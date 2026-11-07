/**
 * Adaptation Locale Différentielle — Routes API
 * Brevet MAINTRIX-SCA — Module Apprentissage Fédéré Adaptatif
 *
 * GET  /api/federated-adapt/config           — paramètres du système (λ_max, k, dimensions)
 * GET  /api/federated-adapt/sites            — profil de maturité du site DEMANDEUR + moyennes de flotte
 * GET  /api/federated-adapt/site/:id         — profil + modèle personnalisé de SON site
 * POST /api/federated-adapt/aggregate        — déclenche l'agrégation différentielle complète
 * GET  /api/federated-adapt/specialization   — rapport SPI du site demandeur + synthèse de flotte
 * GET  /api/federated-adapt/model-dims       — vecteur dimensions + interprétation
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ
 * ═══════════════════════════════════════════════════════════════════
 * Les six routes n'étaient gardées que par `requireAuthentication` : aucun
 * contrôle de rôle, aucun cloisonnement, et pas une seule lecture de
 * `req.tenantId` dans tout le fichier. L'en-tête annonçait d'ailleurs
 * « profils de maturité de TOUS les sites » et « rapport SPI tous sites » :
 * la divulgation était l'intention déclarée, pas un filtre oublié.
 *
 * Relevé de mesure du 2026-11-07 (serveur réel, 3 locataires, données
 * distinctes par site, quatre identités testées) :
 *
 *   route                           | admin  | technician | viewer | pair
 *   --------------------------------|--------|------------|--------|-------
 *   /config                         |   —    |     —      |   —    |   —
 *   /model-dims                     |   —    |     —      |   —    |   —
 *   /sites                          | 2 noms | 2 noms     | 2 noms | 2 noms
 *   /specialization                 | 2 noms | 2 noms     | 2 noms | 2 noms
 *   /site/:id  (identifiant d'autrui)| filet | filet      | filet  | filet
 *   POST /aggregate                 | 2 ids  | 2 ids      | 2 ids  | 2 ids
 *   /federated-ai/improvement-stats |   —    |     —      |   —    |   —
 *
 * Trois enseignements que le relevé d'origine n'avait pas :
 *
 *   1. Le plancher n'est pas l'administrateur mais le `viewer`, niveau 0 du
 *      référentiel (shared/roles.ts), dont la définition est « consulte sans
 *      rien modifier ». Il lisait le taux de succès de maintenance d'un autre
 *      locataire (0,40 pour Beta contre 0,90 pour Alpha).
 *   2. `GET /site/:id` avec l'identifiant d'un AUTRE locataire était déjà
 *      arrêté — mais PAR ACCIDENT, et par le filet anti-fuite, parce que sa
 *      charge est un objet plat dont `tenantId` est au premier niveau. Le lot
 *      A4 a précisément documenté ce filet comme une ALARME de dernier recours
 *      et non comme une garantie. La route n'avait donc aucun contrôle propre :
 *      elle en a un désormais, et ne dépend plus d'une coïncidence de forme.
 *   3. `POST /aggregate` relançait, pour un `viewer`, une agrégation sur TOUTE
 *      l'instance — avec ses écritures dans `federated_sync_state` pour chaque
 *      locataire. Une recomputation de flotte est un acte de pilotage ; elle
 *      exige maintenant au moins `maintenance_manager`.
 *
 * `/config` et `/model-dims` ne servent que des constantes et des formules :
 * mesurés sans aucune donnée de locataire, ils restent inchangés.
 *
 * `/api/federated-ai/improvement-stats` figure au relevé pour être écarté : ses
 * chiffres sont écrits en dur dans server/tenant-integration.ts. Ce n'est pas
 * une fuite, c'est une route simulée — un autre défaut, hors de ce lot.
 *
 * La décision produit retenue — conserver la vue de flotte sous forme de
 * moyennes, retirer les lignes des pairs plutôt que les renommer, et pourquoi
 * le garde super-admin aurait produit une capacité morte — est démontrée au bas
 * de server/federated-adaptation.ts, au-dessus de `SITES_MIN_POUR_AGREGAT`.
 */

import type { Express } from "express";
import {
  runDifferentialAggregation,
  getPersonalizedModelForSite,
  agregatsServables,
  MOTIF_AGREGATS_MASQUES,
  DIM_LABELS,
  MODEL_DIMS,
  LAMBDA_MAX,
} from "./federated-adaptation";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { auMoins } from "@shared/roles";

// Cache last aggregation result (évite de relancer à chaque requête)
let lastAggregation: Awaited<ReturnType<typeof runDifferentialAggregation>> | null = null;
let lastAggregationTs = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCachedAggregation() {
  if (lastAggregation && Date.now() - lastAggregationTs < CACHE_TTL_MS) {
    return lastAggregation;
  }
  lastAggregation = await runDifferentialAggregation();
  lastAggregationTs = Date.now();
  return lastAggregation;
}

/**
 * Le locataire de la session, ou `null`.
 *
 * Il vient de `validateSession` (server/enterprise-auth-middleware.ts), jamais
 * d'un paramètre de requête : c'est ce qui distingue « mon site » d'un site
 * choisi par l'appelant. Sans locataire, on REFUSE au lieu de servir la flotte,
 * parce qu'un cloisonnement qui retombe sur « tout » quand il ne sait pas n'en
 * est pas un.
 */
function locataireDeLaSession(req: any): string | null {
  const tid = req.tenantId ?? req.user?.tenantId;
  return typeof tid === "string" && tid.trim() !== "" ? tid : null;
}

function refuserSansLocataire(res: any) {
  return res.status(403).json({
    error: "TENANT_REQUIS",
    message:
      "Aucun locataire sur la session : l'adaptation fédérée ne peut pas " +
      "déterminer quel site est le vôtre.",
  });
}

export function registerFederatedAdaptationRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  /**
   * GET /api/federated-adapt/config
   * Paramètres du système d'adaptation différentielle
   */
  app.get("/api/federated-adapt/config", auth, (_req, res) => {
    res.json({
      algorithm: "Personalised Federated Learning (pFed) avec couplage élastique",
      formulas: {
        maturity: "M(s) = α·min(1, N_cas/100) + β·min(1, N_patterns/50) + γ·SuccessRate + δ·min(1, Jours/365)",
        weights: { alpha: 0.35, beta: 0.25, gamma: 0.25, delta: 0.15 },
        mixing: `λ(s) = ${LAMBDA_MAX} × (1 − exp(−3.5 × M(s)))`,
        personalized: "θ̂(s) = (1 − λ(s)) × θ_global + λ(s) × θ_local(s)",
        fedAvg: "θ_global = Σ_s [n_s × (1−λ(s)) × θ_local(s)] / Σ_s [n_s × (1−λ(s))]",
        spi: "SPI(s) = 1 − cosineSim(θ_global, θ_local(s))",
      },
      lambdaMax: LAMBDA_MAX,
      kElastic: 3.5,
      modelDims: MODEL_DIMS,
      dimLabels: DIM_LABELS,
      properties: {
        "λ→0": "Site neuf — suit entièrement le modèle global",
        "λ≈0.5": "Site modéré — mélange équilibré global/local",
        "λ→λ_max": "Site ultra-mature — préserve sa spécialisation locale",
        "w(s)=n_s×(1−λ)": "Sites matures contribuent moins au consensus global",
        "SPI→0": "Site non-spécialisé (identique au global)",
        "SPI→1": "Site maximalement spécialisé",
      },
    });
  });

  /**
   * GET /api/federated-adapt/sites
   * Profil de maturité + λ du site DEMANDEUR, et moyennes de la flotte.
   *
   * `sites` reste un TABLEAU, à un élément, et non un objet : l'écran, le type
   * côté client et le calcul du radar s'appuient sur sa forme. La changer
   * aurait imposé une refonte sans rapport avec la divulgation.
   */
  app.get("/api/federated-adapt/sites", auth, async (req: any, res) => {
    try {
      const locataire = locataireDeLaSession(req);
      if (!locataire) return refuserSansLocataire(res);

      const agg = await getCachedAggregation();
      const sien = agg.siteProfiles.find(p => p.tenantId === locataire) ?? null;
      const nSites = agg.siteProfiles.length;
      const servable = agregatsServables(nSites);

      res.json({
        sites: sien ? [sien] : [],
        fleetStats: {
          // La TAILLE de la flotte n'est pas une donnée de pair : elle ne porte
          // aucune métrique d'exploitation, et l'écran en a besoin pour dire
          // « un site parmi N ».
          nSites,
          fleetMaturityAvg: servable ? agg.fleetMaturityAvg : null,
          fleetLambdaAvg: servable ? agg.fleetLambdaAvg : null,
          fleetSPIAvg: servable ? agg.fleetSPIAvg : null,
          nSitesMature: servable ? agg.nSitesMature : null,
          nSitesSpecialized: servable ? agg.nSitesSpecialized : null,
        },
        agregatsMasques: servable ? null : MOTIF_AGREGATS_MASQUES,
        aggregatedAt: agg.aggregatedAt,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/federated-adapt/site/:id
   * Profil complet + modèle personnalisé de SON site.
   *
   * L'identifiant reste dans l'URL — l'écran et les appels existants le
   * passent — mais il est désormais CONFRONTÉ à celui de la session. Avant, il
   * n'était comparé à rien : seule la forme plate de la charge faisait réagir
   * le filet anti-fuite, ce qui n'est pas un contrôle mais une coïncidence.
   */
  app.get("/api/federated-adapt/site/:id", auth, async (req: any, res) => {
    try {
      const locataire = locataireDeLaSession(req);
      if (!locataire) return refuserSansLocataire(res);

      const demande = req.params.id;
      if (demande !== locataire) {
        return res.status(403).json({
          error: "TENANT_MISMATCH",
          message: "Ce site n'appartient pas à votre locataire.",
        });
      }

      const agg = await getCachedAggregation();
      const servable = agregatsServables(agg.siteProfiles.length);
      const result = await getPersonalizedModelForSite(demande, agg.globalModel);
      const poids = agg.aggregationWeights[demande] ?? 0;

      res.json({
        ...result,
        // θ_global et θ̂ sont des moyennes de la flotte : servis sous le seuil,
        // ils révèlent le vecteur d'un pair (démonstration au-dessus de
        // `SITES_MIN_POUR_AGREGAT`). Le SPI, lui, reste servi : un scalaire ne
        // referme pas le système.
        globalVector: servable ? result.globalVector : null,
        personalizedVector: servable ? result.personalizedVector : null,
        globalModel: servable ? agg.globalModel : null,
        // Un poids d'agrégation NORMALISÉ se lit « ma part de la flotte » :
        // avec un seul pair, 1 − ma part est la sienne.
        aggregationWeight: servable ? poids : null,
        agregatsMasques: servable ? null : MOTIF_AGREGATS_MASQUES,
        dimLabels: DIM_LABELS,
        interpretation: {
          lambda: `λ = ${result.mixingCoefficient.toFixed(3)} — le site conserve ${(result.mixingCoefficient * 100).toFixed(1)}% de son modèle local`,
          spi: `SPI = ${result.spi.toFixed(3)} — ${result.spi > 0.5 ? "site fortement spécialisé" : result.spi > 0.2 ? "spécialisation modérée" : "proche du modèle global"}`,
          globalContrib: servable
            ? `Ce site contribue ${(poids * 100).toFixed(1)}% au modèle global commun`
            : MOTIF_AGREGATS_MASQUES,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/federated-adapt/aggregate
   * Déclenche l'agrégation différentielle complète (invalide le cache).
   *
   * Réservé au pilotage. Ce n'est pas une lecture : le traitement parcourt TOUS
   * les locataires actifs et écrit dans `federated_sync_state` pour chacun.
   * Mesuré : un `viewer` — « consulte sans rien modifier » — pouvait le
   * déclencher. `auMoins` passe par le référentiel partagé, qui normalise les
   * deux côtés de la comparaison : les anciennes valeurs encore en base
   * (`manager`, `director`…) sont donc traitées correctement, ce qu'une
   * comparaison littérale ne ferait pas.
   */
  app.post("/api/federated-adapt/aggregate", auth, async (req: any, res) => {
    try {
      const locataire = locataireDeLaSession(req);
      if (!locataire) return refuserSansLocataire(res);

      if (!auMoins(req.user?.role, "maintenance_manager")) {
        return res.status(403).json({
          error: "PRIVILEGES_INSUFFISANTS",
          message:
            "Relancer l'agrégation fédérée porte sur toute la flotte : cette " +
            "action est réservée au pilotage de la maintenance.",
        });
      }

      lastAggregationTs = 0; // invalide le cache
      const result = await getCachedAggregation();
      const nSites = result.siteProfiles.length;
      const servable = agregatsServables(nSites);

      res.json({
        success: true,
        // Même règle que sur les lectures : le demandeur ne reçoit que SA part
        // et les moyennes, jamais le dictionnaire des poids de la flotte ni les
        // alertes de dérive d'autrui.
        globalModel: servable ? result.globalModel : null,
        nSites,
        fleetMaturityAvg: servable ? result.fleetMaturityAvg : null,
        fleetLambdaAvg: servable ? result.fleetLambdaAvg : null,
        fleetSPIAvg: servable ? result.fleetSPIAvg : null,
        nSitesMature: servable ? result.nSitesMature : null,
        nSitesSpecialized: servable ? result.nSitesSpecialized : null,
        driftAlerts: result.driftAlerts.filter(a => a.tenantId === locataire),
        aggregationWeights: servable
          ? { [locataire]: result.aggregationWeights[locataire] ?? 0 }
          : {},
        agregatsMasques: servable ? null : MOTIF_AGREGATS_MASQUES,
        aggregatedAt: result.aggregatedAt,
        dimLabels: DIM_LABELS,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/federated-adapt/specialization
   * Rapport SPI du site demandeur : sur quelles dimensions il se spécialise, et
   * comment il se situe dans la flotte.
   */
  app.get("/api/federated-adapt/specialization", auth, async (req: any, res) => {
    try {
      const locataire = locataireDeLaSession(req);
      if (!locataire) return refuserSansLocataire(res);

      const agg = await getCachedAggregation();
      const nSites = agg.siteProfiles.length;
      const servable = agregatsServables(nSites);

      const spiReport = agg.personalizedModels
        .filter(pm => pm.tenantId === locataire)
        .map(pm => {
          const profile = agg.siteProfiles.find(p => p.tenantId === pm.tenantId);

          // Dimensions où le modèle local dépasse le global (spécialisation
          // positive). Comparer à θ_global reste une opération SERVEUR : ce qui
          // sort est la liste des dimensions, pas le vecteur global.
          const dimDiffs = DIM_LABELS.map((lbl, i) => ({
            dim: lbl,
            local: pm.localVector[i],
            global: pm.globalVector[i],
            delta: pm.localVector[i] - pm.globalVector[i],
            isSpecialized: pm.localVector[i] > pm.globalVector[i] * 1.2,
          }));

          const specializedDims = dimDiffs.filter(d => d.isSpecialized);

          return {
            tenantId: pm.tenantId,
            tenantName: profile?.tenantName ?? pm.tenantId,
            spi: pm.spi,
            lambda: pm.mixingCoefficient,
            maturity: profile?.maturityScore ?? 0,
            specializedDims,
            nSpecializedDims: specializedDims.length,
            dominantSpecialization: dimDiffs.sort((a, b) => b.delta - a.delta)[0]?.dim ?? "none",
            riskLevel: pm.spi > 0.6 && (profile?.maturityScore ?? 0) < 0.3
              ? "artefact"
              : pm.spi > 0.5 ? "specialized"
              : pm.spi > 0.2 ? "emerging"
              : "generic",
          };
        });

      res.json({
        spiReport,
        globalModel: servable ? agg.globalModel : null,
        dimLabels: DIM_LABELS,
        agregatsMasques: servable ? null : MOTIF_AGREGATS_MASQUES,
        summary: {
          nSites,
          // Un compteur par classe est un histogramme de la flotte : avec deux
          // pairs, il dit lequel est spécialisé. Même seuil que les moyennes.
          nGeneric: servable ? agg.personalizedModels.filter(m => m.spi <= 0.2).length : null,
          nEmerging: servable
            ? agg.personalizedModels.filter(m => m.spi > 0.2 && m.spi <= 0.5).length
            : null,
          nSpecialized: servable ? agg.personalizedModels.filter(m => m.spi > 0.5).length : null,
          nArtefact: servable
            ? agg.personalizedModels.filter(m => {
                const p = agg.siteProfiles.find(sp => sp.tenantId === m.tenantId);
                return m.spi > 0.6 && (p?.maturityScore ?? 0) < 0.3;
              }).length
            : null,
          maxSPI: servable ? Math.max(...agg.personalizedModels.map(m => m.spi), 0) : null,
          avgSPI: servable ? agg.fleetSPIAvg : null,
          driftAlerts: agg.driftAlerts.filter(a => a.tenantId === locataire),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/federated-adapt/model-dims
   * Interprétation des 12 dimensions du vecteur modèle
   */
  app.get("/api/federated-adapt/model-dims", auth, (_req, res) => {
    res.json({
      dims: DIM_LABELS.map((lbl, i) => ({
        index: i,
        name: lbl,
        category: i < 6 ? "sensor_weight" : i < 11 ? "failure_mode" : "threshold",
        description: [
          "Poids capteur vibration (défauts mécaniques)",
          "Poids capteur température (surchauffe, friction)",
          "Poids capteur pression (défauts hydrauliques)",
          "Poids capteur courant électrique",
          "Poids capteur acoustique (bruits parasites)",
          "Poids capteur vitesse/rotation",
          "Probabilité défaillance roulement/palier",
          "Probabilité défaillance lubrification",
          "Probabilité surchauffe",
          "Probabilité cavitation",
          "Probabilité défaut électrique",
          "Sensibilité seuil IMCA (ajustement local)",
        ][i],
      })),
      priorUniform: new Array(MODEL_DIMS).fill(1 / MODEL_DIMS),
      lambdaTable: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0].map(m => ({
        maturity: m,
        lambda: LAMBDA_MAX * (1 - Math.exp(-3.5 * m)),
        interpretation: m < 0.2 ? "site neuf" : m < 0.5 ? "site intermédiaire" : m < 0.8 ? "site mature" : "site expert",
      })),
    });
  });

  console.log("🧬 Routes Adaptation Fédérée Différentielle enregistrées (pFed · λ-elastic · SPI · FedAvg pondéré)");
}

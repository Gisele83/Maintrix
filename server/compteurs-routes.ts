/**
 * ═══════════════════════════════════════════════════════════════════
 * COMPTEURS D'USAGE — SUIVI, RELEVÉS, SEUILS
 * ═══════════════════════════════════════════════════════════════════
 *
 * CE QUI ÉTAIT, ET MESURÉ
 * ───────────────────────────────────────────────────────────────────
 * Le module des compteurs était écrit en entier et joignable par rien.
 * Recensement du 2026-10-26 :
 *
 *   • AUCUNE route du serveur ne servait `maintenance_counters` ;
 *   • `incrementCounter()` — zéro appelant. Rien n'augmentait `current_value` ;
 *   • `updateMaintenanceCounter()`, `deleteMaintenanceCounter()`,
 *     `getCounterHistory()`, `getMaintenanceCounterById()`,
 *     `getMaintenanceCountersByEquipment()` — zéro appelant ;
 *   • `increment_rate` — colonne jamais écrite, jamais lue.
 *
 * Un compteur pouvait donc être créé (le formulaire de plan préventif en
 * envoie un) mais jamais consulté, jamais relevé, jamais corrigé. Il ne
 * franchissait son seuil que si quelqu'un éditait la base à la main — et la
 * remise à zéro à la clôture d'un OT (migration 0024) n'avait alors rien à
 * remettre.
 *
 * L'INCRÉMENTATION EST UN RELEVÉ, PAS UNE DÉRIVE SIMULÉE
 * ───────────────────────────────────────────────────────────────────
 * `increment_rate` invitait à faire croître les compteurs automatiquement. On
 * ne le fait pas : une cadence nominale déclarée n'est pas une mesure, et un
 * compteur ainsi alimenté afficherait un usage INVENTÉ qui déclencherait de
 * vraies alertes sur de vraies machines. Le dépôt a une barrière dédiée contre
 * les chiffres fabriqués (tests/unit/aucun-chiffre-invente.test.ts), et rien
 * dans le système ne mesure le temps de marche réel d'un équipement —
 * `iot_sensor_data` porte des grandeurs physiques, pas un signal « en
 * fonctionnement ».
 *
 * Le relevé manuel est la seule source honnête, et c'est la pratique du
 * métier : un compteur horaire se lit sur la machine.
 *
 * DROITS
 * ───────────────────────────────────────────────────────────────────
 * Le découpage suit le geste, pas la commodité :
 *
 *   • RELEVER est le travail quotidien d'un technicien → aucun niveau exigé
 *     au-delà de l'authentification. Exiger un chef d'équipe pour saisir un
 *     relevé garantirait que personne ne le saisit.
 *   • DÉFINIR OU MODIFIER UN SEUIL est un acte d'ingénierie de maintenance :
 *     c'est lui qui décide quand une machine est déclarée due. → chef d'équipe.
 *   • REMETTRE À ZÉRO À LA MAIN efface un relevé d'usage sans intervention
 *     pour le justifier. → chef d'équipe (la clôture d'un OT, elle, le fait
 *     automatiquement et avec sa trace).
 *   • SUPPRIMER détruit l'historique d'usage d'un équipement. → directeur
 *     technique, comme la suppression d'un plan ou d'un ordre de travail.
 */
import type { Express } from "express";
import { z } from "zod";
import { auMoins } from "@shared/roles";
import { releveCompteurPayloadSchema } from "@shared/schema";
import {
  gmaoStorage,
  CompteurDesactive,
  CompteurIntrouvable,
} from "./gmao-storage";
import { tenantRequis } from "./tenant-requis";

function auMoinsNiveau(req: any, minimum: Parameters<typeof auMoins>[1]): boolean {
  return auMoins(req.user?.role, minimum);
}

/**
 * Traduit les erreurs métier du module en codes HTTP, et rien d'autre en 500.
 *
 * La convention du dépôt : 403 = rôle refusé, 404 = rôle accepté mais objet
 * absent, 409 = requête bien formée que l'état contredit. Un compteur d'autrui
 * doit se lire comme un objet absent, sans révéler qu'il existe ailleurs.
 */
function repondreErreur(res: any, error: unknown, contexte: string) {
  if (error instanceof CompteurIntrouvable) {
    return res.status(404).json({ error: "COMPTEUR_INTROUVABLE", message: error.message });
  }
  if (error instanceof CompteurDesactive) {
    return res.status(409).json({ error: "COMPTEUR_DESACTIVE", message: error.message });
  }
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      error: "SAISIE_INVALIDE",
      message: error.issues.map((i) => i.message).join(" ; "),
    });
  }
  console.error(`${contexte} :`, error);
  return res.status(500).json({
    error: "ERREUR_SERVEUR",
    message: error instanceof Error ? error.message : "Erreur inconnue",
  });
}

/** Champs modifiables d'un compteur. Volontairement restreint. */
const modificationCompteurSchema = z.object({
  description: z.string().max(200).optional(),
  counterType: z.enum(["hours", "cycles", "kilometers", "units"]).optional(),
  thresholdValue: z.coerce.number().finite().positive().max(10_000_000).optional(),
  warningThresholdPct: z.coerce.number().finite().min(1).max(100).optional(),
  maintenanceType: z.string().max(200).optional(),
  isActive: z.boolean().optional(),
  // `currentValue` n'est PAS modifiable ici, et c'est délibéré : faire avancer
  // ou reculer un compteur par une édition de champ laisserait l'usage changer
  // sans trace. Pour l'augmenter, on enregistre un relevé ; pour le ramener à
  // zéro, on le remet à zéro. Les deux laissent une ligne d'historique.
}).strict();

/** Création d'un compteur indépendamment d'un plan. */
const creationCompteurSchema = z.object({
  equipmentId: z.coerce.number().int().positive(),
  counterType: z.enum(["hours", "cycles", "kilometers", "units"]),
  description: z.string().min(1, "Un libellé est requis").max(200),
  currentValue: z.coerce.number().finite().min(0).max(10_000_000).default(0),
  thresholdValue: z.coerce.number().finite().positive("Le seuil doit être strictement positif").max(10_000_000),
  warningThresholdPct: z.coerce.number().finite().min(1).max(100).default(90),
  planId: z.coerce.number().int().positive().nullable().optional(),
  maintenanceType: z.string().max(200).optional(),
});

export function registerCompteurRoutes(app: Express) {
  /**
   * Les compteurs du locataire, éventuellement filtrés sur un plan.
   *
   * Le filtre `planId` est appliqué par le serveur et non par le client : il
   * évite de servir tout le parc pour n'en afficher qu'un ou deux (la boîte de
   * clôture d'un ordre de travail s'en sert ainsi). Le locataire, lui, vient
   * toujours de la session.
   */
  app.get("/api/maintenance-counters", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;

      const compteurs = await gmaoStorage.getMaintenanceCounters(tenantId);

      // L'ordre de travail déjà ouvert pour la gamme du compteur, s'il existe.
      //
      // Sans cette information, un compteur affiche « échéance atteinte » sans
      // dire qu'un ordre a DÉJÀ été créé pour elle — et l'exploitant en saisit
      // un second à la main, pour un travail déjà programmé. La clé composée
      // est celle de la garde d'idempotence du serveur, pour que l'écran
      // montre exactement ce qui est considéré comme pris en charge.
      const ordresOuverts = await gmaoStorage.getOrdresPreventifsOuvertsParPlan(tenantId);
      const avecOrdre = compteurs.map((c) => ({
        ...c,
        ordreTravailOuvert:
          c.planId != null && c.equipmentId != null
            ? ordresOuverts.get(`${c.planId}:${c.equipmentId}`) ?? null
            : null,
      }));

      const filtrePlan = req.query.planId;
      if (filtrePlan !== undefined && filtrePlan !== '') {
        const planId = parseInt(String(filtrePlan), 10);
        if (!Number.isInteger(planId)) {
          return res.status(400).json({ error: "SAISIE_INVALIDE", message: "planId invalide" });
        }
        return res.json(avecOrdre.filter((c) => c.planId === planId));
      }

      res.json(avecOrdre);
    } catch (error) {
      repondreErreur(res, error, "Lecture des compteurs");
    }
  });

  /**
   * L'histoire d'un compteur : relevés ET remises à zéro, réunis.
   *
   * Les deux vivent dans des tables distinctes parce qu'ils ne décrivent pas
   * le même geste, mais les lire séparément ne dit rien : une suite de relevés
   * sans les remises à zéro donne une courbe qui semble redescendre sans
   * raison.
   */
  app.get("/api/maintenance-counters/:id/history", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "SAISIE_INVALIDE", message: "Identifiant invalide" });
      }

      // `getHistoriqueCompteur` rend un tableau vide pour un compteur hors
      // périmètre. On distingue ici « pas d'histoire » de « pas mon compteur »,
      // sinon un compteur d'autrui se lirait comme un compteur neuf.
      const compteur = await gmaoStorage.getMaintenanceCounterById(id, tenantId);
      if (!compteur) throw new CompteurIntrouvable(id);

      res.json(await gmaoStorage.getHistoriqueCompteur(id, tenantId));
    } catch (error) {
      repondreErreur(res, error, "Lecture de l'historique d'un compteur");
    }
  });

  /**
   * ENREGISTRER UN RELEVÉ — c'est l'incrémentation.
   *
   * L'usage déclaré est un ÉCART depuis le relevé précédent, pas la valeur
   * absolue lue sur la machine. La distinction est portée par l'interface, qui
   * affiche la valeur résultante avant de confirmer : saisir 1 240 là où l'on
   * attend 40 porterait le compteur très au-delà de son seuil et déclencherait
   * une alerte fausse.
   *
   * Aucun niveau exigé : relever un compteur est le travail quotidien d'un
   * technicien.
   */
  app.post("/api/maintenance-counters/:id/readings", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "SAISIE_INVALIDE", message: "Identifiant invalide" });
      }

      const { usage, notes } = releveCompteurPayloadSchema.parse(req.body);

      const { compteur, releve } = await gmaoStorage.enregistrerReleveCompteur(id, tenantId, usage, {
        // L'auteur vient de la SESSION, jamais du corps : un relevé signé d'un
        // identifiant fourni par le client imputerait la saisie à n'importe qui.
        recordedBy: (req as any).user?.id ?? null,
        notes,
      });

      res.status(201).json({ compteur, releve });
    } catch (error) {
      repondreErreur(res, error, "Enregistrement d'un relevé");
    }
  });

  /**
   * Remise à zéro MANUELLE.
   *
   * La clôture d'un ordre de travail le fait automatiquement pour les
   * compteurs de son plan (migration 0024). Celle-ci sert au cas où
   * l'intervention a été faite hors GMAO, ou pour corriger une saisie — d'où
   * le motif OBLIGATOIRE : une remise à zéro efface un relevé d'usage, et sans
   * motif l'historique ne dirait pas pourquoi.
   */
  app.post("/api/maintenance-counters/:id/reset", async (req, res) => {
    try {
      if (!auMoinsNiveau(req, 'team_leader')) {
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "Droits insuffisants pour remettre un compteur à zéro",
        });
      }
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "SAISIE_INVALIDE", message: "Identifiant invalide" });
      }

      const { motif } = z.object({
        motif: z.string().min(3, "Un motif est requis pour une remise à zéro manuelle").max(300),
      }).parse(req.body);

      const compteur = await gmaoStorage.getMaintenanceCounterById(id, tenantId);
      if (!compteur) throw new CompteurIntrouvable(id);

      const remis = await gmaoStorage.resetCounter(
        id,
        tenantId,
        motif,
        (req as any).user?.id ?? null,
        undefined,
      );

      res.json(remis);
    } catch (error) {
      repondreErreur(res, error, "Remise à zéro d'un compteur");
    }
  });

  /** Créer un compteur, indépendamment d'un plan préventif. */
  app.post("/api/maintenance-counters", async (req, res) => {
    try {
      if (!auMoinsNiveau(req, 'team_leader')) {
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "Droits insuffisants pour créer un compteur",
        });
      }
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;

      const donnees = creationCompteurSchema.parse(req.body);

      // L'équipement doit être CELUI DU DEMANDEUR. La clé étrangère garantit
      // qu'il existe, pas à qui il est : sans ce contrôle, un compteur se
      // poserait sur la machine d'une autre organisation.
      const equipement = await gmaoStorage.getEquipmentById(donnees.equipmentId, tenantId);
      if (!equipement) {
        return res.status(404).json({
          error: "EQUIPEMENT_INTROUVABLE",
          message: `Équipement #${donnees.equipmentId} non trouvé`,
        });
      }

      // Même raison pour le plan, et la conséquence est plus large : un
      // compteur rattaché au plan d'autrui serait remis à zéro par la clôture
      // d'un ordre de travail de cette autre organisation.
      if (donnees.planId != null) {
        const plan = await gmaoStorage.getPreventiveMaintenancePlanById(donnees.planId, tenantId);
        if (!plan) {
          return res.status(404).json({
            error: "PLAN_INTROUVABLE",
            message: `Plan de maintenance préventive #${donnees.planId} non trouvé`,
          });
        }
      }

      const compteur = await gmaoStorage.createMaintenanceCounter({
        tenantId,
        equipmentId: donnees.equipmentId,
        equipmentName: equipement.equipmentName,
        counterType: donnees.counterType,
        description: donnees.description,
        currentValue: donnees.currentValue,
        thresholdValue: donnees.thresholdValue,
        warningThresholdPct: donnees.warningThresholdPct,
        planId: donnees.planId ?? null,
        maintenanceType: donnees.maintenanceType,
        isActive: true,
      });

      // Un compteur créé déjà au-delà de son seuil doit le dire tout de suite :
      // c'est le cas d'une machine reprise en main avec un retard d'entretien.
      // Et si le compteur porte une gamme, l'ordre de travail est créé dès
      // maintenant — le retard d'entretien est du travail à faire, pas
      // seulement une information.
      await gmaoStorage.traiterEcheanceCompteur(compteur);

      res.status(201).json(compteur);
    } catch (error) {
      repondreErreur(res, error, "Création d'un compteur");
    }
  });

  /** Modifier un compteur : libellé, seuils, activation. Jamais sa valeur. */
  app.put("/api/maintenance-counters/:id", async (req, res) => {
    try {
      if (!auMoinsNiveau(req, 'team_leader')) {
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "Droits insuffisants pour modifier un compteur",
        });
      }
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "SAISIE_INVALIDE", message: "Identifiant invalide" });
      }

      const modifications = modificationCompteurSchema.parse(req.body);
      if (Object.keys(modifications).length === 0) {
        return res.status(400).json({ error: "SAISIE_INVALIDE", message: "Aucune modification fournie" });
      }

      const existant = await gmaoStorage.getMaintenanceCounterById(id, tenantId);
      if (!existant) throw new CompteurIntrouvable(id);

      const compteur = await gmaoStorage.updateMaintenanceCounter(id, tenantId, modifications);

      // Un seuil ABAISSÉ peut rendre due une échéance qui ne l'était pas. Sans
      // cette relecture, le compteur resterait « info » jusqu'au relevé
      // suivant, c'est-à-dire potentiellement des semaines après que
      // l'ingénierie a décidé que la périodicité était trop longue.
      if (modifications.thresholdValue !== undefined || modifications.warningThresholdPct !== undefined) {
        await gmaoStorage.traiterEcheanceCompteur(compteur);
      }

      res.json(compteur);
    } catch (error) {
      repondreErreur(res, error, "Modification d'un compteur");
    }
  });

  /** Supprimer un compteur et tout son historique d'usage. */
  app.delete("/api/maintenance-counters/:id", async (req, res) => {
    try {
      if (!auMoinsNiveau(req, 'technical_director')) {
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "Droits insuffisants pour supprimer un compteur",
        });
      }
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "SAISIE_INVALIDE", message: "Identifiant invalide" });
      }

      const existant = await gmaoStorage.getMaintenanceCounterById(id, tenantId);
      if (!existant) throw new CompteurIntrouvable(id);

      await gmaoStorage.deleteMaintenanceCounter(id, tenantId);
      res.json({ success: true });
    } catch (error) {
      repondreErreur(res, error, "Suppression d'un compteur");
    }
  });
}

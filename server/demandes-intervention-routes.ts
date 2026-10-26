/**
 * ═══════════════════════════════════════════════════════════════════
 * DEMANDES D'INTERVENTION — l'exploitant signale, la maintenance arbitre
 * ═══════════════════════════════════════════════════════════════════
 *
 * CE QUI MANQUAIT
 * ───────────────────────────────────────────────────────────────────
 * Aucune table ne portait la demande d'intervention (audit du 2026-10-25,
 * section 1). La conséquence que ces routes referment, et qui est la plus
 * citée par l'audit : « n'importe qui devait créer directement un ordre de
 * travail, c'est-à-dire engager la planification et le budget », et « le refus
 * motivé n'existait pas, donc la charge non traitée n'était pas mesurable ».
 *
 * LE DÉCOUPAGE DES DROITS SUIT LE GESTE
 * ───────────────────────────────────────────────────────────────────
 *   • SIGNALER est ouvert à tout utilisateur authentifié. C'est le point. Un
 *     opérateur qui voit une fuite doit pouvoir la signaler sans habilitation,
 *     et sans engager de budget. Exiger un niveau ici reproduirait exactement
 *     le défaut qu'on corrige.
 *   • ARBITRER (accepter ou refuser) demande un chef d'équipe : c'est
 *     l'acte qui engage la planification, et la raison d'être de la séparation.
 *   • ANNULER sa propre demande reste ouvert à son auteur — on ne force
 *     personne à faire arbitrer un signalement fait par erreur. Un arbitre
 *     peut annuler n'importe quelle demande.
 *
 * POURQUOI L'ALERTE PASSE PAR ICI
 * ───────────────────────────────────────────────────────────────────
 * `POST /api/alerts/:id/demande-intervention` ferme la boucle « alerte → OT »
 * de l'audit, et la fait passer par l'arbitrage. Une alerte est un SYMPTÔME,
 * pas une décision : elle peut être un faux positif, un doublon, ou un
 * phénomène connu. En faire un ordre de travail directement fabriquerait du
 * travail dans le dos de la maintenance — le reproche même que l'audit adresse
 * à l'absence de DI. À l'inverse d'un compteur, dont le seuil EST une décision
 * d'ingénierie déjà prise (migration 0025).
 */
import type { Express } from "express";
import { z } from "zod";
import { auMoins } from "@shared/roles";
import {
  demandeInterventionPayloadSchema,
  arbitrageAcceptationSchema,
  arbitrageRefusSchema,
} from "@shared/schema";
import {
  gmaoStorage,
  DemandeIntrouvable,
  DemandeDejaArbitree,
} from "./gmao-storage";
import { tenantRequis } from "./tenant-requis";

function auMoinsNiveau(req: any, minimum: Parameters<typeof auMoins>[1]): boolean {
  return auMoins(req.user?.role, minimum);
}

/** Convention du dépôt : 403 = rôle refusé, 404 = objet absent, 409 = état contredit. */
function repondreErreur(res: any, error: unknown, contexte: string) {
  if (error instanceof DemandeIntrouvable) {
    return res.status(404).json({ error: "DEMANDE_INTROUVABLE", message: error.message });
  }
  if (error instanceof DemandeDejaArbitree) {
    return res.status(409).json({ error: "DEMANDE_DEJA_ARBITREE", message: error.message, etat: error.etat });
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

const ETATS = ['pending', 'accepted', 'rejected', 'cancelled'] as const;

export function registerDemandeInterventionRoutes(app: Express) {
  /**
   * Les demandes du locataire, éventuellement filtrées par état, avec le
   * compte par état — la CHARGE, y compris celle qu'on a écartée.
   *
   * C'est la mesure que l'absence de table rendait impossible. Elle est servie
   * avec la liste plutôt que par une seconde route : un écran qui afficherait
   * « 12 en attente » sans pouvoir les lister ne servirait à rien, et deux
   * appels donneraient deux instants différents.
   */
  app.get("/api/demandes-intervention", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;

      const etat = req.query.status;
      if (etat !== undefined && etat !== '' && !ETATS.includes(String(etat) as any)) {
        return res.status(400).json({
          error: "SAISIE_INVALIDE",
          message: `État inconnu. Attendu : ${ETATS.join(', ')}`,
        });
      }

      const demandes = await gmaoStorage.getDemandesIntervention(tenantId, {
        status: etat && etat !== '' ? String(etat) : undefined,
      });
      const charge = await gmaoStorage.getChargeDemandes(tenantId);

      res.json({ demandes, charge });
    } catch (error) {
      repondreErreur(res, error, "Lecture des demandes d'intervention");
    }
  });

  /**
   * SIGNALER. Aucun niveau exigé — c'est le geste le plus simple du produit.
   */
  app.post("/api/demandes-intervention", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;

      const donnees = demandeInterventionPayloadSchema.parse(req.body);

      // L'équipement, s'il est nommé, doit être CELUI DU DEMANDEUR. La clé
      // étrangère garantit qu'il existe, pas à qui il est : sans ce contrôle,
      // une demande se poserait sur la machine d'une autre organisation.
      if (donnees.equipmentId != null) {
        const equipement = await gmaoStorage.getEquipmentById(donnees.equipmentId, tenantId);
        if (!equipement) {
          return res.status(404).json({
            error: "EQUIPEMENT_INTROUVABLE",
            message: `Équipement #${donnees.equipmentId} non trouvé`,
          });
        }
      }

      const demande = await gmaoStorage.createDemandeIntervention({
        tenantId,
        title: donnees.title,
        description: donnees.description,
        urgency: donnees.urgency,
        equipmentId: donnees.equipmentId ?? null,
        reportedLocation: donnees.reportedLocation,
        // Le demandeur vient de la SESSION, jamais du corps : une demande
        // signée d'un identifiant fourni par le client attribuerait le
        // signalement à n'importe qui.
        requestedBy: (req as any).user?.id ?? null,
        status: 'pending',
      });

      res.status(201).json(demande);
    } catch (error) {
      repondreErreur(res, error, "Création d'une demande d'intervention");
    }
  });

  /**
   * SIGNALER UNE ALERTE à la maintenance — la boucle « alerte → OT ».
   *
   * L'alerte fournit le titre, le message et l'équipement : le signalement ne
   * se ressaisit pas. L'urgence proposée est déduite de la SÉVÉRITÉ de
   * l'alerte, qui est une mesure, mais elle reste une urgence PERÇUE : c'est
   * l'arbitre qui fixera la priorité de l'ordre.
   */
  app.post("/api/alerts/:id/demande-intervention", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const alertId = parseInt(req.params.id, 10);
      if (!Number.isInteger(alertId)) {
        return res.status(400).json({ error: "SAISIE_INVALIDE", message: "Identifiant d'alerte invalide" });
      }

      const alerte = await gmaoStorage.getAlertById(alertId, tenantId);
      if (!alerte) {
        return res.status(404).json({ error: "ALERTE_INTROUVABLE", message: `Alerte #${alertId} non trouvée` });
      }

      // GARDE : une alerte déjà signalée ne produit pas un doublon. Une
      // demande REFUSÉE ou annulée, en revanche, ne bloque pas : les
      // circonstances ont pu changer, et re-signaler est alors légitime.
      const existante = await gmaoStorage.getDemandePourAlerte(alertId, tenantId);
      if (existante) {
        return res.status(409).json({
          error: "ALERTE_DEJA_SIGNALEE",
          message: `Cette alerte a déjà fait l'objet de la demande ${existante.requestNumber}.`,
          demande: existante,
        });
      }

      // La sévérité de l'alerte est une mesure ; l'urgence perçue s'y aligne.
      // `medium` par défaut plutôt que `high` : une alerte sans sévérité
      // connue ne justifie pas de passer devant les autres.
      const urgenceSelonSeverite: Record<string, 'low' | 'medium' | 'high' | 'urgent'> = {
        low: 'low', medium: 'medium', high: 'high', critical: 'urgent',
      };

      // `trigger_value` et `threshold_value` sont des `decimal(15,6)` : relus
      // tels quels, ils s'écrivent « 3.400000 ». Un message que des humains
      // lisent ne doit pas porter la précision de la colonne — on retire les
      // zéros de queue sans toucher à la valeur.
      const sansZerosDeQueue = (v: unknown): string | null => {
        if (v == null) return null;
        const n = Number(v);
        return Number.isFinite(n) ? String(n) : String(v);
      };
      const releve = sansZerosDeQueue(alerte.triggerValue);
      const seuil = sansZerosDeQueue(alerte.thresholdValue);

      const demande = await gmaoStorage.createDemandeIntervention({
        tenantId,
        title: alerte.title,
        description:
          `${alerte.message}\n\n` +
          `— Signalé depuis l'alerte #${alerte.id} (${alerte.alertType}, sévérité ${alerte.severity ?? 'non précisée'})` +
          (releve != null && seuil != null
            ? `, relevé ${releve} pour un seuil de ${seuil}.`
            : '.'),
        urgency: urgenceSelonSeverite[alerte.severity ?? ''] ?? 'medium',
        equipmentId: alerte.equipmentId ?? null,
        alertId: alerte.id,
        requestedBy: (req as any).user?.id ?? null,
        status: 'pending',
      });

      res.status(201).json(demande);
    } catch (error) {
      repondreErreur(res, error, "Signalement d'une alerte");
    }
  });

  /**
   * ARBITRER — ACCEPTER : la demande devient un ordre de travail.
   *
   * Le type et la priorité viennent de l'ARBITRE, et non de la demande :
   * l'urgence perçue par le demandeur reste une information, elle n'engage pas
   * la planification. C'est toute la raison d'être de la séparation DI / OT.
   */
  app.post("/api/demandes-intervention/:id/accepter", async (req, res) => {
    try {
      if (!auMoinsNiveau(req, 'team_leader')) {
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "Seule la maintenance arbitre les demandes d'intervention",
        });
      }
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "SAISIE_INVALIDE", message: "Identifiant invalide" });
      }

      const decision = arbitrageAcceptationSchema.parse(req.body ?? {});

      // Le technicien affecté, s'il est nommé, doit appartenir au locataire :
      // sans ce contrôle, un ordre serait affecté à quelqu'un d'une autre
      // organisation, qui le verrait dans sa liste de travail.
      if (decision.assignedTo != null) {
        const profils = await gmaoStorage.getIdentifiantsProfils(tenantId);
        if (!profils.some((p) => p.id === decision.assignedTo)) {
          return res.status(404).json({
            error: "UTILISATEUR_INTROUVABLE",
            message: `Utilisateur #${decision.assignedTo} non trouvé dans cette organisation`,
          });
        }
      }

      const { demande, ordre } = await gmaoStorage.accepterDemandeIntervention(id, tenantId, {
        ...decision,
        reviewedBy: (req as any).user?.id ?? null,
      });

      console.log(
        `Demande ${demande.requestNumber} acceptée → ordre de travail ${ordre.orderNumber}`,
      );
      res.status(201).json({ demande, ordre });
    } catch (error) {
      repondreErreur(res, error, "Acceptation d'une demande d'intervention");
    }
  });

  /**
   * ARBITRER — REFUSER, avec un motif OBLIGATOIRE.
   *
   * C'est le défaut n° 2 de l'audit qu'on referme : sans motif, un refus est
   * indistinguable d'un oubli, et personne ne peut dire combien de
   * signalements ont été écartés ni pourquoi. Le schéma exige cinq caractères
   * au minimum — pas pour la forme, mais pour qu'« ok » ne passe pas.
   */
  app.post("/api/demandes-intervention/:id/refuser", async (req, res) => {
    try {
      if (!auMoinsNiveau(req, 'team_leader')) {
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "Seule la maintenance arbitre les demandes d'intervention",
        });
      }
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "SAISIE_INVALIDE", message: "Identifiant invalide" });
      }

      const { rejectionReason } = arbitrageRefusSchema.parse(req.body ?? {});

      const demande = await gmaoStorage.refuserDemandeIntervention(
        id, tenantId, rejectionReason, (req as any).user?.id ?? null,
      );

      res.json(demande);
    } catch (error) {
      repondreErreur(res, error, "Refus d'une demande d'intervention");
    }
  });

  /**
   * ANNULER sa propre demande, tant qu'elle n'est pas arbitrée.
   *
   * Ouvert à l'AUTEUR de la demande, et à un arbitre pour n'importe laquelle.
   * On ne force personne à faire arbitrer un signalement fait par erreur, mais
   * on n'autorise pas non plus un tiers à retirer le signalement d'autrui : ce
   * serait un moyen de faire disparaître une charge sans la refuser, donc sans
   * laisser de motif — exactement le trou qu'on vient de combler.
   */
  app.post("/api/demandes-intervention/:id/annuler", async (req, res) => {
    try {
      const tenantId = tenantRequis(req as any, res as any);
      if (!tenantId) return;
      const id = parseInt(req.params.id, 10);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "SAISIE_INVALIDE", message: "Identifiant invalide" });
      }

      const demande = await gmaoStorage.getDemandeInterventionById(id, tenantId);
      if (!demande) throw new DemandeIntrouvable(id);

      const utilisateur = (req as any).user?.id ?? null;
      const estAuteur = demande.requestedBy != null && demande.requestedBy === utilisateur;
      if (!estAuteur && !auMoinsNiveau(req, 'team_leader')) {
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "Seul l'auteur de la demande, ou la maintenance, peut l'annuler",
        });
      }

      res.json(await gmaoStorage.annulerDemandeIntervention(id, tenantId));
    } catch (error) {
      repondreErreur(res, error, "Annulation d'une demande d'intervention");
    }
  });
}

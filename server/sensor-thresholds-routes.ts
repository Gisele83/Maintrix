/**
 * Réglage des seuils d'alarme, par machine et par grandeur.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CES ROUTES EXISTENT
 * ═══════════════════════════════════════════════════════════════════
 * `equipment-health-routes.ts` jugeait tous les capteurs de toutes les
 * installations contre quatre constantes écrites dans le code : température
 * 75, vibration 4,5, pression 4,0, courant 10. Ces nombres ne décrivent aucune
 * installation en particulier — une chaudière vapeur travaille à 9 bar, une
 * presse hydraulique à 185, un moteur de 75 kW tire 130 A — et rendaient donc
 * toute usine réelle « critique » en permanence.
 *
 * La détection statistique de `shared/supervision.ts` a retiré ces constantes
 * et comblé le vide : chaque capteur est comparé à son propre historique. Mais
 * elle a une limite assumée, qu'aucun réglage de sa part ne lèvera jamais —
 * elle détecte un CHANGEMENT, pas un DÉPASSEMENT. Une machine mauvaise depuis
 * toujours lui paraît normale, son mauvais état étant devenu sa référence.
 *
 * Seul un seuil posé par quelqu'un qui connaît la machine répond à cette
 * question-là. Ces routes le rendent possible.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI EST DÉLIBÉRÉ
 * ═══════════════════════════════════════════════════════════════════
 * • `equipmentId` facultatif. NUL signifie « valeur par défaut de
 *   l'organisation pour cette grandeur ». Sans cela, régler un parc de cent
 *   moteurs identiques demanderait cent saisies, et personne ne le ferait.
 *
 * • Aucun seuil n'est créé d'office à l'inscription d'un équipement. Un seuil
 *   par défaut inventé par la plateforme serait exactement la faute qu'on
 *   vient de corriger, avec une couche de légitimité en plus puisqu'il
 *   apparaîtrait comme « configuré ». Tant que personne n'a réglé, la
 *   détection statistique s'applique et l'écran dit laquelle des deux méthodes
 *   a décidé.
 *
 * • Le réglage exige le niveau `maintenance_manager`. Un seuil d'alarme est un
 *   acte d'ingénierie : trop bas il noie l'équipe sous les fausses alertes,
 *   trop haut il laisse passer la panne. Ce n'est pas une préférence
 *   d'affichage.
 */

import type { Express, Request, Response } from "express";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { sensorThresholds, equipmentRegistry } from "@shared/schema";
import { tenantRequis } from "./tenant-requis";
import { auMoins } from "@shared/roles";
import type { SeuilConfigure, SensFranchissement } from "@shared/supervision";

/** Grandeurs acceptées — celles que le tableau de bord de santé sait afficher. */
const GRANDEURS = ["temperature", "vibration", "pressure", "current", "flow", "speed", "voltage", "humidity"] as const;

const SENS_VALIDES: SensFranchissement[] = ["au-dessus", "au-dessous"];

function peutRegler(req: Request): boolean {
  return auMoins((req as any).user?.role, "maintenance_manager");
}

/**
 * Seuils d'un locataire, indexés pour une résolution rapide.
 *
 * La résolution suit l'ordre de précision : le réglage de LA machine l'emporte
 * sur la valeur par défaut de l'organisation, qui l'emporte sur l'absence de
 * réglage (et donc sur la détection statistique).
 */
export interface SeuilsDuLocataire {
  /** `${equipmentId}:${metricType}` → seuil. */
  parEquipement: Map<string, SeuilConfigure>;
  /** `metricType` → seuil par défaut de l'organisation. */
  parDefaut: Map<string, SeuilConfigure>;
}

function versSeuilConfigure(ligne: typeof sensorThresholds.$inferSelect): SeuilConfigure {
  return {
    typeCapteur: ligne.metricType,
    niveauAlerte: Number(ligne.warningLevel),
    niveauCritique: Number(ligne.criticalLevel),
    sens: (ligne.sens === "au-dessous" ? "au-dessous" : "au-dessus"),
    unite: ligne.unit ?? undefined,
  };
}

/**
 * Charge tous les seuils actifs d'un locataire, en UNE requête.
 *
 * Appelé une fois par rendu du tableau de bord de santé, et non une fois par
 * équipement : sur un parc de deux cents machines, la seconde forme produirait
 * deux cents allers-retours pour lire au total quelques dizaines de lignes.
 */
export async function chargerSeuils(tenantId: string): Promise<SeuilsDuLocataire> {
  const lignes = await db
    .select()
    .from(sensorThresholds)
    .where(and(eq(sensorThresholds.tenantId, tenantId), eq(sensorThresholds.isActive, true)));

  const parEquipement = new Map<string, SeuilConfigure>();
  const parDefaut = new Map<string, SeuilConfigure>();

  for (const ligne of lignes) {
    const seuil = versSeuilConfigure(ligne);
    if (ligne.equipmentId === null) parDefaut.set(ligne.metricType, seuil);
    else parEquipement.set(`${ligne.equipmentId}:${ligne.metricType}`, seuil);
  }

  return { parEquipement, parDefaut };
}

/** Le seuil applicable à cette machine et cette grandeur, s'il en existe un. */
export function seuilApplicable(
  seuils: SeuilsDuLocataire,
  equipmentId: number,
  typeCapteur: string,
): SeuilConfigure | undefined {
  return seuils.parEquipement.get(`${equipmentId}:${typeCapteur}`) ?? seuils.parDefaut.get(typeCapteur);
}

/**
 * Contrôle de cohérence d'un réglage.
 *
 * Un seuil incohérent ne provoque aucune erreur visible : il produit soit une
 * alarme permanente, soit un silence permanent. Les deux se découvrent trop
 * tard, d'où ce refus à la saisie.
 */
function incoherence(
  niveauAlerte: number,
  niveauCritique: number,
  sens: SensFranchissement,
): string | null {
  if (!Number.isFinite(niveauAlerte) || !Number.isFinite(niveauCritique)) {
    return "Les deux niveaux doivent être des nombres.";
  }
  if (niveauAlerte === niveauCritique) {
    return "Le niveau d'alerte et le niveau critique sont identiques : l'état « surveillance » serait inatteignable.";
  }
  if (sens === "au-dessus" && niveauCritique < niveauAlerte) {
    return "Pour un franchissement vers le haut, le niveau critique doit être SUPÉRIEUR au niveau d'alerte.";
  }
  if (sens === "au-dessous" && niveauCritique > niveauAlerte) {
    return "Pour un franchissement vers le bas, le niveau critique doit être INFÉRIEUR au niveau d'alerte.";
  }
  return null;
}

export function registerSensorThresholdRoutes(app: Express) {
  /** Tous les seuils réglés par l'organisation. */
  app.get("/api/sensor-thresholds", async (req: Request, res: Response) => {
    try {
      const tenantId = tenantRequis(req, res);
      if (!tenantId) return;

      const lignes = await db
        .select()
        .from(sensorThresholds)
        .where(eq(sensorThresholds.tenantId, tenantId));

      res.json(lignes);
    } catch (error) {
      console.error("Erreur de lecture des seuils :", error);
      res.status(500).json({ error: "LECTURE_SEUILS", message: "Impossible de lire les seuils." });
    }
  });

  /**
   * Pose ou met à jour un seuil.
   *
   * `tenantId` vient de la SESSION et n'est jamais lu dans le corps : un
   * locataire fourni par l'appelant permettrait de régler les alarmes d'une
   * autre entreprise.
   */
  app.put("/api/sensor-thresholds", async (req: Request, res: Response) => {
    try {
      const tenantId = tenantRequis(req, res);
      if (!tenantId) return;

      if (!peutRegler(req)) {
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "Régler un seuil d'alarme demande le niveau responsable maintenance ou supérieur.",
        });
      }

      const { metricType, warningLevel, criticalLevel, unit } = req.body ?? {};
      const equipmentId = req.body?.equipmentId ?? null;
      const sens: SensFranchissement = SENS_VALIDES.includes(req.body?.sens) ? req.body.sens : "au-dessus";

      if (!GRANDEURS.includes(metricType)) {
        return res.status(400).json({
          error: "GRANDEUR_INCONNUE",
          message: `Grandeur « ${metricType} » inconnue. Attendu : ${GRANDEURS.join(", ")}.`,
        });
      }
      if (typeof unit !== "string" || unit.trim() === "") {
        return res.status(400).json({ error: "UNITE_REQUISE", message: "L'unité est obligatoire : un seuil sans unité ne se relit pas." });
      }

      const alerte = Number(warningLevel);
      const critique = Number(criticalLevel);
      const probleme = incoherence(alerte, critique, sens);
      if (probleme) {
        return res.status(400).json({ error: "SEUIL_INCOHERENT", message: probleme });
      }

      // L'équipement doit appartenir à CE locataire : sans ce contrôle, un
      // identifiant choisi au hasard réglerait le seuil d'une machine d'autrui.
      if (equipmentId !== null) {
        const [machine] = await db
          .select({ id: equipmentRegistry.id })
          .from(equipmentRegistry)
          .where(and(eq(equipmentRegistry.id, Number(equipmentId)), eq(equipmentRegistry.tenantId, tenantId)))
          .limit(1);
        if (!machine) {
          return res.status(404).json({ error: "EQUIPEMENT_INTROUVABLE", message: "Cet équipement n'appartient pas à votre organisation." });
        }
      }

      const valeurs = {
        tenantId,
        equipmentId: equipmentId === null ? null : Number(equipmentId),
        metricType,
        warningLevel: alerte,
        criticalLevel: critique,
        sens,
        unit: unit.trim(),
        isActive: true,
        updatedBy: (req as any).user?.id ?? null,
        updatedAt: new Date(),
      };

      // Un seul réglage par (locataire, équipement, grandeur) : on cherche puis
      // on met à jour, plutôt que d'empiler des lignes dont la lecture
      // choisirait l'une au hasard.
      const conditionEquipement = valeurs.equipmentId === null
        ? isNull(sensorThresholds.equipmentId)
        : eq(sensorThresholds.equipmentId, valeurs.equipmentId);

      const [existant] = await db
        .select({ id: sensorThresholds.id })
        .from(sensorThresholds)
        .where(and(
          eq(sensorThresholds.tenantId, tenantId),
          eq(sensorThresholds.metricType, metricType),
          conditionEquipement,
        ))
        .limit(1);

      const [ligne] = existant
        ? await db.update(sensorThresholds).set(valeurs).where(eq(sensorThresholds.id, existant.id)).returning()
        : await db.insert(sensorThresholds).values(valeurs).returning();

      res.json(ligne);
    } catch (error) {
      console.error("Erreur d'enregistrement d'un seuil :", error);
      res.status(500).json({ error: "ECRITURE_SEUIL", message: "Impossible d'enregistrer ce seuil." });
    }
  });

  /**
   * Retire un seuil.
   *
   * La grandeur retombe alors sur la détection statistique — jamais sur une
   * constante : supprimer un réglage ne doit pas rétablir en douce les
   * anciennes valeurs en dur.
   */
  app.delete("/api/sensor-thresholds/:id", async (req: Request, res: Response) => {
    try {
      const tenantId = tenantRequis(req, res);
      if (!tenantId) return;

      if (!peutRegler(req)) {
        return res.status(403).json({ error: "FORBIDDEN", message: "Droits insuffisants pour retirer un seuil." });
      }

      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "ID_INVALIDE", message: "Identifiant de seuil invalide." });
      }

      // Le locataire est dans la clause WHERE, pas seulement vérifié avant :
      // une suppression par identifiant seul effacerait le réglage d'autrui.
      const supprimes = await db
        .delete(sensorThresholds)
        .where(and(eq(sensorThresholds.id, id), eq(sensorThresholds.tenantId, tenantId)))
        .returning({ id: sensorThresholds.id });

      if (supprimes.length === 0) {
        return res.status(404).json({ error: "SEUIL_INTROUVABLE", message: "Aucun seuil de votre organisation ne porte cet identifiant." });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Erreur de suppression d'un seuil :", error);
      res.status(500).json({ error: "SUPPRESSION_SEUIL", message: "Impossible de retirer ce seuil." });
    }
  });
}

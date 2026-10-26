/**
 * Permit-to-Work (PTW) Routes
 * Gestion complète des permis de travail industriels
 * Types: Travaux à chaud, Espace confiné, LOTO, Hauteur, Froid, Chimique
 * Cycle: draft → submitted → approved → active → completed / rejected / cancelled / expired
 */

import type { Express } from "express";
import { db } from "./db";
import { eq, desc, and, or } from "drizzle-orm";
import { permitToWork, insertPermitToWorkSchema, miseAJourPermisSchema, userProfiles, equipmentRegistry, workOrders } from "@shared/schema";
import { tenantRequis } from "./tenant-requis";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";
import { z } from "zod";
import { journalizePTWMutation, PTW_ACTIONS } from "./crypto-journal";
import { auMoins } from "@shared/roles";

// ─── Journalisation helper ────────────────────────────────────────────────────
// Extrait le contexte acteur depuis req.user et appelle le journal.
// Best-effort : un échec de journalisation ne bloque pas la réponse HTTP.
async function journal(
  action: string,
  permit: Record<string, unknown>,
  req: any,
): Promise<void> {
  try {
    const actorName = req.user
      ? `${req.user.firstName ?? ""} ${req.user.lastName ?? ""}`.trim() || req.user.username || "unknown"
      : "anonymous";
    await journalizePTWMutation(action, permit, req.user?.id ?? null, actorName, {
      tenantId: req.user?.tenantId,
      ip: req.ip ?? req.socket?.remoteAddress,
      userAgent: req.headers?.["user-agent"]?.slice(0, 200),
    });
  } catch (journalErr) {
    console.error("[CryptoJournal] PTW journalisation failed (non-blocking):", journalErr);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * La clause qui désigne UN permis — toujours par son identifiant ET son
 * locataire.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI UNE FONCTION POUR DEUX ÉGALITÉS
 * ═══════════════════════════════════════════════════════════════════
 * Les NEUF routes d'écriture de ce module désignaient leur permis par
 * `eq(permitToWork.id, id)` — l'identifiant seul. Mesuré sur banc : un
 * technicien d'une entreprise pouvait soumettre, **approuver**, **activer**,
 * clôturer, annuler ou rejeter le permis d'une autre
 * (docs/EXAMEN_LISTES_BLANCHES.md).
 *
 * La gravité n'est pas celle d'une fuite de données : `approve` et `activate`
 * AUTORISENT DES TRAVAUX — points chauds, consignation, espace confiné. Un
 * permis de travail est le document qu'on affiche au poste et qui engage la
 * sécurité des intervenants.
 *
 * Cette fonction existe pour que la clause ne PUISSE PLUS s'écrire sans
 * locataire : il n'y a plus de forme courte à portée de main. Une liste de
 * sept corrections protège du passé ; une forme unique protège de la
 * huitième route.
 */
function cePermis(id: number, tenantId: string) {
  return and(eq(permitToWork.id, id), eq(permitToWork.tenantId, tenantId));
}

/**
 * Le permis de l'appelant, ou `null` si la réponse a déjà été envoyée.
 *
 * Regroupe les trois gestes que chaque route refaisait à la main : exiger le
 * locataire, lire le permis DANS son périmètre, et répondre 404 s'il n'y est
 * pas.
 *
 * `tenantRequis` et non `req.user?.tenantId` : la forme `if (tenantId)` encore
 * employée par les routes de LECTURE de ce fichier ne filtre pas quand le
 * locataire est absent — elle se rabat silencieusement sur « tout voir ».
 * `tenantRequis` refuse (voir server/tenant-requis.ts).
 *
 * Le 404 est volontaire là où un 403 serait tentant : hors de son périmètre,
 * un permis est pour l'appelant ABSENT. Répondre « interdit » renseignerait
 * sur l'existence du document d'une autre entreprise.
 */
async function permisDuLocataire(
  req: any,
  res: any,
  id: number,
): Promise<{ permit: typeof permitToWork.$inferSelect; tenantId: string } | null> {
  const tenantId = tenantRequis(req, res);
  if (!tenantId) return null; // 401 déjà envoyé

  const [permit] = await db.select().from(permitToWork)
    .where(cePermis(id, tenantId)).limit(1);

  if (!permit) {
    res.status(404).json({ message: "Permis introuvable" });
    return null;
  }
  return { permit, tenantId };
}

function generatePermitNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `PTW-${year}-${rand}`;
}

// Default checklists by permit type
const DEFAULT_CHECKLISTS: Record<string, string[]> = {
  hot_work: [
    "Zone délimitée et signalisée",
    "Extinction d'incendie à portée",
    "Matériaux inflammables écartés (> 10 m)",
    "Permis de feu signé par le responsable site",
    "Surveillance post-travaux (60 min après fin)",
    "Détecteur de gaz inflammable vérifié",
  ],
  confined_space: [
    "Atmosphère testée (O2, CO, H2S, explosivité)",
    "Ventilation forcée installée",
    "Équipe de secours en stand-by à l'extérieur",
    "Communication établie (radio/signal)",
    "Harnais de sécurité et trépied disponibles",
    "Consignes d'évacuation affichées",
  ],
  electrical_loto: [
    "Équipement hors tension (disjoncteur ouvert)",
    "Cadenas et étiquettes posés sur tous les points",
    "Test absence de tension effectué",
    "Liste des points de consignation complète",
    "Notification aux équipes affectées",
    "Procédure de déconsignation documentée",
  ],
  height_work: [
    "Équipement anti-chute vérifié (harnais, longe)",
    "Échafaudage ou PEMP contrôlé",
    "Zone d'exclusion délimitée au sol",
    "Conditions météo acceptables (vent < 45 km/h)",
    "Plan de secours défini",
    "Communication avec le sol établie",
  ],
  cold_work: [
    "Risques mécaniques identifiés",
    "Outils non-étincelants disponibles",
    "Zone dépressurisée si nécessaire",
    "EPI adaptés au froid disponibles",
    "Procédure de consignation mécanique vérifiée",
  ],
  chemical: [
    "Fiches de données de sécurité (FDS) consultées",
    "Équipements de protection chimique disponibles",
    "Douche de sécurité accessible",
    "Neutralisants ou absorbants prêts",
    "Plan de gestion des déchets chimiques défini",
    "Contact avec le médecin du travail établi",
  ],
};

const DEFAULT_PPE: Record<string, string[]> = {
  hot_work: ["Masque de soudure", "Gants ignifugés", "Tablier cuir", "Lunettes de protection"],
  confined_space: ["Appareil respiratoire autonome", "Harnais complet", "Combinaison étanche", "Lampe anti-déflagrante"],
  electrical_loto: ["Gants isolants CAT 3/4", "Casque anti-arc", "Lunettes à protection latérale", "Chaussures isolantes"],
  height_work: ["Harnais anti-chute", "Casque avec jugulaire", "Longe double à absorbeur", "Chaussures anti-dérapantes"],
  cold_work: ["Gants mécaniques", "Lunettes de sécurité", "Chaussures de sécurité", "Combinaison de travail"],
  chemical: ["Combinaison NBC", "Masque à cartouche filtrante", "Gants chimiques", "Lunettes étanches"],
};

// ─── Route Registration ──────────────────────────────────────────────────────

export function registerPermitToWorkRoutes(app: Express) {

  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  // ── GET /api/permits ── List all permits (filtered by tenant via auth)
  app.get("/api/permits", auth, generalRateLimit, async (req: any, res) => {
    try {
      const { status, type, riskLevel } = req.query;
      const tenantId = req.user?.tenantId;

      let conditions: any[] = [];
      if (tenantId) conditions.push(eq(permitToWork.tenantId, tenantId));
      if (status) conditions.push(eq(permitToWork.status, status as string));
      if (type) conditions.push(eq(permitToWork.type, type as string));
      if (riskLevel) conditions.push(eq(permitToWork.riskLevel, riskLevel as string));

      const permits = await db.select({
        id: permitToWork.id,
        permitNumber: permitToWork.permitNumber,
        type: permitToWork.type,
        status: permitToWork.status,
        riskLevel: permitToWork.riskLevel,
        title: permitToWork.title,
        location: permitToWork.location,
        plannedStart: permitToWork.plannedStart,
        plannedEnd: permitToWork.plannedEnd,
        createdAt: permitToWork.createdAt,
        updatedAt: permitToWork.updatedAt,
        requestedById: permitToWork.requestedById,
        approvedById: permitToWork.approvedById,
        equipmentId: permitToWork.equipmentId,
        workOrderId: permitToWork.workOrderId,
      }).from(permitToWork)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(permitToWork.createdAt));

      // Enrich with requester name
      const userIds = [...new Set(permits.map(p => p.requestedById).filter(Boolean))] as number[];
      const userMap: Record<number, string> = {};
      if (userIds.length > 0) {
        const { inArray } = await import("drizzle-orm");
        const users = await db.select({ id: userProfiles.id, firstName: userProfiles.firstName, lastName: userProfiles.lastName, username: userProfiles.username })
          .from(userProfiles).where(inArray(userProfiles.id, userIds));
        for (const u of users) userMap[u.id] = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
      }

      const enriched = permits.map(p => ({
        ...p,
        requestedByName: (p.requestedById && userMap[p.requestedById]) || "—",
      }));

      res.json(enriched);
    } catch (error: any) {
      console.error("Error listing permits:", error);
      res.status(500).json({ message: "Erreur lors de la récupération des permis" });
    }
  });

  // ── GET /api/permits/stats ── Dashboard stats
  app.get("/api/permits/stats", auth, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const conditions = tenantId ? [eq(permitToWork.tenantId, tenantId)] : [];
      const all = await db.select({ status: permitToWork.status, riskLevel: permitToWork.riskLevel, type: permitToWork.type })
        .from(permitToWork).where(conditions.length > 0 ? and(...conditions) : undefined);

      const stats = {
        total: all.length,
        active: all.filter(p => p.status === 'active').length,
        pending: all.filter(p => p.status === 'submitted').length,
        expiringSoon: 0, // computed below
        byStatus: {} as Record<string, number>,
        byType: {} as Record<string, number>,
        byRisk: {} as Record<string, number>,
      };
      for (const p of all) {
        stats.byStatus[p.status] = (stats.byStatus[p.status] || 0) + 1;
        stats.byType[p.type] = (stats.byType[p.type] || 0) + 1;
        stats.byRisk[p.riskLevel] = (stats.byRisk[p.riskLevel] || 0) + 1;
      }
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: "Erreur stats permis" });
    }
  });

  // ── GET /api/permits/:id ── Single permit detail
  app.get("/api/permits/:id", auth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID invalide" });

      const [permit] = await db.select().from(permitToWork).where(eq(permitToWork.id, id)).limit(1);
      if (!permit) return res.status(404).json({ message: "Permis introuvable" });

      // Enrich with related data
      const enriched: any = { ...permit };

      if (permit.requestedById) {
        const [u] = await db.select({ id: userProfiles.id, firstName: userProfiles.firstName, lastName: userProfiles.lastName, username: userProfiles.username })
          .from(userProfiles).where(eq(userProfiles.id, permit.requestedById)).limit(1);
        if (u) enriched.requestedByName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
      }
      if (permit.approvedById) {
        const [u] = await db.select({ id: userProfiles.id, firstName: userProfiles.firstName, lastName: userProfiles.lastName, username: userProfiles.username })
          .from(userProfiles).where(eq(userProfiles.id, permit.approvedById)).limit(1);
        if (u) enriched.approvedByName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
      }
      if (permit.equipmentId) {
        const [eq2] = await db.select({ id: equipmentRegistry.id, name: equipmentRegistry.equipmentName, location: equipmentRegistry.location })
          .from(equipmentRegistry).where(eq(equipmentRegistry.id, permit.equipmentId)).limit(1);
        if (eq2) enriched.equipment = eq2;
      }
      if (permit.workOrderId) {
        const [wo] = await db.select({ id: workOrders.id, orderNumber: workOrders.orderNumber, title: workOrders.title })
          .from(workOrders).where(eq(workOrders.id, permit.workOrderId)).limit(1);
        if (wo) enriched.workOrder = wo;
      }

      res.json(enriched);
    } catch (error: any) {
      console.error("Error getting permit:", error);
      res.status(500).json({ message: "Erreur lors de la récupération du permis" });
    }
  });

  // ── POST /api/permits ── Create new permit
  app.post("/api/permits", auth, generalRateLimit, async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;
      const { type } = req.body;

      // Inject default checklist if not provided
      const checklistItems = (req.body.checklistItems?.length > 0)
        ? req.body.checklistItems
        : (DEFAULT_CHECKLISTS[type] || []).map((label: string) => ({ label, checked: false }));

      const safetyEquipment = (req.body.safetyEquipment?.length > 0)
        ? req.body.safetyEquipment
        : (DEFAULT_PPE[type] || []);

      const permitData = {
        ...req.body,
        permitNumber: generatePermitNumber(),
        tenantId,
        requestedById: userId,
        status: "draft",
        checklistItems,
        safetyEquipment,
      };

      const validated = insertPermitToWorkSchema.parse(permitData);
      const [created] = await db.insert(permitToWork).values(validated).returning();
      journal(PTW_ACTIONS.CREATE, created as any, req);
      res.status(201).json(created);
    } catch (error: any) {
      if (error.name === 'ZodError') return res.status(400).json({ message: "Données invalides", errors: error.errors });
      console.error("Error creating permit:", error);
      res.status(500).json({ message: "Erreur lors de la création du permis" });
    }
  });

  // ── PATCH /api/permits/:id ── Update permit (only when draft)
  app.patch("/api/permits/:id", auth, generalRateLimit, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "ID invalide" });

      // ═══════════════════════════════════════════════════════════════
      // LE PERMIS D'UNE AUTRE ENTREPRISE ÉTAIT MODIFIABLE
      // ═══════════════════════════════════════════════════════════════
      // La lecture ET l'écriture filtraient sur l'`id` SEUL. Mesuré sur banc
      // (docs/EXAMEN_LISTES_BLANCHES.md, anomalie B) : un technicien du
      // locataire Alpha a remplacé le titre du permis de Beta et s'en est
      // attribué la propriété, en HTTP 200. Un permis de travail est un
      // document de sécurité — travaux par points chauds, consignation,
      // espace confiné.
      //
      // Même aide commune que les sept routes de transition : elle exige le
      // locataire, lit le permis DANS son périmètre, et répond 404 s'il n'y est
      // pas. Une forme différente ici inviterait à recopier la mauvaise.
      const trouve = await permisDuLocataire(req, res, id);
      if (!trouve) return;
      const { permit: existing, tenantId } = trouve;

      if (!['draft', 'rejected'].includes(existing.status)) {
        return res.status(409).json({ message: "Un permis ne peut être modifié qu'à l'état Brouillon ou Rejeté" });
      }

      // ═══════════════════════════════════════════════════════════════
      // LISTE BLANCHE, ET NON LISTE NOIRE
      // ═══════════════════════════════════════════════════════════════
      // Le corps passait par `const { status, permitNumber, createdAt,
      // ...updateData } = req.body` : trois champs écartés, TOUT LE RESTE
      // écrit — `tenantId` compris. Une liste noire ne protège que de ce
      // qu'on a pensé à nommer, et une colonne ajoutée demain serait
      // acceptée par oubli.
      //
      // `.strict()` REFUSE un champ inconnu au lieu de l'ignorer : une
      // tentative d'écrire `tenantId` doit s'entendre dire non, pas croire
      // qu'elle a réussi.
      const validation = miseAJourPermisSchema.safeParse(req.body);
      if (!validation.success) {
        const champsRefuses = validation.error.issues
          .filter((i) => i.code === "unrecognized_keys")
          .flatMap((i) => (i as any).keys as string[]);

        return res.status(400).json({
          message: champsRefuses.length
            ? `Ces champs ne se modifient pas par cette route : ${champsRefuses.join(", ")}. ` +
              "Le numéro de permis, son statut et l'entreprise propriétaire n'en font pas partie."
            : "Mise à jour invalide.",
          champs: champsRefuses,
          details: validation.error.issues.map((i) => ({ chemin: i.path.join("."), motif: i.message })),
        });
      }

      const [updated] = await db.update(permitToWork)
        .set({ ...validation.data, status: 'draft', updatedAt: new Date() })
        .where(and(eq(permitToWork.id, id), eq(permitToWork.tenantId, tenantId)))
        .returning();
      journal(PTW_ACTIONS.UPDATE, updated as any, req);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating permit:", error);
      res.status(500).json({ message: "Erreur lors de la mise à jour du permis" });
    }
  });

  // ── POST /api/permits/:id/submit ── Submit for approval
  app.post("/api/permits/:id/submit", auth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const trouve = await permisDuLocataire(req, res, id);
      if (!trouve) return;
      const { permit, tenantId } = trouve;
      if (permit.status !== 'draft') return res.status(409).json({ message: "Seul un brouillon peut être soumis" });

      const [updated] = await db.update(permitToWork)
        .set({ status: 'submitted', updatedAt: new Date() })
        .where(cePermis(id, tenantId)).returning();
      journal(PTW_ACTIONS.SUBMIT, updated as any, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: "Erreur lors de la soumission" });
    }
  });

  // ── POST /api/permits/:id/approve ── Approve permit (supervisor/admin)
  app.post("/api/permits/:id/approve", auth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user?.id;
      const role = req.user?.role;

      // ⚠️ La liste citait `manager` et `supervisor`, absents du référentiel :
      // aucun compte réel ne pouvait satisfaire ce contrôle. On raisonne
      // désormais par niveau — chef d'équipe ou au-dessus.
      if (!auMoins(role, 'team_leader')) {
        return res.status(403).json({ message: "Seul un chef d'équipe ou un responsable peut approuver un permis" });
      }

      // Le contrôle de rôle ci-dessus dit QUI peut approuver ; celui-ci dit
      // DANS QUELLE ENTREPRISE. Les deux sont nécessaires : un chef d'équipe
      // en règle pouvait approuver les travaux d'une autre société.
      const trouve = await permisDuLocataire(req, res, id);
      if (!trouve) return;
      const { permit, tenantId } = trouve;
      if (permit.status !== 'submitted') return res.status(409).json({ message: "Seul un permis soumis peut être approuvé" });

      const { conditions } = req.body;
      const [updated] = await db.update(permitToWork)
        .set({
          status: 'approved',
          approvedById: userId,
          approvedAt: new Date(),
          permitConditions: conditions || permit.permitConditions,
          updatedAt: new Date(),
        })
        .where(cePermis(id, tenantId)).returning();
      journal(PTW_ACTIONS.APPROVE, updated as any, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: "Erreur lors de l'approbation" });
    }
  });

  // ── POST /api/permits/:id/reject ── Reject permit
  app.post("/api/permits/:id/reject", auth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const role = req.user?.role;

      if (!auMoins(role, 'team_leader')) {
        return res.status(403).json({ message: "Seul un superviseur ou administrateur peut rejeter un permis" });
      }

      const trouve = await permisDuLocataire(req, res, id);
      if (!trouve) return;
      const { permit, tenantId } = trouve;
      if (!['submitted', 'approved'].includes(permit.status)) {
        return res.status(409).json({ message: "Le permis doit être soumis ou approuvé pour être rejeté" });
      }

      const { reason } = req.body;
      if (!reason) return res.status(400).json({ message: "La raison du rejet est obligatoire" });

      const [updated] = await db.update(permitToWork)
        .set({ status: 'rejected', rejectionReason: reason, updatedAt: new Date() })
        .where(cePermis(id, tenantId)).returning();
      journal(PTW_ACTIONS.REJECT, updated as any, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: "Erreur lors du rejet" });
    }
  });

  // ── POST /api/permits/:id/activate ── Start work (activate permit)
  app.post("/api/permits/:id/activate", auth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user?.id;

      const trouve = await permisDuLocataire(req, res, id);
      if (!trouve) return;
      const { permit, tenantId } = trouve;
      if (permit.status !== 'approved') return res.status(409).json({ message: "Le permis doit être approuvé avant activation" });

      const [updated] = await db.update(permitToWork)
        .set({ status: 'active', issuedById: userId, actualStart: new Date(), updatedAt: new Date() })
        .where(cePermis(id, tenantId)).returning();
      journal(PTW_ACTIONS.ACTIVATE, updated as any, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: "Erreur lors de l'activation" });
    }
  });

  // ── POST /api/permits/:id/complete ── Close permit after work done
  app.post("/api/permits/:id/complete", auth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = req.user?.id;

      const trouve = await permisDuLocataire(req, res, id);
      if (!trouve) return;
      const { permit, tenantId } = trouve;
      if (permit.status !== 'active') return res.status(409).json({ message: "Seul un permis actif peut être clôturé" });

      const { notes, checklistItems } = req.body;
      const [updated] = await db.update(permitToWork)
        .set({
          status: 'completed',
          closedById: userId,
          actualEnd: new Date(),
          completionNotes: notes,
          checklistItems: checklistItems || permit.checklistItems,
          updatedAt: new Date(),
        })
        .where(cePermis(id, tenantId)).returning();
      journal(PTW_ACTIONS.COMPLETE, updated as any, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: "Erreur lors de la clôture" });
    }
  });

  // ── POST /api/permits/:id/cancel ── Cancel permit
  app.post("/api/permits/:id/cancel", auth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const trouve = await permisDuLocataire(req, res, id);
      if (!trouve) return;
      const { permit, tenantId } = trouve;
      if (['completed', 'cancelled', 'expired'].includes(permit.status)) {
        return res.status(409).json({ message: "Ce permis ne peut pas être annulé" });
      }

      const [updated] = await db.update(permitToWork)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(cePermis(id, tenantId)).returning();
      journal(PTW_ACTIONS.CANCEL, updated as any, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: "Erreur lors de l'annulation" });
    }
  });

  // ── PATCH /api/permits/:id/checklist ── Update checklist items
  app.patch("/api/permits/:id/checklist", auth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { checklistItems } = req.body;
      if (!Array.isArray(checklistItems)) return res.status(400).json({ message: "checklistItems doit être un tableau" });

      // Cette route n'avait AUCUNE lecture préalable : elle écrivait à
      // l'aveugle sur un identifiant, et répondait donc 200 même quand aucune
      // ligne n'existait — un coup dans le vide annoncé comme un succès. Passer
      // par l'aide commune corrige les deux défauts d'un coup : le
      // cloisonnement, et le 404 sur un permis absent.
      const trouve = await permisDuLocataire(req, res, id);
      if (!trouve) return;
      const { tenantId } = trouve;

      const [updated] = await db.update(permitToWork)
        .set({ checklistItems, updatedAt: new Date() })
        .where(cePermis(id, tenantId)).returning();
      journal(PTW_ACTIONS.CHECKLIST, updated as any, req);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: "Erreur lors de la mise à jour de la checklist" });
    }
  });

  // ── GET /api/permits/defaults/:type ── Get default checklist for a type
  app.get("/api/permits/defaults/:type", auth, async (req, res) => {
    const { type } = req.params;
    res.json({
      checklistItems: (DEFAULT_CHECKLISTS[type] || []).map(label => ({ label, checked: false })),
      safetyEquipment: DEFAULT_PPE[type] || [],
    });
  });

  console.log("🔐 Permit-to-Work routes registered");
}

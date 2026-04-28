/**
 * Permit-to-Work (PTW) Routes
 * Gestion complète des permis de travail industriels
 * Types: Travaux à chaud, Espace confiné, LOTO, Hauteur, Froid, Chimique
 * Cycle: draft → submitted → approved → active → completed / rejected / cancelled / expired
 */

import type { Express } from "express";
import { db } from "./db";
import { eq, desc, and, or } from "drizzle-orm";
import { permitToWork, insertPermitToWorkSchema, userProfiles, equipmentRegistry, workOrders } from "@shared/schema";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";
import { z } from "zod";

// ─── Helpers ────────────────────────────────────────────────────────────────

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
        const [eq2] = await db.select({ id: equipmentRegistry.id, name: equipmentRegistry.name, location: equipmentRegistry.location })
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

      const [existing] = await db.select({ status: permitToWork.status, requestedById: permitToWork.requestedById })
        .from(permitToWork).where(eq(permitToWork.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Permis introuvable" });

      if (!['draft', 'rejected'].includes(existing.status)) {
        return res.status(409).json({ message: "Un permis ne peut être modifié qu'à l'état Brouillon ou Rejeté" });
      }

      const { status, permitNumber, createdAt, ...updateData } = req.body;
      const [updated] = await db.update(permitToWork)
        .set({ ...updateData, status: 'draft', updatedAt: new Date() })
        .where(eq(permitToWork.id, id))
        .returning();
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
      const [permit] = await db.select().from(permitToWork).where(eq(permitToWork.id, id)).limit(1);
      if (!permit) return res.status(404).json({ message: "Permis introuvable" });
      if (permit.status !== 'draft') return res.status(409).json({ message: "Seul un brouillon peut être soumis" });

      const [updated] = await db.update(permitToWork)
        .set({ status: 'submitted', updatedAt: new Date() })
        .where(eq(permitToWork.id, id)).returning();
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

      if (!['admin', 'manager', 'supervisor'].includes(role)) {
        return res.status(403).json({ message: "Seul un superviseur ou administrateur peut approuver un permis" });
      }

      const [permit] = await db.select().from(permitToWork).where(eq(permitToWork.id, id)).limit(1);
      if (!permit) return res.status(404).json({ message: "Permis introuvable" });
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
        .where(eq(permitToWork.id, id)).returning();
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

      if (!['admin', 'manager', 'supervisor'].includes(role)) {
        return res.status(403).json({ message: "Seul un superviseur ou administrateur peut rejeter un permis" });
      }

      const [permit] = await db.select().from(permitToWork).where(eq(permitToWork.id, id)).limit(1);
      if (!permit) return res.status(404).json({ message: "Permis introuvable" });
      if (!['submitted', 'approved'].includes(permit.status)) {
        return res.status(409).json({ message: "Le permis doit être soumis ou approuvé pour être rejeté" });
      }

      const { reason } = req.body;
      if (!reason) return res.status(400).json({ message: "La raison du rejet est obligatoire" });

      const [updated] = await db.update(permitToWork)
        .set({ status: 'rejected', rejectionReason: reason, updatedAt: new Date() })
        .where(eq(permitToWork.id, id)).returning();
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

      const [permit] = await db.select().from(permitToWork).where(eq(permitToWork.id, id)).limit(1);
      if (!permit) return res.status(404).json({ message: "Permis introuvable" });
      if (permit.status !== 'approved') return res.status(409).json({ message: "Le permis doit être approuvé avant activation" });

      const [updated] = await db.update(permitToWork)
        .set({ status: 'active', issuedById: userId, actualStart: new Date(), updatedAt: new Date() })
        .where(eq(permitToWork.id, id)).returning();
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

      const [permit] = await db.select().from(permitToWork).where(eq(permitToWork.id, id)).limit(1);
      if (!permit) return res.status(404).json({ message: "Permis introuvable" });
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
        .where(eq(permitToWork.id, id)).returning();
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: "Erreur lors de la clôture" });
    }
  });

  // ── POST /api/permits/:id/cancel ── Cancel permit
  app.post("/api/permits/:id/cancel", auth, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [permit] = await db.select().from(permitToWork).where(eq(permitToWork.id, id)).limit(1);
      if (!permit) return res.status(404).json({ message: "Permis introuvable" });
      if (['completed', 'cancelled', 'expired'].includes(permit.status)) {
        return res.status(409).json({ message: "Ce permis ne peut pas être annulé" });
      }

      const [updated] = await db.update(permitToWork)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(permitToWork.id, id)).returning();
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

      const [updated] = await db.update(permitToWork)
        .set({ checklistItems, updatedAt: new Date() })
        .where(eq(permitToWork.id, id)).returning();
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

/**
 * SMM — Système de Management de Maintenance
 * Manuels, procédures, checklists, audits, non-conformités, amélioration continue.
 * Voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md, section 4.
 *
 * Deux points d'intégration avec le reste du système (la "capitalisation") :
 * 1. Une procédure publiée est synchronisée comme nœud du Knowledge Graph (findOrCreateNode).
 * 2. Un échec de contrôle qualité dans Maintenance Execution crée automatiquement une
 *    non-conformité ici (voir intervention-execution-routes.ts).
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import {
  smmDocuments,
  smmChecklists,
  smmAudits,
  smmNonConformities,
  smmImprovementActions,
} from "@shared/schema";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";
import { findOrCreateNode } from "./kg-sync-service";

interface TenantRequest extends Request {
  tenantId?: string;
  user?: any;
}

function requireTenant(req: TenantRequest, res: Response): string | null {
  if (!req.tenantId) {
    res.status(400).json({ error: "Tenant non résolu pour cette requête" });
    return null;
  }
  return req.tenantId;
}

function generateNumber(prefix: string): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `${prefix}-${year}-${rand}`;
}

// ── Schémas de validation ─────────────────────────────────────────────────
const DocumentSchema = z.object({
  documentType: z.enum(["manuel_qualite", "manuel_maintenance", "procedure", "mode_operatoire", "instruction"]),
  title: z.string().min(3),
  content: z.string().min(1),
  version: z.string().default("1.0"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  equipmentType: z.string().optional(),
  attachmentUrl: z.string().optional(),
});

const ChecklistSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  equipmentType: z.string().optional(),
  items: z.array(z.object({ label: z.string(), required: z.boolean().default(true) })).default([]),
  version: z.string().default("1.0"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

const AuditSchema = z.object({
  title: z.string().min(3),
  auditType: z.enum(["interne", "externe", "fournisseur"]).default("interne"),
  scope: z.string().optional(),
  equipmentId: z.number().optional(),
  checklistId: z.number().optional(),
  scheduledDate: z.string().optional(),
});

const AuditUpdateSchema = z.object({
  status: z.enum(["planned", "in_progress", "completed"]).optional(),
  findings: z.array(z.object({ item: z.string(), conforme: z.boolean(), commentaire: z.string().optional() })).optional(),
  score: z.number().optional(),
  completedDate: z.string().optional(),
});

const NonConformitySchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  severity: z.enum(["mineure", "majeure", "critique"]).default("mineure"),
  source: z.enum(["audit", "controle_qualite", "reclamation_client", "autre"]).default("autre"),
  sourceAuditId: z.number().optional(),
  equipmentId: z.number().optional(),
  rootCause: z.string().optional(),
});

const NonConformityUpdateSchema = z.object({
  status: z.enum(["ouverte", "en_traitement", "cloturee"]).optional(),
  rootCause: z.string().optional(),
  severity: z.enum(["mineure", "majeure", "critique"]).optional(),
});

const ImprovementActionSchema = z.object({
  nonConformityId: z.number().optional(),
  title: z.string().min(3),
  description: z.string().optional(),
  actionType: z.enum(["corrective", "preventive", "amelioration"]).default("corrective"),
  responsibleId: z.number().optional(),
  dueDate: z.string().optional(),
});

const ImprovementActionUpdateSchema = z.object({
  status: z.enum(["a_faire", "en_cours", "terminee", "verifiee"]).optional(),
  effectivenessCheck: z.string().optional(),
});

export function registerSmmRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  // ═══════════ DOCUMENTS (manuels, procédures, modes opératoires, instructions) ═══════════

  app.get("/api/smm/documents", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { documentType } = req.query;
      const conditions = [eq(smmDocuments.tenantId, tenantId)];
      if (documentType) conditions.push(eq(smmDocuments.documentType, String(documentType)));
      const docs = await db.select().from(smmDocuments).where(and(...conditions)).orderBy(desc(smmDocuments.updatedAt));
      res.json(docs);
    } catch (e: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/smm/documents", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = DocumentSchema.parse(req.body);

      const [doc] = await db.insert(smmDocuments).values({
        ...body, tenantId, createdBy: req.user?.id ?? null,
      }).returning();

      if (doc.documentType === "procedure" && doc.status === "published") {
        await findOrCreateNode({
          tenantId, nodeType: "procedure", label: doc.title,
          refTable: "smm_documents", refId: String(doc.id),
        });
      }

      res.status(201).json(doc);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.patch("/api/smm/documents/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const id = parseInt(req.params.id, 10);
      const body = DocumentSchema.partial().parse(req.body);

      const [doc] = await db.update(smmDocuments).set({ ...body, updatedAt: new Date() })
        .where(and(eq(smmDocuments.id, id), eq(smmDocuments.tenantId, tenantId))).returning();
      if (!doc) return res.status(404).json({ error: "Document introuvable" });

      // Publication d'une procédure : capitalisation vers le Knowledge Graph
      if (doc.documentType === "procedure" && doc.status === "published") {
        await findOrCreateNode({
          tenantId, nodeType: "procedure", label: doc.title,
          refTable: "smm_documents", refId: String(doc.id),
        });
      }

      res.json(doc);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ═══════════ CHECKLISTS ═══════════

  app.get("/api/smm/checklists", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const checklists = await db.select().from(smmChecklists).where(eq(smmChecklists.tenantId, tenantId)).orderBy(desc(smmChecklists.updatedAt));
      res.json(checklists);
    } catch (e: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/smm/checklists", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = ChecklistSchema.parse(req.body);
      const [checklist] = await db.insert(smmChecklists).values({
        ...body, tenantId, createdBy: req.user?.id ?? null,
      }).returning();
      res.status(201).json(checklist);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ═══════════ AUDITS ═══════════

  app.get("/api/smm/audits", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const audits = await db.select().from(smmAudits).where(eq(smmAudits.tenantId, tenantId)).orderBy(desc(smmAudits.createdAt));
      res.json(audits);
    } catch (e: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/smm/audits", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = AuditSchema.parse(req.body);
      const [audit] = await db.insert(smmAudits).values({
        ...body,
        tenantId,
        auditNumber: generateNumber("AUD"),
        auditorId: req.user?.id ?? null,
        scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
      }).returning();
      res.status(201).json(audit);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.patch("/api/smm/audits/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const id = parseInt(req.params.id, 10);
      const body = AuditUpdateSchema.parse(req.body);

      const updates: Record<string, unknown> = { ...body, updatedAt: new Date() };
      if (body.completedDate) updates.completedDate = new Date(body.completedDate);
      if (body.findings && body.score === undefined) {
        const conformeCount = body.findings.filter(f => f.conforme).length;
        updates.score = body.findings.length > 0 ? Math.round((conformeCount / body.findings.length) * 100) : null;
      }

      const [audit] = await db.update(smmAudits).set(updates)
        .where(and(eq(smmAudits.id, id), eq(smmAudits.tenantId, tenantId))).returning();
      if (!audit) return res.status(404).json({ error: "Audit introuvable" });
      res.json(audit);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ═══════════ NON-CONFORMITÉS ═══════════

  app.get("/api/smm/non-conformities", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { status } = req.query;
      const conditions = [eq(smmNonConformities.tenantId, tenantId)];
      if (status) conditions.push(eq(smmNonConformities.status, String(status)));
      const ncs = await db.select().from(smmNonConformities).where(and(...conditions)).orderBy(desc(smmNonConformities.detectedAt));
      res.json(ncs);
    } catch (e: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/smm/non-conformities", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = NonConformitySchema.parse(req.body);
      const [nc] = await db.insert(smmNonConformities).values({
        ...body, tenantId, ncNumber: generateNumber("NC"), detectedBy: req.user?.id ?? null,
      }).returning();
      res.status(201).json(nc);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.patch("/api/smm/non-conformities/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const id = parseInt(req.params.id, 10);
      const body = NonConformityUpdateSchema.parse(req.body);
      const [nc] = await db.update(smmNonConformities).set({ ...body, updatedAt: new Date() })
        .where(and(eq(smmNonConformities.id, id), eq(smmNonConformities.tenantId, tenantId))).returning();
      if (!nc) return res.status(404).json({ error: "Non-conformité introuvable" });
      res.json(nc);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // ═══════════ ACTIONS D'AMÉLIORATION ═══════════

  app.get("/api/smm/improvement-actions", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const actions = await db.select().from(smmImprovementActions).where(eq(smmImprovementActions.tenantId, tenantId)).orderBy(desc(smmImprovementActions.createdAt));
      res.json(actions);
    } catch (e: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/smm/improvement-actions", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const body = ImprovementActionSchema.parse(req.body);
      const [action] = await db.insert(smmImprovementActions).values({
        ...body, tenantId,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      }).returning();
      res.status(201).json(action);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.patch("/api/smm/improvement-actions/:id", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const id = parseInt(req.params.id, 10);
      const body = ImprovementActionUpdateSchema.parse(req.body);
      const [action] = await db.update(smmImprovementActions).set({ ...body, updatedAt: new Date() })
        .where(and(eq(smmImprovementActions.id, id), eq(smmImprovementActions.tenantId, tenantId))).returning();
      if (!action) return res.status(404).json({ error: "Action introuvable" });
      res.json(action);
    } catch (e: any) {
      if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
      res.status(500).json({ error: "Erreur serveur" });
    }
  });
}

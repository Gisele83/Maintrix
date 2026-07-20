/**
 * Engineering Knowledge Hub Routes
 * Voir ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md, section 6.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import { knowledgeHubDocuments } from "@shared/schema";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";
import { generalRateLimit } from "./security-middleware";
import { uploadKnowledgeHubDocument, knowledgeHubFileUrl } from "./knowledge-hub-upload";
import { searchKnowledgeHub, embedDocument, isSemanticSearchAvailable } from "./knowledge-hub-service";

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

const DocumentMetaSchema = z.object({
  documentType: z.enum(["schema", "plan", "notice", "bulletin_technique", "photo", "video", "norme", "procedure_saem", "rex"]),
  title: z.string().min(3),
  description: z.string().optional(),
  content: z.string().optional(),
  tags: z.string().optional(), // reçu en CSV depuis un formulaire multipart, converti en tableau
  equipmentType: z.string().optional(),
});

export function registerKnowledgeHubRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  app.get("/api/knowledge-hub/status", generalRateLimit, auth, async (_req, res) => {
    res.json({ semanticSearchAvailable: isSemanticSearchAvailable() });
  });

  app.get("/api/knowledge-hub/documents", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const { documentType } = req.query;
      const conditions = [eq(knowledgeHubDocuments.tenantId, tenantId)];
      if (documentType) conditions.push(eq(knowledgeHubDocuments.documentType, String(documentType)));
      const docs = await db.select().from(knowledgeHubDocuments).where(and(...conditions)).orderBy(desc(knowledgeHubDocuments.createdAt));
      res.json(docs.map(({ embedding, ...rest }) => rest)); // ne pas renvoyer les vecteurs bruts au client
    } catch (e: any) {
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.post("/api/knowledge-hub/documents", generalRateLimit, auth,
    uploadKnowledgeHubDocument.single("file"),
    async (req: TenantRequest, res) => {
      try {
        const tenantId = requireTenant(req, res);
        if (!tenantId) return;
        const body = DocumentMetaSchema.parse(req.body);
        const file = (req as any).file as Express.Multer.File | undefined;

        const [doc] = await db.insert(knowledgeHubDocuments).values({
          tenantId,
          documentType: body.documentType,
          title: body.title,
          description: body.description ?? null,
          content: body.content ?? null,
          tags: body.tags ? body.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
          equipmentType: body.equipmentType ?? null,
          fileUrl: file ? knowledgeHubFileUrl(file.filename) : null,
          fileType: file?.mimetype ?? null,
          uploadedBy: req.user?.id ?? null,
        }).returning();

        // Indexation sémantique en tâche de fond — ne bloque pas la réponse à l'upload.
        // Sans effet si OPENAI_API_KEY n'est pas configurée (embedDocument no-op silencieux).
        embedDocument(doc.id).catch(err => console.warn("[knowledge-hub] embedDocument a échoué:", err));

        const { embedding, ...safeDoc } = doc;
        res.status(201).json(safeDoc);
      } catch (e: any) {
        if (e.name === "ZodError") return res.status(400).json({ error: e.errors });
        console.error("Knowledge hub document create error:", e.message);
        res.status(500).json({ error: e.message || "Erreur serveur" });
      }
    }
  );

  app.get("/api/knowledge-hub/search", generalRateLimit, auth, async (req: TenantRequest, res) => {
    try {
      const tenantId = requireTenant(req, res);
      if (!tenantId) return;
      const q = String(req.query.q ?? "").trim();
      if (!q) return res.status(400).json({ error: "Paramètre de recherche 'q' requis" });

      const results = await searchKnowledgeHub(q, tenantId, 10);
      res.json(results.map(r => ({
        document: { ...r.document, embedding: undefined },
        score: Math.round(r.score * 1000) / 1000,
        matchType: r.matchType,
      })));
    } catch (e: any) {
      console.error("Knowledge hub search error:", e.message);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });
}

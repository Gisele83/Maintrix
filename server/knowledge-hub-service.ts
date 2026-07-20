/**
 * Engineering Knowledge Hub — recherche documentaire.
 * "L'IA va chercher ici avant de répondre" (ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md, section 6).
 *
 * Recherche sémantique par embeddings (OpenAI text-embedding-3-small) si OPENAI_API_KEY
 * est configurée ; repli automatique sur un scoring par mots-clés sinon — même principe
 * que le repli local de anthropic-service.ts quand ANTHROPIC_API_KEY est absente.
 */

import OpenAI from "openai";
import { eq, and } from "drizzle-orm";
import { db } from "./db";
import { knowledgeHubDocuments, type KnowledgeHubDocument } from "@shared/schema";

const EMBEDDING_MODEL = "text-embedding-3-small";
const MAX_EMBED_CHARS = 8000;

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export function isSemanticSearchAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  const client = getOpenAI();
  if (!client) return null;
  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, MAX_EMBED_CHARS),
    });
    return response.data[0]?.embedding ?? null;
  } catch (error) {
    console.warn("[knowledge-hub] Échec génération embedding, repli mot-clé:", error);
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function keywordScore(query: string, doc: KnowledgeHubDocument): number {
  const terms = normalizeText(query).split(/\s+/).filter(t => t.length > 2);
  if (terms.length === 0) return 0;

  const title = normalizeText(doc.title);
  const description = normalizeText(doc.description ?? "");
  const content = normalizeText(doc.content ?? "");
  const tags = normalizeText((doc.tags ?? []).join(" "));

  let score = 0;
  for (const term of terms) {
    if (title.includes(term)) score += 3;
    if (tags.includes(term)) score += 2;
    if (description.includes(term)) score += 1;
    if (content.includes(term)) score += 1;
  }
  return score / (terms.length * 3); // normalisé ~0-2+, comparable entre documents
}

export interface KnowledgeHubSearchResult {
  document: KnowledgeHubDocument;
  score: number;
  matchType: "semantic" | "keyword";
}

/** Recherche dans le corpus documentaire d'un tenant. Bascule automatiquement sémantique/mot-clé. */
export async function searchKnowledgeHub(query: string, tenantId: string, topK = 5): Promise<KnowledgeHubSearchResult[]> {
  const docs = await db.select().from(knowledgeHubDocuments).where(eq(knowledgeHubDocuments.tenantId, tenantId));
  if (docs.length === 0) return [];

  const queryEmbedding = await generateEmbedding(query);

  const results: KnowledgeHubSearchResult[] = docs.map(doc => {
    const docEmbedding = doc.embedding as number[] | null;
    if (queryEmbedding && docEmbedding && docEmbedding.length > 0) {
      return { document: doc, score: cosineSimilarity(queryEmbedding, docEmbedding), matchType: "semantic" as const };
    }
    return { document: doc, score: keywordScore(query, doc), matchType: "keyword" as const };
  });

  return results
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** Génère (ou régénère) l'embedding d'un document à partir de son titre + description + contenu. */
export async function embedDocument(documentId: number): Promise<void> {
  const [doc] = await db.select().from(knowledgeHubDocuments).where(eq(knowledgeHubDocuments.id, documentId)).limit(1);
  if (!doc) return;

  const text = [doc.title, doc.description, doc.content].filter(Boolean).join("\n\n");
  const embedding = await generateEmbedding(text);
  if (embedding) {
    await db.update(knowledgeHubDocuments).set({ embedding, updatedAt: new Date() }).where(eq(knowledgeHubDocuments.id, documentId));
  }
}

/**
 * Point d'intégration IA : formate les meilleurs résultats en bloc de contexte texte,
 * injectable dans un prompt Claude avant de répondre — voir hybrid-diagnostic-pipeline.ts.
 */
export async function getRelevantContext(query: string, tenantId: string, topK = 3): Promise<string> {
  const results = await searchKnowledgeHub(query, tenantId, topK);
  if (results.length === 0) return "";

  return results.map(r => {
    const d = r.document;
    const excerpt = (d.content || d.description || "").slice(0, 300);
    return `[${d.documentType}] ${d.title}${excerpt ? ` — ${excerpt}` : ""} (pertinence: ${Math.round(r.score * 100) / 100}, ${r.matchType})`;
  }).join("\n");
}

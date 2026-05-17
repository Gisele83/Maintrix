/**
 * Enclavement Cryptographique — Journal Append-Only Chainé par Hachage
 * Brevet MAINTRIX-SCA — Module Sécurité & Traçabilité
 *
 * Architecture :
 *   ─ Journal immuable : aucun UPDATE ni DELETE n'est autorisé par l'application
 *   ─ Chaque entrée contient le hash SHA-256 de l'entrée précédente (chaîne)
 *   ─ Bloc genesis : hash fixe calculé sur la constante MAINTRIX_GENESIS_BLOCK_v1
 *   ─ Domaine d'exécution PTW séparé : toutes les mutations PTW passent par ce journal
 *   ─ Vérification d'intégrité : recompute toute la chaîne et détecte toute altération
 *
 * Formule de hachage :
 *   H(n) = SHA256( seq_n || ts_n || domain || action || entityType || entityId
 *                 || actorId || canonical_payload || H(n-1) )
 *
 *   où canonical_payload = JSON.stringify(payload, Object.keys(payload).sort())
 */

import { createHash } from "crypto";
import { db } from "./db";
import { cryptoJournalEntries } from "@shared/schema";
import { eq, desc, asc, sql } from "drizzle-orm";

// ─── Constants ────────────────────────────────────────────────────────────────

export const DOMAINS = {
  PTW: "PTW_DOMAIN",
  GMAO: "GMAO_DOMAIN",
  IMCA: "IMCA_DOMAIN",
  SYSTEM: "SYSTEM_DOMAIN",
  SECURITY: "SECURITY_DOMAIN",
} as const;

export type Domain = typeof DOMAINS[keyof typeof DOMAINS];

// Actions PTW — nomenclature normalisée
export const PTW_ACTIONS = {
  CREATE:     "PTW:CREATE_PERMIT",
  UPDATE:     "PTW:UPDATE_PERMIT",
  SUBMIT:     "PTW:SUBMIT_PERMIT",
  APPROVE:    "PTW:APPROVE_PERMIT",
  REJECT:     "PTW:REJECT_PERMIT",
  ACTIVATE:   "PTW:ACTIVATE_PERMIT",
  COMPLETE:   "PTW:COMPLETE_PERMIT",
  CANCEL:     "PTW:CANCEL_PERMIT",
  EXPIRE:     "PTW:EXPIRE_PERMIT",
  CHECKLIST:  "PTW:UPDATE_CHECKLIST",
} as const;

export type PTWAction = typeof PTW_ACTIONS[keyof typeof PTW_ACTIONS];

const GENESIS_INPUT = "MAINTRIX_GENESIS_BLOCK_v1_PTW_ENCLAVE_2025";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JournalEntryInput {
  domain: Domain;
  action: string;
  entityType: string;
  entityId: string;
  actorId: number | null;
  actorName: string;
  payload: Record<string, unknown>;
  metadata?: {
    ip?: string;
    userAgent?: string;
    tenantId?: string;
    requestId?: string;
    [key: string]: unknown;
  };
}

export interface JournalEntry {
  id: number;
  sequenceNumber: number;
  domain: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: number | null;
  actorName: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  previousHash: string;
  entryHash: string;
  createdAt: Date;
}

export interface ChainVerificationResult {
  isValid: boolean;
  totalEntries: number;
  verifiedEntries: number;
  firstTamperedAt: number | null;
  firstTamperedEntry: { id: number; sequenceNumber: number; action: string } | null;
  genesisHash: string;
  latestHash: string;
  verifiedAt: string;
  chainCoverage: number; // %
}

// ─── Hash computation ─────────────────────────────────────────────────────────

/**
 * Hash genesis block — constante immuable, ancre de la chaîne
 */
export function computeGenesisHash(): string {
  return createHash("sha256").update(GENESIS_INPUT, "utf8").digest("hex");
}

/**
 * Canonicalise le payload pour une sérialisation déterministe (clés triées)
 */
function canonicalize(payload: Record<string, unknown>): string {
  const sortedKeys = Object.keys(payload).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of sortedKeys) sorted[k] = payload[k];
  return JSON.stringify(sorted);
}

/**
 * Calcule le hash SHA-256 d'une entrée de journal
 *
 * H(n) = SHA256( seq || timestamp.toISOString() || domain || action
 *               || entityType || entityId || actorId || canonicalPayload || H(n-1) )
 */
export function computeEntryHash(
  sequenceNumber: number,
  timestamp: Date,
  domain: string,
  action: string,
  entityType: string,
  entityId: string,
  actorId: number | null,
  payload: Record<string, unknown>,
  previousHash: string,
): string {
  const input = [
    String(sequenceNumber),
    timestamp.toISOString(),
    domain,
    action,
    entityType,
    entityId,
    String(actorId ?? "null"),
    canonicalize(payload),
    previousHash,
  ].join("|");
  return createHash("sha256").update(input, "utf8").digest("hex");
}

// ─── Mutex for sequence number allocation ─────────────────────────────────────

let sequenceLock: Promise<unknown> = Promise.resolve();

// ─── Append entry ─────────────────────────────────────────────────────────────

/**
 * Ajoute une entrée immuable au journal.
 * Utilise un verrou séquentiel pour garantir la monotonie de la séquence.
 *
 * Atomicité : l'insertion est dans une transaction DB distincte de la mutation
 * métier — le journal est best-effort mais chaque succès est définitif.
 */
export async function appendJournalEntry(input: JournalEntryInput): Promise<JournalEntry> {
  return new Promise((resolve, reject) => {
    sequenceLock = sequenceLock.then(async () => {
      try {
        // Récupérer le dernier hash de la chaîne
        const [lastRow] = await db
          .select({ sequenceNumber: cryptoJournalEntries.sequenceNumber, entryHash: cryptoJournalEntries.entryHash })
          .from(cryptoJournalEntries)
          .orderBy(desc(cryptoJournalEntries.sequenceNumber))
          .limit(1);

        const previousHash = lastRow?.entryHash ?? computeGenesisHash();
        const sequenceNumber = (lastRow?.sequenceNumber ?? 0) + 1;
        const createdAt = new Date();

        const entryHash = computeEntryHash(
          sequenceNumber,
          createdAt,
          input.domain,
          input.action,
          input.entityType,
          String(input.entityId),
          input.actorId,
          input.payload,
          previousHash,
        );

        const [inserted] = await db
          .insert(cryptoJournalEntries)
          .values({
            sequenceNumber,
            domain: input.domain,
            action: input.action,
            entityType: input.entityType,
            entityId: String(input.entityId),
            actorId: input.actorId,
            actorName: input.actorName,
            payload: input.payload,
            metadata: input.metadata ?? {},
            previousHash,
            entryHash,
            createdAt,
          })
          .returning();

        resolve(inserted as unknown as JournalEntry);
      } catch (err) {
        reject(err);
      }
    });
  });
}

// ─── Chain verification ────────────────────────────────────────────────────────

/**
 * Vérifie l'intégrité complète de la chaîne.
 * Recompute chaque hash et vérifie le chaînage.
 * Complexité : O(N) — lit toutes les entrées en streaming par lots.
 */
export async function verifyChainIntegrity(
  domain?: Domain,
  limit: number = 10000,
): Promise<ChainVerificationResult> {
  const genesisHash = computeGenesisHash();

  const query = db
    .select()
    .from(cryptoJournalEntries)
    .orderBy(asc(cryptoJournalEntries.sequenceNumber))
    .limit(limit);

  const entries = domain
    ? await query.where(eq(cryptoJournalEntries.domain, domain))
    : await query;

  if (entries.length === 0) {
    return {
      isValid: true,
      totalEntries: 0,
      verifiedEntries: 0,
      firstTamperedAt: null,
      firstTamperedEntry: null,
      genesisHash,
      latestHash: genesisHash,
      verifiedAt: new Date().toISOString(),
      chainCoverage: 100,
    };
  }

  let expectedPreviousHash = genesisHash;
  let verifiedCount = 0;
  let firstTamperedAt: number | null = null;
  let firstTamperedEntry: ChainVerificationResult["firstTamperedEntry"] = null;

  for (const entry of entries) {
    // Vérification 1 : le previousHash correspond au hash attendu
    const prevHashOk = entry.previousHash === expectedPreviousHash;

    // Vérification 2 : le entryHash est correct (recomputation)
    const recomputed = computeEntryHash(
      entry.sequenceNumber,
      entry.createdAt,
      entry.domain,
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.actorId,
      entry.payload as Record<string, unknown>,
      entry.previousHash,
    );
    const hashOk = recomputed === entry.entryHash;

    if (!prevHashOk || !hashOk) {
      if (firstTamperedAt === null) {
        firstTamperedAt = entry.sequenceNumber;
        firstTamperedEntry = { id: entry.id, sequenceNumber: entry.sequenceNumber, action: entry.action };
      }
    } else {
      verifiedCount++;
    }

    expectedPreviousHash = entry.entryHash;
  }

  const isValid = firstTamperedAt === null;
  const latestHash = entries[entries.length - 1].entryHash;

  return {
    isValid,
    totalEntries: entries.length,
    verifiedEntries: verifiedCount,
    firstTamperedAt,
    firstTamperedEntry,
    genesisHash,
    latestHash,
    verifiedAt: new Date().toISOString(),
    chainCoverage: entries.length > 0 ? Math.round((verifiedCount / entries.length) * 100) : 100,
  };
}

// ─── PTW Domain facade ────────────────────────────────────────────────────────

/**
 * Journalise une mutation PTW dans le domaine isolé PTW_DOMAIN.
 * Appelé depuis les routes PTW après chaque mutation DB réussie.
 *
 * @param action      — code d'action normalisé (PTW_ACTIONS.*)
 * @param permit      — snapshot du permis après mutation
 * @param actorId     — ID de l'utilisateur ayant effectué l'action
 * @param actorName   — nom complet (dénormalisé pour immuabilité)
 * @param metadata    — contexte HTTP (IP, tenantId…)
 */
export async function journalizePTWMutation(
  action: string,
  permit: Record<string, unknown>,
  actorId: number | null,
  actorName: string,
  metadata: JournalEntryInput["metadata"] = {},
): Promise<JournalEntry> {
  return appendJournalEntry({
    domain: DOMAINS.PTW,
    action,
    entityType: "permit_to_work",
    entityId: String(permit.id ?? permit.permitNumber ?? "unknown"),
    actorId,
    actorName,
    payload: {
      id: permit.id,
      permitNumber: permit.permitNumber,
      type: permit.type,
      status: permit.status,
      riskLevel: permit.riskLevel,
      title: permit.title,
      location: permit.location,
      equipmentId: permit.equipmentId,
      requestedById: permit.requestedById,
      approvedById: permit.approvedById,
      plannedStart: permit.plannedStart,
      plannedEnd: permit.plannedEnd,
      // Snapshots sécurité critiques
      checklistSummary: Array.isArray(permit.checklistItems)
        ? { total: (permit.checklistItems as any[]).length, checked: (permit.checklistItems as any[]).filter((i: any) => i.checked).length }
        : null,
      isolationPointCount: Array.isArray(permit.isolationPoints) ? (permit.isolationPoints as any[]).length : 0,
      authorizedPersonnelCount: Array.isArray(permit.authorizedPersonnel) ? (permit.authorizedPersonnel as any[]).length : 0,
    },
    metadata,
  });
}

// ─── System event logging ──────────────────────────────────────────────────────

/**
 * Journalise un événement système (démarrage, erreur critique, etc.)
 */
export async function journalizeSystemEvent(
  action: string,
  payload: Record<string, unknown>,
  metadata: JournalEntryInput["metadata"] = {},
): Promise<void> {
  try {
    await appendJournalEntry({
      domain: DOMAINS.SYSTEM,
      action,
      entityType: "system",
      entityId: "maintrix",
      actorId: null,
      actorName: "SYSTEM",
      payload,
      metadata,
    });
  } catch (err) {
    console.error("[CryptoJournal] Failed to log system event:", err);
  }
}

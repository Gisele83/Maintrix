/**
 * Crypto Journal Routes — Journal Append-Only Chainé par Hachage
 * Enclavement cryptographique Brevet MAINTRIX-SCA
 *
 * GET  /api/crypto-journal/entries       — journal paginé (filtre domain/action)
 * GET  /api/crypto-journal/verify        — vérification intégrité chaîne complète
 * GET  /api/crypto-journal/verify/:domain — vérification par domaine
 * GET  /api/crypto-journal/stats         — statistiques par domaine + dernière entrée
 * GET  /api/crypto-journal/chain         — dernières N entrées avec chaînage visuel
 * GET  /api/crypto-journal/entry/:seq    — entrée par numéro de séquence
 */

import type { Express } from "express";
import { db } from "./db";
import { cryptoJournalEntries } from "@shared/schema";
import { eq, desc, asc, and, gte, count, sql } from "drizzle-orm";
import {
  verifyChainIntegrity,
  computeGenesisHash,
  computeEntryHash,
  DOMAINS,
  type Domain,
} from "./crypto-journal";
import { EnterpriseAuthMiddleware } from "./enterprise-auth-middleware";

export function registerCryptoJournalRoutes(app: Express) {
  const auth = EnterpriseAuthMiddleware.requireAuthentication;

  /**
   * GET /api/crypto-journal/entries
   * Journal paginé avec filtre optionnel domain, action, depuis un seq min
   */
  app.get("/api/crypto-journal/entries", auth, async (req: any, res) => {
    try {
      const page = Math.max(1, parseInt((req.query.page as string) ?? "1"));
      const pageSize = Math.min(100, parseInt((req.query.pageSize as string) ?? "20"));
      const domain = req.query.domain as string | undefined;
      const action = req.query.action as string | undefined;
      const fromSeq = req.query.fromSeq ? parseInt(req.query.fromSeq as string) : undefined;

      const conditions = [];
      if (domain) conditions.push(eq(cryptoJournalEntries.domain, domain));
      if (action) conditions.push(eq(cryptoJournalEntries.action, action));
      if (fromSeq !== undefined) conditions.push(gte(cryptoJournalEntries.sequenceNumber, fromSeq));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [{ total }] = await db
        .select({ total: count() })
        .from(cryptoJournalEntries)
        .where(whereClause ?? sql`1=1`);

      const entries = await db
        .select()
        .from(cryptoJournalEntries)
        .where(whereClause ?? sql`1=1`)
        .orderBy(desc(cryptoJournalEntries.sequenceNumber))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      res.json({
        entries,
        pagination: { page, pageSize, total, totalPages: Math.ceil(Number(total) / pageSize) },
        genesisHash: computeGenesisHash(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/crypto-journal/verify
   * Vérifie l'intégrité complète de la chaîne (tous domaines)
   */
  app.get("/api/crypto-journal/verify", auth, async (_req, res) => {
    try {
      const result = await verifyChainIntegrity(undefined, 50000);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/crypto-journal/verify/:domain
   * Vérifie l'intégrité d'un seul domaine
   */
  app.get("/api/crypto-journal/verify/:domain", auth, async (req, res) => {
    try {
      const domain = req.params.domain as Domain;
      if (!Object.values(DOMAINS).includes(domain)) {
        return res.status(400).json({ error: "Domaine inconnu" });
      }
      const result = await verifyChainIntegrity(domain);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/crypto-journal/stats
   * Statistiques par domaine : count, dernière entrée, dernier hash
   */
  app.get("/api/crypto-journal/stats", auth, async (_req, res) => {
    try {
      const domainStats = await Promise.all(
        Object.values(DOMAINS).map(async (domain) => {
          const [{ cnt }] = await db
            .select({ cnt: count() })
            .from(cryptoJournalEntries)
            .where(eq(cryptoJournalEntries.domain, domain));

          const [latest] = await db
            .select({
              sequenceNumber: cryptoJournalEntries.sequenceNumber,
              action: cryptoJournalEntries.action,
              entryHash: cryptoJournalEntries.entryHash,
              createdAt: cryptoJournalEntries.createdAt,
            })
            .from(cryptoJournalEntries)
            .where(eq(cryptoJournalEntries.domain, domain))
            .orderBy(desc(cryptoJournalEntries.sequenceNumber))
            .limit(1);

          return { domain, count: Number(cnt), latest: latest ?? null };
        })
      );

      const [{ total }] = await db.select({ total: count() }).from(cryptoJournalEntries);
      const [globalLatest] = await db
        .select({ sequenceNumber: cryptoJournalEntries.sequenceNumber, entryHash: cryptoJournalEntries.entryHash })
        .from(cryptoJournalEntries)
        .orderBy(desc(cryptoJournalEntries.sequenceNumber))
        .limit(1);

      res.json({
        totalEntries: Number(total),
        genesisHash: computeGenesisHash(),
        latestHash: globalLatest?.entryHash ?? computeGenesisHash(),
        latestSequence: globalLatest?.sequenceNumber ?? 0,
        domains: domainStats,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/crypto-journal/chain
   * Dernières N entrées avec chaînage visuel (prev/next hash truncated)
   */
  app.get("/api/crypto-journal/chain", auth, async (req, res) => {
    try {
      const n = Math.min(50, parseInt((req.query.n as string) ?? "20"));
      const domain = req.query.domain as string | undefined;

      const whereClause = domain ? eq(cryptoJournalEntries.domain, domain) : sql`1=1`;

      const entries = await db
        .select()
        .from(cryptoJournalEntries)
        .where(whereClause)
        .orderBy(desc(cryptoJournalEntries.sequenceNumber))
        .limit(n);

      // Ajouter vérification in-situ pour chaque bloc
      const genesisHash = computeGenesisHash();
      const enriched = entries.map((e, idx) => {
        const nextEntry = idx > 0 ? entries[idx - 1] : null;
        const prevEntry = idx < entries.length - 1 ? entries[idx + 1] : null;

        const recomputed = computeEntryHash(
          e.sequenceNumber,
          e.createdAt,
          e.domain,
          e.action,
          e.entityType,
          e.entityId,
          e.actorId,
          e.payload as Record<string, unknown>,
          e.previousHash,
        );

        return {
          ...e,
          hashValid: recomputed === e.entryHash,
          prevHashLinked: prevEntry ? prevEntry.entryHash === e.previousHash : e.previousHash === genesisHash,
          nextPointsToMe: nextEntry ? nextEntry.previousHash === e.entryHash : true,
          hashShort: e.entryHash.slice(0, 12) + "…" + e.entryHash.slice(-8),
          prevHashShort: e.previousHash.slice(0, 12) + "…" + e.previousHash.slice(-8),
        };
      });

      res.json({ chain: enriched, genesisHash, domain: domain ?? "ALL" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/crypto-journal/entry/:seq
   * Entrée par numéro de séquence avec vérification de hash
   */
  app.get("/api/crypto-journal/entry/:seq", auth, async (req, res) => {
    try {
      const seq = parseInt(req.params.seq);
      if (isNaN(seq)) return res.status(400).json({ error: "Numéro de séquence invalide" });

      const [entry] = await db
        .select()
        .from(cryptoJournalEntries)
        .where(eq(cryptoJournalEntries.sequenceNumber, seq))
        .limit(1);

      if (!entry) return res.status(404).json({ error: "Entrée introuvable" });

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

      res.json({
        ...entry,
        verification: {
          hashValid: recomputed === entry.entryHash,
          recomputedHash: recomputed,
          storedHash: entry.entryHash,
          genesisHash: computeGenesisHash(),
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  console.log("🔐 Journal Cryptographique Chainé enregistré (SHA-256 · Append-only · PTW Domain)");
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ModernNavigation } from "@/components/modern-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, CheckCircle, ChevronDown, ChevronRight, FlaskConical,
  Link2, Lock, RefreshCw, Search, Shield, ShieldAlert, ShieldCheck, XCircle
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface JournalEntry {
  id: number; sequenceNumber: number; domain: string; action: string;
  entityType: string; entityId: string; actorId: number | null; actorName: string;
  payload: Record<string, unknown>; metadata: Record<string, unknown>;
  previousHash: string; entryHash: string; createdAt: string;
  hashValid?: boolean; prevHashLinked?: boolean; hashShort?: string; prevHashShort?: string;
}
interface ChainStats {
  totalEntries: number; genesisHash: string; latestHash: string; latestSequence: number;
  domains: { domain: string; count: number; latest: { action: string; createdAt: string } | null }[];
}
interface VerifyResult {
  isValid: boolean; totalEntries: number; verifiedEntries: number;
  firstTamperedAt: number | null;
  firstTamperedEntry: { id: number; sequenceNumber: number; action: string } | null;
  genesisHash: string; latestHash: string; verifiedAt: string; chainCoverage: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────
const DOMAIN_COLOR: Record<string, string> = {
  PTW_DOMAIN:      "bg-red-500/20 text-red-300 border-red-500/30",
  GMAO_DOMAIN:     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  IMCA_DOMAIN:     "bg-violet-500/20 text-violet-300 border-violet-500/30",
  SYSTEM_DOMAIN:   "bg-slate-500/20 text-slate-300 border-slate-500/30",
  SECURITY_DOMAIN: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};
const DOMAIN_LABEL: Record<string, string> = {
  PTW_DOMAIN:      "Permis de Travail",
  GMAO_DOMAIN:     "GMAO",
  IMCA_DOMAIN:     "IMCA",
  SYSTEM_DOMAIN:   "Système",
  SECURITY_DOMAIN: "Sécurité",
};
const ACTION_VERB: Record<string, string> = {
  "PTW:CREATE_PERMIT":   "Création permis",
  "PTW:UPDATE_PERMIT":   "Modification permis",
  "PTW:SUBMIT_PERMIT":   "Soumission permis",
  "PTW:APPROVE_PERMIT":  "Approbation permis",
  "PTW:REJECT_PERMIT":   "Rejet permis",
  "PTW:ACTIVATE_PERMIT": "Activation permis",
  "PTW:COMPLETE_PERMIT": "Clôture permis",
  "PTW:CANCEL_PERMIT":   "Annulation permis",
  "PTW:UPDATE_CHECKLIST":"Checklist mise à jour",
};
const FMT_DATE = (s: string) => new Date(s).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "medium" });
const H_SHORT = (h: string) => h.slice(0, 10) + "…" + h.slice(-8);

// ─── Block component ────────────────────────────────────────────────────────────
function Block({ entry, prevEntry, isFirst }: { entry: JournalEntry; prevEntry?: JournalEntry; isFirst: boolean }) {
  const [open, setOpen] = useState(false);

  // Vérification locale de l'intégrité du lien
  const prevOk = isFirst
    ? true // genesis validé côté serveur
    : prevEntry?.entryHash === entry.previousHash;
  const hashOk = entry.hashValid !== false; // true par défaut si non fourni

  const isValid = prevOk && hashOk;

  return (
    <div className="relative">
      {/* Connecteur chaîne */}
      {!isFirst && (
        <div className="flex items-center justify-center h-5 my-0.5">
          <div className={`w-0.5 h-full ${isValid ? "bg-emerald-500/50" : "bg-red-500/50"}`} />
          <Link2 className={`w-3 h-3 absolute ${isValid ? "text-emerald-500/70" : "text-red-500/70"}`} />
        </div>
      )}

      <div className={`rounded-xl border p-4 transition-all cursor-pointer hover:bg-slate-800/40 ${
        isValid
          ? "border-emerald-500/20 bg-slate-800/20"
          : "border-red-500/40 bg-red-500/5"
      }`} onClick={() => setOpen(!open)}>

        <div className="flex items-start gap-3">
          {/* Numéro de bloc */}
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${
            isValid ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
          }`}>
            #{entry.sequenceNumber}
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${DOMAIN_COLOR[entry.domain] ?? "bg-slate-700 text-slate-300"}`}>
                {DOMAIN_LABEL[entry.domain] ?? entry.domain}
              </span>
              <span className="text-sm font-semibold text-white">
                {ACTION_VERB[entry.action] ?? entry.action}
              </span>
              {!isValid && (
                <Badge className="bg-red-500/20 text-red-300 text-[10px] animate-pulse">⚠ Altération détectée</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono text-slate-500">
              <span>Entité : <span className="text-slate-400">{entry.entityId}</span></span>
              <span>Acteur : <span className="text-slate-400">{entry.actorName}</span></span>
              <span>Date : <span className="text-slate-400">{FMT_DATE(entry.createdAt)}</span></span>
              <div className="flex items-center gap-1">
                {isValid ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
                <span className={isValid ? "text-emerald-400" : "text-red-400"}>{isValid ? "Hash valide" : "Hash invalide"}</span>
              </div>
            </div>

            {/* Hash display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[9px] font-mono">
              <span className="text-slate-600">prev: <span className="text-slate-500">{entry.prevHashShort ?? H_SHORT(entry.previousHash)}</span></span>
              <span className="text-slate-600">hash: <span className="text-emerald-600/80">{entry.hashShort ?? H_SHORT(entry.entryHash)}</span></span>
            </div>
          </div>

          <div className="text-slate-600 flex-shrink-0">
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
        </div>

        {/* Expanded detail */}
        {open && (
          <div className="mt-4 ml-12 space-y-3 border-t border-slate-700/40 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Hash SHA-256 complet</p>
                <p className="text-[9px] font-mono text-emerald-500/80 break-all">{entry.entryHash}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Hash précédent</p>
                <p className="text-[9px] font-mono text-slate-500 break-all">{entry.previousHash}</p>
              </div>
            </div>

            {entry.payload && Object.keys(entry.payload).length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Snapshot payload (immuable)</p>
                <pre className="text-[9px] font-mono text-slate-400 bg-slate-900/60 rounded-lg p-2 overflow-x-auto max-h-32">
                  {JSON.stringify(entry.payload, null, 2)}
                </pre>
              </div>
            )}

            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Métadonnées contextuelles</p>
                <pre className="text-[9px] font-mono text-slate-500 bg-slate-900/40 rounded-lg p-2 overflow-x-auto">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────────
export default function CryptoJournalPage() {
  const [domainFilter, setDomainFilter] = useState<string>("ALL");
  const [showFormulas, setShowFormulas] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const { data: stats, refetch: refetchStats } = useQuery<ChainStats>({
    queryKey: ["/api/crypto-journal/stats"],
  });

  const { data: chainData, refetch: refetchChain, isLoading: loadingChain } = useQuery<{ chain: JournalEntry[]; genesisHash: string; domain: string }>({
    queryKey: ["/api/crypto-journal/chain", domainFilter],
    queryFn: () =>
      fetch(`/api/crypto-journal/chain?n=40${domainFilter !== "ALL" ? `&domain=${domainFilter}` : ""}`, {
        credentials: "include",
      }).then(r => r.json()),
  });

  const { data: verifyData, refetch: refetchVerify } = useQuery<VerifyResult>({
    queryKey: ["/api/crypto-journal/verify", domainFilter],
    queryFn: () =>
      fetch(`/api/crypto-journal/verify${domainFilter !== "ALL" ? `/${domainFilter}` : ""}`, {
        credentials: "include",
      }).then(r => r.json()),
    enabled: false,
  });

  const handleVerify = async () => {
    setVerifying(true);
    await refetchVerify();
    setVerifying(false);
  };

  const chain = chainData?.chain ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <ModernNavigation />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-slate-800/40 to-cyan-500/10 p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <Lock className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">Journal Cryptographique</h1>
                <p className="text-sm text-slate-400">
                  Enclavement SHA-256 · Append-only · Domaine PTW isolé · Vérification d'intégrité
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => { refetchChain(); refetchStats(); }}
                className="bg-slate-700/80 hover:bg-slate-700 text-white gap-2"
                size="sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingChain ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
              <Button
                onClick={handleVerify}
                disabled={verifying}
                className="bg-emerald-600/80 hover:bg-emerald-600 text-white gap-2"
                size="sm"
              >
                <Shield className={`w-3.5 h-3.5 ${verifying ? "animate-pulse" : ""}`} />
                {verifying ? "Vérification…" : "Vérifier intégrité"}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Verify result banner ──────────────────────────────────────── */}
        {verifyData && (
          <div className={`rounded-xl border p-4 flex items-start gap-4 ${
            verifyData.isValid
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-red-500/40 bg-red-500/10"
          }`}>
            {verifyData.isValid
              ? <ShieldCheck className="w-8 h-8 text-emerald-400 flex-shrink-0" />
              : <ShieldAlert className="w-8 h-8 text-red-400 flex-shrink-0" />
            }
            <div>
              <p className={`font-bold text-sm ${verifyData.isValid ? "text-emerald-300" : "text-red-300"}`}>
                {verifyData.isValid
                  ? `✓ Chaîne intègre — ${verifyData.verifiedEntries}/${verifyData.totalEntries} blocs vérifiés (${verifyData.chainCoverage}%)`
                  : `⚠ Altération détectée au bloc #${verifyData.firstTamperedAt} — ${verifyData.firstTamperedEntry?.action}`
                }
              </p>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">
                Genesis : {H_SHORT(verifyData.genesisHash)} ·
                Dernier : {H_SHORT(verifyData.latestHash)} ·
                Vérifié : {FMT_DATE(verifyData.verifiedAt)}
              </p>
            </div>
          </div>
        )}

        {/* ── Stats KPIs ────────────────────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
              <p className="text-[11px] text-slate-500">Total entrées</p>
              <p className="text-2xl font-black text-white">{stats.totalEntries}</p>
              <p className="text-[10px] font-mono text-slate-600">seq #{stats.latestSequence}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-[11px] text-slate-500">Hash genesis</p>
              <p className="text-[10px] font-mono text-emerald-400 mt-1 break-all">{H_SHORT(stats.genesisHash)}</p>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
              <p className="text-[11px] text-slate-500">Dernier hash</p>
              <p className="text-[10px] font-mono text-cyan-400 mt-1 break-all">{H_SHORT(stats.latestHash)}</p>
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4">
              <p className="text-[11px] text-slate-500">Domaines actifs</p>
              <p className="text-2xl font-black text-white">{stats.domains.filter(d => d.count > 0).length}</p>
              <p className="text-[10px] text-slate-500">/ {stats.domains.length} configurés</p>
            </div>
          </div>
        )}

        {/* ── Domain stats mini-cards ───────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {stats.domains.map(d => (
              <button
                key={d.domain}
                onClick={() => setDomainFilter(domainFilter === d.domain ? "ALL" : d.domain)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  domainFilter === d.domain
                    ? (DOMAIN_COLOR[d.domain] ?? "bg-slate-700 text-white border-slate-600") + " ring-1 ring-current"
                    : "border-slate-700/50 bg-slate-800/30 hover:bg-slate-800/60"
                }`}
              >
                <p className="text-[10px] text-slate-500">{DOMAIN_LABEL[d.domain] ?? d.domain}</p>
                <p className="text-lg font-black text-white">{d.count}</p>
                {d.latest && <p className="text-[9px] text-slate-600 truncate">{d.latest.action.replace("PTW:", "")}</p>}
              </button>
            ))}
          </div>
        )}

        {/* ── Chain viewer ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-emerald-400" />
              Chaîne cryptographique — {domainFilter === "ALL" ? "Tous domaines" : DOMAIN_LABEL[domainFilter] ?? domainFilter}
              {chain.length > 0 && <span className="text-slate-500 font-normal">({chain.length} derniers blocs)</span>}
            </h2>
            {domainFilter !== "ALL" && (
              <button onClick={() => setDomainFilter("ALL")} className="text-[11px] text-slate-500 hover:text-white underline">
                Afficher tous les domaines
              </button>
            )}
          </div>

          {loadingChain ? (
            <div className="flex items-center justify-center h-32 rounded-xl border border-slate-700 bg-slate-800/20">
              <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
              <span className="ml-3 text-slate-400">Chargement de la chaîne…</span>
            </div>
          ) : chain.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-slate-700 bg-slate-800/10 text-center p-6 space-y-3">
              <Lock className="w-10 h-10 text-slate-600" />
              <div>
                <p className="text-slate-400 font-medium">Aucune entrée dans ce domaine</p>
                <p className="text-slate-600 text-sm">
                  Le journal se remplira automatiquement lors des mutations PTW.
                </p>
              </div>
              {/* Genesis block always displayed */}
              <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 w-full max-w-md text-left">
                <p className="text-[10px] text-emerald-400 font-semibold mb-1">⛓ Bloc genesis (ancre immuable)</p>
                <p className="text-[9px] font-mono text-emerald-500/70 break-all">{chainData?.genesisHash ?? "—"}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              {/* Genesis anchor */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-400 font-semibold">Bloc Genesis — Ancre immuable</p>
                    <p className="text-[9px] font-mono text-emerald-500/70">{H_SHORT(chainData?.genesisHash ?? "")}</p>
                  </div>
                  <Badge className="ml-auto bg-emerald-500/10 text-emerald-400 text-[9px]">SHA-256</Badge>
                </div>
              </div>

              {/* Chain entries (latest first from API, oldest at top visually) */}
              {[...chain].reverse().map((entry, idx, arr) => (
                <Block
                  key={entry.id}
                  entry={entry}
                  prevEntry={idx > 0 ? arr[idx - 1] : undefined}
                  isFirst={idx === 0}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Scientific formulas ───────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-5">
          <button
            onClick={() => setShowFormulas(!showFormulas)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-300 w-full text-left"
          >
            <FlaskConical className="w-4 h-4 text-emerald-400" />
            Formulation cryptographique — SHA-256 Hash-Chaining
            {showFormulas ? <ChevronDown className="w-3.5 h-3.5 ml-auto" /> : <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
          </button>
          {showFormulas && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-mono">
              {[
                {
                  color: "text-emerald-400", label: "Hash genesis",
                  lines: ["H(0) = SHA256(MAINTRIX_GENESIS_BLOCK_v1_PTW_…)", "Ancre immuable de la chaîne", "Constante fixe, connue à l'avance"],
                },
                {
                  color: "text-cyan-400", label: "Hash entrée n",
                  lines: ["H(n) = SHA256(", "  seq_n || ts_n || domain || action", "  || entityId || actorId", "  || canonical_payload || H(n-1))"],
                },
                {
                  color: "text-violet-400", label: "Canonicalisation payload",
                  lines: ["JSON.stringify(payload, sortedKeys)", "Déterministe — tri alphabétique des clés", "Élimine les variations d'ordre JSON"],
                },
                {
                  color: "text-blue-400", label: "Vérification intégrité",
                  lines: ["∀n: H_stored(n) == H_recomputed(n)", "∀n: prev(n) == H_stored(n-1)", "O(N) — lit toute la chaîne séquentiellement"],
                },
                {
                  color: "text-amber-400", label: "Domaine PTW isolé",
                  lines: ["Toutes mutations → journalizePTWMutation()", "Snapshot payload dénormalisé (immuable)", "Best-effort : non-blocking sur l'API"],
                },
                {
                  color: "text-pink-400", label: "Propriétés cryptographiques",
                  lines: ["Résistance aux collisions (SHA-256: 2^128)", "Imputabilité : actorName dénormalisé", "Append-only : aucun UPDATE/DELETE applicatif"],
                },
              ].map(({ color, label, lines }) => (
                <div key={label} className="rounded-lg bg-slate-900/60 border border-slate-700/50 p-3">
                  <div className={`${color} font-bold mb-1`}>{label}</div>
                  {lines.map((l, i) => (
                    <div key={i} className={i === 0 ? "text-slate-400" : "text-slate-500"}>{l}</div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

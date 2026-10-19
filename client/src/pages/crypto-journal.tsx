import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ModernNavigation } from "@/components/modern-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, CheckCircle, ChevronDown, ChevronRight, FlaskConical,
  Link2, Lock, RefreshCw, Search, Shield, ShieldAlert, ShieldCheck, XCircle
} from "lucide-react";
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

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
  PTW_DOMAIN:      "bg-etat-critique-fond text-etat-critique-texte border-etat-critique-filet",
  GMAO_DOMAIN:     "bg-etat-encours-fond text-etat-encours-texte border-etat-encours-filet",
  IMCA_DOMAIN:     "bg-signal-deep/20 text-signal border-rule/30",
  SYSTEM_DOMAIN:   "bg-slate-500/20 text-ink-soft border-rule",
  SECURITY_DOMAIN: "bg-etat-alerte-fond text-etat-alerte-texte border-etat-alerte-filet",
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
          <div className={`w-0.5 h-full ${isValid ? "bg-etat-nominal-fond" : "bg-etat-critique-fond"}`} />
          <Link2 className={`w-3 h-3 absolute ${isValid ? "text-etat-nominal-texte/70" : "text-etat-critique-texte/70"}`} />
        </div>
      )}

      <div className={`rounded-none border p-4 transition-all cursor-pointer hover:bg-white ${
        isValid
          ? "border-etat-nominal-filet bg-white"
          : "border-etat-critique-filet bg-etat-critique-fond"
      }`} onClick={() => setOpen(!open)}>

        <div className="flex items-start gap-3">
          {/* Numéro de bloc */}
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${
            isValid ? "bg-etat-nominal-fond text-etat-nominal-texte" : "bg-etat-critique-fond text-etat-critique-texte"
          }`}>
            #{entry.sequenceNumber}
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${DOMAIN_COLOR[entry.domain] ?? "bg-paper-deep text-ink-soft"}`}>
                {DOMAIN_LABEL[entry.domain] ?? entry.domain}
              </span>
              <span className="text-sm font-semibold text-ink">
                {ACTION_VERB[entry.action] ?? entry.action}
              </span>
              {!isValid && (
                <Badge className="bg-etat-critique-fond text-etat-critique-texte text-[10px] animate-pulse">Altération détectée</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono text-ink-mute">
              <span>Entité : <span className="text-ink-mute">{entry.entityId}</span></span>
              <span>Acteur : <span className="text-ink-mute">{entry.actorName}</span></span>
              <span>Date : <span className="text-ink-mute">{FMT_DATE(entry.createdAt)}</span></span>
              <div className="flex items-center gap-1">
                {isValid ? <CheckCircle className="w-3 h-3 text-etat-nominal-texte" /> : <XCircle className="w-3 h-3 text-etat-critique-texte" />}
                <span className={isValid ? "text-etat-nominal-texte" : "text-etat-critique-texte"}>{isValid ? "Hash valide" : "Hash invalide"}</span>
              </div>
            </div>

            {/* Hash display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[9px] font-mono">
              <span className="text-ink-soft">prev: <span className="text-ink-mute">{entry.prevHashShort ?? H_SHORT(entry.previousHash)}</span></span>
              <span className="text-ink-soft">hash: <span className="text-etat-nominal-texte/80">{entry.hashShort ?? H_SHORT(entry.entryHash)}</span></span>
            </div>
          </div>

          <div className="text-ink-soft flex-shrink-0">
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
        </div>

        {/* Expanded detail */}
        {open && (
          <div className="mt-4 ml-12 space-y-3 border-t border-rule pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-ink-mute mb-1">Hash SHA-256 complet</p>
                <p className="text-[9px] font-mono text-etat-nominal-texte/80 break-all">{entry.entryHash}</p>
              </div>
              <div>
                <p className="text-[10px] text-ink-mute mb-1">Hash précédent</p>
                <p className="text-[9px] font-mono text-ink-mute break-all">{entry.previousHash}</p>
              </div>
            </div>

            {entry.payload && Object.keys(entry.payload).length > 0 && (
              <div>
                <p className="text-[10px] text-ink-mute mb-1">Snapshot payload (immuable)</p>
                <pre className="text-[9px] font-mono text-ink-mute bg-paper-deep rounded-lg p-2 overflow-x-auto max-h-32">
                  {JSON.stringify(entry.payload, null, 2)}
                </pre>
              </div>
            )}

            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
              <div>
                <p className="text-[10px] text-ink-mute mb-1">Métadonnées contextuelles</p>
                <pre className="text-[9px] font-mono text-ink-mute bg-paper-deep rounded-lg p-2 overflow-x-auto">
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
    <AppShell filAriane={[{ libelle: "Sécurité" }, { libelle: "Journal cryptographique" }]} largeur="large">
    <div className="space-y-6">
      <ModernNavigation />
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="rounded-none border border-etat-nominal-filet bg-paper-deep p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-none bg-etat-nominal-fond border border-etat-nominal-filet flex items-center justify-center">
                <Lock className="w-6 h-6 text-etat-nominal-texte" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-ink">Journal Cryptographique</h1>
                <p className="text-sm text-ink-mute">
                  Enclavement SHA-256 · Append-only · Domaine PTW isolé · Vérification d'intégrité
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => { refetchChain(); refetchStats(); }}
                className="bg-paper-deep hover:bg-paper-deep text-ink gap-2"
                size="sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingChain ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
              <Button
                onClick={handleVerify}
                disabled={verifying}
                className="bg-etat-nominal-fond hover:bg-etat-nominal-vif text-white gap-2"
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
          <div className={`rounded-none border p-4 flex items-start gap-4 ${
            verifyData.isValid
              ? "border-etat-nominal-filet bg-etat-nominal-fond"
              : "border-etat-critique-filet bg-etat-critique-fond"
          }`}>
            {verifyData.isValid
              ? <ShieldCheck className="w-8 h-8 text-etat-nominal-texte flex-shrink-0" />
              : <ShieldAlert className="w-8 h-8 text-etat-critique-texte flex-shrink-0" />
            }
            <div>
              <p className={`font-bold text-sm ${verifyData.isValid ? "text-etat-nominal-texte" : "text-etat-critique-texte"}`}>
                {verifyData.isValid
                  ? `Chaîne intègre — ${verifyData.verifiedEntries}/${verifyData.totalEntries} blocs vérifiés (${verifyData.chainCoverage}%)`
                  : `Altération détectée au bloc #${verifyData.firstTamperedAt} — ${verifyData.firstTamperedEntry?.action}`
                }
              </p>
              <p className="text-[11px] text-ink-mute mt-1 font-mono">
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
            <div className="rounded-none border border-rule bg-white p-4">
              <p className="text-[11px] text-ink-mute">Total entrées</p>
              <p className="text-2xl font-black text-ink">{stats.totalEntries}</p>
              <p className="text-[10px] font-mono text-ink-soft">seq #{stats.latestSequence}</p>
            </div>
            <div className="rounded-none border border-etat-nominal-filet bg-etat-nominal-fond p-4">
              <p className="text-[11px] text-ink-mute">Hash genesis</p>
              <p className="text-[10px] font-mono text-etat-nominal-texte mt-1 break-all">{H_SHORT(stats.genesisHash)}</p>
            </div>
            <div className="rounded-none border border-etat-encours-filet bg-etat-encours-fond p-4">
              <p className="text-[11px] text-ink-mute">Dernier hash</p>
              <p className="text-[10px] font-mono text-etat-encours-texte mt-1 break-all">{H_SHORT(stats.latestHash)}</p>
            </div>
            <div className="rounded-none border border-rule bg-white p-4">
              <p className="text-[11px] text-ink-mute">Domaines actifs</p>
              <p className="text-2xl font-black text-ink">{stats.domains.filter(d => d.count > 0).length}</p>
              <p className="text-[10px] text-ink-mute">/ {stats.domains.length} configurés</p>
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
                className={`rounded-none border p-3 text-left transition-all ${
                  domainFilter === d.domain
                    ? (DOMAIN_COLOR[d.domain] ?? "bg-paper-deep text-white border-rule") + " ring-1 ring-current"
                    : "border-rule bg-white hover:bg-white"
                }`}
              >
                <p className="text-[10px] text-ink-mute">{DOMAIN_LABEL[d.domain] ?? d.domain}</p>
                <p className="text-lg font-black text-ink">{d.count}</p>
                {d.latest && <p className="text-[9px] text-ink-soft truncate">{d.latest.action.replace("PTW:", "")}</p>}
              </button>
            ))}
          </div>
        )}

        {/* ── Chain viewer ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-ink-soft flex items-center gap-2">
              <Link2 className="w-4 h-4 text-etat-nominal-texte" />
              Chaîne cryptographique — {domainFilter === "ALL" ? "Tous domaines" : DOMAIN_LABEL[domainFilter] ?? domainFilter}
              {chain.length > 0 && <span className="text-ink-mute font-normal">({chain.length} derniers blocs)</span>}
            </h2>
            {domainFilter !== "ALL" && (
              <button onClick={() => setDomainFilter("ALL")} className="text-[11px] text-ink-mute hover:text-ink underline">
                Afficher tous les domaines
              </button>
            )}
          </div>

          {loadingChain ? (
            <div className="flex items-center justify-center h-32 rounded-none border border-rule bg-white">
              <RefreshCw className="w-5 h-5 text-etat-nominal-texte animate-spin" />
              <span className="ml-3 text-ink-mute">Chargement de la chaîne…</span>
            </div>
          ) : chain.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 rounded-none border border-dashed border-rule bg-white text-center p-6 space-y-3">
              <Lock className="w-10 h-10 text-ink-soft" />
              <div>
                <p className="text-ink-mute font-medium">Aucune entrée dans ce domaine</p>
                <p className="text-ink-soft text-sm">
                  Le journal se remplira automatiquement lors des mutations PTW.
                </p>
              </div>
              {/* Genesis block always displayed */}
              <div className="mt-4 rounded-none border border-etat-nominal-filet bg-etat-nominal-fond p-4 w-full max-w-md text-left">
                <p className="text-[10px] text-etat-nominal-texte font-semibold mb-1">Bloc genesis (ancre immuable)</p>
                <p className="text-[9px] font-mono text-etat-nominal-texte/70 break-all">{chainData?.genesisHash ?? "—"}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              {/* Genesis anchor */}
              <div className="rounded-none border border-etat-nominal-filet bg-etat-nominal-fond p-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-etat-nominal-fond flex items-center justify-center">
                    <Lock className="w-3.5 h-3.5 text-etat-nominal-texte" />
                  </div>
                  <div>
                    <p className="text-[10px] text-etat-nominal-texte font-semibold">Bloc Genesis — Ancre immuable</p>
                    <p className="text-[9px] font-mono text-etat-nominal-texte/70">{H_SHORT(chainData?.genesisHash ?? "")}</p>
                  </div>
                  <Badge className="ml-auto bg-etat-nominal-fond text-etat-nominal-texte text-[9px]">SHA-256</Badge>
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
        <div className="rounded-none border border-rule bg-white p-5">
          <button
            onClick={() => setShowFormulas(!showFormulas)}
            className="flex items-center gap-2 text-sm font-semibold text-ink-soft w-full text-left"
          >
            <FlaskConical className="w-4 h-4 text-etat-nominal-texte" />
            Formulation cryptographique — SHA-256 Hash-Chaining
            {showFormulas ? <ChevronDown className="w-3.5 h-3.5 ml-auto" /> : <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
          </button>
          {showFormulas && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-mono">
              {[
                {
                  color: "text-etat-nominal-texte", label: "Hash genesis",
                  lines: ["H(0) = SHA256(MAINTRIX_GENESIS_BLOCK_v1_PTW_…)", "Ancre immuable de la chaîne", "Constante fixe, connue à l'avance"],
                },
                {
                  color: "text-etat-encours-texte", label: "Hash entrée n",
                  lines: ["H(n) = SHA256(", "  seq_n || ts_n || domain || action", "  || entityId || actorId", "  || canonical_payload || H(n-1))"],
                },
                {
                  color: "text-signal", label: "Canonicalisation payload",
                  lines: ["JSON.stringify(payload, sortedKeys)", "Déterministe — tri alphabétique des clés", "Élimine les variations d'ordre JSON"],
                },
                {
                  color: "text-etat-encours-texte", label: "Vérification intégrité",
                  lines: ["∀n: H_stored(n) == H_recomputed(n)", "∀n: prev(n) == H_stored(n-1)", "O(N) — lit toute la chaîne séquentiellement"],
                },
                {
                  color: "text-etat-alerte-texte", label: "Domaine PTW isolé",
                  lines: ["Toutes mutations → journalizePTWMutation()", "Snapshot payload dénormalisé (immuable)", "Best-effort : non-blocking sur l'API"],
                },
                {
                  color: "text-signal", label: "Propriétés cryptographiques",
                  lines: ["Résistance aux collisions (SHA-256: 2^128)", "Imputabilité : actorName dénormalisé", "Append-only : aucun UPDATE/DELETE applicatif"],
                },
              ].map(({ color, label, lines }) => (
                <div key={label} className="rounded-lg bg-paper-deep border border-rule p-3">
                  <div className={`${color} font-bold mb-1`}>{label}</div>
                  {lines.map((l, i) => (
                    <div key={i} className={i === 0 ? "text-ink-mute" : "text-ink-mute"}>{l}</div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
    </AppShell>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ModernNavigation } from "@/components/modern-navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Activity, AlertTriangle, Brain, CheckCircle, ChevronDown, ChevronRight,
  Clock, RefreshCw, Shield, TrendingDown, TrendingUp, Zap
} from "lucide-react";
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

// ─── Types ───────────────────────────────────────────────────────────────────
interface RULDistribution {
  mean: number; median: number; mode: number; stdDev: number; unit: "heures";
  confidenceIntervals: { p05: number; p10: number; p25: number; p50: number; p75: number; p90: number; p95: number };
}
interface StochasticRUL {
  model: string; recommendedModel: "wiener" | "gamma" | "ensemble";
  currentDegradation: number; failureThreshold: number; remainingMargin: number;
  wienerRUL?: RULDistribution; gammaRUL?: RULDistribution;
  recommended: RULDistribution; ensemble?: RULDistribution;
  wienerParams?: { mu: number; sigma: number; r2: number };
  gammaParams?: { alpha: number; beta: number; positiveRatio: number };
  warnings: string[]; explanation: string;
}
interface IMCAResult {
  equipmentId: number; equipmentName: string; timestamp: string;
  ISD: number; IDC: number; ISO: number; IRS: number; IMCA: number;
  mahalanobisDistance: number;
  klDivergence: number;
  jsDivergence: number;
  weights: { ISD: number; IDC: number; ISO: number; IRS: number };
  trend: "improving" | "stable" | "degrading" | "critical";
  alertLevel: "ok" | "watch" | "warning" | "critical";
  rul_hours: number | null;
  stochasticRUL?: StochasticRUL;
  explanation: { ISD: string; IDC: string; ISO: string; IRS: string; dominantFactor: string; recommendation: string };
}
interface FleetResult { results: IMCAResult[]; fleetIMCA: number; criticalCount: number; degradingCount: number; }
interface Equipment { id: number; name: string; type: string; status: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const scoreColor = (v: number) =>
  v >= 75 ? "text-etat-nominal-texte" : v >= 55 ? "text-etat-encours-texte" : v >= 35 ? "text-etat-alerte-texte" : "text-etat-critique-texte";

const scoreBg = (v: number) =>
  v >= 75 ? "bg-etat-nominal-fond border-etat-nominal-filet" : v >= 55 ? "bg-etat-encours-fond border-etat-encours-filet"
  : v >= 35 ? "bg-etat-alerte-fond border-etat-alerte-filet" : "bg-etat-critique-fond border-etat-critique-filet";

const trendIcon = (t: string) => {
  if (t === "improving") return <TrendingUp className="w-4 h-4 text-etat-nominal-texte" />;
  if (t === "degrading") return <TrendingDown className="w-4 h-4 text-etat-alerte-texte" />;
  if (t === "critical") return <AlertTriangle className="w-4 h-4 text-etat-critique-texte" />;
  return <Activity className="w-4 h-4 text-etat-encours-texte" />;
};

/**
 * ⚠️ Ces pastilles posaient la couleur VIVE à 20 % d'opacité
 * (`bg-etat-nominal-fond`). Un fond translucide se compose sur son parent
 * AVANT tout calcul de contraste : le vert vif à 20 % sur la carte donnait
 * rgb(204, 223, 216), et le texte par-dessus tombait à 4,27:1 — sous le
 * seuil AA. Et comme la grille affiche une pastille par équipement, le
 * défaut se répétait 250 fois sur un seul écran.
 *
 * Les jetons `puce` portent déjà le couple fond + texte + filet dont le
 * contraste est mesuré. On s'en sert, au lieu de recomposer une teinte.
 */
const alertBadge = (level: string) => {
  const registre: Record<string, RegistreEtat> = {
    ok: "nominal", watch: "encours", warning: "alerte", critical: "critique",
  };
  const label: Record<string, string> = { ok: "Nominal", watch: "Surveillance", warning: "Alerte", critical: "Critique" };
  return <PuceEtat registre={registre[level] ?? "neutre"}>{label[level] ?? level}</PuceEtat>;
};

// ─── Gauge component ──────────────────────────────────────────────────────────
function Gauge({ value, size = 80, label }: { value: number; size?: number; label: string }) {
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ * 0.75;
  // Arc de jauge : un élément graphique, pas du texte. Les valeurs sont
  // littérales parce que SVG n'accepte pas de classe Tailwind ; elles
  // reprennent les jetons d'état de tailwind.config.ts.
  const color = value >= 75 ? "#2E7D4F" : value >= 55 ? "#006B97" : value >= 35 ? "#B9770E" : "#C0392B";
  const rotation = -135;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#334155" strokeWidth={size * 0.08}
          strokeDasharray={`${circ * 0.75} ${circ}`} strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={size * 0.09}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          transform={`rotate(${rotation} ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 0.8s ease" }} />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={size * 0.2} fontWeight="700" fill={color}>{value}</text>
      </svg>
      <span className="text-xs text-ink-mute font-medium">{label}</span>
    </div>
  );
}

// ─── Sub-index bar ────────────────────────────────────────────────────────────
function SubBar({ label, value, weight, tip }: { label: string; value: number; weight: number; tip: string }) {
  const color = value >= 75 ? "bg-etat-nominal-vif" : value >= 55 ? "bg-etat-encours-vif" : value >= 35 ? "bg-etat-alerte-vif" : "bg-etat-critique-vif";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="space-y-1 cursor-help">
            <div className="flex justify-between text-xs">
              <span className="text-ink-soft font-semibold">{label}</span>
              <span className={`font-bold ${scoreColor(value)}`}>{value}/100 <span className="text-ink-mute">({Math.round(weight * 100)}%)</span></span>
            </div>
            <div className="h-2 rounded-full bg-paper-deep">
              <div className={`h-2 rounded-full ${color} transition-all duration-700`} style={{ width: `${value}%` }} />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-paper-deep border-rule text-slate-200 text-xs p-3">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Equipment card ───────────────────────────────────────────────────────────
function EquipmentCard({ r, onSelect }: { r: IMCAResult; onSelect: () => void }) {
  return (
    <div onClick={onSelect} className={`relative rounded-none border p-4 cursor-pointer transition-colors ${scoreBg(r.IMCA)}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-ink truncate max-w-[180px]">{r.equipmentName}</p>
          <div className="flex items-center gap-2 mt-1">{alertBadge(r.alertLevel)}{trendIcon(r.trend)}</div>
        </div>
        <div className={`text-2xl font-black ${scoreColor(r.IMCA)}`}>{r.IMCA}</div>
      </div>
      <div className="grid grid-cols-4 gap-1 text-center">
        {["ISD", "IDC", "ISO", "IRS"].map(k => (
          <div key={k}>
            <div className={`text-sm font-bold ${scoreColor((r as any)[k])}`}>{(r as any)[k]}</div>
            <div className="text-[10px] text-ink-mute">{k}</div>
          </div>
        ))}
      </div>
      {r.rul_hours !== null && (
        <div className="mt-2 flex items-center gap-1 text-xs text-etat-alerte-texte">
          <Clock className="w-3 h-3" />
          RUL P50 : ~{r.stochasticRUL?.recommended.median ?? r.rul_hours}h
          {r.stochasticRUL && (
            <span className="text-ink-mute ml-1">
              [IC90 : {r.stochasticRUL.recommended.confidenceIntervals.p05}–{r.stochasticRUL.recommended.confidenceIntervals.p95}h]
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ r }: { r: IMCAResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-none border border-rule bg-paper-deep p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-ink">{r.equipmentName}</h2>
          <div className="flex items-center gap-2 mt-1">{alertBadge(r.alertLevel)}{trendIcon(r.trend)}
            <span className="text-xs text-ink-mute">{r.trend === "improving" ? "En amélioration" : r.trend === "stable" ? "Stable" : r.trend === "degrading" ? "En dégradation" : "Critique"}</span>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-5xl font-black ${scoreColor(r.IMCA)}`}>{r.IMCA}</div>
          <div className="text-xs text-ink-mute mt-1">IMCA / 100</div>
        </div>
      </div>

      {/* 4 gauges */}
      <div className="grid grid-cols-4 gap-4 py-2 border-y border-rule">
        <Gauge value={r.ISD} label="ISD" size={90} />
        <Gauge value={r.IDC} label="IDC" size={90} />
        <Gauge value={r.ISO} label="ISO" size={90} />
        <Gauge value={r.IRS} label="IRS" size={90} />
      </div>

      {/* Sub-index bars */}
      <div className="space-y-3">
        <SubBar label="ISD — Santé Dynamique" value={r.ISD} weight={r.weights.ISD} tip={r.explanation.ISD} />
        <SubBar label="IDC — Dérive Comportementale" value={r.IDC} weight={r.weights.IDC} tip={r.explanation.IDC} />
        <SubBar label="ISO — Stress Opérationnel" value={r.ISO} weight={r.weights.ISO} tip={r.explanation.ISO} />
        <SubBar label="IRS — Résilience Structurelle" value={r.IRS} weight={r.weights.IRS} tip={r.explanation.IRS} />
      </div>

      {/* Technical metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-none bg-white border border-rule p-3">
          <p className="text-xs text-ink-mute mb-1">Écart au comportement normal</p>
          <p className="text-lg font-bold text-ink">{r.mahalanobisDistance.toFixed(3)}</p>
        </div>
        <div className="rounded-none bg-white border border-rule p-3">
          <p className="text-xs text-ink-mute mb-1">Distance Jensen-Shannon (√JSD)</p>
          <p className="text-lg font-bold text-ink">
            {((r.jsDivergence ?? r.klDivergence) || 0).toFixed(4)}
            <span className="text-xs text-ink-mute ml-1">
              {(r.jsDivergence ?? 0) < 0.10 ? "dérive négligeable" : (r.jsDivergence ?? 0) < 0.22 ? "dérive modérée" : (r.jsDivergence ?? 0) < 0.38 ? "dérive marquée" : "dérive sévère"}
            </span>
          </p>
        </div>
        {r.stochasticRUL && (
          <div className="col-span-2 rounded-none bg-etat-alerte-fond border border-etat-alerte-filet p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-etat-alerte-texte flex-shrink-0" />
              <span className="text-xs text-etat-alerte-texte font-semibold">
                RUL Stochastique —&nbsp;
                {r.stochasticRUL.recommendedModel === "ensemble"
                  ? "Fusion Wiener + Gamma"
                  : r.stochasticRUL.recommendedModel === "wiener"
                  ? "Processus de Wiener (Inverse Gaussienne)"
                  : "Processus Gamma (Monte Carlo)"}
              </span>
            </div>

            {/* Median + mean */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-etat-alerte-fond p-2">
                <p className="text-[10px] text-etat-alerte-texte/70">Mode</p>
                <p className="text-base font-bold text-amber-200">{r.stochasticRUL.recommended.mode}h</p>
              </div>
              <div className="rounded-lg bg-etat-alerte-fond border border-etat-alerte-filet p-2">
                <p className="text-[10px] text-etat-alerte-texte">Médiane (P50)</p>
                <p className="text-lg font-black text-amber-100">{r.stochasticRUL.recommended.median}h</p>
              </div>
              <div className="rounded-lg bg-etat-alerte-fond p-2">
                <p className="text-[10px] text-etat-alerte-texte/70">Espérance</p>
                <p className="text-base font-bold text-amber-200">{r.stochasticRUL.recommended.mean}h</p>
              </div>
            </div>

            {/* Confidence interval bar */}
            <div className="space-y-1">
              <p className="text-[10px] text-ink-mute font-mono">Intervalles de confiance</p>
              <div className="relative h-6 rounded-full bg-white overflow-hidden">
                {(() => {
                  const ci = r.stochasticRUL.recommended.confidenceIntervals;
                  const max = Math.max(ci.p95 * 1.05, 1);
                  const pct = (v: number) => `${Math.round((v / max) * 100)}%`;
                  return (
                    <>
                      {/* P05–P95 range */}
                      <div className="absolute top-0 h-full bg-etat-alerte-fond rounded-full"
                        style={{ left: pct(ci.p05), width: `${Math.round(((ci.p95 - ci.p05) / max) * 100)}%` }} />
                      {/* P10–P90 range */}
                      <div className="absolute top-0 h-full bg-etat-alerte-fond"
                        style={{ left: pct(ci.p10), width: `${Math.round(((ci.p90 - ci.p10) / max) * 100)}%` }} />
                      {/* P25–P75 IQR */}
                      <div className="absolute top-0 h-full bg-etat-alerte-fond"
                        style={{ left: pct(ci.p25), width: `${Math.round(((ci.p75 - ci.p25) / max) * 100)}%` }} />
                      {/* Median marker */}
                      <div className="absolute top-0 h-full w-0.5 bg-white"
                        style={{ left: pct(ci.p50) }} />
                    </>
                  );
                })()}
              </div>
              <div className="flex justify-between text-[9px] text-ink-soft font-mono">
                {[
                  ["P05", r.stochasticRUL.recommended.confidenceIntervals.p05],
                  ["P25", r.stochasticRUL.recommended.confidenceIntervals.p25],
                  ["P50", r.stochasticRUL.recommended.confidenceIntervals.p50],
                  ["P75", r.stochasticRUL.recommended.confidenceIntervals.p75],
                  ["P95", r.stochasticRUL.recommended.confidenceIntervals.p95],
                ].map(([label, val]) => (
                  <span key={label as string}>{label}: {val}h</span>
                ))}
              </div>
            </div>

            {/* σ and margin */}
            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-ink-mute">
              <div>σ = ±{r.stochasticRUL.recommended.stdDev}h</div>
              <div>Marge = {r.stochasticRUL.remainingMargin.toFixed(1)} pts</div>
              {r.stochasticRUL.wienerParams && (
                <div>μ̂ = {r.stochasticRUL.wienerParams.mu.toFixed(4)}/h</div>
              )}
            </div>

            {/* Wiener vs Gamma comparison if both available */}
            {r.stochasticRUL.wienerRUL && r.stochasticRUL.gammaRUL && (
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-etat-alerte-filet">
                <div className="text-[10px] text-ink-mute">
                  <span className="text-signal font-semibold">Wiener IG</span>{" "}
                  P50={r.stochasticRUL.wienerRUL.median}h · σ={r.stochasticRUL.wienerRUL.stdDev}h
                </div>
                <div className="text-[10px] text-ink-mute">
                  <span className="text-etat-nominal-texte font-semibold">Gamma MC</span>{" "}
                  P50={r.stochasticRUL.gammaRUL.median}h · σ={r.stochasticRUL.gammaRUL.stdDev}h
                </div>
              </div>
            )}

            {/* Warnings */}
            {r.stochasticRUL.warnings.length > 0 && (
              <div className="text-[10px] text-etat-alerte-texte/80 italic">
                {r.stochasticRUL.warnings[0]}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recommendation */}
      <div className="rounded-none bg-etat-encours-fond border border-etat-encours-filet p-4 space-y-2">
        <div className="flex items-center gap-2 text-etat-encours-texte font-semibold text-sm"><Brain className="w-4 h-4" /> Facteur dominant</div>
        <p className="text-xs text-ink-mute">{r.explanation.dominantFactor}</p>
        <div className="flex items-center gap-2 text-etat-encours-texte font-semibold text-sm mt-2"><Zap className="w-4 h-4" /> Recommandation</div>
        <p className="text-xs text-ink-soft">{r.explanation.recommendation}</p>
      </div>

      {/* Expandable detail */}
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-xs text-ink-mute hover:text-ink-soft transition-colors">
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} Détails explicatifs par sous-indice
      </button>
      {open && (
        <div className="space-y-3 border-t border-rule pt-3">
          {(["ISD", "IDC", "ISO", "IRS"] as const).map(k => (
            <div key={k} className="rounded-lg bg-white p-3">
              <p className="text-xs font-semibold text-ink-soft mb-1">{k}</p>
              <p className="text-xs text-ink-mute">{r.explanation[k]}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function IMCADashboard() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [windowShort, setWindowShort] = useState("7");
  const [windowLong, setWindowLong] = useState("60");

  const { data: fleet, isLoading: fleetLoading, refetch: refetchFleet } = useQuery<FleetResult>({
    queryKey: ["/api/imca/fleet"],
    refetchInterval: 120_000,
  });

  const { data: equipList } = useQuery<Equipment[]>({ queryKey: ["/api/imca/equipment-list"] });

  const { data: detail, isLoading: detailLoading } = useQuery<IMCAResult>({
    queryKey: ["/api/imca/equipment", selectedId, windowShort, windowLong],
    queryFn: () =>
      apiRequest(`/api/imca/equipment/${selectedId}?windowShort=${windowShort}&windowLong=${windowLong}`),
    enabled: selectedId !== null,
  });

  const fleetIMCA = fleet?.fleetIMCA ?? 0;

  return (
    <AppShell filAriane={[{ libelle: "Supervision" }, { libelle: "Indice cognitif" }]} largeur="large">
    <div className="space-y-6">
      <ModernNavigation />
      <div className="pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-none bg-signal-deep/20 border border-rule/30">
              <Brain className="w-6 h-6 text-signal" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-ink">IMCA — Indice Cognitif Composite</h1>
              <p className="text-sm text-ink-mute">Score de santé composite combinant comportement, dérive, stress opérationnel et résilience structurelle</p>
            </div>
          </div>
        </div>

        {/* Fleet KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-none border border-rule/30 bg-signal-deep/10 p-5 text-center">
            <div className={`text-4xl font-black mb-1 ${scoreColor(fleetIMCA)}`}>{fleetLoading ? "…" : fleetIMCA}</div>
            <div className="text-xs text-ink-mute">IMCA Flotte</div>
          </div>
          <div className="rounded-none border border-rule bg-white p-5 text-center">
            <div className="text-4xl font-black mb-1 text-ink">{fleet?.results.length ?? "–"}</div>
            <div className="text-xs text-ink-mute">Actifs analysés</div>
          </div>
          <div className="rounded-none border border-etat-critique-filet bg-etat-critique-fond p-5 text-center">
            <div className="text-4xl font-black mb-1 text-etat-critique-texte">{fleet?.criticalCount ?? "–"}</div>
            <div className="text-xs text-ink-mute">Critiques</div>
          </div>
          <div className="rounded-none border border-etat-alerte-filet bg-etat-alerte-fond p-5 text-center">
            <div className="text-4xl font-black mb-1 text-etat-alerte-texte">{fleet?.degradingCount ?? "–"}</div>
            <div className="text-xs text-ink-mute">En dégradation</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Equipment selection & fleet list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-ink">Analyse par équipement</h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => refetchFleet()} className="text-ink-mute hover:text-ink">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Fenêtre glissante params */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-ink-mute mb-1 block">Fenêtre courte (ISD/ISO)</label>
                <Select value={windowShort} onValueChange={setWindowShort}>
                  <SelectTrigger className="bg-white border-rule text-ink-soft h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-rule">
                    {["3", "7", "14", "30"].map(v => <SelectItem key={v} value={v} className="text-ink-soft">{v} jours</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-ink-mute mb-1 block">Fenêtre longue KL (IDC)</label>
                <Select value={windowLong} onValueChange={setWindowLong}>
                  <SelectTrigger className="bg-white border-rule text-ink-soft h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-rule">
                    {["30", "60", "90"].map(v => <SelectItem key={v} value={v} className="text-ink-soft">{v} jours</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fleet grid */}
            {fleetLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-36 rounded-none bg-white animate-pulse" />
                ))}
              </div>
            ) : fleet?.results && fleet.results.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
                {fleet.results.map(r => (
                  <EquipmentCard key={r.equipmentId} r={r} onSelect={() => setSelectedId(r.equipmentId)} />
                ))}
              </div>
            ) : (
              <div className="rounded-none border border-rule bg-white p-8 text-center">
                <Activity className="w-8 h-8 text-ink-soft mx-auto mb-3" />
                <p className="text-ink-mute text-sm">Aucune donnée capteur disponible.</p>
                <p className="text-ink-soft text-xs mt-1">Connectez des capteurs IoT pour alimenter l'IMCA.</p>
              </div>
            )}

            {/* Equipment selector if fleet empty */}
            {(!fleet?.results || fleet.results.length === 0) && equipList && equipList.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-ink-mute">Sélectionner un équipement à analyser :</p>
                <div className="grid grid-cols-1 gap-2">
                  {equipList.slice(0, 8).map(e => (
                    <button key={e.id} onClick={() => setSelectedId(e.id)}
                      className="flex items-center justify-between rounded-none border border-rule bg-white px-4 py-2 hover:border-rule/50 transition-colors text-left">
                      <span className="text-sm text-ink-soft">{e.name}</span>
                      <ChevronRight className="w-4 h-4 text-ink-soft" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Detail panel */}
          <div>
            {detailLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-none bg-white animate-pulse" />
                ))}
              </div>
            ) : detail ? (
              <DetailPanel r={detail} />
            ) : (
              <div className="rounded-none border border-rule bg-white p-12 text-center h-full flex flex-col items-center justify-center">
                <div className="p-4 rounded-none bg-signal-deep/10 border border-rule/20 mb-4">
                  <Brain className="w-10 h-10 text-signal" />
                </div>
                <p className="text-ink-soft font-semibold mb-2">Sélectionnez un équipement</p>
                <p className="text-ink-mute text-sm">Cliquez sur une carte pour afficher l'analyse IMCA détaillée avec distance de Mahalanobis, divergence KL, et décomposition des 4 sous-indices.</p>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 rounded-none border border-rule bg-white p-5">
          <p className="text-xs font-semibold text-ink-mute mb-3">Échelle IMCA</p>
          <div className="flex flex-wrap gap-4">
            {[
              { range: "75–100", label: "Nominal", color: "bg-etat-nominal-vif" },
              { range: "55–74", label: "Surveillance", color: "bg-etat-encours-vif" },
              { range: "35–54", label: "Alerte", color: "bg-etat-alerte-vif" },
              { range: "0–34", label: "Critique", color: "bg-etat-critique-vif" },
            ].map(item => (
              <div key={item.range} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                <span className="text-xs text-ink-mute">{item.range} — {item.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-ink-mute">
            <div><span className="font-semibold text-ink-mute">ISD</span> Indice de Santé Dynamique (Mahalanobis)</div>
            <div><span className="font-semibold text-ink-mute">IDC</span> Dérive Comportementale (Jensen-Shannon · fenêtres glissantes)</div>
            <div><span className="font-semibold text-ink-mute">ISO</span> Stress Opérationnel (alarmes + surcharge)</div>
            <div><span className="font-semibold text-ink-mute">IRS</span> Résilience Structurelle (MTBF + âge)</div>
          </div>
        </div>
      </div>
    </div>
    </AppShell>
  );
}

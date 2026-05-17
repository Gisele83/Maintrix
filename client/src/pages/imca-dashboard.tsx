import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ModernNavigation } from "@/components/modern-navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Activity, AlertTriangle, Brain, CheckCircle, ChevronDown, ChevronRight,
  Clock, FlaskConical, RefreshCw, Shield, TrendingDown, TrendingUp, Zap
} from "lucide-react";

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
  v >= 75 ? "text-emerald-400" : v >= 55 ? "text-blue-400" : v >= 35 ? "text-amber-400" : "text-red-400";

const scoreBg = (v: number) =>
  v >= 75 ? "bg-emerald-500/20 border-emerald-500/40" : v >= 55 ? "bg-blue-500/20 border-blue-500/40"
  : v >= 35 ? "bg-amber-500/20 border-amber-500/40" : "bg-red-500/20 border-red-500/40";

const trendIcon = (t: string) => {
  if (t === "improving") return <TrendingUp className="w-4 h-4 text-emerald-400" />;
  if (t === "degrading") return <TrendingDown className="w-4 h-4 text-amber-400" />;
  if (t === "critical") return <AlertTriangle className="w-4 h-4 text-red-400" />;
  return <Activity className="w-4 h-4 text-blue-400" />;
};

const alertBadge = (level: string) => {
  const map: Record<string, string> = {
    ok: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    watch: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    warning: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    critical: "bg-red-500/20 text-red-300 border-red-500/40",
  };
  const label: Record<string, string> = { ok: "Nominal", watch: "Surveillance", warning: "Alerte", critical: "Critique" };
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${map[level] ?? ""}`}>{label[level] ?? level}</span>;
};

// ─── Gauge component ──────────────────────────────────────────────────────────
function Gauge({ value, size = 80, label }: { value: number; size?: number; label: string }) {
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ * 0.75;
  const color = value >= 75 ? "#10b981" : value >= 55 ? "#3b82f6" : value >= 35 ? "#f59e0b" : "#ef4444";
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
      <span className="text-xs text-slate-400 font-medium">{label}</span>
    </div>
  );
}

// ─── Sub-index bar ────────────────────────────────────────────────────────────
function SubBar({ label, value, weight, tip }: { label: string; value: number; weight: number; tip: string }) {
  const color = value >= 75 ? "bg-emerald-500" : value >= 55 ? "bg-blue-500" : value >= 35 ? "bg-amber-500" : "bg-red-500";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="space-y-1 cursor-help">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">{label}</span>
              <span className={`font-bold ${scoreColor(value)}`}>{value}/100 <span className="text-slate-500">({Math.round(weight * 100)}%)</span></span>
            </div>
            <div className="h-2 rounded-full bg-slate-700/60">
              <div className={`h-2 rounded-full ${color} transition-all duration-700`} style={{ width: `${value}%` }} />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-slate-900 border-slate-700 text-slate-200 text-xs p-3">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Equipment card ───────────────────────────────────────────────────────────
function EquipmentCard({ r, onSelect }: { r: IMCAResult; onSelect: () => void }) {
  return (
    <div onClick={onSelect} className={`relative rounded-xl border p-4 cursor-pointer transition-all hover:scale-[1.01] ${scoreBg(r.IMCA)}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white truncate max-w-[180px]">{r.equipmentName}</p>
          <div className="flex items-center gap-2 mt-1">{alertBadge(r.alertLevel)}{trendIcon(r.trend)}</div>
        </div>
        <div className={`text-2xl font-black ${scoreColor(r.IMCA)}`}>{r.IMCA}</div>
      </div>
      <div className="grid grid-cols-4 gap-1 text-center">
        {["ISD", "IDC", "ISO", "IRS"].map(k => (
          <div key={k}>
            <div className={`text-sm font-bold ${scoreColor((r as any)[k])}`}>{(r as any)[k]}</div>
            <div className="text-[10px] text-slate-500">{k}</div>
          </div>
        ))}
      </div>
      {r.rul_hours !== null && (
        <div className="mt-2 flex items-center gap-1 text-xs text-amber-400">
          <Clock className="w-3 h-3" />
          RUL P50 : ~{r.stochasticRUL?.recommended.median ?? r.rul_hours}h
          {r.stochasticRUL && (
            <span className="text-slate-500 ml-1">
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
    <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">{r.equipmentName}</h2>
          <div className="flex items-center gap-2 mt-1">{alertBadge(r.alertLevel)}{trendIcon(r.trend)}
            <span className="text-xs text-slate-500">{r.trend === "improving" ? "En amélioration" : r.trend === "stable" ? "Stable" : r.trend === "degrading" ? "En dégradation" : "Critique"}</span>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-5xl font-black ${scoreColor(r.IMCA)}`}>{r.IMCA}</div>
          <div className="text-xs text-slate-500 mt-1">IMCA / 100</div>
        </div>
      </div>

      {/* 4 gauges */}
      <div className="grid grid-cols-4 gap-4 py-2 border-y border-slate-700/50">
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
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
          <p className="text-xs text-slate-500 mb-1">Distance Mahalanobis (D_M)</p>
          <p className="text-lg font-bold text-white">{r.mahalanobisDistance.toFixed(3)}</p>
          <p className="text-xs text-slate-600">ISD = 100 × exp(−0.4 × D_M)</p>
        </div>
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-3">
          <p className="text-xs text-slate-500 mb-1">Distance Jensen-Shannon (√JSD)</p>
          <p className="text-lg font-bold text-white">
            {((r.jsDivergence ?? r.klDivergence) || 0).toFixed(4)}
            <span className="text-xs text-slate-500 ml-1">
              {(r.jsDivergence ?? 0) < 0.10 ? "🟢" : (r.jsDivergence ?? 0) < 0.22 ? "🟡" : (r.jsDivergence ?? 0) < 0.38 ? "🟠" : "🔴"}
            </span>
          </p>
          <p className="text-xs text-slate-600">IDC = 100 × (1 − tanh(β × √JSD_glissant))</p>
        </div>
        {r.stochasticRUL && (
          <div className="col-span-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-xs text-amber-400 font-semibold">
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
              <div className="rounded-lg bg-amber-500/10 p-2">
                <p className="text-[10px] text-amber-300/70">Mode</p>
                <p className="text-base font-bold text-amber-200">{r.stochasticRUL.recommended.mode}h</p>
              </div>
              <div className="rounded-lg bg-amber-500/20 border border-amber-500/40 p-2">
                <p className="text-[10px] text-amber-300">Médiane (P50)</p>
                <p className="text-lg font-black text-amber-100">{r.stochasticRUL.recommended.median}h</p>
              </div>
              <div className="rounded-lg bg-amber-500/10 p-2">
                <p className="text-[10px] text-amber-300/70">Espérance</p>
                <p className="text-base font-bold text-amber-200">{r.stochasticRUL.recommended.mean}h</p>
              </div>
            </div>

            {/* Confidence interval bar */}
            <div className="space-y-1">
              <p className="text-[10px] text-slate-500 font-mono">Intervalles de confiance</p>
              <div className="relative h-6 rounded-full bg-slate-800/60 overflow-hidden">
                {(() => {
                  const ci = r.stochasticRUL.recommended.confidenceIntervals;
                  const max = Math.max(ci.p95 * 1.05, 1);
                  const pct = (v: number) => `${Math.round((v / max) * 100)}%`;
                  return (
                    <>
                      {/* P05–P95 range */}
                      <div className="absolute top-0 h-full bg-amber-900/40 rounded-full"
                        style={{ left: pct(ci.p05), width: `${Math.round(((ci.p95 - ci.p05) / max) * 100)}%` }} />
                      {/* P10–P90 range */}
                      <div className="absolute top-0 h-full bg-amber-700/50"
                        style={{ left: pct(ci.p10), width: `${Math.round(((ci.p90 - ci.p10) / max) * 100)}%` }} />
                      {/* P25–P75 IQR */}
                      <div className="absolute top-0 h-full bg-amber-500/60"
                        style={{ left: pct(ci.p25), width: `${Math.round(((ci.p75 - ci.p25) / max) * 100)}%` }} />
                      {/* Median marker */}
                      <div className="absolute top-0 h-full w-0.5 bg-white"
                        style={{ left: pct(ci.p50) }} />
                    </>
                  );
                })()}
              </div>
              <div className="flex justify-between text-[9px] text-slate-600 font-mono">
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
            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-slate-400">
              <div>σ = ±{r.stochasticRUL.recommended.stdDev}h</div>
              <div>Marge = {r.stochasticRUL.remainingMargin.toFixed(1)} pts</div>
              {r.stochasticRUL.wienerParams && (
                <div>μ̂ = {r.stochasticRUL.wienerParams.mu.toFixed(4)}/h</div>
              )}
            </div>

            {/* Wiener vs Gamma comparison if both available */}
            {r.stochasticRUL.wienerRUL && r.stochasticRUL.gammaRUL && (
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-500/20">
                <div className="text-[10px] text-slate-500">
                  <span className="text-violet-400 font-semibold">Wiener IG</span>{" "}
                  P50={r.stochasticRUL.wienerRUL.median}h · σ={r.stochasticRUL.wienerRUL.stdDev}h
                </div>
                <div className="text-[10px] text-slate-500">
                  <span className="text-emerald-400 font-semibold">Gamma MC</span>{" "}
                  P50={r.stochasticRUL.gammaRUL.median}h · σ={r.stochasticRUL.gammaRUL.stdDev}h
                </div>
              </div>
            )}

            {/* Warnings */}
            {r.stochasticRUL.warnings.length > 0 && (
              <div className="text-[10px] text-yellow-500/80 italic">
                ⚠ {r.stochasticRUL.warnings[0]}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recommendation */}
      <div className="rounded-xl bg-blue-500/10 border border-blue-500/30 p-4 space-y-2">
        <div className="flex items-center gap-2 text-blue-300 font-semibold text-sm"><Brain className="w-4 h-4" /> Facteur dominant</div>
        <p className="text-xs text-slate-400">{r.explanation.dominantFactor}</p>
        <div className="flex items-center gap-2 text-blue-300 font-semibold text-sm mt-2"><Zap className="w-4 h-4" /> Recommandation</div>
        <p className="text-xs text-slate-300">{r.explanation.recommendation}</p>
      </div>

      {/* Expandable detail */}
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />} Détails explicatifs par sous-indice
      </button>
      {open && (
        <div className="space-y-3 border-t border-slate-700/50 pt-3">
          {(["ISD", "IDC", "ISO", "IRS"] as const).map(k => (
            <div key={k} className="rounded-lg bg-slate-800/40 p-3">
              <p className="text-xs font-semibold text-slate-300 mb-1">{k}</p>
              <p className="text-xs text-slate-500">{r.explanation[k]}</p>
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
    queryFn: async () => {
      const r = await fetch(`/api/imca/equipment/${selectedId}?windowShort=${windowShort}&windowLong=${windowLong}`, { credentials: "include" });
      return r.json();
    },
    enabled: selectedId !== null,
  });

  const fleetIMCA = fleet?.fleetIMCA ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <ModernNavigation />
      <div className="pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-violet-600/20 border border-violet-500/30">
              <Brain className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">IMCA — Indice Cognitif Composite</h1>
              <p className="text-sm text-slate-400">Brevet N°1 · Mahalanobis · Jensen-Shannon Divergence · Fenêtres Glissantes · ISD · IDC · ISO · IRS</p>
            </div>
          </div>
        </div>

        {/* Fleet KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-5 text-center">
            <div className={`text-4xl font-black mb-1 ${scoreColor(fleetIMCA)}`}>{fleetLoading ? "…" : fleetIMCA}</div>
            <div className="text-xs text-slate-400">IMCA Flotte</div>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-5 text-center">
            <div className="text-4xl font-black mb-1 text-white">{fleet?.results.length ?? "–"}</div>
            <div className="text-xs text-slate-400">Actifs analysés</div>
          </div>
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center">
            <div className="text-4xl font-black mb-1 text-red-400">{fleet?.criticalCount ?? "–"}</div>
            <div className="text-xs text-slate-400">Critiques</div>
          </div>
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-center">
            <div className="text-4xl font-black mb-1 text-amber-400">{fleet?.degradingCount ?? "–"}</div>
            <div className="text-xs text-slate-400">En dégradation</div>
          </div>
        </div>

        {/* Formula card */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-slate-300">Formules scientifiques mobilisées</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
            <div className="rounded-lg bg-slate-900/60 border border-slate-700/50 p-3">
              <div className="text-violet-400 font-bold mb-1">ISD — Mahalanobis multivariée</div>
              <div className="text-slate-400">D_M = √((x−μ)ᵀ Σ⁻¹ (x−μ))</div>
              <div className="text-slate-500">ISD = 100 × exp(−0.4 × D_M)</div>
            </div>
            <div className="rounded-lg bg-slate-900/60 border border-slate-700/50 p-3">
              <div className="text-blue-400 font-bold mb-1">IDC — Jensen-Shannon (fenêtres glissantes)</div>
              <div className="text-slate-400">M = ½P+½Q · JSD = ½KL(P‖M)+½KL(Q‖M)</div>
              <div className="text-slate-500">IDC = 100 × (1 − tanh(β × √JSD<sub>glissant</sub>))</div>
            </div>
            <div className="rounded-lg bg-slate-900/60 border border-slate-700/50 p-3">
              <div className="text-emerald-400 font-bold mb-1">ISO — Stress Opérationnel</div>
              <div className="text-slate-400">StressScore = 0.6 × AlarmRate + 0.4 × OverloadRatio</div>
              <div className="text-slate-500">ISO = 100 × exp(−2.5 × StressScore)</div>
            </div>
            <div className="rounded-lg bg-slate-900/60 border border-slate-700/50 p-3">
              <div className="text-amber-400 font-bold mb-1">IMCA — Fusion composite adaptative</div>
              <div className="text-slate-400">IMCA = w₁·ISD + w₂·IDC + w₃·ISO + w₄·IRS</div>
              <div className="text-slate-500">Poids adaptatifs selon disponibilité données</div>
            </div>
            <div className="rounded-lg bg-slate-900/60 border border-violet-500/30 p-3">
              <div className="text-violet-300 font-bold mb-1">RUL — Processus de Wiener</div>
              <div className="text-slate-400">X(t) = X₀ + μt + σW(t)  →  T<sub>RUL</sub> ~ IG(m, λ)</div>
              <div className="text-slate-500">m = D/μ̂ · λ = D²/σ̂² · F(t) = Φ(…) + e<sup>2λ/m</sup>Φ(…)</div>
            </div>
            <div className="rounded-lg bg-slate-900/60 border border-emerald-500/30 p-3">
              <div className="text-emerald-300 font-bold mb-1">RUL — Processus Gamma (Monte Carlo)</div>
              <div className="text-slate-400">ΔX(Δt) ~ Γ(α·Δt, β) · α̂ = μ²/σ² · β̂ = μ/σ²</div>
              <div className="text-slate-500">IC via 15 000 trajectoires · Fusion bayésienne w<sub>W</sub>·R² + w<sub>Γ</sub>·pos%</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Equipment selection & fleet list */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Analyse par équipement</h2>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => refetchFleet()} className="text-slate-400 hover:text-white">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Fenêtre glissante params */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">Fenêtre courte (ISD/ISO)</label>
                <Select value={windowShort} onValueChange={setWindowShort}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {["3", "7", "14", "30"].map(v => <SelectItem key={v} value={v} className="text-slate-300">{v} jours</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block">Fenêtre longue KL (IDC)</label>
                <Select value={windowLong} onValueChange={setWindowLong}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {["30", "60", "90"].map(v => <SelectItem key={v} value={v} className="text-slate-300">{v} jours</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fleet grid */}
            {fleetLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-36 rounded-xl bg-slate-800/40 animate-pulse" />
                ))}
              </div>
            ) : fleet?.results && fleet.results.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
                {fleet.results.map(r => (
                  <EquipmentCard key={r.equipmentId} r={r} onSelect={() => setSelectedId(r.equipmentId)} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-8 text-center">
                <Activity className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Aucune donnée capteur disponible.</p>
                <p className="text-slate-600 text-xs mt-1">Connectez des capteurs IoT pour alimenter l'IMCA.</p>
              </div>
            )}

            {/* Equipment selector if fleet empty */}
            {(!fleet?.results || fleet.results.length === 0) && equipList && equipList.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Sélectionner un équipement à analyser :</p>
                <div className="grid grid-cols-1 gap-2">
                  {equipList.slice(0, 8).map(e => (
                    <button key={e.id} onClick={() => setSelectedId(e.id)}
                      className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-2 hover:border-violet-500/50 transition-colors text-left">
                      <span className="text-sm text-slate-300">{e.name}</span>
                      <ChevronRight className="w-4 h-4 text-slate-600" />
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
                  <div key={i} className="h-24 rounded-xl bg-slate-800/40 animate-pulse" />
                ))}
              </div>
            ) : detail ? (
              <DetailPanel r={detail} />
            ) : (
              <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-12 text-center h-full flex flex-col items-center justify-center">
                <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-4">
                  <Brain className="w-10 h-10 text-violet-400" />
                </div>
                <p className="text-slate-300 font-semibold mb-2">Sélectionnez un équipement</p>
                <p className="text-slate-500 text-sm">Cliquez sur une carte pour afficher l'analyse IMCA détaillée avec distance de Mahalanobis, divergence KL, et décomposition des 4 sous-indices.</p>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-800/20 p-5">
          <p className="text-xs font-semibold text-slate-400 mb-3">Échelle IMCA</p>
          <div className="flex flex-wrap gap-4">
            {[
              { range: "75–100", label: "Nominal", color: "bg-emerald-500" },
              { range: "55–74", label: "Surveillance", color: "bg-blue-500" },
              { range: "35–54", label: "Alerte", color: "bg-amber-500" },
              { range: "0–34", label: "Critique", color: "bg-red-500" },
            ].map(item => (
              <div key={item.range} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                <span className="text-xs text-slate-400">{item.range} — {item.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-500">
            <div><span className="font-semibold text-slate-400">ISD</span> Indice de Santé Dynamique (Mahalanobis)</div>
            <div><span className="font-semibold text-slate-400">IDC</span> Dérive Comportementale (Jensen-Shannon · fenêtres glissantes · √JSD ∈ [0,1])</div>
            <div><span className="font-semibold text-slate-400">ISO</span> Stress Opérationnel (alarmes + surcharge)</div>
            <div><span className="font-semibold text-slate-400">IRS</span> Résilience Structurelle (MTBF + âge)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ModernNavigation } from "@/components/modern-navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import {
  Activity, AlertTriangle, Brain, CheckCircle, ChevronDown, ChevronRight,
  DollarSign, Layers, RefreshCw, Shield, Target, TrendingUp,
  Users, Wrench, Zap
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AssetAction {
  type: string; label: string; cost: number; gainIMCA: number;
  techDays: number; duration: number; description: string;
}
interface AllocationDecision {
  equipmentId: number; equipmentName: string; currentIMCA: number;
  selectedAction: AssetAction; projectedIMCA: number; gainIMCA: number;
  weightedGain: number; isMandatory: boolean; roi: number;
}
interface OptResult {
  algorithm: string; totalCost: number; totalGain: number; totalUnweightedGain: number;
  usedTechDays: number; budgetUtilization: number; allocations: AllocationDecision[];
  skippedAssets: { equipmentId: number; equipmentName: string; reason: string }[];
  fleetIMCABefore: number; fleetIMCAAfter: number; feasible: boolean;
  solverTimeMs: number; explanation: string;
}
interface ParetoPoint { budget: number; totalGain: number; unweightedGain: number; nInterventions: number; }
interface FleetResult {
  totalEquipment: number;
  constraints: { totalBudget: number; maxTechDays: number };
  optimal: OptResult; greedy: OptResult; paretoFront: ParetoPoint[];
  mandatoryBudget: number;
  summary: { nAssets: number; nInterventions: number; avgIMCAGain: number; criticalCovered: number; totalFleetGain: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ACTION_COLOR: Record<string, string> = {
  none: "bg-slate-700/60 text-slate-400",
  inspection: "bg-blue-500/20 text-blue-300",
  preventive: "bg-amber-500/20 text-amber-300",
  corrective: "bg-orange-500/20 text-orange-300",
  overhaul: "bg-red-500/20 text-red-300",
};
const ACTION_ICON: Record<string, string> = {
  none: "—", inspection: "🔍", preventive: "🔧", corrective: "⚙️", overhaul: "🏭",
};
const SCORE_COLOR = (s: number) =>
  s >= 75 ? "text-emerald-400" : s >= 55 ? "text-yellow-400" : s >= 35 ? "text-orange-400" : "text-red-400";
const SCORE_BG = (s: number) =>
  s >= 75 ? "border-emerald-500/30 bg-emerald-500/5" : s >= 55 ? "border-yellow-500/30 bg-yellow-500/5"
  : s >= 35 ? "border-orange-500/30 bg-orange-500/5" : "border-red-500/30 bg-red-500/5";
const FMT = (n: number | undefined | null) => (n ?? 0).toLocaleString("fr-FR");

// ─── Pareto mini-chart ────────────────────────────────────────────────────────
function ParetoChart({ points, budget }: { points: ParetoPoint[]; budget: number }) {
  if (!points.length) return null;
  const maxGain = Math.max(...points.map(p => p.totalGain), 1);
  const maxBudget = Math.max(...points.map(p => p.budget), 1);
  const w = 340, h = 100, pad = 24;

  const pts = points.map(p => ({
    x: pad + ((p.budget / maxBudget) * (w - 2 * pad)),
    y: h - pad - ((p.totalGain / maxGain) * (h - 2 * pad)),
  }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const fill = `${d} L ${pts[pts.length - 1].x} ${h - pad} L ${pts[0].x} ${h - pad} Z`;

  // Marquer le budget courant
  const curX = pad + ((budget / maxBudget) * (w - 2 * pad));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 100 }}>
      <defs>
        <linearGradient id="pareto-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#pareto-grad)" />
      <path d={d} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#818cf8" />
      ))}
      <line x1={curX} y1={pad / 2} x2={curX} y2={h - pad} stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3,2" />
      <text x={pad} y={h - 6} fontSize="9" fill="#64748b">0</text>
      <text x={w - pad} y={h - 6} fontSize="9" fill="#64748b" textAnchor="end">{FMT(Math.round(maxBudget / 1000))}k€</text>
      <text x={pad - 2} y={pad} fontSize="9" fill="#64748b" textAnchor="end">{Math.round(maxGain)}</text>
    </svg>
  );
}

// ─── Allocation row ────────────────────────────────────────────────────────────
function AllocationRow({ d, rank }: { d: AllocationDecision; rank: number }) {
  const [open, setOpen] = useState(false);
  const isIntervention = d.selectedAction.type !== "none";
  return (
    <div className={`rounded-xl border p-3 transition-all ${isIntervention ? SCORE_BG(d.currentIMCA) : "border-slate-700/40 bg-slate-800/30"}`}>
      <div className="flex items-start gap-3 cursor-pointer" onClick={() => setOpen(!open)}>
        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-400 flex-shrink-0 mt-0.5">
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{d.equipmentName}</span>
            {d.isMandatory && <Badge className="bg-red-500/20 text-red-300 text-[10px] px-1.5 py-0">Obligatoire</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className={`text-xs font-mono font-bold ${SCORE_COLOR(d.currentIMCA)}`}>
              {d.currentIMCA} → {d.projectedIMCA}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${ACTION_COLOR[d.selectedAction.type]}`}>
              {ACTION_ICON[d.selectedAction.type]} {d.selectedAction.label}
            </span>
            {isIntervention && (
              <>
                <span className="text-[10px] text-slate-400">{FMT(d.selectedAction.cost)}€</span>
                <span className="text-[10px] text-emerald-400">+{d.gainIMCA} pts IMCA</span>
              </>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-slate-500">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
      </div>
      {open && (
        <div className="mt-3 ml-9 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono text-slate-400 border-t border-slate-700/40 pt-3">
          <div><span className="text-slate-500">Coût</span><br />{FMT(d.selectedAction.cost)} €</div>
          <div><span className="text-slate-500">Techniciens</span><br />{d.selectedAction.techDays} j</div>
          <div><span className="text-slate-500">Immobilisation</span><br />{d.selectedAction.duration} j</div>
          <div><span className="text-slate-500">ROI</span><br />{d.roi.toFixed(2)} pts/k€</div>
          <div className="col-span-4 text-slate-500 italic">{d.selectedAction.description}</div>
        </div>
      )}
    </div>
  );
}

// ─── Summary bar ──────────────────────────────────────────────────────────────
function SummaryBar({ result, label, color }: { result: OptResult; label: string; color: string }) {
  const interventions = result.allocations.filter(d => d.selectedAction.type !== "none");
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">{label}</span>
        <Badge className={result.feasible ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}>
          {result.feasible ? "Faisable" : "Infaisable"}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          ["Budget utilisé", `${FMT(result.totalCost)} €`, `${result.budgetUtilization.toFixed(0)}%`],
          ["IMCA flotte", `${result.fleetIMCABefore} → ${result.fleetIMCAAfter}`, `+${result.fleetIMCAAfter - result.fleetIMCABefore} pts`],
          ["Interventions", `${interventions.length}`, `/ ${result.allocations.length} actifs`],
          ["Techniciens", `${result.usedTechDays.toFixed(1)} j`, `${result.solverTimeMs}ms`],
        ].map(([lbl, val, sub]) => (
          <div key={lbl as string} className="bg-slate-900/40 rounded-lg p-2">
            <p className="text-[10px] text-slate-500">{lbl}</p>
            <p className="text-sm font-bold text-white">{val}</p>
            <p className="text-[10px] text-slate-500">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MultiAssetOptimizerPage() {
  const [budget, setBudget] = useState(50000);
  const [maxTechDays, setMaxTechDays] = useState(30);
  const [activeTab, setActiveTab] = useState<"optimal" | "greedy" | "pareto">("optimal");

  const { data: config } = useQuery<any>({
    queryKey: ["/api/multi-asset/config"],
  });

  const { data: fleetData, isLoading, refetch } = useQuery<FleetResult>({
    queryKey: ["/api/multi-asset/fleet", budget, maxTechDays],
    queryFn: () =>
      fetch(`/api/multi-asset/fleet?totalBudget=${budget}&maxTechDays=${maxTechDays}`, {
        credentials: "include",
      }).then(r => r.json()),
    enabled: true,
    staleTime: 30000,
  });

  const activeResult = fleetData?.[activeTab === "pareto" ? "optimal" : activeTab];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <ModernNavigation />
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-slate-800/40 to-indigo-500/10 p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center">
                <Target className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">Optimiseur Multi-Actifs</h1>
                <p className="text-sm text-slate-400">
                  Multiple Choice Knapsack · DP exact · Greedy ROI · Front de Pareto
                </p>
              </div>
            </div>
            <Button
              onClick={() => refetch()}
              disabled={isLoading}
              className="bg-violet-600/80 hover:bg-violet-600 text-white gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              Recalculer
            </Button>
          </div>
        </div>

        {/* ── Controls ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
              <DollarSign className="w-4 h-4 text-amber-400" /> Budget total disponible
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span>5 000 €</span>
                <span className="text-amber-300 font-bold text-base">{FMT(budget)} €</span>
                <span>200 000 €</span>
              </div>
              <Slider
                value={[budget]}
                onValueChange={([v]) => setBudget(v)}
                min={5000} max={200000} step={5000}
                className="w-full"
              />
              {fleetData && (
                <p className="text-[10px] text-slate-500 mt-2">
                  Budget min obligatoire : {FMT(fleetData.mandatoryBudget)} € ·
                  Utilisation actuelle : {fleetData.optimal.budgetUtilization.toFixed(0)}%
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-300 font-semibold text-sm">
              <Users className="w-4 h-4 text-blue-400" /> Ressources techniciens (jours)
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span>5 j</span>
                <span className="text-blue-300 font-bold text-base">{maxTechDays} j</span>
                <span>100 j</span>
              </div>
              <Slider
                value={[maxTechDays]}
                onValueChange={([v]) => setMaxTechDays(v)}
                min={5} max={100} step={5}
                className="w-full"
              />
              {fleetData && (
                <p className="text-[10px] text-slate-500 mt-2">
                  Consommation optimale : {fleetData.optimal.usedTechDays.toFixed(1)} j ·
                  Greedy : {fleetData.greedy.usedTechDays.toFixed(1)} j
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Fleet KPIs ────────────────────────────────────────────────────── */}
        {fleetData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Actifs analysés", value: fleetData.summary.nAssets, icon: Layers, color: "text-slate-300" },
              { label: "Interventions planifiées", value: fleetData.summary.nInterventions, icon: Wrench, color: "text-amber-300" },
              { label: "Gain fleet IMCA", value: `+${fleetData.summary.totalFleetGain} pts`, icon: TrendingUp, color: "text-emerald-300" },
              { label: "Critiques couverts", value: `${fleetData.summary.criticalCovered}`, icon: Shield, color: "text-red-300" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-4 flex items-center gap-3">
                <Icon className={`w-8 h-8 ${color} flex-shrink-0`} />
                <div>
                  <p className="text-[11px] text-slate-500">{label}</p>
                  <p className={`text-xl font-black ${color}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Algorithm tabs ────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {[
              { id: "optimal" as const, label: "DP-MCKP (Optimal exact)", icon: Brain },
              { id: "greedy" as const, label: "Greedy ROI", icon: Zap },
              { id: "pareto" as const, label: "Front de Pareto", icon: Activity },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === id
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                    : "bg-slate-800/60 text-slate-400 hover:text-white border border-slate-700/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-40 rounded-xl border border-slate-700 bg-slate-800/30">
              <RefreshCw className="w-6 h-6 text-violet-400 animate-spin" />
              <span className="ml-3 text-slate-400">Optimisation en cours…</span>
            </div>
          ) : !fleetData ? (
            <div className="flex items-center justify-center h-40 rounded-xl border border-slate-700 bg-slate-800/30">
              <span className="text-slate-400">Cliquer sur Recalculer pour lancer l'optimisation</span>
            </div>
          ) : activeTab === "pareto" ? (
            /* ── Pareto tab ──────────────────────────────────────────────── */
            <div className="rounded-2xl border border-violet-500/20 bg-slate-800/30 p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-1">Front de Pareto — Efficacité marginale des investissements</h3>
                <p className="text-xs text-slate-500">
                  Courbe gain IMCA pondéré ↔ budget (25 niveaux · Greedy ROI).
                  La ligne verticale jaune indique le budget actuel.
                </p>
              </div>
              <ParetoChart points={fleetData.paretoFront} budget={budget} />

              {/* Pareto table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-700/50">
                      <th className="text-left pb-2 font-normal">Budget</th>
                      <th className="text-right pb-2 font-normal">Gain pondéré</th>
                      <th className="text-right pb-2 font-normal">Gain IMCA brut</th>
                      <th className="text-right pb-2 font-normal">Interventions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fleetData.paretoFront.filter((_, i) => i % 3 === 0 || i === fleetData.paretoFront.length - 1).map((p, i) => (
                      <tr key={i} className={`border-b border-slate-700/20 ${Math.abs(p.budget - budget) < budget * 0.1 ? "text-amber-300" : "text-slate-300"}`}>
                        <td className="py-1.5 font-mono">{FMT(Math.round(p.budget))} €</td>
                        <td className="py-1.5 text-right font-mono">{p.totalGain.toFixed(1)}</td>
                        <td className="py-1.5 text-right font-mono">{p.unweightedGain} pts</td>
                        <td className="py-1.5 text-right">{p.nInterventions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Comparison summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-700/40 pt-4">
                <SummaryBar result={fleetData.optimal} label="DP-MCKP (Optimal)" color="border-violet-500/30 bg-violet-500/5" />
                <SummaryBar result={fleetData.greedy} label="Greedy ROI" color="border-amber-500/30 bg-amber-500/5" />
              </div>
            </div>
          ) : activeResult ? (
            /* ── Optimal / Greedy tab ────────────────────────────────────── */
            <div className="space-y-4">
              {/* Summary */}
              <SummaryBar
                result={activeResult}
                label={activeTab === "optimal" ? "DP-MCKP — Solution optimale exacte" : "Greedy ROI — Heuristique rapide"}
                color={activeTab === "optimal" ? "border-violet-500/30 bg-violet-500/5" : "border-amber-500/30 bg-amber-500/5"}
              />

              {/* Explanation */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-slate-400 italic">
                {activeResult.explanation}
              </div>

              {/* Budget bar */}
              <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4 space-y-2">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Budget utilisé</span>
                  <span className="font-mono">{FMT(activeResult.totalCost)} € / {FMT(budget)} €</span>
                </div>
                <div className="h-3 rounded-full bg-slate-700/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${activeResult.budgetUtilization > 95 ? "bg-red-500" : activeResult.budgetUtilization > 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min(100, activeResult.budgetUtilization)}%` }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 text-[10px] text-center">
                  {(["none", "inspection", "preventive", "corrective", "overhaul"] as const).map(type => {
                    const count = activeResult.allocations.filter(d => d.selectedAction.type === type).length;
                    return count > 0 ? (
                      <div key={type} className={`rounded px-2 py-1 ${ACTION_COLOR[type]}`}>
                        {ACTION_ICON[type]} {count} × {type === "none" ? "Aucune" : type}
                      </div>
                    ) : null;
                  })}
                </div>
              </div>

              {/* Allocation list */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-300">
                  Allocations par actif — {activeResult.allocations.length} équipements
                </h3>
                {/* Sort: interventions first, then by gain desc */}
                {[...activeResult.allocations]
                  .sort((a, b) => {
                    if (a.selectedAction.type === "none" && b.selectedAction.type !== "none") return 1;
                    if (a.selectedAction.type !== "none" && b.selectedAction.type === "none") return -1;
                    return b.gainIMCA - a.gainIMCA;
                  })
                  .map((d, i) => <AllocationRow key={d.equipmentId} d={d} rank={i + 1} />)}
              </div>

              {/* Skipped */}
              {activeResult.skippedAssets.length > 0 && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-red-300 font-semibold text-sm">
                    <AlertTriangle className="w-4 h-4" /> Actifs non couverts par le budget
                  </div>
                  {activeResult.skippedAssets.map(s => (
                    <p key={s.equipmentId} className="text-xs text-slate-400">
                      • {s.equipmentName} — {s.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

      </div>
    </div>
  );
}

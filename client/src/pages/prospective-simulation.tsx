import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ModernNavigation } from "@/components/modern-navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Activity, AlertTriangle, BarChart3, Brain, CheckCircle, ChevronDown,
  ChevronRight, Clock, Cpu, DollarSign, FlaskConical, RefreshCw,
  Shield, TrendingDown, TrendingUp, Zap, XCircle
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type ScenarioType = "IMMEDIATE" | "DEFERRED" | "NO_INTERVENTION";
type UrgencyLevel = "low" | "moderate" | "high" | "critical";

interface DegradationPoint { day: number; imca: number; failureProb: number; oeeImpact: number; }
interface ScenarioCost { maintenance: number; downtime: number; failureRisk: number; total: number; currency: string; }
interface ScenarioResult {
  id: ScenarioType; label: string; description: string; deferDays: number;
  degradationCurve: DegradationPoint[];
  failureProbability30d: number; failureProbability90d: number;
  cost: ScenarioCost; riskScore: number; oeeAverageLoss: number;
  recommendationWeight: number; pros: string[]; cons: string[];
  imcaAtDecision: number; imcaAtEnd: number; rul_days: number | null;
}
interface SimResult {
  equipmentId: number; equipmentName: string; criticalityLevel: string;
  currentIMCA: number; currentDegradationRate: number; timestamp: string;
  scenarios: Record<ScenarioType, ScenarioResult>;
  recommendation: { scenario: ScenarioType; confidence: number; urgencyLevel: UrgencyLevel; rationale: string; decisionDeadline: string | null; autonomyCompatible: boolean; };
  comparisonMatrix: { costRanking: ScenarioType[]; riskRanking: ScenarioType[]; oeeRanking: ScenarioType[]; overallRanking: ScenarioType[]; };
}
interface Equipment { id: number; name: string; type: string; criticalityLevel: string; }
interface FleetItem { equipmentId: number; equipmentName: string; criticalityLevel: string; currentIMCA: number; recommendedScenario: ScenarioType; urgencyLevel: UrgencyLevel; decisionDeadline: string | null; immediateCost: number; noInterventionRisk: number; autonomyCompatible: boolean; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k€` : `${Math.round(n)}€`;

const urgencyConfig: Record<UrgencyLevel, { label: string; color: string; bg: string; border: string; icon: any }> = {
  low:      { label: "Faible",    color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: CheckCircle },
  moderate: { label: "Modérée",   color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    icon: Activity },
  high:     { label: "Élevée",    color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   icon: AlertTriangle },
  critical: { label: "Critique",  color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30",     icon: Zap },
};

const scenarioConfig: Record<ScenarioType, { color: string; bg: string; border: string; dotColor: string }> = {
  IMMEDIATE:       { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", dotColor: "#10b981" },
  DEFERRED:        { color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    dotColor: "#3b82f6" },
  NO_INTERVENTION: { color: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30",     dotColor: "#ef4444" },
};

const imcaColor = (v: number) =>
  v >= 75 ? "#10b981" : v >= 55 ? "#3b82f6" : v >= 35 ? "#f59e0b" : "#ef4444";

// ─── Mini sparkline chart (SVG) ───────────────────────────────────────────────
function SparkLine({ data, color, height = 60, showAxis = false }: { data: DegradationPoint[]; color: string; height?: number; showAxis?: boolean }) {
  const w = 280; const h = height;
  const days = data.map(d => d.day);
  const values = data.map(d => d.imca);
  const maxDay = Math.max(...days, 1);
  const px = (d: number) => (d / maxDay) * (w - 20) + 10;
  const py = (v: number) => h - 8 - ((v / 100) * (h - 16));
  const path = data.map((d, i) => `${i === 0 ? "M" : "L"} ${px(d.day)} ${py(d.imca)}`).join(" ");
  const area = `${path} L ${px(maxDay)} ${py(0)} L ${px(0)} ${py(0)} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace("#","")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {showAxis && (
        <>
          <line x1="10" y1={py(75)} x2={w-10} y2={py(75)} stroke="#334155" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="10" y1={py(40)} x2={w-10} y2={py(40)} stroke="#334155" strokeWidth="0.8" strokeDasharray="3 3" />
          <text x="14" y={py(75)-2} fontSize="8" fill="#475569">75</text>
          <text x="14" y={py(40)-2} fontSize="8" fill="#475569">40</text>
        </>
      )}
      <path d={area} fill={`url(#grad-${color.replace("#","")})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Current dot */}
      <circle cx={px(0)} cy={py(values[0] ?? 0)} r="3" fill={color} />
    </svg>
  );
}

// ─── Scenario card ────────────────────────────────────────────────────────────
function ScenarioCard({ scenario, isRecommended, isExpanded, onToggle }: {
  scenario: ScenarioResult; isRecommended: boolean; isExpanded: boolean; onToggle: () => void;
}) {
  const cfg = scenarioConfig[scenario.id];
  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} overflow-hidden transition-all`}>
      {/* Header */}
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {isRecommended && (
              <span className="text-[10px] bg-violet-600 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                ✓ Recommandé
              </span>
            )}
          </div>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
        </div>
        <h3 className={`font-bold text-sm ${cfg.color} mb-1`}>{scenario.label}</h3>
        <p className="text-xs text-slate-500 line-clamp-2">{scenario.description}</p>

        {/* Key metrics row */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="text-center">
            <div className={`text-base font-black ${cfg.color}`}>{fmt(scenario.cost.total)}</div>
            <div className="text-[10px] text-slate-500">Coût total</div>
          </div>
          <div className="text-center">
            <div className={`text-base font-black ${scenario.failureProbability30d > 30 ? "text-red-400" : "text-slate-300"}`}>
              {scenario.failureProbability30d.toFixed(1)}%
            </div>
            <div className="text-[10px] text-slate-500">Défaillance 30j</div>
          </div>
          <div className="text-center">
            <div className={`text-base font-black ${scenario.oeeAverageLoss > 10 ? "text-amber-400" : "text-slate-300"}`}>
              -{scenario.oeeAverageLoss.toFixed(1)}pt
            </div>
            <div className="text-[10px] text-slate-500">OEE moyen</div>
          </div>
        </div>

        {/* Sparkline */}
        <div className="mt-3 h-14">
          <SparkLine data={scenario.degradationCurve} color={cfg.dotColor} height={56} showAxis />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mt-1 px-2">
          <span>J0</span><span>J30</span><span>J60</span><span>J90</span>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-slate-700/40 p-4 space-y-4">
          {/* IMCA journey */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-slate-800/60 p-2">
              <div className="text-xs text-slate-500">IMCA actuel</div>
              <div className={`text-lg font-black`} style={{ color: imcaColor(scenario.imcaAtDecision) }}>{scenario.imcaAtDecision.toFixed(0)}</div>
            </div>
            <div className="rounded-lg bg-slate-800/60 p-2 flex items-center justify-center">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </div>
            <div className="rounded-lg bg-slate-800/60 p-2">
              <div className="text-xs text-slate-500">IMCA J+90</div>
              <div className={`text-lg font-black`} style={{ color: imcaColor(scenario.imcaAtEnd) }}>{scenario.imcaAtEnd.toFixed(0)}</div>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="space-y-1">
            <p className="text-xs text-slate-400 font-semibold">Décomposition des coûts</p>
            {[
              { label: "Maintenance", val: scenario.cost.maintenance, color: "bg-blue-500" },
              { label: "Arrêts/Production", val: scenario.cost.downtime, color: "bg-amber-500" },
              { label: "Risque défaillance", val: scenario.cost.failureRisk, color: "bg-red-500" },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${color}`} />
                <span className="text-xs text-slate-500 flex-1">{label}</span>
                <span className="text-xs font-semibold text-slate-300">{fmt(val)}</span>
              </div>
            ))}
          </div>

          {/* Failure probability */}
          <div className="grid grid-cols-2 gap-2">
            {[["30j", scenario.failureProbability30d], ["90j", scenario.failureProbability90d]].map(([horizon, prob]) => (
              <div key={horizon as string} className="rounded-lg bg-slate-800/60 p-2">
                <div className="text-xs text-slate-500">P(défaillance {horizon})</div>
                <div className={`text-base font-bold ${(prob as number) > 20 ? "text-red-400" : "text-slate-300"}`}>
                  {(prob as number).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>

          {/* Pros/Cons */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-emerald-400 font-semibold mb-1">Avantages</p>
              <ul className="space-y-1">
                {scenario.pros.map((p, i) => <li key={i} className="text-xs text-slate-400 flex gap-1"><span className="text-emerald-500 flex-shrink-0">+</span>{p}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-xs text-red-400 font-semibold mb-1">Inconvénients</p>
              <ul className="space-y-1">
                {scenario.cons.map((c, i) => <li key={i} className="text-xs text-slate-400 flex gap-1"><span className="text-red-500 flex-shrink-0">−</span>{c}</li>)}
              </ul>
            </div>
          </div>

          {scenario.rul_days !== null && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>RUL estimé sans intervention : <strong>{scenario.rul_days} jours</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Comparison matrix ────────────────────────────────────────────────────────
function ComparisonTable({ data }: { data: SimResult }) {
  const medals = ["🥇", "🥈", "🥉"];
  const scenarioLabel: Record<ScenarioType, string> = {
    IMMEDIATE: "Immédiat", DEFERRED: "Différé", NO_INTERVENTION: "Non-intervention",
  };
  const rows = [
    { label: "Coût total", ranking: data.comparisonMatrix.costRanking, format: (s: ScenarioType) => fmt(data.scenarios[s].cost.total) },
    { label: "Risque défaillance", ranking: data.comparisonMatrix.riskRanking, format: (s: ScenarioType) => `${data.scenarios[s].failureProbability30d.toFixed(1)}%` },
    { label: "OEE (perte moy.)", ranking: data.comparisonMatrix.oeeRanking, format: (s: ScenarioType) => `-${data.scenarios[s].oeeAverageLoss.toFixed(1)}pt` },
    { label: "Score global", ranking: data.comparisonMatrix.overallRanking, format: () => "" },
  ];
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/30 overflow-hidden">
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-bold text-white">Matrice de comparaison</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left p-3 text-slate-500 font-medium">Critère</th>
              {(["IMMEDIATE", "DEFERRED", "NO_INTERVENTION"] as ScenarioType[]).map(s => (
                <th key={s} className={`text-center p-3 font-semibold ${scenarioConfig[s].color}`}>{scenarioLabel[s]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.label} className="border-b border-slate-700/30">
                <td className="p-3 text-slate-400">{row.label}</td>
                {(["IMMEDIATE", "DEFERRED", "NO_INTERVENTION"] as ScenarioType[]).map(s => {
                  const rank = row.ranking.indexOf(s);
                  return (
                    <td key={s} className="p-3 text-center">
                      <span className="mr-1">{medals[rank] ?? ""}</span>
                      <span className={rank === 0 ? "text-white font-bold" : "text-slate-500"}>
                        {row.format(s)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Fleet summary row ────────────────────────────────────────────────────────
function FleetRow({ item, onSelect }: { item: FleetItem; onSelect: () => void }) {
  const cfg = urgencyConfig[item.urgencyLevel];
  const UrgIcon = cfg.icon;
  const scenarioLabel: Record<ScenarioType, string> = { IMMEDIATE: "Immédiat", DEFERRED: "Différé", NO_INTERVENTION: "Aucune action" };
  return (
    <div onClick={onSelect} className={`flex items-center gap-3 rounded-xl border ${cfg.border} ${cfg.bg} p-3 cursor-pointer hover:opacity-90 transition-all`}>
      <UrgIcon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{item.equipmentName}</p>
        <p className="text-xs text-slate-500">{scenarioLabel[item.recommendedScenario]} · {fmt(item.immediateCost)}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</div>
        <div className="text-xs text-slate-500">IMCA {item.currentIMCA}</div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ProspectiveSimulationPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deferDays, setDeferDays] = useState("14");
  const [expandedScenario, setExpandedScenario] = useState<ScenarioType | null>("IMMEDIATE");

  const { data: equipList } = useQuery<Equipment[]>({ queryKey: ["/api/prospective/equipment-list"] });

  const { data: fleet, isLoading: fleetLoading, refetch: refetchFleet } = useQuery<{ results: FleetItem[]; totalEquipment: number; criticalCount: number }>({
    queryKey: ["/api/prospective/fleet-summary", deferDays],
    queryFn: async () => {
      const r = await fetch(`/api/prospective/fleet-summary?deferDays=${deferDays}`, { credentials: "include" });
      return r.json();
    },
  });

  const { data: sim, isLoading: simLoading } = useQuery<SimResult>({
    queryKey: ["/api/prospective/simulate", selectedId, deferDays],
    queryFn: async () => {
      const r = await fetch(`/api/prospective/simulate/${selectedId}?deferDays=${deferDays}`, { credentials: "include" });
      return r.json();
    },
    enabled: selectedId !== null,
  });

  const rec = sim?.recommendation;
  const urgCfg = rec ? urgencyConfig[rec.urgencyLevel] : null;
  const UrgIcon = urgCfg?.icon ?? Activity;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <ModernNavigation />
      <div className="pt-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-cyan-600/20 border border-cyan-500/30">
              <FlaskConical className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Simulation Prospective</h1>
              <p className="text-sm text-slate-400">Brevet N°2 · Comparaison formelle Immédiat / Différé / Non-intervention avant toute décision autonome</p>
            </div>
          </div>
        </div>

        {/* Defer days selector */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-400">Horizon du report (scénario Différé) :</span>
          </div>
          <Select value={deferDays} onValueChange={v => { setDeferDays(v); }}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-300 h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {["7", "14", "21", "30", "45", "60"].map(v => (
                <SelectItem key={v} value={v} className="text-slate-300">J+{v} jours</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => refetchFleet()} className="text-slate-400 hover:text-white h-8">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Fleet KPIs */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-4 text-center">
            <div className="text-3xl font-black text-white mb-1">{fleet?.totalEquipment ?? "–"}</div>
            <div className="text-xs text-slate-400">Actifs simulés</div>
          </div>
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center">
            <div className="text-3xl font-black text-red-400 mb-1">{fleet?.criticalCount ?? "–"}</div>
            <div className="text-xs text-slate-400">Urgence critique</div>
          </div>
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-center">
            <div className="text-3xl font-black text-cyan-400 mb-1">{deferDays}j</div>
            <div className="text-xs text-slate-400">Horizon report simulé</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left — Fleet list */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-white">Classement par urgence — Flotte</h2>
            {fleetLoading ? (
              <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-800/40 animate-pulse" />)}</div>
            ) : fleet?.results && fleet.results.length > 0 ? (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {fleet.results.map(item => (
                  <FleetRow key={item.equipmentId} item={item} onSelect={() => setSelectedId(item.equipmentId)} />
                ))}
              </div>
            ) : equipList && equipList.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">Sélectionner un équipement :</p>
                {equipList.slice(0, 10).map(e => (
                  <button key={e.id} onClick={() => setSelectedId(e.id)}
                    className="w-full flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-2.5 hover:border-cyan-500/50 transition-colors text-left">
                    <span className="text-sm text-slate-300">{e.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs border-slate-600 text-slate-500">{e.criticalityLevel}</Badge>
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-8 text-center">
                <Cpu className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Aucun équipement disponible.</p>
              </div>
            )}
          </div>

          {/* Right — Simulation detail */}
          <div>
            {simLoading ? (
              <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 rounded-xl bg-slate-800/40 animate-pulse" />)}</div>
            ) : sim ? (
              <div className="space-y-4">
                {/* Equipment header */}
                <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-white">{sim.equipmentName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Criticité : <span className="text-slate-300 capitalize">{sim.criticalityLevel}</span> ·
                        Taux de dégradation : <span className="text-amber-400">{sim.currentDegradationRate.toFixed(3)} IMCA/j</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black" style={{ color: imcaColor(sim.currentIMCA) }}>{sim.currentIMCA}</div>
                      <div className="text-xs text-slate-500">IMCA actuel</div>
                    </div>
                  </div>
                </div>

                {/* Recommendation banner */}
                {rec && urgCfg && (
                  <div className={`rounded-2xl border ${urgCfg.border} ${urgCfg.bg} p-4`}>
                    <div className="flex items-start gap-3">
                      <UrgIcon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${urgCfg.color}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-sm font-bold ${urgCfg.color}`}>Urgence {urgCfg.label}</span>
                          <span className="text-xs text-slate-500">— Confiance : {Math.round(rec.confidence * 100)}%</span>
                          {rec.autonomyCompatible
                            ? <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full px-2">Autonomie compatible</span>
                            : <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-2">Approbation humaine requise</span>}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{rec.rationale}</p>
                        {rec.decisionDeadline && (
                          <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Délai de décision : <span className="text-slate-300">{new Date(rec.decisionDeadline).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Three scenario cards */}
                {(["IMMEDIATE", "DEFERRED", "NO_INTERVENTION"] as ScenarioType[]).map(type => (
                  <ScenarioCard
                    key={type}
                    scenario={sim.scenarios[type]}
                    isRecommended={rec?.scenario === type}
                    isExpanded={expandedScenario === type}
                    onToggle={() => setExpandedScenario(expandedScenario === type ? null : type)}
                  />
                ))}

                {/* Comparison matrix */}
                <ComparisonTable data={sim} />

                {/* Formula legend */}
                <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-4">
                  <p className="text-xs font-semibold text-slate-400 mb-2">Modèles utilisés</p>
                  <div className="grid grid-cols-1 gap-1 text-xs font-mono text-slate-500">
                    <div>IMCA(t) = IMCA₀ × exp(−λ × (t/τ)^β) · Weibull β=1.3</div>
                    <div>P(défaillance) = 1 − exp(−μ × max(0, 60−IMCA)² / 800)</div>
                    <div>OEE_loss = max(0, (80−IMCA) × 0.15) pts</div>
                    <div>Score = 0.4×C_total + 0.4×RiskScore + 0.2×OEE_loss</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-700 bg-slate-800/30 p-12 text-center h-full flex flex-col items-center justify-center min-h-[400px]">
                <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-4">
                  <FlaskConical className="w-10 h-10 text-cyan-400" />
                </div>
                <p className="text-slate-300 font-semibold mb-2">Sélectionnez un équipement</p>
                <p className="text-slate-500 text-sm max-w-xs">La simulation compare les trois scénarios décisionnels (Immédiat / Différé / Non-intervention) sur un horizon de 90 jours avec modèle de Weibull calibré.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

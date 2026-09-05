/**
 * Adaptation Locale Différentielle — Interface Utilisateur
 * Brevet MAINTRIX-SCA — Module Apprentissage Fédéré Adaptatif
 *
 * Visualise :
 * - Score de maturité M(s) par site
 * - Coefficient de mélange λ(s) avec courbe élastique
 * - Modèle global vs local (radar 12D)
 * - Indice de Préservation de la Spécialisation (SPI)
 * - Rapport de dérive et alertes
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Brain,
  Layers,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Network,
  BarChart3,
  Cpu,
  Info,
} from "lucide-react";

// ─── Types mirroring server ────────────────────────────────────────────────────

interface SiteProfile {
  tenantId: string;
  tenantName: string;
  maturityScore: number;
  mixingCoefficient: number;
  nCases: number;
  nPatterns: number;
  avgSuccessRate: number;
  daysActive: number;
  localModelVector: number[];
  specializations: string[];
}

interface PersonalizedModelResult {
  tenantId: string;
  personalizedVector: number[];
  globalVector: number[];
  localVector: number[];
  mixingCoefficient: number;
  spi: number;
  globalContribution: number;
  localContribution: number;
}

interface AggregationResult {
  success: boolean;
  globalModel: number[];
  nSites: number;
  fleetMaturityAvg: number;
  fleetLambdaAvg: number;
  fleetSPIAvg: number;
  nSitesMature: number;
  nSitesSpecialized: number;
  driftAlerts: { tenantId: string; delta: number; reason: string }[];
  aggregationWeights: Record<string, number>;
  aggregatedAt: string;
  dimLabels: string[];
}

interface SitesResult {
  sites: SiteProfile[];
  fleetStats: {
    nSites: number;
    fleetMaturityAvg: number;
    fleetLambdaAvg: number;
    fleetSPIAvg: number;
    nSitesMature: number;
    nSitesSpecialized: number;
  };
  aggregatedAt: string;
}

interface SpecializationReport {
  spiReport: {
    tenantId: string;
    tenantName: string;
    spi: number;
    lambda: number;
    maturity: number;
    specializedDims: { dim: string; local: number; global: number; delta: number; isSpecialized: boolean }[];
    nSpecializedDims: number;
    dominantSpecialization: string;
    riskLevel: "generic" | "emerging" | "specialized" | "artefact";
  }[];
  globalModel: number[];
  dimLabels: string[];
  summary: {
    nGeneric: number;
    nEmerging: number;
    nSpecialized: number;
    nArtefact: number;
    maxSPI: number;
    avgSPI: number;
    driftAlerts: any[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lambdaColor(lambda: number): string {
  if (lambda > 0.65) return "text-emerald-400";
  if (lambda > 0.4) return "text-amber-400";
  return "text-blue-400";
}

function maturityColor(m: number): string {
  if (m > 0.7) return "from-emerald-500 to-emerald-600";
  if (m > 0.4) return "from-amber-500 to-amber-600";
  return "from-blue-500 to-blue-600";
}

function spiLabel(spi: number): { label: string; color: string } {
  if (spi > 0.5) return { label: "Fortement spécialisé", color: "text-purple-400" };
  if (spi > 0.2) return { label: "Spécialisation émergente", color: "text-amber-400" };
  return { label: "Proche du consensus", color: "text-blue-400" };
}

function riskBadge(level: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    generic:     { label: "Générique",   variant: "secondary" },
    emerging:    { label: "Émergent",    variant: "default" },
    specialized: { label: "Spécialisé", variant: "default" },
    artefact:    { label: "Artefact",    variant: "destructive" },
  };
  return map[level] ?? { label: level, variant: "outline" };
}

// ─── Mini radar chart (SVG, 12 dimensions) ────────────────────────────────────

function RadarChart({
  global, local, personalized, labels,
}: {
  global: number[];
  local: number[];
  personalized: number[];
  labels: string[];
}) {
  const cx = 120, cy = 120, r = 100;
  const n = Math.min(labels.length, 12);
  const angleStep = (2 * Math.PI) / n;

  function toXY(val: number, idx: number) {
    const angle = idx * angleStep - Math.PI / 2;
    return {
      x: cx + r * val * Math.cos(angle),
      y: cy + r * val * Math.sin(angle),
    };
  }

  function polyPoints(vec: number[]) {
    return vec.slice(0, n).map((v, i) => {
      const { x, y } = toXY(Math.min(1, v * 6), i); // scale × 6 pour lisibilité
      return `${x},${y}`;
    }).join(" ");
  }

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-xs mx-auto">
      {/* Grid */}
      {rings.map(ring => (
        <polygon
          key={ring}
          points={Array.from({ length: n }, (_, i) => {
            const { x, y } = toXY(ring, i);
            return `${x},${y}`;
          }).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}
      {/* Axes */}
      {Array.from({ length: n }, (_, i) => {
        const { x, y } = toXY(1, i);
        return (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y}
            stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        );
      })}
      {/* Global (bleu) */}
      <polygon points={polyPoints(global)}
        fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth="1.5" />
      {/* Local (violet) */}
      <polygon points={polyPoints(local)}
        fill="rgba(168,85,247,0.15)" stroke="#a855f7" strokeWidth="1.5" />
      {/* Personnalisé (vert) */}
      <polygon points={polyPoints(personalized)}
        fill="rgba(34,197,94,0.15)" stroke="#22c55e" strokeWidth="2" strokeDasharray="4,2" />
      {/* Labels */}
      {labels.slice(0, n).map((lbl, i) => {
        const { x, y } = toXY(1.22, i);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fontSize="7" fill="rgba(255,255,255,0.6)" className="font-mono">
            {lbl.replace(/_w$|_p$/, "")}
          </text>
        );
      })}
      {/* Center dot */}
      <circle cx={cx} cy={cy} r="3" fill="rgba(255,255,255,0.3)" />
    </svg>
  );
}

// ─── Lambda curve (elastic coupling) ─────────────────────────────────────────

function LambdaCurve({ current }: { current: number }) {
  const LAMBDA_MAX = 0.85;
  const K = 3.5;
  const W = 280, H = 100;
  const points = Array.from({ length: 101 }, (_, i) => {
    const m = i / 100;
    const lam = LAMBDA_MAX * (1 - Math.exp(-K * m));
    const x = (m * (W - 40)) + 20;
    const y = H - 20 - lam * (H - 40);
    return `${x},${y}`;
  }).join(" ");

  const dotX = (current * (W - 40)) + 20;
  const dotY = H - 20 - (LAMBDA_MAX * (1 - Math.exp(-K * current))) * (H - 40);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
      <polyline points={points} fill="none" stroke="#6366f1" strokeWidth="2" />
      {/* Asymptote */}
      <line x1={20} y1={H - 20 - LAMBDA_MAX * (H - 40)} x2={W - 20} y2={H - 20 - LAMBDA_MAX * (H - 40)}
        stroke="rgba(99,102,241,0.3)" strokeDasharray="4,3" strokeWidth="1" />
      {/* Current site dot */}
      <circle cx={dotX} cy={dotY} r="5" fill="#22c55e" />
      <text x={dotX + 7} y={dotY + 1} fontSize="9" fill="#22c55e" dominantBaseline="middle">
        λ={(LAMBDA_MAX * (1 - Math.exp(-K * current))).toFixed(2)}
      </text>
      {/* Axes labels */}
      <text x={20} y={H - 5} fontSize="8" fill="rgba(255,255,255,0.4)">M=0</text>
      <text x={W - 35} y={H - 5} fontSize="8" fill="rgba(255,255,255,0.4)">M=1</text>
      <text x={5} y={H - 20 - LAMBDA_MAX * (H - 40)} fontSize="8" fill="rgba(99,102,241,0.6)" dominantBaseline="middle">
        λ_max
      </text>
    </svg>
  );
}

// ─── Site card ────────────────────────────────────────────────────────────────

function SiteCard({
  profile,
  aggregationWeight,
  globalModel,
  dimLabels,
}: {
  profile: SiteProfile;
  aggregationWeight: number;
  globalModel: number[];
  dimLabels: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const personalizedVec = profile.localModelVector.map((v, i) =>
    (1 - profile.mixingCoefficient) * (globalModel[i] ?? 0) + profile.mixingCoefficient * v
  );

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white truncate">{profile.tenantName}</span>
            <Badge variant="outline" className="text-xs border-white/20 text-white/60">
              {profile.nCases} cas · {profile.nPatterns} patterns
            </Badge>
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs text-white/50">{profile.daysActive}j actif</span>
            {profile.specializations.slice(0, 2).map(s => (
              <Badge key={s} variant="secondary" className="text-xs px-1.5 py-0 bg-purple-500/20 text-purple-300 border-purple-500/30">
                {s.replace(/_w$|_p$/, "")}
              </Badge>
            ))}
          </div>
        </div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-white/40 hover:text-white transition-colors text-xs"
        >
          {expanded ? "▲ Réduire" : "▼ Détails"}
        </button>
      </div>

      {/* Metrics row */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-3">
        {/* Maturité */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-white/50">Maturité M(s)</span>
            <span className="text-white font-mono font-medium">{(profile.maturityScore * 100).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${maturityColor(profile.maturityScore)} transition-all`}
              style={{ width: `${profile.maturityScore * 100}%` }}
            />
          </div>
        </div>

        {/* Lambda */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-white/50">Mélange λ(s)</span>
            <span className={`font-mono font-bold ${lambdaColor(profile.mixingCoefficient)}`}>
              {profile.mixingCoefficient.toFixed(3)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all"
              style={{ width: `${profile.mixingCoefficient * 100}%` }}
            />
          </div>
        </div>

        {/* Contribution globale */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-white/50">Contribution</span>
            <span className="text-white font-mono text-xs">{(aggregationWeight * 100).toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all"
              style={{ width: `${Math.min(100, aggregationWeight * 100 * 5)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Expanded: lambda curve + radar */}
      {expanded && (
        <div className="border-t border-white/10 p-4 space-y-4 bg-white/3">
          <div>
            <div className="text-xs text-white/50 mb-1">
              Couplage adaptatif entre le modèle global et le modèle local du site
            </div>
            <LambdaCurve current={profile.maturityScore} />
          </div>
          <div>
            <div className="text-xs text-white/50 mb-2">
              Modèle · <span className="text-blue-400">■ global</span> &nbsp;
              <span className="text-purple-400">■ local</span> &nbsp;
              <span className="text-green-400">▪ personnalisé θ̂(s)</span>
            </div>
            <RadarChart
              global={globalModel}
              local={profile.localModelVector}
              personalized={personalizedVec}
              labels={dimLabels}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white/5 p-2.5 space-y-0.5">
              <div className="text-white/40">Modèle global (1 − λ)</div>
              <div className="text-blue-300 font-mono font-bold">
                {((1 - profile.mixingCoefficient) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="rounded-lg bg-white/5 p-2.5 space-y-0.5">
              <div className="text-white/40">Modèle local (λ)</div>
              <div className="text-purple-300 font-mono font-bold">
                {(profile.mixingCoefficient * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FederatedAdaptationPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("sites");

  const { data: sitesData, isLoading: sitesLoading } = useQuery<SitesResult>({
    queryKey: ["/api/federated-adapt/sites"],
  });

  const { data: specData, isLoading: specLoading } = useQuery<SpecializationReport>({
    queryKey: ["/api/federated-adapt/specialization"],
  });

  const { data: configData } = useQuery<any>({
    queryKey: ["/api/federated-adapt/config"],
  });

  const aggregateMutation = useMutation({
    mutationFn: () => apiRequest("/api/federated-adapt/aggregate", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/federated-adapt/sites"] });
      qc.invalidateQueries({ queryKey: ["/api/federated-adapt/specialization"] });
    },
  });

  const stats = sitesData?.fleetStats;
  const sites = sitesData?.sites ?? [];
  const dimLabels: string[] = configData?.dimLabels ?? [];
  const globalModel: number[] = specData?.globalModel ?? [];

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    Adaptation Locale Différentielle
                  </h1>
                  <p className="text-sm text-white/50">
                    Préservation de la spécialisation des sites matures · Apprentissage Fédéré Adaptatif
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 ml-13">
                <Badge variant="outline" className="text-xs border-indigo-500/40 text-indigo-300 bg-indigo-500/10">
                  pFed · Couplage Élastique
                </Badge>
                <Badge variant="outline" className="text-xs border-purple-500/40 text-purple-300 bg-purple-500/10">
                  Mélange adaptatif global/local
                </Badge>
                <Badge variant="outline" className="text-xs border-cyan-500/40 text-cyan-300 bg-cyan-500/10">
                  SPI · FedAvg pondéré différentiel
                </Badge>
              </div>
            </div>
            <Button
              onClick={() => aggregateMutation.mutate()}
              disabled={aggregateMutation.isPending}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border-0 shadow-lg shadow-indigo-500/20"
            >
              {aggregateMutation.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Agréger maintenant
            </Button>
          </div>
        </div>

        {/* Fleet KPI cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {[
              {
                label: "Sites actifs",
                value: stats.nSites,
                icon: Network,
                color: "from-blue-500 to-blue-600",
                suffix: "",
              },
              {
                label: "Maturité moy. M̄",
                value: (stats.fleetMaturityAvg * 100).toFixed(0),
                icon: Activity,
                color: "from-emerald-500 to-emerald-600",
                suffix: "%",
              },
              {
                label: "Mélange moy. λ̄",
                value: stats.fleetLambdaAvg.toFixed(3),
                icon: Layers,
                color: "from-indigo-500 to-indigo-600",
                suffix: "",
              },
              {
                label: "SPI moyen",
                value: stats.fleetSPIAvg.toFixed(3),
                icon: BarChart3,
                color: "from-purple-500 to-purple-600",
                suffix: "",
              },
              {
                label: "Sites matures",
                value: stats.nSitesMature,
                icon: CheckCircle2,
                color: "from-teal-500 to-teal-600",
                suffix: "",
              },
              {
                label: "Spécialisés",
                value: stats.nSitesSpecialized,
                icon: Cpu,
                color: "from-violet-500 to-violet-600",
                suffix: "",
              },
            ].map(({ label, value, icon: Icon, color, suffix }) => (
              <Card key={label} className="border-white/10 bg-white/5 backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center mb-2 shadow-md`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {value}{suffix}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5">{label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Main tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/5 border border-white/10 mb-6">
            <TabsTrigger value="sites" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
              <Network className="w-4 h-4 mr-2" />Profils des sites
            </TabsTrigger>
            <TabsTrigger value="specialization" className="data-[state=active]:bg-white/10 data-[state=active]:text-white text-white/60">
              <BarChart3 className="w-4 h-4 mr-2" />Rapport SPI
            </TabsTrigger>
          </TabsList>

          {/* ── Sites tab ──────────────────────────────────────────────────── */}
          <TabsContent value="sites">
            {sitesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-40 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : sites.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
                <Brain className="w-12 h-12 text-white/20 mx-auto mb-3" />
                <div className="text-white/40 text-sm">
                  Aucun site actif — créez des tenants et des sessions diagnostiques pour alimenter l'apprentissage fédéré.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sites.map(profile => {
                  const specEntry = specData?.spiReport.find(s => s.tenantId === profile.tenantId);
                  const aggData = sitesData;
                  const agg = sitesData?.aggregatedAt ? profile.mixingCoefficient : 0;
                  return (
                    <SiteCard
                      key={profile.tenantId}
                      profile={profile}
                      aggregationWeight={1 / Math.max(1, sites.length)}
                      globalModel={globalModel}
                      dimLabels={dimLabels}
                    />
                  );
                })}
              </div>
            )}

            {/* Drift alerts */}
            {specData?.summary?.driftAlerts && specData.summary.driftAlerts.length > 0 && (
              <div className="mt-6 space-y-2">
                <div className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Alertes de dérive détectées
                </div>
                {specData.summary.driftAlerts.map((alert: any, i: number) => (
                  <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                    <span className="font-mono text-amber-400 mr-2">[{alert.tenantId.slice(0, 8)}]</span>
                    {alert.reason}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Specialization tab ────────────────────────────────────────── */}
          <TabsContent value="specialization">
            {specLoading ? (
              <div className="h-64 rounded-xl bg-white/5 animate-pulse" />
            ) : (
              <div className="space-y-4">
                {/* Summary pills */}
                {specData?.summary && (
                  <div className="flex flex-wrap gap-3">
                    {[
                      { label: "Génériques", count: specData.summary.nGeneric, color: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
                      { label: "Émergents", count: specData.summary.nEmerging, color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
                      { label: "Spécialisés", count: specData.summary.nSpecialized, color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
                      { label: "Artefacts", count: specData.summary.nArtefact, color: "bg-red-500/20 text-red-300 border-red-500/30" },
                    ].map(({ label, count, color }) => (
                      <div key={label} className={`rounded-full border px-3 py-1 text-xs font-medium ${color}`}>
                        {count} {label}
                      </div>
                    ))}
                    <div className="rounded-full border px-3 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                      SPI max = {specData.summary.maxSPI.toFixed(3)}
                    </div>
                  </div>
                )}

                {/* SPI table */}
                <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/5">
                          <th className="text-left p-3 text-white/50 font-medium text-xs">Site</th>
                          <th className="text-center p-3 text-white/50 font-medium text-xs">M(s)</th>
                          <th className="text-center p-3 text-white/50 font-medium text-xs">λ(s)</th>
                          <th className="text-center p-3 text-white/50 font-medium text-xs">SPI</th>
                          <th className="text-center p-3 text-white/50 font-medium text-xs">Dim. spécialisées</th>
                          <th className="text-left p-3 text-white/50 font-medium text-xs">Dominante</th>
                          <th className="text-center p-3 text-white/50 font-medium text-xs">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {(specData?.spiReport ?? []).map(row => {
                          const { label: spiLbl, color: spiClr } = spiLabel(row.spi);
                          const { label: rLabel, variant } = riskBadge(row.riskLevel);
                          return (
                            <tr key={row.tenantId} className="hover:bg-white/5 transition-colors">
                              <td className="p-3">
                                <div className="font-medium text-white text-xs">{row.tenantName}</div>
                                <div className="text-white/30 text-xs font-mono">{row.tenantId.slice(0, 8)}</div>
                              </td>
                              <td className="p-3 text-center">
                                <div className="font-mono font-bold text-white text-xs">{(row.maturity * 100).toFixed(0)}%</div>
                                <Progress value={row.maturity * 100} className="h-1 mt-1 w-16 mx-auto" />
                              </td>
                              <td className="p-3 text-center">
                                <span className={`font-mono font-bold text-sm ${lambdaColor(row.lambda)}`}>
                                  {row.lambda.toFixed(3)}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span className={`font-mono font-bold text-sm ${spiClr}`}>
                                  {row.spi.toFixed(3)}
                                </span>
                                <div className="text-white/30 text-xs">{spiLbl}</div>
                              </td>
                              <td className="p-3 text-center">
                                <span className="text-white font-mono text-lg font-bold">{row.nSpecializedDims}</span>
                                <span className="text-white/40 text-xs">/12</span>
                              </td>
                              <td className="p-3">
                                <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/30 font-mono">
                                  {row.dominantSpecialization.replace(/_w$|_p$/, "") || "—"}
                                </Badge>
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant={variant} className="text-xs">
                                  {rLabel}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                        {(specData?.spiReport ?? []).length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-white/30 text-sm">
                              Aucune donnée — déclenchez une agrégation pour alimenter le rapport SPI.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

        </Tabs>
      </div>
    </TooltipProvider>
  );
}

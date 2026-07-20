import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ModernNavigation } from "@/components/modern-navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Brain,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench,
  TrendingUp,
  Filter,
  Search,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Sparkles,
  CalendarDays,
  DollarSign,
  Activity,
  Shield,
  ClipboardList,
  BarChart3,
  Gauge,
  Info,
  Play,
  Building2,
  AlertCircle,
  Target,
  Zap,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────────────────
interface Recommendation {
  id: string;
  equipmentId: number;
  equipmentName: string;
  equipmentType: string;
  location: string;
  priority: "critical" | "high" | "medium" | "low";
  type: "overdue" | "predictive" | "usage_based" | "failure_pattern" | "seasonal" | "ai_optimized";
  title: string;
  description: string;
  reasoning: string[];
  suggestedDate: string;
  estimatedDuration: number;
  estimatedCost: number;
  confidence: number;
  kpis: {
    failureRisk: number;
    mtbfDays: number;
    daysSinceLastMaintenance: number;
    completionRate: number;
  };
  actions: string[];
  relatedWorkOrders: number[];
}

interface RecommendationData {
  recommendations: Recommendation[];
  summary: {
    totalRecommendations: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    avgConfidence: number;
    estimatedCostIfIgnored: number;
    topRisks: string[];
  };
  generatedAt: string;
  analysisMetadata: {
    equipmentAnalyzed: number;
    workOrdersAnalyzed: number;
    plansAnalyzed: number;
    lookbackDays: number;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
const PRIORITY_CONFIG = {
  critical: { label: "Critique", color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-500", badge: "bg-rose-100 text-rose-700 border-rose-200" },
  high:     { label: "Élevée",   color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700 border-orange-200" },
  medium:   { label: "Moyenne",  color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  low:      { label: "Faible",   color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  overdue:         { label: "En retard",       icon: AlertTriangle, color: "text-rose-600" },
  predictive:      { label: "Prédictive",      icon: Brain,         color: "text-violet-600" },
  usage_based:     { label: "Usage",           icon: Gauge,         color: "text-blue-600" },
  failure_pattern: { label: "Schéma pannes",   icon: TrendingUp,    color: "text-orange-600" },
  seasonal:        { label: "Saisonnière",     icon: CalendarDays,  color: "text-sky-600" },
  ai_optimized:    { label: "IA Optimisée",    icon: Sparkles,      color: "text-purple-600" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}
function formatDuration(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? m + "min" : ""}` : `${m}min`;
}
function daysUntil(d: string) {
  const diff = Math.round((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}j en retard`;
  if (diff === 0) return "Aujourd'hui";
  return `Dans ${diff}j`;
}

// ── Apply Dialog ────────────────────────────────────────────────────────────────
function ApplyDialog({ rec, onClose }: { rec: Recommendation; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [scheduledDate, setScheduledDate] = useState(rec.suggestedDate);

  const apply = useMutation({
    mutationFn: () => apiRequest("/api/maintenance-recommendations/apply", {
      method: "POST",
      body: {
        recommendationId: rec.id,
        equipmentId: rec.equipmentId,
        title: rec.title.replace(/^[⚠️📅🔄🔍]\s?/, ""),
        description: rec.description,
        scheduledDate,
        estimatedDuration: rec.estimatedDuration,
        priority: rec.priority,
      },
    }),
    onSuccess: () => {
      toast({ title: "Ordre de travail créé", description: `OT planifié pour ${rec.equipmentName}` });
      qc.invalidateQueries({ queryKey: ["/api/work-orders"] });
      onClose();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer l'ordre de travail", variant: "destructive" });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">Créer un ordre de travail</h3>
          <p className="text-sm text-slate-500 mt-1">{rec.equipmentName}</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">Date planifiée</label>
            <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
          </div>
          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Durée estimée</span>
              <span className="font-medium text-slate-800">{formatDuration(rec.estimatedDuration)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Coût estimé</span>
              <span className="font-medium text-slate-800">{rec.estimatedCost.toLocaleString("fr-FR")} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Priorité</span>
              <Badge className={PRIORITY_CONFIG[rec.priority].badge}>{PRIORITY_CONFIG[rec.priority].label}</Badge>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            onClick={() => apply.mutate()}
            disabled={apply.isPending}
          >
            {apply.isPending ? "Création..." : "Créer l'OT"}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Recommendation Card ─────────────────────────────────────────────────────────
function RecCard({ rec, onApply }: { rec: Recommendation; onApply: (r: Recommendation) => void }) {
  const [expanded, setExpanded] = useState(false);
  const pc = PRIORITY_CONFIG[rec.priority];
  const tc = TYPE_CONFIG[rec.type] || TYPE_CONFIG.predictive;
  const TypeIcon = tc.icon;

  return (
    <div className={`bg-white border ${pc.border} rounded-2xl shadow-sm hover:shadow-md transition-all duration-200`}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-2.5 h-2.5 ${pc.dot} rounded-full flex-shrink-0 mt-1.5`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge className={`text-xs ${pc.badge}`}>{pc.label}</Badge>
                <div className={`flex items-center gap-1 text-xs ${tc.color}`}>
                  <TypeIcon className="w-3.5 h-3.5" />
                  <span>{tc.label}</span>
                </div>
              </div>
              <h3 className="text-sm font-semibold text-slate-800 leading-snug">{rec.title}</h3>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-xs font-medium text-slate-500 whitespace-nowrap">{daysUntil(rec.suggestedDate)}</div>
            <div className="text-xs text-slate-400">{formatDate(rec.suggestedDate)}</div>
          </div>
        </div>

        {/* Equipment info */}
        <div className="flex items-center gap-3 mb-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{rec.location}</span>
          <span className="text-slate-300">·</span>
          <span>{rec.equipmentType}</span>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-slate-50 rounded-lg p-2 text-center">
            <div className={`text-base font-bold ${rec.kpis.failureRisk >= 50 ? "text-rose-600" : rec.kpis.failureRisk >= 25 ? "text-amber-600" : "text-emerald-600"}`}>
              {rec.kpis.failureRisk}%
            </div>
            <div className="text-[10px] text-slate-500 leading-tight">Risque panne</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-slate-700">{rec.kpis.mtbfDays}j</div>
            <div className="text-[10px] text-slate-500 leading-tight">MTBF</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2 text-center">
            <div className="text-base font-bold text-slate-700">{rec.kpis.daysSinceLastMaintenance}j</div>
            <div className="text-[10px] text-slate-500 leading-tight">Depuis dernière MP</div>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Confiance de l'analyse</span>
            <span className="font-medium text-slate-700">{rec.confidence}%</span>
          </div>
          <Progress value={rec.confidence} className="h-1.5" />
        </div>

        {/* Cost + duration */}
        <div className="flex gap-3 text-xs text-slate-500 mb-4">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDuration(rec.estimatedDuration)}</span>
          <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />{rec.estimatedCost.toLocaleString("fr-FR")} €</span>
        </div>

        {/* Expand toggle */}
        <button
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 mb-3"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {expanded ? "Masquer le détail" : "Voir l'analyse complète"}
        </button>

        {expanded && (
          <div className="space-y-3 mb-4">
            {/* Reasoning */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <div className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />Facteurs de recommandation
              </div>
              <ul className="space-y-1">
                {rec.reasoning.map((r, i) => (
                  <li key={i} className="text-xs text-blue-800 flex items-start gap-1.5">
                    <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-blue-500" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />Actions recommandées
              </div>
              <ol className="space-y-1">
                {rec.actions.map((a, i) => (
                  <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                    <span className="w-4 h-4 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center flex-shrink-0 font-bold" style={{ fontSize: "9px" }}>{i + 1}</span>
                    {a}
                  </li>
                ))}
              </ol>
            </div>

            {/* Completion rate */}
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>Taux complétion MP historique</span>
              <span className={`font-semibold ${rec.kpis.completionRate >= 80 ? "text-emerald-600" : rec.kpis.completionRate >= 60 ? "text-amber-600" : "text-rose-600"}`}>
                {rec.kpis.completionRate}%
              </span>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs"
            onClick={() => onApply(rec)}
          >
            <Play className="w-3.5 h-3.5 mr-1.5" />
            Créer un OT
          </Button>
          <Link href={`/gmao`}>
            <Button size="sm" variant="outline" className="rounded-xl text-xs border-slate-200">
              <Wrench className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────────
export default function MaintenanceRecommendations() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [applyTarget, setApplyTarget] = useState<Recommendation | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch, isFetching } = useQuery<RecommendationData>({
    queryKey: ["/api/maintenance-recommendations"],
    staleTime: 2 * 60 * 1000, // 2 min
  });

  const recommendations = data?.recommendations || [];
  const summary = data?.summary;
  const meta = data?.analysisMetadata;

  // Filter
  const filtered = recommendations.filter(r => {
    const matchSearch = !search ||
      r.equipmentName.toLowerCase().includes(search.toLowerCase()) ||
      r.location.toLowerCase().includes(search.toLowerCase()) ||
      r.equipmentType.toLowerCase().includes(search.toLowerCase());
    const matchPriority = filterPriority === "all" || r.priority === filterPriority;
    const matchType = filterType === "all" || r.type === filterType;
    return matchSearch && matchPriority && matchType;
  });

  const criticalRecs = filtered.filter(r => r.priority === "critical");
  const highRecs = filtered.filter(r => r.priority === "high");
  const otherRecs = filtered.filter(r => r.priority === "medium" || r.priority === "low");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/80">
        <ModernNavigation />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse shadow-lg shadow-blue-500/25">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-slate-700 mb-2">Analyse en cours…</h2>
          <p className="text-slate-500 text-sm">Analyse de l'historique des équipements, OT et plans de maintenance</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/80">
      <ModernNavigation />

      {applyTarget && <ApplyDialog rec={applyTarget} onClose={() => setApplyTarget(null)} />}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Page Header ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-800">Recommandations de maintenance</h1>
            </div>
            <p className="text-slate-500 text-sm ml-13">
              Recommandations personnalisées basées sur l'historique, l'usage et les données IoT de vos équipements
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <div className="text-xs text-slate-400">
                Analysé {meta?.equipmentAnalyzed} équipements · {meta?.workOrdersAnalyzed} OT
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="border-slate-200 text-slate-600 rounded-xl"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </div>

        {isError && (
          <div className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center gap-3 text-rose-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">Erreur lors de l'analyse. Vérifiez que des équipements et ordres de travail existent.</span>
            <Button size="sm" variant="ghost" onClick={() => refetch()} className="ml-auto text-rose-700">Réessayer</Button>
          </div>
        )}

        {/* ── Summary KPI Bar ──────────────────────────────────── */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
            <div className="col-span-2 sm:col-span-4 lg:col-span-2 bg-gradient-to-br from-blue-600 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20">
              <div className="text-3xl font-extrabold mb-1">{summary.totalRecommendations}</div>
              <div className="text-blue-100 text-sm">Recommandations</div>
              <div className="mt-3 text-xs text-blue-200">Confiance moyenne : <span className="text-white font-semibold">{summary.avgConfidence}%</span></div>
            </div>
            {[
              { label: "Critiques", val: summary.critical, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100" },
              { label: "Élevées",   val: summary.high,     color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100" },
              { label: "Moyennes",  val: summary.medium,   color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
              { label: "Faibles",   val: summary.low,      color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
            ].map(({ label, val, color, bg, border }) => (
              <div key={label} className={`${bg} border ${border} rounded-2xl p-4 text-center`}>
                <div className={`text-2xl font-bold ${color}`}>{val}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Cost if Ignored Banner ───────────────────────────── */}
        {summary && summary.estimatedCostIfIgnored > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <DollarSign className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-amber-800">Coût estimé si non traité</div>
              <div className="text-xs text-amber-600 mt-0.5">
                Les recommandations critiques et élevées non traitées pourraient générer jusqu'à{" "}
                <span className="font-bold text-amber-800">{summary.estimatedCostIfIgnored.toLocaleString("fr-FR")} €</span>
                {" "}de maintenance corrective (3,5× le coût préventif estimé).
              </div>
            </div>
          </div>
        )}

        {/* ── Filters ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-9 rounded-xl border-slate-200"
              placeholder="Rechercher un équipement, lieu…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {["all", "critical", "high", "medium", "low"].map(p => (
              <button
                key={p}
                onClick={() => setFilterPriority(p)}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${filterPriority === p ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
              >
                {p === "all" ? "Tous" : PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG].label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {["all", "overdue", "predictive", "failure_pattern"].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${filterType === t ? "bg-violet-600 text-white border-violet-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
              >
                {t === "all" ? "Tout type" : TYPE_CONFIG[t]?.label || t}
              </button>
            ))}
          </div>
        </div>

        {/* ── Recommendations ─────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              {recommendations.length === 0 ? "Aucune recommandation générée" : "Aucun résultat"}
            </h3>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              {recommendations.length === 0
                ? "Tous vos équipements semblent à jour. Ajoutez des équipements et des historiques d'OT pour obtenir des recommandations personnalisées."
                : "Essayez de modifier vos filtres de recherche."}
            </p>
            {recommendations.length === 0 && (
              <Link href="/equipment-management">
                <Button className="mt-4 bg-blue-600 hover:bg-blue-700 rounded-xl">
                  <Wrench className="w-4 h-4 mr-2" />
                  Gérer les équipements
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList className="bg-white border border-slate-200 rounded-xl p-1">
              <TabsTrigger value="all" className="rounded-lg text-xs">
                Toutes ({filtered.length})
              </TabsTrigger>
              {criticalRecs.length > 0 && (
                <TabsTrigger value="critical" className="rounded-lg text-xs text-rose-600">
                  Critiques ({criticalRecs.length})
                </TabsTrigger>
              )}
              {highRecs.length > 0 && (
                <TabsTrigger value="high" className="rounded-lg text-xs text-orange-600">
                  Élevées ({highRecs.length})
                </TabsTrigger>
              )}
              {otherRecs.length > 0 && (
                <TabsTrigger value="other" className="rounded-lg text-xs">
                  Autres ({otherRecs.length})
                </TabsTrigger>
              )}
            </TabsList>

            {[
              { value: "all", items: filtered },
              { value: "critical", items: criticalRecs },
              { value: "high", items: highRecs },
              { value: "other", items: otherRecs },
            ].map(({ value, items }) => (
              <TabsContent key={value} value={value}>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {items.map(r => (
                    <RecCard key={r.id} rec={r} onApply={setApplyTarget} />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* ── Bottom Info ──────────────────────────────────────── */}
        {data && (
          <div className="mt-10 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" />
              Équipements analysés : <strong className="text-slate-700">{meta?.equipmentAnalyzed}</strong>
            </span>
            <span className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" />
              OT analysés : <strong className="text-slate-700">{meta?.workOrdersAnalyzed}</strong>
            </span>
            <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />
              Plans consultés : <strong className="text-slate-700">{meta?.plansAnalyzed}</strong>
            </span>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />
              Générée le {new Date(data.generatedAt).toLocaleString("fr-FR")}
            </span>
            <span className="flex items-center gap-1.5 ml-auto"><Shield className="w-3.5 h-3.5" />
              Horizon d'analyse : {meta?.lookbackDays}j d'historique
            </span>
          </div>
        )}

      </main>
    </div>
  );
}

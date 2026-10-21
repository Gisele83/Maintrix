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
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

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
  critical: { label: "Critique", color: "text-etat-critique-texte", bg: "bg-etat-critique-fond", border: "border-etat-critique-filet", dot: "bg-etat-critique-vif", badge: "bg-etat-critique-fond text-etat-critique-texte border-etat-critique-filet" },
  high:     { label: "Élevée",   color: "text-etat-alerte-texte", bg: "bg-etat-alerte-fond", border: "border-etat-alerte-filet", dot: "bg-etat-alerte-vif", badge: "bg-etat-alerte-fond text-etat-alerte-texte border-etat-alerte-filet" },
  medium:   { label: "Moyenne",  color: "text-etat-alerte-texte", bg: "bg-etat-alerte-fond", border: "border-etat-alerte-filet", dot: "bg-etat-alerte-vif", badge: "bg-etat-alerte-fond text-etat-alerte-texte border-etat-alerte-filet" },
  low:      { label: "Faible",   color: "text-etat-nominal-texte", bg: "bg-etat-nominal-fond", border: "border-etat-nominal-filet", dot: "bg-etat-nominal-vif", badge: "bg-etat-nominal-fond text-etat-nominal-texte border-etat-nominal-filet" },
};

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  overdue:         { label: "En retard",       icon: AlertTriangle, color: "text-etat-critique-texte" },
  predictive:      { label: "Prédictive",      icon: Brain,         color: "text-signal-deep" },
  usage_based:     { label: "Usage",           icon: Gauge,         color: "text-etat-encours-texte" },
  failure_pattern: { label: "Schéma pannes",   icon: TrendingUp,    color: "text-etat-alerte-texte" },
  seasonal:        { label: "Saisonnière",     icon: CalendarDays,  color: "text-etat-encours-texte" },
  ai_optimized:    { label: "IA Optimisée",    icon: Sparkles,      color: "text-signal-deep" },
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
        title: rec.title.replace(/^[]\s?/, ""),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-none w-full max-w-md">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-ink">Créer un ordre de travail</h3>
          <p className="text-sm text-ink-mute mt-1">{rec.equipmentName}</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-ink-soft block mb-1.5">Date planifiée</label>
            <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
          </div>
          <div className="bg-paper rounded-none p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-mute">Durée estimée</span>
              <span className="font-medium text-ink">{formatDuration(rec.estimatedDuration)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-mute">Coût estimé</span>
              <span className="font-medium text-ink">{rec.estimatedCost.toLocaleString("fr-FR")} €</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-mute">Priorité</span>
              <Badge className={PRIORITY_CONFIG[rec.priority].badge}>{PRIORITY_CONFIG[rec.priority].label}</Badge>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
          <Button
            className="flex-1 bg-etat-encours-vif hover:bg-etat-encours-vif"
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
    <div className={`bg-white border ${pc.border} rounded-none shadow-sm hover:shadow-none transition-all duration-200`}>
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
              <h3 className="text-sm font-semibold text-ink leading-snug">{rec.title}</h3>
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="text-xs font-medium text-ink-mute whitespace-nowrap">{daysUntil(rec.suggestedDate)}</div>
            <div className="text-xs text-ink-mute">{formatDate(rec.suggestedDate)}</div>
          </div>
        </div>

        {/* Equipment info */}
        <div className="flex items-center gap-3 mb-3 text-xs text-ink-mute">
          <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{rec.location}</span>
          <span className="text-ink-soft">·</span>
          <span>{rec.equipmentType}</span>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-paper rounded-lg p-2 text-center">
            <div className={`text-base font-bold ${rec.kpis.failureRisk >= 50 ? "text-etat-critique-texte" : rec.kpis.failureRisk >= 25 ? "text-etat-alerte-texte" : "text-etat-nominal-texte"}`}>
              {rec.kpis.failureRisk}%
            </div>
            <div className="text-[10px] text-ink-mute leading-tight">Risque panne</div>
          </div>
          <div className="bg-paper rounded-lg p-2 text-center">
            <div className="text-base font-bold text-ink-soft">{rec.kpis.mtbfDays}j</div>
            <div className="text-[10px] text-ink-mute leading-tight">MTBF</div>
          </div>
          <div className="bg-paper rounded-lg p-2 text-center">
            <div className="text-base font-bold text-ink-soft">{rec.kpis.daysSinceLastMaintenance}j</div>
            <div className="text-[10px] text-ink-mute leading-tight">Depuis dernière MP</div>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-ink-mute mb-1">
            <span>Confiance de l'analyse</span>
            <span className="font-medium text-ink-soft">{rec.confidence}%</span>
          </div>
          <Progress value={rec.confidence} className="h-1.5" />
        </div>

        {/* Cost + duration */}
        <div className="flex gap-3 text-xs text-ink-mute mb-4">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{formatDuration(rec.estimatedDuration)}</span>
          <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />{rec.estimatedCost.toLocaleString("fr-FR")} €</span>
        </div>

        {/* Expand toggle */}
        <button
          className="flex items-center gap-1.5 text-xs text-etat-encours-texte hover:text-etat-encours-texte mb-3"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          {expanded ? "Masquer le détail" : "Voir l'analyse complète"}
        </button>

        {expanded && (
          <div className="space-y-3 mb-4">
            {/* Reasoning */}
            <div className="bg-etat-encours-fond border border-etat-encours-filet rounded-none p-3">
              <div className="text-xs font-semibold text-etat-encours-texte mb-2 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />Facteurs de recommandation
              </div>
              <ul className="space-y-1">
                {rec.reasoning.map((r, i) => (
                  <li key={i} className="text-xs text-etat-encours-texte flex items-start gap-1.5">
                    <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-etat-encours-texte" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div className="bg-paper rounded-none p-3">
              <div className="text-xs font-semibold text-ink-soft mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" />Actions recommandées
              </div>
              <ol className="space-y-1">
                {rec.actions.map((a, i) => (
                  <li key={i} className="text-xs text-ink-soft flex items-start gap-2">
                    <span className="w-4 h-4 bg-etat-encours-fond text-etat-encours-texte rounded-full flex items-center justify-center flex-shrink-0 font-bold" style={{ fontSize: "9px" }}>{i + 1}</span>
                    {a}
                  </li>
                ))}
              </ol>
            </div>

            {/* Completion rate */}
            <div className="flex justify-between items-center text-xs text-ink-mute">
              <span>Taux complétion MP historique</span>
              <span className={`font-semibold ${rec.kpis.completionRate >= 80 ? "text-etat-nominal-texte" : rec.kpis.completionRate >= 60 ? "text-etat-alerte-texte" : "text-etat-critique-texte"}`}>
                {rec.kpis.completionRate}%
              </span>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-etat-encours-vif hover:bg-etat-encours-vif rounded-none text-xs"
            onClick={() => onApply(rec)}
          >
            <Play className="w-3.5 h-3.5 mr-1.5" />
            Créer un OT
          </Button>
          <Link href={`/gmao`}>
            <Button size="sm" variant="outline" className="rounded-none text-xs border-rule">
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
      <AppShell filAriane={[{ libelle: "Prédictif" }, { libelle: "Recommandations" }]} largeur="large">
      <div className="space-y-6">
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 bg-paper-deep rounded-none flex items-center justify-center mx-auto mb-6 animate-pulse shadow-blue-500/25">
            <Brain className="w-8 h-8 text-ink" />
          </div>
          <h2 className="text-xl font-semibold text-ink-soft mb-2">Analyse en cours…</h2>
          <p className="text-ink-mute text-sm">Analyse de l'historique des équipements, OT et plans de maintenance</p>
        </div>
      </div>
    </AppShell>
    );
  }

  return (
    <div className="min-h-screen bg-paper-deep">
      <ModernNavigation />

      {applyTarget && <ApplyDialog rec={applyTarget} onClose={() => setApplyTarget(null)} />}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Page Header ──────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-paper-deep rounded-none flex items-center justify-center shadow-blue-500/20">
                <Sparkles className="w-5 h-5 text-ink" />
              </div>
              <h1 className="text-2xl font-bold text-ink">Recommandations de maintenance</h1>
            </div>
            <p className="text-ink-mute text-sm ml-13">
              Recommandations personnalisées basées sur l'historique, l'usage et les données IoT de vos équipements
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data && (
              <div className="text-xs text-ink-mute">
                Analysé {meta?.equipmentAnalyzed} équipements · {meta?.workOrdersAnalyzed} OT
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="border-rule text-ink-soft rounded-none"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
        </div>

        {isError && (
          <div className="mb-6 bg-etat-critique-fond border border-etat-critique-filet rounded-none p-4 flex items-center gap-3 text-etat-critique-texte">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">Erreur lors de l'analyse. Vérifiez que des équipements et ordres de travail existent.</span>
            <Button size="sm" variant="ghost" onClick={() => refetch()} className="ml-auto text-etat-critique-texte">Réessayer</Button>
          </div>
        )}

        {/* ── Summary KPI Bar ──────────────────────────────────── */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
            <div className="col-span-2 sm:col-span-4 lg:col-span-2 bg-ink rounded-none p-5 text-paper">
              <div className="text-3xl font-extrabold mb-1">{summary.totalRecommendations}</div>
              <div className="text-paper/80 text-sm">Recommandations</div>
              <div className="mt-3 text-xs text-paper/70">Confiance moyenne : <span className="text-paper font-semibold">{summary.avgConfidence} %</span></div>
            </div>
            {[
              { label: "Critiques", val: summary.critical, color: "text-etat-critique-texte", bg: "bg-etat-critique-fond", border: "border-etat-critique-filet" },
              { label: "Élevées",   val: summary.high,     color: "text-etat-alerte-texte", bg: "bg-etat-alerte-fond", border: "border-etat-alerte-filet" },
              { label: "Moyennes",  val: summary.medium,   color: "text-etat-alerte-texte", bg: "bg-etat-alerte-fond", border: "border-etat-alerte-filet" },
              { label: "Faibles",   val: summary.low,      color: "text-etat-nominal-texte", bg: "bg-etat-nominal-fond", border: "border-etat-nominal-filet" },
            ].map(({ label, val, color, bg, border }) => (
              <div key={label} className={`${bg} border ${border} rounded-none p-4 text-center`}>
                <div className={`text-2xl font-bold ${color}`}>{val}</div>
                <div className="text-xs text-ink-mute mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Cost if Ignored Banner ───────────────────────────── */}
        {summary && summary.estimatedCostIfIgnored > 0 && (
          <div className="mb-6 bg-etat-alerte-fond border border-etat-alerte-filet rounded-none p-4 flex items-start gap-3">
            <DollarSign className="w-5 h-5 text-etat-alerte-texte flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-etat-alerte-texte">Coût estimé si non traité</div>
              <div className="text-xs text-etat-alerte-texte mt-0.5">
                Les recommandations critiques et élevées non traitées pourraient générer jusqu'à{" "}
                <span className="font-bold text-etat-alerte-texte">{summary.estimatedCostIfIgnored.toLocaleString("fr-FR")} €</span>
                {" "}de maintenance corrective (3,5× le coût préventif estimé).
              </div>
            </div>
          </div>
        )}

        {/* ── Filters ─────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
            <Input
              className="pl-9 rounded-none border-rule"
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
                className={`px-3 py-2 rounded-none text-xs font-medium border transition-all ${filterPriority === p ? "bg-etat-encours-vif text-white border-etat-encours-filet" : "bg-white text-ink-soft border-rule hover:border-rule"}`}
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
                className={`px-3 py-2 rounded-none text-xs font-medium border transition-all ${filterType === t ? "bg-signal-deep text-white border-rule" : "bg-white text-ink-soft border-rule hover:border-rule"}`}
              >
                {t === "all" ? "Tout type" : TYPE_CONFIG[t]?.label || t}
              </button>
            ))}
          </div>
        </div>

        {/* ── Recommendations ─────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-etat-nominal-fond border border-etat-nominal-filet rounded-none flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-etat-nominal-texte" />
            </div>
            <h3 className="text-lg font-semibold text-ink-soft mb-2">
              {recommendations.length === 0 ? "Aucune recommandation générée" : "Aucun résultat"}
            </h3>
            <p className="text-ink-mute text-sm max-w-md mx-auto">
              {recommendations.length === 0
                ? "Tous vos équipements semblent à jour. Ajoutez des équipements et des historiques d'OT pour obtenir des recommandations personnalisées."
                : "Essayez de modifier vos filtres de recherche."}
            </p>
            {recommendations.length === 0 && (
              <Link href="/equipment-management">
                <Button className="mt-4 bg-etat-encours-vif hover:bg-etat-encours-vif rounded-none">
                  <Wrench className="w-4 h-4 mr-2" />
                  Gérer les équipements
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <Tabs defaultValue="all" className="space-y-6">
            <TabsList className="bg-white border border-rule rounded-none p-1">
              <TabsTrigger value="all" className="rounded-lg text-xs">
                Toutes ({filtered.length})
              </TabsTrigger>
              {criticalRecs.length > 0 && (
                <TabsTrigger value="critical" className="rounded-lg text-xs text-etat-critique-texte">
                  Critiques ({criticalRecs.length})
                </TabsTrigger>
              )}
              {highRecs.length > 0 && (
                <TabsTrigger value="high" className="rounded-lg text-xs text-etat-alerte-texte">
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
          <div className="mt-10 bg-paper border border-rule rounded-none p-4 flex flex-wrap gap-4 text-xs text-ink-mute">
            <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" />
              Équipements analysés : <strong className="text-ink-soft">{meta?.equipmentAnalyzed}</strong>
            </span>
            <span className="flex items-center gap-1.5"><ClipboardList className="w-3.5 h-3.5" />
              OT analysés : <strong className="text-ink-soft">{meta?.workOrdersAnalyzed}</strong>
            </span>
            <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />
              Plans consultés : <strong className="text-ink-soft">{meta?.plansAnalyzed}</strong>
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

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity, Database, Cpu, HardDrive, Server, CheckCircle2,
  AlertTriangle, XCircle, RefreshCw, Code2, Layers, Clock,
  MemoryStick, Package, ShieldOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { auMoins } from "@shared/roles";

interface HealthData {
  overall: "healthy" | "warning" | "degraded" | "error";
  timestamp: string;
  version: string;
  environment: string;
  database: {
    status: string;
    latencyMs: number;
    tables: Record<string, number | string>;
  };
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    uptime: number;
    memory: { totalMb: number; usedMb: number; freeMb: number; usedPct: number };
    cpu: { model: string; cores: number; loadAvg1m: number };
  };
  codebase: {
    serverFiles: number;
    clientFiles: number;
    sharedFiles: number;
    totalFiles: number;
    pdfGenerators: number;
    excelProcessors: number;
    routeModules: number;
  };
  modules: Array<{ id: string; name: string; status: string }>;
}

function OverallBadge({ status }: { status: string }) {
  if (status === "healthy") return (
    <Badge className="bg-emerald-500 text-white gap-1 px-3 py-1 text-sm">
      <CheckCircle2 className="h-4 w-4" /> Opérationnel
    </Badge>
  );
  if (status === "warning") return (
    <Badge className="bg-amber-500 text-white gap-1 px-3 py-1 text-sm">
      <AlertTriangle className="h-4 w-4" /> Avertissement
    </Badge>
  );
  return (
    <Badge className="bg-red-500 text-white gap-1 px-3 py-1 text-sm">
      <XCircle className="h-4 w-4" /> Dégradé
    </Badge>
  );
}

function formatUptime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}min`;
}

const TABLE_LABELS: Record<string, string> = {
  equipment: "Équipements",
  work_orders: "Ordres de travail",
  oee_records: "Mesures OEE",
  rca_analyses: "Analyses RCA",
  fmea_analyses: "Analyses FMEA",
  assets: "Actifs",
  budgets: "Budgets",
  calibrations: "Calibrations",
  maintenance_cases: "Cas historiques",
  alerts: "Alertes",
  iot_data: "Données IoT",
  db_size: "Taille base",
};

export default function SystemHealthPage() {
  const { user } = useAuth();
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery<HealthData>({
    queryKey: ["/api/system/health"],
    refetchInterval: 30000,
    enabled: auMoins(user?.role, 'admin'),
  });

  // `owner` — le compte principal de chaque organisation — est HIÉRARCHIQUEMENT
  // au-dessus d'`admin`, mais la comparaison littérale le refusait. `auMoins`
  // compare par niveau et rattrape au passage les valeurs héritées en base.
  if (!auMoins(user?.role, 'admin')) {
    return (
      <div className="min-h-screen bg-paper-deep flex items-center justify-center">
        <div className="text-center space-y-4">
          <ShieldOff className="h-16 w-16 text-red-600 mx-auto" />
          <h2 className="text-2xl font-bold text-ink">Accès refusé</h2>
          <p className="text-ink-mute max-w-sm mx-auto">
            Cette page est réservée aux administrateurs de la plateforme.
          </p>
          <Link href="/">
            <Button variant="outline" className="border-rule text-ink-soft hover:bg-paper-deep mt-2">
              Retour à l'accueil
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-deep p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
              <Activity className="h-7 w-7 text-signal" />
              Santé du Système
            </h1>
            <p className="text-ink-mute mt-1">
              Surveillance en temps réel de la plateforme Maintrix
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data && <OverallBadge status={data.overall} />}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="border-rule text-ink-soft hover:bg-paper-deep"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Rafraîchir
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-48">
            <div className="text-ink-mute flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Chargement des métriques...
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-2 text-ink-mute text-sm mb-1">
                    <Server className="h-4 w-4" /> Version
                  </div>
                  <div className="text-ink font-semibold">{data.version}</div>
                  <div className="text-ink-mute text-xs">{data.environment}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-2 text-ink-mute text-sm mb-1">
                    <Clock className="h-4 w-4" /> Uptime
                  </div>
                  <div className="text-ink font-semibold">{formatUptime(data.system.uptime)}</div>
                  <div className="text-ink-mute text-xs">Node {data.system.nodeVersion}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-2 text-ink-mute text-sm mb-1">
                    <Database className="h-4 w-4" /> Base de données
                  </div>
                  <div className={`font-semibold ${data.database.status === "ok" ? "text-emerald-700" : "text-red-600"}`}>
                    {data.database.status === "ok" ? "Connectée" : "Erreur"}
                  </div>
                  <div className="text-ink-mute text-xs">{data.database.latencyMs}ms latence</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-center gap-2 text-ink-mute text-sm mb-1">
                    <MemoryStick className="h-4 w-4" /> Mémoire
                  </div>
                  <div className="text-ink font-semibold">{data.system.memory.usedPct}%</div>
                  <div className="text-ink-mute text-xs">
                    {data.system.memory.usedMb} / {data.system.memory.totalMb} Mo
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* System resources */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-ink text-base flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-signal" /> Ressources système
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-ink-mute">Mémoire utilisée</span>
                      <span className="text-ink">{data.system.memory.usedPct}%</span>
                    </div>
                    <Progress
                      value={data.system.memory.usedPct}
                      className="h-2"
                    />
                    <div className="text-ink-mute text-xs mt-1">
                      {data.system.memory.usedMb} Mo utilisés / {data.system.memory.totalMb} Mo total
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-ink-mute">Charge CPU (1 min)</span>
                      <span className="text-ink">{data.system.cpu.loadAvg1m}</span>
                    </div>
                    <Progress
                      value={Math.min(data.system.cpu.loadAvg1m * 100 / data.system.cpu.cores, 100)}
                      className="h-2"
                    />
                    <div className="text-ink-mute text-xs mt-1">
                      {data.system.cpu.cores} cœurs — {data.system.cpu.model.substring(0, 40)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-paper-deep border border-rule rounded-lg p-3">
                      <div className="text-ink-mute text-xs">Plateforme</div>
                      <div className="text-ink text-sm font-medium capitalize">{data.system.platform} ({data.system.arch})</div>
                    </div>
                    <div className="bg-paper-deep border border-rule rounded-lg p-3">
                      <div className="text-ink-mute text-xs">Uptime</div>
                      <div className="text-ink text-sm font-medium">{formatUptime(data.system.uptime)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Database tables */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-ink text-base flex items-center gap-2">
                    <Database className="h-5 w-5 text-signal" /> État des données
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(data.database.tables ?? {}).map(([key, val]) => (
                      <div key={key} className="bg-paper-deep border border-rule rounded-lg p-2.5 flex justify-between items-center">
                        <span className="text-ink-mute text-xs">{TABLE_LABELS[key] ?? key}</span>
                        <span className="text-ink text-sm font-semibold">
                          {typeof val === "number" ? val.toLocaleString("fr-FR") : val}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Codebase quality metrics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-ink text-base flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-cyan-700" /> Métriques de la base de code
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[
                    { label: "Fichiers serveur", value: data.codebase.serverFiles, icon: Server, color: "text-signal" },
                    { label: "Fichiers frontend", value: data.codebase.clientFiles, icon: Layers, color: "text-signal-deep" },
                    { label: "Fichiers partagés", value: data.codebase.sharedFiles, icon: Package, color: "text-amber-700" },
                    { label: "Total fichiers", value: data.codebase.totalFiles, icon: HardDrive, color: "text-ink-mute" },
                    { label: "Modules routes", value: data.codebase.routeModules, icon: Activity, color: "text-emerald-700" },
                    { label: "Gén. PDF actifs", value: data.codebase.pdfGenerators, icon: Code2, color: "text-cyan-700" },
                    { label: "Process. Excel", value: data.codebase.excelProcessors, icon: Code2, color: "text-green-700" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-paper-deep border border-rule rounded-xl p-3 text-center">
                      <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
                      <div className="text-ink font-bold text-lg">{value}</div>
                      <div className="text-ink-mute text-xs leading-tight">{label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Module status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-ink text-base flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                  Modules actifs ({data.modules.filter(m => m.status === "active").length}/{data.modules.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {data.modules.map((mod) => (
                    <div
                      key={mod.id}
                      className="flex items-center gap-3 bg-paper-deep border border-rule rounded-lg px-3 py-2"
                    >
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                        mod.status === "active" ? "bg-emerald-600" :
                        mod.status === "warning" ? "bg-amber-600" : "bg-red-600"
                      }`} />
                      <span className="text-ink-soft text-sm">{mod.name}</span>
                      <Badge
                        variant="outline"
                        className={`ml-auto text-xs py-0 ${
                          mod.status === "active"
                            ? "border-emerald-600 text-emerald-700"
                            : "border-amber-600 text-amber-700"
                        }`}
                      >
                        {mod.status === "active" ? "Actif" : "Avertissement"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="text-center text-ink-mute text-xs">
              Dernière mise à jour : {new Date(dataUpdatedAt).toLocaleString("fr-FR")}
              {" · "}
              Rafraîchissement automatique toutes les 30 secondes
            </div>
          </>
        )}
      </div>
    </div>
  );
}

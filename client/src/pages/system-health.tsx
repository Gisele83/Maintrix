import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity, Database, Cpu, HardDrive, Server, CheckCircle2,
  AlertTriangle, XCircle, RefreshCw, Code2, Layers, Clock,
  MemoryStick, Package
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery<HealthData>({
    queryKey: ["/api/system/health"],
    refetchInterval: 30000,
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Activity className="h-7 w-7 text-blue-400" />
              Santé du Système
            </h1>
            <p className="text-slate-400 mt-1">
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
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Rafraîchir
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center h-48">
            <div className="text-slate-400 flex items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Chargement des métriques...
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-slate-800/60 border-slate-700">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <Server className="h-4 w-4" /> Version
                  </div>
                  <div className="text-white font-semibold">{data.version}</div>
                  <div className="text-slate-500 text-xs">{data.environment}</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/60 border-slate-700">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <Clock className="h-4 w-4" /> Uptime
                  </div>
                  <div className="text-white font-semibold">{formatUptime(data.system.uptime)}</div>
                  <div className="text-slate-500 text-xs">Node {data.system.nodeVersion}</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/60 border-slate-700">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <Database className="h-4 w-4" /> Base de données
                  </div>
                  <div className={`font-semibold ${data.database.status === "ok" ? "text-emerald-400" : "text-red-400"}`}>
                    {data.database.status === "ok" ? "Connectée" : "Erreur"}
                  </div>
                  <div className="text-slate-500 text-xs">{data.database.latencyMs}ms latence</div>
                </CardContent>
              </Card>
              <Card className="bg-slate-800/60 border-slate-700">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <MemoryStick className="h-4 w-4" /> Mémoire
                  </div>
                  <div className="text-white font-semibold">{data.system.memory.usedPct}%</div>
                  <div className="text-slate-500 text-xs">
                    {data.system.memory.usedMb} / {data.system.memory.totalMb} Mo
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* System resources */}
              <Card className="bg-slate-800/60 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-blue-400" /> Ressources système
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">Mémoire utilisée</span>
                      <span className="text-white">{data.system.memory.usedPct}%</span>
                    </div>
                    <Progress
                      value={data.system.memory.usedPct}
                      className="h-2"
                    />
                    <div className="text-slate-500 text-xs mt-1">
                      {data.system.memory.usedMb} Mo utilisés / {data.system.memory.totalMb} Mo total
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-400">Charge CPU (1 min)</span>
                      <span className="text-white">{data.system.cpu.loadAvg1m}</span>
                    </div>
                    <Progress
                      value={Math.min(data.system.cpu.loadAvg1m * 100 / data.system.cpu.cores, 100)}
                      className="h-2"
                    />
                    <div className="text-slate-500 text-xs mt-1">
                      {data.system.cpu.cores} cœurs — {data.system.cpu.model.substring(0, 40)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-slate-400 text-xs">Plateforme</div>
                      <div className="text-white text-sm font-medium capitalize">{data.system.platform} ({data.system.arch})</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="text-slate-400 text-xs">Uptime</div>
                      <div className="text-white text-sm font-medium">{formatUptime(data.system.uptime)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Database tables */}
              <Card className="bg-slate-800/60 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Database className="h-5 w-5 text-purple-400" /> État des données
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(data.database.tables ?? {}).map(([key, val]) => (
                      <div key={key} className="bg-slate-900/50 rounded-lg p-2.5 flex justify-between items-center">
                        <span className="text-slate-400 text-xs">{TABLE_LABELS[key] ?? key}</span>
                        <span className="text-white text-sm font-semibold">
                          {typeof val === "number" ? val.toLocaleString("fr-FR") : val}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Codebase quality metrics */}
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Code2 className="h-5 w-5 text-cyan-400" /> Métriques de la base de code
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {[
                    { label: "Fichiers serveur", value: data.codebase.serverFiles, icon: Server, color: "text-blue-400" },
                    { label: "Fichiers frontend", value: data.codebase.clientFiles, icon: Layers, color: "text-purple-400" },
                    { label: "Fichiers partagés", value: data.codebase.sharedFiles, icon: Package, color: "text-amber-400" },
                    { label: "Total fichiers", value: data.codebase.totalFiles, icon: HardDrive, color: "text-slate-300" },
                    { label: "Modules routes", value: data.codebase.routeModules, icon: Activity, color: "text-emerald-400" },
                    { label: "Gén. PDF actifs", value: data.codebase.pdfGenerators, icon: Code2, color: "text-cyan-400" },
                    { label: "Process. Excel", value: data.codebase.excelProcessors, icon: Code2, color: "text-green-400" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-slate-900/50 rounded-xl p-3 text-center">
                      <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
                      <div className="text-white font-bold text-lg">{value}</div>
                      <div className="text-slate-500 text-xs leading-tight">{label}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Module status */}
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  Modules actifs ({data.modules.filter(m => m.status === "active").length}/{data.modules.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {data.modules.map((mod) => (
                    <div
                      key={mod.id}
                      className="flex items-center gap-3 bg-slate-900/40 rounded-lg px-3 py-2"
                    >
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                        mod.status === "active" ? "bg-emerald-400" :
                        mod.status === "warning" ? "bg-amber-400" : "bg-red-400"
                      }`} />
                      <span className="text-slate-300 text-sm">{mod.name}</span>
                      <Badge
                        variant="outline"
                        className={`ml-auto text-xs py-0 ${
                          mod.status === "active"
                            ? "border-emerald-700 text-emerald-400"
                            : "border-amber-700 text-amber-400"
                        }`}
                      >
                        {mod.status === "active" ? "Actif" : "Avertissement"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="text-center text-slate-600 text-xs">
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

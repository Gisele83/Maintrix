import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import {
  Factory, Wrench, CheckCircle, Clock, AlertTriangle,
  Shield, Activity, MapPin, Eye, Copy, ExternalLink,
  BarChart3, RefreshCw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const statusColors: Record<string, string> = {
  operational: "bg-green-500/10 text-green-500 border-green-500/30",
  maintenance: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  offline: "bg-red-500/10 text-red-500 border-red-500/30",
  decommissioned: "bg-gray-500/10 text-gray-500 border-gray-500/30"
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400",
  high: "bg-orange-500/10 text-orange-400",
  medium: "bg-yellow-500/10 text-yellow-400",
  low: "bg-blue-500/10 text-blue-400"
};

const statusLabels: Record<string, string> = {
  operational: "Opérationnel",
  maintenance: "En maintenance",
  offline: "Hors service",
  decommissioned: "Décommissionné",
  pending: "En attente",
  in_progress: "En cours",
  completed: "Terminé",
  cancelled: "Annulé"
};

function PortalView({ token }: { token: string }) {
  const { data, isLoading, error, refetch } = useQuery<any>({
    queryKey: ['/api/client-portal', token],
    queryFn: () => fetch(`/api/client-portal/${token}`).then(r => r.json()),
    refetchInterval: 30000
  });

  if (isLoading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center">
      <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center">
      <Card className="bg-slate-900/80 border-red-500/30 max-w-md">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400">Lien du portail invalide ou expiré.</p>
        </CardContent>
      </Card>
    </div>
  );

  const operationalCount = data.equipment?.filter((e: any) => e.status === 'operational').length || 0;
  const operationalRate = data.totalEquipment ? Math.round((operationalCount / data.totalEquipment) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <div className="border-b border-white/10 bg-slate-900/60 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Maintrix - Portail Client</h1>
              <p className="text-xs text-slate-400">Suivi de maintenance en temps réel</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-white/20 text-slate-300">
            <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { icon: Factory, label: "Équipements", value: data.totalEquipment, color: "from-blue-500 to-cyan-500" },
            { icon: Wrench, label: "OT actifs", value: data.activeWorkOrders, color: "from-orange-500 to-amber-500" },
            { icon: CheckCircle, label: "OT terminés", value: data.completedWorkOrders, color: "from-green-500 to-emerald-500" },
            { icon: Activity, label: "Taux opérationnel", value: `${operationalRate}%`, color: "from-purple-500 to-violet-500" }
          ].map((stat, i) => (
            <Card key={i} className="bg-slate-900/60 border-white/10 backdrop-blur-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shrink-0`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-slate-400">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-900/60 border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Factory className="w-5 h-5 text-blue-400" />
                État des Équipements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.equipment?.map((eq: any) => (
                <div key={eq.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${eq.status === 'operational' ? 'bg-green-500' : eq.status === 'maintenance' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                    <div>
                      <p className="text-sm font-medium text-white">{eq.name}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {eq.location || 'N/A'} · {eq.type}
                      </p>
                    </div>
                  </div>
                  <Badge className={statusColors[eq.status] || "bg-gray-500/10 text-gray-400"}>
                    {statusLabels[eq.status] || eq.status}
                  </Badge>
                </div>
              ))}
              {(!data.equipment || data.equipment.length === 0) && (
                <p className="text-sm text-slate-500 text-center py-4">Aucun équipement</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-900/60 border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-orange-400" />
                Ordres de Travail Récents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.recentWorkOrders?.map((wo: any) => (
                <div key={wo.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-white/5">
                  <div>
                    <p className="text-sm font-medium text-white">{wo.title}</p>
                    <p className="text-xs text-slate-400">
                      {wo.orderType} · {new Date(wo.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={priorityColors[wo.priority] || "bg-gray-500/10"}>
                      {wo.priority}
                    </Badge>
                    <Badge variant="outline" className="text-slate-300 border-white/20">
                      {statusLabels[wo.status] || wo.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {(!data.recentWorkOrders || data.recentWorkOrders.length === 0) && (
                <p className="text-sm text-slate-500 text-center py-4">Aucun ordre de travail</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-slate-900/60 border-white/10 backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-300">Taux de disponibilité global</p>
              <p className="text-sm font-bold text-white">{operationalRate}%</p>
            </div>
            <Progress value={operationalRate} className="h-3" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PortalAdmin() {
  const [generatedToken, setGeneratedToken] = useState("");
  const { toast } = useToast();

  const generateToken = async () => {
    try {
      const data = await apiRequest("/api/client-portal/generate-token", { method: "POST" });
      setGeneratedToken(data.token);
      toast({ title: "Lien portail généré", description: "Partagez ce lien avec votre client." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de générer le lien", variant: "destructive" });
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/client-portal/${generatedToken}`);
    toast({ title: "Copié", description: "Lien copié dans le presse-papier" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
            <ExternalLink className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Portail Client</h1>
            <p className="text-slate-400">Créez un lien de suivi pour vos clients</p>
          </div>
        </div>

        <Card className="bg-slate-900/60 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">Générer un lien d'accès client</CardTitle>
            <CardDescription className="text-slate-400">
              Vos clients pourront consulter l'état de leurs équipements et le suivi des interventions sans avoir besoin d'un compte.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={generateToken} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
              <Shield className="w-4 h-4 mr-2" /> Générer un lien sécurisé
            </Button>

            {generatedToken && (
              <div className="space-y-3 p-4 bg-slate-800/50 rounded-lg border border-white/10">
                <p className="text-sm text-slate-300 font-medium">Lien du portail client :</p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/client-portal/${generatedToken}`}
                    className="bg-slate-900/50 border-white/20 text-white text-sm"
                  />
                  <Button variant="outline" size="icon" onClick={copyLink} className="border-white/20 shrink-0">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="border-white/20 text-slate-300" onClick={() => window.open(`/client-portal/${generatedToken}`, '_blank')}>
                    <Eye className="w-4 h-4 mr-2" /> Prévisualiser
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {[
                { icon: Factory, title: "Suivi équipements", desc: "État en temps réel de tous les équipements" },
                { icon: Wrench, title: "Suivi interventions", desc: "Historique et statut des ordres de travail" },
                { icon: BarChart3, title: "KPIs & rapports", desc: "Taux de disponibilité et indicateurs clés" }
              ].map((feature, i) => (
                <Card key={i} className="bg-slate-800/30 border-white/5">
                  <CardContent className="p-4 text-center">
                    <feature.icon className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-white">{feature.title}</p>
                    <p className="text-xs text-slate-400 mt-1">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ClientPortalPage() {
  const [, params] = useRoute("/client-portal/:token");
  
  if (params?.token) {
    return <PortalView token={params.token} />;
  }
  
  return <PortalAdmin />;
}

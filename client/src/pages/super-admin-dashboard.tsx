import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { 
  Shield, 
  Building2, 
  Users, 
  Database, 
  Brain, 
  Settings, 
  LogOut,
  Plus,
  Activity,
  TrendingUp,
  Lock,
  Mail
} from "lucide-react";

interface SuperAdminUser {
  id: string;
  email: string;
  role: string;
}

interface Tenant {
  id: string;
  name: string;
  domain: string;
  status: string;
  createdAt: string;
  userCount: number;
  lastActivity: string;
}

interface FederatedStats {
  id: number;
  tenant_id: string;
  contribution_type: string;
  data_points: number;
  accuracy_improvement: number;
  timestamp: string;
}

export default function SuperAdminDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [superAdminUser, setSuperAdminUser] = useState<SuperAdminUser | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('superAdminToken');
    const user = localStorage.getItem('superAdminUser');
    
    if (!token || !user) {
      navigate('/admin-login');
      return;
    }
    
    try {
      setSuperAdminUser(JSON.parse(user));
    } catch {
      navigate('/admin-login');
    }
  }, [navigate]);

  // Récupérer les tenants
  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['/api/super-admin/tenants'],
    enabled: !!superAdminUser
  });

  // Récupérer les stats d'apprentissage fédéré
  const { data: federatedStats = [], isLoading: statsLoading } = useQuery({
    queryKey: ['/api/super-admin/federated-stats'],
    enabled: !!superAdminUser
  });

  const logout = () => {
    localStorage.removeItem('superAdminToken');
    localStorage.removeItem('superAdminUser');
    navigate('/admin-login');
    toast({
      title: "Déconnexion",
      description: "Vous êtes déconnecté de l'interface d'administration",
    });
  };

  const createTenantMutation = useMutation({
    mutationFn: async (tenantData: { name: string; domain: string }) => {
      return apiRequest("POST", "/api/super-admin/tenants", tenantData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/tenants'] });
      toast({
        title: "Tenant créé",
        description: "Le nouveau tenant a été créé avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer le tenant",
        variant: "destructive",
      });
    }
  });

  if (!superAdminUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Administration Plateforme</h1>
                <p className="text-sm text-gray-400">Gestion multi-tenant SaaS</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-medium text-white">{superAdminUser.email}</div>
                <div className="text-xs text-gray-400">Super Administrateur</div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={logout}
                className="bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="tenants" className="space-y-6">
          <TabsList className="bg-black/20 backdrop-blur-xl border-white/10">
            <TabsTrigger value="tenants" className="data-[state=active]:bg-purple-600">
              <Building2 className="w-4 h-4 mr-2" />
              Tenants
            </TabsTrigger>
            <TabsTrigger value="federated" className="data-[state=active]:bg-purple-600">
              <Brain className="w-4 h-4 mr-2" />
              IA Fédérée
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-purple-600">
              <Lock className="w-4 h-4 mr-2" />
              Sécurité
            </TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-purple-600">
              <Mail className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
          </TabsList>

          {/* Gestion des Tenants */}
          <TabsContent value="tenants" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">Gestion des Tenants</h2>
              <Button 
                onClick={() => {
                  const name = prompt("Nom du tenant:");
                  const domain = prompt("Domaine du tenant:");
                  if (name && domain) {
                    createTenantMutation.mutate({ name, domain });
                  }
                }}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouveau Tenant
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tenantsLoading ? (
                <div className="text-white">Chargement...</div>
              ) : (
                tenants.map((tenant: Tenant) => (
                  <Card key={tenant.id} className="bg-white/5 backdrop-blur-xl border-white/10">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-white">{tenant.name}</CardTitle>
                        <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                          {tenant.status}
                        </Badge>
                      </div>
                      <CardDescription className="text-gray-400">
                        {tenant.domain}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-gray-300">
                          <span>Utilisateurs:</span>
                          <span>{tenant.userCount || 0}</span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                          <span>Créé:</span>
                          <span>{new Date(tenant.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                          <span>Dernière activité:</span>
                          <span>{tenant.lastActivity || 'N/A'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* IA Fédérée */}
          <TabsContent value="federated" className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Intelligence Artificielle Fédérée</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-white/5 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Contributions Totales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-400">
                    {federatedStats.reduce((sum: number, stat: FederatedStats) => sum + stat.data_points, 0)}
                  </div>
                  <p className="text-gray-400">Points de données</p>
                </CardContent>
              </Card>
              
              <Card className="bg-white/5 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Amélioration Moyenne
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-400">
                    {((federatedStats.reduce((sum: number, stat: FederatedStats) => sum + stat.accuracy_improvement, 0) / Math.max(federatedStats.length, 1)) * 100).toFixed(1)}%
                  </div>
                  <p className="text-gray-400">Précision IA</p>
                </CardContent>
              </Card>
              
              <Card className="bg-white/5 backdrop-blur-xl border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    Tenants Actifs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-400">
                    {new Set(federatedStats.map((stat: FederatedStats) => stat.tenant_id)).size}
                  </div>
                  <p className="text-gray-400">Contributeurs</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white/5 backdrop-blur-xl border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Détail des Contributions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {federatedStats.map((stat: FederatedStats) => (
                    <div key={stat.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                      <div>
                        <div className="text-white font-medium">{stat.tenant_id}</div>
                        <div className="text-gray-400 text-sm">{stat.contribution_type}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-white">{stat.data_points} points</div>
                        <div className="text-green-400 text-sm">+{(stat.accuracy_improvement * 100).toFixed(2)}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sécurité */}
          <TabsContent value="security" className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Sécurité Plateforme</h2>
            <Card className="bg-white/5 backdrop-blur-xl border-white/10">
              <CardContent className="p-6">
                <div className="text-center text-gray-400">
                  <Lock className="w-12 h-12 mx-auto mb-4" />
                  <p>Fonctionnalités de sécurité en développement</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Système de Notifications</h2>
            <Card className="bg-white/5 backdrop-blur-xl border-white/10">
              <CardContent className="p-6">
                <div className="text-center text-gray-400">
                  <Mail className="w-12 h-12 mx-auto mb-4" />
                  <p>Centre de notifications en développement</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
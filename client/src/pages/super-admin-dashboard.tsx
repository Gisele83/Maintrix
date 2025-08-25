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
  Mail,
  Trash2
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

interface SuperAdminTenant {
  id: string;
  name: string;
  domain: string | null;
  plan: string;
  isActive: boolean;
  maxUsers: number;
  currentUsers: number;
  userCount: number;
  lastActivity: string;
  createdAt: string;
}

interface FederatedStats {
  id: string;
  tenantId: string | null;
  patternHash: string;
  equipmentCategory: string;
  solutionEffectiveness: number | null;
  contributionWeight: number | null;
  lastUpdated: Date | null;
  createdAt: Date | null;
}

export default function SuperAdminDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [superAdminUser, setSuperAdminUser] = useState<SuperAdminUser | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('superAdminToken');
    const user = localStorage.getItem('superAdminUser');
    
    if (!token || !user) {
      setLocation('/admin-login');
      return;
    }
    
    try {
      setSuperAdminUser(JSON.parse(user));
    } catch {
      setLocation('/admin-login');
    }
  }, [setLocation]);

  // Récupérer les tenants
  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<SuperAdminTenant[]>({
    queryKey: ['/api/super-admin/tenants'],
    enabled: !!superAdminUser
  });

  // Récupérer les stats d'apprentissage fédéré (temporairement désactivé)
  const { data: federatedStats = [], isLoading: statsLoading } = useQuery<FederatedStats[]>({
    queryKey: ['/api/super-admin/federated-stats'],
    enabled: false // Temporairement désactivé
  });

  const logout = () => {
    localStorage.removeItem('superAdminToken');
    localStorage.removeItem('superAdminUser');
    setLocation('/admin-login');
    toast({
      title: "Déconnexion",
      description: "Vous êtes déconnecté de l'interface d'administration",
    });
  };

  const createTenantMutation = useMutation({
    mutationFn: async (tenantData: { name: string; domain: string }) => {
      return await apiRequest("/api/super-admin/tenants", { method: "POST", body: tenantData });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/tenants'] });
      toast({
        title: "Tenant créé",
        description: `Le tenant "${data.tenant.name}" a été créé avec succès`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le tenant",
        variant: "destructive",
      });
    }
  });

  const updateTenantStatusMutation = useMutation({
    mutationFn: async ({ tenantId, isActive, reason }: { tenantId: string; isActive: boolean; reason?: string }) => {
      return await apiRequest(`/api/super-admin/tenants/${tenantId}/status`, { 
        method: "PATCH", 
        body: { isActive, reason } 
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/tenants'] });
      toast({
        title: data.message,
        description: `Statut mis à jour avec succès`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le statut",
        variant: "destructive",
      });
    }
  });

  const deleteTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      return await apiRequest(`/api/super-admin/tenants/${tenantId}`, { method: "DELETE" });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/tenants'] });
      toast({
        title: "Tenant supprimé",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le tenant",
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
                  const domain = prompt("Domaine du tenant (optionnel):");
                  if (name) {
                    createTenantMutation.mutate({ name, domain: domain || `${name.toLowerCase().replace(/\s+/g, '-')}.example.com` });
                  }
                }}
                disabled={createTenantMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouveau Tenant
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tenantsLoading ? (
                <div className="text-white">Chargement...</div>
              ) : (
                tenants.map((tenant: SuperAdminTenant) => (
                  <Card key={tenant.id} className="bg-white/5 backdrop-blur-xl border-white/10">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-white">{tenant.name}</CardTitle>
                        <Badge variant={tenant.isActive ? 'default' : 'secondary'}>
                          {tenant.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                      <CardDescription className="text-gray-400">
                        {tenant.domain || tenant.plan || 'Aucun domaine'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between text-gray-300">
                          <span>Utilisateurs:</span>
                          <span>{tenant.currentUsers || tenant.userCount || 0}/{tenant.maxUsers}</span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                          <span>Créé:</span>
                          <span>{new Date(tenant.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                          <span>Plan:</span>
                          <span className="capitalize">{tenant.plan}</span>
                        </div>
                        <div className="flex justify-between text-gray-300">
                          <span>Dernière activité:</span>
                          <span>{new Date(tenant.lastActivity).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      {/* Actions Admin */}
                      <div className="flex gap-2 mt-4 pt-4 border-t border-white/10">
                        <Button
                          size="sm"
                          variant={tenant.isActive ? "destructive" : "default"}
                          onClick={() => {
                            const action = tenant.isActive ? "désactiver" : "réactiver";
                            const reason = tenant.isActive ? prompt("Raison de la désactivation (optionnel):") : undefined;
                            
                            if (confirm(`Voulez-vous vraiment ${action} le tenant "${tenant.name}" ?`)) {
                              updateTenantStatusMutation.mutate({
                                tenantId: tenant.id,
                                isActive: !tenant.isActive,
                                reason: reason || undefined
                              });
                            }
                          }}
                          disabled={updateTenantStatusMutation.isPending}
                          className="flex-1"
                        >
                          {tenant.isActive ? "Désactiver" : "Réactiver"}
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (confirm(`⚠️ ATTENTION: Supprimer définitivement le tenant "${tenant.name}" ?\n\nCette action est IRRÉVERSIBLE et supprimera toutes les données associées.`)) {
                              deleteTenantMutation.mutate(tenant.id);
                            }
                          }}
                          disabled={deleteTenantMutation.isPending}
                          className="px-3"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
                    {federatedStats.length}
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
                    {((federatedStats.reduce((sum: number, stat: FederatedStats) => sum + (stat.solutionEffectiveness || 0), 0) / Math.max(federatedStats.length, 1)) * 100).toFixed(1)}%
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
                    {new Set(federatedStats.map((stat: FederatedStats) => stat.tenantId)).size}
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
                        <div className="text-white font-medium">{stat.tenantId || 'N/A'}</div>
                        <div className="text-gray-400 text-sm">{stat.equipmentCategory}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-white">{(stat.solutionEffectiveness || 0).toFixed(2)}</div>
                        <div className="text-gray-400 text-sm">Efficacité</div>
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
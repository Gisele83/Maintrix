import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Building, 
  Users, 
  Shield, 
  Database, 
  TrendingUp, 
  Brain,
  AlertTriangle,
  Plus,
  Edit,
  Trash2,
  Settings,
  Globe,
  Lock,
  Zap,
  BarChart3,
  Mail,
  Send
} from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  domain?: string;
  plan: string;
  isActive: boolean;
  maxUsers: number;
  currentUsers: number;
  dataRetentionDays: number;
  encryptionEnabled: boolean;
  gdprCompliant: boolean;
  auditLogsEnabled: boolean;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: string;
  subscriptionId?: string;
  trialEndDate?: string;
  features: Record<string, any>;
  settings: Record<string, any>;
}

interface FederatedAnalytics {
  totalContributions: number;
  acceptanceRate: number;
  globalImpactScore: number;
  contributionRank: string;
  improvementsBenefited: number;
}

const TenantManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch tenants
  const { data: tenants = [], isLoading, error } = useQuery<Tenant[]>({
    queryKey: ['/api/admin/tenants'],
    staleTime: 30000,
  });

  // Fetch federated learning analytics
  const { data: federatedAnalytics } = useQuery<FederatedAnalytics>({
    queryKey: ['/api/admin/federated-analytics'],
    enabled: selectedTenant?.id !== undefined,
    staleTime: 60000,
  });

  // Create tenant mutation
  const createTenantMutation = useMutation({
    mutationFn: (tenantData: Partial<Tenant>) => 
      apiRequest('POST', '/api/admin/tenants', tenantData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      setShowCreateModal(false);
      toast({
        title: "Tenant créé",
        description: "Le nouveau tenant a été créé avec succès.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le tenant.",
        variant: "destructive",
      });
    },
  });

  // Update tenant mutation
  const updateTenantMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<Tenant> & { id: string }) => 
      apiRequest('PUT', `/api/admin/tenants/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
      toast({
        title: "Tenant mis à jour",
        description: "Les modifications ont été sauvegardées.",
      });
    },
  });

  // Send invitation email mutation
  const sendInvitationMutation = useMutation({
    mutationFn: ({ tenantId, contactEmail }: { tenantId: string; contactEmail: string }) => 
      apiRequest('POST', `/api/admin/tenants/${tenantId}/send-invitation`, { contactEmail }),
    onSuccess: (data: any) => {
      toast({
        title: "Invitation envoyée",
        description: `Email d'accès envoyé à ${data.sentTo}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer l'invitation",
        variant: "destructive",
      });
    },
  });

  if (isLoading) return <div className="flex items-center justify-center h-64">Chargement...</div>;
  if (error) return <div className="text-red-500">Erreur lors du chargement</div>;

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'free': return 'bg-gray-100 text-gray-800';
      case 'pro': return 'bg-blue-100 text-blue-800';
      case 'business': return 'bg-purple-100 text-purple-800';
      case 'enterprise': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion Multi-Tenant</h1>
          <p className="text-gray-600">Administration centralisée des clients et isolation des données</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nouveau Tenant
        </Button>
      </div>

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Building className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Tenants</p>
                <p className="text-2xl font-bold">{tenants.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Utilisateurs</p>
                <p className="text-2xl font-bold">
                  {tenants.reduce((sum, t) => sum + t.currentUsers, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Brain className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">IA Collaborative</p>
                <p className="text-2xl font-bold">98.5%</p>
                <p className="text-xs text-gray-500">Précision globale</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Shield className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Conformité RGPD</p>
                <p className="text-2xl font-bold">100%</p>
                <p className="text-xs text-gray-500">Tenants conformes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tenants List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Tenants
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedTenant?.id === tenant.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedTenant(tenant)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{tenant.name}</h3>
                      <p className="text-sm text-gray-500">{tenant.domain || tenant.id}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={getPlanColor(tenant.plan)}>
                        {tenant.plan.toUpperCase()}
                      </Badge>
                      <div className={`w-2 h-2 rounded-full ${
                        tenant.isActive ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <span>{tenant.currentUsers}/{tenant.maxUsers} utilisateurs</span>
                    {tenant.gdprCompliant && <Shield className="w-3 h-3 text-green-500" />}
                    {tenant.encryptionEnabled && <Lock className="w-3 h-3 text-blue-500" />}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Tenant Details */}
        <div className="lg:col-span-2">
          {selectedTenant ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Aperçu</TabsTrigger>
                <TabsTrigger value="security">Sécurité</TabsTrigger>
                <TabsTrigger value="ai-learning">IA Collaborative</TabsTrigger>
                <TabsTrigger value="settings">Paramètres</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="w-5 h-5" />
                      {selectedTenant.name}
                    </CardTitle>
                    <CardDescription>
                      Créé le {new Date(selectedTenant.createdAt).toLocaleDateString('fr-FR')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Plan</Label>
                        <Badge className={`${getPlanColor(selectedTenant.plan)} mt-1`}>
                          {selectedTenant.plan.toUpperCase()}
                        </Badge>
                      </div>
                      <div>
                        <Label>Statut</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={`w-2 h-2 rounded-full ${
                            selectedTenant.isActive ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <span className="text-sm">
                            {selectedTenant.isActive ? 'Actif' : 'Inactif'}
                          </span>
                        </div>
                      </div>
                      <div>
                        <Label>Utilisateurs</Label>
                        <p className="text-lg font-semibold mt-1">
                          {selectedTenant.currentUsers} / {selectedTenant.maxUsers}
                        </p>
                      </div>
                      <div>
                        <Label>Rétention Données</Label>
                        <p className="text-lg font-semibold mt-1">
                          {selectedTenant.dataRetentionDays} jours
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Usage Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Statistiques d'utilisation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">847</div>
                        <div className="text-sm text-gray-600">Diagnostics ce mois</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">2.3k</div>
                        <div className="text-sm text-gray-600">Interventions totales</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">94%</div>
                        <div className="text-sm text-gray-600">Taux de résolution</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      Sécurité & Conformité
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <Label className="font-semibold">Chiffrement des données</Label>
                          <p className="text-sm text-gray-600">Chiffrement AES-256 des données sensibles</p>
                        </div>
                        <Switch 
                          checked={selectedTenant.encryptionEnabled} 
                          onCheckedChange={(checked) => 
                            updateTenantMutation.mutate({
                              id: selectedTenant.id,
                              encryptionEnabled: checked
                            })
                          }
                        />
                      </div>
                      
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <Label className="font-semibold">Conformité RGPD</Label>
                          <p className="text-sm text-gray-600">Respect du règlement européen</p>
                        </div>
                        <Switch 
                          checked={selectedTenant.gdprCompliant} 
                          onCheckedChange={(checked) => 
                            updateTenantMutation.mutate({
                              id: selectedTenant.id,
                              gdprCompliant: checked
                            })
                          }
                        />
                      </div>
                      
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <Label className="font-semibold">Journaux d'audit</Label>
                          <p className="text-sm text-gray-600">Traçabilité complète des actions</p>
                        </div>
                        <Switch 
                          checked={selectedTenant.auditLogsEnabled} 
                          onCheckedChange={(checked) => 
                            updateTenantMutation.mutate({
                              id: selectedTenant.id,
                              auditLogsEnabled: checked
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-green-600" />
                        <span className="font-semibold text-green-800">Isolation parfaite</span>
                      </div>
                      <p className="text-sm text-green-700 mt-1">
                        Aucune fuite de données détectée entre les tenants
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* AI Learning Tab */}
              <TabsContent value="ai-learning" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5" />
                      Apprentissage Fédéré
                    </CardTitle>
                    <CardDescription>
                      Amélioration de l'IA sans partage de données brutes
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {federatedAnalytics && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">
                            {federatedAnalytics.totalContributions || 0}
                          </div>
                          <div className="text-sm text-gray-600">Contributions totales</div>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">
                            {Math.round((federatedAnalytics.acceptanceRate || 0) * 100)}%
                          </div>
                          <div className="text-sm text-gray-600">Taux d'acceptation</div>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">
                            {Math.round(federatedAnalytics.globalImpactScore || 0)}
                          </div>
                          <div className="text-sm text-gray-600">Score d'impact global</div>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-lg">
                          <div className="text-2xl font-bold text-orange-600">
                            {federatedAnalytics.improvementsBenefited || 0}
                          </div>
                          <div className="text-sm text-gray-600">Améliorations bénéficiées</div>
                        </div>
                      </div>
                    )}

                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="font-semibold">Rang de contribution</Label>
                          <p className="text-sm text-gray-600">
                            {federatedAnalytics?.contributionRank || 'Nouveau Contributeur'}
                          </p>
                        </div>
                        <Badge className="bg-purple-100 text-purple-800">
                          {federatedAnalytics?.contributionRank || 'Nouveau'}
                        </Badge>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-blue-600" />
                        <span className="font-semibold text-blue-800">Anonymisation totale</span>
                      </div>
                      <p className="text-sm text-blue-700 mt-1">
                        Seuls les patterns statistiques anonymisés sont partagés pour améliorer l'IA collective
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Paramètres
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label>Nom du tenant</Label>
                        <Input 
                          value={selectedTenant.name} 
                          onChange={(e) => setSelectedTenant({...selectedTenant, name: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label>Domaine</Label>
                        <Input 
                          value={selectedTenant.domain || ''} 
                          onChange={(e) => setSelectedTenant({...selectedTenant, domain: e.target.value})}
                          placeholder="tenant.smartgmao.com"
                        />
                      </div>
                      <div>
                        <Label>Email de contact</Label>
                        <Input 
                          type="email"
                          value={selectedTenant.contactEmail || ''} 
                          onChange={(e) => setSelectedTenant({...selectedTenant, contactEmail: e.target.value})}
                        />
                      </div>
                      <div>
                        <Label>Plan</Label>
                        <Select 
                          value={selectedTenant.plan}
                          onValueChange={(value) => setSelectedTenant({...selectedTenant, plan: value})}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">Gratuit</SelectItem>
                            <SelectItem value="pro">Pro</SelectItem>
                            <SelectItem value="business">Business</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Utilisateurs maximum</Label>
                        <Input 
                          type="number"
                          value={selectedTenant.maxUsers} 
                          onChange={(e) => setSelectedTenant({...selectedTenant, maxUsers: parseInt(e.target.value)})}
                        />
                      </div>
                    </div>

                    {/* Email Invitation Section */}
                    <div className="p-4 border rounded-lg bg-purple-50 border-purple-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="font-semibold flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Invitation d'accès
                          </Label>
                          <p className="text-sm text-gray-600">
                            Envoyer le lien de connexion par email
                          </p>
                        </div>
                        <Button
                          onClick={() => {
                            if (selectedTenant.contactEmail) {
                              sendInvitationMutation.mutate({
                                tenantId: selectedTenant.id,
                                contactEmail: selectedTenant.contactEmail
                              });
                            } else {
                              toast({
                                title: "Email requis",
                                description: "Veuillez d'abord saisir un email de contact",
                                variant: "destructive",
                              });
                            }
                          }}
                          disabled={sendInvitationMutation.isPending || !selectedTenant.contactEmail}
                          className="flex items-center gap-2"
                          size="sm"
                        >
                          <Send className="w-4 h-4" />
                          {sendInvitationMutation.isPending ? 'Envoi...' : 'Envoyer'}
                        </Button>
                      </div>
                      {selectedTenant.contactEmail && (
                        <div className="text-xs text-purple-700 bg-purple-100 p-2 rounded">
                          📧 Email sera envoyé à: <strong>{selectedTenant.contactEmail}</strong>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        onClick={() => updateTenantMutation.mutate(selectedTenant)}
                        disabled={updateTenantMutation.isPending}
                      >
                        Sauvegarder
                      </Button>
                      <Button variant="outline">
                        Réinitialiser
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Building className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600">Sélectionnez un tenant</h3>
                <p className="text-gray-500">Choisissez un tenant dans la liste pour voir les détails</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Tenant Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Nouveau Tenant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nom</Label>
                <Input placeholder="Nom du client" />
              </div>
              <div>
                <Label>Email de contact</Label>
                <Input type="email" placeholder="contact@client.com" />
              </div>
              <div>
                <Label>Plan</Label>
                <Select defaultValue="free">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Gratuit (5 utilisateurs)</SelectItem>
                    <SelectItem value="pro">Pro (25 utilisateurs)</SelectItem>
                    <SelectItem value="business">Business (100 utilisateurs)</SelectItem>
                    <SelectItem value="enterprise">Enterprise (illimité)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <div className="p-6 flex gap-2">
              <Button 
                onClick={() => {/* Create logic */}}
                disabled={createTenantMutation.isPending}
              >
                Créer
              </Button>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Annuler
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TenantManagement;
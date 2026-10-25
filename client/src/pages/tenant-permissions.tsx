import React, { useState, useEffect } from "react";
import { auMoins, libelleRole } from "@shared/roles";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Shield, 
  Users, 
  Settings, 
  CheckCircle2, 
  XCircle, 
  Edit, 
  Plus,
  AlertTriangle,
  Factory,
  UserCog,
  Lock,
  Unlock,
  Crown,
  Building
} from "lucide-react";
import ModernNavigation from "@/components/modern-navigation";
import { useAuth } from "@/hooks/useAuth";
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

// Types pour les permissions et rôles
interface UserPermission {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department: string;
  validationLevel: number;
  canValidateWorkOrders: boolean;
  canValidatePurchaseOrders: boolean;
  maxPurchaseAmount: number;
  isActive: boolean;
  modulePermissions: Record<string, boolean>;
  lastLogin: string;
}

interface TenantRole {
  id: string;
  name: string;
  description: string;
  level: number;
  permissions: string[];
  validationCapabilities: {
    workOrders: boolean;
    purchaseOrders: boolean;
    maxAmount: number;
  };
  moduleAccess: Record<string, boolean>;
}

interface ModulePermission {
  moduleKey: string;
  moduleName: string;
  category: string;
  description: string;
  requiredLevel: number;
  enabled: boolean;
}

const PRESET_ROLES: TenantRole[] = [
  {
    id: "technician",
    name: "Technicien",
    description: "Accès de base pour les techniciens de maintenance",
    level: 1,
    permissions: ["view_equipment", "create_work_orders", "update_work_orders"],
    validationCapabilities: { workOrders: false, purchaseOrders: false, maxAmount: 0 },
    moduleAccess: { "gmao_core": true, "diagnostic_ai": true, "mobile_access": true }
  },
  {
    id: "supervisor",
    name: "Superviseur",
    description: "Supervision d'équipe et validation niveau 1",
    level: 2,
    permissions: ["view_equipment", "create_work_orders", "validate_level1", "manage_team"],
    validationCapabilities: { workOrders: true, purchaseOrders: true, maxAmount: 5000 },
    moduleAccess: { "gmao_core": true, "diagnostic_ai": true, "erp_procurement": true, "analytics": true }
  },
  {
    id: "manager",
    name: "Chef de Service",
    description: "Gestion de service et validation niveau 2",
    level: 3,
    permissions: ["view_equipment", "create_work_orders", "validate_level2", "manage_budget", "manage_team"],
    validationCapabilities: { workOrders: true, purchaseOrders: true, maxAmount: 25000 },
    moduleAccess: { "gmao_core": true, "erp_procurement": true, "analytics": true, "enterprise_integration": true }
  },
  {
    id: "director",
    name: "Directeur Maintenance",
    description: "Direction maintenance et validation niveau 3",
    level: 4,
    permissions: ["all_permissions"],
    validationCapabilities: { workOrders: true, purchaseOrders: true, maxAmount: 100000 },
    moduleAccess: { "*": true } // Accès à tous les modules
  },
  {
    id: "admin",
    name: "Administrateur Tenant",
    description: "Administration complète du tenant",
    level: 5,
    permissions: ["all_permissions", "manage_users", "manage_tenant"],
    validationCapabilities: { workOrders: true, purchaseOrders: true, maxAmount: 999999 },
    moduleAccess: { "*": true }
  }
];

const MODULE_CATEGORIES = {
  "GMAO": "Modules Core GMAO",
  "ERP_PROCUREMENT": "ERP Approvisionnement", 
  "ANALYTICS": "Analytics de Base",
  "IOT_AUTOMATION": "IoT et Automatisation",
  "ENTERPRISE_INTEGRATION": "Intégrations Avancées",
  "ADVANCED_AI": "IA Ensemble Avancée",
  "MOBILE_PLATFORM": "Accès Mobile",
  "ENTERPRISE_PLATFORM": "Multi-Tenant SaaS",
  "PAYMENT_SYSTEM": "Gestion des Paiements",
  "ADVANCED_ANALYTICS": "Rapports Avancés PDF",
  "DEPLOYMENT": "Déploiement Local"
};

export default function TenantPermissions() {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<UserPermission | null>(null);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [customRole, setCustomRole] = useState<Partial<TenantRole>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /**
   * Qui accède à la gestion des permissions ?
   *
   * ⚠️ La condition comparait le rôle à `["admin", "director"]`, écrit à la
   * main. Elle recopiait fidèlement le serveur, qui faisait la même faute —
   * c'est pourquoi le lot précédent l'avait GELÉE au lieu de la corriger : la
   * corriger seule aurait promis un écran que le serveur refusait.
   *
   * Le serveur a été repris depuis (`auMoins(role, 'admin')` sur
   * `GET /api/tenant/users`, `PATCH …/permissions` et `POST /api/tenant/roles`).
   * L'interface peut donc enfin s'aligner : le **propriétaire** du locataire,
   * niveau 7, retrouve l'écran que la comparaison littérale lui refusait, et
   * `director` — qui n'existe dans aucun référentiel — cesse de l'obtenir.
   */
  if (!auMoins(user?.role, "admin")) {
    return (
      <AppShell filAriane={[{ libelle: "Administration" }, { libelle: "Permissions" }]} largeur="large">
      <div className="space-y-6">
        <div className="pt-24 pb-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-lg p-8 text-center">
              <Shield className="w-16 h-16 text-etat-critique-texte mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-ink mb-2">Accès Non Autorisé</h1>
              <p className="text-ink-soft mb-4">
                La gestion des permissions est réservée à l'administrateur et au propriétaire du compte.
              </p>
              <p className="text-sm text-ink-mute">
                Votre rôle actuel : <span className="font-medium">{libelleRole(user?.role)}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
    );
  }

  // Récupérer les utilisateurs du tenant
  const { data: users = [], isLoading: usersLoading } = useQuery<UserPermission[]>({
    queryKey: ['/api/tenant/users'],
    enabled: true
  });

  // Récupérer les modules disponibles
  const { data: modules, isLoading: modulesLoading } = useQuery<{ availableModules: any[] }>({
    queryKey: ['/api/tenant/modules'],
    enabled: true
  });

  // Mutation pour mettre à jour les permissions utilisateur
  const updateUserPermissionsMutation = useMutation({
    mutationFn: async (data: { userId: number; permissions: Partial<UserPermission> }) => {
      return apiRequest(`/api/tenant/users/${data.userId}/permissions`, {
        method: "PATCH",
        body: data.permissions
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tenant/users'] });
      toast({
        title: "Permissions mises à jour",
        description: "Les permissions utilisateur ont été sauvegardées avec succès."
      });
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour les permissions",
        variant: "destructive"
      });
    }
  });

  // Mutation pour créer un rôle personnalisé
  const createCustomRoleMutation = useMutation({
    mutationFn: async (roleData: TenantRole) => {
      return apiRequest("/api/tenant/roles", {
        method: "POST",
        body: roleData
      });
    },
    onSuccess: () => {
      toast({
        title: "Rôle créé",
        description: "Le rôle personnalisé a été créé avec succès."
      });
      setShowCreateRole(false);
      setCustomRole({});
    }
  });

  const handleApplyPresetRole = (user: UserPermission, role: TenantRole) => {
    const updatedPermissions: Partial<UserPermission> = {
      role: role.id,
      validationLevel: role.level,
      canValidateWorkOrders: role.validationCapabilities.workOrders,
      canValidatePurchaseOrders: role.validationCapabilities.purchaseOrders,
      maxPurchaseAmount: role.validationCapabilities.maxAmount,
      modulePermissions: role.moduleAccess
    };

    updateUserPermissionsMutation.mutate({
      userId: user.id,
      permissions: updatedPermissions
    });
  };

  const handleSaveUserPermissions = () => {
    if (!selectedUser) return;

    updateUserPermissionsMutation.mutate({
      userId: selectedUser.id,
      permissions: selectedUser
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin": return <Crown className="w-4 h-4 text-signal-deep" />;
      case "director": return <Building className="w-4 h-4 text-etat-encours-texte" />;
      case "manager": return <UserCog className="w-4 h-4 text-etat-nominal-texte" />;
      case "supervisor": return <Shield className="w-4 h-4 text-etat-alerte-texte" />;
      default: return <Users className="w-4 h-4 text-ink-soft" />;
    }
  };

  const getValidationBadges = (user: UserPermission) => {
    const badges = [];
    
    if (user.canValidateWorkOrders) {
      badges.push(
        <Badge key="wo" variant="secondary" className="text-xs">
          OT Niveau {user.validationLevel}
        </Badge>
      );
    }
    
    if (user.canValidatePurchaseOrders) {
      badges.push(
        <Badge key="po" variant="secondary" className="text-xs">
          BC ≤ {user.maxPurchaseAmount.toLocaleString()}€
        </Badge>
      );
    }
    
    return badges;
  };

  if (usersLoading || modulesLoading) {
    return (
      <div className="min-h-screen bg-paper-deep">
        <ModernNavigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/3 mb-4"></div>
            <div className="h-64 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-deep">
      <ModernNavigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-paper-deep rounded-none flex items-center justify-center">
              <Shield className="w-6 h-6 text-ink" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-ink">Gestion des Permissions</h1>
              <p className="text-ink-soft">Définissez les niveaux d'accès selon l'organigramme de votre entreprise</p>
            </div>
          </div>

          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              En tant qu'administrateur tenant, vous pouvez attribuer des droits de création et validation des OT/BC selon 
              les responsabilités et qualifications de chaque utilisateur dans votre organigramme.
            </AlertDescription>
          </Alert>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Utilisateurs & Permissions
            </TabsTrigger>
            <TabsTrigger value="roles" className="flex items-center gap-2">
              <UserCog className="w-4 h-4" />
              Rôles Prédéfinis
            </TabsTrigger>
            <TabsTrigger value="modules" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Accès Modules
            </TabsTrigger>
          </TabsList>

          {/* Onglet Utilisateurs & Permissions */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Gestion des Utilisateurs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {users.map((user: UserPermission) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-paper">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(user.role)}
                          <div>
                            <div className="font-semibold text-ink">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-ink-soft">
                              {user.email} • {user.department}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-1">
                          {getValidationBadges(user)}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {user.isActive ? (
                            <CheckCircle2 className="w-4 h-4 text-etat-nominal-texte" />
                          ) : (
                            <XCircle className="w-4 h-4 text-etat-critique-texte" />
                          )}
                          <span className="text-xs text-ink-mute">
                            {user.isActive ? "Actif" : "Inactif"}
                          </span>
                        </div>
                      </div>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedUser(user)}
                            data-testid={`button-edit-permissions-${user.id}`}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Modifier Permissions
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>
                              Permissions de {user.firstName} {user.lastName}
                            </DialogTitle>
                          </DialogHeader>
                          
                          {selectedUser && (
                            <div className="space-y-6">
                              {/* Informations de base */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Rôle</Label>
                                  <Select 
                                    value={selectedUser.role} 
                                    onValueChange={(value) => setSelectedUser({...selectedUser, role: value})}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PRESET_ROLES.map((role) => (
                                        <SelectItem key={role.id} value={role.id}>
                                          {role.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                
                                <div>
                                  <Label>Niveau de Validation</Label>
                                  <Select 
                                    value={selectedUser.validationLevel.toString()} 
                                    onValueChange={(value) => setSelectedUser({...selectedUser, validationLevel: parseInt(value)})}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="0">Aucun</SelectItem>
                                      <SelectItem value="1">Niveau 1 - Superviseur</SelectItem>
                                      <SelectItem value="2">Niveau 2 - Chef Service</SelectItem>
                                      <SelectItem value="3">Niveau 3 - Directeur</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              {/* Droits de validation */}
                              <div className="space-y-4">
                                <h3 className="font-semibold">Droits de Validation</h3>
                                
                                <div className="flex items-center justify-between">
                                  <div>
                                    <Label>Validation Ordres de Travail</Label>
                                    <p className="text-sm text-ink-soft">Peut valider et approuver les OT</p>
                                  </div>
                                  <Switch
                                    checked={selectedUser.canValidateWorkOrders}
                                    onCheckedChange={(checked) => setSelectedUser({...selectedUser, canValidateWorkOrders: checked})}
                                  />
                                </div>
                                
                                <div className="flex items-center justify-between">
                                  <div>
                                    <Label>Validation Bons de Commande</Label>
                                    <p className="text-sm text-ink-soft">Peut valider et approuver les BC</p>
                                  </div>
                                  <Switch
                                    checked={selectedUser.canValidatePurchaseOrders}
                                    onCheckedChange={(checked) => setSelectedUser({...selectedUser, canValidatePurchaseOrders: checked})}
                                  />
                                </div>
                                
                                {selectedUser.canValidatePurchaseOrders && (
                                  <div>
                                    <Label>Montant Maximum Autorisé (€)</Label>
                                    <Input
                                      type="number"
                                      value={selectedUser.maxPurchaseAmount}
                                      onChange={(e) => setSelectedUser({...selectedUser, maxPurchaseAmount: parseFloat(e.target.value) || 0})}
                                      placeholder="Montant maximum en euros"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex justify-between">
                                <div className="flex gap-2">
                                  {PRESET_ROLES.map((role) => (
                                    <Button
                                      key={role.id}
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleApplyPresetRole(user, role)}
                                      data-testid={`button-apply-role-${role.id}`}
                                    >
                                      Appliquer {role.name}
                                    </Button>
                                  ))}
                                </div>
                                
                                <Button
                                  onClick={handleSaveUserPermissions}
                                  disabled={updateUserPermissionsMutation.isPending}
                                  data-testid="button-save-permissions"
                                >
                                  {updateUserPermissionsMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
                                </Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Rôles Prédéfinis */}
          <TabsContent value="roles" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="w-5 h-5" />
                  Rôles Prédéfinis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {PRESET_ROLES.map((role) => (
                    <Card key={role.id} className="border-2 transition-shadow">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          {getRoleIcon(role.id)}
                          {role.name}
                        </CardTitle>
                        <Badge variant="outline" className="w-fit">
                          Niveau {role.level}
                        </Badge>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-ink-soft">{role.description}</p>
                        
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Validations autorisées:</h4>
                          <div className="flex flex-wrap gap-1">
                            {role.validationCapabilities.workOrders && (
                              <Badge variant="secondary" className="text-xs">OT</Badge>
                            )}
                            {role.validationCapabilities.purchaseOrders && (
                              <Badge variant="secondary" className="text-xs">
                                BC ≤ {role.validationCapabilities.maxAmount.toLocaleString()}€
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-semibold text-sm mb-2">Accès modules:</h4>
                          <div className="text-xs text-ink-soft">
                            {role.moduleAccess["*"] ? "Tous les modules" : 
                             `${Object.keys(role.moduleAccess).length} modules autorisés`}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Accès Modules */}
          <TabsContent value="modules" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Contrôle d'Accès par Module
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Alert className="mb-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Configurez l'accès aux modules selon les besoins de votre organisation. 
                    Certains modules peuvent nécessiter des formations spécifiques.
                  </AlertDescription>
                </Alert>

                {Object.entries(MODULE_CATEGORIES).map(([category, categoryName]) => (
                  <div key={category} className="mb-6">
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Factory className="w-5 h-5 text-etat-encours-texte" />
                      {categoryName}
                    </h3>
                    
                    <div className="grid gap-3 pl-7">
                      {modules?.availableModules?.filter((mod: any) => mod.category === category).map((module: any) => (
                        <div key={module.key} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-medium">{module.name}</div>
                            <div className="text-sm text-ink-soft">{module.description}</div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <Badge variant={module.isCore ? "default" : "secondary"}>
                              {module.isCore ? "Obligatoire" : "Optionnel"}
                            </Badge>
                            
                            <div className="flex items-center gap-2">
                              {module.isCore ? (
                                <Lock className="w-4 h-4 text-ink-mute" />
                              ) : (
                                <Switch defaultChecked={true} />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
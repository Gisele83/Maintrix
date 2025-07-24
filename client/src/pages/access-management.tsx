import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/header";
import { useToast } from "@/hooks/use-toast";
import { 
  UserPlus, 
  Users, 
  Clock, 
  Shield, 
  Trash2, 
  Edit, 
  Eye,
  AlertCircle,
  CheckCircle,
  Calendar,
  BarChart3,
  Settings,
  Crown,
  Zap,
  Building,
  Gift
} from "lucide-react";
import { Link } from "wouter";

interface AccessGrant {
  id: string;
  grantedTo: string;
  planType: "pro" | "business" | "enterprise";
  daysRemaining: number;
  isActive: boolean;
  currentUsage: number;
  maxDiagnostics: number;
  reason?: string;
  createdAt: string;
  lastUsed?: string;
}

export default function AccessManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"grants" | "create" | "reports">("grants");
  
  // Formulaire de création d'accès
  const [newGrant, setNewGrant] = useState({
    email: "",
    planType: "business" as "pro" | "business" | "enterprise",
    duration: "30",
    reason: "",
    notes: ""
  });

  // Mock data - en production, vient de l'API
  const [accessGrants, setAccessGrants] = useState<AccessGrant[]>([
    {
      id: "grant_001",
      grantedTo: "partenaire@entreprise.com",
      planType: "business",
      daysRemaining: 25,
      isActive: true,
      currentUsage: 45,
      maxDiagnostics: 1000,
      reason: "Partenariat commercial",
      createdAt: "2024-12-01",
      lastUsed: "2024-12-15"
    },
    {
      id: "grant_002", 
      grantedTo: "consultant@expertise.com",
      planType: "enterprise",
      daysRemaining: 8,
      isActive: true,
      currentUsage: 189,
      maxDiagnostics: 5000,
      reason: "Mission de consulting",
      createdAt: "2024-11-20",
      lastUsed: "2024-12-14"
    },
    {
      id: "grant_003",
      grantedTo: "evaluateur@prospect.com",
      planType: "pro",
      daysRemaining: 0,
      isActive: false,
      currentUsage: 67,
      maxDiagnostics: 200,
      reason: "Évaluation prospect",
      createdAt: "2024-10-15"
    }
  ]);

  const planIcons = {
    pro: Zap,
    business: Building,
    enterprise: Crown
  };

  const planColors = {
    pro: "bg-blue-50 border-blue-200 text-blue-800",
    business: "bg-green-50 border-green-200 text-green-800", 
    enterprise: "bg-purple-50 border-purple-200 text-purple-800"
  };

  const createAccess = () => {
    if (!newGrant.email || !newGrant.planType || !newGrant.duration) {
      toast({
        title: "Informations manquantes",
        description: "Veuillez remplir tous les champs requis",
        variant: "destructive"
      });
      return;
    }

    const grant: AccessGrant = {
      id: `grant_${Date.now()}`,
      grantedTo: newGrant.email,
      planType: newGrant.planType,
      daysRemaining: parseInt(newGrant.duration),
      isActive: true,
      currentUsage: 0,
      maxDiagnostics: newGrant.planType === "pro" ? 200 : newGrant.planType === "business" ? 1000 : 5000,
      reason: newGrant.reason,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setAccessGrants([grant, ...accessGrants]);
    setNewGrant({ email: "", planType: "business", duration: "30", reason: "", notes: "" });
    
    toast({
      title: "Accès accordé avec succès",
      description: `Accès ${newGrant.planType.toUpperCase()} accordé à ${newGrant.email} pour ${newGrant.duration} jours`
    });

    setActiveTab("grants");
  };

  const revokeAccess = (grantId: string) => {
    setAccessGrants(grants => 
      grants.map(g => 
        g.id === grantId ? { ...g, isActive: false } : g
      )
    );
    
    toast({
      title: "Accès révoqué",
      description: "L'accès a été révoqué avec succès"
    });
  };

  const extendAccess = (grantId: string, additionalDays: number) => {
    setAccessGrants(grants =>
      grants.map(g =>
        g.id === grantId ? { ...g, daysRemaining: g.daysRemaining + additionalDays } : g
      )
    );
    
    toast({
      title: "Accès étendu",
      description: `Accès étendu de ${additionalDays} jours supplémentaires`
    });
  };

  const activeGrants = accessGrants.filter(g => g.isActive);
  const expiredGrants = accessGrants.filter(g => !g.isActive);
  const totalUsage = accessGrants.reduce((sum, g) => sum + g.currentUsage, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                Gestion des accès
              </h1>
              <p className="text-muted-foreground">
                Accordez l'accès à la plateforme sans paiement
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Accès actifs</p>
                    <p className="text-xl font-bold">{activeGrants.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Expirés</p>
                    <p className="text-xl font-bold">{expiredGrants.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Utilisation totale</p>
                    <p className="text-xl font-bold">{totalUsage}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Ce mois</p>
                    <p className="text-xl font-bold">3</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="flex space-x-1 bg-muted/30 p-1 rounded-lg">
            <Button
              variant={activeTab === "grants" ? "default" : "ghost"}
              onClick={() => setActiveTab("grants")}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Accès accordés
            </Button>
            <Button
              variant={activeTab === "create" ? "default" : "ghost"}
              onClick={() => setActiveTab("create")}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Nouvel accès
            </Button>
            <Button
              variant={activeTab === "reports" ? "default" : "ghost"}
              onClick={() => setActiveTab("reports")}
              className="flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              Rapports
            </Button>
          </div>
        </div>

        {/* Content */}
        {activeTab === "grants" && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Accès accordés ({accessGrants.length})</h2>
            
            {accessGrants.map((grant) => {
              const PlanIcon = planIcons[grant.planType];
              const usagePercentage = (grant.currentUsage / grant.maxDiagnostics) * 100;
              
              return (
                <Card key={grant.id} className="border-0 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                          <PlanIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{grant.grantedTo}</h3>
                          <p className="text-sm text-muted-foreground">{grant.reason}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge className={planColors[grant.planType]}>
                          {grant.planType.toUpperCase()}
                        </Badge>
                        <Badge variant={grant.isActive ? "default" : "destructive"}>
                          {grant.isActive ? "Actif" : "Expiré"}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Jours restants</p>
                        <p className="font-semibold">{grant.daysRemaining}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Utilisation</p>
                        <p className="font-semibold">{grant.currentUsage} / {grant.maxDiagnostics}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Créé le</p>
                        <p className="font-semibold">{grant.createdAt}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Dernière utilisation</p>
                        <p className="font-semibold">{grant.lastUsed || "Jamais"}</p>
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progression</span>
                        <span>{usagePercentage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full" 
                          style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {grant.isActive && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => extendAccess(grant.id, 30)}
                            className="flex items-center gap-1"
                          >
                            <Calendar className="h-3 w-3" />
                            Étendre +30j
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => revokeAccess(grant.id)}
                            className="flex items-center gap-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                            Révoquer
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm">
                        <Eye className="h-3 w-3 mr-1" />
                        Détails
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {activeTab === "create" && (
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Accorder un nouvel accès
              </CardTitle>
              <CardDescription>
                Donnez l'accès à la plateforme à un tiers sans paiement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Adresse email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="utilisateur@entreprise.com"
                      value={newGrant.email}
                      onChange={(e) => setNewGrant({...newGrant, email: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="planType">Type de plan *</Label>
                    <Select value={newGrant.planType} onValueChange={(value: any) => setNewGrant({...newGrant, planType: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pro">Pro (200 diagnostics)</SelectItem>
                        <SelectItem value="business">Business (1000 diagnostics)</SelectItem>
                        <SelectItem value="enterprise">Enterprise (5000 diagnostics)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="duration">Durée (jours) *</Label>
                    <Select value={newGrant.duration} onValueChange={(value) => setNewGrant({...newGrant, duration: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 jours</SelectItem>
                        <SelectItem value="14">14 jours</SelectItem>
                        <SelectItem value="30">30 jours</SelectItem>
                        <SelectItem value="60">60 jours</SelectItem>
                        <SelectItem value="90">90 jours</SelectItem>
                        <SelectItem value="180">180 jours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="reason">Raison de l'accès *</Label>
                    <Input
                      id="reason"
                      placeholder="Ex: Partenariat commercial, Mission de consulting..."
                      value={newGrant.reason}
                      onChange={(e) => setNewGrant({...newGrant, reason: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="notes">Notes (optionnel)</Label>
                    <Textarea
                      id="notes"
                      placeholder="Informations complémentaires..."
                      value={newGrant.notes}
                      onChange={(e) => setNewGrant({...newGrant, notes: e.target.value})}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setActiveTab("grants")}>
                  Annuler
                </Button>
                <Button onClick={createAccess}>
                  Accorder l'accès
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "reports" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Répartition par plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Pro</span>
                    <Badge variant="outline">1 utilisateur</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Business</span>
                    <Badge variant="outline">1 utilisateur</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Enterprise</span>
                    <Badge variant="outline">1 utilisateur</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Top utilisateurs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {accessGrants
                    .sort((a, b) => b.currentUsage - a.currentUsage)
                    .slice(0, 3)
                    .map((grant, index) => (
                      <div key={grant.id} className="flex justify-between items-center">
                        <span className="truncate">{grant.grantedTo}</span>
                        <Badge variant="secondary">{grant.currentUsage} diagnostics</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
import React from "react";
// ✅ MIGRATION COMPLÈTE : ValidationLogin legacy supprimé
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  LogOut, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  FileText,
  ShoppingCart,
  Wrench,
  AlertTriangle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";
import { useAuth } from "@/hooks/useAuth";
import { libelleRole } from "@shared/roles";

/**
 * Écran de validation « sécurisé » — second écran branché sur le même circuit.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ
 * ═══════════════════════════════════════════════════════════════════
 * Cette page construisait son utilisateur depuis `localStorage` :
 *
 *     const savedUser = localStorage.getItem("validation_user");
 *     setUser(JSON.parse(savedUser));   // ← avec validationLevel et canValidate*
 *
 * Donc son niveau de validation et ses deux habilitations venaient d'un magasin
 * que le navigateur de l'utilisateur contrôle entièrement. Et comme
 * `handleLoginSuccess` n'était plus appelé par personne (l'écran
 * `ValidationLogin` a été supprimé), ces clés n'étaient jamais écrites : la page
 * affichait « Authentification requise » à tout le monde, sauf à qui les plantait
 * à la main.
 *
 * Deux champs n'existaient de toute façon nulle part : `matricule`, et
 * `canValidateOrders` — la colonne s'appelle `can_validate_purchase_orders`.
 * `user.canValidateOrders` valait donc toujours `undefined`, et le panneau des
 * bons de commande ne s'affichait jamais.
 *
 * La page lit maintenant la SESSION (`useAuth`), comme le reste de l'application.
 * Le serveur ne croit plus un mot de ce que cet écran lui envoie sur l'identité
 * ou le niveau (server/simple-validation-routes.ts) : ce qui est affiché ici
 * n'est qu'un reflet, et doit donc être exact.
 */

interface ValidationItem {
  id: number;
  orderNumber: string;
  orderType: string;
  description: string;
  totalAmount: string;
  priority: string;
  requestedBy: string;
  documentType: string;
  validationStatus: string;
  /** Le niveau que CE document attend, tel que le serveur l'a calculé. */
  niveauAttendu?: number;
}

export default function SecureValidation() {
  const { user, isLoading: userLoading, logout } = useAuth();
  const queryClient = useQueryClient();

  const validationLevel = user?.validationLevel ?? 0;
  const canValidatePurchaseOrders = user?.canValidatePurchaseOrders === true;
  const canValidateWorkOrders = user?.canValidateWorkOrders === true;

  // Les files d'attente sont servies au niveau de la SESSION : plus de
  // `validationLevel` ni de `validatorId` en paramètres de requête.
  const { data: pendingOrders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery<ValidationItem[]>({
    queryKey: ["/api/validation/purchase-orders/pending"],
    enabled: !!user && canValidatePurchaseOrders,
    queryFn: () => apiRequest("/api/validation/purchase-orders/pending")
  });

  const { data: pendingWorkOrders = [], isLoading: workOrdersLoading, refetch: refetchWorkOrders } = useQuery<any[]>({
    queryKey: ["/api/validation/work-orders/pending"],
    enabled: !!user && canValidateWorkOrders,
    queryFn: () => apiRequest("/api/validation/work-orders/pending")
  });

  const validateOrderMutation = useMutation({
    mutationFn: async ({ orderId, action, comments, niveau }: { orderId: number; action: 'validate' | 'reject'; comments: string; niveau?: number }) => {
      return await apiRequest("/api/validation/purchase-orders/validate", {
        method: "POST",
        body: {
          purchaseorderId: orderId,
          action,
          // Le niveau que le serveur annonce pour CE document, et non celui du
          // profil : un bon peut attendre un échelon inférieur à celui qu'on
          // détient. `validatorId` n'est plus envoyé — il valait `matricule`,
          // une chaîne, là où la colonne attend un identifiant de compte.
          validationLevel: niveau ?? validationLevel,
          comments
        }
      });
    },
    onSuccess: () => {
      refetchOrders();
      queryClient.invalidateQueries({ queryKey: ["/api/validation/statistics"] });
    }
  });

  const validateWorkOrderMutation = useMutation({
    mutationFn: async ({ workOrderId, action, comments, niveau }: { workOrderId: number; action: 'validate' | 'reject'; comments: string; niveau?: number }) => {
      return await apiRequest("/api/validation/work-orders/validate", {
        method: "POST",
        body: {
          // ⚠️ Cette page envoyait `workOrderId`, que la route ne lisait PAS :
          // elle attend `workorderId` ou `orderId`. L'identifiant arrivait donc
          // `undefined` et la validation d'un ordre de travail ne pouvait pas
          // aboutir depuis cet écran. On envoie le nom que la route lit.
          workorderId: workOrderId,
          action,
          validationLevel: niveau ?? validationLevel,
          comments
        }
      });
    },
    onSuccess: () => {
      refetchWorkOrders();
      queryClient.invalidateQueries({ queryKey: ["/api/validation/statistics"] });
    }
  });

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper-deep">
        <div className="flex items-center gap-2 text-ink-soft">
          <Clock className="w-5 h-5 animate-spin" />
          Chargement de votre profil…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper-deep">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Authentification requise</h2>
          <p className="text-ink-soft mb-4">Veuillez vous connecter pour accéder à cette page.</p>
          <Button onClick={() => window.location.href = "/login"}>Se connecter</Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell filAriane={[{ libelle: "Administration" }, { libelle: "Validation" }]} largeur="large">
    <div className="space-y-6">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-ink">
              Système de Validation Multi-Niveaux
            </h1>
            <p className="text-ink-soft mt-1">
              Interface sécurisée pour la validation des demandes
            </p>
          </div>
          {/* `logout()` de `useAuth` : il révoque la session côté serveur.
              L'ancien bouton ne faisait que vider deux clés de localStorage —
              la session, elle, restait ouverte. */}
          <Button
            onClick={() => { void logout(); }}
            variant="outline"
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </Button>
        </div>

        {/* User Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profil Utilisateur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-ink-soft">Nom complet</p>
                <p className="font-medium">
                  {user.firstName || user.lastName
                    ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                    : user.username}
                </p>
              </div>
              <div>
                {/* `matricule` n'existe dans aucune table : le champ affichait
                    toujours du vide. C'est l'identifiant de connexion et le
                    rôle du référentiel qui désignent le compte. */}
                <p className="text-sm text-ink-soft">Compte</p>
                <p className="font-medium font-mono">{user.username}</p>
              </div>
              <div>
                <p className="text-sm text-ink-soft">Département</p>
                <p className="font-medium">{user.department || "non renseigné"}</p>
              </div>
              <div>
                <p className="text-sm text-ink-soft">Rôle et niveau</p>
                {/* `getLevelDescription` traduisait le niveau 1 en « Chef de
                    Service » et le 2 en « Chef Département Maintenance » : deux
                    intitulés qui n'appartiennent à aucune nomenclature du dépôt.
                    Le rôle est affiché par le référentiel, le niveau est affiché
                    comme ce qu'il est — un échelon d'approbation, pas un métier. */}
                <Badge variant="outline" className="mt-1">
                  {libelleRole(user.role)} — niveau {validationLevel}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Purchase Orders Validation */}
          {canValidatePurchaseOrders && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Bons de Commande ({pendingOrders.length})
                </CardTitle>
                <CardDescription>
                  Demandes en attente de validation niveau {validationLevel}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Clock className="w-6 h-6 animate-spin" />
                    <span className="ml-2">Chargement...</span>
                  </div>
                ) : pendingOrders.length === 0 ? (
                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      Aucune demande en attente pour votre niveau d'habilitation.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {pendingOrders.map((order: ValidationItem) => (
                      <div key={order.id} className="border rounded-lg p-4 bg-white">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold">{order.orderNumber}</h4>
                            <p className="text-sm text-ink-soft">{order.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{order.totalAmount} EUR</p>
                            <Badge variant={getPriorityColor(order.priority)}>
                              {order.priority}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center text-sm text-ink-soft mb-3">
                          <span>Demandé par: {order.requestedBy}</span>
                          <span>Type: {order.documentType === 'purchase_order' ? 'Bon de commande' : 'Lettre de commande'}</span>
                        </div>
                        
                        <Separator className="my-3" />
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => validateOrderMutation.mutate({
                              orderId: order.id,
                              action: 'validate',
                              niveau: order.niveauAttendu,
                              comments: ''
                            })}
                            disabled={validateOrderMutation.isPending}
                            className="flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Valider
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => validateOrderMutation.mutate({
                              orderId: order.id,
                              action: 'reject',
                              niveau: order.niveauAttendu,
                              comments: "Rejeté depuis l'écran de validation"
                            })}
                            disabled={validateOrderMutation.isPending}
                            className="flex items-center gap-1"
                          >
                            <XCircle className="w-4 h-4" />
                            Rejeter
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Work Orders Validation */}
          {canValidateWorkOrders && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="w-5 h-5" />
                  Ordres de Travail ({pendingWorkOrders.length})
                </CardTitle>
                <CardDescription>
                  Ordres de travail en attente de validation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {workOrdersLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Clock className="w-6 h-6 animate-spin" />
                    <span className="ml-2">Chargement...</span>
                  </div>
                ) : pendingWorkOrders.length === 0 ? (
                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      Aucun ordre de travail en attente.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {pendingWorkOrders.map((workOrder: any) => (
                      <div key={workOrder.id} className="border rounded-lg p-4 bg-white">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold">{workOrder.orderNumber}</h4>
                            <p className="text-sm text-ink-soft">{workOrder.description}</p>
                          </div>
                          <Badge variant={getPriorityColor(workOrder.priority)}>
                            {workOrder.priority}
                          </Badge>
                        </div>
                        
                        <div className="flex justify-between items-center text-sm text-ink-soft mb-3">
                          <span>Assigné à: {workOrder.assignedTo}</span>
                          <span>Équipement: {workOrder.equipmentType}</span>
                        </div>
                        
                        <Separator className="my-3" />
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => validateWorkOrderMutation.mutate({
                              workOrderId: workOrder.id,
                              action: 'validate',
                              niveau: workOrder.niveauAttendu,
                              comments: ''
                            })}
                            disabled={validateWorkOrderMutation.isPending}
                            className="flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Valider
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => validateWorkOrderMutation.mutate({
                              workOrderId: workOrder.id,
                              action: 'reject',
                              niveau: workOrder.niveauAttendu,
                              comments: "Rejeté depuis l'écran de validation"
                            })}
                            disabled={validateWorkOrderMutation.isPending}
                            className="flex items-center gap-1"
                          >
                            <XCircle className="w-4 h-4" />
                            Rejeter
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
    </AppShell>
  );
}
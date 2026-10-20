import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Clock, FileText, User, Calendar, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ValidationDemoButton } from "./validation-demo-button";

interface WorkOrder {
  id: number;
  orderNumber: string;
  title: string;
  description: string;
  priority: string;
  validationStatus: string;
  requestedBy?: number;
  estimatedDuration?: number;
  totalCost?: string;
  createdAt: string;
}

interface PurchaseOrder {
  id: number;
  orderNumber: string;
  orderType: string;
  totalAmount: string;
  currency: string;
  validationStatus: string;
  requestedBy: string;
  priority: string;
  createdAt: string;
}

interface ValidationLog {
  id: number;
  recordType: string;
  validationLevel: number;
  action: string;
  validationDate: string;
  comments?: string;
  validatedBy?: number;
}

interface ValidationDashboardProps {
  userId: number;
  userRole: string;
  validationLevel: number;
  canValidateWorkOrders: boolean;
  canValidatePurchaseOrders: boolean;
}

export default function ValidationDashboard({
  userId,
  userRole,
  validationLevel,
  canValidateWorkOrders,
  canValidatePurchaseOrders
}: ValidationDashboardProps) {
  const [pendingWorkOrders, setPendingWorkOrders] = useState<WorkOrder[]>([]);
  const [pendingPurchaseOrders, setPendingPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [validationHistory, setValidationHistory] = useState<ValidationLog[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [validationComments, setValidationComments] = useState("");
  const [activeTab, setActiveTab] = useState("work-orders");
  const [loading, setLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showValidateModal, setShowValidateModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPendingItems();
    loadValidationHistory();
  }, [userId, validationLevel]);

  const loadPendingItems = async () => {
    try {
      if (canValidateWorkOrders) {
        const workOrdersResponse = await apiRequest(
          `/api/validation/work-orders/pending?validatorId=${userId}&validationLevel=${validationLevel}`
        );
        setPendingWorkOrders(workOrdersResponse);
      }

      if (canValidatePurchaseOrders) {
        const purchaseOrdersResponse = await apiRequest(
          `/api/validation/purchase-orders/pending?validatorId=${userId}&validationLevel=${validationLevel}`
        );
        setPendingPurchaseOrders(purchaseOrdersResponse);
      }
    } catch (error) {
      console.error("Error loading pending items:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les éléments en attente",
        variant: "destructive",
      });
    }
  };

  const loadValidationHistory = async () => {
    try {
      const response = await apiRequest(`/api/validation/statistics?validatorId=${userId}`);
      setValidationHistory(response.logs || []);
    } catch (error) {
      console.error("Error loading validation history:", error);
      // Set empty array as fallback
      setValidationHistory([]);
    }
  };

  const handleValidation = async (recordType: "work_order" | "purchase_order", recordId: number, action: "validate" | "reject") => {
    // Justification requise uniquement pour les rejets
    if (!validationComments.trim() && action === "reject") {
      toast({
        title: "Justification requise",
        description: "Veuillez expliquer la raison du rejet",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const endpoint = recordType === "work_order" 
        ? "/api/validation/work-orders/validate"
        : "/api/validation/purchase-orders/validate";

      const requestData = {
        [`${recordType.replace('_', '')}Id`]: recordId,
        action,
        validationLevel,
        comments: validationComments,
        validatorId: userId
      };

      await apiRequest(endpoint, { method: "POST", body: requestData });

      toast({
        title: "Validation réussie",
        description: `${recordType === "work_order" ? "Ordre de travail" : "Bon de commande"} ${action === "validate" ? "validé" : "rejeté"} avec succès`,
        variant: "default",
      });

      // 🔧 CORRECTION: Fermer les modals et nettoyer les états
      setValidationComments("");
      setSelectedRecord(null);
      setShowRejectModal(false);
      setShowValidateModal(false);
      
      // 🔧 CORRECTION: Délai pour laisser la base de données se mettre à jour
      setTimeout(() => {
        loadPendingItems();
        loadValidationHistory();
      }, 500);
    } catch (error) {
      console.error("Validation error:", error);
      toast({
        title: "Erreur de validation",
        description: "Impossible de traiter la validation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPurchaseOrder = async (purchaseOrderId: number) => {
    try {
      const response = await apiRequest(`/api/purchase-orders/${purchaseOrderId}/mark-printed`, {
        method: "POST",
        body: {
          printedBy: userId
        }
      });

      toast({
        title: "Succès",
        description: "Bon de commande marqué comme imprimé - Processus terminé",
      });

      // Reload pending items
      loadPendingItems();
    } catch (error) {
      toast({
        title: "Erreur", 
        description: "Erreur lors du marquage d'impression",
        variant: "destructive",
      });
    }
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      urgent: "bg-etat-critique-vif text-white",
      high: "bg-etat-alerte-vif text-white", 
      medium: "bg-etat-alerte-vif text-black",
      low: "bg-etat-nominal-vif text-white"
    };
    return <Badge className={colors[priority as keyof typeof colors] || "bg-gray-500 text-white"}>{priority}</Badge>;
  };

  const getValidationStatusBadge = (status: string) => {
    const colors = {
      pending: "bg-etat-alerte-fond text-etat-alerte-texte border-etat-alerte-filet",
      level1_validated: "bg-etat-encours-fond text-etat-encours-texte border-etat-encours-filet",
      level2_validated: "bg-paper-deep text-signal-deep border-rule",
      fully_validated: "bg-etat-nominal-fond text-etat-nominal-texte border-etat-nominal-filet",
      rejected: "bg-etat-critique-fond text-etat-critique-texte border-etat-critique-filet"
    };
    
    const labels = {
      pending: "En attente",
      level1_validated: "Niveau 1 validé",
      level2_validated: "Niveau 2 validé", 
      fully_validated: "Entièrement validé",
      rejected: "Rejeté"
    };
    
    return (
      <Badge variant="outline" className={colors[status as keyof typeof colors] || "bg-paper-deep text-ink"}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  if (!canValidateWorkOrders && !canValidatePurchaseOrders) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-ink-mute mb-4" />
            <h3 className="text-lg font-medium text-ink mb-2">Aucune permission de validation</h3>
            <p className="text-ink-mute">Vous n'avez pas les permissions nécessaires pour valider des ordres de travail ou des bons de commande.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Système de Validation Multi-Niveaux</h2>
        <div className="flex items-center gap-2">
          <ValidationDemoButton />
          <Badge variant="outline">Niveau {validationLevel}</Badge>
          <Badge variant="outline">{userRole}</Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          {canValidateWorkOrders && (
            <TabsTrigger value="work-orders" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Ordres de Travail ({pendingWorkOrders.length})
            </TabsTrigger>
          )}
          {canValidatePurchaseOrders && (
            <TabsTrigger value="purchase-orders" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Bons de Commande ({pendingPurchaseOrders.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        {canValidateWorkOrders && (
          <TabsContent value="work-orders" className="space-y-4">
            <div className="grid gap-4">
              {pendingWorkOrders.length === 0 ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <CheckCircle2 className="h-12 w-12 mx-auto text-etat-nominal-texte mb-4" />
                      <h3 className="text-lg font-medium text-ink mb-2">Aucun ordre en attente</h3>
                      <p className="text-ink-mute">Tous les ordres de travail ont été traités.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                pendingWorkOrders.map((workOrder) => (
                  <Card key={workOrder.id} className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{workOrder.orderNumber}</CardTitle>
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(workOrder.priority)}
                          {getValidationStatusBadge(workOrder.validationStatus)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <h4 className="font-medium mb-1">{workOrder.title}</h4>
                        <p className="text-sm text-ink-soft">{workOrder.description}</p>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4 text-ink-mute" />
                          <span>Demandeur: {workOrder.requestedBy}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-ink-mute" />
                          <span>Durée: {workOrder.estimatedDuration || 0} min</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-ink-mute" />
                          <span>{new Date(workOrder.createdAt).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Dialog open={showValidateModal && selectedRecord?.id === workOrder.id} onOpenChange={setShowValidateModal}>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={() => {
                                setSelectedRecord(workOrder);
                                setShowValidateModal(true);
                              }}
                              className="bg-etat-nominal-vif hover:bg-etat-nominal-vif"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Valider
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Validation - {workOrder.orderNumber}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <label className="text-sm font-medium">Commentaires de validation</label>
                                <Textarea
                                  placeholder="Ajoutez vos commentaires sur cette validation..."
                                  value={validationComments}
                                  onChange={(e) => setValidationComments(e.target.value)}
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setShowValidateModal(false);
                                    setValidationComments("");
                                  }}
                                  disabled={loading}
                                >
                                  Annuler
                                </Button>
                                <Button
                                  onClick={() => handleValidation("work_order", workOrder.id, "validate")}
                                  disabled={loading}
                                  className="bg-etat-nominal-vif hover:bg-etat-nominal-vif"
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Valider
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Dialog open={showRejectModal && selectedRecord?.id === workOrder.id} onOpenChange={setShowRejectModal}>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => {
                                setSelectedRecord(workOrder);
                                setShowRejectModal(true);
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Rejeter
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Rejet - {workOrder.orderNumber}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <label className="text-sm font-medium">Raison du rejet <span className="text-etat-critique-texte">*</span></label>
                                <Textarea
                                  placeholder="Veuillez expliquer la raison du rejet..."
                                  value={validationComments}
                                  onChange={(e) => setValidationComments(e.target.value)}
                                  required
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="outline" 
                                  onClick={() => {
                                    setShowRejectModal(false);
                                    setValidationComments("");
                                    setSelectedRecord(null);
                                  }}
                                >
                                  Annuler
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => handleValidation("work_order", workOrder.id, "reject")}
                                  disabled={loading || !validationComments.trim()}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Confirmer le rejet
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        )}

        {canValidatePurchaseOrders && (
          <TabsContent value="purchase-orders" className="space-y-4">
            <div className="grid gap-4">
              {pendingPurchaseOrders.length === 0 ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <CheckCircle2 className="h-12 w-12 mx-auto text-etat-nominal-texte mb-4" />
                      <h3 className="text-lg font-medium text-ink mb-2">Aucun bon en attente</h3>
                      <p className="text-ink-mute">Tous les bons de commande ont été traités.</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                pendingPurchaseOrders.map((purchaseOrder) => (
                  <Card key={purchaseOrder.id} className="border-l-4 border-l-signal">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{purchaseOrder.orderNumber}</CardTitle>
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(purchaseOrder.priority)}
                          {getValidationStatusBadge(purchaseOrder.validationStatus)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <h4 className="font-medium mb-1">Type: {purchaseOrder.orderType}</h4>
                        <p className="text-lg font-semibold text-etat-nominal-texte">
                          {parseFloat(purchaseOrder.totalAmount).toLocaleString('fr-FR', { 
                            style: 'currency', 
                            currency: purchaseOrder.currency 
                          })}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4 text-ink-mute" />
                          <span>Service Achat: {purchaseOrder.requestedBy}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-ink-mute" />
                          <span>{new Date(purchaseOrder.createdAt).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                      
                      <div className="bg-etat-encours-fond p-3 rounded-lg border border-etat-encours-filet">
                        <h5 className="font-medium text-etat-encours-texte mb-2">Workflow de Validation</h5>
                        <div className="text-sm text-etat-encours-texte space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-etat-nominal-vif rounded-full"></div>
                            <span>1. Service Achat - Créé</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${validationLevel === 1 ? 'bg-etat-alerte-vif' : 'bg-gray-300'}`}></div>
                            <span>2. Chef de Service Utilisateur - {validationLevel === 1 ? 'En cours' : 'En attente'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${validationLevel === 2 ? 'bg-etat-alerte-vif' : 'bg-gray-300'}`}></div>
                            <span>3. Directeur Général - {validationLevel === 2 ? 'En cours' : 'En attente'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                            <span>4. Retour Service Achat - Impression</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/api/purchase-orders/${purchaseOrder.id}/letterhead`, '_blank')}
                          className="flex items-center gap-1"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Voir papier en-tête
                        </Button>
                        
                        {/* Show Print button only for Service Achat when fully validated */}
                        {userRole === "Service Achat" && purchaseOrder.validationStatus === "ready_for_print" && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handlePrintPurchaseOrder(purchaseOrder.id)}
                            className="bg-signal-deep hover:bg-signal-deep flex items-center gap-1"
                          >
                            <FileText className="h-4 w-4" />
                            Marquer comme imprimé
                          </Button>
                        )}
                        
                        <Dialog open={showValidateModal && selectedRecord?.id === purchaseOrder.id} onOpenChange={setShowValidateModal}>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={() => {
                                setSelectedRecord(purchaseOrder);
                                setShowValidateModal(true);
                              }}
                              className="bg-etat-nominal-vif hover:bg-etat-nominal-vif"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Valider
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Validation - {purchaseOrder.orderNumber}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <label className="text-sm font-medium">Commentaires de validation</label>
                                <Textarea
                                  placeholder="Ajoutez vos commentaires sur cette validation..."
                                  value={validationComments}
                                  onChange={(e) => setValidationComments(e.target.value)}
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setShowValidateModal(false);
                                    setValidationComments("");
                                  }}
                                  disabled={loading}
                                >
                                  Annuler
                                </Button>
                                <Button
                                  onClick={() => handleValidation("purchase_order", purchaseOrder.id, "validate")}
                                  disabled={loading}
                                  className="bg-etat-nominal-vif hover:bg-etat-nominal-vif"
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Valider
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <Dialog open={showRejectModal && selectedRecord?.id === purchaseOrder.id} onOpenChange={setShowRejectModal}>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => {
                                setSelectedRecord(purchaseOrder);
                                setShowRejectModal(true);
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Rejeter
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Rejet - {purchaseOrder.orderNumber}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <label className="text-sm font-medium">Raison du rejet <span className="text-etat-critique-texte">*</span></label>
                                <Textarea
                                  placeholder="Veuillez expliquer la raison du rejet..."
                                  value={validationComments}
                                  onChange={(e) => setValidationComments(e.target.value)}
                                  required
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="outline" 
                                  onClick={() => {
                                    setShowRejectModal(false);
                                    setValidationComments("");
                                    setSelectedRecord(null);
                                  }}
                                >
                                  Annuler
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => handleValidation("purchase_order", purchaseOrder.id, "reject")}
                                  disabled={loading || !validationComments.trim()}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Confirmer le rejet
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historique des Validations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {validationHistory.length === 0 ? (
                  <p className="text-ink-mute text-center py-8">Aucun historique de validation disponible</p>
                ) : (
                  validationHistory.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`p-1 rounded-full ${log.action === 'validate' ? 'bg-etat-nominal-fond' : 'bg-etat-critique-fond'}`}>
                          {log.action === 'validate' ? (
                            <Check className="h-4 w-4 text-etat-nominal-texte" />
                          ) : (
                            <X className="h-4 w-4 text-etat-critique-texte" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">
                            {log.recordType === 'work_order' ? 'Ordre de travail' : 'Bon de commande'} - 
                            Niveau {log.validationLevel}
                          </p>
                          {log.comments && (
                            <p className="text-sm text-ink-soft">{log.comments}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm text-ink-mute">
                        {new Date(log.validationDate).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
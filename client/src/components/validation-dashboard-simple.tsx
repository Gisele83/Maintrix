import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Clock, FileText, AlertCircle, User, Euro, Calendar } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface WorkOrder {
  id: number;
  orderNumber: string;
  title: string;
  description: string;
  priority: string;
  requestedBy: string;
  createdAt: string;
  status: string;
}

interface PurchaseOrder {
  id: number;
  orderNumber: string;
  orderType: string;
  description: string;
  supplier: string;
  totalAmount: string;
  currency: string;
  priority: string;
  requestedBy: string;
  deliveryDate: string;
  documentType?: string;
}

interface ValidationLog {
  id: number;
  recordType: string;
  recordId: number;
  action: string;
  validatedBy: number;
  comments?: string;
  validationDate: string;
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
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState("work-orders");
  const [loading, setLoading] = useState(false);
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
      setValidationHistory([]);
    }
  };

  const handleValidation = async (recordType: "work_order" | "purchase_order", recordId: number, action: "validate" | "reject") => {
    // Justification requise uniquement pour les rejets
    if (!rejectionReason.trim() && action === "reject") {
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

      await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({
          [`${recordType.replace("_", "")}Id`]: recordId,
          action,
          validationLevel,
          validatorId: userId,
          comments: action === "reject" ? rejectionReason : undefined // Pas de commentaire pour validation
        })
      });

      toast({
        title: action === "validate" ? "Validé avec succès" : "Rejeté avec succès",
        description: `${recordType === "work_order" ? "Ordre de travail" : "Bon de commande"} ${action === "validate" ? "validé" : "rejeté"}`,
      });

      // Reset form and reload data
      setRejectionReason("");
      setSelectedRecord(null);
      loadPendingItems();
      loadValidationHistory();
    } catch (error) {
      toast({
        title: "Erreur",
        description: `Impossible de ${action === "validate" ? "valider" : "rejeter"} l'élément`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "urgent": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const getDocumentTypeIcon = (documentType?: string) => {
    return documentType === "command_letter" ? "📄" : "🧾";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tableau de Validation</h2>
          <p className="text-gray-600">
            {userRole} - Niveau {validationLevel}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            <Clock className="inline w-4 h-4 mr-1" />
            Mise à jour: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {canValidateWorkOrders && (
            <TabsTrigger value="work-orders" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Ordres de Travail ({pendingWorkOrders.length})
            </TabsTrigger>
          )}
          {canValidatePurchaseOrders && (
            <TabsTrigger value="purchase-orders" className="flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Bons de Commande ({pendingPurchaseOrders.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        {canValidateWorkOrders && (
          <TabsContent value="work-orders">
            <div className="grid gap-4">
              {pendingWorkOrders.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">Aucun ordre de travail en attente de validation</p>
                  </CardContent>
                </Card>
              ) : (
                pendingWorkOrders.map((workOrder) => (
                  <Card key={workOrder.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{workOrder.orderNumber}</h3>
                            <Badge className={`${getPriorityColor(workOrder.priority)} text-white`}>
                              {workOrder.priority}
                            </Badge>
                          </div>
                          <h4 className="font-medium mb-2">{workOrder.title}</h4>
                          <p className="text-gray-600 mb-3">{workOrder.description}</p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {workOrder.requestedBy}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(workOrder.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          {/* VALIDATION SIMPLE - Pas de commentaire requis */}
                          <Button
                            onClick={() => handleValidation("work_order", workOrder.id, "validate")}
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Valider
                          </Button>
                          
                          {/* REJET - Justification requise */}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="destructive"
                                onClick={() => setSelectedRecord(workOrder)}
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
                                  <label className="text-sm font-medium">Raison du rejet *</label>
                                  <Textarea
                                    placeholder="Expliquez pourquoi vous rejetez cet ordre de travail..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    required
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => setRejectionReason("")}>
                                    Annuler
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={() => handleValidation("work_order", workOrder.id, "reject")}
                                    disabled={loading || !rejectionReason.trim()}
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    Confirmer le rejet
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        )}

        {canValidatePurchaseOrders && (
          <TabsContent value="purchase-orders">
            <div className="grid gap-4">
              {pendingPurchaseOrders.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <AlertCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">Aucun bon de commande en attente de validation</p>
                  </CardContent>
                </Card>
              ) : (
                pendingPurchaseOrders.map((purchaseOrder) => (
                  <Card key={purchaseOrder.id} className="border-l-4 border-l-purple-500">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">
                              {getDocumentTypeIcon(purchaseOrder.documentType)} {purchaseOrder.orderNumber}
                            </h3>
                            <Badge className={`${getPriorityColor(purchaseOrder.priority)} text-white`}>
                              {purchaseOrder.priority}
                            </Badge>
                            {purchaseOrder.documentType && (
                              <Badge variant="outline">
                                {purchaseOrder.documentType === "command_letter" ? "Lettre de Commande" : "Bon de Commande"}
                              </Badge>
                            )}
                          </div>
                          <h4 className="font-medium mb-2">{purchaseOrder.orderType}</h4>
                          <p className="text-gray-600 mb-3">{purchaseOrder.description}</p>
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {purchaseOrder.requestedBy}
                            </div>
                            <div className="flex items-center gap-1">
                              <Euro className="w-4 h-4" />
                              {purchaseOrder.totalAmount} {purchaseOrder.currency}
                            </div>
                            <div>Fournisseur: {purchaseOrder.supplier}</div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Livraison: {new Date(purchaseOrder.deliveryDate).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          {/* VALIDATION SIMPLE - Pas de commentaire requis */}
                          <Button
                            onClick={() => handleValidation("purchase_order", purchaseOrder.id, "validate")}
                            disabled={loading}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Valider
                          </Button>
                          
                          {/* REJET - Justification requise */}
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="destructive"
                                onClick={() => setSelectedRecord(purchaseOrder)}
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
                                  <label className="text-sm font-medium">Raison du rejet *</label>
                                  <Textarea
                                    placeholder="Expliquez pourquoi vous rejetez ce bon de commande..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    required
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => setRejectionReason("")}>
                                    Annuler
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={() => handleValidation("purchase_order", purchaseOrder.id, "reject")}
                                    disabled={loading || !rejectionReason.trim()}
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    Confirmer le rejet
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Historique des Validations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {validationHistory.length === 0 ? (
                  <p className="text-gray-600 text-center py-4">Aucun historique de validation</p>
                ) : (
                  validationHistory.slice(0, 10).map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">
                          {log.recordType === "work_order" ? "Ordre de travail" : "Bon de commande"} #{log.recordId}
                        </span>
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${
                          log.action === "validate" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                          {log.action === "validate" ? "Validé" : "Rejeté"}
                        </span>
                        {log.comments && (
                          <p className="text-sm text-gray-600 mt-1">Raison: {log.comments}</p>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(log.validationDate).toLocaleString()}
                      </div>
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
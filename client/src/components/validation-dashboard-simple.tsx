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
import { useAuth } from "@/hooks/useAuth";
import { libelleRole } from "@shared/roles";

/**
 * Tableau de validation — ordres de travail et bons de commande.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ
 * ═══════════════════════════════════════════════════════════════════
 * Ce composant recevait son utilisateur en PROPRIÉTÉS, et l'écran qui
 * l'affichait les écrivait toutes en dur :
 *
 *     userId={1} userRole="Chef de Service" validationLevel={1}
 *     canValidateWorkOrders={true} canValidatePurchaseOrders={true}
 *
 * Donc : tout le monde était l'utilisateur n° 1 ; « Chef de Service » n'existe
 * dans aucune nomenclature du dépôt (voir shared/roles.ts, dont l'en-tête cite
 * déjà `manager` et `supervisor` comme valeurs fantômes du même genre) ; et les
 * deux droits de validation étaient accordés à quiconque ouvrait l'écran.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI PLUS AUCUNE PROPRIÉTÉ D'IDENTITÉ
 * ═══════════════════════════════════════════════════════════════════
 * Le composant lit lui-même la session (`useAuth`). Une propriété peut être
 * recodée en dur par le prochain appelant — c'est précisément ce qui est arrivé
 * ici ; une session, non. Le serveur ne croit de toute façon plus un mot de ce
 * que l'écran lui envoie sur l'identité ou le niveau
 * (server/simple-validation-routes.ts) : ce que cet écran affiche n'est donc
 * plus qu'un reflet, et il doit être exact.
 */

interface WorkOrder {
  id: number;
  orderNumber: string;
  title: string;
  description: string;
  priority: string;
  requestedBy: string;
  createdAt: string;
  status: string;
  /** Le niveau que CE document attend, tel que le serveur l'a calculé. */
  niveauAttendu?: number;
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
  deliveryDate: string | null;
  documentType?: string;
  /** Le niveau que CE document attend, tel que le serveur l'a calculé. */
  niveauAttendu?: number;
}

interface ValidationLog {
  id: number;
  recordType: string;
  recordId: number;
  validationLevel: number;
  action: string;
  validatedBy: number;
  comments?: string;
  validationDate: string;
}

/**
 * Le motif lisible d'un refus serveur.
 *
 * `apiRequest` lève `new Error('403: {"error":…,"message":"…"}')` : afficher la
 * chaîne brute mettrait du JSON dans une notification. On en extrait la phrase,
 * pour que « niveau insuffisant » ou « plafond dépassé » arrive jusqu'à la
 * personne qui vient de cliquer.
 */
function motifDuRefus(erreur: unknown): string | null {
  if (!(erreur instanceof Error) || !erreur.message) return null;
  const corps = erreur.message.replace(/^\d{3}:\s*/, "").trim();
  try {
    const json = JSON.parse(corps);
    if (typeof json?.message === "string" && json.message) return json.message;
  } catch { /* corps non JSON */ }
  return corps && corps.length < 200 ? corps : null;
}

export default function ValidationDashboard() {
  const { user } = useAuth();

  // Tout est dérivé de la session. `?? 0` et `=== true` plutôt qu'un repli
  // permissif : un champ absent vaut « aucun droit », jamais « tous les droits ».
  const validationLevel = user?.validationLevel ?? 0;
  const canValidateWorkOrders = user?.canValidateWorkOrders === true;
  const canValidatePurchaseOrders = user?.canValidatePurchaseOrders === true;
  const userId = user?.id;

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
      // `validatorId` et `validationLevel` ne sont PLUS envoyés en paramètres :
      // le serveur lit l'un et l'autre sur la session. Les laisser suggérerait
      // qu'ils pèsent encore sur la réponse.
      if (canValidateWorkOrders) {
        const workOrdersResponse = await apiRequest("/api/validation/work-orders/pending");
        setPendingWorkOrders(workOrdersResponse);
      }

      if (canValidatePurchaseOrders) {
        const purchaseOrdersResponse = await apiRequest("/api/validation/purchase-orders/pending");
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
      const response = await apiRequest("/api/validation/statistics");
      setValidationHistory(response.logs || []);
    } catch (error) {
      console.error("Error loading validation history:", error);
      setValidationHistory([]);
    }
  };

  const handleValidation = async (
    recordType: "work_order" | "purchase_order",
    recordId: number,
    action: "validate" | "reject",
    niveauDuDocument?: number,
  ) => {
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

      const reponse = await apiRequest(endpoint, {
        method: "POST",
        body: {
          [`${recordType.replace("_", "")}Id`]: recordId,
          action,
          // Le niveau que le SERVEUR a annoncé pour ce document, et non celui
          // du profil : un document peut attendre un échelon inférieur à celui
          // qu'on détient. `validatorId` n'est plus envoyé — l'identité de
          // l'approbateur est celle de la session, et c'est elle qui est
          // inscrite dans `levelNValidatedBy`.
          validationLevel: niveauDuDocument ?? validationLevel,
          comments: action === "reject" ? rejectionReason : undefined // Pas de commentaire pour validation
        }
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
      return reponse;
    } catch (error) {
      // Le serveur refuse désormais pour des raisons PRÉCISES — habilitation
      // absente, niveau insuffisant, étape inattendue, plafond dépassé. Les
      // noyer dans « Impossible de valider » rendrait le refus incompréhensible
      // à la personne qui le reçoit.
      const motif = motifDuRefus(error);
      toast({
        title: action === "validate" ? "Validation refusée" : "Rejet refusé",
        description: motif ?? `Impossible de ${action === "validate" ? "valider" : "rejeter"} l'élément`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case "urgent": return "bg-etat-critique-vif";
      case "high": return "bg-etat-alerte-vif";
      case "medium": return "bg-etat-alerte-vif";
      case "low": return "bg-etat-nominal-vif";
      default: return "bg-gray-500";
    }
  };

  /**
   * ⚠️ Les deux branches renvoyaient la chaîne vide : le numéro de commande
   * s'affichait précédé d'un espace, sans aucun repère de type. On rend un
   * libellé court, lisible aussi par un lecteur d'écran — ce qu'une icône
   * seule n'aurait pas fait.
   */
  const libelleTypeDocument = (documentType?: string) =>
    documentType === "command_letter" ? "Lettre" : "Bon";

  /**
   * Un compte sans habilitation le lit, au lieu de voir trois onglets vides.
   *
   * C'est l'état par défaut en base : `validation_level` vaut 0 et les deux
   * drapeaux `false` tant qu'un administrateur ne les a pas accordés. L'écran
   * contournait ce cas en se déclarant lui-même habilité.
   */
  if (!userId) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Clock className="w-10 h-10 mx-auto text-ink-mute mb-3" />
          <p className="text-ink-soft">Chargement de votre profil…</p>
        </CardContent>
      </Card>
    );
  }

  if (!canValidateWorkOrders && !canValidatePurchaseOrders) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-10 h-10 mx-auto text-ink-mute mb-3" />
          <p className="font-medium">Votre compte ne porte aucun droit de validation.</p>
          <p className="text-ink-soft mt-2">
            {libelleRole(user?.role)} — niveau de validation {validationLevel}. Les droits
            d'approbation des ordres de travail et des bons de commande sont attribués par
            un administrateur de votre organisation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Tableau de Validation</h2>
          {/* Le rôle passe par `libelleRole()` : il affichait « Chef de Service »,
              une valeur hors référentiel reçue en propriété codée en dur. */}
          <p className="text-ink-soft">
            {libelleRole(user?.role)} — Niveau {validationLevel}
            {user?.maxPurchaseAmount
              ? ` — plafond d'approbation ${user.maxPurchaseAmount} EUR`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-ink-soft">
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
                    <AlertCircle className="w-12 h-12 mx-auto text-ink-mute mb-4" />
                    <p className="text-ink-soft">Aucun ordre de travail en attente de validation</p>
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
                          <p className="text-ink-soft mb-3">{workOrder.description}</p>
                          <div className="flex items-center gap-4 text-sm text-ink-mute">
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
                            onClick={() => handleValidation("work_order", workOrder.id, "validate", workOrder.niveauAttendu)}
                            disabled={loading}
                            className="bg-etat-nominal-vif hover:bg-etat-nominal-vif"
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
                                    onClick={() => handleValidation("work_order", workOrder.id, "reject", workOrder.niveauAttendu)}
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
                    <AlertCircle className="w-12 h-12 mx-auto text-ink-mute mb-4" />
                    <p className="text-ink-soft">Aucun bon de commande en attente de validation</p>
                  </CardContent>
                </Card>
              ) : (
                pendingPurchaseOrders.map((purchaseOrder) => (
                  <Card key={purchaseOrder.id} className="border-l-4 border-l-signal">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">
                              <span className="font-mono text-xs text-ink-mute mr-1.5">{libelleTypeDocument(purchaseOrder.documentType)}</span>{purchaseOrder.orderNumber}
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
                          <p className="text-ink-soft mb-3">{purchaseOrder.description}</p>
                          <div className="grid grid-cols-2 gap-4 text-sm text-ink-mute">
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
                              {/* La date venait d'un `Date.now() + 10 jours` calculé par le
                                  serveur à chaque appel : une livraison inventée, qui se
                                  décalait d'un jour par jour. C'est `expected_delivery` qui
                                  est lu maintenant, et son absence s'affiche comme absente. */}
                              Livraison: {purchaseOrder.deliveryDate
                                ? new Date(purchaseOrder.deliveryDate).toLocaleDateString()
                                : "non renseignée"}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          {/* VALIDATION SIMPLE - Pas de commentaire requis */}
                          <Button
                            onClick={() => handleValidation("purchase_order", purchaseOrder.id, "validate", purchaseOrder.niveauAttendu)}
                            disabled={loading}
                            className="bg-etat-nominal-vif hover:bg-etat-nominal-vif"
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
                                    onClick={() => handleValidation("purchase_order", purchaseOrder.id, "reject", purchaseOrder.niveauAttendu)}
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
                  <p className="text-ink-soft text-center py-4">Aucun historique de validation</p>
                ) : (
                  validationHistory.slice(0, 10).map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-paper rounded">
                      <div>
                        <span className="font-medium">
                          {log.recordType === "work_order" ? "Ordre de travail" : "Bon de commande"} #{log.recordId}
                        </span>
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${
                          log.action === "validate" ? "bg-etat-nominal-fond text-etat-nominal-texte" : "bg-etat-critique-fond text-etat-critique-texte"
                        }`}>
                          {log.action === "validate" ? "Validé" : "Rejeté"}
                        </span>
                        {/* Le niveau et l'approbateur viennent de `validation_logs`.
                            Cet onglet affichait deux entrées écrites en dur, datées de
                            l'instant de l'affichage et attribuées au validateur n° 1. */}
                        <span className="ml-2 text-xs text-ink-mute">
                          niveau {log.validationLevel} · compte n° {log.validatedBy}
                        </span>
                        {log.comments && (
                          <p className="text-sm text-ink-soft mt-1">Raison: {log.comments}</p>
                        )}
                      </div>
                      <div className="text-sm text-ink-mute">
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
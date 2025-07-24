import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
// Using native HTML select instead of Radix UI Select to avoid dropdown issues
import { useToast } from "@/hooks/use-toast";
import { FileText, Mail, Calculator, Plus, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

interface DocumentTypeResponse {
  documentType: string;
  validationLevels: number;
  threshold: number;
  commandThreshold: number;
  message: string;
}

export default function PurchaseOrderCreator() {
  const [formData, setFormData] = useState({
    requestedBy: "",
    orderType: "spare_parts",
    title: "",
    description: "",
    totalAmount: "",
    priority: "medium",
    supplier: ""
  });

  const [documentTypeInfo, setDocumentTypeInfo] = useState<DocumentTypeResponse | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const { toast } = useToast();

  // Check document type based on amount
  const checkDocumentType = async (amount: string) => {
    if (!amount || isNaN(parseFloat(amount))) {
      setDocumentTypeInfo(null);
      return;
    }

    setIsCalculating(true);
    try {
      const response = await apiRequest("/api/purchase-orders/document-type", {
        method: "POST",
        body: { amount }
      });
      setDocumentTypeInfo(response);
    } catch (error) {
      console.error("Error checking document type:", error);
    } finally {
      setIsCalculating(false);
    }
  };

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return await apiRequest("/api/purchase-orders", {
        method: "POST",
        body: orderData
      });
    },
    onSuccess: (response) => {
      toast({
        title: "Commande créée",
        description: response.message,
      });
      // Reset form
      setFormData({
        requestedBy: "",
        orderType: "spare_parts",
        title: "",
        description: "",
        totalAmount: "",
        priority: "medium",
        supplier: ""
      });
      setDocumentTypeInfo(null);
    },
    onError: (error) => {
      toast({
        title: "Erreur de création",
        description: "Impossible de créer la commande",
        variant: "destructive",
      });
    }
  });

  const handleAmountBlur = () => {
    if (formData.totalAmount) {
      checkDocumentType(formData.totalAmount);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.requestedBy || !formData.title || !formData.totalAmount) {
      toast({
        title: "Champs obligatoires",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    createOrderMutation.mutate(formData);
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Initier une Demande de Commande
        </CardTitle>
        <p className="text-sm text-gray-600">
          Le service utilisateur initie la commande qui sera automatiquement classifiée selon le montant
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="requestedBy" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Service Utilisateur *
              </Label>
              <Input
                id="requestedBy"
                value={formData.requestedBy}
                onChange={(e) => setFormData(prev => ({ ...prev, requestedBy: e.target.value }))}
                placeholder="Ex: Service Maintenance"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderType">Type de Commande</Label>
              <select
                id="orderType"
                value={formData.orderType}
                onChange={(e) => setFormData(prev => ({ ...prev, orderType: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="spare_parts">Pièces de rechange</option>
                <option value="services">Services</option>
                <option value="maintenance">Maintenance</option>
                <option value="supplies">Fournitures</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Objet de la Commande *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Roulements pour équipement de production"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description Détaillée</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Décrivez les détails techniques, quantités, spécifications..."
              rows={4}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="totalAmount" className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Montant Total (€) *
              </Label>
              <Input
                id="totalAmount"
                type="number"
                step="0.01"
                min="0"
                value={formData.totalAmount}
                onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: e.target.value }))}
                onBlur={handleAmountBlur}
                placeholder="0.00"
                required
              />
              
              {/* Document Type Display */}
              {isCalculating && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  Calcul du type de document...
                </div>
              )}
              
              {documentTypeInfo && (
                <div className="p-3 rounded-lg border bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Type de Document:</span>
                    <Badge className={`${
                      documentTypeInfo.documentType === "purchase_order" 
                        ? "bg-blue-500" 
                        : "bg-purple-500"
                    } text-white`}>
                      {documentTypeInfo.documentType === "purchase_order" ? (
                        <>
                          <FileText className="h-3 w-3 mr-1" />
                          Bon de Commande
                        </>
                      ) : (
                        <>
                          <Mail className="h-3 w-3 mr-1" />
                          Lettre de Commande
                        </>
                      )}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600">{documentTypeInfo.message}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Niveaux de validation requis: {documentTypeInfo.validationLevels}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priorité</Label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="urgent">Urgent</option>
                <option value="high">Haute</option>
                <option value="medium">Moyenne</option>
                <option value="low">Faible</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier">Fournisseur Suggéré</Label>
            <Input
              id="supplier"
              value={formData.supplier}
              onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
              placeholder="Ex: Roulement Industriel SA"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFormData({
                  requestedBy: "",
                  orderType: "spare_parts",
                  title: "",
                  description: "",
                  totalAmount: "",
                  priority: "medium",
                  supplier: ""
                });
                setDocumentTypeInfo(null);
              }}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={createOrderMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createOrderMutation.isPending ? "Création..." : "Créer la Demande"}
            </Button>
          </div>
        </form>

        {/* Information Panel */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">Processus de Validation</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• <strong>Bon de Commande</strong> (≤ 1500€): Validation standard (Chef Service → Directeur)</p>
            <p>• <strong>Lettre de Commande</strong> (&gt; 1500€): Validation renforcée avec approbation spéciale</p>
            <p>• Une fois validé, le document retourne au Service Achat pour impression et envoi</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
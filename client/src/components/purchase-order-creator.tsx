import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
// Using native HTML select instead of Radix UI Select to avoid dropdown issues
import { useToast } from "@/hooks/use-toast";
import { FileText, Mail, Calculator, Plus, User, Upload, X, File } from "lucide-react";
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
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
    onSuccess: async (response) => {
      // Upload attachments if any
      if (selectedFiles.length > 0 && response.id) {
        await uploadAttachments(response.id);
      }
      
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
      setSelectedFiles([]);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file count (max 5)
    if (selectedFiles.length + files.length > 5) {
      toast({
        title: "Trop de fichiers",
        description: "Maximum 5 fichiers autorisés par bon de commande",
        variant: "destructive",
      });
      return;
    }

    // Validate file sizes (max 10MB each)
    const invalidFiles = files.filter(f => f.size > 10 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      toast({
        title: "Fichier trop volumineux",
        description: "Taille maximale : 10MB par fichier",
        variant: "destructive",
      });
      return;
    }

    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (orderId: number) => {
    if (selectedFiles.length === 0) return;

    setIsUploadingAttachments(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('attachments', file);
      });

      const response = await fetch(`/api/procurement/purchase-orders/${orderId}/attachments`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      toast({
        title: "Pièces justificatives uploadées",
        description: result.message,
      });
    } catch (error) {
      console.error("Error uploading attachments:", error);
      toast({
        title: "Erreur d'upload",
        description: "Impossible d'uploader les pièces justificatives",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAttachments(false);
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

          {/* Section Pièces Justificatives */}
          <div className="space-y-3 border-t pt-4">
            <Label className="flex items-center gap-2 text-base font-semibold">
              <Upload className="h-5 w-5 text-purple-600" />
              Pièces Justificatives (Optionnel)
            </Label>
            <p className="text-sm text-gray-600">
              Joindre des documents (devis, spécifications techniques, photos, etc.)
            </p>

            <div className="space-y-3">
              {/* Upload Button */}
              <div>
                <input
                  type="file"
                  id="attachments"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="input-attachments"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('attachments')?.click()}
                  className="w-full border-dashed border-2 hover:border-purple-500"
                  data-testid="button-upload-attachments"
                  disabled={selectedFiles.length >= 5}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Ajouter des fichiers ({selectedFiles.length}/5)
                </Button>
                <p className="text-xs text-gray-500 mt-1">
                  Formats acceptés : PDF, Word, Excel, Images (max 10MB par fichier)
                </p>
              </div>

              {/* Files List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Fichiers sélectionnés :</Label>
                  {selectedFiles.map((file, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                      data-testid={`file-item-${index}`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <File className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                        data-testid={`button-remove-file-${index}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                setSelectedFiles([]);
              }}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={createOrderMutation.isPending || isUploadingAttachments}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-submit-purchase-order"
            >
              {createOrderMutation.isPending || isUploadingAttachments ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-white mr-2"></div>
                  {isUploadingAttachments ? "Upload..." : "Création..."}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer la Demande
                  {selectedFiles.length > 0 && (
                    <Badge className="ml-2 bg-purple-500">
                      +{selectedFiles.length}
                    </Badge>
                  )}
                </>
              )}
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
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings, Euro, FileText, Mail, Save } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface ThresholdConfig {
  id?: number;
  purchaseOrderThreshold: string;
  commandLetterThreshold: string;
}

export default function ThresholdConfiguration() {
  const [purchaseOrderThreshold, setPurchaseOrderThreshold] = useState("1500.00");
  const [commandLetterThreshold, setCommandLetterThreshold] = useState("1500.01");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current configuration
  const { data: companyConfig, isLoading } = useQuery({
    queryKey: ["/api/company-config"],
  });

  useEffect(() => {
    if (companyConfig) {
      setPurchaseOrderThreshold((companyConfig as any).purchaseOrderThreshold || "1500.00");
      setCommandLetterThreshold((companyConfig as any).commandLetterThreshold || "1500.01");
    }
  }, [companyConfig]);

  // Update configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (data: ThresholdConfig) => {
      return await apiRequest("/api/company-config", {
        method: "POST",
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({
        title: "Configuration mise à jour",
        description: "Les seuils de montant ont été sauvegardés avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/company-config"] });
    },
    onError: (error) => {
      toast({
        title: "Erreur de sauvegarde",
        description: "Impossible de sauvegarder la configuration",
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    const purchaseThreshold = parseFloat(purchaseOrderThreshold);
    const commandThreshold = parseFloat(commandLetterThreshold);

    if (isNaN(purchaseThreshold) || isNaN(commandThreshold)) {
      toast({
        title: "Valeurs invalides",
        description: "Veuillez entrer des montants valides",
        variant: "destructive",
      });
      return;
    }

    if (commandThreshold <= purchaseThreshold) {
      toast({
        title: "Seuil invalide",
        description: "Le seuil de lettre de commande doit être supérieur au seuil de bon de commande",
        variant: "destructive",
      });
      return;
    }

    updateConfigMutation.mutate({
      ...(companyConfig || {}),
      purchaseOrderThreshold: purchaseOrderThreshold,
      commandLetterThreshold: commandLetterThreshold,
    });
  };

  const getDocumentType = (amount: number) => {
    const purchaseThreshold = parseFloat(purchaseOrderThreshold);
    const commandThreshold = parseFloat(commandLetterThreshold);
    
    if (amount <= purchaseThreshold) {
      return { type: "Bon de Commande", color: "bg-blue-500", icon: FileText };
    } else if (amount >= commandThreshold) {
      return { type: "Lettre de Commande", color: "bg-purple-500", icon: Mail };
    } else {
      return { type: "Zone de transition", color: "bg-yellow-500", icon: Settings };
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuration des Seuils de Montant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-800 mb-2">Principe de Fonctionnement</h4>
            <p className="text-sm text-blue-700">
              Le service utilisateur initie une demande de commande (service ou pièce de rechange). 
              Selon le montant, le système génère automatiquement soit un <strong>Bon de Commande</strong> 
              (montant ≤ seuil), soit une <strong>Lettre de Commande</strong> (montant &gt; seuil).
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="purchaseThreshold" className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Seuil Maximum Bon de Commande (€)
              </Label>
              <Input
                id="purchaseThreshold"
                type="number"
                step="0.01"
                min="0"
                value={purchaseOrderThreshold}
                onChange={(e) => setPurchaseOrderThreshold(e.target.value)}
                className="text-lg font-medium"
              />
              <p className="text-xs text-gray-600">
                Montants de 0€ à {purchaseOrderThreshold}€ → Bon de Commande
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commandThreshold" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-purple-600" />
                Seuil Minimum Lettre de Commande (€)
              </Label>
              <Input
                id="commandThreshold"
                type="number"
                step="0.01"
                min="0"
                value={commandLetterThreshold}
                onChange={(e) => setCommandLetterThreshold(e.target.value)}
                className="text-lg font-medium"
              />
              <p className="text-xs text-gray-600">
                Montants ≥ {commandLetterThreshold}€ → Lettre de Commande
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={handleSave}
              disabled={updateConfigMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateConfigMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Simulation Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Exemples de Classification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { amount: 750, description: "Pièces de rechange standard" },
              { amount: 1200, description: "Maintenance préventive" },
              { amount: 2500, description: "Réparation majeure" },
              { amount: 5000, description: "Équipement industriel" },
              { amount: 850, description: "Consommables atelier" },
              { amount: 3200, description: "Service externe spécialisé" }
            ].map((example, index) => {
              const docType = getDocumentType(example.amount);
              const Icon = docType.icon;
              
              return (
                <div key={index} className="p-4 border rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-lg">{example.amount}€</span>
                    <Badge className={`${docType.color} text-white`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {docType.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{example.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Current Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5" />
            Configuration Actuelle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium text-blue-800">Bons de Commande</h4>
              </div>
              <p className="text-2xl font-bold text-blue-600">0€ - {purchaseOrderThreshold}€</p>
              <p className="text-sm text-blue-700 mt-1">
                Validation standard - Processus accéléré
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-5 w-5 text-purple-600" />
                <h4 className="font-medium text-purple-800">Lettres de Commande</h4>
              </div>
              <p className="text-2xl font-bold text-purple-600">≥ {commandLetterThreshold}€</p>
              <p className="text-sm text-purple-700 mt-1">
                Validation renforcée - Approbation spéciale
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, FileSpreadsheet, Database } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProcessingResult {
  success: boolean;
  message: string;
  data: {
    equipments: number;
    diagnostics: number;
    procedures: number;
    crossReferences: number;
  };
}

export function ExcelProcessorDemo() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const { toast } = useToast();

  const processExcelFile = async () => {
    setIsProcessing(true);
    try {
      const response = await apiRequest("POST", "/api/diagnostic/process-excel-sheets", {});
      const data = await response.json();
      
      setResult(data);
      
      if (data.success) {
        toast({
          title: "✅ Fichier Excel traité avec succès",
          description: `${data.data.crossReferences} cas croisés créés`,
        });
      } else {
        toast({
          title: "❌ Erreur de traitement",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "❌ Erreur réseau",
        description: "Impossible de traiter le fichier Excel",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Traitement Fichier Excel Multi-Tables
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          <p>📊 <strong>Fichier:</strong> Base_Industrie_120_Cas_Enrichie_1754590391833.xlsx</p>
          <p>📋 <strong>Tables:</strong> Équipements, Diagnostics, Interventions, Techniciens, Règles_Symptômes, Procédures_Réparation</p>
          <p>🔗 <strong>Traitement:</strong> Croisement automatique des données pour enrichir l'historique diagnostic</p>
        </div>

        <Button 
          onClick={processExcelFile}
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              Traitement en cours...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Traiter et Importer les Données
            </div>
          )}
        </Button>

        {result && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50">
            <div className="flex items-center gap-2 mb-3">
              {result.success ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Traitement réussi</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-800">Traitement échoué</span>
                </>
              )}
            </div>

            <p className="text-sm mb-3">{result.message}</p>

            {result.success && (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Équipements:</span>
                  <Badge variant="secondary">{result.data.equipments}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Diagnostics:</span>
                  <Badge variant="secondary">{result.data.diagnostics}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Procédures:</span>
                  <Badge variant="secondary">{result.data.procedures}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Cas croisés:</span>
                  <Badge variant="default">{result.data.crossReferences}</Badge>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded">
          <p><strong>💡 Fonctionnement du système:</strong></p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Analyse croisée: Équipements → Diagnostics → Procédures</li>
            <li>Enrichissement automatique de l'historique</li>
            <li>Si symptômes introuvables → diagnostic IA cloud</li>
            <li>Retour technicien → enrichit la base historique</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Upload, 
  Database, 
  CheckCircle, 
  AlertCircle, 
  FileSpreadsheet,
  Factory,
  Wrench,
  Package,
  TrendingUp,
  BarChart3
} from "lucide-react";

export default function DataImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const handleImportIndustrialData = async () => {
    setIsImporting(true);
    setProgress(0);
    setImportResult(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await apiRequest("POST", "/api/import/industrial-data");
      
      clearInterval(progressInterval);
      setProgress(100);
      
      setImportResult(response);
      
      toast({
        title: "Importation réussie",
        description: `${response.data.equipment} équipements, ${response.data.workOrders} ordres de travail et ${response.data.spareParts} pièces importés`,
      });

    } catch (error: any) {
      console.error("Import error:", error);
      toast({
        title: "Erreur d'importation",
        description: error.message || "Une erreur s'est produite lors de l'importation",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Importation des Données Industrielles
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Complétez votre base de données avec 120 cas industriels enrichis
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Import Section */}
          <Card className="border-0 shadow-2xl">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <CardTitle className="flex items-center text-2xl">
                <FileSpreadsheet className="w-6 h-6 mr-3" />
                Fichier Excel Détecté
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-500">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    Base_Industrie_120_Cas_Enrichie.xlsx
                  </h3>
                  <p className="text-blue-700 text-sm">
                    Fichier détecté contenant 120 cas industriels avec équipements, 
                    interventions et données de maintenance complètes
                  </p>
                </div>

                {isImporting && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Importation en cours...</span>
                      <span className="text-sm text-gray-500">{progress}%</span>
                    </div>
                    <Progress value={progress} className="w-full" />
                  </div>
                )}

                <Button 
                  onClick={handleImportIndustrialData}
                  disabled={isImporting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6"
                >
                  {isImporting ? (
                    <>
                      <Database className="w-5 h-5 mr-2 animate-spin" />
                      Importation en cours...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Lancer l'Importation
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Section */}
          <Card className="border-0 shadow-2xl">
            <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white">
              <CardTitle className="flex items-center text-2xl">
                <BarChart3 className="w-6 h-6 mr-3" />
                Résultats d'Importation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              {importResult ? (
                <div className="space-y-6">
                  <div className="flex items-center p-4 bg-green-50 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
                    <div>
                      <p className="font-semibold text-green-900">Importation réussie !</p>
                      <p className="text-sm text-green-700">Toutes les données ont été traitées</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg text-center">
                      <Factory className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-900">{importResult.data.equipment}</p>
                      <p className="text-sm text-blue-700">Équipements</p>
                    </div>
                    
                    <div className="bg-purple-50 p-4 rounded-lg text-center">
                      <Wrench className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-purple-900">{importResult.data.workOrders}</p>
                      <p className="text-sm text-purple-700">Ordres de Travail</p>
                    </div>
                    
                    <div className="bg-orange-50 p-4 rounded-lg text-center col-span-2">
                      <Package className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-orange-900">{importResult.data.spareParts}</p>
                      <p className="text-sm text-orange-700">Pièces Détachées</p>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <Button asChild className="flex-1 bg-blue-600 hover:bg-blue-700">
                      <a href="/equipment">
                        <Factory className="w-4 h-4 mr-2" />
                        Voir Équipements
                      </a>
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <a href="/work-orders">
                        <Wrench className="w-4 h-4 mr-2" />
                        Voir Ordres
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Database className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Aucune importation effectuée</p>
                  <p className="text-sm">Cliquez sur "Lancer l'Importation" pour commencer</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Data Preview */}
        <Card className="mt-8 border-0 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center text-2xl">
              <TrendingUp className="w-6 h-6 mr-3" />
              Aperçu des Données à Importer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg">
                <Factory className="w-8 h-8 text-blue-600 mb-3" />
                <h3 className="font-semibold text-blue-900 mb-2">Équipements Industriels</h3>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Moteurs et pompes</li>
                  <li>• Compresseurs</li>
                  <li>• Systèmes électriques</li>
                  <li>• Équipements de production</li>
                </ul>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg">
                <Wrench className="w-8 h-8 text-purple-600 mb-3" />
                <h3 className="font-semibold text-purple-900 mb-2">Interventions Maintenance</h3>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>• Maintenance préventive</li>
                  <li>• Réparations urgentes</li>
                  <li>• Remplacements planifiés</li>
                  <li>• Diagnostics approfondis</li>
                </ul>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg">
                <Package className="w-8 h-8 text-green-600 mb-3" />
                <h3 className="font-semibold text-green-900 mb-2">Pièces & Ressources</h3>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Pièces détachées</li>
                  <li>• Outils spécialisés</li>
                  <li>• Consommables</li>
                  <li>• Matériel de sécurité</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
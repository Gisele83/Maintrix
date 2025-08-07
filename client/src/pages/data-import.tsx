import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
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
  BarChart3,
  CloudUpload,
  FileText
} from "lucide-react";

export default function DataImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'free' | 'premium'>('premium'); // Pour la démo, on considère l'utilisateur comme premium
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

      // Use the correct Excel processing endpoint
      const response = await fetch("/api/diagnostic/process-excel-sheets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      clearInterval(progressInterval);
      setProgress(100);
      
      console.log("Import API response:", result);
      
      if (result && result.success) {
        // Transform the result to match expected format
        const transformedResult = {
          success: true,
          data: {
            equipment: result.data?.equipments || 0,
            workOrders: result.data?.diagnostics || 0,
            spareParts: result.data?.procedures || 0,
            maintenanceCases: result.data?.crossReferences || 0
          }
        };
        
        setImportResult(transformedResult);
        
        toast({
          title: "✅ Importation réussie",
          description: `${transformedResult.data.equipment} équipements, ${transformedResult.data.workOrders} diagnostics, ${transformedResult.data.spareParts} procédures et ${transformedResult.data.maintenanceCases} cas croisés importés`,
        });
      } else {
        throw new Error(result?.message || "Réponse API invalide");
      }

    } catch (error: any) {
      console.error("Import error:", error);
      setProgress(0);
      toast({
        title: "❌ Erreur d'importation",
        description: error.message || "Une erreur s'est produite lors de l'importation Excel",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "❌ Fichier manquant",
        description: "Veuillez sélectionner un fichier Excel à importer",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingFile(true);
    setProgress(0);
    setImportResult(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('excelFile', selectedFile);

      const response = await fetch('/api/diagnostic/upload-excel', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        let errorMessage = `Erreur serveur ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage += `: ${errorData.message || errorData.error || response.statusText}`;
        } catch {
          errorMessage += `: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log("Upload API response:", result);

      if (result && result.success) {
        // Transform the result to match expected format
        const transformedResult = {
          success: true,
          data: {
            equipment: result.data?.equipments || 0,
            workOrders: result.data?.diagnostics || 0,
            spareParts: result.data?.procedures || 0,
            maintenanceCases: result.data?.crossReferences || 0
          }
        };
        
        setImportResult(transformedResult);
        
        toast({
          title: "✅ Importation fichier réussie",
          description: `${transformedResult.data.equipment} équipements, ${transformedResult.data.workOrders} diagnostics, ${transformedResult.data.spareParts} procédures et ${transformedResult.data.maintenanceCases} cas importés depuis votre fichier`,
        });

        // Reset file selection
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        throw new Error(result?.message || "Réponse API invalide");
      }

    } catch (error: any) {
      console.error("Upload error:", error);
      setProgress(0);
      toast({
        title: "❌ Erreur d'importation fichier",
        description: error.message || "Une erreur s'est produite lors de l'importation de votre fichier Excel",
        variant: "destructive",
      });
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') || 
          file.name.endsWith('.xls')) {
        setSelectedFile(file);
        toast({
          title: "✅ Fichier sélectionné",
          description: `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`,
        });
      } else {
        toast({
          title: "❌ Format invalide",
          description: "Veuillez sélectionner un fichier Excel (.xlsx ou .xls)",
          variant: "destructive",
        });
        event.target.value = '';
      }
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
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-6">
            Complétez votre base de données avec 120 cas industriels enrichis
          </p>
          
          {/* Demo Toggle for Subscription Status */}
          <div className="flex justify-center mb-4">
            <div className="bg-white border rounded-lg p-2 flex items-center shadow-sm">
              <span className="text-sm text-gray-600 mr-3">Mode Démo:</span>
              <Button
                onClick={() => setSubscriptionStatus(subscriptionStatus === 'free' ? 'premium' : 'free')}
                variant={subscriptionStatus === 'premium' ? 'default' : 'outline'}
                className="text-xs"
              >
                {subscriptionStatus === 'premium' ? '👑 Premium' : '🔒 Gratuit'}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Demo Data Import Section */}
          <Card className="border-0 shadow-2xl">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <CardTitle className="flex items-center text-xl">
                <FileSpreadsheet className="w-5 h-5 mr-3" />
                Données Démo
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
                  disabled={isImporting || isUploadingFile}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-sm py-4"
                >
                  {isImporting ? (
                    <>
                      <Database className="w-4 h-4 mr-2 animate-spin" />
                      Importation...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Importer Démo
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* User File Upload Section */}
          <Card className="border-0 shadow-2xl">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
              <CardTitle className="flex items-center text-xl">
                <CloudUpload className="w-5 h-5 mr-3" />
                Vos Données
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {subscriptionStatus === 'premium' ? (
                  <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
                    <h3 className="font-semibold text-purple-900 mb-2 flex items-center">
                      <Badge className="bg-purple-600 text-white mr-2">PREMIUM</Badge>
                      Importez votre historique d'équipements
                    </h3>
                    <p className="text-purple-700 text-sm mb-3">
                      En tant qu'abonné Premium, importez vos propres données de maintenance 
                      historiques pour enrichir le système de diagnostic IA avec votre expérience terrain.
                    </p>
                    <div className="text-xs text-purple-600 space-y-1">
                      <p>• Format supporté : Excel (.xlsx, .xls)</p>
                      <p>• Colonnes requises : Équipement, Symptômes, Diagnostic, Solutions</p>
                      <p>• Intégration automatique dans l'IA diagnostique</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
                    <h3 className="font-semibold text-orange-900 mb-2">
                      Fonctionnalité Premium Requise
                    </h3>
                    <p className="text-orange-700 text-sm mb-3">
                      L'importation d'historique d'équipements personnalisé est réservée aux abonnés Premium (19€/mois).
                    </p>
                    <Button 
                      onClick={() => window.location.href = '/pricing'}
                      className="bg-orange-600 hover:bg-orange-700 text-white text-sm"
                    >
                      Voir les Plans Premium
                    </Button>
                  </div>
                )}

                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={handleFileSelection}
                    className="hidden"
                  />
                  
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
                    disabled={subscriptionStatus !== 'premium' || isUploadingFile || isImporting}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    {subscriptionStatus === 'premium' ? 'Sélectionner un fichier Excel' : 'Premium Requis'}
                  </Button>

                  {selectedFile && (
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <div className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-900">{selectedFile.name}</p>
                          <p className="text-xs text-green-700">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {(isUploadingFile || isImporting) && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {isUploadingFile ? "Téléchargement..." : "Importation..."}
                        </span>
                        <span className="text-sm text-gray-500">{progress}%</span>
                      </div>
                      <Progress value={progress} className="w-full" />
                    </div>
                  )}

                  <Button 
                    onClick={handleFileUpload}
                    disabled={subscriptionStatus !== 'premium' || !selectedFile || isUploadingFile || isImporting}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-sm py-4"
                  >
                    {isUploadingFile ? (
                      <>
                        <CloudUpload className="w-4 h-4 mr-2 animate-bounce" />
                        Téléchargement...
                      </>
                    ) : subscriptionStatus !== 'premium' ? (
                      <>
                        <CloudUpload className="w-4 h-4 mr-2" />
                        Abonnement Premium Requis
                      </>
                    ) : (
                      <>
                        <CloudUpload className="w-4 h-4 mr-2" />
                        Importer le Fichier
                      </>
                    )}
                  </Button>
                </div>
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
                    
                    <div className="bg-orange-50 p-4 rounded-lg text-center">
                      <Package className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-orange-900">{importResult.data.spareParts}</p>
                      <p className="text-sm text-orange-700">Pièces Détachées</p>
                    </div>
                    
                    <div className="bg-green-50 p-4 rounded-lg text-center">
                      <BarChart3 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-900">{importResult.data.maintenanceCases}</p>
                      <p className="text-sm text-green-700">Cas Historiques</p>
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
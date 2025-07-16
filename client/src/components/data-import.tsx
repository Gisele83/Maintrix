import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Upload, Download, FileText, AlertCircle, CheckCircle, FileSpreadsheet } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function DataImport() {
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);

  // Mutation pour l'importation CSV de maintenance
  const importMaintenanceCSVMutation = useMutation({
    mutationFn: async (csvContent: string) => {
      const response = await apiRequest("POST", "/api/import/maintenance-csv", { csvContent });
      return await response.json();
    },
    onSuccess: (result) => {
      setImportResults(result);
      toast({
        title: "Importation terminée",
        description: `${result.success} cas de maintenance importés avec succès`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur d'importation",
        description: "Erreur lors de l'importation du fichier CSV",
        variant: "destructive",
      });
    },
  });

  // Mutation pour l'importation CSV de cas signalés
  const importReportedCSVMutation = useMutation({
    mutationFn: async (csvContent: string) => {
      const response = await apiRequest("POST", "/api/import/reported-cases-csv", { csvContent });
      return await response.json();
    },
    onSuccess: (result) => {
      setImportResults(result);
      toast({
        title: "Importation terminée",
        description: `${result.success} cas signalés importés avec succès`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/reported-cases"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur d'importation",
        description: "Erreur lors de l'importation du fichier CSV",
        variant: "destructive",
      });
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileUpload(files[0]);
    }
    // Reset input
    e.target.value = '';
  };

  const handleFileUpload = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Format non supporté",
        description: "Seuls les fichiers CSV sont acceptés pour l'importation",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvContent = e.target?.result as string;
      
      // Détecter le type de fichier basé sur le nom ou contenu
      if (file.name.toLowerCase().includes('maintenance') || file.name.toLowerCase().includes('cas')) {
        importMaintenanceCSVMutation.mutate(csvContent);
      } else if (file.name.toLowerCase().includes('signal') || file.name.toLowerCase().includes('report')) {
        importReportedCSVMutation.mutate(csvContent);
      } else {
        // Par défaut, traiter comme un fichier de maintenance
        importMaintenanceCSVMutation.mutate(csvContent);
      }
    };

    reader.readAsText(file);
  };

  const downloadTemplate = async (type: 'maintenance' | 'reported') => {
    try {
      const endpoint = type === 'maintenance' 
        ? '/api/templates/maintenance-csv' 
        : '/api/templates/reported-cases-csv';
      
      const response = await fetch(endpoint);
      const csvContent = await response.text();
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'maintenance' ? 'template_maintenance.csv' : 'template_cas_signales.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Template téléchargé",
        description: `Template ${type === 'maintenance' ? 'de maintenance' : 'de cas signalés'} téléchargé avec succès`,
      });
    } catch (error) {
      toast({
        title: "Erreur de téléchargement",
        description: "Impossible de télécharger le template",
        variant: "destructive",
      });
    }
  };

  const downloadEquipmentTypes = async () => {
    try {
      const response = await fetch('/api/export/equipment-types');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'equipment_types.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export terminé",
        description: "Types d'équipements exportés avec succès",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur lors de l'export des types d'équipements",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Upload className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Importation de Données</h2>
          <p className="text-muted-foreground">Intégrez l'historique réel de votre entreprise</p>
        </div>
      </div>

      {/* Templates Downloads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              <span>Templates CSV</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Téléchargez les templates CSV pré-formatés pour préparer vos données d'importation.
            </p>
            <div className="space-y-2">
              <Button
                onClick={() => downloadTemplate('maintenance')}
                variant="outline"
                className="w-full justify-start"
              >
                <Download className="w-4 h-4 mr-2" />
                Template Cas de Maintenance
              </Button>
              <Button
                onClick={() => downloadTemplate('reported')}
                variant="outline"
                className="w-full justify-start"
              >
                <Download className="w-4 h-4 mr-2" />
                Template Cas Signalés
              </Button>
              <Button
                onClick={() => downloadEquipmentTypes()}
                variant="outline"
                className="w-full justify-start"
              >
                <Download className="w-4 h-4 mr-2" />
                Types d'Équipements
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Upload Zone */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="w-5 h-5 text-green-600" />
              <span>Zone d'Importation</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-gray-300 hover:border-primary/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">
                Glissez votre fichier CSV ici
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                ou cliquez pour sélectionner un fichier
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  Sélectionner un fichier
                </Button>
              </label>
            </div>

            {(importMaintenanceCSVMutation.isPending || importReportedCSVMutation.isPending) && (
              <div className="mt-4 text-center">
                <div className="inline-flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>Importation en cours...</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-5 h-5" />
            <span>Instructions d'Importation</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-amber-700 dark:text-amber-300">
          <div className="space-y-2">
            <h4 className="font-medium">Préparation des données :</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Téléchargez d'abord le template CSV approprié</li>
              <li>Remplissez vos données historiques en respectant le format</li>
              <li>Utilisez les colonnes en français ou en anglais (système compatible)</li>
              <li>Sauvegardez votre fichier au format CSV</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Types de fichiers supportés :</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Fichiers de maintenance : diagnostics, solutions, durées</li>
              <li>Cas signalés : incidents, problèmes non résolus</li>
              <li>Format CSV uniquement (séparateur : virgule)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {importResults && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Résultats d'Importation</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {importResults.message}
              </AlertDescription>
            </Alert>

            {importResults.hasErrors && (
              <div className="space-y-2">
                <h4 className="font-medium text-destructive">Erreurs détectées :</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {importResults.errors.map((error: any, index: number) => (
                    <div key={index} className="text-sm bg-destructive/10 p-2 rounded">
                      <span className="font-medium">Ligne {error.line}:</span> {error.error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-green-50 dark:bg-green-950 p-3 rounded">
                <div className="font-medium text-green-800 dark:text-green-200">Succès</div>
                <div className="text-2xl font-bold text-green-600">{importResults.success}</div>
              </div>
              <div className="bg-red-50 dark:bg-red-950 p-3 rounded">
                <div className="font-medium text-red-800 dark:text-red-200">Erreurs</div>
                <div className="text-2xl font-bold text-red-600">{importResults.errors?.length || 0}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  Database,
  Package,
  Wrench,
  Settings,
  Users,
  FileX,
  RefreshCw,
  Loader2
} from "lucide-react";

interface ImportProgress {
  total: number;
  processed: number;
  errors: string[];
  warnings: string[];
}

export function HistoryManagement() {
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState("equipment");
  const [exportType, setExportType] = useState("equipment");
  const [isUploading, setIsUploading] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        setSelectedFile(file);
      } else {
        toast({
          title: "Format de fichier non supporté",
          description: "Veuillez sélectionner un fichier Excel (.xlsx, .xls) ou CSV",
          variant: "destructive",
        });
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        title: "Aucun fichier sélectionné",
        description: "Veuillez sélectionner un fichier à importer",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('importType', importType);

    try {
      const response = await fetch('/api/data-import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'importation');
      }

      const result = await response.json();
      
      setImportProgress({
        total: result.total || 0,
        processed: result.processed || 0,
        errors: result.errors || [],
        warnings: result.warnings || []
      });

      toast({
        title: "Importation réussie",
        description: `${result.processed} enregistrements importés avec succès`,
      });

      setIsImportDialogOpen(false);
      setSelectedFile(null);
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Erreur d'importation",
        description: "Une erreur est survenue lors de l'importation du fichier",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/data-export?type=${exportType}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'exportation');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `export_${exportType}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Exportation réussie",
        description: "Les données ont été exportées avec succès",
      });

      setIsExportDialogOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Erreur d'exportation",
        description: "Une erreur est survenue lors de l'exportation",
        variant: "destructive",
      });
    }
  };

  const importTypeOptions = [
    { value: "equipment", label: "Équipements", icon: Settings },
    { value: "spare-parts", label: "Pièces de rechange", icon: Package },
    { value: "work-orders", label: "Ordres de travail", icon: Wrench },
    { value: "users", label: "Utilisateurs", icon: Users },
    { value: "maintenance-history", label: "Historique maintenance", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Gestion de l'Historique</h2>
          <p className="text-muted-foreground">
            Importez et exportez vos données de maintenance et d'équipements
          </p>
        </div>
      </div>

      <Tabs defaultValue="import" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="import" className="flex items-center space-x-2">
            <Upload className="w-4 h-4" />
            <span>Importation</span>
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Exportation</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="w-5 h-5" />
                  <span>Importer des données</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Importez vos données existantes depuis des fichiers Excel ou CSV
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  {importTypeOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <Button
                        key={option.value}
                        variant={importType === option.value ? "default" : "outline"}
                        className="flex flex-col items-center space-y-2 h-20"
                        onClick={() => setImportType(option.value)}
                      >
                        <Icon className="w-6 h-6" />
                        <span className="text-xs text-center">{option.label}</span>
                      </Button>
                    );
                  })}
                </div>

                <Button 
                  onClick={() => setIsImportDialogOpen(true)}
                  className="w-full"
                  data-testid="button-open-import"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Commencer l'importation
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  <span>Formats supportés</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="font-medium">Excel (.xlsx, .xls)</p>
                      <p className="text-xs text-muted-foreground">Format recommandé</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="font-medium">CSV (.csv)</p>
                      <p className="text-xs text-muted-foreground">Séparateur: virgule ou point-virgule</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Database className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="font-medium">Sage Export</p>
                      <p className="text-xs text-muted-foreground">Format d'export Sage compatible</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Conseil:</strong> Vérifiez que vos colonnes correspondent aux champs attendus pour optimiser l'importation.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {importProgress && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span>Résultat de l'importation</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{importProgress.processed}</p>
                    <p className="text-sm text-green-800">Enregistrements traités</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{importProgress.total}</p>
                    <p className="text-sm text-blue-800">Total d'enregistrements</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{importProgress.errors.length}</p>
                    <p className="text-sm text-red-800">Erreurs</p>
                  </div>
                </div>

                {importProgress.errors.length > 0 && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <h4 className="font-medium text-red-800 mb-2">Erreurs d'importation:</h4>
                    <ul className="text-sm text-red-700 space-y-1">
                      {importProgress.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {importProgress.warnings.length > 0 && (
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <h4 className="font-medium text-yellow-800 mb-2">Avertissements:</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      {importProgress.warnings.map((warning, index) => (
                        <li key={index}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Download className="w-5 h-5" />
                  <span>Exporter des données</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Exportez vos données vers des fichiers Excel pour sauvegarde ou transfert
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  {importTypeOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <Button
                        key={option.value}
                        variant={exportType === option.value ? "default" : "outline"}
                        className="flex flex-col items-center space-y-2 h-20"
                        onClick={() => setExportType(option.value)}
                      >
                        <Icon className="w-6 h-6" />
                        <span className="text-xs text-center">{option.label}</span>
                      </Button>
                    );
                  })}
                </div>

                <Button 
                  onClick={() => setIsExportDialogOpen(true)}
                  className="w-full"
                  data-testid="button-open-export"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Commencer l'exportation
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  <span>Options d'exportation</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="font-medium">Export complet</p>
                      <p className="text-xs text-muted-foreground">Toutes les données disponibles</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="font-medium">Format Excel</p>
                      <p className="text-xs text-muted-foreground">Compatible avec Excel et autres tableurs</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="font-medium">Colonnes structurées</p>
                      <p className="text-xs text-muted-foreground">En-têtes clairs et données organisées</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-800">
                    <strong>Info:</strong> L'exportation inclut toutes les données visibles selon vos permissions utilisateur.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Upload className="w-5 h-5" />
              <span>Importer {importTypeOptions.find(opt => opt.value === importType)?.label}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Sélectionner un fichier</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="mt-1"
                data-testid="input-file-upload"
              />
            </div>

            {selectedFile && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">{selectedFile.name}</span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}

            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setIsImportDialogOpen(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button 
                onClick={handleImport}
                disabled={!selectedFile || isUploading}
                className="flex-1"
                data-testid="button-confirm-import"
              >
                {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isUploading ? 'Importation...' : 'Importer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Download className="w-5 h-5" />
              <span>Exporter {importTypeOptions.find(opt => opt.value === exportType)?.label}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                Cette exportation téléchargera toutes les données de type "{importTypeOptions.find(opt => opt.value === exportType)?.label}" au format Excel.
              </p>
            </div>

            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setIsExportDialogOpen(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button 
                onClick={handleExport}
                className="flex-1"
                data-testid="button-confirm-export"
              >
                <Download className="w-4 h-4 mr-2" />
                Exporter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
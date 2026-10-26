import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { uploadFile, apiRequest } from "@/lib/queryClient";
import { ImportReserve, usePeutImporterEnMasse } from "@/components/import-reserve";
import { 
  Upload, 
  Download, 
  FileText, 
  Database, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  FileSpreadsheet,
  Settings,
  BarChart3,
  TrendingUp,
  Shield
} from "lucide-react";
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

interface ImportResult {
  success: boolean;
  imported: number;
  errors: string[];
  warnings: string[];
}

interface ImportHistory {
  id: number;
  type: string;
  dataType: string;
  filename: string;
  status: string;
  recordCount: number;
  timestamp: Date;
  errors: string[];
}

/**
 * Les types réellement traités par le serveur, et PAS les mêmes dans les deux
 * sens (server/data-import-export-routes.ts) : l'import n'en connaît que
 * trois, l'export cinq. Les deux consoles existantes proposaient la même
 * liste des deux côtés — dont « Utilisateurs », qu'aucune des deux routes ne
 * traite. Choisir un type non géré ne produisait rien d'utile.
 */
const TYPES_EXPORT = [
  { value: 'equipments', label: 'Équipements', icon: Settings },
  { value: 'maintenance-history', label: 'Historique de maintenance', icon: Clock },
  { value: 'spare-parts', label: 'Pièces détachées', icon: Database },
  { value: 'iot-data', label: 'Données IoT', icon: TrendingUp },
  { value: 'work-orders', label: 'Ordres de travail', icon: FileText }
];

const TYPES_IMPORT = TYPES_EXPORT.filter((t) =>
  ['equipments', 'maintenance-history', 'spare-parts'].includes(t.value),
);

/** Conservé pour les libellés : l'historique d'import peut citer n'importe quel type. */
const DATA_TYPES = TYPES_EXPORT;

const FORMATS = [
  { value: 'csv', label: 'CSV', extension: '.csv' },
  { value: 'excel', label: 'Excel', extension: '.xlsx' }
];

export default function DataImportExport() {
  const [selectedDataType, setSelectedDataType] = useState('equipments');
  const [selectedFormat, setSelectedFormat] = useState('excel');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const peutImporter = usePeutImporterEnMasse();

  // Récupération de l'historique des imports/exports
  const { data: importHistory, isLoading: historyLoading } = useQuery<ImportHistory[]>({
    queryKey: ['/api/data-import-export/import-history'],
    // `apiRequest` applique le contrôle de `lib/queryClient.ts` : un refus
    // servi en HTTP 200 devient une erreur au lieu d'arriver dans un `.map`.
    queryFn: () => apiRequest('/api/data-import-export/import-history')
  });

  // Mutation pour l'import de données
  const importMutation = useMutation({
    mutationFn: async (formData: FormData): Promise<ImportResult> => {
      setIsUploading(true);
      setUploadProgress(0);
      
      // `uploadFile` pose l'en-tête X-CSRF-Token et `credentials: include`.
      // Un `fetch` brut ne fait ni l'un ni l'autre : depuis F06, la route
      // n'étant plus exemptée de CSRF, l'import serait refusé en 403.
      return (await uploadFile('/api/data-import-export/import', formData)) as ImportResult;
    },
    onSuccess: (result) => {
      setIsUploading(false);
      setUploadProgress(100);
      
      if (result.success) {
        toast({
          title: "Import réussi",
          description: `${result.imported} enregistrements importés avec succès`,
          variant: "default",
        });
        
        if (result.warnings.length > 0) {
          toast({
            title: "Avertissements",
            description: `${result.warnings.length} avertissements générés`,
            variant: "default",
          });
        }
      } else {
        toast({
          title: "Erreur d'import",
          description: `${result.errors.length} erreurs détectées`,
          variant: "destructive",
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/data-import-export/import-history'] });
    },
    onError: (error: Error) => {
      setIsUploading(false);
      setUploadProgress(0);
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Téléchargement des templates
  const downloadTemplate = async (dataType: string, format: string) => {
    try {
      const response = await fetch(`/api/data-import-export/template?type=${dataType}&format=${format}`);
      if (!response.ok) throw new Error('Erreur lors du téléchargement du template');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template_${dataType}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Template téléchargé",
        description: `Template ${dataType} en format ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de télécharger le template",
        variant: "destructive",
      });
    }
  };

  // Export de données
  const exportData = async (dataType: string, format: string) => {
    try {
      const params = new URLSearchParams({ type: dataType, format });
      if (dataType === 'iot-data') {
        params.append('days', '30'); // Derniers 30 jours pour les données IoT
      }
      
      const response = await fetch(`/api/data-import-export/export?${params}`);
      if (!response.ok) throw new Error('Erreur lors de l\'export');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const today = new Date().toISOString().split('T')[0];
      const filename = `export_${dataType}_${today}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export réussi",
        description: `Données ${dataType} exportées en ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'exporter les données",
        variant: "destructive",
      });
    }
  };

  // Gestion de l'upload de fichier
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', selectedDataType);

    // Simulation du progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      setUploadProgress(progress);
      if (progress >= 80) {
        clearInterval(interval);
      }
    }, 200);

    importMutation.mutate(formData);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-etat-nominal-fond text-etat-nominal-texte"><CheckCircle className="w-3 h-3 mr-1" />Succès</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Erreur</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />En cours</Badge>;
    }
  };

  return (
    <AppShell filAriane={[{ libelle: "Données" }, { libelle: "Import et export" }]} largeur="large">
    <div className="space-y-6">
      <div className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-ink mb-4">
            Import/Export de Données GMAO
          </h1>
          <p className="text-xl text-ink-soft max-w-3xl mx-auto">
            Gérez vos données GMAO : importez vos équipements, historiques de maintenance, 
            pièces détachées et exportez vos données pour analyse externe.
          </p>
        </div>

        <Tabs defaultValue="import" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="import" className="flex items-center space-x-2">
              <Upload className="w-4 h-4" />
              <span>Import</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center space-x-2">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Historique</span>
            </TabsTrigger>
          </TabsList>

          {/* Onglet Import */}
          <TabsContent value="import" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Configuration d'import */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Upload className="w-5 h-5" />
                    <span>Configuration d'Import</span>
                  </CardTitle>
                  <CardDescription>
                    Sélectionnez le type de données et le format à importer
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Type de données</label>
                    <Select value={selectedDataType} onValueChange={setSelectedDataType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TYPES_IMPORT.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center space-x-2">
                              <type.icon className="w-4 h-4" />
                              <span>{type.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Format de fichier</label>
                    <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMATS.map((format) => (
                          <SelectItem key={format.value} value={format.value}>
                            {format.label} ({format.extension})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => downloadTemplate(selectedDataType, selectedFormat)}
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Télécharger Template
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Zone d'upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Upload de Fichier</span>
                  </CardTitle>
                  <CardDescription>
                    Glissez-déposez votre fichier ou cliquez pour sélectionner
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!peutImporter ? (
                    <ImportReserve quoi="un fichier de données" />
                  ) : (
                  <div 
                    className="border-2 border-dashed border-rule rounded-lg p-6 text-center hover:border-etat-encours-filet transition-colors cursor-pointer"
                    onClick={triggerFileInput}
                  >
                    <Upload className="w-12 h-12 mx-auto text-ink-mute mb-4" />
                    <p className="text-lg font-medium text-ink-soft mb-2">
                      Cliquez pour sélectionner un fichier
                    </p>
                    <p className="text-sm text-ink-mute">
                      Formats supportés: CSV, Excel (.xlsx)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                  )}

                  {isUploading && (
                    <div className="mt-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span>Upload en cours...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="w-full" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Résultats d'import */}
            {importMutation.data && (
              <Card>
                <CardHeader>
                  <CardTitle>Résultats d'Import</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Statut:</span>
                      {importMutation.data.success ? (
                        <Badge variant="default" className="bg-etat-nominal-fond text-etat-nominal-texte">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Succès
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertCircle className="w-4 h-4 mr-1" />
                          Erreur
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Enregistrements importés:</span>
                      <span className="text-lg font-bold text-etat-nominal-texte">
                        {importMutation.data.imported}
                      </span>
                    </div>

                    {importMutation.data.errors.length > 0 && (
                      <div>
                        <h4 className="font-medium text-etat-critique-texte mb-2">Erreurs:</h4>
                        <div className="space-y-1">
                          {importMutation.data.errors.slice(0, 5).map((error, index) => (
                            <Alert key={index} variant="destructive">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>{error}</AlertDescription>
                            </Alert>
                          ))}
                          {importMutation.data.errors.length > 5 && (
                            <p className="text-sm text-ink-mute">
                              ... et {importMutation.data.errors.length - 5} autres erreurs
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {importMutation.data.warnings.length > 0 && (
                      <div>
                        <h4 className="font-medium text-etat-alerte-texte mb-2">Avertissements:</h4>
                        <div className="space-y-1">
                          {importMutation.data.warnings.slice(0, 3).map((warning, index) => (
                            <Alert key={index}>
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>{warning}</AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Onglet Export */}
          <TabsContent value="export" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TYPES_EXPORT.map((dataType) => (
                <Card key={dataType.value} className="transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <dataType.icon className="w-5 h-5" />
                      <span>{dataType.label}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm text-ink-soft">
                        Exporter les données {dataType.label.toLowerCase()}
                      </p>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => exportData(dataType.value, 'csv')}
                        >
                          CSV
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => exportData(dataType.value, 'excel')}
                        >
                          Excel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Onglet Historique */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Historique des Opérations</span>
                </CardTitle>
                <CardDescription>
                  Suivi des imports et exports récents
                </CardDescription>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                    <p className="text-sm text-ink-mute mt-4">Chargement de l'historique...</p>
                  </div>
                ) : importHistory && importHistory.length > 0 ? (
                  <div className="space-y-4">
                    {importHistory.map((item) => (
                      <div key={item.id} className="border rounded-lg p-4 hover:bg-paper transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <div className="text-sm font-medium capitalize">
                              {item.type === 'import' ? '' : ''} {item.type}
                            </div>
                            <div className="text-sm text-ink-mute">
                              {DATA_TYPES.find(t => t.value === item.dataType)?.label || item.dataType}
                            </div>
                            {getStatusBadge(item.status)}
                          </div>
                          <div className="text-sm text-ink-mute">
                            {new Date(item.timestamp).toLocaleString()}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-ink-soft">
                            {item.filename}
                          </span>
                          <span className="font-medium">
                            {item.recordCount} enregistrements
                          </span>
                        </div>
                        
                        {item.errors.length > 0 && (
                          <div className="mt-2 text-sm text-etat-critique-texte">
                            {item.errors.length} erreur(s)
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-ink-mute mx-auto mb-4" />
                    <p className="text-ink-mute">Aucun historique d'opération disponible</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Section d'aide */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>Guide d'Utilisation</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Import de Données</h4>
                <ul className="space-y-2 text-sm text-ink-soft">
                  <li>• Téléchargez d'abord un template pour voir le format requis</li>
                  <li>• Remplissez votre fichier en respectant les colonnes</li>
                  <li>• Uploadez votre fichier au format CSV ou Excel</li>
                  <li>• Vérifiez les résultats et corrigez les erreurs si nécessaire</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-3">Export de Données</h4>
                <ul className="space-y-2 text-sm text-ink-soft">
                  <li>• Sélectionnez le type de données à exporter</li>
                  <li>• Choisissez le format (CSV pour analyse, Excel pour présentation)</li>
                  <li>• Le fichier sera téléchargé automatiquement</li>
                  <li>• Utilisez les données exportées pour vos analyses externes</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </AppShell>
  );
}
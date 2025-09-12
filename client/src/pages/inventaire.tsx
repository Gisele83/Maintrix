import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import InventorySimple from "@/components/inventory-simple";
import { EquipmentManagement } from "@/components/equipment-management";
import { 
  Package,
  Download, 
  Upload, 
  FileText, 
  Settings,
  Search,
  Filter,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Factory,
  Wrench,
  Activity
} from "lucide-react";

export default function Inventaire() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState("parts");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importType, setImportType] = useState<"equipments" | "spare-parts">("spare-parts");
  const [isExporting, setIsExporting] = useState(false);

  // Mutation pour l'import de données
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", importType);

      return apiRequest("/api/data-import-export/import", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Import réussi",
        description: `${data.recordsImported || 0} enregistrements importés avec succès`,
      });
      // Invalider les caches appropriés
      if (importType === "equipments") {
        queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/spare-parts"] });
      }
      setIsImportDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur d'import",
        description: error.message || "Erreur lors de l'importation",
        variant: "destructive",
      });
    },
  });

  // Fonction d'export
  const handleExport = async (type: "equipments" | "spare-parts", format: "excel" | "csv") => {
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/data-import-export/export?type=${type}&format=${format}`
      );
      
      if (!response.ok) {
        throw new Error("Erreur lors de l'export");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      const fileName = type === "equipments" ? "equipements" : "pieces_detachees";
      a.download = `${fileName}_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export réussi",
        description: `Fichier ${format.toUpperCase()} téléchargé avec succès`,
      });
    } catch (error) {
      toast({
        title: "Erreur d'export",
        description: "Impossible d'exporter les données",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Fonction d'import de fichier
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validation du type de fichier
    const allowedTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv"
    ];

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Format non supporté",
        description: "Veuillez utiliser un fichier Excel (.xlsx, .xls) ou CSV",
        variant: "destructive",
      });
      return;
    }

    importMutation.mutate(file);
  };

  // Télécharger template d'import
  const downloadTemplate = async (type: "equipments" | "spare-parts", format: "excel" | "csv") => {
    try {
      const response = await fetch(
        `/api/data-import-export/template?type=${type}&format=${format}`
      );
      
      if (!response.ok) throw new Error("Erreur lors du téléchargement");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      const fileName = type === "equipments" ? "template_equipements" : "template_pieces_detachees";
      a.download = `${fileName}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Template téléchargé",
        description: "Utilisez ce modèle pour préparer vos données",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de télécharger le template",
        variant: "destructive",
      });
    }
  };

  const getCurrentTypeLabel = () => {
    if (activeTab === "parts") return "Pièces Détachées";
    if (activeTab === "equipment") return "Équipements";
    return "";
  };

  const getCurrentImportType = (): "equipments" | "spare-parts" => {
    return activeTab === "equipment" ? "equipments" : "spare-parts";
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-inventaire">
      {/* Header avec actions d'import/export */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="title-inventaire">
            Gestion d'Inventaire
          </h1>
          <p className="text-gray-600 mt-2">
            Gérez vos équipements et pièces détachées avec import/export depuis Excel et SAGE
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Boutons d'export */}
          <Button 
            variant="outline" 
            onClick={() => handleExport(getCurrentImportType(), "excel")}
            disabled={isExporting}
            data-testid="button-export-excel"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => handleExport(getCurrentImportType(), "csv")}
            disabled={isExporting}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>

          {/* Bouton d'import */}
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => setImportType(getCurrentImportType())}
                data-testid="button-import-open"
              >
                <Upload className="h-4 w-4 mr-2" />
                Importer Données
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Importer {getCurrentTypeLabel()}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p>Formats supportés :</p>
                  <ul className="list-disc list-inside mt-2">
                    <li>Excel (.xlsx, .xls)</li>
                    <li>CSV</li>
                    <li>Export SAGE (format Excel)</li>
                    <li>Formats ERP standards</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium">Télécharger template :</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadTemplate(importType, "excel")}
                      data-testid="button-download-template-excel"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadTemplate(importType, "csv")}
                      data-testid="button-download-template-csv"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      CSV
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <p className="font-medium text-blue-900">Compatible SAGE</p>
                  <p className="text-blue-700 mt-1">
                    Exportez directement depuis SAGE au format Excel et importez ici
                  </p>
                </div>

                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileImport}
                    className="hidden"
                    data-testid="input-file-import"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importMutation.isPending}
                    className="w-full"
                    data-testid="button-select-file"
                  >
                    {importMutation.isPending ? (
                      "Importation en cours..."
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Sélectionner fichier
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pièces en Stock</p>
                <p className="text-2xl font-bold text-blue-600">1,247</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Équipements</p>
                <p className="text-2xl font-bold text-green-600">156</p>
              </div>
              <Factory className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Alertes Stock</p>
                <p className="text-2xl font-bold text-orange-600">23</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Valeur Stock</p>
                <p className="text-2xl font-bold text-purple-600">€127K</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onglets de gestion */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="parts" className="flex items-center gap-2" data-testid="tab-parts">
            <Package className="h-4 w-4" />
            Pièces Détachées
          </TabsTrigger>
          <TabsTrigger value="equipment" className="flex items-center gap-2" data-testid="tab-equipment">
            <Factory className="h-4 w-4" />
            Équipements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Gestion des Pièces Détachées
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InventorySimple />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Factory className="h-5 w-5" />
                Registre des Équipements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EquipmentManagement />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Guide d'import */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Guide d'Importation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Import depuis SAGE</h3>
              <ol className="text-sm text-blue-800 space-y-1">
                <li>1. Exportez vos données depuis SAGE au format Excel</li>
                <li>2. Téléchargez notre template pour vérifier la structure</li>
                <li>3. Adaptez vos colonnes si nécessaire</li>
                <li>4. Importez le fichier via le bouton "Importer Données"</li>
              </ol>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">Autres Progiciels</h3>
              <ol className="text-sm text-green-800 space-y-1">
                <li>1. Exportez au format Excel ou CSV</li>
                <li>2. Utilisez notre template comme référence</li>
                <li>3. Mappez vos champs aux colonnes requises</li>
                <li>4. Testez avec un petit échantillon d'abord</li>
              </ol>
            </div>
          </div>
          
          <div className="p-4 bg-yellow-50 rounded-lg">
            <h3 className="font-semibold text-yellow-900 mb-2">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              Bonnes Pratiques
            </h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Effectuez une sauvegarde avant tout import massif</li>
              <li>• Vérifiez la cohérence des données avant import</li>
              <li>• Utilisez des identifiants uniques pour éviter les doublons</li>
              <li>• Testez d'abord avec un fichier de quelques lignes</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
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
import { 
  History,
  Download, 
  Upload, 
  FileText, 
  Calendar,
  Search,
  Filter,
  Settings,
  TrendingUp,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Wrench,
  Package
} from "lucide-react";

interface MaintenanceHistoryItem {
  id: number;
  workOrderNumber: string;
  equipmentName: string;
  equipmentId: string;
  maintenanceType: "preventive" | "corrective" | "emergency";
  description: string;
  technicianName: string;
  startDate: string;
  endDate: string;
  duration: number;
  status: "completed" | "in_progress" | "cancelled";
  cost: number;
  spareParts: string[];
  notes: string;
  createdAt: string;
}

export default function Historique() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Récupération des données d'historique
  const { data: historyData, isLoading } = useQuery<MaintenanceHistoryItem[]>({
    queryKey: ["/api/maintenance-history"],
    staleTime: 30000
  });

  // Mutation pour l'import de données
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "maintenance-history");

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
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance-history"] });
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
  const handleExport = async (format: "excel" | "csv") => {
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/data-import-export/export?type=maintenance-history&format=${format}`
      );
      
      if (!response.ok) {
        throw new Error("Erreur lors de l'export");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `historique_maintenance_${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'csv'}`;
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
  const downloadTemplate = async (format: "excel" | "csv") => {
    try {
      const response = await fetch(
        `/api/data-import-export/template?type=maintenance-history&format=${format}`
      );
      
      if (!response.ok) throw new Error("Erreur lors du téléchargement");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `template_historique_maintenance.${format === 'excel' ? 'xlsx' : 'csv'}`;
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

  // Filtrage des données
  const filteredHistory = historyData?.filter(item => {
    const matchesSearch = 
      item.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.technicianName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.workOrderNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === "all" || item.maintenanceType === typeFilter;
    
    return matchesSearch && matchesType;
  }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "in_progress": return "bg-blue-100 text-blue-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "preventive": return "bg-blue-100 text-blue-800";
      case "corrective": return "bg-orange-100 text-orange-800";
      case "emergency": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-historique">
      {/* Header avec actions d'import/export */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="title-historique">
            Historique de Maintenance
          </h1>
          <p className="text-gray-600 mt-2">
            Consultez et gérez l'historique complet des interventions de maintenance
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Boutons d'export */}
          <Button 
            variant="outline" 
            onClick={() => handleExport("excel")}
            disabled={isExporting}
            data-testid="button-export-excel"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => handleExport("csv")}
            disabled={isExporting}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>

          {/* Bouton d'import */}
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-import-open">
                <Upload className="h-4 w-4 mr-2" />
                Importer Données
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Importer Historique de Maintenance</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-gray-600">
                  <p>Formats supportés :</p>
                  <ul className="list-disc list-inside mt-2">
                    <li>Excel (.xlsx, .xls)</li>
                    <li>CSV</li>
                    <li>Export SAGE (format Excel)</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium">Télécharger template :</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadTemplate("excel")}
                      data-testid="button-download-template-excel"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadTemplate("csv")}
                      data-testid="button-download-template-csv"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      CSV
                    </Button>
                  </div>
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

      {/* Filtres et recherche */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Rechercher par équipement, technicien ou N° OT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-historique"
              />
            </div>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
              data-testid="select-type-filter"
            >
              <option value="all">Tous les types</option>
              <option value="preventive">Préventif</option>
              <option value="corrective">Correctif</option>
              <option value="emergency">Urgence</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Liste des interventions */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Chargement de l'historique...</p>
            </CardContent>
          </Card>
        ) : filteredHistory.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Aucun historique de maintenance trouvé</p>
              <p className="text-sm text-gray-500 mt-1">
                Importez vos données ou créez votre première intervention
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredHistory.map((item) => (
            <Card key={item.id} data-testid={`history-item-${item.id}`}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{item.workOrderNumber}</h3>
                      <Badge className={getStatusColor(item.status)}>
                        {item.status === "completed" ? "Terminé" : 
                         item.status === "in_progress" ? "En cours" : "Annulé"}
                      </Badge>
                      <Badge className={getTypeColor(item.maintenanceType)}>
                        {item.maintenanceType === "preventive" ? "Préventif" :
                         item.maintenanceType === "corrective" ? "Correctif" : "Urgence"}
                      </Badge>
                    </div>
                    <p className="text-gray-600">{item.description}</p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>{new Date(item.startDate).toLocaleDateString()}</p>
                    <p>{item.duration}h - {item.cost}€</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Équipement</p>
                    <p className="font-medium">{item.equipmentName}</p>
                    <p className="text-gray-400">{item.equipmentId}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Technicien</p>
                    <p className="font-medium">{item.technicianName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Pièces utilisées</p>
                    <p className="font-medium">
                      {item.spareParts.length > 0 ? item.spareParts.join(", ") : "Aucune"}
                    </p>
                  </div>
                </div>
                
                {item.notes && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-gray-500 text-sm">Notes</p>
                    <p className="text-gray-700 text-sm">{item.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
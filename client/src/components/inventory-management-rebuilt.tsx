import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  Plus, 
  Search, 
  Edit, 
  Download,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from "lucide-react";

// Interface précise pour les pièces détachées
interface SparePart {
  id: number;
  partNumber: string;
  partName: string;
  description?: string;
  category: string;
  manufacturer?: string;
  supplier: string;
  unitPrice: string;
  currency?: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  reorderPoint?: number;
  leadTime?: number;
  location?: string;
  compatibleEquipment?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Schema de validation
const sparePartSchema = z.object({
  partNumber: z.string().min(1, "Numéro de pièce requis"),
  partName: z.string().min(1, "Nom de pièce requis"),
  category: z.string().min(1, "Catégorie requise"),
  supplier: z.string().min(1, "Fournisseur requis"),
  manufacturer: z.string().optional(),
  unitPrice: z.string().refine((val) => parseFloat(val) > 0, "Prix invalide"),
  currentStock: z.number().min(0),
  minStock: z.number().min(0),
  maxStock: z.number().min(0),
  location: z.string().optional(),
  leadTime: z.number().optional().nullable(),
  description: z.string().optional(),
});

type SparePartFormData = z.infer<typeof sparePartSchema>;

export default function InventoryManagementRebuilt() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [localParts, setLocalParts] = useState<SparePart[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Hook personnalisé pour récupérer les données avec gestion d'état local
  const { data: apiData, isLoading, error, refetch } = useQuery<SparePart[]>({
    queryKey: ["/api/spare-parts", refreshKey],
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  // Synchronisation des données API avec l'état local
  useEffect(() => {
    if (apiData && Array.isArray(apiData)) {
      console.log("=== SYNCING API DATA TO LOCAL STATE ===");
      console.log("API Data:", apiData.length, "pieces");
      setLocalParts(apiData);
    }
  }, [apiData]);

  // Force refresh function
  const forceRefresh = useCallback(async () => {
    console.log("=== FORCE REFRESH TRIGGERED ===");
    setRefreshKey(prev => prev + 1);
    await queryClient.clear();
    await queryClient.invalidateQueries({ queryKey: ["/api/spare-parts"] });
    await refetch();
    
    // Fetch fresh data directly
    try {
      const response = await fetch("/api/spare-parts");
      const freshData = await response.json();
      console.log("Fresh fetch result:", freshData.length, "pieces");
      setLocalParts(freshData);
    } catch (err) {
      console.error("Direct fetch failed:", err);
    }
  }, [queryClient, refetch]);

  // Combinaison des données avec priorité aux données locales - toujours un tableau
  const spareParts = Array.isArray(localParts) && localParts.length > 0 
    ? localParts 
    : (Array.isArray(apiData) ? apiData : []);

  // Filtrage robuste avec vérification de type
  const filteredParts = (Array.isArray(spareParts) ? spareParts : []).filter((part: SparePart) => {
    if (!part) return false;
    
    const partName = (part.partName || "").toLowerCase();
    const partNumber = (part.partNumber || "").toLowerCase();
    const category = part.category || "";
    
    const matchesSearch = searchTerm === "" || 
      partName.includes(searchTerm.toLowerCase()) ||
      partNumber.includes(searchTerm.toLowerCase());
      
    const matchesCategory = categoryFilter === "all" || category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  console.log("=== INVENTORY REBUILT STATUS ===");
  console.log("API Data Length:", apiData?.length || 0);
  console.log("Local Parts Length:", localParts.length);
  console.log("Filtered Parts Length:", filteredParts.length);
  console.log("Refresh Key:", refreshKey);

  // Formulaire
  const form = useForm<SparePartFormData>({
    resolver: zodResolver(sparePartSchema),
    defaultValues: {
      partNumber: "",
      partName: "",
      category: "",
      supplier: "",
      manufacturer: "",
      unitPrice: "",
      currentStock: 0,
      minStock: 0,
      maxStock: 0,
      location: "",
      leadTime: null,
      description: "",
    },
  });

  // Mutation de création avec mise à jour immédiate de l'état local
  const createPartMutation = useMutation({
    mutationFn: async (data: SparePartFormData) => {
      console.log("=== CREATING NEW PART ===");
      console.log("Form data:", data);
      
      const response = await apiRequest("/api/spare-parts", {
        method: "POST",
        body: data,
      });
      
      console.log("API Response:", response);
      return response;
    },
    onSuccess: async (newPart) => {
      console.log("=== CREATION SUCCESS - IMMEDIATE UPDATE ===");
      console.log("New part:", newPart);
      
      // Mise à jour immédiate de l'état local
      setLocalParts(prevParts => {
        const updated = [...prevParts, newPart];
        console.log("Local state updated. New count:", updated.length);
        return updated;
      });
      
      // Toast de succès
      toast({
        title: "Succès",
        description: `Pièce "${newPart.partName}" ajoutée avec succès`,
      });
      
      // Fermer le dialogue
      setIsAddDialogOpen(false);
      form.reset();
      
      // Refresh en arrière-plan pour synchroniser
      setTimeout(() => {
        forceRefresh();
      }, 500);
    },
    onError: (error: any) => {
      console.error("=== CREATION ERROR ===", error);
      
      // Gestion spécifique des erreurs de contraintes uniques
      let errorMessage = "Erreur lors de la création de la pièce";
      
      if (error.message && (
        error.message.includes('duplicate key') || 
        error.message.includes('unique constraint') ||
        error.message.includes('already exists')
      )) {
        errorMessage = "Cette référence de pièce existe déjà. Veuillez utiliser une référence différente.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "❌ Référence déjà utilisée",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SparePartFormData) => {
    console.log("=== FORM SUBMISSION ===");
    createPartMutation.mutate(data);
  };

  const getStockStatus = (part: SparePart) => {
    if (part.currentStock <= part.minStock) return { label: "Stock faible", color: "destructive" as const };
    if (part.currentStock >= part.maxStock) return { label: "Stock élevé", color: "secondary" as const };
    return { label: "Normal", color: "default" as const };
  };

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Référence,Nom,Catégorie,Fournisseur,Prix,Stock\n" +
      filteredParts.map(part => 
        `${part.partNumber},${part.partName},${part.category},${part.supplier},${part.unitPrice},${part.currentStock}`
      ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "inventaire.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export réussi",
      description: "Le fichier CSV a été téléchargé",
    });
  };

  return (
    <div className="space-y-6">
      {/* Debug Status Bar */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Badge variant="outline">API: {apiData?.length || 0}</Badge>
              <Badge variant="outline">Local: {localParts.length}</Badge>
              <Badge variant="outline">Affichées: {filteredParts.length}</Badge>
              <Badge variant={isLoading ? "destructive" : "default"}>
                {isLoading ? "Chargement..." : "Prêt"}
              </Badge>
            </div>
            <Button
              onClick={forceRefresh}
              size="sm"
              variant="outline"
              disabled={isLoading}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center space-x-2">
              <Package className="w-6 h-6" />
              <span>Inventaire - Pièces Détachées</span>
            </CardTitle>
            <div className="flex space-x-2">
              <Button onClick={handleExport} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exporter
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter une pièce
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Ajouter une Pièce Détachée</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="partNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Numéro de pièce</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="REF-001" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="partName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nom de la pièce</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Nom de la pièce" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Catégorie</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Sélectionner..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="mechanical">Mécanique</SelectItem>
                                  <SelectItem value="electrical">Électrique</SelectItem>
                                  <SelectItem value="hydraulic">Hydraulique</SelectItem>
                                  <SelectItem value="bearing">Roulement</SelectItem>
                                  <SelectItem value="seal">Joint</SelectItem>
                                  <SelectItem value="filter">Filtre</SelectItem>
                                  <SelectItem value="belt">Courroie</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="supplier"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fournisseur</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Nom du fournisseur" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="unitPrice"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prix unitaire (€)</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" step="0.01" placeholder="0.00" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="currentStock"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Stock actuel</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="minStock"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Stock minimum</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Description de la pièce..." />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsAddDialogOpen(false);
                            form.reset();
                          }}
                        >
                          Annuler
                        </Button>
                        <Button type="submit" disabled={createPartMutation.isPending}>
                          {createPartMutation.isPending ? "Création..." : "Créer"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Rechercher par nom ou référence..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-48">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  <SelectItem value="mechanical">Mécanique</SelectItem>
                  <SelectItem value="electrical">Électrique</SelectItem>
                  <SelectItem value="hydraulic">Hydraulique</SelectItem>
                  <SelectItem value="bearing">Roulement</SelectItem>
                  <SelectItem value="seal">Joint</SelectItem>
                  <SelectItem value="filter">Filtre</SelectItem>
                  <SelectItem value="belt">Courroie</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Affichage des pièces */}
      {isLoading ? (
        <Card>
          <CardContent className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p>Chargement des données...</p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Erreur de chargement</h3>
            <p className="text-muted-foreground mb-4">
              Impossible de charger les données: {String(error)}
            </p>
            <Button onClick={() => forceRefresh()}>Réessayer</Button>
          </CardContent>
        </Card>
      ) : filteredParts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune pièce trouvée</h3>
            <p className="text-muted-foreground mb-4">
              {spareParts.length === 0 ? "Aucune pièce en inventaire" : "Aucune pièce ne correspond aux critères"}
            </p>
            {spareParts.length === 0 && (
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter la première pièce
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredParts.map((part: SparePart) => {
            const stockStatus = getStockStatus(part);
            return (
              <Card key={part.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{part.partName}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Réf: {part.partNumber} | ID: {part.id}
                      </p>
                    </div>
                    <Badge variant={stockStatus.color}>
                      {stockStatus.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Prix unitaire:</span>
                      <span className="font-medium">{part.unitPrice} €</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Stock actuel:</span>
                      <span className="font-medium">{part.currentStock}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Catégorie:</span>
                      <span className="text-sm capitalize">{part.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Fournisseur:</span>
                      <span className="text-sm">{part.supplier}</span>
                    </div>
                    {part.location && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Emplacement:</span>
                        <span className="text-sm">{part.location}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
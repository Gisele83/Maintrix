import React, { useState, useEffect } from "react";
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
  CheckCircle 
} from "lucide-react";

// Types simplifiés pour debug
interface SparePart {
  id: number;
  partNumber: string;
  partName: string;
  category: string;
  supplier: string;
  manufacturer?: string;
  unitPrice: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  location?: string;
  leadTime?: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Schema de formulaire simplifié
const sparePartFormSchema = z.object({
  partNumber: z.string().min(1, "Numéro requis"),
  partName: z.string().min(1, "Nom requis"),
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

type SparePartFormData = z.infer<typeof sparePartFormSchema>;

export default function InventoryManagementDebug() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query avec logs détaillés
  const { data: rawData, isLoading, error, refetch } = useQuery<SparePart[]>({
    queryKey: ["/api/spare-parts", forceRefresh],
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Logs de debug détaillés
  useEffect(() => {
    console.log("=== INVENTORY DEBUG ===");
    console.log("Raw data:", rawData);
    console.log("Data length:", rawData?.length || 0);
    console.log("Is loading:", isLoading);
    console.log("Error:", error);
    console.log("Search term:", searchTerm);
    console.log("Category filter:", categoryFilter);
    console.log("Force refresh count:", forceRefresh);
  }, [rawData, isLoading, error, searchTerm, categoryFilter, forceRefresh]);

  const spareParts = rawData || [];

  // Filtrage avec logs
  const filteredParts = spareParts.filter((part: SparePart) => {
    const matchesSearch = 
      part.partName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.partNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || part.category === categoryFilter;
    const result = matchesSearch && matchesCategory;
    
    if (searchTerm || categoryFilter !== "all") {
      console.log(`Part ${part.partName}: search=${matchesSearch}, category=${matchesCategory}, result=${result}`);
    }
    
    return result;
  });

  console.log("Filtered parts count:", filteredParts.length);

  // Formulaire
  const form = useForm<SparePartFormData>({
    resolver: zodResolver(sparePartFormSchema),
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

  // Mutation de création
  const createPartMutation = useMutation({
    mutationFn: async (data: SparePartFormData) => {
      console.log("=== CREATING PART ===");
      console.log("Form data:", data);
      
      const result = await apiRequest("/api/spare-parts", {
        method: "POST",
        body: data,
      });
      
      console.log("Creation result:", result);
      return result;
    },
    onSuccess: async (newPart) => {
      console.log("=== PART CREATED SUCCESSFULLY ===");
      console.log("New part:", newPart);
      
      // Multiple refresh strategies
      setForceRefresh(prev => prev + 1);
      await queryClient.invalidateQueries({ queryKey: ["/api/spare-parts"] });
      await queryClient.refetchQueries({ queryKey: ["/api/spare-parts"] });
      await refetch();
      
      toast({
        title: "Succès",
        description: `Pièce "${newPart?.partName}" créée avec succès`,
      });
      
      setIsAddDialogOpen(false);
      form.reset();
      
      // Force un autre refresh après un délai
      setTimeout(() => {
        setForceRefresh(prev => prev + 1);
        queryClient.invalidateQueries({ queryKey: ["/api/spare-parts"] });
      }, 500);
    },
    onError: (error) => {
      console.error("=== CREATION ERROR ===", error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la création",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SparePartFormData) => {
    console.log("=== FORM SUBMISSION ===");
    console.log("Submitted data:", data);
    createPartMutation.mutate(data);
  };

  const getStockStatus = (part: SparePart) => {
    if (part.currentStock <= part.minStock) return { label: "Stock faible", color: "destructive" };
    if (part.currentStock >= part.maxStock) return { label: "Stock élevé", color: "secondary" };
    return { label: "Normal", color: "default" };
  };

  const forceFullRefresh = async () => {
    console.log("=== FORCE FULL REFRESH ===");
    setForceRefresh(prev => prev + 1);
    await queryClient.clear();
    await queryClient.invalidateQueries();
    await refetch();
    
    toast({
      title: "Actualisation",
      description: "Données actualisées",
    });
  };

  return (
    <div className="space-y-6">
      {/* Debug Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-800">🔍 Informations de Debug</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <strong>Données brutes:</strong> {rawData?.length || 0}
            </div>
            <div>
              <strong>Filtrées:</strong> {filteredParts.length}
            </div>
            <div>
              <strong>Chargement:</strong> {isLoading ? "Oui" : "Non"}
            </div>
            <div>
              <strong>Refresh:</strong> {forceRefresh}
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={forceFullRefresh} size="sm" variant="outline">
              🔄 Actualiser forcé
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
              <span>Inventaire DEBUG - Pièces Détachées</span>
            </CardTitle>
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
                              <Input {...field} />
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
                              <Input {...field} />
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
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="unitPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prix unitaire (€)</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" />
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
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
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
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Rechercher..."
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
            <Button onClick={() => refetch()}>Réessayer</Button>
          </CardContent>
        </Card>
      ) : filteredParts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune pièce trouvée</h3>
            <p className="text-muted-foreground mb-4">
              {spareParts.length === 0 ? "Aucune pièce en base" : "Aucune pièce ne correspond aux critères"}
            </p>
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
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Prix:</span>
                      <span className="font-medium">{part.unitPrice} €</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Stock:</span>
                      <Badge variant={stockStatus.color === "destructive" ? "destructive" : "secondary"}>
                        {part.currentStock} / {part.maxStock}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Catégorie:</span>
                      <span className="text-sm">{part.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Fournisseur:</span>
                      <span className="text-sm">{part.supplier}</span>
                    </div>
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
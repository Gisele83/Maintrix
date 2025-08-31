import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import StockMovementModal from "@/components/stock-movement-modal";
import StockHistoryModal from "@/components/stock-history-modal";
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
  Download,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  History,
  Trash2
} from "lucide-react";

interface SparePart {
  id: number;
  partNumber: string;
  partName: string;
  description?: string;
  category: string;
  manufacturer?: string;
  supplier: string;
  unitPrice: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  location?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

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
  description: z.string().optional(),
});

type SparePartFormData = z.infer<typeof sparePartSchema>;

export default function InventorySimple() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [stockMovementModal, setStockMovementModal] = useState<{
    isOpen: boolean;
    sparePartId: number;
    currentStock: number;
    partName: string;
    partNumber: string;
  }>({
    isOpen: false,
    sparePartId: 0,
    currentStock: 0,
    partName: "",
    partNumber: ""
  });

  const [stockHistoryModal, setStockHistoryModal] = useState<{
    isOpen: boolean;
    sparePartId: number;
    partName: string;
    partNumber: string;
  }>({
    isOpen: false,
    sparePartId: 0,
    partName: "",
    partNumber: ""
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Simple query - pas de complexité
  const { data: spareParts = [], isLoading, error, refetch } = useQuery<SparePart[]>({
    queryKey: ["/api/spare-parts"],
    retry: 1,
  });

  // Filtrage simple
  const filteredParts = spareParts.filter((part: SparePart) => {
    const matchesSearch = searchTerm === "" || 
      part.partName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.partNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesCategory = categoryFilter === "all" || part.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  // Form
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
      description: "",
    },
  });

  // Mutation simple
  const createPartMutation = useMutation({
    mutationFn: async (data: SparePartFormData) => {
      return await apiRequest("/api/spare-parts", {
        method: "POST",
        body: data,
      });
    },
    onSuccess: (newPart) => {
      toast({
        title: "Succès",
        description: `Pièce "${newPart.partName}" ajoutée avec succès`,
      });
      
      setIsAddDialogOpen(false);
      form.reset();
      
      // Simple refresh
      queryClient.invalidateQueries({ queryKey: ["/api/spare-parts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la création",
        variant: "destructive",
      });
    },
  });

  // Mutation de suppression
  const deletePartMutation = useMutation({
    mutationFn: async (partId: number) => {
      return await apiRequest(`/api/spare-parts/${partId}`, {
        method: "DELETE",
      });
    },
    onSuccess: (response, partId) => {
      toast({
        title: "Succès",
        description: response.message || "Pièce supprimée avec succès",
      });
      
      // Simple refresh
      queryClient.invalidateQueries({ queryKey: ["/api/spare-parts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de suppression",
        description: error.message || "Impossible de supprimer cette pièce",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SparePartFormData) => {
    createPartMutation.mutate(data);
  };

  const handleDeletePart = (part: SparePart) => {
    if (window.confirm(
      `Êtes-vous sûr de vouloir supprimer la pièce "${part.partName}" (${part.partNumber}) ?\n\n` +
      `Cette action est irréversible et la pièce sera définitivement supprimée de l'inventaire.`
    )) {
      deletePartMutation.mutate(part.id);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/spare-parts"] });
    refetch();
  };

  const handleExport = () => {
    const csvContent = [
      "Numéro,Nom,Catégorie,Fournisseur,Prix,Stock,Stock Min,Stock Max,Emplacement",
      ...filteredParts.map(part => 
        `${part.partNumber},"${part.partName}",${part.category},"${part.supplier}",${part.unitPrice},${part.currentStock},${part.minStock},${part.maxStock},"${part.location || ''}"`
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `inventaire_pieces_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export réussi",
      description: "Le fichier CSV a été téléchargé",
    });
  };

  if (error) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Erreur de chargement</h3>
          <p className="text-gray-600 mb-4">
            Impossible de charger les données: {error.message}
          </p>
          <Button onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center space-x-2">
              <Package className="w-6 h-6" />
              <span>Inventaire - Pièces Détachées</span>
              <Badge variant="outline">{filteredParts.length} pièces</Badge>
            </CardTitle>
            <div className="flex space-x-2">
              <Button onClick={handleExport} variant="outline" disabled={filteredParts.length === 0}>
                <Download className="w-4 h-4 mr-2" />
                Exporter
              </Button>
              <Button onClick={handleRefresh} variant="outline" disabled={isLoading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Actualiser
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
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  value={field.value || 0}
                                />
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
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  value={field.value || 0}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="maxStock"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Stock maximum</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  value={field.value || 0}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Emplacement</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Zone A-01" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="manufacturer"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fabricant (optionnel)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Nom du fabricant" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end space-x-2 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsAddDialogOpen(false)}
                        >
                          Annuler
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createPartMutation.isPending}
                        >
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
      </Card>

      {/* Search & Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Rechercher par nom ou numéro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Toutes catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
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
        </CardContent>
      </Card>

      {/* Parts List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
            <p>Chargement des pièces détachées...</p>
          </CardContent>
        </Card>
      ) : filteredParts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune pièce trouvée</h3>
            <p className="text-gray-600">
              {searchTerm || categoryFilter !== "all" 
                ? "Aucune pièce ne correspond à votre recherche" 
                : "Commencez par ajouter votre première pièce détachée"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredParts.map((part) => (
            <Card key={part.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold">{part.partName}</h3>
                      <Badge variant="outline">{part.partNumber}</Badge>
                      <Badge variant={part.category === 'electrical' ? 'default' : 'secondary'}>
                        {part.category}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Fournisseur:</span> {part.supplier}
                      </div>
                      <div>
                        <span className="font-medium">Prix:</span> {part.unitPrice}€
                      </div>
                      <div>
                        <span className="font-medium">Stock:</span> 
                        <span className={part.currentStock <= part.minStock ? 'text-red-600 font-medium' : ''}>
                          {part.currentStock}
                        </span>
                        /{part.maxStock}
                      </div>
                      <div>
                        <span className="font-medium">Emplacement:</span> {part.location || 'Non défini'}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    {part.currentStock <= part.minStock && (
                      <Badge variant="destructive">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Stock bas
                      </Badge>
                    )}
                    
                    {/* Boutons de gestion de stock */}
                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => setStockMovementModal({
                          isOpen: true,
                          sparePartId: part.id,
                          currentStock: part.currentStock,
                          partName: part.partName,
                          partNumber: part.partNumber
                        })}
                      >
                        <TrendingUp className="w-4 h-4 mr-1" />
                        Entrée
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={part.currentStock === 0}
                        onClick={() => setStockMovementModal({
                          isOpen: true,
                          sparePartId: part.id,
                          currentStock: part.currentStock,
                          partName: part.partName,
                          partNumber: part.partNumber
                        })}
                      >
                        <TrendingDown className="w-4 h-4 mr-1" />
                        Sortie
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => setStockHistoryModal({
                          isOpen: true,
                          sparePartId: part.id,
                          partName: part.partName,
                          partNumber: part.partNumber
                        })}
                      >
                        <History className="w-4 h-4 mr-1" />
                        Historique
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300"
                        onClick={() => handleDeletePart(part)}
                        disabled={deletePartMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        {deletePartMutation.isPending ? "Suppression..." : "Supprimer"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de mouvement de stock */}
      <StockMovementModal
        isOpen={stockMovementModal.isOpen}
        onClose={() => setStockMovementModal(prev => ({ ...prev, isOpen: false }))}
        sparePartId={stockMovementModal.sparePartId}
        currentStock={stockMovementModal.currentStock}
        partName={stockMovementModal.partName}
        partNumber={stockMovementModal.partNumber}
      />

      {/* Modal d'historique des mouvements */}
      <StockHistoryModal
        isOpen={stockHistoryModal.isOpen}
        onClose={() => setStockHistoryModal(prev => ({ ...prev, isOpen: false }))}
        sparePartId={stockHistoryModal.sparePartId}
        partName={stockHistoryModal.partName}
        partNumber={stockHistoryModal.partNumber}
      />
    </div>
  );
}
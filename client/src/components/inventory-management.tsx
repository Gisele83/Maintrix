import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const sparePartSchema = z.object({
  partNumber: z.string().min(1, "Numéro de pièce requis"),
  partName: z.string().min(1, "Nom de la pièce requis"),
  category: z.string().min(1, "Catégorie requise"),
  description: z.string().optional(),
  manufacturer: z.string().optional(),
  unitPrice: z.string().min(1, "Prix unitaire requis"),
  currency: z.string().default("EUR"),
  currentStock: z.string().min(1, "Stock actuel requis"),
  minimumStock: z.string().min(1, "Stock minimum requis"),
  maximumStock: z.string().optional(),
  location: z.string().min(1, "Emplacement requis"),
  supplier: z.string().optional(),
  leadTime: z.string().optional(),
  unit: z.string().min(1, "Unité requise")
});

type SparePartFormData = z.infer<typeof sparePartSchema>;

interface SparePart {
  id: number;
  partNumber: string;
  partName: string;
  category: string;
  description?: string;
  manufacturer?: string;
  unitPrice: number;
  currency: string;
  currentStock: number;
  minimumStock: number;
  maximumStock?: number;
  location: string;
  supplier?: string;
  leadTime?: number;
  unit: string;
  createdAt?: string;
  updatedAt?: string;
}

export function InventoryManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch spare parts
  const { data: spareParts = [], isLoading } = useQuery<SparePart[]>({
    queryKey: ["/api/spare-parts"],
  });

  // Add spare part mutation
  const addPartMutation = useMutation({
    mutationFn: (data: SparePartFormData) => {
      const formattedData = {
        ...data,
        unitPrice: parseFloat(data.unitPrice),
        currentStock: parseInt(data.currentStock),
        minimumStock: parseInt(data.minimumStock),
        maximumStock: data.maximumStock ? parseInt(data.maximumStock) : undefined,
        leadTime: data.leadTime ? parseInt(data.leadTime) : undefined
      };
      return apiRequest("/api/spare-parts", {
        method: "POST",
        body: JSON.stringify(formattedData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spare-parts"] });
      setIsAddDialogOpen(false);
      toast({
        title: "Pièce ajoutée",
        description: "La nouvelle pièce détachée a été ajoutée avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la pièce détachée",
        variant: "destructive",
      });
    }
  });

  // Update spare part mutation
  const updatePartMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SparePartFormData }) => {
      const formattedData = {
        ...data,
        unitPrice: parseFloat(data.unitPrice),
        currentStock: parseInt(data.currentStock),
        minimumStock: parseInt(data.minimumStock),
        maximumStock: data.maximumStock ? parseInt(data.maximumStock) : undefined,
        leadTime: data.leadTime ? parseInt(data.leadTime) : undefined
      };
      return apiRequest(`/api/spare-parts/${id}`, {
        method: "PUT",
        body: JSON.stringify(formattedData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spare-parts"] });
      setIsEditDialogOpen(false);
      setSelectedPart(null);
      toast({
        title: "Pièce mise à jour",
        description: "La pièce détachée a été mise à jour avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la pièce détachée",
        variant: "destructive",
      });
    }
  });

  // Delete spare part mutation
  const deletePartMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/spare-parts/${id}`, {
      method: "DELETE"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/spare-parts"] });
      toast({
        title: "Pièce supprimée",
        description: "La pièce détachée a été supprimée avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la pièce détachée",
        variant: "destructive",
      });
    }
  });

  const form = useForm<SparePartFormData>({
    resolver: zodResolver(sparePartSchema),
    defaultValues: {
      partNumber: "",
      partName: "",
      category: "",
      description: "",
      manufacturer: "",
      unitPrice: "",
      currency: "EUR",
      currentStock: "",
      minimumStock: "",
      maximumStock: "",
      location: "",
      supplier: "",
      leadTime: "",
      unit: ""
    }
  });

  // Get unique categories from spare parts
  const categories = [...new Set(spareParts.map(part => part.category))];

  const filteredParts = spareParts.filter(part => {
    const matchesSearch = part.partName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         part.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (part.manufacturer && part.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = categoryFilter === "all" || part.category === categoryFilter;
    
    let matchesStock = true;
    if (stockFilter === "low") {
      matchesStock = part.currentStock <= part.minimumStock;
    } else if (stockFilter === "out") {
      matchesStock = part.currentStock === 0;
    }
    
    return matchesSearch && matchesCategory && matchesStock;
  });

  const onSubmit = (data: SparePartFormData) => {
    if (selectedPart) {
      updatePartMutation.mutate({ id: selectedPart.id, data });
    } else {
      addPartMutation.mutate(data);
    }
  };

  const handleEdit = (part: SparePart) => {
    setSelectedPart(part);
    form.reset({
      partNumber: part.partNumber,
      partName: part.partName,
      category: part.category,
      description: part.description || "",
      manufacturer: part.manufacturer || "",
      unitPrice: part.unitPrice.toString(),
      currency: part.currency,
      currentStock: part.currentStock.toString(),
      minimumStock: part.minimumStock.toString(),
      maximumStock: part.maximumStock?.toString() || "",
      location: part.location,
      supplier: part.supplier || "",
      leadTime: part.leadTime?.toString() || "",
      unit: part.unit
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette pièce détachée ?")) {
      deletePartMutation.mutate(id);
    }
  };

  const getStockStatus = (part: SparePart) => {
    if (part.currentStock === 0) {
      return { status: "out", color: "bg-red-100 text-red-800", icon: <AlertTriangle className="w-4 h-4" /> };
    } else if (part.currentStock <= part.minimumStock) {
      return { status: "low", color: "bg-yellow-100 text-yellow-800", icon: <TrendingDown className="w-4 h-4" /> };
    } else {
      return { status: "good", color: "bg-green-100 text-green-800", icon: <TrendingUp className="w-4 h-4" /> };
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      "mechanical": "bg-blue-100 text-blue-800",
      "electrical": "bg-purple-100 text-purple-800",
      "hydraulic": "bg-cyan-100 text-cyan-800",
      "electronic": "bg-indigo-100 text-indigo-800",
      "bearing": "bg-orange-100 text-orange-800",
      "seal": "bg-teal-100 text-teal-800",
      "filter": "bg-green-100 text-green-800",
      "belt": "bg-amber-100 text-amber-800",
      "other": "bg-gray-100 text-gray-800"
    };
    return colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Chargement de l'inventaire...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion de l'Inventaire</h2>
          <p className="text-gray-600">Gérez vos pièces détachées et le stock d'inventaire</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => form.reset()}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle Pièce
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ajouter une Nouvelle Pièce</DialogTitle>
            </DialogHeader>
            <SparePartForm
              form={form}
              onSubmit={onSubmit}
              isLoading={addPartMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Rechercher par nom, numéro ou fabricant..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrer par catégorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les catégories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrer par stock" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les niveaux</SelectItem>
            <SelectItem value="low">Stock faible</SelectItem>
            <SelectItem value="out">Rupture de stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Inventory Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Package className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total des pièces</p>
                <p className="text-2xl font-bold text-gray-900">{spareParts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Stock faible</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {spareParts.filter(p => p.currentStock <= p.minimumStock && p.currentStock > 0).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Rupture de stock</p>
                <p className="text-2xl font-bold text-red-600">
                  {spareParts.filter(p => p.currentStock === 0).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-600">Stock OK</p>
                <p className="text-2xl font-bold text-green-600">
                  {spareParts.filter(p => p.currentStock > p.minimumStock).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Parts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredParts.map((part) => {
          const stockStatus = getStockStatus(part);
          
          return (
            <Card key={part.id} className={`hover:shadow-lg transition-shadow ${stockStatus.status === 'out' ? 'border-red-200' : stockStatus.status === 'low' ? 'border-yellow-200' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    <CardTitle className="text-lg">{part.partName}</CardTitle>
                  </div>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(part)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDelete(part.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Numéro:</span>
                    <p className="text-gray-600">{part.partNumber}</p>
                  </div>
                  <div>
                    <span className="font-medium">Emplacement:</span>
                    <p className="text-gray-600">{part.location}</p>
                  </div>
                  <div>
                    <span className="font-medium">Prix unitaire:</span>
                    <p className="text-gray-600">{part.unitPrice} {part.currency}</p>
                  </div>
                  <div>
                    <span className="font-medium">Unité:</span>
                    <p className="text-gray-600">{part.unit}</p>
                  </div>
                </div>

                {part.description && (
                  <div>
                    <p className="font-medium text-sm text-gray-900 mb-1">Description:</p>
                    <p className="text-sm text-gray-600 line-clamp-2">{part.description}</p>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <Badge className={getCategoryColor(part.category)}>
                    {part.category}
                  </Badge>
                  <div className="flex items-center space-x-2">
                    {stockStatus.icon}
                    <Badge className={stockStatus.color}>
                      {part.currentStock} / {part.minimumStock}
                    </Badge>
                  </div>
                </div>

                {part.manufacturer && (
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Fabricant:</span> {part.manufacturer}
                  </p>
                )}

                {part.supplier && (
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Fournisseur:</span> {part.supplier}
                  </p>
                )}

                {stockStatus.status !== 'good' && (
                  <div className={`p-2 rounded-md ${stockStatus.status === 'out' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                    <p className={`text-sm font-medium ${stockStatus.status === 'out' ? 'text-red-800' : 'text-yellow-800'}`}>
                      {stockStatus.status === 'out' ? '⚠️ Rupture de stock' : '⚠️ Stock faible'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredParts.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune pièce trouvée</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm ? "Aucune pièce ne correspond à votre recherche." : "Commencez par ajouter votre première pièce détachée."}
          </p>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter une Pièce
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la Pièce</DialogTitle>
          </DialogHeader>
          <SparePartForm
            form={form}
            onSubmit={onSubmit}
            isLoading={updatePartMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Spare Part Form Component
function SparePartForm({ 
  form, 
  onSubmit, 
  isLoading
}: { 
  form: any; 
  onSubmit: (data: SparePartFormData) => void; 
  isLoading: boolean;
}) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="partNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Numéro de pièce *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: ROB-001" {...field} />
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
                <FormLabel>Nom de la pièce *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: Roulement moteur principal" {...field} />
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
                <FormLabel>Catégorie *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une catégorie" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="mechanical">Mécanique</SelectItem>
                    <SelectItem value="electrical">Électrique</SelectItem>
                    <SelectItem value="hydraulic">Hydraulique</SelectItem>
                    <SelectItem value="electronic">Électronique</SelectItem>
                    <SelectItem value="bearing">Roulement</SelectItem>
                    <SelectItem value="seal">Joint d'étanchéité</SelectItem>
                    <SelectItem value="filter">Filtre</SelectItem>
                    <SelectItem value="belt">Courroie</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="manufacturer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fabricant</FormLabel>
                <FormControl>
                  <Input placeholder="ex: SKF, Siemens..." {...field} />
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
                <FormLabel>Prix unitaire *</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="150.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Devise</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Devise" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unité *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Unité" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pcs">Pièces</SelectItem>
                    <SelectItem value="kg">Kilogrammes</SelectItem>
                    <SelectItem value="l">Litres</SelectItem>
                    <SelectItem value="m">Mètres</SelectItem>
                    <SelectItem value="m2">Mètres carrés</SelectItem>
                    <SelectItem value="box">Boîtes</SelectItem>
                    <SelectItem value="set">Ensembles</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="currentStock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock actuel *</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="10" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="minimumStock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock minimum *</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="5" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="maximumStock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock maximum</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="50" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Emplacement *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: Magasin A - Rayon 3" {...field} />
                </FormControl>
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
                  <Input placeholder="ex: SKF Roulements France" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="leadTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Délai de livraison (jours)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="7" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Description détaillée de la pièce..."
                  rows={3}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline">
            Annuler
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Package, 
  Plus, 
  Search, 
  Edit,
  Download,
  Grid,
  List 
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Types - Aligned with database schema
interface SparePart {
  id: number;
  partNumber: string;
  partName: string;
  category: string | null;
  supplier: string | null;
  manufacturer: string | null;
  unitPrice: string; // Database stores as decimal string
  currency: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  leadTime: number | null;
  location: string | null;
  description: string | null;
  compatibleEquipment: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Form Schema - Fixed type issues
const sparePartFormSchema = z.object({
  partNumber: z.string().min(1, "Le numéro de pièce est requis"),
  partName: z.string().min(1, "Le nom de la pièce est requis"),
  category: z.string().min(1, "La catégorie est requise"),
  supplier: z.string().min(1, "Le fournisseur est requis"),
  manufacturer: z.string().optional(),
  unitPrice: z.string().refine((val) => parseFloat(val) > 0, "Le prix unitaire doit être supérieur à 0"),
  currentStock: z.number().min(0, "Le stock ne peut pas être négatif"),
  minStock: z.number().min(0, "Le stock minimum ne peut pas être négatif"),
  maxStock: z.number().min(0, "Le stock maximum ne peut pas être négatif"),
  location: z.string().optional(),
  leadTime: z.number().optional().nullable(),
  description: z.string().optional(),
});

type SparePartFormData = z.infer<typeof sparePartFormSchema>;

export default function InventoryManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch spare parts with forced refresh
  const { data: spareParts = [], isLoading, refetch } = useQuery<SparePart[]>({
    queryKey: ["/api/spare-parts"],
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  console.log("Current spare parts:", spareParts.length, spareParts);

  // Form with proper default values
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

  // Create mutation with proper refresh
  const createPartMutation = useMutation({
    mutationFn: async (data: SparePartFormData) => {
      console.log("Creating part with data:", data);
      return apiRequest("/api/spare-parts", {
        method: "POST",
        body: data,
      });
    },
    onSuccess: async (newPart) => {
      console.log("Part created successfully:", newPart);
      
      // Force multiple refresh strategies
      await queryClient.invalidateQueries({ queryKey: ["/api/spare-parts"] });
      await queryClient.refetchQueries({ queryKey: ["/api/spare-parts"] });
      await refetch();
      
      // Add small delay to ensure UI updates
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/spare-parts"] });
      }, 100);
      
      toast({
        title: "Succès",
        description: `Pièce ${newPart?.partName || 'détachée'} créée avec succès`,
      });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      console.error("Create part error:", error);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la création",
        variant: "destructive",
      });
    },
  });

  // Update mutation with proper refresh  
  const updatePartMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: SparePartFormData }) => {
      console.log("Updating part:", id, data);
      return apiRequest(`/api/spare-parts/${id}`, {
        method: "PUT",
        body: data,
      });
    },
    onSuccess: async (updatedPart) => {
      console.log("Part updated successfully:", updatedPart);
      
      // Force multiple refresh strategies
      await queryClient.invalidateQueries({ queryKey: ["/api/spare-parts"] });
      await queryClient.refetchQueries({ queryKey: ["/api/spare-parts"] });
      await refetch();
      
      // Add small delay to ensure UI updates
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/spare-parts"] });
      }, 100);
      
      toast({
        title: "Succès",
        description: `Pièce ${updatedPart?.partName || 'détachée'} modifiée avec succès`,
      });
      setIsEditDialogOpen(false);
      setSelectedPart(null);
      form.reset();
    },
    onError: (error: any) => {
      console.error("Update part error:", error);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la modification",
        variant: "destructive",
      });
    },
  });

  // Export functionality with full logging
  const handleExportInventory = async () => {
    console.log("=== STARTING EXPORT PROCESS ===");
    
    // Force refresh before export
    await refetch();
    const currentParts = spareParts.length > 0 ? spareParts : [];
    console.log("Parts to export:", currentParts.length);
    
    if (currentParts.length === 0) {
      toast({
        title: "Aucune donnée",
        description: "Aucune pièce à exporter. Actualisation des données...",
        variant: "destructive",
      });
      await queryClient.refetchQueries({ queryKey: ["/api/spare-parts"] });
      return;
    }

    const totalValue = currentParts.reduce((sum: number, part: SparePart) => 
      sum + (part.currentStock * parseFloat(part.unitPrice || '0')), 0
    );
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rapport d'Inventaire - Smart GMAO DiagFix</title>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #1f2937; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
            .summary { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; }
            th { background: #f9fafb; font-weight: bold; }
            tr:nth-child(even) { background: #f9fafb; }
            .stock-low { color: #dc2626; font-weight: bold; }
            .stock-high { color: #059669; }
          </style>
        </head>
        <body>
          <h1>📦 Rapport d'Inventaire des Pièces Détachées</h1>
          
          <div class="summary">
            <h3>📊 Résumé</h3>
            <p><strong>Date du rapport:</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
            <p><strong>Nombre total de références:</strong> ${currentParts.length}</p>
            <p><strong>Valeur totale du stock:</strong> ${totalValue.toFixed(2)} €</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Nom de la pièce</th>
                <th>Catégorie</th>
                <th>Fournisseur</th>
                <th>Stock actuel</th>
                <th>Stock min</th>
                <th>Prix unitaire</th>
                <th>Valeur totale</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              ${currentParts.map((part: SparePart) => {
                const totalPartValue = part.currentStock * parseFloat(part.unitPrice || '0');
                const stockStatus = part.currentStock <= part.minStock ? 'stock-low' : 
                                  part.currentStock >= part.maxStock ? 'stock-high' : '';
                const statusText = part.currentStock <= part.minStock ? '⚠️ Stock faible' :
                                 part.currentStock >= part.maxStock ? '⬆️ Stock élevé' : '✅ Normal';
                
                return `
                  <tr>
                    <td><strong>${part.partNumber}</strong></td>
                    <td>${part.partName}</td>
                    <td>${part.category || '-'}</td>
                    <td>${part.supplier || '-'}</td>
                    <td class="${stockStatus}">${part.currentStock}</td>
                    <td>${part.minStock}</td>
                    <td>${parseFloat(part.unitPrice || '0').toFixed(2)} €</td>
                    <td>${totalPartValue.toFixed(2)} €</td>
                    <td class="${stockStatus}">${statusText}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="summary">
            <p><strong>Généré par Smart GMAO DiagFix</strong> - ${new Date().toLocaleString('fr-FR')}</p>
          </div>
        </body>
      </html>
    `;

    console.log("Creating download...");
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventaire_smart_gmao_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log("=== EXPORT COMPLETED ===");
    toast({
      title: "Export réussi",
      description: `Rapport généré avec ${currentParts.length} pièces`,
    });
  };

  // Handlers
  const onSubmit = (data: SparePartFormData) => {
    console.log("Form submitted with data:", data);
    if (selectedPart) {
      updatePartMutation.mutate({ id: selectedPart.id, data });
    } else {
      createPartMutation.mutate(data);
    }
  };

  const handleEdit = (part: SparePart) => {
    console.log("=== EDITING PART ===", part.id);
    setSelectedPart(part);
    
    // Reset form with proper values and types
    form.reset({
      partNumber: part.partNumber,
      partName: part.partName,
      category: part.category || "",
      supplier: part.supplier || "",
      manufacturer: part.manufacturer || "",
      unitPrice: part.unitPrice || "0",
      currentStock: part.currentStock,
      minStock: part.minStock,
      maxStock: part.maxStock,
      location: part.location || "",
      leadTime: part.leadTime,
      description: part.description || "",
    });
    
    console.log("Opening edit dialog...");
    setIsEditDialogOpen(true);
  };

  // Filter data
  const filteredParts = spareParts.filter((part: SparePart) => {
    const matchesSearch = part.partName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         part.partNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || part.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getStockStatus = (part: SparePart) => {
    if (part.currentStock <= part.minStock) return { label: "Stock faible", color: "destructive" };
    if (part.currentStock >= part.maxStock) return { label: "Stock élevé", color: "secondary" };
    return { label: "Normal", color: "default" };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center space-x-2">
              <Package className="w-6 h-6" />
              <span>Inventaire des Pièces Détachées</span>
            </CardTitle>
            <div className="flex space-x-2">
              <Button onClick={handleExportInventory} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exporter l'inventaire
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
                  <PartForm
                    form={form}
                    onSubmit={onSubmit}
                    isLoading={createPartMutation.isPending}
                    onCancel={() => {
                      setIsAddDialogOpen(false);
                      form.reset();
                    }}
                  />
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

      {/* Parts List */}
      {isLoading ? (
        <div className="text-center py-8">Chargement...</div>
      ) : filteredParts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune pièce trouvée</h3>
            <p className="text-muted-foreground mb-4">
              {spareParts.length === 0 ? "Commencez par ajouter votre première pièce détachée." : "Aucune pièce ne correspond aux critères de recherche."}
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
                        Réf: {part.partNumber}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log("Edit button clicked for part:", part.id);
                        handleEdit(part);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Stock:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">
                          {part.currentStock}
                        </span>
                        <Badge variant={stockStatus.color as any}>
                          {stockStatus.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Prix unitaire:</span>
                      <span className="text-sm font-medium">{parseFloat(part.unitPrice || '0').toFixed(2)} €</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la Pièce Détachée</DialogTitle>
          </DialogHeader>
          <PartForm
            form={form}
            onSubmit={onSubmit}
            isLoading={updatePartMutation.isPending}
            onCancel={() => {
              setIsEditDialogOpen(false);
              setSelectedPart(null);
              form.reset();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PartForm({
  form,
  onSubmit,
  isLoading,
  onCancel,
}: {
  form: any;
  onSubmit: (data: SparePartFormData) => void;
  isLoading: boolean;
  onCancel: () => void;
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
                <FormLabel>Fournisseur *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: SKF" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="manufacturer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fabricant</FormLabel>
                <FormControl>
                  <Input placeholder="ex: SKF" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="unitPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prix unitaire (€) *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="ex: 150.00"
                    {...field}
                  />
                </FormControl>
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
                  <Input
                    type="number"
                    min="0"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
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
                <FormLabel>Stock minimum *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="maxStock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock maximum *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
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
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Emplacement</FormLabel>
                <FormControl>
                  <Input placeholder="ex: Magasin A1" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="leadTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Délai de livraison (jours)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0"
                    {...field}
                    value={field.value || ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      field.onChange(val ? parseInt(val) : null);
                    }}
                  />
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
                <Textarea
                  placeholder="Description détaillée de la pièce..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
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
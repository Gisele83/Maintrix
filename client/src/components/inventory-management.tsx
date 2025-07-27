import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  AlertTriangle,
  TrendingUp,
  Download,
  Filter,
  Grid,
  List 
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Types
interface SparePart {
  id: number;
  partNumber: string;
  partName: string;
  category: string;
  supplier: string;
  unitPrice: number;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  location: string;
  leadTime: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// Form Schema
const sparePartFormSchema = z.object({
  partNumber: z.string().min(1, "Le numéro de pièce est requis"),
  partName: z.string().min(1, "Le nom de la pièce est requis"),
  category: z.string().min(1, "La catégorie est requise"),
  supplier: z.string().min(1, "Le fournisseur est requis"),
  unitPrice: z.string().min(1, "Le prix unitaire est requis"),
  currentStock: z.number().min(0, "Le stock ne peut pas être négatif"),
  minStock: z.number().min(0, "Le stock minimum ne peut pas être négatif"),
  maxStock: z.number().min(0, "Le stock maximum ne peut pas être négatif"),
  unit: z.string().min(1, "L'unité est requise"),
  location: z.string().optional(),
  leadTime: z.string().optional(),
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

  // Fetch spare parts
  const { data: spareParts = [], isLoading } = useQuery({
    queryKey: ["/api/gmao/spare-parts"],
  });

  // Form
  const form = useForm<SparePartFormData>({
    resolver: zodResolver(sparePartFormSchema),
    defaultValues: {
      partNumber: "",
      partName: "",
      category: "",
      supplier: "",
      unitPrice: "",
      currentStock: 0,
      minStock: 0,
      maxStock: 0,
      unit: "",
      location: "",
      leadTime: "",
      description: "",
    },
  });

  // Mutations
  const createPartMutation = useMutation({
    mutationFn: (data: SparePartFormData) =>
      apiRequest("POST", "/api/gmao/spare-parts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmao/spare-parts"] });
      toast({
        title: "Succès",
        description: "Pièce détachée créée avec succès",
      });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la création de la pièce détachée",
        variant: "destructive",
      });
    },
  });

  const updatePartMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SparePartFormData }) =>
      apiRequest("PUT", `/api/gmao/spare-parts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gmao/spare-parts"] });
      toast({
        title: "Succès",
        description: "Pièce détachée modifiée avec succès",
      });
      setIsEditDialogOpen(false);
      setSelectedPart(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Erreur lors de la modification de la pièce détachée",
        variant: "destructive",
      });
    },
  });

  // Export functionality
  const handleExportInventory = () => {
    const totalValue = spareParts.reduce((sum: number, part: SparePart) => 
      sum + (part.currentStock * part.unitPrice), 0
    );
    
    const lowStockItems = spareParts.filter((part: SparePart) => 
      part.currentStock <= part.minStock
    );

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rapport d'Inventaire - Smart GMAO DiagFix</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1 { color: #1f2937; border-bottom: 2px solid #3b82f6; }
            h2 { color: #374151; margin-top: 30px; }
            .summary { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f9fafb; font-weight: bold; }
            .alert { color: #dc2626; font-weight: bold; }
            .good { color: #059669; }
          </style>
        </head>
        <body>
          <h1>Rapport d'Inventaire des Pièces Détachées</h1>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          
          <div class="summary">
            <h2>Résumé Général</h2>
            <p><strong>Nombre total de références:</strong> ${spareParts.length}</p>
            <p><strong>Valeur totale du stock:</strong> ${totalValue.toFixed(2)} €</p>
            <p><strong>Articles en stock faible:</strong> <span class="alert">${lowStockItems.length}</span></p>
          </div>

          <h2>Détail des Pièces Détachées</h2>
          <table>
            <thead>
              <tr>
                <th>Référence</th>
                <th>Nom</th>
                <th>Catégorie</th>
                <th>Stock</th>
                <th>Prix Unitaire</th>
                <th>Valeur</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              ${spareParts.map((part: SparePart) => `
                <tr>
                  <td>${part.partNumber}</td>
                  <td>${part.partName}</td>
                  <td>${part.category}</td>
                  <td>${part.currentStock} ${part.unit}</td>
                  <td>${part.unitPrice.toFixed(2)} €</td>
                  <td>${(part.currentStock * part.unitPrice).toFixed(2)} €</td>
                  <td class="${part.currentStock <= part.minStock ? 'alert' : 'good'}">
                    ${part.currentStock <= part.minStock ? 'Stock faible' : 'OK'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${lowStockItems.length > 0 ? `
            <h2>Alertes de Stock Faible</h2>
            <table>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Nom</th>
                  <th>Stock Actuel</th>
                  <th>Stock Minimum</th>
                  <th>Recommandation</th>
                </tr>
              </thead>
              <tbody>
                ${lowStockItems.map((part: SparePart) => `
                  <tr>
                    <td>${part.partNumber}</td>
                    <td>${part.partName}</td>
                    <td class="alert">${part.currentStock}</td>
                    <td>${part.minStock || 0}</td>
                    <td>Commander ${Math.max(part.maxStock - part.currentStock, part.minStock * 2)} unités</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
        </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventaire_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export réussi",
      description: "Le rapport d'inventaire a été téléchargé",
    });
  };

  // Handlers
  const onSubmit = (data: SparePartFormData) => {
    if (selectedPart) {
      updatePartMutation.mutate({ id: selectedPart.id, data });
    } else {
      createPartMutation.mutate(data);
    }
  };

  const handleEdit = (part: SparePart) => {
    setSelectedPart(part);
    form.reset({
      partNumber: part.partNumber,
      partName: part.partName,
      category: part.category,
      supplier: part.supplier,
      unitPrice: part.unitPrice.toString(),
      currentStock: part.currentStock,
      minStock: part.minStock,
      maxStock: part.maxStock,
      unit: part.unit,
      location: part.location || "",
      leadTime: part.leadTime?.toString() || "",
      description: part.description || "",
    });
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Stocks</h1>
          <p className="text-muted-foreground">
            Gérez vos pièces détachées et suivez les niveaux de stock
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={handleExportInventory} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exporter Inventaire
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter une Pièce
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
                onCancel={() => setIsAddDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="search">Rechercher</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Rechercher par nom ou référence..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Label>Catégorie</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  <SelectItem value="mechanical">Mécanique</SelectItem>
                  <SelectItem value="electrical">Électrique</SelectItem>
                  <SelectItem value="hydraulic">Hydraulique</SelectItem>
                  <SelectItem value="electronic">Électronique</SelectItem>
                  <SelectItem value="bearing">Roulement</SelectItem>
                  <SelectItem value="seal">Joint</SelectItem>
                  <SelectItem value="consumable">Consommable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex space-x-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
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
              {searchTerm || categoryFilter !== "all"
                ? "Aucune pièce ne correspond à vos critères de recherche."
                : "Commencez par ajouter votre première pièce détachée."}
            </p>
            {!searchTerm && categoryFilter === "all" && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter une Pièce
                  </Button>
                </DialogTrigger>
              </Dialog>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-4"}>
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
                      onClick={() => handleEdit(part)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Catégorie:</span>
                      <span className="text-sm font-medium">{part.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Stock:</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">
                          {part.currentStock} {part.unit}
                        </span>
                        <Badge variant={stockStatus.color as any}>
                          {stockStatus.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Prix unitaire:</span>
                      <span className="text-sm font-medium">{part.unitPrice.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Valeur totale:</span>
                      <span className="text-sm font-medium">
                        {(part.currentStock * part.unitPrice).toFixed(2)} €
                      </span>
                    </div>
                    {part.location && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Emplacement:</span>
                        <span className="text-sm font-medium">{part.location}</span>
                      </div>
                    )}
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
                    <SelectItem value="seal">Joint</SelectItem>
                    <SelectItem value="consumable">Consommable</SelectItem>
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
                  <Input placeholder="ex: TechParts SA" {...field} />
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
                <FormLabel>Prix unitaire (€) *</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="45.50"
                    {...field}
                  />
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
                <FormLabel>Stock actuel *</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="25"
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                  />
                </FormControl>
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
                    <SelectItem value="pc">pièce</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="l">litre</SelectItem>
                    <SelectItem value="m">mètre</SelectItem>
                    <SelectItem value="m²">m²</SelectItem>
                    <SelectItem value="set">jeu</SelectItem>
                    <SelectItem value="pack">pack</SelectItem>
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
            name="minStock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stock minimum</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="5"
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
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
                <FormLabel>Stock maximum</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="100"
                    value={field.value}
                    onChange={(e) => field.onChange(Number(e.target.value))}
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
                  <Input placeholder="ex: A1-B2-C3" {...field} />
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
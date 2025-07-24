import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  ShoppingCart, 
  Truck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Package,
  Plus,
  Send,
  RefreshCw
} from 'lucide-react';

interface Supplier {
  id: number;
  supplierCode: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  rating: number;
  isActive: boolean;
}

interface PurchaseOrder {
  id: number;
  orderNumber: string;
  supplierId: number;
  status: string;
  priority: string;
  totalAmount: number;
  currency: string;
  expectedDelivery: string;
  requestedBy: string;
}

interface ReorderRule {
  id: number;
  sparePartId: number;
  reorderPoint: number;
  reorderQuantity: number;
  autoOrder: boolean;
  isActive: boolean;
}

interface PartNeedingReorder {
  id: number;
  partNumber: string;
  partName: string;
  currentStock: number;
  reorderRule?: ReorderRule;
}

export function ProcurementDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [isPurchaseOrderDialogOpen, setIsPurchaseOrderDialogOpen] = useState(false);

  // Queries
  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
    queryKey: ['/api/suppliers'],
  });

  const { data: purchaseOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['/api/purchase-orders'],
  });

  const { data: reorderRules = [] } = useQuery({
    queryKey: ['/api/reorder-rules'],
  });

  const { data: partsNeedingReorder = [] } = useQuery({
    queryKey: ['/api/parts-needing-reorder'],
  });

  // Mutations
  const triggerReorderMutation = useMutation({
    mutationFn: () => apiRequest('/api/trigger-reorder-check', 'POST'),
    onSuccess: (data) => {
      toast({
        title: "Vérification terminée ✅",
        description: `${data.triggeredRules} règles déclenchées, ${data.createdOrders} commandes créées`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/parts-needing-reorder'] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Échec de la vérification automatique",
        variant: "destructive",
      });
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: (supplier: any) => apiRequest('/api/suppliers', 'POST', supplier),
    onSuccess: () => {
      toast({
        title: "Fournisseur créé",
        description: "Le nouveau fournisseur a été ajouté avec succès",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });
      setIsSupplierDialogOpen(false);
    },
  });

  const createPurchaseOrderMutation = useMutation({
    mutationFn: (order: any) => apiRequest('/api/purchase-orders', 'POST', order),
    onSuccess: () => {
      toast({
        title: "Bon de commande créé",
        description: "Le bon de commande a été généré",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/purchase-orders'] });
      setIsPurchaseOrderDialogOpen(false);
    },
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: 'Brouillon', variant: 'secondary' as const },
      sent: { label: 'Envoyé', variant: 'default' as const },
      confirmed: { label: 'Confirmé', variant: 'default' as const },
      delivered: { label: 'Livré', variant: 'default' as const },
      cancelled: { label: 'Annulé', variant: 'destructive' as const },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { label: 'Faible', variant: 'secondary' as const },
      normal: { label: 'Normal', variant: 'default' as const },
      high: { label: 'Élevé', variant: 'default' as const },
      urgent: { label: 'Urgent', variant: 'destructive' as const },
    };
    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.normal;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Gestion des Achats</h2>
          <p className="text-muted-foreground">
            Système de commandes automatiques et gestion des fournisseurs
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => triggerReorderMutation.mutate()}
            disabled={triggerReorderMutation.isPending}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${triggerReorderMutation.isPending ? 'animate-spin' : ''}`} />
            Vérifier les stocks
          </Button>
          <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nouveau fournisseur
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Ajouter un fournisseur</DialogTitle>
                <DialogDescription>
                  Créer un nouveau fournisseur pour les achats
                </DialogDescription>
              </DialogHeader>
              <SupplierForm onSubmit={(data) => createSupplierMutation.mutate(data)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fournisseurs actifs</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers.length}</div>
            <p className="text-xs text-muted-foreground">
              Fournisseurs enregistrés
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commandes en cours</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {purchaseOrders.filter((o: PurchaseOrder) => ['draft', 'sent', 'confirmed'].includes(o.status)).length}
            </div>
            <p className="text-xs text-muted-foreground">
              À traiter ou en attente
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pièces à réapprovisionner</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{partsNeedingReorder.length}</div>
            <p className="text-xs text-muted-foreground">
              Stock critique atteint
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Règles automatiques</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reorderRules.filter((r: ReorderRule) => r.autoOrder && r.isActive).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Commandes automatiques activées
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Parts Needing Reorder */}
      {partsNeedingReorder.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Pièces nécessitant un réapprovisionnement
            </CardTitle>
            <CardDescription>
              Pièces dont le stock est en dessous du seuil de réapprovisionnement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {partsNeedingReorder.map((part: PartNeedingReorder) => (
                <div key={part.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{part.partName}</h4>
                    <p className="text-sm text-muted-foreground">
                      {part.partNumber} - Stock actuel: {part.currentStock}
                    </p>
                    {part.reorderRule && (
                      <p className="text-xs text-orange-600">
                        Seuil: {part.reorderRule.reorderPoint} | 
                        Quantité de commande: {part.reorderRule.reorderQuantity} |
                        Auto: {part.reorderRule.autoOrder ? '✅' : '❌'}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-orange-600 border-orange-200">
                    Stock critique
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Purchase Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Bons de commande récents</CardTitle>
          <CardDescription>
            Dernières commandes générées par le système
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="text-center py-4">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
              Chargement des commandes...
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Aucun bon de commande pour le moment</p>
              <p className="text-sm">Le système générera automatiquement des commandes lorsque les stocks seront faibles</p>
            </div>
          ) : (
            <div className="space-y-4">
              {purchaseOrders.slice(0, 5).map((order: PurchaseOrder) => (
                <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">{order.orderNumber}</div>
                    <div className="text-sm text-muted-foreground">
                      Demandé par: {order.requestedBy}
                    </div>
                    <div className="text-sm">
                      Livraison prévue: {new Date(order.expectedDelivery).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="font-medium">
                      {order.totalAmount.toFixed(2)} {order.currency}
                    </div>
                    <div className="flex gap-2">
                      {getStatusBadge(order.status)}
                      {getPriorityBadge(order.priority)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SupplierForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    supplierCode: '',
    companyName: '',
    supplierType: 'distributor',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'France',
    rating: 3,
    paymentTerms: 'NET 30',
    deliveryTime: 7,
    isActive: true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="supplierCode">Code fournisseur</Label>
          <Input
            id="supplierCode"
            value={formData.supplierCode}
            onChange={(e) => setFormData({ ...formData, supplierCode: e.target.value })}
            placeholder="SUP001"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companyName">Nom de l'entreprise</Label>
          <Input
            id="companyName"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            placeholder="Nom de l'entreprise"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contactPerson">Personne de contact</Label>
          <Input
            id="contactPerson"
            value={formData.contactPerson}
            onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
            placeholder="Jean Dupont"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="contact@entreprise.com"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Téléphone</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="+33 1 23 45 67 89"
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="submit">
          Créer le fournisseur
        </Button>
      </div>
    </form>
  );
}
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, TrendingUp, TrendingDown, RotateCcw, Settings } from "lucide-react";

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  sparePartId: number;
  currentStock: number;
  partName: string;
  partNumber: string;
}

interface StockMovementForm {
  movementType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  reason: string;
  reference?: string;
  notes?: string;
  workOrderId?: number;
  equipmentId?: number;
}

export default function StockMovementModal({
  isOpen,
  onClose,
  sparePartId,
  currentStock,
  partName,
  partNumber
}: StockMovementModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<StockMovementForm>({
    movementType: 'IN',
    quantity: 1,
    reason: 'PURCHASE',
    reference: '',
    notes: '',
    workOrderId: undefined,
    equipmentId: undefined,
  });

  const movementMutation = useMutation({
    mutationFn: async (movement: StockMovementForm) => {
      const endpoint = movement.movementType === 'OUT' ? '/api/stock/outbound' :
                     movement.movementType === 'RETURN' ? '/api/stock/return' :
                     movement.movementType === 'ADJUSTMENT' ? '/api/stock/adjust' :
                     '/api/stock/inbound';

      const payload = movement.movementType === 'ADJUSTMENT' 
        ? { sparePartId, newQuantity: movement.quantity, notes: movement.notes }
        : { 
            sparePartId, 
            quantity: movement.quantity,
            reason: movement.reason,
            reference: movement.reference,
            notes: movement.notes,
            workOrderId: movement.workOrderId,
            equipmentId: movement.equipmentId
          };

      return apiRequest(endpoint, {
        method: "POST",
        body: payload,
      });
    },
    onSuccess: () => {
      toast({
        title: "Mouvement de stock enregistré",
        description: `${form.movementType === 'OUT' ? 'Sortie' : 
                       form.movementType === 'IN' ? 'Entrée' :
                       form.movementType === 'RETURN' ? 'Retour' : 'Ajustement'} de ${form.quantity} unité(s) effectuée avec succès`,
      });
      
      // Invalider les caches pour rafraîchir les données
      queryClient.invalidateQueries({ queryKey: ['/api/spare-parts'] });
      queryClient.invalidateQueries({ queryKey: [`/api/stock/${sparePartId}/history`] });
      
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'enregistrer le mouvement de stock",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setForm({
      movementType: 'IN',
      quantity: 1,
      reason: 'PURCHASE',
      reference: '',
      notes: '',
      workOrderId: undefined,
      equipmentId: undefined,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (form.movementType === 'OUT' && form.quantity > currentStock) {
      toast({
        title: "Stock insuffisant",
        description: `Stock disponible: ${currentStock}, Quantité demandée: ${form.quantity}`,
        variant: "destructive",
      });
      return;
    }

    if (form.movementType === 'ADJUSTMENT' && form.quantity < 0) {
      toast({
        title: "Quantité invalide",
        description: "La quantité ne peut pas être négative",
        variant: "destructive",
      });
      return;
    }

    movementMutation.mutate(form);
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'IN': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'OUT': return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'RETURN': return <RotateCcw className="h-4 w-4 text-blue-500" />;
      case 'ADJUSTMENT': return <Settings className="h-4 w-4 text-orange-500" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getReasonOptions = (movementType: string) => {
    switch (movementType) {
      case 'IN':
        return [
          { value: 'PURCHASE', label: 'Achat/Réception' },
          { value: 'INVENTORY', label: 'Inventaire' },
          { value: 'ADJUSTMENT', label: 'Ajustement' }
        ];
      case 'OUT':
        return [
          { value: 'MAINTENANCE', label: 'Maintenance' },
          { value: 'WORK_ORDER', label: 'Ordre de travail' },
          { value: 'DAMAGED', label: 'Pièce endommagée' }
        ];
      case 'RETURN':
        return [
          { value: 'RETURN', label: 'Retour non utilisé' },
          { value: 'INVENTORY', label: 'Correction inventaire' }
        ];
      case 'ADJUSTMENT':
        return [
          { value: 'INVENTORY', label: 'Inventaire physique' },
          { value: 'ADJUSTMENT', label: 'Correction stock' }
        ];
      default:
        return [];
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Mouvement de Stock
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            <p><strong>{partName}</strong></p>
            <p>Référence: {partNumber}</p>
            <p>Stock actuel: <span className="font-semibold text-blue-600">{currentStock} unités</span></p>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="movementType">Type de mouvement</Label>
            <Select
              value={form.movementType}
              onValueChange={(value: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN') => {
                setForm(prev => ({ 
                  ...prev, 
                  movementType: value,
                  reason: getReasonOptions(value)[0]?.value || ''
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">
                  <div className="flex items-center gap-2">
                    {getMovementIcon('IN')}
                    Entrée de stock
                  </div>
                </SelectItem>
                <SelectItem value="OUT">
                  <div className="flex items-center gap-2">
                    {getMovementIcon('OUT')}
                    Sortie de stock
                  </div>
                </SelectItem>
                <SelectItem value="RETURN">
                  <div className="flex items-center gap-2">
                    {getMovementIcon('RETURN')}
                    Retour au stock
                  </div>
                </SelectItem>
                <SelectItem value="ADJUSTMENT">
                  <div className="flex items-center gap-2">
                    {getMovementIcon('ADJUSTMENT')}
                    Ajustement stock
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="quantity">
              {form.movementType === 'ADJUSTMENT' ? 'Nouveau stock' : 'Quantité'}
            </Label>
            <Input
              id="quantity"
              type="number"
              min={form.movementType === 'ADJUSTMENT' ? 0 : 1}
              max={form.movementType === 'OUT' ? currentStock : undefined}
              value={form.quantity}
              onChange={(e) => setForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
              required
            />
            {form.movementType === 'OUT' && (
              <p className="text-xs text-muted-foreground mt-1">
                Maximum disponible: {currentStock} unités
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="reason">Motif</Label>
            <Select
              value={form.reason}
              onValueChange={(value) => setForm(prev => ({ ...prev, reason: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getReasonOptions(form.movementType).map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(form.movementType === 'OUT' || form.movementType === 'RETURN') && (
            <>
              <div>
                <Label htmlFor="workOrderId">N° Ordre de travail (optionnel)</Label>
                <Input
                  id="workOrderId"
                  type="number"
                  placeholder="Ex: 2024001"
                  value={form.workOrderId || ''}
                  onChange={(e) => setForm(prev => ({ 
                    ...prev, 
                    workOrderId: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                />
              </div>

              <div>
                <Label htmlFor="equipmentId">ID Équipement (optionnel)</Label>
                <Input
                  id="equipmentId"
                  type="number"
                  placeholder="Ex: 101"
                  value={form.equipmentId || ''}
                  onChange={(e) => setForm(prev => ({ 
                    ...prev, 
                    equipmentId: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="reference">Référence document (optionnel)</Label>
            <Input
              id="reference"
              placeholder="Ex: BC-2024-001, OT-2024-001"
              value={form.reference}
              onChange={(e) => setForm(prev => ({ ...prev, reference: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Textarea
              id="notes"
              placeholder="Commentaires additionnels..."
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" disabled={movementMutation.isPending} className="flex-1">
              {movementMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Valider mouvement
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
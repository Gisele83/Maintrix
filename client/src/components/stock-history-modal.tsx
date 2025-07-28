import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  History, 
  TrendingUp, 
  TrendingDown, 
  RotateCcw, 
  Settings,
  Calendar,
  User,
  FileText,
  Euro,
  Package
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface StockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sparePartId: number;
  partName: string;
  partNumber: string;
}

interface StockMovement {
  id: number;
  movementType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  workOrderId?: number;
  equipmentId?: number;
  performedBy?: number;
  reference?: string;
  notes?: string;
  unitCost?: string;
  totalCost?: string;
  createdAt: string;
}

export default function StockHistoryModal({
  isOpen,
  onClose,
  sparePartId,
  partName,
  partNumber
}: StockHistoryModalProps) {
  
  const { data: movements = [], isLoading } = useQuery<StockMovement[]>({
    queryKey: [`/api/stock/${sparePartId}/history`],
    enabled: isOpen && sparePartId > 0,
  });

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'IN': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'OUT': return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'RETURN': return <RotateCcw className="h-4 w-4 text-blue-500" />;
      case 'ADJUSTMENT': return <Settings className="h-4 w-4 text-orange-500" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getMovementLabel = (type: string) => {
    switch (type) {
      case 'IN': return 'Entrée';
      case 'OUT': return 'Sortie';
      case 'RETURN': return 'Retour';
      case 'ADJUSTMENT': return 'Ajustement';
      default: return type;
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case 'IN': return 'bg-green-100 text-green-800 border-green-200';
      case 'OUT': return 'bg-red-100 text-red-800 border-red-200';
      case 'RETURN': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ADJUSTMENT': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getReasonLabel = (reason: string) => {
    const reasonLabels: { [key: string]: string } = {
      'MAINTENANCE': 'Maintenance',
      'PURCHASE': 'Achat/Réception',
      'RETURN': 'Retour non utilisé',
      'INVENTORY': 'Inventaire',
      'DAMAGED': 'Pièce endommagée',
      'WORK_ORDER': 'Ordre de travail',
      'ADJUSTMENT': 'Ajustement'
    };
    return reasonLabels[reason] || reason;
  };

  const calculateStockVariation = (movement: StockMovement) => {
    return movement.newStock - movement.previousStock;
  };

  const getTotalValue = () => {
    return movements.reduce((total, movement) => {
      const cost = parseFloat(movement.totalCost || '0');
      return total + cost;
    }, 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique des mouvements de stock
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            <p><strong>{partName}</strong></p>
            <p>Référence: {partNumber}</p>
            <p>Total des mouvements: {movements.length}</p>
            {movements.length > 0 && (
              <p>Valeur totale des mouvements: {getTotalValue().toFixed(2)}€</p>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              <span className="ml-2">Chargement de l'historique...</span>
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun mouvement enregistré</h3>
              <p className="text-gray-600">
                Cette pièce n'a pas encore d'historique de mouvements de stock.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {movements.map((movement) => (
                <Card key={movement.id} className="border-l-4" style={{
                  borderLeftColor: movement.movementType === 'IN' ? '#22c55e' :
                                   movement.movementType === 'OUT' ? '#ef4444' :
                                   movement.movementType === 'RETURN' ? '#3b82f6' : '#f97316'
                }}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="flex-shrink-0 mt-1">
                          {getMovementIcon(movement.movementType)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getMovementColor(movement.movementType)}>
                              {getMovementLabel(movement.movementType)}
                            </Badge>
                            <Badge variant="outline">
                              {getReasonLabel(movement.reason)}
                            </Badge>
                            {movement.reference && (
                              <Badge variant="secondary">
                                <FileText className="w-3 h-3 mr-1" />
                                {movement.reference}
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-gray-500">Quantité:</span>
                              <div className="font-semibold">
                                {movement.movementType === 'ADJUSTMENT' 
                                  ? `${movement.quantity} unités`
                                  : `${movement.movementType === 'OUT' ? '-' : '+'}${movement.quantity}`
                                }
                              </div>
                            </div>
                            
                            <div>
                              <span className="font-medium text-gray-500">Stock:</span>
                              <div className="font-semibold">
                                {movement.previousStock} → {movement.newStock}
                                <span className={`ml-1 text-xs ${
                                  calculateStockVariation(movement) > 0 ? 'text-green-600' : 
                                  calculateStockVariation(movement) < 0 ? 'text-red-600' : 'text-gray-600'
                                }`}>
                                  ({calculateStockVariation(movement) > 0 ? '+' : ''}{calculateStockVariation(movement)})
                                </span>
                              </div>
                            </div>

                            {movement.totalCost && (
                              <div>
                                <span className="font-medium text-gray-500">Coût total:</span>
                                <div className="font-semibold flex items-center">
                                  <Euro className="w-3 h-3 mr-1" />
                                  {parseFloat(movement.totalCost).toFixed(2)}€
                                </div>
                              </div>
                            )}

                            <div>
                              <span className="font-medium text-gray-500">Date:</span>
                              <div className="font-semibold flex items-center">
                                <Calendar className="w-3 h-3 mr-1" />
                                {format(new Date(movement.createdAt), 'dd/MM/yyyy HH:mm', { locale: fr })}
                              </div>
                            </div>
                          </div>

                          {movement.workOrderId && (
                            <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
                              <span>
                                <strong>OT:</strong> {movement.workOrderId}
                              </span>
                              {movement.equipmentId && (
                                <span>
                                  <strong>Équipement:</strong> {movement.equipmentId}
                                </span>
                              )}
                            </div>
                          )}

                          {movement.notes && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                              <strong>Notes:</strong> {movement.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
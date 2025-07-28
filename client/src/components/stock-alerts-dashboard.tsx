import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertTriangle, 
  Package, 
  ShoppingCart, 
  TrendingDown,
  Euro,
  User,
  RefreshCw
} from "lucide-react";

interface StockAlert {
  id: number;
  partNumber: string;
  partName: string;
  currentStock: number;
  minStock: number;
  alertLevel: 'CRITICAL' | 'WARNING';
  message: string;
}

interface StockRecommendation {
  sparePartId: number;
  partNumber: string;
  partName: string;
  currentStock: number;
  minStock: number;
  recommendedOrder: number;
  supplier: string;
  estimatedCost: string;
}

interface StockAlertsData {
  alerts: StockAlert[];
  recommendations: StockRecommendation[];
}

export default function StockAlertsDashboard() {
  const { toast } = useToast();
  const [selectedRecommendations, setSelectedRecommendations] = useState<number[]>([]);

  const { data: stockData, isLoading, refetch } = useQuery<StockAlertsData>({
    queryKey: ["/api/stock/alerts/low-stock"],
    refetchInterval: 30000, // Actualiser toutes les 30 secondes
  });

  const toggleRecommendation = (sparePartId: number) => {
    setSelectedRecommendations(prev => 
      prev.includes(sparePartId) 
        ? prev.filter(id => id !== sparePartId)
        : [...prev, sparePartId]
    );
  };

  const generatePurchaseOrder = async () => {
    if (selectedRecommendations.length === 0) {
      toast({
        title: "Aucune sélection",
        description: "Veuillez sélectionner au moins une recommandation",
        variant: "destructive",
      });
      return;
    }

    const selectedItems = stockData?.recommendations.filter(rec => 
      selectedRecommendations.includes(rec.sparePartId)
    ) || [];

    const totalCost = selectedItems.reduce((sum, item) => sum + parseFloat(item.estimatedCost), 0);

    // Simulation de génération de bon de commande
    toast({
      title: "Bon de commande généré",
      description: `${selectedItems.length} articles pour un total de ${totalCost.toFixed(2)}€`,
    });

    setSelectedRecommendations([]);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p>Chargement des alertes de stock...</p>
        </CardContent>
      </Card>
    );
  }

  const alerts = stockData?.alerts || [];
  const recommendations = stockData?.recommendations || [];
  const criticalAlerts = alerts.filter(alert => alert.alertLevel === 'CRITICAL');
  const warningAlerts = alerts.filter(alert => alert.alertLevel === 'WARNING');

  return (
    <div className="space-y-6">
      {/* Résumé des alertes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Stock épuisé</p>
                <p className="text-2xl font-bold text-red-700">{criticalAlerts.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Stock bas</p>
                <p className="text-2xl font-bold text-yellow-700">{warningAlerts.length}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">À commander</p>
                <p className="text-2xl font-bold text-blue-700">{recommendations.length}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertes critiques */}
      {criticalAlerts.length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alertes Critiques - Stock Épuisé
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              {criticalAlerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-white rounded border border-red-200">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-red-500" />
                    <div>
                      <p className="font-semibold">{alert.partName}</p>
                      <p className="text-sm text-gray-600">{alert.partNumber}</p>
                    </div>
                  </div>
                  <Badge variant="destructive">
                    Stock: {alert.currentStock}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommandations de commande */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Recommandations de Commande
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Actualiser
                </Button>
                <Button 
                  onClick={generatePurchaseOrder}
                  disabled={selectedRecommendations.length === 0}
                  size="sm"
                >
                  Générer commande ({selectedRecommendations.length})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-96">
              <div className="p-4 space-y-3">
                {recommendations.map((rec) => (
                  <div 
                    key={rec.sparePartId} 
                    className={`p-4 rounded border transition-colors cursor-pointer ${
                      selectedRecommendations.includes(rec.sparePartId)
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => toggleRecommendation(rec.sparePartId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="checkbox"
                            checked={selectedRecommendations.includes(rec.sparePartId)}
                            onChange={() => toggleRecommendation(rec.sparePartId)}
                            className="rounded border-gray-300"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div>
                            <h3 className="font-semibold">{rec.partName}</h3>
                            <p className="text-sm text-gray-600">{rec.partNumber}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-500">Stock actuel:</span>
                            <div className="font-semibold text-red-600">{rec.currentStock}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-500">Stock min:</span>
                            <div className="font-semibold">{rec.minStock}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-500">Qté recommandée:</span>
                            <div className="font-semibold text-green-600">{rec.recommendedOrder}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-500">Coût estimé:</span>
                            <div className="font-semibold flex items-center">
                              <Euro className="w-3 h-3 mr-1" />
                              {rec.estimatedCost}€
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
                          <span className="flex items-center">
                            <User className="w-3 h-3 mr-1" />
                            <strong>Fournisseur:</strong> {rec.supplier}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* État vide */}
      {alerts.length === 0 && recommendations.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-green-700">Stocks optimaux</h3>
            <p className="text-gray-600">
              Aucune alerte de stock. Tous les niveaux de stock sont corrects.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
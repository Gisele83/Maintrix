import InventorySimple from "@/components/inventory-simple";
import StockAlertsDashboard from "@/components/stock-alerts-dashboard";

export default function InventoryManagement() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Smart GMAO DiagFix - Inventaire
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Gestion intelligente de l'inventaire des pièces détachées
          </p>
        </div>

        {/* Dashboard d'alertes de stock */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Alertes de Stock
          </h2>
          <StockAlertsDashboard />
        </div>

        {/* Interface Inventaire */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Inventaire des Pièces Détachées
          </h2>
          <InventorySimple />
        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  ShoppingCart,
  Wrench,
  BarChart3,
  Download,
  Upload,
  Edit,
  Trash2
} from "lucide-react";

interface InventoryItem {
  id: number;
  partNumber: string;
  name: string;
  description: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unitPrice: number;
  supplier: string;
  location: string;
  lastOrderDate: string;
  status: "in-stock" | "low-stock" | "out-of-stock" | "discontinued";
}

interface StockMovement {
  id: number;
  partId: number;
  partName: string;
  type: "in" | "out" | "adjustment";
  quantity: number;
  reason: string;
  user: string;
  date: string;
}

export default function InventoryManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const { toast } = useToast();

  // Fetch inventory data
  const { data: inventory = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
  });

  // Fetch stock movements
  const { data: movements = [] } = useQuery<StockMovement[]>({
    queryKey: ["/api/inventory/movements"],
  });

  // Sample data for demonstration
  const sampleInventory: InventoryItem[] = [
    {
      id: 1,
      partNumber: "BRG-001",
      name: "Roulement à billes",
      description: "Roulement à billes SKF 6205-2RS",
      category: "Roulements",
      currentStock: 25,
      minStock: 10,
      maxStock: 50,
      unitPrice: 45.80,
      supplier: "SKF France",
      location: "A1-B3",
      lastOrderDate: "2025-01-15",
      status: "in-stock"
    },
    {
      id: 2,
      partNumber: "FLT-045",
      name: "Filtre hydraulique",
      description: "Filtre hydraulique Parker 926837",
      category: "Filtres",
      currentStock: 5,
      minStock: 8,
      maxStock: 30,
      unitPrice: 128.50,
      supplier: "Parker Hannifin",
      location: "B2-C1",
      lastOrderDate: "2025-01-10",
      status: "low-stock"
    },
    {
      id: 3,
      partNumber: "SL-078",
      name: "Joint d'étanchéité",
      description: "Joint torique NBR 70 Shore",
      category: "Joints",
      currentStock: 0,
      minStock: 15,
      maxStock: 100,
      unitPrice: 8.90,
      supplier: "Trelleborg",
      location: "C1-A2",
      lastOrderDate: "2024-12-20",
      status: "out-of-stock"
    },
    {
      id: 4,
      partNumber: "VLV-123",
      name: "Électrovanne",
      description: "Électrovanne 24V DC Parker",
      category: "Vannes",
      currentStock: 12,
      minStock: 5,
      maxStock: 20,
      unitPrice: 245.00,
      supplier: "Parker Hannifin",
      location: "D1-B2",
      lastOrderDate: "2025-01-18",
      status: "in-stock"
    },
    {
      id: 5,
      partNumber: "PMP-890",
      name: "Pompe hydraulique",
      description: "Pompe à engrenages Bosch Rexroth",
      category: "Pompes",
      currentStock: 3,
      minStock: 2,
      maxStock: 8,
      unitPrice: 1850.00,
      supplier: "Bosch Rexroth",
      location: "E1-A1",
      lastOrderDate: "2025-01-12",
      status: "in-stock"
    }
  ];

  const sampleMovements: StockMovement[] = [
    {
      id: 1,
      partId: 1,
      partName: "Roulement à billes",
      type: "out",
      quantity: 2,
      reason: "Maintenance préventive - Moteur principal",
      user: "Jean Dupont",
      date: "2025-01-25 14:30"
    },
    {
      id: 2,
      partId: 2,
      partName: "Filtre hydraulique",
      type: "out",
      quantity: 3,
      reason: "Réparation urgente - Pompe hydraulique",
      user: "Marie Martin",
      date: "2025-01-25 09:15"
    },
    {
      id: 3,
      partId: 4,
      partName: "Électrovanne",
      type: "in",
      quantity: 5,
      reason: "Réception commande CMD-2025-0156",
      user: "Système",
      date: "2025-01-24 16:45"
    }
  ];

  const displayInventory = inventory.length > 0 ? inventory : sampleInventory;
  const displayMovements = movements.length > 0 ? movements : sampleMovements;

  // Filter inventory
  const filteredInventory = displayInventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.partNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get categories
  const categories = ["all", ...Array.from(new Set(displayInventory.map(item => item.category)))];

  // Calculate statistics
  const totalItems = displayInventory.length;
  const lowStockItems = displayInventory.filter(item => item.status === "low-stock").length;
  const outOfStockItems = displayInventory.filter(item => item.status === "out-of-stock").length;
  const totalValue = displayInventory.reduce((sum, item) => sum + (item.currentStock * item.unitPrice), 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in-stock": return "bg-green-100 text-green-800";
      case "low-stock": return "bg-yellow-100 text-yellow-800";
      case "out-of-stock": return "bg-red-100 text-red-800";
      case "discontinued": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "low-stock": return <AlertTriangle className="h-4 w-4" />;
      case "out-of-stock": return <TrendingDown className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Gestion des Stocks et Pièces
              </h1>
              <p className="text-gray-600 text-lg">
                Gestion complète de l'inventaire et des pièces de rechange
              </p>
            </div>
            <Button 
              onClick={() => setShowAddForm(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Pièce
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-xl bg-gradient-to-br from-blue-50 to-blue-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 font-medium">Total Références</p>
                  <p className="text-3xl font-bold text-blue-900">{totalItems}</p>
                </div>
                <Package className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-gradient-to-br from-yellow-50 to-yellow-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-600 font-medium">Stock Faible</p>
                  <p className="text-3xl font-bold text-yellow-900">{lowStockItems}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-gradient-to-br from-red-50 to-red-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-600 font-medium">Rupture Stock</p>
                  <p className="text-3xl font-bold text-red-900">{outOfStockItems}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-xl bg-gradient-to-br from-green-50 to-green-100">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 font-medium">Valeur Stock</p>
                  <p className="text-3xl font-bold text-green-900">{totalValue.toLocaleString()}€</p>
                </div>
                <BarChart3 className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="inventory" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="inventory">Inventaire</TabsTrigger>
            <TabsTrigger value="movements">Mouvements</TabsTrigger>
            <TabsTrigger value="orders">Commandes</TabsTrigger>
          </TabsList>

          {/* Inventory Tab */}
          <TabsContent value="inventory">
            <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
                  <CardTitle className="flex items-center text-2xl">
                    <Package className="h-6 w-6 mr-3 text-blue-600" />
                    Inventaire des Pièces
                  </CardTitle>
                  
                  <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Rechercher une pièce..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 w-72"
                      />
                    </div>
                    
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {categories.map(category => (
                        <option key={category} value={category}>
                          {category === "all" ? "Toutes catégories" : category}
                        </option>
                      ))}
                    </select>
                    
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Exporter
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Référence</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Nom</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Catégorie</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Stock</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Prix Unit.</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Emplacement</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Statut</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInventory.map((item) => (
                        <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <span className="font-medium text-blue-600">{item.partNumber}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-sm text-gray-500">{item.description}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="secondary">{item.category}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(item.status)}
                              <span className="font-medium">{item.currentStock}</span>
                              <span className="text-gray-500">/ {item.maxStock}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium">{item.unitPrice.toFixed(2)}€</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-gray-600">{item.location}</span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={getStatusColor(item.status)}>
                              {item.status === "in-stock" && "En stock"}
                              {item.status === "low-stock" && "Stock faible"}
                              {item.status === "out-of-stock" && "Rupture"}
                              {item.status === "discontinued" && "Arrêté"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <Button size="sm" variant="outline">
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline">
                                <ShoppingCart className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Movements Tab */}
          <TabsContent value="movements">
            <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-2xl">
                  <TrendingUp className="h-6 w-6 mr-3 text-green-600" />
                  Mouvements de Stock
                </CardTitle>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {displayMovements.map((movement) => (
                    <div key={movement.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className={`p-2 rounded-full ${
                          movement.type === "in" ? "bg-green-100 text-green-600" : 
                          movement.type === "out" ? "bg-red-100 text-red-600" : 
                          "bg-blue-100 text-blue-600"
                        }`}>
                          {movement.type === "in" ? <TrendingUp className="h-4 w-4" /> : 
                           movement.type === "out" ? <TrendingDown className="h-4 w-4" /> : 
                           <Wrench className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="font-medium">{movement.partName}</div>
                          <div className="text-sm text-gray-500">{movement.reason}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {movement.type === "in" ? "+" : "-"}{movement.quantity}
                        </div>
                        <div className="text-sm text-gray-500">{movement.date}</div>
                        <div className="text-sm text-gray-500">{movement.user}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-2xl">
                  <ShoppingCart className="h-6 w-6 mr-3 text-purple-600" />
                  Gestion des Commandes
                </CardTitle>
              </CardHeader>
              
              <CardContent>
                <div className="text-center py-12">
                  <ShoppingCart className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-xl font-medium text-gray-600 mb-2">
                    Fonctionnalité Commandes
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Module de gestion des commandes fournisseurs et réapprovisionnement automatique
                  </p>
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Créer une Commande
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
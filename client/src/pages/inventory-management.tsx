import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Settings } from "lucide-react";
import InventoryDiagnostic from "@/components/inventory-diagnostic";
import InventoryManagementRebuilt from "@/components/inventory-management-rebuilt";

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
            Gestion intelligente de l'inventaire des pièces détachées avec diagnostic API intégré
          </p>
        </div>

        {/* Content Sections */}
        <Tabs defaultValue="inventory" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="inventory" className="flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <span>Inventaire</span>
            </TabsTrigger>
            <TabsTrigger value="diagnostic" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Diagnostic</span>
            </TabsTrigger>
          </TabsList>

          {/* Inventaire Principal */}
          <TabsContent value="inventory">
            <div className="space-y-8">
              {/* Section Diagnostic API */}
              <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center text-2xl">
                    <Settings className="h-6 w-6 mr-3 text-green-600" />
                    Diagnostic Inventaire - Connexion API
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <InventoryDiagnostic />
                </CardContent>
              </Card>
              
              {/* Section Inventaire Corrigé */}
              <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center text-2xl">
                    <Package className="h-6 w-6 mr-3 text-blue-600" />
                    Inventaire des Pièces - Interface Moderne
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <InventoryManagementRebuilt />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Section Diagnostic */}
          <TabsContent value="diagnostic">
            <Card className="border-0 shadow-2xl bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center text-2xl">
                  <Settings className="h-6 w-6 mr-3 text-green-600" />
                  Diagnostic API Complet
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InventoryDiagnostic />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
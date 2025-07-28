import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, AlertCircle, CheckCircle } from "lucide-react";

interface SparePart {
  id: number;
  partNumber: string;
  partName: string;
  category: string;
  supplier: string;
  unitPrice: string;
}

interface DiagnosticResult {
  timestamp: string;
  apiResponse: SparePart[];
  apiCount: number;
  fetchSuccess: boolean;
  error?: string;
}

export default function InventoryDiagnostic() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostic = async () => {
    setIsRunning(true);
    console.log("=== DIAGNOSTIC INVENTORY COMPLET ===");
    
    try {
      const response = await fetch("/api/spare-parts");
      const data = await response.json();
      
      const result: DiagnosticResult = {
        timestamp: new Date().toISOString(),
        apiResponse: data,
        apiCount: data.length,
        fetchSuccess: response.ok,
      };
      
      if (!response.ok) {
        result.error = `HTTP ${response.status}`;
      }
      
      console.log("Diagnostic result:", result);
      console.log("Raw API data:", data);
      
      setDiagnostics(prev => [result, ...prev.slice(0, 4)]);
      
    } catch (error) {
      const result: DiagnosticResult = {
        timestamp: new Date().toISOString(),
        apiResponse: [],
        apiCount: 0,
        fetchSuccess: false,
        error: String(error),
      };
      
      console.error("Diagnostic error:", error);
      setDiagnostics(prev => [result, ...prev.slice(0, 4)]);
    }
    
    setIsRunning(false);
  };

  const createTestPart = async () => {
    console.log("=== CRÉATION PIÈCE DE TEST ===");
    
    // Générer un numéro vraiment unique pour éviter les conflits
    const uniqueId = `DIAG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const testPart = {
      partNumber: uniqueId,
      partName: `Test Diagnostic ${new Date().toLocaleTimeString()}`,
      category: "diagnostic",
      supplier: "Test Diagnostic Supplier",
      manufacturer: "Diagnostic Manufacturer",
      unitPrice: "1.00",
      currentStock: 1,
      minStock: 1,
      maxStock: 10,
      location: "DIAG-TEST",
      leadTime: 1,
      description: "Pièce de test pour diagnostic"
    };
    
    try {
      const response = await fetch("/api/spare-parts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testPart),
      });
      
      const createdPart = await response.json();
      console.log("Pièce créée:", createdPart);
      
      // Attendre 1 seconde puis refaire un diagnostic
      setTimeout(() => {
        runDiagnostic();
      }, 1000);
      
    } catch (error) {
      console.error("Erreur création:", error);
    }
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="w-6 h-6" />
            <span>Diagnostic Inventaire - Test de Connectivité API</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4 mb-6">
            <Button onClick={runDiagnostic} disabled={isRunning}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRunning ? "animate-spin" : ""}`} />
              Tester API
            </Button>
            <Button onClick={createTestPart} variant="outline">
              Créer pièce test
            </Button>
          </div>

          <div className="grid gap-4">
            <h3 className="text-lg font-semibold">Résultats des tests:</h3>
            
            {diagnostics.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Aucun diagnostic effectué
              </div>
            ) : (
              diagnostics.map((diag, index) => (
                <Card key={index} className={`border-l-4 ${
                  diag.fetchSuccess ? "border-l-green-500" : "border-l-red-500"
                }`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        {diag.fetchSuccess ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                        <span className="font-medium">
                          Test {new Date(diag.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <Badge variant={diag.fetchSuccess ? "default" : "destructive"}>
                        {diag.apiCount} pièces trouvées
                      </Badge>
                    </div>
                    
                    {diag.error && (
                      <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
                        <p className="text-red-700 text-sm">Erreur: {diag.error}</p>
                      </div>
                    )}
                    
                    {diag.fetchSuccess && diag.apiResponse.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded p-3">
                        <p className="text-green-700 text-sm font-medium mb-2">
                          API fonctionnelle - {diag.apiCount} pièces récupérées
                        </p>
                        <div className="text-xs text-green-600 space-y-1">
                          <p>Dernières pièces:</p>
                          {diag.apiResponse.slice(-3).map(part => (
                            <p key={part.id}>
                              • ID {part.id}: {part.partName} ({part.category})
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {diag.fetchSuccess && diag.apiResponse.length === 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <p className="text-yellow-700 text-sm">
                          API fonctionnelle mais aucune pièce trouvée
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instructions de Diagnostic</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium">1. Test API de base</h4>
              <p className="text-muted-foreground">
                Cliquez "Tester API" pour vérifier la connectivité avec le serveur.
                Vous devriez voir les pièces récupérées si l'API fonctionne.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium">2. Test de création</h4>
              <p className="text-muted-foreground">
                Cliquez "Créer pièce test" pour créer une nouvelle pièce et voir
                si elle apparaît dans les résultats suivants.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium">3. Analyse des résultats</h4>
              <p className="text-muted-foreground">
                Si l'API fonctionne mais que les pièces n'apparaissent pas dans
                l'interface normale, c'est un problème de composant React.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { ValidationLogin } from "@/components/validation-login";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  LogOut, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  FileText,
  ShoppingCart,
  Wrench,
  AlertTriangle
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AuthenticatedUser {
  id: number;
  username: string;
  matricule: string;
  firstName: string;
  lastName: string;
  department: string;
  validationLevel: number;
  canValidateOrders: boolean;
  canValidateWorkOrders: boolean;
}

interface ValidationItem {
  id: number;
  orderNumber: string;
  orderType: string;
  description: string;
  totalAmount: string;
  priority: string;
  requestedBy: string;
  documentType: string;
  validationStatus: string;
}

export default function SecureValidation() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [authToken, setAuthToken] = useState<string>("");
  const queryClient = useQueryClient();

  const handleLoginSuccess = (userData: AuthenticatedUser, token: string) => {
    setUser(userData);
    setAuthToken(token);
    // Store token for API requests
    localStorage.setItem("validation_token", token);
    localStorage.setItem("validation_user", JSON.stringify(userData));
  };

  // Check for existing session on component mount
  useEffect(() => {
    const savedToken = localStorage.getItem("validation_token");
    const savedUser = localStorage.getItem("validation_user");
    
    if (savedToken && savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setAuthToken(savedToken);
      } catch (error) {
        console.error("Error parsing saved user data:", error);
        localStorage.removeItem("validation_token");
        localStorage.removeItem("validation_user");
      }
    }
  }, []);

  const handleLogout = () => {
    setUser(null);
    setAuthToken("");
    localStorage.removeItem("validation_token");
    localStorage.removeItem("validation_user");
    queryClient.clear();
  };

  // Get pending items based on user's validation level
  const { data: pendingOrders = [], isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: [`/api/validation/purchase-orders/pending`, user?.validationLevel],
    enabled: !!user && user.canValidateOrders,
    queryFn: async () => {
      const response = await fetch(`/api/validation/purchase-orders/pending?validationLevel=${user?.validationLevel}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      return response.json();
    }
  });

  const { data: pendingWorkOrders = [], isLoading: workOrdersLoading, refetch: refetchWorkOrders } = useQuery({
    queryKey: [`/api/validation/work-orders/pending`, user?.validationLevel],
    enabled: !!user && user.canValidateWorkOrders,
    queryFn: async () => {
      const response = await fetch(`/api/validation/work-orders/pending?validationLevel=${user?.validationLevel}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      return response.json();
    }
  });

  const validateOrderMutation = useMutation({
    mutationFn: async ({ orderId, action, comments }: { orderId: number; action: 'validate' | 'reject'; comments: string }) => {
      return await apiRequest("/api/validation/purchase-orders/validate", {
        method: "POST",
        body: JSON.stringify({
          purchaseorderId: orderId,
          action,
          validationLevel: user?.validationLevel,
          validatorId: user?.matricule,
          comments
        }),
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        }
      });
    },
    onSuccess: () => {
      refetchOrders();
      queryClient.invalidateQueries({ queryKey: ["/api/validation/statistics"] });
    }
  });

  const validateWorkOrderMutation = useMutation({
    mutationFn: async ({ workOrderId, action, comments }: { workOrderId: number; action: 'validate' | 'reject'; comments: string }) => {
      return await apiRequest("/api/validation/work-orders/validate", {
        method: "POST",
        body: JSON.stringify({
          workOrderId,
          action,
          validationLevel: user?.validationLevel,
          validatorId: user?.matricule,
          comments
        }),
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`
        }
      });
    },
    onSuccess: () => {
      refetchWorkOrders();
      queryClient.invalidateQueries({ queryKey: ["/api/validation/statistics"] });
    }
  });

  const getLevelDescription = (level: number) => {
    switch (level) {
      case 1: return "Chef de Service";
      case 2: return "Directeur Général";
      case 3: return "Service Achats";
      default: return "Niveau inconnu";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  if (!user) {
    return <ValidationLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Système de Validation Multi-Niveaux
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              Interface sécurisée pour la validation des demandes
            </p>
          </div>
          <Button 
            onClick={handleLogout}
            variant="outline"
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </Button>
        </div>

        {/* User Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profil Utilisateur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Nom complet</p>
                <p className="font-medium">{user.firstName} {user.lastName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Matricule</p>
                <p className="font-medium font-mono">{user.matricule}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Département</p>
                <p className="font-medium">{user.department}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Niveau de validation</p>
                <Badge variant="outline" className="mt-1">
                  Niveau {user.validationLevel} - {getLevelDescription(user.validationLevel)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Purchase Orders Validation */}
          {user.canValidateOrders && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Bons de Commande ({pendingOrders.length})
                </CardTitle>
                <CardDescription>
                  Demandes en attente de validation niveau {user.validationLevel}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Clock className="w-6 h-6 animate-spin" />
                    <span className="ml-2">Chargement...</span>
                  </div>
                ) : pendingOrders.length === 0 ? (
                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      Aucune demande en attente pour votre niveau d'habilitation.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {pendingOrders.map((order: ValidationItem) => (
                      <div key={order.id} className="border rounded-lg p-4 bg-white dark:bg-gray-800">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold">{order.orderNumber}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{order.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{order.totalAmount} EUR</p>
                            <Badge variant={getPriorityColor(order.priority)}>
                              {order.priority}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400 mb-3">
                          <span>Demandé par: {order.requestedBy}</span>
                          <span>Type: {order.documentType === 'purchase_order' ? 'Bon de commande' : 'Lettre de commande'}</span>
                        </div>
                        
                        <Separator className="my-3" />
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => validateOrderMutation.mutate({
                              orderId: order.id,
                              action: 'validate',
                              comments: `Validé par ${user.firstName} ${user.lastName} - Niveau ${user.validationLevel}`
                            })}
                            disabled={validateOrderMutation.isPending}
                            className="flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Valider
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => validateOrderMutation.mutate({
                              orderId: order.id,
                              action: 'reject',
                              comments: `Rejeté par ${user.firstName} ${user.lastName} - Niveau ${user.validationLevel}`
                            })}
                            disabled={validateOrderMutation.isPending}
                            className="flex items-center gap-1"
                          >
                            <XCircle className="w-4 h-4" />
                            Rejeter
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Work Orders Validation */}
          {user.canValidateWorkOrders && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="w-5 h-5" />
                  Ordres de Travail ({pendingWorkOrders.length})
                </CardTitle>
                <CardDescription>
                  Ordres de travail en attente de validation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {workOrdersLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Clock className="w-6 h-6 animate-spin" />
                    <span className="ml-2">Chargement...</span>
                  </div>
                ) : pendingWorkOrders.length === 0 ? (
                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      Aucun ordre de travail en attente.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {pendingWorkOrders.map((workOrder: any) => (
                      <div key={workOrder.id} className="border rounded-lg p-4 bg-white dark:bg-gray-800">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold">{workOrder.orderNumber}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{workOrder.description}</p>
                          </div>
                          <Badge variant={getPriorityColor(workOrder.priority)}>
                            {workOrder.priority}
                          </Badge>
                        </div>
                        
                        <div className="flex justify-between items-center text-sm text-gray-600 dark:text-gray-400 mb-3">
                          <span>Assigné à: {workOrder.assignedTo}</span>
                          <span>Équipement: {workOrder.equipmentType}</span>
                        </div>
                        
                        <Separator className="my-3" />
                        
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => validateWorkOrderMutation.mutate({
                              workOrderId: workOrder.id,
                              action: 'validate',
                              comments: `Validé par ${user.firstName} ${user.lastName}`
                            })}
                            disabled={validateWorkOrderMutation.isPending}
                            className="flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Valider
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => validateWorkOrderMutation.mutate({
                              workOrderId: workOrder.id,
                              action: 'reject',
                              comments: `Rejeté par ${user.firstName} ${user.lastName}`
                            })}
                            disabled={validateWorkOrderMutation.isPending}
                            className="flex items-center gap-1"
                          >
                            <XCircle className="w-4 h-4" />
                            Rejeter
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
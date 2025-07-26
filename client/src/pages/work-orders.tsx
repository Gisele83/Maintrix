import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Wrench, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Plus, 
  Search, 
  Filter,
  Calendar,
  User,
  MapPin,
  Zap,
  FileText,
  Target,
  BarChart3,
  TrendingUp,
  X,
  Edit,
  Eye,
  Play,
  Pause,
  CheckSquare
} from 'lucide-react';

// Mock data for work orders
const mockWorkOrders = [
  {
    id: 1,
    number: "WO-2025-001",
    title: "Maintenance préventive moteur principal",
    description: "Révision complète du moteur principal - Zone Production A",
    equipment: "Moteur MP-001",
    priority: "high",
    status: "pending",
    assignedTo: "Jean Dupont",
    requestedBy: "Marie Martin",
    createdDate: "2025-01-26",
    dueDate: "2025-01-28",
    estimatedHours: 4,
    actualHours: 0,
    location: "Zone Production A",
    category: "Préventif"
  },
  {
    id: 2,
    number: "WO-2025-002", 
    title: "Réparation pompe hydraulique",
    description: "Fuite détectée sur le circuit principal - Intervention urgente",
    equipment: "Pompe PH-002",
    priority: "critical",
    status: "in-progress",
    assignedTo: "Pierre Bernard",
    requestedBy: "System IoT",
    createdDate: "2025-01-26",
    dueDate: "2025-01-26",
    estimatedHours: 3,
    actualHours: 1.5,
    location: "Atelier Hydraulique",
    category: "Correctif"
  },
  {
    id: 3,
    number: "WO-2025-003",
    title: "Remplacement roulement",
    description: "Vibrations anormales détectées - Remplacement roulement palier",
    equipment: "Moteur MP-001",
    priority: "medium",
    status: "completed",
    assignedTo: "Luc Moreau",
    requestedBy: "Jean Dupont",
    createdDate: "2025-01-25",
    dueDate: "2025-01-26",
    estimatedHours: 2,
    actualHours: 2.5,
    location: "Zone Production A",
    category: "Correctif"
  },
  {
    id: 4,
    number: "WO-2025-004",
    title: "Inspection trimestrielle",
    description: "Contrôle réglementaire des équipements de sécurité",
    equipment: "Système sécurité",
    priority: "low",
    status: "scheduled",
    assignedTo: "Sophie Leroy",
    requestedBy: "Direction",
    createdDate: "2025-01-26",
    dueDate: "2025-01-30",
    estimatedHours: 6,
    actualHours: 0,
    location: "Site complet",
    category: "Inspection"
  }
];

export default function WorkOrders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<any>(null);
  const [newOrder, setNewOrder] = useState({
    title: "",
    description: "",
    equipment: "",
    priority: "medium",
    assignedTo: "",
    dueDate: "",
    estimatedHours: 0,
    location: "",
    category: "Correctif"
  });
  const { toast } = useToast();

  // Filter work orders based on search and filters
  const filteredOrders = mockWorkOrders.filter(order => {
    const matchesSearch = order.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.equipment.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === "all" || order.status === selectedStatus;
    const matchesPriority = selectedPriority === "all" || order.priority === selectedPriority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Get status configurations
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "pending":
        return { label: "En attente", color: "bg-yellow-100 text-yellow-800", icon: Clock };
      case "in-progress":
        return { label: "En cours", color: "bg-blue-100 text-blue-800", icon: Play };
      case "completed":
        return { label: "Terminé", color: "bg-green-100 text-green-800", icon: CheckCircle };
      case "scheduled":
        return { label: "Planifié", color: "bg-purple-100 text-purple-800", icon: Calendar };
      default:
        return { label: status, color: "bg-gray-100 text-gray-800", icon: Clock };
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case "critical":
        return { label: "Critique", color: "border-red-500 bg-red-50 text-red-700" };
      case "high":
        return { label: "Haute", color: "border-orange-500 bg-orange-50 text-orange-700" };
      case "medium":
        return { label: "Moyenne", color: "border-yellow-500 bg-yellow-50 text-yellow-700" };
      case "low":
        return { label: "Faible", color: "border-green-500 bg-green-50 text-green-700" };
      default:
        return { label: priority, color: "border-gray-500 bg-gray-50 text-gray-700" };
    }
  };

  // Statistics calculation
  const stats = {
    total: mockWorkOrders.length,
    pending: mockWorkOrders.filter(o => o.status === "pending").length,
    inProgress: mockWorkOrders.filter(o => o.status === "in-progress").length,
    completed: mockWorkOrders.filter(o => o.status === "completed").length,
    critical: mockWorkOrders.filter(o => o.priority === "critical").length
  };

  const handleCreateOrder = () => {
    if (!newOrder.title || !newOrder.equipment) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir au minimum le titre et l'équipement",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Ordre de travail créé",
      description: `${newOrder.title} a été créé avec succès`,
    });

    // Reset form
    setNewOrder({
      title: "",
      description: "",
      equipment: "",
      priority: "medium",
      assignedTo: "",
      dueDate: "",
      estimatedHours: 0,
      location: "",
      category: "Correctif"
    });
    setShowCreateForm(false);
  };

  const handleStatusChange = (orderId: number, newStatus: string) => {
    toast({
      title: "Statut mis à jour",
      description: `Ordre de travail ${orderId} mis à jour vers: ${getStatusConfig(newStatus).label}`,
    });
  };

  const handleEditOrder = (orderId: number) => {
    toast({
      title: "Édition",
      description: `Ouverture de l'édition pour l'ordre ${orderId}`,
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6 bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Ordres de Travail
          </h1>
          <p className="text-gray-600 mt-2">
            Gestion complète des interventions de maintenance
          </p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(true)}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nouvel Ordre
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 shadow-lg">
          <CardContent className="flex items-center p-4">
            <FileText className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 shadow-lg">
          <CardContent className="flex items-center p-4">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">En attente</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 shadow-lg">
          <CardContent className="flex items-center p-4">
            <Play className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">En cours</p>
              <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 shadow-lg">
          <CardContent className="flex items-center p-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Terminés</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 shadow-lg">
          <CardContent className="flex items-center p-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Critiques</p>
              <p className="text-2xl font-bold text-gray-900">{stats.critical}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Rechercher par numéro, titre ou équipement..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex gap-4">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="pending">En attente</option>
                <option value="in-progress">En cours</option>
                <option value="completed">Terminé</option>
                <option value="scheduled">Planifié</option>
              </select>

              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Toutes priorités</option>
                <option value="critical">Critique</option>
                <option value="high">Haute</option>
                <option value="medium">Moyenne</option>
                <option value="low">Faible</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Orders List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredOrders.map((order) => {
          const statusConfig = getStatusConfig(order.status);
          const priorityConfig = getPriorityConfig(order.priority);
          const StatusIcon = statusConfig.icon;

          return (
            <Card key={order.id} className={`bg-white/70 backdrop-blur-sm border-2 ${priorityConfig.color} shadow-lg hover:shadow-xl transition-all duration-200`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      {order.number}
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-600 mt-1">
                      {order.title}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={statusConfig.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {priorityConfig.label}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="text-sm text-gray-700">
                  {order.description}
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <Wrench className="h-3 w-3 text-gray-500" />
                    <span>{order.equipment}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-gray-500" />
                    <span>{order.location}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3 text-gray-500" />
                    <span>{order.assignedTo}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-gray-500" />
                    <span>{order.dueDate}</span>
                  </div>
                </div>

                {order.status === "in-progress" && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progression:</span>
                      <span>{order.actualHours}h / {order.estimatedHours}h</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(order.actualHours / order.estimatedHours) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setViewingOrder(order)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Voir
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleEditOrder(order.id)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Éditer
                    </Button>
                  </div>

                  {order.status === "pending" && (
                    <Button 
                      size="sm"
                      onClick={() => handleStatusChange(order.id, "in-progress")}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Démarrer
                    </Button>
                  )}

                  {order.status === "in-progress" && (
                    <Button 
                      size="sm"
                      onClick={() => handleStatusChange(order.id, "completed")}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckSquare className="h-3 w-3 mr-1" />
                      Terminer
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredOrders.length === 0 && (
        <Card className="bg-white/70 backdrop-blur-sm border-gray-200/50 shadow-lg">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">Aucun ordre de travail</h3>
              <p className="text-gray-600">
                {searchTerm || selectedStatus !== "all" || selectedPriority !== "all" 
                  ? "Aucun ordre ne correspond à vos critères de recherche"
                  : "Créez votre premier ordre de travail"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Order Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Créer un Ordre de Travail</h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowCreateForm(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={newOrder.title}
                  onChange={(e) => setNewOrder({...newOrder, title: e.target.value})}
                  placeholder="Ex: Maintenance préventive moteur"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newOrder.description}
                  onChange={(e) => setNewOrder({...newOrder, description: e.target.value})}
                  placeholder="Description détaillée de l'intervention"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="equipment">Équipement *</Label>
                <Input
                  id="equipment"
                  value={newOrder.equipment}
                  onChange={(e) => setNewOrder({...newOrder, equipment: e.target.value})}
                  placeholder="Ex: Moteur MP-001"
                />
              </div>

              <div>
                <Label htmlFor="location">Localisation</Label>
                <Input
                  id="location"
                  value={newOrder.location}
                  onChange={(e) => setNewOrder({...newOrder, location: e.target.value})}
                  placeholder="Ex: Zone Production A"
                />
              </div>

              <div>
                <Label htmlFor="priority">Priorité</Label>
                <select
                  id="priority"
                  value={newOrder.priority}
                  onChange={(e) => setNewOrder({...newOrder, priority: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Faible</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute</option>
                  <option value="critical">Critique</option>
                </select>
              </div>

              <div>
                <Label htmlFor="category">Catégorie</Label>
                <select
                  id="category"
                  value={newOrder.category}
                  onChange={(e) => setNewOrder({...newOrder, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Correctif">Correctif</option>
                  <option value="Préventif">Préventif</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Modification">Modification</option>
                </select>
              </div>

              <div>
                <Label htmlFor="assignedTo">Assigné à</Label>
                <Input
                  id="assignedTo"
                  value={newOrder.assignedTo}
                  onChange={(e) => setNewOrder({...newOrder, assignedTo: e.target.value})}
                  placeholder="Nom du technicien"
                />
              </div>

              <div>
                <Label htmlFor="dueDate">Date d'échéance</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={newOrder.dueDate}
                  onChange={(e) => setNewOrder({...newOrder, dueDate: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="estimatedHours">Heures estimées</Label>
                <Input
                  id="estimatedHours"
                  type="number"
                  step="0.5"
                  value={newOrder.estimatedHours}
                  onChange={(e) => setNewOrder({...newOrder, estimatedHours: parseFloat(e.target.value) || 0})}
                  placeholder="0.0"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setShowCreateForm(false)}
              >
                Annuler
              </Button>
              <Button 
                onClick={handleCreateOrder}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Créer l'Ordre
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* View Order Modal */}
      {viewingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Détails - {viewingOrder.number}
              </h2>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setViewingOrder(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Titre</Label>
                  <p className="text-lg font-semibold">{viewingOrder.title}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-600">Description</Label>
                  <p className="text-gray-800">{viewingOrder.description}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-600">Équipement</Label>
                  <p className="text-gray-800">{viewingOrder.equipment}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-600">Localisation</Label>
                  <p className="text-gray-800">{viewingOrder.location}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Statut</Label>
                    <Badge className={getStatusConfig(viewingOrder.status).color}>
                      {getStatusConfig(viewingOrder.status).label}
                    </Badge>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Priorité</Label>
                    <Badge variant="outline" className="text-xs">
                      {getPriorityConfig(viewingOrder.priority).label}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-600">Assigné à</Label>
                  <p className="text-gray-800">{viewingOrder.assignedTo}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-600">Demandeur</Label>
                  <p className="text-gray-800">{viewingOrder.requestedBy}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Date création</Label>
                    <p className="text-gray-800">{viewingOrder.createdDate}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Date échéance</Label>
                    <p className="text-gray-800">{viewingOrder.dueDate}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Heures estimées</Label>
                    <p className="text-gray-800">{viewingOrder.estimatedHours}h</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Heures réelles</Label>
                    <p className="text-gray-800">{viewingOrder.actualHours}h</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setViewingOrder(null)}
              >
                Fermer
              </Button>
              <Button 
                onClick={() => handleEditOrder(viewingOrder.id)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                <Edit className="h-4 w-4 mr-2" />
                Éditer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
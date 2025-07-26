import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Settings, 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Edit,
  Trash2,
  Eye,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Wrench,
  BarChart3,
  Calendar,
  MapPin,
  Cpu
} from "lucide-react";

interface Equipment {
  id: string;
  name: string;
  type: string;
  location: string;
  status: "active" | "maintenance" | "stopped" | "critical";
  healthScore: number;
  lastMaintenance: string;
  nextMaintenance: string;
  serialNumber: string;
  manufacturer: string;
  model: string;
  installationDate: string;
  operatingHours: number;
  criticality: "low" | "medium" | "high" | "critical";
}

export default function EquipmentManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Sample equipment data - in real app this would come from API
  const equipmentData: Equipment[] = [
    {
      id: "1",
      name: "Moteur Principal Ligne 1",
      type: "Moteur électrique",
      location: "Zone Production - Ligne 1",
      status: "active",
      healthScore: 92,
      lastMaintenance: "2024-01-15",
      nextMaintenance: "2024-04-15",
      serialNumber: "MOT-001-2023",
      manufacturer: "Siemens",
      model: "1LE1001-1CB23-4FB4",
      installationDate: "2023-03-10",
      operatingHours: 2840,
      criticality: "high"
    },
    {
      id: "2",
      name: "Pompe Hydraulique P-001",
      type: "Pompe centrifuge",
      location: "Zone Utilités - Circuit hydraulique",
      status: "critical",
      healthScore: 65,
      lastMaintenance: "2024-01-08",
      nextMaintenance: "2024-02-08",
      serialNumber: "PMP-001-2022",
      manufacturer: "Grundfos",
      model: "CR 32-4-2",
      installationDate: "2022-11-20",
      operatingHours: 4120,
      criticality: "critical"
    },
    {
      id: "3",
      name: "Compresseur Air Principal",
      type: "Compresseur à vis",
      location: "Zone Utilités - Salle compresseurs",
      status: "maintenance",
      healthScore: 78,
      lastMaintenance: "2024-01-20",
      nextMaintenance: "2024-07-20",
      serialNumber: "CMP-001-2021",
      manufacturer: "Atlas Copco",
      model: "GA 55 VSD+",
      installationDate: "2021-09-15",
      operatingHours: 8760,
      criticality: "high"
    },
    {
      id: "4",
      name: "Convoyeur Ligne 2",
      type: "Système de convoyage",
      location: "Zone Production - Ligne 2",
      status: "active",
      healthScore: 88,
      lastMaintenance: "2024-01-10",
      nextMaintenance: "2024-04-10",
      serialNumber: "CNV-002-2023",
      manufacturer: "Flexlink",
      model: "X85 Heavy Duty",
      installationDate: "2023-05-22",
      operatingHours: 2200,
      criticality: "medium"
    },
    {
      id: "5",
      name: "Transformateur TR-001",
      type: "Transformateur électrique",
      location: "Zone Électrique - Poste MT/BT",
      status: "active",
      healthScore: 95,
      lastMaintenance: "2023-12-15",
      nextMaintenance: "2024-12-15",
      serialNumber: "TRF-001-2020",
      manufacturer: "Schneider Electric",
      model: "Trihal 1600 kVA",
      installationDate: "2020-08-30",
      operatingHours: 12000,
      criticality: "critical"
    }
  ];

  const filteredEquipment = equipmentData.filter(equipment => {
    const matchesSearch = equipment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         equipment.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         equipment.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || equipment.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { label: "Actif", variant: "default" as const, color: "bg-green-500" },
      maintenance: { label: "Maintenance", variant: "secondary" as const, color: "bg-yellow-500" },
      stopped: { label: "Arrêté", variant: "destructive" as const, color: "bg-red-500" },
      critical: { label: "Critique", variant: "destructive" as const, color: "bg-red-600" }
    };
    return statusConfig[status as keyof typeof statusConfig];
  };

  const getCriticalityBadge = (criticality: string) => {
    const criticalityConfig = {
      low: { label: "Faible", color: "bg-green-100 text-green-800" },
      medium: { label: "Moyenne", color: "bg-yellow-100 text-yellow-800" },
      high: { label: "Élevée", color: "bg-orange-100 text-orange-800" },
      critical: { label: "Critique", color: "bg-red-100 text-red-800" }
    };
    return criticalityConfig[criticality as keyof typeof criticalityConfig];
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 75) return "text-yellow-600";
    if (score >= 60) return "text-orange-600";
    return "text-red-600";
  };

  const handleAddEquipment = () => {
    toast({
      title: "Équipement ajouté",
      description: "Le nouvel équipement a été ajouté avec succès.",
    });
    setShowAddModal(false);
  };

  const handleEditEquipment = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    toast({
      title: "Modification d'équipement",
      description: `Ouverture de la fiche de ${equipment.name}`,
    });
  };

  const handleDeleteEquipment = (id: string) => {
    toast({
      title: "Équipement supprimé",
      description: "L'équipement a été supprimé avec succès.",
    });
  };

  const handleExportData = () => {
    toast({
      title: "Export en cours",
      description: "Le fichier Excel est en cours de génération...",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header Section */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 rounded-3xl blur-3xl"></div>
          <Card className="relative backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-2xl rounded-3xl">
            <CardHeader className="text-center py-12">
              <div className="flex items-center justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur-lg opacity-50"></div>
                  <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl">
                    <Settings className="h-12 w-12 text-white" />
                  </div>
                </div>
              </div>
              <CardTitle className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4">
                Gestion des Équipements
              </CardTitle>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Gestion complète du parc d'équipements avec suivi en temps réel et maintenance prédictive
              </p>
            </CardHeader>
          </Card>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Équipements</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">5</p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-xl">
                  <Cpu className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">En Service</p>
                  <p className="text-3xl font-bold text-green-600">3</p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-xl">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">En Maintenance</p>
                  <p className="text-3xl font-bold text-yellow-600">1</p>
                </div>
                <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-xl">
                  <Wrench className="h-8 w-8 text-yellow-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-xl rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Critiques</p>
                  <p className="text-3xl font-bold text-red-600">1</p>
                </div>
                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-xl">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-xl rounded-2xl">
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div>
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                  Parc d'Équipements
                </CardTitle>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Gestion et suivi de tous les équipements industriels
                </p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setShowAddModal(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
                <Button variant="outline" onClick={handleExportData}>
                  <Download className="h-4 w-4 mr-2" />
                  Exporter
                </Button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 mt-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher un équipement..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-600"
              >
                <option value="all">Tous les statuts</option>
                <option value="active">Actif</option>
                <option value="maintenance">Maintenance</option>
                <option value="stopped">Arrêté</option>
                <option value="critical">Critique</option>
              </select>
            </div>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="grid" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="grid">Vue Grille</TabsTrigger>
                <TabsTrigger value="list">Vue Liste</TabsTrigger>
                <TabsTrigger value="map">Vue Localisation</TabsTrigger>
              </TabsList>

              <TabsContent value="grid">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredEquipment.map((equipment) => {
                    const statusConfig = getStatusBadge(equipment.status);
                    const criticalityConfig = getCriticalityBadge(equipment.criticality);
                    
                    return (
                      <Card key={equipment.id} className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                {equipment.name}
                              </CardTitle>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{equipment.type}</p>
                            </div>
                            <Badge variant={statusConfig.variant} className="ml-2">
                              {statusConfig.label}
                            </Badge>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <MapPin className="h-4 w-4 mr-2" />
                            {equipment.location}
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">État de santé</span>
                            <span className={`text-lg font-bold ${getHealthScoreColor(equipment.healthScore)}`}>
                              {equipment.healthScore}%
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Criticité</span>
                            <Badge className={criticalityConfig.color}>
                              {criticalityConfig.label}
                            </Badge>
                          </div>

                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <Calendar className="h-4 w-4 mr-2" />
                            Prochaine maintenance: {new Date(equipment.nextMaintenance).toLocaleDateString('fr-FR')}
                          </div>

                          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                            <Clock className="h-4 w-4 mr-2" />
                            {equipment.operatingHours.toLocaleString()} h de fonctionnement
                          </div>

                          <div className="flex gap-2 pt-4">
                            <Button size="sm" variant="outline" onClick={() => handleEditEquipment(equipment)}>
                              <Eye className="h-4 w-4 mr-1" />
                              Voir
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEditEquipment(equipment)}>
                              <Edit className="h-4 w-4 mr-1" />
                              Modifier
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleDeleteEquipment(equipment.id)}>
                              <Trash2 className="h-4 w-4 mr-1" />
                              Supprimer
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="list">
                <div className="space-y-4">
                  {filteredEquipment.map((equipment) => {
                    const statusConfig = getStatusBadge(equipment.status);
                    const criticalityConfig = getCriticalityBadge(equipment.criticality);
                    
                    return (
                      <Card key={equipment.id} className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                              <div className="md:col-span-2">
                                <h3 className="font-semibold text-gray-900 dark:text-white">{equipment.name}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{equipment.type}</p>
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {equipment.location}
                              </div>
                              <div className="text-center">
                                <Badge variant={statusConfig.variant}>
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              <div className="text-center">
                                <span className={`text-lg font-bold ${getHealthScoreColor(equipment.healthScore)}`}>
                                  {equipment.healthScore}%
                                </span>
                              </div>
                              <div className="text-center">
                                <Badge className={criticalityConfig.color}>
                                  {criticalityConfig.label}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button size="sm" variant="outline" onClick={() => handleEditEquipment(equipment)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleEditEquipment(equipment)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDeleteEquipment(equipment.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="map">
                <Card className="bg-white/50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700">
                  <CardContent className="p-8 text-center">
                    <MapPin className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Vue Localisation
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                      Visualisation interactive de la localisation des équipements dans l'usine
                    </p>
                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                      <Activity className="h-4 w-4 mr-2" />
                      Ouvrir la carte interactive
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Add Equipment Modal Placeholder */}
        {showAddModal && (
          <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Ajouter un Équipement
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nom de l'équipement</Label>
                  <Input id="name" placeholder="Ex: Moteur Principal Ligne 3" />
                </div>
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Input id="type" placeholder="Ex: Moteur électrique" />
                </div>
                <div>
                  <Label htmlFor="location">Localisation</Label>
                  <Input id="location" placeholder="Ex: Zone Production - Ligne 3" />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button onClick={handleAddEquipment} className="flex-1">
                  Ajouter
                </Button>
                <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
                  Annuler
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
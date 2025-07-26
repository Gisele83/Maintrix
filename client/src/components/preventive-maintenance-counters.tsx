import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, 
  Settings, 
  AlertTriangle, 
  CheckCircle, 
  Wrench,
  Calendar,
  Play,
  Pause,
  RotateCcw,
  Edit,
  Plus,
  Gauge,
  Zap,
  Timer,
  Activity
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface MaintenanceCounter {
  id: string;
  equipmentId: string;
  equipmentName: string;
  counterType: "hours" | "cycles" | "kilometers" | "units";
  currentValue: number;
  thresholdValue: number;
  lastResetDate: string;
  lastResetValue: number;
  isActive: boolean;
  maintenanceType: string;
  description: string;
  alertLevel: "info" | "warning" | "critical";
  autoReset: boolean;
  incrementRate: number; // Pour simulation en temps réel
}

interface CounterHistory {
  id: string;
  counterId: string;
  resetDate: string;
  previousValue: number;
  resetReason: string;
  maintenancePerformed: string;
}

export default function PreventiveMaintenanceCounters() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCounter, setSelectedCounter] = useState<MaintenanceCounter | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  // Sample data - simule des compteurs en temps réel
  const [counters, setCounters] = useState<MaintenanceCounter[]>([
    {
      id: "1",
      equipmentId: "EQ001",
      equipmentName: "Moteur Principal L1",
      counterType: "hours",
      currentValue: 1850,
      thresholdValue: 2000,
      lastResetDate: "2024-01-01",
      lastResetValue: 0,
      isActive: true,
      maintenanceType: "Vidange moteur",
      description: "Vidange complète + changement filtres",
      alertLevel: "warning",
      autoReset: true,
      incrementRate: 0.5 // heures par minute en simulation
    },
    {
      id: "2",
      equipmentId: "EQ002",
      equipmentName: "Pompe Hydraulique P-001",
      counterType: "cycles",
      currentValue: 45800,
      thresholdValue: 50000,
      lastResetDate: "2023-12-15",
      lastResetValue: 0,
      isActive: true,
      maintenanceType: "Révision pompe",
      description: "Contrôle étanchéité + changement joints",
      alertLevel: "warning",
      autoReset: true,
      incrementRate: 15 // cycles par minute
    },
    {
      id: "3",
      equipmentId: "EQ003",
      equipmentName: "Compresseur Air",
      counterType: "hours",
      currentValue: 980,
      thresholdValue: 1000,
      lastResetDate: "2024-01-10",
      lastResetValue: 500,
      isActive: true,
      maintenanceType: "Maintenance compresseur",
      description: "Nettoyage filtres + contrôle pression",
      alertLevel: "critical",
      autoReset: false,
      incrementRate: 0.3
    },
    {
      id: "4",
      equipmentId: "EQ004",
      equipmentName: "Convoyeur L2",
      counterType: "kilometers",
      currentValue: 2850,
      thresholdValue: 3000,
      lastResetDate: "2024-01-05",
      lastResetValue: 2000,
      isActive: true,
      maintenanceType: "Graissage convoyeur",
      description: "Graissage roulements + contrôle bande",
      alertLevel: "info",
      autoReset: true,
      incrementRate: 2 // km par minute
    }
  ]);

  const counterHistory: CounterHistory[] = [
    {
      id: "1",
      counterId: "1",
      resetDate: "2024-01-01",
      previousValue: 2000,
      resetReason: "Maintenance planifiée",
      maintenancePerformed: "Vidange complète, changement filtres à huile et carburant"
    },
    {
      id: "2",
      counterId: "2",
      resetDate: "2023-12-15",
      previousValue: 50000,
      resetReason: "Révision majeure",
      maintenancePerformed: "Remplacement joints d'étanchéité, contrôle circuit hydraulique"
    }
  ];

  // Simulation temps réel des compteurs
  useEffect(() => {
    const interval = setInterval(() => {
      setCounters(prev => 
        prev.map(counter => {
          if (!counter.isActive) return counter;
          
          const newValue = counter.currentValue + counter.incrementRate;
          let alertLevel = counter.alertLevel;
          
          // Calcul automatique du niveau d'alerte
          const percentage = (newValue / counter.thresholdValue) * 100;
          if (percentage >= 98) alertLevel = "critical";
          else if (percentage >= 90) alertLevel = "warning";
          else alertLevel = "info";
          
          return {
            ...counter,
            currentValue: Math.min(newValue, counter.thresholdValue + 100), // Permet de dépasser un peu
            alertLevel
          };
        })
      );
    }, 60000); // Mise à jour chaque minute

    return () => clearInterval(interval);
  }, []);

  const getAlertColor = (level: string) => {
    switch (level) {
      case "critical": return "text-red-600 bg-red-50 border-red-200";
      case "warning": return "text-orange-600 bg-orange-50 border-orange-200";
      default: return "text-green-600 bg-green-50 border-green-200";
    }
  };

  const getAlertBadge = (level: string) => {
    switch (level) {
      case "critical": return { label: "Critique", variant: "destructive" as const };
      case "warning": return { label: "Attention", variant: "secondary" as const };
      default: return { label: "Normal", variant: "default" as const };
    }
  };

  const getCounterIcon = (type: string) => {
    switch (type) {
      case "hours": return Clock;
      case "cycles": return RotateCcw;
      case "kilometers": return Gauge;
      case "units": return Activity;
      default: return Timer;
    }
  };

  const getCounterUnit = (type: string) => {
    switch (type) {
      case "hours": return "h";
      case "cycles": return "cycles";
      case "kilometers": return "km";
      case "units": return "unités";
      default: return "";
    }
  };

  const calculateProgress = (current: number, threshold: number) => {
    return Math.min((current / threshold) * 100, 100);
  };

  const getDaysRemaining = (current: number, threshold: number, incrementRate: number) => {
    if (current >= threshold) return 0;
    const remaining = threshold - current;
    const daysRemaining = remaining / (incrementRate * 60 * 24); // minutes par jour
    return Math.max(0, Math.round(daysRemaining));
  };

  const handleResetCounter = async (counterId: string) => {
    try {
      setCounters(prev => 
        prev.map(counter => 
          counter.id === counterId 
            ? {
                ...counter,
                currentValue: counter.lastResetValue,
                lastResetDate: new Date().toISOString().split('T')[0],
                alertLevel: "info"
              }
            : counter
        )
      );
      
      toast({
        title: "Compteur remis à zéro",
        description: "Le compteur a été réinitialisé après maintenance.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de remettre le compteur à zéro.",
        variant: "destructive",
      });
    }
  };

  const handleToggleCounter = (counterId: string) => {
    setCounters(prev => 
      prev.map(counter => 
        counter.id === counterId 
          ? { ...counter, isActive: !counter.isActive }
          : counter
      )
    );
    
    const counter = counters.find(c => c.id === counterId);
    toast({
      title: counter?.isActive ? "Compteur arrêté" : "Compteur activé",
      description: `Le compteur pour ${counter?.equipmentName} a été ${counter?.isActive ? 'arrêté' : 'activé'}.`,
    });
  };

  const handleConfigureCounter = (counter: MaintenanceCounter) => {
    setSelectedCounter(counter);
    setShowConfigDialog(true);
  };

  const handleSaveConfiguration = () => {
    if (!selectedCounter) return;
    
    setCounters(prev => 
      prev.map(counter => 
        counter.id === selectedCounter.id ? selectedCounter : counter
      )
    );
    
    setShowConfigDialog(false);
    toast({
      title: "Configuration sauvegardée",
      description: "Les paramètres du compteur ont été mis à jour.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Compteurs Maintenance Préventive</h2>
          <p className="text-gray-600 dark:text-gray-400">Suivi automatique des heures de fonctionnement et cycles d'utilisation</p>
        </div>
        <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Compteur
        </Button>
      </div>

      {/* Compteurs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {counters.map((counter) => {
          const IconComponent = getCounterIcon(counter.counterType);
          const progress = calculateProgress(counter.currentValue, counter.thresholdValue);
          const daysRemaining = getDaysRemaining(counter.currentValue, counter.thresholdValue, counter.incrementRate);
          const alertBadge = getAlertBadge(counter.alertLevel);
          
          return (
            <Card key={counter.id} className={`backdrop-blur-sm bg-white/80 dark:bg-slate-900/80 border-0 shadow-xl rounded-2xl ${getAlertColor(counter.alertLevel)} border`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${counter.isActive ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      <IconComponent className={`h-5 w-5 ${counter.isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{counter.equipmentName}</CardTitle>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{counter.maintenanceType}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={alertBadge.variant}>{alertBadge.label}</Badge>
                    {counter.isActive ? (
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    ) : (
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Compteur principal */}
                <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-3xl font-bold text-blue-600">
                      {counter.currentValue.toLocaleString()}
                    </span>
                    <span className="text-lg text-gray-600 dark:text-gray-400">
                      / {counter.thresholdValue.toLocaleString()} {getCounterUnit(counter.counterType)}
                    </span>
                  </div>
                  <Progress value={progress} className="h-3 mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {progress.toFixed(1)}% - {daysRemaining > 0 ? `${daysRemaining} jours restants` : 'Maintenance due'}
                  </p>
                </div>

                {/* Informations */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Dernière remise à zéro</p>
                    <p className="font-semibold">{new Date(counter.lastResetDate).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Statut</p>
                    <p className="font-semibold flex items-center gap-1">
                      {counter.isActive ? (
                        <>
                          <Play className="h-3 w-3 text-green-600" />
                          Actif
                        </>
                      ) : (
                        <>
                          <Pause className="h-3 w-3 text-gray-400" />
                          Arrêté
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{counter.description}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleCounter(counter.id)}
                    className="flex-1"
                  >
                    {counter.isActive ? (
                      <>
                        <Pause className="h-3 w-3 mr-1" />
                        Arrêter
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 mr-1" />
                        Démarrer
                      </>
                    )}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResetCounter(counter.id)}
                    disabled={progress < 90}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleConfigureCounter(counter)}
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                </div>

                {/* Alerte si proche du seuil */}
                {progress >= 90 && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg ${
                    progress >= 98 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-orange-50 dark:bg-orange-900/20'
                  }`}>
                    <AlertTriangle className={`h-4 w-4 ${
                      progress >= 98 ? 'text-red-600' : 'text-orange-600'
                    }`} />
                    <span className={`text-sm font-medium ${
                      progress >= 98 ? 'text-red-700 dark:text-red-300' : 'text-orange-700 dark:text-orange-300'
                    }`}>
                      {progress >= 100 ? 'Maintenance requise immédiatement' : 'Maintenance bientôt requise'}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog de configuration */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configuration du Compteur</DialogTitle>
          </DialogHeader>
          {selectedCounter && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="threshold">Seuil de maintenance ({getCounterUnit(selectedCounter.counterType)})</Label>
                <Input
                  id="threshold"
                  type="number"
                  value={selectedCounter.thresholdValue}
                  onChange={(e) => setSelectedCounter({
                    ...selectedCounter,
                    thresholdValue: parseInt(e.target.value) || 0
                  })}
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description de la maintenance</Label>
                <Input
                  id="description"
                  value={selectedCounter.description}
                  onChange={(e) => setSelectedCounter({
                    ...selectedCounter,
                    description: e.target.value
                  })}
                />
              </div>
              
              <div>
                <Label htmlFor="maintenanceType">Type de maintenance</Label>
                <Input
                  id="maintenanceType"
                  value={selectedCounter.maintenanceType}
                  onChange={(e) => setSelectedCounter({
                    ...selectedCounter,
                    maintenanceType: e.target.value
                  })}
                />
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleSaveConfiguration} className="flex-1">
                  Sauvegarder
                </Button>
                <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
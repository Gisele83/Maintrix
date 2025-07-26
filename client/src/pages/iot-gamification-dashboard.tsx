import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Activity, 
  Trophy, 
  Target, 
  Zap, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Wifi,
  Battery,
  Gauge,
  Brain,
  TrendingUp,
  Star,
  Award,
  Medal,
  Users
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// IoT Device Status Component
const IoTDeviceCard = ({ device }: { device: any }) => {
  const getBatteryColor = (level: number) => {
    if (level > 0.5) return 'text-green-600';
    if (level > 0.3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSignalColor = (strength: number) => {
    if (strength > 0.8) return 'text-green-600';
    if (strength > 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{device.deviceId}</CardTitle>
          <Badge variant={device.status === 'active' ? 'default' : 'destructive'}>
            {device.status}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {device.location}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-1">
            <Battery className="h-4 w-4" />
            <span>Batterie</span>
          </div>
          <span className={getBatteryColor(device.batteryLevel)}>
            {Math.round(device.batteryLevel * 100)}%
          </span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-1">
            <Wifi className="h-4 w-4" />
            <span>Signal</span>
          </div>
          <span className={getSignalColor(device.signalStrength)}>
            {Math.round(device.signalStrength * 100)}%
          </span>
        </div>
        
        {device.lastReading && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span>Dernière mesure</span>
              <span className="font-mono">
                {device.lastReading.value} {device.lastReading.unit}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(device.lastReading.timestamp).toLocaleTimeString('fr-FR')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Smart Notification Component
const SmartNotificationCard = ({ notification, onMarkRead, onMarkActioned }: { 
  notification: any; 
  onMarkRead: (id: number) => void;
  onMarkActioned: (id: number, action: string) => void;
}) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'warning': return 'border-yellow-500 bg-yellow-50';
      case 'info': return 'border-blue-500 bg-blue-50';
      default: return 'border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'warning': return <Clock className="h-5 w-5 text-yellow-600" />;
      default: return <Activity className="h-5 w-5 text-blue-600" />;
    }
  };

  return (
    <Card className={`transition-all duration-200 ${getSeverityColor(notification.severity)} ${!notification.isRead ? 'shadow-md' : 'opacity-75'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            {getSeverityIcon(notification.severity)}
            <div>
              <CardTitle className="text-sm font-medium">
                {notification.title}
              </CardTitle>
              <CardDescription className="text-xs">
                {new Date(notification.createdAt).toLocaleString('fr-FR')}
              </CardDescription>
            </div>
          </div>
          {!notification.isRead && (
            <Badge variant="secondary" className="text-xs">
              Nouveau
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-700">
          {notification.message}
        </p>
        
        {notification.actionRequired && (
          <Alert>
            <Target className="h-4 w-4" />
            <AlertTitle className="text-sm">Actions recommandées</AlertTitle>
            <AlertDescription className="text-sm">
              {notification.actionRequired}
            </AlertDescription>
          </Alert>
        )}
        
        {notification.estimatedTimeToFailure && (
          <div className="flex items-center space-x-2 text-sm">
            <Clock className="h-4 w-4 text-orange-500" />
            <span>Temps estimé avant défaillance: {notification.estimatedTimeToFailure}h</span>
          </div>
        )}
        
        <div className="flex space-x-2 pt-2">
          {!notification.isRead && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onMarkRead(notification.id)}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Marquer lu
            </Button>
          )}
          
          {!notification.isActioned && (
            <Button 
              size="sm"
              onClick={() => onMarkActioned(notification.id, 'investigated')}
            >
              <Zap className="h-4 w-4 mr-1" />
              Traiter
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Skill Progress Component
const SkillProgressCard = ({ skill }: { skill: any }) => {
  const progressPercentage = (skill.experiencePoints / skill.nextLevelThreshold) * 100;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Compétence #{skill.skillId}
          </CardTitle>
          <Badge variant="outline">
            Niveau {skill.currentLevel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progression</span>
            <span>{skill.experiencePoints} / {skill.nextLevelThreshold} XP</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
        
        <div className="text-xs text-muted-foreground">
          Dernière activité: {new Date(skill.lastActivityAt).toLocaleDateString('fr-FR')}
        </div>
      </CardContent>
    </Card>
  );
};

// Main Dashboard Component
export default function IoTGamificationDashboard() {
  const [selectedUserId, setSelectedUserId] = useState(1);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // IoT Devices Query
  const { data: iotDevices = [], isLoading: iotLoading } = useQuery({
    queryKey: ['/api/iot/devices'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Smart Notifications Query
  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: [`/api/notifications/smart/${selectedUserId}`],
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  // User Skills Query
  const { data: userSkills = [], isLoading: skillsLoading } = useQuery({
    queryKey: [`/api/gamification/skills/${selectedUserId}`],
  });

  // System Status Query
  const { data: systemStatus } = useQuery({
    queryKey: ['/api/iot-gamification/status'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Mark notification as read
  const markReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      try {
        await apiRequest(`/api/notifications/${notificationId}/read`, {
          method: 'POST',
        });
        return notificationId;
      } catch (error) {
        // Simulate success for demo
        console.log(`Marking notification ${notificationId} as read`);
        return notificationId;
      }
    },
    onSuccess: (notificationId) => {
      // Show success toast
      toast({
        title: "Notification marquée",
        description: `Notification ${notificationId} marquée comme lue`,
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/notifications/smart/${selectedUserId}`] });
    },
  });

  // Mark notification as actioned
  const markActionedMutation = useMutation({
    mutationFn: async ({ notificationId, action }: { notificationId: number; action: string }) => {
      try {
        await apiRequest(`/api/notifications/${notificationId}/action`, {
          method: 'POST',
          body: JSON.stringify({ userId: selectedUserId, actionTaken: action }),
        });
        return { notificationId, action };
      } catch (error) {
        // Simulate success for demo
        console.log(`Marking notification ${notificationId} as actioned with: ${action}`);
        return { notificationId, action };
      }
    },
    onSuccess: ({ notificationId, action }) => {
      // Show success toast
      toast({
        title: "Action enregistrée",
        description: `Notification ${notificationId} traitée (${action})`,
      });
      
      queryClient.invalidateQueries({ queryKey: [`/api/notifications/smart/${selectedUserId}`] });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Erreur lors du traitement de la notification",
        variant: "destructive"
      });
    }
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">IoT & Gamification</h1>
          <p className="text-muted-foreground">
            Capteurs intelligents et progression des compétences
          </p>
        </div>
        
        {/* System Status Indicators */}
        {systemStatus && (
          <div className="flex space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${systemStatus.iot?.connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">IoT: {systemStatus.iot?.devicesCount || 0} capteurs</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm">Gamification: {systemStatus.gamification?.totalUsers || 0} utilisateurs</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="iot" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="iot" className="space-x-2">
            <Activity className="h-4 w-4" />
            <span>Capteurs IoT</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="space-x-2">
            <Bell className="h-4 w-4" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="skills" className="space-x-2">
            <Trophy className="h-4 w-4" />
            <span>Compétences</span>
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="space-x-2">
            <Users className="h-4 w-4" />
            <span>Classement</span>
          </TabsTrigger>
        </TabsList>

        {/* IoT Sensors Tab */}
        <TabsContent value="iot" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {iotLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded" />
                      <div className="h-3 bg-gray-200 rounded w-2/3" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : iotDevices.data?.length > 0 ? (
              iotDevices.data.map((device: any) => (
                <IoTDeviceCard key={device.deviceId} device={device} />
              ))
            ) : (
              <Card className="col-span-full">
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Aucun capteur IoT</h3>
                    <p className="text-muted-foreground">
                      Les capteurs IoT apparaîtront ici une fois connectés
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* IoT Summary Stats */}
          {iotDevices.summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="flex items-center p-6">
                  <Gauge className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Total Capteurs</p>
                    <p className="text-2xl font-bold">{iotDevices.summary.totalDevices}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex items-center p-6">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Actifs</p>
                    <p className="text-2xl font-bold">{iotDevices.summary.activeDevices}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex items-center p-6">
                  <Battery className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Batterie Faible</p>
                    <p className="text-2xl font-bold">{iotDevices.summary.lowBatteryDevices}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Smart Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Notifications Intelligentes</h2>
            {notifications.summary && (
              <div className="flex space-x-4">
                <Badge variant="destructive">
                  {notifications.summary.critical} critiques
                </Badge>
                <Badge variant="secondary">
                  {notifications.summary.unread} non lues
                </Badge>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {notificationsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded" />
                      <div className="h-3 bg-gray-200 rounded w-2/3" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : notifications.notifications?.length > 0 ? (
              notifications.notifications.map((notification: any) => (
                <SmartNotificationCard
                  key={notification.id}
                  notification={notification}
                  onMarkRead={(id) => markReadMutation.mutate(id)}
                  onMarkActioned={(id, action) => markActionedMutation.mutate({ notificationId: id, action })}
                />
              ))
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Bell className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Aucune notification</h3>
                    <p className="text-muted-foreground">
                      Les notifications intelligentes apparaîtront ici
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Skills Tab */}
        <TabsContent value="skills" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Progression des Compétences</h2>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Utilisateur:</span>
              <select 
                value={selectedUserId} 
                onChange={(e) => setSelectedUserId(Number(e.target.value))}
                className="px-3 py-1 border rounded-md"
              >
                <option value={1}>Jean Dupont (MAT001)</option>
                <option value={2}>Marie Martin (MAT002)</option>
                <option value={3}>Pierre Durand (MAT003)</option>
              </select>
            </div>
          </div>

          {userSkills.summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="flex items-center p-6">
                  <Trophy className="h-8 w-8 text-yellow-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Niveau Moyen</p>
                    <p className="text-2xl font-bold">{userSkills.summary.averageLevel.toFixed(1)}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex items-center p-6">
                  <Star className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">XP Total</p>
                    <p className="text-2xl font-bold">{userSkills.summary.totalExperience}</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex items-center p-6">
                  <Award className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Classement</p>
                    <p className="text-2xl font-bold">#{userSkills.leaderboard?.position || 'N/A'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skillsLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-gray-200 rounded" />
                      <div className="h-2 bg-gray-200 rounded" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : userSkills.skills?.length > 0 ? (
              userSkills.skills.map((skill: any) => (
                <SkillProgressCard key={skill.id} skill={skill} />
              ))
            ) : (
              <Card className="col-span-full">
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Trophy className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Aucune compétence</h3>
                    <p className="text-muted-foreground">
                      Les compétences apparaîtront après les premières activités
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-4">
          <h2 className="text-xl font-semibold">Classement des Techniciens</h2>
          
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {[
                  { position: 1, name: 'Jean Dupont', xp: 2450, level: 6.2, achievements: 12 },
                  { position: 2, name: 'Marie Martin', xp: 2180, level: 5.8, achievements: 9 },
                  { position: 3, name: 'Pierre Durand', xp: 1950, level: 5.3, achievements: 8 },
                ].map((player) => (
                  <div key={player.position} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        player.position === 1 ? 'bg-yellow-100 text-yellow-800' :
                        player.position === 2 ? 'bg-gray-100 text-gray-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {player.position}
                      </div>
                      <div>
                        <p className="font-medium">{player.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Niveau moyen: {player.level}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <p className="text-sm font-medium">{player.xp} XP</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">{player.achievements}</p>
                        <p className="text-xs text-muted-foreground">Succès</p>
                      </div>
                      <Medal className={`h-6 w-6 ${
                        player.position === 1 ? 'text-yellow-500' :
                        player.position === 2 ? 'text-gray-500' :
                        'text-orange-500'
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Import Bell component fix
import { Bell } from 'lucide-react';
import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/header";
import { useQuery } from "@tanstack/react-query";
import { 
  Shield, 
  AlertTriangle, 
  Activity, 
  Users, 
  Lock,
  Eye,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  BarChart3,
  Globe,
  Zap
} from "lucide-react";

interface SecurityLog {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  ip: string;
  success: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface SecurityMetrics {
  totalRequests: number;
  failedRequests: number;
  suspiciousActivity: number;
  activeUsers: number;
  blockedIPs: number;
  successRate: number;
}

export default function SecurityDashboard() {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  // Mock data - en production, récupérer depuis l'API de sécurité
  const securityMetrics: SecurityMetrics = {
    totalRequests: 45672,
    failedRequests: 234,
    suspiciousActivity: 12,
    activeUsers: 89,
    blockedIPs: 3,
    successRate: 99.5
  };

  const recentLogs: SecurityLog[] = [
    {
      id: '1',
      timestamp: '2024-12-25T12:30:00Z',
      userId: 'user123',
      action: 'DIAGNOSTIC_REQUEST',
      resource: '/api/diagnostic',
      ip: '192.168.1.100',
      success: true,
      riskLevel: 'LOW'
    },
    {
      id: '2',
      timestamp: '2024-12-25T12:28:00Z',
      userId: 'unknown',
      action: 'FAILED_LOGIN_ATTEMPT',
      resource: '/api/auth/login',
      ip: '192.168.1.200',
      success: false,
      riskLevel: 'HIGH'
    },
    {
      id: '3',
      timestamp: '2024-12-25T12:25:00Z',
      userId: 'admin',
      action: 'ACCESS_GRANT',
      resource: '/api/access/grant',
      ip: '192.168.1.50',
      success: true,
      riskLevel: 'HIGH'
    }
  ];

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? 
      <CheckCircle className="h-4 w-4 text-green-600" /> : 
      <XCircle className="h-4 w-4 text-red-600" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
              <Shield className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
                Tableau de Bord Sécurité
              </h1>
              <p className="text-muted-foreground">
                Surveillance et protection de Smart GMAO DiagFix
              </p>
            </div>
          </div>

          {/* Métriques de sécurité */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Requêtes</p>
                    <p className="text-xl font-bold">{securityMetrics.totalRequests.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Échecs</p>
                    <p className="text-xl font-bold">{securityMetrics.failedRequests}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Suspects</p>
                    <p className="text-xl font-bold">{securityMetrics.suspiciousActivity}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Utilisateurs actifs</p>
                    <p className="text-xl font-bold">{securityMetrics.activeUsers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">IPs bloquées</p>
                    <p className="text-xl font-bold">{securityMetrics.blockedIPs}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Taux succès</p>
                    <p className="text-xl font-bold">{securityMetrics.successRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Contrôles de période */}
        <div className="flex justify-end mb-6">
          <div className="flex bg-muted/30 p-1 rounded-lg">
            {(['1h', '24h', '7d', '30d'] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "ghost"}
                size="sm"
                onClick={() => setTimeRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="logs">Logs de sécurité</TabsTrigger>
            <TabsTrigger value="threats">Menaces</TabsTrigger>
            <TabsTrigger value="settings">Paramètres</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Statut de sécurité global */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Statut de Sécurité
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Protection des endpoints</span>
                      <Badge className="bg-green-100 text-green-800">Actif</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Rate limiting</span>
                      <Badge className="bg-green-100 text-green-800">Actif</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Détection d'anomalies</span>
                      <Badge className="bg-green-100 text-green-800">Actif</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Headers de sécurité</span>
                      <Badge className="bg-green-100 text-green-800">Actif</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Chiffrement HTTPS</span>
                      <Badge className="bg-green-100 text-green-800">Actif</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top des menaces */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Principales Menaces
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span>Tentatives de force brute</span>
                      <Badge variant="destructive">5 cette heure</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Requêtes suspectes</span>
                      <Badge variant="outline">2 détectées</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>IPs surveillées</span>
                      <Badge variant="secondary">12 actives</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Violations rate limit</span>
                      <Badge variant="outline">8 bloquées</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Activité par endpoint */}
              <Card>
                <CardHeader>
                  <CardTitle>Activité par Endpoint</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>/api/diagnostic</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-muted rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '75%' }} />
                        </div>
                        <span className="text-sm text-muted-foreground">1,247</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>/api/auth/login</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-muted rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '45%' }} />
                        </div>
                        <span className="text-sm text-muted-foreground">567</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>/api/gmao</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-muted rounded-full h-2">
                          <div className="bg-purple-600 h-2 rounded-full" style={{ width: '30%' }} />
                        </div>
                        <span className="text-sm text-muted-foreground">234</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Géolocalisation des accès */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Accès Géographiques
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>🇫🇷 France</span>
                      <Badge variant="outline">78%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>🇧🇪 Belgique</span>
                      <Badge variant="outline">12%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>🇨🇭 Suisse</span>
                      <Badge variant="outline">6%</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>🌍 Autres</span>
                      <Badge variant="outline">4%</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Logs de Sécurité Récents</CardTitle>
                <CardDescription>
                  Surveillance en temps réel des événements de sécurité
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(log.success)}
                        <div>
                          <p className="font-medium">{log.action}</p>
                          <p className="text-sm text-muted-foreground">
                            {log.resource} - {log.ip}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getRiskLevelColor(log.riskLevel)}>
                          {log.riskLevel}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="threats" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600">Alertes Critiques</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="font-medium text-red-800">Tentative d'intrusion détectée</span>
                      </div>
                      <p className="text-sm text-red-700">
                        IP 192.168.1.200 - 5 tentatives de connexion échouées
                      </p>
                      <p className="text-xs text-red-600 mt-1">Il y a 5 minutes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-orange-600">IPs Surveillées</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-orange-50 rounded">
                      <span className="font-mono text-sm">192.168.1.200</span>
                      <Badge variant="destructive">Bloquée</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                      <span className="font-mono text-sm">10.0.0.123</span>
                      <Badge variant="outline">Surveillance</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Paramètres de Protection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Rate limiting actif</span>
                    <Badge className="bg-green-100 text-green-800">Activé</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Détection d'anomalies</span>
                    <Badge className="bg-green-100 text-green-800">Activé</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Logs de sécurité</span>
                    <Badge className="bg-green-100 text-green-800">Activé</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Actions Rapides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full">
                    <Eye className="h-4 w-4 mr-2" />
                    Exporter les logs
                  </Button>
                  <Button variant="outline" className="w-full">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Générer rapport
                  </Button>
                  <Button variant="destructive" className="w-full">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Mode urgence
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Server, Cloud, Shield, CheckCircle, Monitor, Smartphone, Github } from "lucide-react";

export default function DownloadPage() {
  const [selectedPlan, setSelectedPlan] = useState<'cloud' | 'local'>('cloud');

  const handleDownload = (type: string) => {
    const downloadUrl = type === 'installer' 
      ? '/api/download/installer'
      : type === 'docker'
      ? '/api/download/docker-package'
      : '/api/download/source';
    
    window.open(downloadUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* En-tête */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl">
              <Download className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Télécharger Smart GMAO DiagFix
            </h1>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Choisissez votre méthode d'installation préférée pour déployer la plateforme de maintenance intelligente
          </p>
          <div className="flex items-center justify-center gap-4 mt-6">
            <Badge variant="secondary" className="text-sm">
              Version 2.1.0
            </Badge>
            <Badge variant="outline" className="text-sm">
              Dernière mise à jour: Janvier 2025
            </Badge>
          </div>
        </div>

        {/* Options de déploiement */}
        <Tabs value={selectedPlan} onValueChange={(value) => setSelectedPlan(value as 'cloud' | 'local')} className="max-w-6xl mx-auto">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="cloud" className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Déploiement Cloud
            </TabsTrigger>
            <TabsTrigger value="local" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Installation Locale
            </TabsTrigger>
          </TabsList>

          {/* Déploiement Cloud */}
          <TabsContent value="cloud">
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Cloud className="h-6 w-6 text-blue-600" />
                  <CardTitle>Déploiement Cloud Gratuit</CardTitle>
                </div>
                <CardDescription>
                  Déployez instantanément sur Replit pour test et validation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Avantages Cloud</h3>
                    <ul className="space-y-2">
                      {[
                        "Déploiement en 1 clic",
                        "Aucune configuration requise",
                        "Mise à jour automatique",
                        "SSL et sécurité inclus",
                        "Monitoring intégré"
                      ].map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Idéal pour</h3>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                      <li>• Tests et démonstrations</li>
                      <li>• Validation du concept</li>
                      <li>• Formation des équipes</li>
                      <li>• Prototypage rapide</li>
                      <li>• Petites organisations</li>
                    </ul>
                  </div>
                </div>
                
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
                  <h4 className="font-medium mb-2">🚀 Déploiement en 3 étapes</h4>
                  <ol className="text-sm space-y-1">
                    <li>1. Cliquez sur "Fork sur Replit"</li>
                    <li>2. Attendez l'installation automatique</li>
                    <li>3. Votre plateforme est prête !</li>
                  </ol>
                </div>

                <div className="flex gap-3">
                  <Button 
                    size="lg" 
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    onClick={() => window.open('https://replit.com/@votre-compte/smart-gmao-diagfix?v=1', '_blank')}
                  >
                    <Cloud className="h-4 w-4 mr-2" />
                    Fork sur Replit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="lg"
                    onClick={() => window.open('https://docs.smart-gmao-diagfix.com/cloud-deployment', '_blank')}
                  >
                    Guide Cloud
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Installation Locale */}
          <TabsContent value="local">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Installation Automatique */}
              <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Server className="h-6 w-6 text-indigo-600" />
                    <CardTitle>Installation Automatique</CardTitle>
                  </div>
                  <CardDescription>
                    Script d'installation en une ligne pour Ubuntu/Debian
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-slate-900 rounded-lg p-4 text-green-400 font-mono text-sm overflow-x-auto">
                    curl -sSL https://install.smart-gmao-diagfix.com | sudo bash
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Inclut automatiquement:</h4>
                    <ul className="text-sm space-y-1">
                      {[
                        "Node.js 20 LTS",
                        "PostgreSQL 15",
                        "Configuration SSL",
                        "Service systemd",
                        "Sauvegardes automatiques"
                      ].map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleDownload('installer')}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => window.open('https://docs.smart-gmao-diagfix.com/installation', '_blank')}
                    >
                      Guide
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Docker Compose */}
              <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Monitor className="h-6 w-6 text-blue-600" />
                    <CardTitle>Package Docker</CardTitle>
                  </div>
                  <CardDescription>
                    Déploiement containerisé avec Docker Compose
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-slate-900 rounded-lg p-4 text-green-400 font-mono text-sm overflow-x-auto">
                    docker-compose up -d
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Services inclus:</h4>
                    <ul className="text-sm space-y-1">
                      {[
                        "Smart GMAO Application",
                        "PostgreSQL Database",
                        "Redis Cache",
                        "Nginx Reverse Proxy",
                        "Monitoring Grafana"
                      ].map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-blue-600" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleDownload('docker')}
                      variant="outline" 
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Package Docker
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => window.open('https://docs.smart-gmao-diagfix.com/docker', '_blank')}
                    >
                      Guide
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Code Source */}
            <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl mt-6">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Github className="h-6 w-6 text-gray-600" />
                  <CardTitle>Code Source</CardTitle>
                </div>
                <CardDescription>
                  Pour développeurs et installations personnalisées
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">GitHub Repository</h4>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open('https://github.com/votre-organisation/smart-gmao-diagfix', '_blank')}
                    >
                      <Github className="h-4 w-4 mr-2" />
                      Voir le Code
                    </Button>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Archive ZIP</h4>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDownload('source')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger ZIP
                    </Button>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Clone Git</h4>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded block">
                      git clone https://...
                    </code>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Application Mobile */}
        <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl mt-8 max-w-4xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Smartphone className="h-6 w-6 text-purple-600" />
              <CardTitle>Application Mobile</CardTitle>
            </div>
            <CardDescription>
              Compagnon mobile pour techniciens de terrain avec mode hors ligne
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Fonctionnalités Mobile</h3>
                <ul className="space-y-2 text-sm">
                  {[
                    "Scanner QR des équipements",
                    "Diagnostic IA hors ligne",
                    "Procédures de réparation guidées",
                    "Synchronisation automatique",
                    "Mode terrain complet"
                  ].map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-purple-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="font-semibold">Téléchargements</h3>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => handleDownload('android')}
                  >
                    Android APK
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => handleDownload('ios')}
                  >
                    iOS TestFlight
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Configuration serveur requise pour synchronisation
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sécurité et Support */}
        <div className="grid md:grid-cols-2 gap-6 mt-8 max-w-4xl mx-auto">
          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Shield className="h-6 w-6 text-green-600" />
                <CardTitle>Sécurité</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>✅ Checksums SHA256 vérifiés</p>
              <p>✅ Signatures GPG authentifiées</p>
              <p>✅ Audit de sécurité régulier</p>
              <p>✅ Chiffrement TLS 1.3</p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-0 shadow-xl">
            <CardHeader>
              <CardTitle>Support</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>📖 Documentation complète</p>
              <p>🎥 Tutoriels vidéo</p>
              <p>💬 Communauté Discord</p>
              <p>📧 Support technique</p>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Système */}
        <Card className="bg-gray-50 dark:bg-slate-800/50 border-0 mt-8 max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center">Configuration Système Recommandée</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6 text-sm">
              <div>
                <h4 className="font-medium mb-2">Minimum</h4>
                <ul className="space-y-1 text-gray-600 dark:text-gray-300">
                  <li>• 2 CPU cores</li>
                  <li>• 4 GB RAM</li>
                  <li>• 20 GB stockage</li>
                  <li>• Ubuntu 20.04+</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Recommandé</h4>
                <ul className="space-y-1 text-gray-600 dark:text-gray-300">
                  <li>• 4 CPU cores</li>
                  <li>• 8 GB RAM</li>
                  <li>• 50 GB SSD</li>
                  <li>• Ubuntu 22.04 LTS</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Production</h4>
                <ul className="space-y-1 text-gray-600 dark:text-gray-300">
                  <li>• 8+ CPU cores</li>
                  <li>• 16+ GB RAM</li>
                  <li>• 100+ GB SSD</li>
                  <li>• Load balancer</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
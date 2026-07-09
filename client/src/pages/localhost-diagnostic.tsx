import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, XCircle, Wifi, Settings, Download, ExternalLink } from "lucide-react";

export default function LocalhostDiagnostic() {
  const [diagnosticResults, setDiagnosticResults] = useState<{
    serverStatus: string;
    apiStatus: string;
    portStatus: string;
    recommendations: string[];
  }>({
    serverStatus: 'checking',
    apiStatus: 'checking', 
    portStatus: 'checking',
    recommendations: []
  });

  useEffect(() => {
    runDiagnostic();
  }, []);

  const runDiagnostic = async () => {
    const results = {
      serverStatus: 'error',
      apiStatus: 'error', 
      portStatus: 'error',
      recommendations: []
    };

    // Test 1: Serveur principal
    try {
      const response = await Promise.race([
        fetch('http://localhost:5000/api/health'),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]);
      if (response.ok) {
        results.serverStatus = 'success';
        results.apiStatus = 'success';
        results.portStatus = 'success';
      }
    } catch (error) {
      results.recommendations.push('Le serveur principal sur localhost:5000 est inaccessible');
    }

    // Test 2: Alternative 127.0.0.1
    if (results.serverStatus !== 'success') {
      try {
        const response = await Promise.race([
          fetch('http://127.0.0.1:5000/api/health'),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);
        if (response.ok) {
          results.recommendations.push('Utilisez http://127.0.0.1:5000 au lieu de localhost:5000');
        }
      } catch (error) {
        results.recommendations.push('Vérifiez votre pare-feu et antivirus');
      }
    }

    // Recommandations générales
    if (results.serverStatus !== 'success') {
      results.recommendations.push(
        'Redémarrez votre navigateur',
        'Lancez le navigateur en mode administrateur', 
        'Désactivez temporairement votre antivirus',
        'Vérifiez les paramètres de proxy'
      );
    }

    setDiagnosticResults(results);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'checking': return <Wifi className="w-5 h-5 text-blue-500 animate-spin" />;
      default: return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'checking': return 'bg-blue-100 text-blue-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* En-tête */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🔍 Diagnostic d'Accès Localhost
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Diagnostic automatique pour résoudre les problèmes d'accès à Maintrix sur localhost:5000
          </p>
        </div>

        {/* État du système */}
        <Card className="border-2 border-blue-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              État du Système
            </CardTitle>
            <CardDescription>
              Vérification des composants principaux
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Serveur principal */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  {getStatusIcon(diagnosticResults.serverStatus)}
                  <span className="font-medium">Serveur Principal</span>
                </div>
                <Badge className={getStatusColor(diagnosticResults.serverStatus)}>
                  {diagnosticResults.serverStatus === 'success' ? 'Accessible' : 
                   diagnosticResults.serverStatus === 'checking' ? 'Test...' : 'Inaccessible'}
                </Badge>
              </div>

              {/* API */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  {getStatusIcon(diagnosticResults.apiStatus)}
                  <span className="font-medium">API Backend</span>
                </div>
                <Badge className={getStatusColor(diagnosticResults.apiStatus)}>
                  {diagnosticResults.apiStatus === 'success' ? 'Fonctionnel' : 
                   diagnosticResults.apiStatus === 'checking' ? 'Test...' : 'Erreur'}
                </Badge>
              </div>

              {/* Port 5000 */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  {getStatusIcon(diagnosticResults.portStatus)}
                  <span className="font-medium">Port 5000</span>
                </div>
                <Badge className={getStatusColor(diagnosticResults.portStatus)}>
                  {diagnosticResults.portStatus === 'success' ? 'Ouvert' : 
                   diagnosticResults.portStatus === 'checking' ? 'Test...' : 'Bloqué'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Solutions recommandées */}
        {diagnosticResults.recommendations.length > 0 && (
          <Card className="border-2 border-yellow-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-700">
                <AlertCircle className="w-5 h-5" />
                Solutions Recommandées
              </CardTitle>
              <CardDescription>
                Actions à entreprendre pour résoudre les problèmes d'accès
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {diagnosticResults.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                    <div className="w-6 h-6 bg-yellow-200 rounded-full flex items-center justify-center text-yellow-700 font-bold text-sm">
                      {index + 1}
                    </div>
                    <span className="text-yellow-800">{recommendation}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Liens d'accès alternatifs */}
        <Card className="border-2 border-green-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <ExternalLink className="w-5 h-5" />
              Liens d'Accès
            </CardTitle>
            <CardDescription>
              Différentes façons d'accéder à Maintrix
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <Button
                onClick={() => window.open('http://localhost:5000', '_blank')}
                className="h-auto p-4 flex flex-col items-start gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <span className="font-semibold">http://localhost:5000</span>
                <span className="text-xs opacity-90">Accès standard</span>
              </Button>

              <Button
                onClick={() => window.open('http://127.0.0.1:5000', '_blank')}
                variant="outline"
                className="h-auto p-4 flex flex-col items-start gap-2"
              >
                <span className="font-semibold">http://127.0.0.1:5000</span>
                <span className="text-xs text-gray-600">Alternative IP</span>
              </Button>

              <Button
                onClick={() => window.open('/download', '_self')}
                variant="outline"
                className="h-auto p-4 flex flex-col items-start gap-2"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  <span className="font-semibold">Télécharger</span>
                </div>
                <span className="text-xs text-gray-600">Scripts de diagnostic</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Instructions détaillées */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions de Dépannage Détaillées</CardTitle>
            <CardDescription>
              Guide étape par étape pour résoudre les problèmes courants
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">🔥 Pare-feu Windows</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-4">
                <li>Ouvrez le Panneau de configuration → Système et sécurité</li>
                <li>Cliquez sur "Pare-feu Windows Defender"</li>
                <li>Sélectionnez "Paramètres avancés"</li>
                <li>Créez une nouvelle règle de trafic entrant pour le port 5000</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-2">🛡️ Antivirus</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-4">
                <li>Ajoutez Maintrix aux exceptions</li>
                <li>Autorisez les connexions sur le port 5000</li>
                <li>Désactivez temporairement la protection en temps réel</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-2">🌐 Paramètres Navigateur</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 ml-4">
                <li>Videz le cache (Ctrl+F5)</li>
                <li>Désactivez les extensions</li>
                <li>Vérifiez les paramètres de proxy</li>
                <li>Essayez en mode navigation privée</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Bouton de nouveau test */}
        <div className="text-center">
          <Button 
            onClick={runDiagnostic}
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            🔄 Relancer le Diagnostic
          </Button>
        </div>
      </div>
    </div>
  );
}
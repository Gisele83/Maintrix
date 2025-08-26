import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { 
  Mail, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Settings, 
  Shield, 
  ExternalLink,
  RefreshCw,
  ArrowLeft,
  Info,
  Zap
} from "lucide-react";

interface DiagnosticResult {
  success: boolean;
  sendgridTest?: {
    success: boolean;
    apiKeyValid: boolean;
    error?: string;
  };
  emailTest?: {
    success: boolean;
    error?: string;
    details?: any;
  };
  timestamp: string;
}

export default function EmailDiagnostic() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [diagnosticProgress, setDiagnosticProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [emailTestData, setEmailTestData] = useState({
    toEmail: 'test@example.com',
    fromEmail: 'admin@smartgmao.com'
  });

  useEffect(() => {
    const token = localStorage.getItem('superAdminToken');
    if (!token) {
      setLocation('/super-admin-login');
      return;
    }
  }, [setLocation]);

  // Test configuration SendGrid
  const sendgridTestMutation = useMutation({
    mutationFn: () => apiRequest("GET", "/api/super-admin/test-sendgrid"),
    onSuccess: (data: any) => {
      setDiagnosticProgress(50);
      setCurrentStep(1);
      toast({
        title: "Configuration SendGrid",
        description: data.sendgridTest?.success ? "✅ Configuration valide" : "❌ Erreur de configuration",
        variant: data.sendgridTest?.success ? "default" : "destructive"
      });
    }
  });

  // Test d'envoi email réel
  const emailTestMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/super-admin/test-email", { body: emailTestData }),
    onSuccess: (data: any) => {
      setDiagnosticProgress(100);
      setCurrentStep(2);
      toast({
        title: "Test d'envoi email",
        description: data.result?.success ? "✅ Email envoyé" : "❌ Échec d'envoi",
        variant: data.result?.success ? "default" : "destructive"
      });
    }
  });

  const runFullDiagnostic = async () => {
    setDiagnosticProgress(0);
    setCurrentStep(0);
    
    // Étape 1: Test configuration
    await sendgridTestMutation.mutateAsync();
    
    // Étape 2: Test envoi email
    if (emailTestData.toEmail && emailTestData.fromEmail) {
      await emailTestMutation.mutateAsync();
    }
  };

  const diagnosticSteps = [
    {
      title: "Configuration SendGrid",
      description: "Vérification de la clé API et des paramètres",
      icon: Settings,
      status: sendgridTestMutation.data?.sendgridTest?.success ? "success" : 
              sendgridTestMutation.isError ? "error" : "pending"
    },
    {
      title: "Test d'envoi email",
      description: "Tentative d'envoi d'un email de test",
      icon: Mail,
      status: emailTestMutation.data?.result?.success ? "success" : 
              emailTestMutation.isError || emailTestMutation.data?.result?.success === false ? "error" : "pending"
    },
    {
      title: "Diagnostic complet",
      description: "Analyse des résultats et recommandations",
      icon: CheckCircle,
      status: (sendgridTestMutation.data && emailTestMutation.data) ? "success" : "pending"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/super-admin-dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Diagnostic Email Avancé
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Outils de diagnostic et résolution des problèmes d'envoi d'emails
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Panel de diagnostic */}
          <Card className="glassmorphism">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                Diagnostic Automatique
              </CardTitle>
              <CardDescription>
                Lance une série de tests pour identifier les problèmes d'email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Configuration du test */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="toEmail">Email de destination (test)</Label>
                  <Input
                    id="toEmail"
                    type="email"
                    placeholder="test@example.com"
                    value={emailTestData.toEmail}
                    onChange={(e) => setEmailTestData(prev => ({ ...prev, toEmail: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="fromEmail">Email expéditeur</Label>
                  <Input
                    id="fromEmail"
                    type="email"
                    value={emailTestData.fromEmail}
                    onChange={(e) => setEmailTestData(prev => ({ ...prev, fromEmail: e.target.value }))}
                  />
                </div>
              </div>

              {/* Bouton de diagnostic */}
              <Button 
                onClick={runFullDiagnostic}
                disabled={sendgridTestMutation.isPending || emailTestMutation.isPending}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {sendgridTestMutation.isPending || emailTestMutation.isPending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Diagnostic en cours...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Lancer le diagnostic complet
                  </>
                )}
              </Button>

              {/* Barre de progression */}
              {diagnosticProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progression du diagnostic</span>
                    <span>{diagnosticProgress}%</span>
                  </div>
                  <Progress value={diagnosticProgress} className="w-full" />
                </div>
              )}

              {/* Étapes du diagnostic */}
              <div className="space-y-3">
                {diagnosticSteps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-lg border bg-white/50 dark:bg-gray-800/50">
                      <div className={`p-2 rounded-full ${
                        step.status === 'success' ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400' :
                        step.status === 'error' ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400' :
                        'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{step.title}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">{step.description}</div>
                      </div>
                      {step.status === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
                      {step.status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Panel de résultats et solutions */}
          <Card className="glassmorphism">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-purple-500" />
                Résultats & Solutions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="results" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="results">Résultats</TabsTrigger>
                  <TabsTrigger value="solutions">Solutions</TabsTrigger>
                </TabsList>
                
                <TabsContent value="results" className="space-y-4">
                  {/* Résultats du test SendGrid */}
                  {sendgridTestMutation.data && (
                    <Alert className={sendgridTestMutation.data.sendgridTest?.success ? 
                      "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950" :
                      "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                    }>
                      <Settings className="h-4 w-4" />
                      <AlertTitle>Configuration SendGrid</AlertTitle>
                      <AlertDescription>
                        {sendgridTestMutation.data.sendgridTest?.success ? 
                          "✅ Clé API valide et configuration correcte" :
                          `❌ Problème de configuration: ${sendgridTestMutation.data.sendgridTest?.error}`
                        }
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Résultats du test d'email */}
                  {emailTestMutation.data && (
                    <Alert className={emailTestMutation.data.result?.success ? 
                      "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950" :
                      "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                    }>
                      <Mail className="h-4 w-4" />
                      <AlertTitle>Test d'envoi email</AlertTitle>
                      <AlertDescription>
                        {emailTestMutation.data.result?.success ? 
                          "✅ Email envoyé avec succès" :
                          `❌ Échec d'envoi: ${emailTestMutation.data.result?.error || 'Erreur inconnue'}`
                        }
                        {emailTestMutation.data.result?.details && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm font-medium">Détails techniques</summary>
                            <pre className="mt-1 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto">
                              {JSON.stringify(emailTestMutation.data.result.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                <TabsContent value="solutions" className="space-y-4">
                  <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Solution principale: Vérification d'expéditeur</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p>Le problème principal est que l'adresse email expéditeur n'est pas vérifiée dans SendGrid.</p>
                      
                      <div className="space-y-2">
                        <p className="font-medium">Étapes de résolution:</p>
                        <ol className="list-decimal list-inside space-y-1 text-sm">
                          <li>Connectez-vous à votre compte SendGrid</li>
                          <li>Allez dans Settings → Sender Authentication</li>
                          <li>Cliquez sur "Single Sender Verification"</li>
                          <li>Ajoutez votre adresse email expéditeur</li>
                          <li>Vérifiez l'email de confirmation reçu</li>
                          <li>Relancez le test d'envoi</li>
                        </ol>
                      </div>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open('https://app.sendgrid.com/settings/sender_auth', '_blank')}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Ouvrir SendGrid
                      </Button>
                    </AlertDescription>
                  </Alert>

                  <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Vérifications supplémentaires</AlertTitle>
                    <AlertDescription className="space-y-2">
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Vérifiez que votre clé API SendGrid a les permissions d'envoi</li>
                        <li>Assurez-vous que votre domaine n'est pas en blacklist</li>
                        <li>Vérifiez les quotas d'envoi de votre compte SendGrid</li>
                        <li>Testez avec différentes adresses email de destination</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Actions rapides */}
        <Card className="glassmorphism mt-8">
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
            <CardDescription>
              Raccourcis pour les tâches de maintenance courantes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button 
                variant="outline" 
                onClick={() => sendgridTestMutation.mutate()}
                disabled={sendgridTestMutation.isPending}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Test config SendGrid
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => {
                  if (emailTestData.toEmail) {
                    emailTestMutation.mutate();
                  }
                }}
                disabled={emailTestMutation.isPending || !emailTestData.toEmail}
                className="flex items-center gap-2"
              >
                <Mail className="h-4 w-4" />
                Test envoi email
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => window.open('https://app.sendgrid.com/settings/sender_auth', '_blank')}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                SendGrid Console
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
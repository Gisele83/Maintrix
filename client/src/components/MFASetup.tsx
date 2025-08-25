/**
 * 🔐 INTERFACE MFA COMPLÈTE
 * 
 * Composant React pour la gestion complète du MFA :
 * - Setup initial avec QR code
 * - Vérification codes TOTP
 * - Gestion codes de backup
 * - Interface d'administration
 */

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Copy, RefreshCw, Download, Smartphone, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface MFAStatus {
  required: boolean;
  enabled: boolean;
  setupComplete: boolean;
  enforcement: 'REQUIRED' | 'OPTIONAL';
}

interface MFASetupData {
  qrCode: string;
  backupCodes: string[];
  secret: string;
}

export function MFASetup() {
  const [mfaStatus, setMfaStatus] = useState<MFAStatus | null>(null);
  const [setupData, setSetupData] = useState<MFASetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [currentStep, setCurrentStep] = useState<'status' | 'setup' | 'verify' | 'complete'>('status');
  const { toast } = useToast();

  // Charger le statut MFA au montage
  useEffect(() => {
    loadMFAStatus();
  }, []);

  const loadMFAStatus = async () => {
    try {
      const response = await apiRequest('/api/mfa/status');
      const data = await response.json();
      
      if (data.success) {
        setMfaStatus(data.data);
        
        if (data.data.enabled) {
          setCurrentStep('complete');
        } else if (data.data.required && !data.data.enabled) {
          setCurrentStep('setup');
        }
      }
    } catch (error) {
      console.error('Erreur chargement statut MFA:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger le statut MFA",
        variant: "destructive"
      });
    }
  };

  const initiateMFASetup = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/mfa/setup/init', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        setSetupData(data.data);
        setCurrentStep('verify');
        
        toast({
          title: "Setup MFA initialisé",
          description: "Scannez le QR code avec votre application d'authentification"
        });
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      console.error('Erreur init MFA:', error);
      toast({
        title: "Erreur Setup",
        description: error.message || "Erreur lors de l'initialisation MFA",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const completeMFASetup = async () => {
    if (!verificationCode || !setupData) return;

    setIsLoading(true);
    try {
      const response = await apiRequest('/api/mfa/setup/complete', {
        method: 'POST',
        body: {
          secret: setupData.secret,
          token: verificationCode,
          backupCodes: setupData.backupCodes
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCurrentStep('complete');
        setShowBackupCodes(true);
        
        toast({
          title: "MFA configuré avec succès",
          description: "Sauvegardez vos codes de récupération maintenant"
        });
        
        // Recharger le statut
        await loadMFAStatus();
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      console.error('Erreur completion MFA:', error);
      toast({
        title: "Code invalide",
        description: error.message || "Vérifiez votre code d'authentification",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyBackupCode = async () => {
    if (!backupCode) return;

    setIsLoading(true);
    try {
      const response = await apiRequest('/api/mfa/verify', {
        method: 'POST',
        body: {
          token: backupCode,
          isBackupCode: true
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Code de récupération valide",
          description: data.message
        });
        
        setBackupCode('');
      } else {
        throw new Error(data.message);
      }
    } catch (error: any) {
      toast({
        title: "Code invalide",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const regenerateBackupCodes = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest('/api/mfa/backup-codes/regenerate', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        setSetupData(prev => prev ? { ...prev, backupCodes: data.data.backupCodes } : null);
        setShowBackupCodes(true);
        
        toast({
          title: "Nouveaux codes générés",
          description: "Sauvegardez vos nouveaux codes de récupération"
        });
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Impossible de régénérer les codes",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copié !",
        description: "Code copié dans le presse-papiers"
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de copier le code",
        variant: "destructive"
      });
    }
  };

  const downloadBackupCodes = () => {
    if (!setupData?.backupCodes) return;
    
    const content = setupData.backupCodes.join('\\n');
    const blob = new Blob([`Smart GMAO DiagFix - Codes de récupération MFA\\n\\n${content}\\n\\nConservez ces codes en lieu sûr !`], 
      { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smart-gmao-mfa-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Codes téléchargés",
      description: "Conservez ce fichier en lieu sûr"
    });
  };

  // Rendu conditionnel par étape
  if (!mfaStatus) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center p-8">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Chargement...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Header avec statut */}
      <div className="flex items-center space-x-3">
        <Shield className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold">Authentification Multi-Facteurs (MFA)</h1>
          <p className="text-muted-foreground">Sécurisez votre compte administrateur</p>
        </div>
        {mfaStatus.enabled && (
          <Badge variant="outline" className="ml-auto text-green-600 border-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Activé
          </Badge>
        )}
        {mfaStatus.required && !mfaStatus.enabled && (
          <Badge variant="outline" className="ml-auto text-red-600 border-red-600">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Requis
          </Badge>
        )}
      </div>

      {/* Alerte pour MFA obligatoire */}
      {mfaStatus.enforcement === 'REQUIRED' && !mfaStatus.enabled && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Configuration MFA obligatoire !</strong><br />
            En tant qu'administrateur, vous devez configurer l'authentification multi-facteurs pour accéder au système.
          </AlertDescription>
        </Alert>
      )}

      {/* Étape 1: Statut et bouton Setup */}
      {currentStep === 'status' && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration MFA</CardTitle>
            <CardDescription>
              L'authentification multi-facteurs ajoute une couche de sécurité supplémentaire à votre compte.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Statut</span>
                <Badge variant={mfaStatus.enabled ? "default" : "secondary"}>
                  {mfaStatus.enabled ? "Configuré" : "Non configuré"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Obligatoire</span>
                <Badge variant={mfaStatus.required ? "destructive" : "outline"}>
                  {mfaStatus.required ? "Oui" : "Non"}
                </Badge>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            {!mfaStatus.enabled && (
              <Button onClick={initiateMFASetup} disabled={isLoading} className="w-full">
                {isLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                Configurer MFA
              </Button>
            )}
          </CardFooter>
        </Card>
      )}

      {/* Étape 2: Setup - Affichage QR Code */}
      {currentStep === 'setup' && (
        <Card>
          <CardHeader>
            <CardTitle>Étape 1: Configuration de l'application</CardTitle>
            <CardDescription>
              Utilisez une application d'authentification comme Google Authenticator ou Authy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={initiateMFASetup} disabled={isLoading} className="w-full">
              {isLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
              Générer le QR Code
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Étape 3: Vérification - QR Code + Input */}
      {currentStep === 'verify' && setupData && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Étape 2: Scanner le QR Code</CardTitle>
              <CardDescription>
                Scannez ce QR code avec votre application d'authentification
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              {/* QR Code */}
              <div className="flex justify-center">
                <img 
                  src={setupData.qrCode} 
                  alt="QR Code MFA" 
                  className="border-2 border-gray-300 rounded-lg"
                />
              </div>
              
              {/* Instructions */}
              <div className="text-sm text-muted-foreground space-y-2">
                <div className="flex items-center justify-center space-x-2">
                  <Smartphone className="w-4 h-4" />
                  <span>Applications compatibles :</span>
                </div>
                <div className="flex justify-center space-x-4">
                  <Badge variant="outline">Google Authenticator</Badge>
                  <Badge variant="outline">Authy</Badge>
                  <Badge variant="outline">Microsoft Authenticator</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Étape 3: Vérification</CardTitle>
              <CardDescription>
                Entrez le code à 6 chiffres généré par votre application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="text"
                placeholder="123456"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\\D/g, '').slice(0, 6))}
                className="text-center text-lg font-mono tracking-widest"
                maxLength={6}
              />
            </CardContent>
            <CardFooter>
              <Button 
                onClick={completeMFASetup} 
                disabled={isLoading || verificationCode.length !== 6}
                className="w-full"
              >
                {isLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                Vérifier et Activer MFA
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Étape 4: Complète - Gestion et codes backup */}
      {currentStep === 'complete' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">
                <CheckCircle className="w-5 h-5 inline mr-2" />
                MFA Configuré avec Succès
              </CardTitle>
              <CardDescription>
                Votre compte est maintenant protégé par l'authentification multi-facteurs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Actions de gestion */}
              <div className="flex space-x-2">
                <Button variant="outline" onClick={regenerateBackupCodes} disabled={isLoading}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Nouveaux codes de récupération
                </Button>
                <Button variant="outline" onClick={() => setShowBackupCodes(!showBackupCodes)}>
                  {showBackupCodes ? 'Masquer' : 'Afficher'} les codes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Codes de récupération */}
          {showBackupCodes && setupData?.backupCodes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-amber-600">
                  <AlertTriangle className="w-5 h-5 inline mr-2" />
                  Codes de Récupération
                </CardTitle>
                <CardDescription>
                  Conservez ces codes en lieu sûr. Chaque code ne peut être utilisé qu'une seule fois.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 rounded-lg">
                  {setupData.backupCodes.map((code, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                      <code className="font-mono text-sm">{code}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(code)}
                        className="ml-2 p-1"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={downloadBackupCodes} className="flex-1">
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => copyToClipboard(setupData.backupCodes.join('\\n'))} 
                    className="flex-1"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copier tous
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Test code de récupération */}
          <Card>
            <CardHeader>
              <CardTitle>Tester un Code de Récupération</CardTitle>
              <CardDescription>
                Vérifiez qu'un de vos codes de récupération fonctionne correctement
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="text"
                placeholder="Entrez un code de récupération"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </CardContent>
            <CardFooter>
              <Button 
                onClick={verifyBackupCode} 
                disabled={isLoading || !backupCode}
                variant="outline"
                className="w-full"
              >
                {isLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                Tester le Code
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
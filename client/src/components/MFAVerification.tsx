/**
 * 🔐 MODAL DE VÉRIFICATION MFA
 * 
 * Modal pour la vérification MFA lors de l'accès aux fonctions admin
 * - Vérification TOTP
 * - Option backup codes
 * - Interface utilisateur intuitive
 */

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Smartphone, Key, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface MFAVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export function MFAVerification({ 
  isOpen, 
  onClose, 
  onSuccess, 
  title = "Vérification MFA Requise",
  description = "Entrez votre code d'authentification pour continuer" 
}: MFAVerificationProps) {
  const [totpCode, setTotpCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('totp');
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleVerification = async (code: string, isBackup: boolean = false) => {
    if (!code) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await apiRequest('/api/mfa/verify', {
        method: 'POST',
        body: {
          token: code,
          isBackupCode: isBackup
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Vérification réussie",
          description: isBackup ? "Code de récupération accepté" : "Code MFA vérifié"
        });
        
        // Si backup code utilisé, afficher info
        if (data.data?.backupCodeUsed) {
          toast({
            title: "Code de récupération utilisé",
            description: data.message,
            variant: "default"
          });
        }
        
        onSuccess();
        resetForm();
      } else {
        setError(data.message || 'Code incorrect');
        
        // Focus sur le champ approprié après erreur
        setTimeout(() => {
          if (isBackup) {
            setBackupCode('');
          } else {
            setTotpCode('');
          }
        }, 1500);
      }
    } catch (error: any) {
      setError(error.message || 'Erreur lors de la vérification');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTotpCode('');
    setBackupCode('');
    setError('');
    setActiveTab('totp');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* Erreur globale */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Tabs pour TOTP vs Backup Codes */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="totp" className="flex items-center space-x-2">
              <Smartphone className="w-4 h-4" />
              <span>Application</span>
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex items-center space-x-2">
              <Key className="w-4 h-4" />
              <span>Code de récupération</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab TOTP */}
          <TabsContent value="totp" className="space-y-4">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <Smartphone className="w-8 h-8 text-blue-600" />
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Entrez le code à 6 chiffres de votre application d'authentification
                </p>
                <Input
                  type="text"
                  placeholder="123456"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\\D/g, '').slice(0, 6))}
                  className="text-center text-xl font-mono tracking-widest"
                  maxLength={6}
                  autoFocus={activeTab === 'totp'}
                />
              </div>
            </div>

            <Button 
              onClick={() => handleVerification(totpCode, false)}
              disabled={isLoading || totpCode.length !== 6}
              className="w-full"
            >
              {isLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
              Vérifier le Code
            </Button>
          </TabsContent>

          {/* Tab Backup Codes */}
          <TabsContent value="backup" className="space-y-4">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
                  <Key className="w-8 h-8 text-amber-600" />
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Entrez un de vos codes de récupération à 8 caractères
                </p>
                <Input
                  type="text"
                  placeholder="ABC12345"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value.toUpperCase().slice(0, 8))}
                  className="text-center text-lg font-mono tracking-wider"
                  maxLength={8}
                  autoFocus={activeTab === 'backup'}
                />
              </div>
              
              <Alert className="text-left">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Attention :</strong> Chaque code de récupération ne peut être utilisé qu'une seule fois.
                </AlertDescription>
              </Alert>
            </div>

            <Button 
              onClick={() => handleVerification(backupCode, true)}
              disabled={isLoading || backupCode.length !== 8}
              className="w-full"
              variant="outline"
            >
              {isLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
              Utiliser le Code de Récupération
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
            Annuler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook pour utiliser facilement la vérification MFA
export function useMFAVerification() {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvePromise, setResolvePromise] = useState<((success: boolean) => void) | null>(null);
  
  const requestMFAVerification = (title?: string, description?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setResolvePromise(() => resolve);
      setIsOpen(true);
    });
  };
  
  const handleSuccess = () => {
    if (resolvePromise) {
      resolvePromise(true);
      setResolvePromise(null);
    }
    setIsOpen(false);
  };
  
  const handleClose = () => {
    if (resolvePromise) {
      resolvePromise(false);
      setResolvePromise(null);
    }
    setIsOpen(false);
  };
  
  const MFAModal = () => (
    <MFAVerification
      isOpen={isOpen}
      onClose={handleClose}
      onSuccess={handleSuccess}
    />
  );
  
  return {
    requestMFAVerification,
    MFAModal
  };
}
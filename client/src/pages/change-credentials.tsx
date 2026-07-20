import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, Shield, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

const changeCredentialsSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string().min(1, "Confirmation du mot de passe requise"),
  newUsername: z.string().min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères").optional()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"]
});

type ChangeCredentialsForm = z.infer<typeof changeCredentialsSchema>;

interface PasswordRequirement {
  message: string;
  isValid: boolean;
}

interface UserInfo {
  mustChangePassword: boolean;
  isDefaultCredentials: boolean;
  passwordExpiresAt?: string;
  username: string;
  email: string;
  canChangeUsername: boolean;
}

export default function ChangeCredentials() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loadingUserInfo, setLoadingUserInfo] = useState(true);
  const [passwordRequirements, setPasswordRequirements] = useState<PasswordRequirement[]>([]);

  const form = useForm<ChangeCredentialsForm>({
    resolver: zodResolver(changeCredentialsSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      newUsername: ''
    }
  });

  const newPassword = form.watch('newPassword');

  // Vérifier les informations utilisateur au chargement
  useEffect(() => {
    const checkUserInfo = async () => {
      try {
        const data = await apiRequest('/api/enterprise-auth/must-change-password');
        setUserInfo(data);
        
        // Si l'utilisateur n'a pas besoin de changer son mot de passe, rediriger
        if (!data.mustChangePassword) {
          toast({
            title: "Redirection",
            description: "Vous n'avez pas besoin de changer vos identifiants",
          });
          setLocation('/');
          return;
        }

        // Préremplir le nom d'utilisateur s'il peut être changé
        if (data.canChangeUsername) {
          form.setValue('newUsername', data.username);
        }

      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message || "Impossible de vérifier les informations utilisateur",
          variant: "destructive",
        });
        setLocation('/');
      } finally {
        setLoadingUserInfo(false);
      }
    };

    checkUserInfo();
  }, [form, setLocation, toast]);

  // Validation en temps réel du mot de passe
  useEffect(() => {
    if (!newPassword) {
      setPasswordRequirements([]);
      return;
    }

    const requirements = [
      {
        message: "Au moins 8 caractères",
        isValid: newPassword.length >= 8
      },
      {
        message: "Au moins une lettre majuscule",
        isValid: /[A-Z]/.test(newPassword)
      },
      {
        message: "Au moins une lettre minuscule",
        isValid: /[a-z]/.test(newPassword)
      },
      {
        message: "Au moins un chiffre",
        isValid: /\d/.test(newPassword)
      },
      {
        message: "Au moins un caractère spécial",
        isValid: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)
      }
    ];

    setPasswordRequirements(requirements);
  }, [newPassword]);

  const onSubmit = async (data: ChangeCredentialsForm) => {
    setIsLoading(true);
    try {
      await apiRequest('/api/enterprise-auth/change-credentials', {
        method: 'POST',
        body: {
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
          confirmPassword: data.confirmPassword,
          ...(userInfo?.canChangeUsername && data.newUsername ? { newUsername: data.newUsername } : {})
        }
      });

      toast({
        title: "✅ Identifiants mis à jour",
        description: "Vos identifiants ont été changés avec succès. Vous pouvez maintenant utiliser la plateforme normalement.",
      });

      // Rediriger vers la page d'accueil
      setTimeout(() => {
        setLocation('/');
      }, 2000);

    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de changer les identifiants",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingUserInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Vérification des informations...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userInfo) {
    return null;
  }

  const expirationDate = userInfo.passwordExpiresAt ? new Date(userInfo.passwordExpiresAt) : null;
  const isExpired = expirationDate ? new Date() > expirationDate : false;
  const daysRemaining = expirationDate ? Math.ceil((expirationDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🔐 Changement d'identifiants obligatoire
          </CardTitle>
          <CardDescription className="text-base">
            Pour votre sécurité, vous devez changer vos identifiants par défaut avant de continuer
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Alerte de sécurité */}
          <Alert className={`border-2 ${isExpired ? 'border-red-500 bg-red-50' : 'border-orange-500 bg-orange-50'}`}>
            <AlertTriangle className={`h-4 w-4 ${isExpired ? 'text-red-600' : 'text-orange-600'}`} />
            <AlertDescription className={isExpired ? 'text-red-800' : 'text-orange-800'}>
              {userInfo.isDefaultCredentials ? (
                <>
                  <strong>Identifiants par défaut détectés.</strong> Ces identifiants temporaires doivent être changés.
                  {daysRemaining && daysRemaining > 0 && (
                    <> Temps restant : <strong>{daysRemaining} jour{daysRemaining > 1 ? 's' : ''}</strong></>
                  )}
                  {isExpired && <> <strong>EXPIRÉ</strong> - Changement requis immédiatement.</>}
                </>
              ) : (
                <>
                  <strong>Changement de mot de passe requis.</strong> Votre mot de passe doit être mis à jour.
                </>
              )}
            </AlertDescription>
          </Alert>

          {/* Informations utilisateur actuelles */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">👤 Informations actuelles</h3>
            <div className="space-y-1 text-sm text-blue-800">
              <p><strong>Email :</strong> {userInfo.email}</p>
              <p><strong>Nom d'utilisateur actuel :</strong> {userInfo.username}</p>
              {userInfo.canChangeUsername && (
                <p className="text-green-700">✅ Vous pouvez modifier votre nom d'utilisateur</p>
              )}
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Mot de passe actuel */}
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">Mot de passe actuel</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showCurrentPassword ? "text" : "password"}
                          placeholder="Entrez votre mot de passe actuel"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Nouveau nom d'utilisateur (optionnel) */}
              {userInfo.canChangeUsername && (
                <FormField
                  control={form.control}
                  name="newUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-medium">Nouveau nom d'utilisateur (optionnel)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Choisissez un nouveau nom d'utilisateur"
                        />
                      </FormControl>
                      <FormDescription>
                        Laissez vide pour garder votre nom d'utilisateur actuel
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Nouveau mot de passe */}
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">Nouveau mot de passe</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Choisissez un mot de passe sécurisé"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    
                    {/* Exigences de mot de passe */}
                    {passwordRequirements.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {passwordRequirements.map((req, index) => (
                          <div key={index} className="flex items-center space-x-2 text-sm">
                            {req.isValid ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <div className="h-4 w-4 border-2 border-gray-300 rounded-full"></div>
                            )}
                            <span className={req.isValid ? "text-green-700" : "text-gray-600"}>
                              {req.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Confirmation du mot de passe */}
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">Confirmer le nouveau mot de passe</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirmez votre nouveau mot de passe"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Conseils de sécurité */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">🛡️ Conseils de sécurité</h4>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>• Utilisez un mot de passe unique que vous n'utilisez nulle part ailleurs</li>
                  <li>• Combinez lettres majuscules, minuscules, chiffres et symboles</li>
                  <li>• Évitez les informations personnelles (nom, date de naissance, etc.)</li>
                  <li>• Considérez l'utilisation d'un gestionnaire de mots de passe</li>
                </ul>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mise à jour en cours...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Changer mes identifiants
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, Eye, EyeOff, CheckCircle, AlertTriangle, Shield, ArrowLeft } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Link, useLocation } from 'wouter';

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string().min(1, "Confirmation du mot de passe requise")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"]
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

interface PasswordRequirement {
  message: string;
  isValid: boolean;
}

interface TokenVerification {
  valid: boolean;
  user?: {
    email: string;
    username: string;
    displayName: string;
  };
  expiresAt?: string;
  error?: string;
}

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenVerification, setTokenVerification] = useState<TokenVerification | null>(null);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [passwordRequirements, setPasswordRequirements] = useState<PasswordRequirement[]>([]);

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: ''
    }
  });

  const newPassword = form.watch('newPassword');

  // Extraire le token depuis l'URL
  const getTokenFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('token');
  };

  // Vérifier le token au chargement
  useEffect(() => {
    const token = getTokenFromUrl();
    
    if (!token) {
      toast({
        title: "Token manquant",
        description: "Le lien de réinitialisation est invalide ou incomplet",
        variant: "destructive",
      });
      setLocation('/forgot-password');
      return;
    }

    const verifyToken = async () => {
      try {
        const data = await apiRequest(`/api/enterprise-auth/reset-password/verify/${token}`);
        setTokenVerification(data);
      } catch (error: any) {
        toast({
          title: "Lien invalide",
          description: error.message || "Le lien de réinitialisation est invalide ou a expiré",
          variant: "destructive",
        });
        setTokenVerification({ 
          valid: false, 
          error: error.message || "Token invalide" 
        });
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [setLocation, toast]);

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

  const onSubmit = async (data: ResetPasswordForm) => {
    const token = getTokenFromUrl();
    if (!token) return;

    setIsLoading(true);
    try {
      await apiRequest('/api/enterprise-auth/reset-password', {
        method: 'POST',
        body: {
          token,
          newPassword: data.newPassword,
          confirmPassword: data.confirmPassword
        }
      });

      setIsPasswordReset(true);
      
      toast({
        title: "✅ Mot de passe réinitialisé",
        description: "Votre mot de passe a été mis à jour avec succès",
      });

    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de réinitialiser le mot de passe",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // État de vérification
  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Vérification du lien...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Token invalide
  if (!tokenVerification?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-red-600">
              Lien invalide ou expiré
            </CardTitle>
            <CardDescription>
              Ce lien de réinitialisation n'est plus valide
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {tokenVerification?.error || "Le lien de réinitialisation a expiré ou est invalide"}
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Link href="/forgot-password">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Demander un nouveau lien
                </Button>
              </Link>
              
              <Link href="/login">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour à la connexion
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Succès de réinitialisation
  if (isPasswordReset) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              ✅ Mot de passe réinitialisé !
            </CardTitle>
            <CardDescription>
              Votre mot de passe a été mis à jour avec succès
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Succès !</strong> Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
              </AlertDescription>
            </Alert>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">🔐 Pour votre sécurité :</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Votre ancien mot de passe n'est plus valide</li>
                <li>• Utilisez votre nouveau mot de passe pour vous connecter</li>
                <li>• Gardez votre mot de passe confidentiel</li>
                <li>• Considérez l'activation de l'authentification à deux facteurs</li>
              </ul>
            </div>

            <Link href="/login">
              <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3">
                <Lock className="mr-2 h-4 w-4" />
                Se connecter maintenant
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const timeRemaining = tokenVerification.expiresAt ? 
    Math.max(0, Math.floor((new Date(tokenVerification.expiresAt).getTime() - new Date().getTime()) / (1000 * 60))) 
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🔄 Réinitialiser votre mot de passe
          </CardTitle>
          <CardDescription className="text-base">
            Choisissez un nouveau mot de passe sécurisé pour {tokenVerification.user?.displayName || tokenVerification.user?.email}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Informations utilisateur et expiration */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">👤 Informations du compte</h3>
            <div className="space-y-1 text-sm text-blue-800">
              <p><strong>Email :</strong> {tokenVerification.user?.email}</p>
              <p><strong>Nom d'utilisateur :</strong> {tokenVerification.user?.username}</p>
              {timeRemaining > 0 ? (
                <p><strong>⏰ Temps restant :</strong> {timeRemaining} minute{timeRemaining > 1 ? 's' : ''}</p>
              ) : (
                <p className="text-red-600"><strong>⚠️ Ce lien va bientôt expirer</strong></p>
              )}
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                          autoComplete="new-password"
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
                          autoComplete="new-password"
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
                    Réinitialisation en cours...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Réinitialiser mon mot de passe
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="text-center">
            <Link href="/login">
              <Button variant="ghost" className="text-sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à la connexion
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
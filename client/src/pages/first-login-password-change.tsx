import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Shield, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react";

interface FirstLoginUser {
  userId: number;
  username: string;
  email: string;
  passwordExpiresAt?: string;
  isFirstLogin?: boolean;
  tempSessionToken: string;
}

export default function FirstLoginPasswordChange() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [firstLoginData, setFirstLoginData] = useState<FirstLoginUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  
  // Vérifier les données de première connexion dans useEffect
  useEffect(() => {
    const data = localStorage.getItem('firstLoginData');
    if (!data) {
      setLocation('/login');
      return;
    }
    try {
      const parsedData: FirstLoginUser = JSON.parse(data);
      setFirstLoginData(parsedData);
    } catch {
      setLocation('/login');
    }
  }, [setLocation]);
  
  if (!firstLoginData) {
    return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">Chargement...</div>;
  }

  // Validation du mot de passe
  const passwordRequirements = {
    length: formData.newPassword.length >= 8,
    uppercase: /[A-Z]/.test(formData.newPassword),
    lowercase: /[a-z]/.test(formData.newPassword),
    number: /\d/.test(formData.newPassword),
    special: /[@$!%*?&]/.test(formData.newPassword)
  };

  const isPasswordValid = Object.values(passwordRequirements).every(Boolean);
  const passwordsMatch = formData.newPassword === formData.confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive"
      });
      return;
    }

    if (!isPasswordValid) {
      toast({
        title: "Mot de passe invalide", 
        description: "Le mot de passe ne respecte pas les critères de sécurité",
        variant: "destructive"
      });
      return;
    }

    if (!passwordsMatch) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Utiliser apiRequest pour une gestion d'erreur cohérente
      const result = await apiRequest('/api/enterprise-auth/force-password-change', {
        method: 'POST',
        body: {
          userId: firstLoginData.userId,
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
          tempSessionToken: firstLoginData.tempSessionToken
        }
      });

      // Vérifier explicitement le succès
      if (result.success && result.sessionToken && result.user) {
        // Stocker le nouveau token de session et les données utilisateur
        localStorage.setItem('sessionToken', result.sessionToken);
        localStorage.setItem('user_data', JSON.stringify(result.user));
        
        // Nettoyer les données de première connexion
        localStorage.removeItem('firstLoginData');

        toast({
          title: "✅ Mot de passe changé",
          description: "Bienvenue sur Maintrix ! Votre compte est maintenant sécurisé.",
        });

        // Rediriger vers le dashboard principal
        setLocation('/');
      } else {
        // Gérer le cas où la réponse ne contient pas les bonnes données
        toast({
          title: "Erreur",
          description: result.message || "Erreur lors du changement de mot de passe",
          variant: "destructive"
        });
      }
      
    } catch (error: any) {
      console.error('Password change error:', error);
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors du changement de mot de passe",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/5 backdrop-blur-xl border-white/10">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-600 to-red-600 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            🔐 Première connexion
          </CardTitle>
          <CardDescription className="text-gray-400">
            Vous devez changer votre mot de passe par défaut pour accéder à la plateforme
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Informations utilisateur */}
          <div className="p-3 bg-white/5 rounded-lg border border-orange-500/30">
            <div className="text-sm text-gray-400">Utilisateur connecté:</div>
            <div className="text-white font-medium">{firstLoginData.email}</div>
            <div className="text-xs text-gray-500">Nom d'utilisateur: {firstLoginData.username}</div>
            {firstLoginData.passwordExpiresAt && (
              <div className="text-xs text-yellow-400 mt-1">
                ⏰ Expire: {new Date(firstLoginData.passwordExpiresAt).toLocaleString()}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mot de passe actuel */}
            <div>
              <Label htmlFor="currentPassword" className="text-white">
                Mot de passe temporaire *
              </Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showPasswords.current ? "text" : "password"}
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({...formData, currentPassword: e.target.value})}
                  className="bg-white/10 border-gray-600 text-white placeholder-gray-400 pr-10"
                  placeholder="Mot de passe reçu du super-admin"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                >
                  {showPasswords.current ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                </Button>
              </div>
            </div>

            {/* Nouveau mot de passe */}
            <div>
              <Label htmlFor="newPassword" className="text-white">
                Nouveau mot de passe *
              </Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPasswords.new ? "text" : "password"}
                  value={formData.newPassword}
                  onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
                  className="bg-white/10 border-gray-600 text-white placeholder-gray-400 pr-10"
                  placeholder="Choisissez un mot de passe sécurisé"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                >
                  {showPasswords.new ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                </Button>
              </div>
            </div>

            {/* Critères de mot de passe */}
            {formData.newPassword && (
              <div className="space-y-2">
                <div className="text-sm text-gray-400">Critères de sécurité :</div>
                <div className="space-y-1">
                  {Object.entries({
                    'Au moins 8 caractères': passwordRequirements.length,
                    'Une majuscule': passwordRequirements.uppercase,
                    'Une minuscule': passwordRequirements.lowercase,
                    'Un chiffre': passwordRequirements.number,
                    'Un caractère spécial (@$!%*?&)': passwordRequirements.special
                  }).map(([requirement, met]) => (
                    <div key={requirement} className={`flex items-center gap-2 text-xs ${met ? 'text-green-400' : 'text-gray-400'}`}>
                      {met ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {requirement}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirmation mot de passe */}
            <div>
              <Label htmlFor="confirmPassword" className="text-white">
                Confirmer le mot de passe *
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPasswords.confirm ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  className="bg-white/10 border-gray-600 text-white placeholder-gray-400 pr-10"
                  placeholder="Tapez à nouveau votre mot de passe"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                >
                  {showPasswords.confirm ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                </Button>
              </div>
              {formData.confirmPassword && !passwordsMatch && (
                <div className="text-red-400 text-xs mt-1">
                  Les mots de passe ne correspondent pas
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading || !isPasswordValid || !passwordsMatch}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:opacity-50"
            >
              {isLoading ? "Changement en cours..." : "🔐 Changer mon mot de passe"}
            </Button>
          </form>

          <div className="text-center text-xs text-gray-500">
            Une fois le mot de passe changé, vous aurez accès à toutes les fonctionnalités de Maintrix
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
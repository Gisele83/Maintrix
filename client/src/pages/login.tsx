import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { messageErreurApi } from "@/lib/api-error";
import { Eye, EyeOff } from "lucide-react";
import { IS_TEST_ENVIRONMENT } from "@/lib/feature-flags";

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères"),
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  confirmPassword: z.string(),
  department: z.string().optional(),
  role: z.string().default("technician"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  

  


  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      confirmPassword: "",
      department: "",
      role: "technician",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const response = await apiRequest("/api/enterprise-auth/login", {
        method: "POST",
        body: { email: data.email, password: data.password },
      });
      return response;
    },
    onSuccess: (data) => {
      // ✅ PREMIÈRE CONNEXION: Vérifier si changement de mot de passe requis
      if (data.requirePasswordChange) {
        // Stocker les données temporaires pour le changement de mot de passe
        localStorage.setItem("firstLoginData", JSON.stringify({
          userId: data.userId,
          username: data.username,
          email: data.email,
          tempSessionToken: data.tempSessionToken,
          isFirstLogin: data.isFirstLogin || false,
          isExpired: data.isExpired || false,
          passwordExpiresAt: data.passwordExpiresAt
        }));
        
        toast({
          title: "Changement de mot de passe requis",
          description: data.message,
          variant: "default",
        });
        
        // Rediriger vers la page de changement de mot de passe
        setLocation("/first-login-password-change");
        return;
      }
      
      // 🔑 F09 — La session vit dans un cookie httpOnly, PAS dans le corps de
      // la réponse : /api/enterprise-auth/login ne renvoie aucun `sessionToken`
      // (son message le dit : « Session stored in secure cookie »).
      // `data.sessionToken` valait donc `undefined`, et
      // `localStorage.setItem` le convertissait en CHAÎNE "undefined" — qui est
      // truthy. App.tsx et useAuth.ts, qui testent `!!localStorage.sessionToken`,
      // fonctionnaient par accident sur cette chaîne.
      //
      // On stocke désormais un marqueur EXPLICITE. Ce n'est pas un jeton : c'est
      // uniquement l'indicateur « une session est ouverte », le secret restant
      // dans le cookie httpOnly, hors de portée de JavaScript.
      localStorage.setItem("sessionToken", "cookie");
      localStorage.setItem("user_data", JSON.stringify(data.user));
      
      // ✅ FIX: Invalider spécifiquement la query d'auth
      queryClient.setQueryData(["/api/enterprise-auth/profile"], data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/enterprise-auth/profile"] });
      
      toast({
        title: "Connexion réussie",
        description: `Bienvenue ${data.user.firstName || data.user.username} !`,
      });
      
      // ✅ FIX: Redirection immédiate sans délai
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de connexion",
        // Sans extraction, l'utilisateur lisait :
        //   401: {"error":"INVALID_CREDENTIALS","message":"Invalid email or password"}
        // — du JSON brut, et en anglais sur une interface française.
        description: messageErreurApi(error, "Identifiants incorrects"),
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      const { confirmPassword, ...registerData } = data;
      const response = await apiRequest("/api/enterprise-auth/register", {
        method: "POST",
        body: registerData,
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Inscription réussie",
        description: "Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter.",
      });
      setIsRegistering(false);
      loginForm.setValue("email", data.user.email);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur d'inscription",
        description: messageErreurApi(error, "Impossible de créer le compte"),
        variant: "destructive",
      });
    },
  });

  const onLogin = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  const onRegister = (data: RegisterForm) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-sans grid lg:grid-cols-2">
      {/* Colonne éditoriale — masquée sur mobile, où le formulaire prime. */}
      <aside className="hidden lg:flex flex-col justify-between bg-ink text-paper p-12 xl:p-16">
        <Link href="/" className="font-serif text-2xl font-medium tracking-tight">
          Maintrix
        </Link>
        <div>
          <p className="font-mono text-eyebrow uppercase text-signal-light">Maintenance industrielle</p>
          <p className="font-serif text-headline font-medium mt-6 max-w-md">
            Reprendre là où l'équipe s'est arrêtée.
          </p>
          <p className="text-paper/70 mt-5 max-w-sm leading-relaxed">
            Ordres de travail en cours, équipements à surveiller, historique des interventions :
            tout est au même endroit.
          </p>
        </div>
        {IS_TEST_ENVIRONMENT ? (
          <p className="text-sm text-paper/60 border-t border-paper/15 pt-5">
            Version de test — les données sont fictives et peuvent être réinitialisées.
          </p>
        ) : (
          <span />
        )}
      </aside>

      <main className="flex flex-col justify-center px-5 py-12 sm:px-12">
        <div className="w-full max-w-sm mx-auto">
          <Link href="/" className="lg:hidden font-serif text-2xl font-medium tracking-tight text-ink">
            Maintrix
          </Link>
          <h1 className="font-serif text-headline font-medium text-ink mt-10 lg:mt-0">
            {isRegistering ? "Créer un compte" : "Connexion"}
          </h1>
          <p className="text-ink-soft mt-2 mb-8">
            {isRegistering
              ? "Rejoignez l'espace de travail de votre équipe."
              : "Accédez à votre espace de maintenance."}
          </p>
          {IS_TEST_ENVIRONMENT && (
            <p className="lg:hidden -mt-4 mb-8 text-sm text-ink-mute border-t border-rule pt-3">
              Version de test — données fictives.
            </p>
          )}
          <div className="space-y-6">
              {!isRegistering ? (
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="vous@exemple.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mot de passe</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type={showLoginPassword ? "text" : "password"} 
                                placeholder="Votre mot de passe" 
                                {...field} 
                                className="pr-10"
                                data-testid="input-login-password"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowLoginPassword(!showLoginPassword)}
                                data-testid="toggle-login-password-visibility"
                              >
                                {showLoginPassword ? (
                                  <EyeOff className="h-4 w-4 text-ink-mute" />
                                ) : (
                                  <Eye className="h-4 w-4 text-ink-mute" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      className="w-full h-11 rounded-none bg-ink text-paper hover:bg-signal"
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? "Connexion..." : "Se connecter"}
                    </Button>
                    
                    {/* Lien mot de passe oublié */}
                    <div className="text-center">
                      <Link href="/forgot-password">
                        <Button variant="link" className="text-sm text-ink-soft hover:text-ink">
                          Mot de passe oublié ?
                        </Button>
                      </Link>
                    </div>
                  </form>
                </Form>
              ) : (
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={registerForm.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Prénom</FormLabel>
                            <FormControl>
                              <Input placeholder="Prénom" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={registerForm.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nom</FormLabel>
                            <FormControl>
                              <Input placeholder="Nom" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="username-field">Nom d'utilisateur</Label>
                      <Input
                        id="username-field"
                        type="text"
                        placeholder="Nom d'utilisateur unique"
                        {...registerForm.register("username")}
                      />
                      {registerForm.formState.errors.username && (
                        <p className="text-sm text-red-500">
                          {registerForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>

                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="votre@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={registerForm.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Département (optionnel)</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Maintenance, Production..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mot de passe</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Mot de passe" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={registerForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmer</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="Confirmer" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button 
                      type="submit" 
                      className="w-full h-11 rounded-none bg-ink text-paper hover:bg-signal"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? "Création..." : "Créer le compte"}
                    </Button>
                  </form>
                </Form>
              )}

              <div className="text-center space-y-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    if (!isRegistering) {
                      registerForm.reset();
                    } else {
                      loginForm.reset();
                    }
                  }}
                  className="text-ink hover:bg-transparent hover:text-signal underline-offset-4 hover:underline"
                >
                  {isRegistering 
                    ? "Déjà un compte ? Se connecter" 
                    : "Pas de compte ? S'inscrire"
                  }
                </Button>
                
              </div>
            </div>
        </div>
      </main>
    </div>
  );
}
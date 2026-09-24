import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, Settings, Database } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

const superAdminLoginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  secretKey: z.string().min(1, "Clé secrète requise")
});

type SuperAdminLoginForm = z.infer<typeof superAdminLoginSchema>;

export default function SuperAdminLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<SuperAdminLoginForm>({
    resolver: zodResolver(superAdminLoginSchema),
    defaultValues: {
      email: "",
      password: "",
      secretKey: ""
    }
  });

  const onSubmit = async (data: SuperAdminLoginForm) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("/api/super-admin/login", { method: "POST", body: data });
      
      toast({
        title: "Connexion réussie",
        description: "Bienvenue dans l'interface d'administration plateforme",
      });
      
      // Stocker les infos super-admin
      localStorage.setItem('superAdminToken', response.token);
      localStorage.setItem('superAdminUser', JSON.stringify(response.user));
      
      setLocation('/super-admin-dashboard');
    } catch (error: any) {
      toast({
        title: "Erreur de connexion",
        description: error.message || "Identifiants super-admin incorrects",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ⚠️ Cet écran était sombre à l'origine. L'harmonisation a éclairci le fond
   * sans toucher aux champs, restés en texte blanc : on saisissait donc du blanc
   * sur du blanc, illisible. Signalé le 2026-09-24.
   *
   * Il redevient franchement sombre — la console de plateforme porte déjà un
   * bandeau encre — ce qui la distingue d'un coup d'œil de l'espace client, et
   * rend les champs lisibles par contraste réel.
   */
  return (
    <div className="min-h-screen bg-ink text-paper flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KPGcgZmlsbD0iI2ZmZmZmZiIgZmlsbC1vcGFjaXR5PSIwLjAyIj4KPGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPgo8L2c+CjwvZz4KPC9zdmc+')] opacity-20"></div>
      
      <Card className="w-full max-w-md relative bg-white/5 border-white/15 shadow-none">
        <CardHeader className="text-center">
          <img
            src="/logo-maintrix-clair.png"
            alt="Maintrix"
            width={640}
            height={213}
            className="h-8 w-auto mx-auto mb-6"
          />
          <p className="font-mono text-eyebrow uppercase tracking-wider text-signal-light">
            Console de plateforme
          </p>
          <CardTitle className="font-serif text-2xl font-medium text-paper mt-2">
            Administration
          </CardTitle>
          <CardDescription className="text-paper/60">
            Réservée à la gestion des organisations et de leurs comptes.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-paper/80">Email Super-Admin</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="admin@platform.com"
                        className="bg-white/10 border-white/40 text-paper placeholder:text-paper/55 focus-visible:ring-signal-light"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-paper/80">Mot de passe</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        className="bg-white/10 border-white/40 text-paper placeholder:text-paper/55 focus-visible:ring-signal-light"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="secretKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-paper/80">Clé secrète plateforme</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Clé secrète d'administration"
                        className="bg-white/10 border-white/40 text-paper placeholder:text-paper/55 focus-visible:ring-signal-light"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full bg-signal text-white font-medium py-2.5 hover:bg-signal-light hover:text-ink"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Accéder à l'administration
                  </>
                )}
              </Button>
            </form>
          </Form>
          
          <div className="mt-6 pt-6 border-t border-white/15">
            <div className="flex items-center gap-4 text-sm text-paper/60">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span>Multi-tenant</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4" />
                <span>Sécurisé</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="absolute bottom-4 left-4 text-sm text-paper/60">
        <button 
          onClick={() => setLocation('/')}
          className="hover:text-paper transition-colors underline underline-offset-4"
        >
          ← Retour à l'interface client
        </button>
      </div>
    </div>
  );
}
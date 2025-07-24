import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, LogIn, User, Lock } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface LoginData {
  username: string;
  password: string;
}

interface ValidationLoginProps {
  onLoginSuccess: (user: any, token: string) => void;
}

export function ValidationLogin({ onLoginSuccess }: ValidationLoginProps) {
  const [formData, setFormData] = useState<LoginData>({
    username: "",
    password: ""
  });
  const [error, setError] = useState<string>("");

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      const response = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json"
        }
      });
      return response;
    },
    onSuccess: (data) => {
      if (data.success) {
        setError("");
        onLoginSuccess(data.user, data.token);
      } else {
        setError(data.message || "Erreur de connexion");
      }
    },
    onError: (error: any) => {
      console.error("Login error:", error);
      setError(error.message || "Erreur de connexion");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.password) {
      setError("Veuillez remplir tous les champs");
      return;
    }
    setError("");
    loginMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof LoginData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center">
            <LogIn className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Système de Validation</CardTitle>
          <CardDescription>
            Connectez-vous avec votre matricule d'entreprise
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Nom d'utilisateur
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="chef.maintenance"
                value={formData.username}
                onChange={(e) => handleInputChange("username", e.target.value)}
                disabled={loginMutation.isPending}
                className="h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Mot de passe
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                disabled={loginMutation.isPending}
                className="h-11"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full h-11 text-base font-medium"
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connexion...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Se connecter
                </>
              )}
            </Button>
          </form>
          
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100 mb-2">
              Comptes de test disponibles :
            </h4>
            <div className="text-xs text-blue-700 dark:text-blue-200 space-y-1">
              <div>• <strong>chef.maintenance</strong> / admin123 (Niveau 1)</div>
              <div>• <strong>directeur.general</strong> / directeur123 (Niveau 2)</div>
              <div>• <strong>service.achat</strong> / achat123 (Niveau 3)</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
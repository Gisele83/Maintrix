import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, ArrowLeft, Shield, Clock, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

const forgotPasswordSchema = z.object({
  email: z.string().email("Veuillez saisir un email valide")
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: ''
    }
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setIsLoading(true);
    try {
      await apiRequest('/api/enterprise-auth/forgot-password', {
        method: 'POST',
        body: data
      });

      setSubmittedEmail(data.email);
      setIsEmailSent(true);
      
      toast({
        title: "✅ Demande envoyée",
        description: "Si cet email existe, un lien de réinitialisation a été envoyé",
      });

    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer la demande de réinitialisation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              📧 Email envoyé !
            </CardTitle>
            <CardDescription>
              Vérifiez votre boîte de réception
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <Alert className="border-green-200 bg-green-50">
              <Mail className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Si l'email {submittedEmail} existe dans notre système</strong>, vous recevrez un lien de réinitialisation dans quelques minutes.
              </AlertDescription>
            </Alert>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3">📋 Étapes suivantes :</h3>
              <ol className="text-sm text-blue-800 space-y-2">
                <li className="flex items-start space-x-2">
                  <span className="font-bold text-blue-600">1.</span>
                  <span>Vérifiez votre boîte de réception (et vos spams)</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="font-bold text-blue-600">2.</span>
                  <span>Cliquez sur le lien "Réinitialiser mon mot de passe"</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="font-bold text-blue-600">3.</span>
                  <span>Choisissez un nouveau mot de passe sécurisé</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="font-bold text-blue-600">4.</span>
                  <span>Connectez-vous avec vos nouveaux identifiants</span>
                </li>
              </ol>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="font-semibold text-orange-900">Important :</span>
              </div>
              <p className="text-sm text-orange-800">
                Le lien de réinitialisation <strong>expire dans 1 heure</strong>. 
                Si vous ne le recevez pas ou s'il expire, vous pouvez refaire une demande.
              </p>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={() => {
                  setIsEmailSent(false);
                  form.reset();
                }}
                variant="outline" 
                className="w-full"
              >
                <Mail className="mr-2 h-4 w-4" />
                Renvoyer un email
              </Button>
              
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🔐 Mot de passe oublié
          </CardTitle>
          <CardDescription className="text-base">
            Saisissez votre email pour recevoir un lien de réinitialisation
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert className="border-blue-200 bg-blue-50">
            <Mail className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Processus sécurisé :</strong> Un email avec un lien temporaire (valide 1 heure) sera envoyé à votre adresse si elle existe dans notre système.
            </AlertDescription>
          </Alert>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-medium">Adresse email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="votre.email@exemple.com"
                        className="h-12"
                        autoComplete="email"
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">🛡️ Sécurité et confidentialité</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Nous ne révélons jamais si un email existe ou non</li>
                  <li>• Le lien de réinitialisation expire automatiquement</li>
                  <li>• Votre mot de passe actuel reste inchangé jusqu'à utilisation du lien</li>
                  <li>• Seul le propriétaire de l'email peut réinitialiser le mot de passe</li>
                </ul>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 h-12"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Envoyer le lien de réinitialisation
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="text-center space-y-2">
            <Link href="/login">
              <Button variant="ghost" className="text-sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à la connexion
              </Button>
            </Link>
            <p className="text-xs text-gray-500">
              Vous vous souvenez de votre mot de passe ? Connectez-vous directement.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
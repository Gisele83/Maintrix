import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, CheckCircle, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { SiStripe, SiPaypal } from "react-icons/si";
import { Link } from "wouter";
import { getCsrfToken } from "@/lib/queryClient";

// F06 — les routes de paiement ne sont plus exemptées de CSRF : tout POST doit
// porter l'en-tête, y compris depuis un `fetch` brut.
function csrfHeader(): Record<string, string> {
  const token = getCsrfToken();
  return token ? { "X-CSRF-Token": token } : {};
}

interface PaymentStatus {
  stripe: { configured: boolean; tested: boolean; error?: string };
  paypal: { configured: boolean; tested: boolean; error?: string };
}

export default function PaymentTest() {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<PaymentStatus>({
    stripe: { configured: false, tested: false },
    paypal: { configured: false, tested: false }
  });

  const testStripeConfig = async () => {
    setLoading("stripe-config");
    try {
      const response = await fetch("/api/payments/config", { credentials: "include" });
      const data = await response.json();
      
      if (data.publishableKey) {
        setStatus(prev => ({
          ...prev,
          stripe: { ...prev.stripe, configured: true }
        }));
        toast({
          title: "Stripe configuré",
          description: `Clé publique détectée: ${data.publishableKey.substring(0, 20)}...`
        });
      } else {
        throw new Error("Clé Stripe non trouvée");
      }
    } catch (error: any) {
      setStatus(prev => ({
        ...prev,
        stripe: { ...prev.stripe, configured: false, error: error.message }
      }));
      toast({
        title: "Erreur Stripe",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const testStripePayment = async () => {
    setLoading("stripe-payment");
    try {
      const response = await fetch("/api/payments/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeader() },
        credentials: "include",
        body: JSON.stringify({ amount: 100, planType: "test" })
      });
      const data = await response.json();
      
      if (data.clientSecret) {
        setStatus(prev => ({
          ...prev,
          stripe: { ...prev.stripe, tested: true }
        }));
        toast({
          title: "Test Stripe réussi",
          description: "Payment Intent créé avec succès"
        });
      } else {
        throw new Error(data.error || "Échec création Payment Intent");
      }
    } catch (error: any) {
      setStatus(prev => ({
        ...prev,
        stripe: { ...prev.stripe, tested: false, error: error.message }
      }));
      toast({
        title: "Erreur test Stripe",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const testPayPalConfig = async () => {
    setLoading("paypal-config");
    try {
      const response = await fetch("/api/paypal/config", { credentials: "include" });
      const data = await response.json();
      
      if (data.clientId) {
        setStatus(prev => ({
          ...prev,
          paypal: { ...prev.paypal, configured: true }
        }));
        toast({
          title: "PayPal configuré",
          description: `Client ID détecté: ${data.clientId.substring(0, 20)}...`
        });
      } else {
        throw new Error("Client ID PayPal non trouvé");
      }
    } catch (error: any) {
      setStatus(prev => ({
        ...prev,
        paypal: { ...prev.paypal, configured: false, error: error.message }
      }));
      toast({
        title: "Erreur PayPal",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const testPayPalOrder = async () => {
    setLoading("paypal-order");
    try {
      const response = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeader() },
        credentials: "include",
        body: JSON.stringify({ amount: 10, planType: "test", currency: "EUR" })
      });
      const data = await response.json();
      
      if (data.orderId) {
        setStatus(prev => ({
          ...prev,
          paypal: { ...prev.paypal, tested: true }
        }));
        toast({
          title: "Test PayPal réussi",
          description: `Commande créée: ${data.orderId}`
        });
      } else {
        throw new Error(data.error || "Échec création commande PayPal");
      }
    } catch (error: any) {
      setStatus(prev => ({
        ...prev,
        paypal: { ...prev.paypal, tested: false, error: error.message }
      }));
      toast({
        title: "Erreur test PayPal",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const StatusIcon = ({ success }: { success: boolean }) => (
    success ? <CheckCircle className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-violet-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-blue-600" />
            Test des Systèmes de Paiement
          </h1>
          <p className="text-gray-600 mt-2">Vérifiez la configuration et le fonctionnement de Stripe et PayPal</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-2 border-violet-200 bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <SiStripe className="w-8 h-8 text-violet-600" />
                Stripe
              </CardTitle>
              <CardDescription>Paiements par carte bancaire</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span>Configuration</span>
                <div className="flex items-center gap-2">
                  {status.stripe.configured ? (
                    <Badge variant="default" className="bg-green-500">Configuré</Badge>
                  ) : (
                    <Badge variant="secondary">Non testé</Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span>Payment Intent</span>
                <div className="flex items-center gap-2">
                  {status.stripe.tested ? (
                    <Badge variant="default" className="bg-green-500">Fonctionnel</Badge>
                  ) : (
                    <Badge variant="secondary">Non testé</Badge>
                  )}
                </div>
              </div>

              {status.stripe.error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {status.stripe.error}
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={testStripeConfig} 
                  disabled={loading !== null}
                  variant="outline"
                  className="flex-1"
                >
                  {loading === "stripe-config" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Tester Config
                </Button>
                <Button 
                  onClick={testStripePayment} 
                  disabled={loading !== null}
                  className="flex-1 bg-violet-600 hover:bg-violet-700"
                >
                  {loading === "stripe-payment" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Tester Paiement
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200 bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <SiPaypal className="w-8 h-8 text-blue-600" />
                PayPal
              </CardTitle>
              <CardDescription>Paiements via compte PayPal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span>Configuration</span>
                <div className="flex items-center gap-2">
                  {status.paypal.configured ? (
                    <Badge variant="default" className="bg-green-500">Configuré</Badge>
                  ) : (
                    <Badge variant="secondary">Non testé</Badge>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span>Création Commande</span>
                <div className="flex items-center gap-2">
                  {status.paypal.tested ? (
                    <Badge variant="default" className="bg-green-500">Fonctionnel</Badge>
                  ) : (
                    <Badge variant="secondary">Non testé</Badge>
                  )}
                </div>
              </div>

              {status.paypal.error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {status.paypal.error}
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={testPayPalConfig} 
                  disabled={loading !== null}
                  variant="outline"
                  className="flex-1"
                >
                  {loading === "paypal-config" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Tester Config
                </Button>
                <Button 
                  onClick={testPayPalOrder} 
                  disabled={loading !== null}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {loading === "paypal-order" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Tester Commande
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 bg-white/80 backdrop-blur" data-testid="payment-summary">
          <CardHeader>
            <CardTitle>Résumé des Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-violet-50 rounded-lg">
                <SiStripe className="w-6 h-6 text-violet-600" />
                <div>
                  <p className="font-medium">Stripe</p>
                  <p className="text-sm text-gray-600">
                    {status.stripe.configured && status.stripe.tested 
                      ? "✅ Entièrement fonctionnel" 
                      : status.stripe.configured 
                        ? "⚠️ Config OK, paiement non testé"
                        : "❌ Non configuré"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                <SiPaypal className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="font-medium">PayPal</p>
                  <p className="text-sm text-gray-600">
                    {status.paypal.configured && status.paypal.tested 
                      ? "✅ Entièrement fonctionnel" 
                      : status.paypal.configured 
                        ? "⚠️ Config OK, commande non testée"
                        : "❌ Non configuré"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

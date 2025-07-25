import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CreditCard, Banknote, CheckCircle, AlertCircle, Building2, User, Calculator } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface PaymentAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: "business" | "personal";
  balance: number;
  currency: "EUR" | "USD";
  isActive: boolean;
}

interface PaymentMethod {
  id: string;
  type: "card" | "bank_transfer" | "invoice";
  name: string;
  isDefault: boolean;
  details: {
    lastFour?: string;
    bankName?: string;
    iban?: string;
  };
}

interface Invoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "overdue";
  dueDate: string;
  description: string;
  accountReference: string;
}

export default function Payment() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [accountReference, setAccountReference] = useState<string>("");
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [selectedAddon, setSelectedAddon] = useState<string>("");
  const [isDemo, setIsDemo] = useState<boolean>(false);

  // Extraire les paramètres de l'URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const plan = urlParams.get('plan');
    const addon = urlParams.get('addon');
    const demo = urlParams.get('demo');
    
    if (plan) {
      setSelectedPlan(plan);
      // Définir le montant selon le plan
      switch(plan.toLowerCase()) {
        case 'freemium':
          setAmount('0');
          break;
        case 'pro':
          setAmount('20');
          break;
        case 'business':
          setAmount('75');
          break;
        case 'enterprise':
          setAmount('sur devis');
          break;
        default:
          setAmount('20');
      }
    }
    
    if (addon) {
      setSelectedAddon(addon);
      setAmount('25'); // Prix standard pour les modules additionnels
    }
    
    if (demo === 'true') {
      setIsDemo(true);
      setAmount('0');
    }
  }, []);
  
  // Mock data - Les références de compte seront renseignées ultérieurement
  const mockAccounts: PaymentAccount[] = [
    {
      id: "acc_1",
      accountNumber: "GMAO-2025-001",
      accountName: "Smart GMAO DiagFix - Production",
      accountType: "business",
      balance: 2500.00,
      currency: "EUR",
      isActive: true
    },
    {
      id: "acc_2", 
      accountNumber: "GMAO-2025-002",
      accountName: "Smart GMAO DiagFix - Diagnostic IA",
      accountType: "business",
      balance: 1750.00,
      currency: "EUR",
      isActive: true
    }
  ];

  const mockPaymentMethods: PaymentMethod[] = [
    {
      id: "pm_1",
      type: "card",
      name: "Carte Visa **** 4242",
      isDefault: true,
      details: { lastFour: "4242" }
    },
    {
      id: "pm_2",
      type: "bank_transfer",
      name: "Virement SEPA",
      isDefault: false,
      details: { bankName: "BNP Paribas", iban: "FR76****1234" }
    },
    {
      id: "pm_3",
      type: "invoice",
      name: "Facturation à 30 jours",
      isDefault: false,
      details: {}
    }
  ];

  const mockInvoices: Invoice[] = [
    {
      id: "inv_1",
      number: "SMART-GMAO-2025-001",
      amount: 299.00,
      currency: "EUR",
      status: "pending",
      dueDate: "2025-02-15",
      description: "Abonnement Smart GMAO DiagFix Pro - Janvier 2025",
      accountReference: "GMAO-2025-001"
    },
    {
      id: "inv_2", 
      number: "SMART-GMAO-2025-002",
      amount: 149.00,
      currency: "EUR",
      status: "paid",
      dueDate: "2025-01-15",
      description: "Module Diagnostic IA Avancé - Décembre 2024",
      accountReference: "GMAO-2025-002"
    }
  ];

  const processPayment = useMutation({
    mutationFn: async (paymentData: {
      accountId: string;
      paymentMethodId: string;
      amount: number;
      accountReference: string;
      description: string;
    }) => {
      // Note: Les références de compte seront configurées ultérieurement
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulation API
      return { success: true, transactionId: `txn_${Date.now()}` };
    },
    onSuccess: (data) => {
      toast({
        title: "Paiement effectué avec succès",
        description: `Transaction ${data.transactionId} confirmée`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur de paiement",
        description: "Impossible de traiter le paiement. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  });

  const handlePayment = () => {
    if (!selectedPaymentMethod || !amount || !accountReference) {
      toast({
        title: "Informations manquantes",
        description: "Veuillez remplir tous les champs requis",
        variant: "destructive",
      });
      return;
    }

    processPayment.mutate({
      accountId: "acc_1",
      paymentMethodId: selectedPaymentMethod,
      amount: parseFloat(amount),
      accountReference,
      description: `Paiement Smart GMAO DiagFix - ${accountReference}`
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Centre de Paiement
            </h1>
            <p className="text-muted-foreground">
              Gestion des paiements et comptes Smart GMAO DiagFix
            </p>
          </div>
        </div>

        {/* Plan sélectionné */}
        {(selectedPlan || selectedAddon || isDemo) && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span>
                  {isDemo ? "Demande de démonstration" : 
                   selectedPlan ? `Plan ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}` : 
                   `Module ${selectedAddon?.replace(/-/g, ' ')}`}
                </span>
              </CardTitle>
              <CardDescription>
                {isDemo ? "Nous vous contacterons pour planifier une démonstration personnalisée" :
                 selectedPlan ? `Vous avez sélectionné le plan ${selectedPlan} avec essai gratuit de 14 jours` :
                 `Module additionnel sélectionné: ${selectedAddon?.replace(/-/g, ' ')}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {isDemo ? "Démonstration gratuite" : 
                     selectedPlan === 'freemium' ? "Plan gratuit" :
                     amount === 'sur devis' ? "Tarif sur mesure" :
                     `${amount}€/mois`}
                  </p>
                  {!isDemo && selectedPlan !== 'freemium' && (
                    <p className="text-sm text-muted-foreground">
                      Essai gratuit de 14 jours inclus
                    </p>
                  )}
                </div>
                {selectedPlan && (
                  <Badge variant="secondary">
                    {selectedPlan === 'freemium' ? 'Gratuit' :
                     selectedPlan === 'pro' ? 'Populaire' :
                     selectedPlan === 'business' ? 'Recommandé' :
                     'Enterprise'}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Comptes liés */}
          <div className="lg:col-span-1">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Comptes liés
                </CardTitle>
                <CardDescription>
                  Références de compte configurées pour votre organisation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {mockAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-violet-50 dark:from-slate-800 dark:to-slate-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={account.isActive ? "default" : "secondary"}>
                        {account.accountType === "business" ? "Entreprise" : "Personnel"}
                      </Badge>
                      <span className="text-sm font-mono text-muted-foreground">
                        {account.accountNumber}
                      </span>
                    </div>
                    <h4 className="font-semibold text-sm">{account.accountName}</h4>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {account.balance.toFixed(2)} {account.currency}
                    </p>
                  </div>
                ))}
                
                <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    Essai gratuit 14 jours inclus pour tous les nouveaux utilisateurs
                  </p>
                  <p className="text-xs mt-1">
                    Les références de compte seront renseignées ultérieurement
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Interface de paiement */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="payment" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="payment">Nouveau paiement</TabsTrigger>
                <TabsTrigger value="invoices">Factures</TabsTrigger>
                <TabsTrigger value="methods">Moyens de paiement</TabsTrigger>
              </TabsList>

              <TabsContent value="payment">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Effectuer un paiement
                    </CardTitle>
                    <CardDescription>
                      Traitement sécurisé des paiements avec référence de compte
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="amount">Montant</Label>
                        <div className="relative">
                          <Input
                            id="amount"
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="pr-12"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            EUR
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="account-ref">Référence de compte</Label>
                        <Input
                          id="account-ref"
                          placeholder="GMAO-2025-XXX"
                          value={accountReference}
                          onChange={(e) => setAccountReference(e.target.value)}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <Label>Méthode de paiement</Label>
                      <div className="grid gap-3">
                        {mockPaymentMethods.map((method) => (
                          <div
                            key={method.id}
                            className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                              selectedPaymentMethod === method.id
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                                : "hover:border-gray-300"
                            }`}
                            onClick={() => setSelectedPaymentMethod(method.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {method.type === "card" && <CreditCard className="h-5 w-5" />}
                                {method.type === "bank_transfer" && <Banknote className="h-5 w-5" />}
                                {method.type === "invoice" && <Calculator className="h-5 w-5" />}
                                <span className="font-medium">{method.name}</span>
                              </div>
                              {method.isDefault && (
                                <Badge variant="secondary">Par défaut</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={handlePayment}
                      disabled={processPayment.isPending || !selectedPaymentMethod || !amount}
                      className="w-full"
                      size="lg"
                    >
                      {processPayment.isPending ? "Traitement..." : "Effectuer le paiement"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="invoices">
                <Card>
                  <CardHeader>
                    <CardTitle>Factures et historique</CardTitle>
                    <CardDescription>
                      Suivi des factures Smart GMAO DiagFix
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {mockInvoices.map((invoice) => (
                        <div
                          key={invoice.id}
                          className="p-4 border rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{invoice.number}</span>
                              <Badge
                                variant={
                                  invoice.status === "paid"
                                    ? "default"
                                    : invoice.status === "overdue"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {invoice.status === "paid" && <CheckCircle className="h-3 w-3 mr-1" />}
                                {invoice.status === "overdue" && <AlertCircle className="h-3 w-3 mr-1" />}
                                {invoice.status === "paid" ? "Payée" : 
                                 invoice.status === "overdue" ? "En retard" : "En attente"}
                              </Badge>
                            </div>
                            <span className="font-bold">
                              {invoice.amount.toFixed(2)} {invoice.currency}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {invoice.description}
                          </p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Compte: {invoice.accountReference}</span>
                            <span>Échéance: {invoice.dueDate}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="methods">
                <Card>
                  <CardHeader>
                    <CardTitle>Moyens de paiement</CardTitle>
                    <CardDescription>
                      Configuration des méthodes de paiement
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {mockPaymentMethods.map((method) => (
                        <div
                          key={method.id}
                          className="p-4 border rounded-lg"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {method.type === "card" && <CreditCard className="h-5 w-5" />}
                              {method.type === "bank_transfer" && <Banknote className="h-5 w-5" />}
                              {method.type === "invoice" && <Calculator className="h-5 w-5" />}
                              <div>
                                <p className="font-medium">{method.name}</p>
                                {method.details.bankName && (
                                  <p className="text-sm text-muted-foreground">
                                    {method.details.bankName} - {method.details.iban}
                                  </p>
                                )}
                              </div>
                            </div>
                            {method.isDefault && (
                              <Badge variant="default">Par défaut</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground">
                        <p className="text-sm">
                          Configuration des moyens de paiement à venir
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Wrench,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Building2,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Star,
  Loader2,
} from "lucide-react";

type PlanId = "freemium" | "startup" | "business" | "enterprise";

interface PlanDetails {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  userRange: string;
  features: string[];
  color: string;
  popular?: boolean;
}

const plans: Record<PlanId, PlanDetails> = {
  freemium: {
    id: "freemium",
    name: "Freemium",
    price: "0€",
    period: "pour toujours",
    userRange: "1-5 utilisateurs",
    features: ["10 équipements max", "5 utilisateurs", "Diagnostic IA basique", "Support communautaire"],
    color: "slate"
  },
  startup: {
    id: "startup",
    name: "Startup",
    price: "79€",
    period: "/mois",
    userRange: "10-25 utilisateurs",
    features: ["Équipements illimités", "25 utilisateurs", "IA avancée", "App mobile", "Support prioritaire"],
    color: "emerald"
  },
  business: {
    id: "business",
    name: "Business",
    price: "199€",
    period: "/mois",
    userRange: "25-100 utilisateurs",
    features: ["100 utilisateurs", "Multi-tenant (3 sites)", "Intégrations ERP", "API complète", "Formation incluse"],
    color: "blue",
    popular: true
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    price: "499€",
    period: "/mois",
    userRange: "Illimité",
    features: ["Utilisateurs illimités", "Sites illimités", "ERP avancé", "Déploiement local", "Support 24/7"],
    color: "violet"
  }
};

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("freemium");
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    companyName: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get("plan") as PlanId | null;
    if (planParam && plans[planParam]) {
      setSelectedPlan(planParam);
      setStep(2);
    }
  }, []);

  const registerMutation = useMutation({
    mutationFn: async (data: typeof formData & { plan: PlanId }) => {
      const response = await apiRequest("/api/auth/register", { method: "POST", body: data });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Compte créé avec succès !",
        description: "Vérifiez votre email pour activer votre compte.",
      });
      navigate("/login");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de l'inscription.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = () => {
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas.",
        variant: "destructive"
      });
      return;
    }
    
    if (formData.password.length < 8) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 8 caractères.",
        variant: "destructive"
      });
      return;
    }

    registerMutation.mutate({ ...formData, plan: selectedPlan });
  };

  const isStep2Valid = formData.companyName.trim() !== "" && 
                       formData.firstName.trim() !== "" && 
                       formData.lastName.trim() !== "";

  const isStep3Valid = formData.email.includes("@") && 
                       formData.password.length >= 8 && 
                       formData.password === formData.confirmPassword;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      {/* Header */}
      <header className="py-6 px-4 sm:px-6 lg:px-8 border-b border-slate-100">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/welcome">
            <div className="flex items-center space-x-3 cursor-pointer">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-800">Maintrix</span>
            </div>
          </Link>
          <Link href="/login">
            <Button variant="ghost" className="text-slate-600">
              Déjà un compte ? Se connecter
            </Button>
          </Link>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center space-x-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  step >= s 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {step > s ? <CheckCircle className="w-5 h-5" /> : s}
                </div>
                {s < 3 && (
                  <div className={`w-16 sm:w-24 h-1 mx-2 rounded ${
                    step > s ? 'bg-blue-600' : 'bg-slate-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm text-slate-500 px-2">
            <span className="w-20 text-center">Plan</span>
            <span className="w-20 text-center">Entreprise</span>
            <span className="w-20 text-center">Compte</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Step 1: Choose Plan */}
          {step === 1 && (
            <div>
              <div className="text-center mb-10">
                <h1 className="text-3xl font-bold text-slate-900 mb-3">
                  Choisissez votre plan
                </h1>
                <p className="text-slate-600">
                  Sélectionnez l'offre qui correspond à vos besoins
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.values(plans).map((plan) => (
                  <Card 
                    key={plan.id}
                    className={`cursor-pointer transition-all duration-300 ${
                      selectedPlan === plan.id 
                        ? 'border-2 border-blue-500 shadow-lg' 
                        : 'border border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => setSelectedPlan(plan.id)}
                    data-testid={`card-plan-${plan.id}`}
                  >
                    <CardContent className="p-5">
                      {plan.popular && (
                        <Badge className="bg-blue-600 text-white mb-3">
                          <Star className="w-3 h-3 mr-1" />
                          Recommandé
                        </Badge>
                      )}
                      <h3 className="text-lg font-bold text-slate-800 mb-1">{plan.name}</h3>
                      <div className="text-xs text-slate-500 mb-3">{plan.userRange}</div>
                      <div className="mb-4">
                        <span className="text-2xl font-bold text-slate-900">{plan.price}</span>
                        <span className="text-slate-500 text-sm">{plan.period}</span>
                      </div>
                      <ul className="space-y-1.5">
                        {plan.features.slice(0, 4).map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-xs text-slate-600">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {selectedPlan === plan.id && (
                        <div className="mt-4 flex justify-center">
                          <CheckCircle className="w-6 h-6 text-blue-600" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="flex justify-center mt-10">
                <Button 
                  size="lg" 
                  className="bg-blue-600 hover:bg-blue-700 px-8"
                  onClick={() => setStep(2)}
                  data-testid="button-next-step1"
                >
                  Continuer
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Company Info */}
          {step === 2 && (
            <div className="max-w-lg mx-auto">
              <div className="text-center mb-10">
                <h1 className="text-3xl font-bold text-slate-900 mb-3">
                  Informations de l'entreprise
                </h1>
                <p className="text-slate-600">
                  Parlez-nous de votre organisation
                </p>
              </div>
              
              <Card className="border border-slate-200">
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="companyName" className="text-slate-700">
                      <Building2 className="w-4 h-4 inline mr-2" />
                      Nom de l'entreprise
                    </Label>
                    <Input
                      id="companyName"
                      placeholder="Ex: Industrie Métallurgique SA"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="rounded-xl"
                      data-testid="input-company-name"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-slate-700">
                        <User className="w-4 h-4 inline mr-2" />
                        Prénom
                      </Label>
                      <Input
                        id="firstName"
                        placeholder="Jean"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="rounded-xl"
                        data-testid="input-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-slate-700">Nom</Label>
                      <Input
                        id="lastName"
                        placeholder="Dupont"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="rounded-xl"
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 rounded-xl p-4 mt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-slate-800">Plan sélectionné : </span>
                        <span className="text-blue-600 font-semibold">{plans[selectedPlan].name}</span>
                      </div>
                      <button 
                        className="text-sm text-blue-600 hover:underline"
                        onClick={() => setStep(1)}
                      >
                        Modifier
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <div className="flex justify-between mt-8">
                <Button 
                  variant="outline" 
                  onClick={() => setStep(1)}
                  className="px-6"
                  data-testid="button-back-step2"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour
                </Button>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 px-8"
                  onClick={() => setStep(3)}
                  disabled={!isStep2Valid}
                  data-testid="button-next-step2"
                >
                  Continuer
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Account Creation */}
          {step === 3 && (
            <div className="max-w-lg mx-auto">
              <div className="text-center mb-10">
                <h1 className="text-3xl font-bold text-slate-900 mb-3">
                  Créez votre compte
                </h1>
                <p className="text-slate-600">
                  Dernière étape pour accéder à Maintrix
                </p>
              </div>
              
              <Card className="border border-slate-200">
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-700">
                      <Mail className="w-4 h-4 inline mr-2" />
                      Email professionnel
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="jean.dupont@entreprise.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="rounded-xl"
                      data-testid="input-email"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-700">
                      <Lock className="w-4 h-4 inline mr-2" />
                      Mot de passe
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Minimum 8 caractères"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="rounded-xl pr-10"
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-slate-700">
                      Confirmer le mot de passe
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirmez votre mot de passe"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="rounded-xl"
                      data-testid="input-confirm-password"
                    />
                    {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                      <p className="text-red-500 text-sm">Les mots de passe ne correspondent pas</p>
                    )}
                  </div>
                  
                  <div className="bg-slate-50 rounded-xl p-4">
                    <h4 className="font-medium text-slate-800 mb-2">Récapitulatif</h4>
                    <div className="text-sm text-slate-600 space-y-1">
                      <p><span className="font-medium">Plan :</span> {plans[selectedPlan].name} - {plans[selectedPlan].price}{plans[selectedPlan].period}</p>
                      <p><span className="font-medium">Entreprise :</span> {formData.companyName}</p>
                      <p><span className="font-medium">Contact :</span> {formData.firstName} {formData.lastName}</p>
                    </div>
                  </div>
                  
                  <p className="text-xs text-slate-500 text-center">
                    En créant un compte, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
                  </p>
                </CardContent>
              </Card>
              
              <div className="flex justify-between mt-8">
                <Button 
                  variant="outline" 
                  onClick={() => setStep(2)}
                  className="px-6"
                  data-testid="button-back-step3"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour
                </Button>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 px-8"
                  onClick={handleSubmit}
                  disabled={!isStep3Valid || registerMutation.isPending}
                  data-testid="button-create-account"
                >
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      Créer mon compte
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

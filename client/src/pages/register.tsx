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
import { detailErreurApi, messageErreurApi } from "@/lib/api-error";
import { BILLING_ENABLED } from "@/lib/feature-flags";
import {
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
  // Sans offre payante, l'assistant démarre à l'étape « Entreprise » : l'étape
  // « Plan » proposait des formules à 79 €, 199 € et 499 € alors que
  // l'abonnement est en veille.
  const [step, setStep] = useState(BILLING_ENABLED ? 1 : 2);
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

  /**
   * Le serveur exige un `username` (3 à 50 caractères, unique), que cet
   * assistant ne demande pas : il collecte une entreprise et une personne, pas
   * un pseudonyme à inventer. On le dérive donc de la partie locale de l'e-mail.
   *
   * La colonne est `varchar(50)` : on tronque pour laisser la place au suffixe
   * éventuel ajouté en cas de collision.
   */
  const nomUtilisateurDepuis = (email: string, suffixe = "") => {
    const base = (email.split("@")[0] || "")
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 40 - suffixe.length);
    // Une adresse ne laissant presque rien (« a@… », « 1@… ») donnerait un nom
    // trop court pour le schéma : on complète alors plutôt que d'échouer.
    return (base.length >= 3 ? base : `user${base}`) + suffixe;
  };

  const registerMutation = useMutation({
    mutationFn: async (data: typeof formData & { plan: PlanId }) => {
      // ⚠️ La route appelée ici était `/api/auth/register`, qui n'existe pas :
      // `/api/auth` n'est monté nulle part. Toute inscription échouait donc en
      // 404 « Route API inconnue », affiché tel quel à l'utilisateur.
      //
      // La charge utile était elle aussi non conforme : le serveur attend
      // `username`, `firstName`, `lastName`, `email`, `password`. Corriger la
      // seule URL n'aurait fait que remplacer le 404 par un 400 sur `username`.
      //
      // `companyName`, `confirmPassword` et `plan` ne figurent pas au schéma —
      // zod les écarte. On ne les transmet donc pas, pour que le contrat de
      // l'appel soit lisible tel quel.
      const envoyer = (username: string) =>
        apiRequest("/api/enterprise-auth/register", {
          method: "POST",
          body: {
            username,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            password: data.password,
          },
        });

      try {
        return await envoyer(nomUtilisateurDepuis(data.email));
      } catch (error) {
        // Le nom dérivé peut être déjà pris (deux personnes « jean@ » sur des
        // domaines différents). L'assistant n'ayant aucun champ où le corriger,
        // l'utilisateur serait dans une impasse : on réessaie une fois avec un
        // suffixe. Une seule reprise — au-delà, l'erreur doit remonter.
        if (detailErreurApi(error).code !== "USERNAME_ALREADY_EXISTS") throw error;
        const suffixe = Math.random().toString(36).slice(2, 6);
        return await envoyer(nomUtilisateurDepuis(data.email, suffixe));
      }
    },
    onSuccess: () => {
      // Le compte est actif immédiatement : le serveur ne pose aucun jeton
      // d'activation et n'envoie aucun message. Annoncer « vérifiez votre
      // e-mail » laissait l'utilisateur attendre un courriel qui n'arrive
      // jamais — d'autant que SendGrid n'est pas configuré.
      toast({
        title: "Compte créé avec succès !",
        description: "Vous pouvez vous connecter dès maintenant.",
      });
      navigate("/login");
    },
    onError: (error: unknown) => {
      // Sans extraction, l'utilisateur lisait le corps JSON brut de la réponse,
      // préfixé du code HTTP.
      toast({
        title: "Erreur",
        description: messageErreurApi(error, "Une erreur est survenue lors de l'inscription."),
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

  const ETAPES_VISIBLES = [
    ...(BILLING_ENABLED ? [{ numero: 1, libelle: "Formule" }] : []),
    { numero: 2, libelle: "Entreprise" },
    { numero: 3, libelle: "Compte" },
  ];

  return (
    <div className="min-h-screen bg-paper text-ink font-sans flex flex-col">
      {/* En-tête — même langage que la page d'accueil */}
      <header className="border-b border-rule">
        <div className="mx-auto max-w-6xl w-full px-5 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" aria-label="Maintrix — accueil">
            <img src="/logo-maintrix.png" alt="Maintrix" width={640} height={213} className="h-8 w-auto" />
          </Link>
          <Link href="/login" className="text-sm text-ink hover:text-signal transition-colors">
            Déjà un compte ? Se connecter
          </Link>
        </div>
      </header>

      {/* Étapes */}
      <div className="mx-auto w-full max-w-lg px-5 pt-10">
        <ol className="flex gap-6 border-b border-rule">
          {ETAPES_VISIBLES.map((e, i) => (
            <li
              key={e.numero}
              aria-current={step === e.numero ? "step" : undefined}
              className={`pb-3 -mb-px border-b-2 ${
                step === e.numero
                  ? "border-ink text-ink"
                  : step > e.numero
                    ? "border-transparent text-ink-soft"
                    : "border-transparent text-ink-mute"
              }`}
            >
              <span className="font-mono text-eyebrow mr-2">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-sm">{e.libelle}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Content */}
      <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Step 1: Choose Plan */}
          {step === 1 && (
            <div>
              <div className="text-center mb-10">
                <h1 className="font-serif text-headline font-medium text-ink mb-3">
                  Choisissez votre plan
                </h1>
                <p className="text-ink-soft">
                  Sélectionnez l'offre qui correspond à vos besoins
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.values(plans).map((plan) => (
                  <Card 
                    key={plan.id}
                    className={`cursor-pointer transition-all duration-300 ${
                      selectedPlan === plan.id 
                        ? 'border-2 border-ink rounded-none shadow-none' 
                        : 'border border-rule hover:border-ink-mute rounded-none shadow-none'
                    }`}
                    onClick={() => setSelectedPlan(plan.id)}
                    data-testid={`card-plan-${plan.id}`}
                  >
                    <CardContent className="p-5">
                      {plan.popular && (
                        <Badge className="bg-ink text-paper rounded-none mb-3">
                          <Star className="w-3 h-3 mr-1" />
                          Recommandé
                        </Badge>
                      )}
                      <h3 className="text-lg font-bold text-ink mb-1">{plan.name}</h3>
                      <div className="text-xs text-ink-mute mb-3">{plan.userRange}</div>
                      <div className="mb-4">
                        <span className="text-2xl font-bold text-ink">{plan.price}</span>
                        <span className="text-ink-mute text-sm">{plan.period}</span>
                      </div>
                      <ul className="space-y-1.5">
                        {plan.features.slice(0, 4).map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-xs text-ink-soft">
                            <CheckCircle className="w-3.5 h-3.5 text-signal flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      {selectedPlan === plan.id && (
                        <div className="mt-4 flex justify-center">
                          <CheckCircle className="w-6 h-6 text-signal" />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="flex justify-center mt-10">
                <Button 
                  size="lg" 
                  className="rounded-none bg-ink text-paper hover:bg-signal px-8"
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
                <h1 className="font-serif text-headline font-medium text-ink mb-3">
                  Informations de l'entreprise
                </h1>
                <p className="text-ink-soft">
                  Parlez-nous de votre organisation
                </p>
              </div>
              
              <Card className="border border-rule rounded-none shadow-none bg-white">
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="companyName" className="text-ink">
                      <Building2 className="w-4 h-4 inline mr-2" />
                      Nom de l'entreprise
                    </Label>
                    <Input
                      id="companyName"
                      placeholder="Ex: Industrie Métallurgique SA"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className="rounded-md"
                      data-testid="input-company-name"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-ink">
                        <User className="w-4 h-4 inline mr-2" />
                        Prénom
                      </Label>
                      <Input
                        id="firstName"
                        placeholder="Jean"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="rounded-md"
                        data-testid="input-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-ink">Nom</Label>
                      <Input
                        id="lastName"
                        placeholder="Dupont"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="rounded-md"
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>
                  
                  {BILLING_ENABLED && (
                  <div className="bg-paper-deep p-4 mt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-ink">Plan sélectionné : </span>
                        <span className="text-signal font-semibold">{plans[selectedPlan].name}</span>
                      </div>
                      <button 
                        className="text-sm text-signal hover:underline"
                        onClick={() => setStep(1)}
                      >
                        Modifier
                      </button>
                    </div>
                  </div>
                  )}
                </CardContent>
              </Card>
              
              <div className="flex justify-between mt-8">
                <Button 
                  variant="outline" 
                  onClick={() => (BILLING_ENABLED ? setStep(1) : navigate("/"))}
                  className="px-6 rounded-none border-ink"
                  data-testid="button-back-step2"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour
                </Button>
                <Button 
                  className="rounded-none bg-ink text-paper hover:bg-signal px-8"
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
                <h1 className="font-serif text-headline font-medium text-ink mb-3">
                  Créez votre compte
                </h1>
                <p className="text-ink-soft">
                  Dernière étape pour accéder à Maintrix
                </p>
              </div>
              
              <Card className="border border-rule rounded-none shadow-none bg-white">
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-ink">
                      <Mail className="w-4 h-4 inline mr-2" />
                      Email professionnel
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="jean.dupont@entreprise.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="rounded-md"
                      data-testid="input-email"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-ink">
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
                        className="rounded-md pr-10"
                        data-testid="input-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute hover:text-ink-soft"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-ink">
                      Confirmer le mot de passe
                    </Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirmez votre mot de passe"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="rounded-md"
                      data-testid="input-confirm-password"
                    />
                    {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                      <p className="text-red-500 text-sm">Les mots de passe ne correspondent pas</p>
                    )}
                  </div>
                  
                  <div className="bg-paper-deep p-4">
                    <h4 className="font-medium text-ink mb-2">Récapitulatif</h4>
                    <div className="text-sm text-ink-soft space-y-1">
                      {BILLING_ENABLED && (<p><span className="font-medium">Plan :</span> {plans[selectedPlan].name} - {plans[selectedPlan].price}{plans[selectedPlan].period}</p>)}
                      <p><span className="font-medium">Entreprise :</span> {formData.companyName}</p>
                      <p><span className="font-medium">Contact :</span> {formData.firstName} {formData.lastName}</p>
                    </div>
                  </div>
                  
                  <p className="text-xs text-ink-mute text-center">
                    En créant un compte, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
                  </p>
                </CardContent>
              </Card>
              
              <div className="flex justify-between mt-8">
                <Button 
                  variant="outline" 
                  onClick={() => setStep(2)}
                  className="px-6 rounded-none border-ink"
                  data-testid="button-back-step3"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Retour
                </Button>
                <Button 
                  className="rounded-none bg-ink text-paper hover:bg-signal px-8"
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

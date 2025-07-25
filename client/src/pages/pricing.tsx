import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Header } from "@/components/header";
import { useLocation } from "wouter";
import { 
  Check, 
  Star, 
  Zap, 
  Building, 
  Crown,
  Users,
  Settings,
  BarChart3,
  Wifi,
  Database,
  Shield,
  Headphones,
  Gift
} from "lucide-react";

interface PricingFeature {
  text: string;
  included: boolean;
}

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  description: string;
  badge?: string;
  badgeColor?: "default" | "secondary" | "destructive" | "outline";
  icon: React.ComponentType<any>;
  features: PricingFeature[];
  userLimit: string;
  target: string;
  ctaText: string;
  ctaVariant?: "default" | "outline" | "secondary" | "destructive";
}

interface AddonModule {
  name: string;
  description: string;
  price: string;
  icon: React.ComponentType<any>;
}

export default function Pricing() {
  const [location, navigate] = useLocation();

  const handlePlanSelection = (planName: string) => {
    // Rediriger vers la page de paiement avec le plan sélectionné
    navigate(`/payment?plan=${planName.toLowerCase()}`);
  };

  const handleAddonSelection = (addonName: string) => {
    // Pour les modules additionnels, rediriger vers une page d'information ou de contact
    navigate(`/payment?addon=${addonName.toLowerCase().replace(/ /g, '-')}`);
  };
  const plans: PricingPlan[] = [
    {
      name: "Freemium",
      price: "0",
      period: "EUR",
      description: "Découverte et auto-formation",
      badge: "Gratuit",
      badgeColor: "secondary",
      icon: Star,
      features: [
        { text: "1 équipement", included: true },
        { text: "30 diagnostics/mois", included: true },
        { text: "IA simple (règles)", included: true },
        { text: "Historique local", included: true },
        { text: "Support communautaire", included: true },
        { text: "Diagnostic IA complet", included: false },
        { text: "Export CSV", included: false },
        { text: "API ERP", included: false }
      ],
      userLimit: "1 utilisateur / 1 site",
      target: "Découverte, auto-formation",
      ctaText: "Essai gratuit 14 jours",
      ctaVariant: "outline"
    },
    {
      name: "Pro",
      price: "15-25",
      period: "EUR/utilisateur/mois",
      description: "Solution complète pour techniciens",
      badge: "Populaire",
      badgeColor: "default",
      icon: Zap,
      features: [
        { text: "Multi-équipements", included: true },
        { text: "Diagnostic IA complet", included: true },
        { text: "Historique centralisé", included: true },
        { text: "Export CSV", included: true },
        { text: "Support prioritaire", included: true },
        { text: "Rapports avancés", included: true },
        { text: "Planification préventive", included: false },
        { text: "IoT / capteurs", included: false }
      ],
      userLimit: "Jusqu'à 10 utilisateurs",
      target: "Techniciens, PME",
      ctaText: "Essai gratuit 14 jours",
      ctaVariant: "default"
    },
    {
      name: "Business",
      price: "50-100",
      period: "EUR/site/mois",
      description: "Gestion industrielle avancée",
      badge: "Recommandé",
      badgeColor: "destructive",
      icon: Building,
      features: [
        { text: "Planification préventive", included: true },
        { text: "Suivi pièces détachées", included: true },
        { text: "IoT / capteurs", included: true },
        { text: "API ERP", included: true },
        { text: "Dashboard personnalisé", included: true },
        { text: "Formation équipe", included: true },
        { text: "SLA garanti", included: true },
        { text: "IA prédictive RUL", included: false }
      ],
      userLimit: "Multi-sites, équipes",
      target: "PME/ETI industrialisées",
      ctaText: "Essai gratuit 14 jours",
      ctaVariant: "default"
    },
    {
      name: "Enterprise",
      price: "Sur devis",
      period: "",
      description: "Solution sur mesure pour grands groupes",
      badge: "Premium",
      badgeColor: "outline",
      icon: Crown,
      features: [
        { text: "IA prédictive RUL", included: true },
        { text: "Dashboard personnalisé", included: true },
        { text: "SLA premium", included: true },
        { text: "Services Data IA", included: true },
        { text: "Onboarding dédié", included: true },
        { text: "Support 24/7", included: true },
        { text: "Intégrations sur mesure", included: true },
        { text: "Consulting stratégique", included: true }
      ],
      userLimit: "Illimité",
      target: "Groupes industriels, OEM",
      ctaText: "Nous contacter",
      ctaVariant: "outline"
    }
  ];

  const addonModules: AddonModule[] = [
    {
      name: "Module IA Prédictive",
      description: "RUL, séries temporelles",
      price: "+30 EUR/mois",
      icon: BarChart3
    },
    {
      name: "Connecteur ERP/MES/API",
      description: "Intégration systèmes existants",
      price: "+50 EUR/mois",
      icon: Database
    },
    {
      name: "Intégration IoT",
      description: "Capteurs vibration/température",
      price: "Sur devis",
      icon: Wifi
    },
    {
      name: "Export PowerBI/Grafana",
      description: "Tableaux de bord avancés",
      price: "+20 EUR/mois",
      icon: Settings
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Header />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
              <Shield className="w-4 h-4" />
              <span>Grille Tarifaire SMDiagFix GMAO IA</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              Choisissez votre formule d'abonnement
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-4">
              Tarification hybride adaptée à une GMAO connectée avec diagnostic intelligent par IA. 
              Montée en gamme naturelle selon la taille, la maturité numérique et les besoins spécifiques.
            </p>
            <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 px-4 py-2 rounded-full border border-green-200 dark:border-green-800">
              <Gift className="h-4 w-4" />
              <span className="font-medium">Essai gratuit 14 jours pour tous les plans</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Pricing Plans */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-16">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            return (
              <Card 
                key={plan.name} 
                className={`relative transition-all duration-300 hover:shadow-2xl ${
                  plan.badge === "Populaire" ? "ring-2 ring-primary shadow-xl scale-105" : 
                  plan.badge === "Recommandé" ? "ring-2 ring-destructive shadow-xl" : ""
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge variant={plan.badgeColor} className="px-3 py-1">
                      {plan.badge}
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-muted-foreground ml-1">{plan.period}</span>}
                  </div>
                  <CardDescription className="mt-2">{plan.description}</CardDescription>
                </CardHeader>
                
                <CardContent className="pt-4">
                  <div className="space-y-4 mb-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        <Users className="w-4 h-4 inline mr-1" />
                        {plan.userLimit}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Cible:</span> {plan.target}
                      </p>
                    </div>
                    
                    <Separator />
                    
                    <ul className="space-y-2">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-center space-x-2">
                          <Check 
                            className={`w-4 h-4 ${
                              feature.included ? "text-green-600" : "text-muted-foreground/30"
                            }`} 
                          />
                          <span className={`text-sm ${
                            feature.included ? "text-foreground" : "text-muted-foreground/50 line-through"
                          }`}>
                            {feature.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <Button 
                    className="w-full" 
                    variant={plan.ctaVariant}
                    size="lg"
                    onClick={() => handlePlanSelection(plan.name)}
                  >
                    {plan.ctaText}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Addon Modules */}
        <div className="mt-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Modules additionnels (optionnels)</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Étendez les fonctionnalités de votre plateforme SMDiagFix avec nos modules spécialisés
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {addonModules.map((addon, index) => {
              const Icon = addon.icon;
              return (
                <Card key={addon.name} className="transition-all duration-300 hover:shadow-lg">
                  <CardHeader className="text-center pb-4">
                    <div className="mx-auto w-10 h-10 bg-secondary/20 rounded-lg flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5 text-secondary-foreground" />
                    </div>
                    <CardTitle className="text-lg">{addon.name}</CardTitle>
                    <CardDescription>{addon.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-center">
                      <p className="text-xl font-bold text-primary mb-3">{addon.price}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={() => handleAddonSelection(addon.name)}
                      >
                        En savoir plus
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="py-12">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">Prêt à transformer votre maintenance ?</h3>
                  <p className="text-muted-foreground max-w-2xl mx-auto">
                    Découvrez comment SMDiagFix peut révolutionner votre gestion de maintenance 
                    avec l'intelligence artificielle et l'IoT industriel.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    size="lg" 
                    className="px-8"
                    onClick={() => navigate('/payment?demo=true')}
                  >
                    <Headphones className="w-4 h-4 mr-2" />
                    Demander une démo
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="px-8"
                    onClick={() => handlePlanSelection('Pro')}
                  >
                    Essai gratuit 14 jours
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Settings,
  Shield,
  Zap,
  Users,
  CheckCircle,
  ArrowRight,
  Wrench,
  BarChart3,
  Clock,
  Building2,
  Smartphone,
  Cloud,
  Lock,
  TrendingUp,
  Star,
  Play,
} from "lucide-react";

export default function LandingPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const features = [
    {
      icon: Brain,
      title: "Diagnostic IA Avancé",
      description: "9 algorithmes ML avec 98% de précision pour identifier les pannes avant qu'elles ne surviennent",
      color: "violet"
    },
    {
      icon: Settings,
      title: "GMAO Complète",
      description: "Gestion des équipements, ordres de travail, maintenance préventive et inventaire des pièces",
      color: "blue"
    },
    {
      icon: Shield,
      title: "Sécurité Enterprise",
      description: "Isolation multi-tenant, RBAC avec 7 rôles, authentification sécurisée",
      color: "emerald"
    },
    {
      icon: Smartphone,
      title: "Application Mobile",
      description: "Accès terrain avec mode hors-ligne, scanner QR et synchronisation automatique",
      color: "amber"
    },
    {
      icon: BarChart3,
      title: "Rapports & Analytics",
      description: "Tableaux de bord en temps réel, KPIs, exports PDF automatisés",
      color: "rose"
    },
    {
      icon: Cloud,
      title: "Déploiement Flexible",
      description: "SaaS cloud ou installation locale sur vos serveurs (Linux, macOS, Windows)",
      color: "sky"
    }
  ];

  const plans = [
    {
      id: "freemium",
      name: "Freemium",
      price: "0€",
      period: "pour toujours",
      description: "Idéal pour découvrir Maintrix",
      features: [
        "Jusqu'à 10 équipements",
        "5 utilisateurs maximum",
        "Diagnostic IA basique",
        "Ordres de travail",
        "Support communautaire"
      ],
      limitations: [
        "Rapports limités",
        "Pas d'accès mobile",
        "1 tenant uniquement"
      ],
      cta: "Commencer gratuitement",
      popular: false,
      color: "slate"
    },
    {
      id: "professional",
      name: "Professionnel",
      price: "49€",
      period: "/mois",
      description: "Pour les équipes de maintenance",
      features: [
        "Équipements illimités",
        "25 utilisateurs",
        "Diagnostic IA avancé (9 algorithmes)",
        "Maintenance préventive complète",
        "Application mobile",
        "Rapports PDF automatiques",
        "Support prioritaire"
      ],
      limitations: [],
      cta: "Essai gratuit 14 jours",
      popular: true,
      color: "blue"
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "199€",
      period: "/mois",
      description: "Multi-sites & grandes entreprises",
      features: [
        "Tout du plan Professionnel",
        "Utilisateurs illimités",
        "Multi-tenant (sites illimités)",
        "Intégrations ERP (SAP, Maximo)",
        "API complète",
        "Déploiement local possible",
        "SLA garanti 99.9%",
        "Account manager dédié"
      ],
      limitations: [],
      cta: "Contacter les ventes",
      popular: false,
      color: "violet"
    }
  ];

  const testimonials = [
    {
      quote: "Maintrix a réduit nos temps d'arrêt de 40% en 6 mois grâce au diagnostic prédictif.",
      author: "Marie Dupont",
      role: "Directrice Maintenance",
      company: "Industrie Métallurgique SA"
    },
    {
      quote: "L'interface intuitive a facilité l'adoption par nos techniciens terrain.",
      author: "Jean-Pierre Martin",
      role: "Responsable GMAO",
      company: "Groupe Agroalimentaire"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-800">Maintrix</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">Fonctionnalités</a>
              <a href="#pricing" className="text-slate-600 hover:text-slate-900 transition-colors">Tarifs</a>
              <a href="#testimonials" className="text-slate-600 hover:text-slate-900 transition-colors">Témoignages</a>
            </div>
            <div className="flex items-center space-x-3">
              <Link href="/login">
                <Button variant="ghost" className="text-slate-600" data-testid="button-login">
                  Connexion
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-blue-600 hover:bg-blue-700" data-testid="button-register">
                  Créer un compte
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto text-center">
          <Badge className="bg-blue-50 text-blue-700 border border-blue-200 px-4 py-1.5 mb-6">
            Plateforme GMAO + IA de nouvelle génération
          </Badge>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
            La maintenance industrielle<br />
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              intelligente et prédictive
            </span>
          </h1>
          
          <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-10">
            Maintrix combine une GMAO complète avec l'intelligence artificielle pour anticiper les pannes, 
            optimiser vos interventions et réduire vos coûts de maintenance jusqu'à 40%.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-12">
            <Link href="/register">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 px-8 py-6 text-lg rounded-xl" data-testid="button-cta-primary">
                Commencer gratuitement
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="px-8 py-6 text-lg rounded-xl border-slate-300" data-testid="button-demo">
              <Play className="mr-2 h-5 w-5" />
              Voir la démo
            </Button>
          </div>
          
          <div className="flex justify-center items-center flex-wrap gap-6 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span>Essai gratuit 14 jours</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span>Aucune carte requise</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span>Configuration en 5 minutes</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-blue-400 mb-1">98%</div>
              <div className="text-slate-400 text-sm">Précision IA</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-emerald-400 mb-1">40%</div>
              <div className="text-slate-400 text-sm">Réduction des pannes</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-violet-400 mb-1">120+</div>
              <div className="text-slate-400 text-sm">Cas industriels</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-bold text-amber-400 mb-1">99.9%</div>
              <div className="text-slate-400 text-sm">Disponibilité</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Une plateforme complète qui unifie la gestion de maintenance et l'intelligence artificielle
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-300">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-${feature.color}-50`}>
                    <feature.icon className={`w-6 h-6 text-${feature.color}-600`} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">{feature.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Comment ça marche ?
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Connectez vos équipements</h3>
              <p className="text-slate-600">Importez votre parc d'équipements ou connectez vos capteurs IoT en quelques clics</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-violet-600">2</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">L'IA analyse et prédit</h3>
              <p className="text-slate-600">Nos 9 algorithmes ML détectent les anomalies et prédisent les pannes avec 98% de précision</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-emerald-600">3</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">Agissez proactivement</h3>
              <p className="text-slate-600">Planifiez vos interventions avant les pannes et réduisez vos coûts de maintenance</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Tarifs simples et transparents
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Commencez gratuitement, évoluez selon vos besoins
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card 
                key={plan.id}
                className={`relative border-2 transition-all duration-300 ${
                  plan.popular 
                    ? 'border-blue-500 shadow-lg scale-105' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-600 text-white px-3 py-1">
                      <Star className="w-3 h-3 mr-1" />
                      Plus populaire
                    </Badge>
                  </div>
                )}
                <CardContent className="p-6 pt-8">
                  <h3 className="text-xl font-bold text-slate-800 mb-2">{plan.name}</h3>
                  <p className="text-slate-500 text-sm mb-4">{plan.description}</p>
                  
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                    <span className="text-slate-500">{plan.period}</span>
                  </div>
                  
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                        <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Link href={`/register?plan=${plan.id}`}>
                    <Button 
                      className={`w-full rounded-xl ${
                        plan.popular 
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : 'bg-slate-800 hover:bg-slate-900'
                      }`}
                      data-testid={`button-plan-${plan.id}`}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Ils nous font confiance
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border border-slate-200">
                <CardContent className="p-6">
                  <p className="text-slate-700 italic mb-4">"{testimonial.quote}"</p>
                  <div>
                    <div className="font-semibold text-slate-800">{testimonial.author}</div>
                    <div className="text-sm text-slate-500">{testimonial.role}, {testimonial.company}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-violet-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Prêt à transformer votre maintenance ?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Rejoignez les entreprises qui ont réduit leurs coûts de maintenance avec Maintrix
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link href="/register">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 px-8 py-6 text-lg rounded-xl" data-testid="button-cta-bottom">
                Commencer gratuitement
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Wrench className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">Maintrix</span>
            </div>
            <div className="text-sm">
              © 2025 Maintrix. Tous droits réservés. | maintrix-t.com
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ACCENT, type AccentColor } from "@/lib/accent-colors";
import { BILLING_ENABLED } from "@/lib/feature-flags";
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
  TrendingUp,
  Star,
  Play,
  Activity,
  Cpu,
  Network,
  ChevronRight,
  Lock,
  Globe,
  Award,
  Menu,
  X,
  Download,
  Mail,
  Phone,
} from "lucide-react";

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [counter, setCounter] = useState({ uptime: 0, cases: 0, nodes: 0, accuracy: 0 });
  const [showSalesModal, setShowSalesModal] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const duration = 1800;
    const steps = 50;
    const targets = { uptime: 99.9, cases: 120, nodes: 48, accuracy: 98 };
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      const ease = 1 - Math.pow(1 - progress, 3);
      setCounter({
        uptime: Math.round(targets.uptime * ease * 10) / 10,
        cases: Math.round(targets.cases * ease),
        nodes: Math.round(targets.nodes * ease),
        accuracy: Math.round(targets.accuracy * ease),
      });
      if (step >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, []);

  const features = [
    {
      icon: Activity,
      title: "Perception Sensorielle",
      description: "Réception temps réel des capteurs IoT (MQTT, OPC-UA). Traitement edge et surveillance permanente de l'état physique de vos machines.",
      color: "amber",
      bg: "from-amber-500/10 to-amber-600/5",
      border: "border-amber-200/50",
    },
    {
      icon: Brain,
      title: "Supervision Adaptative",
      description: "5 modules coopératifs. Modélisation causale via Knowledge Graph (48+ nœuds, 46+ arêtes). Autonomie graduée de 0 à 5.",
      color: "violet",
      bg: "from-violet-500/10 to-violet-600/5",
      border: "border-violet-200/50",
    },
    {
      icon: Shield,
      title: "Diagnostic Hybride IA",
      description: "Règles expertes + similarité historique (120+ cas) + IA Claude + modèles physiques. Explainabilité complète et capitalisation continue.",
      color: "emerald",
      bg: "from-emerald-500/10 to-emerald-600/5",
      border: "border-emerald-200/50",
    },
    {
      icon: Network,
      title: "Modèle Causal Dynamique",
      description: "Le graphe de connaissances s'adapte à chaque intervention. Relations pondérées, propagation de défaillances et prédiction en cascade.",
      color: "blue",
      bg: "from-blue-500/10 to-blue-600/5",
      border: "border-blue-200/50",
    },
    {
      icon: Settings,
      title: "GMAO Complète",
      description: "Équipements, ordres de travail, maintenance préventive, pièces détachées, budget, calibration, habilitations — tout en un seul système.",
      color: "rose",
      bg: "from-rose-500/10 to-rose-600/5",
      border: "border-rose-200/50",
    },
    {
      icon: Smartphone,
      title: "Multi-Environnement",
      description: "Web, application desktop Windows/macOS, application mobile React Native avec mode hors-ligne. Accessible partout, tout le temps.",
      color: "sky",
      bg: "from-sky-500/10 to-sky-600/5",
      border: "border-sky-200/50",
    },
  ];

  /**
   * Liens de navigation. « Tarifs » n'apparaît que si l'offre payante est
   * activée : sans cette condition, le lien subsisterait et pointerait vers une
   * ancre `#pricing` inexistante — un clic sans effet, que le visiteur
   * interprète comme un défaut de l'application.
   */
  type Lien = [string, string];
  const liensNav: Lien[] = [
    ["#features", "Fonctionnalités"],
    ["#how-it-works", "Comment ça marche"],
    ...(BILLING_ENABLED ? [["#pricing", "Tarifs"] as Lien] : []),
  ];
  const liensProduit: Lien[] = [
    ["#features", "Fonctionnalités"],
    ...(BILLING_ENABLED ? [["#pricing", "Tarifs"] as Lien] : []),
    ["/download", "Télécharger"],
    ["/api-docs", "API Documentation"],
  ];

  const plans = [
    {
      id: "solo",
      name: "Solo",
      price: "29,99€",
      period: "/mois",
      description: "Technicien ou petit atelier",
      userRange: "1 utilisateur",
      features: ["Équipements illimités", "GMAO complète", "Diagnostic IA", "Rapports PDF", "Application mobile"],
      cta: "Essai gratuit 14j",
      popular: false,
    },
    {
      id: "equipe",
      name: "Équipe",
      price: "89,99€",
      period: "/mois",
      description: "Petite équipe de maintenance",
      userRange: "2 à 5 utilisateurs",
      features: ["Tout du plan Solo", "Collaboration équipe", "OEE & RCA", "FMEA/AMDEC", "Alertes multi-canaux"],
      cta: "Essai gratuit 14j",
      popular: false,
    },
    {
      id: "business",
      name: "Entreprise S",
      price: "189,99€",
      period: "/mois",
      description: "Site industriel complet",
      userRange: "6 à 11 utilisateurs",
      features: ["Tout du plan Équipe", "Supervision adaptative", "Knowledge Graph", "IoT intégré", "Rapports avancés"],
      cta: "Essai gratuit 14j",
      popular: true,
    },
    {
      id: "enterprise",
      name: "Entreprise L",
      price: "Sur devis",
      period: "",
      description: "Groupes industriels multi-sites",
      userRange: "21+ utilisateurs",
      features: ["Multi-tenant illimité", "Déploiement on-premise", "SAP / Maximo / SCADA", "SLA 99,9%", "Support 24/7 dédié"],
      cta: "Contacter les ventes",
      popular: false,
    },
  ];

  const steps = [
    {
      n: "01",
      title: "Connectez vos capteurs",
      desc: "Branchez vos équipements via MQTT, OPC-UA ou notre API REST. Le module de perception commence à collecter les signaux physiques en temps réel.",
      icon: Zap,
      color: "blue",
    },
    {
      n: "02",
      title: "Le modèle apprend",
      desc: "Le Knowledge Graph modélise les relations de cause à effet. Le système détecte les déviations et enrichit son modèle causal à chaque anomalie.",
      icon: Brain,
      color: "violet",
    },
    {
      n: "03",
      title: "Contrôle automatique",
      desc: "En fonction du niveau d'autonomie choisi (0-5), le système émet des recommandations ou déclenche directement des actions correctives sur l'équipement.",
      icon: Settings,
      color: "emerald",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">

      {/* ── Navigation ────────────────────────────────────── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-slate-950/95 backdrop-blur-md border-b border-slate-800/60 shadow-xl" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">Maintrix</span>
              <Badge className="hidden sm:flex bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] px-2 py-0.5">v2.6</Badge>
            </div>

            <div className="hidden md:flex items-center space-x-7">
              {liensNav.map(([href, label]) => (
                <a key={href} href={href} className="text-slate-400 hover:text-white text-sm transition-colors">{label}</a>
              ))}
              <Link href="/download" className="text-slate-400 hover:text-white text-sm transition-colors flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" />Desktop
              </Link>
            </div>

            <div className="hidden md:flex items-center space-x-3">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/10">
                  Connexion
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/25">
                  Essai gratuit
                  <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            <button className="md:hidden text-slate-400" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-t border-slate-800 px-4 py-4 space-y-3">
            {liensNav.map(([href, label]) => (
              <a key={href} href={href} className="block text-slate-300 py-2" onClick={() => setMobileMenuOpen(false)}>{label}</a>
            ))}
            <div className="pt-2 flex gap-3">
              <Link href="/login" className="flex-1"><Button variant="outline" className="w-full border-slate-700 text-slate-300">Connexion</Button></Link>
              <Link href="/register" className="flex-1"><Button className="w-full bg-blue-600 hover:bg-blue-500">Essai gratuit</Button></Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-blue-600/10 rounded-full blur-[140px]" />
          <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-violet-600/8 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-emerald-600/6 rounded-full blur-[80px]" />
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b20_1px,transparent_1px),linear-gradient(to_bottom,#1e293b20_1px,transparent_1px)] bg-[size:64px_64px]" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/25 text-blue-400 text-sm px-4 py-2 rounded-full mb-8">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
            Architecture propriétaire · 5 modules coopératifs · Autonomie graduée 0-5
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight mb-6">
            <span className="text-white">Le cerveau industriel</span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              qui supervise & contrôle
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            Maintrix capte les signaux de vos capteurs, détecte les anomalies,
            modélise les causes de défaillance via un graphe de connaissances dynamique
            et génère des actions correctives — automatiquement ou guidées.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
            <Link href="/register">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-500 px-8 h-12 text-base rounded-xl shadow-xl shadow-blue-600/30 group">
                Commencer gratuitement — 14 jours
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <a href="#how-it-works">
              <Button size="lg" variant="outline" className="px-8 h-12 text-base rounded-xl border-slate-700 text-slate-300 hover:bg-white/5 hover:border-slate-500">
                <Play className="mr-2 w-4 h-4" />
                Voir comment ça marche
              </Button>
            </a>
          </div>

          <div className="flex justify-center flex-wrap gap-5 text-sm text-slate-500">
            {[
              "Aucune carte bancaire",
              "Accès complet 14 jours",
              "Configuration en 5 min",
              "Annulation à tout moment",
            ].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" />{t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats Bar ─────────────────────────────────────── */}
      <section className="py-12 border-y border-slate-800/60 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { val: `${counter.uptime}%`, label: "Disponibilité SLA", color: "text-blue-400" },
            { val: `${counter.cases}+`, label: "Cas industriels", color: "text-emerald-400" },
            { val: `${counter.nodes}+`, label: "Nœuds Knowledge Graph", color: "text-violet-400" },
            { val: `${counter.accuracy}%`, label: "Précision diagnostic IA", color: "text-amber-400" },
          ].map(({ val, label, color }) => (
            <div key={label}>
              <div className={`text-3xl sm:text-4xl font-bold mb-1 ${color}`}>{val}</div>
              <div className="text-slate-500 text-sm">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────── */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-violet-500/10 text-violet-400 border border-violet-500/30 mb-4">Fonctionnalités</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Une supervision industrielle complète
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Cinq modules coopératifs qui transforment vos machines en systèmes auto-contrôlés
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={i}
                className={`group relative bg-gradient-to-br ${f.bg} border ${f.border} rounded-2xl p-7 hover:scale-[1.02] transition-all duration-300 cursor-default`}
              >
                <div className={`w-12 h-12 rounded-xl ${ACCENT[f.color as AccentColor].iconTile} flex items-center justify-center mb-5 group-hover:-translate-y-0.5 transition-transform`}>
                  <f.icon className={`w-6 h-6 ${ACCENT[f.color as AccentColor].icon400}`} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 mb-4">Comment ça marche</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">3 étapes vers l'autonomie industrielle</h2>
          </div>

          <div className="space-y-8">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-6 items-start group">
                <div className="flex-shrink-0 flex flex-col items-center">
                  <div className={`w-14 h-14 rounded-2xl ${ACCENT[s.color as AccentColor].iconTile} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <s.icon className={`w-7 h-7 ${ACCENT[s.color as AccentColor].icon400}`} />
                  </div>
                  {i < steps.length - 1 && <div className="w-px h-8 bg-slate-700/60 mt-2" />}
                </div>
                <div className="pt-1.5">
                  <div className={`text-xs font-bold ${ACCENT[s.color as AccentColor].text500} mb-1 tracking-widest`}>{s.n}</div>
                  <h3 className="text-xl font-semibold text-white mb-2">{s.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platforms ─────────────────────────────────────── */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Disponible sur toutes vos plateformes</h2>
            <p className="text-slate-400">Web, Desktop Windows/macOS/Linux et Mobile iOS/Android</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { icon: Globe, title: "Application Web", desc: "Accès depuis n'importe quel navigateur. Responsive et optimisé.", color: "blue", badge: "Disponible" },
              { icon: Building2, title: "Desktop", desc: "Installeur Windows (.EXE/.MSI), macOS (.DMG) et Linux. Fonctionnement hors-ligne partiel.", color: "violet", badge: "v2.6.0" },
              { icon: Smartphone, title: "Mobile", desc: "React Native iOS & Android. Mode hors-ligne complet avec synchronisation automatique.", color: "emerald", badge: "Bêta" },
            ].map(({ icon: Icon, title, desc, color, badge }) => (
              <div key={title} className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-6 text-center hover:border-slate-700 transition-colors">
                <div className={`w-14 h-14 ${ACCENT[color as AccentColor].iconTileSm} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                  <Icon className={`w-7 h-7 ${ACCENT[color as AccentColor].icon400}`} />
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h3 className="text-white font-semibold">{title}</h3>
                  <Badge className={`text-[10px] ${ACCENT[color as AccentColor].badgeChip}`}>{badge}</Badge>
                </div>
                <p className="text-slate-500 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────── */}
      {BILLING_ENABLED && (
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/30 mb-4">Tarifs</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Tarifs simples et transparents</h2>
            <p className="text-slate-400 max-w-xl mx-auto">14 jours d'essai gratuit sur tous les plans. Aucune carte bancaire requise.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((p) => (
              <div
                key={p.id}
                className={`relative rounded-2xl p-6 flex flex-col transition-all duration-300 ${
                  p.popular
                    ? "bg-gradient-to-b from-blue-600/20 to-blue-600/5 border-2 border-blue-500/50 shadow-xl shadow-blue-600/10 scale-[1.03]"
                    : "bg-slate-900/60 border border-slate-800/60 hover:border-slate-700"
                }`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-600 text-white border-0 px-3 shadow-lg">
                      <Star className="w-3 h-3 mr-1 fill-white" />Recommandé
                    </Badge>
                  </div>
                )}
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-white mb-1">{p.name}</h3>
                  <p className="text-slate-500 text-xs">{p.description}</p>
                </div>
                <div className="mb-4">
                  <span className="text-3xl font-extrabold text-white">{p.price}</span>
                  {p.period && <span className="text-slate-500 text-sm ml-1">{p.period}</span>}
                </div>
                <div className="flex items-center gap-1.5 mb-5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-400 text-xs">{p.userRange}</span>
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {p.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {feat}
                    </li>
                  ))}
                </ul>
                {p.id === "enterprise" ? (
                  <Button
                    onClick={() => setShowSalesModal(true)}
                    className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700"
                  >
                    {p.cta}
                  </Button>
                ) : (
                  <Link href={`/register?plan=${p.id}`}>
                    <Button
                      className={`w-full rounded-xl ${p.popular ? "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20" : "bg-slate-800 hover:bg-slate-700 border border-slate-700"}`}
                    >
                      {p.cta}
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ── Final CTA ─────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-violet-600/15 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-[100px]" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-600/30">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Prêt à superviser intelligemment vos machines ?
          </h2>
          <p className="text-slate-400 text-lg mb-8">
            Rejoignez les équipes industrielles qui ont réduit leurs coûts de maintenance avec Maintrix.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100 px-8 h-12 rounded-xl font-semibold shadow-xl">
                Commencer gratuitement
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="border-slate-600 text-slate-300 hover:bg-white/5 px-8 h-12 rounded-xl">
                J'ai déjà un compte
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/60 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-600 rounded-lg flex items-center justify-center">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-bold">Maintrix</span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">Supervision & Contrôle Adaptatif Industriel. Architecture propriétaire à 5 modules coopératifs.</p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Produit</h4>
              <ul className="space-y-2">
                {liensProduit.map(([href, l]) => (
                  <li key={l}><a href={href} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Ressources</h4>
              <ul className="space-y-2">
                <li><Link href="/documentation" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Documentation</Link></li>
                <li><Link href="/support-chatbot" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Support</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Entreprise</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">À propos</a></li>
                <li>
                  <button onClick={() => setShowSalesModal(true)} className="text-slate-500 hover:text-slate-300 text-sm transition-colors text-left">
                    Contact
                  </button>
                </li>
                <li><a href="#" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Mentions légales</a></li>
                <li><a href="#" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Politique de confidentialité</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800/60 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-slate-600 text-sm">
            <span>© 2024–2026 Maintrix. Tous droits réservés.</span>
            <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> RGPD · Hébergé en Europe</span>
          </div>
        </div>
      </footer>

      {/* ── Modal Contact Commercial ─────────────────────────── */}
      {showSalesModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
          onClick={() => setShowSalesModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setShowSalesModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/30">
                <Phone className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Contactez nos ventes</h2>
              <p className="mt-1 text-sm text-slate-400">
                Notre équipe commerciale vous répond sous 24h pour construire votre offre sur-mesure.
              </p>
            </div>

            {/* Contact info */}
            <div className="space-y-4">
              <a
                href="mailto:contact@mantrix-t.com"
                className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800 p-4 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20">
                  <Mail className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Email commercial</p>
                  <p className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">
                    contact@mantrix-t.com
                  </p>
                </div>
              </a>

              <a
                href="tel:+33628352828"
                className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800 p-4 hover:border-emerald-500/50 hover:bg-slate-800/80 transition-all group"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600/20">
                  <Phone className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Téléphone</p>
                  <p className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors">
                    +33 6 28 35 28 28
                  </p>
                </div>
              </a>
            </div>

            <p className="mt-6 text-center text-xs text-slate-600">
              Lun–Ven · 9h–18h · Heure de Paris
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, 
  Video, 
  FileText, 
  Search, 
  Download, 
  Play, 
  Clock, 
  Users, 
  CheckCircle,
  HelpCircle,
  Lightbulb,
  Settings,
  Wrench,
  Brain,
  Upload,
  BarChart,
  Factory,
  ExternalLink
} from "lucide-react";
import { Header } from "@/components/header";

interface GuideSection {
  id: string;
  title: string;
  description: string;
  duration: string;
  difficulty: "Débutant" | "Intermédiaire" | "Avancé";
  icon: any;
  content: string[];
}

interface VideoTutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  thumbnail: string;
  category: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export default function Documentation() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<GuideSection | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<VideoTutorial | null>(null);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const { toast } = useToast();

  // Gestionnaires d'événements pour les boutons
  const handleOpenGuide = (guideId: string, title: string) => {
    const guide = guides.find(g => g.id === guideId);
    if (guide) {
      setSelectedGuide(guide);
      setIsGuideModalOpen(true);
    }
  };

  const handleWatchVideo = (videoId: string, title: string) => {
    const video = videoTutorials.find(v => v.id === videoId);
    if (video) {
      setSelectedVideo(video);
      setIsVideoModalOpen(true);
    }
  };

  const handleDownloadResource = (filename: string) => {
    toast({
      title: "Téléchargement démarré",
      description: `Téléchargement de ${filename} en cours...`,
    });
    // Simulation du téléchargement
    console.log(`Downloading: ${filename}`);
  };

  const guides: GuideSection[] = [
    {
      id: "getting-started",
      title: "Premiers pas avec Smart GMAO DiagFix",
      description: "Guide d'introduction complet pour débuter avec la plateforme intégrée Smart Diagnostic + Smart GMAO",
      duration: "20 min",
      difficulty: "Débutant",
      icon: Play,
      content: [
        "Connexion à Smart GMAO DiagFix et découverte de l'interface moderne avec glassmorphisme",
        "Navigation vers la page dédiée Smart Diagnostic via le bouton principal ou les cartes fonctionnalités",
        "Création de votre premier diagnostic avec l'interface Smart Diagnostic IA dédiée",
        "Intégration automatique des diagnostics dans Smart GMAO pour générer des ordres de travail",
        "Workflow complet de maintenance : Smart Diagnostic → Smart GMAO → IoT → Intervention",
        "Utilisation du chatbot support technique intégré",
        "Comprendre les résultats IA, maintenance prédictive et gamification",
        "Monitoring IoT temps réel et alertes automatiques",
        "Système de validation multi-niveaux et sécurité avancée",
        "Gestion des abonnements et période d'essai gratuite de 14 jours"
      ]
    },
    {
      id: "diagnostic-advanced",
      title: "Smart Diagnostic Avancé + Smart GMAO",
      description: "Maîtrisez l'intégration complète Smart Diagnostic et Smart GMAO",
      duration: "35 min",
      difficulty: "Intermédiaire",
      icon: Brain,
      content: [
        "Utilisation des modes ML avancés (Standard, Avancé, Ensemble ML) dans la page dédiée",
        "Navigation entre les onglets Diagnostic, Réparation, Historique et Rapports",
        "Interprétation des scores de confiance et analyses prédictives",
        "Conversion automatique Smart Diagnostic → ordre de travail Smart GMAO",
        "Analyse des anomalies et maintenance prédictive",
        "Workflow intégré diagnostic → planification → intervention",
        "Optimisation des diagnostics selon votre contexte industriel",
        "Personnalisation des symptômes par type d'équipement"
      ]
    },
    {
      id: "gmao-complete",
      title: "Smart GMAO Complet - Gestion de Maintenance",
      description: "Maîtrisez tous les aspects de la gestion de maintenance",
      duration: "45 min",
      difficulty: "Intermédiaire",
      icon: Factory,
      content: [
        "Gestion complète des équipements et registres d'actifs",
        "Création et suivi des ordres de travail",
        "Planification de la maintenance préventive",
        "Gestion des stocks et pièces de rechange",
        "Système de validation multi-niveaux",
        "Intégration IoT et monitoring en temps réel",
        "Tableaux de bord et KPIs de maintenance"
      ]
    },
    {
      id: "repair-procedures",
      title: "Procédures de Réparation",
      description: "Guide complet des procédures de maintenance",
      duration: "30 min",
      difficulty: "Intermédiaire",
      icon: Wrench,
      content: [
        "Planification des interventions",
        "Suivi des étapes de réparation",
        "Gestion des outils et équipements requis",
        "Respect des consignes de sécurité",
        "Documentation des interventions"
      ]
    },
    {
      id: "data-import",
      title: "Importation de Données",
      description: "Intégrez vos données historiques d'entreprise",
      duration: "20 min",
      difficulty: "Avancé",
      icon: Upload,
      content: [
        "Préparation des fichiers CSV",
        "Utilisation des templates",
        "Validation et correction des erreurs",
        "Optimisation de la qualité des données",
        "Entraînement des modèles IA personnalisés"
      ]
    },
    {
      id: "analytics",
      title: "Analyses et Rapports",
      description: "Exploitez vos données de maintenance",
      duration: "35 min",
      difficulty: "Avancé",
      icon: BarChart,
      content: [
        "Création de tableaux de bord personnalisés",
        "Analyse des tendances de maintenance",
        "Métriques de performance des équipements",
        "Prédictions et maintenance préventive",
        "Export et partage des rapports"
      ]
    },
    {
      id: "administration",
      title: "Administration Système",
      description: "Configuration et gestion des utilisateurs",
      duration: "40 min",
      difficulty: "Avancé",
      icon: Settings,
      content: [
        "Gestion des profils utilisateurs",
        "Configuration des autorisations",
        "Paramétrage des équipements",
        "Maintenance de la base de données",
        "Sauvegarde et restauration"
      ]
    }
  ];

  const videoTutorials: VideoTutorial[] = [
    {
      id: "intro-video",
      title: "Introduction à SMDiagFix",
      description: "Découvrez les fonctionnalités principales en 5 minutes",
      duration: "5:30",
      thumbnail: "🎬",
      category: "Introduction"
    },
    {
      id: "diagnostic-demo",
      title: "Réaliser un diagnostic complet",
      description: "Démonstration pas-à-pas d'un diagnostic de moteur",
      duration: "12:45",
      thumbnail: "🔧",
      category: "Diagnostic"
    },
    {
      id: "ml-features",
      title: "Fonctionnalités IA avancées",
      description: "Exploitez toute la puissance de l'intelligence artificielle",
      duration: "18:20",
      thumbnail: "🧠",
      category: "IA/ML"
    },
    {
      id: "data-import-tutorial",
      title: "Importer vos données historiques",
      description: "Guide complet pour intégrer vos données d'entreprise",
      duration: "15:10",
      thumbnail: "📊",
      category: "Données"
    },
    {
      id: "maintenance-workflow",
      title: "Workflow de maintenance optimisé",
      description: "Organisez efficacement vos interventions",
      duration: "22:30",
      thumbnail: "⚙️",
      category: "Workflow"
    },
    {
      id: "reporting-analytics",
      title: "Rapports et analyses",
      description: "Créez des rapports percutants pour votre direction",
      duration: "16:45",
      thumbnail: "📈",
      category: "Rapports"
    }
  ];

  const faqs: FAQ[] = [
    {
      id: "what-is-smdiagfix",
      question: "Qu'est-ce que SMDiagFix ?",
      answer: "SMDiagFix est une plateforme intelligente de diagnostic et maintenance industrielle qui utilise l'IA pour aider les techniciens à identifier rapidement les problèmes d'équipements et proposer des solutions adaptées.",
      category: "Général"
    },
    {
      id: "how-accurate-ai",
      question: "Quelle est la précision de l'IA de diagnostic ?",
      answer: "Nos modèles ML atteignent une précision de 85-95% selon les types d'équipements. La précision s'améliore avec l'ajout de vos données historiques spécifiques.",
      category: "IA/ML"
    },
    {
      id: "data-security",
      question: "Mes données sont-elles sécurisées ?",
      answer: "Absolument. Toutes les données sont chiffrées, stockées localement ou sur des serveurs sécurisés conformes aux normes industrielles. Vos données restent votre propriété.",
      category: "Sécurité"
    },
    {
      id: "offline-usage",
      question: "Puis-je utiliser SMDiagFix hors ligne ?",
      answer: "Certaines fonctionnalités de base sont disponibles hors ligne. Pour les diagnostics IA avancés, une connexion internet est requise.",
      category: "Technique"
    },
    {
      id: "equipment-types",
      question: "Quels types d'équipements sont supportés ?",
      answer: "SMDiagFix supporte une large gamme : moteurs, pompes, convoyeurs, compresseurs, systèmes hydrauliques, équipements électriques, et plus encore.",
      category: "Équipements"
    },
    {
      id: "training-time",
      question: "Combien de temps faut-il pour former les utilisateurs ?",
      answer: "La plupart des utilisateurs sont opérationnels en 2-4 heures. Nos formations structurées et tutoriels interactifs accélèrent l'apprentissage.",
      category: "Formation"
    },
    {
      id: "data-import-format",
      question: "Quels formats de données puis-je importer ?",
      answer: "Nous supportons principalement CSV et Excel. Des templates sont fournis pour faciliter la préparation de vos données historiques.",
      category: "Données"
    },
    {
      id: "mobile-access",
      question: "L'application est-elle disponible sur mobile ?",
      answer: "SMDiagFix est une application web responsive qui fonctionne parfaitement sur tablettes et smartphones pour les interventions terrain.",
      category: "Mobile"
    },
    {
      id: "integration-erp",
      question: "Peut-on intégrer SMDiagFix avec notre ERP/GMAO ?",
      answer: "Oui, nous proposons des API et connecteurs pour intégrer SMDiagFix avec les principaux systèmes ERP et GMAO du marché.",
      category: "Intégration"
    },
    {
      id: "cost-roi",
      question: "Quel est le retour sur investissement ?",
      answer: "Les clients observent généralement 20-40% de réduction des temps de diagnostic et 15-25% d'amélioration de l'efficacité maintenance dès les premiers mois.",
      category: "ROI"
    }
  ];

  const filteredGuides = guides.filter(guide =>
    guide.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    guide.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredVideos = videoTutorials.filter(video =>
    (selectedCategory === "all" || video.category === selectedCategory) &&
    (video.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
     video.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredFAQs = faqs.filter(faq =>
    (selectedCategory === "all" || faq.category === selectedCategory) &&
    (faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
     faq.answer.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const videoCategories = ["all", "Introduction", "Diagnostic", "IA/ML", "Données", "Workflow", "Rapports"];
  const faqCategories = ["all", "Général", "IA/ML", "Sécurité", "Technique", "Équipements", "Formation", "Données", "Mobile", "Intégration", "ROI"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Header />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
              <BookOpen className="w-4 h-4" />
              <span>Centre de Documentation</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              Support & Formation
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Guides complets, tutoriels vidéo et support technique pour maîtriser SMDiagFix
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Rechercher dans la documentation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs defaultValue="guides" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="guides" className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4" />
              <span>Guides</span>
            </TabsTrigger>
            <TabsTrigger value="videos" className="flex items-center space-x-2">
              <Video className="w-4 h-4" />
              <span>Vidéos</span>
            </TabsTrigger>
            <TabsTrigger value="faq" className="flex items-center space-x-2">
              <HelpCircle className="w-4 h-4" />
              <span>FAQ</span>
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex items-center space-x-2">
              <Download className="w-4 h-4" />
              <span>Ressources</span>
            </TabsTrigger>
          </TabsList>

          {/* Guides Tab */}
          <TabsContent value="guides" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGuides.map((guide) => {
                const IconComponent = guide.icon;
                return (
                  <Card key={guide.id} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <IconComponent className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{guide.title}</CardTitle>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant={guide.difficulty === "Débutant" ? "secondary" : guide.difficulty === "Intermédiaire" ? "outline" : "destructive"}>
                                {guide.difficulty}
                              </Badge>
                              <span className="text-sm text-muted-foreground flex items-center">
                                <Clock className="w-3 h-3 mr-1" />
                                {guide.duration}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground mb-4">{guide.description}</p>
                      <div className="space-y-2">
                        {guide.content.slice(0, 3).map((item, index) => (
                          <div key={index} className="flex items-center space-x-2 text-sm">
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            <span>{item}</span>
                          </div>
                        ))}
                        {guide.content.length > 3 && (
                          <div className="text-sm text-muted-foreground">
                            +{guide.content.length - 3} autres points...
                          </div>
                        )}
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            className="w-full mt-4"
                            onClick={() => handleOpenGuide(guide.id, guide.title)}
                          >
                            <BookOpen className="w-4 h-4 mr-2" />
                            Lire le guide
                          </Button>
                        </DialogTrigger>
                      </Dialog>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Videos Tab */}
          <TabsContent value="videos" className="space-y-6">
            <div className="flex flex-wrap gap-2 mb-6">
              {videoCategories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category === "all" ? "Toutes" : category}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVideos.map((video) => (
                <Card key={video.id} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer">
                  <CardContent className="p-6">
                    <div className="aspect-video bg-gradient-to-br from-primary/10 to-primary/20 rounded-lg mb-4 flex items-center justify-center text-4xl">
                      {video.thumbnail}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">{video.category}</Badge>
                        <span className="text-sm text-muted-foreground flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {video.duration}
                        </span>
                      </div>
                      <h3 className="font-semibold">{video.title}</h3>
                      <p className="text-sm text-muted-foreground">{video.description}</p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            className="w-full"
                            onClick={() => handleWatchVideo(video.id, video.title)}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Regarder
                          </Button>
                        </DialogTrigger>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="space-y-6">
            <div className="flex flex-wrap gap-2 mb-6">
              {faqCategories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category === "all" ? "Toutes" : category}
                </Button>
              ))}
            </div>

            <div className="space-y-4">
              {filteredFAQs.map((faq) => (
                <Card key={faq.id} className="border-0 shadow-sm">
                  <CardContent className="p-6">
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <HelpCircle className="w-5 h-5 text-primary" />
                          <span className="font-medium">{faq.question}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{faq.category}</Badge>
                          <span className="text-lg">{expandedFAQ === faq.id ? "−" : "+"}</span>
                        </div>
                      </div>
                    </button>
                    {expandedFAQ === faq.id && (
                      <div className="mt-4 pl-8 text-muted-foreground">
                        {faq.answer}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span>Documents Techniques</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <div className="font-medium">Guide d'installation</div>
                        <div className="text-sm text-muted-foreground">PDF - 2.5 MB</div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDownloadResource("Guide d'installation")}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <div className="font-medium">API Documentation</div>
                        <div className="text-sm text-muted-foreground">PDF - 1.8 MB</div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDownloadResource("API Documentation")}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <div className="font-medium">Templates CSV</div>
                        <div className="text-sm text-muted-foreground">ZIP - 45 KB</div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDownloadResource("Templates CSV")}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Lightbulb className="w-5 h-5 text-yellow-600" />
                    <span>Ressources Complémentaires</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <div className="font-medium">Webinaires mensuels</div>
                        <div className="text-sm text-muted-foreground">Sessions live avec nos experts</div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          toast({
                            title: "Redirection",
                            description: "Accès aux webinaires en cours...",
                          });
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <div className="font-medium">Forum communauté</div>
                        <div className="text-sm text-muted-foreground">Échangez avec d'autres utilisateurs</div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          toast({
                            title: "Forum ouvert",
                            description: "Redirection vers le forum communauté...",
                          });
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <div className="font-medium">Support technique</div>
                        <div className="text-sm text-muted-foreground">Assistance personnalisée 24/7</div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          toast({
                            title: "Support contacté",
                            description: "Redirection vers le support technique...",
                          });
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Start Section */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-green-800 dark:text-green-200">
                  <Play className="w-5 h-5" />
                  <span>Démarrage Rapide</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-green-700 dark:text-green-300">
                  Nouveau sur SMDiagFix ? Suivez ces étapes pour être opérationnel en 15 minutes :
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant="ghost"
                    className="text-center p-4 bg-white dark:bg-green-900 rounded-lg h-auto hover:bg-green-50 dark:hover:bg-green-800 transition-colors"
                    onClick={() => handleWatchVideo("intro-video", "Vidéo d'introduction Smart GMAO DiagFix")}
                  >
                    <div>
                      <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center mx-auto mb-2">1</div>
                      <div className="font-medium">Regarder l'intro (5 min)</div>
                    </div>
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-center p-4 bg-white dark:bg-green-900 rounded-lg h-auto hover:bg-green-50 dark:hover:bg-green-800 transition-colors"
                    onClick={() => {
                      toast({
                        title: "Diagnostic démarré",
                        description: "Redirection vers l'interface de diagnostic...",
                      });
                      window.location.href = "/";
                    }}
                  >
                    <div>
                      <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center mx-auto mb-2">2</div>
                      <div className="font-medium">Premier diagnostic (5 min)</div>
                    </div>
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-center p-4 bg-white dark:bg-green-900 rounded-lg h-auto hover:bg-green-50 dark:hover:bg-green-800 transition-colors"
                    onClick={() => {
                      toast({
                        title: "GMAO ouvert",
                        description: "Redirection vers le tableau de bord GMAO...",
                      });
                      window.location.href = "/gmao-dashboard";
                    }}
                  >
                    <div>
                      <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center mx-auto mb-2">3</div>
                      <div className="font-medium">Explorer les fonctionnalités (5 min)</div>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal pour les guides détaillés */}
        <Dialog open={isGuideModalOpen} onOpenChange={setIsGuideModalOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                {selectedGuide && (
                  <>
                    <selectedGuide.icon className="w-5 h-5" />
                    <span>{selectedGuide.title}</span>
                    <Badge variant={selectedGuide.difficulty === "Débutant" ? "secondary" : selectedGuide.difficulty === "Intermédiaire" ? "outline" : "destructive"}>
                      {selectedGuide.difficulty}
                    </Badge>
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              {selectedGuide && (
                <div className="space-y-6 p-4">
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {selectedGuide.duration}
                    </span>
                    <span className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      {selectedGuide.difficulty}
                    </span>
                  </div>
                  
                  <p className="text-lg">{selectedGuide.description}</p>
                  
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Contenu du guide :</h3>
                    {selectedGuide.content.map((item, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                        <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium mt-0.5">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p>{item}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex space-x-3 pt-4">
                    <Button 
                      onClick={() => {
                        toast({
                          title: "Guide démarré",
                          description: `Début du guide: ${selectedGuide.title}`,
                        });
                        setIsGuideModalOpen(false);
                      }}
                      className="flex-1"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Commencer ce guide
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        toast({
                          title: "Guide téléchargé",
                          description: "PDF téléchargé avec succès",
                        });
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger PDF
                    </Button>
                  </div>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Modal pour les vidéos */}
        <Dialog open={isVideoModalOpen} onOpenChange={setIsVideoModalOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                {selectedVideo && (
                  <>
                    <Video className="w-5 h-5" />
                    <span>{selectedVideo.title}</span>
                    <Badge variant="secondary">{selectedVideo.category}</Badge>
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              {selectedVideo && (
                <div className="space-y-6 p-4">
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {selectedVideo.duration}
                    </span>
                    <span className="flex items-center">
                      <Badge variant="outline">{selectedVideo.category}</Badge>
                    </span>
                  </div>
                  
                  {/* Placeholder vidéo simulé */}
                  <div className="aspect-video bg-gradient-to-br from-primary/10 to-primary/20 rounded-lg flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="text-6xl">{selectedVideo.thumbnail}</div>
                      <div>
                        <h3 className="text-xl font-semibold">{selectedVideo.title}</h3>
                        <p className="text-muted-foreground">{selectedVideo.description}</p>
                      </div>
                      <Button 
                        size="lg"
                        onClick={() => {
                          toast({
                            title: "Lecture vidéo",
                            description: `Lecture de: ${selectedVideo.title}`,
                          });
                        }}
                      >
                        <Play className="w-5 h-5 mr-2" />
                        Lancer la vidéo
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Description :</h3>
                    <p className="text-muted-foreground">{selectedVideo.description}</p>
                    
                    <h3 className="text-lg font-semibold">Dans cette vidéo, vous apprendrez :</h3>
                    <ul className="space-y-2">
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Les concepts fondamentaux de la fonctionnalité</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Une démonstration pratique étape par étape</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Les meilleures pratiques et conseils d'experts</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span>Comment éviter les erreurs courantes</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
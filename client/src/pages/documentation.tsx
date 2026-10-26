import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
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
import { ModernNavigation } from "@/components/modern-navigation";

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

  // ⚠️ `handleDownloadResource` annonçait « Téléchargement démarré » puis
  // n'effectuait qu'un `console.log` — son propre commentaire disait
  // « Simulation du téléchargement ». Trois documents étaient proposés avec
  // leur taille au dixième de méga-octet (« PDF - 2.5 MB »), ce qui donnait
  // toute l'apparence de fichiers existants. Aucun n'existe.
  //
  // Un bouton qui affirme agir sans agir est pire qu'un bouton absent :
  // l'utilisateur attend, cherche dans ses téléchargements, puis met en doute
  // le reste de l'application. La section Ressources ne propose donc plus que
  // ce qui est réellement joignable.

  // ═══════════════════════════════════════════════════════════════════
  // CE QUI A CHANGÉ DANS CETTE PAGE, ET POURQUOI
  // ═══════════════════════════════════════════════════════════════════
  // Les guides décrivaient un produit qui n'existe plus : « Smart Diagnostic »,
  // « Smart GMAO », « SmartDiagFix », une « interface moderne avec
  // glassmorphisme » retirée depuis, de la « gamification » dont les six tables
  // ne sont ni lues ni écrites, et une « période d'essai gratuite de 14 jours »
  // qui ne correspond à aucun réglage de la plateforme.
  //
  // Une documentation fausse coûte plus cher qu'une documentation absente :
  // l'utilisateur qui suit une procédure inexistante conclut que le produit est
  // cassé, pas que le guide est périmé.
  //
  // Les guides ci-dessous décrivent les modules RÉELS, nommés comme la page
  // d'accueil les nomme, et disent explicitement ce qui n'est pas encore en
  // place plutôt que de le passer sous silence.
  //
  // `duration` est un temps de LECTURE estimé, assumé comme tel — pas une
  // mesure.
  const guides: GuideSection[] = [
    {
      id: "getting-started",
      title: "Premiers pas",
      description: "Se connecter, comprendre son rôle, et trouver son chemin dans la plateforme.",
      duration: "10 min",
      difficulty: "Débutant",
      icon: Play,
      content: [
        "Se connecter avec les identifiants fournis par l'administrateur de votre organisation",
        "Changer son mot de passe à la première connexion : l'écran s'impose tant que ce n'est pas fait",
        "Comprendre son rôle — propriétaire, administrateur, directeur technique, responsable maintenance, planificateur, achats, chef d'équipe ou technicien — car il détermine les écrans accessibles",
        "Parcourir les sept modules depuis la page d'accueil et ouvrir celui qui correspond à votre travail",
        "Repérer la distinction entre une donnée mesurée et une donnée absente : la plateforme affiche « — » quand elle ne sait pas, et ne comble jamais un vide par une estimation",
        "Savoir que chaque organisation ne voit que ses propres données : équipements, interventions, stock et documents sont cloisonnés"
      ]
    },
    {
      id: "gmao-complete",
      title: "GMAO — le quotidien du service",
      description: "Parc, ordres de travail, maintenance préventive et pièces détachées.",
      duration: "25 min",
      difficulty: "Débutant",
      icon: Factory,
      content: [
        "Déclarer un équipement : repère, type, criticité, zone et date de mise en service",
        "Créer un ordre de travail correctif, préventif ou d'urgence, et le rattacher à un équipement",
        "Suivre un ordre de travail de l'attente à la clôture, en renseignant les dates réelles de début et de fin",
        "Pourquoi ces deux dates comptent : ce sont elles, et elles seules, qui permettent de calculer le MTBF, le MTTR et la durée moyenne d'intervention. Un ordre clos sans dates ne produit aucun indicateur",
        "Créer un plan de maintenance préventive, lui associer des équipements et une périodicité",
        "Clôturer un ordre préventif fait avancer l'échéance du plan d'une période, calculée depuis l'échéance PRÉVUE et non depuis la date de réalisation : un retard ne décale donc pas tout le calendrier à chaque cycle",
        "Gérer les pièces détachées : référence, stock courant, stock minimum et délai d'approvisionnement",
        "Les pièces déclarées sur un ordre de travail sont déduites du stock à sa clôture, avec le mouvement de sortie correspondant — le point de commande se déclenche donc tout seul",
        "Une clôture est rejouable sans dommage : un ordre déjà clos ne consomme pas une seconde fois, et une sortie qui rendrait le stock négatif est refusée plutôt que forcée",
        "L'équipement revient en service à la clôture du dernier ordre qui l'immobilisait"
      ]
    },
    {
      id: "diagnostic-advanced",
      title: "Diagnostic",
      description: "Obtenir des causes probables, et savoir d'où vient chacune.",
      duration: "15 min",
      difficulty: "Intermédiaire",
      icon: Brain,
      content: [
        "Décrire un symptôme observé sur un équipement du parc",
        "Lire les causes probables classées, chacune accompagnée de SA SOURCE : règle de maintenance, cas passé de votre organisation, ou assistance par modèle de langage",
        "Pourquoi la source est affichée : une règle métier et une suggestion générée par un modèle n'ont pas la même valeur de preuve, et c'est à vous d'en juger",
        "Consulter les cas similaires déjà rencontrés sur votre parc",
        "Transformer un diagnostic retenu en ordre de travail",
        "Enrichir la base de cas en documentant l'issue réelle de l'intervention : c'est ce retour qui rend les diagnostics suivants pertinents"
      ]
    },
    {
      id: "supervision-sante",
      title: "Supervision et santé des équipements",
      description: "Lire l'état d'une machine à partir de ses capteurs, et savoir ce que l'indicateur mesure vraiment.",
      duration: "20 min",
      difficulty: "Intermédiaire",
      icon: Wrench,
      content: [
        "Consulter l'état de santé d'un équipement et le détail de ses capteurs",
        "Comprendre la méthode : chaque capteur est comparé à SON PROPRE historique, pas à un seuil universel. Une chaudière à 9 bar et une presse à 185 bar sont toutes deux normales dans leur régime",
        "Lire l'écart en nombre d'écarts-types : au-delà de 2, la grandeur est sous surveillance ; au-delà de 3, il s'agit d'une anomalie",
        "Reconnaître l'état « non évalué » : il signifie qu'il n'y a pas assez de relevés pour établir une référence. Ce n'est PAS un équipement sain, c'est un équipement sur lequel la plateforme ne se prononce pas",
        "Ce que cette méthode détecte : un CHANGEMENT par rapport au régime habituel",
        "Ce qu'elle ne détecte pas : une machine dégradée depuis toujours, dont le mauvais état constitue sa propre référence. Seuls des seuils réglés par un ingénieur répondent à cette question",
        "Régler un seuil d'alarme par machine et par grandeur, depuis « Régler les seuils » sur la fiche de santé — c'est ce qui comble la limite ci-dessus : un seuil voit une valeur dangereuse même stable",
        "Indiquer le SENS du franchissement : pour une pression, un débit ou un niveau, c'est la CHUTE qui alarme, et le niveau critique est donc plus bas que le niveau d'alerte",
        "Lire l'étiquette « seuil » à côté d'un capteur : elle signale que l'état vient d'une limite réglée, et non de la comparaison à l'historique",
        "Une grandeur sans seuil réglé reste surveillée statistiquement : retirer un seuil ne rétablit aucune constante, cela repasse simplement à l'autre méthode"
      ]
    },
    {
      id: "analytics",
      title: "Analyses et rapports",
      description: "Indicateurs de parc, suivi budgétaire, exports pour vos comités.",
      duration: "15 min",
      difficulty: "Intermédiaire",
      icon: BarChart,
      content: [
        "Lire les indicateurs de parc : MTBF, MTTR, part du préventif, taux de complétion",
        "Comprendre pourquoi un indicateur affiche « — » : il n'est pas calculable en l'état. Le MTBF, par exemple, exige au moins deux pannes datées pour qu'un intervalle existe",
        "Suivre les enveloppes budgétaires de l'exercice : alloué, dépensé, engagé, disponible",
        "Exporter en PDF ou en tableur pour un comité ou un audit",
        "Savoir ce qui n'est pas mesuré aujourd'hui, et que la plateforme ne prétend donc pas afficher : le temps d'arrêt de production, et la satisfaction des utilisateurs",
        "⚠️ À savoir : le TRS (OEE) se saisit manuellement, car il dépend de données de production que la GMAO ne possède pas"
      ]
    },
    {
      id: "data-import",
      title: "Importer vos données existantes",
      description: "Reprendre un parc et un historique déjà constitués.",
      duration: "20 min",
      difficulty: "Avancé",
      icon: Upload,
      content: [
        "Préparer un fichier tableur par type de donnée : équipements, interventions, pièces",
        "Vérifier les colonnes obligatoires : un équipement exige au minimum un repère unique, un nom et un type",
        "Attention aux repères d'équipement : ils doivent être uniques sur toute l'instance, pas seulement dans votre organisation. Préfixer par un code site évite les collisions",
        "Lancer l'import, puis contrôler le compte-rendu ligne à ligne avant de considérer la reprise comme faite",
        "Reprendre l'historique d'interventions avec les dates réelles de début et de fin, faute de quoi aucun indicateur de fiabilité ne pourra être calculé sur le passé"
      ]
    },
    {
      id: "administration",
      title: "Administration et sécurité",
      description: "Comptes, rôles, traçabilité et permis de travail.",
      duration: "20 min",
      difficulty: "Avancé",
      icon: Settings,
      content: [
        "Créer un compte et lui attribuer un rôle parmi ceux du référentiel de la plateforme",
        "Comprendre la hiérarchie des rôles et ce que chacun ouvre comme écrans",
        "Attribuer les droits de validation : niveau d'habilitation, et montant maximal approuvable pour les achats",
        "Consulter le journal d'audit : qui a fait quoi, quand",
        "Configurer l'identité de votre organisation — raison sociale, adresse, logo — qui apparaîtra sur les documents générés",
        "Régler les seuils d'approbation des achats",
        "Délivrer un permis de travail avant une intervention à risque"
      ]
    }
  ];

  // ⚠️ Cette liste contenait SIX tutoriels vidéo — « Introduction à Maintrix
  // 5:30 », « Réaliser un diagnostic complet 12:45 », « Fonctionnalités IA
  // avancées 18:20 »… — avec des durées à la seconde près et des vignettes
  // vides. Aucune de ces vidéos n'existe : le lecteur s'ouvrait sur du vide.
  //
  // Des durées aussi précises inspirent confiance précisément parce qu'elles
  // semblent relevées sur un fichier réel. C'est ce qui rend ce genre
  // d'invention coûteux : l'utilisateur clique, ne trouve rien, et doute
  // ensuite du reste de la documentation.
  //
  // La liste reste vide tant qu'aucune vidéo n'est produite. L'onglet le dit.
  const videoTutorials: VideoTutorial[] = [];

  // ⚠️ La FAQ avançait des chiffres que personne ne pouvait vérifier :
  // « précision de 85-95 % » des modèles, « 20-40 % de réduction des temps de
  // diagnostic », « 15-25 % d'amélioration de l'efficacité », « opérationnels
  // en 2-4 heures ». Aucun n'est mesuré ; ils venaient d'une plaquette
  // commerciale.
  //
  // Devant un responsable maintenance, un chiffre invérifiable coûte plus cher
  // qu'il ne rapporte : une seule question suffit à rendre tout le reste
  // suspect. Les réponses ci-dessous décrivent ce que la plateforme fait, et
  // disent franchement ce qu'elle ne fait pas encore.
  const faqs: FAQ[] = [
    {
      id: "what-is-maintrix",
      question: "Qu'est-ce que Maintrix ?",
      answer: "Une plateforme de gestion de maintenance (GMAO) et de supervision industrielle. Elle tient le parc d'équipements, les ordres de travail, la maintenance préventive et le stock de pièces, et exploite les relevés de capteurs pour signaler les dérives. Une aide au diagnostic propose des causes probables à partir de règles de maintenance, de cas passés et, en complément, d'un modèle de langage.",
      category: "Général"
    },
    {
      id: "fiabilite-diagnostic",
      question: "Quelle confiance accorder aux causes proposées par le diagnostic ?",
      answer: "Chaque cause est affichée AVEC sa source : règle de maintenance, cas déjà rencontré sur votre parc, ou suggestion d'un modèle de langage. Ces trois origines n'ont pas la même valeur de preuve, et c'est pourquoi la plateforme ne les confond pas et ne publie aucun taux de réussite global : un tel chiffre dépendrait de votre parc, de vos données et de vos modes de défaillance, et ne serait donc pas transposable. Le diagnostic est une aide au raisonnement, pas un verdict.",
      category: "Diagnostic"
    },
    {
      id: "indicateurs-tirets",
      question: "Pourquoi certains indicateurs affichent-ils « — » plutôt qu'une valeur ?",
      answer: "Parce qu'ils ne sont pas calculables en l'état. Le MTBF exige au moins deux pannes datées pour qu'un intervalle existe ; un point de commande exige assez de sorties de stock pour que la variabilité ait un sens. Plutôt que de combler ces vides par une valeur par défaut, la plateforme dit qu'elle ne sait pas. Un indicateur inventé se propage dans les décisions et ne se rattrape jamais.",
      category: "Indicateurs"
    },
    {
      id: "cloisonnement",
      question: "Les données de mon organisation sont-elles séparées de celles des autres ?",
      answer: "Oui. Chaque organisation possède son propre espace : équipements, interventions, stock, documents et configuration sont filtrés par organisation à la lecture comme à l'écriture. Les échanges avec le serveur passent par HTTPS. Pour les modalités d'hébergement et de conservation applicables à votre contrat, adressez-vous à votre interlocuteur Techlearn.",
      category: "Sécurité"
    },
    {
      id: "seuils-capteurs",
      question: "Comment la plateforme décide-t-elle qu'un capteur est en anomalie ?",
      answer: "Elle compare la période récente au régime habituel du capteur lui-même, et exprime l'écart en nombre d'écarts-types. Au-delà de 2, la grandeur passe sous surveillance ; au-delà de 3, elle est signalée comme anomalie. Cette méthode ne demande aucun paramétrage et fonctionne quelle que soit l'unité. Sa limite est connue : elle détecte un changement, pas un dépassement — une machine dégradée depuis toujours paraîtra normale. Les seuils absolus réglés par machine ne sont pas encore paramétrables.",
      category: "Supervision"
    },
    {
      id: "offline-usage",
      question: "Peut-on utiliser Maintrix hors connexion ?",
      answer: "Non. La plateforme est une application web : toutes les fonctions nécessitent une connexion au serveur. Pour une intervention en zone non couverte, prévoyez d'imprimer l'ordre de travail et de saisir le compte rendu au retour.",
      category: "Technique"
    },
    {
      id: "equipment-types",
      question: "Quels types d'équipements peut-on gérer ?",
      answer: "Le type d'équipement est un champ libre : vous déclarez vos machines telles que vous les nommez — moteurs, pompes, convoyeurs, compresseurs, presses, groupes froid, transformateurs. Les calculs de fiabilité et de supervision ne dépendent pas du type, mais des données saisies : interventions datées et relevés de capteurs.",
      category: "Équipements"
    },
    {
      id: "data-import-format",
      question: "Quels formats puis-je importer ?",
      answer: "Les fichiers tableur, CSV et Excel. Les colonnes obligatoires d'un équipement sont son repère, son nom et son type. Attention : les repères d'équipement doivent être uniques sur toute l'instance et pas seulement dans votre organisation — préfixer par un code site évite les collisions avec un autre client.",
      category: "Données"
    },
    {
      id: "mobile-access",
      question: "L'interface fonctionne-t-elle sur tablette et téléphone ?",
      answer: "L'interface s'adapte aux écrans étroits et reste consultable sur tablette. La saisie sur téléphone, en revanche, n'a pas fait l'objet d'une optimisation spécifique : pour un usage terrain intensif, la tablette est plus confortable.",
      category: "Mobile"
    },
    {
      id: "integration-erp",
      question: "Peut-on connecter Maintrix à notre ERP ?",
      answer: "Pas de connecteur prêt à l'emploi aujourd'hui. Les reprises se font par import de fichiers tableur. Si une interface avec votre système est nécessaire, c'est un sujet à aborder avec votre interlocuteur Techlearn avant de vous engager.",
      category: "Intégration"
    },
    {
      id: "par-ou-commencer",
      question: "Par où commencer avec un parc vide ?",
      answer: "Dans cet ordre : déclarez vos équipements avec leur criticité, puis reprenez l'historique des interventions passées avec leurs dates réelles de début et de fin. Ce sont ces dates qui rendent les indicateurs de fiabilité calculables dès le premier jour. Les plans préventifs et le stock viennent ensuite. Tant que rien n'est saisi, les écrans affichent « — » : c'est le comportement attendu, pas un dysfonctionnement.",
      category: "Général"
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

  const videoCategories = ["all"];
  // Catégories dérivées des questions réellement présentes : une liste écrite à
  // la main finit par proposer des filtres qui ne renvoient rien.
  const faqCategories = ["all", ...Array.from(new Set(faqs.map((f) => f.category)))];

  return (
    <div className="min-h-screen bg-paper-deep from-background via-background to-muted">
      <ModernNavigation />
      
      {/* Hero Section */}
      <div className="bg-paper-deep from-primary/5 via-primary/10 to-primary/5 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
              <BookOpen className="w-4 h-4" />
              <span>Centre de Documentation</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              Documentation et formation
            </h1>
            {/* ⚠️ Le sous-titre annonçait « tutoriels vidéo et support
                technique », deux choses qui n'existent pas. Le titre, lui, ne
                correspondait pas à celui de la carte d'accueil, qui dit
                « Documentation et formation ». */}
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Guides d'utilisation, questions fréquentes et points de départ pour prendre
              Maintrix en main.
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
                  <Card key={guide.id} className="border-0 transition-all duration-300 cursor-pointer">
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
                            <CheckCircle className="w-3 h-3 text-etat-nominal-texte" />
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
            {/* Sans cet état, l'onglet rendait une grille vide : un écran blanc
                se lit comme une panne, pas comme une absence de contenu. */}
            {videoTutorials.length === 0 && (
              <div className="rounded-lg border border-rule bg-paper p-8 text-center">
                <Video className="w-8 h-8 mx-auto text-ink-mute mb-3" />
                <p className="text-ink-soft">
                  Aucun tutoriel vidéo n'est disponible pour le moment.
                </p>
                <p className="mt-2 text-sm text-ink-mute max-w-xl mx-auto">
                  Cet onglet listait auparavant six vidéos qui n'avaient jamais été
                  produites. Les guides écrits couvrent les mêmes sujets et sont, eux,
                  à jour.
                </p>
              </div>
            )}

            {videoTutorials.length > 0 && (
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
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVideos.map((video) => (
                <Card key={video.id} className="border-0 transition-all duration-300 cursor-pointer">
                  <CardContent className="p-6">
                    <div className="aspect-video bg-paper-deep from-primary/10 to-primary/20 rounded-lg mb-4 flex items-center justify-center text-4xl">
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
            {/* ⚠️ Cet onglet proposait trois documents au téléchargement —
                « Guide d'installation PDF - 2.5 MB », « API Documentation
                PDF - 1.8 MB », « Templates CSV ZIP - 45 KB » — dont aucun
                n'existe : le bouton affichait « Téléchargement démarré » puis
                écrivait une ligne dans la console. Il annonçait aussi des
                « webinaires mensuels », un « forum communauté » et un
                « support technique 24/7 », tous trois sans destination.

                Une taille de fichier au dixième de méga-octet est ce qui rend
                l'invention crédible — et donc coûteuse quand l'utilisateur
                découvre le vide. Ne sont conservés ici que des chemins
                réellement joignables. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-0">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-ink-mute" />
                    <span>Aller droit au but</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { libelle: "Parc et ordres de travail", detail: "Le module GMAO", href: "/gmao" },
                      { libelle: "Santé des équipements", detail: "Capteurs et dérives", href: "/predictive-insights" },
                      { libelle: "Analyses et rapports", detail: "Indicateurs et budget", href: "/advanced-reporting" },
                      { libelle: "Comptes et rôles", detail: "Administration", href: "/user-management" },
                    ].map((lien) => (
                      <a
                        key={lien.href}
                        href={lien.href}
                        className="flex items-center justify-between p-3 border border-rule rounded-lg hover:bg-paper transition-colors"
                      >
                        <div>
                          <div className="font-medium text-ink">{lien.libelle}</div>
                          <div className="text-sm text-ink-soft">{lien.detail}</div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-ink-mute" />
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Lightbulb className="w-5 h-5 text-ink-mute" />
                    <span>Obtenir de l'aide</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-ink-soft">
                  <p>
                    Pour une question sur votre organisation, vos accès ou vos données,
                    adressez-vous à l'administrateur de votre organisation : c'est lui qui
                    crée les comptes, attribue les rôles et règle les seuils d'approbation.
                  </p>
                  <p>
                    Pour signaler un comportement anormal, notez l'écran concerné, ce que
                    vous attendiez et ce que vous avez obtenu. Un relevé précis vaut mieux
                    qu'une capture : il permet de reproduire le problème.
                  </p>
                  <p className="text-ink-mute">
                    Il n'existe pas aujourd'hui de forum, de webinaire ni de permanence
                    téléphonique. Cette page le dira le jour où ce sera le cas.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-0 bg-paper-deep">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-ink">
                  <Play className="w-5 h-5" />
                  <span>Par où commencer, sur un parc vide</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* ⚠️ Ce bloc promettait d'être « opérationnel en 15 minutes »,
                    et sa première étape ouvrait une vidéo inexistante. Sa
                    deuxième annonçait « redirection vers le diagnostic » et
                    renvoyait en réalité vers l'accueil. L'ordre ci-dessous est
                    celui qui rend les indicateurs calculables le plus tôt. */}
                <p className="text-sm text-ink-soft">
                  L'ordre compte : les indicateurs de fiabilité ne se calculent qu'à partir
                  d'interventions datées. Reprendre l'historique avant tout le reste, c'est
                  disposer d'un MTBF dès le premier jour plutôt que dans six mois.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { n: 1, titre: "Déclarer les équipements", detail: "Repère, type, criticité, zone", href: "/gmao" },
                    { n: 2, titre: "Reprendre l'historique", detail: "Interventions passées, avec leurs dates réelles", href: "/data-import" },
                    { n: 3, titre: "Créer les plans préventifs", detail: "Gammes et périodicités", href: "/gmao" },
                  ].map((etape) => (
                    <a
                      key={etape.n}
                      href={etape.href}
                      className="text-center p-4 bg-white border border-rule rounded-lg hover:bg-paper transition-colors"
                    >
                      <div className="w-8 h-8 bg-signal text-white rounded-full flex items-center justify-center mx-auto mb-2">
                        {etape.n}
                      </div>
                      <div className="font-medium text-ink">{etape.titre}</div>
                      <div className="text-sm text-ink-soft mt-1">{etape.detail}</div>
                    </a>
                  ))}
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
              <DialogDescription>
                {selectedGuide?.description}
              </DialogDescription>
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
                        if (selectedGuide) {
                          toast({
                            title: "Guide démarré",
                            description: `Début du guide: ${selectedGuide.title}`,
                          });
                          setIsGuideModalOpen(false);
                          // Redirection vers la page appropriée selon le guide
                          if (selectedGuide.id === "getting-started") {
                            window.location.href = "/";
                          } else if (selectedGuide.id === "diagnostic-advanced") {
                            window.location.href = "/smart-diagnostic";
                          } else if (selectedGuide.id === "gmao-complete") {
                            window.location.href = "/gmao-dashboard";
                          } else if (selectedGuide.id === "data-import") {
                            window.location.href = "/data-import";
                          } else if (selectedGuide.id === "analytics") {
                            window.location.href = "/advanced-reporting";
                          } else {
                            window.location.href = "/";
                          }
                        }
                      }}
                      className="flex-1"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Commencer ce guide
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        if (selectedGuide) {
                          toast({
                            title: "Téléchargement démarré",
                            description: `Téléchargement du PDF: ${selectedGuide.title}`,
                          });
                          // Simulation du téléchargement d'un PDF
                          const element = document.createElement('a');
                          const file = new Blob([`Guide: ${selectedGuide.title}\n\n${selectedGuide.description}\n\nContenu:\n${selectedGuide.content.map((item, index) => `${index + 1}. ${item}`).join('\n')}`], {type: 'text/plain'});
                          element.href = URL.createObjectURL(file);
                          element.download = `Guide-${selectedGuide.id}.txt`;
                          document.body.appendChild(element);
                          element.click();
                          document.body.removeChild(element);
                        }
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {/* Le libellé disait « PDF » alors que le fichier produit
                          est un .txt. Le téléchargement, lui, fonctionne. */}
                      Télécharger le guide (.txt)
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
              <DialogDescription>
                {selectedVideo?.description}
              </DialogDescription>
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
                  <div className="aspect-video bg-paper-deep from-primary/10 to-primary/20 rounded-lg flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="text-6xl">{selectedVideo.thumbnail}</div>
                      <div>
                        <h3 className="text-xl font-semibold">{selectedVideo.title}</h3>
                        <p className="text-muted-foreground">{selectedVideo.description}</p>
                      </div>
                      <Button 
                        size="lg"
                        onClick={() => {
                          if (selectedVideo) {
                            toast({
                              title: "Lecture vidéo",
                              description: `Lecture de: ${selectedVideo.title}`,
                            });
                            // Simulation de la lecture d'une vidéo
                            setTimeout(() => {
                              toast({
                                title: "Vidéo terminée",
                                description: "Merci d'avoir regardé cette vidéo !",
                              });
                            }, 3000);
                          }
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
                        <CheckCircle className="w-4 h-4 text-etat-nominal-texte" />
                        <span>Les concepts fondamentaux de la fonctionnalité</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-etat-nominal-texte" />
                        <span>Une démonstration pratique étape par étape</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-etat-nominal-texte" />
                        <span>Les meilleures pratiques et conseils d'experts</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-etat-nominal-texte" />
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
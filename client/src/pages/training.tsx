import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  GraduationCap, 
  Play, 
  CheckCircle, 
  Clock, 
  Users, 
  Award,
  BookOpen,
  Video,
  Target,
  Zap,
  Brain,
  Wrench,
  Settings,
  BarChart,
  Factory,
  ArrowLeft
} from "lucide-react";
import { ModernNavigation } from "@/components/modern-navigation";
import { ModuleViewer } from "@/components/training/ModuleViewer";
import { getModuleContent } from "@/data/trainingContent";

/**
 * ⚠️ `progress: number` et `completed: boolean` ont été RETIRÉS de ce type.
 *
 * Les douze modules portaient une progression écrite en dur — 100 %, 85 %,
 * 60 %, 20 %… — identique pour tout le monde. Chaque utilisateur se voyait
 * annoncer qu'il avait terminé « Introduction Maintrix » sans avoir rien
 * ouvert, et qu'il lui restait 40 % du module GMAO qu'il n'avait jamais
 * commencé.
 *
 * Rien ne persiste cette progression : `handleModuleComplete` se contentait
 * d'un `console.log` et d'un message de félicitations, et les tables
 * `user_skill_progress` et `user_challenge_progress` ne sont ni lues ni
 * écrites. Il n'y avait donc aucune progression à afficher, seulement des
 * nombres choisis pour faire joli.
 *
 * La progression RÉELLE existe à l'intérieur d'un module — `ModuleViewer` la
 * calcule sur les leçons effectivement parcourues — mais elle ne survit pas à
 * un rechargement. Tant que ce n'est pas persisté, la liste n'en montre pas.
 */
interface TrainingModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  difficulty: "Débutant" | "Intermédiaire" | "Avancé";
  lessons: number;
  category: string;
  icon: any;
  skills: string[];
}

interface LearningPath {
  id: string;
  title: string;
  description: string;
  modules: string[];
  totalDuration: string;
  targetAudience: string;
  icon: any;
}

export default function Training() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  // ⚠️ `userProgress` a été RETIRÉ : six chiffres inventés dans un `useState`
  // (« 4/12 modules terminés », « 15h », « 2 certificats », « 7j de série »),
  // identiques pour tous et remis à ces valeurs à chaque rechargement.
  //
  // `handleContinueModule` et `handleStartCertification` ont disparu avec eux :
  // le premier distinguait « reprendre » de « commencer » sur la foi d'une
  // progression fictive, le second n'exécutait qu'un `console.log` sous le
  // titre « Certification commencée ».
  const { toast } = useToast();

  const handleStartModule = (moduleId: string, title: string) => {
    setSelectedModule(moduleId);
  };

  const handleModuleComplete = (moduleId: string) => {
    setSelectedModule(null);
    // Pas de « Félicitations pour avoir terminé ce module » : rien n'est
    // enregistré, et le module sera de nouveau vierge au prochain passage.
    toast({
      title: "Module parcouru",
      description: "Votre avancement n'est pas conservé d'une session à l'autre.",
    });
  };

  const handleExitModule = () => {
    setSelectedModule(null);
  };

  /**
   * ⚠️ Cette liste comptait DOUZE modules. Seuls six avaient un contenu dans
   * `trainingContent.ts` : les six autres — « Fondamentaux de Smart
   * Diagnostic », « IA et Machine Learning », « Procédures de Maintenance »,
   * « Gestion des Données »… — ouvraient sur « Module non trouvé ».
   *
   * Un septième, « Gamification et Compétences », décrivait un système de
   * points, de récompenses et de classement dont les six tables
   * (`maintenance_skills`, `user_skill_progress`, `maintenance_achievements`,
   * `user_achievements`, `skill_challenges`, `user_challenge_progress`) ne
   * sont ni lues ni écrites par le serveur. Il enseignait une fonctionnalité
   * qui n'existe pas.
   *
   * Restent cinq modules, qui correspondent aux modules RÉELS de la
   * plateforme et dont le contenu a été réécrit en conséquence.
   */
  const trainingModules: TrainingModule[] = [
    {
      id: "intro-basics",
      title: "Prise en main",
      description: "Se connecter, comprendre son rôle, et lire ce que la plateforme affiche — y compris quand elle affiche « — ».",
      duration: "25 min",
      difficulty: "Débutant",
      lessons: 2,
      category: "Introduction",
      icon: Play,
      skills: ["Connexion et rôles", "Lecture des indicateurs", "Cloisonnement des données"]
    },
    {
      id: "gmao-complete",
      title: "GMAO au quotidien",
      description: "Parc, ordres de travail, préventif et pièces détachées : le cycle complet, de la demande à la clôture.",
      duration: "40 min",
      difficulty: "Débutant",
      lessons: 3,
      category: "GMAO",
      icon: Factory,
      skills: ["Registre du parc", "Ordres de travail", "Plans préventifs", "Stock et point de commande"]
    },
    {
      id: "diagnostic-ai-advanced",
      title: "Diagnostic assisté",
      description: "Obtenir des causes probables, et savoir d'où vient chacune — règle, cas passé ou modèle de langage.",
      duration: "25 min",
      difficulty: "Intermédiaire",
      lessons: 2,
      category: "Diagnostic",
      icon: Brain,
      skills: ["Description d'un symptôme", "Lecture des sources", "Conversion en ordre de travail"]
    },
    {
      id: "iot-monitoring",
      title: "Supervision et santé des équipements",
      description: "Lire l'état d'une machine à partir de ses capteurs, et régler les seuils que la statistique ne peut pas deviner.",
      duration: "35 min",
      difficulty: "Intermédiaire",
      lessons: 3,
      category: "Supervision",
      icon: Zap,
      skills: ["Écart au régime habituel", "Seuils réglés par machine", "Sens du franchissement", "État « non évalué »"]
    },
    {
      id: "security-advanced",
      title: "Administration et sécurité",
      description: "Comptes, rôles, habilitations de validation et traçabilité des approbations.",
      duration: "30 min",
      difficulty: "Avancé",
      lessons: 2,
      category: "Administration",
      icon: Settings,
      skills: ["Rôles et niveaux", "Droits de validation", "Journal d'audit", "Permis de travail"]
    },
  ];

  /**
   * ⚠️ Les quatre parcours désignaient des modules par des identifiants qui
   * n'existent pas — `diagnostic-fundamentals`, `gmao-integration`,
   * `maintenance-procedures`, `advanced-ai`, `data-management`,
   * `system-administration`. `getModulesByPath` renvoyait donc des listes
   * vides ou amputées, et les durées annoncées (« 6h 00min », « 14h 45min »)
   * ne correspondaient à aucune somme réelle.
   *
   * Les durées sont désormais CALCULÉES à partir des modules du parcours :
   * elles ne peuvent plus diverger de leur contenu.
   */
  const dureeParcours = (ids: string[]): string => {
    const minutes = ids
      .map((id) => trainingModules.find((m) => m.id === id))
      .filter((m): m is TrainingModule => m !== undefined)
      .reduce((somme, m) => somme + (parseInt(m.duration, 10) || 0), 0);
    const h = Math.floor(minutes / 60);
    const min = minutes % 60;
    return h > 0 ? `${h} h ${String(min).padStart(2, "0")}` : `${min} min`;
  };

  const parcours: Array<Omit<LearningPath, "totalDuration">> = [
    {
      id: "technician-path",
      title: "Parcours technicien",
      description: "Recevoir une intervention, la réaliser, la clôturer proprement.",
      modules: ["intro-basics", "gmao-complete", "diagnostic-ai-advanced"],
      targetAudience: "Techniciens de maintenance, opérateurs",
      icon: Wrench
    },
    {
      id: "manager-path",
      title: "Parcours responsable maintenance",
      description: "Piloter le préventif, lire les indicateurs, régler les seuils d'alarme.",
      modules: ["intro-basics", "gmao-complete", "iot-monitoring"],
      targetAudience: "Responsables maintenance, planificateurs",
      icon: Brain
    },
    {
      id: "administrator-path",
      title: "Parcours administrateur",
      description: "Comptes, rôles, habilitations de validation et traçabilité.",
      modules: ["intro-basics", "security-advanced"],
      targetAudience: "Administrateurs, responsables informatiques",
      icon: Settings
    },
    {
      id: "complete-path",
      title: "Parcours complet",
      description: "Les cinq modules, dans l'ordre.",
      modules: trainingModules.map((m) => m.id),
      targetAudience: "Responsables, formateurs",
      icon: Award
    }
  ];

  const learningPaths: LearningPath[] = parcours.map((p) => ({
    ...p,
    totalDuration: dureeParcours(p.modules),
  }));

  const getModulesByPath = (pathId: string) => {
    const path = learningPaths.find(p => p.id === pathId);
    if (!path) return [];
    return trainingModules.filter(module => path.modules.includes(module.id));
  };

  // Si un module est sélectionné, afficher le ModuleViewer
  if (selectedModule) {
    return (
      <div className="min-h-screen bg-paper-deep from-background via-background to-muted">
        <ModernNavigation />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={handleExitModule}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour aux modules</span>
            </Button>
          </div>
          <ModuleViewer
            moduleId={selectedModule}
            onComplete={handleModuleComplete}
            onExit={handleExitModule}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-deep from-background via-background to-muted">
      <ModernNavigation />
      
      {/* Hero Section */}
      <div className="bg-paper-deep from-primary/5 via-primary/10 to-primary/5 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
              <GraduationCap className="w-4 h-4" />
              <span>Centre de Formation</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              Formation Maintrix
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Parcours d'apprentissage personnalisés pour maîtriser toutes les fonctionnalités
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ⚠️ Ce bandeau affichait quatre chiffres entièrement inventés, posés
            dans un `useState` : « 4/12 modules terminés », « 15h
            d'apprentissage », « 2 certificats obtenus », « 7j de série ». Les
            mêmes pour tout le monde, dès la première visite, et remis à ces
            valeurs à chaque rechargement.

            Rien ne les mesure : aucune table ne suit la progression, et
            `handleModuleComplete` ne faisait qu'un `console.log`. Annoncer à
            un technicien qu'il détient deux certificats qu'il n'a jamais
            passés est la pire chose qu'un outil de formation puisse faire —
            c'est précisément ce qu'on lui demandera de prouver.

            Ce que l'on peut dire sans rien mesurer, c'est ce que la formation
            CONTIENT. */}
        <Card className="border-0 bg-paper-deep">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-ink mb-1">{trainingModules.length}</div>
                <div className="text-sm text-ink-soft">Modules disponibles</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-ink mb-1">
                  {trainingModules.reduce((s, m) => s + m.lessons, 0)}
                </div>
                <div className="text-sm text-ink-soft">Leçons au total</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-ink-mute mb-1">—</div>
                <div className="text-sm text-ink-soft">Votre progression</div>
                <div className="text-xs text-ink-mute mt-1">
                  pas encore conservée d'une session à l'autre
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Learning Paths */}
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Parcours d'Apprentissage</h2>
              <p className="text-muted-foreground">Choisissez le parcours adapté à votre rôle</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {learningPaths.map((path) => {
              const IconComponent = path.icon;
              const pathModules = getModulesByPath(path.id);

              return (
                <Card 
                  key={path.id} 
                  className={`border-0 transition-all duration-300 cursor-pointer ${ selectedPath === path.id ? 'ring-2 ring-primary' : '' }`}
                  onClick={() => setSelectedPath(selectedPath === path.id ? null : path.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <IconComponent className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{path.title}</CardTitle>
                          <div className="text-sm text-muted-foreground">{path.targetAudience}</div>
                        </div>
                      </div>
                      <Badge variant="outline">{path.totalDuration}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">{path.description}</p>
                    {/* La barre affichait une progression dérivée de drapeaux
                        `completed` écrits en dur. Reste le décompte réel des
                        modules de ce parcours, qui ne prétend rien sur ce que
                        l'utilisateur a fait. */}
                    <div className="text-sm text-ink-soft">
                      {pathModules.length} module{pathModules.length > 1 ? "s" : ""}
                    </div>
                    <Button className="w-full mt-4" variant={selectedPath === path.id ? "default" : "outline"}>
                      {selectedPath === path.id ? "Masquer les détails" : "Voir les détails"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Selected Path Details */}
          {selectedPath && (
            <Card className="border-0 bg-paper-deep">
              <CardHeader>
                <CardTitle className="text-etat-encours-texte">
                  Modules du {learningPaths.find(p => p.id === selectedPath)?.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getModulesByPath(selectedPath).map((module) => {
                    const IconComponent = module.icon;
                    return (
                      <div key={module.id} className="bg-white p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <IconComponent className="w-5 h-5 text-primary" />
                          <span className="font-medium">{module.title}</span>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">{module.duration}</div>
                        <div className="flex items-center justify-between">
                          <Badge variant={module.difficulty === "Débutant" ? "secondary" : module.difficulty === "Intermédiaire" ? "outline" : "destructive"} className="text-xs">
                            {module.difficulty}
                          </Badge>
                          <span className="text-xs text-ink-mute">{module.lessons} leçons</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* All Training Modules */}
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Video className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Tous les Modules</h2>
              <p className="text-muted-foreground">Explorez tous les modules de formation disponibles</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trainingModules.map((module) => {
              const IconComponent = module.icon;
              return (
                <Card key={module.id} className="border-0 transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <IconComponent className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{module.title}</CardTitle>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant={module.difficulty === "Débutant" ? "secondary" : module.difficulty === "Intermédiaire" ? "outline" : "destructive"}>
                              {module.difficulty}
                            </Badge>
                            <span className="text-sm text-muted-foreground flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {module.duration}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">{module.description}</p>

                    {/* La barre « Progression » affichait une valeur écrite en
                        dur, identique pour tous. Rien ne persiste l'avancement
                        d'un module d'une session à l'autre : il n'y a donc
                        aucune progression à montrer ici. */}
                    <div className="space-y-3">
                      <div className="text-sm">
                        <div className="font-medium mb-1">Compétences acquises :</div>
                        <div className="flex flex-wrap gap-1">
                          {module.skills.slice(0, 2).map((skill, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                          {module.skills.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{module.skills.length - 2}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{module.lessons} leçons</span>
                        <span>{module.category}</span>
                      </div>
                    </div>

                    <Button
                      className="w-full mt-4"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleStartModule(module.id, module.title);
                      }}
                    >
                      {(
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Ouvrir
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* ⚠️ CETTE SECTION PROPOSAIT TROIS CERTIFICATIONS QUI N'EXISTENT PAS.
            « Technicien Certifié » (6h), « Expert IA » (8h), « Administrateur »
            (10h), chacune avec un bouton « Commencer » qui n'exécutait qu'un
            `console.log` suivi d'un message « Certification commencée ».
            Aucune épreuve, aucun jury, aucune attestation, rien en base.

            Le bandeau de la page annonçait en outre « 2 certificats obtenus »
            à tout nouvel arrivant.

            C'est le mensonge le plus coûteux de toute la plateforme, parce
            qu'une certification se présente à un employeur ou à un donneur
            d'ordre. Un technicien qui s'en prévaut sur la foi de cet écran se
            retrouve à en répondre.

            La section dit désormais ce qui existe réellement : des modules de
            formation, et une évaluation de fin de module interne au lecteur. */}
        <Card className="border-0 bg-paper-deep">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-ink">
              <Award className="w-6 h-6 text-ink-mute" />
              <span>Attestations</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-ink-soft">
            <p>
              Maintrix ne délivre aucune certification. Chaque module se termine par
              une évaluation dont le résultat s'affiche immédiatement, et qui sert à
              vous situer — elle n'est ni conservée ni opposable à un tiers.
            </p>
            <p className="text-ink-mute">
              Si un parcours certifiant vous est nécessaire, c'est un sujet à aborder
              avec votre interlocuteur Techlearn : il suppose un référentiel de
              compétences, une épreuve et un jury, aucun des trois n'existant à ce jour
              dans la plateforme.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
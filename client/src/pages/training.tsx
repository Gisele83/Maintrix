import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  BarChart
} from "lucide-react";
import { Header } from "@/components/header";

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  duration: string;
  difficulty: "Débutant" | "Intermédiaire" | "Avancé";
  progress: number;
  completed: boolean;
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
  const [userProgress, setUserProgress] = useState({
    totalModules: 12,
    completedModules: 4,
    totalHours: 40,
    completedHours: 15,
    certificates: 2,
    streak: 7
  });

  const trainingModules: TrainingModule[] = [
    {
      id: "intro-basics",
      title: "Introduction et Bases",
      description: "Découvrez SMDiagFix et ses fonctionnalités essentielles",
      duration: "45 min",
      difficulty: "Débutant",
      progress: 100,
      completed: true,
      lessons: 5,
      category: "Introduction",
      icon: Play,
      skills: ["Navigation interface", "Première connexion", "Vue d'ensemble"]
    },
    {
      id: "diagnostic-fundamentals",
      title: "Fondamentaux du Diagnostic",
      description: "Maîtrisez les techniques de diagnostic de base",
      duration: "2h 30min",
      difficulty: "Débutant",
      progress: 100,
      completed: true,
      lessons: 8,
      category: "Diagnostic",
      icon: Target,
      skills: ["Analyse symptômes", "Identification problèmes", "Solutions recommandées"]
    },
    {
      id: "advanced-ai",
      title: "IA et Machine Learning",
      description: "Exploitez la puissance de l'intelligence artificielle",
      duration: "3h 15min",
      difficulty: "Intermédiaire",
      progress: 60,
      completed: false,
      lessons: 10,
      category: "IA/ML",
      icon: Brain,
      skills: ["Modèles ML", "Interprétation résultats", "Optimisation précision"]
    },
    {
      id: "maintenance-procedures",
      title: "Procédures de Maintenance",
      description: "Planification et exécution des interventions",
      duration: "2h 45min",
      difficulty: "Intermédiaire",
      progress: 75,
      completed: false,
      lessons: 9,
      category: "Maintenance",
      icon: Wrench,
      skills: ["Planification", "Sécurité", "Documentation", "Suivi qualité"]
    },
    {
      id: "data-management",
      title: "Gestion des Données",
      description: "Import, export et analyse de vos données",
      duration: "2h 00min",
      difficulty: "Intermédiaire",
      progress: 30,
      completed: false,
      lessons: 7,
      category: "Données",
      icon: BarChart,
      skills: ["Import CSV", "Validation données", "Nettoyage", "Analyse trends"]
    },
    {
      id: "system-administration",
      title: "Administration Système",
      description: "Configuration avancée et gestion utilisateurs",
      duration: "3h 30min",
      difficulty: "Avancé",
      progress: 0,
      completed: false,
      lessons: 12,
      category: "Administration",
      icon: Settings,
      skills: ["Gestion utilisateurs", "Paramétrage", "Sécurité", "Maintenance système"]
    }
  ];

  const learningPaths: LearningPath[] = [
    {
      id: "technician-path",
      title: "Parcours Technicien",
      description: "Formation complète pour les techniciens de maintenance",
      modules: ["intro-basics", "diagnostic-fundamentals", "maintenance-procedures"],
      totalDuration: "6h 00min",
      targetAudience: "Techniciens de maintenance, opérateurs",
      icon: Wrench
    },
    {
      id: "analyst-path",
      title: "Parcours Analyste",
      description: "Spécialisation en analyse de données et IA",
      modules: ["intro-basics", "advanced-ai", "data-management"],
      totalDuration: "6h 30min",
      targetAudience: "Ingénieurs, analystes de données",
      icon: Brain
    },
    {
      id: "administrator-path",
      title: "Parcours Administrateur",
      description: "Formation complète pour la gestion système",
      modules: ["intro-basics", "data-management", "system-administration"],
      totalDuration: "6h 15min",
      targetAudience: "Administrateurs système, responsables IT",
      icon: Settings
    },
    {
      id: "complete-path",
      title: "Parcours Complet",
      description: "Maîtrise complète de tous les aspects de SMDiagFix",
      modules: ["intro-basics", "diagnostic-fundamentals", "advanced-ai", "maintenance-procedures", "data-management", "system-administration"],
      totalDuration: "14h 45min",
      targetAudience: "Responsables maintenance, formateurs",
      icon: Award
    }
  ];

  const getModulesByPath = (pathId: string) => {
    const path = learningPaths.find(p => p.id === pathId);
    if (!path) return [];
    return trainingModules.filter(module => path.modules.includes(module.id));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <Header />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
              <GraduationCap className="w-4 h-4" />
              <span>Centre de Formation</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight">
              Formation SMDiagFix
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Parcours d'apprentissage personnalisés pour maîtriser toutes les fonctionnalités
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Progress Dashboard */}
        <Card className="border-0 shadow-xl bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {userProgress.completedModules}/{userProgress.totalModules}
                </div>
                <div className="text-sm text-muted-foreground">Modules terminés</div>
                <Progress value={(userProgress.completedModules / userProgress.totalModules) * 100} className="mt-2" />
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {userProgress.completedHours}h
                </div>
                <div className="text-sm text-muted-foreground">Temps d'apprentissage</div>
                <Progress value={(userProgress.completedHours / userProgress.totalHours) * 100} className="mt-2" />
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600 mb-1">
                  {userProgress.certificates}
                </div>
                <div className="text-sm text-muted-foreground">Certificats obtenus</div>
                <div className="flex justify-center mt-2">
                  <Award className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  {userProgress.streak}j
                </div>
                <div className="text-sm text-muted-foreground">Série d'apprentissage</div>
                <div className="flex justify-center mt-2">
                  <Zap className="w-6 h-6 text-orange-600" />
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
              const completedInPath = pathModules.filter(m => m.completed).length;
              const progressPercent = pathModules.length > 0 ? (completedInPath / pathModules.length) * 100 : 0;

              return (
                <Card 
                  key={path.id} 
                  className={`border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer ${
                    selectedPath === path.id ? 'ring-2 ring-primary' : ''
                  }`}
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
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{completedInPath}/{pathModules.length} modules terminés</span>
                        <span>{Math.round(progressPercent)}%</span>
                      </div>
                      <Progress value={progressPercent} />
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
            <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
              <CardHeader>
                <CardTitle className="text-blue-800 dark:text-blue-200">
                  Modules du {learningPaths.find(p => p.id === selectedPath)?.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getModulesByPath(selectedPath).map((module) => {
                    const IconComponent = module.icon;
                    return (
                      <div key={module.id} className="bg-white dark:bg-blue-900 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <IconComponent className="w-5 h-5 text-primary" />
                          <span className="font-medium">{module.title}</span>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">{module.duration}</div>
                        <Progress value={module.progress} className="mb-2" />
                        <div className="flex items-center justify-between">
                          <Badge variant={module.difficulty === "Débutant" ? "secondary" : module.difficulty === "Intermédiaire" ? "outline" : "destructive"} className="text-xs">
                            {module.difficulty}
                          </Badge>
                          {module.completed && <CheckCircle className="w-4 h-4 text-green-600" />}
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
                <Card key={module.id} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300">
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
                      {module.completed && <CheckCircle className="w-5 h-5 text-green-600" />}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">{module.description}</p>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>Progression</span>
                          <span>{module.progress}%</span>
                        </div>
                        <Progress value={module.progress} />
                      </div>

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

                    <Button className="w-full mt-4" variant={module.completed ? "outline" : "default"}>
                      {module.completed ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Revoir
                        </>
                      ) : module.progress > 0 ? (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Continuer
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Commencer
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Certification Section */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-yellow-800 dark:text-yellow-200">
              <Award className="w-6 h-6" />
              <span>Certifications Disponibles</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-white dark:bg-yellow-900 rounded-lg">
                <Award className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Technicien Certifié</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Maîtrise des fonctionnalités de diagnostic et maintenance
                </p>
                <Badge variant="secondary">6h de formation</Badge>
              </div>
              <div className="text-center p-4 bg-white dark:bg-yellow-900 rounded-lg">
                <Award className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Expert IA</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Spécialisation en intelligence artificielle et analyse
                </p>
                <Badge variant="secondary">8h de formation</Badge>
              </div>
              <div className="text-center p-4 bg-white dark:bg-yellow-900 rounded-lg">
                <Award className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Administrateur</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Administration système et gestion avancée
                </p>
                <Badge variant="secondary">10h de formation</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
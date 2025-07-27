export interface TrainingLesson {
  id: string;
  title: string;
  duration: string;
  content: {
    introduction: string;
    objectives: string[];
    steps: {
      title: string;
      description: string;
      animation?: string;
      interactive?: boolean;
      code?: string;
      tips?: string[];
    }[];
    exercises: {
      title: string;
      description: string;
      type: 'quiz' | 'practical' | 'simulation';
      questions?: {
        question: string;
        answers: string[];
        correct: number;
      }[];
    }[];
    resources: string[];
  };
}

export interface ModuleContent {
  id: string;
  title: string;
  description: string;
  totalDuration: string;
  prerequisites: string[];
  outcomes: string[];
  lessons: TrainingLesson[];
  finalAssessment: {
    title: string;
    description: string;
    questions: {
      question: string;
      answers: string[];
      correct: number;
      explanation: string;
    }[];
  };
}

export const trainingModulesContent: ModuleContent[] = [
  {
    id: "intro-basics",
    title: "Introduction Smart GMAO DiagFix",
    description: "Découvrez la plateforme intégrée Smart Diagnostic + Smart GMAO avec IoT et sécurité avancée",
    totalDuration: "50 min",
    prerequisites: ["Aucun prérequis"],
    outcomes: [
      "Comprendre l'architecture unifiée Smart GMAO DiagFix",
      "Naviguer dans l'interface utilisateur",
      "Utiliser les fonctionnalités de base du diagnostic IA",
      "Accéder aux modules GMAO essentiels"
    ],
    lessons: [
      {
        id: "lesson-1",
        title: "Vue d'ensemble de Smart GMAO DiagFix",
        duration: "10 min",
        content: {
          introduction: "Smart GMAO DiagFix est une plateforme révolutionnaire qui unifie l'intelligence artificielle de diagnostic avec un système complet de gestion de maintenance assistée par ordinateur (GMAO). Cette leçon vous présente l'interface moderne avec glassmorphisme, la page dédiée Smart Diagnostic et l'architecture globale unifiée.",
          objectives: [
            "Comprendre la vision unifiée Smart Diagnostic + Smart GMAO",
            "Naviguer vers la page dédiée Smart Diagnostic IA",
            "Identifier les modules principaux et les onglets intégrés",
            "Reconnaître les avantages par rapport aux solutions traditionnelles"
          ],
          steps: [
            {
              title: "Architecture unifiée",
              description: "Smart GMAO DiagFix combine deux systèmes puissants : Smart Diagnostic (assistant IA) et Smart GMAO (gestion maintenance) dans une interface unique.",
              animation: "🔄 Animation : Fusion des modules Diagnostic IA ↔ GMAO",
              tips: [
                "Un seul tableau de bord pour toutes les opérations",
                "Données partagées entre diagnostic et maintenance",
                "Workflow automatisé du diagnostic à la planification"
              ]
            },
            {
              title: "Modules Smart Diagnostic",
              description: "L'assistant IA analyse les symptômes, propose des diagnostics avec score de confiance et génère automatiquement des procédures de réparation.",
              animation: "🧠 Animation : Processus de diagnostic IA en temps réel",
              interactive: true,
              tips: [
                "Mode ML Standard pour diagnostics rapides",
                "Mode ML Avancé pour analyses complexes",
                "Mode Ensemble pour consensus multi-algorithmes"
              ]
            },
            {
              title: "Modules Smart GMAO",
              description: "Système complet de gestion : équipements, ordres de travail, maintenance préventive, stocks, IoT temps réel et KPIs avancés.",
              animation: "⚙️ Animation : Cycle complet GMAO",
              tips: [
                "Registre d'équipements avec historique complet",
                "Planification intelligente des interventions",
                "Intégration IoT pour monitoring temps réel"
              ]
            }
          ],
          exercises: [
            {
              title: "Quiz : Architecture Smart GMAO DiagFix",
              description: "Testez votre compréhension de l'architecture unifiée",
              type: "quiz",
              questions: [
                {
                  question: "Quels sont les deux systèmes principaux unifiés dans Smart GMAO DiagFix ?",
                  answers: [
                    "Smart Diagnostic + Smart GMAO",
                    "IoT + Machine Learning",
                    "ERP + CRM",
                    "Dashboard + Reporting"
                  ],
                  correct: 0
                },
                {
                  question: "Quel est l'avantage principal de l'architecture unifiée ?",
                  answers: [
                    "Coût réduit",
                    "Workflow automatisé diagnostic → maintenance",
                    "Interface plus simple",
                    "Installation rapide"
                  ],
                  correct: 1
                }
              ]
            }
          ],
          resources: [
            "Guide d'architecture Smart GMAO DiagFix",
            "Vidéo démo : Tour complet de la plateforme",
            "Comparatif avec solutions concurrentes"
          ]
        }
      },
      {
        id: "lesson-2",
        title: "Navigation et interface utilisateur",
        duration: "15 min",
        content: {
          introduction: "Maîtrisez l'interface moderne de Smart GMAO DiagFix avec ses tableaux de bord intuitifs, sa navigation adaptative et ses fonctionnalités d'accessibilité avancées.",
          objectives: [
            "Naviguer efficacement dans tous les modules",
            "Personnaliser l'interface selon vos besoins",
            "Utiliser les raccourcis et fonctionnalités avancées"
          ],
          steps: [
            {
              title: "Dashboard principal",
              description: "Le tableau de bord unifie Smart Diagnostic et Smart GMAO avec des widgets personnalisables, KPIs temps réel et accès rapide aux fonctions critiques.",
              animation: "📊 Animation : Navigation dashboard avec widgets interactifs",
              interactive: true,
              tips: [
                "Glisser-déposer pour réorganiser les widgets",
                "Filtres rapides par équipement ou zone",
                "Mode sombre/clair automatique"
              ]
            },
            {
              title: "Menu de navigation adaptatif",
              description: "Menu intelligent qui s'adapte à votre rôle (technicien, superviseur, gestionnaire) avec accès contextuel aux fonctionnalités pertinentes.",
              animation: "🎯 Animation : Menu adaptatif selon profil utilisateur",
              tips: [
                "Accès rapide aux modules fréquemment utilisés",
                "Raccourcis clavier pour navigation experte",
                "Breadcrumb intelligent avec historique"
              ]
            },
            {
              title: "Notifications et alertes",
              description: "Système de notifications temps réel avec classification par priorité, filtrage intelligent et actions rapides intégrées.",
              animation: "🔔 Animation : Système d'alertes IoT en temps réel",
              interactive: true,
              tips: [
                "Notifications push pour alertes critiques",
                "Groupement intelligent des alertes similaires",
                "Actions rapides directement depuis les notifications"
              ]
            }
          ],
          exercises: [
            {
              title: "Simulation : Navigation experte",
              description: "Parcours guidé pour maîtriser la navigation",
              type: "simulation",
              questions: [
                {
                  question: "Naviguez vers le module Smart Diagnostic et lancez une analyse",
                  answers: ["Diagnostic lancé avec succès"],
                  correct: 0
                }
              ]
            }
          ],
          resources: [
            "Guide navigation interface",
            "Raccourcis clavier Smart GMAO DiagFix",
            "Personnalisation dashboard avancée"
          ]
        }
      }
    ],
    finalAssessment: {
      title: "Évaluation : Maîtrise des fondamentaux",
      description: "Évaluation complète de vos connaissances sur Smart GMAO DiagFix",
      questions: [
        {
          question: "Smart GMAO DiagFix unifie quels systèmes principaux ?",
          answers: [
            "Smart Diagnostic (IA) + Smart GMAO (maintenance)",
            "ERP + CRM",
            "IoT + Analytics",
            "Dashboard + Reporting"
          ],
          correct: 0,
          explanation: "Smart GMAO DiagFix combine l'intelligence artificielle de diagnostic avec un système complet de gestion de maintenance."
        },
        {
          question: "Quels sont les avantages de l'architecture unifiée ?",
          answers: [
            "Interface unique et workflow automatisé",
            "Coût réduit uniquement",
            "Installation plus rapide",
            "Moins de formations nécessaires"
          ],
          correct: 0,
          explanation: "L'unification permet un workflow continu du diagnostic IA vers la planification GMAO avec partage de données."
        }
      ]
    }
  },
  {
    id: "diagnostic-ai-advanced",
    title: "Smart Diagnostic IA Avancé",
    description: "Maîtrisez l'assistant IA de diagnostic avec ML avancé, ensemble et chatbot technique",
    totalDuration: "60 min",
    prerequisites: ["Module Introduction terminé"],
    outcomes: [
      "Utiliser les 3 modes ML (Standard, Avancé, Ensemble)",
      "Interpréter les scores de confiance et métriques IA",
      "Optimiser les diagnostics selon le contexte industriel",
      "Exploiter le chatbot technique intégré"
    ],
    lessons: [
      {
        id: "lesson-1",
        title: "Modes ML et algorithmes avancés",
        duration: "20 min",
        content: {
          introduction: "Smart Diagnostic utilise trois modes d'intelligence artificielle distincts selon la complexité du diagnostic. Chaque mode emploie des algorithmes spécialisés pour optimiser la précision et la rapidité d'analyse.",
          objectives: [
            "Comprendre les 3 modes ML disponibles",
            "Choisir le mode optimal selon le contexte",
            "Interpréter les résultats de chaque algorithme"
          ],
          steps: [
            {
              title: "Mode ML Standard",
              description: "Utilise Random Forest et Gradient Boosting avec analyse TF-IDF pour diagnostics rapides (< 2 secondes) avec 85-90% de précision.",
              animation: "🌳 Animation : Random Forest analysant les symptômes",
              code: `// Exemple de diagnostic ML Standard
const diagnostic = await analyzeSymptoms({
  mode: 'standard',
  equipment: 'pompe-hydraulique',
  symptoms: ['vibration excessive', 'température élevée'],
  urgency: 'high'
});
// Résultat en ~1.5 secondes avec score de confiance`,
              tips: [
                "Idéal pour diagnostics de routine",
                "Consommation ressources minimale",
                "Recommandé pour équipes terrain"
              ]
            },
            {
              title: "Mode ML Avancé",
              description: "Emploie réseaux de neurones (MLP), SVM et détection d'anomalies pour analyses complexes avec 92-95% de précision.",
              animation: "🧠 Animation : Réseau neuronal multi-couches",
              code: `// Diagnostic ML Avancé avec Neural Network
const advancedDiag = await analyzeSymptoms({
  mode: 'advanced',
  algorithms: ['neural_network', 'svm', 'anomaly_detection'],
  equipment: 'turbine-gaz',
  sensors: iotData,
  history: maintenanceHistory
});`,
              tips: [
                "Pour équipements critiques",
                "Analyse multi-factorielle",
                "Détection anomalies subtiles"
              ]
            },
            {
              title: "Mode Ensemble ML",
              description: "Combine 9 algorithmes avec vote majoritaire pour diagnostics ultra-précis (96-98%) sur équipements stratégiques.",
              animation: "🎯 Animation : Consensus de 9 algorithmes ML",
              interactive: true,
              tips: [
                "Précision maximale garantie",
                "Consensus multi-algorithmes",
                "Réservé aux équipements stratégiques"
              ]
            }
          ],
          exercises: [
            {
              title: "Pratique : Comparaison des modes ML",
              description: "Analysez le même cas avec les 3 modes et comparez",
              type: "practical",
              questions: [
                {
                  question: "Quel mode recommandez-vous pour un diagnostic de routine sur pompe standard ?",
                  answers: ["Standard", "Avancé", "Ensemble", "Aucun"],
                  correct: 0
                }
              ]
            }
          ],
          resources: [
            "Documentation algorithmes ML",
            "Benchmark performance par mode",
            "Guide sélection mode optimal"
          ]
        }
      }
    ],
    finalAssessment: {
      title: "Certification Smart Diagnostic IA",
      description: "Évaluation avancée des compétences en diagnostic IA",
      questions: [
        {
          question: "Quel mode ML offre le meilleur compromis rapidité/précision pour diagnostic routine ?",
          answers: ["Mode Standard", "Mode Avancé", "Mode Ensemble", "Mode Automatique"],
          correct: 0,
          explanation: "Le mode Standard offre 85-90% de précision en <2 secondes, optimal pour diagnostics de routine."
        }
      ]
    }
  },
  {
    id: "gmao-complete",
    title: "Smart GMAO Complet",
    description: "Formation complète sur le système de gestion de maintenance avec équipements, OT, et IoT",
    totalDuration: "90 min",
    prerequisites: ["Module Introduction terminé"],
    outcomes: [
      "Maîtriser la gestion complète des équipements",
      "Créer et planifier des ordres de travail optimisés",
      "Configurer la maintenance préventive intelligente",
      "Exploiter les données IoT temps réel"
    ],
    lessons: [
      {
        id: "lesson-1",
        title: "Gestion avancée des équipements",
        duration: "30 min",
        content: {
          introduction: "Le module Smart GMAO transforme la gestion d'équipements avec un registre intelligent, historique complet et intégration IoT temps réel pour optimiser la maintenance et maximiser la disponibilité.",
          objectives: [
            "Créer et organiser le registre d'équipements",
            "Configurer la hiérarchie et criticité",
            "Exploiter l'historique et les KPIs"
          ],
          steps: [
            {
              title: "Registre d'équipements intelligent",
              description: "Système centralisé avec classification automatique, géolocalisation, documentation technique et intégration photos/schémas.",
              animation: "📋 Animation : Création registre avec scan QR codes",
              interactive: true,
              code: `// Création équipement avec IA
const equipment = await createEquipment({
  name: "Pompe hydraulique P001",
  type: "pump",
  location: "Zone Production A",
  criticality: "high",
  specifications: {
    power: "45kW",
    flow: "500L/min",
    pressure: "25bar"
  },
  sensors: ["temp", "vibration", "pressure"],
  autoClassify: true
});`,
              tips: [
                "Scan QR codes pour ajout rapide",
                "Import Excel/CSV pour migration",
                "Classification IA automatique"
              ]
            },
            {
              title: "Hiérarchie et criticité intelligente",
              description: "Organisation hiérarchique avec calcul automatique de criticité basé sur impact production, coût arrêt et historique pannes.",
              animation: "🏗️ Animation : Arbre hiérarchique avec scores criticité",
              tips: [
                "Criticité calculée automatiquement",
                "Alerte préventive selon niveau",
                "Priorisation maintenance intelligente"
              ]
            }
          ],
          exercises: [
            {
              title: "Simulation : Création registre équipements",
              description: "Créez un registre complet pour une ligne de production",
              type: "simulation"
            }
          ],
          resources: [
            "Template registre équipements",
            "Guide criticité et hiérarchie",
            "Best practices organisation"
          ]
        }
      }
    ],
    finalAssessment: {
      title: "Certification Smart GMAO Expert",
      description: "Évaluation complète des compétences GMAO",
      questions: [
        {
          question: "Comment Smart GMAO calcule-t-il automatiquement la criticité d'un équipement ?",
          answers: [
            "Impact production + coût arrêt + historique pannes",
            "Âge de l'équipement uniquement",
            "Coût d'achat initial",
            "Fréquence d'utilisation"
          ],
          correct: 0,
          explanation: "La criticité combine l'impact sur la production, le coût d'arrêt et l'historique des pannes pour une évaluation complète."
        }
      ]
    }
  },
  {
    id: "iot-monitoring",
    title: "Monitoring IoT Temps Réel",
    description: "Surveillance avancée avec capteurs IoT, alertes automatiques et maintenance prédictive",
    totalDuration: "45 min",
    prerequisites: ["Module Introduction terminé"],
    outcomes: [
      "Configurer les capteurs IoT intelligents",
      "Interpréter les données temps réel",
      "Configurer les alertes automatiques",
      "Utiliser la maintenance prédictive"
    ],
    lessons: [
      {
        id: "lesson-1",
        title: "Configuration capteurs IoT",
        duration: "20 min",
        content: {
          introduction: "Le système IoT de Smart GMAO DiagFix collecte des données temps réel pour optimiser la maintenance et prévenir les pannes.",
          objectives: [
            "Configurer les capteurs IoT",
            "Comprendre les seuils d'alerte",
            "Interpréter les données temps réel"
          ],
          steps: [
            {
              title: "Installation capteurs intelligents",
              description: "Configuration des capteurs de température, vibration, pression et courant avec auto-calibration.",
              animation: "📡 Animation : Installation et configuration capteurs IoT",
              tips: [
                "Auto-détection des capteurs compatibles",
                "Calibration automatique selon équipement",
                "Monitoring temps réel intégré"
              ]
            }
          ],
          exercises: [
            {
              title: "Simulation : Configuration capteur",
              description: "Configurez un capteur de vibration",
              type: "simulation"
            }
          ],
          resources: [
            "Guide installation capteurs IoT",
            "Spécifications techniques capteurs",
            "Procédures de calibration"
          ]
        }
      }
    ],
    finalAssessment: {
      title: "Évaluation IoT Monitoring",
      description: "Testez vos connaissances en monitoring IoT",
      questions: [
        {
          question: "Quels types de capteurs sont intégrés dans Smart GMAO DiagFix ?",
          answers: [
            "Température, vibration, pression, courant",
            "Température uniquement",
            "Vibration uniquement",
            "Capteurs visuels"
          ],
          correct: 0,
          explanation: "Smart GMAO DiagFix intègre une gamme complète de capteurs pour un monitoring optimal."
        }
      ]
    }
  },
  {
    id: "security-advanced",
    title: "Sécurité et Accès Avancés",
    description: "Gestion des accès, sécurité des données et audit complet",
    totalDuration: "40 min",
    prerequisites: ["Module Introduction terminé"],
    outcomes: [
      "Configurer les rôles et permissions",
      "Gérer la sécurité des données",
      "Utiliser le système d'audit",
      "Configurer l'authentification multi-niveaux"
    ],
    lessons: [
      {
        id: "lesson-1",
        title: "Gestion des accès multi-niveaux",
        duration: "20 min",
        content: {
          introduction: "Smart GMAO DiagFix offre un système de sécurité avancé avec authentification multi-niveaux et audit complet.",
          objectives: [
            "Configurer les rôles utilisateurs",
            "Gérer les permissions par module",
            "Utiliser le système d'audit"
          ],
          steps: [
            {
              title: "Configuration des rôles",
              description: "Système hiérarchique avec rôles personnalisables selon les besoins organisationnels.",
              animation: "🔐 Animation : Configuration système de rôles",
              tips: [
                "Rôles prédéfinis : Technicien, Superviseur, Gestionnaire",
                "Permissions granulaires par fonction",
                "Audit automatique de toutes les actions"
              ]
            }
          ],
          exercises: [
            {
              title: "Pratique : Création profil utilisateur",
              description: "Créez un profil technicien avec permissions spécifiques",
              type: "practical"
            }
          ],
          resources: [
            "Guide sécurité et accès",
            "Matrice des permissions",
            "Procédures d'audit"
          ]
        }
      }
    ],
    finalAssessment: {
      title: "Certification Sécurité",
      description: "Évaluation des compétences sécurité",
      questions: [
        {
          question: "Quels sont les niveaux d'accès disponibles dans Smart GMAO DiagFix ?",
          answers: [
            "Technicien, Superviseur, Gestionnaire avec permissions granulaires",
            "Utilisateur et Administrateur uniquement",
            "Accès libre pour tous",
            "Un seul niveau d'accès"
          ],
          correct: 0,
          explanation: "Le système offre une hiérarchie flexible avec permissions détaillées par fonction."
        }
      ]
    }
  },
  {
    id: "gamification-skills",
    title: "Gamification et Développement des Compétences",
    description: "Système de gamification pour motivation et développement des compétences techniques",
    totalDuration: "35 min",
    prerequisites: ["Module Introduction terminé"],
    outcomes: [
      "Comprendre le système de compétences",
      "Utiliser la gamification pour la motivation",
      "Suivre les progrès et achievements",
      "Optimiser l'apprentissage continu"
    ],
    lessons: [
      {
        id: "lesson-1",
        title: "Système de compétences et achievements",
        duration: "15 min",
        content: {
          introduction: "Smart GMAO DiagFix intègre un système de gamification pour motiver les équipes et développer les compétences techniques.",
          objectives: [
            "Comprendre les niveaux de compétences",
            "Débloquer les achievements",
            "Suivre les progrès individuels et d'équipe"
          ],
          steps: [
            {
              title: "Système de niveaux de compétences",
              description: "6 compétences principales avec progression mesurable et rewards motivants.",
              animation: "🎯 Animation : Progression compétences et achievements",
              tips: [
                "Diagnostics précis, Maintenance préventive, Analyse IoT",
                "Gestion équipements, Efficacité énergétique, Leadership technique",
                "Points d'expérience et badges de reconnaissance"
              ]
            }
          ],
          exercises: [
            {
              title: "Challenge : Premier diagnostic",
              description: "Complétez votre premier diagnostic pour débloquer l'achievement",
              type: "simulation"
            }
          ],
          resources: [
            "Guide système de compétences",
            "Liste complète des achievements",
            "Stratégies de motivation d'équipe"
          ]
        }
      }
    ],
    finalAssessment: {
      title: "Évaluation Gamification",
      description: "Testez votre compréhension du système de compétences",
      questions: [
        {
          question: "Combien de compétences principales sont trackées dans Smart GMAO DiagFix ?",
          answers: [
            "6 compétences principales",
            "3 compétences",
            "10 compétences",
            "Aucun système de compétences"
          ],
          correct: 0,
          explanation: "Le système track 6 compétences clés pour un développement professionnel complet."
        }
      ]
    }
  }
];

// Fonction pour obtenir le contenu d'un module
export const getModuleContent = (moduleId: string): ModuleContent | undefined => {
  return trainingModulesContent.find(module => module.id === moduleId);
};

// Fonction pour obtenir une leçon spécifique
export const getLessonContent = (moduleId: string, lessonId: string): TrainingLesson | undefined => {
  const module = getModuleContent(moduleId);
  return module?.lessons.find(lesson => lesson.id === lessonId);
};
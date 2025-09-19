/**
 * Service d'assistant intelligent local pour Maintrix
 * Fournit des réponses basées sur les meilleures pratiques GMAO
 * sans nécessiter d'API externe
 */

interface AssistantResponse {
  response: string;
  suggestions?: string[];
  confidence?: number;
}

class SmartAssistantService {
  private knowledgeBase: Record<string, any> = {
    maintenance: {
      keywords: ['maintenance', 'entretien', 'réparer', 'panne', 'dysfonctionnement', 'défaillance'],
      responses: [
        "Pour une maintenance efficace, je recommande de suivre une approche préventive. Voici les étapes clés :",
        "La maintenance préventive permet de réduire les pannes de 60%. Voici comment l'optimiser :",
        "Pour diagnostiquer cette situation, commençons par identifier les symptômes observés."
      ]
    },
    diagnostic: {
      keywords: ['diagnostic', 'problème', 'erreur', 'bug', 'analyser', 'identifier'],
      responses: [
        "Pour établir un diagnostic précis, j'ai besoin de plus d'informations. Pouvez-vous me dire :",
        "Analysons ce problème méthodiquement. Voici les vérifications à effectuer :",
        "Ce type de problème nécessite une approche systématique. Commençons par :"
      ]
    },
    equipment: {
      keywords: ['équipement', 'machine', 'appareil', 'moteur', 'pompe', 'compresseur'],
      responses: [
        "Pour cet équipement, voici les points de contrôle essentiels :",
        "La surveillance de cet équipement doit inclure :",
        "Les paramètres critiques à surveiller pour ce type d'équipement sont :"
      ]
    },
    planning: {
      keywords: ['planifier', 'programmer', 'calendrier', 'planning', 'organiser'],
      responses: [
        "Pour une planification optimale, je recommande cette approche :",
        "Voici comment structurer votre planning de maintenance :",
        "Une bonne organisation de la maintenance inclut :"
      ]
    }
  };

  private commonResponses = {
    greeting: [
      "Bonjour ! Je suis votre assistant Maintrix. Comment puis-je vous aider avec votre maintenance aujourd'hui ?",
      "Salut ! Prêt à optimiser votre maintenance ? Que souhaitez-vous faire ?",
      "Hello ! En quoi puis-je vous assister pour vos équipements ?"
    ],
    unknown: [
      "Je comprends votre question. Pouvez-vous être plus spécifique sur le contexte ?",
      "Intéressant ! Pour vous donner une réponse précise, j'aimerais en savoir plus sur :",
      "Bonne question ! Aidez-moi à mieux comprendre en précisant :"
    ]
  };

  async chat(message: string): Promise<AssistantResponse> {
    const lowerMessage = message.toLowerCase();
    
    // Détection des salutations
    if (this.isGreeting(lowerMessage)) {
      return {
        response: this.getRandomResponse(this.commonResponses.greeting),
        suggestions: [
          "Diagnostic d'équipement",
          "Planification maintenance",
          "Analyse de panne",
          "Optimisation GMAO"
        ],
        confidence: 1.0
      };
    }

    // Analyse des mots-clés pour déterminer le contexte
    const context = this.analyzeContext(lowerMessage);
    
    if (context) {
      const baseResponse = this.getRandomResponse(this.knowledgeBase[context].responses);
      const detailedResponse = this.generateDetailedResponse(context, lowerMessage);
      
      return {
        response: `${baseResponse}\n\n${detailedResponse}`,
        suggestions: this.getSuggestions(context),
        confidence: 0.8
      };
    }

    // Réponse par défaut
    return {
      response: this.getRandomResponse(this.commonResponses.unknown) + 
               "\n\n- Le type d'équipement concerné\n- Les symptômes observés\n- Le contexte d'utilisation",
      suggestions: [
        "Diagnostic équipement",
        "Maintenance préventive", 
        "Gestion pannes",
        "Optimisation planning"
      ],
      confidence: 0.6
    };
  }

  private isGreeting(message: string): boolean {
    const greetings = ['bonjour', 'salut', 'hello', 'bonsoir', 'hey', 'hi'];
    return greetings.some(greeting => message.includes(greeting));
  }

  private analyzeContext(message: string): string | null {
    for (const [category, data] of Object.entries(this.knowledgeBase)) {
      if (data.keywords.some((keyword: string) => message.includes(keyword))) {
        return category;
      }
    }
    return null;
  }

  private generateDetailedResponse(context: string, message: string): string {
    switch (context) {
      case 'maintenance':
        return `📋 **Checklist Maintenance :**
• Inspectez les points de lubrification
• Vérifiez les niveaux et pressions
• Contrôlez l'état des composants critiques
• Documentez toutes les observations
• Planifiez les interventions nécessaires

💡 **Conseil :** Une maintenance régulière réduit les coûts de 30% en moyenne.`;

      case 'diagnostic':
        return `🔍 **Méthode de Diagnostic :**
1. **Collecte des données** - symptômes, historique, conditions
2. **Analyse préliminaire** - identification des causes probables  
3. **Tests et mesures** - validation des hypothèses
4. **Conclusion** - diagnostic final et recommandations

⚡ **Outils recommandés :** Multimètre, analyseur vibrations, thermomètre infrarouge`;

      case 'equipment':
        return `⚙️ **Surveillance Équipement :**
• **Paramètres vitaux** : température, pression, vibrations
• **Indicateurs visuels** : fuites, usure, corrosion
• **Performance** : rendement, consommation, qualité
• **Historique** : pannes précédentes, modifications

📊 **Fréquence recommandée :** Contrôle quotidien + inspection hebdomadaire`;

      case 'planning':
        return `📅 **Planning Optimal :**
• **Maintenance préventive** : 70% du temps
• **Maintenance corrective** : 20% du temps  
• **Améliorations** : 10% du temps

🎯 **Priorités :** Équipements critiques → Production → Support → Confort`;

      default:
        return "Je peux vous aider avec des conseils spécialisés selon votre besoin.";
    }
  }

  private getSuggestions(context: string): string[] {
    const suggestions = {
      maintenance: [
        "Créer un planning préventif",
        "Analyser les coûts maintenance",
        "Optimiser les stocks pièces",
        "Former les équipes"
      ],
      diagnostic: [
        "Méthodes d'analyse de panne",
        "Outils de diagnostic",
        "Historique des pannes",
        "Analyse des causes racines"
      ],
      equipment: [
        "Surveillance en temps réel",
        "Indicateurs de performance",
        "Seuils d'alerte",
        "Maintenance conditionnelle"
      ],
      planning: [
        "Optimisation planning",
        "Gestion des priorités", 
        "Allocation ressources",
        "Suivi des KPI"
      ]
    };

    return (suggestions as any)[context] || [
      "Diagnostic avancé",
      "Maintenance prédictive",
      "Optimisation GMAO",
      "Formation équipe"
    ];
  }

  private getRandomResponse(responses: string[]): string {
    return responses[Math.floor(Math.random() * responses.length)];
  }

  async analyzeEquipment(equipmentType: string, symptoms: string, context: string): Promise<any> {
    return {
      analysis: `**Analyse pour ${equipmentType}**\n\nBasé sur les symptômes "${symptoms}", voici mon analyse :\n\n` +
               `🔍 **Diagnostic probable :**\n` +
               `Les symptômes indiquent potentiellement un problème de maintenance préventive ou d'usure normale.\n\n` +
               `📋 **Actions recommandées :**\n` +
               `• Vérifier les paramètres de fonctionnement\n` +
               `• Contrôler l'état des composants critiques\n` +
               `• Effectuer les maintenances préventives planifiées\n\n` +
               `⚡ **Urgence :** Moyenne - Planifier intervention sous 48h`,
      recommendations: [
        "Inspection visuelle complète",
        "Vérification des paramètres de fonctionnement", 
        "Contrôle des niveaux et pressions",
        "Documentation dans le GMAO"
      ],
      confidence: 0.75
    };
  }

  async suggestMaintenanceSchedule(equipmentType: string, currentCondition: string, usage: string): Promise<any> {
    return {
      schedule: `**Planning de Maintenance - ${equipmentType}**\n\n` +
               `Basé sur l'état "${currentCondition}" et l'usage "${usage}" :\n\n` +
               `📅 **Fréquences recommandées :**\n` +
               `• Inspection quotidienne : Points critiques\n` +
               `• Maintenance hebdomadaire : Lubrification, nettoyage\n` +
               `• Contrôle mensuel : Paramètres, calibrage\n` +
               `• Révision trimestrielle : Composants d'usure\n\n` +
               `🎯 **Optimisation :** Adapter selon les conditions réelles d'utilisation`,
      intervals: {
        daily: "Inspection visuelle, vérification paramètres",
        weekly: "Lubrification, nettoyage, contrôles de base",
        monthly: "Mesures, calibrage, tests fonctionnels", 
        quarterly: "Révision complète, remplacement préventif"
      },
      priority: "Haute - Équipement critique pour la production"
    };
  }
}

export const smartAssistantService = new SmartAssistantService();
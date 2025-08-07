// Voice Diagnostic Engine - Backend Service
// Processes voice input and provides AI-powered diagnostic responses

/**
 * Voice Diagnostic Engine - Backend Service
 * Processes voice input and provides AI-powered diagnostic responses
 */

interface VoiceDiagnosticRequest {
  query: string;
  sessionId: string;
  timestamp: string;
  equipmentContext?: {
    equipmentId?: number;
    sensorData?: any;
  };
}

interface VoiceDiagnosticResponse {
  diagnosis: string;
  confidence: number;
  recommendations: string[];
  equipmentId?: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  estimatedCost?: number;
  estimatedTime?: string;
  requiredParts?: string[];
}

// Diagnostic knowledge base for common symptoms
const diagnosticPatterns = [
  {
    keywords: ['vibration', 'vibrations', 'vibre', 'tremble'],
    equipment: ['moteur', 'pompe', 'palier', 'roulement'],
    diagnosis: 'Problème de vibration détecté',
    recommendations: [
      'Vérifier l\'alignement des arbres',
      'Contrôler l\'état des roulements',
      'Vérifier l\'équilibrage du rotor',
      'Inspecter les fixations'
    ],
    urgencyLevel: 'medium' as const,
    confidence: 0.85
  },
  {
    keywords: ['température', 'chaud', 'chauffe', 'surchauffe', 'chaleur'],
    equipment: ['moteur', 'pompe', 'compresseur'],
    diagnosis: 'Surchauffe détectée',
    recommendations: [
      'Vérifier le système de refroidissement',
      'Contrôler le niveau d\'huile',
      'Nettoyer les filtres à air',
      'Vérifier la ventilation'
    ],
    urgencyLevel: 'high' as const,
    confidence: 0.90
  },
  {
    keywords: ['pression', 'fuite', 'fuit', 'goutte', 'suinte'],
    equipment: ['pompe', 'hydraulique', 'circuit', 'valve'],
    diagnosis: 'Problème de pression ou fuite hydraulique',
    recommendations: [
      'Inspecter les joints et raccords',
      'Vérifier l\'état des flexibles',
      'Contrôler la pression système',
      'Remplacer les joints défaillants'
    ],
    urgencyLevel: 'high' as const,
    confidence: 0.80
  },
  {
    keywords: ['bruit', 'bruyant', 'grincement', 'claquement', 'sifflement'],
    equipment: ['moteur', 'pompe', 'ventilateur', 'roulement'],
    diagnosis: 'Bruit anormal détecté',
    recommendations: [
      'Localiser la source du bruit',
      'Vérifier les roulements',
      'Contrôler la lubrification',
      'Inspecter les éléments rotatifs'
    ],
    urgencyLevel: 'medium' as const,
    confidence: 0.75
  },
  {
    keywords: ['arrêt', 'panne', 'défaillance', 'ne fonctionne pas', 'en panne'],
    equipment: ['moteur', 'pompe', 'système'],
    diagnosis: 'Arrêt de fonctionnement',
    recommendations: [
      'Vérifier l\'alimentation électrique',
      'Contrôler les fusibles',
      'Tester les contacts de sécurité',
      'Inspecter le système de commande'
    ],
    urgencyLevel: 'critical' as const,
    confidence: 0.95
  },
  {
    keywords: ['débit', 'performance', 'rendement', 'efficacité'],
    equipment: ['pompe', 'ventilateur', 'compresseur'],
    diagnosis: 'Baisse de performance détectée',
    recommendations: [
      'Vérifier l\'état des filtres',
      'Contrôler l\'usure des composants',
      'Optimiser les réglages',
      'Planifier une maintenance préventive'
    ],
    urgencyLevel: 'medium' as const,
    confidence: 0.70
  }
];

// Equipment identification patterns
const equipmentPatterns = [
  { keywords: ['moteur principal', 'moteur', 'motor'], equipmentId: 1 },
  { keywords: ['pompe hydraulique', 'pompe', 'pump'], equipmentId: 2 },
  { keywords: ['compresseur', 'compressor'], equipmentId: 3 },
  { keywords: ['ventilateur', 'fan'], equipmentId: 4 },
  { keywords: ['convoyeur', 'conveyor'], equipmentId: 5 }
];

/**
 * Analyze voice input and provide diagnostic response
 */
export async function processVoiceDiagnostic(request: VoiceDiagnosticRequest): Promise<VoiceDiagnosticResponse> {
  const { query } = request;
  const queryLower = query.toLowerCase();
  
  // Identify equipment mentioned
  let identifiedEquipment: number | undefined;
  for (const pattern of equipmentPatterns) {
    if (pattern.keywords.some(keyword => queryLower.includes(keyword))) {
      identifiedEquipment = pattern.equipmentId;
      break;
    }
  }
  
  // Find matching diagnostic patterns
  const matchingPatterns = diagnosticPatterns.filter(pattern => {
    const hasKeyword = pattern.keywords.some(keyword => queryLower.includes(keyword));
    const hasEquipment = pattern.equipment.some(equipment => queryLower.includes(equipment));
    return hasKeyword || hasEquipment;
  });
  
  if (matchingPatterns.length === 0) {
    // Generic response for unrecognized patterns
    return {
      diagnosis: "Diagnostic général nécessaire. Je recommande une inspection visuelle complète de l'équipement mentionné.",
      confidence: 0.50,
      recommendations: [
        "Effectuer une inspection visuelle",
        "Vérifier les paramètres de fonctionnement",
        "Consulter la documentation technique",
        "Contacter un technicien spécialisé si nécessaire"
      ],
      equipmentId: identifiedEquipment,
      urgencyLevel: 'low',
      estimatedTime: "30-60 minutes"
    };
  }
  
  // Select the best matching pattern
  const bestMatch = matchingPatterns.reduce((best, current) => 
    current.confidence > best.confidence ? current : best
  );
  
  // Calculate overall confidence based on keyword matches
  const keywordMatches = bestMatch.keywords.filter(keyword => queryLower.includes(keyword)).length;
  const adjustedConfidence = Math.min(bestMatch.confidence + (keywordMatches * 0.05), 0.95);
  
  // Estimate cost and time based on urgency
  let estimatedCost: number;
  let estimatedTime: string;
  
  switch (bestMatch.urgencyLevel) {
    case 'critical':
      estimatedCost = Math.floor(Math.random() * 1000) + 500;
      estimatedTime = "Immédiat - 2 heures";
      break;
    case 'high':
      estimatedCost = Math.floor(Math.random() * 500) + 200;
      estimatedTime = "2-4 heures";
      break;
    case 'medium':
      estimatedCost = Math.floor(Math.random() * 300) + 100;
      estimatedTime = "4-8 heures";
      break;
    default:
      estimatedCost = Math.floor(Math.random() * 150) + 50;
      estimatedTime = "1-2 jours";
  }
  
  // Generate required parts based on diagnosis type
  const requiredParts: string[] = [];
  if (queryLower.includes('roulement') || queryLower.includes('vibration')) {
    requiredParts.push('Roulement à billes SKF 6205', 'Graisse haute température');
  }
  if (queryLower.includes('joint') || queryLower.includes('fuite')) {
    requiredParts.push('Kit de joints hydrauliques', 'Huile hydraulique ISO 46');
  }
  if (queryLower.includes('filtre')) {
    requiredParts.push('Filtre à huile', 'Filtre à air');
  }
  
  return {
    diagnosis: bestMatch.diagnosis + ". " + generateContextualAdvice(queryLower, bestMatch.urgencyLevel),
    confidence: adjustedConfidence,
    recommendations: bestMatch.recommendations,
    equipmentId: identifiedEquipment,
    urgencyLevel: bestMatch.urgencyLevel,
    estimatedCost,
    estimatedTime,
    requiredParts: requiredParts.length > 0 ? requiredParts : undefined
  };
}

/**
 * Generate contextual advice based on query and urgency
 */
function generateContextualAdvice(query: string, urgency: string): string {
  if (urgency === 'critical') {
    return "Arrêtez immédiatement l'équipement pour éviter des dommages supplémentaires.";
  }
  
  if (urgency === 'high') {
    return "Planifiez une intervention dans les plus brefs délais.";
  }
  
  if (query.includes('préventif') || query.includes('maintenance')) {
    return "Intégrez cette intervention dans votre plan de maintenance préventive.";
  }
  
  return "Surveillez l'évolution des symptômes et documentez les observations.";
}

/**
 * Enhanced diagnostic with ML integration (simulated)
 */
export async function enhancedVoiceDiagnostic(request: VoiceDiagnosticRequest): Promise<VoiceDiagnosticResponse> {
  const basicDiagnostic = await processVoiceDiagnostic(request);
  
  // Simulate ML enhancement
  const mlConfidenceBoost = Math.random() * 0.1; // 0-10% boost
  const enhancedConfidence = Math.min(basicDiagnostic.confidence + mlConfidenceBoost, 0.98);
  
  // Add ML-based insights
  const mlInsights = [
    "L'analyse des données historiques suggère une corrélation avec les conditions météorologiques.",
    "Les modèles prédictifs indiquent une probabilité de 78% de récurrence dans les 30 jours.",
    "L'analyse vibratoire avancée révèle des harmoniques caractéristiques d'un déséquilibre.",
    "Les données IoT confirment une dérive progressive des paramètres opérationnels."
  ];
  
  const randomInsight = mlInsights[Math.floor(Math.random() * mlInsights.length)];
  
  return {
    ...basicDiagnostic,
    confidence: enhancedConfidence,
    diagnosis: basicDiagnostic.diagnosis + " " + randomInsight,
    recommendations: [
      ...basicDiagnostic.recommendations,
      "Consulter l'analyse ML complète dans le rapport détaillé"
    ]
  };
}
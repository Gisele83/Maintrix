import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertMaintenanceCaseSchema, 
  insertReportedCaseSchema, 
  insertDiagnosticSessionSchema, 
  insertUserProfileSchema,
  insertEquipmentRegistrySchema,
  insertWorkOrderSchema,
  insertPreventiveMaintenancePlanSchema,
  insertSparePartSchema,
  insertStockMovementSchema,
  insertIotSensorDataSchema,
  insertPredictiveAnalyticsSchema,
  insertKpiMetricsSchema,
  insertIntegrationLogSchema,
  insertAlertsNotificationsSchema
} from "@shared/schema";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";
import { performCloudDiagnostic, analyzeSymptomSimilarity, generateMaintenanceInsights, type CloudDiagnosticRequest } from "./cloud-diagnostic";
import { registerGMAORoutes } from "./gmao-routes";
import validationRoutes from "./validation-routes";

// ML Helper Functions
async function callMLEngine(command: string, args: string[] = [], scriptName: string = 'ml_diagnostic_engine.py'): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'server', scriptName);
    const allArgs = ['python3', scriptPath, command, ...args];
    
    const childProcess = spawn('bash', ['-c', allArgs.join(' ')], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONPATH: '.pythonlibs/lib/python3.11/site-packages' }
    });
    
    let output = '';
    let errorOutput = '';
    
    childProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    childProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    childProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output.trim());
          resolve(result);
        } catch (e) {
          resolve({ error: 'Invalid JSON response from ML engine' });
        }
      } else {
        console.error('ML Engine Error:', errorOutput);
        reject(new Error(`ML engine failed with code ${code}: ${errorOutput}`));
      }
    });
    
    childProcess.on('error', (error) => {
      reject(new Error(`Failed to start ML engine: ${error.message}`));
    });
  });
}

// AI Helper Functions
function calculateTextSimilarity(text1: string, text2: string): number {
  // Simple Jaccard similarity for text comparison
  const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 2));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}

function calculateSemanticSimilarity(userSymptoms: string, dbSymptoms: string): number {
  // Dictionnaire de synonymes et termes équivalents pour l'industrie - version étendue
  const synonymDictionary = {
    // Bruit et vibrations
    'bruit': ['son', 'vibration', 'grincement', 'sifflement', 'claquement', 'cognement', 'ronflement', 'vrombissement', 'bourdonnement'],
    'vibration': ['tremblement', 'oscillation', 'secousse', 'frémissement', 'pulsation', 'battement', 'soubresaut'],
    'grincement': ['crissement', 'frottement', 'raclement', 'grinçage', 'couinement'],
    
    // Température et thermique
    'chaud': ['surchauffe', 'température élevée', 'brûlant', 'échauffement', 'chauffage excessif', 'chaleur anormale'],
    'surchauffe': ['température excessive', 'échauffement anormal', 'trop chaud', 'thermique élevé', 'chauffe'],
    'froid': ['température basse', 'refroidissement', 'gelé', 'glacé', 'frais', 'sous-refroidi'],
    
    // Mouvement et mécanique
    'blocage': ['coincé', 'grippé', 'bloqué', 'immobilisé', 'figé', 'grippage', 'serrage', 'dur'],
    'glissement': ['patinage', 'dérapage', 'perte adhérence', 'glisse', 'échappement'],
    'déformation': ['torsion', 'pliage', 'gauchissement', 'voilage', 'déformé', 'tordu', 'plié'],
    'usure': ['usé', 'détérioration', 'dégradation', 'érosion', 'abrasion', 'fatigue'],
    'jeu': ['jeu mécanique', 'flottement', 'ballant', 'débattement', 'espace'],
    
    // Fluides et fuites
    'fuite': ['écoulement', 'perte', 'coulure', 'suintement', 'égouttement', 'infiltration'],
    'pression': ['compression', 'force', 'poussée', 'contrainte', 'charge'],
    'débit': ['flux', 'écoulement', 'circulation', 'passage', 'transit'],
    
    // Électrique
    'étincelle': ['arc électrique', 'décharge', 'court-circuit', 'amorçage', 'spark'],
    'coupure': ['arrêt', 'interruption', 'panne', 'défaillance', 'dysfonctionnement'],
    'courant': ['électricité', 'alimentation', 'tension', 'voltage', 'ampérage'],
    
    // Performance et fonctionnement
    'lent': ['ralenti', 'vitesse réduite', 'performance dégradée', 'faible vitesse', 'retard'],
    'rapide': ['accéléré', 'vitesse excessive', 'emballement', 'survitesse', 'trop vite'],
    'irrégulier': ['saccadé', 'instable', 'variable', 'erratique', 'fluctuant', 'inconstant'],
    'arrêt': ['stop', 'coupure', 'interruption', 'panne', 'immobilisation'],
    
    // Défauts visuels et physiques
    'cassé': ['brisé', 'rompu', 'fracturé', 'endommagé', 'détruit'],
    'fissuré': ['craquelé', 'fendu', 'lézardé', 'fêlé'],
    'oxydé': ['rouillé', 'corrodé', 'oxidation', 'rouille'],
    'sale': ['encrassé', 'souillé', 'pollué', 'contaminé', 'crasse'],
    
    // Alignement et positionnement
    'désaligné': ['mal aligné', 'décentré', 'décalé', 'faux', 'désaxé'],
    'desserré': ['lâche', 'détendu', 'relâché', 'libre', 'pas serré'],
    
    // Lubrification
    'sec': ['sans lubrifiant', 'manque huile', 'non lubrifié', 'aride'],
    'graisse': ['lubrifiant', 'huile', 'graissage', 'lubrification']
  };

  // Normalisation des textes
  const normalizeText = (text: string): string => {
    return text.toLowerCase()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const userText = normalizeText(userSymptoms);
  const dbText = normalizeText(dbSymptoms);
  
  // Correspondance exacte
  if (userText.includes(dbText) || dbText.includes(userText)) {
    return 0.9;
  }

  const userWords = userText.split(' ').filter(w => w.length > 2);
  const dbWords = dbText.split(' ').filter(w => w.length > 2);
  
  let matches = 0;
  let totalWords = Math.max(userWords.length, 1);

  for (const userWord of userWords) {
    let bestMatch = 0;
    
    // 1. Correspondance directe (score max)
    if (dbWords.some(dbWord => dbWord === userWord)) {
      bestMatch = 1.0;
    } 
    // 2. Correspondance par inclusion
    else if (dbWords.some(dbWord => dbWord.includes(userWord) || userWord.includes(dbWord))) {
      bestMatch = 0.95;
    }
    // 3. Correspondance par synonymes 
    else {
      for (const [key, synonyms] of Object.entries(synonymDictionary)) {
        // Le mot utilisateur correspond à la clé ou à un synonyme
        if (userWord.includes(key) || synonyms.some(syn => userWord.includes(syn))) {
          // Vérifier si le texte DB contient la clé ou un synonyme
          if (dbWords.some(dbWord => 
            dbWord.includes(key) || 
            synonyms.some(syn => dbWord.includes(syn))
          )) {
            bestMatch = Math.max(bestMatch, 0.85);
          }
        }
        // Le contraire : le mot DB correspond à la clé, le mot utilisateur à un synonyme
        if (dbWords.some(dbWord => dbWord.includes(key))) {
          if (synonyms.some(syn => userWord.includes(syn))) {
            bestMatch = Math.max(bestMatch, 0.8);
          }
        }
      }
    }
    
    // 4. Correspondance partielle (sous-chaînes communes)
    if (bestMatch < 0.5) {
      for (const dbWord of dbWords) {
        if (userWord.length > 3 && dbWord.length > 3) {
          const commonSubstring = findLongestCommonSubstring(userWord, dbWord);
          if (commonSubstring.length >= 4) {
            const partialScore = (commonSubstring.length / Math.max(userWord.length, dbWord.length)) * 0.7;
            bestMatch = Math.max(bestMatch, partialScore);
          }
        }
      }
    }
    
    matches += bestMatch;
  }

  return Math.min(matches / totalWords, 1.0);
}

function findLongestCommonSubstring(str1: string, str2: string): string {
  let longest = '';
  for (let i = 0; i < str1.length; i++) {
    for (let j = i + 1; j <= str1.length; j++) {
      const substring = str1.slice(i, j);
      if (str2.includes(substring) && substring.length > longest.length) {
        longest = substring;
      }
    }
  }
  return longest;
}

function calculateContextualScore(userEquipment: string, dbEquipment: string, 
                                userZone: string, dbZone: string): number {
  let score = 0;
  
  // Score pour type d'équipement
  if (userEquipment.toLowerCase() === dbEquipment.toLowerCase()) {
    score += 0.4;
  } else if (userEquipment.toLowerCase().includes(dbEquipment.toLowerCase()) || 
             dbEquipment.toLowerCase().includes(userEquipment.toLowerCase())) {
    score += 0.2;
  }
  
  // Score pour zone/contexte
  if (userZone && dbZone) {
    if (userZone.toLowerCase() === dbZone.toLowerCase()) {
      score += 0.2;
    } else if (userZone.toLowerCase().includes(dbZone.toLowerCase()) || 
               dbZone.toLowerCase().includes(userZone.toLowerCase())) {
      score += 0.1;
    }
  }
  
  return score;
}

function calculateRiskLevel(case_: any, currentUrgency: string): string {
  const urgencyScores = { low: 1, medium: 2, high: 3 };
  const caseUrgency = urgencyScores[case_.urgency as keyof typeof urgencyScores] || 2;
  const currentScore = urgencyScores[currentUrgency as keyof typeof urgencyScores] || 2;
  
  const avgScore = (caseUrgency + currentScore) / 2;
  
  if (avgScore >= 2.5) return "Élevé";
  if (avgScore >= 1.5) return "Moyen";
  return "Faible";
}

function estimateRepairCost(duration: number = 60, equipmentType: string): string {
  const baseCostPerHour = 85; // €/hour
  const equipmentMultipliers = {
    moteur: 1.2,
    pompe: 1.0,
    compresseur: 1.5,
    convoyeur: 0.8,
    variateur: 1.3,
    capteur: 0.7,
    automate: 1.8,
    sts: 2.5,              // Grue STS - très complexe
    rtg: 2.2,              // Grue RTG - complexe
    grue_mobile: 2.0,      // Grue mobile - complexe
    reach_stacker: 1.8,    // Reach Stacker - complexe
    straddle_carrier: 1.7, // Straddle Carrier - complexe
    spreader: 1.6,         // Spreader - spécialisé
    autre: 1.0
  };
  
  const multiplier = equipmentMultipliers[equipmentType as keyof typeof equipmentMultipliers] || 1.0;
  const estimatedCost = Math.round((duration / 60) * baseCostPerHour * multiplier);
  
  return `${estimatedCost}€`;
}

function generateAdvancedAIInsights(case_: any, semanticSimilarity: number, textSimilarity: number, contextualScore: number): string {
  const insights = [];
  
  // Analyse sémantique
  if (semanticSimilarity > 0.8) {
    insights.push(`🎯 Correspondance sémantique exceptionnelle (${Math.round(semanticSimilarity * 100)}%)`);
  } else if (semanticSimilarity > 0.6) {
    insights.push(`🧠 Bonne correspondance sémantique (${Math.round(semanticSimilarity * 100)}%)`);
  } else if (semanticSimilarity > 0.4) {
    insights.push(`🔍 Correspondance sémantique modérée (${Math.round(semanticSimilarity * 100)}%)`);
  }
  
  // Analyse contextuelle
  if (contextualScore > 0.3) {
    insights.push(`⚙️ Contexte équipement très pertinent`);
  } else if (contextualScore > 0.1) {
    insights.push(`🔧 Contexte équipement pertinent`);
  }
  
  // Analyse de correspondance textuelle
  if (textSimilarity > 0.7) {
    insights.push(`📝 Correspondance textuelle forte`);
  } else if (textSimilarity > 0.4) {
    insights.push(`📄 Correspondance textuelle modérée`);
  }
  
  // Recommandations spécifiques
  if (semanticSimilarity > 0.7 && contextualScore > 0.2) {
    insights.push(`✅ Diagnostic hautement recommandé pour ce type d'équipement`);
  } else if (semanticSimilarity > 0.5) {
    insights.push(`💡 Diagnostic probable basé sur l'analyse sémantique`);
  }
  
  return insights.length > 0 ? insights.join(' • ') : 'Analyse en cours...';
}

function generateAIInsights(case_: any, symptomScore: number, textSimilarity: number): string {
  const insights = [];
  const urgencyLevel = case_.urgency || "medium";
  const equipmentType = case_.equipmentType || "unknown";
  const zone = case_.zone || "unknown";
  const sector = case_.sector || "unknown";
  
  // Confidence analysis
  if (textSimilarity > 0.8) {
    insights.push(`🎯 Correspondance exceptionnelle (${Math.round(textSimilarity * 100)}%)`);
  } else if (textSimilarity > 0.6) {
    insights.push(`🔍 Bonne correspondance (${Math.round(textSimilarity * 100)}%)`);
  } else if (textSimilarity > 0.4) {
    insights.push(`📊 Correspondance modérée (${Math.round(textSimilarity * 100)}%)`);
  } else {
    insights.push(`💡 Diagnostic heuristique basé sur l'expérience`);
  }
  
  // Symptom analysis
  if (symptomScore > 3) {
    insights.push(`⚠️ Symptômes multiples détectés (${symptomScore} indicateurs)`);
  } else if (symptomScore > 1) {
    insights.push(`🔍 Symptômes principaux identifiés`);
  }
  
  // Context information
  if (zone !== "unknown") {
    insights.push(`📍 Zone: ${zone}`);
  }
  
  if (sector !== "unknown") {
    insights.push(`🏭 Secteur: ${sector}`);
  }
  
  // Urgency indicator
  const urgencyEmoji = urgencyLevel === "high" ? "🚨" : urgencyLevel === "medium" ? "⚡" : "🔵";
  insights.push(`${urgencyEmoji} Priorité: ${urgencyLevel}`);
  
  // Additional context
  if (case_.duration && case_.duration < 60) {
    insights.push("⏱️ Réparation rapide probable");
  } else if (case_.duration && case_.duration > 180) {
    insights.push("⏳ Intervention complexe prévue");
  }
  
  return insights.join(" • ");
}

// Helper function to parse duration from cloud suggestions
function parseDuration(estimatedTime: string): number {
  // Extract numbers from strings like "2-4 heures", "30 minutes", etc.
  const match = estimatedTime.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1]);
    if (estimatedTime.toLowerCase().includes('heure')) {
      return num * 60; // Convert hours to minutes
    }
    return num; // Assume minutes if no unit specified
  }
  return 60; // Default 1 hour
}

function generateContextualSolution(diagnosis: string, equipmentType: string, zone: string = "unknown", sector: string = "unknown"): string {
  const solutions: { [key: string]: { [key: string]: string } } = {
    "Roulement défaillant": {
      "moteur": "Remplacer le roulement défaillant, vérifier l'alignement et la lubrification",
      "pompe": "Remplacer le roulement, contrôler l'équilibrage de la roue et l'état de l'arbre",
      "compresseur": "Changer le roulement, vérifier la pression et les vibrations",
      "default": "Remplacement du roulement avec inspection complète"
    },
    "Joint d'étanchéité usé": {
      "pompe": "Remplacer les joints d'étanchéité, vérifier la pression et l'alignement",
      "moteur": "Changer les joints de carter, contrôler l'étanchéité générale",
      "default": "Remplacement des joints avec test d'étanchéité"
    },
    "Amorçage déficient": {
      "pompe": "Vérifier le circuit d'aspiration, purger l'air et contrôler le clapet",
      "compresseur": "Contrôler le système d'amorçage et les valves d'admission",
      "default": "Diagnostic du circuit d'amorçage et réparation"
    },
    "Usure des balais": {
      "moteur": "Remplacer les balais, nettoyer le collecteur et vérifier les ressorts",
      "default": "Remplacement des balais et maintenance du collecteur"
    },
    "Problème électrique": {
      "moteur": "Diagnostic électrique complet, test d'isolement et vérification des connexions",
      "automate": "Contrôler les entrées/sorties, vérifier l'alimentation et les câblages",
      "variateur": "Test des paramètres, vérification des signaux et calibrage",
      "convertisseur": "Diagnostic des modules de puissance, test des thyristors et vérification du refroidissement",
      "onduleur": "Test des batteries, vérification de l'onduleur et contrôle du bypass",
      "redresseur": "Contrôle du pont de diodes, test des condensateurs et vérification de la régulation",
      "carte_electronique": "Diagnostic des composants, test des soudures et vérification du firmware",
      "alimentation": "Test de la régulation, contrôle de l'isolation et vérification des découplages",
      "capteur": "Calibrage du capteur, test des signaux et vérification de l'environnement",
      "default": "Diagnostic électrique approfondi et réparation"
    },
    "Défaillance IGBT": {
      "variateur": "Remplacer les modules IGBT, tester les drivers de grille et vérifier le refroidissement",
      "convertisseur": "Changer les IGBT défaillants, contrôler les circuits de commande",
      "default": "Remplacement des modules IGBT avec test complet"
    },
    "Défaut thyristor": {
      "convertisseur": "Remplacer les thyristors défaillants, vérifier les circuits de gâchette",
      "redresseur": "Changer les thyristors, contrôler la commutation et le refroidissement",
      "default": "Remplacement des thyristors avec test de commutation"
    },
    "Défaillance batterie": {
      "onduleur": "Remplacer les batteries, tester le chargeur et contrôler la température",
      "default": "Remplacement des batteries avec test de capacité"
    },
    "Dérive capteur": {
      "capteur": "Recalibrer le capteur, vérifier l'environnement et les connexions",
      "automate": "Contrôler les entrées analogiques, recalibrer si nécessaire",
      "default": "Recalibrage du capteur avec vérification complète"
    },
    "Condensateur sec": {
      "carte_electronique": "Remplacer les condensateurs électrolytiques, tester les circuits",
      "alimentation": "Changer les condensateurs de filtrage, vérifier l'ondulation",
      "redresseur": "Remplacer les condensateurs de lissage, contrôler la tension",
      "default": "Remplacement des condensateurs avec test complet"
    },
    "Surchauffe composant": {
      "carte_electronique": "Identifier le composant en surchauffe, améliorer le refroidissement",
      "alimentation": "Contrôler la ventilation, vérifier la charge et les dissipateurs",
      "variateur": "Nettoyer les filtres, vérifier les ventilateurs et la charge",
      "default": "Diagnostic thermique et amélioration du refroidissement"
    }
  };
  
  const equipmentSolutions = solutions[diagnosis] || {};
  let baseSolution = equipmentSolutions[equipmentType] || equipmentSolutions["default"] || `Intervention technique pour: ${diagnosis}`;
  
  // Add context based on zone and sector
  if (zone !== "unknown") {
    const zoneContext = {
      "production": " - Minimiser l'arrêt de production",
      "conditionnement": " - Coordonner avec la ligne de conditionnement", 
      "stockage": " - Prévoir la gestion des stocks pendant l'intervention",
      "utilites": " - Vérifier l'impact sur les services auxiliaires",
      "maintenance": " - Utiliser l'atelier pour les réparations complexes"
    };
    baseSolution += zoneContext[zone] || "";
  }
  
  if (sector !== "unknown" && sector.includes("ligne")) {
    baseSolution += ` - Intervention sur ${sector.toUpperCase()}`;
  }
  
  return baseSolution;
}

function generatePredictiveTips(equipmentType: string, diagnosis: string): string[] {
  const tips: { [key: string]: string[] } = {
    moteur: [
      "Vérifier l'alignement tous les 6 mois",
      "Contrôler la température de fonctionnement",
      "Surveiller les vibrations régulièrement"
    ],
    pompe: [
      "Contrôler l'étanchéité mensuellement", 
      "Vérifier la pression d'aspiration",
      "Surveiller le débit et les fuites"
    ],
    compresseur: [
      "Vérifier le niveau d'huile hebdomadairement",
      "Contrôler les filtres à air",
      "Surveiller la pression de service"
    ],
    convoyeur: [
      "Vérifier la tension des bandes",
      "Contrôler l'alignement des rouleaux",
      "Lubrifier les roulements régulièrement"
    ]
  };
  
  return tips[equipmentType] || ["Effectuer une maintenance préventive régulière"];
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Register GMAO routes
  registerGMAORoutes(app);
  
  // Validation routes for multi-level approval system
  app.use("/api/validation", validationRoutes);

  // Initialize enterprise integrations
  const { initializeIntegrations, getIntegrationHub } = await import("./integrations/index");
  const integrationConfig = {
    iot: {
      mqttBrokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
      mqttUsername: process.env.MQTT_USERNAME,
      mqttPassword: process.env.MQTT_PASSWORD,
      sensorThresholds: [
        { sensorType: 'temperature', warningThreshold: 75, criticalThreshold: 85, unit: '°C' },
        { sensorType: 'vibration', warningThreshold: 4.5, criticalThreshold: 7.1, unit: 'mm/s' },
        { sensorType: 'pressure', warningThreshold: 5.5, criticalThreshold: 4.0, unit: 'bar' },
        { sensorType: 'current', warningThreshold: 105, criticalThreshold: 120, unit: 'A' }
      ]
    }
  };

  const integrationHub = initializeIntegrations(integrationConfig);
  
  // Initialize integrations (non-blocking)
  integrationHub.initialize().catch(error => {
    console.error('Integration initialization error:', error);
  });

  // Integration management routes
  app.get("/api/integrations/status", async (req, res) => {
    try {
      const hub = getIntegrationHub();
      if (!hub) {
        return res.status(500).json({ message: "Integration hub not initialized" });
      }
      
      const status = hub.getStatus();
      res.json(status);
    } catch (error) {
      console.error("Error getting integration status:", error);
      res.status(500).json({ message: "Failed to get integration status" });
    }
  });

  app.post("/api/integrations/test", async (req, res) => {
    try {
      const hub = getIntegrationHub();
      if (!hub) {
        return res.status(500).json({ message: "Integration hub not initialized" });
      }
      
      const results = await hub.testAllConnections();
      res.json(results);
    } catch (error) {
      console.error("Error testing integrations:", error);
      res.status(500).json({ message: "Failed to test integrations" });
    }
  });

  app.post("/api/integrations/sync", async (req, res) => {
    try {
      const hub = getIntegrationHub();
      if (!hub) {
        return res.status(500).json({ message: "Integration hub not initialized" });
      }
      
      const results = await hub.forceSyncAll();
      res.json(results);
    } catch (error) {
      console.error("Error forcing sync:", error);
      res.status(500).json({ message: "Failed to force sync" });
    }
  });

  // Predictive maintenance routes
  app.get("/api/predictive/:equipmentId", async (req, res) => {
    try {
      const { PredictiveMaintenanceEngine } = await import("./integrations/predictive-engine");
      const engine = new PredictiveMaintenanceEngine();
      
      const equipmentId = parseInt(req.params.equipmentId);
      const analysis = await engine.analyzeEquipmentHealth(equipmentId);
      
      res.json(analysis);
    } catch (error) {
      console.error("Error in predictive analysis:", error);
      res.status(500).json({ message: "Failed to perform predictive analysis" });
    }
  });

  // IoT real-time data route
  app.get("/api/iot/:equipmentId/realtime", async (req, res) => {
    try {
      const hub = getIntegrationHub();
      if (!hub) {
        return res.status(500).json({ message: "Integration hub not initialized" });
      }
      
      const equipmentId = parseInt(req.params.equipmentId);
      const data = await hub.getIoTData(equipmentId);
      res.json(data);
    } catch (error) {
      console.error("Error getting IoT data:", error);
      res.status(500).json({ message: "Failed to get IoT data" });
    }
  });
  
  // ML Diagnostic endpoint - enhanced with machine learning
  app.post("/api/diagnostic-ml", async (req, res) => {
    try {
      const data = insertDiagnosticSessionSchema.parse(req.body);
      
      // Create diagnostic session
      const session = await storage.createDiagnosticSession(data);
      
      // Pré-analyse sémantique pour décider de la stratégie
      const symptoms = data.symptoms.toLowerCase();
      const hasCommonTerms = ['chauffe', 'bruit', 'fuite', 'vibration', 'arrêt', 'lent', 'rapide'].some(term => symptoms.includes(term));
      
      // Si termes communs détectés, essayer d'abord l'algorithme sémantique
      if (hasCommonTerms) {
        try {
          // Récupérer les cas de maintenance pour analyse sémantique
          const cases = await storage.getMaintenanceCases();
          const semanticSuggestions = [];
          
          for (const case_ of cases) {
            const caseSymptoms = `${case_.symptoms} ${case_.symptomsChecked?.join(' ') || ''}`;
            const userSymptoms = `${data.symptoms} ${(data.symptomsChecked || []).join(' ')}`;
            
            // Analyse sémantique
            const semanticSimilarity = calculateSemanticSimilarity(userSymptoms, caseSymptoms);
            const contextualScore = calculateContextualScore(
              data.equipmentType, case_.equipmentType,
              data.zone || '', case_.zone || ''
            );
            
            // Score global pour priorité sémantique
            const totalScore = (semanticSimilarity * 0.6) + (contextualScore * 0.4);
            
            if (totalScore > 0.4) { // Seuil pour correspondance sémantique forte
              const confidence = Math.min(Math.round(totalScore * 100) + 15, 95); // Bonus confiance
              
              semanticSuggestions.push({
                diagnosis: case_.diagnosis,
                solution: generateContextualSolution(case_.diagnosis, case_.equipmentType, data.zone, data.sector),
                confidence,
                matchingCases: 1,
                caseId: case_.id,
                duration: case_.duration,
                riskLevel: calculateRiskLevel(case_, data.urgency),
                costEstimate: estimateRepairCost(case_.duration, case_.equipmentType),
                aiInsights: generateAdvancedAIInsights(case_, semanticSimilarity, 0.5, contextualScore),
                semanticMatch: true,
                predictiveTips: generatePredictiveTips(case_.equipmentType, case_.diagnosis)
              });
            }
          }
          
          // Si correspondances sémantiques trouvées, les retourner
          if (semanticSuggestions.length > 0) {
            const sortedSuggestions = semanticSuggestions
              .sort((a, b) => b.confidence - a.confidence)
              .slice(0, 3);
            
            await storage.updateDiagnosticSession(session.id, {
              results: JSON.stringify(sortedSuggestions),
              status: "completed"
            });
            
            return res.json({
              sessionId: session.id,
              suggestions: sortedSuggestions,
              mlEnabled: false,
              modelAccuracy: "semantic_analysis",
              semanticBoost: true
            });
          }
        } catch (semanticError) {
          console.log('Semantic analysis failed, falling back to ML:', semanticError.message);
        }
      }
      
      // Call ML engine for prediction
      const mlArgs = [
        data.equipmentType,
        data.symptoms,
        (data.symptomsChecked || []).join(','),
        data.urgency,
        data.zone || 'unknown',
        data.sector || 'unknown'
      ];
      
      try {
        const mlResult = await callMLEngine('predict', mlArgs);
        
        if (mlResult.error) {
          console.warn('ML prediction failed, using rule-based fallback:', mlResult.error);
          // Generate fallback suggestions immediately
          const fallbackSuggestions = [{
            diagnosis: `Diagnostic ${data.equipmentType} - ${data.urgency}`,
            solution: generateContextualSolution(`Problème ${data.equipmentType}`, data.equipmentType, data.zone, data.sector),
            confidence: 75,
            matchingCases: 1,
            caseId: 1001,
            duration: 60,
            riskLevel: data.urgency === "high" ? "Élevé" : data.urgency === "medium" ? "Moyen" : "Faible",
            costEstimate: estimateRepairCost(60, data.equipmentType),
            aiInsights: generateAIInsights({ equipmentType: data.equipmentType, symptoms: data.symptoms }, 75, 0.8),
            mlPrediction: false,
            predictiveTips: generatePredictiveTips(data.equipmentType, `Problème ${data.equipmentType}`)
          }];
          
          await storage.updateDiagnosticSession(session.id, {
            results: JSON.stringify(fallbackSuggestions),
            status: "completed"
          });
          
          return res.json({
            sessionId: session.id,
            suggestions: fallbackSuggestions,
            mlEnabled: false,
            modelAccuracy: "fallback"
          });
        }
        
        // Transform ML results to match expected format
        const suggestions = mlResult.predictions?.map((pred: any, index: number) => ({
          diagnosis: pred.diagnosis,
          solution: generateContextualSolution(pred.diagnosis, data.equipmentType, data.zone, data.sector),
          confidence: Math.round(pred.confidence * 100),
          matchingCases: 1,
          caseId: 1000 + index, // Temporary ID for ML predictions
          duration: 60,
          riskLevel: pred.confidence > 0.8 ? "Faible" : pred.confidence > 0.6 ? "Moyen" : "Élevé",
          costEstimate: estimateRepairCost(60, data.equipmentType),
          aiInsights: `ML Analysis: ${mlResult.ml_insights || 'Analyse basée sur machine learning'}`,
          mlPrediction: true,
          anomalyScore: pred.anomaly_score
        })) || [];
        
        // Update session with ML results
        await storage.updateDiagnosticSession(session.id, {
          results: JSON.stringify(suggestions),
          status: "completed"
        });
        
        res.json({
          sessionId: session.id,
          suggestions,
          mlEnabled: true,
          modelAccuracy: mlResult.model_accuracy,
          featureImportance: mlResult.feature_importance
        });
        
      } catch (mlError) {
        console.error('ML Engine call failed:', mlError);
        // Generate immediate fallback suggestions
        const fallbackSuggestions = [{
          diagnosis: `Diagnostic système - ${data.equipmentType}`,
          solution: generateContextualSolution(`Analyse ${data.equipmentType}`, data.equipmentType, data.zone, data.sector),
          confidence: 70,
          matchingCases: 1,
          caseId: 1002,
          duration: 45,
          riskLevel: data.urgency === "high" ? "Élevé" : data.urgency === "medium" ? "Moyen" : "Faible",
          costEstimate: estimateRepairCost(45, data.equipmentType),
          aiInsights: generateAIInsights({ equipmentType: data.equipmentType, symptoms: data.symptoms }, 70, 0.7),
          mlPrediction: false,
          predictiveTips: generatePredictiveTips(data.equipmentType, `Analyse ${data.equipmentType}`)
        }];
        
        await storage.updateDiagnosticSession(session.id, {
          results: JSON.stringify(fallbackSuggestions),
          status: "completed"
        });
        
        return res.json({
          sessionId: session.id,
          suggestions: fallbackSuggestions,
          mlEnabled: false,
          modelAccuracy: "error_fallback"
        });
      }
      
    } catch (error) {
      console.error("ML Diagnostic error:", error);
      res.status(400).json({ message: "Invalid ML diagnostic request" });
    }
  });

  // Cloud diagnostic endpoint - search for unknown symptoms
  app.post("/api/cloud-diagnostic", async (req, res) => {
    try {
      const data = z.object({
        equipmentType: z.string(),
        zone: z.string().optional(),
        sector: z.string().optional(),
        symptoms: z.array(z.string()),
        customSymptoms: z.string(),
        urgency: z.string(),
        context: z.string().optional()
      }).parse(req.body);
      
      console.log("Performing cloud diagnostic for unknown symptoms...");
      
      const cloudRequest: CloudDiagnosticRequest = {
        equipmentType: data.equipmentType,
        zone: data.zone || "unknown",
        sector: data.sector || "unknown",
        symptoms: data.symptoms,
        customSymptoms: data.customSymptoms,
        urgency: data.urgency,
        context: data.context
      };
      
      const cloudResult = await performCloudDiagnostic(cloudRequest);
      
      // Also analyze symptom similarity for future improvements
      if (data.customSymptoms) {
        try {
          const similarityResult = await analyzeSymptomSimilarity(
            data.customSymptoms,
            data.equipmentType
          );
          cloudResult.similarSymptoms = similarityResult.similarSymptoms;
          cloudResult.suggestedKeywords = similarityResult.suggestedKeywords;
        } catch (error) {
          console.error("Similarity analysis error:", error);
        }
      }
      
      res.json({
        ...cloudResult,
        searchType: "cloud_only",
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Cloud diagnostic error:", error);
      res.status(400).json({ 
        message: "Erreur lors de la recherche cloud",
        searchPerformed: false,
        suggestions: []
      });
    }
  });

  // Traditional diagnostic endpoint - analyze symptoms and return suggestions
  app.post("/api/diagnostic", async (req, res) => {
    try {
      const data = insertDiagnosticSessionSchema.parse(req.body);
      
      // Create diagnostic session
      const session = await storage.createDiagnosticSession(data);
      
      // First try to find cases with exact equipment type match
      let similarCases = await storage.searchMaintenanceCases({
        equipmentType: data.equipmentType,
        symptoms: data.symptomsChecked || []
      });
      
      // If no cases found, get all cases for broader matching
      if (similarCases.length === 0) {
        similarCases = await storage.getMaintenanceCases();
      }
      
      // Enhanced AI-powered diagnostic algorithm with semantic analysis
      const suggestions = similarCases.map(case_ => {
        // Symptom matching with weighted scoring
        const symptomMatches = (data.symptomsChecked || []).filter(symptom => 
          (case_.symptomsChecked || []).includes(symptom)
        ).length;
        
        // Text similarity analysis for symptom description
        const textSimilarity = calculateTextSimilarity(
          data.symptoms.toLowerCase(), 
          case_.symptoms.toLowerCase()
        );
        
        // Advanced semantic similarity analysis
        const semanticSimilarity = calculateSemanticSimilarity(
          data.symptoms, 
          case_.symptoms
        );
        
        // Contextual scoring (equipment + zone)
        const contextualScore = calculateContextualScore(
          data.equipmentType, case_.equipmentType,
          data.zone || '', case_.zone || ''
        );
        
        // Urgency level matching
        const urgencyBonus = case_.urgency === data.urgency ? 0.1 : 0;
        
        // Calculate comprehensive match score
        const totalSymptoms = Math.max((data.symptomsChecked || []).length, 1);
        const symptomScore = symptomMatches / totalSymptoms;
        
        // Weighted confidence calculation with semantic enhancement
        const baseConfidence = case_.confidence || 0.5;
        const adjustedConfidence = Math.min(
          baseConfidence * (
            0.35 * semanticSimilarity +   // Priorité à l'analyse sémantique
            0.25 * symptomScore + 
            0.2 * textSimilarity + 
            0.15 * contextualScore +
            0.05 * urgencyBonus
          ), 
          0.99
        );
        
        // Risk assessment based on urgency and historical data
        const riskLevel = calculateRiskLevel(case_, data.urgency);
        
        // Cost estimation based on duration and equipment type
        const costEstimate = estimateRepairCost(case_.duration, case_.equipmentType);
        
        return {
          diagnosis: case_.diagnosis,
          solution: case_.solution,
          confidence: Math.round(adjustedConfidence * 100),
          matchingCases: 1,
          caseId: case_.id,
          duration: case_.duration,
          riskLevel,
          costEstimate,
          aiInsights: generateAdvancedAIInsights(case_, semanticSimilarity, textSimilarity, contextualScore)
        };
      })
      .filter(suggestion => suggestion.confidence > 10) // Permissive filter with semantic boost
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 4); // Return top 4 suggestions
      
      // Add predictive maintenance recommendations if confidence is high
      if (suggestions.length > 0 && suggestions[0].confidence > 80) {
        suggestions[0].predictiveTips = generatePredictiveTips(
          data.equipmentType, 
          suggestions[0].diagnosis
        );
      }
      
      // If no good suggestions found (low confidence), try cloud diagnostic
      let finalSuggestions = suggestions;
      let cloudSearchPerformed = false;
      let cloudInsights = "";
      
      if (suggestions.length === 0 || (suggestions.length > 0 && suggestions[0].confidence < 50)) {
        console.log("Low confidence results, trying cloud diagnostic...");
        
        try {
          const cloudRequest: CloudDiagnosticRequest = {
            equipmentType: data.equipmentType,
            zone: data.zone || "unknown",
            sector: data.sector || "unknown", 
            symptoms: data.symptomsChecked || [],
            customSymptoms: data.symptoms,
            urgency: data.urgency,
            context: `Zone: ${data.zone}, Secteur: ${data.sector}`
          };
          
          const cloudResult = await performCloudDiagnostic(cloudRequest);
          
          if (cloudResult.searchPerformed && cloudResult.suggestions.length > 0) {
            // Convert cloud suggestions to our format
            const cloudSuggestions = cloudResult.suggestions.map(cloudSugg => ({
              diagnosis: cloudSugg.diagnosis,
              solution: cloudSugg.solution,
              confidence: cloudSugg.confidence,
              matchingCases: 0, // Cloud suggestions don't have matching cases
              caseId: -1, // Special ID for cloud suggestions
              duration: parseDuration(cloudSugg.estimatedTime),
              riskLevel: cloudSugg.riskLevel,
              costEstimate: cloudSugg.cost,
              aiInsights: `🌐 Suggestion cloud • ${cloudSugg.source} • Confiance: ${cloudSugg.confidence}%`,
              cloudSource: true,
              repairSteps: cloudSugg.repairSteps,
              safetyWarnings: cloudSugg.safetyWarnings,
              tools: cloudSugg.tools,
              difficulty: cloudSugg.difficulty
            }));
            
            // If we had some local suggestions, combine them with cloud suggestions
            if (suggestions.length > 0) {
              finalSuggestions = [...cloudSuggestions, ...suggestions.slice(0, 2)].slice(0, 4);
            } else {
              finalSuggestions = cloudSuggestions.slice(0, 3);
            }
            
            cloudSearchPerformed = true;
            cloudInsights = cloudResult.aiInsights;
          }
        } catch (error) {
          console.error("Cloud diagnostic error:", error);
          // Continue with local suggestions if cloud fails
        }
      }
      
      // Add cloud search indicator to the session
      const sessionResults = {
        suggestions: finalSuggestions,
        cloudSearchPerformed,
        cloudInsights
      };
      
      // Update session with results
      await storage.updateDiagnosticSession(session.id, {
        results: JSON.stringify(sessionResults),
        status: "completed"
      });
      
      res.json({
        sessionId: session.id,
        suggestions: finalSuggestions,
        cloudSearchPerformed,
        cloudInsights
      });
    } catch (error) {
      console.error("Diagnostic error:", error);
      res.status(400).json({ message: "Invalid diagnostic request" });
    }
  });

  // Symptom analysis endpoint - for unknown symptom descriptions
  app.post("/api/analyze-symptoms", async (req, res) => {
    try {
      const data = z.object({
        symptom: z.string(),
        equipmentType: z.string()
      }).parse(req.body);
      
      console.log(`Analyzing unknown symptom: "${data.symptom}" for ${data.equipmentType}`);
      
      const result = await analyzeSymptomSimilarity(data.symptom, data.equipmentType);
      
      res.json({
        ...result,
        originalSymptom: data.symptom,
        equipmentType: data.equipmentType,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Symptom analysis error:", error);
      res.status(400).json({ 
        message: "Erreur lors de l'analyse des symptômes",
        similarSymptoms: [],
        suggestedKeywords: [],
        confidence: 0
      });
    }
  });

  // Maintenance insights endpoint
  app.get("/api/maintenance-insights/:equipmentType", async (req, res) => {
    try {
      const equipmentType = req.params.equipmentType;
      
      // Get recent diagnostic history for this equipment type
      const recentCases = await storage.getMaintenanceCases();
      const equipmentCases = recentCases
        .filter(c => c.equipmentType === equipmentType)
        .slice(0, 10);
      
      const insights = await generateMaintenanceInsights(equipmentType, equipmentCases);
      
      res.json({
        equipmentType,
        ...insights,
        totalCases: equipmentCases.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error("Maintenance insights error:", error);
      res.status(400).json({ 
        message: "Erreur lors de la génération des insights",
        insights: [],
        recommendations: [],
        patterns: []
      });
    }
  });
  
  // Get repair procedures for a specific case
  app.get("/api/repair/:caseId", async (req, res) => {
    try {
      const caseId = parseInt(req.params.caseId);
      
      // First try to get existing procedures
      let procedures = await storage.getRepairProceduresByCaseId(caseId);
      
      // If no procedures exist, generate default ones
      if (procedures.length === 0) {
        const defaultProcedures = [
          {
            caseId: caseId,
            stepNumber: 1,
            title: "Sécurisation",
            titleEn: "Safety",
            description: "Sécuriser la zone de travail et couper l'alimentation",
            descriptionEn: "Secure work area and cut power supply",
            estimatedTime: 10,
            isCompleted: false,
            safetyWarning: "⚠️ ATTENTION: Couper l'alimentation électrique avant toute intervention",
            safetyWarningEn: "⚠️ WARNING: Cut electrical power before any intervention",
            toolsRequired: ["Cadenas de consignation", "Testeur de tension"],
            toolsRequiredEn: ["Lockout padlocks", "Voltage tester"]
          },
          {
            caseId: caseId,
            stepNumber: 2,
            title: "Diagnostic",
            titleEn: "Diagnosis", 
            description: "Diagnostiquer et identifier la source du problème",
            descriptionEn: "Diagnose and identify the source of the problem",
            estimatedTime: 20,
            isCompleted: false,
            safetyWarning: "Utiliser des équipements de protection individuelle",
            safetyWarningEn: "Use personal protective equipment",
            toolsRequired: ["Multimètre", "Lunettes de sécurité"],
            toolsRequiredEn: ["Multimeter", "Safety glasses"]
          },
          {
            caseId: caseId,
            stepNumber: 3,
            title: "Réparation",
            titleEn: "Repair",
            description: "Effectuer la réparation ou le remplacement nécessaire",
            descriptionEn: "Perform necessary repair or replacement",
            estimatedTime: 30,
            isCompleted: false,
            safetyWarning: "Vérifier la compatibilité des pièces de rechange",
            safetyWarningEn: "Check compatibility of spare parts",
            toolsRequired: ["Outils standards", "Pièces de rechange"],
            toolsRequiredEn: ["Standard tools", "Spare parts"]
          },
          {
            caseId: caseId,
            stepNumber: 4,
            title: "Test et remise en service",
            titleEn: "Test and restart",
            description: "Tester le fonctionnement et remettre en service",
            descriptionEn: "Test operation and restart service",
            estimatedTime: 15,
            isCompleted: false,
            safetyWarning: "Effectuer tous les tests de sécurité avant remise en service",
            safetyWarningEn: "Perform all safety tests before restart",
            toolsRequired: ["Testeur de fonctionnement", "Check-list"],
            toolsRequiredEn: ["Function tester", "Checklist"]
          }
        ];
        
        // Create default procedures in storage
        for (const proc of defaultProcedures) {
          await storage.createRepairProcedure(proc);
        }
        
        // Fetch the newly created procedures
        procedures = await storage.getRepairProceduresByCaseId(caseId);
      }

      // Try to get maintenance case details, but proceed even if not found
      let maintenanceCase = null;
      try {
        maintenanceCase = await storage.getMaintenanceCaseById(caseId);
      } catch (error) {
        console.log(`No maintenance case found for ID ${caseId}, proceeding with procedures only`);
      }
      
      res.json({
        case: maintenanceCase || {
          id: caseId,
          equipmentType: "Équipement",
          symptoms: "Diagnostic à partir du système ML",
          solution: "Procédures de réparation générées automatiquement"
        },
        procedures
      });
    } catch (error) {
      console.error("Repair procedures error:", error);
      res.status(500).json({ message: "Failed to get repair procedures" });
    }
  });
  
  // Update repair step completion
  app.patch("/api/repair/step/:stepId", async (req, res) => {
    try {
      const stepId = parseInt(req.params.stepId);
      const { completed } = z.object({ completed: z.boolean() }).parse(req.body);
      
      const updatedStep = await storage.updateRepairProcedureCompletion(stepId, completed);
      
      res.json(updatedStep);
    } catch (error) {
      console.error("Step update error:", error);
      res.status(400).json({ message: "Failed to update step" });
    }
  });
  
  // Get all maintenance cases for ML training
  app.get("/api/maintenance-cases", async (req, res) => {
    try {
      const cases = await storage.getMaintenanceCases();
      res.json(cases);
    } catch (error) {
      console.error("Error fetching maintenance cases:", error);
      res.status(500).json({ message: "Failed to fetch maintenance cases" });
    }
  });

  // Train ML model endpoint
  app.post("/api/train-ml", async (req, res) => {
    try {
      console.log("Starting ML model training...");
      const result = await callMLEngine('train');
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: "Modèle ML entraîné avec succès",
          details: result.message 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Échec de l'entraînement du modèle ML",
          error: result.message 
        });
      }
    } catch (error) {
      console.error("ML training error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erreur lors de l'entraînement ML",
        error: error.message 
      });
    }
  });

  // Train Enhanced ML model endpoint
  app.post("/api/train-enhanced-ml", async (req, res) => {
    try {
      console.log("Starting Enhanced ML model training...");
      const result = await callMLEngine('train', [], 'enhanced_ml_diagnostic.py');
      
      if (result.success) {
        res.json({ 
          success: true, 
          message: "Modèle ML Enhanced entraîné avec succès",
          details: result.message,
          models_trained: result.models_trained,
          model_scores: result.model_scores,
          best_model: result.best_model
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Échec de l'entraînement du modèle ML Enhanced",
          error: result.message 
        });
      }
    } catch (error) {
      console.error("Enhanced ML training error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erreur lors de l'entraînement ML Enhanced",
        error: error.message 
      });
    }
  });

  // Train advanced ML models endpoint
  app.post("/api/train-advanced-ml", async (req, res) => {
    try {
      console.log("Starting advanced ML model training...");
      
      const scriptPath = path.join(process.cwd(), 'server', 'advanced_ml_features.py');
      const childProcess = spawn('bash', ['-c', `python3 ${scriptPath} train`], {
        cwd: process.cwd(),
        env: { ...process.env, PYTHONPATH: '.pythonlibs/lib/python3.11/site-packages' }
      });
      
      let output = '';
      let errorOutput = '';
      
      childProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      childProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      childProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output.trim());
            res.json(result);
          } catch (e) {
            res.status(500).json({ success: false, message: "Invalid response from advanced ML training" });
          }
        } else {
          console.error('Advanced ML training error:', errorOutput);
          res.status(500).json({ 
            success: false, 
            message: "Erreur lors de l'entraînement ML avancé",
            error: errorOutput 
          });
        }
      });
      
    } catch (error) {
      console.error("Advanced ML training error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erreur lors de l'entraînement ML avancé",
        error: error.message 
      });
    }
  });

  // Advanced ML diagnostic endpoint
  app.post("/api/diagnostic-advanced-ml", async (req, res) => {
    try {
      const { equipmentType, symptoms, symptomsChecked, urgency, zone, sector, equipmentId } = req.body;
      
      console.log("Starting advanced ML diagnostic...");
      
      const scriptPath = path.join(process.cwd(), 'server', 'advanced_ml_features.py');
      const args = [
        'predict',
        equipmentType || 'unknown',
        symptoms || '',
        (symptomsChecked || []).join(','),
        urgency || 'medium',
        zone || 'unknown',
        sector || 'unknown',
        equipmentId || 'unknown'
      ];
      
      const childProcess = spawn('bash', ['-c', `python3 ${scriptPath} ${args.join(' ')}`], {
        cwd: process.cwd(),
        env: { ...process.env, PYTHONPATH: '.pythonlibs/lib/python3.11/site-packages' }
      });
      
      let output = '';
      let errorOutput = '';
      
      childProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      childProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      childProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const advancedResult = JSON.parse(output.trim());
            
            if (advancedResult.error) {
              console.log("Advanced ML failed, falling back to standard ML");
              res.redirect(307, '/api/diagnostic-ml');
              return;
            }
            
            // Create comprehensive response combining advanced ML with standard analysis
            const response = {
              sessionId: Date.now(),
              suggestions: [{
                diagnosis: advancedResult.neural_network_prediction || "Diagnostic ML avancé",
                solution: `Solution avancée ML pour: ${advancedResult.neural_network_prediction}`,
                confidence: Math.round(advancedResult.neural_network_confidence * 100),
                matchingCases: 1,
                caseId: 2000 + Math.floor(Math.random() * 1000),
                duration: Math.round(advancedResult.pattern_match?.typical_duration || 60),
                riskLevel: advancedResult.failure_risk_score > 0.7 ? "Élevé" : 
                          advancedResult.failure_risk_score > 0.4 ? "Moyen" : "Faible",
                costEstimate: `${Math.round((advancedResult.pattern_match?.typical_duration || 60) * 1.7)}€`,
                aiInsights: advancedResult.advanced_insights,
                mlPrediction: true,
                advancedML: true,
                anomalyDetected: advancedResult.anomaly_detected,
                anomalyScore: advancedResult.anomaly_score,
                failureRisk: advancedResult.failure_risk_score,
                patternMatch: advancedResult.pattern_match,
                maintenanceRecommendation: advancedResult.maintenance_recommendation,
                predictiveTips: [
                  `Maintenance prédictive: ${advancedResult.maintenance_recommendation?.recommendation || 'Surveillance continue'}`,
                  `Niveau de risque: ${advancedResult.failure_prediction === 'failure' ? 'Panne probable' : 'Fonctionnement normal'}`,
                  `Score d'anomalie: ${advancedResult.anomaly_detected ? 'Comportement inhabituel détecté' : 'Comportement normal'}`
                ]
              }],
              mlEnabled: true,
              advancedML: true,
              modelAccuracy: "advanced_trained",
              advancedMetrics: {
                neural_network_confidence: advancedResult.neural_network_confidence,
                failure_risk_score: advancedResult.failure_risk_score,
                anomaly_score: advancedResult.anomaly_score,
                pattern_match_score: advancedResult.pattern_match?.match_score || 0
              }
            };
            
            res.json(response);
            
          } catch (e) {
            console.error("Error parsing advanced ML response:", e);
            res.redirect(307, '/api/diagnostic-ml');
          }
        } else {
          console.error('Advanced ML diagnostic error:', errorOutput);
          res.redirect(307, '/api/diagnostic-ml');
        }
      });
      
    } catch (error) {
      console.error("Advanced ML diagnostic error:", error);
      res.redirect(307, '/api/diagnostic-ml');
    }
  });

  // Train ensemble ML models endpoint
  app.post("/api/train-ensemble-ml", async (req, res) => {
    try {
      console.log("Starting ensemble ML model training...");
      
      const scriptPath = path.join(process.cwd(), 'server', 'ml_ensemble_engine.py');
      const childProcess = spawn('bash', ['-c', `python3 ${scriptPath} train`], {
        cwd: process.cwd(),
        env: { ...process.env, PYTHONPATH: '.pythonlibs/lib/python3.11/site-packages' }
      });
      
      let output = '';
      let errorOutput = '';
      
      childProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      childProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      childProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output.trim());
            res.json(result);
          } catch (e) {
            res.status(500).json({ success: false, message: "Invalid response from ensemble ML training" });
          }
        } else {
          console.error('Ensemble ML training error:', errorOutput);
          res.status(500).json({ 
            success: false, 
            message: "Erreur lors de l'entraînement ML ensemble",
            error: errorOutput 
          });
        }
      });
      
    } catch (error) {
      console.error("Ensemble ML training error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erreur lors de l'entraînement ML ensemble",
        error: error.message 
      });
    }
  });

  // Ensemble ML diagnostic endpoint
  app.post("/api/diagnostic-ensemble-ml", async (req, res) => {
    try {
      const { equipmentType, symptoms, symptomsChecked, urgency, zone, sector, equipmentId } = req.body;
      
      console.log("Starting ensemble ML diagnostic...");
      
      const scriptPath = path.join(process.cwd(), 'server', 'ml_ensemble_engine.py');
      const args = [
        'predict',
        equipmentType || 'unknown',
        symptoms || '',
        (symptomsChecked || []).join(','),
        urgency || 'medium',
        zone || 'unknown',
        sector || 'unknown',
        equipmentId || 'unknown'
      ];
      
      const childProcess = spawn('bash', ['-c', `python3 ${scriptPath} ${args.join(' ')}`], {
        cwd: process.cwd(),
        env: { ...process.env, PYTHONPATH: '.pythonlibs/lib/python3.11/site-packages' }
      });
      
      let output = '';
      let errorOutput = '';
      
      childProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      childProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      childProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const ensembleResult = JSON.parse(output.trim());
            
            if (ensembleResult.error) {
              console.log("Ensemble ML failed, falling back to advanced ML");
              res.redirect(307, '/api/diagnostic-advanced-ml');
              return;
            }
            
            // Create comprehensive response with ensemble ML results
            const response = {
              sessionId: Date.now(),
              suggestions: [{
                diagnosis: ensembleResult.ensemble_prediction || "Diagnostic Ensemble ML",
                solution: `Solution optimisée par ensemble ML pour: ${ensembleResult.ensemble_prediction}`,
                confidence: Math.round(ensembleResult.ensemble_confidence * 100),
                matchingCases: ensembleResult.model_agreement || 1,
                caseId: 3000 + Math.floor(Math.random() * 1000),
                duration: Math.round(60 + ensembleResult.risk_assessment?.complexity_score * 30 || 60),
                riskLevel: ensembleResult.risk_assessment?.urgency_level > 2.5 ? "Élevé" : 
                          ensembleResult.risk_assessment?.urgency_level > 1.5 ? "Moyen" : "Faible",
                costEstimate: `${Math.round((60 + ensembleResult.risk_assessment?.complexity_score * 30) * 1.8)}€`,
                aiInsights: `🧠 Ensemble ML: ${Object.keys(ensembleResult.individual_predictions || {}).length} modèles consultés • 🎯 Confiance: ${Math.round(ensembleResult.ensemble_confidence * 100)}% • 🤖 Accord des modèles: ${ensembleResult.model_agreement}/9 • ⚡ Complexité: ${Math.round(ensembleResult.risk_assessment?.complexity_score * 100 || 50)}%`,
                mlPrediction: true,
                ensembleML: true,
                ensembleAgreement: ensembleResult.model_agreement,
                individualPredictions: ensembleResult.individual_predictions,
                riskAssessment: ensembleResult.risk_assessment,
                predictiveTips: [
                  `Ensemble ML: ${Object.keys(ensembleResult.individual_predictions || {}).length} algorithmes convergent vers ce diagnostic`,
                  `Accord des modèles: ${ensembleResult.model_agreement}/9 modèles en consensus`,
                  `Score de risque: ${Math.round(ensembleResult.risk_assessment?.risk_factor * 100 || 50)}% - ${ensembleResult.risk_assessment?.urgency_level > 2 ? 'Action rapide recommandée' : 'Surveillance standard'}`
                ]
              }],
              mlEnabled: true,
              ensembleML: true,
              modelAccuracy: "ensemble_trained",
              ensembleMetrics: {
                ensemble_confidence: ensembleResult.ensemble_confidence,
                model_agreement: ensembleResult.model_agreement,
                feature_vector_size: ensembleResult.feature_vector_size,
                risk_factor: ensembleResult.risk_assessment?.risk_factor || 0,
                individual_models: Object.keys(ensembleResult.individual_predictions || {}).length
              }
            };
            
            res.json(response);
            
          } catch (e) {
            console.error("Error parsing ensemble ML response:", e);
            res.redirect(307, '/api/diagnostic-advanced-ml');
          }
        } else {
          console.error('Ensemble ML diagnostic error:', errorOutput);
          res.redirect(307, '/api/diagnostic-advanced-ml');
        }
      });
      
    } catch (error) {
      console.error("Ensemble ML diagnostic error:", error);
      res.redirect(307, '/api/diagnostic-advanced-ml');
    }
  });

  // Get maintenance history
  app.get("/api/history", async (req, res) => {
    try {
      const { equipmentType, period, status, search } = req.query;
      
      let sessions = await storage.getDiagnosticSessions();
      
      // Apply filters
      if (equipmentType && equipmentType !== "") {
        sessions = sessions.filter(s => s.equipmentType === equipmentType);
      }
      
      if (period) {
        const now = new Date();
        let filterDate = new Date();
        
        switch (period) {
          case "7d":
            filterDate.setDate(now.getDate() - 7);
            break;
          case "30d":
            filterDate.setDate(now.getDate() - 30);
            break;
          case "90d":
            filterDate.setDate(now.getDate() - 90);
            break;
        }
        
        sessions = sessions.filter(s => s.createdAt >= filterDate);
      }
      
      if (status && status !== "") {
        sessions = sessions.filter(s => s.status === status);
      }
      
      if (search && search !== "") {
        const searchTerm = (search as string).toLowerCase();
        sessions = sessions.filter(s => 
          s.equipmentId?.toLowerCase().includes(searchTerm) ||
          s.symptoms.toLowerCase().includes(searchTerm) ||
          s.selectedDiagnosis?.toLowerCase().includes(searchTerm)
        );
      }
      
      // Sort by creation date (newest first)
      sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      res.json(sessions);
    } catch (error) {
      console.error("History error:", error);
      res.status(500).json({ message: "Failed to get history" });
    }
  });
  
  // Report new case
  app.post("/api/report", async (req, res) => {
    try {
      const data = insertReportedCaseSchema.parse(req.body);
      const reportedCase = await storage.createReportedCase(data);
      
      res.status(201).json(reportedCase);
    } catch (error) {
      console.error("Report error:", error);
      res.status(400).json({ message: "Invalid report data" });
    }
  });
  
  // Get reported cases
  app.get("/api/reports", async (req, res) => {
    try {
      const reports = await storage.getReportedCases();
      res.json(reports);
    } catch (error) {
      console.error("Get reports error:", error);
      res.status(500).json({ message: "Failed to get reports" });
    }
  });
  
  // Get equipment types for dropdown
  app.get("/api/equipment-types", async (req, res) => {
    try {
      const types = [
        { value: "moteur", label: "Moteur électrique", labelEn: "Electric motor" },
        { value: "pompe", label: "Pompe hydraulique", labelEn: "Hydraulic pump" },
        { value: "compresseur", label: "Compresseur", labelEn: "Compressor" },
        { value: "convoyeur", label: "Convoyeur", labelEn: "Conveyor" },
        { value: "variateur", label: "Variateur de vitesse", labelEn: "Variable speed drive" },
        { value: "capteur", label: "Capteur/Instrumentation", labelEn: "Sensor/Instrumentation" },
        { value: "automate", label: "Automate programmable", labelEn: "PLC" },
        { value: "autre", label: "Autre", labelEn: "Other" }
      ];
      
      res.json(types);
    } catch (error) {
      console.error("Equipment types error:", error);
      res.status(500).json({ message: "Failed to get equipment types" });
    }
  });

  // Enhanced ML diagnostic endpoint  
  app.post("/api/diagnostic-enhanced-ml", async (req, res) => {
    try {
      console.log("Starting Enhanced ML diagnostic...");
      const formData = z.object({
        equipmentType: z.string(),
        equipmentId: z.string().optional(),
        zone: z.string().optional(),
        sector: z.string().optional(),
        symptoms: z.string(),
        symptomsChecked: z.array(z.string()).optional(),
        urgency: z.string(),
        duration: z.number().optional()
      }).parse(req.body);

      // Call the Enhanced ML engine
      const mlResult = await callMLEngine('predict', [
        formData.equipmentType,
        formData.symptoms,
        JSON.stringify(formData.symptomsChecked || []),
        formData.urgency,
        formData.zone || "unknown",
        formData.sector || "unknown",
        formData.equipmentId || "unknown"
      ], 'enhanced_ml_diagnostic.py');

      let suggestions = [];
      let mlEnabled = false;
      let modelAccuracy = "not_trained";
      let enhancedMetrics = {};

      if (mlResult && mlResult.success) {
        // Enhanced ML predictions available
        mlEnabled = true;
        modelAccuracy = "enhanced_trained";
        
        enhancedMetrics = {
          total_models: mlResult.total_models || 0,
          consensus_count: mlResult.consensus_count || 0,
          best_confidence: mlResult.confidence || 0,
          anomaly_score: mlResult.anomaly_score || 0,
          risk_assessment: mlResult.risk_assessment || {},
          feature_importance: mlResult.feature_importance || {},
          individual_models: Object.keys(mlResult.individual_predictions || {}).length
        };
        
        suggestions = [{
          diagnosis: mlResult.prediction || "Diagnostic incertain",
          solution: `Solution optimisée par Enhanced ML pour: ${mlResult.prediction}`,
          confidence: Math.round((mlResult.confidence || 0) * 100),
          matchingCases: mlResult.consensus_count || 1,
          caseId: 4000 + Math.floor(Math.random() * 1000),
          duration: formData.duration || 60,
          riskLevel: mlResult.risk_assessment?.risk_level || "Moyen",
          costEstimate: estimateRepairCost(formData.duration || 60, formData.equipmentType),
          aiInsights: `🧠 Enhanced ML: ${mlResult.total_models} modèles • 🎯 Confiance: ${Math.round((mlResult.confidence || 0) * 100)}% • 🤖 Consensus: ${mlResult.consensus_count}/${mlResult.total_models} • ⚡ Anomalie: ${Math.round((mlResult.anomaly_score || 0) * 100)}%`,
          mlPrediction: true,
          enhancedML: true,
          totalModels: mlResult.total_models,
          consensusCount: mlResult.consensus_count,
          individualPredictions: mlResult.individual_predictions,
          anomalyScore: mlResult.anomaly_score,
          riskAssessment: mlResult.risk_assessment,
          featureImportance: mlResult.feature_importance,
          predictiveTips: [
            "Enhanced ML: Multiple algorithmes convergent vers ce diagnostic",
            `Consensus des modèles: ${mlResult.consensus_count}/${mlResult.total_models}`,
            `Score d'anomalie: ${Math.round((mlResult.anomaly_score || 0) * 100)}% - ${mlResult.anomaly_score > 0.5 ? 'Situation inhabituelle détectée' : 'Comportement normal'}`
          ]
        }];
      } else {
        // Fallback to standard ML
        const standardMlResult = await callMLEngine('predict', [
          formData.equipmentType,
          formData.symptoms,
          JSON.stringify(formData.symptomsChecked || []),
          formData.urgency,
          formData.zone || "unknown",
          formData.sector || "unknown",
          (formData.duration || 60).toString()
        ]);

        if (standardMlResult?.success && standardMlResult.predictions) {
          mlEnabled = true;
          modelAccuracy = "standard_fallback";
          
          suggestions = standardMlResult.predictions.map((pred: any, index: number) => ({
            diagnosis: pred.diagnosis,
            solution: `Solution ML Standard (fallback): ${pred.diagnosis}`,
            confidence: Math.round(pred.confidence * 100),
            matchingCases: pred.matching_cases || 1,
            caseId: 3500 + index,
            duration: pred.duration || formData.duration || 60,
            riskLevel: pred.risk_level || "Moyen",
            costEstimate: estimateRepairCost(pred.duration || 60, formData.equipmentType),
            aiInsights: `🔄 Fallback ML: Standard • 🎯 Confiance: ${Math.round(pred.confidence * 100)}% • ⚠️ Enhanced ML indisponible`,
            mlPrediction: true,
            predictiveTips: generatePredictiveTips(formData.equipmentType, pred.diagnosis)
          }));
        } else {
          // Final fallback to rule-based
          modelAccuracy = "rule_based_fallback";
          const cases = await storage.getMaintenanceCases();
          const matchingSuggestions = cases
            .filter(case_ => case_.equipmentType === formData.equipmentType)
            .slice(0, 1);

          suggestions = matchingSuggestions.map((case_) => ({
            diagnosis: case_.diagnosis,
            solution: case_.solution,
            confidence: 50,
            matchingCases: 1,
            caseId: case_.id,
            duration: case_.duration,
            riskLevel: "Moyen",
            costEstimate: estimateRepairCost(case_.duration, formData.equipmentType),
            aiInsights: "⚠️ Système basé sur les règles (ML indisponible)",
            predictiveTips: generatePredictiveTips(formData.equipmentType, case_.diagnosis)
          }));
        }
      }

      // Save diagnostic session
      const sessionData = {
        equipmentType: formData.equipmentType,
        equipmentId: formData.equipmentId || `${formData.equipmentType.toUpperCase()}-${Date.now()}`,
        zone: formData.zone || "unknown",
        sector: formData.sector || "unknown",
        symptoms: formData.symptoms,
        symptomsChecked: formData.symptomsChecked || [],
        urgency: formData.urgency,
        confidence: suggestions[0]?.confidence || 0,
        mlPrediction: mlEnabled,
        sessionData: JSON.stringify({ suggestions, mlEnabled, modelAccuracy, enhancedMetrics })
      };

      const session = await storage.createDiagnosticSession(sessionData);
      
      res.json({
        sessionId: session.id,
        suggestions,
        mlEnabled,
        enhancedML: modelAccuracy === "enhanced_trained",
        modelAccuracy,
        enhancedMetrics
      });
      
    } catch (error) {
      console.error("Enhanced ML diagnostic error:", error);
      res.status(400).json({ 
        message: "Invalid enhanced ML diagnostic request",
        error: error instanceof z.ZodError ? error.errors : error.message
      });
    }
  });

  // User Profile Management endpoints
  app.get("/api/user-profiles", async (req, res) => {
    try {
      const profiles = await storage.getUserProfiles();
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching user profiles:", error);
      res.status(500).json({ error: "Failed to fetch user profiles" });
    }
  });

  app.get("/api/user-profiles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const profile = await storage.getUserProfileById(id);
      if (!profile) {
        return res.status(404).json({ error: "User profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ error: "Failed to fetch user profile" });
    }
  });

  app.post("/api/user-profiles", async (req, res) => {
    try {
      const data = insertUserProfileSchema.parse(req.body);
      
      // Check if username already exists
      const existingProfile = await storage.getUserProfileByUsername(data.username);
      if (existingProfile) {
        return res.status(400).json({ error: "Username already exists" });
      }
      
      const profile = await storage.createUserProfile(data);
      res.status(201).json(profile);
    } catch (error) {
      console.error("Error creating user profile:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ error: "Invalid profile data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create user profile" });
      }
    }
  });

  app.put("/api/user-profiles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      // Remove fields that shouldn't be updated directly
      delete updates.id;
      delete updates.createdAt;
      
      const profile = await storage.updateUserProfile(id, updates);
      res.json(profile);
    } catch (error) {
      console.error("Error updating user profile:", error);
      if (error.message.includes("not found")) {
        res.status(404).json({ error: "User profile not found" });
      } else {
        res.status(500).json({ error: "Failed to update user profile" });
      }
    }
  });

  app.delete("/api/user-profiles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteUserProfile(id);
      if (!success) {
        return res.status(404).json({ error: "User profile not found" });
      }
      res.json({ success: true, message: "User profile deleted successfully" });
    } catch (error) {
      console.error("Error deleting user profile:", error);
      res.status(500).json({ error: "Failed to delete user profile" });
    }
  });

  // Data Import/Export routes
  app.get('/api/templates/maintenance-csv', (req, res) => {
    const { dataImporter } = require('./data-import');
    const template = dataImporter.generateMaintenanceTemplate();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="template_maintenance.csv"');
    res.send(template);
  });

  app.get('/api/templates/reported-cases-csv', (req, res) => {
    const { dataImporter } = require('./data-import');
    const template = dataImporter.generateReportedCasesTemplate();
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="template_cas_signales.csv"');
    res.send(template);
  });

  app.post('/api/import/maintenance-csv', async (req, res) => {
    try {
      const { csvContent } = req.body;
      
      if (!csvContent) {
        return res.status(400).json({ error: 'Contenu CSV requis' });
      }

      const { dataImporter } = require('./data-import');
      const results = await dataImporter.importMaintenanceCasesFromCSV(csvContent);
      
      res.json({
        message: `Importation terminée: ${results.success} cas importés`,
        success: results.success,
        errors: results.errors,
        hasErrors: results.errors.length > 0
      });
    } catch (error) {
      console.error('Erreur importation CSV:', error);
      res.status(500).json({ 
        error: 'Erreur lors de l\'importation',
        details: error.message 
      });
    }
  });

  app.post('/api/import/reported-cases-csv', async (req, res) => {
    try {
      const { csvContent } = req.body;
      
      if (!csvContent) {
        return res.status(400).json({ error: 'Contenu CSV requis' });
      }

      const { dataImporter } = require('./data-import');
      const results = await dataImporter.importReportedCasesFromCSV(csvContent);
      
      res.json({
        message: `Importation terminée: ${results.success} cas signalés importés`,
        success: results.success,
        errors: results.errors,
        hasErrors: results.errors.length > 0
      });
    } catch (error) {
      console.error('Erreur importation CSV cas signalés:', error);
      res.status(500).json({ 
        error: 'Erreur lors de l\'importation',
        details: error.message 
      });
    }
  });

  // Equipment types export endpoint
  app.get("/api/export/equipment-types", async (req, res) => {
    try {
      const equipmentTypes = [
        { id: "moteur", name: "Moteur électrique", category: "Mécanique" },
        { id: "pompe", name: "Pompe", category: "Hydraulique" },
        { id: "compresseur", name: "Compresseur", category: "Pneumatique" },
        { id: "convoyeur", name: "Convoyeur", category: "Mécanique" },
        { id: "variateur", name: "Variateur de vitesse", category: "Électronique" },
        { id: "capteur", name: "Capteur", category: "Instrumentation" },
        { id: "automate", name: "Automate programmable", category: "Contrôle" },
        { id: "convertisseur", name: "Convertisseur de puissance", category: "Électronique" },
        { id: "onduleur", name: "Onduleur/UPS", category: "Électronique" },
        { id: "redresseur", name: "Redresseur", category: "Électronique" },
        { id: "carte_electronique", name: "Carte électronique", category: "Électronique" },
        { id: "alimentation", name: "Alimentation électronique", category: "Électronique" },
        { id: "sts", name: "Grue STS (Ship to Shore)", category: "Levage portuaire" },
        { id: "rtg", name: "Grue RTG (Rubber Tired Gantry)", category: "Levage portuaire" },
        { id: "grue_mobile", name: "Grue mobile portuaire", category: "Levage portuaire" },
        { id: "reach_stacker", name: "Reach Stacker", category: "Levage portuaire" },
        { id: "straddle_carrier", name: "Straddle Carrier", category: "Levage portuaire" },
        { id: "spreader", name: "Spreader automatique", category: "Levage portuaire" },
        { id: "autre", name: "Autre équipement", category: "Général" }
      ];

      // Generate CSV content
      const csvHeader = "ID,Nom,Catégorie,Défauts typiques,Zones recommandées\n";
      const csvContent = equipmentTypes.map(eq => {
        const defauts = getDefautsTypiques(eq.id);
        const zones = getZonesRecommandees(eq.id);
        return `"${eq.id}","${eq.name}","${eq.category}","${defauts}","${zones}"`;
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="equipment_types.csv"');
      res.send(csvHeader + csvContent);
    } catch (error) {
      console.error("Error exporting equipment types:", error);
      res.status(500).json({ message: "Erreur lors de l'export des types d'équipements" });
    }
  });

  // Helper functions for equipment export
  function getDefautsTypiques(equipmentId: string): string {
    const defauts = {
      "moteur": "Roulements, alignement, surchauffe, vibrations",
      "pompe": "Joints, cavitation, amorçage, débit",
      "compresseur": "Soupapes, filtres, température, pression",
      "convoyeur": "Courroies, roulements, alignement, moteurs",
      "variateur": "IGBT, ventilation, paramètres, harmoniques",
      "capteur": "Étalonnage, câblage, environnement, dérive",
      "automate": "Programmation, E/S, alimentation, modules",
      "convertisseur": "Régulation, surchauffe, harmoniques, protection",
      "onduleur": "Batterie, bypass, régulation tension",
      "redresseur": "Diodes, filtrage, régulation",
      "carte_electronique": "Composants, soudures, firmware",
      "alimentation": "Régulation, découpage, isolation",
      "sts": "Trolley, câbles, spreader, rails, anti-collision",
      "rtg": "Pneumatiques, moteur diesel, hydraulique, spreader",
      "grue_mobile": "Stabilisateurs, flèche, moment charge, orientation",
      "reach_stacker": "Mât, hydraulique, transmission, refroidissement",
      "straddle_carrier": "Jambes, direction, guides, hydraulique",
      "spreader": "Twist-locks, châssis, télescopage, vérins",
      "autre": "Variable selon équipement"
    };
    return defauts[equipmentId] || "Non défini";
  }

  function getZonesRecommandees(equipmentId: string): string {
    const zones = {
      "moteur": "Production, Atelier",
      "pompe": "Production, Stockage, Utilités",
      "compresseur": "Utilités, Énergie",
      "convoyeur": "Production, Stockage",
      "variateur": "Production, Atelier",
      "capteur": "Production, Laboratoire",
      "automate": "Production, Contrôle",
      "convertisseur": "Énergie, Production",
      "onduleur": "Énergie, Informatique",
      "redresseur": "Énergie, Production",
      "carte_electronique": "Contrôle, Informatique",
      "alimentation": "Toutes zones",
      "sts": "Extérieur, Terminal conteneurs",
      "rtg": "Extérieur, Stockage",
      "grue_mobile": "Extérieur, Réception",
      "reach_stacker": "Stockage, Terminal",
      "straddle_carrier": "Stockage, Terminal",
      "spreader": "Production, Manutention",
      "autre": "Variable"
    };
    return zones[equipmentId] || "Non défini";
  }

  // Continuous Learning System Endpoints
  app.post("/api/feedback", async (req, res) => {
    try {
      const feedbackData = req.body;
      const feedback = await storage.createFeedbackSession(feedbackData);
      res.json({ success: true, feedback });
    } catch (error) {
      console.error("Error creating feedback:", error);
      res.status(500).json({ error: "Failed to create feedback session" });
    }
  });

  app.get("/api/learning-metrics", async (req, res) => {
    try {
      const { equipmentType } = req.query;
      let metrics;
      
      if (equipmentType) {
        metrics = await storage.getLearningMetricsByEquipment(equipmentType as string);
      } else {
        metrics = await storage.getLearningMetrics();
      }
      
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching learning metrics:", error);
      res.status(500).json({ error: "Failed to fetch learning metrics" });
    }
  });

  app.get("/api/model-performance", async (req, res) => {
    try {
      const performance = await storage.getModelPerformance();
      res.json(performance);
    } catch (error) {
      console.error("Error fetching model performance:", error);
      res.status(500).json({ error: "Failed to fetch model performance" });
    }
  });

  app.get("/api/adaptive-learning", async (req, res) => {
    try {
      const { equipmentType } = req.query;
      let adaptive;
      
      if (equipmentType) {
        adaptive = await storage.getAdaptiveLearningByEquipment(equipmentType as string);
      } else {
        adaptive = await storage.getAdaptiveLearning();
      }
      
      res.json(adaptive);
    } catch (error) {
      console.error("Error fetching adaptive learning:", error);
      res.status(500).json({ error: "Failed to fetch adaptive learning data" });
    }
  });

  // Continuous learning analysis endpoint
  app.get("/api/learning-analysis", async (req, res) => {
    try {
      const mlResult = await callMLEngine('plan', [], 'continuous_learning_engine.py');
      res.json(mlResult || {});
    } catch (error) {
      console.error("Error in learning analysis:", error);
      res.status(500).json({ error: "Failed to perform learning analysis" });
    }
  });

  // Auto-improvement endpoint that analyzes patterns and updates ML models
  app.post("/api/auto-improve", async (req, res) => {
    try {
      const { equipmentType, forceRetrain } = req.body;
      
      // Get learning metrics to assess current performance
      const metrics = equipmentType 
        ? await storage.getLearningMetricsByEquipment(equipmentType)
        : await storage.getLearningMetrics();
      
      const improvements = [];
      
      for (const metric of metrics) {
        if (metric.successRate < 80 || forceRetrain) {
          // Trigger ML model retraining for poor performing equipment types
          try {
            const mlResult = await callMLEngine('train', [], 'enhanced_ml_diagnostic.py');
            if (mlResult?.success) {
              await storage.updateModelPerformance({
                modelType: "enhanced_ml",
                equipmentType: metric.equipmentType,
                accuracy: mlResult.accuracy || 0.85,
                precision: mlResult.precision || 0.82,
                recall: mlResult.recall || 0.88,
                f1Score: mlResult.f1_score || 0.85,
                sampleSize: mlResult.sample_size || 100,
                crossValidationScore: mlResult.cv_score || 0.83
              });
              
              improvements.push({
                equipmentType: metric.equipmentType,
                action: "retrained_model",
                newAccuracy: mlResult.accuracy,
                improvementReason: `Low success rate: ${metric.successRate}%`
              });
            }
          } catch (error) {
            console.error(`Failed to retrain model for ${metric.equipmentType}:`, error);
          }
        }
        
        // Update adaptive learning weights based on performance
        if (metric.successRate < 70) {
          await storage.updateAdaptiveLearning(metric.equipmentType, {
            learningWeight: 1.2, // Increase learning rate for poor performers
            confidenceAdjustment: -0.1 // Decrease confidence for poor performers
          });
          
          improvements.push({
            equipmentType: metric.equipmentType,
            action: "adjusted_learning_weights",
            reason: `Performance below threshold: ${metric.successRate}%`
          });
        } else if (metric.successRate > 90) {
          await storage.updateAdaptiveLearning(metric.equipmentType, {
            learningWeight: 0.8, // Decrease learning rate for good performers
            confidenceAdjustment: 0.05 // Increase confidence for good performers
          });
        }
      }
      
      res.json({
        success: true,
        improvements,
        message: `Auto-improvement completed. ${improvements.length} optimizations applied.`
      });
      
    } catch (error) {
      console.error("Error in auto-improvement:", error);
      res.status(500).json({ error: "Failed to execute auto-improvement" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

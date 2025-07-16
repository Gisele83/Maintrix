import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMaintenanceCaseSchema, insertReportedCaseSchema, insertDiagnosticSessionSchema, insertUserProfileSchema } from "@shared/schema";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";

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
    autre: 1.0
  };
  
  const multiplier = equipmentMultipliers[equipmentType as keyof typeof equipmentMultipliers] || 1.0;
  const estimatedCost = Math.round((duration / 60) * baseCostPerHour * multiplier);
  
  return `${estimatedCost}€`;
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
      "default": "Diagnostic électrique approfondi et réparation"
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
  
  // ML Diagnostic endpoint - enhanced with machine learning
  app.post("/api/diagnostic-ml", async (req, res) => {
    try {
      const data = insertDiagnosticSessionSchema.parse(req.body);
      
      // Create diagnostic session
      const session = await storage.createDiagnosticSession(data);
      
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
      
      // Enhanced AI-powered diagnostic algorithm
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
        
        // Equipment type exact match bonus
        const equipmentBonus = case_.equipmentType === data.equipmentType ? 0.2 : 0;
        
        // Zone/location context similarity
        const locationBonus = case_.zone === data.zone ? 0.1 : 0;
        
        // Urgency level matching
        const urgencyBonus = case_.urgency === data.urgency ? 0.1 : 0;
        
        // Calculate comprehensive match score
        const totalSymptoms = Math.max((data.symptomsChecked || []).length, 1);
        const symptomScore = symptomMatches / totalSymptoms;
        
        // Weighted confidence calculation (ML-inspired)
        const baseConfidence = case_.confidence || 0.5;
        const adjustedConfidence = Math.min(
          baseConfidence * (
            0.4 * symptomScore + 
            0.3 * textSimilarity + 
            0.2 * equipmentBonus + 
            0.05 * locationBonus + 
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
          aiInsights: generateAIInsights(case_, symptomScore, textSimilarity)
        };
      })
      .filter(suggestion => suggestion.confidence > 5) // Very permissive filter
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 4); // Return top 4 suggestions
      
      // Add predictive maintenance recommendations if confidence is high
      if (suggestions.length > 0 && suggestions[0].confidence > 80) {
        suggestions[0].predictiveTips = generatePredictiveTips(
          data.equipmentType, 
          suggestions[0].diagnosis
        );
      }
      
      // Update session with results
      await storage.updateDiagnosticSession(session.id, {
        results: JSON.stringify(suggestions),
        status: "completed"
      });
      
      res.json({
        sessionId: session.id,
        suggestions
      });
    } catch (error) {
      console.error("Diagnostic error:", error);
      res.status(400).json({ message: "Invalid diagnostic request" });
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

  const httpServer = createServer(app);
  return httpServer;
}

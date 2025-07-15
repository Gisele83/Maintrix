import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMaintenanceCaseSchema, insertReportedCaseSchema, insertDiagnosticSessionSchema } from "@shared/schema";
import { z } from "zod";
import { spawn } from "child_process";
import path from "path";

// ML Helper Functions
async function callMLEngine(command: string, args: string[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'server', 'ml_diagnostic_engine.py');
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
  
  if (symptomScore > 0.7) {
    insights.push("Symptômes très similaires détectés");
  }
  
  if (textSimilarity > 0.5) {
    insights.push("Description correspondante trouvée");
  }
  
  if (case_.resolved && case_.confidence && case_.confidence > 0.85) {
    insights.push("Solution validée avec succès");
  }
  
  if (case_.duration && case_.duration < 60) {
    insights.push("Réparation rapide probable");
  }
  
  return insights.length > 0 ? insights.join(" • ") : "Analyse basée sur l'historique";
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
          console.warn('ML prediction failed, falling back to rule-based system:', mlResult.error);
          // Fall back to traditional diagnostic
          return res.redirect(307, '/api/diagnostic');
        }
        
        // Transform ML results to match expected format
        const suggestions = mlResult.predictions?.map((pred: any, index: number) => ({
          diagnosis: pred.diagnosis,
          solution: `Solution ML pour: ${pred.diagnosis}`, // We'll need to enhance this
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
        console.warn('ML engine failed, falling back to rule-based system:', mlError);
        // Fall back to traditional diagnostic approach
        return res.redirect(307, '/api/diagnostic');
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
      const procedures = await storage.getRepairProceduresByCaseId(caseId);
      const maintenanceCase = await storage.getMaintenanceCaseById(caseId);
      
      if (!maintenanceCase) {
        return res.status(404).json({ message: "Case not found" });
      }
      
      res.json({
        case: maintenanceCase,
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

  const httpServer = createServer(app);
  return httpServer;
}

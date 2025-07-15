import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMaintenanceCaseSchema, insertReportedCaseSchema, insertDiagnosticSessionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Diagnostic endpoint - analyze symptoms and return suggestions
  app.post("/api/diagnostic", async (req, res) => {
    try {
      const data = insertDiagnosticSessionSchema.parse(req.body);
      
      // Create diagnostic session
      const session = await storage.createDiagnosticSession(data);
      
      // Search for similar cases based on equipment type and symptoms
      const similarCases = await storage.searchMaintenanceCases({
        equipmentType: data.equipmentType,
        symptoms: data.symptomsChecked || []
      });
      
      // Calculate diagnostic suggestions with confidence scores
      const suggestions = similarCases.map(case_ => {
        const symptomMatches = (data.symptomsChecked || []).filter(symptom => 
          (case_.symptomsChecked || []).includes(symptom)
        ).length;
        
        const totalSymptoms = Math.max((data.symptomsChecked || []).length, 1);
        const matchScore = symptomMatches / totalSymptoms;
        
        // Adjust confidence based on match score and historical confidence
        const adjustedConfidence = Math.min(
          (case_.confidence || 0.5) * (0.5 + matchScore * 0.5), 
          0.99
        );
        
        return {
          diagnosis: case_.diagnosis,
          solution: case_.solution,
          confidence: Math.round(adjustedConfidence * 100),
          matchingCases: 1,
          caseId: case_.id,
          duration: case_.duration
        };
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3); // Return top 3 suggestions
      
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

/**
 * Advanced Integrations Routes
 * Handles ERP/SCADA connectors, Advanced Predictive AI, and Power BI integration
 */

import type { Express } from "express";
import { z } from "zod";
import { db } from "./db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { 
  erpSystems, 
  scadaConnections, 
  dataIntegrationLogs,
  aiModels,
  predictivePredictions,
  aiTrainingJobs,
  powerBiWorkspaces,
  powerBiReports,
  powerBiDatasets,
  reportingSchedules,
  equipmentRegistry,
  iotSensorData,
  insertERPSystemSchema,
  insertSCADAConnectionSchema,
  insertAIModelSchema,
  insertPredictivePredictionSchema,
  insertPowerBiWorkspaceSchema,
  insertPowerBiReportSchema,
  insertPowerBiDatasetSchema,
  insertReportingScheduleSchema,
} from "@shared/schema";

// =======================
// ERP/SCADA CONNECTOR ROUTES
// =======================

export function registerAdvancedIntegrationRoutes(app: Express) {

  // ============= ERP SYSTEMS =============
  
  // Get all ERP systems for tenant
  app.get("/api/erp-systems", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || "default-tenant";
      
      const systems = await db
        .select()
        .from(erpSystems)
        .where(eq(erpSystems.tenantId, tenantId))
        .orderBy(desc(erpSystems.createdAt));
        
      res.json(systems);
    } catch (error) {
      console.error("Error fetching ERP systems:", error);
      res.status(500).json({ error: "Failed to fetch ERP systems" });
    }
  });

  // Create new ERP system connection
  app.post("/api/erp-systems", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || "default-tenant";
      const validatedData = insertERPSystemSchema.parse({
        ...req.body,
        tenantId
      });

      const [system] = await db
        .insert(erpSystems)
        .values(validatedData)
        .returning();

      res.status(201).json(system);
    } catch (error) {
      console.error("Error creating ERP system:", error);
      res.status(400).json({ error: "Failed to create ERP system" });
    }
  });

  // Test ERP system connection
  app.post("/api/erp-systems/:id/test", async (req, res) => {
    try {
      const systemId = req.params.id;
      
      const [system] = await db
        .select()
        .from(erpSystems)
        .where(eq(erpSystems.id, systemId));

      if (!system) {
        return res.status(404).json({ error: "ERP system not found" });
      }

      // Simulate connection test based on system type
      const testResult = await testERPConnection(system);
      
      res.json(testResult);
    } catch (error) {
      console.error("Error testing ERP connection:", error);
      res.status(500).json({ error: "Failed to test ERP connection" });
    }
  });

  // Synchronize data from ERP system
  app.post("/api/erp-systems/:id/sync", async (req, res) => {
    try {
      const systemId = req.params.id;
      const { entityTypes } = req.body; // Array of entity types to sync
      
      const [system] = await db
        .select()
        .from(erpSystems)
        .where(eq(erpSystems.id, systemId));

      if (!system) {
        return res.status(404).json({ error: "ERP system not found" });
      }

      // Perform synchronization
      const syncResult = await performERPSync(system, entityTypes);
      
      // Log the integration
      await db.insert(dataIntegrationLogs).values({
        tenantId: system.tenantId,
        sourceSystem: system.systemName,
        operationType: "sync",
        entityType: "multiple",
        recordCount: syncResult.totalRecords,
        successCount: syncResult.successfulRecords,
        errorCount: syncResult.failedRecords,
        status: syncResult.failedRecords > 0 ? "partial" : "success",
        errorDetails: syncResult.errors,
        executionTime: syncResult.executionTime,
      });

      res.json(syncResult);
    } catch (error) {
      console.error("Error syncing ERP data:", error);
      res.status(500).json({ error: "Failed to sync ERP data" });
    }
  });

  // ============= SCADA CONNECTIONS =============
  
  // Get all SCADA connections
  app.get("/api/scada-connections", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || "default-tenant";
      
      const connections = await db
        .select()
        .from(scadaConnections)
        .where(eq(scadaConnections.tenantId, tenantId))
        .orderBy(desc(scadaConnections.createdAt));
        
      res.json(connections);
    } catch (error) {
      console.error("Error fetching SCADA connections:", error);
      res.status(500).json({ error: "Failed to fetch SCADA connections" });
    }
  });

  // Create new SCADA connection
  app.post("/api/scada-connections", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || "default-tenant";
      const validatedData = insertSCADAConnectionSchema.parse({
        ...req.body,
        tenantId
      });

      const [connection] = await db
        .insert(scadaConnections)
        .values(validatedData)
        .returning();

      res.status(201).json(connection);
    } catch (error) {
      console.error("Error creating SCADA connection:", error);
      res.status(400).json({ error: "Failed to create SCADA connection" });
    }
  });

  // Test SCADA connection
  app.post("/api/scada-connections/:id/test", async (req, res) => {
    try {
      const connectionId = req.params.id;
      
      const [connection] = await db
        .select()
        .from(scadaConnections)
        .where(eq(scadaConnections.id, connectionId));

      if (!connection) {
        return res.status(404).json({ error: "SCADA connection not found" });
      }

      const testResult = await testSCADAConnection(connection);
      
      res.json(testResult);
    } catch (error) {
      console.error("Error testing SCADA connection:", error);
      res.status(500).json({ error: "Failed to test SCADA connection" });
    }
  });

  // ============= ADVANCED PREDICTIVE AI =============
  
  // Get all AI models
  app.get("/api/ai-models", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || "default-tenant";
      
      const models = await db
        .select()
        .from(aiModels)
        .where(eq(aiModels.tenantId, tenantId))
        .orderBy(desc(aiModels.createdAt));
        
      res.json(models);
    } catch (error) {
      console.error("Error fetching AI models:", error);
      res.status(500).json({ error: "Failed to fetch AI models" });
    }
  });

  // Create new AI model
  app.post("/api/ai-models", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || "default-tenant";
      const validatedData = insertAIModelSchema.parse({
        ...req.body,
        tenantId
      });

      const [model] = await db
        .insert(aiModels)
        .values(validatedData)
        .returning();

      res.status(201).json(model);
    } catch (error) {
      console.error("Error creating AI model:", error);
      res.status(400).json({ error: "Failed to create AI model" });
    }
  });

  // Train AI model
  app.post("/api/ai-models/:id/train", async (req, res) => {
    try {
      const modelId = req.params.id;
      const { hyperParameters, dataFilters } = req.body;
      
      const [model] = await db
        .select()
        .from(aiModels)
        .where(eq(aiModels.id, modelId));

      if (!model) {
        return res.status(404).json({ error: "AI model not found" });
      }

      // Create training job
      const [trainingJob] = await db
        .insert(aiTrainingJobs)
        .values({
          tenantId: model.tenantId,
          modelId,
          jobType: "retraining",
          status: "pending",
          hyperParameters,
          startedAt: new Date(),
        })
        .returning();

      // Start training process (async)
      const trainingResult = await startModelTraining(model, hyperParameters, dataFilters);
      
      res.json({
        trainingJobId: trainingJob.id,
        status: "started",
        estimatedDuration: trainingResult.estimatedDuration
      });
    } catch (error) {
      console.error("Error training AI model:", error);
      res.status(500).json({ error: "Failed to train AI model" });
    }
  });

  // Get predictions for equipment
  app.get("/api/equipment/:equipmentId/predictions", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.equipmentId);
      
      const predictions = await db
        .select({
          prediction: predictivePredictions,
          model: aiModels,
        })
        .from(predictivePredictions)
        .innerJoin(aiModels, eq(predictivePredictions.modelId, aiModels.id))
        .where(
          and(
            eq(predictivePredictions.equipmentId, equipmentId),
            gte(predictivePredictions.validUntil, new Date())
          )
        )
        .orderBy(desc(predictivePredictions.createdAt));
        
      res.json(predictions);
    } catch (error) {
      console.error("Error fetching predictions:", error);
      res.status(500).json({ error: "Failed to fetch predictions" });
    }
  });

  // Generate new prediction
  app.post("/api/equipment/:equipmentId/predict", async (req, res) => {
    try {
      const equipmentId = parseInt(req.params.equipmentId);
      const { modelType, predictionHorizon } = req.body;
      
      // Get latest sensor data for equipment
      const sensorData = await db
        .select()
        .from(iotSensorData)
        .where(eq(iotSensorData.equipmentId, equipmentId))
        .orderBy(desc(iotSensorData.timestamp))
        .limit(100);

      // Get appropriate AI model
      const [model] = await db
        .select()
        .from(aiModels)
        .where(
          and(
            eq(aiModels.modelType, modelType),
            eq(aiModels.isActive, true)
          )
        )
        .orderBy(desc(aiModels.accuracy))
        .limit(1);

      if (!model) {
        return res.status(404).json({ error: "No suitable AI model found" });
      }

      // Generate prediction
      const prediction = await generatePrediction(model, equipmentId, sensorData, predictionHorizon);
      
      // Save prediction
      const [savedPrediction] = await db
        .insert(predictivePredictions)
        .values({
          tenantId: model.tenantId,
          equipmentId,
          modelId: model.id,
          predictionType: modelType,
          predictedValue: prediction.value,
          predictedCategory: prediction.category,
          confidenceScore: prediction.confidence,
          predictionHorizon,
          inputFeatures: prediction.features,
          riskLevel: prediction.riskLevel,
          recommendedActions: prediction.actions,
          explanationFactors: prediction.explanation,
          validUntil: new Date(Date.now() + predictionHorizon * 24 * 60 * 60 * 1000),
        })
        .returning();
      
      res.json(savedPrediction);
    } catch (error) {
      console.error("Error generating prediction:", error);
      res.status(500).json({ error: "Failed to generate prediction" });
    }
  });

  // ============= POWER BI INTEGRATION =============
  
  // Get all Power BI workspaces
  app.get("/api/power-bi/workspaces", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || "default-tenant";
      
      const workspaces = await db
        .select()
        .from(powerBiWorkspaces)
        .where(eq(powerBiWorkspaces.tenantId, tenantId))
        .orderBy(desc(powerBiWorkspaces.createdAt));
        
      res.json(workspaces);
    } catch (error) {
      console.error("Error fetching Power BI workspaces:", error);
      res.status(500).json({ error: "Failed to fetch Power BI workspaces" });
    }
  });

  // Create Power BI workspace connection
  app.post("/api/power-bi/workspaces", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || "default-tenant";
      const validatedData = insertPowerBiWorkspaceSchema.parse({
        ...req.body,
        tenantId
      });

      const [workspace] = await db
        .insert(powerBiWorkspaces)
        .values(validatedData)
        .returning();

      res.status(201).json(workspace);
    } catch (error) {
      console.error("Error creating Power BI workspace:", error);
      res.status(400).json({ error: "Failed to create Power BI workspace" });
    }
  });

  // Get reports for workspace
  app.get("/api/power-bi/workspaces/:workspaceId/reports", async (req, res) => {
    try {
      const workspaceId = req.params.workspaceId;
      
      const reports = await db
        .select()
        .from(powerBiReports)
        .where(eq(powerBiReports.workspaceId, workspaceId))
        .orderBy(desc(powerBiReports.createdAt));
        
      res.json(reports);
    } catch (error) {
      console.error("Error fetching Power BI reports:", error);
      res.status(500).json({ error: "Failed to fetch Power BI reports" });
    }
  });

  // Create Power BI report
  app.post("/api/power-bi/reports", async (req, res) => {
    try {
      const validatedData = insertPowerBiReportSchema.parse(req.body);

      const [report] = await db
        .insert(powerBiReports)
        .values(validatedData)
        .returning();

      res.status(201).json(report);
    } catch (error) {
      console.error("Error creating Power BI report:", error);
      res.status(400).json({ error: "Failed to create Power BI report" });
    }
  });

  // Generate embed token for report
  app.post("/api/power-bi/reports/:reportId/embed-token", async (req, res) => {
    try {
      const reportId = req.params.reportId;
      
      const [report] = await db
        .select({
          report: powerBiReports,
          workspace: powerBiWorkspaces,
        })
        .from(powerBiReports)
        .innerJoin(powerBiWorkspaces, eq(powerBiReports.workspaceId, powerBiWorkspaces.id))
        .where(eq(powerBiReports.id, reportId));

      if (!report) {
        return res.status(404).json({ error: "Power BI report not found" });
      }

      // Generate embed token (simulation)
      const embedToken = await generatePowerBIEmbedToken(report.workspace, report.report);
      
      res.json({
        embedToken: embedToken.token,
        embedUrl: report.report.embedUrl,
        expiresAt: embedToken.expiresAt
      });
    } catch (error) {
      console.error("Error generating embed token:", error);
      res.status(500).json({ error: "Failed to generate embed token" });
    }
  });

  // Sync data to Power BI dataset
  app.post("/api/power-bi/datasets/:datasetId/refresh", async (req, res) => {
    try {
      const datasetId = req.params.datasetId;
      
      const [dataset] = await db
        .select({
          dataset: powerBiDatasets,
          workspace: powerBiWorkspaces,
        })
        .from(powerBiDatasets)
        .innerJoin(powerBiWorkspaces, eq(powerBiDatasets.workspaceId, powerBiWorkspaces.id))
        .where(eq(powerBiDatasets.id, datasetId));

      if (!dataset) {
        return res.status(404).json({ error: "Power BI dataset not found" });
      }

      // Refresh dataset
      const refreshResult = await refreshPowerBIDataset(dataset.workspace, dataset.dataset);
      
      res.json(refreshResult);
    } catch (error) {
      console.error("Error refreshing Power BI dataset:", error);
      res.status(500).json({ error: "Failed to refresh Power BI dataset" });
    }
  });

  // Get integration logs
  app.get("/api/integration-logs", async (req, res) => {
    try {
      const tenantId = (req as any).tenantId || "default-tenant";
      const { limit = 50, sourceSystem, entityType, status } = req.query;
      
      let whereConditions = [eq(dataIntegrationLogs.tenantId, tenantId)];

      if (sourceSystem) {
        whereConditions.push(eq(dataIntegrationLogs.sourceSystem, sourceSystem as string));
      }
      if (entityType) {
        whereConditions.push(eq(dataIntegrationLogs.entityType, entityType as string));
      }
      if (status) {
        whereConditions.push(eq(dataIntegrationLogs.status, status as string));
      }

      const query = db
        .select()
        .from(dataIntegrationLogs)
        .where(and(...whereConditions));

      const logs = await query
        .orderBy(desc(dataIntegrationLogs.createdAt))
        .limit(parseInt(limit as string));
        
      res.json(logs);
    } catch (error) {
      console.error("Error fetching integration logs:", error);
      res.status(500).json({ error: "Failed to fetch integration logs" });
    }
  });
}

// =======================
// HELPER FUNCTIONS
// =======================

async function testERPConnection(system: any) {
  // Simulate ERP connection test
  return {
    success: true,
    connectionTime: Math.random() * 1000 + 500,
    systemInfo: {
      version: "12.3.1",
      capabilities: ["work_orders", "equipment", "spare_parts"],
      lastSync: system.lastSyncAt,
    },
    message: `Successfully connected to ${system.systemName}`
  };
}

async function performERPSync(system: any, entityTypes: string[]) {
  // Simulate ERP synchronization
  const startTime = Date.now();
  
  // Mock sync results
  const totalRecords = Math.floor(Math.random() * 500) + 100;
  const successfulRecords = Math.floor(totalRecords * 0.85);
  const failedRecords = totalRecords - successfulRecords;
  
  return {
    totalRecords,
    successfulRecords,
    failedRecords,
    executionTime: Date.now() - startTime,
    errors: failedRecords > 0 ? [
      { entityType: "work_order", error: "Duplicate ID", count: failedRecords }
    ] : null,
    syncedEntities: entityTypes
  };
}

async function testSCADAConnection(connection: any) {
  // Simulate SCADA connection test
  return {
    success: true,
    protocol: connection.protocol,
    endpoint: connection.endpoint,
    tagsRead: Math.floor(Math.random() * 100) + 20,
    latency: Math.random() * 50 + 10,
    message: `Successfully connected via ${connection.protocol}`
  };
}

async function startModelTraining(model: any, hyperParameters: any, dataFilters: any) {
  // Simulate model training initialization
  return {
    estimatedDuration: Math.floor(Math.random() * 3600) + 1800, // 30 minutes to 2 hours
    dataSize: Math.floor(Math.random() * 10000) + 1000,
    status: "training_started"
  };
}

async function generatePrediction(model: any, equipmentId: number, sensorData: any[], predictionHorizon: number) {
  // Advanced AI prediction simulation
  const features = sensorData.slice(0, 10).map(data => ({
    sensorType: data.sensorType,
    value: data.value,
    timestamp: data.timestamp
  }));

  const confidence = Math.random() * 0.3 + 0.7; // 0.7-1.0
  const riskScore = Math.random();
  
  let riskLevel: string;
  let actions: string[] = [];
  
  if (riskScore < 0.3) {
    riskLevel = "low";
    actions = ["Continue normal operation", "Schedule routine maintenance"];
  } else if (riskScore < 0.6) {
    riskLevel = "medium";
    actions = ["Increase monitoring frequency", "Plan preventive maintenance"];
  } else if (riskScore < 0.8) {
    riskLevel = "high";
    actions = ["Schedule immediate inspection", "Prepare replacement parts"];
  } else {
    riskLevel = "critical";
    actions = ["Immediate maintenance required", "Consider equipment shutdown"];
  }

  return {
    value: model.modelType === "rul_estimation" ? Math.floor(Math.random() * 365) + 30 : riskScore,
    category: model.modelType === "failure_prediction" ? (riskScore > 0.7 ? "likely_failure" : "normal") : null,
    confidence,
    riskLevel,
    features,
    actions,
    explanation: {
      topFactors: [
        { feature: "vibration_level", importance: 0.35 },
        { feature: "temperature", importance: 0.28 },
        { feature: "operating_hours", importance: 0.22 },
        { feature: "pressure", importance: 0.15 }
      ]
    }
  };
}

async function generatePowerBIEmbedToken(workspace: any, report: any) {
  // Simulate Power BI embed token generation
  return {
    token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify({
      workspaceId: workspace.workspaceId,
      reportId: report.reportId,
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
      iss: "smart-gmao-diagfix"
    })).toString('base64')}.mock-signature`,
    expiresAt: new Date(Date.now() + 3600 * 1000)
  };
}

async function refreshPowerBIDataset(workspace: any, dataset: any) {
  // Simulate Power BI dataset refresh
  return {
    success: true,
    refreshId: `refresh_${Date.now()}`,
    startTime: new Date().toISOString(),
    status: "InProgress",
    message: "Dataset refresh started successfully"
  };
}
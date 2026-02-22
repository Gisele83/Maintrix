import { Express } from 'express';
import { getCognitiveKernel } from './cognitive-kernel/index.js';
import { getGlobalAgent } from './agents/global-agent.js';
import { getKnowledgeGraph } from './cognitive-layers/knowledge-graph.js';
import { getPhysicsModel } from './cognitive-layers/physics-models.js';
import { AutonomyLevel } from './cognitive-layers/layer-contracts.js';

export async function initializeCognitiveInfrastructure(): Promise<void> {
  console.log('🧠 INITIALIZING COGNITIVE INFRASTRUCTURE...');

  const kernel = getCognitiveKernel();
  await kernel.initialize();

  const knowledgeGraph = getKnowledgeGraph();
  await knowledgeGraph.initialize();

  const globalAgent = getGlobalAgent();
  await globalAgent.initialize();

  const defaultSite = globalAgent.registerSite('site-default', 'Site Principal', 'default-tenant');

  try {
    const { db } = await import('./db.js');
    const { equipmentRegistry } = await import('../shared/schema.js');
    const equipments = await db.select().from(equipmentRegistry).limit(20);

    for (const eq of equipments) {
      defaultSite.registerEquipment(eq.id, eq.equipmentType || 'general');
    }

    console.log(`✅ ${equipments.length} equipment agents registered on default site`);
  } catch (error) {
    console.log('⚠️ Could not auto-register equipment agents:', error);
  }

  console.log('✅ COGNITIVE INFRASTRUCTURE FULLY INITIALIZED');
  console.log(`   🧠 Cognitive Kernel: ACTIVE (Autonomy Level: ${AutonomyLevel[kernel.getSystemStatus().autonomyLevel]})`);
  console.log(`   📊 Knowledge Graph: ${knowledgeGraph.getStats().totalNodes} nodes, ${knowledgeGraph.getStats().totalEdges} edges`);
  console.log(`   🌐 Global Agent: ${globalAgent.getGlobalStatus().siteCount} sites, ${globalAgent.getGlobalStatus().totalEquipment} equipment`);
}

export function registerCognitiveRoutes(app: Express): void {

  app.get('/api/cognitive/status', async (_req, res) => {
    try {
      const kernel = getCognitiveKernel();
      const globalAgent = getGlobalAgent();
      const knowledgeGraph = getKnowledgeGraph();

      res.json({
        kernel: kernel.getSystemStatus(),
        globalAgent: globalAgent.getGlobalStatus(),
        knowledgeGraph: knowledgeGraph.getStats(),
        architecture: {
          modules: [
            { id: 'a', name: 'Reception de signaux capteurs', description: 'Interface materielle MQTT/Modbus/OPC-UA/LoRaWAN pour capteurs physiques', status: 'active' },
            { id: 'b', name: 'Detection de variations anormales', description: 'Comparaison temps reel aux seuils adaptatifs avec classification par type et severite', status: 'active' },
            { id: 'c', name: 'Modelisation causale dynamique', description: 'Graphe de connaissances avec 5 types de noeuds, 7 types de relations ponderees', status: 'active' },
            { id: 'd', name: 'Module decisionnel adaptatif', description: 'Generation de signaux de commande avec 6 niveaux d\'autonomie graduee', status: 'active' },
            { id: 'e', name: 'Adaptation dynamique du modele', description: 'Modification de la structure causale selon les resultats d\'interventions', status: 'active' }
          ],
          objectives: [
            { name: 'Limiter les derives techniques', status: 'active' },
            { name: 'Reduire les defaillances en cascade', status: 'active' },
            { name: 'Stabiliser le comportement operationnel', status: 'active' }
          ]
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get cognitive status' });
    }
  });

  app.get('/api/cognitive/agents', async (_req, res) => {
    try {
      const kernel = getCognitiveKernel();
      res.json({
        agents: kernel.getAgents(),
        systemAutonomyLevel: kernel.getSystemStatus().autonomyLevel,
        autonomyLevelName: kernel.getSystemStatus().autonomyLevelName
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get agents' });
    }
  });

  app.get('/api/cognitive/agents/site/:siteId', async (req, res) => {
    try {
      const globalAgent = getGlobalAgent();
      const site = globalAgent.getSite(req.params.siteId);
      if (!site) return res.status(404).json({ error: 'Site not found' });
      res.json(site.getSiteStatus());
    } catch (error) {
      res.status(500).json({ error: 'Failed to get site status' });
    }
  });

  app.get('/api/cognitive/agents/equipment/:equipmentId', async (req, res) => {
    try {
      const globalAgent = getGlobalAgent();
      const site = globalAgent.getSite('site-default');
      if (!site) return res.status(404).json({ error: 'Default site not found' });

      const eqId = parseInt(req.params.equipmentId);
      const agent = site.getEquipmentAgent(eqId);
      if (!agent) return res.status(404).json({ error: 'Equipment agent not found' });

      res.json(agent.getState());
    } catch (error) {
      res.status(500).json({ error: 'Failed to get equipment agent state' });
    }
  });

  app.post('/api/cognitive/closed-loop/:equipmentId', async (req, res) => {
    try {
      const kernel = getCognitiveKernel();
      const equipmentId = parseInt(req.params.equipmentId);
      const triggerSignal = req.body;

      const result = await kernel.processClosedLoop(equipmentId, triggerSignal);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Closed loop processing failed' });
    }
  });

  app.get('/api/cognitive/autonomy', async (_req, res) => {
    try {
      const kernel = getCognitiveKernel();
      const status = kernel.getSystemStatus();
      res.json({
        currentLevel: status.autonomyLevel,
        currentLevelName: status.autonomyLevelName,
        levels: [
          { level: 0, name: 'MONITORING', description: 'Observation pure — aucune action automatique' },
          { level: 1, name: 'ASSISTED_DIAGNOSTIC', description: 'Diagnostic assiste — suggestions avec validation humaine obligatoire' },
          { level: 2, name: 'AUTO_RECOMMENDATION', description: 'Recommandation automatique — creation automatique d\'alertes et OT' },
          { level: 3, name: 'SUPERVISED_EXECUTION', description: 'Execution supervisee — actions automatiques avec supervision' },
          { level: 4, name: 'PARTIAL_AUTONOMY', description: 'Autonomie partielle — decisions autonomes sur incidents non-critiques' },
          { level: 5, name: 'FULL_AUTONOMY', description: 'Autonomie complete — orchestration entierement autonome' }
        ]
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get autonomy levels' });
    }
  });

  app.put('/api/cognitive/autonomy', async (req, res) => {
    try {
      const { level } = req.body;
      if (level === undefined || level < 0 || level > 5) {
        return res.status(400).json({ error: 'Invalid autonomy level (0-5)' });
      }
      const kernel = getCognitiveKernel();
      kernel.setSystemAutonomyLevel(level);
      res.json({
        success: true,
        newLevel: level,
        levelName: AutonomyLevel[level]
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update autonomy level' });
    }
  });

  app.get('/api/cognitive/policies', async (_req, res) => {
    try {
      const kernel = getCognitiveKernel();
      res.json({ policies: kernel.getPolicies() });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get policies' });
    }
  });

  app.post('/api/cognitive/policies', async (req, res) => {
    try {
      const kernel = getCognitiveKernel();
      kernel.addPolicy(req.body);
      res.json({ success: true, totalPolicies: kernel.getPolicies().length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to add policy' });
    }
  });

  app.get('/api/cognitive/audit-log', async (req, res) => {
    try {
      const kernel = getCognitiveKernel();
      const limit = parseInt(req.query.limit as string) || 50;
      res.json({ auditLog: kernel.getDecisionAuditLog(limit) });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get audit log' });
    }
  });

  app.get('/api/cognitive/knowledge-graph', async (_req, res) => {
    try {
      const kg = getKnowledgeGraph();
      res.json({
        stats: kg.getStats(),
        graph: kg.getFullGraph()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get knowledge graph' });
    }
  });

  app.post('/api/cognitive/knowledge-graph/reason', async (req, res) => {
    try {
      const { symptoms, equipmentType } = req.body;
      if (!symptoms || !Array.isArray(symptoms)) {
        return res.status(400).json({ error: 'symptoms array required' });
      }
      const kg = getKnowledgeGraph();
      const result = kg.reasonFromSymptoms(symptoms, equipmentType);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Knowledge graph reasoning failed' });
    }
  });

  app.post('/api/cognitive/knowledge-graph/learn', async (req, res) => {
    try {
      const { symptoms, cause, intervention, success } = req.body;
      const kg = getKnowledgeGraph();
      kg.learnFromIntervention(symptoms, cause, intervention, success);
      res.json({ success: true, updatedStats: kg.getStats() });
    } catch (error) {
      res.status(500).json({ error: 'Learning update failed' });
    }
  });

  app.post('/api/cognitive/physics-model', async (req, res) => {
    try {
      const { equipmentType, sensorData } = req.body;
      if (!equipmentType) return res.status(400).json({ error: 'equipmentType required' });

      const physics = getPhysicsModel();
      const result = physics.selectAndRunModel(equipmentType, sensorData || {});

      if (!result) {
        return res.status(404).json({ error: 'No physics model available for this equipment type' });
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Physics model execution failed' });
    }
  });

  app.post('/api/cognitive/what-if', async (req, res) => {
    try {
      const { equipmentId, conditions } = req.body;
      if (!equipmentId) return res.status(400).json({ error: 'equipmentId required' });

      const kernel = getCognitiveKernel();
      const result = await kernel.simulateWhatIf(equipmentId, conditions || {});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'What-if simulation failed' });
    }
  });

  app.get('/api/cognitive/global-learning', async (_req, res) => {
    try {
      const globalAgent = getGlobalAgent();
      res.json(globalAgent.getGlobalStatus());
    } catch (error) {
      res.status(500).json({ error: 'Failed to get global learning status' });
    }
  });

  console.log('🧠 COGNITIVE INFRASTRUCTURE ROUTES REGISTERED:');
  console.log('   📊 /api/cognitive/status — System status');
  console.log('   🤖 /api/cognitive/agents — Agent registry');
  console.log('   🔄 /api/cognitive/closed-loop/:id — Closed-loop processing');
  console.log('   🎚️ /api/cognitive/autonomy — Autonomy levels (0-5)');
  console.log('   📜 /api/cognitive/policies — Policy engine');
  console.log('   📝 /api/cognitive/audit-log — Decision audit trail');
  console.log('   🕸️ /api/cognitive/knowledge-graph — Knowledge graph');
  console.log('   🔬 /api/cognitive/physics-model — Physics hybrid models');
  console.log('   🔮 /api/cognitive/what-if — What-if simulation');
  console.log('   🌐 /api/cognitive/global-learning — Cross-site learning');
}

/**
 * Configuration Swagger / OpenAPI 3.0
 * Documentation interactive de l'API Maintrix
 */
import swaggerUi from "swagger-ui-express";

export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "Maintrix API",
    description: `API RESTful de la plateforme industrielle Maintrix.
    
**Authentification** : JWT Bearer token + CSRF token (header X-CSRF-Token).  
**Base URL** : \`/api\`

Tous les endpoints protégés nécessitent un cookie de session valide obtenu via \`POST /api/enterprise-auth/login\`.`,
    version: "2.6.0",
    contact: { name: "Maintrix Support", url: "https://maintrix.io", email: "support@maintrix.io" },
    license: { name: "Commercial", url: "https://maintrix.io/license" },
  },
  servers: [
    { url: "/api", description: "Serveur de production" },
    { url: "http://localhost:5000/api", description: "Développement local" },
  ],
  tags: [
    { name: "Auth", description: "Authentification et gestion de session" },
    { name: "Equipment", description: "Registre des équipements industriels" },
    { name: "WorkOrders", description: "Ordres de travail GMAO" },
    { name: "Diagnostic", description: "Diagnostic IA hybride" },
    { name: "OEE", description: "Overall Equipment Effectiveness" },
    { name: "RCA", description: "Analyse des causes racines" },
    { name: "FMEA", description: "Analyse des modes de défaillance" },
    { name: "Assets", description: "Gestion du cycle de vie des actifs" },
    { name: "Calibration", description: "Étalonnage des instruments" },
    { name: "Budget", description: "Budget de maintenance" },
    { name: "Alerts", description: "Alertes et notifications" },
    { name: "IoT", description: "Données capteurs et IoT" },
    { name: "License", description: "Gestion des licences et abonnements" },
    { name: "System", description: "Santé et état du système" },
    { name: "Reports", description: "Rapports PDF et export" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: "apiKey", in: "cookie", name: "maintrix_session" },
      csrfToken: { type: "apiKey", in: "header", name: "X-CSRF-Token" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "AUTHENTICATION_REQUIRED" },
          message: { type: "string", example: "Vous devez être connecté pour accéder à cette ressource." },
        },
      },
      Equipment: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          equipment_name: { type: "string", example: "Pompe centrifuge P-001" },
          equipment_type: { type: "string", example: "pompe" },
          location: { type: "string", example: "Zone A - Atelier production" },
          status: { type: "string", enum: ["operational", "maintenance", "offline", "critical"], example: "operational" },
          manufacturer: { type: "string", example: "Grundfos" },
          model: { type: "string", example: "CR 32-4" },
          serial_number: { type: "string", example: "GF2024-001" },
          installation_date: { type: "string", format: "date", example: "2022-03-15" },
          last_maintenance: { type: "string", format: "date", example: "2024-11-01" },
        },
      },
      WorkOrder: {
        type: "object",
        properties: {
          id: { type: "integer", example: 42 },
          title: { type: "string", example: "Remplacement roulement P-001" },
          description: { type: "string" },
          equipment_id: { type: "integer" },
          order_type: { type: "string", enum: ["corrective", "preventive", "emergency"] },
          status: { type: "string", enum: ["open", "in_progress", "completed", "cancelled"] },
          priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
          assigned_to: { type: "string" },
          planned_date: { type: "string", format: "date" },
          completion_date: { type: "string", format: "date" },
          estimated_duration: { type: "integer", description: "Minutes" },
          actual_duration: { type: "integer", description: "Minutes" },
        },
      },
      DiagnosticRequest: {
        type: "object",
        required: ["symptoms", "equipmentType"],
        properties: {
          symptoms: { type: "string", example: "Vibrations anormales et bruit de grincement" },
          equipmentType: { type: "string", example: "pompe" },
          equipmentId: { type: "integer" },
          urgency: { type: "string", enum: ["low", "medium", "high"], default: "medium" },
          zone: { type: "string", example: "production" },
          additionalContext: { type: "string" },
        },
      },
      DiagnosticResult: {
        type: "object",
        properties: {
          diagnosis: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          solution: { type: "string" },
          urgency: { type: "string" },
          estimatedDuration: { type: "integer" },
          estimatedCost: { type: "string" },
          similarCases: { type: "array", items: { type: "object" } },
          aiInsights: { type: "string" },
          predictiveTips: { type: "array", items: { type: "string" } },
        },
      },
      OEERecord: {
        type: "object",
        properties: {
          id: { type: "integer" },
          equipment_id: { type: "integer" },
          date: { type: "string", format: "date" },
          availability: { type: "number", minimum: 0, maximum: 100 },
          performance: { type: "number", minimum: 0, maximum: 100 },
          quality: { type: "number", minimum: 0, maximum: 100 },
          oee_score: { type: "number", minimum: 0, maximum: 100 },
        },
      },
      LicenseStatus: {
        type: "object",
        properties: {
          tenantId: { type: "string" },
          status: { type: "string", enum: ["trial", "active", "grace", "expired", "suspended"] },
          plan: { type: "string", enum: ["free", "pro", "business", "enterprise"] },
          isTrialActive: { type: "boolean" },
          trialDaysRemaining: { type: "integer" },
          canOperate: { type: "boolean" },
          maxUsers: { type: "integer" },
          currentUsers: { type: "integer" },
          warningMessage: { type: "string", nullable: true },
        },
      },
      SystemHealth: {
        type: "object",
        properties: {
          overall: { type: "string", enum: ["healthy", "warning", "degraded", "error"] },
          timestamp: { type: "string", format: "date-time" },
          version: { type: "string" },
          database: { type: "object" },
          system: { type: "object" },
          modules: { type: "array", items: { type: "object" } },
        },
      },
    },
  },
  security: [{ cookieAuth: [], csrfToken: [] }],
  paths: {
    "/enterprise-auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Connexion utilisateur",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username", "password"],
                properties: {
                  username: { type: "string", example: "admin@example.com" },
                  password: { type: "string", format: "password" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Connexion réussie — cookie de session défini" },
          401: { description: "Identifiants invalides", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          429: { description: "Trop de tentatives — veuillez patienter" },
        },
      },
    },
    "/enterprise-auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Déconnexion",
        responses: { 200: { description: "Session terminée" } },
      },
    },
    "/enterprise-auth/profile": {
      get: {
        tags: ["Auth"],
        summary: "Profil de l'utilisateur connecté",
        responses: {
          200: { description: "Profil utilisateur" },
          401: { description: "Non authentifié", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/equipment": {
      get: {
        tags: ["Equipment"],
        summary: "Liste des équipements",
        parameters: [
          { name: "type", in: "query", schema: { type: "string" }, description: "Filtrer par type" },
          { name: "status", in: "query", schema: { type: "string" }, description: "Filtrer par statut" },
          { name: "limit", in: "query", schema: { type: "integer", default: 50 } },
        ],
        responses: {
          200: { description: "Liste des équipements", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Equipment" } } } } },
        },
      },
      post: {
        tags: ["Equipment"],
        summary: "Créer un équipement",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Equipment" } } } },
        responses: {
          201: { description: "Équipement créé" },
          400: { description: "Données invalides" },
        },
      },
    },
    "/equipment/{id}": {
      get: {
        tags: ["Equipment"],
        summary: "Détails d'un équipement",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: {
          200: { description: "Équipement trouvé", content: { "application/json": { schema: { $ref: "#/components/schemas/Equipment" } } } },
          404: { description: "Équipement introuvable" },
        },
      },
      put: {
        tags: ["Equipment"],
        summary: "Modifier un équipement",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Equipment" } } } },
        responses: { 200: { description: "Équipement mis à jour" } },
      },
      delete: {
        tags: ["Equipment"],
        summary: "Supprimer un équipement",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { 200: { description: "Supprimé" }, 404: { description: "Introuvable" } },
      },
    },
    "/work-orders": {
      get: { tags: ["WorkOrders"], summary: "Liste des ordres de travail", responses: { 200: { description: "Liste des OT", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/WorkOrder" } } } } } } },
      post: { tags: ["WorkOrders"], summary: "Créer un ordre de travail", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/WorkOrder" } } } }, responses: { 201: { description: "OT créé" } } },
    },
    "/work-orders/{id}": {
      get: { tags: ["WorkOrders"], summary: "Détails d'un OT", parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }], responses: { 200: { description: "OT trouvé" } } },
      put: { tags: ["WorkOrders"], summary: "Modifier un OT", parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }], requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/WorkOrder" } } } }, responses: { 200: { description: "OT mis à jour" } } },
    },
    "/diagnostic/analyze": {
      post: {
        tags: ["Diagnostic"],
        summary: "Lancer un diagnostic IA",
        description: "Analyse les symptômes et retourne un diagnostic avec recommandations basé sur la base de 120+ cas historiques et Claude AI.",
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/DiagnosticRequest" } } } },
        responses: {
          200: { description: "Résultat du diagnostic", content: { "application/json": { schema: { $ref: "#/components/schemas/DiagnosticResult" } } } },
          400: { description: "Données de symptômes manquantes" },
        },
      },
    },
    "/oee": {
      get: { tags: ["OEE"], summary: "Mesures OEE", responses: { 200: { description: "Liste des mesures OEE", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/OEERecord" } } } } } } },
      post: { tags: ["OEE"], summary: "Enregistrer une mesure OEE", requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/OEERecord" } } } }, responses: { 201: { description: "Mesure enregistrée" } } },
    },
    "/rca": {
      get: { tags: ["RCA"], summary: "Liste des analyses RCA", responses: { 200: { description: "Analyses RCA" } } },
      post: { tags: ["RCA"], summary: "Créer une analyse RCA", responses: { 201: { description: "RCA créée" } } },
    },
    "/fmea": {
      get: { tags: ["FMEA"], summary: "Liste des analyses FMEA/AMDEC", responses: { 200: { description: "Analyses FMEA" } } },
      post: { tags: ["FMEA"], summary: "Créer une analyse FMEA", responses: { 201: { description: "FMEA créée" } } },
    },
    "/asset-lifecycle": {
      get: { tags: ["Assets"], summary: "Liste des actifs", responses: { 200: { description: "Actifs" } } },
      post: { tags: ["Assets"], summary: "Enregistrer un actif", responses: { 201: { description: "Actif créé" } } },
    },
    "/calibration": {
      get: { tags: ["Calibration"], summary: "Enregistrements d'étalonnage", responses: { 200: { description: "Étalonnages" } } },
      post: { tags: ["Calibration"], summary: "Enregistrer un étalonnage", responses: { 201: { description: "Étalonnage créé" } } },
    },
    "/budget-plans": {
      get: { tags: ["Budget"], summary: "Plans budgétaires", responses: { 200: { description: "Budgets" } } },
      post: { tags: ["Budget"], summary: "Créer un budget", responses: { 201: { description: "Budget créé" } } },
    },
    "/alerts": {
      get: { tags: ["Alerts"], summary: "Alertes actives", responses: { 200: { description: "Liste des alertes" } } },
    },
    "/iot/sensor-data": {
      get: { tags: ["IoT"], summary: "Données capteurs IoT", responses: { 200: { description: "Données capteurs" } } },
    },
    "/license/status": {
      get: { tags: ["License"], summary: "Statut de la licence du tenant", responses: { 200: { description: "Statut licence", content: { "application/json": { schema: { $ref: "#/components/schemas/LicenseStatus" } } } } } },
    },
    "/license/activate": {
      post: {
        tags: ["License"],
        summary: "Activer une clé de licence",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { licenseKey: { type: "string", example: "SM0123456789012" } } } } } },
        responses: { 200: { description: "Licence activée" }, 400: { description: "Clé invalide ou expirée" } },
      },
    },
    "/system/health": {
      get: {
        tags: ["System"],
        summary: "État de santé du système (Admin uniquement)",
        responses: { 200: { description: "Métriques système", content: { "application/json": { schema: { $ref: "#/components/schemas/SystemHealth" } } } }, 403: { description: "Accès refusé — admin requis" } },
      },
    },
  },
};

/**
 * Documentation interactive de l'API.
 *
 * ⚠️ F11 — Elle était montée sans condition, y compris en production, et
 * accessible sans authentification par le point d'entrée public : n'importe
 * quel visiteur obtenait la carte complète des routes, des paramètres et des
 * schémas de données. C'est un guide de reconnaissance offert.
 *
 * Elle reste précieuse pour des testeurs externes : on ne la supprime pas, on
 * la rend explicite. Hors production elle est active par défaut ; en production
 * elle exige `ENABLE_API_DOCS=true`, une décision consciente et réversible.
 */
export function setupSwagger(app: any) {
  const enProduction = process.env.NODE_ENV === "production";
  const autorisee = process.env.ENABLE_API_DOCS === "true";

  if (enProduction && !autorisee) {
    console.log(
      "📕 Documentation API désactivée (production). " +
      "Pour l'ouvrir aux testeurs : ENABLE_API_DOCS=true",
    );
    return;
  }

  try {
    const swaggerOptions = {
      customCss: ".swagger-ui .topbar { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); }",
      customSiteTitle: "Maintrix API Documentation",
      customfavIcon: "/favicon.ico",
      swaggerOptions: {
        persistAuthorization: true,
        filter: true,
        displayRequestDuration: true,
      },
    };
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerOptions));
    app.get("/api-docs.json", (_req: any, res: any) => res.json(swaggerDocument));
    console.log("📖 API Documentation disponible sur /api-docs");
  } catch (e: any) {
    console.warn("⚠️  Swagger setup failed:", e.message);
  }
}

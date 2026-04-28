# Maintrix - Supervision & Contrôle Adaptatif Industriel

## Overview
Maintrix is an adaptive industrial supervision and control system with dynamic causal modeling. It implements a patent-protected architecture with 5 cooperative modules: (a) hardware interface for physical sensor signals (MQTT/Modbus/OPC-UA/LoRaWAN), (b) abnormal parameter variation detection, (c) causal modeling of parameter-failure relationships via knowledge graph, (d) decision module generating control signals for industrial equipment, (e) dynamic adaptation of causal model based on intervention results. The system pursues 3 cooperative objectives: limit technical drift, reduce cascade failures, stabilize operational behavior. Features graduated autonomy (levels 0-5), multi-agent architecture, and GMAO modules as operational backbone.

## User Preferences
Preferred communication style: Simple, everyday language.
User requested improvements based on provided database and enhanced specifications document.
User loves the new modern interface design with glassmorphism effects and gradient styling.
User confirmed architecture requirements: Interface unifiée avec architecture modulaire - Module GMAO (planification, interventions, techniciens) + Module Diagnostic intelligent (analyse symptômes → diagnostic → préconisations → lien vers intervention).
User specifically requested to use ONLY the provided Excel file (Base_Industrie_120_Cas_Enrichie_1754590391833.xlsx) as historical database for diagnostic pattern matching and to allow users to upload their own historical maintenance data.
User confirmed that username field should remain non-editable in profile forms for security and data integrity.

## System Architecture
### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui, glassmorphism, gradient backgrounds, and smooth animations. Color scheme inspired by Carbon Design.
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation
- **Internationalization**: Custom i18n (French and English)
- **UI/UX Decisions**: Professional design with modern aesthetics, interactive feature cards, 3D shadows, smooth animations, and gradient text. Unified branding with clear distinction between Smart Diagnostic (AI assistant) and Smart GMAO (maintenance management). Includes a full-featured React Native mobile application with offline capabilities.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with JSON responses.
- **Storage**: PostgreSQL with Drizzle ORM
- **Build System**: Vite for frontend, esbuild for backend

### Database Design
- **ORM**: Drizzle ORM for PostgreSQL
- **Schema**: Comprehensive GMAO database covering equipment, work orders, preventive maintenance, spare parts, IoT data, KPIs, alerts, and integration logs.
- **Migration**: Drizzle-kit for schema management.

### Technical Implementations
- **AI Diagnostic Engine (CCTP-Compliant Hybrid)**: Combines an Expert Rules Engine, Historical Similarity Analysis (120+ cases from Excel), Failure Memory capitalization, and AI Structuring via Anthropic Claude. Features explainability, GMAO contextualization, failure trend tracking, and continuous learning.
- **Historical Data Processing**: Dual-mode Excel import for pre-loaded and user-uploaded maintenance data with flexible column mapping and equipment type normalization.
- **GMAO Platform**: Comprehensive equipment registry, advanced work order management, preventive maintenance scheduling, spare parts inventory, and budget management.
- **Security**: Multi-level authentication (bcrypt), advanced security middleware (rate limiting, anomaly detection, CSRF protection), Role-Based Access Control (RBAC) with 7 roles, and a security dashboard.
- **Reporting**: Comprehensive maintenance reporting with automatic generation (intervention, monthly, dashboard reports including KPIs) using client-side PDF generation.
- **Mobile Application**: React Native app with offline capabilities, QR code scanning, repair guidance, work order management, diagnostic sessions, and data synchronization.
- **Multi-tenant SaaS Infrastructure**: Enterprise-grade multi-tenant architecture with email invitation, tenant management, enterprise security middleware, and federated AI learning.
- **Adaptive Supervision & Control System**: 5-module architecture (a-e) implementing patent-protected adaptive supervision: sensor reception, anomaly detection, causal modeling (Knowledge Graph 48+ nodes, 46+ edges), adaptive decision module (6 autonomy levels, policy engine), and dynamic model adaptation. Multi-agent system (Equipment, Site, Global Agents) with closed-loop industrial automation and 3 cooperative objectives.
- **Communication Platform Integrations**: Multi-platform alert dispatch system supporting Slack (webhooks), Microsoft Teams (connectors), Telegram (bot API), WhatsApp (Business API), and custom webhooks. Features channel CRUD, severity/event filtering, test messages, delivery logging, and statistics. Frontend management page at /communication-integrations.
- **Permit-to-Work (PTW) Module**: Full lifecycle permit management at /permit-to-work. 6 permit types (hot work, confined space, electrical LOTO, height work, cold work, chemical). 8 statuses with workflow (draft→submitted→approved→active→completed/rejected/cancelled/expired). Features: risk level, hazards, PPE, authorized personnel, safety checklists (auto-generated per type), LOTO isolation points, approval/rejection with reason, start/complete actions, stats dashboard. Backend routes at server/permit-to-work-routes.ts; table permit_to_work in local PostgreSQL. Navigation shortcut in GMAO dashboard quick-access grid.
- **Advanced Feature Pages**: Client Portal, SLA Management, Machine Health Scoring, Smart Alerts & Action Recommendations, Sensor Hub (IoT), Equipment QR Codes, Equipment Management Improvements, Work Order Deletion, and Inline Equipment Creation.

## External Dependencies
- **UI Components**: Radix UI
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS, Lucide React
- **Form Handling**: React Hook Form, Zod
- **Database**: Neon Database (serverless PostgreSQL)
- **ORM**: Drizzle ORM
- **Session Management**: PostgreSQL session store
- **Development Tools**: TSX, Vite, PostCSS, Autoprefixer
- **AI**: Anthropic Claude
- **Email Service**: SendGrid
- **Payment Gateways**: Stripe, PayPal
- **Enterprise Integration**: SAP ERP Connector, IoT (MQTT simulation), Maximo (integration ready), SCADA (integration ready).

## Production Readiness Status (April 2026)
### All 14 audit items resolved — platform hardened for production

**Blocking issues (6/6 fixed):**
- Stripe webhook requires `STRIPE_WEBHOOK_SECRET` + updates tenant plan in DB
- Anti-leakage validator blocks responses (HTTP 403) on cross-tenant data
- General rate limit re-enabled (1000 req/15min per IP)
- Startup env var validation blocks production boot if critical vars absent
- Super-admin: bcrypt auth + server-side token Map + timing-safe comparison
- Payment webhook updates tenant plan in DB

**High-priority issues (8/8 fixed):**
- IoT MQTT: real `mqtt` library wired; auto-detects localhost (simulation) vs real broker via `MQTT_BROKER_URL`
- Storage methods: `getIotSensorData`, `createIotSensorData`, `getPredictiveAnalytics`, `createPredictiveAnalytics`, `getKpiMetrics`, `createKpiMetrics`, `getIntegrationLog`, `createIntegrationLog`, `getAlertsNotifications`, `createAlertsNotifications` — all implemented with real DB queries (Drizzle ORM)
- S3/MinIO: production warnings logged when `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME` not set
- CORS origin validation re-enabled in production mode
- Tenant domain mapping: async DB lookup implemented in `resolveTenant()` (strategy DOMAIN)
- Anthropic service: no longer crashes on missing key — warns and returns null client, guards all method calls
- Email onboarding: `createCredentialNotification` + `sendTenantCredentials` now wired in user creation flow (non-blocking)
- `createCredentialNotification` imported properly in enterprise-auth-routes

**Required env vars for production:**
- `DATABASE_URL`, `KMS_MASTER_KEY`, `JWT_SECRET`, `SESSION_SECRET`, `MFA_ENCRYPTION_KEY` — mandatory (startup blocked if absent)
- `SUPER_ADMIN_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD_HASH` — super-admin access
- `SENDGRID_API_KEY`, `ANTHROPIC_API_KEY`, `STRIPE_WEBHOOK_SECRET` — optional with warnings
- `MQTT_BROKER_URL` — optional; if not set, simulation mode active
- `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME` — optional with error log if absent in production
- `FRONTEND_URL` / `APP_URL` — base URL for email links (default: http://localhost:5000)

## Recent Changes (April 2026)
- **Excel Processor (processEquipment/processWorkOrders/processSpareParts)**: Fully implemented with multi-column French/English key mapping, normalisation of criticality/type/priority, graceful duplicate skipping (unique constraint), and tenantId-aware insertion into `equipmentRegistry`, `workOrders`, `spareParts` tables via `gmaoStorage`. Constructor now accepts optional `tenantId`.
- **Maximo Connector (`server/integrations/maximo-connector.ts`)**: Full IBM Maximo OSLC REST connector — `testConnection`, `fetchWorkOrders`, `fetchAssets`, `updateWorkOrderStatus`, `createMaximoConnector()` factory. Activated by MAXIMO_BASE_URL / MAXIMO_USERNAME / MAXIMO_PASSWORD.
- **SCADA Connector (`server/integrations/scada-connector.ts`)**: Full SCADA/REST-bridge connector — `testConnection`, `readTagValues`, `fetchActiveAlarms`, `startPolling`, `createScadaConnector()` factory. Activated by SCADA_ENDPOINT.
- **Integration Hub (`server/integrations/index.ts`)**: Replaced TODO stubs — Maximo and SCADA connectors wired in, `syncWithMaximo()`, `getScadaTags()`, `getScadaAlarms()` implemented, IoT polling only runs when equipment exists in DB, graceful fallback when connectors not configured.
- **Notifications (`server/notifications.ts`)**: `sendEmail()` now uses real SendGrid via lazy-loaded `@sendgrid/mail`. Falls back to console log when `SENDGRID_API_KEY` is absent.
- **Smart Notification Engine (`server/integrations/smart-notification-engine.ts`)**: `resolveRecipients()` replaced mock hardcoded users with real DB query from `userProfiles` (active users only, email required). `createNotification()` now persists to `smartNotifications` table.
- **MFA System (`server/mfa-system.ts`)**: Added `getMfaKey()` helper with explicit production warning when `MFA_ENCRYPTION_KEY` is absent; backward-compatible with existing encrypted backup codes.

## Recent Changes (February 2026)
- **Documentation Consolidation**: Merged ARCHITECTURE_MAINTRIX.md into ARCHITECTURE_GLOBALE_MAINTRIX.md (v2.0) as single authoritative architecture document. Removed duplicate.
- **Positioning Shift**: All documentation and UI updated from "Infrastructure Cognitive / 6 couches" to "Supervision & Contrôle Adaptatif / 5 modules coopératifs" — emphasizing patent-aligned adaptive supervision architecture.
- **Frontend Realignment**: cognitive-infrastructure page rewritten with 5 MODULE_CONFIG (a-e), 3 COOPERATIVE_OBJECTIVES, 7 tabs (Modules, Objectifs, Agents, Autonomie, Modèle Causal, Raisonnement, Gouvernance). Navigation, modern-home, feature-cards, landing page all updated to "Supervision Adaptative".
- **API Update**: /api/cognitive/status response changed from architecture.layers (6) to architecture.modules (5) + architecture.objectives (3).
- **Commercial Docs Updated**: ONE_PAGER, BROCHURE, ARGUMENTS_VENTE, PRESENTATION_COMMERCIALE, PITCH_DECK, PACK_COMMERCIAL, NOTE_OPPORTUNITE, DEMO_GUIDE, FAQ_TECHNIQUE, GUIDE_DEMARRAGE_RAPIDE, TEMPLATES_EMAIL — all reflect cognitive infrastructure positioning.
- **INDEX_DOCUMENTATION_COMPLETE.md**: Updated with cognitive infrastructure section, API endpoints, communication channels, verified all file references.
- **DOCUMENTATION_TECHNIQUE_MAINTRIX.md**: Comprehensive technical documentation created. Covers all ~99 server files with real/simulated/not-implemented classification. Includes coverage checklist, production roadmap, and terrain intervention requirements. ~75% components real, ~15% simulated, ~10% not implemented.
- **BREVET_INNOVATION_SCIENTIFIQUE_MAINTRIX.md**: Patent document "Système informatique de supervision et de contrôle adaptatif d'équipements industriels à modélisation causale dynamique". Claim 1 with sub-sections (a-e) covering 5 modules, dependent claims 6-15. Abstract aligned with adaptive supervision positioning for EPO/OAPI/USPTO submission.
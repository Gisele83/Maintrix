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

## Recent Changes (February 2026)
- **Documentation Consolidation**: Merged ARCHITECTURE_MAINTRIX.md into ARCHITECTURE_GLOBALE_MAINTRIX.md (v2.0) as single authoritative architecture document. Removed duplicate.
- **Positioning Shift**: All documentation and UI updated from "Infrastructure Cognitive / 6 couches" to "Supervision & Contrôle Adaptatif / 5 modules coopératifs" — emphasizing patent-aligned adaptive supervision architecture.
- **Frontend Realignment**: cognitive-infrastructure page rewritten with 5 MODULE_CONFIG (a-e), 3 COOPERATIVE_OBJECTIVES, 7 tabs (Modules, Objectifs, Agents, Autonomie, Modèle Causal, Raisonnement, Gouvernance). Navigation, modern-home, feature-cards, landing page all updated to "Supervision Adaptative".
- **API Update**: /api/cognitive/status response changed from architecture.layers (6) to architecture.modules (5) + architecture.objectives (3).
- **Commercial Docs Updated**: ONE_PAGER, BROCHURE, ARGUMENTS_VENTE, PRESENTATION_COMMERCIALE, PITCH_DECK, PACK_COMMERCIAL, NOTE_OPPORTUNITE, DEMO_GUIDE, FAQ_TECHNIQUE, GUIDE_DEMARRAGE_RAPIDE, TEMPLATES_EMAIL — all reflect cognitive infrastructure positioning.
- **INDEX_DOCUMENTATION_COMPLETE.md**: Updated with cognitive infrastructure section, API endpoints, communication channels, verified all file references.
- **DOCUMENTATION_TECHNIQUE_MAINTRIX.md**: Comprehensive technical documentation created. Covers all ~99 server files with real/simulated/not-implemented classification. Includes coverage checklist, production roadmap, and terrain intervention requirements. ~75% components real, ~15% simulated, ~10% not implemented.
- **BREVET_INNOVATION_SCIENTIFIQUE_MAINTRIX.md**: Patent document "Système informatique de supervision et de contrôle adaptatif d'équipements industriels à modélisation causale dynamique". Claim 1 with sub-sections (a-e) covering 5 modules, dependent claims 6-15. Abstract aligned with adaptive supervision positioning for EPO/OAPI/USPTO submission.
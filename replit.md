# Maintrix - Supervision & Contrôle Adaptatif Industriel

## Overview
Maintrix is an adaptive industrial supervision and control system designed to limit technical drift, reduce cascade failures, and stabilize operational behavior in industrial environments. It utilizes a patent-protected architecture comprising five cooperative modules: hardware interface, abnormal parameter variation detection, causal modeling via knowledge graph, decision module for control signals, and dynamic adaptation of the causal model. Key capabilities include graduated autonomy (levels 0-5), a multi-agent architecture, and comprehensive GMAO (Gestion de Maintenance Assistée par Ordinateur) functionalities. The system aims to provide intelligent diagnostics, proactive maintenance planning, and real-time operational control.

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
- **Styling**: Tailwind CSS with shadcn/ui, glassmorphism, gradient backgrounds, and animations. Color scheme inspired by Carbon Design.
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation
- **Internationalization**: Custom i18n (French and English)
- **UI/UX Decisions**: Professional design with modern aesthetics, interactive feature cards, 3D shadows, and gradient text. Unified branding for Smart Diagnostic (AI assistant) and Smart GMAO (maintenance management). Includes a full-featured React Native mobile application with offline capabilities.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with JSON responses.
- **Storage**: PostgreSQL with Drizzle ORM
- **Build System**: Vite for frontend, esbuild for backend

### Database Design
- **ORM**: Drizzle ORM for PostgreSQL
- **Schema**: Comprehensive GMAO database covering equipment, work orders, preventive maintenance, spare parts, IoT data, KPIs, alerts, and integration logs.

### Technical Implementations
- **AI Diagnostic Engine (CCTP-Compliant Hybrid)**: Combines an Expert Rules Engine, Historical Similarity Analysis (120+ cases from Excel), Failure Memory capitalization, and AI Structuring via Anthropic Claude. Features explainability, GMAO contextualization, failure trend tracking, and continuous learning.
- **Historical Data Processing**: Dual-mode Excel import for pre-loaded and user-uploaded maintenance data with flexible column mapping and equipment type normalization.
- **GMAO Platform**: Comprehensive equipment registry, advanced work order management, preventive maintenance scheduling, spare parts inventory, and budget management.
- **Security**: Multi-level authentication (bcrypt), advanced security middleware (rate limiting, anomaly detection, CSRF protection), Role-Based Access Control (RBAC) with 7 roles, and a security dashboard.
- **Reporting**: Comprehensive maintenance reporting with automatic generation (intervention, monthly, dashboard reports including KPIs) using client-side PDF generation.
- **Mobile Application**: React Native app with offline capabilities, QR code scanning, repair guidance, work order management, diagnostic sessions, and data synchronization.
- **Multi-tenant SaaS Infrastructure**: Enterprise-grade multi-tenant architecture with email invitation, tenant management, enterprise security middleware, and federated AI learning.
- **Adaptive Supervision & Control System**: 5-module architecture implementing patent-protected adaptive supervision: sensor reception, anomaly detection, causal modeling (Knowledge Graph 48+ nodes, 46+ edges), adaptive decision module (6 autonomy levels, policy engine), and dynamic model adaptation. Multi-agent system (Equipment, Site, Global Agents) with closed-loop industrial automation and 3 cooperative objectives.
- **Communication Platform Integrations**: Multi-platform alert dispatch system supporting Slack, Microsoft Teams, Telegram, WhatsApp, and custom webhooks.
- **Permit-to-Work (PTW) Module**: Full lifecycle permit management with 6 permit types and 8 statuses. Includes risk assessment, safety checklists, and approval workflows.
- **Root Cause Analysis (RCA) Module**: Structured RCA with 4 methodologies: 5 Why, Ishikawa/Fishbone, FMEA, Fault Tree. Includes action plans and lessons learned.
- **OEE Module**: Overall Equipment Effectiveness tracking with real-time A×P×Q calculation, trend charts, and equipment comparison.
- **FMEA / AMDEC Module**: Failure Mode & Effects Analysis with full lifecycle, RPN calculation, criticality matrix, and recommended actions.
- **Asset Lifecycle Management Module**: Full lifecycle tracking (procurement to disposal) with automated asset tagging, financial tracking (TCO, depreciation), performance KPIs (MTBF/MTTR), condition scoring, and event timeline.

## External Dependencies
- **UI Components**: Radix UI
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS, Lucide React
- **Form Handling**: React Hook Form, Zod
- **Database**: Neon Database (serverless PostgreSQL)
- **ORM**: Drizzle ORM
- **AI**: Anthropic Claude
- **Email Service**: SendGrid
- **Payment Gateways**: Stripe, PayPal
- **Enterprise Integration**: SAP ERP Connector, IoT (MQTT simulation), Maximo (integration ready), SCADA (integration ready).
# Maintrix - L'intelligence cognitive au service des industries critiques

## Overview
Maintrix is NOT a simple GMAO/CMMS. It is a cognitive intelligence platform that transforms industrial machines into autonomous systems capable of perceiving, understanding, and anticipating their own failures. Maintrix is the software brain of industry — a 4-layer cognitive architecture (Perception → Comprehension → Memory → Cognition) that gives machines a digital nervous system. Key capabilities include autonomous IoT perception, expert rules engine, historical similarity analysis with 120+ real industrial cases, AI-powered cognitive reasoning (Anthropic Claude), failure memory capitalization with continuous learning loop, federated inter-tenant learning, and full CCTP-compliant explainability. The GMAO modules (equipment, work orders, preventive maintenance, spare parts, etc.) serve as the operational backbone that feeds and is fed by the cognitive engine.

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
- **Styling**: Tailwind CSS with shadcn/ui component library, glassmorphism effects, gradient backgrounds, and smooth animations. Color scheme inspired by Carbon Design.
- **State Management**: TanStack Query
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation
- **Internationalization**: Custom i18n supporting French and English
- **UI/UX Decisions**: Professional design with modern aesthetics, interactive feature cards, 3D shadows, smooth animations, and gradient text. Unified branding with clear distinction between Smart Diagnostic (AI assistant) and Smart GMAO (maintenance management). Includes a full-featured React Native mobile application with offline capabilities.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with JSON responses, including GMAO-specific endpoints.
- **Storage**: PostgreSQL with Drizzle ORM
- **Build System**: Vite for frontend, esbuild for backend

### Database Design
- **ORM**: Drizzle ORM for PostgreSQL
- **Schema**: Comprehensive GMAO database covering equipment, work orders, preventive maintenance, spare parts, IoT data, KPIs, alerts, and integration logs.
- **Migration**: Drizzle-kit for schema management.

### Technical Implementations
- **AI Diagnostic Engine (CCTP-Compliant Hybrid)**: CCTP-compliant hybrid diagnostic engine combining: (1) Expert Rules Engine — 10 deterministic rules for common industrial failures (server/diagnostic-rules-engine.ts), (2) Historical Similarity Analysis — pattern matching against 120+ maintenance cases from Excel data, (3) Failure Memory — auto-capitalized validated failures from technician feedback (failureMemory table), (4) AI Structuring via Anthropic Claude — formats/enriches diagnoses without being sole decision maker (server/hybrid-diagnostic-pipeline.ts). Includes explainability with confidence factors ("12 similar cases", "Rule expert activated"), GMAO contextualization (work orders, equipment criticality, recent interventions), failure trends tracking, similar incident history, and continuous learning loop from post-intervention feedback. Exclusively uses 120 real industrial maintenance cases from Excel files for pattern matching with 98% confidence.
- **Historical Data Processing**: Dual-mode Excel import system supporting pre-loaded industrial data (from `Base_Industrie_120_Cas_Enrichie_1754590391833.xlsx`) and user-uploaded files with flexible column naming. Supports full cross-referencing and automatic equipment type normalization.
- **GMAO Platform**: Comprehensive equipment registry, advanced work order management with multi-level validation, preventive maintenance scheduling, spare parts inventory with stock optimization, and budget management.
- **Security**: Multi-level authentication (bcrypt), advanced security middleware (rate limiting, anomaly detection, CSRF protection), and a security dashboard. Implemented Role-Based Access Control (RBAC) with 7 defined roles and granular permissions.
- **Reporting**: Comprehensive maintenance reporting system with automatic generation (intervention, monthly, dashboard reports) including KPIs. Client-side PDF generation using jsPDF and html2canvas.
- **Mobile Application**: Complete React Native app with comprehensive offline capabilities including SQLite local database, equipment QR code scanner, step-by-step repair guidance, work order management, diagnostic sessions, data synchronization, and field technician workflow support.
- **Multi-tenant SaaS Infrastructure**: Enterprise-grade multi-tenant architecture with email invitation system (SendGrid integration), tenant creation/management, enterprise security middleware, and federated AI learning.

## External Dependencies
- **UI Components**: Radix UI
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS, Lucide React (icons)
- **Form Handling**: React Hook Form, Zod
- **Database**: Neon Database (serverless PostgreSQL)
- **ORM**: Drizzle ORM
- **Session Management**: PostgreSQL session store
- **Development Tools**: TSX, Vite, PostCSS, Autoprefixer
- **Enterprise Integration**: SAP ERP Connector, IoT (MQTT simulation), Maximo (integration ready), SCADA (integration ready).
- **Payment Gateways**: Stripe, PayPal
- **Email Service**: SendGrid

## Recent Updates

### CI/CD Pipeline AWS via GitHub Actions (February 2026)
✅ **GitHub Actions CI pipeline** - Automated build, type-check, and Docker image push to AWS ECR on every push to main
✅ **ECS Fargate deployment workflow** - Auto-deploy to AWS ECS after successful CI (production-grade, managed)
✅ **EC2 SSH deployment workflow** - Manual trigger deploy to EC2 via SSH (budget-friendly option)
✅ **AWS CloudFormation template** - One-command infrastructure setup (VPC, ECS, RDS, ALB, Security Groups)
✅ **AWS SSM Parameter Store** - Secure secret management script for production secrets
✅ **Docker vulnerability scanning** - Trivy integration for container security
✅ **Rollback support** - Automatic rollback on EC2 deploy failure, ECS native rollback
📁 Pipeline files in `.github/workflows/`, infrastructure in `aws/`
📄 Guide complet dans `GUIDE_DEPLOIEMENT_AWS_GITHUB.md`

### Documentation & Deployment Update (February 2026)
✅ **17 duplicate documentation files removed** (deployment reports, old branding files, redundant security reports)
✅ **Core docs updated**: INSTALL.md, INDEX_DOCUMENTATION_COMPLETE.md, .env.example
✅ **Deployment files updated**: docker-compose.yml, docker-compose.simple.yml with ANTHROPIC_API_KEY and SENDGRID_API_KEY
✅ **Equipment ID bug fixed**: Global uniqueness check prevents duplicate key errors
✅ **.env.example**: Corrected from OpenAI to Anthropic Claude, added SendGrid
📁 Remaining docs: 35 files (from 52), each serving a distinct purpose

### 9 Advanced Feature Pages (February 2026)
✅ **Client Portal** - Token-based public access for clients to view work order status
✅ **SLA Management** - SLA rules definition, compliance tracking, breach monitoring with escalation
✅ **Machine Health Scoring** - Equipment health scores (0-100), risk assessment, AI recommendations
✅ **Smart Alerts & Action Recommendations** - AI-powered alert system with pattern detection
✅ **Sensor Hub (IoT)** - Real-time IoT sensor monitoring, alarm tracking, protocol support (Modbus, MQTT, OPC-UA, LoRaWAN)
✅ **Equipment QR Codes** - QR code generation and printing for equipment identification
✅ **Equipment Management Improvements** - Optional equipmentId (auto-generated), optional zone, expanded equipment types, controlled Select components
✅ **Work Order Deletion** - DELETE endpoint with tenant security isolation
✅ **Inline Equipment Creation** - Quick-add equipment from work order form
📁 Frontend pages in `client/src/pages/`, APIs in `server/gmao-routes.ts` and `server/routes.ts`

### Rebranding Complet (9 Janvier 2025)
✅ **Migration complète de "Smart GMAO DiagFix" vers "Maintrix"**
✅ 86 fichiers rebrandés avec 726 remplacements automatisés
✅ Infrastructure complète mise à jour (Docker, systemd, scripts)
✅ Backend, Frontend, Mobile, et Documentation rebrandés
✅ Nouveau fichier de constantes partagées : `shared/branding.ts`
✅ Script automatisé de rebranding créé : `scripts/rebranding.js`
✅ Domaine officiel : maintrix-t.com
📄 Rapport détaillé dans `REBRANDING_REPORT.md`

### Mise à jour Fichiers de Déploiement (19 Décembre 2025)
✅ **Configuration paiements ajoutée** aux fichiers Docker et scripts d'installation
✅ docker-compose.yml et docker-compose.simple.yml mis à jour avec Stripe/PayPal
✅ Dockerfile nettoyé avec PAYPAL_MODE=sandbox par défaut
✅ scripts/install.sh et windows-setup.bat incluent la config paiements
✅ .env.example et INSTALL.md mis à jour avec documentation paiements
✅ PayPal corrigé pour utiliser sandbox/live dynamiquement

### Nettoyage Massif du Projet (31 Janvier 2025)
✅ **60+ fichiers en doublon supprimés** pour faciliter le déploiement local
✅ Fichiers Excel consolidés (gardé uniquement la version la plus récente)
✅ Configuration Docker simplifiée (docker-compose.yml unique)
✅ Scripts d'installation consolidés (15+ scripts en doublon supprimés)
✅ Anciens fichiers ML Python supprimés (système utilise TypeScript/Anthropic Claude)
✅ Fichiers de test temporaires nettoyés
✅ Documentation consolidée
✅ 25+ fichiers de débogging supprimés (Pasted-*.txt, cookies, etc.)
✅ Structure optimisée pour déploiement local
📄 Détails complets dans `NETTOYAGE_PROJET.md`

### Système de Pièces Justificatives
✅ Upload de documents pour bons de commande fonctionnel
✅ API complète (upload, liste, téléchargement, suppression)
✅ Interface utilisateur intégrée avec validation client-side
✅ Formats: PDF, Word, Excel, Images (max 10MB, 5 fichiers)
📄 Guide complet dans `GUIDE_PIECES_JUSTIFICATIVES.md`

### RBAC Système
✅ 7 rôles avec permissions granulaires
✅ Middlewares backend + hooks React
✅ Isolation des données par rôle
📄 Documentation dans `RBAC_GUIDE.md`

### Documentation Sécurité SOC 2 / ISO 27001 (Janvier 2025)
✅ **6 documents de conformité créés** pour préparer les certifications
✅ Politique de Sécurité de l'Information (14 sections)
✅ Procédure de Réponse aux Incidents (7 phases)
✅ Plan de Continuité d'Activité (RTO 4h / RPO 24h)
✅ Registre des Risques (14 risques évalués)
✅ Mapping des Contrôles SOC 2 / ISO 27001 (97% couverture SOC 2)
✅ Annexes : Utilisation acceptable, SDLC sécurisé, Inventaire actifs
📁 Tous les documents dans `docs/security/`

## Security & Compliance Documentation

### SOC 2 / ISO 27001 Preparation
Located in `docs/security/`:
- `POLITIQUE_SECURITE_INFORMATION.md` - Information Security Policy
- `PROCEDURE_REPONSE_INCIDENTS.md` - Incident Response Procedure
- `PLAN_CONTINUITE_ACTIVITE.md` - Business Continuity Plan (PCA)
- `REGISTRE_RISQUES.md` - Risk Register with 14 identified risks
- `MAPPING_CONTROLES_SOC2_ISO27001.md` - Control mapping (97% SOC 2, 84% ISO 27001)
- `ANNEXES_POLITIQUE_SECURITE.md` - Policy annexes (acceptable use, SDLC, assets)

### Certification Roadmap
- **Year 1**: SOC 2 Type I (~20-40k€)
- **Year 2**: SOC 2 Type II (~30-60k€)
- **Year 3**: ISO 27001 (~25-50k€)
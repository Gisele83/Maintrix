# Maintrix - L'intelligence cognitive au service des industries critiques

## Overview
Maintrix is a cognitive industrial infrastructure designed to transform industrial machines into autonomous systems capable of perceiving, understanding, anticipating, and acting on their own failures. It serves as the software brain for industrial operations, built on a formal 6-layer cognitive architecture. The system orchestrates a multi-agent distributed system with a Cognitive Kernel, offering capabilities such as autonomous IoT perception, AI-powered cognitive reasoning, an Industrial Knowledge Graph for causal reasoning, hybrid physics+data models, continuous learning loops, closed-loop industrial automation, and graduated autonomy levels. Maintrix aims to provide full CCTP-compliant explainability and leverages GMAO modules as its operational backbone.

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
- **Cognitive Industrial Infrastructure**: Formal 6-layer architecture with a Cognitive Kernel orchestrating a multi-agent distributed system (Equipment, Site, Global Agents). Features closed-loop industrial automation, Industrial Knowledge Graph (48+ nodes, 46+ edges), hybrid physics+data models, structured auto-learning, governance and trust layer, graduated autonomy model (Levels 0-5), and industrialization APIs.
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
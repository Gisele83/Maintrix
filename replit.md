# Smart GMAO DiagFix - Compressed

## Overview
Smart GMAO DiagFix is an integrated platform combining Smart Diagnostic (AI-powered diagnostics) with Smart GMAO (comprehensive Computerized Maintenance Management System). This unified solution leverages advanced machine learning, IoT sensor data, and predictive maintenance to provide a comprehensive industrial maintenance management system. Its purpose is to streamline maintenance operations, enhance diagnostic accuracy, and enable proactive maintenance strategies. Key capabilities include AI-driven diagnostics, comprehensive asset management, work order management, preventive maintenance planning, spare parts inventory, and enterprise system integration.

## User Preferences
Preferred communication style: Simple, everyday language.
User requested improvements based on provided database and enhanced specifications document.
User loves the new modern interface design with glassmorphism effects and gradient styling.
User confirmed architecture requirements: Interface unifiée avec architecture modulaire - Module GMAO (planification, interventions, techniciens) + Module Diagnostic intelligent (analyse symptômes → diagnostic → préconisations → lien vers intervention).
User specifically requested to use ONLY the provided Excel file (Base_Industrie_120_Cas_Enrichie_1754588437015.xlsx) as historical database for diagnostic pattern matching and to allow users to upload their own historical maintenance data.

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
- **AI Diagnostic Engine**: Combines Standard ML (Random Forest, Gradient Boosting with TF-IDF), Advanced ML (Neural Networks, SVM, Anomaly Detection using MLP and Isolation Forest), and Ensemble ML (combining 9 algorithms for multi-model consensus). Includes predictive maintenance scheduling, failure risk assessment, and continuous learning system with feedback collection. Now exclusively uses historical industrial maintenance cases from Excel files for pattern matching.
- **Historical Data Processing**: Excel processor system (simple-excel-reader.ts, excel-processor.ts) that extracts maintenance cases from user-provided Excel files or default industrial database. Supports automatic column detection and data normalization for equipment types (moteur, pompe, compresseur, convoyeur).
- **GMAO Platform**: Comprehensive equipment registry, advanced work order management with multi-level validation, preventive maintenance scheduling (time, usage, condition-based), complete spare parts inventory with stock optimization and automatic unique reference generation, and a budget management system with multi-level approvals.
- **Security**: Multi-level authentication (bcrypt), advanced security middleware (rate limiting, anomaly detection, CSRF protection), and a security dashboard.
- **Reporting**: Comprehensive maintenance reporting system with automatic generation (intervention, monthly, dashboard reports) including KPIs (MTBF, MTTR, OEE, availability).
- **Mobile Application**: React Native app with offline capabilities, QR code scanner, history tracking, step-by-step repair guidance, and a robust offline storage with SQLite.
- **Payment System**: PCI-DSS compliant architecture with Stripe and PayPal gateway support, ready for subscription plan activation.

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
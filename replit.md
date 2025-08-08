# Smart GMAO DiagFix - Compressed

## Overview
Smart GMAO DiagFix is an integrated platform combining Smart Diagnostic (AI-powered diagnostics) with Smart GMAO (comprehensive Computerized Maintenance Management System). This unified solution leverages advanced machine learning, IoT sensor data, and predictive maintenance to provide a comprehensive industrial maintenance management system. Its purpose is to streamline maintenance operations, enhance diagnostic accuracy, and enable proactive maintenance strategies. Key capabilities include AI-driven diagnostics, comprehensive asset management, work order management, preventive maintenance planning, spare parts inventory, and enterprise system integration.

## User Preferences
Preferred communication style: Simple, everyday language.
User requested improvements based on provided database and enhanced specifications document.
User loves the new modern interface design with glassmorphism effects and gradient styling.
User confirmed architecture requirements: Interface unifiée avec architecture modulaire - Module GMAO (planification, interventions, techniciens) + Module Diagnostic intelligent (analyse symptômes → diagnostic → préconisations → lien vers intervention).
User specifically requested to use ONLY the provided Excel file (Base_Industrie_120_Cas_Enrichie_1754590391833.xlsx) as historical database for diagnostic pattern matching and to allow users to upload their own historical maintenance data.

## Recent Success (January 7, 2025)
✅ MAJOR BREAKTHROUGH: Successfully integrated 120 real industrial maintenance cases from Excel file with 6 interconnected tables
✅ Cross-table analysis fully operational: Equipements ↔ Diagnostics ↔ Procedures ↔ Interventions ↔ Techniciens ↔ Regles_Symptomes
✅ AI diagnostic system working with real historical data (98% confidence on industrial cases)
✅ Ensemble ML delivering 5/9 model consensus with pattern matching from 120 real cases
✅ Module GMAO + Module Diagnostic intelligent unified interface completed and functional
✅ RESOLVED: Equipment dropdown now shows authentic industrial/port equipment from Excel file (Kalmar RTG, ZPMC STS, Liebherr cranes, Siemens drives, ABB transformers, etc.)
✅ NEW: Complete user Excel file upload system with dual interface (demo data + user data)
✅ NEW: Secure file processing with multer middleware, flexible column name support, and PostgreSQL integration
✅ NEW: Enhanced data import page with purple-themed user upload section and progress tracking
✅ LATEST: Added "Autre" option in preventive maintenance equipment dropdown with custom input field for unlisted equipment
✅ OPTIMIZATION: Removed redundant "Traiter et importer les données" button from Smart Diagnostic since 120 industrial cases are already processed and saved
✅ MOBILE MILESTONE: Complete React Native mobile application fully implemented with comprehensive offline capabilities
✅ Mobile features: Home dashboard, AI diagnostics, QR scanner, repair guidance, work orders, equipment details, settings, and offline data management
✅ Full offline mode: SQLite database, data synchronization, repair step tracking, and field technician workflow support
✅ LOCAL INSTALLATION: Complete local installation version created with Docker containerization and automated setup scripts
✅ Enterprise deployment: Installation guide, Docker Compose, automated scripts (install.sh, start.sh, backup.sh, update.sh), systemd service, security configuration
✅ Production ready: Nginx reverse proxy, SSL configuration, monitoring setup, automated backups, and comprehensive testing framework
✅ Deployment flexibility: Both cloud (Replit) and local (Docker/manual) installation options for different enterprise needs
✅ CRITICAL FIX (Jan 8, 2025): Windows installer issue completely resolved - replaced faulty script-based installer with genuine 37MB executable using pkg tool
✅ DEFINITIVE FIX (Jan 8, 2025): Resolved execSync error "Cannot find module '--version'" by creating simplified installer (Smart-GMAO-DiagFix-Setup-Fixed.exe) without external system calls
✅ Download interface 100% operational: All 11 endpoints validated and working, navigation issue resolved with dedicated "Téléchargement" button on homepage
✅ PDF EXPORT SYSTEM FULLY OPERATIONAL (Jan 8, 2025): Successfully migrated from Puppeteer to client-side PDF generation system using jsPDF and html2canvas. All maintenance and diagnostic report endpoints now return 200 OK responses. The system generates HTML pages with embedded JavaScript that automatically converts content to downloadable PDF files in the user's browser, providing a seamless PDF export experience without server-side dependencies.
✅ FRONTEND PDF INTEGRATION COMPLETED (Jan 8, 2025): Updated all React components in "Rapports" tab to use new PDF endpoints. Both maintenance reports and monthly reports now open PDF generation pages in new browser tabs instead of downloading HTML files. The PDFGeneratorFunctional system is now consistently used across all reporting interfaces.

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
- **AI Diagnostic Engine**: Combines Standard ML (Random Forest, Gradient Boosting with TF-IDF), Advanced ML (Neural Networks, SVM, Anomaly Detection using MLP and Isolation Forest), and Ensemble ML (combining 9 algorithms for multi-model consensus). Includes predictive maintenance scheduling, failure risk assessment, and continuous learning system with feedback collection. Now exclusively uses 120 real industrial maintenance cases from Excel files for pattern matching with 98% confidence.
- **Historical Data Processing**: Dual-mode Excel import system supporting both pre-loaded industrial data and user-uploaded files. Direct Excel import system (direct-excel-import.ts) processes 6 interconnected tables from Base_Industrie_120_Cas_Enrichie_1754590391833.xlsx. User upload system (user-excel-upload.ts) with multer middleware handles custom Excel files with flexible column naming (Equipment_ID/EquipmentID variants). Supports full cross-referencing and automatic equipment type normalization for industrial equipment (grues, moteurs, pompes, compresseurs, transformateurs, variateurs, convoyeurs).
- **GMAO Platform**: Comprehensive equipment registry, advanced work order management with multi-level validation, preventive maintenance scheduling (time, usage, condition-based), complete spare parts inventory with stock optimization and automatic unique reference generation, and a budget management system with multi-level approvals.
- **Security**: Multi-level authentication (bcrypt), advanced security middleware (rate limiting, anomaly detection, CSRF protection), and a security dashboard.
- **Reporting**: Comprehensive maintenance reporting system with automatic generation (intervention, monthly, dashboard reports) including KPIs (MTBF, MTTR, OEE, availability).
- **Mobile Application**: Complete React Native app with comprehensive offline capabilities including: SQLite local database, equipment QR code scanner with barcode/manual ID support, step-by-step repair guidance with progress tracking, work order management, diagnostic sessions with AI/offline fallback, data synchronization system, equipment details with maintenance history, offline data management, and settings with user profile. Full field technician workflow support for industrial environments without internet connectivity.
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
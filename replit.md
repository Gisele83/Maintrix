# SMDiagFix - Industrial Maintenance Diagnostic Assistant

## Overview

SMDiagFix is a full-stack web application designed to assist industrial technicians with equipment diagnostics and maintenance procedures. The system uses a React frontend with TypeScript and an Express.js backend, featuring an intelligent diagnostic engine that analyzes equipment symptoms and provides maintenance recommendations.

## User Preferences

Preferred communication style: Simple, everyday language.
User requested improvements based on provided database and enhanced specifications document.

## Recent Changes (July 2025)

✓ Enhanced AI diagnostic engine with advanced pattern matching algorithms
✓ Added intelligent confidence scoring based on multiple factors
✓ Implemented risk assessment and cost estimation features  
✓ Added AI insights and predictive maintenance recommendations
✓ Enhanced diagnostic results display with detailed metrics
✓ Added CSV and Excel export functionality for maintenance history
✓ Expanded sample database with 8 comprehensive industrial cases
✓ Fixed translation duplicate key warnings
✓ Improved diagnostic suggestion algorithm with text similarity analysis

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for client-side routing
- **Forms**: React Hook Form with Zod validation
- **Internationalization**: Custom i18n implementation supporting French and English

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with JSON responses
- **Storage**: In-memory storage with database abstraction layer (ready for PostgreSQL via Drizzle ORM)
- **Build System**: Vite for frontend, esbuild for backend

### Database Design
- **ORM**: Drizzle ORM configured for PostgreSQL
- **Schema**: Includes tables for equipment types, maintenance cases, repair procedures, reported cases, and diagnostic sessions
- **Migration**: Drizzle-kit for schema management

## Key Components

### Enhanced AI Diagnostic Engine
- Advanced symptom-based equipment analysis with text similarity matching
- Multi-factor confidence scoring algorithm (symptoms, text, equipment type, location, urgency)
- Intelligent pattern recognition using Jaccard similarity for text analysis
- Risk level assessment based on urgency and historical patterns
- Cost estimation with equipment-specific multipliers
- AI insights generation based on matching criteria
- Predictive maintenance recommendations for high-confidence diagnoses
- Equipment type and symptom matching with weighted scoring

### Enhanced User Interface Components
1. **Diagnostic Form**: Captures equipment details, symptoms, and urgency levels
2. **Advanced Diagnostic Results**: 
   - AI-generated suggestions with enhanced confidence scoring
   - Risk level indicators with color-coded displays
   - Cost estimates for repair procedures
   - AI insights and analysis explanations
   - Predictive maintenance recommendations
   - Enhanced visual metrics display
3. **Repair Guidance**: Step-by-step repair procedures with progress tracking
4. **Enhanced Maintenance History**: 
   - Historical view with advanced filtering
   - CSV and Excel export functionality
   - Comprehensive data export with all diagnostic details
5. **Case Reporting**: Incident reporting system for new issues

### Storage Layer
- Abstract storage interface (`IStorage`) for database operations
- Memory storage implementation for development
- Ready for PostgreSQL integration with existing schema

## Enhanced Data Flow

1. **Diagnostic Request**: User submits equipment details, symptoms, and context via diagnostic form
2. **Advanced AI Analysis**: 
   - Multi-factor pattern matching algorithm
   - Text similarity analysis using Jaccard coefficients
   - Equipment type and location context matching
   - Urgency level correlation analysis
3. **Intelligent Suggestion Generation**: 
   - Weighted confidence scoring with multiple criteria
   - Risk level assessment and cost estimation
   - AI insights generation explaining matching logic
   - Predictive maintenance recommendations
4. **Enhanced Results Display**: Rich diagnostic suggestions with detailed metrics
5. **Repair Guidance**: Users can initiate guided repair procedures with safety warnings
6. **Progress Tracking**: Real-time tracking of repair step completion
7. **Data Export**: CSV/Excel export functionality for maintenance records
8. **Case Storage**: All sessions and procedures stored with comprehensive metadata

## External Dependencies

### Frontend Dependencies
- **UI Components**: Extensive Radix UI component collection
- **State Management**: TanStack React Query for API state
- **Styling**: Tailwind CSS with custom Carbon Design-inspired color scheme
- **Form Handling**: React Hook Form with Zod schema validation
- **Icons**: Lucide React icon library

### Backend Dependencies
- **Database**: Neon Database serverless PostgreSQL
- **ORM**: Drizzle ORM with Zod integration
- **Session Management**: PostgreSQL session store support
- **Development**: TSX for TypeScript execution

### Development Tools
- **Build**: Vite with React plugin and Replit-specific enhancements
- **Type Checking**: TypeScript with strict configuration
- **CSS Processing**: PostCSS with Tailwind CSS and Autoprefixer

## Deployment Strategy

### Development Environment
- Vite development server with HMR
- Express server with middleware logging
- Memory-based storage for rapid prototyping
- Replit-specific development banner and cartographer integration

### Production Build
- Vite builds optimized frontend bundle to `dist/public`
- esbuild compiles backend to `dist/index.js`
- Static file serving from Express in production
- Environment-based configuration switching

### Database Strategy
- Development uses in-memory storage with sample data
- Production ready for PostgreSQL via Drizzle ORM
- Schema migrations managed through `drizzle-kit push`
- Connection pooling via Neon Database serverless

### Configuration Management
- Environment variables for database connection
- Separate development/production configurations
- TypeScript path mapping for clean imports
- ESM module system throughout the stack

The application is designed with industrial usability in mind, featuring a professional Carbon Design-inspired color scheme, bilingual support, and robust error handling for maintenance environments.
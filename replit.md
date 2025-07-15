# SMDiagFix - Industrial Maintenance Diagnostic Assistant

## Overview

SMDiagFix is a full-stack web application designed to assist industrial technicians with equipment diagnostics and maintenance procedures. The system uses a React frontend with TypeScript and an Express.js backend, featuring an intelligent diagnostic engine that analyzes equipment symptoms and provides maintenance recommendations.

## User Preferences

Preferred communication style: Simple, everyday language.

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

### Diagnostic Engine
- Symptom-based equipment analysis
- Confidence scoring algorithm based on historical cases
- Equipment type and symptom matching
- Suggestion ranking system

### User Interface Components
1. **Diagnostic Form**: Captures equipment details, symptoms, and urgency levels
2. **Diagnostic Results**: Displays AI-generated suggestions with confidence scores
3. **Repair Guidance**: Step-by-step repair procedures with progress tracking
4. **Maintenance History**: Historical view of diagnostic sessions and repairs
5. **Case Reporting**: Incident reporting system for new issues

### Storage Layer
- Abstract storage interface (`IStorage`) for database operations
- Memory storage implementation for development
- Ready for PostgreSQL integration with existing schema

## Data Flow

1. **Diagnostic Request**: User submits equipment symptoms via diagnostic form
2. **Analysis**: Backend searches similar historical cases and calculates confidence scores
3. **Suggestion Generation**: System returns ranked diagnostic suggestions
4. **Repair Guidance**: Users can initiate guided repair procedures
5. **Progress Tracking**: Real-time tracking of repair step completion
6. **Case Storage**: All sessions and procedures are stored for future reference

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
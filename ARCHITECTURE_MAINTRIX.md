# Architecture Maintrix - Documentation Technique

## Vue d'Ensemble du Système

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           UTILISATEURS                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Navigateur Web]    [Application Mobile]    [Intégrations IoT]              │
│       ↓                      ↓                       ↓                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COUCHE PRÉSENTATION                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │   React SPA     │    │  React Native   │    │   API REST      │          │
│  │   (Vite)        │    │   Mobile App    │    │   Externe       │          │
│  │                 │    │                 │    │                 │          │
│  │ - TanStack Query│    │ - Mode Offline  │    │ - IoT Sensors   │          │
│  │ - Wouter Router │    │ - QR Scanner    │    │ - ERP (SAP)     │          │
│  │ - shadcn/ui     │    │ - SQLite Local  │    │ - SCADA         │          │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                        HTTPS (Port 443/5000)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          REVERSE PROXY                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                        Nginx + Let's Encrypt SSL                             │
│                     (Load Balancing, Gzip, Cache)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COUCHE APPLICATION                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      Express.js Server                               │    │
│  │                        (Node.js 20+)                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────┬───────────────┼───────────────┬─────────────────┐      │
│  │                 │               │               │                 │      │
│  ▼                 ▼               ▼               ▼                 ▼      │
│ ┌───────┐    ┌──────────┐   ┌──────────┐   ┌──────────┐    ┌───────────┐   │
│ │Sécurité│   │   Auth   │   │  GMAO    │   │Diagnostic│    │Paiements  │   │
│ │Middle- │   │Enterprise│   │  Core    │   │    IA    │    │Stripe/    │   │
│ │ware   │   │          │   │          │   │          │    │PayPal     │   │
│ ├───────┤   ├──────────┤   ├──────────┤   ├──────────┤    ├───────────┤   │
│ │Helmet │   │JWT/Cookie│   │Équipement│   │Claude AI │    │Webhooks   │   │
│ │CSRF   │   │SSO/MFA   │   │OT/Plans  │   │9 Algos ML│    │Abonnement │   │
│ │Rate   │   │RBAC      │   │Stock     │   │Patterns  │    │Licences   │   │
│ │Limit  │   │Tenant    │   │Achats    │   │Historique│    │Facturation│   │
│ └───────┘   └──────────┘   └──────────┘   └──────────┘    └───────────┘   │
│                                                                              │
│  ┌─────────────────┬───────────────┬───────────────┬─────────────────┐      │
│  │                 │               │               │                 │      │
│  ▼                 ▼               ▼               ▼                 ▼      │
│ ┌───────────┐ ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐      │
│ │ Rapports  │ │   IoT    │  │  Email   │  │Gamifica- │  │  Import/  │      │
│ │   PDF     │ │Connector │  │ SendGrid │  │  tion    │  │  Export   │      │
│ └───────────┘ └──────────┘  └──────────┘  └──────────┘  └───────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COUCHE DONNÉES                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Drizzle ORM (TypeScript)                          │    │
│  │              Schémas typés + Validation Zod                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    PostgreSQL 16 (Neon)                              │    │
│  │                                                                      │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │    │
│  │  │   Tenants   │  │ Equipment   │  │ Work Orders │  │   Users    │  │    │
│  │  │  (Multi-    │  │  Registry   │  │  & Plans    │  │  Profiles  │  │    │
│  │  │   tenant)   │  │             │  │             │  │            │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │    │
│  │                                                                      │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐  │    │
│  │  │ Spare Parts │  │  Purchase   │  │    IoT      │  │   Audit    │  │    │
│  │  │  & Stock    │  │   Orders    │  │   Data      │  │    Logs    │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘  │    │
│  │                                                                      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Architecture Frontend

### 1.1 Technologies
| Composant | Technologie | Rôle |
|-----------|-------------|------|
| Framework | React 18 | Interface utilisateur |
| Build | Vite | Bundling et développement |
| Routing | Wouter | Navigation SPA |
| State | TanStack Query | Cache et synchronisation |
| UI | shadcn/ui + Tailwind | Composants et styling |
| Forms | React Hook Form + Zod | Validation |
| i18n | Custom | Français/Anglais |

### 1.2 Structure des Dossiers
```
client/
├── src/
│   ├── components/       # Composants réutilisables
│   │   ├── ui/          # shadcn/ui (Button, Card, Dialog...)
│   │   └── ...          # Composants métier
│   ├── pages/           # ~30 pages (routes)
│   │   ├── landing.tsx
│   │   ├── gmao-dashboard.tsx
│   │   ├── work-orders.tsx
│   │   ├── smart-diagnostic.tsx
│   │   └── ...
│   ├── hooks/           # Hooks personnalisés
│   │   ├── useAuth.ts
│   │   ├── useRBAC.ts
│   │   └── ...
│   ├── lib/             # Utilitaires
│   │   └── queryClient.ts
│   └── App.tsx          # Router principal
```

---

## 2. Architecture Backend

### 2.1 Technologies
| Composant | Technologie | Rôle |
|-----------|-------------|------|
| Runtime | Node.js 20+ | Exécution JavaScript |
| Framework | Express.js | API REST |
| ORM | Drizzle | Accès base de données |
| Auth | JWT + Cookies sécurisés | Authentification |
| Validation | Zod | Validation des données |

### 2.2 Structure des Dossiers
```
server/
├── index.ts              # Point d'entrée
├── routes.ts             # Routes générales
├── gmao-routes.ts        # Routes GMAO (équipements, OT, stock...)
├── gmao-storage.ts       # Accès données GMAO
├── auth.ts               # Authentification
├── rbac-permissions.ts   # Définition des rôles
├── rbac-middleware.ts    # Contrôle d'accès
├── tenant-middleware.ts  # Isolation multi-tenant
├── email-service.ts      # Envoi emails (SendGrid)
├── anthropic-service.ts  # Intégration Claude AI
├── stripe-routes.ts      # Paiements Stripe
├── paypal-routes.ts      # Paiements PayPal
└── integrations/         # Connecteurs externes
    ├── iot-connector.ts
    └── erp-connector.ts
```

### 2.3 Middlewares (ordre d'exécution)
```
1. helmet()              → En-têtes de sécurité
2. cors()                → Cross-Origin
3. cookieParser()        → Parsing cookies
4. express.json()        → Parsing JSON
5. rateLimiter()         → Limitation requêtes
6. csrfProtection()      → Protection CSRF
7. tenantMiddleware()    → Isolation données
8. authMiddleware()      → Vérification auth
9. rbacMiddleware()      → Vérification permissions
```

---

## 3. Schéma Base de Données

### 3.1 Tables Principales

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            MULTI-TENANT                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐        │
│  │   tenants   │◄────────│    users    │────────►│userProfiles │        │
│  │             │         │             │         │             │        │
│  │ id          │         │ id          │         │ firstName   │        │
│  │ name        │         │ username    │         │ lastName    │        │
│  │ domain      │         │ email       │         │ phone       │        │
│  │ license     │         │ role        │         │ department  │        │
│  │ maxUsers    │         │ tenantId ──►│         │ skills      │        │
│  └─────────────┘         └─────────────┘         └─────────────┘        │
│         │                       │                                        │
│         │ tenantId              │ assignedTechnicianId                   │
│         ▼                       ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         GMAO CORE                                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐        │
│  │ equipment   │◄────────│ workOrders  │────────►│ spareParts  │        │
│  │  Registry   │         │             │         │             │        │
│  │             │         │ id          │         │ partNumber  │        │
│  │ id          │         │ title       │         │ name        │        │
│  │ name        │         │ description │         │ quantity    │        │
│  │ type        │         │ priority    │         │ minStock    │        │
│  │ location    │         │ status      │         │ price       │        │
│  │ status      │         │ equipmentId │         │ location    │        │
│  │ tenantId    │         │ tenantId    │         │ tenantId    │        │
│  └─────────────┘         └─────────────┘         └─────────────┘        │
│         │                       │                       │                │
│         ▼                       ▼                       ▼                │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐        │
│  │maintenance  │         │ preventive  │         │   stock     │        │
│  │  Counters   │         │Maintenance  │         │  Movements  │        │
│  │             │         │   Plans     │         │             │        │
│  │ type(heures)│         │ frequency   │         │ type        │        │
│  │ currentValue│         │ nextDueDate │         │ quantity    │        │
│  │ threshold   │         │ counterBased│         │ workOrderId │        │
│  └─────────────┘         └─────────────┘         └─────────────┘        │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                       ACHATS & FOURNISSEURS                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐        │
│  │  suppliers  │◄────────│ purchase    │────────►│ purchase    │        │
│  │             │         │   Orders    │         │ OrderItems  │        │
│  │ name        │         │             │         │             │        │
│  │ contact     │         │ orderNumber │         │ partId      │        │
│  │ email       │         │ status      │         │ quantity    │        │
│  │ phone       │         │ totalAmount │         │ unitPrice   │        │
│  └─────────────┘         └─────────────┘         └─────────────┘        │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      MONITORING & AUDIT                          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐        │
│  │   alerts    │         │  kpiMetrics │         │ auditLogs   │        │
│  │Notifications│         │             │         │             │        │
│  │             │         │ mtbf        │         │ action      │        │
│  │ type        │         │ mttr        │         │ userId      │        │
│  │ severity    │         │ availability│         │ timestamp   │        │
│  │ message     │         │ preventive% │         │ details     │        │
│  └─────────────┘         └─────────────┘         └─────────────┘        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Intégrations Externes

| Service | Fichier | Fonction |
|---------|---------|----------|
| **Stripe** | server/stripe-routes.ts | Paiements par carte |
| **PayPal** | server/paypal-routes.ts | Paiements alternatifs |
| **SendGrid** | server/email-service.ts | Emails transactionnels |
| **Anthropic Claude** | server/anthropic-service.ts | Diagnostic IA |
| **MQTT (IoT)** | server/integrations/iot-connector.ts | Capteurs temps réel |

---

## 5. Sécurité Multi-Couches

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        COUCHES DE SÉCURITÉ                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. RÉSEAU                                                               │
│     └── HTTPS (TLS 1.3) + Nginx Reverse Proxy                           │
│                                                                          │
│  2. APPLICATION                                                          │
│     ├── Helmet (en-têtes sécurité)                                      │
│     ├── Rate Limiting (100 req/15min)                                   │
│     ├── CSRF Protection (tokens)                                        │
│     └── Input Validation (Zod)                                          │
│                                                                          │
│  3. AUTHENTIFICATION                                                     │
│     ├── Cookies HTTPOnly + Secure                                       │
│     ├── JWT avec expiration                                             │
│     ├── MFA (TOTP optionnel)                                            │
│     └── Sessions PostgreSQL                                             │
│                                                                          │
│  4. AUTORISATION (RBAC)                                                  │
│     ├── 7 rôles définis                                                 │
│     ├── Permissions granulaires                                         │
│     └── Validation côté serveur                                         │
│                                                                          │
│  5. ISOLATION DONNÉES (Multi-Tenant)                                     │
│     ├── tenantId sur toutes les tables                                  │
│     ├── Filtrage automatique requêtes                                   │
│     └── Audit logging                                                   │
│                                                                          │
│  6. BASE DE DONNÉES                                                      │
│     ├── Connexion SSL                                                   │
│     ├── Mots de passe hashés (bcrypt)                                   │
│     └── Prepared statements (anti-injection)                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Options de Déploiement

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    OPTIONS DE DÉPLOIEMENT                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  OPTION A: REPLIT (SaaS)                                                 │
│  ─────────────────────────────────────────────────                       │
│  [Replit App] ──► [Replit DB Dev] ──► [Publish] ──► [Replit DB Prod]    │
│                                                                          │
│  OPTION B: CLOUD EXTERNE (AWS/Scaleway/OVH)                              │
│  ─────────────────────────────────────────────────                       │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                         AWS                                      │    │
│  │  ┌─────────┐    ┌─────────────────┐    ┌─────────────────────┐  │    │
│  │  │   EC2   │───►│  Docker Compose │───►│  RDS PostgreSQL     │  │    │
│  │  │(t3.med) │    │  (Maintrix App) │    │  (ou Docker PG)     │  │    │
│  │  └─────────┘    └─────────────────┘    └─────────────────────┘  │    │
│  │       │                                                          │    │
│  │       ▼                                                          │    │
│  │  ┌─────────┐    ┌─────────────────┐    ┌─────────────────────┐  │    │
│  │  │ Route53 │───►│  Load Balancer  │───►│     CloudFront      │  │    │
│  │  │  (DNS)  │    │    (optionnel)  │    │     (CDN - opt)     │  │    │
│  │  └─────────┘    └─────────────────┘    └─────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  OPTION C: SERVEUR LOCAL (On-Premise)                                    │
│  ─────────────────────────────────────────────────                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  [Serveur Linux/Windows]                                         │    │
│  │       │                                                          │    │
│  │       ├── Docker + Docker Compose                                │    │
│  │       ├── Nginx (reverse proxy + SSL)                            │    │
│  │       ├── PostgreSQL (conteneur ou natif)                        │    │
│  │       └── Sauvegarde automatique (cron)                          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Fonctionnalités Avancées (Février 2026)

### 7.1 🌐 Portail Client
**Route :** `/client-portal`
**API :** `GET /api/client-portal/:token`
Accès public par token permettant aux clients de consulter le statut de leurs ordres de travail sans authentification. Génération de liens de partage sécurisés avec expiration configurable.

### 7.2 📋 Gestion SLA (Service Level Agreement)
**Route :** `/sla-management`
**API :** `GET/POST /api/sla-rules`, `GET /api/sla-compliance`, `GET /api/sla-breaches`
Définition de règles SLA par priorité et type d'équipement. Suivi de conformité en temps réel, monitoring des dépassements avec système d'escalade automatique par notifications.

### 7.3 💚 Score Santé Machine
**Route :** `/machine-health`
**API :** `GET /api/equipment-health/:id`, `GET /api/equipment-health/scores`
Score de santé des équipements de 0 à 100, basé sur l'historique de maintenance, l'âge, la fréquence des pannes. Évaluation des risques et recommandations IA pour la maintenance prédictive.

### 7.4 🔔 Alertes Intelligentes & Recommandations d'Actions
**Route :** `/smart-alerts`
**API :** `GET /api/smart-alerts`, `POST /api/smart-alerts/acknowledge`
Système d'alertes alimenté par l'IA avec détection de patterns récurrents. Recommandations d'actions contextuelles basées sur l'historique et les conditions actuelles des équipements.

### 7.5 📡 Hub Capteurs IoT (Sensor Hub)
**Route :** `/sensor-hub`
**API :** `GET /api/sensors`, `GET /api/sensors/:id/data`, `GET /api/sensor-alarms`
Monitoring IoT temps réel avec support multi-protocoles : Modbus, MQTT, OPC-UA, LoRaWAN. Suivi des alarmes capteurs, visualisation des données avec graphiques historiques.

### 7.6 📱 QR Codes Équipements
**Route :** `/equipment-qr`
**API :** `GET /api/equipment/:id/qr`, `POST /api/equipment/qr/generate`
Génération et impression de QR codes pour identification rapide des équipements. Scan mobile pour accès direct à la fiche équipement et création d'ordres de travail.

### 7.7 ⚙️ Améliorations Gestion Équipements
**API :** `POST/PUT /api/equipment`
- `equipmentId` désormais optionnel (auto-généré si non fourni)
- Champ `zone` optionnel pour localisation flexible
- Types d'équipements étendus (nouveaux types industriels)
- Composants Select contrôlés pour une meilleure expérience utilisateur

### 7.8 🗑️ Suppression Ordres de Travail
**API :** `DELETE /api/work-orders/:id`
Endpoint de suppression avec vérification de l'isolation tenant. Contrôle RBAC pour restreindre la suppression aux rôles autorisés. Audit log automatique de chaque suppression.

### 7.9 ➕ Création Équipement Inline
**API :** `POST /api/equipment` (depuis formulaire OT)
Ajout rapide d'un équipement directement depuis le formulaire de création d'ordre de travail, sans quitter le workflow. L'équipement créé est automatiquement sélectionné dans l'OT.

---

## 8. Scripts Disponibles

| Script | Emplacement | Fonction |
|--------|-------------|----------|
| Deploy AWS | scripts/deploy-aws.sh | Déploiement automatisé AWS |
| Deploy Scaleway | scripts/deploy-scaleway.sh | Déploiement Scaleway |
| Deploy OVH | scripts/deploy-ovh.sh | Déploiement OVH |
| Docker Compose | docker-compose.yml | Orchestration conteneurs |
| Dockerfile | Dockerfile | Construction image |

---

## 9. Fichiers de Configuration Clés

| Fichier | Rôle | Critique |
|---------|------|----------|
| `.env` | Variables d'environnement | ⚠️ OUI |
| `docker-compose.yml` | Configuration conteneurs | ⚠️ OUI |
| `shared/schema.ts` | Schéma base de données | ⚠️ OUI |
| `server/rbac-permissions.ts` | Définition des rôles | OUI |
| `nginx.conf` | Configuration reverse proxy | OUI |

---

**Document généré automatiquement pour Maintrix v3.0**
**© 2026 Maintrix - Tous droits réservés**

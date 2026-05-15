# Maintrix — Documentation Technique v2.6.0

## 1. Architecture globale

Maintrix est une plateforme industrielle modulaire fonctionnant selon une architecture hybride :

```
┌─────────────────────────────────────────────────────────────┐
│                     COUCHE PRÉSENTATION                      │
│  Web (React)  │  Desktop (Electron)  │  Mobile (React Native)│
└───────────────┬──────────────────────┬──────────────────────┘
                │       HTTPS / WSS    │
┌───────────────▼──────────────────────▼──────────────────────┐
│                   COUCHE API (Express.js)                    │
│  Auth · GMAO · Diagnostic IA · OEE · RCA · FMEA · Assets   │
│  Licences · Abonnements · IoT · Alertes · Rapports          │
└───────────────────────────┬─────────────────────────────────┘
                            │
          ┌─────────────────┼────────────────────┐
          │                 │                    │
┌─────────▼────────┐ ┌──────▼──────┐ ┌──────────▼──────────┐
│   PostgreSQL 15  │ │  Redis 7    │ │  Stockage fichiers   │
│  (données GMAO)  │ │  (sessions) │ │  (uploads/rapports)  │
└──────────────────┘ └─────────────┘ └─────────────────────-┘
```

### Ports et services

| Service | Port | Description |
|---------|------|-------------|
| Application | 5000 | Serveur Express (API + SPA) |
| PostgreSQL | 5432 | Base de données principale |
| Redis | 6379 | Cache et sessions |
| Nginx | 80/443 | Reverse proxy + SSL |
| Prometheus | 9090 | Métriques |
| Grafana | 3000 | Dashboards monitoring |

## 2. Stack technologique

### Backend
- **Runtime** : Node.js 20 LTS (TypeScript via tsx)
- **Framework** : Express.js 4.x
- **ORM** : Drizzle ORM (PostgreSQL)
- **Auth** : JWT + bcrypt + MFA + RBAC (7 rôles)
- **IA** : Anthropic Claude (claude-sonnet-4-20250514)
- **Email** : SendGrid
- **Paiements** : Stripe + PayPal

### Frontend
- **Framework** : React 18 + TypeScript
- **UI** : Tailwind CSS + shadcn/ui + Radix UI
- **État** : TanStack Query v5
- **Routing** : Wouter
- **Formulaires** : React Hook Form + Zod
- **i18n** : Français + Anglais

### Desktop
- **Framework** : Electron 29
- **Build** : electron-builder (NSIS .EXE, MSI, .DMG, .DEB)
- **Distribution** : GitHub Releases + auto-updater

### Mobile
- **Framework** : React Native (Expo)
- **Offline** : MMKV + SQLite local
- **Notifications** : Expo Push Notifications

## 3. Base de données — Schéma principal

### Tables GMAO
```sql
equipment_registry       -- Équipements industriels
work_orders              -- Ordres de travail
preventive_maintenance   -- Plans de maintenance préventive
spare_parts             -- Stock pièces détachées
calibration_records     -- Étalonnages instruments
```

### Tables analytiques
```sql
oee_records             -- Mesures OEE (Dispo × Perf × Qualité)
rca_analyses            -- Analyses causes racines
fmea_analyses           -- Analyses FMEA/AMDEC
asset_lifecycle         -- Cycle de vie actifs
budget_plans            -- Budgets maintenance
```

### Tables multi-tenant / licences
```sql
tenants                 -- Organisations / locataires
users                   -- Utilisateurs (par tenant)
license_types           -- Types de licences (solo → enterprise_l)
license_history         -- Historique activations
```

### Tables IoT / alertes
```sql
iot_sensor_data         -- Données capteurs temps réel
alerts_notifications    -- Alertes et notifications
kpi_metrics            -- Métriques KPI industriels
```

## 4. Sécurité

### Authentification
- Sessions JWT (HttpOnly cookies) + CSRF tokens
- Refresh tokens rotatifs
- MFA (TOTP/HOTP) optionnel par utilisateur
- Verrouillage après 5 tentatives (15 min)
- Journalisation de toutes les connexions

### Autorisations (RBAC — 7 rôles)
| Rôle | Description |
|------|-------------|
| `super_admin` | Administration plateforme complète |
| `admin` | Administration du tenant |
| `director` | Accès lecture + rapports |
| `engineer` | GMAO + Diagnostics + Rapports |
| `technician` | Interventions terrain |
| `operator` | Consultation tableaux de bord |
| `viewer` | Lecture seule |

### Chiffrement
- Données en transit : TLS 1.2/1.3 (Nginx)
- Données au repos : AES-256 (secrets tenant)
- Mots de passe : bcrypt (coût 12)
- Clés de licence : HMAC-SHA256

## 5. Modules principaux

### Diagnostic IA hybride (CCTP)
Architecture à 4 couches :
1. **Expert Rules** — règles métier paramétrables
2. **Historical Similarity** — 120+ cas (fichier Excel)
3. **Failure Memory** — capitalisation des diagnostics confirmés
4. **AI Structuring** — Claude Anthropic pour la formulation

### Supervision Adaptative (5 modules brevetés)
1. Réception des paramètres hardware (capteurs/IoT)
2. Détection des variations anormales
3. Modélisation causale (Knowledge Graph 48 nœuds, 46 arêtes)
4. Module décisionnel (6 niveaux d'autonomie)
5. Adaptation dynamique du modèle causal

### GMAO
- Registre équipements (QR code intégré)
- Ordres de travail (workflow complet)
- Maintenance préventive (planification calendrier)
- Stock pièces détachées
- Budget maintenance
- Rapports PDF automatiques

## 6. API — Points d'entrée principaux

Documentation interactive : `GET /api-docs`  
Schéma OpenAPI JSON : `GET /api-docs.json`

### Authentification
```
POST /api/enterprise-auth/login
POST /api/enterprise-auth/logout
POST /api/enterprise-auth/register
GET  /api/enterprise-auth/profile
```

### GMAO
```
GET|POST        /api/equipment
GET|PUT|DELETE  /api/equipment/:id
GET|POST        /api/work-orders
GET|PUT         /api/work-orders/:id
GET|POST        /api/preventive-maintenance
GET|POST        /api/spare-parts
```

### Diagnostic
```
POST /api/diagnostic/analyze
GET  /api/diagnostic/history
GET  /api/diagnostic/cases
POST /api/diagnostic/upload-excel
```

### Analytique
```
GET|POST /api/oee
GET|POST /api/rca
GET|POST /api/fmea
GET|POST /api/asset-lifecycle
GET|POST /api/calibration
GET|POST /api/budget-plans
```

### Licences
```
GET  /api/license/status
POST /api/license/activate
GET  /api/trial/status
POST /api/trial/start
```

## 7. Déploiement

Voir `docs/INSTALL_GUIDE.md` pour les procédures détaillées.

### Variables d'environnement critiques
Voir `.env.example` pour la liste complète.

### Docker (recommandé)
```bash
cp .env.example .env
# Éditer .env avec vos valeurs
docker-compose up -d
```

### Manuel
```bash
npm install
npm run db:push
npm run build
npm start
```

# DOCUMENTATION TECHNIQUE MAINTRIX
## Analyse Fonctionnelle Complète — Réel vs Simulé vs À Compléter

**Version**: 1.0  
**Date**: 19 février 2026  
**Objectif**: Documenter précisément le fonctionnement de chaque composant du code, distinguer ce qui est opérationnel (réel), ce qui est simulé (démo/prototype), et ce qui nécessite une intervention terrain ou l'intégration d'agents externes pour passer en production.

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble de l'architecture](#1-vue-densemble-de-larchitecture)
2. [Couche 1 — Perception Physique (IoT)](#2-couche-1--perception-physique-iot)
3. [Couche 2 — Intelligence Edge](#3-couche-2--intelligence-edge)
4. [Couche 3 — Noyau Cognitif (Cognitive Kernel)](#4-couche-3--noyau-cognitif)
5. [Couche 4 — Orchestration & Exécution](#5-couche-4--orchestration--exécution)
6. [Couche 5 — Apprentissage & Connaissance](#6-couche-5--apprentissage--connaissance)
7. [Couche 6 — Gouvernance & Confiance](#7-couche-6--gouvernance--confiance)
8. [Module GMAO Intégrée](#8-module-gmao-intégrée)
9. [Module Diagnostic Hybride](#9-module-diagnostic-hybride)
10. [Intégrations Externes](#10-intégrations-externes)
11. [Interface Utilisateur (Frontend)](#11-interface-utilisateur-frontend)
12. [Base de Données & Schéma](#12-base-de-données--schéma)
13. [Sécurité & Authentification](#13-sécurité--authentification)
14. [Synthèse : Matrice Réel / Simulé / À Compléter](#14-synthèse--matrice-réel--simulé--à-compléter)
15. [Feuille de Route — Interventions Terrain Requises](#15-feuille-de-route--interventions-terrain-requises)

---

## 1. Vue d'ensemble de l'architecture

### Structure du projet
```
server/
├── routes.ts                    (4533 lignes) — API REST principale
├── storage.ts                   (1317 lignes) — Interface stockage + implémentations
├── anthropic-service.ts         — Service IA Claude
├── enhanced-diagnostic-engine.ts — Moteur diagnostic historique
├── diagnostic-rules-engine.ts   — Moteur règles expert + mémoire des pannes
├── email-service.ts             — Service email SendGrid
├── cognitive-kernel/
│   └── index.ts                 (~750 lignes) — Noyau cognitif central
├── cognitive-layers/
│   ├── knowledge-graph.ts       — Graphe de connaissances industriel
│   ├── physics-models.ts        — Modèles physiques thermo-mécaniques
│   ├── cognitive-core/          — Couche cœur cognitive
│   ├── edgelayer-contracts.ts   — Contrats couche Edge
│   ├── physical/                — Couche physique
│   ├── orchestration/           — Couche orchestration
│   ├── learning/                — Couche apprentissage
│   └── governance/              — Couche gouvernance
├── agents/
│   ├── equipment-agent.ts       — Agent par équipement
│   ├── site-agent.ts            — Agent site (coordination)
│   └── global-agent.ts          — Agent global (apprentissage fédéré)
├── integrations/
│   ├── communication-dispatcher.ts — Alertes multi-canal
│   ├── sap-connector.ts         — Connecteur SAP ERP
│   ├── iot-connector.ts         — Connecteur IoT
│   ├── advanced-iot-connector.ts — Connecteur IoT avancé
│   ├── predictive-engine.ts     — Moteur prédictif
│   ├── smart-notification-engine.ts — Notifications intelligentes
│   └── gamification-engine.ts   — Gamification maintenance
shared/
└── schema.ts                    (2090 lignes) — Schéma DB Drizzle + types
client/src/pages/                (55+ pages React)
```

### Métriques du code
- **Backend**: ~99 fichiers TypeScript serveur
- **Frontend**: 55+ pages React
- **Schéma DB**: 2090 lignes, ~40+ tables
- **API Routes**: 4533 lignes, ~100+ endpoints

---

## 2. Couche 1 — Perception Physique (IoT)

### Fichiers: `server/routes.ts` (endpoint `/api/sensor-hub`), `server/integrations/iot-connector.ts`, `server/integrations/advanced-iot-connector.ts`

### Ce qui existe

| Composant | Statut | Description |
|-----------|--------|-------------|
| API Sensor Hub (`/api/sensor-hub`) | **SIMULÉ** | Génère aléatoirement des lectures capteurs (température, vibration, pression, humidité, courant, RPM) pour chaque équipement enregistré. Les valeurs sont calculées avec `Math.random()`. |
| Protocoles affichés | **SIMULÉ** | MQTT, Modbus, OPC-UA, LoRaWAN sont affichés comme protocoles mais assignés aléatoirement — aucune connexion réelle à ces protocoles. |
| Seuils d'alarme | **PARTIELLEMENT RÉEL** | Les seuils (ex: température > 80°C, vibration > 7 mm/s) sont codés en dur et cohérents avec les normes industrielles, mais ne sont pas configurables par équipement. |
| Statut online/offline | **SIMULÉ** | `Math.random() > 0.15` — 85% des capteurs sont affichés comme "en ligne", sans connexion réelle. |
| Niveau batterie / signal | **SIMULÉ** | Valeurs générées aléatoirement pour chaque capteur. |

### Ce qui manque pour la production

| Besoin | Priorité | Description |
|--------|----------|-------------|
| **Passerelle IoT réelle** | CRITIQUE | Intégrer un broker MQTT (ex: Mosquitto, HiveMQ) pour recevoir de vraies données capteurs. |
| **Connecteur OPC-UA** | HAUTE | Implémenter un client OPC-UA pour lire les données d'automates industriels (PLCs Siemens, Allen-Bradley, etc.). |
| **Connecteur Modbus** | HAUTE | Implémenter un client Modbus TCP/RTU pour les capteurs et automates industriels. |
| **Passerelle LoRaWAN** | MOYENNE | Intégrer avec une passerelle LoRaWAN (ex: The Things Network, Chirpstack) pour les capteurs distants. |
| **Base de données temps-réel** | HAUTE | Stocker les données capteurs dans une base temporelle (ex: InfluxDB, TimescaleDB) au lieu de les générer à chaque requête. |
| **Configuration capteurs** | MOYENNE | Interface pour configurer les seuils, plages normales, et fréquences d'échantillonnage par capteur. |

### Intervention terrain requise
- **Installation de capteurs physiques** sur les machines (température, vibration, pression, courant).
- **Configuration réseau** : passerelle IoT, adressage IP, sécurité réseau industriel.
- **Étalonnage** des capteurs selon les spécifications constructeur.

---

## 3. Couche 2 — Intelligence Edge

### Fichiers: `server/agents/equipment-agent.ts`, `server/cognitive-layers/edgelayer-contracts.ts`

### Ce qui existe

| Composant | Statut | Description |
|-----------|--------|-------------|
| Equipment Agent | **RÉEL (logique)** | Chaque agent surveille un équipement, maintient un historique capteur (100 dernières valeurs), calcule un score de santé (z-score), et détecte des anomalies locales. La logique est fonctionnelle. |
| Détection d'anomalies locale | **RÉEL (algorithme)** | Détection par z-score : si z > 3.0 → anomalie, z > 4.0 → critique. Bien implémenté avec calcul de confiance (`min(0.5 + z*0.1, 0.99)`). |
| Score de santé équipement | **RÉEL (algorithme)** | Calculé à partir des anomalies récentes, mis à jour en continu via `monitoringCycle` (toutes les 10 secondes). |
| Communication vers le Kernel | **RÉEL** | L'agent envoie des messages au Cognitive Kernel via `kernel.sendMessage()` quand une anomalie est détectée. |
| Données d'entrée | **SIMULÉ** | Les agents ne reçoivent pas de données capteurs réelles — ils attendent qu'on appelle `processSensorReading()` avec des données, mais le sensor hub les génère aléatoirement. |

### Ce qui manque pour la production

| Besoin | Priorité | Description |
|--------|----------|-------------|
| **Alimentation en données réelles** | CRITIQUE | Connecter la sortie du broker MQTT aux agents via `processSensorReading()`. |
| **Modèles de baseline** | HAUTE | Les `baselineValues` (moyenne et écart-type) doivent être calculés à partir des données réelles de chaque machine, pas de valeurs par défaut. |
| **Exécution sur Edge** | MOYENNE | Actuellement tout tourne sur le serveur Node.js. Pour une latence faible, déployer les agents sur des devices Edge (Raspberry Pi, NVIDIA Jetson, etc.). |

---

## 4. Couche 3 — Noyau Cognitif (Cognitive Kernel)

### Fichier: `server/cognitive-kernel/index.ts` (~750 lignes)

### Ce qui existe

| Composant | Statut | Description |
|-----------|--------|-------------|
| Classe CognitiveKernel | **RÉEL** | Singleton opérationnel avec EventEmitter, boucle de traitement (5 secondes), gestion d'état. |
| Gestion des agents | **RÉEL** | Enregistrement/désinscription d'agents, suivi des heartbeats, détection d'agents offline (>60s sans heartbeat). |
| File de messages | **RÉEL** | `messageQueue` traitant 10 messages par cycle, routage vers les agents cibles. |
| Boucle fermée (Closed Loop) | **RÉEL (logique)** | Pipeline complet : Détection → Diagnostic → Décision → Action → Apprentissage. Toutes les phases sont implémentées. |
| Détection d'anomalies | **RÉEL** | Vérifie les seuils de signaux, compare aux seuils configurés par capteur. |
| Diagnostic cognitif | **RÉEL** | Génère un `CognitiveDiagnosis` avec causes possibles, facteurs contribuants, évaluation de risque, et actions suggérées. |
| Prise de décision | **RÉEL** | Évalue les politiques, compare au niveau d'autonomie du système, retourne AUTO_EXECUTED, DEFERRED, ou ESCALATED. |
| Exécution d'actions | **PARTIELLEMENT RÉEL** | L'action est loggée et émise via EventEmitter, mais n'exécute pas de commande réelle sur les systèmes industriels (pas de PLC, pas de SCADA). |
| Apprentissage | **RÉEL (logique)** | `learnFromOutcome()` enregistre le résultat dans la mémoire de l'agent et dans la mémoire globale. |
| Niveaux d'autonomie (0-5) | **RÉEL** | 6 niveaux définis : MANUAL → MONITORING → ASSISTED_DIAGNOSTIC → SUPERVISED_EXECUTION → AUTONOMOUS → FULL_AUTONOMY. La logique de graduation est implémentée. |
| Moteur de politiques | **RÉEL** | 4 politiques par défaut (sécurité critique, équipement critique, maintenance préventive, haute performance). Conditions évaluées dynamiquement. |
| Journal d'audit | **RÉEL** | Chaque décision est enregistrée avec horodatage, contexte, justification, et résultat. |
| Simulation What-If | **RÉEL** | Permet de simuler des scénarios hypothétiques (augmentation température, vibration, heures) et prédit la probabilité de panne et le coût. |
| Knowledge Graph (sync) | **RÉEL** | Le kernel reçoit et stocke les données du Knowledge Graph. |

### Ce qui manque pour la production

| Besoin | Priorité | Description |
|--------|----------|-------------|
| **Connecteurs SCADA/PLC** | CRITIQUE | `executeAction()` doit envoyer des commandes réelles aux automates (arrêt machine, ajustement paramètres, etc.). |
| **Intégration temps réel** | HAUTE | La boucle de 5 secondes est trop lente pour des situations critiques de sécurité. Passer à du event-driven pur. |
| **Persistance de l'état** | HAUTE | L'état du kernel (agents, politiques, audit) est en mémoire. Redémarrage serveur = perte de tout le contexte cognitif. |
| **Calibration des politiques** | MOYENNE | Les seuils et conditions des politiques doivent être ajustés aux réalités de chaque site industriel. |

---

## 5. Couche 4 — Orchestration & Exécution

### Fichiers: `server/agents/site-agent.ts`, `server/cognitive-layers/orchestration/`

### Ce qui existe

| Composant | Statut | Description |
|-----------|--------|-------------|
| Site Agent | **RÉEL (logique)** | Coordonne les Equipment Agents d'un site, corrèle les alertes (si 3+ anomalies simultanées avec mêmes types de capteurs → alerte corrélée), calcule le score santé global du site. |
| Statut de production | **RÉEL (logique)** | Détermine automatiquement : normal / degraded / critical selon les scores de santé agrégés. |
| Détection cascade | **RÉEL (logique)** | Identifie les risques de panne en cascade quand plusieurs équipements critiques sont en anomalie simultanée. |
| Coordination cycle | **RÉEL** | Boucle périodique : corrélation alertes → mise à jour santé site → détection cascades. |

### Ce qui manque pour la production

| Besoin | Priorité | Description |
|--------|----------|-------------|
| **Connecteur GMAO bidirectionnel** | CRITIQUE | L'agent site doit pouvoir créer automatiquement des ordres de travail dans la GMAO quand une intervention est requise. |
| **Connecteur SCADA** | HAUTE | Recevoir les états machines réels (marche/arrêt/défaut) depuis le SCADA, pas seulement des capteurs individuels. |
| **Gestion des priorités** | MOYENNE | Logique de priorisation des interventions quand plusieurs équipements sont en anomalie. |

---

## 6. Couche 5 — Apprentissage & Connaissance

### Fichiers: `server/agents/global-agent.ts`, `server/cognitive-layers/knowledge-graph.ts`, `server/cognitive-layers/learning/`

### Ce qui existe

| Composant | Statut | Description |
|-----------|--------|-------------|
| Global Agent | **RÉEL (logique)** | Agrège les patterns de tous les sites, détecte les corrélations inter-sites, met à jour le Knowledge Graph global. Boucle d'apprentissage toutes les 30 secondes. |
| Corrélation inter-sites | **RÉEL (logique)** | Détecte quand 2+ sites sont en dégradation simultanée et suggère des causes possibles (fournisseur commun, conditions environnementales, lot d'équipements). |
| Knowledge Graph Industriel | **RÉEL (en mémoire)** | 48+ nœuds (8 types d'équipements, symptômes, causes, interventions, contextes), 46+ arêtes. Stocké en Map (mémoire), pas en base de données. Synchronisé avec le Cognitive Kernel. |
| Traversée du graphe | **RÉEL** | Recherche par type de nœud, exploration de voisinage, calcul de chemins. |
| Enrichissement dynamique | **RÉEL (logique)** | Le Global Agent ajoute dynamiquement des nœuds et arêtes au graphe quand de nouveaux patterns sont découverts. |

### Ce qui manque pour la production

| Besoin | Priorité | Description |
|--------|----------|-------------|
| **Persistance du Knowledge Graph** | CRITIQUE | Le graphe est en mémoire RAM. Redémarrage = reconstruction depuis zéro. Migrer vers Neo4j ou une base graphe, ou au minimum persister en PostgreSQL. |
| **Apprentissage supervisé** | HAUTE | Les confirmations/corrections des techniciens doivent être utilisées pour affiner les poids et relations du graphe. |
| **Données terrain** | CRITIQUE | Le graphe est initialisé avec des données génériques. Il doit être enrichi avec les spécificités de chaque site client. |
| **Apprentissage fédéré réel** | MOYENNE | Le Global Agent simule l'apprentissage fédéré mais ne gère pas les contraintes de confidentialité inter-tenants. |

---

## 7. Couche 6 — Gouvernance & Confiance

### Fichiers: `server/cognitive-layers/governance/`

### Ce qui existe

| Composant | Statut | Description |
|-----------|--------|-------------|
| Journal d'audit des décisions | **RÉEL** | Chaque décision du Kernel est enregistrée avec : timestamp, contexte, diagnostic, justification, résultat, niveau d'autonomie. |
| Niveaux d'autonomie | **RÉEL** | Graduation de 0 (manuel) à 5 (autonomie complète) avec contrôle d'accès par niveau. |
| Conformité CCTP | **PARTIELLEMENT RÉEL** | L'interface affiche les informations de conformité, mais la certification réelle n'est pas faite. |
| Approbation humaine | **RÉEL (logique)** | Les politiques marquées `requiresApproval: true` bloquent l'exécution automatique et escaladent vers un rôle humain. |

### Ce qui manque pour la production

| Besoin | Priorité | Description |
|--------|----------|-------------|
| **Certification CCTP** | HAUTE | Processus de certification formel avec documentation de conformité. |
| **Audit trail persistant** | CRITIQUE | L'audit est en mémoire. Doit être persisté en base de données pour compliance. |
| **Signature numérique** | MOYENNE | Les décisions autonomes doivent être signées cryptographiquement pour la traçabilité. |

---

## 8. Module GMAO Intégrée

### Fichiers: `server/routes.ts`, `server/storage.ts`, `shared/schema.ts`

### Ce qui existe

| Composant | Statut | Description |
|-----------|--------|-------------|
| Registre des équipements | **RÉEL** | CRUD complet en base de données (PostgreSQL via Drizzle ORM). Création, lecture, mise à jour, recherche par type/zone/secteur. |
| Ordres de travail | **PARTIELLEMENT RÉEL** | La liste (`getWorkOrders`) fonctionne. Mais `getWorkOrderById`, `getWorkOrdersByEquipment`, `createWorkOrder`, `updateWorkOrder` lèvent `throw new Error("Method not implemented")`. |
| Maintenance préventive | **RÉEL** | CRUD complet en base de données. Plans par type d'équipement, création, mise à jour, récupération par ID. |
| Inventaire pièces de rechange | **NON IMPLÉMENTÉ** | `getSpareParts()` et `createSparePart()` lèvent `throw new Error("Method not implemented")`. |
| Mouvements de stock | **NON IMPLÉMENTÉ** | `getStockMovements()` et `createStockMovement()` lèvent `throw new Error("Method not implemented")`. |
| Budget maintenance | **PARTIELLEMENT RÉEL** | Interface frontend présente, mais pas de logique backend complète. |
| Tableau de bord GMAO | **RÉEL** | Affiche les KPIs agrégés : équipements, ordres de travail, plans préventifs. |
| QR Codes équipements | **RÉEL** | Génération de QR codes pour chaque équipement avec lien vers sa fiche. |

### Ce qui manque pour la production

| Besoin | Priorité | Description |
|--------|----------|-------------|
| **Implémenter les Work Orders** | CRITIQUE | Les méthodes `getWorkOrderById`, `createWorkOrder`, `updateWorkOrder` dans DatabaseStorage doivent être implémentées (actuellement `throw Error`). |
| **Implémenter l'inventaire** | HAUTE | `getSpareParts`, `createSparePart`, `getStockMovements`, `createStockMovement` sont des placeholders. |
| **Calcul MTBF/MTTR** | HAUTE | Les indicateurs clés de maintenance (Mean Time Between Failures, Mean Time To Repair) doivent être calculés à partir des données réelles. |
| **Planification automatique** | MOYENNE | Le système doit générer automatiquement des ordres de travail à partir des plans de maintenance préventive. |

---

## 9. Module Diagnostic Hybride

### Fichiers: `server/enhanced-diagnostic-engine.ts`, `server/diagnostic-rules-engine.ts`, `server/anthropic-service.ts`

### Ce qui existe

| Composant | Statut | Détail |
|-----------|--------|--------|
| **Moteur de Règles Expert** | **RÉEL** | ~15+ règles codées (surchauffe moteur, vibration excessive, fuite hydraulique, etc.). Chaque règle a : patterns d'équipement, patterns de symptômes, diagnostic, solution, étapes de réparation, outils nécessaires, pièces de rechange, temps estimé, score de confiance. Logique de matching NFD-normalisée (accent-insensitive). |
| **Analyse de Similarité Historique** | **RÉEL** | Recherche dans la table `maintenanceCases` (120+ cas pré-chargés depuis Excel). 3 niveaux de recherche : correspondance exacte (confiance 1.0), correspondance similaire (0.7-0.9), correspondance par mots-clés (0.5-0.7). Résultats combinés, dédupliqués, et triés par score. |
| **Mémoire des Pannes** | **RÉEL** | Table `failureMemory` en base de données. Stocke les pannes confirmées avec compteur de confirmations. Les diagnostics avec plus de confirmations sont priorisés. |
| **IA Claude (Anthropic)** | **RÉEL** | Appel API réel à Claude Sonnet. Prompt structuré : causes possibles, étapes de diagnostic, solutions, priorité, considérations de sécurité. Nécessite la clé `ANTHROPIC_API_KEY`. |
| **Pipeline hybride** | **RÉEL** | Combine les 4 sources (règles + historique + mémoire + IA) pour fournir un diagnostic multi-perspective avec explainabilité (chaque source est identifiée). |
| **Import de données Excel** | **RÉEL** | Import de fichiers Excel (.xlsx) avec mapping flexible des colonnes. Normalisation des types d'équipements. Supporte les données pré-chargées et les uploads utilisateur. |
| **Feedback & apprentissage** | **RÉEL** | Les techniciens peuvent confirmer ou corriger un diagnostic. Les confirmations alimentent la mémoire des pannes et augmentent le compteur de confiance. |

### Ce qui manque pour la production

| Besoin | Priorité | Description |
|--------|----------|-------------|
| **Enrichissement des règles** | HAUTE | 15 règles couvrent les cas courants mais pas la diversité complète des équipements industriels. Chaque site aura des cas spécifiques. |
| **Données historiques client** | CRITIQUE | Les 120 cas pré-chargés sont génériques. Chaque client doit importer ses propres données de maintenance historiques. |
| **Calibration IA** | MOYENNE | Le prompt Claude est générique. Des prompts spécialisés par industrie (mine, énergie, agroalimentaire) amélioreraient la pertinence. |

---

## 10. Intégrations Externes

### 10.1 Communication Multi-Canal

**Fichier**: `server/integrations/communication-dispatcher.ts`

| Canal | Statut | Détail |
|-------|--------|--------|
| **Slack** | **RÉEL** | Appel `fetch` vers webhook URL. Payload formaté avec blocs Slack (header, section, fields, actions). Prêt à l'emploi avec un webhook Slack configuré. |
| **Microsoft Teams** | **RÉEL** | Appel `fetch` vers connecteur webhook. Payload MessageCard avec thème couleur, sections, et faits. Prêt avec un connecteur Teams. |
| **Telegram** | **RÉEL** | Appel API Bot Telegram (`api.telegram.org/bot{token}/sendMessage`). Formatage Markdown V2. Nécessite bot token + chat ID. |
| **WhatsApp** | **PARTIELLEMENT RÉEL** | Appel `fetch` vers webhook configuré. Le format de payload est générique — nécessite un service intermédiaire (Twilio, WhatsApp Business API) pour fonctionner réellement. |
| **Webhook custom** | **RÉEL** | Appel POST vers URL configurable avec payload JSON standard. |
| **Logging des livraisons** | **RÉEL** | Chaque envoi est loggé en base de données (`notificationDeliveryLogs`) avec statut, code de réponse, et erreur éventuelle. |
| **Statistiques** | **RÉEL** | Compteurs de messages envoyés, taux de succès/échec, par canal et par période. |

### 10.2 Email (SendGrid)

**Fichier**: `server/email-service.ts`

| Fonction | Statut | Détail |
|----------|--------|--------|
| Invitations tenant | **RÉEL** | Email HTML complet avec branding Maintrix, informations du tenant, URL de connexion. |
| Notifications de statut | **RÉEL** | Emails pour activation/désactivation/suppression de tenant. Contenu dynamique. |
| Envoi de credentials | **RÉEL** | Email sécurisé avec identifiants temporaires, instructions de sécurité, date d'expiration. |
| **Condition** | Nécessite `SENDGRID_API_KEY` | Si la clé n'est pas configurée, les emails sont silencieusement ignorés (pas d'erreur). L'adresse expéditeur `noreply@maintrix-t.com` doit être vérifiée dans SendGrid. |

### 10.3 Paiements

| Service | Statut | Détail |
|---------|--------|--------|
| **Stripe** | **RÉEL** | Intentions de paiement, abonnements, webhooks. Activé si `STRIPE_SECRET_KEY` et `STRIPE_PUBLISHABLE_KEY` sont configurés. Le mode (test/live) dépend des clés utilisées. |
| **PayPal** | **RÉEL** | Création d'ordres, capture de paiements. Mode sandbox par défaut (`PAYPAL_MODE` != 'live'). OAuth2 pour l'authentification API. |

### 10.4 SAP ERP

**Fichier**: `server/integrations/sap-connector.ts`

| Composant | Statut | Description |
|-----------|--------|-------------|
| Connecteur SAP | **STRUCTURE SEULEMENT** | L'interface est définie mais l'implémentation nécessite les APIs SAP réelles du client. |

### 10.5 Anthropic Claude (IA)

**Fichier**: `server/anthropic-service.ts`

| Composant | Statut | Description |
|-----------|--------|-------------|
| Service Anthropic | **RÉEL** | SDK `@anthropic-ai/sdk`, modèle `claude-sonnet-4-20250514`. Analyse d'équipement, chat, prompt structuré. Nécessite `ANTHROPIC_API_KEY`. |

---

## 11. Interface Utilisateur (Frontend)

### 55+ pages React — `client/src/pages/`

| Page | Statut | Description |
|------|--------|-------------|
| `landing.tsx` | **RÉEL** | Page d'accueil publique — positionnement "infrastructure cognitive" |
| `modern-home.tsx` | **RÉEL** | Dashboard d'accueil après connexion — modules, stats, KPIs |
| `cognitive-infrastructure.tsx` | **RÉEL** | Visualisation de l'architecture 6 couches |
| `smart-diagnostic.tsx` | **RÉEL** | Interface de diagnostic hybride complète |
| `gmao-dashboard.tsx` | **RÉEL** | Tableau de bord GMAO |
| `equipment-management.tsx` | **RÉEL** | Gestion des équipements (CRUD) |
| `work-orders.tsx` | **PARTIELLEMENT RÉEL** | Interface présente, mais backend partiellement implémenté |
| `preventive-maintenance.tsx` | **RÉEL** | Plans de maintenance préventive |
| `inventaire.tsx` | **PARTIELLEMENT RÉEL** | Interface présente, backend non implémenté |
| `sensor-hub.tsx` | **SIMULÉ** | Affiche des données capteurs simulées |
| `machine-health.tsx` | **RÉEL** | Scoring de santé des machines |
| `smart-alerts.tsx` | **RÉEL** | Alertes intelligentes et recommandations |
| `communication-integrations.tsx` | **RÉEL** | Gestion des canaux de communication |
| `dashboard.tsx` | **RÉEL** | Tableau de bord principal |
| `historique.tsx` | **RÉEL** | Historique des interventions |
| `learning-dashboard.tsx` | **RÉEL** | Suivi de l'apprentissage continu |
| `sla-management.tsx` | **RÉEL** | Gestion des SLAs |
| `client-portal.tsx` | **RÉEL** | Portail client |
| `tenant-management.tsx` | **RÉEL** | Gestion multi-tenant |
| `user-management.tsx` | **RÉEL** | Gestion des utilisateurs |
| `login.tsx` / `register.tsx` | **RÉEL** | Authentification |
| `equipment-qr.tsx` | **RÉEL** | QR codes pour équipements |
| `data-import.tsx` | **RÉEL** | Import de données historiques (Excel) |
| `advanced-reporting.tsx` | **RÉEL** | Rapports avancés |
| `training.tsx` | **RÉEL** | Module de formation |
| `voice-diagnostic.tsx` | **SIMULÉ** | Interface de diagnostic vocal (sans reconnaissance vocale réelle) |
| `ai-assistant.tsx` | **RÉEL** | Assistant IA (utilise Claude) |
| `payment-test.tsx` | **RÉEL** | Page de test paiements |
| `super-admin-dashboard.tsx` | **RÉEL** | Dashboard super-administrateur |
| `erp-configuration.tsx` | **STRUCTURE** | Configuration ERP (SAP non connecté) |
| `iot-gamification-dashboard.tsx` | **SIMULÉ** | Gamification IoT avec données simulées |

---

## 12. Base de Données & Schéma

### Fichier: `shared/schema.ts` (2090 lignes)

### Tables principales

| Table | Statut | Données |
|-------|--------|---------|
| `users` | **RÉEL** | Utilisateurs avec rôles, hash bcrypt, multi-tenant |
| `tenants` | **RÉEL** | Organisations/entreprises |
| `equipmentRegistry` | **RÉEL** | Registre des équipements industriels |
| `workOrders` | **RÉEL (schéma)** | Ordres de travail — schéma complet mais méthodes storage partielles |
| `preventiveMaintenancePlans` | **RÉEL** | Plans de maintenance préventive |
| `spareParts` | **RÉEL (schéma)** | Pièces de rechange — schéma complet mais storage non implémenté |
| `stockMovements` | **RÉEL (schéma)** | Mouvements de stock — schéma complet mais storage non implémenté |
| `maintenanceCases` | **RÉEL** | 120+ cas de maintenance historiques importés depuis Excel |
| `failureMemory` | **RÉEL** | Mémoire des pannes confirmées |
| `diagnosticSessions` | **RÉEL** | Sessions de diagnostic utilisateur |
| `communicationChannels` | **RÉEL** | Canaux de communication configurés |
| `notificationDeliveryLogs` | **RÉEL** | Logs de livraison des notifications |
| `iotSensorData` | **RÉEL (schéma)** | Données capteurs IoT — schéma présent mais alimentation simulée |
| `alerts` | **RÉEL** | Alertes système |
| `kpiData` | **RÉEL** | Indicateurs de performance |

### Observation importante
Le schéma de base de données est complet et bien structuré (2090 lignes). Cependant, certaines tables ont un schéma défini mais leur couche d'accès (`storage.ts`) n'est pas complètement implémentée (méthodes qui lancent `throw new Error("Method not implemented")`).

---

## 13. Sécurité & Authentification

| Composant | Statut | Description |
|-----------|--------|-------------|
| Authentification bcrypt | **RÉEL** | Hash de mots de passe avec bcrypt, sessions PostgreSQL |
| RBAC (7 rôles) | **RÉEL** | admin, manager, technician, operator, viewer, super_admin, client_portal |
| Multi-tenant isolation | **RÉEL** | Filtrage des données par `tenantId` dans les requêtes |
| Rate limiting | **RÉEL** | Middleware de limitation de requêtes |
| CSRF protection | **RÉEL** | Protection CSRF dans le middleware |
| Session management | **RÉEL** | Sessions stockées en PostgreSQL avec expiration |
| MFA | **STRUCTURE** | Interface présente (`security-mfa.tsx`) mais pas d'implémentation TOTP réelle |
| Changement mot de passe forcé | **RÉEL** | Premier login → changement obligatoire |

---

## 14. Synthèse — Matrice Réel / Simulé / À Compléter

### LÉGENDE
- ✅ **RÉEL** = Fonctionnel, code opérationnel
- 🟡 **SIMULÉ** = Logique correcte mais données factices
- 🔴 **NON IMPLÉMENTÉ** = Placeholder ou structure seulement
- 🔧 **INTERVENTION TERRAIN** = Nécessite une action physique ou une intégration client

| # | Fonctionnalité | Statut | Détail |
|---|---------------|--------|--------|
| 1 | Diagnostic par Règles Expert | ✅ RÉEL | 15+ règles, matching NFD, confiance calculée |
| 2 | Diagnostic par Historique | ✅ RÉEL | 120+ cas, 3 niveaux de matching, scoring |
| 3 | Diagnostic par IA Claude | ✅ RÉEL | API Anthropic, prompt structuré (nécessite API key) |
| 4 | Mémoire des Pannes | ✅ RÉEL | DB, compteur confirmations, scoring |
| 5 | Pipeline Diagnostic Hybride | ✅ RÉEL | Combine 4 sources avec explainabilité |
| 6 | Import données Excel | ✅ RÉEL | .xlsx, mapping flexible, normalisation |
| 7 | Cognitive Kernel | ✅ RÉEL | Boucle fermée, politiques, audit, autonomie |
| 8 | Knowledge Graph | ✅ RÉEL (mémoire) | 48 nœuds, 46 arêtes — **non persisté** |
| 9 | Equipment Agent | ✅ RÉEL (logique) | Z-score, anomalies, santé — **données simulées** |
| 10 | Site Agent | ✅ RÉEL (logique) | Corrélation, cascade, santé site |
| 11 | Global Agent | ✅ RÉEL (logique) | Patterns inter-sites, apprentissage |
| 12 | Modèles Physiques | ✅ RÉEL | Bearing life, cavitation, thermique, compresseur |
| 13 | Alertes Slack/Teams/Telegram | ✅ RÉEL | Appels API réels via fetch |
| 14 | Alertes WhatsApp | 🟡 SIMULÉ | Fetch vers webhook (nécessite Twilio/WhatsApp Business) |
| 15 | Email SendGrid | ✅ RÉEL | Invitations, credentials, notifications (nécessite API key) |
| 16 | Paiements Stripe | ✅ RÉEL | Intentions, abonnements, webhooks |
| 17 | Paiements PayPal | ✅ RÉEL | Ordres, capture, sandbox/live |
| 18 | Registre Équipements | ✅ RÉEL | CRUD complet en DB |
| 19 | Plans Préventifs | ✅ RÉEL | CRUD complet en DB |
| 20 | Ordres de Travail | 🔴 PARTIEL | Liste OK, CRUD non implémenté |
| 21 | Inventaire Pièces | 🔴 NON IMPL. | Schema OK, storage = throw Error |
| 22 | Mouvements de Stock | 🔴 NON IMPL. | Schema OK, storage = throw Error |
| 23 | Capteurs IoT | 🟡 SIMULÉ | Math.random(), pas de broker MQTT |
| 24 | Protocoles MQTT/Modbus/OPC-UA | 🟡 SIMULÉ | Affichés mais pas connectés |
| 25 | Connecteur SAP | 🔴 STRUCTURE | Interface définie, pas d'implémentation |
| 26 | Connecteur SCADA | 🔴 STRUCTURE | Mentionné mais pas implémenté |
| 27 | MFA (2FA) | 🔴 STRUCTURE | Interface UI mais pas de TOTP |
| 28 | Exécution PLC/automate | 🔴 NON IMPL. | Le kernel ne commande pas de machines |
| 29 | Diagnostic vocal | 🟡 SIMULÉ | Interface sans reconnaissance vocale |
| 30 | Application mobile React Native | 🔴 STRUCTURE | Documentation et specs mais pas de code RN déployé |
| 31 | Authentification/Sessions | ✅ RÉEL | bcrypt, RBAC, sessions PostgreSQL |
| 32 | Multi-tenant | ✅ RÉEL | Isolation par tenantId |
| 33 | Audit des décisions | ✅ RÉEL (mémoire) | **Non persisté en DB** |
| 34 | Modèles Physiques thermo-mécaniques | ✅ RÉEL | Formules simplifiées mais physiquement correctes |

---

## 15. Feuille de Route — Interventions Terrain Requises

### Phase 1 — Fondations opérationnelles (Priorité CRITIQUE)

| # | Action | Qui | Effort estimé |
|---|--------|-----|---------------|
| 1 | Implémenter les méthodes Work Order dans DatabaseStorage | Développeur backend | 2-3 jours |
| 2 | Implémenter les méthodes Spare Parts / Stock Movements | Développeur backend | 2-3 jours |
| 3 | Persister le Knowledge Graph en base de données | Développeur backend | 3-5 jours |
| 4 | Persister le journal d'audit des décisions en base de données | Développeur backend | 1-2 jours |
| 5 | Persister l'état du Cognitive Kernel (reprise après redémarrage) | Développeur backend | 3-5 jours |

### Phase 2 — Connexion au monde réel (Priorité HAUTE)

| # | Action | Qui | Effort estimé |
|---|--------|-----|---------------|
| 6 | Installer et configurer un broker MQTT (Mosquitto/HiveMQ) | Ingénieur IoT + infrastructure | 1-2 semaines |
| 7 | Développer le connecteur MQTT → Equipment Agent | Développeur backend + IoT | 1 semaine |
| 8 | Implémenter le connecteur OPC-UA pour les PLCs | Développeur industriel | 2-3 semaines |
| 9 | Implémenter le connecteur Modbus TCP/RTU | Développeur industriel | 1-2 semaines |
| 10 | Déployer une base de données temporelle (InfluxDB/TimescaleDB) | DevOps | 1 semaine |
| 11 | Calibrer les baselines des Equipment Agents par machine réelle | Technicien terrain + data | 1-2 semaines/site |

### Phase 3 — Terrain et déploiement client (Priorité HAUTE)

| # | Action | Qui | Effort estimé |
|---|--------|-----|---------------|
| 12 | Installer les capteurs physiques sur les machines | Équipe terrain + électricien | 1-4 semaines/site |
| 13 | Configurer le réseau industriel (VLAN, pare-feu, passerelle) | Administrateur réseau | 1 semaine/site |
| 14 | Importer les données historiques de maintenance du client | Data engineer + client | 1-2 semaines |
| 15 | Calibrer les règles expert pour l'industrie spécifique du client | Expert métier + développeur | 1-2 semaines |
| 16 | Vérifier l'adresse expéditeur SendGrid (`noreply@maintrix-t.com`) | Admin système | 1 jour |

### Phase 4 — Intégrations avancées (Priorité MOYENNE)

| # | Action | Qui | Effort estimé |
|---|--------|-----|---------------|
| 17 | Connecteur SAP ERP bidirectionnel | Développeur SAP + backend | 3-6 semaines |
| 18 | Connecteur SCADA temps réel | Développeur SCADA + industriel | 2-4 semaines |
| 19 | Application mobile React Native | Développeur mobile | 6-8 semaines |
| 20 | MFA / TOTP authentification | Développeur sécurité | 1-2 semaines |
| 21 | Intégration WhatsApp Business API (via Twilio) | Développeur backend | 1 semaine |
| 22 | Connecteur Maximo | Développeur + consultant Maximo | 3-4 semaines |
| 23 | Devices Edge (Raspberry Pi / NVIDIA Jetson) | Développeur embarqué + IoT | 4-8 semaines |

---

## 16. Couverture Complète — Tous les Fichiers Serveur

### Checklist de classification par fichier

| Fichier | Catégorie | Statut | Description |
|---------|-----------|--------|-------------|
| `server/routes.ts` | API principale | ✅/🟡 | 4533 lignes, ~100+ endpoints. Majorité réels, capteurs IoT simulés. |
| `server/storage.ts` | Stockage | ✅/🔴 | Interface complète. DatabaseStorage partiellement implémentée (Work Orders, Spare Parts = placeholder). |
| `server/db.ts` | Base de données | ✅ RÉEL | Connexion PostgreSQL via Drizzle/Neon. |
| `server/index.ts` | Point d'entrée | ✅ RÉEL | Démarrage serveur Express. |
| `server/vite.ts` | Build frontend | ✅ RÉEL | Serveur Vite pour le développement. |
| **Diagnostic** | | | |
| `server/enhanced-diagnostic-engine.ts` | Diagnostic historique | ✅ RÉEL | 3 niveaux de matching dans la DB maintenanceCases. |
| `server/diagnostic-rules-engine.ts` | Règles expert | ✅ RÉEL | 15+ règles, mémoire des pannes, scoring. |
| `server/hybrid-diagnostic-pipeline.ts` | Pipeline hybride | ✅ RÉEL | Combine règles + historique + mémoire + IA. |
| `server/enhanced-diagnostic-routes.ts` | Routes diagnostic | ✅ RÉEL | Endpoints API pour le diagnostic. |
| `server/cloud-diagnostic.ts` | Diagnostic cloud | ✅ RÉEL | Diagnostic distribué multi-tenant. |
| `server/voice-diagnostic.ts` | Diagnostic vocal | 🟡 SIMULÉ | Interface sans reconnaissance vocale réelle. |
| **IA & Apprentissage** | | | |
| `server/anthropic-service.ts` | Service IA Claude | ✅ RÉEL | API Anthropic, modèle claude-sonnet-4. Nécessite API key. |
| `server/smart-assistant-service.ts` | Assistant intelligent | ✅ RÉEL | Chatbot IA pour assistance maintenance. |
| `server/federated-ai-system.ts` | IA fédérée | ✅ RÉEL (logique) | Apprentissage inter-tenants. Données simulées. |
| `server/federated-learning.ts` | Apprentissage fédéré | ✅ RÉEL (logique) | Modèles partagés entre sites. |
| `server/data-aggregation-algorithm.ts` | Agrégation données | ✅ RÉEL | Algorithmes d'agrégation pour analytics. |
| **Cognitive Infrastructure** | | | |
| `server/cognitive-kernel/index.ts` | Noyau cognitif | ✅ RÉEL | Boucle fermée, politiques, agents, audit. En mémoire. |
| `server/cognitive-routes.ts` | Routes cognitives | ✅ RÉEL | Endpoints API pour l'infrastructure cognitive. |
| `server/cognitive-layers/knowledge-graph.ts` | Knowledge Graph | ✅ RÉEL (mémoire) | 48+ nœuds, 46+ arêtes. Non persisté. |
| `server/cognitive-layers/physics-models.ts` | Modèles physiques | ✅ RÉEL | Bearing, cavitation, thermique, compresseur. |
| `server/cognitive-layers/layer-contracts.ts` | Contrats couches | ✅ RÉEL | Types et interfaces pour les 6 couches. |
| **Agents** | | | |
| `server/agents/equipment-agent.ts` | Agent équipement | ✅ RÉEL (logique) | Z-score, anomalies. Attend données réelles. |
| `server/agents/site-agent.ts` | Agent site | ✅ RÉEL (logique) | Corrélation alertes, santé site, cascades. |
| `server/agents/global-agent.ts` | Agent global | ✅ RÉEL (logique) | Patterns inter-sites, apprentissage fédéré. |
| **Multi-Tenant & Auth** | | | |
| `server/enterprise-auth-middleware.ts` | Auth enterprise | ✅ RÉEL | Middleware d'authentification avancée. |
| `server/enterprise-auth-routes.ts` | Routes auth enterprise | ✅ RÉEL | Login, register, sessions, tokens. |
| `server/tenant-middleware.ts` | Middleware tenant | ✅ RÉEL | Isolation des données par tenant. |
| `server/tenant-routes.ts` | Routes tenant | ✅ RÉEL | CRUD tenants, configuration, statut. |
| `server/tenant-security-middleware.ts` | Sécurité tenant | ✅ RÉEL | Middleware de sécurité spécifique multi-tenant. |
| `server/tenant-isolation-tests.ts` | Tests isolation | ✅ RÉEL | Vérification de l'isolation des données. |
| `server/tenant-permissions-routes.ts` | Permissions tenant | ✅ RÉEL | Gestion des permissions par tenant. |
| `server/tenant-integration.ts` | Intégration tenant | ✅ RÉEL | Intégration du système multi-tenant. |
| `server/rbac-middleware.ts` | RBAC middleware | ✅ RÉEL | Contrôle d'accès basé sur les rôles. |
| `server/rbac-permissions.ts` | Permissions RBAC | ✅ RÉEL | Définition des 7 rôles et permissions. |
| `server/rbac-routes.ts` | Routes RBAC | ✅ RÉEL | Endpoints API pour la gestion RBAC. |
| `server/mfa-system.ts` | Système MFA | 🔴 STRUCTURE | Logique MFA définie mais TOTP non fonctionnel. |
| `server/mfa-routes.ts` | Routes MFA | 🔴 STRUCTURE | Endpoints pour MFA, pas de TOTP réel. |
| `server/jwt-oidc-middleware.ts` | JWT/OIDC | ✅ RÉEL | Middleware JWT pour authentification API. |
| `server/credential-generator.ts` | Générateur credentials | ✅ RÉEL | Génération de mots de passe temporaires. |
| `server/seed-auth-users.ts` | Seed utilisateurs | ✅ RÉEL | Données initiales d'authentification. |
| **Sécurité** | | | |
| `server/security-middleware.ts` | Middleware sécurité | ✅ RÉEL | Rate limiting, CSRF, détection anomalies. |
| `server/continuous-access-control.ts` | Contrôle d'accès continu | ✅ RÉEL | Surveillance continue des accès. |
| `server/automated-security-testing.ts` | Tests sécurité auto | ✅ RÉEL | Tests de sécurité automatisés. |
| `server/pii-redaction-system.ts` | Rédaction PII | ✅ RÉEL | Masquage des données personnelles. |
| `server/kms-encryption.ts` | Chiffrement KMS | ✅ RÉEL (logique) | Système de chiffrement. Pas de KMS externe réel. |
| `server/s3-compartmentalization.ts` | Compartimentage S3 | 🔴 STRUCTURE | Structure pour stockage S3, pas d'AWS réel. |
| `server/k8s-network-policies.ts` | Politiques réseau K8s | 🔴 STRUCTURE | Définitions pour Kubernetes, pas déployé. |
| **Intégrations** | | | |
| `server/integrations/communication-dispatcher.ts` | Alertes multi-canal | ✅ RÉEL | Slack, Teams, Telegram (API réelles). WhatsApp via webhook. |
| `server/integrations/sap-connector.ts` | Connecteur SAP | 🔴 STRUCTURE | Interface définie, implémentation requise. |
| `server/integrations/iot-connector.ts` | Connecteur IoT | 🟡 SIMULÉ | Structure sans broker MQTT réel. |
| `server/integrations/advanced-iot-connector.ts` | IoT avancé | 🟡 SIMULÉ | Connecteur avancé, données simulées. |
| `server/integrations/predictive-engine.ts` | Moteur prédictif | ✅ RÉEL (logique) | Prédictions basées sur les modèles physiques. |
| `server/integrations/smart-notification-engine.ts` | Notifications intelligentes | ✅ RÉEL | Moteur de notifications contextuelles. |
| `server/integrations/gamification-engine.ts` | Gamification | ✅ RÉEL (logique) | Points, badges, classements. Données simulées. |
| **Email & Paiements** | | | |
| `server/email-service.ts` | Service email SendGrid | ✅ RÉEL | Invitations, credentials, notifications. Nécessite API key. |
| `server/invitation-system.ts` | Système d'invitation | ✅ RÉEL | Invitations par email avec token. |
| Routes Stripe (dans routes.ts) | Paiements Stripe | ✅ RÉEL | Intentions, abonnements, webhooks. |
| Routes PayPal (dans routes.ts) | Paiements PayPal | ✅ RÉEL | Ordres, capture, sandbox/live. |
| `server/license-service.ts` | Service de licences | ✅ RÉEL | Gestion des licences par tenant. |
| `server/trial-management.ts` | Gestion essais | ✅ RÉEL | Périodes d'essai avec expiration. |
| **GMAO** | | | |
| `server/gmao-routes.ts` | Routes GMAO | ✅ RÉEL | Endpoints API GMAO spécifiques. |
| `server/gmao-storage.ts` | Stockage GMAO | ✅/🔴 | Fonctions GMAO, certaines non implémentées. |
| `server/stock-management.ts` | Gestion stocks | 🔴 PARTIEL | Logique de stock, méthodes incomplètes. |
| `server/budget-management.ts` | Gestion budget | ✅ RÉEL | Suivi budgétaire maintenance. |
| `server/automated-procurement.ts` | Approvisionnement auto | ✅ RÉEL (logique) | Commandes automatiques pièces. |
| `server/auto-procurement-api.ts` | API approvisionnement | ✅ RÉEL | Endpoints pour approvisionnement. |
| `server/procurement-routes.ts` | Routes approvisionnement | ✅ RÉEL | Gestion des commandes d'achat. |
| `server/purchase-order-attachments.ts` | Pièces jointes commandes | ✅ RÉEL | Gestion des fichiers joints. |
| **Import/Export données** | | | |
| `server/data-import.ts` | Import données | ✅ RÉEL | Import depuis fichiers. |
| `server/data-import-export.ts` | Import/Export | ✅ RÉEL | Import et export de données. |
| `server/data-import-export-routes.ts` | Routes import/export | ✅ RÉEL | Endpoints API. |
| `server/excel-processor.ts` | Processeur Excel | ✅ RÉEL | Lecture et traitement fichiers .xlsx. |
| `server/excel-real-processor.ts` | Excel processeur réel | ✅ RÉEL | Traitement réel des données Excel. |
| `server/excel-multi-table-processor.ts` | Excel multi-table | ✅ RÉEL | Import vers plusieurs tables. |
| `server/excel-sheet-processor.ts` | Excel feuilles | ✅ RÉEL | Traitement par feuille. |
| `server/simple-excel-reader.ts` | Lecteur Excel simple | ✅ RÉEL | Lecture simplifiée. |
| `server/simple-excel-real.ts` | Excel réel simple | ✅ RÉEL | Lecture réelle simplifiée. |
| `server/user-excel-upload.ts` | Upload Excel user | ✅ RÉEL | Upload de fichiers par l'utilisateur. |
| `server/direct-excel-import.ts` | Import Excel direct | ✅ RÉEL | Import direct sans mapping. |
| `server/import-industrial-data.ts` | Import données industrielles | ✅ RÉEL | Import spécialisé données industrielles. |
| `server/simple-import.ts` / `server/simple-import-service.ts` | Import simple | ✅ RÉEL | Service d'import simplifié. |
| **Rapports & PDF** | | | |
| `server/pdf-generator.ts` | Générateur PDF | ✅ RÉEL | Génération de rapports PDF. |
| `server/pdf-generator-client-side.ts` | PDF côté client | ✅ RÉEL | Génération côté navigateur. |
| `server/pdf-generator-fallback.ts` | PDF fallback | ✅ RÉEL | Fallback si lib principale échoue. |
| `server/pdf-generator-pdfkit.ts` | PDF PDFKit | ✅ RÉEL | Génération via PDFKit. |
| `server/pdf-generator-functional.ts` | PDF fonctionnel | ✅ RÉEL | Approche fonctionnelle. |
| `server/pdf-generator-simple.ts` | PDF simple | ✅ RÉEL | Génération simplifiée. |
| **Conformité & Audit** | | | |
| `server/cctp-compliance-system.ts` | Conformité CCTP | ✅ RÉEL (logique) | Système de conformité CCTP. |
| `server/cctp-routes.ts` | Routes CCTP | ✅ RÉEL | Endpoints API conformité. |
| `server/audit-review-system.ts` | Système d'audit | ✅ RÉEL | Revue et audit des opérations. |
| `server/enhanced-audit-monitoring.ts` | Audit amélioré | ✅ RÉEL | Monitoring avancé des audits. |
| **Gestion utilisateurs** | | | |
| `server/access-management.ts` | Gestion accès | ✅ RÉEL | Contrôle d'accès avancé. |
| `server/user-lifecycle-management.ts` | Cycle de vie utilisateur | ✅ RÉEL | Onboarding, désactivation, suppression. |
| `server/post-deployment-access-routes.ts` | Routes post-déploiement | ✅ RÉEL | Accès après déploiement. |
| **IoT & Gamification** | | | |
| `server/iot-gamification-routes.ts` | Routes gamification IoT | 🟡 SIMULÉ | Gamification avec données IoT simulées. |
| **Autres** | | | |
| `server/notifications.ts` | Notifications | ✅ RÉEL | Système de notifications internes. |
| `server/module-initializer.ts` | Initialiseur modules | ✅ RÉEL | Démarrage des modules au boot. |
| `server/feature-middleware.ts` | Middleware features | ✅ RÉEL | Feature flags par tenant. |
| `server/feature-service.ts` | Service features | ✅ RÉEL | Gestion des features. |
| `server/company-data-access.ts` | Accès données entreprise | ✅ RÉEL | Contrôle d'accès aux données. |
| `server/gdpr-api-ergonomics.ts` | RGPD/API ergonomie | ✅ RÉEL | Conformité RGPD. |
| `server/multi-tenant-assessment.ts` | Évaluation multi-tenant | ✅ RÉEL | Évaluation de la configuration. |
| `server/validation-routes.ts` | Routes validation | ✅ RÉEL | Validation des données. |
| `server/simple-validation-routes.ts` | Validation simple | ✅ RÉEL | Routes de validation simplifiées. |
| `server/create-validation-demo.ts` | Démo validation | ✅ RÉEL | Données de démonstration. |
| `server/seed.ts` / `server/seed-*.ts` | Seeds | ✅ RÉEL | Données initiales pour la DB. |
| `server/advanced-integrations-routes.ts` | Routes intégrations avancées | ✅ RÉEL | Endpoints pour intégrations. |
| `server/equipment-health-routes.ts` | Routes santé équipement | ✅ RÉEL | Endpoints scoring santé. |
| `server/super-admin-routes.ts` | Routes super admin | ✅ RÉEL | Administration globale. |

---

## CONCLUSION

Maintrix est un système **architecturalement complet** avec une infrastructure cognitive formelle de 6 couches et **~99 fichiers serveur TypeScript**. La logique applicative (diagnostic, kernel, agents, knowledge graph, politiques, apprentissage) est **fonctionnelle et bien structurée**.

### Résumé des statistiques

| Catégorie | Nombre |
|-----------|--------|
| Fichiers serveur | ~99 |
| Pages frontend React | 55+ |
| Tables base de données | ~40+ |
| Endpoints API | ~100+ |
| Composants ✅ RÉEL | ~75% |
| Composants 🟡 SIMULÉ | ~15% |
| Composants 🔴 NON IMPL/STRUCTURE | ~10% |

### Les 4 lacunes principales pour la production

1. **La connexion au monde physique** : les capteurs IoT sont simulés, il n'y a pas de connecteur réel MQTT/OPC-UA/Modbus. C'est le principal travail terrain à réaliser.
2. **La persistance de l'état cognitif** : le Knowledge Graph et l'audit des décisions du Kernel sont en mémoire RAM. Un redémarrage du serveur perd le contexte cognitif accumulé.
3. **Quelques méthodes GMAO non implémentées** : `createWorkOrder`, `getWorkOrderById`, `getSpareParts`, `createSparePart`, `getStockMovements` dans `DatabaseStorage` lèvent `throw new Error("Method not implemented")`.
4. **L'exécution d'actions physiques** : le Cognitive Kernel prend des décisions mais n'envoie pas de commandes réelles aux automates industriels (PLCs/SCADA).

### Ce qui est prêt pour la production dès maintenant

- Diagnostic hybride (règles + historique + mémoire + IA Claude)
- Authentification multi-tenant avec RBAC (7 rôles)
- Alertes multi-canal (Slack, Teams, Telegram)
- Emails transactionnels (SendGrid)
- Paiements (Stripe + PayPal)
- Import/Export données Excel
- Registre équipements + Plans maintenance préventive
- Rapports PDF
- Sécurité (rate limiting, CSRF, sessions PostgreSQL)
- Interface utilisateur complète (55+ pages)

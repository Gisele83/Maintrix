# ARCHITECTURE GLOBALE MAINTRIX

## Le cerveau cognitif de l'industrie — Vision complete

**Date : Fevrier 2026**
**Version : 2.1 (corrigee suite audit code)**
**Mise a jour : 19 Juillet 2026**

> **Note de mise a jour (19/07/2026)** — Ce document decrivait initialement une architecture cible sans verification systematique face au code. Un audit complet du repository a corrige plusieurs ecarts (voir encadre ci-dessous et statuts mis a jour dans les tableaux). Le schema en 6 couches ci-dessous reste le **modele conceptuel/logique** du systeme, mais **ne correspond pas a une separation en modules de code distincts** : voir la note dans la section D.1.

---

## SCHEMA D'ARCHITECTURE COGNITIVE — 6 COUCHES

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                                                                                   ║
║                        MAINTRIX — ARCHITECTURE COGNITIVE                          ║
║           Le systeme nerveux numerique des machines industrielles                  ║
║                    Infrastructure Cognitive 6 Couches                              ║
║                                                                                   ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  ┌─────────────────────────────────────────────────────────────────────────────┐  ║
║  │              COUCHE 6 : GOVERNANCE & TRUST                                │  ║
║  │  ┌─────────────┐ ┌───────────────┐ ┌──────────────┐ ┌───────────────────┐ │  ║
║  │  │ Explainabi- │ │ Audit         │ │ Simulation   │ │ Niveaux          │ │  ║
║  │  │ lite CCTP   │ │ decisionnel   │ │ what-if      │ │ d'autonomie 0-5  │ │  ║
║  │  │ tracabilite │ │ complet       │ │ scenarios    │ │ configurable     │ │  ║
║  │  └─────────────┘ └───────────────┘ └──────────────┘ └───────────────────┘ │  ║
║  └─────────────────────────────────────────────────────────────────────────────┘  ║
║                                      ▲                                            ║
║  ┌─────────────────────────────────────────────────────────────────────────────┐  ║
║  │              COUCHE 5 : LEARNING & KNOWLEDGE                              │  ║
║  │  ┌─────────────┐ ┌───────────────┐ ┌──────────────┐ ┌───────────────────┐ │  ║
║  │  │ Apprentiss- │ │ Memoire des   │ │ Modeles      │ │ Federation       │ │  ║
║  │  │ age continu │ │ defaillances  │ │ hybrides     │ │ inter-tenant     │ │  ║
║  │  │ adaptatif   │ │ capitalisees  │ │ physique+data│ │ anonymisee       │ │  ║
║  │  └─────────────┘ └───────────────┘ └──────────────┘ └───────────────────┘ │  ║
║  └─────────────────────────────────────────────────────────────────────────────┘  ║
║                                      ▲                                            ║
║  ┌─────────────────────────────────────────────────────────────────────────────┐  ║
║  │         COUCHE 4 : ORCHESTRATION & EXECUTION                              │  ║
║  │  ┌─────────────┐ ┌───────────────┐ ┌──────────────┐ ┌───────────────────┐ │  ║
║  │  │ Cognitive   │ │ Policy Engine │ │ Boucle       │ │ Workflow         │ │  ║
║  │  │ Kernel      │ │ regles metier │ │ fermee       │ │ automatise       │ │  ║
║  │  │ orchestr.   │ │ decisionnelle │ │ D→D→D→A→F→L │ │ bout-en-bout     │ │  ║
║  │  └─────────────┘ └───────────────┘ └──────────────┘ └───────────────────┘ │  ║
║  │  Boucle: Detection → Diagnostic → Decision → Action → Feedback → Learning│  ║
║  └─────────────────────────────────────────────────────────────────────────────┘  ║
║                                      ▲                                            ║
║  ┌─────────────────────────────────────────────────────────────────────────────┐  ║
║  │              COUCHE 3 : COGNITIVE CORE                                    │  ║
║  │  ┌─────────────┐ ┌───────────────┐ ┌──────────────┐ ┌───────────────────┐ │  ║
║  │  │ Knowledge   │ │ Moteur regles │ │ Similarite   │ │ IA Claude        │ │  ║
║  │  │ Graph 48+   │ │ expert        │ │ historique   │ │ (Anthropic)      │ │  ║
║  │  │ noeuds      │ │ deterministes │ │ 120+ cas     │ │ structuration    │ │  ║
║  │  └─────────────┘ └───────────────┘ └──────────────┘ └───────────────────┘ │  ║
║  └─────────────────────────────────────────────────────────────────────────────┘  ║
║                                      ▲                                            ║
║  ┌─────────────────────────────────────────────────────────────────────────────┐  ║
║  │              COUCHE 2 : EDGE INTELLIGENCE                                 │  ║
║  │  ┌─────────────┐ ┌───────────────┐ ┌──────────────┐ ┌───────────────────┐ │  ║
║  │  │ Pre-traite- │ │ Detection     │ │ Agents       │ │ Scoring de       │  │  ║
║  │  │ ment local  │ │ anomalies     │ │ equipement   │ │ sante machine    │  │  ║
║  │  │ filtrage    │ │ temps reel    │ │ autonomes    │ │ (Health Score)   │  │  ║
║  │  └─────────────┘ └───────────────┘ └──────────────┘ └───────────────────┘ │  ║
║  └─────────────────────────────────────────────────────────────────────────────┘  ║
║                                      ▲                                            ║
║  ┌─────────────────────────────────────────────────────────────────────────────┐  ║
║  │              COUCHE 1 : PHYSIQUE                                          │  ║
║  │  ┌─────────────┐ ┌───────────────┐ ┌──────────────┐ ┌───────────────────┐ │  ║
║  │  │ Capteurs IoT│ │ Collecte      │ │ Protocoles   │ │ 8 types de       │ │  ║
║  │  │ MQTT/Modbus │ │ donnees       │ │ industriels  │ │ capteurs         │ │  ║
║  │  │ OPC-UA/LoRa │ │ temps reel    │ │ certifies    │ │ supportes        │ │  ║
║  │  └─────────────┘ └───────────────┘ └──────────────┘ └───────────────────┘ │  ║
║  └─────────────────────────────────────────────────────────────────────────────┘  ║
║                                      ▲                                            ║
║  ┌─────────────────────────────────────────────────────────────────────────────┐  ║
║  │                SOCLE OPERATIONNEL : GMAO & ERP                             │  ║
║  │  La colonne vertebrale qui alimente et est alimentee par le cerveau         │  ║
║  │  ┌─────────┐┌──────────┐┌──────────┐┌─────────┐┌──────────┐┌────────────┐│  ║
║  │  │Equipements│ Ordres   ││ Maint.   ││ Stocks  ││ Achats   ││ Rapports   ││  ║
║  │  │& actifs  ││ travail  ││ prevent. ││ pieces  ││ fourniss.││ & KPIs     ││  ║
║  │  └─────────┘└──────────┘└──────────┘└─────────┘└──────────┘└────────────┘│  ║
║  └─────────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                   ║
╠═══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                   ║
║  ┌────────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐    ║
║  │  SYSTEME MULTI-     │  │  SECURITE &      │  │  INTERFACES                │    ║
║  │  AGENTS DISTRIBUE   │  │  CONFORMITE      │  │  ┌──────────────────────┐  │    ║
║  │  ┌────────────────┐ │  │  ┌──────────────┐│  │  │ Web (React 18)       │  │    ║
║  │  │ Equipment Agent│ │  │  │ RBAC 7 roles ││  │  │ Mobile (React Native)│  │    ║
║  │  │ Site Agent     │ │  │  │ SOC 2 / ISO  ││  │  │ API REST             │  │    ║
║  │  │ Global Agent   │ │  │  │ CCTP / RGPD  ││  │  │ Portail Client       │  │    ║
║  │  └────────────────┘ │  │  └──────────────┘│  │  └──────────────────────┘  │    ║
║  └────────────────────┘  └──────────────────┘  └────────────────────────────┘    ║
║                                                                                   ║
║  ┌──────────────────────────────────────────────────────────────────────────┐     ║
║  │  PLATEFORMES DE COMMUNICATION                                            │     ║
║  │  Slack │ Teams │ Telegram │ WhatsApp │ Webhooks personnalises            │     ║
║  └──────────────────────────────────────────────────────────────────────────┘     ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

---

## INVENTAIRE COMPLET DES MODULES

### Legende des statuts

| Symbole | Signification |
|---|---|
| **OPERATIONNEL** | Module developpe, teste et fonctionnel en production |
| **PARTIEL** | Module partiellement developpe, fonctionnalites de base presentes |
| **SIMULE** | Module present avec simulation, necessite integration reelle |
| **SCHEMA** | Tables de base de donnees creees, logique metier a developper |
| **A DEVELOPPER** | Module non encore developpe, prevu dans la roadmap |

---

## A. COUCHE 1 — PHYSIQUE (Capteurs et collecte de donnees)

*Donner a la machine la capacite de "sentir" son propre etat via capteurs IoT, collecte de donnees et protocoles industriels*

### A.1 Connecteur IoT multi-protocole

> **Correction (audit 19/07/2026)** : il existe deux connecteurs IoT distincts dans le code, a ne pas confondre. `iot-connector.ts` utilise le vrai package `mqtt` et se connecte reellement a un broker si `MQTT_BROKER_URL` pointe vers une adresse externe (bascule en simulation seulement si l'URL est `localhost`/`127.*`, typiquement en dev). `advanced-iot-connector.ts`, initialise au demarrage du serveur, est en revanche **entierement simule** (client MQTT mocke, devices codes en dur) — c'est ce second connecteur qui tourne par defaut au boot.

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Collecte MQTT (iot-connector.ts) | **PARTIEL / HYBRIDE** | Vrai client mqtt, connexion reelle si broker externe configure, simulation si localhost | Deployer avec un broker industriel reel en environnement cible |
| Advanced IoT Connector (init au boot) | **SIMULE** | advanced-iot-connector.ts, client MQTT mocke, devices codes en dur | Remplacer par une vraie connexion ou retirer si redondant avec iot-connector.ts |
| Collecte Modbus | **SIMULE** | Architecture prevue, protocole declare | Implementer client Modbus TCP/RTU reel |
| Collecte OPC-UA | **SIMULE** | Architecture prevue, protocole declare | Implementer client OPC-UA reel |
| Collecte LoRaWAN | **SIMULE** | Architecture prevue, protocole declare | Implementer passerelle LoRaWAN |
| Gestion des devices IoT | **OPERATIONNEL** | 3 devices configures, seuils par capteur | — |
| Simulation temps reel | **OPERATIONNEL** | 8 types de capteurs (vibration, temperature, pression, courant, bruit, debit, humidite, vitesse) | — |
| Stockage donnees capteurs | **OPERATIONNEL** | Table iot_sensor_data, insertion validee | — |

**Estimation R&D restante : 65 000 - 105 000 EUR** (revisee : le cablage MQTT reel existe deja dans iot-connector.ts, il reste a le brancher en production et clarifier la redondance avec advanced-iot-connector.ts)
- Unifier iot-connector.ts et advanced-iot-connector.ts, deployer contre un broker reel : 15 000 EUR
- Client Modbus TCP/RTU certifie : 20 000 EUR
- Client OPC-UA conforme OPC Foundation : 25 000 EUR
- Passerelle LoRaWAN : 20 000 EUR
- Tests et certification protocoles : 20 000 EUR

### A.2 Detection automatique de symptomes

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Regles de detection automatique | **OPERATIONNEL** | 4 regles automatisees (roulement, cavitation, surchauffe, desalignement) | Enrichir avec 20+ regles supplementaires |
| Correlation multi-capteurs | **OPERATIONNEL** | Algorithme multi_sensor_correlation | Ameliorer avec modeles statistiques avances |
| Seuils adaptatifs par machine | **OPERATIONNEL** | Seuils configurables par equipement | Auto-calibration par apprentissage |
| Alertes en temps reel | **OPERATIONNEL** | Systeme de notification smart | — |

**Estimation R&D restante : 30 000 - 50 000 EUR**

### A.3 Edge Computing (IA embarquee)

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Modeles ML embarques | **A DEVELOPPER** | — | Modeles TensorFlow Lite / ONNX pour execution locale |
| Gateway edge intelligent | **A DEVELOPPER** | — | Materiel + logiciel de passerelle |
| Inference locale sans cloud | **A DEVELOPPER** | — | Moteur d'inference embarque |
| Synchronisation edge-cloud | **A DEVELOPPER** | — | Protocole de synchro bidirectionnel |

**Estimation R&D restante : 150 000 - 300 000 EUR**

---

## B. COUCHE 2 — EDGE INTELLIGENCE (Pre-traitement et detection temps reel)

*Pre-traitement local, detection d'anomalies en temps reel, agents equipement autonomes*

### B.1 Pre-traitement et filtrage

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Filtrage de donnees brutes | **OPERATIONNEL** | Pre-traitement avant envoi au core | — |
| Agregation temporelle | **OPERATIONNEL** | Moyenne, min, max par fenetre | — |
| Detection d'anomalies (z-score) | **OPERATIONNEL** | Algorithme statistique sur series temporelles | — |
| Analyse de tendance | **OPERATIONNEL** | Calcul de tendance lineaire | — |

### B.2 Agents equipement (Equipment Agents)

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Perception locale par equipement | **OPERATIONNEL** | equipment-agent.ts, metriques individuelles | — |
| Detection anomalies autonome | **OPERATIONNEL** | Detection temps reel par agent | — |
| Seuils adaptatifs par machine | **OPERATIONNEL** | Seuils configurables par equipement | Auto-calibration par apprentissage |
| Health Score individuel | **OPERATIONNEL** | Score de sante 0-100 par machine | — |

### B.3 Scoring de sante machine (Machine Health Score)

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Score de sante 0-100 | **OPERATIONNEL** | Page machine-health.tsx, calcul multi-facteurs | — |
| Evaluation des risques | **OPERATIONNEL** | Niveaux de risque par equipement | — |
| Recommandations IA | **OPERATIONNEL** | Suggestions basees sur le score | — |
| Historique du score | **PARTIEL** | Score instantane | Suivi temporel du score, courbes d'evolution |
| Benchmark inter-equipements | **A DEVELOPPER** | — | Comparer les scores entre machines similaires |

**Estimation R&D restante : 25 000 - 40 000 EUR**

### B.4 Analyse predictive

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Prediction de defaillance | **PARTIEL** | Modeles basiques par type d'equipement | Deep learning sur series temporelles (LSTM, Transformer) |
| Remaining Useful Life (RUL) | **A DEVELOPPER** | — | Estimation duree de vie restante par composant |
| Prediction 72h+ | **A DEVELOPPER** | — | Modeles de prevision avancee |

**Estimation R&D restante : 100 000 - 200 000 EUR**

---

## C. COUCHE 3 — COGNITIVE CORE (Knowledge Graph, regles expert, IA)

*Le noyau cognitif : Knowledge Graph 48+ noeuds, moteur de regles expert, similarite historique 120+ cas, IA Claude*

### C.1 Knowledge Graph

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Graphe de connaissances 48+ noeuds | **OPERATIONNEL** | knowledge-graph.ts, noeuds equipements, symptomes, causes, actions | — |
| Relations semantiques | **OPERATIONNEL** | Liens causes → symptomes → actions | — |
| Navigation et interrogation | **OPERATIONNEL** | API cognitive-routes.ts | — |
| Enrichissement continu | **OPERATIONNEL** | Mise a jour automatique via feedback | — |

### C.2 Moteur de regles expert

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| 10 regles deterministes | **OPERATIONNEL** | Vibration, temperature, pression, courant, bruit par type d'equipement (moteur, pompe, compresseur, convoyeur, turbine) | — |
| Matching symptome → cause → action | **OPERATIONNEL** | Confiance 70-95% selon les regles | — |
| Support multi-equipement | **OPERATIONNEL** | 5 types d'equipements couverts | Etendre a 15+ types |
| Regles configurables par tenant | **PARTIEL** | Structure prevue | Interface d'edition de regles par le client |

**Estimation R&D restante : 20 000 - 35 000 EUR**

### C.3 Base de similarite historique

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| 120+ cas industriels reels | **OPERATIONNEL** | Charges depuis fichier Excel enrichi | — |
| Algorithme de correspondance multi-criteres | **OPERATIONNEL** | Matching symptomes, type equipement, contexte | — |
| Import de donnees historiques (Excel) | **OPERATIONNEL** | Double mode : pre-charge + upload utilisateur | — |
| Recherche par similarite semantique | **PARTIEL** | Correspondance par mots-cles | Embeddings vectoriels pour recherche semantique avancee |

**Estimation R&D restante : 40 000 - 60 000 EUR**

### C.4 IA Claude (Anthropic)

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Structuration par Anthropic Claude | **OPERATIONNEL** | Mise en forme et enrichissement du diagnostic | — |
| Assistant IA conversationnel | **OPERATIONNEL** | Page ai-assistant.tsx | — |
| Analyse de symptomes inconnus | **OPERATIONNEL** | cloud-diagnostic.ts | — |
| Analyse de similarite semantique | **OPERATIONNEL** | analyzeSymptomSimilarity | — |
| Insights de maintenance | **OPERATIONNEL** | generateMaintenanceInsights | — |
| Diagnostic par email | **OPERATIONNEL** | Page email-diagnostic.tsx | — |

**Estimation R&D restante : 0 EUR (module complet)**

### C.5 Contextualisation GMAO

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Heures machine (machineHours) | **OPERATIONNEL** | Integration compteurs + fallback | — |
| Historique des ordres de travail | **OPERATIONNEL** | Derniers OT integres au diagnostic | — |
| Criticite equipement | **OPERATIONNEL** | Prise en compte dans le scoring | — |
| Stock pieces disponibles | **OPERATIONNEL** | Verification stock dans preconisations | — |
| Compteurs de maintenance | **OPERATIONNEL** | Tables maintenance_counters + counter_history | — |

**Estimation R&D restante : 0 EUR (module complet)**

---

## D. COUCHE 4 — ORCHESTRATION & EXECUTION (Cognitive Kernel et boucle fermee)

*Cognitive Kernel, Policy Engine, boucle fermee Detection → Diagnostic → Decision → Action → Feedback → Learning*

### D.1 Cognitive Kernel

> **Correction (audit 19/07/2026)** : le repertoire `server/cognitive-layers/` contient bien des sous-dossiers nommes `physical/`, `edge/`, `cognitive-core/`, `orchestration/`, `learning/`, `governance/`, mais **ces dossiers sont vides** — ce ne sont que des emplacements reserves. Le systeme ne comporte **pas de separation en 6 modules de code distincts**. Toute l'orchestration reelle est centralisee dans `server/cognitive-kernel/index.ts` (classe unique `CognitiveKernel`, singleton) et `server/agents/` (Equipment/Site/Global Agent), avec deux fichiers plats complementaires : `cognitive-layers/knowledge-graph.ts` et `cognitive-layers/physics-models.ts`. Le schema en 6 couches reste un **modele conceptuel valide pour comprendre le flux fonctionnel**, mais ne doit pas etre lu comme une cartographie du code.

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Orchestrateur central | **OPERATIONNEL** | cognitive-kernel/index.ts (classe CognitiveKernel, singleton), boucle de traitement toutes les 5s | — |
| Policy Engine | **OPERATIONNEL** | Regles metier et decisionnelles, integre au kernel (pas un module separe) | — |
| Boucle fermee complete | **OPERATIONNEL** | processClosedLoop() : Detection → Diagnostic → Decision → Action → Feedback → Learning, ecrit de vrais ordres de travail en base et journalise chaque decision (crypto-journal.ts) | — |
| Mode degrade sans IA | **OPERATIONNEL** | Les regles expert fonctionnent offline | — |
| Modularisation en 6 couches distinctes | **A DEVELOPPER** | Dossiers physical/, edge/, cognitive-core/, orchestration/, learning/, governance/ crees mais vides | Extraire la logique du kernel monolithique vers des modules dedies si la separation devient necessaire |

### D.2 Pipeline de diagnostic hybride

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Pipeline triple couche (regles + similarite + IA) | **OPERATIONNEL** | hybrid-diagnostic-pipeline.ts, confiance jusqu'a 98% | — |
| Facteurs de confiance explicables | **OPERATIONNEL** | "Regle expert activee", "12 cas similaires", etc. | — |
| Conformite CCTP | **OPERATIONNEL** | Tracabilite, auditabilite, non-dependance IA | — |
| Diagnostic vocal | **OPERATIONNEL** | Interface vocale pour saisie de symptomes | — |

**Estimation R&D restante : 0 EUR (module complet)**

### D.3 IA ensemble avancee

> **Correction (audit 19/07/2026)** : le fichier `diagnostic-ml-engine.ts` invoquait des scripts Python externes (`ml_diagnostic_engine.py`, `enhanced_ml_diagnostic.py`, `continuous_learning_engine.py`) censes implementer les "9 algorithmes ML combines". Ces scripts **n'existent pas dans le repository** — les appels echouaient systematiquement (ENOENT). Ce module etait donc du code mort, jamais fonctionnel. Il a ete supprime (voir changelog en fin de document). Le diagnostic robuste reel repose sur `hybrid-diagnostic-pipeline.ts` : moteur de regles expert + base de similarite historique (120+ cas) + IA Claude (Anthropic), qui reste pleinement operationnel (voir C.2, C.3, C.4).

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Ensemble ML Python (9 algorithmes) | **SUPPRIME (code mort)** | Appelait des scripts Python absents du repo, jamais fonctionnel | Si souhaite : implementer reellement un ensemble ML, sinon s'appuyer sur le pipeline hybride existant |
| Pipeline hybride regles + similarite + IA | **OPERATIONNEL** | hybrid-diagnostic-pipeline.ts, seul moteur de diagnostic combine reellement actif | — |
| Modeles specifiques par secteur | **A DEVELOPPER** | — | Modeles pre-entraines par industrie (cimenterie, agroalimentaire, mines, energie) |
| AutoML pour optimisation | **A DEVELOPPER** | — | Selection automatique du meilleur modele par contexte |

**Estimation R&D restante : 80 000 - 120 000 EUR** (inchangee — le module supprime n'apportait deja aucune valeur reelle)

---

## E. COUCHE 5 — LEARNING & KNOWLEDGE (Apprentissage continu et memoire)

*Apprentissage continu, memoire des defaillances, modeles hybrides physique+data, federation inter-tenant*

### E.1 Apprentissage continu

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Systeme de continuous learning | **OPERATIONNEL** | Apprentissage adaptatif en temps reel | — |
| Adaptive learning | **OPERATIONNEL** | Table adaptive_learning | — |
| Indicateurs d'apprentissage | **OPERATIONNEL** | Tables learning_metrics, model_performance | — |
| Boucle de feedback technicien | **OPERATIONNEL** | Validation/correction post-intervention | — |

### E.2 Memoire des defaillances (Failure Memory)

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Capitalisation automatique | **OPERATIONNEL** | Table failure_memory, insertion apres validation technicien | — |
| Enrichissement base a chaque intervention | **OPERATIONNEL** | Les cas valides alimentent les futurs diagnostics | — |
| Tracking des tendances de defaillance | **OPERATIONNEL** | Table failure_trends | — |

**Estimation R&D restante : 0 EUR (module complet)**

### E.3 Modeles hybrides physique+data

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Modeles physiques d'equipements | **OPERATIONNEL** | physics-models.ts, modeles mecaniques et thermiques | — |
| Fusion donnees capteurs + modeles physiques | **PARTIEL** | Integration basique | Deep learning + modeles physiques combines |
| Calibration automatique | **A DEVELOPPER** | — | Auto-ajustement des parametres physiques |

**Estimation R&D restante : 50 000 - 80 000 EUR**

### E.4 Apprentissage federe inter-tenants

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Routes API federated-ai | **OPERATIONNEL** | Feedback, recommandations, statistiques | — |
| Isolation des donnees | **OPERATIONNEL** | Aucune fuite de donnees entre tenants | — |
| Partage anonymise de patterns | **PARTIEL** | Structure presente | Algorithme de federation reelle (Federated Averaging) |
| Modele global federe | **A DEVELOPPER** | — | Entrainement distribue sans partage de donnees brutes |
| Benchmark cross-sectoriel | **A DEVELOPPER** | — | Comparaison anonymisee des performances par secteur |

**Estimation R&D restante : 80 000 - 150 000 EUR**

---

## F. COUCHE 6 — GOVERNANCE & TRUST (Explainabilite, audit et conformite)

*Explainabilite CCTP, audit decisionnel, simulation what-if, niveaux d'autonomie 0-5*

### F.1 Explainabilite et conformite CCTP

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Tracabilite complete des decisions | **OPERATIONNEL** | cctp-compliance-system.ts, audit trail | — |
| Facteurs de confiance explicables | **OPERATIONNEL** | Justification de chaque diagnostic | — |
| Non-dependance IA (mode degrade) | **OPERATIONNEL** | Regles expert fonctionnent sans IA | — |
| Rapports de conformite automatises | **OPERATIONNEL** | Generation rapports CCTP | — |

### F.2 Audit decisionnel

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Audit logs complets | **OPERATIONNEL** | Tracabilite complete de toutes les actions | — |
| Revue des decisions IA | **OPERATIONNEL** | audit-review-system.ts | — |
| Tableaux de bord audit | **OPERATIONNEL** | Visualisation des decisions et performances | — |

### F.3 Simulation what-if

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Scenarios de simulation | **PARTIEL** | Simulation basique | Moteur de simulation physique avance |
| Impact analysis | **A DEVELOPPER** | — | Simuler l'impact de decisions de maintenance |
| Jumeaux numeriques (Digital Twins) | **A DEVELOPPER** | — | Moteur 3D web (Three.js / Babylon.js) |

**Estimation R&D restante : 200 000 - 400 000 EUR**

### F.4 Niveaux d'autonomie 0-5

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Niveau 0 : Manuel complet | **OPERATIONNEL** | Tout valide par l'humain | — |
| Niveau 1 : Suggestions | **OPERATIONNEL** | IA suggere, humain decide | — |
| Niveau 2 : Assistance | **OPERATIONNEL** | IA prepare, humain valide | — |
| Niveau 3 : Semi-autonome | **PARTIEL** | Actions mineures automatisees | Perimetre a definir |
| Niveau 4 : Autonome supervise | **A DEVELOPPER** | — | IA agit, humain supervise |
| Niveau 5 : Autonome complet | **A DEVELOPPER** | — | IA agit, intervention humaine exceptionnelle |

**Estimation R&D restante : 80 000 - 150 000 EUR**

---

## G. SYSTEME MULTI-AGENTS DISTRIBUE

*Architecture distribuee avec trois niveaux d'agents intelligents*

### G.1 Equipment Agent (Agent equipement)

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Perception locale | **OPERATIONNEL** | server/agents/equipment-agent.ts, collecte et analyse par equipement | — |
| Detection d'anomalies | **OPERATIONNEL** | Detection temps reel par agent individuel | — |
| Metriques individuelles | **OPERATIONNEL** | Health score, tendances, alertes par machine | — |
| Communication ascendante | **OPERATIONNEL** | Remontee d'alertes vers le Site Agent | — |

### G.2 Site Agent (Agent site)

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Coordination multi-equipements | **OPERATIONNEL** | server/agents/site-agent.ts, vision globale du site | — |
| Prevention cascade | **OPERATIONNEL** | Detection de pannes en cascade entre equipements | — |
| Correlation inter-equipements | **OPERATIONNEL** | Analyse des interactions et dependances | — |
| Optimisation locale | **OPERATIONNEL** | Decisions de maintenance coordonnees | — |

### G.3 Global Agent (Agent global)

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Apprentissage inter-sites | **OPERATIONNEL** | server/agents/global-agent.ts, patterns globaux | — |
| Patterns globaux | **OPERATIONNEL** | Detection de tendances cross-site | — |
| Optimisation globale | **OPERATIONNEL** | Recommandations basees sur l'ensemble du parc | — |
| Federation de connaissances | **PARTIEL** | Partage anonymise | Federation reelle (Federated Averaging) |

**Estimation R&D restante : 40 000 - 70 000 EUR**

---

## H. INTEGRATIONS PLATEFORMES DE COMMUNICATION

*Dispatch multi-plateforme, filtrage par severite et type d'evenement, historique des envois*

### H.1 Plateformes supportees

| Plateforme | Statut | Detail | R&D restante |
|---|---|---|---|
| Slack | **OPERATIONNEL** | Notifications, alertes, rapports | — |
| Microsoft Teams | **OPERATIONNEL** | Integration webhooks et messages | — |
| Telegram | **OPERATIONNEL** | Bot de notification | — |
| WhatsApp | **OPERATIONNEL** | Notifications via API | — |
| Webhooks personnalises | **OPERATIONNEL** | Endpoints configurables par tenant | — |
| Email (SendGrid) | **OPERATIONNEL** | Notifications, diagnostics, invitations | — |

### H.2 Moteur de dispatch

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Dispatch multi-plateforme | **OPERATIONNEL** | server/integrations/communication-dispatcher.ts | — |
| Filtrage par severite | **OPERATIONNEL** | Configuration par niveau d'alerte | — |
| Filtrage par type d'evenement | **OPERATIONNEL** | Diagnostic, maintenance, stock, IoT | — |
| Historique des envois | **OPERATIONNEL** | Tracabilite complete des notifications | — |
| Statistiques d'envoi | **OPERATIONNEL** | Metriques de deliverabilite et engagement | — |
| Configuration par tenant | **OPERATIONNEL** | Chaque tenant configure ses canaux | — |

**Estimation R&D restante : 0 EUR (module complet)**

---

## I. SOCLE OPERATIONNEL — GMAO & ERP

*La colonne vertebrale qui alimente et est alimentee par le cerveau cognitif*

### I.1 Gestion des equipements

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Registre des equipements | **OPERATIONNEL** | CRUD complet, multi-tenant | — |
| Types d'equipements | **OPERATIONNEL** | Classification et normalisation | — |
| QR codes equipement | **OPERATIONNEL** | Generation et impression | — |
| Arbre des actifs (hierarchie) | **PARTIEL** | Structure plate | Hierarchie parent/enfant, localisation |
| Historique complet de l'equipement | **OPERATIONNEL** | OT, capteurs, diagnostics lies | — |

**Estimation R&D restante : 15 000 - 25 000 EUR**

### I.2 Ordres de travail

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| CRUD complet | **OPERATIONNEL** | Creation, lecture, mise a jour, suppression | — |
| Validation multi-niveaux | **OPERATIONNEL** | Workflow de validation configurable | — |
| Assignation techniciens | **OPERATIONNEL** | Affectation manuelle | — |
| Suivi des temps et couts | **OPERATIONNEL** | Duree, pieces, main d'oeuvre | — |
| Lien diagnostic → OT | **OPERATIONNEL** | Creation d'OT depuis un diagnostic | — |
| Pieces justificatives | **OPERATIONNEL** | Upload de documents (PDF, images) | — |
| Planification automatique | **A DEVELOPPER** | — | Algorithme d'optimisation planning |

**Estimation R&D restante : 0 EUR (module complet pour le socle)**

### I.3 Maintenance preventive

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Plans de maintenance | **OPERATIONNEL** | CRUD complet, frequences configurables | — |
| Compteurs de maintenance | **OPERATIONNEL** | Tables maintenance_counters, counter_history | — |
| Calendrier preventif | **OPERATIONNEL** | Planification temporelle et/ou compteur | — |
| Transition preventif → cognitif | **A DEVELOPPER** | — | Remplacer le calendaire par le scoring de sante |

**Estimation R&D restante : 30 000 - 50 000 EUR**

### I.4 Gestion des stocks et pieces detachees

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Inventaire pieces | **OPERATIONNEL** | CRUD complet, stock par tenant | — |
| Mouvements de stock | **OPERATIONNEL** | Entrees, sorties, transferts | — |
| Seuils de reapprovisionnement | **OPERATIONNEL** | Alertes stock bas | — |
| Regles de commande automatique | **SCHEMA** | Table reorder_rules | Logique metier a implementer |

**Estimation R&D restante : 20 000 - 30 000 EUR**

### I.5 Achats et fournisseurs

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Registre fournisseurs | **OPERATIONNEL** | CRUD complet | — |
| Bons de commande | **OPERATIONNEL** | CRUD avec items, validation | — |
| Suivi des commandes | **PARTIEL** | Statuts basiques | Workflow complet reception/controle qualite |
| Evaluation fournisseurs | **A DEVELOPPER** | — | Scoring qualite/delai/prix |

**Estimation R&D restante : 25 000 - 40 000 EUR**

### I.6 Rapports et KPIs

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Rapports d'intervention | **OPERATIONNEL** | Generation automatique | — |
| Rapports mensuels | **OPERATIONNEL** | KPIs consolides par mois | — |
| Tableau de bord maintenance | **OPERATIONNEL** | Dashboard avec indicateurs cles | — |
| Export PDF | **OPERATIONNEL** | jsPDF + html2canvas | — |
| Templates de rapports | **OPERATIONNEL** | Table report_templates | — |
| Rapports avances | **OPERATIONNEL** | Page advanced-reporting.tsx | — |
| Integration Power BI | **SCHEMA** | Tables power_bi_workspaces, reports, datasets | Connecteur Power BI reel |
| Rapports cognitifs (impact IA) | **A DEVELOPPER** | — | ROI du diagnostic cognitif, economies generees |

**Estimation R&D restante : 30 000 - 50 000 EUR**

---

## J. INFRASTRUCTURE & PLATEFORME

### J.1 Architecture multi-tenant SaaS

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Isolation complete des donnees | **OPERATIONNEL** | Zero data leakage, tests 25/25 | — |
| Gestion des tenants | **OPERATIONNEL** | CRUD, configuration par tenant | — |
| Systeme d'invitations email | **OPERATIONNEL** | SendGrid integration | — |
| Catalogue de modules activables | **OPERATIONNEL** | 16 modules, activation par tenant | — |
| Templates sectoriels | **OPERATIONNEL** | 4 templates pre-configures | — |
| Systeme de licences | **OPERATIONNEL** | Types, historique, gestion | — |

**Estimation R&D restante : 0 EUR (module complet)**

### J.2 Securite et conformite

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Authentification enterprise | **OPERATIONNEL** | bcrypt, sessions securisees, MFA | — |
| RBAC (7 roles) | **OPERATIONNEL** | Permissions granulaires | — |
| Protection CSRF | **OPERATIONNEL** | Tokens CSRF actifs | — |
| Rate limiting | **OPERATIONNEL** | Anti-brute-force | — |
| Audit logs | **OPERATIONNEL** | Tracabilite complete | — |
| RGPD (donnees personnelles) | **OPERATIONNEL** | Requetes RGPD, retention, anonymisation | — |
| Documentation SOC 2 | **OPERATIONNEL** | 97% couverture documentaire | — |
| Documentation ISO 27001 | **OPERATIONNEL** | Politique, PCA, registre risques | — |
| Certification SOC 2 Type I | **A DEVELOPPER** | Documentation prete | Audit externe par cabinet certifie |
| Certification ISO 27001 | **A DEVELOPPER** | Documentation prete | Audit et certification par organisme accredite |
| SSO / SAML | **A DEVELOPPER** | — | Single Sign-On pour grands comptes |

**Estimation R&D restante : 70 000 - 120 000 EUR**

### J.3 Paiements et monetisation

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Stripe | **OPERATIONNEL** | Integration complete | — |
| PayPal | **OPERATIONNEL** | Sandbox + production | — |
| Gestion abonnements | **PARTIEL** | Logique de base | Workflow complet cycle de vie abonnement |
| Facturation automatique | **A DEVELOPPER** | — | Generation et envoi automatique de factures |
| Mobile Money (Afrique) | **A DEVELOPPER** | — | Orange Money, MTN Mobile Money, Wave |

**Estimation R&D restante : 40 000 - 70 000 EUR**

### J.4 Deploiement et DevOps

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Docker | **OPERATIONNEL** | Dockerfile, docker-compose | — |
| CI/CD GitHub Actions | **OPERATIONNEL** | Build, test, deploy AWS | — |
| AWS ECS Fargate | **OPERATIONNEL** | Workflow de deploiement | — |
| AWS EC2 SSH | **OPERATIONNEL** | Deploiement alternatif | — |
| CloudFormation | **OPERATIONNEL** | Template infrastructure | — |
| Monitoring production | **PARTIEL** | Logs basiques | APM, metriques, alerting (Datadog/Grafana) |
| Auto-scaling | **A DEVELOPPER** | — | Scalabilite horizontale automatique |
| Historique de migrations DB | **CORRIGE (19/07/2026)** | 84 tables definies dans shared/schema.ts mais un seul snapshot de migration existait (aout 2025) — usage de `drizzle-kit push` en synchronisation directe sans historique versionne. Une migration baseline a jour a ete generee lors de cet audit. | Maintenir la discipline `drizzle-kit generate` a chaque evolution du schema |

**Estimation R&D restante : 30 000 - 50 000 EUR**

---

## K. INTERFACES UTILISATEUR

### K.1 Application web

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| 53+ pages fonctionnelles | **OPERATIONNEL** | Toutes les pages listees | — |
| Design glassmorphism | **OPERATIONNEL** | UI/UX moderne | — |
| Internationalisation (FR/EN) | **OPERATIONNEL** | Systeme i18n complet | — |
| Mode sombre | **OPERATIONNEL** | Toggle dark/light | — |
| Portail client | **OPERATIONNEL** | Acces token pour clients | — |
| Dashboard super-admin | **OPERATIONNEL** | Gestion globale | — |
| Dashboard infrastructure cognitive | **OPERATIONNEL** | Visualisation des 6 couches | — |
| Dashboard apprentissage | **OPERATIONNEL** | Metriques learning et performance IA | — |

**Estimation R&D restante : 0 EUR (module complet)**

### K.2 Application mobile

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Architecture React Native | **OPERATIONNEL** | Structure complete | — |
| Mode offline (SQLite) | **OPERATIONNEL** | Base locale, synchro auto | — |
| Scanner QR equipement | **OPERATIONNEL** | Camera + decodage | — |
| Gestion OT mobile | **OPERATIONNEL** | CRUD depuis le terrain | — |
| Diagnostic mobile | **OPERATIONNEL** | Sessions de diagnostic | — |
| Guidage reparation pas-a-pas | **OPERATIONNEL** | Procedures de reparation | — |
| Notifications push | **A DEVELOPPER** | — | Firebase Cloud Messaging / APNs |
| Realite augmentee (AR) | **A DEVELOPPER** | — | Overlay d'informations sur la machine filmee |
| Publication App Store / Play Store | **A DEVELOPPER** | — | Processus de soumission et validation |

**Estimation R&D restante : 50 000 - 90 000 EUR**

### K.2bis Application desktop (nouvellement documentee)

> **Ajout (audit 19/07/2026)** : ce module n'existait pas dans la version precedente du document. Deux implementations Electron distinctes coexistent dans le repository, **non reliees entre elles** (aucun import croise) — un doublon non intentionnel a resoudre.

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| `desktop/` — client leger | **OPERATIONNEL** | v2.0.0, charge une URL serveur (local ou cloud) via electron-store, auto-update (electron-updater), aucun backend embarque | — |
| `electron/` — client avec backend embarque | **OPERATIONNEL** | v2.6.0, tente d'embarquer un backend Node local + SQLite, tray, menu natif, notifications systeme | — |
| Choix de l'implementation a conserver | **DECISION EN ATTENTE** | Aucune trace dans la CI/CD (ni ci.yml ni deploy-ec2/ecs.yml ne referencent l'un ou l'autre) ; indice git : `desktop/` ajoute par un commit dedie ("Add installable desktop application and PWA"), `electron/` touche seulement par un commit generique sans rapport | Trancher puis supprimer l'implementation non retenue |

**Estimation R&D restante : a definir apres decision produit**

### K.3 Integrations externes

> **Correction (audit 19/07/2026)** : SAP, SCADA et Maximo etaient decrits comme simules/schema uniquement. En realite, `sap-connector.ts`, `scada-connector.ts` et `maximo-connector.ts` effectuent de vrais appels HTTP (`fetch`) vers des endpoints externes reels (OData SAP, REST SCADA, OSLC Maximo) avec credentials lus depuis les variables d'environnement. Ces connecteurs sont donc **fonctionnels des lors qu'un endpoint externe est configure** — il ne s'agit pas de simulation de donnees.

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Connecteur SAP | **OPERATIONNEL** | sap-connector.ts, appels reels OData (API_MAINTENANCE_ORDER_SRV, API_EQUIPMENT_SRV) via credentials env | Tests d'integration avec instance SAP client reelle, gestion d'erreurs avancee |
| Connecteur SCADA | **OPERATIONNEL** | scada-connector.ts, appels REST reels (/tags/read, /alarms/active) via SCADA_ENDPOINT env | Tests d'integration avec systemes SCADA reels varies |
| Connecteur Maximo | **OPERATIONNEL** | maximo-connector.ts, appels OSLC reels via MAXIMO_BASE_URL/USERNAME/PASSWORD env | Tests d'integration avec instance Maximo reelle |
| Connecteur ERP generique | **SCHEMA** | Table erp_systems | API RESTful bidirectionnelle |
| Integration Power BI | **SCHEMA** | Tables presentes | Connecteur Power BI reel |
| Webhook / API tierce | **PARTIEL** | API REST disponible | SDK et documentation API publique |

**Estimation R&D restante : 40 000 - 100 000 EUR** (revisee a la baisse : SAP/SCADA/Maximo necessitent des tests contre instances reelles, pas un developpement de connecteur depuis zero)

### K.4 Gamification et formation

| Sous-module | Statut | Detail | R&D restante |
|---|---|---|---|
| Competences maintenance | **OPERATIONNEL** | 6 competences trackees | — |
| Achievements / badges | **OPERATIONNEL** | 7 achievements definis | — |
| Challenges techniques | **OPERATIONNEL** | 3 defis actifs | — |
| Progression utilisateur | **OPERATIONNEL** | Suivi des progres | — |
| Tableau de bord apprentissage | **OPERATIONNEL** | Page learning-dashboard.tsx | — |
| Formation interactive | **A DEVELOPPER** | — | Modules e-learning integres |
| Certification technicien | **A DEVELOPPER** | — | Parcours de certification interne |

**Estimation R&D restante : 40 000 - 60 000 EUR**

---

## STACK TECHNIQUE

| Composant | Technologie | Detail |
|---|---|---|
| **Frontend** | React 18 + TypeScript | SPA avec Vite, TailwindCSS, shadcn/ui |
| **Backend** | Node.js + Express | API REST, TypeScript |
| **Base de donnees** | PostgreSQL | Driver node-postgres (pg) + Drizzle ORM, multi-tenant (le driver Neon serverless est present en dependance mais non utilise) |
| **IA** | Anthropic Claude | Structuration diagnostics, assistant conversationnel — 2 clients Anthropic distincts (pipeline diagnostic + chat assistant), appels API reels si cle configuree |
| **IoT** | MQTT (reel/hybride), Modbus/OPC-UA/LoRaWAN (simules) | MQTT reellement cable (iot-connector.ts) mais connecteur "advanced" mocke tourne par defaut au boot |
| **Mobile** | React Native + Expo | Mode offline SQLite, scanner QR |
| **Authentification** | bcrypt, sessions, MFA (TOTP) | JWT, OIDC, enterprise auth |
| **Paiements** | Stripe, PayPal | Integration complete |
| **Email** | SendGrid | Notifications, invitations, diagnostics |
| **Communication** | Slack, Teams, Telegram, WhatsApp | Dispatch multi-plateforme |
| **DevOps** | Docker, GitHub Actions, AWS ECS | CI/CD complet |
| **Infrastructure** | AWS (ECS Fargate, EC2, CloudFormation) | Multi-region capable |
| **Monitoring** | Grafana, Prometheus | Dashboards et metriques |
| **Cache** | Redis | Sessions, cache de donnees |
| **Cognitive** | Knowledge Graph, Regles Expert, Pipeline hybride (regles + similarite + Claude) | Orchestration centralisee dans cognitive-kernel/ (pas de separation en 6 modules de code) — l'ancien "ML Ensemble" Python etait du code mort, supprime |
| **Agents** | Equipment, Site, Global | Systeme multi-agents distribue |

---

## SYNTHESE R&D — CE QUI RESTE A FAIRE

### Par couche cognitive

| Couche | Modules operationnels | Modules a developper | Budget R&D estime |
|---|---|---|---|
| **Couche 1 : Physique** | Simulation IoT, stockage capteurs, 8 types capteurs | Protocoles reels (MQTT, Modbus, OPC-UA, LoRaWAN), edge computing | **260 000 - 470 000 EUR** |
| **Couche 2 : Edge Intelligence** | Agents equipement, detection anomalies, health score | Deep learning series temporelles, RUL, prediction 72h+ | **125 000 - 240 000 EUR** |
| **Couche 3 : Cognitive Core** | Knowledge Graph 48+ noeuds, regles expert, 120 cas, IA Claude | Recherche semantique vectorielle, regles configurables | **60 000 - 95 000 EUR** |
| **Couche 4 : Orchestration & Execution** | Cognitive Kernel, pipeline hybride, boucle fermee | Modeles par secteur, AutoML | **80 000 - 120 000 EUR** |
| **Couche 5 : Learning & Knowledge** | Failure memory, apprentissage continu, feedback, tendances | Federation reelle, modeles hybrides avances | **130 000 - 230 000 EUR** |
| **Couche 6 : Governance & Trust** | CCTP, audit, explainabilite, niveaux 0-2 | Simulation what-if, jumeaux numeriques, niveaux 3-5 | **280 000 - 550 000 EUR** |
| **Multi-Agents** | Equipment, Site, Global agents operationnels | Federation reelle | **40 000 - 70 000 EUR** |
| **Communication** | Slack, Teams, Telegram, WhatsApp, Webhooks, Email | — | **0 EUR (complet)** |
| **Socle GMAO/ERP** | Equipements, OT, preventif, stocks, achats, rapports | Hierarchie actifs, commande auto, rapports cognitifs | **120 000 - 195 000 EUR** |
| **Infrastructure** | Multi-tenant, securite, paiements, CI/CD | Certifications, SSO, Mobile Money, auto-scaling | **140 000 - 240 000 EUR** |
| **Interfaces** | Web (53+ pages), mobile offline, gamification | Notifications push, AR, publications stores, integrations ERP | **190 000 - 350 000 EUR** |

### Total global

| Categorie | Budget minimum | Budget maximum |
|---|---|---|
| **Deja developpe (valeur estimee)** | **900 000 EUR** | **1 400 000 EUR** |
| **R&D restante (toutes couches)** | **1 425 000 EUR** | **2 560 000 EUR** |

### Priorites de R&D par horizon temporel

#### Horizon 1 — Immediat (6 mois, Seed) : 400 000 - 600 000 EUR

| Priorite | Module | Budget | Justification |
|---|---|---|---|
| P1 | Integration MQTT reelle | 15 000 EUR | Indispensable pour les pilotes terrain |
| P1 | Enrichissement regles expert (20+ regles) | 20 000 EUR | Couverture plus large des pannes |
| P1 | Recherche semantique vectorielle | 40 000 EUR | Amelioration majeure precision diagnostics |
| P1 | Certification SOC 2 Type I | 30 000 EUR | Acces aux grands comptes |
| P1 | Mobile Money (Wave, Orange Money) | 25 000 EUR | Indispensable marche africain |
| P1 | Notifications push mobile | 15 000 EUR | Experience terrain complete |
| P1 | Monitoring production (APM) | 20 000 EUR | Fiabilite en production |
| P2 | Modeles ML sectoriels | 50 000 EUR | Specialisation par industrie |
| P2 | Historique score de sante | 20 000 EUR | Suivi evolution des machines |
| P2 | Publication App Store/Play Store | 25 000 EUR | Distribution mobile |

#### Horizon 2 — Moyen terme (12 mois, Post-Seed) : 500 000 - 800 000 EUR

| Priorite | Module | Budget |
|---|---|---|
| P1 | IA embarquee / edge computing | 150 000 - 300 000 EUR |
| P1 | Detection predictive deep learning (72h+) | 100 000 - 200 000 EUR |
| P2 | Connecteurs SAP/Oracle reels | 100 000 - 200 000 EUR |
| P2 | Protocoles Modbus + OPC-UA reels | 45 000 EUR |
| P2 | Certification ISO 27001 | 40 000 EUR |

#### Horizon 3 — Long terme (24 mois, Serie A) : 600 000 - 1 400 000 EUR

| Priorite | Module | Budget |
|---|---|---|
| P1 | Jumeaux numeriques 3D | 200 000 - 400 000 EUR |
| P1 | Niveaux d'autonomie 3-5 | 80 000 - 150 000 EUR |
| P2 | Orchestration inter-machines avancee | 150 000 - 300 000 EUR |
| P2 | Realite augmentee mobile | 40 000 EUR |
| P2 | Apprentissage federe reel (FL) | 80 000 - 150 000 EUR |
| P3 | Auto-commande pieces | 60 000 - 100 000 EUR |
| P3 | Formation interactive / e-learning | 40 000 - 60 000 EUR |

---

## INDICATEURS DE MATURITE PAR COUCHE

```
COUCHE 6 : GOVERNANCE & TRUST   ████████████░░░░░░░░  60%  ← What-if et niveaux 3-5 a completer
COUCHE 5 : LEARNING & KNOWLEDGE ██████████████░░░░░░  70%  ← Federation a renforcer
COUCHE 4 : ORCHESTRATION & EXEC ████████████████████  95%  ← Quasi-complete
COUCHE 3 : COGNITIVE CORE       ██████████████████░░  90%  ← Recherche semantique a ameliorer
COUCHE 2 : EDGE INTELLIGENCE    ████████████████░░░░  80%  ← Predictif a approfondir
COUCHE 1 : PHYSIQUE             ████████████░░░░░░░░  60%  ← Protocoles reels + edge
MULTI-AGENTS                     ██████████████████░░  85%  ← Federation reelle
COMMUNICATION                    ████████████████████  100% ← Complet
SOCLE GMAO/ERP                   ██████████████████░░  90%  ← Presque complet
INFRASTRUCTURE                   ██████████████████░░  85%  ← Certifications restantes
INTERFACES                       ████████████████░░░░  80%  ← Stores + AR
─────────────────────────────────────────────────────────────
MATURITE GLOBALE                 ████████████████░░░░  80%
```

---

## CHANGELOG DES CORRECTIONS (audit code du 19/07/2026)

Corrections apportees suite a un audit complet du repository (exploration directe des fichiers source, pas de la documentation) :

1. **6 couches cognitives** — clarifie que `server/cognitive-layers/{physical,edge,cognitive-core,orchestration,learning,governance}/` sont des dossiers vides ; toute la logique est centralisee dans `cognitive-kernel/` + `agents/`. Le schema 6 couches reste un modele conceptuel, pas une cartographie du code (section D.1).
2. **Ensemble ML Python (9 algorithmes)** — identifie comme code mort (`diagnostic-ml-engine.ts` appelait des scripts Python inexistants) et **supprime** du code. Le diagnostic robuste repose reellement sur le pipeline hybride regles + similarite + Claude (section D.3).
3. **Connecteurs SAP, SCADA, Maximo** — reclasses de SIMULE/SCHEMA vers OPERATIONNEL : ce sont de vrais appels HTTP vers des API externes (OData, REST, OSLC), pas des simulations (section K.3).
4. **Connecteur IoT MQTT** — nuance entre `iot-connector.ts` (reel/hybride, vrai client mqtt) et `advanced-iot-connector.ts` (entierement mocke, actif par defaut au demarrage) — l'ancien statut "SIMULE" global etait imprecis (section A.1).
5. **Driver base de donnees** — corrige de "PostgreSQL (Neon)" vers driver `pg` (node-postgres) classique ; le driver Neon serverless est en dependance mais non utilise (Stack technique).
6. **Application desktop** — ajout d'une section documentant le doublon non resolu entre `desktop/` et `electron/` (deux implementations Electron non reliees), absent du document original (section K.2bis).
7. **Historique de migrations DB** — signale l'absence d'historique de migrations versionne malgre 84 tables ; une migration baseline (`migrations/0000_baseline_84_tables.sql`, 1608 lignes) a ete generee via `drizzle-kit generate`, sans connexion a la base de production. L'ancien snapshot (aout 2025, desynchronise) a ete sauvegarde dans `migrations_legacy_backup_2026-07-19/` plutot que supprime (section J.4).

Les estimations de budget R&D globales (section SYNTHESE R&D) n'ont pas ete recalculees dans leur ensemble suite a cet audit — seules les lignes directement concernees par les corrections ci-dessus ont ete revisees. Une revue complete des chiffrages est recommandee au prochain cycle.

---

**Document prepare par l'equipe Maintrix**
**Fevrier 2026 — Version 2.0**
**Corrige le 19 Juillet 2026 — Version 2.1 (audit code)**

*Ce document constitue la reference architecturale unique et la feuille de route technique complete de Maintrix. Il doit etre mis a jour a chaque milestone de developpement.*

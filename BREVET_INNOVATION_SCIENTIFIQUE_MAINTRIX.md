# BREVET D'INVENTION — MAINTRIX
# Système informatique de supervision et de contrôle adaptatif d'équipements industriels à modélisation causale dynamique

**Document de Soumission de Brevet**
**Version :** 1.0
**Date :** Février 2026
**Classification :** G06N (Intelligence Artificielle) / G05B (Systèmes de Contrôle Industriels)
**Déposant :** [À compléter]

---

## TABLE DES MATIÈRES

1. [Titre de l'invention](#1-titre-de-linvention)
2. [Domaine technique](#2-domaine-technique)
3. [État de l'art et problème technique](#3-état-de-lart-et-problème-technique)
4. [Résumé de l'invention](#4-résumé-de-linvention)
5. [Description détaillée de l'invention](#5-description-détaillée-de-linvention)
6. [Revendications principales](#6-revendications-principales)
7. [Revendications dépendantes](#7-revendications-dépendantes)
8. [Figures et schémas](#8-figures-et-schémas)
9. [Exemples de réalisation](#9-exemples-de-réalisation)
10. [Avantages de l'invention](#10-avantages-de-linvention)
11. [Applications industrielles](#11-applications-industrielles)
12. [Abrégé](#12-abrégé)

---

## 1. TITRE DE L'INVENTION

**"Système informatique de supervision et de contrôle adaptatif d'équipements industriels à modélisation causale dynamique"**

Titre court : **MAINTRIX — Système de Supervision et Contrôle Adaptatif Industriel**

---

## 2. DOMAINE TECHNIQUE

La présente invention se rapporte au domaine des systèmes informatiques de supervision et de contrôle adaptatif d'équipements industriels. Plus particulièrement, l'invention concerne un système à modélisation causale dynamique qui structure les relations entre paramètres physiques mesurés et modes de défaillance mécaniques, et qui adapte dynamiquement cette modélisation en fonction des résultats d'interventions techniques effectuées sur lesdits équipements.

L'invention s'inscrit dans les classifications internationales suivantes :
- **G06N 5/04** — Systèmes experts, raisonnement basé sur des règles
- **G06N 3/08** — Méthodes d'apprentissage pour réseaux neuronaux
- **G06N 20/00** — Apprentissage automatique
- **G05B 23/02** — Systèmes de surveillance d'état pour machines
- **G06Q 10/20** — Logistique de maintenance et planification
- **G06F 16/36** — Graphes de connaissances et ontologies

---

## 3. ÉTAT DE L'ART ET PROBLÈME TECHNIQUE

### 3.1 État de l'art existant

Les systèmes actuels de gestion de maintenance assistée par ordinateur (GMAO) et les plateformes de maintenance prédictive présentent les caractéristiques suivantes :

#### 3.1.1 GMAO traditionnels (SAP PM, IBM Maximo, Infor EAM)
- Systèmes de gestion transactionnelle des interventions
- Planification calendaire de la maintenance préventive
- Historique des interventions sous forme de base de données relationnelle
- Aucune capacité de raisonnement autonome
- Requièrent une expertise humaine pour chaque décision

#### 3.1.2 Plateformes de maintenance prédictive (SparkCognition, Uptake, C3.ai)
- Modèles de machine learning pour la prédiction de pannes
- Analyse de données capteurs en temps réel
- Alertes basées sur des seuils statistiques
- **Limitations** : modèles "boîte noire" sans explicabilité, pas de raisonnement causal, pas d'autonomie décisionnelle, pas de capitalisation structurée des connaissances terrain

#### 3.1.3 Jumeaux numériques (Siemens MindSphere, GE Predix, PTC ThingWorx)
- Répliques virtuelles d'équipements physiques
- Simulation de comportements basée sur des modèles physiques
- **Limitations** : pas de raisonnement cognitif, pas d'apprentissage à partir des interventions terrain, pas de décision autonome

#### 3.1.4 Systèmes experts industriels historiques
- Bases de règles statiques (type CLIPS, Drools)
- Raisonnement déductif simple
- **Limitations** : pas d'apprentissage, pas de fusion multi-sources, pas d'explicabilité structurée, maintenance manuelle des règles

### 3.2 Problème technique non résolu

Aucun système existant ne résout simultanément les problèmes suivants :

1. **Fragmentation cognitive** : Les connaissances de maintenance sont dispersées entre règles expertes informelles, historiques d'interventions, données capteurs, et savoir-faire tacite des techniciens. Aucun système ne les fusionne dans une architecture unifiée.

2. **Absence de raisonnement causal** : Les systèmes existants détectent des anomalies mais ne raisonnent pas sur les chaînes causales (symptôme → cause → cascade → intervention). Ils ne peuvent pas prédire les effets en cascade d'une défaillance.

3. **Opacité décisionnelle** : Les modèles de deep learning produisent des prédictions sans pouvoir expliquer leur raisonnement. Cela pose des problèmes de confiance, de conformité réglementaire (ISO 55000, CCTP), et d'adoption par les équipes terrain.

4. **Autonomie non graduée** : Les systèmes sont soit entièrement manuels, soit entièrement automatisés. Il n'existe pas de mécanisme formel pour graduer progressivement le niveau d'autonomie avec des garde-fous adaptés.

5. **Absence d'apprentissage structuré** : Les retours terrain (succès/échec des interventions) ne sont pas capitalisés de manière à renforcer les futurs diagnostics. La connaissance est perdue à chaque rotation de personnel.

### 3.3 Formulation du problème technique

Le problème technique résolu par la présente invention est le suivant :

> Comment concevoir un système informatique de supervision et de contrôle adaptatif d'équipements industriels qui, à partir de signaux issus de capteurs physiques (vibratoires, thermiques, électriques, pression), soit capable de : (1) détecter les variations anormales de paramètres physiques ; (2) structurer les relations causales entre ces paramètres mesurés et les modes de défaillance mécaniques via un modèle causal dynamique ; (3) générer des signaux de commande destinés à modifier le fonctionnement des équipements industriels ; (4) adapter dynamiquement la structure du modèle causal en fonction des résultats d'interventions techniques effectuées — le tout afin de limiter les dérives techniques, réduire les défaillances en cascade, et stabiliser le comportement opérationnel du parc industriel ?

---

## 4. RÉSUMÉ DE L'INVENTION

La présente invention propose un **système informatique de supervision et de contrôle adaptatif d'équipements industriels à modélisation causale dynamique**, caractérisé en ce qu'il comprend :

1. Une **interface matérielle de réception de signaux** issus de capteurs physiques (vibratoires, thermiques, électriques, pression, débit, vitesse, acoustiques) via des protocoles industriels standards (MQTT, Modbus, OPC-UA, LoRaWAN), produisant des signaux normalisés typés (`SensorSignal`) ;

2. Un **module de détection de variations anormales de paramètres physiques**, configuré pour comparer en temps réel les signaux capteurs à des seuils adaptatifs (warning, critical) et classifier les anomalies par type (`threshold_breach`, `trend_deviation`, `pattern_anomaly`, `correlation_anomaly`) et par sévérité ;

3. Un **module de modélisation causale** structurant les relations entre paramètres mesurés et modes de défaillance mécaniques, sous forme d'un graphe de connaissances industriel comprenant 5 types de nœuds (équipement, symptôme, cause, intervention, contexte) et 7 types de relations pondérées (`affects`, `indicates`, `resolves`, `causes`, `correlates_with`, `requires`, `preceded_by`), avec algorithmes de raisonnement par parcours de graphe et de prédiction de cascades de défaillances ;

4. Un **module décisionnel** configuré pour générer des signaux de commande destinés à modifier le fonctionnement d'au moins un équipement industriel, comprenant un moteur de politiques à 6 niveaux d'autonomie graduée (0-Monitoring à 5-Autonomie Complète), des actions ciblant les systèmes opérationnels (PLC, SCADA, DCS, ERP, GMAO), et un journal d'audit décisionnel complet ;

5. Un **module d'adaptation dynamique** modifiant la structure du modèle causal en fonction des résultats d'interventions techniques effectuées, par ajustement des poids de confiance des arêtes du graphe (+0.02/+0.03 en cas de succès, -0.05 en cas d'échec) et capitalisation dans une mémoire de pannes confirmées à compteur d'occurrences.

**Lesdits modules coopèrent afin :**

- **De limiter les dérives techniques** : par la détection continue des variations anormales et le déclenchement d'actions correctives avant que les paramètres physiques ne sortent de leurs plages de fonctionnement nominal ;

- **De réduire les défaillances en cascade** : par le raisonnement causal prédictif du graphe de connaissances qui traverse récursivement les arêtes `causes` pour identifier les effets en cascade avec probabilité cumulative, permettant des interventions préventives ciblées ;

- **De stabiliser le comportement opérationnel du parc industriel** : par la boucle fermée cognitive à 6 phases (Détection → Diagnostic → Décision → Action → Rétroaction → Apprentissage) qui assure l'amélioration continue du modèle causal et la convergence vers une supervision optimale.

---

## 5. DESCRIPTION DÉTAILLÉE DE L'INVENTION

### 5.1 Architecture Cognitive Formelle à 6 Couches

L'invention implémente une architecture en 6 couches, chacune avec des responsabilités, des contrats d'entrée/sortie, et des agents spécialisés :

#### Couche 1 : Physique (Physical Layer)
**Responsabilité** : Acquisition et normalisation des signaux capteurs
**Contrat d'entrée** : Signaux bruts (MQTT, Modbus, OPC-UA, LoRaWAN)
**Contrat de sortie** : `SensorSignal` — objet typé contenant :
- `signalId` : identifiant unique du signal
- `equipmentId` : identifiant de l'équipement source
- `sensorType` : type de mesure (température, vibration, pression, courant, débit, vitesse, humidité)
- `value` : valeur numérique mesurée
- `unit` : unité de mesure
- `timestamp` : horodatage précis
- `quality` : indicateur de qualité du signal (0-1)
- `source` : protocole d'acquisition (mqtt, modbus, opcua, lorawan, simulation)

#### Couche 2 : Intelligence de Bord (Edge Intelligence)
**Responsabilité** : Détection d'anomalies en temps réel, pré-filtrage
**Agent** : Equipment Agent (1 par machine)
**Contrat de sortie** : `AnomalyDetection` — objet typé contenant :
- `anomalyId` : identifiant unique
- `anomalyType` : classification (`threshold_breach`, `trend_deviation`, `pattern_anomaly`, `correlation_anomaly`)
- `severity` : niveaux formels (`low`, `medium`, `high`, `critical`)
- `confidence` : score de confiance (0-1)
- `description` : explication en langage naturel
- `rawData` : données brutes associées

**Mécanisme** : Comparaison en temps réel des signaux capteurs avec des seuils adaptatifs stockés dans la mémoire locale de l'agent. Les seuils sont de deux niveaux : `warning` et `critical`, spécifiques à chaque type de capteur et chaque équipement.

#### Couche 3 : Noyau Cognitif (Cognitive Core)
**Responsabilité** : Diagnostic, raisonnement causal, fusion multi-sources
**Contrat de sortie** : `CognitiveDiagnosis` — objet typé contenant :
- `diagnosisId` : identifiant unique
- `rootCause` : cause racine identifiée
- `rootCauseConfidence` : confiance dans l'identification de la cause racine (0-1)
- `contributingFactors` : facteurs contributifs identifiés
- `evidenceChain` : tableau d'`EvidenceItem`, chacun typé parmi 6 sources (`sensor_data`, `rule_match`, `historical_case`, `knowledge_graph`, `physics_model`, `agent_report`)
- `suggestedActions` : actions recommandées avec estimation de coût, durée, compétences requises
- `riskAssessment` : évaluation structurée du risque (probabilité de défaillance, temps estimé avant défaillance, impact financier, impact sécurité, impact environnemental)
- `knowledgeGraphPath` : chemin causal traversé dans le graphe de connaissances
- `physicsModelValidation` : validation par modèle physique (si applicable)
- `autonomyLevel` : niveau d'autonomie du système au moment du diagnostic

**Mécanisme de fusion multi-sources** : Le noyau cognitif combine les résultats de 4 sources indépendantes :

**Source 1 — Moteur de Règles Expertes** :
10 règles formalisées couvrant les défaillances industrielles courantes. Chaque règle est définie par :
- Patterns d'équipement (ex: `['moteur', 'pompe', 'compresseur']`)
- Patterns de symptômes (ex: `['surchauffe', 'température élevée', 'overheating']`)
- Logique conditionnelle (`all` ou `any`)
- Diagnostic, solution, étapes de réparation, avertissements de sécurité, outils nécessaires
- Score de confiance de base, ajusté par la couverture symptomatique : `confidence = base × (0.7 + 0.3 × symptomCoverage)`

**Source 2 — Analyse de Similarité Historique** :
Recherche dans une base de 120+ cas de maintenance réels avec 3 niveaux de matching :
- Matching exact : même type d'équipement ET mêmes symptômes (similarité = 1.0)
- Matching similaire : synonymes d'équipement ET mêmes symptômes (similarité = 0.8)
- Matching par symptômes : mêmes symptômes sur tout équipement (similarité = 0.6)
Les résultats sont classés par `confidence × similarity` et les 5 meilleurs sont retenus.

**Source 3 — Mémoire de Pannes Capitalisée** :
Base de données de pannes confirmées avec compteur d'occurrences. Chaque entrée contient une signature de symptômes, un diagnostic validé, et un compteur de confirmations. La confiance augmente avec le nombre de confirmations, créant un mécanisme d'apprentissage par renforcement.

**Source 4 — Structuration par Modèle de Langage** :
Un modèle de langage (Anthropic Claude) synthétise et structure les résultats des 3 autres sources en un diagnostic cohérent avec recommandations hiérarchisées.

#### Couche 4 : Orchestration et Exécution (Orchestration & Execution)
**Responsabilité** : Prise de décision, exécution d'actions, interface avec systèmes opérationnels
**Agent** : Site Agent (1 par site industriel)
**Contrat de sortie** : `OrchestratedAction` — objet typé contenant :
- `executionId` : identifiant unique d'exécution
- `targetSystem` : système cible (`plc`, `scada`, `dcs`, `erp`, `gmao`, `manual`)
- `command` : commande à exécuter
- `autonomyLevel` : niveau d'autonomie ayant autorisé l'exécution
- `approvalStatus` : statut d'approbation (`approved`, `rejected`, `escalated`, `deferred`, `auto-executed`)

**Moteur de Politiques** :
Ensemble de règles formelles évaluées automatiquement pour déterminer le traitement d'un diagnostic :
- Chaque politique contient des conditions (`PolicyCondition[]`) avec opérateurs (`eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `contains`, `in`)
- Les champs évaluables incluent : `risk.overallRisk`, `risk.failureProbability`, `risk.safetyImpact`, `confidence`, `autonomyLevel`, `anomalyCount`
- Chaque politique spécifie un `maxAutonomyLevel` au-delà duquel elle s'applique, et un flag `requiresApproval`
- Les politiques sont triées par priorité et la politique de plus haute priorité correspondante détermine le traitement

Exemples de politiques implémentées :
1. **Critical Safety Response** (priorité 100) : Escalade immédiate pour tout impact sécurité majeur ou catastrophique. Approbation obligatoire par `safety_officer`.
2. **Critical Equipment Failure Prevention** (priorité 90) : Création automatique d'un ordre de travail si risque critique ET confiance ≥ 80%.
3. **High Risk Maintenance Scheduling** (priorité 70) : Planification de maintenance préventive si risque élevé ET probabilité de défaillance > 50%.
4. **Medium Risk Enhanced Monitoring** (priorité 30) : Surveillance renforcée pour risques moyens.

#### Couche 5 : Apprentissage et Connaissances (Learning & Knowledge)
**Responsabilité** : Capitalisation des retours, mise à jour du graphe de connaissances, apprentissage fédéré
**Agent** : Global Agent (cross-sites)

**Graphe de Connaissances Industriel** :
Structure de graphe avec 5 types de nœuds et 7 types de relations :

*Types de nœuds :*
| Type | Description | Exemple | Propriétés |
|------|-------------|---------|------------|
| `equipment` | Type d'équipement industriel | "Moteur électrique", "Pompe industrielle" | — |
| `symptom` | Symptôme observable | "Vibration élevée", "Surchauffe" | `sensors[]` : capteurs associés |
| `cause` | Cause racine de défaillance | "Usure roulement", "Défaut lubrification" | `mtbf` : temps moyen entre pannes |
| `intervention` | Action corrective | "Remplacement roulement", "Réalignement" | `duration`, `cost` |
| `context` | Facteur environnemental | "Haute température ambiante", "Surcharge production" | — |

*Types de relations :*
| Relation | Sémantique | Exemple |
|----------|-----------|---------|
| `affects` | Un équipement est sujet à un symptôme | Moteur →(affects)→ Vibration élevée |
| `indicates` | Un symptôme indique une cause | Vibration élevée →(indicates, w=0.85)→ Usure roulement |
| `resolves` | Une intervention résout une cause | Usure roulement →(resolves, w=0.95)→ Remplacement roulement |
| `causes` | Une cause provoque une autre cause | Défaut lubrification →(causes, w=0.60)→ Usure roulement |
| `correlates_with` | Un contexte est corrélé à une cause | Maintenance retardée →(correlates_with, w=0.85)→ Défaut lubrification |
| `requires` | Une intervention nécessite une pièce | (extensible) |
| `preceded_by` | Relation temporelle entre événements | (extensible) |

*Algorithmes de raisonnement :*

1. **Raisonnement causal par parcours de graphe** (`findCausalPath`) : Pour un symptôme donné, traverse les arêtes `indicates` puis `resolves` pour produire des chemins Symptôme → Cause → Intervention avec une confiance cumulée (produit des poids d'arêtes).

2. **Prédiction de cascades de défaillances** (`findCascadeEffects`) : Pour une cause donnée, traverse récursivement les arêtes `causes` jusqu'à une profondeur configurable (par défaut 3). Calcule la probabilité cumulative de chaque effet en cascade (produit des poids).

3. **Raisonnement multi-symptômes** (`reasonFromSymptoms`) : Pour un ensemble de symptômes, agrège les causes candidates avec renforcement croisé : si deux symptômes différents pointent vers la même cause, la confiance est augmentée de 30% (plafonnée à 1.0).

4. **Identification de facteurs contextuels** (`findContextualFactors`) : Pour une cause identifiée, recherche les contextes corrélés via les arêtes `correlates_with`.

*Mécanisme d'apprentissage du graphe* (`learnFromIntervention`) :
Après chaque intervention, le graphe ajuste dynamiquement les poids de confiance de ses arêtes :
- Si l'intervention a réussi : poids de l'arête `indicates` augmenté de +0.02, poids de l'arête `resolves` augmenté de +0.03 (plafonné à 1.0)
- Si l'intervention a échoué : poids diminué de -0.05 (plancher à 0.1)
- Le compteur d'occurrences de chaque arête est incrémenté

Ce mécanisme crée un **apprentissage par renforcement structuré** où le graphe de connaissances devient progressivement plus fiable avec l'usage, sans nécessiter de ré-entraînement de modèle ML.

#### Couche 6 : Gouvernance et Confiance (Governance & Trust)
**Responsabilité** : Audit décisionnel, conformité, contrôle d'accès, gestion de la confiance

**Journal d'Audit Décisionnel** (`DecisionAuditEntry`) :
Chaque décision du système est enregistrée avec :
- Horodatage et identifiant unique
- Référence au diagnostic source
- Décision prise (`approved`, `rejected`, `escalated`, `deferred`, `auto-executed`)
- Niveau d'autonomie au moment de la décision
- Raison de la décision (politique appliquée)
- Résumé des évidences
- Niveau de risque
- Indicateur de surcharge humaine (`humanOverride`)
- Résultat de l'action (rétroaction)
- Identifiant du tenant (multi-tenant)

### 5.2 Noyau Cognitif et Système Multi-Agent

Le Cognitive Kernel est le composant central de l'invention. Il orchestre :

#### 5.2.1 Architecture multi-agent hiérarchique

| Niveau | Agent | Portée | Mémoire | Rôle |
|--------|-------|--------|---------|------|
| Local | Equipment Agent | 1 machine | `localMemory` (anomalies, historique d'actions) | Détection d'anomalies, perception locale |
| Site | Site Agent | 1 site industriel | Corrélation inter-équipements | Optimisation locale, coordination |
| Global | Global Agent | Tous les sites | `globalMemory` (graphe, apprentissage) | Apprentissage fédéré, patterns globaux |

#### 5.2.2 Communication inter-agents

Les agents communiquent via des messages typés (`AgentMessage`) avec :
- 9 types de messages : `sensor_update`, `anomaly_alert`, `diagnosis_request`, `diagnosis_result`, `action_command`, `feedback_report`, `knowledge_update`, `model_sync`, `heartbeat`
- 4 niveaux de priorité : `low`, `normal`, `high`, `critical`
- Mécanisme d'acquittement (`requiresAck`, `acknowledged`)
- Routage automatique vers la couche cognitive appropriée

Les messages de priorité `critical` sont traités immédiatement (bypass de la file d'attente).

#### 5.2.3 Boucle de traitement

Le Kernel exécute une boucle de traitement toutes les 5 secondes :
1. Traitement de 10 messages en attente
2. Détection d'agents inactifs (heartbeat > 60s → statut OFFLINE)
3. Mise à jour des métriques par couche

### 5.3 Boucle Fermée Cognitive

La méthode `processClosedLoop` implémente une boucle cognitive complète en 6 phases :

**Phase 1 — DÉTECTION** : L'Equipment Agent compare les signaux capteurs aux seuils stockés dans sa mémoire locale. Les anomalies sont classifiées par type et sévérité.

**Phase 2 — DIAGNOSTIC** : Le Noyau Cognitif fusionne les résultats des 4 sources de diagnostic (règles, historique, mémoire, IA) et interroge le Knowledge Graph pour tracer le chemin causal. La confiance est calculée comme la moyenne des confiances des anomalies, augmentée de 15% si le Knowledge Graph a trouvé un chemin.

**Phase 3 — DÉCISION** : Le moteur de politiques évalue les conditions du diagnostic et détermine le traitement. Trois issues possibles :
- `AUTO_EXECUTED` : Si le niveau d'autonomie du système ≥ SUPERVISED_EXECUTION ET la politique n'exige pas d'approbation
- `DEFERRED` : Si la politique exige une approbation humaine
- `APPROVED` : Tous les autres cas conformes à une politique

**Phase 4 — ACTION** : L'action recommandée est exécutée vers le système cible (GMAO, PLC, SCADA, etc.). L'action est enregistrée dans l'historique de l'Equipment Agent.

**Phase 5 — RÉTROACTION** : Un enregistrement d'audit (`DecisionAuditEntry`) est créé avec toutes les informations de traçabilité.

**Phase 6 — APPRENTISSAGE** : Les résultats de l'action sont capitalisés :
- Ajout à l'historique d'apprentissage global (`learningHistory`)
- Diffusion à tous les agents actifs via message `knowledge_update`
- Mise à jour des poids du Knowledge Graph si applicable

### 5.4 Modèles Physiques Hybrides

L'invention intègre 4 modèles thermodynamiques et mécaniques basés sur des équations physiques fondamentales :

#### 5.4.1 Modèle de Durée de Vie de Roulement (ISO 281)

**Base physique** : Norme ISO 281 pour le calcul de la durée de vie nominale des roulements
**Équation** :
```
AdjustedLife = BaseLife × TempFactor × VibrationFactor × SpeedFactor × LoadFactor
```
Où :
- `TempFactor = exp(-0.03 × (T - 70))` si T > 70°C, sinon 1.0
- `VibrationFactor = exp(-0.1 × (V - 4.5))` si V > 4.5 mm/s, sinon 1.0
- `SpeedFactor = 0.8` si vitesse > 3000 RPM, sinon 1.0
- `LoadFactor = exp(-0.02 × (L - 80))` si charge > 80%, sinon 1.0

**Sortie** : Pourcentage d'usure, durée de vie résiduelle (heures), et explication physique en langage naturel.

#### 5.4.2 Modèle de Cavitation de Pompe (Bernoulli)

**Base physique** : Théorème de Bernoulli et concept de NPSH (Net Positive Suction Head)
**Équation** :
```
VaporPressure = 0.023 × exp(0.0645 × T)
NPSHAvailable = InletPressure - VaporPressure
NPSHRequired = 2.0 + (FlowRate / 100) × 0.5
CavitationMargin = NPSHAvailable - NPSHRequired
```
**Sortie** : Risque de cavitation (0-1), marge NPSH, explication physique.

#### 5.4.3 Modèle de Dégradation Thermique Moteur (Arrhenius)

**Base physique** : Loi d'Arrhenius pour le vieillissement de l'isolation des bobinages
**Équation** :
```
ArrheniusFactor = exp(-0.1 × (WindingTemp - 105))
InsulationLife = BaseLife × LoadCorrection × ArrheniusFactor
InsulationWear = min(100, (OperatingHours / InsulationLife) × 100)
```
Où `LoadCorrection = (1/LoadRatio)²` si LoadRatio > 1.0

**Sortie** : Pourcentage d'usure de l'isolation, stress thermique, durée de vie résiduelle.

#### 5.4.4 Modèle de Performance Compresseur (Isentropique)

**Base physique** : Compression isentropique d'un gaz parfait
**Équation** :
```
CompressionRatio = OutletPressure / InletPressure
IdealOutletTemp = (InletTemp + 273.15) × (CompressionRatio)^((γ-1)/γ) - 273.15
IsentropicEfficiency = (IdealOutletTemp - InletTemp) / (ActualOutletTemp - InletTemp)
```
Avec γ = 1.4 (air)

**Sortie** : Efficacité isentropique, ratio de compression, déviation par rapport au comportement nominal.

#### 5.4.5 Sélection automatique de modèle

Le système sélectionne automatiquement le modèle physique approprié en fonction du type d'équipement :
- Équipement contenant "moteur" ou "motor" → Modèle Arrhenius
- Équipement contenant "pompe" ou "pump" → Modèle Bernoulli/Cavitation
- Équipement contenant "compresseur" ou "compressor" → Modèle Isentropique
- Tout équipement avec données vibration+température → Modèle ISO 281

---

## 6. REVENDICATIONS PRINCIPALES

### Revendication 1 — Système de supervision et contrôle adaptatif

Un système informatique de supervision et de contrôle adaptatif d'équipements industriels à modélisation causale dynamique, caractérisé en ce qu'il comprend :

a) une **interface matérielle de réception de signaux** issus de capteurs physiques vibratoires, thermiques, électriques, de pression, de débit, de vitesse et acoustiques, ladite interface recevant lesdits signaux via des protocoles industriels standards (MQTT, Modbus, OPC-UA, LoRaWAN) et produisant des signaux normalisés typés (`SensorSignal`) comprenant un identifiant d'équipement, un type de capteur, une valeur numérique, une unité de mesure, un horodatage, un indicateur de qualité et une source de protocole ;

b) un **module de détection de variations anormales de paramètres physiques**, configuré pour comparer en temps réel les signaux normalisés à des seuils adaptatifs à deux niveaux (warning, critical) spécifiques à chaque type de capteur et chaque équipement, et pour classifier les anomalies détectées par type (`threshold_breach`, `trend_deviation`, `pattern_anomaly`, `correlation_anomaly`) et par sévérité (`low`, `medium`, `high`, `critical`) ;

c) un **module de modélisation causale** structurant les relations entre paramètres mesurés et modes de défaillance mécaniques, sous forme d'un graphe de connaissances industriel comprenant 5 types de nœuds (équipement, symptôme, cause, intervention, contexte) et 7 types de relations pondérées (`affects`, `indicates`, `resolves`, `causes`, `correlates_with`, `requires`, `preceded_by`), ledit module comprenant :
   - un algorithme de raisonnement causal par parcours de graphe (`findCausalPath`) produisant des chemins Symptôme → Cause → Intervention avec confiance cumulée (produit des poids d'arêtes) ;
   - un algorithme de prédiction de cascades de défaillances (`findCascadeEffects`) par traversée récursive des arêtes `causes` jusqu'à une profondeur configurable avec calcul de probabilité cumulative ;
   - un algorithme de renforcement croisé multi-symptômes augmentant la confiance de 30% lorsque deux symptômes indépendants convergent vers la même cause ;

d) un **module décisionnel** configuré pour générer des signaux de commande destinés à modifier le fonctionnement d'au moins un équipement industriel, comprenant :
   - un moteur de politiques à 6 niveaux d'autonomie graduée (0: Monitoring, 1: Diagnostic Assisté, 2: Recommandation Automatique, 3: Exécution Supervisée, 4: Autonomie Partielle, 5: Autonomie Complète) ;
   - un mécanisme d'évaluation automatique de règles formelles avec conditions (champ, opérateur parmi 8 types, valeur), déterminant le traitement (auto-exécution, approbation requise, escalade) ;
   - des actions ciblant les systèmes opérationnels (`plc`, `scada`, `dcs`, `erp`, `gmao`, `manual`) via des commandes typées (`OrchestratedAction`) ;
   - un journal d'audit décisionnel complet enregistrant chaque décision avec horodatage, diagnostic source, niveau d'autonomie, raison, évidences, et indicateur de surcharge humaine ;

e) un **module d'adaptation dynamique** modifiant la structure du modèle causal en fonction des résultats d'interventions techniques effectuées, comprenant :
   - un ajustement des poids de confiance des arêtes du graphe de connaissances : +0.02 (arêtes `indicates`) et +0.03 (arêtes `resolves`) en cas de succès d'intervention, -0.05 en cas d'échec, les poids étant plafonnés dans l'intervalle [0.1, 1.0] ;
   - un compteur d'occurrences pour chaque arête, incrémenté à chaque intervention ;
   - une capitalisation dans une mémoire de pannes confirmées avec signature de symptômes, diagnostic validé, et compteur de confirmations dont la confiance augmente avec les confirmations ;
   - une diffusion des apprentissages à l'ensemble des agents actifs du système via messages typés `knowledge_update` ;

**lesdits modules coopérant afin :**

- **de limiter les dérives techniques** : par la détection continue des variations anormales de paramètres physiques et le déclenchement d'actions correctives avant que lesdits paramètres ne sortent de leurs plages de fonctionnement nominal ;

- **de réduire les défaillances en cascade** : par le raisonnement causal prédictif du module de modélisation causale qui identifie les effets en cascade avec probabilité cumulative, permettant des interventions préventives ciblées sur les causes racines avant propagation ;

- **de stabiliser le comportement opérationnel du parc industriel** : par la boucle fermée à 6 phases (Détection → Diagnostic → Décision → Action → Rétroaction → Apprentissage) qui assure l'amélioration continue du modèle causal et la convergence vers une supervision optimale.

### Revendication 2 — Diagnostic hybride explicable par fusion multi-sources

Système selon la revendication 1, caractérisé en ce que le module de modélisation causale comprend en outre un moteur de diagnostic hybride fusionnant 4 sources de connaissance indépendantes :
- un moteur de règles expertes formalisées, chaque règle comprenant des patterns d'équipement, des patterns de symptômes, une logique conditionnelle, et un score de confiance ajusté par la couverture symptomatique selon la formule `confidence = base × (0.7 + 0.3 × symptomCoverage)` ;
- une analyse de similarité historique recherchant dans une base de cas de maintenance réels avec scoring pondéré multi-critères (similarité textuelle 30%, correspondance de symptômes vérifiés 25%, correspondance d'équipement 25%, correspondance d'urgence 10%, base 10%) ;
- une interrogation d'une mémoire de pannes capitalisée avec compteur de confirmations et signature de symptômes, dont la confiance croît avec le nombre de confirmations terrain ;
- une structuration par un modèle de langage des résultats fusionnés des 3 sources précédentes ;

ledit moteur de diagnostic produisant pour chaque diagnostic une chaîne d'évidence (`EvidenceItem[]`) comprenant pour chaque élément un type source parmi 6 catégories (`sensor_data`, `rule_match`, `historical_case`, `knowledge_graph`, `physics_model`, `agent_report`), un score de confiance, et une description en langage naturel explicable.

### Revendication 3 — Modèles physiques hybrides à explication causale

Système selon la revendication 1, caractérisé en ce qu'il comprend en outre un ensemble de modèles physiques basés sur des équations fondamentales :
- un modèle de durée de vie de roulement basé sur la norme ISO 281 avec facteurs de correction température, vibration, vitesse et charge ;
- un modèle de cavitation de pompe basé sur le théorème de Bernoulli et le concept de NPSH (Net Positive Suction Head) ;
- un modèle de dégradation thermique moteur basé sur la loi d'Arrhenius pour le vieillissement de l'isolation des bobinages ;
- un modèle de performance compresseur basé sur la compression isentropique d'un gaz parfait ;
- un mécanisme de sélection automatique du modèle approprié en fonction du type d'équipement ;
- un paramétrage en temps réel desdits modèles par les données capteurs de l'interface de réception de signaux ;
- une génération automatique d'une explication physique causale en langage naturel détaillant les facteurs d'accélération de dégradation identifiés et leurs contributions quantifiées.

### Revendication 4 — Système multi-agent hiérarchique

Système selon la revendication 1, caractérisé en ce qu'il comprend un noyau cognitif orchestrant un système multi-agent hiérarchique comprenant :
- des agents de niveau équipement (un par machine), disposant d'une mémoire locale (`localMemory`) stockant les anomalies détectées et l'historique des actions ;
- des agents de niveau site (un par site industriel), assurant la coordination et l'optimisation locale ;
- un agent de niveau global (un pour l'ensemble du parc), assurant l'apprentissage fédéré et la diffusion des patterns globaux via une mémoire partagée (`globalMemory`) ;

lesdits agents communiquant via des messages typés avec 9 types de messages (`sensor_update`, `anomaly_alert`, `diagnosis_request`, `diagnosis_result`, `action_command`, `feedback_report`, `knowledge_update`, `model_sync`, `heartbeat`), 4 niveaux de priorité (`low`, `normal`, `high`, `critical`), et un mécanisme d'acquittement, les messages de priorité `critical` étant traités immédiatement en bypass de la file d'attente.

### Revendication 5 — Gouvernance et traçabilité décisionnelle

Système selon la revendication 1, caractérisé en ce que le module décisionnel comprend en outre :
- une politique de sécurité critique (priorité maximale) imposant une escalade immédiate avec approbation obligatoire pour tout impact sécurité majeur ou catastrophique, indépendamment du niveau d'autonomie du système ;
- un journal d'audit décisionnel enregistrant pour chaque décision l'horodatage, le diagnostic source, la décision prise (`approved`, `rejected`, `escalated`, `deferred`, `auto-executed`), le niveau d'autonomie, la politique appliquée, le résumé des évidences, le niveau de risque, et l'indicateur de surcharge humaine ;
- une traçabilité complète de chaque décision conforme aux exigences réglementaires industrielles (ISO 55000, CCTP).

---

## 7. REVENDICATIONS DÉPENDANTES

### 7.1 Dépendantes de la Revendication 1

**Revendication 6** : Système selon la revendication 1, caractérisé en ce que l'interface matérielle de réception de signaux (a) supporte au moins 5 protocoles d'acquisition (MQTT, Modbus, OPC-UA, LoRaWAN, simulation) et produit pour chaque signal un indicateur de qualité permettant au module de détection (b) de pondérer la fiabilité des anomalies détectées en fonction de la qualité des signaux sources.

**Revendication 7** : Système selon la revendication 1, caractérisé en ce que le module de modélisation causale (c) comprend des nœuds de type `cause` portant une propriété `mtbf` (temps moyen entre pannes) et des nœuds de type `intervention` portant des propriétés `duration` (durée estimée) et `cost` (coût estimé), permettant un calcul coût-bénéfice automatique des interventions recommandées.

**Revendication 8** : Système selon la revendication 1, caractérisé en ce que le module de modélisation causale (c) comprend un algorithme d'identification de facteurs contextuels aggravants (`findContextualFactors`) par recherche des arêtes `correlates_with` entrantes vers une cause identifiée, permettant d'enrichir le diagnostic avec des facteurs environnementaux (température ambiante, environnement poussiéreux, surcharge de production, maintenance retardée, instabilité électrique).

**Revendication 9** : Système selon la revendication 1, caractérisé en ce que le module d'adaptation dynamique (e) diffuse les apprentissages à l'ensemble des agents actifs du système via un mécanisme de communication inter-agents comprenant 9 types de messages typés, 4 niveaux de priorité, et un mécanisme d'acquittement, les messages de priorité critique étant traités immédiatement en bypass de la file d'attente.

### 7.2 Dépendantes de la Revendication 2

**Revendication 10** : Système selon la revendication 2, caractérisé en ce que le moteur de règles expertes comprend au moins 10 règles couvrant les défaillances industrielles courantes (surchauffe moteur, vibrations anormales, fuite hydraulique, bruit de roulement, défaut électrique, perte de débit pompe, défaut compresseur, défaut convoyeur, défaut réducteur, défaut automate), chaque règle comprenant des étapes de réparation, des avertissements de sécurité, et des outils nécessaires.

**Revendication 11** : Système selon la revendication 2, caractérisé en ce que les résultats des 4 sources sont fusionnés par un pipeline parallèle (`Promise.all`) suivi d'une déduplication par clé diagnostique, d'un classement par confiance, et d'un enrichissement contextuel par les signaux de l'équipement (criticité, état opérationnel, interventions récentes, compteurs de heures machine).

### 7.3 Dépendantes de la Revendication 3

**Revendication 12** : Système selon la revendication 3, caractérisé en ce que le modèle de dégradation thermique moteur utilise la loi d'Arrhenius avec un facteur de correction `ArrheniusFactor = exp(-0.1 × (WindingTemp - 105))` combiné à un facteur de correction de surcharge `LoadCorrection = (1/LoadRatio)²` pour LoadRatio > 1.0, et génère une explication quantifiant la contribution de chaque facteur de stress.

**Revendication 13** : Système selon la revendication 3, caractérisé en ce que le modèle de cavitation de pompe calcule la marge NPSH (Net Positive Suction Head) selon `NPSHAvailable = InletPressure - VaporPressure` et `NPSHRequired = 2.0 + (FlowRate / 100) × 0.5`, et génère un risque de cavitation quantifié avec explication physique.

### 7.4 Dépendantes de la Revendication 4

**Revendication 14** : Système selon la revendication 4, caractérisé en ce que les agents de niveau équipement disposent d'une mémoire locale (`localMemory`) stockant les anomalies détectées et l'historique des actions, et en ce que l'agent de niveau global maintient une mémoire partagée (`globalMemory`) contenant le graphe de connaissances et l'historique d'apprentissage, permettant un apprentissage fédéré cross-sites.

### 7.5 Dépendantes de la Revendication 5

**Revendication 15** : Système selon la revendication 5, caractérisé en ce que le journal d'audit décisionnel est structuré selon un format normalisé comprenant pour chaque entrée : un identifiant unique, un horodatage, la référence au diagnostic source, la décision prise parmi 5 options (`approved`, `rejected`, `escalated`, `deferred`, `auto-executed`), le niveau d'autonomie, la raison, le résumé des évidences, le niveau de risque, la politique appliquée, l'indicateur de surcharge humaine, le résultat d'action, et l'identifiant du tenant, assurant une conformité complète aux exigences de traçabilité industrielle (ISO 55000, CCTP).

---

## 8. FIGURES ET SCHÉMAS

### Figure 1 — Architecture Cognitive à 6 Couches

```
┌─────────────────────────────────────────────────────────────────┐
│                 COUCHE 6 : GOUVERNANCE & CONFIANCE              │
│  [Audit Décisionnel] [Conformité] [Contrôle d'Accès] [Trust]   │
├─────────────────────────────────────────────────────────────────┤
│              COUCHE 5 : APPRENTISSAGE & CONNAISSANCES           │
│  [Knowledge Graph Auto-Apprenant] [Mémoire de Pannes]          │
│  [Apprentissage Fédéré Cross-Sites] [Global Agent]             │
├─────────────────────────────────────────────────────────────────┤
│            COUCHE 4 : ORCHESTRATION & EXÉCUTION                 │
│  [Moteur de Politiques] [Autonomie Graduée 0-5]                │
│  [Actions GMAO/PLC/SCADA] [Site Agent]                         │
├─────────────────────────────────────────────────────────────────┤
│                COUCHE 3 : NOYAU COGNITIF                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  Règles  │ │Historique│ │ Mémoire  │ │    IA    │          │
│  │ Expertes │ │ Similarité│ │ Pannes  │ │ Structur.│          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │
│       └─────────────┴────────────┴─────────────┘                │
│                    FUSION + EXPLICABILITÉ                        │
│              [CognitiveDiagnosis + EvidenceChain]                │
├─────────────────────────────────────────────────────────────────┤
│              COUCHE 2 : INTELLIGENCE DE BORD                    │
│  [Equipment Agent ×N] [Détection Anomalies] [Seuils Adaptatifs]│
├─────────────────────────────────────────────────────────────────┤
│                  COUCHE 1 : PHYSIQUE                            │
│  [MQTT] [Modbus] [OPC-UA] [LoRaWAN] [→ SensorSignal]          │
└─────────────────────────────────────────────────────────────────┘
```

### Figure 2 — Boucle Fermée Cognitive

```
    ┌──────────┐
    │DÉTECTION │ ← Signaux capteurs
    └────┬─────┘
         ↓
    ┌──────────┐
    │DIAGNOSTIC│ ← Fusion 4 sources + Knowledge Graph
    └────┬─────┘
         ↓
    ┌──────────┐
    │ DÉCISION │ ← Moteur de politiques + Autonomie graduée
    └────┬─────┘
         ↓
    ┌──────────┐
    │  ACTION  │ → GMAO / PLC / SCADA / Manuel
    └────┬─────┘
         ↓
    ┌──────────┐
    │RÉTROACT. │ → Journal d'audit décisionnel
    └────┬─────┘
         ↓
    ┌──────────┐
    │APPRENTIS.│ → Mise à jour Knowledge Graph + Diffusion agents
    └────┬─────┘
         │
         └──────→ (retour DÉTECTION)
```

### Figure 3 — Graphe de Connaissances Industriel

```
  [Moteur]──affects──→[Vibration élevée]──indicates(0.85)──→[Usure roulement]
                       [Surchauffe]──indicates(0.80)──→[Défaut lubrification]
                                                            │
                                                     causes(0.60)
                                                            ↓
                                                      [Usure roulement]──resolves(0.95)──→[Remplacement roulement]
                                                            ↑
                             [Maintenance retardée]──correlates_with(0.85)──→[Défaut lubrification]
```

### Figure 4 — Système Multi-Agent Hiérarchique

```
                    ┌───────────────────┐
                    │   GLOBAL AGENT    │
                    │ (Cross-Sites)     │
                    │ Apprentissage     │
                    │ Fédéré            │
                    └────────┬──────────┘
                             │ knowledge_update
                    ┌────────┴──────────┐
                    │    SITE AGENT     │
                    │ (Par Site)        │
                    │ Coordination      │
                    │ Orchestration     │
                    └────────┬──────────┘
                             │ messages typés
              ┌──────────────┼──────────────┐
     ┌────────┴────┐  ┌─────┴──────┐  ┌────┴────────┐
     │ EQUIP. AGT  │  │ EQUIP. AGT │  │ EQUIP. AGT  │
     │ Machine 1   │  │ Machine 2  │  │ Machine N   │
     │ [localMem]  │  │ [localMem] │  │ [localMem]  │
     └─────────────┘  └────────────┘  └─────────────┘
```

---

## 9. EXEMPLES DE RÉALISATION

### Exemple 1 : Diagnostic d'une surchauffe moteur

**Situation** : Un moteur électrique (ID: EQ-001) présente une température de bobinage de 95°C (seuil critique: 90°C) et un courant de 110A (courant nominal: 100A).

**Phase 1 — Détection** :
L'Equipment Agent de EQ-001 détecte le dépassement de seuil et génère une anomalie :
```
AnomalyDetection {
  anomalyType: 'threshold_breach',
  severity: 'critical',
  confidence: 0.95,
  description: 'temperature critical threshold exceeded: 95°C (threshold: 90°C)'
}
```

**Phase 2 — Diagnostic** :
Le Noyau Cognitif fusionne 4 sources :
- Règle R001 "Surchauffe moteur" activée (confidence: 0.85)
- 3 cas historiques similaires trouvés (confidence moyenne: 0.78)
- 2 pannes confirmées en mémoire pour ce type d'équipement
- Knowledge Graph trace : Moteur → Surchauffe → Défaut lubrification → Relubrification

**Phase 3 — Décision** :
Politique "Critical Equipment Failure Prevention" évaluée : risque = critical, confiance = 0.88 ≥ 0.80 → AUTO_EXECUTED

**Phase 4 — Action** :
Création automatique d'un ordre de travail correctif dans la GMAO avec priorité critique.

**Phase 5 — Rétroaction** :
Entrée d'audit créée avec traçabilité complète.

**Phase 6 — Apprentissage** :
Après intervention réussie (relubrification), l'arête `Surchauffe →(indicates)→ Défaut lubrification` voit sa confiance augmentée de 0.80 à 0.82.

### Exemple 2 : Prédiction de durée de vie résiduelle

**Situation** : Roulement de pompe industrielle — température: 78°C, vibration: 5.2 mm/s, vitesse: 1500 RPM, charge: 85%, heures de fonctionnement: 12000h.

**Calcul modèle ISO 281** :
```
TempFactor = exp(-0.03 × (78 - 70)) = exp(-0.24) = 0.787
VibrationFactor = exp(-0.1 × (5.2 - 4.5)) = exp(-0.07) = 0.932
SpeedFactor = 1.0 (vitesse < 3000)
LoadFactor = exp(-0.02 × (85 - 80)) = exp(-0.10) = 0.905

AdjustedLife = 20000 × 0.787 × 0.932 × 1.0 × 0.905 = 13,266 heures
RemainingLife = 13,266 - 12,000 = 1,266 heures
WearPercentage = (12000 / 13266) × 100 = 90.5%
```

**Sortie** :
```
predictedBehavior: 'Imminent failure'
physicalExplanation: 'Bearing wear analysis: 90.5% of estimated life consumed.
  High temperature (78°C) accelerates degradation by 21%.
  Excessive vibration (5.2 mm/s) reduces bearing life by 7%.'
remainingUsefulLife: 1266 hours
```

### Exemple 3 : Détection de cascade de défaillances

**Situation** : Le Knowledge Graph détecte un "Défaut lubrification" sur un moteur.

**Parcours de cascade** (`findCascadeEffects`) :
```
Défaut lubrification →(causes, w=0.60)→ Usure roulement
  Usure roulement →(causes, w=0.40)→ Désalignement arbre
```

**Résultat** :
1. Usure roulement : probabilité 60% (niveau 1)
2. Désalignement arbre : probabilité 24% (niveau 2)

Le système recommande une intervention proactive sur la lubrification pour prévenir la cascade.

---

## 10. AVANTAGES DE L'INVENTION

### 10.1 Par rapport aux GMAO traditionnels
| Critère | GMAO Traditionnel | Maintrix |
|---------|-------------------|----------|
| Diagnostic | Manuel par technicien | Automatique multi-sources |
| Décision | Humaine uniquement | Graduée (0-5) avec politiques |
| Apprentissage | Aucun | Continu et structuré |
| Explicabilité | N/A | Chaîne d'évidence complète |
| Anticipation | Calendaire uniquement | Physique + données + règles |

### 10.2 Par rapport aux plateformes de maintenance prédictive
| Critère | Prédictif ML | Maintrix |
|---------|-------------|----------|
| Modèle | Boîte noire | Hybride explicable |
| Raisonnement | Statistique | Causal (Knowledge Graph) |
| Cascades | Non prédit | Prédit par parcours de graphe |
| Autonomie | Non graduée | 6 niveaux formels |
| Gouvernance | Limitée | Audit complet + politiques |

### 10.3 Par rapport aux jumeaux numériques
| Critère | Digital Twin | Maintrix |
|---------|-------------|----------|
| Modèle physique | Simulé | Physique + données réelles |
| Apprentissage terrain | Non | Oui (rétroaction d'intervention) |
| Multi-agent | Non | Hiérarchique (Equip/Site/Global) |
| Décision autonome | Non | Oui (moteur de politiques) |

### 10.4 Avantages opérationnels mesurables
- Réduction du temps de diagnostic de 60-80% (fusion automatique vs investigation manuelle)
- Capitalisation systématique du savoir-faire terrain (mémoire de pannes + Knowledge Graph)
- Conformité réglementaire intégrée (journal d'audit CCTP/ISO 55000)
- Réduction des pannes en cascade par anticipation causale
- Adaptation progressive aux particularités de chaque site (apprentissage local + fédéré)

---

## 11. APPLICATIONS INDUSTRIELLES

### 11.1 Secteurs cibles
- **Industrie manufacturière** : Lignes de production avec moteurs, pompes, compresseurs, convoyeurs
- **Industrie minière** : Équipements lourds en environnement hostile (broyeurs, concasseurs, convoyeurs)
- **Production d'énergie** : Turbines, générateurs, transformateurs, systèmes de refroidissement
- **Industrie agroalimentaire** : Chaînes de production avec exigences de traçabilité et conformité sanitaire
- **Infrastructure hydraulique** : Stations de pompage, réseaux de distribution

### 11.2 Marchés géographiques prioritaires
- Afrique subsaharienne et émergents : PME et ETI industrielles avec expertise technique limitée
- L'invention est particulièrement avantageuse dans des contextes où l'expertise technique est rare et coûteuse, car le Knowledge Graph et la mémoire de pannes capitalisent et redistribuent automatiquement le savoir-faire.

### 11.3 Modes de déploiement
- SaaS multi-tenant avec apprentissage fédéré cross-sites
- Déploiement on-premise pour industries sensibles (défense, nucléaire)
- Mode hybride edge/cloud pour sites à connectivité limitée

---

## 12. ABRÉGÉ

L'invention concerne un **système informatique de supervision et de contrôle adaptatif d'équipements industriels à modélisation causale dynamique**, comprenant :

(a) une interface matérielle de réception de signaux issus de capteurs physiques (vibratoires, thermiques, électriques, pression, débit, vitesse, acoustiques) via des protocoles industriels standards (MQTT, Modbus, OPC-UA, LoRaWAN) ;

(b) un module de détection de variations anormales de paramètres physiques par comparaison en temps réel à des seuils adaptatifs avec classification par type et sévérité ;

(c) un module de modélisation causale structurant les relations entre paramètres mesurés et modes de défaillance mécaniques sous forme d'un graphe de connaissances industriel avec raisonnement par parcours de graphe et prédiction de cascades de défaillances ;

(d) un module décisionnel configuré pour générer des signaux de commande destinés à modifier le fonctionnement d'au moins un équipement industriel, avec moteur de politiques à 6 niveaux d'autonomie graduée et journal d'audit décisionnel complet ;

(e) un module d'adaptation dynamique modifiant la structure du modèle causal en fonction des résultats d'interventions techniques effectuées, par ajustement des poids de confiance des arêtes du graphe et capitalisation dans une mémoire de pannes confirmées.

Lesdits modules coopèrent afin de limiter les dérives techniques, de réduire les défaillances en cascade par raisonnement causal prédictif, et de stabiliser le comportement opérationnel du parc industriel par une boucle fermée cognitive à 6 phases assurant l'amélioration continue du modèle causal.

**Classifications** : G06N 5/04, G06N 20/00, G05B 23/02, G06Q 10/20, G06F 16/36

**Mots-clés** : supervision adaptative, contrôle adaptatif industriel, modélisation causale dynamique, graphe de connaissances auto-apprenant, autonomie graduée, défaillances en cascade, modèles physiques hybrides, boucle fermée cognitive

---

*Document préparé pour soumission auprès de l'Office Européen des Brevets (OEB), l'Organisation Africaine de la Propriété Intellectuelle (OAPI), et/ou l'USPTO.*
*Ce document constitue une base technique. La rédaction juridique finale doit être réalisée par un conseil en propriété industrielle agréé.*

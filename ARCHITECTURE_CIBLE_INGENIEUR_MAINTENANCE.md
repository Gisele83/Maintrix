# ARCHITECTURE CIBLE MAINTRIX

## Du cerveau artificiel au cerveau d'ingénieur de maintenance

**Date : 20 Juillet 2026**
**Version : 1.0 — Document de vision cible (target architecture)**
**Statut : proposition validée par le porteur produit, en attente de priorisation**

> **Positionnement de ce document.** [ARCHITECTURE_GLOBALE_MAINTRIX.md](ARCHITECTURE_GLOBALE_MAINTRIX.md) décrit l'état réel du code aujourd'hui (audité le 19/07/2026). Ce document-ci décrit **où on veut aller** : un changement de philosophie qui repositionne Maintrix non plus comme un "moteur d'IA appliqué à la maintenance", mais comme une **plateforme d'ingénierie de maintenance** dans laquelle l'IA est un outil au service de la pratique métier — pas l'inverse. Chaque bloc ci-dessous indique son statut : **CONSERVÉ** (rien ne change), **A ENRICHIR** (une base existe dans le code, à étendre), ou **A CONSTRUIRE** (n'existe pas encore).

---

## PRINCIPE DIRECTEUR

> "Aujourd'hui, MAINTRIX est un cerveau artificiel. Il doit devenir un cerveau d'ingénieur de maintenance."

Un cerveau artificiel raisonne sur des règles et des modèles.
Un cerveau d'ingénieur de maintenance raisonne sur **l'expérience capitalisée d'un métier** : ses normes, ses procédures, ses REX, ses gestes techniques, sa documentation, ses non-conformités.

La refonte ajoute donc trois choses qui n'existaient pas dans la version précédente :
1. Une **couche verticale** supplémentaire qui capture le travail réel des techniciens (Maintenance Execution).
2. Une **dimension horizontale** qui remplace le socle GMAO étroit par une vraie plateforme d'ingénierie (Maintenance Engineering Platform).
3. Un **cycle de vie actif** (ISO 55000) qui relie tous les modules entre eux dans le temps.

---

## 1. LES 6 COUCHES COGNITIVES VERTICALES — CONSERVÉES

**Statut : CONSERVÉ.** Le modèle logique reste tel quel, jugé cohérent. Pour rappel (voir [ARCHITECTURE_GLOBALE_MAINTRIX.md](ARCHITECTURE_GLOBALE_MAINTRIX.md), section D.1), ces 6 couches ne sont **pas** 6 modules de code séparés aujourd'hui — elles restent un modèle de lecture fonctionnelle, centralisé dans `cognitive-kernel/` + `agents/`. Ce document ne change rien à ça.

```
Physique
   │
   ▼
Edge
   │
   ▼
Cognitive Core
   │
   ▼
Orchestration
   │
   ▼
Learning
   │
   ▼
Governance
```

**Ce qui change en revanche : une 7ᵉ couche verticale s'insère entre Physique et Cognitive Core.**

---

## 2. NOUVELLE COUCHE VERTICALE : MAINTENANCE EXECUTION

**Statut : A CONSTRUIRE.** C'est la couche manquante la plus importante du document — elle représente le travail réel du technicien, aujourd'hui totalement absent de l'architecture alors que c'est elle qui **génère la connaissance**.

```
COGNITIVE
   ▲
   │
MAINTENANCE EXECUTION
   ▲
   │
PHYSIQUE
```

Elle formalise le cycle d'intervention complet, étape par étape :

```
Réception
   │
   ▼
Inspection
   │
   ▼
Diagnostic
   │
   ▼
Réparation
   │
   ▼
Essais
   │
   ▼
Contrôle Qualité
   │
   ▼
Livraison
   │
   ▼
Retour d'expérience
```

**Point d'ancrage dans le code existant** : `work_orders` (39 colonnes) capture aujourd'hui un ordre de travail comme un bloc unique avec un statut global (`completed`/`in_progress`/`cancelled`), sans machine à états représentant les étapes internes de l'intervention. Il n'existe pas de table ni de concept "étape d'intervention". C'est un vrai chantier de modélisation :
- Nouvelle table `intervention_steps` (ou extension de `work_orders`) avec un statut par étape (réception → ... → REX), horodatage, technicien, photos, pièces jointes par étape.
- Chaque étape complétée devient un événement exploitable par le Knowledge Graph (section 5) et le Predictive Engine (section 8).
- Le "Contrôle Qualité" et la "Livraison" n'ont aujourd'hui aucun équivalent dans le schéma — à créer entièrement.

---

## 3. DIMENSION HORIZONTALE : MAINTENANCE ENGINEERING PLATFORM

**Statut : A ENRICHIR.** Remplace le "socle GMAO" (Équipements / OT / Stocks / Achats / Rapports) par une plateforme à 8 piliers. La GMAO ne disparaît pas — elle devient **un pilier parmi d'autres**, pas le socle unique.

```
                 MAINTENANCE ENGINEERING PLATFORM
────────────────────────────────────────────────────────
 Gestion des    │   GMAO   │   APM    │   SMM   │ Knowledge │ Digital │  IA  │ Analytics
   actifs       │          │          │         │    Hub    │  Twin   │      │
────────────────────────────────────────────────────────
```

| Pilier | Statut | Ancrage code existant |
|---|---|---|
| Gestion des actifs | A ENRICHIR | `equipment-registry`, `asset-lifecycle-routes.ts` (CRUD basique existant) — à étendre avec le cycle de vie ISO 55000 (section 12) |
| GMAO | CONSERVÉ | `gmao-routes.ts`, `gmao-storage.ts` — cœur existant, devient un pilier parmi d'autres plutôt que le socle |
| APM (Asset Performance Management) | A CONSTRUIRE | Rapproche `equipment-health-routes.ts`, `machine-health.tsx` (Health Score) et le futur Predictive Engine (section 8) — n'existe pas comme brique unifiée aujourd'hui |
| SMM (Système de Management de Maintenance) | A CONSTRUIRE | Aucun équivalent — voir section 4 |
| Knowledge Hub | A CONSTRUIRE | Aucun équivalent — voir section 6 |
| Digital Twin | A ENRICHIR | `physics-models.ts` existe mais isolé (accessible via une seule route dédiée, non rattaché à un équipement) — voir section 7 |
| IA | CONSERVÉ | `hybrid-diagnostic-pipeline.ts`, `anthropic-service.ts`, `knowledge-graph.ts` |
| Analytics | CONSERVÉ | KPIs, rapports, `advanced-reporting.tsx` |

---

## 4. SMM — SYSTÈME DE MANAGEMENT DE MAINTENANCE

**Statut : A CONSTRUIRE.** Bloc autonome, distinct de la GMAO. Alimente directement Learning, Knowledge Graph et IA.

```
Maintenance Management System
   │
   ├── Manuel Qualité
   ├── Manuel Maintenance
   ├── Procédures
   ├── Modes opératoires
   ├── Checklists
   ├── Instructions
   ├── Audits
   ├── Non-conformités
   ├── Amélioration continue
   └── Capitalisation
```

**Ancrage code existant** : rien de comparable aujourd'hui. `cctp-compliance-system.ts` couvre une partie de l'audit/conformité mais pour la traçabilité réglementaire CCTP, pas pour un référentiel qualité maintenance (manuels, procédures, checklists). Il faudrait :
- Un nouveau domaine de tables : `quality_manual_docs`, `maintenance_procedures`, `checklists`, `operating_instructions`, `audits`, `non_conformities`, `continuous_improvement_actions`.
- Un lien explicite `non_conformity → learning_metrics` et `procedure → knowledge_graph_node`, pour que chaque non-conformité et chaque procédure enrichisse effectivement la couche Learning et le Knowledge Graph (section 5), et non un simple espace documentaire statique.

---

## 5. KNOWLEDGE GRAPH — D'UN GRAPHE ABSTRAIT À UN GRAPHE MÉTIER

**Statut : A ENRICHIR EN PROFONDEUR.** C'est le changement de philosophie le plus radical du document, et probablement le vrai avantage concurrentiel de Maintrix.

**Aujourd'hui** (`server/cognitive-layers/knowledge-graph.ts`) : un graphe générique et statique — 8 types d'équipements, 12 symptômes, 13 causes, codé en dur, sans lien avec les données réelles de production (pas de technicien, pas de photo, pas d'OT réel).

**Cible** : un graphe métier qui capture la chaîne complète d'un incident réel, connectée aux vraies données transactionnelles :

```
Variateur
   │
   ▼
IGBT
   │
   ▼
Défaillance
   │
   ▼
Symptômes
   │
   ▼
Codes erreur
   │
   ▼
Mesures
   │
   ▼
Tests
   │
   ▼
Procédure
   │
   ▼
Réparation
   │
   ▼
Technicien
   │
   ▼
Temps
   │
   ▼
Photos
   │
   ▼
OT
   │
   ▼
Client
   │
   ▼
Usine
   │
   ▼
Retour d'expérience
```

**Ce que ça implique concrètement** : le graphe ne doit plus être un jeu de données seed statique en mémoire, mais un graphe **construit dynamiquement à partir des données réelles** — chaque nœud "Technicien", "OT", "Photo", "Client", "Usine" pointe vers un enregistrement réel en base (`users`, `work_orders`, pièces jointes, `tenants`). Chaque intervention terminée (section 2) devrait automatiquement créer/enrichir des arêtes du graphe. C'est un changement d'architecture de données, pas juste un enrichissement de contenu — le graphe devient une **vue dérivée** du reste du système plutôt qu'un module isolé.

---

## 6. ENGINEERING KNOWLEDGE HUB

**Statut : A CONSTRUIRE.** Nouvelle brique documentaire — le lieu où l'IA va chercher avant de répondre (RAG), plutôt que de répondre depuis son seul entraînement.

```
ENGINEERING KNOWLEDGE HUB

Schémas
Plans
Notices
Bulletins techniques
Photos
Vidéos
Normes (IEC, ISO)
Procédures SAEM
REX
```

**Ancrage code existant** : proche de rien. Le dossier `attached_assets/` existe mais sans structure de recherche. Il faudrait :
- Un stockage documentaire structuré (déjà présent partiellement via `@google-cloud/storage` et `@uppy/*` pour l'upload, mais pas de couche de recherche/indexation).
- Un moteur de recherche sémantique/vectoriel sur ce corpus (embeddings) — actuellement absent de tout le projet, y compris dans le pipeline diagnostic.
- Un point d'intégration explicite : avant que `hybrid-diagnostic-pipeline.ts` ou `anthropic-service.ts` n'appelle Claude, il devrait d'abord interroger ce hub et injecter le contexte documentaire pertinent dans le prompt.

---

## 7. DIGITAL TWIN — REPOSITIONNÉ COMME PROPRIÉTÉ DE L'ACTIF

**Statut : A ENRICHIR / REPOSITIONNER.** Le Digital Twin descend d'un niveau dans la hiérarchie conceptuelle : ce n'est plus une fonction de l'IA, c'est une **propriété de chaque équipement**.

**Avant** (implicite dans la doc précédente) : IA → modèle physique → diagnostic.
**Cible** :

```
Pompe
   │
   ▼
Digital Twin
   │
   ▼
IA
   │
   ▼
Diagnostic
```

**Ancrage code existant** : `physics-models.ts` contient déjà de vrais modèles physiques fonctionnels (ex. `ThermoMechanicalModel.predictBearingLife`, cavitation de pompe — voir audit précédent), mais il est aujourd'hui accessible uniquement via une route dédiée (`/api/cognitive/physics-model`), déconnecté du pipeline de diagnostic principal et sans notion d'instance par équipement. Pour atteindre la cible :
- Chaque enregistrement `equipment_registry` devrait porter une référence vers son "instance" de jumeau numérique (paramètres physiques calibrés pour CET équipement précis, pas un modèle générique par type).
- Le pipeline hybride de diagnostic devrait consulter le Digital Twin de l'équipement concerné **avant** ou **en complément** de l'appel à Claude, pas seulement sur une route séparée.

---

## 8. PREDICTIVE MAINTENANCE ENGINE — EXTRAIT COMME MODULE INDÉPENDANT

**Statut : A ENRICHIR / RESTRUCTURER.** Sort du Cognitive Kernel pour devenir un moteur autonome qui alimente la GMAO.

```
Predictive Maintenance Engine
   │
   ▼
Health Score
   │
   ▼
Remaining Useful Life
   │
   ▼
Anomaly Detection
   │
   ▼
Failure Prediction
   │
   ▼
Automatic Work Order
```

**Ancrage code existant** — les briques existent mais sont dispersées et inégalement matures :
- Health Score : `equipment-health-routes.ts`, page `machine-health.tsx` — **opérationnel**.
- Remaining Useful Life : `stochastic-rul.ts`, `stochastic-rul-routes.ts` — existe.
- Anomaly Detection : présente dans `equipment-agent.ts` (z-score, divergence de Jensen-Shannon) — **opérationnelle**.
- Failure Prediction : `predictive-engine.ts` — contient des sections avec `Math.random()` en placeholder (voir audit précédent), à finaliser.
- Automatic Work Order : `cognitive-kernel/index.ts::executeAction()` crée déjà de vrais ordres de travail — mais depuis le kernel générique, pas depuis un moteur prédictif dédié.

La cible consiste à **unifier ces 5 briques existantes en un seul module** avec un flux de données explicite (Health Score → RUL → Anomaly Detection → Failure Prediction → création automatique d'OT), plutôt que de les laisser dispersées entre `agents/`, `cognitive-kernel/` et des fichiers `*-routes.ts` indépendants.

---

## 9. ENGINEERING EXPERTISE — LA COUCHE LA PLUS IMPORTANTE

**Statut : A CONSTRUIRE (consolidation).** Selon le porteur produit, c'est la couche la plus stratégique : elle représente l'expérience des ingénieurs, **pas de l'IA**.

```
ENGINEERING EXPERTISE

Expert Rules
Fault Trees
FMEA
RCA
5 Why
Fishbone
RCM
AMDEC
IEC / ISO
Bonnes pratiques constructeur
```

**Ancrage code existant** — contrairement au Knowledge Hub, cette couche a déjà des fondations réelles, mais éparpillées comme de simples fonctionnalités GMAO plutôt que comme une couche à part entière :
- Expert Rules : `diagnostic-rules-engine.ts` — **opérationnel**, moteur de règles déterministe réel.
- FMEA : `fmea-routes.ts` — existe.
- RCA : `rca-routes.ts` — existe.
- 5 Why, Fishbone, RCM : pas d'équivalent identifié dans l'audit actuel — probablement à construire.
- AMDEC : mentionné dans la doc précédente comme alias FMEA côté francophone — même module.
- Normes IEC/ISO, bonnes pratiques constructeur : aucun stockage structuré — recoupe le Knowledge Hub (section 6) pour le contenu documentaire, mais doit rester distinct sur le plan conceptuel : le Knowledge Hub stocke des documents, l'Engineering Expertise **encode des méthodes de raisonnement**.

La transformation clé : sortir `diagnostic-rules-engine.ts`, `fmea-routes.ts`, `rca-routes.ts` de leur statut actuel de "fonctionnalités GMAO parmi d'autres" pour les regrouper explicitement sous une couche "Engineering Expertise" qui alimente le Cognitive Core — distincte de l'IA générative (Claude), qui elle reste dans la couche Cognitive Core au sens strict.

---

## 10. MULTI-AGENT — D'UNE HIÉRARCHIE TOPOLOGIQUE À UNE ÉQUIPE FONCTIONNELLE

**Statut : A ENRICHIR (extension majeure).**

**Aujourd'hui** (`server/agents/`) : 3 agents organisés par **portée géographique/topologique** — Equipment Agent (par machine), Site Agent (par site), Global Agent (multi-sites). C'est une architecture de *supervision*, pas une équipe de *métiers*.

**Cible** : une deuxième dimension d'agents organisés par **spécialité fonctionnelle**, à l'image d'une vraie équipe d'usine :

```
Diagnostic Agent
Planning Agent
Reliability Agent
QHSE Agent
Documentation Agent
Procurement Agent
Knowledge Agent
Digital Twin Agent
Training Agent
Customer Agent
Energy Agent
Supervisor Agent
```

**Comment les deux dimensions coexistent** : les agents topologiques existants (Equipment/Site/Global) restent l'infrastructure de *collecte et de remontée* d'information (ils tournent déjà en boucle réelle avec `setInterval`, voir audit). Les 12 agents fonctionnels proposés ici sont des agents *spécialistes* qui consomment cette remontée pour agir dans leur domaine — par exemple, le Diagnostic Agent s'appuierait sur le pipeline hybride existant, le Reliability Agent sur le futur Predictive Engine (section 8), le Documentation Agent sur le Knowledge Hub (section 6). Le **Supervisor Agent** serait l'évolution naturelle du rôle aujourd'hui tenu par `cognitive-kernel/index.ts` — un orchestrateur qui arbitre entre agents fonctionnels plutôt qu'un kernel monolithique.

C'est le chantier le plus vaste du document : chacun des 12 agents fonctionnels est aujourd'hui, au mieux, une fonctionnalité éparpillée (routes, services) sans autonomie ni boucle de décision propre.

---

## 11. INTÉGRATION TECHLEARN

**Statut : A CONSTRUIRE.** Nouveau pont entre deux produits — pas d'équivalent dans le code actuel.

```
Technicien ouvre un OT
        │
        ▼
MAINTRIX constate : intervention jamais réalisée
        │
        ▼
Bouton : "Former le technicien"
        │
        ▼
Ouverture automatique : TP TechLearn
        │
        ▼
Laboratoire virtuel
        │
        ▼
Quiz
        │
        ▼
Retour dans MAINTRIX
```

**Ce que ça demande concrètement** :
- Côté Maintrix : une table de compétences techniciens par type d'intervention (recoupe `maintenance_skills`, `user_skill_progress` — déjà existantes côté gamification, mais orientées progression/achievements, pas "jamais réalisé ce type d'intervention"). Il faut un croisement `technicien × type d'OT × historique` pour détecter l'absence d'expérience.
- Côté TechLearn : une API exposant les TP (travaux pratiques) par compétence/type d'équipement, et un moyen de renvoyer le résultat du quiz vers Maintrix.
- Un rattachement logique naturel : le **Training Agent** (section 10) serait le point d'orchestration de ce pont.

C'est probablement le module le plus rapide à cadrer (l'essentiel est côté intégration API, pas côté modélisation complexe), mais il dépend entièrement de ce que TechLearn expose déjà comme API — à vérifier séparément.

---

## 12. CYCLE DE VIE DE L'ACTIF (ISO 55000) — LA COLONNE VERTÉBRALE TEMPORELLE

**Statut : A CONSTRUIRE.** C'est la couche qui relie tout le reste dans le temps — sans elle, chaque module (GMAO, SMM, Digital Twin, agents, documentation, prédictif, dashboards) reste une île.

```
Acquisition
      │
Installation
      │
Mise en service
      │
Exploitation
      │
Surveillance
      │
Diagnostic
      │
Maintenance
      │
Réparation
      │
Essais
      │
Remise en service
      │
Amélioration
      │
Fin de vie / Remplacement
```

**Ancrage code existant** : `equipment_registry` existe avec un CRUD basique et `asset-lifecycle-routes.ts` / `asset-lifecycle.tsx` existent déjà (marqués **OPERATIONNEL** dans l'audit précédent) mais pour une gestion de cycle de vie simple, sans modéliser ces 12 états ISO 55000 ni les transitions entre eux. Construire cette couche revient à :
- Ajouter un champ d'état de cycle de vie sur `equipment_registry` avec une machine à états (transitions autorisées/interdites entre les 12 étapes).
- Faire de chaque étape un point d'ancrage pour les autres modules : "Diagnostic" et "Maintenance" se rattachent à Maintenance Execution (section 2) et à l'Engineering Expertise (section 9) ; "Surveillance" au Predictive Engine (section 8) ; chaque transition d'état génère un événement pour le Knowledge Graph (section 5).

---

## SCHÉMA GLOBAL ASSEMBLÉ

```
                                   ┌────────────────────────────┐
                                   │   ENGINEERING EXPERTISE     │
                                   │  (Expert Rules, FMEA, RCA,  │
                                   │   5 Why, Fishbone, RCM,     │
                                   │   normes, bonnes pratiques) │
                                   └──────────────┬─────────────┘
                                                  │ alimente
┌─────────────────────────────────────────────────────────────────────────┐
│                        6 COUCHES COGNITIVES (conservées)                 │
│   Physique → Edge → Cognitive Core → Orchestration → Learning →          │
│   Governance                                                             │
└───────────────────────────────┬───────────────────────────────────────┘
                                  │ nouvelle couche insérée entre Physique et Cognitive
                     ┌────────────▼─────────────┐
                     │   MAINTENANCE EXECUTION    │
                     │ Réception→Inspection→Diag- │
                     │ nostic→Réparation→Essais→  │
                     │ CQ→Livraison→REX           │
                     └────────────┬─────────────┘
                                  │ génère la connaissance
                     ┌────────────▼─────────────┐
                     │   KNOWLEDGE GRAPH MÉTIER   │
                     │ Équipement→Composant→Panne │
                     │ →Symptômes→Procédure→      │
                     │ Technicien→OT→Client→REX   │
                     └────────────┬─────────────┘
                                  │
      ┌───────────────┬──────────┴──────────┬───────────────┐
      ▼               ▼                     ▼               ▼
┌───────────┐  ┌──────────────┐   ┌──────────────────┐  ┌─────────┐
│    SMM     │  │  KNOWLEDGE   │   │  DIGITAL TWIN     │  │PREDICTIVE│
│ (Manuels,  │  │     HUB      │   │ (propriété de     │  │  ENGINE  │
│ procédures,│  │ (Schémas,    │   │  chaque actif)     │  │(HealthScore│
│ audits,    │  │  normes,     │   │                    │  │→RUL→Anomaly│
│ NC, REX)   │  │  REX docs)   │   │                    │  │→OT auto)  │
└───────────┘  └──────────────┘   └──────────────────┘  └─────────┘
      │               │                     │               │
      └───────────────┴──────────┬──────────┴───────────────┘
                                  ▼
                 ┌─────────────────────────────────────┐
                 │   MAINTENANCE ENGINEERING PLATFORM     │
                 │ Gestion actifs│GMAO│APM│SMM│Knowledge  │
                 │ Hub│Digital Twin│IA│Analytics          │
                 └────────────────────┬────────────────┘
                                       │ orchestrée par
                 ┌─────────────────────▼───────────────────┐
                 │         ÉQUIPE MULTI-AGENTS (12)          │
                 │ Diagnostic, Planning, Reliability, QHSE,  │
                 │ Documentation, Procurement, Knowledge,    │
                 │ Digital Twin, Training, Customer, Energy, │
                 │ Supervisor                                │
                 └─────────────────────┬───────────────────┘
                                       │ rattachée à
                 ┌─────────────────────▼───────────────────┐
                 │    CYCLE DE VIE ACTIF (ISO 55000)         │
                 │ Acquisition→...→Exploitation→Surveillance │
                 │ →Diagnostic→Maintenance→...→Fin de vie    │
                 └───────────────────────────────────────┘

     Pont transverse : TechLearn (Training Agent) ⇄ OT sans compétence détectée
```

---

## SYNTHÈSE DES STATUTS

| Bloc | Statut | Effort relatif |
|---|---|---|
| 6 couches cognitives | CONSERVÉ | — |
| Maintenance Execution (couche) | A CONSTRUIRE | Élevé — nouvelle modélisation transactionnelle |
| Maintenance Engineering Platform (dimension horizontale) | A ENRICHIR | Moyen — recomposition de l'existant + 3 piliers neufs (APM, SMM, Knowledge Hub) |
| SMM | A CONSTRUIRE | Élevé — nouveau domaine de données complet |
| Knowledge Graph métier | A ENRICHIR EN PROFONDEUR | Élevé — changement d'architecture de données (graphe statique → graphe dérivé du réel) |
| Engineering Knowledge Hub | A CONSTRUIRE | Élevé — nécessite recherche sémantique/vectorielle, absente du projet |
| Digital Twin (repositionné) | A ENRICHIR | Moyen — modèles physiques déjà réels, à rattacher par instance d'équipement |
| Predictive Maintenance Engine | A ENRICHIR / RESTRUCTURER | Moyen — briques existantes à unifier, une seule (predictive-engine.ts) a du code placeholder |
| Engineering Expertise | A CONSTRUIRE (consolidation) | Moyen — 3 des 6 sous-modules existent déjà, à regrouper |
| Multi-Agent (12 agents fonctionnels) | A ENRICHIR (extension majeure) | Très élevé — le plus gros chantier du document |
| Intégration TechLearn | A CONSTRUIRE | Faible à moyen — dépend de l'API TechLearn existante |
| Cycle de vie actif ISO 55000 | A CONSTRUIRE | Élevé — colonne vertébrale transverse, touche tous les autres modules |

---

## PROCHAINES ÉTAPES PROPOSÉES

Ce document capture la vision cible mais ne priorise pas encore l'ordre de construction. Trois questions restent ouvertes pour la suite :

1. **Priorisation** — parmi les 12 blocs, lesquels sont les plus urgents pour un prochain jalon (MVP investisseur, pilote client, certification) ?
2. **Périmètre de premier chantier** — la Maintenance Execution (section 2) et le Knowledge Graph métier (section 5) sont interdépendants (l'un génère les données de l'autre) : il est probable qu'ils doivent être construits ensemble en premier.
3. **Modélisation de données détaillée** — plusieurs blocs (SMM, cycle de vie ISO 55000, Maintenance Execution) nécessitent un nouveau schéma Drizzle avant tout développement applicatif.

*Document à mettre à jour à chaque décision de priorisation ou de cadrage détaillé d'un bloc.*

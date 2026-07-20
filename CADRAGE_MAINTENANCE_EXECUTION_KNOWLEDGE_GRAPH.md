# CADRAGE DÉTAILLÉ — MAINTENANCE EXECUTION & KNOWLEDGE GRAPH MÉTIER

**Date : 20 Juillet 2026**
**Statut : proposition de modélisation, pas encore implémentée**

> Ce document approfondit les sections 2 et 5 de [ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md](ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md), désignées comme premier chantier prioritaire. Il propose un schéma de données concret (style Drizzle, cohérent avec `shared/schema.ts`), une machine à états, et surtout **le mécanisme de pont** entre les deux : comment une intervention terminée nourrit automatiquement le graphe métier. Rien n'est encore écrit dans `shared/schema.ts` — c'est une proposition à valider avant implémentation (voir section finale).

---

## POURQUOI CES DEUX CHANTIERS ENSEMBLE

Le Knowledge Graph métier cible (section 5 du document de vision) a besoin de données réelles — techniciens, photos, mesures, procédures effectivement utilisées — pour devenir autre chose qu'un graphe statique. Ces données n'existent nulle part aujourd'hui sous une forme exploitable : `work_orders` capture un OT comme un bloc unique (statut global `completed`/`in_progress`/`cancelled`), sans détail des étapes internes.

**Principe directeur : la Maintenance Execution est la source, le Knowledge Graph est la destination.** Chaque étape d'intervention terminée devient un fait qui enrichit le graphe. Sans la première, la seconde reste un jeu de données seed.

---

## PARTIE 1 — MAINTENANCE EXECUTION

### 1.1 Machine à états

Le cycle défini dans le document de vision (Réception → Inspection → Diagnostic → Réparation → Essais → Contrôle Qualité → Livraison → REX) n'est pas strictement linéaire dans la réalité d'un atelier : un contrôle qualité peut échouer et renvoyer vers la réparation, une inspection peut révéler qu'aucune réparation n'est nécessaire (retour direct), etc.

```
RECEPTION ──▶ INSPECTION ──▶ DIAGNOSTIC ──▶ REPARATION ──▶ ESSAIS ──▶ CONTROLE_QUALITE
                   │                                                        │  │
                   │ (pas de défaut trouvé)                    (échec) ◀────┘  │ (succès)
                   ▼                                              │            ▼
                LIVRAISON ◀─────────────────────────────────── REPARATION   LIVRAISON
                   │                                                            │
                   ▼                                                            ▼
                  REX ◀────────────────────────────────────────────────────── REX
```

Statuts possibles par étape : `pending` (pas commencée), `in_progress`, `completed`, `rejected` (échec → boucle arrière), `skipped` (étape non nécessaire, ex. inspection sans réparation).

### 1.2 Schéma de données proposé

```typescript
// ── Exécution d'intervention (1 par work order) ──────────────────────────
export const interventionExecutions = pgTable("intervention_executions", {
  id: serial("id").primaryKey(),
  workOrderId: integer("work_order_id").notNull().references(() => workOrders.id),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  equipmentId: integer("equipment_id").notNull().references(() => equipmentRegistry.id),
  currentStep: varchar("current_step", { length: 30 }).notNull().default("reception"),
  // reception | inspection | diagnostic | reparation | essais | controle_qualite | livraison | rex | terminee
  overallStatus: varchar("overall_status", { length: 20 }).notNull().default("in_progress"),
  // in_progress | completed | on_hold
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Étapes individuelles (N par exécution) ────────────────────────────────
export const interventionSteps = pgTable("intervention_steps", {
  id: serial("id").primaryKey(),
  executionId: integer("execution_id").notNull().references(() => interventionExecutions.id),
  stepType: varchar("step_type", { length: 30 }).notNull(),
  // reception | inspection | diagnostic | reparation | essais | controle_qualite | livraison | rex
  sequenceOrder: integer("sequence_order").notNull(), // ordre réel d'exécution (permet les boucles arrière)
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  // pending | in_progress | completed | rejected | skipped
  technicianId: integer("technician_id").references(() => users.id),
  diagnosticSessionId: integer("diagnostic_session_id").references(() => diagnosticSessions.id), // lien natif à l'étape "diagnostic"
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  durationMinutes: integer("duration_minutes"),
  notes: text("notes"),
  structuredData: jsonb("structured_data"), // voir 1.3 — contenu spécifique par type d'étape
  rejectionReason: text("rejection_reason"), // si status = rejected
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── Pièces jointes par étape (photos, vidéos, documents) ──────────────────
export const interventionAttachments = pgTable("intervention_attachments", {
  id: serial("id").primaryKey(),
  stepId: integer("step_id").notNull().references(() => interventionSteps.id),
  type: varchar("type", { length: 20 }).notNull(), // photo | video | document
  url: text("url").notNull(),
  caption: text("caption"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Mesures structurées (Essais, Diagnostic) ───────────────────────────────
export const interventionMeasurements = pgTable("intervention_measurements", {
  id: serial("id").primaryKey(),
  stepId: integer("step_id").notNull().references(() => interventionSteps.id),
  measurementType: varchar("measurement_type", { length: 50 }).notNull(), // vibration | temperature | pression | courant...
  value: doublePrecision("value").notNull(),
  unit: varchar("unit", { length: 20 }),
  expectedMin: doublePrecision("expected_min"),
  expectedMax: doublePrecision("expected_max"),
  withinTolerance: boolean("within_tolerance"),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**`structuredData` par type d'étape** (jsonb, volontairement flexible plutôt que des colonnes dédiées par étape, pour éviter d'exploser le nombre de tables) :

| Étape | Contenu type de `structuredData` |
|---|---|
| Réception | `{ etatApparent, accessoiresRecus, plaintClient }` |
| Inspection | `{ checklistId, resultats: [{item, ok, commentaire}] }` |
| Diagnostic | (renvoie vers `diagnosticSessionId` — pas de duplication, le pipeline existant reste la source) |
| Réparation | `{ piecesRemplacees: [{sparePartId, quantite}], procedureUtilisee: string }` |
| Essais | (renvoie vers `intervention_measurements`) |
| Contrôle Qualité | `{ inspecteurId, criteres: [{critere, conforme}], verdict: "pass"\|"fail" }` |
| Livraison | `{ signatureClient, dateLivraison, modeLivraison }` |
| REX | `{ causeRacine, lecons, ameliorationsProposees, tempsReelVsEstime }` |

### 1.3 Intégration avec l'existant

- `work_orders` reste la table maître de l'ordre de travail (planification, coûts, assignation) — `intervention_executions` s'y **rattache** sans la remplacer.
- L'étape "Diagnostic" ne duplique pas `diagnostic_sessions` — elle pointe dessus (`diagnosticSessionId`). Le pipeline hybride existant (`hybrid-diagnostic-pipeline.ts`) continue de fonctionner tel quel ; seule la création de l'étape "diagnostic" en base change.
- Aucune table existante n'est modifiée — c'est une extension additive, donc sans risque de régression sur le code GMAO actuel.

---

## PARTIE 2 — KNOWLEDGE GRAPH MÉTIER

### 2.1 Pourquoi un modèle générique nœuds/arêtes plutôt que 15 tables spécifiques

Le graphe cible (`Variateur → IGBT → Défaillance → Symptômes → ... → REX`) mélange des entités très différentes : certaines existent déjà en base (équipement, technicien, OT, client), d'autres sont conceptuelles (panne, procédure). Plutôt que créer une table par type de nœud, on modélise un graphe générique — **cohérent avec le stack actuel (PostgreSQL/Drizzle, pas de base graphe dédiée)** — où chaque nœud référence, quand c'est possible, un enregistrement réel via une clé polymorphe.

```typescript
export const kgNodes = pgTable("kg_nodes", {
  id: serial("id").primaryKey(),
  nodeType: varchar("node_type", { length: 30 }).notNull(),
  // equipment | component | failure_mode | symptom | error_code | measurement_type |
  // test_type | procedure | technician | work_order | photo | client | plant | lesson_learned
  refTable: varchar("ref_table", { length: 50 }), // nullable — ex: "equipment_registry", "users", "work_orders"
  refId: varchar("ref_id", { length: 50 }),        // nullable — id réel dans refTable
  label: text("label").notNull(),                  // libellé affichable
  metadata: jsonb("metadata"),                      // attributs libres
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const kgEdges = pgTable("kg_edges", {
  id: serial("id").primaryKey(),
  fromNodeId: integer("from_node_id").notNull().references(() => kgNodes.id),
  toNodeId: integer("to_node_id").notNull().references(() => kgNodes.id),
  relationType: varchar("relation_type", { length: 40 }).notNull(),
  // has_component | causes | exhibits_symptom | has_error_code | measured_by | tested_by |
  // resolved_by_procedure | repaired_by | performed_by | took_time | documented_by_photo |
  // part_of_work_order | belongs_to_client | located_at_plant | generated_lesson
  weight: doublePrecision("weight").notNull().default(1.0), // renforcement — voir 2.3
  occurrenceCount: integer("occurrence_count").notNull().default(1),
  lastReinforcedAt: timestamp("last_reinforced_at").defaultNow(),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow(),
});
```

Deux nœuds + une arête suffisent à représenter n'importe quel maillon de la chaîne cible :
`(Variateur:equipment) --[has_component]--> (IGBT:component) --[causes]--> (Défaillance:failure_mode) --[exhibits_symptom]--> (Symptôme) ...`

### 2.2 Ce que ça change par rapport à l'existant

`server/cognitive-layers/knowledge-graph.ts` (classe `IndustrialKnowledgeGraph`) garde son **API publique** (`reasonFromSymptoms`, `findCausalPath`, `findCascadeEffects`, `learnFromIntervention`) — le code qui l'appelle ailleurs (routes cognitives, pipeline diagnostic) n'a pas besoin de changer. Ce qui change, c'est sa **source de données interne** : au lieu des tableaux codés en dur (8 équipements, 12 symptômes, 13 causes), ces méthodes interrogent `kg_nodes`/`kg_edges`. Migration en deux temps possible :
1. Court terme : les données seed actuelles sont insérées comme lignes réelles dans `kg_nodes`/`kg_edges` (migration de données, pas de perte).
2. Continu : chaque intervention terminée (Partie 1) ajoute/renforce des nœuds et arêtes réels — le graphe grossit avec l'usage au lieu de rester figé.

### 2.3 Renforcement (déjà présent dans le code, à généraliser)

`learnFromIntervention()` existe déjà et ajuste des poids — c'est exactement le rôle de `weight`/`occurrenceCount` sur `kg_edges`. La généralisation consiste à appeler cette logique de renforcement automatiquement depuis le pont décrit ci-dessous, plutôt que ponctuellement.

---

## PARTIE 3 — LE PONT : DE L'INTERVENTION AU GRAPHE

C'est la pièce manquante qui transforme les deux modèles ci-dessus en système vivant plutôt qu'en deux silos.

**Déclencheur** : à chaque `interventionStep` qui passe à `status = "completed"`, un service (`kg-sync-service.ts`, à créer) exécute une résolution selon le type d'étape :

| Étape complétée | Nœuds créés/résolus | Arêtes créées/renforcées |
|---|---|---|
| Diagnostic | `equipment`, `failure_mode` (depuis le diagnostic), `symptom` (depuis les symptômes saisis) | `equipment --has_component-->` (si composant identifié), `--causes-->` vers `failure_mode`, `--exhibits_symptom-->` |
| Réparation | `procedure` (depuis `structuredData.procedureUtilisee`), `technician` | `failure_mode --resolved_by_procedure-->`, `procedure --repaired_by--> technician` |
| Essais | `measurement_type` (par mesure dans `intervention_measurements`) | `procedure --tested_by--> measurement_type` |
| Livraison | `work_order`, `client` (depuis le tenant/OT) | `procedure --part_of_work_order-->`, `--belongs_to_client-->` |
| REX | `lesson_learned` (depuis `structuredData.lecons`) | `failure_mode --generated_lesson-->` |
| Toute étape avec pièce jointe | `photo` | `<step> --documented_by_photo-->` |

Chaque résolution suit la même règle : **si un nœud équivalent existe déjà** (même `refTable`/`refId`, ou même libellé normalisé pour les nœuds conceptuels comme `failure_mode`), on **renforce** l'arête existante (`occurrenceCount += 1`, `weight` ajusté à la hausse) plutôt que d'en créer une nouvelle — c'est ce qui fait du graphe une mémoire technique qui apprend, pas un simple journal d'événements.

---

## CE QUE CE CADRAGE NE COUVRE PAS ENCORE

- L'algorithme exact de renforcement du poids (`learnFromIntervention` actuel a sa propre formule — à vérifier si elle s'applique telle quelle au modèle générique nœuds/arêtes ou si elle doit être adaptée).
- La normalisation des libellés de nœuds conceptuels (comment décider que deux `failure_mode` saisis différemment désignent la même panne réelle — nécessaire pour que le renforcement fonctionne correctement plutôt que de créer des doublons).
- L'UI de consultation du graphe (le document de vision ne le précise pas).
- Le dimensionnement de performance (un graphe qui grossit avec chaque intervention réelle a un profil de requête différent d'un graphe statique de 48 nœuds — à surveiller si le volume d'interventions est important).

---

## PROCHAINE DÉCISION

Ce document propose un schéma concret mais **rien n'est encore écrit dans `shared/schema.ts`**, et aucune migration n'a été générée. Avant d'aller plus loin, il faut trancher :

1. Le schéma proposé (5 nouvelles tables : `intervention_executions`, `intervention_steps`, `intervention_attachments`, `intervention_measurements`, `kg_nodes`, `kg_edges` — en fait 6) te convient-il, ou souhaites-tu des ajustements avant que je l'écrive réellement dans le schéma partagé ?
2. Veux-tu que j'écrive ces tables dans `shared/schema.ts` et génère la migration correspondante maintenant, ou préfères-tu d'abord valider ce cadrage sans toucher au code ?

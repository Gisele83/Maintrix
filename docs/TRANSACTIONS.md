# Intégrité transactionnelle — Maintrix

État des opérations multi-étapes et règle à appliquer pour les nouvelles.

## Constat de départ (F04)

Sur **186 écritures** (`db.insert` 121, `db.update` 48, `db.delete` 17) réparties
dans `server/`, **2 transactions** existaient
(`server/storage.ts:539`, `server/tenant-routes.ts:247`).

Un balayage des handlers de route a isolé les opérations écrivant à deux endroits
ou plus **sans** transaction. Cinq ont été corrigées, choisies non pas sur le
nombre d'écritures mais sur la **gravité d'un échec partiel**.

## Opérations rendues atomiques

| Opération | Écritures | Conséquence d'un échec partiel, avant F04 |
|---|---|---|
| `POST /api/super-admin/tenants` | tenant + administrateur + licence + historique | **Tenant sans administrateur : inutilisable et non rattrapable.** Personne ne peut s'y connecter, et recréer bute sur l'unicité du nom et du domaine déjà pris |
| `POST /api/budgets/:id/transactions` | mouvement + imputation sur les totaux | **Dépense enregistrée mais jamais imputée.** Le budget sous-estime durablement les dépenses, sans erreur ni réconciliation |
| `POST /api/interventions` | exécution + première étape | **Exécution sans étape** : le workflow n'a aucun point d'entrée, l'ordre de travail est bloqué |
| `POST /api/interventions/:id/steps/:stepId/complete` | étape + exécution + non-conformité | Workflow figé sur l'étape précédente ; contrôle qualité rejeté **sans non-conformité enregistrée** (perte de traçabilité) |
| `initializeModuleCatalog()` | purge complète + réinsertion | **Catalogue vide ou partiel** — et il s'exécute à chaque démarrage. Le contrôle d'accès aux modules de toute la plateforme en dépend |

## Deux styles, deux mécanismes

Le code mélange deux accès à la base ; la transaction ne s'écrit pas pareil.

**Drizzle** — la majorité du code :

```ts
const result = await db.transaction(async (tx) => {
  const [a] = await tx.insert(tableA).values({ ... }).returning();
  const [b] = await tx.insert(tableB).values({ aId: a.id }).returning();
  return { a, b };
});
```

⚠️ Toutes les écritures doivent passer par `tx`. Un `db.` oublié à l'intérieur
du bloc s'exécute **hors transaction** et ne sera pas annulé — l'erreur la plus
facile à commettre, et la plus silencieuse.

**`pg.Pool` brut** — `budget-routes.ts`, `rca-routes.ts`, `oee-routes.ts` et les
autres fichiers en SQL direct :

```ts
const client = await getPool().connect();
try {
  await client.query("BEGIN");
  // … toutes les requêtes sur `client`, jamais sur le pool …
  await client.query("COMMIT");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  throw e;
} finally {
  client.release();   // sans ce finally, le pool se vide et l'app se fige
}
```

## Ce qui reste HORS transaction, volontairement

Une transaction ne doit contenir que des écritures en base. Sont exclus :

- **Envoi d'e-mail** (création de tenant) — effet externe irréversible ; son
  échec ne doit pas annuler un tenant valide.
- **Synchronisation du graphe de connaissances** (complétion d'étape) — autre
  magasin, non transactionnel. Exécutée après le commit, dans un try/catch qui
  journalise sans invalider l'intervention.

Règle générale : **rien de lent ni de distant dans une transaction.** Un appel
réseau à l'intérieur d'un `BEGIN` tient un verrou pendant toute sa durée.

## Concurrence

`POST /api/budgets/:id/transactions` verrouille la ligne de budget
(`SELECT … FOR UPDATE`) jusqu'au commit. L'`UPDATE … total_spent = total_spent + $1`
est déjà atomique au niveau SQL, donc le verrou n'est pas ce qui empêche la perte
d'écriture ici ; il sérialise les dépenses concurrentes sur un même budget et
protège les évolutions futures qui liraient la valeur avant de l'écrire.
Vérifié par un test : 10 dépenses simultanées, total exact.

## Règle pour les nouvelles opérations

> Si un handler écrit dans **plus d'une table**, ou fait plus d'une écriture qui
> doivent être vraies ensemble, il **doit** être transactionnel.

Deux questions avant de s'en dispenser :

1. *Que voit l'utilisateur si la seconde écriture échoue ?* Si la réponse est
   « un état incohérent qu'il ne peut pas corriger lui-même », la transaction
   est obligatoire.
2. *Est-ce détectable ?* Un écart silencieux (budget sous-évalué) est plus grave
   qu'un échec visible.

## Vérification

```bash
npm test -- --testPathPatterns=transaction-integrity
```

[tests/integration/transaction-integrity.test.ts](../tests/integration/transaction-integrity.test.ts)
injecte les pannes avec un **trigger PostgreSQL** qui fait échouer une écriture
précise — aucun crochet de test dans le code applicatif. Chaque scénario vérifie
d'abord le **chemin nominal**, sans quoi un test pourrait « passer » parce que
l'opération échoue en amont sans jamais atteindre l'écriture ciblée.

## Non traité

Opérations multi-étapes repérées mais **laissées en l'état**, l'échec partiel
n'y produisant pas d'incohérence exploitable :

- `deleteMaintenanceCounter()` — supprime l'historique puis le compteur. Un
  échec laisse un compteur sans historique : dégradé, pas incohérent.
- `checkAndGenerateCounterAlert()` — deux mises à jour indépendantes.
- `updateLearningMetrics()` / `updateAdaptiveLearning()` — update-ou-insert
  exclusifs, jamais les deux.
- `seedDatabase()`, `seedPredictiveInsightsDemoData()` — scripts de données de
  démonstration, rejouables.

Les fichiers en SQL direct (`rca-routes.ts`, `oee-routes.ts`, `budget-routes.ts`
hors transactions) contiennent des handlers à écriture unique : atomiques par
construction.

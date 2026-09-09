# Tests Maintrix

Aucune connaissance préalable du projet n'est nécessaire pour lancer les tests.

## Lancer

```bash
npm install
npm test
```

C'est tout. Il n'y a **rien à préparer** : pas de base à créer, pas de serveur à
démarrer dans un autre terminal, pas de compte à créer à la main.

| Commande | Ce qu'elle fait | Durée | Prérequis |
|---|---|---|---|
| `npm test` | Tout : unitaires + intégration | ~1 min | Docker démarré |
| `npm run test:fast` | Unitaires seuls | ~2 s | aucun |
| `npm run test:integration` | Intégration seule | ~50 s | Docker démarré |

Toute option supplémentaire est transmise à Jest :

```bash
npm test -- --testNamePattern="RBAC"
npm run test:fast -- --watch
```

## Ce que fait `npm test`

[scripts/run-tests.mjs](../scripts/run-tests.mjs) enchaîne :

1. **Construction** de l'application si le bundle `dist/` est périmé.
2. **Base de test jetable** — un conteneur PostgreSQL est créé sur un port
   libre choisi à l'exécution, puis détruit à la fin.
3. **Schéma** — `drizzle-kit push` depuis `shared/schema.ts` (~112 tables).
4. **Seed déterministe** — [tests/seed.ts](../tests/seed.ts) : 3 tenants,
   3 comptes.
5. **Serveur applicatif** — démarré automatiquement sur un port libre, en
   `NODE_ENV=test`.
6. **Jest**.
7. **Nettoyage** — serveur arrêté, conteneur supprimé, même en cas d'échec.
8. **Récapitulatif** PASS/FAIL exploitable par une CI.

## Garanties d'isolation

- **La base de développement n'est jamais touchée.** Le conteneur est créé et
  détruit à chaque exécution ; `DATABASE_URL` est imposée aux processus enfants,
  et le `.env` local est neutralisé (`DOTENV_CONFIG_PATH` vers un fichier vide).
- **Double garde-fou** : `tests/seed.ts` refuse toute base dont le nom ne
  contient pas « test ».
- **Ports dynamiques** — plusieurs exécutions ou d'autres projets peuvent
  cohabiter sur la machine.

## Comptes de test

Créés par le seed, jamais à la main :

| E-mail | Rôle | Tenant |
|---|---|---|
| `admin@maintrix.local` | admin | Alpha |
| `tech@maintrix.local` | technician | Alpha |
| `admin-beta@maintrix.local` | admin | Beta |

Mot de passe commun : `Maintrix2024!`. Deux tenants distincts permettent de
tester l'isolation pour de vrai, et non de la supposer.

## Organisation

```
tests/
  unit/            aucune base, aucun serveur — voie rapide
  integration/     serveur + PostgreSQL provisionnés automatiquement
  helpers/setup.ts helpers d'authentification et de requêtes
  seed.ts          fixtures déterministes
```

Le découpage est porté par deux « projects » Jest (`unit`, `integration`) —
voir [jest.config.ts](../jest.config.ts).

⚠️ **Ne lancez pas `npx jest` directement** pour la voie intégration : elle
attend `API_URL` et `DATABASE_URL`, fabriquées par l'orchestrateur. Le helper
échoue avec un message explicite si la variable manque.

## Lire le résultat

```
  RÉSULTAT      : PASS   (unitaires + intégration)
  Tests         : 62 au total
     réussis    : 59
     échoués    : 0
     ignorés    : 3
  Suites        : 7 au total, 7 réussie(s), 0 échouée(s)
  Durée         : 48.3 s
```

Le détail complet est écrit dans `test-report.json` à la racine (ignoré par
git) : utile pour relire les échecs après le nettoyage de l'environnement.

**« ignorés »** compte les `it.todo` — des spécifications identifiées mais non
réalisées. Elles restent visibles au lieu d'être supprimées. Voir
« Limites connues » plus bas.

## Barrière de déploiement

`npm test` sort en code **0** si et seulement si tout passe. Un déploiement
cloud dont cette commande échoue **n'est pas valide**.

```bash
npm test || { echo "Barrière de test en échec — déploiement annulé"; exit 1; }
```

Trois autres barrières, issues des phases précédentes, sont complémentaires et
non couvertes par `npm test` :

```bash
node scripts/verify-deployment-security.mjs       # F03 — secrets, ports
node scripts/verify-health-endpoint.mjs           # F01 — sonde de santé
node scripts/verify-background-resilience.ts      # F02 — tâches de fond
```

## Limites connues

Constatées pendant la mise en place, **non corrigées** car hors du périmètre
d'automatisation des tests :

- **`/api/diagnostic-sessions` n'existe pas.** La table `diagnostic_sessions`
  est définie et lue en interne, mais aucune route REST ne l'expose. Deux
  `it.todo` en gardent la trace.
- **`/api/tenants` n'existe pas.** La gestion des tenants vit sous
  `/api/super-admin/tenants`, derrière un flux d'authentification distinct.
> ✅ **Corrigé.** Les 9 migrations `0011`→`0019` étaient absentes du journal
> drizzle (`migrations/meta/_journal.json` s'arrêtait à `0010`), si bien que
> `drizzle-kit migrate` ne les appliquait pas — et ce sont précisément celles du
> cloisonnement par locataire. Le journal est complété, et une barrière
> compare désormais les deux chemins :
>
> ```bash
> npm run verify:migrations
> ```
>
> Elle construit deux bases neuves — l'une par `migrate`, l'autre par `push` —
> et échoue à la moindre divergence. Mesure actuelle : **112 tables et
> 77 colonnes `tenant_id` des deux côtés**. Avec l'ancien journal, `migrate`
> produisait 105 tables et 67 colonnes `tenant_id` : 7 tables et 10 colonnes
> manquaient, sans aucune erreur affichée.

## Tests end-to-end (navigateur)

```bash
node scripts/provision-test-env.mjs   # une fois
npm run test:e2e
```

Playwright pilote un vrai Chromium contre l'environnement de test
([tests/e2e/](../tests/e2e/)). Ces tests ne démarrent pas l'environnement : ils
visent une stack déjà montée, comme le ferait un testeur.

Ils existent parce que **les tests d'intégration passaient alors que le parcours
réel était cassé** :

| Défaut | Pourquoi l'API ne le voyait pas |
|---|---|
| `403 ORIGIN_NOT_ALLOWED` à la connexion | supertest n'envoie pas d'en-tête `Origin` |
| Écran de première connexion sans issue | Le mot de passe changeait bien (HTTP 200) ; seule l'interface ne redirigeait pas |

⚠️ **Limitation de débit.** `/api/enterprise-auth/login` est plafonné à
5 tentatives / 15 min, blocage 30 min, et n'est désactivé qu'en `NODE_ENV`
`test` ou `development`. L'environnement testeur tourne en `production` :
le limiteur est donc actif. Les tests E2E visant l'application en direct
partagent une même IP, ils purgent donc `rate_limits` avant de démarrer.
Par le point d'entrée public, nginx pose `X-Forwarded-For` et chaque testeur a
son propre compteur.

## Pas encore couvert

Aucun **test de charge** — c'est l'objet de la phase 10. Côté navigateur, la
couverture reste volontairement étroite : le parcours d'accueil d'un testeur et
l'hygiène de la page de connexion. Les écrans métier (GMAO, diagnostic,
budgets) ne sont pas couverts en E2E.

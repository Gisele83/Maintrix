# Revue de sécurité avant ouverture aux testeurs — F11

Cette revue précède l'ouverture contrôlée de l'environnement de test à des
testeurs externes. Elle porte sur **l'environnement de test**, pas sur une
production : aucune donnée réelle n'y circule.

Tout ce qui suit a été **observé sur l'environnement en fonctionnement**, pas
déduit de la lecture du code. Les constats qui se sont révélés faux sont
signalés comme tels.

---

## 1. Surface d'attaque de l'image de production

### Ce qui a été constaté

`npm audit` remontait **94 vulnérabilités (6 critiques, 57 élevées)**. Le point
important n'était pas le nombre : c'était que **61 des 63 paquets critiques ou
élevés étaient réellement présents dans l'image du serveur**.

L'image pesait **3,69 Go**, dont 1,3 Go de `node_modules`, pour une application
Node dont le bundle fait 5 Mo. Les plus lourds :

| Paquet | Poids | Importé par le serveur ? |
|---|---|---|
| `html-pdf-node` | 409 Mo | **non — aucune référence dans tout le dépôt** |
| `app-builder-bin` | 207 Mo | non (outillage `electron-builder`) |
| `electron-winstaller` | 31 Mo | non |
| `@electron/*`, `dmg-builder`, `app-builder-lib` | 12 Mo | non |

Cause racine : `electron-builder` et `html-pdf-node` étaient déclarés dans
**`dependencies`** et non `devDependencies`. `npm ci --only=production` les
installait donc dans l'image du serveur.

### Pourquoi les retirer ne supprime aucune fonctionnalité

- `html-pdf-node` : recherche exhaustive sur tout le dépôt — **aucune
  référence** en dehors de `package-lock.json`. Code mort.
- `electron-builder` : l'application desktop est construite depuis les
  sous-projets `desktop/` et `electron/`, qui **déclarent chacun leur propre
  `electron-builder` dans leurs `devDependencies`**. La déclaration à la racine
  était vestigiale : la racine n'a ni `main`, ni section `build`, ni script
  Electron.

### Résultat mesuré

| | avant | après |
|---|---|---|
| Image | 3,69 Go | **1,81 Go** |
| `node_modules` dans l'image | 1,3 Go | **630 Mo** |
| Vulnérabilités | 94 | **31** |
| dont critiques | 6 | **2** |
| dont élevées | 57 | **10** |

La seconde moitié de la réduction vient d'un `npm audit fix` **non cassant** :
aucune version déclarée dans `package.json` n'a changé, seules des dépendances
transitives ont été montées à l'intérieur des plages semver déjà autorisées.

Une seule retombée, détectée par la vérification de types : Puppeteer
`24.16.0 → 24.43.1` exclut désormais `networkidle0` du type de `setContent`
(ces états d'inactivité réseau n'ont de sens que pour une navigation). Corrigé
en `load` dans [server/cctp-routes.ts](../server/cctp-routes.ts).

### Barrière

`node scripts/verify-deployment-security.mjs` (T8) échoue si `electron-builder`,
`electron`, `html-pdf-node` ou `@electron/rebuild` réapparaissent en
`dependencies`.

---

## 2. Documentation d'API exposée publiquement

`/api-docs` (Swagger UI) et `/api-docs.json` étaient montés **sans condition et
sans authentification**, y compris en production, et joignables par le point
d'entrée public. N'importe quel visiteur obtenait la carte complète des routes,
des paramètres et des schémas de données — un guide de reconnaissance.

**La documentation n'a pas été supprimée** : elle est utile à des testeurs
externes. Elle est désormais un choix explicite :

- hors production : active par défaut, comme avant ;
- en production : montée **uniquement** si `ENABLE_API_DOCS=true`.

L'interrupteur traverse `docker-compose.test.yml` (défaut `false`) — sans quoi
il serait inutilisable, la variable n'atteignant jamais le conteneur.

Vérifié dans les deux sens sur l'environnement réel : sans la variable, aucun
marqueur `swagger`/`openapi` n'est servi ; avec `ENABLE_API_DOCS=true`, la
documentation revient.

> `/api-docs` répond toujours **200** : c'est le repli SPA qui sert
> `index.html`, comportement normal. Le contenu Swagger, lui, a disparu.

---

## 3. Bannière nginx

`Server: nginx/1.31.5` publiait la version exacte, y compris sur les pages
d'erreur. Cela n'ouvre aucune porte mais indique à un attaquant quelles failles
publiées essayer en premier. `server_tokens off;` ajouté au bloc `http`.
Vérifié : `Server: nginx`.

---

## 4. Routes super-admin — défense en profondeur

### Le constat initial était incomplet

`publicPaths` ([server/index.ts](../server/index.ts)) compare les chemins avec
`startsWith` et contient `/api/super-admin`. **Tout** ce qui commence par ce
préfixe échappe donc au filtre d'authentification global.

Ce n'est **pas** une faille aujourd'hui : les 14 routes ont été vérifiées une
par une, et les 12 qui manipulent des données portent chacune
`authenticateSuperAdmin`. Seules `POST /login` et `POST /logout` sont ouvertes,
délibérément.

### Pourquoi ne pas corriger `publicPaths`

Le super-admin s'authentifie par un mécanisme **distinct** (jeton `Bearer` /
`superAdminToken`) de celui des locataires (`sessionToken`). Retirer le préfixe
de `publicPaths` ferait passer ces routes par un filtre incapable de lire leur
jeton : l'administration deviendrait inaccessible. Le défaut réel n'est pas le
préfixe, c'est qu'il ne reste **qu'une seule ligne de défense**, silencieuse si
on l'oublie.

### Barrière

[tests/unit/super-admin-guard.test.ts](../tests/unit/super-admin-guard.test.ts)
analyse le fichier de routes et échoue si une route apparaît sans son garde,
en nommant la méthode, le chemin et la ligne. Les exceptions sont explicites et
justifiées ; le test échoue aussi si une exception devient orpheline.

Vérifié par injection : garde retiré de `GET /platform-stats` → 2 tests
rougissent en nommant la route.

---

## 5. `tempSessionToken` ne protège rien

Le serveur fabrique un `tempSessionToken` (`crypto.randomBytes(32)`) à la
première connexion, l'exige en entrée de `force-password-change`… et **ne le
stocke nulle part, ne le compare à rien**. Le schéma zod vérifie seulement
qu'il s'agit d'une chaîne non vide. Recherche exhaustive : jamais persisté,
jamais relu.

**Ce n'est pas exploitable** : la vraie défense du flux est la vérification
bcrypt de `currentPassword`. Mais c'est un leurre — un développeur convaincu que
le flux est protégé par un jeton pourrait relâcher la vérification du mot de
passe.

Un test épingle donc la protection **réelle** : un mauvais mot de passe actuel
est refusé (400 `INVALID_CURRENT_PASSWORD`) même avec le jeton authentique, et
le compte ne bouge pas. Vérifié par injection : en neutralisant le `bcrypt.compare`,
le changement de mot de passe **réussit** (200) — la barrière rougit.

**Reste à faire** : rendre le jeton effectif (stockage à usage unique +
expiration). Consigné comme risque résiduel.

---

## 6. Application des licences — inerte

Le middleware `licenseEnforcementMiddleware` est **monté**
([server/index.ts](../server/index.ts):363) et sa logique est complète. Mais il
est monté **avant `registerRoutes`**, alors que l'authentification est posée
route par route à l'intérieur. À son passage, `req.user` est donc toujours
`undefined`, et la première condition (`if (!user) { next(); return; }`) laisse
tout passer.

**Vérifié expérimentalement**, pas déduit : licence d'un locataire forcée à
« expirée » en base, puis requête authentifiée → **HTTP 200** (et non 402).

Ce n'est pas un défaut de sécurité — c'est une fonctionnalité commerciale
inactive. Rétablir l'ordre verrouillerait instantanément les locataires ; c'est
pourquoi F08 a déjà fait naître chaque nouveau locataire avec un essai de
30 jours. **Décision à prendre par le responsable du produit**, hors périmètre
technique.

---

## 7. En-têtes de sécurité — constat corrigé

Une première mesure semblait montrer l'absence de HSTS, `X-Frame-Options` et
`X-Content-Type-Options` derrière nginx. **C'était une erreur de mesure** : le
filtre employait des noms d'en-têtes abrégés suivis de `:`
(`strict-transport:`), qui ne correspondent jamais à
`Strict-Transport-Security:`.

Mesure correcte, sur les quatre chemins :

| En-tête | direct HTML | direct API | nginx HTML | nginx API |
|---|---|---|---|---|
| `Strict-Transport-Security` | ✓ | ✓ | ✓✓ | ✓✓ |
| `X-Frame-Options: DENY` | ✓ | ✓ | ✓✓ | ✓✓ |
| `X-Content-Type-Options: nosniff` | ✓ | ✓ | ✓✓ | ✓✓ |
| `Referrer-Policy` | ✓ | ✓ | ✓✓ | ✓✓ |
| `Content-Security-Policy` | ✓ | ✓ | ✓ | ✓ |
| `X-Robots-Tag: noindex` | ✓ | — | ✓ | — |

Le doublement derrière nginx vient de ce que nginx **et** l'application posent
les mêmes en-têtes. Les valeurs sont **identiques** : c'est de la défense en
profondeur, pas un conflit. Laissé tel quel.

---

## 8. Secrets dans l'historique Git

- **`sk-ant-…`** : 6 commits en contiennent, mais toutes les occurrences sont
  des **exemples** (`sk-ant-xxxxx`, `sk-ant-api03-X…`, 7 à 21 caractères).
  Aucune vraie clé.
- **Chaîne PostgreSQL Neon** : présente dans l'historique public (`f70752a`,
  `0ab95cf`) — mais **sa valeur est caviardée**, et elle n'ouvre pas la base.

> ### ⚠️ Constat corrigé
>
> Ce document a affirmé pendant onze phases que le secret Neon était compromis
> et que sa rotation bloquait l'ouverture aux testeurs. **C'était faux.**
>
> La conclusion reposait sur la *présence* de la chaîne dans l'historique. Sa
> *valeur* n'avait jamais été examinée, et il n'avait jamais été vérifié qu'elle
> ouvrait quoi que ce soit.
>
> Mesures : le mot de passe publié fait 20 caractères dont **6 astérisques
> littéraux** — une valeur masquée à la main. Sur **3 292 blobs** (tous les
> objets, y compris ceux devenus inatteignables), une seule occurrence, aucune
> valeur réelle. Et la chaîne, présentée à Neon, est **refusée** — avec un
> témoin établissant que le serveur répond et authentifie normalement, donc que
> « refusé » ne masque pas « injoignable ».
>
> **La rotation n'est pas le préalable bloquant annoncé.** Détail complet,
> réserves et marche à suivre si vous souhaitez faire tourner l'identifiant
> malgré tout : [SECRET_ROTATION.md](SECRET_ROTATION.md).

---

## Défauts fonctionnels relevés au passage (hors sécurité)

- **`GET /api/cctp/tenant/:id/purchase-order/:id/document` échoue toujours.**
  Le code appelle `puppeteer.launch()`, mais **aucun Chromium n'est présent dans
  l'image** et aucun navigateur système n'y est installé. Reproduit dans le
  conteneur : `Could not find Chrome (ver. 139.0.7258.66)`. Le testeur reçoit
  une erreur 500. Non corrigé : hors périmètre sécurité, et la correction
  (embarquer un Chromium) alourdirait l'image de ~300 Mo — arbitrage à rendre.

---

## Traitement des risques résiduels

Les risques listés à la clôture de F11 ont été repris un par un.

### Vulnérabilités : 94 → 9

Après le retrait de `electron-builder` et `html-pdf-node` (voir §1), quatre
autres paquets se sont révélés **vestigiaux** — déclarés en `dependencies`,
importés nulle part :

| Paquet | Vérification | Effet |
|---|---|---|
| `nexe` | empaqueteur de binaires ; 0 import, 0 script | −9 vulnérabilités dont la dernière **critique** (`decompress`) |
| `pkg` | empaqueteur de binaires ; 0 import | moderate |
| `jspdf` | utilisé **uniquement** comme script CDN dans du HTML généré, jamais importé depuis npm | −1 **critique** |
| `@google-cloud/storage` | aucune trace dans le dépôt | −4 |
| `@tailwindcss/vite` | absent de `vite.config.ts` ; Tailwind v3 passe par PostCSS | −1 |

Puis les montées de version, chacune vérifiée :

| Paquet | Version | Note |
|---|---|---|
| `drizzle-orm` | 0.39.3 → **0.45.2** | corrige une injection SQL par identifiants mal échappés |
| `drizzle-kit` | 0.30.6 → **0.31.10** | |
| `xlsx` | 0.18.5 → **0.20.3** | via la distribution officielle SheetJS — npm ne publie plus au-delà de 0.18.5 |
| `qs` | 6.15.3 → **6.16.0** | par `overrides` : `express@4.22.2` (dernière 4.x) le fige ; corrige aussi `body-parser` et `express` |

**`xlsx` était la plus réellement exploitable** : pollution de prototype et
ReDoS déclenchés à l'**analyse d'un classeur**, or 8 appels `XLSX.read()`
portent sur des buffers téléversés par l'utilisateur. La version corrigée n'est
pas sur npm ; elle est installée depuis `cdn.sheetjs.com`, avec son empreinte
`integrity` verrouillée dans `package-lock.json`.

**Une régression a été introduite puis corrigée.** La montée de `drizzle-orm`
a fait échouer les tests de concurrence : depuis la 0.44, drizzle encapsule les
erreurs du pilote dans un `DrizzleQueryError`, si bien que le code SQLSTATE
n'est plus sur `error.code` mais sur `.cause`. Les cinq routes testant
`e.code === "23505"` avaient donc **silencieusement** cessé de reconnaître les
conflits d'unicité. Corrigé par [server/db-errors.ts](../server/db-errors.ts),
qui parcourt la chaîne des causes. Seuls les tests l'ont vu — la compilation
était propre.

### Les 9 vulnérabilités restantes

| Grappe | Sévérité | Livrée en production ? | Pourquoi elle reste |
|---|---|---|---|
| `puppeteer`, `puppeteer-core`, `@puppeteer/browsers`, `extract-zip` | 4 × élevée | oui | `extract-zip` **n'a aucune version corrigée** ; seul puppeteer 25 s'en débarrasse, or il exige Node ≥ 22.12 |
| `vite`, `esbuild` | 1 élevée + 1 modérée | **non** — devDependencies | vite 7 exige `@types/node@22` (l'image tourne sous Node 20) ; vite 8 tire `@babel/core@8.0.0-rc`, en conflit avec Jest |
| `drizzle-kit`, `@esbuild-kit/*` | 3 modérées | **non** — devDependency | `drizzle-kit@0.31.10` (dernière) dépend encore de `@esbuild-kit`, déprécié |

**Mitigation mesurée pour la grappe puppeteer** : `extract-zip` n'est référencé
que par `@puppeteer/browsers/lib/cjs/fileUtil.js` — l'**installateur** de
navigateur. Il est **absent de `puppeteer-core`**, le cœur d'exécution
(vérifié). Avec `PUPPETEER_SKIP_DOWNLOAD=true` et un Chromium système, ce code
n'est jamais exécuté dans le conteneur.

Les avis `vite`/`esbuild` concernent tous le **serveur de développement**
(`server.fs.deny` contourné, requêtes arbitraires vers le dev server). Le
conteneur testeur exécute `node dist/index.js` : ni vite ni dev server.

### `tempSessionToken` — désormais réel

Implémenté dans [server/temp-session-tokens.ts](../server/temp-session-tokens.ts) :
lié à un utilisateur, expirant (15 min), à usage unique, consommé une fois le
mot de passe changé. Vérification et consommation sont **séparées** — brûler le
jeton dès sa présentation obligerait à se reconnecter à chaque faute de frappe.

Stockage en mémoire, cohérent avec l'hypothèse mono-instance déjà documentée
(voir [SINGLE_INSTANCE_ASSUMPTION.md](SINGLE_INSTANCE_ASSUMPTION.md)) : une
table imposerait une migration, et le journal drizzle venait tout juste d'être
réparé. Quatre tests l'épinglent ; injection de faute vérifiée (4 rougissent).

### Application des licences — rendue fonctionnelle, désactivée par défaut

Le middleware n'était pas mal écrit : il était **mal placé**. Monté globalement
avant `registerRoutes`, il s'exécutait avant que quoi que ce soit ne renseigne
`req.user` et ressortait aussitôt.

Il est désormais enchaîné après `validateSession`
([server/enterprise-auth-middleware.ts](../server/enterprise-auth-middleware.ts)),
seul endroit où l'utilisateur est connu, et gouverné par
`ENABLE_LICENSE_ENFORCEMENT` — **désactivé par défaut**, car bloquer un
locataire est une décision commerciale, pas technique.

Six tests, dont une barrière **structurelle** qui échoue si quelqu'un remonte
le middleware globalement : c'est le placement, et non la logique, qui était
en cause, et un test isolant le middleware ne l'aurait jamais vu.

### Journal des migrations — réparé et mesuré

Les 9 entrées manquantes sont ajoutées.
[scripts/verify-migrations.mjs](../scripts/verify-migrations.mjs) construit deux
bases neuves et compare :

| | tables | colonnes `tenant_id` |
|---|---|---|
| avant (journal tronqué) | 105 | 67 |
| après, par `migrate` | **112** | **77** |
| par `push` (référence) | **112** | **77** |

> La première version de cette barrière relevait **0 table des deux côtés** et
> se déclarait verte : `shell: true` sous Windows mutilait le SQL entre
> apostrophes. Une comparaison vide compare deux fois rien. Corrigé, et un
> garde-fou de volumétrie rend ce faux vert impossible.

---

## Ce qui reste ouvert

| Point | État | Qui |
|---|---|---|
| ~~Identifiant Neon compromis~~ | **clos** — valeur caviardée, refusée par le serveur ; barrières CI et `npm run verify:secrets` posées | rotation facultative, voir [SECRET_ROTATION.md](SECRET_ROTATION.md) |
| Mot de passe en dur `maintrix_user@localhost` (`vm-setup-windows.ps1:103`) | non joignable depuis Internet | à générer, par hygiène |
| 4 vulnérabilités puppeteer | mitigées (code de l'installateur jamais exécuté) | disparaîtront avec puppeteer 25 + image Node 22 |
| 5 vulnérabilités d'outillage | hors image de production | montée de chaîne de construction, à planifier hors fenêtre d'ouverture |
| `--disable-web-security` et `--no-sandbox` dans le lancement Chromium | conservés — les retirer risquait de casser le rendu que l'on venait de rétablir | à réévaluer : le HTML rendu contient des données de locataire |
| `purchase_orders` n'a **aucune colonne `tenant_id`** | constaté en créant la donnée de test | cloisonnement à étendre à cette table |

---

## Génération PDF des bons de commande — quatre défauts empilés

`GET /api/cctp/tenant/:id/purchase-order/:id/document` renvoyait 500 pour tout
le monde. Le premier défaut masquait le deuxième, et ainsi de suite : chacun n'est
apparu qu'une fois le précédent corrigé.

| # | Défaut | Symptôme |
|---|---|---|
| 1 | Aucun navigateur dans l'image | `Could not find Chrome (ver. 139.0.7258.66)` |
| 2 | `--single-process` et `--no-zygote` font crasher Chromium moderne | `Protocol error (Target.setDiscoverTargets): Target closed` |
| 3 | `tenants.purchase_order_config` vaut `{}` et non NULL — le garde `if (!config)` laissait passer une configuration vide | plantage sur `config.companyHeader.name`, 500 opaque, alors que le message explicite existait déjà |
| 4 | `page.pdf()` renvoie un `Uint8Array` depuis Puppeteer 23, non un `Buffer` | **HTTP 200**, `Content-Type: application/pdf`, 537 Ko… contenant `{"0":37,"1":80,"2":68,…}` |

Le quatrième mérite d'être retenu : statut correct, type MIME correct, taille
plausible, **contenu faux**. Le testeur aurait téléchargé un `.pdf` que rien
n'ouvre. Aucun contrôle portant sur le code de retour ne l'aurait vu — il a
fallu ouvrir le fichier.

**Résultat vérifié de bout en bout** sur l'environnement réel : `HTTP 200`,
48 213 octets, en-tête `%PDF-1.4`, fin `%%EOF`, 1 page,
`Content-Disposition: attachment; filename="lettre_commande_1.pdf"` — « lettre »
et non « bon de commande » parce que 1 234,56 € est sous le seuil de 5 000 €,
ce qui est le comportement métier attendu.

Ces quatre défauts ne sont pas testables en intégration : le harnais local n'a
pas de Chromium. Quatre barrières statiques les couvrent
([tests/unit/cctp-pdf-guard.test.ts](../tests/unit/cctp-pdf-guard.test.ts)),
chacune vérifiée par injection.

> La première version de ces barrières signalait ses **propres commentaires
> explicatifs** — qui citent les constructions fautives — comme des
> régressions. Les commentaires sont désormais retirés avant analyse.

### Coût

L'image passe de **1,81 à 2,64 Go** (Chromium et ses dépendances de rendu :
`nss`, `freetype`, `harfbuzz`, `ttf-freefont`). `PUPPETEER_SKIP_DOWNLOAD=true`
évite que Puppeteer n'en télécharge un second (~180 Mo de plus), et la version
suit les correctifs du dépôt Alpine.

### Données ajoutées à l'environnement de test

Pour prouver le parcours, deux éléments ont été créés et **laissés en place** :
une configuration Bon de Commande valide sur le locataire Alpha, et un bon de
commande `BC-F11-001` (1 234,56 €). Sans configuration, la fonctionnalité reste
inutilisable — les testeurs peuvent désormais l'exercer.

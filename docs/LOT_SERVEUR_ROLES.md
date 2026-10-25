# Lot serveur — les cinq défauts de rôles, qualifiés et corrigés

Suite du lot client `9be3c46` (branche `claude/objective-knuth-66e22f`), qui avait
aligné l'interface sur le RBAC du serveur et **relevé cinq défauts serveur sans les
corriger**, le lot client s'interdisant de toucher à `server/`.

Ce lot-ci est **isolé** : branche `claude/lot-serveur-roles`, partie de `origin/main`
(`e8c413a`). Il ne contient aucun commit du lot client ni de la refonte UX/UI, et peut
être fusionné seul — sous réserve de l'ordre décrit au §4.

> **Attention, `main` local est périmé** (`11b548d`, « Premier commit »). Le point
> d'intégration réel est `origin/main` (`e8c413a`).

---

## 0. Méthode et environnement

Rien n'est conclu d'une lecture du code. Chaque défaut est éprouvé sur un serveur réel,
avec des sessions réellement ouvertes, et l'état est relu **en base** après coup —
un code HTTP ne dit pas ce qui a été écrit.

* grappe PostgreSQL jetable `127.0.0.1:55433`, base **dédiée**
  `maintrix_test_lot_serveur` (`drizzle-kit push` + `tests/seed.ts`) — la base partagée
  `maintrix_test` porte un schéma périmé et les fixtures d'autres sessions ;
* serveur `node dist/index.js`, `NODE_ENV=test`, port **5070** (5060 est refusé par
  `fetch` : port SIP, liste WHATWG des ports bloqués) ;
* comptes du seed : `admin@maintrix.local` (`admin`), `tech@maintrix.local`
  (`technician`), `admin-beta@maintrix.local` (`admin`, locataire Beta).

Convention de lecture, les contrôles de rôle précédant la lecture en base :
**403** = rôle refusé · **404** = rôle accepté, objet absent · **200/201** = accepté.

---

## 1. Les cinq défauts

### Vue d'ensemble

| # | Défaut | Criticité | Contournement RBAC ? | Fuite inter-locataires ? |
|---|---|---|---|---|
| **D1** | `role` en texte libre + rôle fantôme `director` | **P1** | **Non** — mesuré depuis cinq rôles de départ | Non |
| **D2** | Le propriétaire ne peut pas gérer ses propres comptes | **P1** | Non (échoue fermé) | Non |
| **D3** | Quatre routes enregistrées avant les middlewares | **P2** | Non (échoue fermé) | Non |
| **D4** | `"Super-admin"` dans `adminConfigGuard` | **P3** | Non | Non |
| **D5** | Suppression d'un plan préventif : 200 sur un id inexistant | **P3** | Non | Non |

**Aucun des cinq ne permet à un compte non privilégié de franchir le RBAC, et aucun ne
laisse fuir de données entre locataires.** Les deux priorités impératives sont donc
satisfaites avant correction — ce qui explique les criticités P1/P2/P3 et l'absence de
P0. La démonstration est au §1.1 et au §1.6 ; elle a été cherchée, pas supposée.

---

### D1 — `role` accepte n'importe quelle chaîne, et `director` n'existe nulle part

**Localisation.**
`server/tenant-permissions-routes.ts:11` (`userPermissionsSchema.role: z.string()`)
et `:210` (`updateData.role = validatedData.role`, recopié brut) ;
`server/gmao-routes.ts:511, 674, 825` (`hasRole(req,'admin','director','technical_director','owner')`) ;
`server/tenant-permissions-routes.ts:58, 173` (`["admin","director"].includes(...)`).

**Attendu.** Un rôle écrit en base appartient au référentiel `shared/roles.ts`, seule
source de vérité, et tout contrôle s'exprime par lui.

**Observé.** `PATCH /api/tenant/users/:id/permissions` écrit la valeur telle quelle :

```
PATCH role="director"       -> HTTP 200 ; en base : "director"
PATCH role="super_admin"    -> HTTP 200 ; en base : "super_admin"
PATCH role="nimporte_quoi"  -> HTTP 200 ; en base : "nimporte_quoi"
```

Ce que chaque valeur **donne réellement**, mesuré en rouvrant une session à chaque fois :

| surface | technician | **director** | super_admin | owner | nimporte_quoi |
|---|---|---|---|---|---|
| `DELETE /api/work-orders/:id` | 403 | **404** | 403 | 404 | 403 |
| `DELETE /api/preventive-maintenance-plans/:id` | 403 | **200** | 403 | 200 | 403 |
| `DELETE /api/spare-parts/:id` | 403 | **404** | 403 | 404 | 403 |
| `GET /api/tenant/users` | 403 | **200** | 403 | **403** | 403 |
| `GET /api/system/health` | 403 | 403 | **200** | 200 | 403 |
| `POST /api/license/grace` | 403 | 403 | **200** | 200 | 403 |
| `GET /api/tenant/modules` | 403 | 403 | 403 | 200 | 403 |
| `POST /api/permits/:id/approve` | 403 | 403 | 403 | 404 | 403 |
| `GET /api/equipment` *(témoin)* | 200 | 200 | 200 | 200 | 200 |

Trois faits s'en dégagent :

1. **`director` est plus puissant que le propriétaire** sur la gestion des comptes :
   200 contre 403 sur `GET /api/tenant/users`. Un rôle qui n'existe dans aucun
   référentiel dépasse le compte principal de l'organisation.
2. **`super_admin`, nom du rôle de plateforme, est écrivable dans une ligne de
   locataire** et `security-middleware.requireRole` l'honore (`estSuperAdmin =
   roleBrut === ROLE_SUPER_ADMIN`). Portée réelle aujourd'hui : `/api/system/health` et
   `/api/license/grace`, déjà ouvertes à `admin`. **`/api/super-admin/*` reste en 401** :
   cette façade a sa propre authentification, elle ne regarde pas `user_profiles.role`.
3. **Une valeur inconnue échoue fermé** partout (403), sans erreur 500 : le référentiel
   refuse proprement ce qu'il ne connaît pas. Le compte devient inutilisable sans
   message — « un refus d'accès inexplicable », exactement ce que le référentiel avait
   été créé pour éviter.

#### 1.1 Y a-t-il un contournement du RBAC ? — Non, et voici la mesure

L'auto-promotion vers `super_admin` a été tentée depuis six rôles de départ, en relisant
le rôle **en base** après l'appel :

| rôle de départ | HTTP | rôle en base après | verdict |
|---|---|---|---|
| `technician` | 403 | `technician` | refusé |
| `team_leader` | 403 | `team_leader` | refusé |
| `maintenance_manager` | 403 | `maintenance_manager` | refusé |
| `director` | 200 | `super_admin` | **réussie** |
| `owner` | 403 | `owner` | refusé |
| `admin` | 200 | `super_admin` | **réussie** |

Seuls `admin` — déjà au sommet du locataire — et `director` — qu'un administrateur seul
peut attribuer — y parviennent. **Aucune élévation depuis un compte non privilégié.**
Le défaut est donc une **perte d'intégrité du référentiel**, pas une faille
d'authorisation : il permet à un administrateur de créer des états que plus aucun
contrôle référentiel ne reconnaît, y compris les garde-fous de l'interface.

**Criticité : P1.** Pas P0, faute de chemin depuis le bas ; pas P2, parce qu'un rôle hors
référentiel contourne durablement les contrôles de `requireRole`/`auMoins` et rend
l'audit des droits faux.

**Cause racine.** `shared/roles.ts` a été créé comme source unique, mais deux endroits ne
s'y réfèrent pas : la **validation d'entrée** (`z.string()` au lieu de l'énumération du
référentiel) et trois **contrôles écrits à la main** antérieurs au référentiel.

**Correction minimale.**
1. `userPermissionsSchema.role` valide contre le référentiel et **normalise** avant
   écriture ;
2. les trois `hasRole(...)` deviennent `auMoins(role, 'technical_director')` ;
3. les deux `["admin","director"].includes(...)` deviennent `auMoins(role, 'admin')`
   (ce qui corrige aussi **D2**) ;
4. `director` est ajouté aux **ALIAS** du référentiel, vers `technical_director`.

**Pourquoi l'alias plutôt que le rejet.** Le bloc `ALIAS` de `shared/roles.ts` existe
pour cette raison précise, documentée dans le fichier : « Elles existent déjà en base et
dans du code ancien : les refuser casserait des comptes en service. » Comme `role` était
en texte libre, des comptes `director` peuvent exister en production ; les refuser les
enfermerait dehors. L'alias les ramène au niveau que les contrôles littéraux leur
accordaient déjà (pair de `technical_director` dans les trois listes).

**Risques de régression.** Pour les trois suppressions, l'ensemble autorisé est
**identique** avant/après : `{admin, director, technical_director, owner}` d'un côté,
`niveau ≥ 5` de l'autre, `director` y entrant par l'alias. Les autres alias connus
restent en dessous du seuil (`manager`→`maintenance_manager` niveau 4,
`supervisor`→`team_leader` niveau 2) : ils étaient refusés, ils le restent. Seul
changement voulu : les orthographes françaises (`directeur_technique`,
`administrateur`, `proprietaire`) sont désormais reconnues — elles étaient refusées par
une comparaison littérale alors qu'elles désignent des rôles autorisés.

---

### D2 — Le propriétaire d'un locataire ne peut pas gérer ses propres comptes

**Localisation.** `server/tenant-permissions-routes.ts:58` (`GET /api/tenant/users`),
`:173` (`PATCH /api/tenant/users/:userId/permissions`), `:286`
(`POST /api/tenant/roles`, `currentUser.role !== "admin"`).

**Attendu.** `owner` est le compte principal du locataire, créé avec lui, niveau 7 —
au-dessus d'`admin` (niveau 6). Il administre au moins autant.

**Observé**, sur un compte réellement porteur du rôle `owner` :

| surface | admin | **owner** |
|---|---|---|
| `GET /api/tenant/users` | 200 | **403** |
| `POST /api/tenant/roles` | 200 | **403** |
| `PATCH /api/tenant/users/:id/permissions` | 200 | **403** |

**Conséquences.** Aucune pour la sécurité ni pour l'isolation : le contrôle échoue
fermé. L'impact est **métier** et il est lourd — le propriétaire ne peut ni consulter,
ni modifier les permissions de ses comptes, ni créer un rôle personnalisé. Si le seul
`admin` d'une organisation part, le propriétaire ne peut pas reprendre la main.
C'est aussi ce qui a obligé le lot client à **geler** deux comparaisons
`["admin","director"].includes(...)` au lieu de les corriger : l'interface recopiait
fidèlement un serveur fautif.

**Criticité : P1** — perte de capacité sur le compte le plus important du locataire.

**Cause racine.** Trois contrôles écrits avant le référentiel, qui énumèrent des rôles
au lieu de raisonner par niveau, et qui oublient le rôle situé **au-dessus** de celui
qu'ils nomment. C'est le défaut que `auMoins` existe pour empêcher.

**Correction minimale.** `auMoins(currentUser.role, 'admin')` aux trois endroits.

**Risques de régression.** L'ensemble autorisé passe de `{admin, director}` à
`{admin, owner}` plus les orthographes alias de ces deux-là. Deux mouvements, tous deux
voulus :

* **gagné** — `owner` entre, c'est l'objet de la correction ;
* **perdu** — `director` sort. Via l'alias de D1 il devient `technical_director`,
  niveau 5, en dessous du seuil `admin` (niveau 6). Un rôle fantôme cesse donc
  d'administrer les comptes du locataire. C'est **le seul rétrécissement du lot**, il
  est assumé — aucun formulaire ne propose ce rôle — et il est couvert par un test.

`technical_director` reste refusé : la correction n'ouvre pas la gestion des comptes à
l'encadrement technique.

---

### D3 — Quatre routes sont enregistrées avant les middlewares qui les alimentent

**Localisation.** `server/tenant-integration.ts:243-256`
(`setupCompleteMultiTenantArchitecture`), appelée depuis `server/routes.ts:198`.
Les routes concernées : `GET /api/tenant/security-stats`,
`POST /api/federated-ai/diagnostic-feedback`, `POST /api/federated-ai/recommendations`,
`GET /api/federated-ai/improvement-stats`.

**Attendu.** Ces quatre routes lisent `req.tenantId` (et `req.user` pour la première) :
elles doivent être déclarées **après** les middlewares qui les posent.

**Observé.** Elles sont inertes pour tout le monde, administrateur compris :

```
admin    GET  /api/tenant/security-stats          403  {"error":"Accès réservé aux administrateurs"}
admin    GET  /api/federated-ai/improvement-stats 401  {"error":"Tenant ID requis"}
admin    POST /api/federated-ai/recommendations   401  {"error":"Tenant ID requis"}
anonyme  GET  /api/tenant/security-stats          403  (atteinte sans authentification)
```

**Cause racine.** Dans `setupCompleteMultiTenantArchitecture`, les routes sont
enregistrées **avant** `enableMultiTenantSecurity(app)`, sous un commentaire qui
l'affirme comme une règle : « ⚠️ IMPORTANT: Les routes doivent être enregistrées AVANT
les middlewares tenant ». C'est l'inverse qui est vrai dans Express — un `app.use`
postérieur ne s'exécute jamais pour une route antérieure. De plus l'ensemble est appelé
à `routes.ts:198`, donc avant la barrière globale
`app.use('/api', EnterpriseAuthMiddleware.requireAuthentication)` de la ligne 426 :
`req.user` est vide lui aussi, et la route est atteignable sans session.

**Conséquences.** Aujourd'hui, **aucune** : les quatre routes échouent fermé, aucune
donnée ne sort, aucun écran ne les appelle (vérifié : aucune occurrence de
`federated-ai` ni de `security-stats` dans `client/src`). Le défaut est une **capacité
morte** — et un piège : toute route ajoutée dans ce bloc serait servie **sans
authentification et sans cloisonnement**.

**Criticité : P2** — rien de cassé, mais la position est fausse et invite la faute
suivante.

**Correction minimale.** Sortir les deux appels d'enregistrement du bloc précoce et les
rejouer après la barrière d'authentification, auprès des autres routes tardives ;
corriger le commentaire qui énonce la règle à l'envers.

**Risques de régression.** Les quatre routes passent d'« inertes » à « fonctionnelles et
authentifiées ». Un appelant anonyme reçoit désormais 401 au lieu de 403 ; aucun client
n'est concerné. `enableMultiTenantSecurity` reste à sa place, donc l'ordre des
middlewares pour toutes les autres routes est inchangé.

---

### D4 — `adminConfigGuard` cite un rôle qui n'existe pas

**Localisation.** `server/feature-middleware.ts:103`
(`const allowedRoles = ["admin", "owner", "Super-admin"]`), comparé par
`allowedRoles.includes(req.user.role)`.

**Attendu.** Le rôle de plateforme s'écrit `super_admin` et se compare à
`ROLE_SUPER_ADMIN`, comme le fait `security-middleware.requireRole`.

**Observé.** `admin` → 200, `technician` → 403 (donc le garde fonctionne pour les deux
rôles réels) ; la troisième entrée ne peut jamais être satisfaite par le rôle de
plateforme, qui vaut `super_admin` et non `"Super-admin"`.

**Conséquences.** Aucune aujourd'hui : l'entrée morte **n'ouvre rien**. Elle brouille la
lecture et, combinée à D1, pourrait être satisfaite en écrivant littéralement
`"Super-admin"` dans une ligne de locataire — sans rien accorder de plus qu'`admin`.

**Criticité : P3.**

**Cause racine.** Troisième liste de rôles écrite à la main, avec une casse et un
séparateur inventés.

**Correction minimale.** `auMoins(req.user.role, 'admin')`, plus la reconnaissance
explicite de `ROLE_SUPER_ADMIN`, alignée sur `security-middleware`.

**Risques de régression.** L'ensemble autorisé passe de `{admin, owner}` à
`{admin, owner, super_admin}` + alias. Aucun rétrécissement.

---

### D5 — Supprimer un plan préventif inexistant répond « supprimé avec succès »

**Localisation.** `server/gmao-routes.ts:680` et
`server/gmao-storage.ts:581` (`deletePreventiveMaintenancePlan` renvoie `Promise<void>`).

**Attendu.** Le même contrat que les deux autres suppressions du module : 404 quand rien
n'a été supprimé.

**Observé**, avec l'identifiant inexistant `99999999` :

```
admin   plan=200   pièce=404   OT=404
```

**Conséquences.** Aucune pour la sécurité ni pour l'isolation — la clause
`WHERE tenant_id = …` est bien présente, un plan d'un autre locataire n'est pas
supprimable. L'impact est sur le **contrat d'API** : l'interface ne peut pas distinguer
une suppression réelle d'un coup dans le vide, et affiche « supprimé avec succès » dans
les deux cas.

**Criticité : P3.**

**Cause racine.** La méthode de stockage ne remonte pas le nombre de lignes touchées,
là où `deleteWorkOrder` le fait déjà (`.returning()` puis `result.length > 0`).
`server/storage.ts:481` déclare d'ailleurs la même opération en `Promise<boolean>` :
c'est `gmao-storage.ts` qui s'écarte de la convention du dépôt.

**Correction minimale.** Aligner `deletePreventiveMaintenancePlan` sur
`deleteWorkOrder` (`.returning()` → booléen) et faire répondre 404 à la route quand
rien n'a été supprimé.

**Risques de régression.** Un appelant qui supprimait deux fois recevait 200 puis 200 ;
il recevra 200 puis 404. Aucun code client ne dépend du second 200 (le composant
rafraîchit la liste). Le passage de `Promise<void>` à `Promise<boolean>` est additif
pour l'unique appelant.

---

### 1.6 Ce qui a été cherché et **non** trouvé

Les deux priorités impératives ont été éprouvées, pas supposées.

* **Élévation de privilèges depuis un compte non privilégié** : tentée depuis
  `technician`, `team_leader`, `maintenance_manager` et `owner` — refusée à chaque fois,
  rôle inchangé en base (tableau §1.1).
* **Franchissement de locataire par en-tête forgé** : un administrateur d'Alpha appelant
  `PATCH /api/tenant/users/:id/permissions` sur un compte de **Beta** avec
  `X-Tenant-Id: <Beta>` reçoit **404**, et le rôle de la cible reste `admin` (relu en
  base). Le même administrateur lisant `GET /api/tenant/users` avec le même en-tête
  reçoit 200 **et les comptes d'Alpha** — son propre locataire. Aucune fuite.
* **Façade super-admin** : `/api/super-admin/users` et `/api/super-admin/session`
  répondent **401** quel que soit le rôle écrit dans `user_profiles`, y compris
  `super_admin`. Elle ne lit pas ce champ.
* **Robustesse face à un rôle inconnu** : `nimporte_quoi` donne 403 partout, aucune
  erreur 500.

Observation incidente, hors des cinq : `POST /api/access/grant` répond **500** à un
corps invalide là où un 400 conviendrait. Signalée, non corrigée — hors périmètre.

---

## 2. Ce qui a été corrigé, et ce que la mesure dit après

Huit fichiers, **173 insertions / 30 suppressions**. Aucune migration, aucun schéma de
base, aucune route ajoutée ou retirée.

| Fichier | Change |
|---|---|
| `shared/roles.ts` | `director` ajouté aux ALIAS → `technical_director` |
| `server/gmao-routes.ts` | `hasRole(…)` littéral → `auMoinsNiveau(req,'technical_director')` ×3 ; 404 sur plan absent |
| `server/gmao-storage.ts` | `deletePreventiveMaintenancePlan` renvoie un booléen |
| `server/tenant-permissions-routes.ts` | `role` normalisé à l'entrée ; `administreLesComptes` = `auMoins(role,'admin')` ×3 |
| `server/tenant-integration.ts` | routes sorties du bloc précoce ; `security-stats` passe à `auMoins(role,'admin')` |
| `server/routes.ts` | `registerTenantScopedRoutes(app)` appelée après la barrière d'authentification |
| `server/feature-middleware.ts` | `adminConfigGuard` → référentiel + `ROLE_SUPER_ADMIN` |
| `tests/unit/roles.test.ts` | alias `director`, seuils, refus de `super_admin` |

### Avant → après, mesuré sur le même environnement

**D1 — ce que `PATCH /api/tenant/users/:id/permissions` écrit en base :**

| valeur envoyée | avant | après |
|---|---|---|
| `director` | 200 → stocké `"director"` | 200 → stocké **`technical_director`** |
| `supervisor` | 200 → stocké `"supervisor"` | 200 → stocké **`team_leader`** |
| `manager` | 200 → stocké `"manager"` | 200 → stocké **`maintenance_manager`** |
| `super_admin` | 200 → stocké `"super_admin"` | **400**, base inchangée |
| `nimporte_quoi` | 200 → stocké `"nimporte_quoi"` | **400**, base inchangée |

Le parcours de l'écran de permissions est **préservé** : il envoie l'identifiant du
catalogue (`supervisor`, `manager`, `director`), qui continue d'être accepté — et qui
est désormais rangé sous le rôle réel qu'il désigne.

**D1 — ce qu'obtient un compte portant `director` en base** (valeur forcée en SQL, pour
représenter un compte existant) :

| surface | avant | après |
|---|---|---|
| les trois suppressions | acceptées | **acceptées** (inchangé, via l'alias) |
| `GET /api/tenant/users` | 200 | **403** *(seul rétrécissement du lot)* |
| `PATCH …/permissions` (escalade) | 200 | **403** |
| `POST /api/permits/:id/approve` | 403 | 404 *(accepté : `technical_director` ≥ `team_leader`)* |

**D2 — le propriétaire :** `GET /api/tenant/users`, `POST /api/tenant/roles` et
`PATCH …/permissions` passent de **403 à 200**. `technical_director` reste à 403.

**D3 — les quatre routes :**

| appel | avant | après |
|---|---|---|
| `GET /api/federated-ai/improvement-stats` (admin) | 401 « Tenant ID requis » | **200**, données servies |
| `POST /api/federated-ai/recommendations` (admin) | 401 | **200** |
| `GET /api/tenant/security-stats` (anonyme) | 403 — route atteinte sans session | **401 AUTHENTICATION_REQUIRED** |
| `GET /api/tenant/security-stats` (admin) | 403 « Accès réservé aux administrateurs » | **403 MFA_REQUIRED**, `setupRequired: true` |

La dernière ligne demande une explication. `routes.ts:3464` pose
`app.use('/api/tenant/security-*', mfaEnforcementMiddleware)` : cette route est
**volontairement** derrière l'authentification à deux facteurs. Déclarée trop tôt, elle
passait aussi sous ce garde-fou sans le voir. Elle y est maintenant soumise, comme son
auteur l'avait prévu, et son refus est devenu **actionnable** (« configurez le MFA »)
au lieu d'être faux (« réservé aux administrateurs », alors que l'administrateur était
refusé lui aussi).

> **Limite de la vérification, explicitement.** Le corps du gestionnaire de
> `security-stats` n'a **pas** été exercé de bout en bout : la politique MFA de la
> plateforme l'exige pour `admin` et `owner`, et aucun compte du seed n'a de MFA
> enrôlé. Ce qui est prouvé, c'est que la cause racine est levée — `req.user` est lu
> par le middleware MFA, et `req.tenantId` est servi aux trois routes fédérées voisines
> enregistrées par le même appel, qui rendent 200 avec leurs données. Cette politique
> MFA est antérieure au lot et n'a pas été touchée.

**D4 :** `admin` 200, `technicien` 403 (inchangé), `owner` 200, et `super_admin` est
reconnu par sa constante au lieu d'une chaîne qui n'existait pas.

**D5 :** plan préventif inexistant **200 → 404**. Les trois suppressions du module
partagent enfin le même contrat (plan 404, pièce 404, ordre 404).

### Ce qui n'a PAS été corrigé, et pourquoi

Deux listes de rôles écrites à la main subsistent dans
`server/tenant-permissions-routes.ts`. Elles ne gardent aucun accès — elles
**calculent un corps de réponse** — et les corriger changerait un contrat d'API, ce que
la consigne réserve à une justification explicite. Signalées, laissées en place :

1. **Lignes 130-133**, dans `GET /api/tenant/users` : `modulePermissions` est calculé
   par `["manager","director","admin"].includes(user.role)` et trois variantes. Ces
   listes emploient la nomenclature fantôme : un `maintenance_manager` réel n'est pas
   `manager`, donc la matrice affichée est fausse pour la plupart des rôles du
   référentiel.
2. **Lignes 405-460**, dans `GET /api/tenant/roles` : le catalogue des rôles proposés
   expose `supervisor`, `manager` et `director` au lieu des neuf rôles du référentiel,
   avec des niveaux (1 à 5) qui ne sont pas ceux de `shared/roles.ts` (0 à 7).

C'est **le même défaut de fond que D1**, déplacé dans la couche d'affichage. Il mérite
son propre lot, avec l'écran de permissions, parce qu'il touche ce que l'interface
montre et non ce que le serveur autorise.

Incidente, hors périmètre : `POST /api/access/grant` répond **500** à un corps invalide
au lieu de 400.

---

## 3. Tests — périmètre réellement exécuté

| Suite | Résultat |
|---|---|
| `tests/unit` (23 suites) | **157 réussis, 0 échec** |
| `tests/integration` (14 suites) | **145 réussis**, 4 ignorés, 7 `todo`, 0 échec |
| dont `tests/integration/roles-serveur.test.ts` *(nouveau)* | **17 réussis** |

**Attention au chiffre de 355.** Ces 355 tests (227 unitaires + 128 d'intégration) ont
été comptés sur la branche du **lot client**, qui descend de la refonte UX/UI et porte
ses propres suites. La présente branche descend d'`origin/main` : son socle unitaire
est plus petit (157), et l'intégration y passe de 128 à **145** grâce aux 17 nouveaux.
Les deux nombres ne sont donc pas comparables tels quels — la vérification qui compte
est celle du §4, sur la **fusion des deux lots**.

Environnement d'exécution : base dédiée `maintrix_test_lot_serveur`, serveur
`NODE_ENV=test` sur le port 5070, `drizzle-kit push` + `tests/seed.ts`.

Les 17 nouveaux tests échouent sur le code d'avant — c'est leur raison d'être. Ils
contrôlent systématiquement **ce qui est écrit en base**, pas seulement le code HTTP :
une correction de validation qui renverrait 400 tout en écrivant quand même serait
prise en défaut.

---

## 4. Dépendance avec le lot client, et recommandation de fusion

### La dépendance, dans cet ordre

Le lot client `9be3c46` a **gelé** deux comparaisons
`["admin","director"].includes(user.role)` —
`client/src/pages/tenant-permissions.tsx` et
`client/src/components/modern-navigation.tsx` — dans la liste `ECARTS_GELES` de
`tests/unit/roles-cote-client.test.ts`, avec ce motif : « L'alignement correct demande
de corriger le SERVEUR d'abord. »

**C'est fait.** Le serveur accepte désormais `owner` sur la gestion des comptes. Il en
résulte, tant que le client n'est pas repris, un **piège inverse** : l'interface
continue de masquer l'écran « Permissions » au propriétaire, alors que le serveur le
lui ouvre — une capacité réelle, rendue invisible.

> **Suite requise, dans un troisième lot (client) :** remplacer les deux comparaisons
> par `auMoins(user?.role, 'admin')` et vider `ECARTS_GELES`. Le test de garde-fou
> **restera vert sans cette reprise** — il gèle l'écart, il ne le signale pas — donc
> l'étape ne doit pas être laissée à la vigilance des tests.

### La fusion a été essayée, pas supposée

Une branche de vérification a été créée depuis le lot client, le lot serveur y a été
fusionné, et l'ensemble a été reconstruit puis rejoué. Elle a été supprimée après
mesure : **aucune des deux branches livrées n'a été modifiée.**

| | lot client seul | lot serveur seul | **les deux fusionnés** |
|---|---|---|---|
| fusion | — | — | **sans conflit** (aucun fichier commun) |
| `tsc` application / tests | vert | vert | **vert / vert** |
| `tests/unit` | 227 | 157 | **229** (24 suites) |
| `tests/integration` | 128 | 145 | **145** (14 suites) |
| **total vert** | 355 | 302 | **374** |

Les 355 tests précédemment verts le restent : 374 = 355 + 2 unitaires et 17
d'intégration ajoutés par ce lot. Aucun test existant n'a été modifié ni retiré.

### Recommandation

1. **Fusionner ce lot serveur en premier.** Il est autonome, part d'`origin/main`, ne
   touche aucun fichier client et ne dépend d'aucun autre lot.
2. **Puis le lot client** `claude/objective-knuth-66e22f`, qui porte la refonte UX/UI
   (lots 1 à 3) en plus de l'alignement des rôles.
3. **Puis le troisième lot** décrit ci-dessus, qui lève les deux écarts gelés.

Les deux branches ne se recouvrent sur **aucun fichier** : le lot client ne modifie que
`client/src/**`, `tests/unit/roles-cote-client.test.ts` et `docs/audit-ux/**` ; ce
lot-ci ne modifie que `server/**`, `shared/roles.ts`, `tests/unit/roles.test.ts`,
`tests/integration/roles-serveur.test.ts` et `docs/LOT_SERVEUR_ROLES.md`.

> **`main` local est périmé** (`11b548d`, « Premier commit »). Fusionner vers
> `origin/main` (`e8c413a`).

Rien n'est poussé, rien n'est fusionné, aucun déploiement n'a été fait : ce sont des
décisions de l'utilisateur.

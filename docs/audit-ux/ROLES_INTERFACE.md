# Les rôles deviennent visibles — ce que le serveur accorde, ce que l'interface montre

Application du **deuxième principe** du §7 de [AUDIT_GMAO.md](AUDIT_GMAO.md) :
« Les rôles deviennent visibles. Le RBAC existant est branché là où il évite
une promesse creuse. **Le serveur reste seul juge.** »

Le §5 avait établi le défaut : un RBAC complet existe côté serveur, mais
l'interface ne le consulte presque nulle part — elle propose donc des actions
que le serveur refusera, et laisse découvrir le refus après coup. Un seul cas
avait été traité : la suppression d'un ordre de travail (commit `7b9002d`).

---

## 1. Méthode

Rien ici ne vient d'une lecture du code seule.

**Côté serveur.** Chaque action réputée sensible a été appelée avec un
identifiant **inexistant**, sur trois sessions ouvertes pour de bon. Le
contrôle de rôle précède la lecture en base, donc le code reçu tranche :

| code | lecture |
|---|---|
| **403** | le rôle est refusé |
| **404** | le rôle est accepté, seul l'objet manque |
| **200 / 400** | accepté, et la suite du traitement a parlé |

Les trois comptes : `admin@maintrix.local` (`admin`), `tech@maintrix.local`
(`technician`), et un compte `owner` déjà présent dans la grappe de test.
`owner` compte double : c'est le rôle AU-DESSUS d'`admin`, celui qu'une
comparaison littérale refuse en silence (voir
`tests/unit/roles-cote-client.test.ts`).

**Côté interface.** Les deux comptes ont été connectés par le **formulaire de
connexion réel**, puis les boutons comptés dans le DOM, page par page, avant et
après la modification.

Environnement : grappe PostgreSQL jetable `127.0.0.1:55433`, serveur
`node dist/index.js`, interface sur `http://localhost:5050`.

---

## 2. Ce que le serveur accorde — mesuré

| Action | Contrôle serveur | admin | technician | owner |
|---|---|---|---|---|
| `DELETE /api/work-orders/:id` | `hasRole('admin','director','technical_director','owner')` | 404 | **403** | 404 |
| `DELETE /api/preventive-maintenance-plans/:id` | idem | 200 | **403** | 200 |
| `DELETE /api/spare-parts/:id` | idem | 404 | **403** | 404 |
| `POST /api/permits/:id/approve` | `auMoins(role,'team_leader')` | 404 | **403** | 404 |
| `POST /api/permits/:id/reject` | `auMoins(role,'team_leader')` | 404 | **403** | 404 |
| `GET /api/system/health` | `requireRole(['admin','owner','super_admin'])` | 200 | **403** | 200 |
| `GET /api/tenant/modules` | `adminConfigGuard` → `admin`, `owner` | 200 | **403** | 200 |
| `PUT /api/tenant/modules` | idem | 200 | **403** | 200 |
| `POST /api/tenant/apply-sector-template` | idem | 404 | **403** | 404 |
| `GET /api/tenant/sector-templates` | *aucun* | 200 | 200 | 200 |
| `GET /api/tenant/users` | `["admin","director"].includes(role)` | 200 | **403** | **403** |
| `POST /api/tenant/roles` | `role !== "admin"` | 200 | **403** | **403** |
| `GET /api/tenant/security-stats` | `role !== "admin"` | **403** | **403** | **403** |
| `GET /api/enterprise-auth/admin/users` | `['owner','admin'].includes(role)` | 200 | **403** | 200 |
| `GET /api/enterprise-auth/admin/invitations` | idem | 200 | **403** | 200 |
| `GET /api/work-orders` *(témoin)* | *aucun* | 200 | 200 | 200 |

Les routes `/api/admin/tenants`, `/api/security/tenant-isolation-test` et
voisines portent aussi « Admin access required », mais se gardent par l'en-tête
`x-admin-key` et non par un rôle : hors sujet ici, et aucun écran ne les
appelle.

---

## 3. Ce que l'interface montre désormais

Comptage des boutons dans le DOM, avec les deux comptes connectés pour de bon.

| Écran | Action | Seuil posé | technician avant → après | admin avant → après |
|---|---|---|---|---|
| `/preventive` | corbeille « supprimer le plan » | `auMoins(role,'technical_director')` | **36 → 0** | 36 → 36 |
| `/inventaire`, onglet « Pièces Détachées » | bouton « Supprimer » | `auMoins(role,'technical_director')` | **1 → 0** | 1 → 1 |
| `/permits` (liste **et** panneau de détail) | « Approuver », « Rejeter » | `auMoins(role,'team_leader')` | **1+1 → 0+0** | 1+1 → 1+1 |
| `/erp-configuration`, onglet « Templates Sectoriels » | « Sélectionner » / « Appliquer » | `auMoins(role,'admin')` | **4 → 0** | 4 → 4 |
| `/gmao`, onglet « Ordres de travail » | corbeille | `auMoins(role,'technical_director')` | 0 → 0 *(déjà fait, `7b9002d`)* | — |

Les onglets « Planification » et « Stocks » de la GMAO montent les **mêmes
composants** que `/preventive` et `/inventaire` (`gmao-dashboard.tsx`, lignes
1013 et 1082) — c'est le premier principe du §7, une implémentation par
domaine. Le garde les suit sans être écrit deux fois.

**Ce qui n'a PAS été masqué**, parce que le serveur ne le refuse pas :

* la **modification** d'un plan préventif (36 crayons conservés pour le
  technicien) — seule la suppression est contrôlée ;
* les **entrées, sorties et historique** de stock ;
* les transitions de permis `submit`, `activate`, `complete` et `cancel`, qui
  ne portent aucun contrôle de rôle : le technicien qui exécute les travaux
  garde la main dessus ;
* la **lecture** des secteurs d'activité et de leurs modules, qui reste
  ouverte — seule l'écriture est réservée ;
* l'onglet « Modules ERP », déjà aligné : son contenu dépend d'un `GET` refusé,
  et ce refus portait déjà une explication lisible.

Le seuil des permis est volontairement **`team_leader` et non
`technical_director`** : chef d'équipe, planificateur, magasinier et
responsable maintenance sont au-dessus du seuil serveur. Les masquer leur
retirerait une capacité réelle — c'est le piège inverse, aussi grave que la
promesse creuse.

Là où l'absence de bouton pourrait passer pour une panne, une phrase la
remplace : « Arbitrage réservé au chef d'équipe » sur la carte d'un permis,
« L'approbation et le rejet reviennent au chef d'équipe ou au-dessus » dans son
détail, et un encart « Configuration réservée à l'administrateur » sur les
templates sectoriels.

**Vérifié dans les deux sens.** La suppression d'une pièce détachée et
l'approbation d'un permis ont été exécutées **par l'interface, avec le compte
administrateur**, et ont abouti (0 pièce restante ; permis passé à `approved`,
`approvedById = 1`). Masquer n'a rien cassé.

---

## 4. Un garde-fou de plus

`tests/unit/roles-cote-client.test.ts` interdisait déjà `user.role === "admin"`.
Il gagne deux contrôles :

1. **La liste de rôles écrite à la main** — `["admin","director"].includes(user.role)` —
   ne contient aucun `===` et échappait donc au premier filtre. Elle est
   pourtant plus trompeuse : elle a l'air d'un référentiel, ne rattrape aucun
   alias de la base (`manager`, `supervisor`, `maintainer`) et oublie les rôles
   au-dessus de ceux qu'elle nomme.
2. **Chaque écran qui appelle une action réservée** doit importer
   `@shared/roles` et poser son seuil par `auMoins(…)`. Sept écrans sont
   nommés ; le test échoue si l'un perd son garde.

La liste des écarts gelés est *fermée* : si une occurrence disparaît, le test
échoue aussi, pour qu'elle ne devienne pas une permission dormante.

---

## 5. Défauts serveur relevés, NON corrigés

Ce lot ne touche ni `server/`, ni `shared/`, ni `migrations/`.

1. **Le rôle fantôme `director`.** Il figure dans les trois contrôles de
   suppression de `gmao-routes.ts` (lignes 511, 674, 825) et dans
   `tenant-permissions-routes.ts` (58, 173), mais **n'existe dans aucun
   référentiel de rôles**. La branche est morte : aucun compte ne peut la
   satisfaire.

2. **`["admin","director"].includes(…)` échappe au garde-fou.**
   `client/src/pages/tenant-permissions.tsx` et
   `client/src/components/modern-navigation.tsx` comparent encore les rôles
   ainsi. Les deux occurrences ont été **gelées plutôt que corrigées** : elles
   recopient exactement le contrôle du serveur. Mesuré, `GET /api/tenant/users`
   rend **403 au propriétaire** — élargir l'interface à `auMoins(role,'admin')`
   rouvrirait la promesse creuse au détriment du compte principal de
   l'organisation. **L'alignement correct demande de corriger le serveur
   d'abord** : le propriétaire d'un locataire ne peut aujourd'hui ni consulter,
   ni modifier les permissions de ses propres comptes, ni créer un rôle
   personnalisé.

3. **`GET /api/tenant/security-stats` est refusée à tout le monde**, y compris
   à l'administrateur (mesuré : 403 sur les trois comptes). La route est
   déclarée sans middleware d'authentification, donc `req.user` est vide et
   `req.user?.role !== "admin"` est toujours vrai. Aucun écran ne l'appelle —
   la capacité est inerte, pas seulement invisible.

4. **`adminConfigGuard` cite `"Super-admin"`** (`feature-middleware.ts:101`),
   comparé tel quel à `req.user.role`, qui vaudrait `super_admin`. Second rôle
   fantôme, même mécanisme.

5. **`DELETE /api/preventive-maintenance-plans/:id` répond 200 sur un
   identifiant inexistant**, là où les deux autres suppressions rendent 404.
   L'interface ne peut pas distinguer une suppression réelle d'un coup dans le
   vide.

---

## 6. Tests

* `tests/unit` — **227 tests, 24 suites, tous verts**, dont les 10 de
  `roles-cote-client.test.ts`.
* `tests/integration` — **128 tests, 13 suites, tous verts** (4 ignorés,
  7 `todo`), sur une base provisionnée par `drizzle-kit push` + `tests/seed.ts`
  et un serveur dédié.

# Examen : les routes qui écrivent `req.body` sans liste blanche

*Examen du 26 octobre 2026, demandé après la correction de
`PUT /api/equipment/:id` (voir `CREATION_EQUIPEMENT.md`), où le corps de la
requête pouvait écrire `tenantId` et faire changer une fiche d'entreprise.*

**Ce document est un constat, pas un correctif.** Aucune des anomalies décrites
ci-dessous n'est corrigée. Chacune a été **vérifiée sur banc** et relue dans la
base, jamais déduite d'une lecture de code.

---

## Résumé

| | Anomalie | Vérifiée | Gravité |
|---|---|---|---|
| **A** | `PUT /api/maintenance-plans/:id` — écrit le plan préventif **d'une autre entreprise** | oui | **critique** |
| **B** | `PATCH /api/permits/:id` — écrit le permis de travail **d'une autre entreprise** | oui | **critique** |
| **C** | `PUT /api/work-orders/:id` — le corps impose `tenantId` : l'ordre **quitte** son entreprise | oui | élevée |
| **D** | `PUT /api/spare-parts/:id` — idem pour une pièce | oui | élevée |
| **E** | `POST /api/procurement/suppliers` — le corps choisit l'entreprise **à la création** | oui | élevée |
| **F** | `POST /api/report` — idem pour un cas signalé | oui | élevée |
| **G** | 5 autres créations de même signature, non éprouvées une à une | non | à confirmer |

Et un **contrôle positif** : `PUT /api/user-profiles/:id`, mis en liste blanche
lors d'une campagne précédente, **résiste** — un technicien envoyant
`{ role: "owner" }` obtient 200 et son rôle reste `technician`. Le défaut est
donc bien l'absence de liste blanche, et non autre chose.

---

## Comment l'examen a été mené

**Le balayage porte sur l'écriture, pas sur les chemins** — leçon du lot
précédent, où une porte d'inscription au parc n'avait pas « equipment » dans son
URL. Trois motifs recherchés dans `server/*.ts` :

1. `...req.body` épandu dans une écriture ;
2. `const x = req.body` passé tel quel à une méthode de stockage ;
3. `.set({ ...x })` et `.values({ ...x })` dans la couche de stockage, puis
   remontée vers les appelants HTTP.

Sur **245 routes d'écriture**, cela a isolé **13 points** à examiner. Chacun a
ensuite été classé selon un critère précis, et c'est lui qui fait tout l'examen :

> **Un `z.object({...}).parse(req.body)` est une liste blanche par
> construction** : Zod *retire* les clés inconnues. Le danger n'est donc pas
> « absence de `.strict()` », mais :
> - **aucun schéma** — le corps part entier dans l'écriture ;
> - **un schéma qui CONTIENT le champ sensible** — typiquement
>   `createInsertSchema(table)`, qui inclut `tenantId` si on ne l'omet pas.

Un troisième motif, cherché et **absent partout** : `{ tenantId, ...req.body }`,
où le corps écraserait le locataire de la session. L'ordre correct
(`{ ...req.body, tenantId }`) est respecté dans les 7 endroits concernés.

---

## Ce qui est sain, et pourquoi

Pour que le constat soit utile, voici ce que l'examen **écarte** :

- `advanced-integrations-routes.ts` (4 routes ERP, SCADA, modèles IA, PowerBI
  workspaces) : `insertXSchema.parse({ ...req.body, tenantId })` — locataire de
  confiance en dernier, clés inconnues retirées ;
- `rcm-routes.ts`, `smm-routes.ts` (4 routes) : schémas Zod explicites
  n'exposant pas `tenantId` ;
- `POST /api/feedback`, `POST /api/diagnostic/analyze` : **lisent des champs
  nommés** (`data.equipmentType`…) au lieu d'épandre le corps — liste blanche
  par construction ;
- `POST /api/permits` (création) : champs de confiance placés après l'épandage ;
- `PUT /api/alerts/:id` : `updateAlert` **extrait `tenantId`** des champs
  modifiables, avec un commentaire qui tient exactement le bon raisonnement ;
- `PUT /api/user-profiles/:id` : liste blanche de 8 champs, et un message qui
  **nomme** les champs refusés au lieu de les ignorer.

**Les deux derniers sont le point important de cet examen** : le remède existe
déjà dans ce dépôt, écrit, commenté, motivé par des incidents réels (des comptes
retrouvés désactivés les 27 septembre et 11 octobre 2026). Il n'a simplement
jamais été généralisé. Aucune des six anomalies ci-dessous ne demande donc
d'invention — seulement l'application d'un motif déjà présent.

---

## A — `PUT /api/maintenance-plans/:id` : écrire chez autrui

**Trois défauts cumulés**, dans `server/routes.ts` (~1948) et
`server/storage.ts:493` :

1. la route n'appelle **pas** `tenantRequis` ;
2. `updatePreventiveMaintenancePlan(id, updates)` ne reçoit **aucun locataire**,
   et sa clause est `.where(eq(preventiveMaintenancePlans.id, id))` — l'`id`
   seul ;
3. le corps est filtré par une **liste noire** (`delete updates.id`,
   `delete updates.createdAt`) qui ne retire pas `tenantId`.

**Mesuré.** Un technicien du locataire Alpha, sur un plan appartenant à Beta :

```
PUT /api/maintenance-plans/<id de Beta>
{ "planName": "DÉTOURNÉ-PAR-ALPHA", "tenantId": "<Alpha>" }
→ HTTP 200
```

En base, après l'appel : `plan_name = DÉTOURNÉ-PAR-ALPHA`, et
`tenant_id = Alpha`. Le plan de maintenance d'une entreprise a été **renommé et
approprié** par un utilisateur d'une autre, au niveau de rôle le plus bas.

C'est strictement plus grave que le défaut corrigé sur les équipements : là, la
clause `WHERE` cloisonnait au moins la ligne atteinte.

## B — `PATCH /api/permits/:id` : idem sur un document de sécurité

`server/permit-to-work-routes.ts:275`. Le permis est lu
(`.where(eq(permitToWork.id, id))`) puis écrit (même clause) **sans locataire**,
et le corps passe par une liste noire (`status`, `permitNumber`, `createdAt`)
qui laisse `tenantId`.

**Mesuré**, mêmes acteurs : `HTTP 200`, titre remplacé, `tenant_id` devenu
Alpha. Un **permis de travail** est un document de sécurité : l'autorisation de
travaux par points chauds, consignation, espace confiné. Qu'il soit modifiable
depuis une autre entreprise dépasse la question du cloisonnement des données.

## C et D — le corps impose le locataire, et le refus est trompeur

`PUT /api/work-orders/:id` (`server/gmao-routes.ts:602`) et
`PUT /api/spare-parts/:id` (`:1123`) font tous deux `const updates = req.body`
puis le passent à un `.set({ ...updates })`. Ici la clause `WHERE` **est**
cloisonnée : on ne peut donc écrire que chez soi. Mais on peut **pousser sa
propre ligne dehors** en écrivant `tenantId`.

**Mesuré** — un responsable maintenance d'Alpha :

```
PUT /api/work-orders/<id>      { "tenantId": "<Beta>" }  → HTTP 403
PUT /api/spare-parts/<id>      { "tenantId": "<Beta>" }  → HTTP 403
```

…et dans les deux cas, la ligne est **passée chez Beta**.

> **Le 403 est le piège.** Il ne vient pas d'un contrôle d'accès : c'est le
> filet anti-fuite posé sur la **réponse** (`CROSS_TENANT_DATA_DETECTED`) qui
> voit revenir une donnée d'un autre locataire et refuse de la transmettre.
> L'écriture, elle, est déjà commise. **Un test qui n'observe que le code de
> retour est vert sur une fuite réelle** — c'est pourquoi tout l'examen relit la
> base.

## E et F — le corps choisit le locataire dès la création

`POST /api/procurement/suppliers` (`procurement-routes.ts:65`) et
`POST /api/report` (`routes.ts:1657`) appliquent au corps brut un schéma dérivé
de `createInsertSchema(table)`, **sans omettre `tenantId`** et **sans le
surcharger** ensuite.

**Mesuré** — un technicien d'Alpha, en désignant Beta dans la charge utile :
HTTP 403 (toujours le filet sur la réponse), et la ligne **naît chez Beta**.
Un fournisseur ou un signalement peut donc être injecté dans le référentiel
d'une autre entreprise.

## G — cinq créations de même signature, non éprouvées

Même motif statique (`insertXSchema.parse(req.body)`, schéma incluant
`tenantId`, aucune surcharge). Routes réelles et montées, mais je ne les ai pas
exercées une à une :

- `POST /api/power-bi/reports` (`advanced-integrations-routes.ts:490`)
- `POST /api/predictive-analytics` (`gmao-routes.ts:1300`)
- `POST /api/kpi-metrics` (`gmao-routes.ts:1341`)
- `POST /api/integration-logs` (`gmao-routes.ts:1466`)
- `POST /api/procurement/reorder-rules` (`procurement-routes.ts:237`)

À traiter comme « probable » et non « constaté », tant qu'elles ne sont pas
mesurées — c'est la distinction que cet examen s'efforce de tenir.

---

## Le remède, en trois formes déjà présentes dans le dépôt

Par ordre de préférence :

1. **Liste blanche en `.strict()`** sur la mise à jour, qui **refuse** un champ
   inconnu au lieu de l'ignorer — ignorer laisse croire que l'écriture a pris
   effet (`miseAJourEquipementSchema`, `shared/schema.ts`).
2. **Omettre `tenantId` du schéma d'insertion**, ou le surcharger après
   l'épandage : `{ ...data, tenantId }`, jamais l'inverse.
3. **Locataire obligatoire et positionnel** dans la méthode de stockage, dans la
   clause `WHERE` **et** retiré des champs écrits — c'est ce que fait déjà
   `updateAlert`.

Pour A et B, le point 3 est indispensable : une liste blanche seule les
laisserait écrire chez autrui, simplement sans changer le propriétaire.

**Un garde-fou statique vaut mieux qu'une liste de routes corrigées.** Six
anomalies aujourd'hui, mais rien n'empêche la septième : un test qui balaye les
écritures et exige, pour chaque `.set({ ...x })` / `.values(...)` atteignable
depuis une route, que `x` soit la sortie d'un schéma — et que ce schéma n'expose
pas `tenantId`. L'énumération ne protège que du passé.

---

## Périmètre de l'examen

**Couvert** : les 245 routes `post`/`put`/`patch` de `server/*.ts`, filtrées sur
les trois motifs d'écriture du corps décrits plus haut ; les schémas
d'insertion associés ; la couche de stockage pour les épandages.

**Non couvert**, et donc non conclu :
- les routes `delete` ;
- la **lecture** (une route qui lit sans cloisonnement est un autre sujet, déjà
  traité par d'autres campagnes) ;
- `cognitive-routes.ts:118`, qui passe le corps brut à
  `kernel.processClosedLoop(...)` : je n'ai pas tracé si cela aboutit à une
  écriture ;
- les 47 insertions dont l'argument est construit par la route : saines dans les
  cas relevés, mais non toutes éprouvées ;
- l'escalade de **privilège** par le corps (hors `tenantId`) : seul
  `user-profiles` a été vérifié, et il résiste.

**Banc** : grappe PostgreSQL jetable (`initdb -E UTF8`, port 55443 puis 55445,
`data_directory` confirmé après démarrage), schéma par `drizzle-kit push`,
`tests/seed.ts`, serveur bâti par `npm run build`. Chaque constat est lu dans la
table, et non dans la réponse HTTP.

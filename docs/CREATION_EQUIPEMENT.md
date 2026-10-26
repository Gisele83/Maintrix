# Inscrire un équipement au référentiel du parc

*Lot du 26 octobre 2026. Ferme l'écart que le lot précédent avait assumé et
documenté (voir `IMPORT_EN_MASSE.md`, « Ce qui n'est PAS fermé par ce lot »).*

---

## Le fait qui fonde la décision

`POST /api/equipment` n'avait aucun contrôle de rôle. L'argument avancé la
veille pour ne pas le fermer était : « la restriction porte sur le volume et son
irréversibilité, pas sur le geste ». Le relevé fait pour ce lot montre que
l'argument **jouait en sens inverse** :

> **Il n'existe aucune route de suppression d'équipement.** Ni
> `DELETE /api/equipment/:id`, ni `deleteEquipment` dans le stockage, ni
> `delete(equipmentRegistry)` nulle part.

Une inscription erronée est donc **définitive** du point de vue de l'API — et
aussitôt référencée par les ordres de travail, les plans préventifs, les
compteurs d'usage et les relevés de capteurs. L'import n'a pas d'annulation *en
masse* ; la création unitaire n'en a **aucune**.

Un détail mesuré au passage, sans rapport direct mais utile : l'écran du parc
affiche un bouton « Supprimer » qui appelle `DELETE /api/equipment/:id`, route
**inexistante**. Le bouton échoue donc toujours. Signalé, pas corrigé par ce
lot.

---

## Trois portes, dont une invisible depuis l'URL

| Porte | Où | Qui pouvait agir avant |
|---|---|---|
| `POST /api/equipment` | `server/gmao-routes.ts` | **tout le monde** |
| `POST /api/work-orders` avec un `equipmentName` inconnu | même fichier, dans la branche « find-or-create » | **chef d'équipe (2) et au-dessus** |
| `PUT /api/equipment/:id` | même fichier | **tout le monde** (voir « Modifier une fiche » plus bas) |

La seconde est le cœur du lot. Un nom d'équipement inconnu déclenchait une
inscription **silencieuse et dégradée** : `equipmentType: 'Generic'`, lieu
« Non spécifié », aucun numéro de série. Garder cette porte ouverte aurait
rendu la garde de `POST /api/equipment` contournable **d'une faute de frappe**
dans le formulaire d'ordre de travail.

Rien dans son chemin ne parle d'équipement : un relevé par URL ne l'aurait
jamais trouvée. C'est pourquoi le garde-fou statique de ce lot balaye les
**écritures** (`createEquipment(`) et non les chemins.

---

## Le seuil : `maintenance_manager` (4)

Même valeur que l'import en masse, et ce n'est pas une coïncidence : c'est le
même acte — inscrire au référentiel — à des volumes différents. Deux seuils
distincts auraient produit l'absurdité de rendre l'ajout d'une machine plus
difficile que celui de cent.

Le seuil reste **sous** `technical_director` (5) : un responsable maintenance
doit pouvoir inscrire une machine qui arrive dans l'atelier sans dépendre du
directeur technique.

La valeur vit dans `shared/creation-equipement.ts`, lue par le serveur **et**
par l'interface. Elle est **nommée séparément** de celle de l'import bien
qu'elle lui soit égale : ce sont deux décisions, et les confondre ferait
qu'abaisser l'une abaisserait l'autre en silence. Un test constate l'égalité,
pour qu'une divergence future soit relue plutôt que subie.

---

## Restreindre l'inscription sans amputer l'arbitrage

C'est la contrainte qui a guidé la mise en œuvre. Le niveau de création d'un
ordre de travail reste `team_leader` (2) : il ne devait pas monter.

Sur la seconde porte, on refuse donc **l'inscription, pas l'ordre**. Le message
le dit, parce que l'appelant *a* le droit de créer l'ordre et ne comprendrait
pas un « droits insuffisants » :

> Aucun équipement nommé « … » n'existe dans le référentiel, et l'y inscrire
> demande au moins un responsable maintenance. Choisissez un équipement
> existant dans la liste, ou faites-le inscrire au parc.

**Deux barrières différentes selon le rôle**, et la suite de tests les
distingue :

| Rôle | `POST /api/equipment` | Ordre + nom inconnu | Barrière qui parle |
|---|---|---|---|
| `technician` (1) | 403 | 403 | la garde des **ordres** — n'atteint jamais la seconde porte |
| `team_leader` (2) | 403 | 403 | la garde du **référentiel** (`champ: equipmentName`) |
| `procurement` (3) | 403 | 403 | la garde du **référentiel** |
| `maintenance_manager` (4) | **201** | **201** | — |

Ne tester que le technicien aurait donné un 403 rassurant qui ne prouve **rien**
sur la porte dérobée, puisqu'il ne l'avait pas atteinte.

---

## Côté interface : remplacé, pas masqué

Deux écrans l'offraient, via le composant partagé
`client/src/components/equipement-reserve.tsx` :

- **le registre du parc** (`equipment-management`) : le bouton « Nouvel
  équipement » et celui de l'état vide cèdent la place au bloc d'explication.
  La phrase de l'état vide change aussi — « Commencez par ajouter votre premier
  équipement » n'apparaît plus qu'à qui peut le faire ;
- **le formulaire d'ordre de travail** : le raccourci « L'équipement n'est pas
  dans la liste » disparaît au profit de la règle. Le sélecteur d'équipements
  existants, lui, reste entier — c'est ce qui permet au chef d'équipe de
  continuer son travail.

Vérifié dans les deux sens au navigateur : pour un chef d'équipe, « Nouvel
ordre de travail » reste offert et le raccourci est remplacé ; pour un
responsable, le raccourci revient et le bloc disparaît. Couleurs mesurées par
`getComputedStyle` (fond `rgb(244,247,250)`, texte `rgb(1,21,53)`), donc les
classes de charte produisent bien des règles.

---

## Un test d'intégration a dû changer de compte

`tests/integration/concurrency.test.ts` faisait courir trois écritures
simultanées du même identifiant d'équipement, dont une par `techAlpha`. Depuis
ce lot, un technicien est refusé en **403 avant la collision** : la course ne
mesurerait plus rien.

Le second écrivain est donc un autre utilisateur **habilité** du même tenant.
Ce que le test protège est conservé à l'identique — deux écritures
concurrentes, un seul enregistrement, aucune 500 — et le droit du technicien,
qui n'était pas son objet, est vérifié dans la suite dédiée. Le commentaire du
test dit tout cela sur place, pour qu'on n'y lise pas un relâchement.

---

## Vérification

Banc sans Docker : grappe PostgreSQL jetable (`initdb -E UTF8`, port **55443**),
schéma par `drizzle-kit push`, `tests/seed.ts`, serveur bâti sur le port 55552.

> **Piège rencontré, à retenir** : le port 55442 était déjà occupé par la
> grappe d'une **autre session**. `pg_ctl` a signalé l'échec du démarrage, mais
> le `CREATE DATABASE` qui suivait a réussi — **dans la grappe voisine**. La
> base créée par erreur (vide) a été retirée et l'état de l'autre session
> rétabli. Toujours vérifier qu'un port est libre *avant* de s'en servir, et
> confirmer le `data_directory` après démarrage.

Mesuré en pilotant la vraie API puis en relisant `equipment_registry`, pas la
réponse : seules les deux lignes du responsable existent, aucune pour les trois
rôles refusés, chacune portant son locataire.

- `tests/integration/creation-equipement-restreinte.test.ts` — **18 tests**
  (les trois portes) ;
- `tests/unit/creation-equipement-garde.test.ts` — **23 tests**, dont le
  balayage des écritures (`createEquipment` *et* `updateEquipment`), le
  verrouillage de la liste blanche, et un test qui **casse volontairement** si
  une suppression d'équipement apparaît un jour, pour que la justification du
  seuil soit relue ;
- lanes complètes : **424 tests unitaires** (36 suites) et **448
  d'intégration** (29 suites) verts ;
- `npm run check`, `check:tests`, `check:scripts` : verts (`--incremental
  false`, codes de sortie relevés).

---

## Modifier une fiche : `PUT /api/equipment/:id`

*Fermé dans le même lot, sur décision de l'utilisateur. J'avais écrit ici qu'un
découpage par champ serait nécessaire « puisqu'un technicien doit pouvoir
changer l'état opérationnel » : **c'était faux**, et la mesure l'a réfuté.*

Le parcours d'un technicien ne passe pas par cette route. L'`operationalState`
est basculé **côté serveur** par la clôture d'un ordre
(`server/cloture-ordre-travail.ts`) et par la mise à l'arrêt pour intervention.
Le seul appelant vivant est le formulaire d'administration du parc, qui envoie
les 14 champs métier de la fiche. La file hors-ligne rejoue aussi des
`equipment_update`, mais **aucun producteur n'en enfile** : chemin dormant,
donc aucune perte. Un seuil unique suffit, et c'est celui de l'inscription —
corriger la plaque, le type ou la criticité engage le référentiel autant que de
créer la fiche. Un seuil plus bas aurait d'ailleurs permis de contourner la
garde de création : inscrire une fiche vide, puis la remplir.

### Le défaut le plus grave n'était pas le rôle

Cette route passait `req.body` **tel quel** à `updateEquipment`, qui fait
`.set({ ...updates })`. N'importe quel champ de la table était donc écrivable,
**`tenantId` compris**.

Mesuré sur le banc, avant correction : un technicien envoyant
`{ tenantId: <autre locataire> }` a bel et bien fait **passer la fiche chez
l'autre entreprise**. La clause `WHERE` cloisonne la ligne qu'on atteint, pas la
valeur qu'on y écrit.

Et le piège est dans ce qui suivait : le filet anti-fuite posé sur la
**réponse** voyait une donnée d'un autre locataire et renvoyait
`403 CROSS_TENANT_DATA_DETECTED`. L'appelant lisait donc un **refus alors que
l'écriture était déjà commise**. Un test qui n'observe que le code de retour
serait resté vert sur une fuite réelle — c'est pourquoi le test de ce lot relit
la table.

La correction est une **liste blanche** (`miseAJourEquipementSchema`,
`shared/schema.ts`), `.strict()` pour **refuser** un champ inconnu plutôt que
l'ignorer : ignorer laisserait l'appelant croire son écriture prise en compte.
`id`, `tenantId`, `createdAt` et `updatedAt` n'y figurent pas — l'identité
technique et l'appartenance à une entreprise ne se changent pas par un
formulaire. Les 14 champs retenus sont exactement ceux que le formulaire envoie,
relevés et non supposés.

### Avant / après, lu dans la table

| | nom | `tenant_id` | criticité |
|---|---|---|---|
| **avant** — technicien renomme puis écrit `tenantId` | `RENOMMÉ-PAR-LE-TECHNICIEN` | **…be7a (Beta)** | `critical` |
| **après** — mêmes appels | inchangé | …a1fa (Alpha) | `medium` |

Et le témoin : un responsable modifiant `location` + `criticalityLevel` obtient
toujours 200, valeurs vérifiées en base.

Côté interface, le crayon et la corbeille de chaque fiche suivent ce droit. La
fiche **reste consultable** : pour un technicien, 25 fiches affichées, 0 crayon,
0 corbeille — c'est la lecture qui compte dans son travail.

---

## Ce qui reste ouvert

- **La création implicite subsiste pour les habilités, et reste dégradée.** Un
  responsable qui saisit un nom inconnu dans un ordre de travail crée encore une
  fiche `equipmentType: 'Generic'`, lieu « Non spécifié ». Mesuré. La supprimer
  ou la compléter est un choix de conception distinct de la question des droits.
- **Aucune suppression d'équipement n'existe**, et le bouton « Supprimer » de
  l'écran du parc appelle une route absente — il échoue donc toujours, pour
  tout le monde.
- **La file hors-ligne reste à reprendre avant usage** : elle rejoue des
  `equipment_update` et supprime l'action après trois échecs avec un simple
  `console.warn`. Dormante aujourd'hui, elle perdrait des saisies le jour où un
  producteur l'alimenterait.
- **Le filet anti-fuite agit sur la réponse, pas sur l'écriture.** Ce lot
  supprime le chemin qui l'exploitait sur les équipements, mais le filet reste
  structurellement incapable d'empêcher une écriture : il la constate. Les
  autres routes qui passent `req.body` sans liste blanche méritent le même
  examen.

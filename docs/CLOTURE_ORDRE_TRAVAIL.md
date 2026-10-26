# La clôture d'un ordre de travail

*Correctif du 26 octobre 2026. Répond au défaut le plus structurant de l'audit
fonctionnel du 25 octobre 2026 (section 1 : « la clôture d'un ordre de travail
ne transmet rien »).*

Dans une GMAO professionnelle, la clôture d'un OT est l'événement qui irrigue
tout le reste : elle consomme les pièces, fait avancer l'échéance du plan
préventif, rend l'équipement disponible et nourrit l'historique de fiabilité.
Ici, elle ne déclenchait qu'une tentative de génération de rapport HTML qui
n'était **même pas enregistrée** — le commentaire du code le disait lui-même.

---

## Ce qui a été mesuré, avant et après

Banc identique des deux côtés : grappe PostgreSQL jetable, locataire Alpha, un
OT préventif rattaché à un plan mensuel dû le lendemain, une pièce à 10 en
stock, un équipement déclaré `maintenance`, et une clôture déclarant trois
pièces. Le code d'**avant** (`git archive HEAD`) et celui d'**après** tournaient
en même temps, sur deux bases de la même grappe.

| Relevé en base | AVANT | APRÈS |
|---|---|---|
| Code HTTP | 200 | 200 |
| `preventive_maintenance_plans.next_due` | inchangé (**+0 j**) | **+31 j** — une période exacte |
| `preventive_maintenance_plans.last_executed` | **nul** | renseigné |
| `spare_parts.current_stock` | 10 → **10** | 10 → **7** |
| `stock_movements` | **aucun** | 1 × `OUT` qty 3 (10→7, `WORK_ORDER`, locataire posé) |
| `equipment_registry.operational_state` | inchangé | `maintenance` → `operational` |
| `maintenance_counters.current_value` | inchangé | remis à sa valeur de départ, alerte levée |
| `counter_history` | **aucune ligne** | le relevé d'avant, rattaché à l'ordre |
| `work_orders.actual_end` | **nul** | renseigné |

Le **200 des deux côtés** est le cœur du problème : la clôture répondait
« c'est fait » en n'écrivant rien. C'est pourquoi aucune assertion de la suite
de tests ne se contente d'un code de retour.

`actual_end` resté nul est une découverte de la mesure, absente de l'audit : la
clôture n'enregistrait même pas la date de fin du travail, et
`lastExecuted = actualEnd` n'aurait donc rien eu à lire. L'interface envoie
`{ status: "completed" }` et rien d'autre.

---

## L'obstacle : `work_orders` ne portait aucun lien vers son plan

`plan_id` existait dans `shared/schema.ts`, mais sur `maintenance_counters`.
Sans ce lien, la clôture ne **pouvait pas** savoir quel plan replanifier.

Correction = migration de schéma : [`0024_work_order_closure_loops.sql`](../migrations/0024_work_order_closure_loops.sql).
Vérifiée en base sur les **deux** chemins de construction du schéma —
`drizzle-kit push` (celui des tests) et `drizzle-kit migrate` (celui du
déploiement) — qui donnent le même résultat :

```
plan_id           | integer | nullable | pas de défaut
requires_shutdown | boolean | NOT NULL | défaut false
FOREIGN KEY (plan_id) REFERENCES preventive_maintenance_plans(id)
```

`npm run verify:migrations` : 25 migrations au journal, 112 tables et 202 clés
étrangères des deux côtés, aucun écart.

**Aucun rattrapage n'est tenté sur les lignes existantes.** On pourrait
rapprocher chaque OT préventif du plan qui couvre son équipement, mais ce serait
une attribution par ressemblance : plusieurs plans peuvent couvrir le même
équipement, et un faux rattachement ferait avancer l'échéance d'un plan sur la
foi d'une intervention qui relevait d'un autre. Même décision que la migration
0023 pour les bons de commande, qui **refuse** plutôt que d'attribuer au hasard.

---

## Le calcul de la prochaine échéance

Code : [`shared/replanification-preventive.ts`](../shared/replanification-preventive.ts).
Fonction pure, sans base — c'est la partie du correctif où une erreur ne se voit
pas. Une consommation de pièces qui échoue se lit tout de suite ; une échéance
décalée d'un jour par cycle ne se remarque qu'après un an de dérive.

### On repart de l'échéance prévue, pas de la date de réalisation

Le réflexe serait `next_due = réalisation + période`. C'est faux, et le défaut
est **cumulatif** : un graissage mensuel dû le 1er, fait le 8 parce que
l'atelier était pris, repasserait au 8, puis au 15, puis au 22. Au bout d'un an
le plan a glissé d'un trimestre sans que personne ne l'ait décidé.

L'ancre est donc `next_due` **avant** la clôture. Un retard se rattrape au cycle
suivant au lieu de se propager.

### Un retard de plus d'une période ne laisse pas l'échéance dans le passé

« Ancre + une période » tomberait dans le passé, et le plan ressortirait *en
retard juste après avoir été exécuté*. On avance donc par périodes **entières**
jusqu'à dépasser la réalisation : la grille d'origine est conservée, et le plan
revient devant soi. Les cycles sautés ne sont pas rattrapés — ils n'ont pas eu
lieu, et créer des échéances dans le passé ne ferait pas apparaître le travail
qui n'a pas été fait.

### Deux vocabulaires de fréquence, parce qu'il y en a deux en base

Ce n'est pas une précaution, c'est un relevé :

| Écrit par | Valeurs de `frequency` |
|---|---|
| le formulaire web (`client/src/components/preventive-maintenance.tsx`) | `days`, `weeks`, `months`, `years` |
| l'injecteur de démonstration et le générateur de test | `daily`, `weekly`, `monthly`, `quarterly`, `annually` |
| le commentaire du schéma | une troisième liste, encore différente |

`frequency_value` est un **multiplicateur** dans les deux conventions
(`{ weekly, 2 }` = deux semaines, `{ days, 30 }` = trente jours). N'en
reconnaître qu'une laisserait la replanification muette sur la moitié du parc,
en rendant `null` sans que rien ne le signale.

### Trois cas où l'on ne replanifie pas, et pourquoi ils sont distingués

| Motif | Cas | Conduite |
|---|---|---|
| `frequence_sur_compteur` | `hours_based`, `usage_based`… | normal : l'échéance est une valeur de compteur, que `maintenance_counters` suit. `last_executed` est quand même écrit |
| `frequence_inconnue` | fréquence absente, vide ou non interprétable | anormal : mérite une trace |
| `periode_non_positive` | `frequency_value` à 0 ou négatif | erreur de saisie. **Refus**, et non correction silencieuse vers 1 — lui inventer un sens la rendrait indétectable |

### Détails qui ont chacun coûté un test

- **Jour de mois inexistant** : le 31 janvier + 1 mois n'est pas le 31 avril.
  `setMonth` déborderait sur le mois suivant (3 mars) ; on rabat sur le dernier
  jour du mois d'arrivée (28 février).
- **Le rabattement ne se propage pas** : le calcul part de l'ancre avec un
  multiplicateur, pas en additionnant n fois une période. Sinon
  31 janvier → 28 février → 28 mars, et le 31 est perdu pour toujours.
- **Changement d'heure** : les additions de jours se font en millisecondes UTC,
  pas avec `setDate` qui travaille en heure locale. Les colonnes sont des
  `timestamp` sans fuseau, écrites et relues en UTC.

---

## Stock insuffisant : la clôture est REFUSÉE

**Décision, et les deux conduites qui se défendaient.** Refuser la clôture, ou
la permettre en enregistrant un écart. Ce qui ne se défend pas — et qui était le
comportement réel — est de clôturer en silence sans décrémenter. Le refus a été
retenu, pour quatre raisons :

1. **Le garde-fou existe déjà et il a raison.** `recordStockMovement` refuse
   depuis toujours une sortie qui rendrait le stock négatif. Le respecter plutôt
   que le contourner laisse **une** seule règle sur ce qu'un stock peut valoir,
   au lieu de deux qui se contredisent selon le chemin d'appel.

2. **Un stock négatif empoisonnerait la boucle qu'on ferme.**
   `generateLowStockAlerts()` compare `current_stock <= min_stock` et recommande
   une quantité calculée depuis `current_stock`. Sur une valeur négative,
   l'alerte porte sur des pièces qui n'existent pas et la recommandation de
   commande est fausse. On aurait remplacé « le point de commande ne se
   déclenche jamais » par « il se déclenche sur un chiffre faux » — pire, parce
   que cela inspire une confiance imméritée.

3. **Le refus est rattrapable sur place, et par le bon geste.** L'écart entre le
   magasin physique et le magasin déclaré se régularise par un ajustement
   d'inventaire : `POST /api/stock/adjust` existe et journalise un mouvement
   `ADJUSTMENT` motivé. La clôture n'est pas perdue, elle est différée d'un acte
   explicite et tracé. Un test vérifie ce chemin de bout en bout.

4. **L'échec est bruyant**, et la règle du dépôt est que « un écart silencieux
   est plus grave qu'un échec visible » ([TRANSACTIONS.md](TRANSACTIONS.md)).

**Ce que le refus ne fait pas** : il ne bloque pas les clôtures sans pièces. Une
tournée de graissage se clôture comme avant. Il ne mord que sur une déclaration
que le magasin ne peut pas honorer — c'est-à-dire sur une contradiction que
l'utilisateur vient d'énoncer lui-même.

**Limite assumée** : si le technicien a physiquement monté la pièce, la refuser
en base ne la démonte pas. Mais le stock était déjà faux **avant** la clôture
(la pièce est sortie du magasin sans mouvement) ; le refus révèle cet écart
préexistant au lieu de l'enterrer sous une valeur négative.

**Forme de la réponse** : `409 Conflict` — la requête est bien formée, c'est
l'état du magasin qui la contredit. Un 400 se lirait « vous avez mal saisi ». La
liste **complète** des manques est rendue en structure, référence par référence :
un magasinier à qui l'on annonce une rupture à la fois régularise en autant
d'allers-retours.

```json
{
  "error": "STOCK_INSUFFISANT",
  "message": "Clôture refusée : le stock déclaré n'est pas disponible. …",
  "manques": [
    { "sparePartId": 42, "partNumber": "PN-…", "partName": "…",
      "demande": 5, "disponible": 2, "manque": 3 }
  ]
}
```

---

## L'état opérationnel ne bascule que pour les interventions avec arrêt

`equipment_registry.operational_state` n'était écrit par le serveur qu'à
l'import : un équipement passé en `maintenance` y restait après la réparation.

Faire basculer l'état sur **tout** OT serait faux dans les deux sens. Une
tournée de graissage, un relevé vibratoire ou un contrôle d'alignement se font
machine en marche : les traiter comme un arrêt déclarerait indisponible un
équipement qui produit, et la disponibilité calculée deviendrait fausse à la
baisse. Ne rien distinguer du tout laisse les machines réparées « en
maintenance ».

Il faut donc dire **quelles** interventions arrêtent la machine, et cette
information n'existait pas : d'où `work_orders.requires_shutdown`.

Les règles, et ce que chacune empêche :

| Règle | Défaut évité |
|---|---|
| bascule vers `maintenance` au passage à `in_progress`, **pas** à la création | un ordre en attente n'a pas encore arrêté la machine |
| retour à `operational` à la clôture **seulement s'il ne reste aucun autre OT ouvert avec arrêt** sur l'équipement | deux interventions avec arrêt peuvent être ouvertes ensemble ; remettre en service à la première clôture déclarerait disponible une machine encore consignée |
| on ne bascule que **depuis** `operational`, et on ne revient que **depuis** `maintenance` | `offline` et `decommissioned` sont des décisions d'exploitation ; une intervention ne doit pas les effacer au profit d'un état transitoire |
| les statuts « ouverts » sont définis **en négatif** (tout sauf `completed`/`cancelled`) | la liste des statuts ouverts s'est déjà enrichie une fois (`paused`, `on_hold`) ; une énumération positive oubliée compterait un arrêt en cours comme terminé, et remettrait en service une machine consignée — défaut de sécurité, pas d'affichage |

---

## D'où viennent les pièces consommées

Du **corps de la requête de clôture**, et c'est le seul endroit possible :
aucune table ne porte les pièces d'un ordre de travail, ni prévues ni réservées.
`maintenance_reports.parts_used` existe, mais est écrite *après*, par le rapport
d'intervention — trop tard pour décrémenter. La déclaration du technicien à la
clôture est donc la seule source, et c'est d'ailleurs la pratique : on déclare
ce qu'on a monté, pas ce qu'on avait prévu de monter.

Le format est celui que `/api/stock/auto-deduction` accepte déjà, pour ne pas
introduire un second vocabulaire de pièces dans le même dépôt :

```http
PUT /api/work-orders/:id
{ "status": "completed", "partsUsed": [{ "sparePartId": 42, "quantity": 3 }] }
```

Deux lignes de la **même** référence sont agrégées avant la vérification :
contrôlées séparément, 2 × 6 passeraient sur un stock de 10.

---

## Concurrence

La clôture pose un verrou sur la ligne de l'ordre de travail
(`SELECT … FOR UPDATE`), puis **relit son statut sous ce verrou**. Un ordre déjà
`completed` ne rejoue aucun effet : ni consommation, ni replanification.

Ce n'est pas une précaution théorique. `recordStockMovement` lit le stock puis
écrit une valeur **absolue** : deux clôtures simultanées qui lisent 10
écriraient toutes deux 7 — six pièces sorties, trois décomptées. Les pièces sont
par ailleurs verrouillées dans l'ordre de leur identifiant, pour que deux
clôtures partageant deux références ne s'interbloquent pas.

Vérifié par deux tests : deux clôtures émises **sans s'attendre**, et un rejeu
plus tard. Dans les deux cas, un seul mouvement et une seule période ajoutée.

---

## Vérification

```bash
npm test -- --testPathPatterns=cloture-ordre-travail
npm test -- --testPathPatterns=replanification-preventive
npm test -- --testPathPatterns=cloture-interface
```

- [`tests/unit/replanification-preventive.test.ts`](../tests/unit/replanification-preventive.test.ts)
  — 20 cas sur le calcul d'échéance : le 31 janvier, le 29 février, un retard de
  trois ans, le passage à l'heure d'hiver, les deux vocabulaires. La suite
  d'intégration ne peut pas couvrir ces dates, et c'est là que vivent les
  défauts.
- [`tests/integration/cloture-ordre-travail.test.ts`](../tests/integration/cloture-ordre-travail.test.ts)
  — 33 cas sur la boucle complète, **tous vérifiés sur la table** et jamais sur
  le code de retour. Y compris les témoins : un OT sans plan ne replanifie rien,
  un OT sans arrêt ne touche pas à l'état, le compteur d'un autre plan n'est
  pas touché, une clôture sans pièces reste possible. Sans eux, un correctif
  qui ferait basculer n'importe quoi passerait aussi.
- [`tests/unit/cloture-interface.test.ts`](../tests/unit/cloture-interface.test.ts)
  — 23 contrôles **statiques** sur l'écran : un seul chemin vers la clôture, le
  filtre des compteurs dans un seul segment de clé, les écrans rafraîchis. Ils
  ne prouvent pas que l'écran fonctionne — cela se vérifie en l'ouvrant, et ça
  a été fait (tableau ci-dessus) — mais ils verrouillent trois défauts qui ne
  se voient pas à la relecture. Ce dépôt n'a ni `@testing-library/react` ni
  `jsdom` ; la convention y est déjà celle du contrôle statique.

Fixtures sur `TENANT_ALPHA` / `TENANT_BETA` ([`tests/seed.ts`](../tests/seed.ts)),
marquées par un horodatage unique et supprimées en `afterAll` — la voie
d'intégration a été relancée **trois fois de suite sur la même base** pour
prouver que le nettoyage tient, car des suites de ce dépôt s'interfèrent par les
agrégats.

---

## Les compteurs d'usage

*Ajouté le 26 octobre 2026.*

### Deux liens manquaient, pas un

L'audit nommait `work_orders.plan_id`. Le recensement a montré un second trou,
du même genre et au même endroit : **`maintenance_counters.plan_id` n'était
écrit nulle part** — y compris dans `POST /api/preventive-maintenance-plans`,
le seul endroit du dépôt où un compteur naît d'un plan. Mesuré : zéro écriture,
zéro lecture, colonne morte. Un compteur créé depuis un plan était donc
orphelin dès sa naissance.

Et `gmaoStorage.resetCounter()` — écrite, correcte, et paramétrée par un
`workOrderId`, donc manifestement prévue pour la clôture — **n'avait aucun
appelant**. Même forme de défaut que `StockManager`, dont le moteur complet
n'était joignable que par des endpoints explicites.

### Ce compteur est un compteur de tronçon, pas un totalisateur

Le point n'est pas anodin : on ne remet pas à zéro le compteur kilométrique
d'un véhicule à chaque révision. Mais c'est la sémantique que ce schéma
implémente, et le relevé le confirme des deux côtés :

- `checkAndGenerateCounterAlert` compare `currentValue` à `thresholdValue`
  **directement**, pas un écart à un jalon — donc `currentValue` signifie
  « usage depuis la dernière intervention » et `thresholdValue` « périodicité » ;
- les colonnes qui porteraient la lecture « totalisateur », `last_service_value`
  et `interval_value`, **ne sont écrites ni lues nulle part** (zéro usage hors
  du schéma). Elles sont mortes.

On honore donc la sémantique en place plutôt que d'en introduire une seconde :
deux sens contradictoires pour `currentValue` dans la même table seraient
exactement le défaut que cette campagne passe son temps à retrouver.
`counter_type` (`hours`, `cycles`, `kilometers`, `units`) nomme l'**unité**, pas
la nature absolue ou relative du relevé.

### Ce que la clôture fait, et ce qu'elle ne fait pas

| Règle | Ce qu'elle empêche |
|---|---|
| le rattachement passe par le **plan**, jamais par l'équipement | plusieurs plans couvrent le même équipement ; remettre à zéro « heures depuis révision générale » parce qu'une tournée de graissage est clôturée **masquerait une révision due** |
| `alert_level` → `info` et `alert_email_sent` → `false` | `checkAndGenerateCounterAlert` ne produit une alerte que si `alert_email_sent` est faux ; laissé à `true`, le compteur repartirait de zéro mais resterait **muet à la prochaine échéance** |
| les compteurs **inactifs** sont ignorés | un compteur désactivé l'a été délibérément (instrument démonté) ; lui écrire une ligne d'historique le ferait rentrer dans le suivi par la petite porte |
| le relevé d'avant part dans `counter_history`, avec l'ordre | c'est ce qui permet de reconstituer l'usage entre deux interventions |
| dans la **même transaction** que le reste | un refus de magasin annule aussi la remise à zéro — sinon l'usage réel serait perdu sans recours, personne ne connaissant plus le relevé d'avant |

`counter_history.previous_value` est un `integer` alors que `current_value` est
un `real` : l'arrondi est fait **explicitement**, pour que la troncature soit
une décision lisible et non un effet de bord du type de colonne.

---

## Les commandes d'interface

*Ajouté le 26 octobre 2026.* Avant, l'API acceptait `planId`,
`requiresShutdown` et `partsUsed`, mais aucun utilisateur ne pouvait les
atteindre : le formulaire n'avait pas les champs et la clôture envoyait
`{ status: "completed" }` et rien d'autre.

| Commande | Où | Note |
|---|---|---|
| **Sélecteur de plan préventif** | formulaire d'OT, visible uniquement si le type est « préventif » | facultatif (un préventif ponctuel hors gamme est légitime). Un plan désactivé reste proposé si l'ordre le porte déjà, sinon un simple enregistrement effacerait le rattachement sans qu'on le demande |
| **Case « intervention avec arrêt machine »** | formulaire d'OT | avec le texte qui dit ce qu'elle déclenche, et quand ne pas la cocher |
| **Déclaration des pièces à la clôture** | boîte de dialogue ouverte par « Terminer » | liste les références avec leur stock ; le refus 409 s'affiche **dans la boîte**, sur les lignes concernées, en conservant les quantités saisies |
| **Relevé des compteurs du plan** | même boîte | montre la valeur actuelle, le seuil, et ce qu'elle deviendra. C'est le **seul endroit du produit** où un compteur d'usage est lisible |
| **Plan et arrêt machine** | fiche de détail | les cacher ferait dépendre d'un champ invisible l'avancement d'une échéance et la remise en service d'une machine |

Deux points de forme qui ont chacun une raison :

- **`GET /api/maintenance-counters` a dû être créée** : aucune route du serveur
  ne servait `maintenance_counters`. Les compteurs pouvaient être créés mais
  jamais lus, et `getMaintenanceCounters()` n'avait aucun appelant. Sans
  lecture, la remise à zéro serait un effet invisible — donc invérifiable.
- **Le sélecteur de statut de la fiche de détail détourne « Terminé » vers la
  boîte de clôture.** C'était un second chemin vers `completed`, et le laisser
  muter directement donnait deux clôtures aux effets inégaux : par là, aucune
  pièce ne pouvait être déclarée et un refus de magasin n'avait nulle part où
  s'afficher. Cet écran a déjà eu cette forme de défaut une fois — deux
  implémentations d'ordres de travail aux contrats de champs différents.

### Le défaut que seul l'écran ouvert a montré

`getWorkOrders()` construit une **projection explicite** colonne par colonne :
un champ absent de la liste est absent de la réponse, sans la moindre erreur.
Les deux colonnes de la migration 0024 n'y étaient pas.

Conséquence, relevée en ouvrant la page : la boîte de clôture n'annonçait ni la
replanification du plan ni la remise en service de l'équipement, et n'affichait
aucun compteur — alors que l'ordre portait bien les deux champs en base. La
liste répondait **200, avec 28 champs**.

Ni le typecheck, ni les tests de statut, ni la relecture du JSX — qui était
juste — ne pouvaient le voir. C'est le rappel de la règle du dépôt : vérifier
le **contrat de champs**, pas seulement le code de retour. Deux cas
d'intégration le verrouillent désormais (`GET /api/work-orders — contrat de
champs`), et ils vérifient que les clés **existent**, car `toBe(undefined)`
passerait aussi bien sur une clé absente que sur une valeur nulle.

### Mesuré en pilotant l'interface

Parcours complet au navigateur, sur la grappe jetable, puis relevé en base :

| Acte dans l'interface | Écrit en base |
|---|---|
| création d'un OT préventif, plan choisi, case arrêt cochée | `order_type=preventive`, `plan_id=23`, `requires_shutdown=t` |
| « Démarrer » | équipement `operational` → **`maintenance`** |
| clôture avec **5** joints pour un stock de 2 | **409** ; liste du manque affichée dans la boîte (« demandé 5, disponible 2, manque 3 ») ; **rien écrit** : OT toujours `in_progress`, `actual_end` nul, compteur à 612, échéance inchangée, 0 mouvement, stocks intacts |
| quantités corrigées (3 graisse, 2 joints) | OT `completed`, `actual_end` renseigné ; équipement → **`operational`** ; compteur **612 → 0**, alerte `info`/`false` ; échéance **2026-10-27 → 2026-11-27** (une période exacte) ; `last_executed` renseigné ; 2 mouvements `OUT` (12→9 et 2→0), `reason=WORK_ORDER`, `work_order_id=28`, `performed_by=1` **pris de la session** ; `counter_history` : `previous_value=612`, motif nommant l'ordre |

Les trois couleurs du bandeau de refus ont été mesurées par `getComputedStyle`
et non lues dans le JSX — `rgb(143,32,18)`, `rgb(251,233,231)`,
`rgb(239,195,188)`, soit exactement `#8F2012`, `#FBE9E7`, `#EFC3BC` de la
charte. Une classe de couleur muette produit le même `className` qu'une classe
valide ; ce dépôt a déjà payé cette confusion sur 159 occurrences.

---

## Ce qui reste ouvert

| Boucle | État | Pourquoi |
|---|---|---|
| ~~Aucun écran de suivi des compteurs~~ | **fait** le 2026-10-26 | Écran `/compteurs` : relevés saisis (l'incrémentation), seuils réglables, historique réunissant relevés et remises à zéro. Voir [COMPTEURS_USAGE.md](COMPTEURS_USAGE.md) |
| ~~Compteur → OT préventif~~ | **fait** le 2026-10-26 | Le franchissement du seuil crée un OT préventif rattaché au plan, dont la clôture remet le compteur à zéro : le cycle se referme. Voir [COMPTEURS_USAGE.md](COMPTEURS_USAGE.md) |
| **Demande d'intervention → OT** | ouvert | Aucune table ne porte la demande d'intervention. Chantier distinct |
| **Alerte → OT** | ouvert | Création d'OT depuis un événement, non traitée ici |
| **`POST /api/work-orders` ignore `dueDate`, `requestedBy`, `orderType`** | ouvert, préexistant | Le client compense par un PUT de complément (voir l'en-tête de `work-order-management.tsx`). `planId` et `requiresShutdown`, eux, sont bien lus par POST |

Le jeu de démonstration, lui, rattache ses OT préventifs à leur plan et marque
l'arrêt machine là où il est réel (presse PRS-002, déjà déclarée `maintenance`
et porteuse d'une alerte « Presse à l'arrêt ») : la boucle se montre donc sur un
cas vrai, y compris le cas qui ne doit **pas** rebasculer (GEN-001, `offline`).

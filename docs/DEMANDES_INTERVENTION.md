# Demandes d'intervention, et la boucle alerte → OT

*Lot du 26 octobre 2026. Referme les deux dernières boucles de l'audit
fonctionnel du 25 octobre 2026 (section 1) :*

> « Demande d'intervention → OT | **absente** | aucune table de demande ; la DI
> est confondue avec l'OT »
> « Alerte → OT | **ouverte** | aucune création d'OT depuis une alerte »

---

## Ce que l'absence de DI coûtait

La séparation DI / OT est structurante en GMAO : l'exploitant **signale**, la
maintenance **arbitre** et convertit — ou refuse en motivant. Les confondre
avait trois effets, tous constatés par l'audit :

1. **n'importe qui devait créer directement un ordre de travail**, c'est-à-dire
   engager la planification et le budget ;
2. **le refus motivé n'existait pas**, donc la charge non traitée n'était pas
   mesurable — un signalement écarté ne laissait aucune trace, et personne ne
   pouvait dire combien de demandes avaient été refusées ni pourquoi ;
3. le dispositif de validation a dû être greffé **après coup** sur l'ordre de
   travail, ce qui explique sa forme bancale.

---

## Les deux échelles qu'il fallait séparer

| | Qui la fixe | Où elle vit |
|---|---|---|
| **Urgence perçue** | le demandeur | `intervention_requests.urgency` |
| **Priorité** | la **maintenance**, à l'arbitrage | `work_orders.priority` |

**C'est la raison d'être de la table.** Sans elle, celui qui signale fixe la
priorité d'un travail qu'il ne planifie pas. Le formulaire d'arbitrage demande
donc la priorité explicitement, et ne la pré-remplit **pas** avec l'urgence —
un test statique le verrouille, parce que ce pré-remplissage rendrait la
séparation décorative sans que rien ne le signale.

Le vocabulaire est celui des priorités d'ordre de travail (`low`, `medium`,
`high`, `urgent`) et non une seconde échelle : deux échelles à traduire l'une
dans l'autre produiraient des correspondances arbitraires, et ce dépôt a déjà
payé la coexistence de deux vocabulaires pour une même notion (les fréquences
de plan préventif).

---

## Pourquoi l'alerte passe par la demande, et non directement par l'OT

C'est le choix de conception de ce lot, et il mérite d'être défendu.

`intervention_requests.alert_id` relie une demande à l'alerte qui l'a
provoquée. La boucle « alerte → OT » se ferme donc **par l'arbitrage** :

- **une alerte est un symptôme, pas une décision.** Elle peut être un faux
  positif, un doublon, ou un phénomène déjà connu. En faire un ordre de travail
  directement fabriquerait du travail dans le dos de la maintenance —
  exactement le reproche que l'audit adresse à l'absence de DI ;
- **à l'inverse d'un compteur**, dont le seuil *est* une décision d'ingénierie
  déjà prise : c'est pourquoi le franchissement d'un compteur crée bien un OT
  directement (voir [COMPTEURS_USAGE.md](COMPTEURS_USAGE.md)) ;
- **et le volume.** Mesuré : le seul producteur vivant d'`alerts_notifications`
  aujourd'hui est l'alerte de compteur, parce que le connecteur IoT qui écrit
  cette table exige un courtier MQTT (`mqtt://localhost:1883`). Mais avec un
  flux MQTT réel, il produit des alertes en continu. Les convertir
  automatiquement reproduirait le noyage d'alarmes que cette plateforme a déjà
  corrigé une fois sur les seuils de capteurs.

Le signalement d'une alerte est donc un **geste humain**, et `alert_id` sert de
garde : une alerte déjà signalée se reconnaît. Une demande **refusée** ne bloque
pas un nouveau signalement — les circonstances ont pu changer, et un refus est
un arbitrage daté, pas une condamnation.

---

## Les droits suivent le geste

| Geste | Niveau exigé | Pourquoi |
|---|---|---|
| **Signaler** | authentifié, aucun niveau | C'est le point. Un opérateur qui voit une fuite doit pouvoir la signaler sans habilitation, et sans engager de budget. Exiger un niveau reproduirait le défaut qu'on corrige |
| **Accepter / refuser** | chef d'équipe | C'est l'acte qui engage la planification |
| **Annuler** | l'**auteur** de la demande, ou un arbitre | On ne force personne à faire arbitrer un signalement fait par erreur. Mais un tiers ne peut pas retirer le signalement d'autrui : ce serait un moyen de faire disparaître une charge sans la refuser, donc sans laisser de motif — le trou qu'on vient de combler |

---

## Le refus exige un motif

Défaut n° 2 de l'audit. Le schéma impose **cinq caractères au minimum** — pas
pour la forme, mais pour qu'« ok » ne passe pas. Le motif est ensuite :

- **conservé** (`rejection_reason`),
- **compté** (l'indicateur « Refusées » de l'écran),
- **réaffiché** sur la demande, avec le nom de l'arbitre et la date.

Un motif conservé mais jamais montré ne rendrait pas la charge analysable : il
faut le lire sans requête SQL.

La contrainte est portée par la route et non par une contrainte `CHECK` en
base : aucune table de ce schéma n'en déclare, et en introduire une ici
seulement créerait un écart entre la base construite par `drizzle-kit migrate`
et celle construite par `push` — celle que les tests utilisent.

---

## La chaîne, et sa traçabilité

```
alerte ──signalement──► demande (pending) ──arbitrage──► ordre de travail
                              │
                              └──refus motivé──► charge écartée, mesurée
```

- `intervention_requests.alert_id` → l'alerte d'origine ;
- `intervention_requests.work_order_id` → l'ordre né de l'acceptation ;
- l'ordre porte **`requestedBy` = le demandeur**, pas l'arbitre : c'est lui qui
  a signalé, et c'est à lui qu'on rendra compte ;
- la description de l'ordre **cite** la demande, son numéro, le lieu signalé et
  l'urgence perçue : un technicien qui ouvre l'ordre voit ce qui a été signalé.

Le lien n'est posé que du côté de la demande. Une colonne `request_id` sur
`work_orders` serait la même information en double, et un ordre retrouve sa
demande par une seule requête.

### Atomicité et concurrence

L'acceptation est **transactionnelle** : un ordre créé sans que la demande soit
marquée acceptée se ferait re-convertir au clic suivant — deux ordres pour un
signalement. Une demande marquée acceptée sans ordre créé serait un signalement
classé « pris en charge » dont le travail n'existe nulle part : le pire des
deux, parce qu'il est invisible.

Un **verrou** (`SELECT … FOR UPDATE`) sur la demande, puis la relecture de son
statut, rendent l'arbitrage sûr : deux arbitres simultanés donnent `201` et
`409`, et **un seul** ordre. Un second arbitrage est refusé en `409` avec
l'état trouvé — un « conflit » muet obligerait à recharger pour comprendre.

---

## Mesuré en pilotant l'interface

| Acte | Relevé |
|---|---|
| ouverture par un **technicien** | l'écran charge, « Signaler » est disponible, et **aucun bouton Accepter/Refuser** n'apparaît |
| signalement de l'alerte active depuis le formulaire | `DI-…-540` créée : `pending`, urgence **high** (déduite de la sévérité `high` de l'alerte), « née d'une alerte », titre et message de l'alerte reportés, équipement résolu (« Presse hydraulique 200 t »), `requested_by` = le technicien |
| ouverture par un **chef d'équipe** | « Accepter » et « Refuser » apparaissent |
| boîte d'arbitrage | affiche « urgence perçue par le demandeur : Haute » **et** un sélecteur « Priorité décidée » à `medium` — il **n'hérite pas** du `high` perçu |
| priorité fixée à `low`, puis acceptation | ordre `WO-…-536` : `corrective`, `pending`, priorité **`low`**, équipement 31, `requested_by` = le demandeur ; demande `accepted`, `work_order_id` posé, `reviewed_by` = l'arbitre |
| la chaîne relue en SQL | `Derive vibratoire palier avant → DI-…-643 (urgence high) → WO-…-536 (priorité low)` |
| refus d'une autre demande | bouton **désactivé** sans motif ; après saisie, bandeau « Refusée par Test team_leader le 26 oct. 2026 : Grincement normal à froid… », en `rgb(251,233,231)` / `rgb(239,195,188)` = `#FBE9E7` / `#EFC3BC`, **mesurés par `getComputedStyle`** ; indicateur « Refusées » passé à 1 |

L'écart entre l'urgence perçue (`high`) et la priorité décidée (`low`) est la
preuve que la séparation est **opérante**, et non décorative.

### Un détail corrigé en route

Le message d'une demande née d'une alerte affichait « relevé 3.400000 pour un
seuil de 3.000000 » : `trigger_value` et `threshold_value` sont des
`decimal(15,6)`, et la précision de la colonne se retrouvait dans un texte que
des humains lisent. Il dit maintenant « relevé 3.4 pour un seuil de 3 ».

---

## Vérification

```bash
npm test -- --testPathPatterns=demandes-intervention
```

- [`tests/integration/demandes-intervention.test.ts`](../tests/integration/demandes-intervention.test.ts)
  — 26 cas, **tous vérifiés sur la table**, dont la chaîne complète
  « alerte → demande → ordre », les deux arbitrages simultanés, et les témoins
  (un technicien peut signaler, un technicien ne peut pas arbitrer, un filtre
  d'état inconnu est refusé au lieu de tout rendre).
- [`tests/unit/demandes-intervention-interface.test.ts`](../tests/unit/demandes-intervention-interface.test.ts)
  — 23 contrôles statiques, dont le plus important : la priorité d'arbitrage ne
  s'initialise jamais depuis l'urgence de la demande.

Suite rejouée **trois fois de suite** sur la même base pour prouver que le
nettoyage des fixtures tient.

### Un piège de nettoyage, mesuré

La première exécution a donné « 26 tests au vert » **et** « Test suite failed to
run » : le `afterAll` supprimait les ordres de travail avant les demandes, alors
que c'est la **demande** qui référence l'ordre
(`intervention_requests_work_order_id_work_orders_id_fk`). Mon propre
commentaire affirmait l'inverse. Les identifiants d'ordre sont désormais relevés
**avant** la suppression des demandes — après, on ne saurait plus lesquels
étaient les nôtres, leur numéro étant auto-généré.

---

## Ce qui reste ouvert

| Sujet | Pourquoi ce n'est pas fait |
|---|---|
| **La création directe d'un OT reste ouverte à tous** | L'audit reproche que « n'importe qui devait créer directement un OT ». La DI offre désormais la voie propre, mais **restreindre `POST /api/work-orders` est une décision de politique**, pas une correction : elle casserait des parcours et des tests existants, et c'est à vous de dire si la création directe doit devenir un privilège maintenant que la DI existe |
| **L'écran des alertes reste un bouchon** | `smart-alerts.tsx` lit `/api/smart-alerts` (table `smart_notifications`), pas `alerts_notifications`. Le signalement d'une alerte se fait donc depuis le formulaire de demande, qui liste les alertes actives — pas depuis un écran d'alertes, qui reste à construire (l'audit le liste séparément : « Écrans vides : onglet Alertes (bouchon) ») |
| **Aucune notification au demandeur** | Un refus est affiché sur la demande, mais rien ne prévient son auteur. `push-notification-service.ts` existe et notifie l'affectation d'un OT ; l'étendre à l'arbitrage d'une DI est un incrément distinct |
| **Le dispositif de validation de l'OT reste « greffé après coup »** | Troisième effet listé par l'audit. La DI ne le corrige pas : elle enlève la raison qui l'avait rendu nécessaire. Reprendre `validationStatus` / `level1`/`level2` sur `work_orders` à la lumière de la DI est un chantier à part |

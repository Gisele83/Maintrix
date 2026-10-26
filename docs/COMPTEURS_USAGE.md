# Compteurs d'usage

*Lot du 26 octobre 2026. Ferme l'amont de la boucle ouverte par la migration
0024 : sans relevé, un compteur n'atteignait jamais son seuil, et sa remise à
zéro à la clôture d'un ordre de travail ne servait à rien.*

Voir aussi [CLOTURE_ORDRE_TRAVAIL.md](CLOTURE_ORDRE_TRAVAIL.md), qui décrit
l'aval : la clôture d'un OT préventif remet à zéro les compteurs de son plan.

---

## Ce qui était : un module écrit, et joignable par rien

Recensement du 26 octobre 2026 :

| Élément | État mesuré |
|---|---|
| routes du serveur servant `maintenance_counters` | **aucune** |
| `incrementCounter()` | **zéro appelant** — rien n'augmentait `current_value` |
| `updateMaintenanceCounter()` | zéro appelant |
| `deleteMaintenanceCounter()` | zéro appelant |
| `getCounterHistory()` | zéro appelant |
| `getMaintenanceCounterById()` | zéro appelant |
| `getMaintenanceCountersByEquipment()` | zéro appelant |
| `increment_rate` (colonne) | jamais écrite, jamais lue |
| `last_service_value`, `interval_value` | jamais écrites, jamais lues |

Un compteur pouvait être **créé** — le formulaire de maintenance préventive en
envoie un avec le plan — mais jamais consulté, jamais relevé, jamais corrigé.
Il ne franchissait son seuil que si quelqu'un éditait la base à la main.

---

## L'incrémentation est un relevé, pas une dérive simulée

**C'est la décision structurante de ce lot.** La colonne `increment_rate`
invitait à faire croître les compteurs automatiquement, à raison de tant
d'heures par jour. On ne le fait pas :

- **une cadence nominale déclarée n'est pas une mesure.** Un compteur alimenté
  ainsi afficherait un usage **inventé**, et cet usage déclencherait de vraies
  alertes de maintenance sur de vraies machines. C'est la famille de défauts
  que cette campagne passe son temps à refermer — les seuils de capteurs en
  dur, les indicateurs fabriqués — et le dépôt a une barrière dédiée pour
  cela : [`tests/unit/aucun-chiffre-invente.test.ts`](../tests/unit/aucun-chiffre-invente.test.ts) ;
- **rien dans la plateforme ne mesure le temps de marche réel d'un
  équipement.** `iot_sensor_data` porte des relevés de grandeurs physiques
  (température, vibration, pression), pas un signal « en fonctionnement ».

Le relevé saisi est donc la seule source honnête — et c'est la pratique du
métier : un compteur horaire se lit sur la machine.

Le jour où un signal de marche existera, il alimentera la **même** table, avec
un `recorded_by` nul et une note qui dira sa provenance. `incrementCounter()`
reste en place pour ce cas : il avance le compteur en SQL sans écrire de trace.

### Le piège de la saisie, et les trois parades

On demande un **écart** (« 40 h depuis le dernier relevé »), pas la valeur
absolue affichée par la machine. Un opérateur qui saisirait 1 240 au lieu de 40
porterait le compteur très au-delà de son seuil et déclencherait une alerte
fausse.

1. le champ est nommé **« Usage depuis le dernier relevé »**, pas « relevé » ;
2. la date de la dernière remise à zéro est affichée à côté, pour donner une
   borne de départ lisible ;
3. la **valeur résultante** est calculée sous le champ, avec son seuil, avant
   toute confirmation — et le franchissement du seuil est annoncé
   explicitement. Mesuré à l'écran : saisir 185,5 sur un compteur à 1 840 /
   2 000 affiche « Le compteur passera à 2 025,5 h sur 2 000 — l'échéance sera
   atteinte et une alerte sera émise. »

---

## Une table pour les relevés — migration 0025

[`0025_counter_readings.sql`](../migrations/0025_counter_readings.sql).

**Pourquoi pas `counter_history`** : c'est l'historique des *remises à zéro*.
`reset_reason` y est `NOT NULL` et `previous_value` est un `integer`. L'y
détourner obligerait à inventer un « motif de remise à zéro » pour un geste qui
n'en est pas un, et tronquerait un relevé de 12,5 h.

Les deux histoires restent séparées ; l'écran les présente **réunies** dans
l'ordre chronologique — parce que les lire séparément ne dit rien : une suite
de relevés sans les remises à zéro donne une courbe qui semble redescendre sans
raison.

**Pourquoi `previous_value` et `new_value` en plus de `usage`** : même forme que
`stock_movements`, et même raison — une ligne doit se lire seule. Avec le seul
incrément, retrouver l'état du compteur à une date donnée obligerait à rejouer
toute la série, et un relevé perdu rendrait tous les suivants faux sans que
rien ne le signale.

Vérifiée sur les **deux** chemins de schéma, `push` et `migrate` :
`npm run verify:migrations` → 113 tables, 205 clés étrangères des deux côtés,
aucun écart.

---

## Sémantique : compteur de tronçon, pas totalisateur

Rappel de la décision prise au lot précédent, et mesurée :
`checkAndGenerateCounterAlert` compare `current_value` à `threshold_value`
**directement**, et les colonnes qui porteraient la lecture « totalisateur »
(`last_service_value`, `interval_value`) ne sont écrites ni lues nulle part.

Donc `current_value` = « usage depuis la dernière intervention », et
`threshold_value` = « périodicité ». `counter_type` (`hours`, `cycles`,
`kilometers`, `units`) nomme l'**unité**, pas la nature absolue ou relative du
relevé.

**Conséquence assumée** : on ne saisit pas le relevé absolu d'un compteur
horaire machine. Le faire demanderait de stocker la valeur du compteur machine
au début du tronçon — ce que `last_service_value` porterait, mais cette colonne
est morte et son nom désigne autre chose. Ce n'est pas fait, et c'est signalé
plus bas.

---

## Les routes

Toutes dans [`server/compteurs-routes.ts`](../server/compteurs-routes.ts),
cloisonnées par la session, jamais par un paramètre de requête.

| Route | Niveau exigé | Note |
|---|---|---|
| `GET /api/maintenance-counters` | authentifié | filtre `?planId=` appliqué par le serveur |
| `GET /api/maintenance-counters/:id/history` | authentifié | relevés **et** remises à zéro, réunis |
| `POST /api/maintenance-counters/:id/readings` | authentifié | **l'incrémentation** |
| `POST /api/maintenance-counters/:id/reset` | chef d'équipe | motif obligatoire |
| `POST /api/maintenance-counters` | chef d'équipe | équipement et plan vérifiés contre le locataire |
| `PUT /api/maintenance-counters/:id` | chef d'équipe | jamais `currentValue` |
| `DELETE /api/maintenance-counters/:id` | directeur technique | emporte les relevés en cascade |

### Les droits suivent le geste, pas la commodité

- **Relever** est le travail quotidien d'un technicien. Exiger un chef d'équipe
  garantirait que personne ne le saisit.
- **Définir ou modifier un seuil** est un acte d'ingénierie de maintenance :
  c'est lui qui décide quand une machine est déclarée due.
- **Remettre à zéro à la main** efface un relevé d'usage sans intervention pour
  le justifier — d'où le motif obligatoire, et le niveau.
- **Supprimer** détruit l'historique d'usage d'un équipement.

### La valeur courante n'est pas modifiable par une édition de champ

Le schéma de modification est `.strict()` et n'accepte pas `currentValue` :
faire bouger un usage par une édition le laisserait changer **sans trace**.
Pour l'augmenter on relève, pour le ramener à zéro on le remet à zéro — les
deux laissent une ligne d'historique.

---

## Deux défauts trouvés en ouvrant l'écran

Ni le typecheck, ni les tests de statut, ni la relecture du JSX ne pouvaient
les voir.

### 1. « Équipement non précisé » pour un équipement connu

`maintenance_counters.equipment_name` est une **copie dénormalisée**, vide sur
la plupart des lignes : le seul chemin qui la remplissait la prend du corps de
la requête avant de se rabattre sur l'équipement.

Relevé : deux compteurs rattachés à l'équipement #9 « Compresseur atelier »
s'affichaient tous deux « Équipement non précisé », alors que le rattachement
était juste en base. Le nom est désormais lu là où il est vrai —
`equipment_registry`, jointure **portant le locataire** — et la copie ne sert
que de repli.

### 2. L'alerte disait « null is due for null »

Le message était composé de `equipmentName` et `maintenanceType`, deux champs
facultatifs. Relevé en provoquant l'alerte depuis l'écran :

```
Maintenance due: null
null is due for null. Current value: 2025.5/2000 hours
```

Le défaut n'avait **jamais pu se voir** : rien n'augmentait les compteurs avant
ce lot, donc ce chemin ne s'exécutait pas. Une alerte de maintenance qui ne
nomme pas la machine ne sert à rien — et le reste de la plateforme est en
français. Après correction :

```
Échéance de maintenance atteinte — Compresseur atelier
Heures depuis vidange est due sur Compresseur atelier : 2025.5 h relevés
pour une périodicité de 2000 h.
```

---

## Mesuré en pilotant l'écran

| Acte dans l'interface | Relevé en base |
|---|---|
| ouverture de `/compteurs` | 2 suivis, 0 échéance atteinte, **1 bientôt due** (1 840/2 000 = 92 %, seuil d'alerte 90 %), **1 sans échéance** (pas de seuil → aucune jauge) |
| saisie de 185,5 h | aperçu « passera à 2 025,5 h sur 2 000 — l'échéance sera atteinte », en `rgb(121,80,10)` = `#79500A` (`etat.alerte.texte`), **mesuré par `getComputedStyle`** |
| enregistrement | `current_value` **1 840 → 2 025,5** · `alert_level` `info` → **`critical`** · `alert_email_sent` → `t` · une ligne `counter_readings` (1 840 → +185,5 → 2 025,5, `recorded_by` **pris de la session**, locataire posé) · **une alerte émise**, nommant la machine |
| ouverture de l'historique | « Relevé · 1 840 → 2 025,5 h (+185,5) · relevé mensuel atelier » |

---

## Vérification

```bash
npm test -- --testPathPatterns=compteurs-usage
npm test -- --testPathPatterns=compteurs-interface
```

- [`tests/integration/compteurs-usage.test.ts`](../tests/integration/compteurs-usage.test.ts)
  — 46 cas, **tous vérifiés sur la table**, dont la boucle complète
  « relevé → ordre → clôture → compteur à zéro ». Y compris les témoins : on n'alerte
  pas sous le seuil, un compteur sans seuil n'alerte pas et ne bloque pas le
  relevé, un technicien peut relever. Et les deux défauts ci-dessus ont chacun
  leur cas.
- [`tests/unit/compteurs-interface.test.ts`](../tests/unit/compteurs-interface.test.ts)
  — 22 contrôles statiques : les trois parades contre le relevé absolu, aucun
  chiffre fabriqué, le seuil d'alerte lu sur le compteur, les droits par le
  référentiel de rôles.

Concurrence : deux relevés simultanés **s'additionnent** (verrou `FOR UPDATE`
sur la ligne, puis lecture). Sans lui, les deux liraient la même valeur de
départ et le second écraserait le premier.

---

## Compteur → ordre de travail préventif

*Ajouté le 26 octobre 2026. C'était la dernière boucle ouverte de la chaîne du
préventif (audit du 2026-10-25, section 1 : « Compteur → OT préventif :
ouverte — le compteur crée une alerte, jamais un OT »).*

### Pourquoi une alerte ne suffisait pas

Une alerte se lit, s'acquitte, et disparaît. Elle ne porte ni affectation, ni
durée estimée, ni pièces, ni traçabilité d'exécution — et surtout **elle ne se
clôture pas**, donc elle ne remet pas le compteur à zéro. L'échéance restait
indéfiniment atteinte, à répéter la même chose à chaque relevé.

L'ordre de travail, lui, se clôture : et sa clôture replanifie le plan et remet
le compteur à zéro (migration 0024). **C'est la fermeture du cycle qui
distingue cette boucle d'une alerte de plus.**

```
relevé saisi → seuil franchi → OT préventif créé → exécuté → clôturé
                     ↑                                           │
                     └──────── compteur remis à zéro ────────────┘
```

### Au seuil d'alerte, pas à 100 %

`warningThresholdPct` est exactement le champ que l'exploitant règle pour
« prévenir assez tôt pour laisser le temps de programmer ». Créer l'ordre à
100 % le ferait naître **déjà en retard** — le défaut corrigé par ailleurs sur
les plans calendaires.

### Ce qui n'est pas inventé

| Champ | Valeur, et sa source |
|---|---|
| `priority` | **déduite de la mesure** : `high` au-delà du seuil critique (`alerte + 8`, le même que celui de l'alerte, pour qu'ils ne se contredisent pas), `medium` sinon. **Jamais `urgent`** : un préventif dû n'est pas une panne, et le dire noierait les vraies urgences |
| `estimatedDuration` | celle du **plan**, quand il la porte ; absente sinon |
| `scheduledStart` | **laissée nulle**. Un plan réglé sur un compteur n'a pas de date, et en déduire une demanderait une cadence d'usage — donc une prévision. Le planificateur la pose |
| `requiresShutdown` | `false`, le défaut prudent de 0024 : le plan ne dit pas si la gamme immobilise la machine |
| `description` | porte le relevé, la périodicité et le pourcentage **mesurés** |

### La garde d'idempotence

Le compteur est relu régulièrement et chaque relevé repasse par le même chemin.
Sans garde, un ordre naîtrait **à chaque relevé** au-delà du seuil.

La garde porte sur **(locataire, plan, équipement)**, pas sur le compteur : un
plan peut porter plusieurs compteurs (heures *et* cycles) et la gamme ne
s'exécute qu'une fois. Deux ordres feraient faire deux fois le même travail, et
la seconde clôture avancerait l'échéance d'une période de trop.

Le filtre est posé **en SQL et sans limite de lignes**. Le motif existant
ailleurs dans ce dépôt (`predictive-maintenance-engine.ts`) relit les cinq
derniers ordres de l'équipement et cherche parmi eux : un ordre ouvert plus
ancien que ces cinq lui échappe, et il en crée un doublon.

### Un compteur sans gamme ne crée aucun ordre — et c'est délibéré

La remise à zéro à la clôture se fait **par le plan**. Un ordre créé pour un
compteur sans plan ne pourrait jamais remettre ce compteur à zéro : le compteur
resterait au-dessus de son seuil, et le relevé suivant créerait un nouvel
ordre, indéfiniment. **On fabriquerait du travail sans jamais fermer la
boucle** — pire que de ne rien faire.

L'alerte, elle, est bien émise. Et l'écran le dit explicitement : « Échéance
atteinte, mais aucun ordre de travail ne sera créé : ce compteur n'est rattaché
à aucune gamme préventive. »

### Un seul point d'entrée

`traiterEcheanceCompteur()` tire **les deux** conséquences — l'alerte qui
prévient, l'ordre qui fait exécuter — et les cinq endroits où un compteur
change d'état l'appellent. `checkAndGenerateCounterAlert` reste la primitive
d'alerte et garde son nom : une fonction nommée « generate alert » qui créerait
aussi des ordres de travail mentirait sur ce qu'elle fait.

Chaque conséquence est indépendante : l'échec de l'une ne prive pas de l'autre.
Et les deux restent **hors** de la transaction du relevé — le relevé est un
fait constaté, elles en sont des conséquences (règle de
[TRANSACTIONS.md](TRANSACTIONS.md)).

### L'ordre ouvert est signalé sur le compteur

Sans cela, un compteur annonce « échéance atteinte » sans dire qu'un ordre
existe déjà, et l'exploitant en saisit un second à la main. L'écran affiche
« Ordre de travail WO-… ouvert — sa clôture remettra ce compteur à zéro », avec
un lien. La clé employée est celle de la garde d'idempotence, pour que l'écran
montre exactement ce que le serveur considère comme pris en charge.

### Mesuré en pilotant l'interface

| Acte | Relevé en base |
|---|---|
| compteur à 1 750 / 2 000 (88 %), seuil d'alerte 90 % | « Dans les limites », **aucun ordre** |
| relevé de 68 h → 1 818 h (91 %) | ordre `WO-…-286` créé : `preventive`, `pending`, `medium`, plan #43, durée **240** (celle du plan), `requires_shutdown` **false**, `scheduled_start` **nul** ; description « Relevé 1818 h pour une périodicité de 2000 h (91 %) » |
| l'écran | pastille « Bientôt due » + lien « Ordre de travail WO-…-286 ouvert », en `rgb(0,107,151)` = `#006B97` (`signal`), **mesuré par `getComputedStyle`** |
| « Démarrer » puis « Terminer » sur cet ordre | la boîte de clôture annonce « Heures depuis vidange : 1 818 h / 2 000 h → 0 h après clôture » |
| clôture | compteur **1 818 → 0**, `alert_level` → `info`, `alert_email_sent` → `f` ; historique : relevé (1 750 → +68 → 1 818) **puis** remise à zéro de 1 818 portant le n° de l'ordre ; plan `last_executed` renseigné, `next_due` **nul** (plan sur compteur : pas d'échéance de date) ; plus aucun ordre ouvert signalé |

---

## Ce qui reste ouvert

| Sujet | Pourquoi ce n'est pas fait |
|---|---|
| **Saisie d'un relevé ABSOLU** (la valeur affichée par la machine) | Demanderait de stocker la valeur du compteur machine au début du tronçon. `last_service_value` porterait cela, mais la colonne est morte et son nom désigne autre chose. L'écart est demandé à la place, avec trois parades contre la confusion |
| **Alimentation automatique depuis un signal de marche** | Aucun signal de ce genre n'existe dans la plateforme. Quand il existera, il écrira dans `counter_readings` par le même chemin, et `incrementCounter()` — qui appelle déjà `traiterEcheanceCompteur` — créera les ordres |
| **Un ordre annulé fait repartir la boucle** | Si l'ordre est *annulé* (et non clôturé), le compteur reste au-dessus de son seuil et le relevé suivant en crée un nouveau. C'est correct — la maintenance est toujours due — mais cela veut dire qu'annuler ne suffit pas à « renoncer » à une échéance : il faut remettre le compteur à zéro avec un motif, ou désactiver son suivi |
| **`increment_rate`, `last_service_value`, `interval_value`** | Colonnes mortes, laissées en place. Les supprimer est une migration qui ne corrige rien ; elles sont signalées ici pour qu'on ne les croie pas actives |

# Intégrité des alertes et isolation multi-locataires

> Lot 3. Branche `claude/lot3-integrite-alertes`.
> Aucun déploiement, aucune exécution sur l'instance en ligne.

## Le défaut, en une phrase

`alerts_notifications.tenant_id` est une colonne **nullable**, et quatre des
cinq chemins d'écriture ne la renseignaient pas. Le simulateur IoT tournant
toutes les 30 secondes, toute instance en fonctionnement accumulait des
alertes n'appartenant à personne.

Elles étaient invisibles — les lectures filtrent par locataire — mais bien
présentes, et liées aux équipements par clé étrangère. Leur seul symptôme
visible est apparu tardivement : le retrait du jeu de démonstration échouait
sur une contrainte de clé étrangère, parce que le moteur d'alertes avait posé
des lignes que personne ne savait rattacher.

---

## 1. Cartographie des chemins d'écriture

### Alertes persistées — `alerts_notifications`

| # | Chemin | Déclencheur | `tenant_id` avant | Après |
|---|---|---|---|---|
| E1 | `gmao-storage.ts:723` — compteurs de maintenance | seuil de compteur | `counter.tenantId` ✓ | inchangé |
| E2 | `gmao-storage.ts:1557` — réapprovisionnement | stock sous le point de commande | **absent** (pourtant dans la portée) | `tenantId` transmis |
| E3 | `iot-connector.ts:283` — seuil de capteur | simulateur / MQTT | **absent** (résolu 3 lignes plus haut) | propagé |
| E4 | `iot-connector.ts:350` — analyse prédictive | simulateur / MQTT | **absent** (idem) | propagé |
| E5 | `gmao-routes.ts:1105` — `POST /api/alerts` | client HTTP | **corps de la requête** | session, le corps est écrasé |
| E6 | `storage.ts:274` — seconde couche | aucun appelant | aucun contrôle | délègue au chemin gardé |
| E7 | `storage.ts:657` — `createAlertsNotifications` | aucun appelant | aucun contrôle | délègue au chemin gardé |
| E8 | `test-data-generator.ts:354` | génération de jeu de test | `tenantId` ✓ | inchangé |
| E9 | `jeu-de-demonstration.ts:1306` | script de démonstration | `TENANT_DEMO` ✓ | inchangé |

### Notifications — `smart_notifications`

| # | Chemin | Déclencheur | Défaut | Après |
|---|---|---|---|---|
| N1 | `smart-notification-engine.ts:383` | événements du connecteur IoT avancé, **toutes les 5 secondes** | destinataires résolus sur **tous les locataires** | restreints à l'organisation de l'équipement |

La table ne porte pas de `tenant_id` : le cloisonnement ne pouvait donc avoir
lieu qu'au choix du destinataire.

### Événements sans persistance

`advanced-iot-connector.ts` n'écrit **rien** en base — il émet des événements
en mémoire, repris par `server/index.ts` et transmis au moteur de
notifications. C'est par là que passait la fuite N1. Ses appareils ont des
identifiants d'équipement **écrits en dur** (1 et 2) : sur une instance
multi-locataires, ils désignent les équipements de qui les a créés en premier.

### Lectures et modifications

| Route | Avant | Après |
|---|---|---|
| `GET /api/alerts` | `tenantRequis` ✓ | inchangé |
| `POST /api/alerts` | locataire du **corps** | locataire de la **session** |
| `PUT /api/alerts/:id` | **aucun contrôle** — identifiant nu | cloisonné, 404 hors locataire |
| `GET /api/equipment/:id/alerts` | **aucun contrôle** | cloisonné |
| `storage.getAlerts()` | 500 lignes, **tous locataires** (sans appelant) | locataire obligatoire |
| `GET /api/equipment/alerts`, `/api/smart-alerts` | calculées en mémoire, filtrées | inchangé |

Aucune route de suppression d'alerte n'existe.

---

## 2. Les correctifs

### La barrière unique — `gmaoStorage.createAlert`

Tout ce qui s'écrit dans `alerts_notifications` passe par là. Elle **refuse**
dans deux cas et n'en comble aucun :

1. **Pas de locataire** → refus. On ne déduit pas le propriétaire depuis
   l'équipement *ici* : ce serait transformer un oubli d'appelant en écriture
   silencieuse. La déduction a sa place à l'ingestion, où une trame arrive
   sans session, et elle y est déjà faite une fois.
2. **Équipement d'un autre locataire** → refus. Le contrôle est dans la
   barrière et non dans la route, parce qu'une garde placée dans une seule
   route ne protège que cette route.

Ce qui n'est **pas** fait : remplacer un `tenant_id` manquant par celui de la
session ou par un défaut global. Une valeur par défaut rendrait le défaut
invisible au lieu de le supprimer.

Elle **lève** plutôt que de rendre un code d'échec : les appelants sont des
boucles de fond, et une boucle qui ignore un code de retour écrirait encore
des alertes orphelines. Les tâches de fond ont leur propre isolation et leur
temporisation — une levée y est tracée, pas fatale.

### La seconde couche de stockage

Le dépôt porte deux couches qui écrivent dans la même table. Mettre la garde
dans une seule revient à la laisser ouverte. Les trois méthodes de
`storage.ts` **délèguent** désormais au chemin gardé plutôt que de dupliquer
le contrôle — un contrôle écrit deux fois finit par diverger, et c'est la
copie la plus laxiste qui décide.

Elles n'avaient aucun appelant. C'est précisément pour cela qu'il fallait s'en
occuper : le premier appelant à venir n'aurait rien vu d'anormal.

### Deux minuteries qui retenaient le processus

`setCooldown` et `scheduleEscalation` posaient des `setTimeout` de plusieurs
minutes — quinze pour l'escalade — sans `unref`. Sans effet sur le serveur,
tenu éveillé par sa socket ; décisif pour tout processus court, et c'est ce
qui suspendait la voie de test après que tous les cas soient passés.

---

## 3. Données historiques

L'outil `npm run alertes:examiner` est **en lecture seule par défaut** et ne
supprime jamais rien, sous aucun indicateur. Il classe en quatre catégories :

| | Cas | Traitement |
|---|---|---|
| **A** | `tenant_id` NULL, équipement connu et rattaché | **rattachable sans ambiguïté** — `--rattacher` |
| **B** | `tenant_id` NULL, **aucun** équipement (alertes de stock) | rien dans la ligne ne dit à qui elle est : laissée NULL |
| **C** | `tenant_id` NULL, équipement disparu ou lui-même orphelin | signalée ; c'est l'équipement qu'il faut examiner |
| **D** | `tenant_id` présent mais **différent** de celui de l'équipement | la plus grave — visible par la mauvaise organisation ; `--corriger-incoherents` |

B et C ne sont pas corrigeables automatiquement. Les laisser à NULL **est**
l'isolement : une alerte sans locataire n'est lisible par personne, puisque
toutes les lectures filtrent. La supprimer détruirait la trace d'un
dépassement de seuil réel sur un équipement réel.

D a son propre indicateur parce que la corriger **retire** quelque chose de la
vue de quelqu'un — ce n'est pas le même geste que rendre visible une ligne que
personne ne voyait.

Le `UPDATE` de rattachement **recalcule** le propriétaire par jointure au lieu
de faire confiance à la lecture précédente, et sa condition `tenant_id IS NULL`
garantit qu'il n'écrase jamais un rattachement existant.

---

## 4. Avis : faut-il une contrainte de base de données ?

**Oui, et en deux temps.**

### Temps 1 — `NOT NULL` sur `alerts_notifications.tenant_id`

Le défaut corrigé ici est exactement « la colonne acceptait NULL ». Une garde
applicative est une convention ; une contrainte est une loi. Ce lot a fermé
**trois** portes d'écriture non gardées dans une seconde couche de stockage
— le prochain chemin d'écriture n'est pas encore écrit, et rien ne garantit
qu'il passera par la barrière.

Le coût est nul en lecture, négligeable en écriture.

**Le prérequis est le vrai obstacle** : il ne doit plus rester une seule ligne
NULL. Les catégories B et C ne sont pas rattachables par la donnée ; il faut
les traiter à la main ou les archiver dans une table dédiée avant de poser la
contrainte. C'est une décision d'exploitation, pas de développement.

**Réserve honnête** : si une alerte « plateforme » légitime devait un jour
n'appartenir à personne — panne globale, incident d'infrastructure — la
contrainte l'interdirait. Aucun chemin n'en produit aujourd'hui, et si ce
besoin apparaît, une table distincte vaudra mieux qu'une colonne nullable qui
redeviendrait le trou par lequel tout passe.

### Temps 2 — clé étrangère **composite**, pour la cohérence

`NOT NULL` empêche l'absence, pas l'**incohérence** : rien n'interdit encore
une alerte rattachée à A sur un équipement de B (catégorie D). Un `CHECK` ne
peut pas faire de sous-requête en PostgreSQL ; un déclencheur ferait l'affaire
mais déplace la règle dans du code impératif.

La voie déclarative :

```sql
ALTER TABLE equipment_registry
  ADD CONSTRAINT equipment_registry_id_tenant_unique UNIQUE (id, tenant_id);

ALTER TABLE alerts_notifications
  ADD CONSTRAINT alerts_equipement_meme_locataire
  FOREIGN KEY (equipment_id, tenant_id)
  REFERENCES equipment_registry (id, tenant_id);
```

La base garantit alors que l'alerte et son équipement ont le **même**
propriétaire, sans déclencheur ni code applicatif. Et la sémantique par défaut
(`MATCH SIMPLE`) joue en notre faveur : la contrainte ne s'applique pas quand
`equipment_id` est NULL, ce qui laisse passer les alertes de stock — exactement
le comportement voulu.

**Le coût réel** : l'action `ON DELETE` doit être choisie explicitement, et
elle diffère de celle de la clé étrangère actuelle sur `equipment_id` seul.
Supprimer un équipement devra soit effacer ses alertes, soit être interdit.
C'est une décision de produit, et c'est pourquoi la migration n'est **pas**
incluse dans ce lot : elle est proposée, pas appliquée.

### Ce que je ne recommande pas

Un déclencheur `BEFORE INSERT` qui corrigerait silencieusement le
`tenant_id` à partir de l'équipement. Il ferait disparaître le symptôme en
laissant le défaut — c'est la version base de données de la valeur par défaut
globale que ce lot refuse.

---

## 5. Ce qui n'a pas été fait

- **La migration de contrainte n'est pas écrite** : voir ci-dessus, elle
  dépend d'une décision sur `ON DELETE` et du traitement préalable des
  catégories B et C.
- **`smart_notifications` et `automated_symptom_detection` n'ont toujours pas
  de `tenant_id`.** La fuite est fermée à la source (choix du destinataire),
  et aucune route ne lit ces tables aujourd'hui. Ajouter la colonne serait
  une défense en profondeur légitime, mais c'est un changement de schéma avec
  reprise de données qui dépasse ce lot.
- **Les identifiants d'équipement codés en dur** (1 et 2) du connecteur IoT
  avancé n'ont pas été touchés : ils relèvent d'un lot « données de
  démonstration dans le code produit », pas de l'isolation.
- **Rien n'a été exécuté sur l'instance en ligne.**

---

## 6. Résultats mesurés

| Barrière | Résultat |
|---|---|
| `npm run check` / `check:tests` / `check:scripts` | verts |
| Voie unitaire | **26 suites, 247 tests** — tous verts |
| Voie d'intégration | **18 suites, 222 tests** — 211 verts, 4 ignorés, 7 à faire |
| Nouvelle suite `integrite-alertes` | **13 cas, tous verts** |

### Non-vacuité

Les gardes ont été retirées une à une, le serveur rebâti, la suite relancée :
**9 des 13 cas tombent**. Les 4 qui résistent sont protégés par une garde que
ce sabotage-là ne touchait pas — le refus d'un relevé dont l'équipement est
inconnu, et le refus de notifier quand l'équipement ne désigne personne.

Les fichiers ont ensuite été restaurés et vérifiés **octet pour octet**
(empreintes SHA-256 identiques), et la suite repassée au vert.

### L'outil d'analyse des alertes historiques

Éprouvé sur une base dédiée portant les quatre catégories fabriquées exprès :
7 alertes en entrée, 7 en sortie, **aucune suppression**. La lecture seule n'a
rien modifié ; `--rattacher` a corrigé les 3 lignes de la catégorie A — dont
une vers un autre locataire que les deux autres, c'est-à-dire par la donnée et
non par un défaut — en laissant B et D intactes ; `--corriger-incoherents` a
ensuite réattribué la seule ligne de la catégorie D.

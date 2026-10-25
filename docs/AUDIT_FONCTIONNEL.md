# Audit fonctionnel de Maintrix

*25 octobre 2026 — confronté aux pratiques de la GMAO professionnelle et de la
supervision industrielle (EN 13306, ISO 14224, ISO 55000, ISA-18.2 / EEMUA 191
pour les alarmes).*

---

## Méthode

Les modules pris isolément ont déjà été audités au fil des campagnes
précédentes. Ce qui juge une GMAO n'est pas la présence des modules, c'est la
fermeture des **boucles** entre eux : une plateforme où chaque écran fonctionne
mais où rien ne se transmet reste un classeur, pas un outil de maintenance.

L'audit a donc porté sur les chaînes fonctionnelles, mesurées dans le code et
non supposées. Chaque constat ci-dessous est accompagné de l'endroit où il se
vérifie.

Mesure de cadrage : **112 tables**, dont **13 ni lues ni écrites** par le
serveur.

---

## 1. Les boucles fonctionnelles

| Boucle attendue | État | Où cela se vérifie |
|---|---|---|
| Demande d'intervention → OT | **absente** | aucune table de demande ; la DI est confondue avec l'OT |
| OT clôturé → consommation de pièces | **ouverte** | `gmao-routes.ts` ~477 |
| OT préventif clôturé → replanification du plan | **ouverte** | `nextDue` / `lastExecuted` jamais écrits hors édition manuelle |
| OT → état opérationnel de l'équipement | **ouverte** | `operationalState` jamais écrit par le serveur en exploitation |
| Compteur → alerte | **fermée** | `gmao-storage.ts` ~700 |
| Compteur → OT préventif | **ouverte** | le compteur crée une alerte, jamais un OT |
| Capteur → seuil → alerte | **fermée mais fausse** | seuils en dur — *corrigé, voir §5* |
| Alerte → OT | **ouverte** | aucune création d'OT depuis une alerte |
| Stock → point de commande → achat | **partielle** | moteur présent, déclenchement manuel |
| Panne → historique → MTBF/MTTR | **fermée** | `shared/fiabilite.ts` |
| Arrêts → disponibilité → TRS | **ouverte** | `oee_records` alimenté à la main uniquement |

### Le point central : la clôture d'un ordre de travail ne transmet rien

Dans une GMAO professionnelle, la clôture d'un OT est l'événement qui irrigue
tout le reste : elle consomme les pièces, fait avancer l'échéance du plan
préventif, remet à jour les compteurs, rend l'équipement disponible et nourrit
l'historique de fiabilité.

Ici, `PUT /api/work-orders/:id` avec `status: 'completed'` déclenche **une seule
chose** : une tentative de génération de rapport HTML, qui n'est même pas
enregistrée — le code le dit lui-même (« *On pourrait sauvegarder le rapport en
DB ou l'envoyer par email ici* »).

Conséquences concrètes pour un exploitant :

- le stock ne décroît jamais, donc le point de commande ne se déclenche jamais,
  donc la rupture se découvre devant la machine à l'arrêt ;
- un plan préventif exécuté reste à son échéance d'origine : il bascule en
  retard et y reste, et le taux de respect du préventif devient ininterprétable ;
- un équipement passé en `maintenance` y demeure après la réparation.

Le moteur de stock existe pourtant et il est bien écrit :
`StockManager.autoStockDeductionForWorkOrder()`, `reserveStock()`,
`autoStockReturnAfterWorkOrder()`. Il n'est accessible que par des appels
explicites : rien ne l'invoque à la clôture.

**Obstacle identifié** : `work_orders` ne porte aucun lien vers le plan
préventif qui l'a engendré. `plan_id` existe, mais sur `maintenance_counters`,
pas sur `work_orders`. Sans ce lien, la clôture ne peut pas savoir quel plan
replanifier. Correction = migration de schéma, donc vérification en base
nécessaire.

### La demande d'intervention n'existe pas

Aucune table ne porte la demande d'intervention. Or la séparation DI / OT est
structurante en GMAO : l'exploitant signale, la maintenance arbitre et
convertit — ou refuse en motivant. Tout confondre a trois effets visibles ici :

- n'importe qui doit créer directement un OT, c'est-à-dire engager la
  planification et le budget ;
- le refus motivé n'existe pas, donc la charge non traitée n'est pas mesurable ;
- le dispositif de validation a dû être greffé *après coup* sur l'OT, ce qui
  explique sa forme bancale (voir §3).

---

## 2. Supervision industrielle — le défaut le plus lourd

**Corrigé dans ce lot, voir §5.**

`equipment-health-routes.ts` jugeait tous les capteurs de toutes les
installations contre quatre constantes :

```
temperature: 75    vibration: 4.5    pressure: 4.0    current: 10
```

Ces nombres ne décrivent aucune installation en particulier. Une chaudière
vapeur travaille à 9 bar, une presse hydraulique à 185 bar, un moteur de 75 kW
tire 130 A. Le score de santé retranchait jusqu'à 45 points pour la pression et
30 pour le courant : **toute usine réelle était « critique » en permanence**,
non à cause de son état mais à cause de l'échelle des unités de ses capteurs.

Et comme une alerte était produite par *relevé* fautif, cela donnait des
milliers d'alarmes fausses par jour. C'est le mécanisme que l'ISA-18.2 et
l'EEMUA 191 existent pour empêcher : passé un certain volume, les opérateurs
cessent de lire les alarmes, et la vraie passe inaperçue. Une supervision qui
crie tout le temps est plus dangereuse qu'une supervision muette, parce qu'elle
inspire une vigilance qu'elle ne mérite pas.

La table prévue pour cela, `sensor_thresholds`, est **morte** : rattachée à
`iot_devices` que rien ne remplit, et sans lien vers l'équipement alors que les
relevés, eux, sont rattachés à l'équipement. Les deux moitiés du modèle ne se
raccordent pas.

---

## 3. Validation multi-niveaux — le contrôle n'en est pas un

L'identité du validateur et son niveau d'habilitation étaient envoyés **par le
navigateur** et repris tels quels par le serveur, sans aucune vérification :
`simple-validation-routes.ts` ne contient aucune occurrence de `canValidate`,
`requireRole` ni `hasPermission`. Poster `validationLevel: 2` suffisait à
obtenir `canExecute = true` en sautant le niveau 1. Et personne n'était
enregistré comme approbateur, le code ayant renoncé aux champs à contrainte de
clé étrangère.

En GMAO, la valeur d'une validation à plusieurs niveaux tient **entièrement** à
la traçabilité : qui a approuvé, à quel niveau, pour quel montant. Sans elle, le
dispositif a l'apparence d'un contrôle sans en être un.

*Chantier lancé séparément.*

---

## 4. Configuration d'entreprise — commune à tous les locataires

`company_config` ne porte aucune colonne locataire, et `createCompanyConfig`
exécute `UPDATE company_config SET is_active = false` **sans clause WHERE**. Le
locataire qui enregistre sa configuration désactive donc celle de tous les
autres et devient la seule ligne active : sa raison sociale, son adresse et son
numéro fiscal sont ensuite servis à tout le monde, y compris sur les bons de
commande générés. Les seuils d'approbation étant dans la même table, un
locataire modifie aussi ceux des autres.

*Chantier lancé séparément.*

---

## 5. Ce qui a été corrigé dans ce lot

### Supervision rebâtie sur une base défendable

`shared/supervision.ts` juge désormais chaque capteur contre **son propre
historique**, par maîtrise statistique du procédé : référence établie sur les
deux premiers tiers de la série, période récente comparée à cette référence,
écart exprimé en écarts-types (|z| ≥ 2 surveillance, ≥ 3 anomalie).

Aucun paramétrage n'est nécessaire — la machine fournit sa propre référence — et
la méthode est indifférente à l'unité. Deux précautions : la référence est bâtie
sur le passé et jamais sur la série entière, faute de quoi une dégradation lente
s'y dissoudrait ; et le plancher sur l'écart-type est *relatif* (1 % de la
moyenne), un plancher absolu dépendant de l'unité.

**Limite assumée** : cette méthode détecte un *changement*, pas un *dépassement*.
Une machine mauvaise depuis toujours sera jugée normale, son mauvais état étant
sa référence. Seuls des seuils d'ingénierie répondent à cette question : ce
module est un palliatif honnête, pas un remplaçant. Rétablir `sensor_thresholds`
reste nécessaire.

### Fabrications retirées du même module

- score de santé de **85 inventé quand il n'y a aucune donnée** — une machine non
  surveillée était annoncée saine à 85 % ;
- capteur absent présenté comme `value: 0, status: 'normal'` ;
- unité déduite du *type* de capteur alors que chaque relevé porte la sienne ;
- courbes de tendance comblées par des valeurs inventées (65 °C, 3,2 mm/s,
  3,5 bar, 8,5 A) ;
- `lastMaintenance` valant la date de **création de la fiche** et
  `nextMaintenance` valant « aujourd'hui + 30 jours » pour tout le parc — les
  deux annotées « Mock » dans le code ; elles viennent maintenant des
  interventions closes et des plans préventifs ;
- `timeToFailure: 365` (« un an si tout va bien ») ;
- plancher de confiance à 60 % ;
- identifiants d'alerte tirés par `Math.random()`.

### Budget (lot précédent)

`/api/budget-summary` et `/api/budget-requests` servaient deux tableaux **en
mémoire** — 325 000 € de budget, deux demandes d'achat nominatives — **partagés
par tous les locataires**. Module supprimé, page rebranchée sur
`/api/budgets/stats`, qui lit les vraies tables cloisonnées.

---

## 6. Modules présents mais sans existence réelle

13 tables ne sont **ni lues ni écrites** par le serveur. Deux comptent
fonctionnellement :

- **`sensor_thresholds`** — les seuils d'alarme, donc le paramétrage de toute la
  supervision ;
- **`iot_devices`** — le registre des équipements de mesure ; `sensor_thresholds`
  en dépend, ce qui explique que les deux soient inertes ensemble ;
- **`equipment_types`** — la typologie d'équipement reste du texte libre sur la
  fiche, sans référentiel.

Les dix autres relèvent de fonctions annexes : gamification (6 tables :
`maintenance_skills`, `user_skill_progress`, `maintenance_achievements`,
`user_achievements`, `skill_challenges`, `user_challenge_progress`), modèles de
rapport et planification d'envoi (`report_templates`, `reporting_schedules`),
moteur de workflow (`workflow_definitions`), et `companies`.

À quoi s'ajoutent des écrans sans contenu :

- onglet **« Alertes »** du tableau de bord GMAO : bouchon affichant
  « en cours de développement » ;
- page **`/data-import-export`** (582 lignes) : toutes ses API (`/api/data/*`)
  sont absentes du serveur, chaque action renvoie 404 ;
- onglet **« Historique »** : rend un outil d'import/export, pas un historique.

---

## 7. Ce qui reste à faire, par ordre de gravité

1. **Fermer la clôture d'OT** — consommation de pièces, replanification du plan
   préventif, mise à jour des compteurs et de l'état de l'équipement. Nécessite
   d'ajouter le lien `work_orders → plan préventif`. *Le plus structurant.*
2. **Rétablir `sensor_thresholds`** sur `(locataire, équipement, grandeur)` pour
   disposer enfin de seuils d'ingénierie en plus de la détection statistique.
3. **Introduire la demande d'intervention**, distincte de l'ordre de travail.
4. **Créer un OT depuis une alerte** — la détection ne débouche aujourd'hui sur
   aucune action.
5. **Déclencher le préventif sur compteur**, et non seulement une alerte.
6. **Trancher le sort des 13 tables mortes** : les brancher ou les retirer. Un
   schéma qui promet des fonctions inexistantes égare quiconque le lit.
7. **Supprimer ou achever** l'onglet Alertes, la page `/data-import-export` et
   l'onglet Historique mal nommé.

---

## Note de méthode

Deux pièges ont été rencontrés pendant cet audit et méritent d'être retenus.

**Une valeur n'est pas fiable parce qu'elle vient du serveur.** La passe
anti-fabrication du 11 octobre avait nettoyé les littéraux du Reporting avancé
mais laissé intacte la section budgétaire, dont les chiffres arrivaient d'une
API — et provenaient en réalité d'un tableau en mémoire. Il faut remonter
jusqu'à la *table*, pas jusqu'à l'*endpoint*.

**Un typage vert ne prouve pas un contrat respecté.** En changeant la forme de
`/api/equipment/health`, le compilateur est resté silencieux sur deux graphiques
dont la `dataKey` était une chaîne de caractères, et sur une interface cliente
qui déclarait encore un champ que le serveur n'envoyait plus. Ces deux-là ne se
voient qu'en relisant le contrat des deux côtés.

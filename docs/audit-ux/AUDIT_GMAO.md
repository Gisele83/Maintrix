# GMAO — audit et proposition de refonte

**Date :** 20 octobre 2026
**Étape :** 1 sur 2 — audit et proposition. **Aucune modification structurelle n'a été
faite.** L'implémentation attend votre validation.
**Maquettes :** canevas « GMAO Maintrix — audit et refonte proposée »
(4 planches : vue d'ensemble proposée, l'écran aujourd'hui, l'organisation en six
domaines, les constats mesurés).

**Méthode :** lecture du code, puis mesure sur l'instance réelle — serveur lancé depuis le
bundle, base PostgreSQL de test, locataire Alpha authentifié, **143 équipements et
26 ordres de travail réels**. Chaque chiffre de ce document a été relevé, pas estimé.

---

## 1. Ce qui se passe quand on ouvre la GMAO

Un responsable de maintenance ouvre `/gmao` le 20 octobre 2026. Voici ce que l'écran lui
dit, et ce que contient la base au même instant :

| L'écran affiche | La base contient |
|---|---|
| **Ordres de travail : 0** | **26 ordres en attente**, aucun affecté |
| **« Aucune urgence, aucun retard, aucun seuil franchi. Le parc tourne. »** | 26 interventions sans technicien ni date |

**Cause.** Le compteur en haut d'écran s'appelle « Ordres de travail » mais ne compte que
`status = 'in_progress'` (`gmao-storage.ts`, `getDashboardKPIs`) — les interventions déjà
démarrées. Et le bloc « À traiter » ne liste que l'urgent, le retard, les seuils franchis
et les indisponibilités : **un ordre simplement en attente n'y a aucune ligne**. Les deux
omissions se composent, et le cockpit affirme qu'il n'y a rien à faire.

*Ce bloc « À traiter » est celui que j'ai écrit à l'étape B. L'omission est de mon fait.*

---

## 2. Inventaire

### 2.1 Structure

| Niveau | Contenu | Nombre |
|---|---|---|
| Onglets principaux | Vue d'ensemble, Ordres de travail, Équipements, Inventaire, Alertes | **5** |
| Sous-onglets, derrière le bouton « Plus » | Maintenance préventive, Historique, Achats, Rapports, Analytiques, Santé des équipements, Validation multi-niveaux, Configuration de l'entreprise | **8** |
| Tuiles de modules sur la vue d'ensemble | Exploitation (6), Analyse (6), Conformité et partenaires (6), Données et échanges (3) | **21** |
| Composants montés | voir 2.2 | **13** |
| Lignes de code derrière la page | `gmao-dashboard.tsx` (1 233) + ses composants (7 452) | **8 685** |

**41 destinations** sont atteignables depuis cette seule page.

### 2.2 Composants montés

`work-order-management` (820 l.), `equipment-management` (682), `inventory-simple` (683),
`preventive-maintenance` (909), `maintenance-reports` (1 062), `history-management` (501),
`procurement-dashboard` (370), `validation-dashboard-simple` (456),
`purchase-order-workflow-demo` (231), `purchase-order-creator` (468),
`equipment-health-dashboard` (471), `threshold-configuration` (256),
`company-letterhead-config` (543).

### 2.3 Mesures sur la vue d'ensemble

| Mesure | Valeur |
|---|---|
| Mots affichés | 246 |
| Liens cliquables | 33, pour **28 destinations distinctes** |
| Boutons visibles | 17 |
| Hauteur | **3,2 écrans** de défilement |
| **Liens qui restent dans la GMAO** | **0 sur 24** |

L'accueil n'est pas un poste de travail : **c'est une table d'aiguillage**. Et 5 des
24 tuiles renvoient vers ce qui existe déjà en onglet — Équipements, Ordres de travail,
Alertes, Inventaire, Plan de maintenance — mais vers une *autre* implémentation.

---

## 3. Le même métier, deux implémentations

Quatre domaines existent en double : une fois comme onglet, une fois comme page autonome.
Ce ne sont pas deux vues du même code, mais **deux codes différents**.

### 3.1 Ordres de travail — les capacités divergent

| Capacité | Onglet GMAO | Page `/work-orders` |
|---|---|---|
| Recherche texte | oui | oui |
| Filtre par statut | oui | oui |
| Créer, modifier | oui | oui |
| **Supprimer** | **oui** | non |
| **Créer un équipement sans quitter le formulaire** | **oui** | non |
| **Filtrer par priorité** | non | **oui** |
| **Démarrer / suspendre / terminer** | non | **oui** |
| **Choisir le technicien dans la liste des comptes** | non | **oui** |
| **Écart de compétence et demande de formation** | non | **oui** |
| **Suggestion de transition de cycle de vie** | non | **oui** |
| **Lien vers l'exécution terrain** | non | **oui** |

Le même objet métier offre des opérations différentes selon la porte empruntée. Une
correction appliquée d'un côté n'atteint pas l'autre.

### 3.2 Le préventif — deux tables, trois écrans

| Écran | Lignes | Point d'API | Table |
|---|---|---|---|
| GMAO › Plus › Maintenance préventive | 909 | `/api/preventive-maintenance-plans` | `preventive_maintenance_plans` |
| Page `/preventive-maintenance` | 1 172 | `/api/maintenance-plans` | `maintenance_plans` |
| Page `/maintenance-plan` | 378 | `/api/maintenance-plans` | `maintenance_plans` |

**Mesuré sur le même locataire, au même instant :**

```
preventive_maintenance_plans  →  12 plans
maintenance_plans             →   0 plan
```

Un plan créé d'un côté est invisible de l'autre. Ce n'est pas une duplication d'affichage :
ce sont **deux jeux de données parallèles pour la même notion métier**.

### 3.3 Et cinq plans fabriqués comblent le vide

`client/src/pages/preventive-maintenance.tsx` ligne 112 :

```js
// Sample static data for demo
const staticPlans: MaintenancePlan[] = [ … ];
…
const allPlans = [...formattedPlans, ...staticPlans];
```

Cinq plans entièrement inventés — **concaténés aux vrais**, donc toujours affichés, quelle
que soit l'organisation :

| Inventé | Valeurs |
|---|---|
| Techniciens | Jean Dupont, Marie Martin, Pierre Durand, Sophie Blanc, Michel Leroy |
| Coûts | 150 €, 280 €, 450 €, 50 €, 800 € |
| Taux de réalisation | 98 %, 85 %, 92 %, 100 %, 95 % |

C'est ce qui produit le « 5 plans · 94 % de réalisation » qu'affiche l'écran alors que
l'API renvoie **zéro**. Cela contrevient directement à la règle « ne pas introduire de
données fictives dans les vues opérationnelles ».

---

## 4. Actions inopérantes et contenus internes

**Le bouton « Supprimer » d'un équipement ne peut pas fonctionner.** Il appelle
`DELETE /api/equipment/:id` ; cette route n'existe pas. Mesuré : 404 pour le technicien
comme pour l'administrateur. L'utilisateur reçoit le message brut du routeur —
`Route API inconnue : DELETE /api/equipment/42` — un texte interne exposé tel quel.

*`apiRequest` lève bien sur un statut d'erreur : l'utilisateur voit une erreur, pas un faux
succès. Le défaut est que le bouton ne marche jamais, pas qu'il mente.*

---

## 5. Rôles, permissions et workflows

### 5.1 Un RBAC complet, monté nulle part

`client/src/hooks/use-permissions.ts` déclare **39 permissions** granulaires
(`delete_work_orders`, `validate_work_orders`, `manage_inventory`, `manage_settings`…), et
trois composants existent pour les appliquer : `Can`, `ProtectedRoute`,
`RoleBasedNavigation`.

**Aucun des trois n'est monté nulle part.** Ni `gmao-dashboard.tsx` ni aucun de ses
13 composants ne consulte un rôle — vérifié fichier par fichier.

### 5.2 Ce n'est pas une faille — c'est une promesse creuse

Vérifié sur l'instance, avec jeton CSRF valide et identifiant inexistant pour distinguer un
refus d'autorisation (403) d'une absence (404) :

| Opération | Technicien | Administrateur | Lecture |
|---|---|---|---|
| Supprimer un ordre de travail | **403** | 404 | le serveur contrôle bien le rôle |
| Supprimer un équipement | 404 | 404 | la route n'existe pas (cf. §4) |

Le serveur reste donc l'autorité, et il tranche. Le défaut est ergonomique : **on montre à
un technicien des boutons que le serveur refusera**, et on lui laisse découvrir le refus
après coup.

> **Note de méthode.** Mon premier relevé concluait que le rôle était contrôlé partout. Il
> était faux : les 403 venaient du CSRF, pas du rôle — l'administrateur les recevait aussi.
> Le jeton CSRF est un *cookie* posé à la connexion, pas une route. Sans ce contrôle en
> miroir sur un compte privilégié, j'aurais livré une fausse assurance.

### 5.3 Workflows — aucun n'est en cause

La validation multi-niveaux des bons de commande, la création d'ordre, la transition de
cycle de vie et le contrôle qualité fonctionnent et gardent leurs règles. La refonte ne les
touche pas.

---

## 6. L'information, triée

| Nature | Sur l'accueil aujourd'hui | Devient |
|---|---|---|
| **Essentiel** | « À traiter », les quatre compteurs, les derniers ordres | Reste, remonte, et s'ouvre sur la **file de travail** — l'écran doit dire quoi affecter |
| **Secondaire** | Activité sur douze mois, répartition du parc par type, indicateurs de maintenance | Descend dans l'onglet **Indicateurs** |
| **Redondant** | 5 tuiles menant à ce qui existe déjà en onglet | Disparaît : l'onglet est le chemin |
| **Inutilement visible** | 19 autres tuiles (OEE, AMDEC, étalonnages, garanties, portail client, intégrations…) | Rejoint la barre de navigation, où ces écrans figurent déjà |
| **Faux** | « Ordres de travail : 0 » et « le parc tourne » | Corrigé : le compteur devient « En attente », et « À traiter » gagne sa ligne |

---

## 7. Organisation proposée — six domaines

| # | Domaine | Ce qu'il réunit |
|---|---|---|
| 1 | **Vue d'ensemble** | À traiter · charge du moment · file de travail |
| 2 | **Actifs** | Équipements · santé des machines · cycle de vie · codes QR · capteurs |
| 3 | **Ordres de travail** | Liste et affectation · exécution terrain · alertes · permis de travail |
| 4 | **Planification** | Plans préventifs · plan annuel · étalonnages · habilitations |
| 5 | **Stocks** | Inventaire · achats · fournisseurs · garanties · validation |
| 6 | **Indicateurs** | Rapports · analytiques · historique · OEE, causes racines, AMDEC · budget |

Les 13 destinations actuelles et les 21 tuiles trouvent toutes leur place. Le niveau caché
« Plus » disparaît : on passe de **trois niveaux de navigation à deux**.

### Trois principes

1. **Une implémentation par domaine.** L'onglet monte le composant de la page, comme le
   font déjà Équipements et Inventaire. **L'union des capacités est conservée** : la
   suppression et la création d'équipement en ligne de l'onglet rejoignent le filtre par
   priorité, les transitions de statut, les techniciens, l'écart de compétence et le lien
   vers l'exécution de la page.
2. **Les rôles deviennent visibles.** Le RBAC existant est branché là où il évite une
   promesse creuse. Le serveur reste seul juge.
3. **L'accueil ne renvoie plus ailleurs.** Ses 7 destinations restent dans la GMAO.

---

## 8. Ce que la refonte ne touche pas

- **Aucun contrat d'API** : mêmes points, mêmes charges utiles.
- **Aucun workflow métier.**
- **Aucune autorisation serveur.**
- **Aucune suppression de fonctionnalité** : les 13 composants restent montés.
- **Aucun algorithme industriel.**
- **Aucun retour du thème sombre.**

---

## 9. Deux points qui demandent votre arbitrage

1. **Le préventif à deux tables.** Fusionner `preventive_maintenance_plans` et
   `maintenance_plans` touche la base et le serveur — hors du périmètre frontend, et une
   autre session travaille sur ces fichiers. Trois options : *(a)* ne garder qu'un écran
   côté interface, celui qui lit la table réellement alimentée ; *(b)* garder les deux en
   indiquant à l'écran laquelle est consultée ; *(c)* ouvrir un chantier serveur de fusion.
   **Je recommande (a)** pour cette refonte, et (c) comme chantier séparé.
2. **Les ordres de travail en cartes ou en tableau.** Le cahier des charges demande des
   tableaux triables ; les techniciens travaillent aujourd'hui sur des cartes. La maquette
   propose un **tableau** pour la file de travail de l'accueil, et laisse l'onglet en
   cartes. À confirmer.

*Les cinq plans fabriqués partent dans tous les cas : ils ne demandent pas d'arbitrage.*

---

## 10. Plan d'implémentation, après validation

| Lot | Contenu | Risque |
|---|---|---|
| 1 | Corriger le compteur et « À traiter » — la contradiction de la §1 | faible, isolé |
| 2 | Retirer les cinq plans fabriqués | faible |
| 3 | Réorganiser en six domaines, sans toucher aux composants | moyen, réversible |
| 4 | Unifier les quatre domaines dupliqués, capacités réunies | **le plus sensible** — un lot par domaine, vérifié à l'écran |
| 5 | Brancher le RBAC existant sur les actions sensibles | faible |
| 6 | Retirer le bouton inopérant, ou créer la route serveur manquante | à arbitrer |

Chaque lot est un commit isolé, vérifiable à l'écran et réversible seul. Les tests de
non-régression, d'accessibilité et de navigation s'exécutent à chaque lot, comme aux étapes
précédentes.

---

## 11. Lots 1 et 2 — faits le 20 octobre 2026

Seuls les deux lots demandés ont été traités. **La réorganisation en six domaines n'a pas
été engagée.**

### Lot 1 — le compteur contradictoire

| | Avant | Après |
|---|---|---|
| Tuile en haut d'écran | « Ordres de travail : **0** » | « Ordres ouverts : **26** » |
| Ce qu'elle compte | `in_progress` seulement | `pending` + `in_progress` |
| « À traiter » | « Aucune urgence, aucun retard. Le parc tourne. » | « **26 ordre(s) de travail à affecter** » |

Vérifié sur l'instance : la base contient 26 en attente et 0 en cours, la tuile affiche 26,
et la mention « Le parc tourne » a disparu. Le même défaut existait sur l'écran
d'ingénierie de maintenance — corrigé à l'identique.

### Lot 2 — les plans fabriqués

Les cinq plans de `pages/preventive-maintenance.tsx` sont retirés, avec leurs cinq
techniciens nommés, leurs cinq coûts et leurs cinq taux de réalisation. L'écran affiche
désormais **0 plan**, ce que contient réellement la table, avec un état vide qui explique
ce qu'est un plan préventif.

Deux conséquences traitées au passage :

- **`Math.round(0 / 0)` donnait `NaN`** : l'écran aurait affiché « NaN % ». Le défaut était
  masqué par les plans fabriqués, qui garantissaient un dénominateur non nul. Une moyenne
  sans population vaut désormais « — ».
- **Le garde-fou écrit pour ce lot a trouvé les mêmes techniciens inventés ailleurs**, sur
  l'écran Perception IoT : un « Classement des Techniciens » listant Jean Dupont, Marie
  Martin et Pierre Durand avec leurs points et leurs niveaux, et un sélecteur proposant
  trois employés à matricules inventés (MAT001 à MAT003) qui pilotait pourtant les requêtes
  de compétences. Le classement est remplacé par un état explicite ; le sélecteur liste les
  comptes réels de l'organisation.

### Trois constats qui appellent une décision serveur

Ils sont hors du périmètre frontend et une autre session travaille sur ces fichiers.

1. **`/api/gamification/leaderboard` est un faux.** Son code porte le commentaire
   « Mock leaderboard data » et renvoie les mêmes trois personnes inventées. Brancher
   l'écran dessus n'aurait rien changé.
2. **Le rang d'un technicien est tiré au sort.**
   `server/integrations/gamification-engine.ts` :
   `position: Math.floor(Math.random() * 20) + 1, // Mock position`. Vérifié par trois
   requêtes successives sur le même compte : **12, 13, 11**. Un nombre qui change à chaque
   affichage paraît vivant — c'est pire qu'une constante. La tuile qui l'affichait est
   retirée côté interface ; la route reste à traiter.
3. ~~**Le préventif à deux tables**~~ — **tranché le 20/10/2026, option (a). Voir §12.**

---

## 12. Le préventif à deux tables — option (a), 20 octobre 2026

Décision de l'utilisateur : **ne garder côté interface que l'écran qui lit la table
réellement alimentée.**

### Laquelle, et pourquoi pas sur le comptage

Un comptage sur un seul locataire de test ne prouve rien : `maintenance_plans` pourrait
être vide ici et pleine ailleurs. Le critère retenu est **l'intégration au reste du
système**, qui ne dépend pas du jeu de données :

| | `preventive_maintenance_plans` | `maintenance_plans` |
|---|---|---|
| Fichiers serveur la référençant | **6** | 4 |
| Occurrences | **45** | 12 |
| « À traiter » de la GMAO (`preventifEnRetard`, `preventifSous7Jours`) | **oui** | non |
| Agents fonctionnels (`overdue_pm`) | **oui** | non |
| Import / export de données | **oui** | non |
| Générateur de données de test | **oui** | non |
| Quelque chose au-delà de sa propre CRUD | **oui** | **non** |

`maintenance_plans` est un îlot : sa table, ses routes, ses deux écrans, et rien qui la
relie au tableau de bord, aux agents ou aux imports. Ce qu'un client importe atterrit dans
l'autre.

**Ce qui tranche définitivement :** le bloc « À traiter » comptait les préventifs en retard
dans `preventive_maintenance_plans`, puis renvoyait l'utilisateur vers `/maintenance-plan`,
qui lit `maintenance_plans`. On cliquait sur « 3 préventifs en retard » et on arrivait sur
une liste vide. Ce parcours est réparé par la même décision.

### Ce qui a été fait

- **`client/src/pages/preventive.tsx`** (nouveau) monte le composant qui lit la table
  alimentée, dans le gabarit commun, avec titre et fil d'Ariane.
- **`/preventive`, `/preventive-maintenance` et `/maintenance-plan`** mènent toutes les
  trois à cet écran. Les signets continuent de fonctionner.
- Le sous-onglet « Maintenance préventive » de la GMAO monte **le même composant**, avec
  son propre en-tête. Une implémentation, deux points de montage.
- **`pages/preventive-maintenance.tsx` (1 172 l.) et `pages/maintenance-plan.tsx`
  (378 l.) sont supprimées.**

### Analyse d'impact — ce qui est perdu, et ce qui ne l'est pas

| Capacité | Écran conservé | Pages retirées |
|---|---|---|
| Créer, modifier, supprimer un plan | oui | oui |
| Recherche | **oui** | `/maintenance-plan` : non |
| Filtre par statut | **oui** | `/maintenance-plan` : non |
| Compteurs d'usage (heures, cycles) | **oui** | `/maintenance-plan` : non |
| Calendrier, année fiscale | oui | oui |
| Onglet « Analyses » | non | `/preventive-maintenance` seulement |
| Statistiques dédiées | non | `/maintenance-plan` seulement |

Les deux capacités perdues portaient sur la table vide. L'onglet « Analyses » portait de
surcroît, dans son propre code, la mention « Cet export fabriquait ses chiffres » — une
campagne précédente l'avait déjà neutralisé.

### Vérification

![Avant](captures/preventif-avant-une-seule-table.jpg)
![Après](captures/preventif-apres-une-seule-table.jpg)

Mesuré après reconstruction : les trois routes servent le même écran, avec un seul `<h1>`
« Maintenance préventive », la barre de navigation, et **14 plans affichés pour 14 en
base**. L'ancien titre « Plan de Maintenance Annuel » a disparu de l'interface.

> **Note de méthode.** Ma première vérification portait sur un bundle périmé de douze
> minutes : l'écran montrait encore l'ancienne page, et j'ai failli conclure que le routage
> n'avait pas pris. Comparer l'horodatage de `dist/` à celui des sources avant de conclure
> quoi que ce soit d'une vérification au navigateur.

### Au passage : une page morte aux métriques fabriquées

`pages/maintenance-dashboard.tsx` (878 lignes) n'était importée nulle part — sa route
redirigeait vers `/gmao` depuis le 11 octobre, parce qu'elle affichait « 156 ordres de
travail, OEE 87,5 %, MTBF 720 h, 125 800 € de coûts », chiffres que son propre code
annonçait comme « Sample data ». Le garde-fou écrit pour la moyenne sans population l'a
rencontrée. Le fichier est supprimé ; la redirection reste pour les signets.

### Ce qui reste ouvert

La **fusion des deux tables** côté serveur. `maintenance_plans` existe toujours, avec ses
routes et son schéma ; plus aucun écran ne la lit. Tant qu'elle reste, un développeur peut
la rebrancher sans le savoir. C'est un chantier serveur, hors du périmètre frontend.

---

## 13. Les ordres de travail à deux implémentations — 20 octobre 2026

Deux écrans servaient les ordres de travail, avec des capacités, un vocabulaire et
**des contrats de champs différents** :

| | `pages/work-orders.tsx` (638 l.) | `components/work-order-management.tsx` (820 l.) |
|---|---|---|
| Monté par | `/work-orders` | onglet « Ordres de travail » de la GMAO |
| Filtre priorité | oui | **non** |
| Tuiles d'indicateurs | 4 | **aucune** |
| Affectation | sélecteur d'utilisateurs | **champ texte libre** |
| Fiche de détail | oui, 12 champs | **non** |
| Écart de compétence, cycle de vie | oui | **non** |
| Suppression | **non** | oui |
| Création d'équipement en place | **non** | oui |
| Notes, 7 types d'ordre | **non** | oui |
| Libellés | français | **valeurs serveur brutes** |

### Ce que la mesure a montré

Relevé dans le DOM de l'onglet GMAO : **deux titres superposés** — un `<h1>` « Ordres de
travail » suivi du `<h2>` « Ordres de Travail » que le composant portait lui-même — quatre
valeurs brutes affichées (`pending`, `on_hold`, `high`, `medium`) et **35 boutons de
suppression** visibles quel que soit le rôle.

Mais le plus grave n'était pas à l'écran. `POST /api/work-orders` ne recopie pas le corps
reçu : il reconstruit un objet champ par champ. Envoyé le payload **exact** de l'onglet,
le serveur a répondu `201 Created` — « Ordre de travail créé avec succès » — et enregistré :

| Champ envoyé | Valeur reçue | Valeur enregistrée |
|---|---|---|
| `orderType` | `"calibration"` | **`"corrective"`** — réécrit |
| `requestedBy` | `1` | **`null`** — perdu |
| `estimatedDuration` | `4` | **`null`** — perdu |
| `scheduledStart` | `2026-11-15T09:00` | **`null`** — perdu |

Autrement dit : on choisissait « Étalonnage », on saisissait une durée et une date, on
lisait un message de succès, et l'ordre était correctif, sans échéance et sans durée.
S'y ajoutaient deux champs texte « Demandeur » et « Assigné à » alors que les colonnes
sont des clés étrangères numériques : `parseInt("Jean Dupont")` vaut `NaN`, donc la saisie
était écartée avant même l'envoi. **Affecter un technicien par son nom n'a jamais rien
enregistré.**

Côté page, deux échecs francs plutôt que des pertes silencieuses :

- `dueDate` rempli → `HTTP 400`, « Expected date, received string » ;
- description vide → `HTTP 400`, « description Required ».

Or le formulaire n'exigeait que le titre et l'équipement, et proposait un champ « Date
d'échéance ». **Remplir l'échéance — le geste normal — rendait la création impossible.**

### Un seul dictionnaire

L'onglet écrivait `on_hold` pour « suspendu », la page ne connaissait que `paused` : un
ordre suspendu depuis l'onglet ressortait sur la page en pastille grise portant le texte
`on_hold`. `shared/schema.ts` documente `paused` sur la colonne ; c'est la valeur retenue.
`on_hold` reste reconnu **en lecture** — la colonne est un `varchar` sans contrainte et des
lignes le portent déjà — mais n'est plus jamais proposé à la saisie. Même mécanique d'alias
que `shared/roles.ts`, pour la même raison : une valeur inconnue ne lève pas d'erreur, elle
s'affiche de travers en silence.

Vérifié : sous le filtre « Suspendu », les deux lignes remontent — celle stockée `paused`
et celle stockée `on_hold`.

### Ce qui a été fait

`components/work-order-management.tsx` est désormais l'unique implémentation. `/work-orders`
et l'onglet de la GMAO la montent tous deux, chacun avec son en-tête, comme pour les
équipements et le préventif. L'union des capacités est conservée — et chacune vérifiée :

- la suppression passe du bouton-corbeille de chaque vignette à la fiche de détail, avec une
  confirmation qui **nomme l'ordre** au lieu d'un `confirm()` anonyme, et n'est affichée
  qu'aux rôles que le serveur autorise (`auMoins(role, 'technical_director')`, soit
  directeur technique, administrateur et propriétaire). Vérifié : le technicien ne voit
  aucun bouton ; l'administrateur supprime, `DELETE → 200` ;
- la création d'équipement en place, les notes et les sept types d'ordre sont repris ;
- l'affectation **et** la demande passent par des sélecteurs d'utilisateurs ;
- le changement de statut complet (suspendre, annuler, affecter) vit dans la fiche ; la
  vignette ne garde que la transition attendue — « Démarrer », « Terminer ».

### Comment les capacités tiennent sans toucher au serveur

`PUT /api/work-orders/:id` recopie le corps (`{ ...updates }`) puis traduit les alias.
Vérifié : il accepte `dueDate` en chaîne, `requestedBy`, et les sept valeurs d'`orderType`.
La création procède donc en deux temps — un `POST` avec ce que POST sait lire, puis, **si et
seulement si** l'une de ces informations a été saisie, un `PUT` qui la complète. Si le PUT
échoue, l'ordre existe : le message le dit et rouvre la fiche, au lieu de laisser croire que
tout a été pris.

S'y est ajouté un défaut trouvé en vérifiant : le champ « Heures estimées » propose un pas
de 0,5 mais `POST` calcule `parseInt(estimatedHours) * 60` — **3,5 h était enregistré comme
3 h**. `PUT` fait `Math.round(parseFloat(...) * 60)` et tombe juste ; le complément part donc
aussi quand la saisie n'est pas un nombre entier d'heures. Vérifié : 2,5 h saisies →
`estimated_duration = 150`.

### Vérification

Créé par le formulaire, puis relu **en base** et non dans l'interface :

```
order_type         | calibration          (était : corrective)
requested_by       | 1                    (était : null)
estimated_duration | 180                  (était : null)
scheduled_start    | 2026-12-15 00:00:00  (était : null)
assigned_to        | 2                    (était : null — NaN)
```

Un seul `<h1>` sur les deux écrans, zéro valeur brute affichée, zéro corbeille sur la liste,
les quatre tuiles et le filtre de priorité désormais présents dans l'onglet. 24 suites et
201 tests unitaires verts, dont 9 nouveaux garde-fous ; 10 suites et 96 tests d'intégration
verts.

> **Note de méthode.** Les tests d'intégration ont d'abord rendu 75 échecs, puis 36. Aucun
> n'était une régression : le premier lot venait du limiteur anti-force-brute, déclenché par
> mes propres tentatives de connexion refusées pendant la vérification au navigateur ; le
> second, d'un secret super-admin que je n'avais pas transmis au processus de test. Le
> harnais avant le code — c'est la deuxième fois dans cette campagne.
>
> `npm run test:fast` a par ailleurs annoncé **« PASS — 0 test »** : dans un arbre de travail
> `.claude`, le `testMatch` de jest résout un chemin à séparateurs mélangés et ne trouve
> aucun fichier, sans que rien ne le signale. Un vert à zéro test n'est pas un vert.

### Ce qui reste ouvert — côté serveur

`POST /api/work-orders` devrait lire `dueDate`, `orderType` et `requestedBy` comme `PUT` le
fait déjà, et accepter les demi-heures. Le détour en deux écritures appartient au client et
n'a lieu d'être que tant que ce n'est pas corrigé. Deux autres points relevés au passage :

- `client/src/pages/tenant-permissions.tsx:150` compare encore les rôles par
  `["admin","director"].includes(...)` — la forme échappe au garde-fou existant, qui ne
  traque que l'égalité littérale. Et `director` n'existe dans aucun référentiel de rôles ;
- le même `director` fantôme figure dans le contrôle serveur de la suppression
  (`gmao-routes.ts:511`), où il ne correspond jamais à rien.

---

## 14. L'historique et les rapports — 20 octobre 2026

### 14.1 Trois écrans nommés « Historique », dont un seul en montrait

| Écran | Monté par | Lit | État mesuré |
|---|---|---|---|
| `pages/historique.tsx` (440 l.) | `/historique`, dans la navigation | `/api/maintenance-history` | fonctionne |
| `components/history-management.tsx` (501 l.) | onglet « Historique » de la GMAO | — | **aucun historique** : une console d'import/export |
| `components/maintenance-history.tsx` (408 l.) | onglet « Historique » du tableau de bord | `/api/history` | **page blanche** |

L'onglet de la GMAO s'intitulait « Gestion de l'Historique » et proposait « Importez et
exportez vos données » : pas une ligne d'historique à l'écran.

### 14.2 La page blanche, et pourquoi personne ne l'avait vue

`/api/history` compose sa réponse à partir de `storage.getDiagnosticSessions()`, dont
l'implémentation est `db.select().from(diagnosticSessions)` — **sans aucun filtre de
locataire**. Le garde-fou `antiLeakageValidator` le détecte et remplace le corps par
`{ error: 'CROSS_TENANT_DATA_DETECTED' }` — **mais laisse le statut à 200**.

Vérifié en insérant UNE session de diagnostic appartenant à un second locataire :

```
avant : GET /api/history → 200, 20 enregistrements
après : GET /api/history → 200, {"error":"CROSS_TENANT_DATA_DETECTED", …}
```

Le client vérifiait `res.ok`, le trouvait vrai, et appelait `.map` sur un objet :
`TypeError: a.map is not a function`. **`/dashboard` ne rendait plus rien du tout** —
onglet « Historique » comme onglet « Signalement », qui lit `/api/reports` et souffre
exactement du même défaut (`storage.getReportedCases()` est tout aussi peu cloisonné).

Ce défaut est invisible sur un jeu de données mono-locataire. C'est précisément ce qui
l'a fait survivre : il ne se déclenche que là où il fait le plus de dégâts, en production
multi-locataire.

> La base de test contient désormais, volontairement, une ligne appartenant au locataire
> « Tenant Beta ». Elle n'a pas été retirée : elle maintient le défaut serveur visible
> pour qui voudra vérifier la correction.

### 14.3 Ce qui a été fait

**Le garde-fou central** est dans `lib/queryClient.ts` : un corps de réponse qui a la
forme d'un refus (`{ error, message }`) est traité comme une erreur même servi en 200,
sur les trois chemins de lecture (`apiRequest`, `uploadFile`, `getQueryFn`). Un écran ne
doit jamais blanchir parce qu'une réponse n'a pas la forme attendue — quelle que soit la
cause côté serveur. Les deux onglets se sont relevés sans autre modification.

**L'historique** est désormais `components/historique-maintenance.tsx`, monté par
`/historique`, l'onglet de la GMAO et celui du tableau de bord. Il lit
`/api/maintenance-history`, qui passe par `gmaoStorage.getWorkOrders(tenantId)` et est
donc correctement cloisonnée. L'union des capacités est conservée : recherche, filtres
par type, par statut et **par période** (celui-ci venait de l'onglet du tableau de bord),
export CSV et Excel côté serveur, export de la **vue filtrée** côté navigateur, import
avec modèle de colonnes téléchargeable.

**Un libellé corrigé au passage.** `mapWorkOrderStatus` ne distingue que `completed` et
`cancelled` : tout le reste devient `in_progress`. Sur le locataire de test, 45 ordres
« pending », 1 « paused » et 1 « on_hold » arrivaient ainsi en `in_progress`. Afficher
« En cours » aurait affirmé que 47 interventions étaient engagées alors que 45 n'avaient
pas commencé. Le libellé retenu est **« Non clôturé »**, qui est vrai pour les 47.

### 14.4 L'import/export : trois implémentations, deux familles d'API, dont une inexistante

| Écran | Famille appelée | État mesuré |
|---|---|---|
| `pages/data-import-export.tsx` (587 l.) | `/api/data/*` | **404 sur tout** |
| `components/history-management.tsx` | `/api/data-import-export/*` | 200 |
| bloc interne de `pages/historique.tsx` | `/api/data-import-export/*` | 200 |

```
GET /api/data/export?type=maintenance-history&format=csv   → 404
GET /api/data/template?type=equipments&format=csv          → 404
GET /api/data/import-history                               → 404
GET /api/data-import-export/export?…                       → 200
```

Les endpoints appelés par la page de 587 lignes existent bel et bien — sous un autre
préfixe. Aucun de ses boutons n'avait jamais rien produit. Le préfixe est corrigé ; la
page gagne au passage `/validate`, et son envoi de fichier passe par `uploadFile`, qui
pose le jeton CSRF (sans quoi l'import est refusé en 403 depuis F06).

Les listes de types sont alignées sur ce que le serveur traite réellement
(`server/data-import-export-routes.ts`) : **trois** types à l'import (équipements,
historique de maintenance, pièces détachées), **cinq** à l'export. Les deux consoles
proposaient la même liste des deux côtés, « Utilisateurs » compris — qu'aucune des deux
routes ne traite.

### 14.5 Les rapports ne sont PAS des doublons

Trois écrans portent le mot « rapport ». Ils n'ont **aucun endpoint en commun** :

| Écran | Lit | Objet métier |
|---|---|---|
| `pages/advanced-reporting.tsx` | kpi-metrics, budgets, budget-requests, alerts, work-orders, equipment | tableau de bord de direction |
| `components/maintenance-reports.tsx` (1 062 l.) | maintenance-reports, monthly-reports | **documents** d'intervention et mensuels, générés en PDF |
| `components/case-reporting.tsx` | report, reports | **formulaire** de signalement d'un cas |

Les réunir supprimerait des capacités au lieu d'en préserver : un document PDF n'est pas
un tableau de bord, et un formulaire de signalement n'est ni l'un ni l'autre. Leurs
métriques ont par ailleurs été vérifiées : celles de `maintenance-reports` proviennent de
`monthly_reports` — ce sont des données stockées, pas des chiffres fabriqués.

Ce qui est vrai, en revanche, c'est que leurs **portions analytiques** se recouvrent
partiellement avec l'onglet « Analytiques » de la GMAO. C'est une question de structure,
pas de doublon d'implémentation : elle relève du lot 3.

### 14.6 Ce qui reste ouvert — côté serveur

1. **`storage.getDiagnosticSessions()` et `storage.getReportedCases()` ne filtrent pas par
   locataire.** C'est la cause des deux pages blanches. Tant que ce n'est pas corrigé,
   aucun écran ne peut afficher les sessions de diagnostic : il n'existe pas de route
   `GET /api/diagnostic-sessions` cloisonnée.
2. **`antiLeakageValidator` répond 200.** Un refus doit porter un statut d'erreur — 403
   conviendrait. Le garde-fou client compense, il ne remplace pas la correction.
3. **`mapWorkOrderStatus` écrase quatre statuts en un.** `pending`, `assigned`, `paused`
   et `on_hold` deviennent tous `in_progress` dans l'historique.
4. La capacité perdue à l'écran : `/api/history` agrégeait aussi les **sessions de
   diagnostic** et les **exécutions de plans préventifs** des 90 derniers jours. Elle
   reviendra quand une route cloisonnée les exposera.

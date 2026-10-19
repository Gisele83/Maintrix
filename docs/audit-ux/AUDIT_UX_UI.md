# Audit UX/UI et fonctionnel — Maintrix

**Date :** 19 octobre 2026
**Périmètre :** interface cliente (`client/src`), 85 pages, 42 composants, 112 routes déclarées.
**Méthode :** lecture du code, puis **mesure dans le navigateur** sur une instance réelle
(serveur de production local sur le port 5050, base PostgreSQL de test, locataire
`TENANT_ALPHA` authentifié en `admin`). Aucune anomalie listée ici n'est déduite du seul
code : chaque valeur de couleur, chaque contraste et chaque absence de navigation a été
relevé par `getComputedStyle` ou par capture d'écran.

> **Pourquoi cette précaution.** Une classe Tailwind construite par interpolation, ou une
> classe maison jamais déclarée, produit exactement le même `className` dans le code source
> qu'une classe valide. Seule la couleur **calculée** fait la différence. Plusieurs des
> anomalies les plus graves de cet audit sont de cette famille : invisibles à la relecture,
> évidentes à la mesure.

---

## 1. Synthèse

L'application a déjà reçu une passe de refonte sérieuse : une charte existe
(`paper` / `ink` / `rule` / `signal`, IBM Plex, angles vifs à 2 px, échelle typographique
`display → headline → page → title → lede → eyebrow`), les dégradés ont été retirés des
composants, les chiffres inventés ont été chassés de plusieurs écrans, et la GMAO a reçu un
en-tête, un bloc « À traiter » et des indicateurs contextualisés qui sont de bonne facture.

Le problème n'est donc pas l'absence de direction artistique — **c'est que la refonte s'est
arrêtée en cours de route**, et que le produit expose aujourd'hui deux vocabulaires visuels
superposés, parfois sur le même écran. S'y ajoutent trois familles de défauts qui coûtent
plus cher que l'esthétique :

1. **La navigation n'existe pas sur la majorité des écrans.** 27 des 33 routes mesurées
   n'affichent aucune barre de navigation. Un utilisateur qui ouvre un ordre de travail
   depuis la GMAO n'a plus aucun moyen de revenir, sinon le bouton « précédent » du
   navigateur.
2. **Des couleurs d'état ne s'affichent pas.** Le sélecteur de niveau d'urgence du
   diagnostic (Faible / Moyen / Élevé) rend les trois niveaux dans la *même* couleur,
   mesurée. Vingt pages portent des fragments de dégradé orphelins qui ont neutralisé la
   couleur de statut au lieu de la remplacer.
3. **Des contenus internes et des chiffres fabriqués subsistent**, y compris aux endroits
   les plus sensibles commercialement (modale « Analyses détaillées » de la GMAO).

Enfin, un détail visuel contredit la charte sur **tous** les écrans à la fois : la barre de
défilement de l'application est un **dégradé bleu → violet**, hérité d'une feuille de style
décorative que plus aucun composant n'utilise.

### Chiffres clés relevés

| Mesure | Valeur |
|---|---|
| Routes sans barre de navigation principale | **27 / 33 mesurées** |
| Classes `text-carbon-*` ne produisant aucune règle CSS | **159 occurrences**, 6 fichiers |
| Éléments portant une de ces classes inertes, sur `/dashboard` | **20** (mesuré en direct) |
| Fragments de dégradé orphelins (`from-X to-Y` sans `bg-gradient-to-*`) | **95**, 20 pages |
| Occurrences de variantes `dark:` encore présentes | **481**, 24 fichiers |
| Textes sous le seuil WCAG AA en thème sombre (page GMAO) | **16 / 83** testés |
| `console.log` laissés dans le code client | **51** |
| Poids du bundle client principal | **2,73 Mo** (655 Ko gzip), **un seul morceau** |
| Mots de texte explicatif sur « Maintenance Engineering Platform » | **497** |

---

## 2. Inventaire des écrans

### 2.1 Structure de navigation réelle

La barre principale (`client/src/components/modern-navigation.tsx`) propose :

- deux liens directs : **Accueil**, **Plateforme** ;
- cinq groupes déroulants : **Exploitation**, **IA & Diagnostic**, **Optimisation**,
  **Sécurité**, **Ressources**.

Ce que cette barre **ne contient pas** : la GMAO, les ordres de travail, les équipements,
le plan de maintenance préventive, les alertes, la santé des machines. C'est-à-dire la
totalité du travail quotidien d'un responsable de maintenance. Le commentaire du code
l'assume (« la GMAO reste accessible via Plateforme »), mais le résultat est qu'un
cockpit d'exploitation se trouve au deuxième niveau, derrière une page intitulée en
anglais.

Le groupe « Exploitation » contient en revanche Équipe Multi-Agent, Cycle de vie ISO 55000,
Inventaire et Historique — des outils périphériques.

### 2.2 Pages par domaine

| Domaine | Écrans | Observation principale |
|---|---|---|
| Accueil / portail | `/` (modern-home), `/welcome` (landing) | Corrects, déjà à la charte |
| Authentification | `/login`, `/forgot-password`, `/reset-password`, `/first-login-password-change`, `/change-credentials`, `/force-logout` | Corrects, bonne facture |
| Diagnostic | `/dashboard`, `/smart-diagnostic`, `/voice-diagnostic`, `/ai-assistant`, `/support-chatbot` | Coquille à la charte, **contenu interne encore à l'ancien vocabulaire** |
| GMAO | `/gmao` (+ 5 onglets + 8 sous-onglets « Plus ») | Moitié haute refondue, moitié basse à l'ancienne |
| Ingénierie | `/maintenance-platform` | Page d'architecture interne, pas un espace de travail |
| Exploitation | `/work-orders`, `/equipment-management`, `/preventive-maintenance`, `/maintenance-plan`, `/maintenance-execution`, `/inventaire`, `/historique` | Aucune navigation ; titres en casse anglaise |
| Prédictif / IA | `/predictive-engine`, `/predictive-insights`, `/machine-health`, `/digital-twin`, `/imca`, `/prospective-simulation`, `/federated-adaptation`, `/multi-agent-team`, `/knowledge-graph`, `/knowledge-hub`, `/engineering-expertise`, `/maintenance-recommendations` | Contrastes insuffisants, titres anglais |
| Conformité | `/permit-to-work`, `/calibration`, `/habilitation`, `/warranty`, `/cctp-compliance`, `/supplier-portal`, `/client-portal` | Dégradés orphelins, couleurs de statut perdues |
| Analyse | `/oee`, `/rca`, `/fmea`, `/asset-lifecycle`, `/budget`, `/advanced-reporting`, `/smm` | `/oee` : texte sombre sur fond sombre |
| Administration | `/system-health`, `/tenant-permissions`, `/tenant-management`, `/user-management`, `/access-management`, `/erp-configuration`, `/super-admin-*` | À conserver, à réorganiser |
| **Pages à retirer de l'application** | `/localhost-diagnostic`, `/enterprise-auth-test`, `/payment-test`, `/email-diagnostic` | Outils de développement exposés aux utilisateurs |

---

## 3. Matrice d'anomalies

Priorités : **P0** = bloquant pour la crédibilité ou l'usage quotidien ; **P1** = défaut
visible qui dégrade la confiance ou l'accessibilité ; **P2** = cohérence et dette.

### P0 — à corriger avant toute présentation à un industriel

| # | Anomalie | Où | Preuve |
|---|---|---|---|
| **P0-1** | **Aucune barre de navigation sur 27 des 33 routes mesurées.** La navigation n'est pas un gabarit : chaque page monte (ou non) `<ModernNavigation />` pour son compte. 60 des 85 fichiers de page ne l'importent pas. Un utilisateur arrivé sur `/work-orders` depuis « À traiter » est sans issue. | `client/src/App.tsx` (aucun gabarit), 60 fichiers de `client/src/pages/` | Mesure en direct : recherche de la barre dans le DOM, route par route |
| **P0-2** | **La couleur du niveau d'urgence ne s'affiche pas.** « Faible » (vert), « Moyen » (orange), « Élevé » (rouge) rendent tous `rgb(29, 37, 48)` — la couleur d'encre par défaut. Les classes `text-carbon-green/orange/red` n'ont **jamais** été déclarées : `index.css` définit `.carbon-green` et `.bg-carbon-green`, jamais `.text-carbon-green`. 159 occurrences, dont 20 vivantes sur `/dashboard`. | `client/src/components/diagnostic-form.tsx`, `diagnostic-results.tsx`, `repair-guidance.tsx`, `maintenance-history.tsx`, `case-reporting.tsx` | `getComputedStyle(el).color` identique pour les trois niveaux |
| **P0-3** | **Chiffres fabriqués dans la modale « Analyses détaillées » de la GMAO** : taux d'utilisation 85,2 %, taux de performance 92,1 %, coût horaire 127 €, économies 12,3 k€, ROI +24 %, « MTBF en hausse de 12 % », « réduction de 8 % des coûts », « modèles prédictifs améliorés de 15 % », trois recommandations écrites en dur, et une modale d'alertes affichant « 3 critiques, 7 importantes, 5 prédictives, 12 résolues ». Aucune de ces valeurs n'a de source. La passe de nettoyage du 11/10 a traité les cartes voisines et laissé celles-ci. | `client/src/pages/gmao-dashboard.tsx` l. 1225-1360 | Lecture directe ; aucun `useQuery` associé |
| **P0-4** | **Un onglet principal de la GMAO est un écran de développement.** L'onglet « Alertes » affiche « Gestion des alertes système en cours de développement », alors que `/smart-alerts` existe et fonctionne. | `client/src/pages/gmao-dashboard.tsx` l. 1008-1012 | Capture d'écran |
| **P0-5** | **Contenus techniques internes affichés en clair**, nommément visés par la demande : <br>• « 8 / 8 piliers ont du code réel aujourd'hui — voir `ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md` pour le détail » <br>• « Application à installer » dans la grille de modules GMAO <br>• « TechLearn non configuré (`TECHLEARN_API_URL` / `TECHLEARN_SERVICE_TOKEN` absents) » <br>• « Health Score (legacy) » comme libellé de bouton <br>• « CRUD équipements opérationnel », « Cœur historique de Maintrix », « les 5 briques (Health Score → RUL → Anomaly → Failure Prediction → OT auto) », « embeddings OpenAI », « avant l'appel à Claude » <br>• page `/localhost-diagnostic` entière, qui affiche `http://localhost:5050` | `maintenance-engineering-platform.tsx`, `gmao-dashboard.tsx:588`, `multi-agent-team.tsx:212`, `localhost-diagnostic.tsx` | Texte de page relevé dans le navigateur |
| **P0-6** | **Surcharge textuelle de « Maintenance Engineering Platform » : 497 mots, zéro donnée.** La page n'émet aucune requête. Elle explique une architecture au lieu de montrer un état. Son titre est en anglais, sa première phrase est une dénégation (« Ce n'est plus une GMAO — c'est… »). | `client/src/pages/maintenance-engineering-platform.tsx` | Texte intégral relevé |

### P1 — défauts visibles, confiance et accessibilité

| # | Anomalie | Où | Preuve |
|---|---|---|---|
| **P1-1** | **La barre de défilement de toute l'application est un dégradé bleu → violet.** Règle active mesurée : `::-webkit-scrollbar-thumb { background: linear-gradient(rgb(59,130,246), rgb(139,92,246)); border-radius: 4px }`. Visible sous les onglets de la GMAO et du tableau de bord, dans chaque modale et chaque tableau défilant. C'est la signature visuelle exacte que la charte interdit. | `client/src/index.css` l. 196-210 | Capture zoomée + inspection des règles CSS |
| **P1-2** | **~200 lignes de CSS décoratif mort** toujours livrées : `glass-morphism`, `gradient-text-animate` (dégradé bleu/violet/rose/ambre animé), `card-hover` (soulèvement de 12 px et mise à l'échelle), `btn-professional` (balayage brillant), `animate-float` (rotation flottante), `gradient-border` (dégradé animé). **Zéro composant ne les utilise.** Elles restent une invitation permanente à réintroduire ce que la charte proscrit. | `client/src/index.css` | `grep` : 0 usage pour chacune des 11 classes |
| **P1-3** | **95 fragments de dégradé orphelins sur 20 pages.** Les chaînes `from-red-500 to-rose-600` subsistent sans le `bg-gradient-to-*` qui les activerait : elles ne posent plus aucun fond. Dans `calibration.tsx`, les quatre tuiles d'état (En retard / Bientôt échus / Conformes / Hors service) reçoivent toutes `bg-paper-deep` et **plus aucune distinction de couleur**. Le retrait des dégradés a supprimé l'information d'état au lieu de la reporter sur un aplat. | `asset-lifecycle`, `budget`, `calibration`, `client-portal`, `communication-integrations`, `download-center`, `federated-adaptation`, `fmea`, `habilitation`, `machine-health`, `maintenance-plan`, `oee`, `permit-to-work`, `rca`, `sensor-hub`, `sla-management`, `smart-alerts`, `supplier-portal`, `trial-dashboard`, `warranty` | 3 à 7 éléments orphelins détectés par page dans le DOM |
| **P1-4** ✅ | *(clos le 19/10 — thème sombre retiré, voir 5.5)* **Le thème sombre était toujours proposé et il était inutilisable.** Le bouton « Passer au thème sombre » est présent dans la barre. En sombre, **16 des 83 textes** testés sur la GMAO passent sous le seuil AA, dont **les cinq entrées de la navigation principale à 2,01:1** (`rgb(58,74,96)` sur `rgb(1,21,53)`). 481 variantes `dark:` subsistent dans 24 fichiers, incohérentes depuis le passage de 56 pages au thème clair. | `modern-navigation.tsx` l. 255-260 ; 24 fichiers | Mesure de contraste sur fond composé |
| **P1-5** | **Contrastes sous le seuil AA sur fond composé.** Relevés : `/predictive-insights` « Faible » 1,62:1, « Benchmark » 1,64:1, « Valeur actuelle » 2,17:1 ; `/modules-overview` deux titres à 1,53:1 (encre sur encre) ; `/localhost-diagnostic` bouton « Relancer le Diagnostic » **1,18:1** (blanc sur blanc cassé) ; `/sensor-hub` « LoRaWAN » 1,53:1 ; `/oee` « Temps planifié (min) » 3,05:1 — **texte sombre sur fond bleu nuit**, vestige de la migration ; `/gmao` légende « Préventif » 2,28:1. | voir colonne « où » | Calcul de ratio sur la couleur **composée**, pas déclarée |
| **P1-6** | **Défaut d'accessibilité systémique sur les onglets.** Le déclencheur d'onglet inactif de la bibliothèque rend `rgb(103,113,126)` sur `rgb(240,242,244)` = **4,41:1**, juste sous les 4,5:1 requis. Un seul jeton en cause, mais il échoue sur `/smm`, `/documentation`, `/data-import-export`, `/engineering-expertise`, `/multi-agent-team`, `/preventive-maintenance`. | jeton partagé `components/ui/tabs.tsx` | Mesure répétée, même valeur |
| **P1-7** | **Focus clavier invisible sur la navigation principale.** Les cinq déclencheurs de groupe (Exploitation, IA & Diagnostic, Optimisation, Sécurité, Ressources) ne changent ni `outline` ni `box-shadow` au focus. WCAG 2.4.7. | `modern-navigation.tsx` | 5 éléments sur 40 testés |
| **P1-8** | **Sept champs du formulaire de diagnostic sans étiquette associée** (`/dashboard` et `/smart-diagnostic`). Les `<label>` existent visuellement mais ne sont liés à aucun `id`. Lecteur d'écran : champs anonymes. Également 8 champs sur `/oee`, 2 sur `/work-orders`. | `diagnostic-form.tsx`, `oee.tsx` | Comptage DOM |
| **P1-9** | **Données de démonstration affichées quand le chargement échoue.** Le camembert « Répartition par type d'équipement » retombe sur `{ Moteurs 12, Pompes 8, Compresseurs 5, Convoyeurs 6, Autres 4 }` dès que `dashboardData` est absent — c'est-à-dire **précisément en cas d'erreur d'API**, où la page affiche déjà un bandeau rouge. L'utilisateur voit un message d'erreur et 35 équipements fictifs côte à côte. | `gmao-dashboard.tsx` l. 856-864 | Branche `isError` et branche de repli identiques |
| **P1-10** | **Deux modales d'alertes pilotées par le même état, et inatteignables.** `showAlertsModal` commande deux `<Dialog>` distincts (« Toutes les Alertes » et « Centre d'Alertes Intelligent »), et n'est jamais mis à `true` : `setShowAlertsModal` n'apparaît que dans `onOpenChange`. Code mort qui s'afficherait en double s'il devenait atteignable. | `gmao-dashboard.tsx` l. 1167 et 1378 | `grep` exhaustif de l'état |
| **P1-11** | **51 `console.log` dans le code client livré**, dont 7 sur `/dashboard` qui impriment le contenu brut du formulaire de diagnostic (`"Raw form data received:"`, `JSON.stringify(data)`) et 17 dans `maintenance-reports.tsx`. | 11 fichiers | `grep` |
| **P1-12** | **Vocabulaire d'algorithme réintroduit par les notifications.** Le code a soigneusement remplacé « Mode ML Avancé / Enhanced / Ensemble » par « Standard / Avancée / Approfondie / Maximale » dans le formulaire — mais la notification de succès affiche toujours « Diagnostic terminé (Ensemble ML) », « (Enhanced ML) », « (Advanced ML) ». | `dashboard.tsx` l. 103-110 | Lecture |
| **P1-13** | **Les boutons de téléchargement PDF des rapports de maintenance renvoient 401.** Les routes `/pdf/*` sont enregistrées hors du périmètre où `req.tenantId` existe. *Connu, traité par une autre session — signalé ici pour mémoire, non corrigé dans ce chantier.* | `components/maintenance-reports.tsx` l. 237, 301 | Établi le 19/10 |

### P2 — cohérence, dette, performance

| # | Anomalie | Où |
|---|---|---|
| **P2-1** | **Deux palettes parallèles.** `--carbon-*` (bleu/vert/rouge/orange/violet/jaune, hérité) coexiste avec `paper`/`ink`/`rule`/`signal` (charte). ~250 usages de `carbon-*`, dont 159 inertes. | `index.css`, 6 composants |
| **P2-2** | **Deux vocabulaires visuels sur le même écran.** La GMAO passe, sans transition, de tuiles à filet et chiffres en romain (haut) à des boîtes teintées `rounded-lg` avec pastilles rondes colorées et `shadow-md` (bas). Trois cartes d'indicateurs voisines : deux en `shadow-md`, une en `shadow-none`. | `gmao-dashboard.tsx` |
| **P2-3** | **Casse de titre anglaise sur l'ensemble du produit.** « Ordres de Travail », « Répartition par Type d'Équipement », « Statistiques Mensuelles des Interventions », « Gestion des Calibrations », « Habilitations Techniciens », « Analyse des Causes Racines », « Scoring Santé Machines », « Hub Capteurs IoT ». La typographie française met la capitale au premier mot seulement. | ~40 pages |
| **P2-4** | **Titres de page en anglais** : « Maintenance Engineering Platform », « Predictive Maintenance Engine », « Digital Twin », « AI Assistant », « Engineering Knowledge Hub », « Engineering Expertise », « Knowledge Graph métier », « FMEA / AMDEC », « Smart Diagnostic IA ». | 9 pages |
| **P2-5** | **Pages sans `<h1>`** : `/equipment-management`, `/preventive-maintenance` (dont le premier titre est une valeur de donnée : « Graissage Moteur Principal »). | 2 pages |
| **P2-6** | **Un seul morceau de 2,73 Mo** (655 Ko gzip). `App.tsx` importe 82 pages en statique ; seules 3 utilisent `lazy()`. Première ouverture pénalisée pour tout le monde. | `App.tsx`, sortie de `vite build` |
| **P2-7** | **Redondance d'information sur la GMAO.** « Évolution des OT (6 derniers mois) » et « Statistiques mensuelles des interventions » tracent la même série. « Accès rapide » (Équipements / Préventif / Inventaire / Santé) duplique les onglets et la grille de modules situés au-dessus. | `gmao-dashboard.tsx` |
| **P2-8** | **Cellules vides dans la grille de modules.** Le groupe « Données et échanges » n'a que 3 entrées dans une grille à 6 colonnes : trois cases grises apparaissent comme un bloc inexpliqué. | `gmao-dashboard.tsx` |
| **P2-9** | **Import mort** : `FeatureCards` est importé par `dashboard.tsx` sans être rendu. *(Le composant `QuickStats` aux chiffres fictifs n'est donc plus affiché sur cette page — point de vigilance de la mémoire projet levé.)* | `dashboard.tsx:14` |
| **P2-10** | **Composant mort** : `components/header.tsx` n'est monté nulle part, et son état actif/inactif serait de toute façon invisible (`bg-carbon-blue/20` ne produit aucune règle). | `components/header.tsx` |
| **P2-11** | **Ordres de travail présentés en cartes**, pas en tableau. Une carte affiche « N/A », « Non spécifié », « Non assigné », « Non programmé » — quatre marqueurs de vide occupant autant de place que la donnée réelle. Le cahier des charges demande des tableaux triables et filtrables. | `work-orders.tsx` |
| **P2-12** | **Barre d'onglets secondaire surchargée** sur `/dashboard` : 11 entrées sur une ligne, « Import / Export » se brise en deux lignes, le reste part en défilement horizontal (d'où le dégradé de P1-1, bien visible). | `dashboard.tsx` |
| **P2-13** | **Faute d'orthographe dans un titre d'écran** : « Supervision & Controle Adaptatif » (accent circonflexe manquant). | `cognitive-infrastructure.tsx` |
| **P2-14** | **Accroche commerciale dans le pied de page de l'outil** : « Plateforme de maintenance industrielle assistée par IA ». La charte réserve l'argument IA aux pages publiques. | `lib/i18n.ts` (`appSubtitle`) |
| **P2-15** | **Icônes non discriminantes.** Le groupe « IA & Diagnostic » compte 8 entrées dont 4 partagent l'icône `Brain` et 2 l'icône `Database`. | `modern-navigation.tsx` |

---

## 4. Proposition de design system

La charte existante est bonne et **n'est pas remise en cause** : on la complète, on
supprime ce qui la contredit, et on la rend applicable sans effort par page.

### 4.1 Couleurs — ce qui change

| Rôle | Jeton | Valeur | Statut |
|---|---|---|---|
| Fond d'application | `paper` | `#F4F7FA` | conservé |
| Fond secondaire | `paper-deep` | `#E6EDF3` | conservé |
| Encre | `ink` | `#011535` | conservé |
| Encre secondaire | `ink-soft` / `ink-mute` | `#3A4A60` / `#56657A` | conservé |
| Filet | `rule` | `#D3DCE5` | conservé |
| Accent | `signal` | `#006B97` | conservé |
| **État — critique** | `etat-critique` | à introduire | **nouveau** |
| **État — alerte** | `etat-alerte` | à introduire | **nouveau** |
| **État — nominal** | `etat-nominal` | à introduire | **nouveau** |
| **État — neutre / inactif** | `etat-neutre` | à introduire | **nouveau** |
| `--carbon-*` | — | — | **à supprimer** |

Les quatre jetons d'état remplacent à la fois les `bg-red-100 text-red-800` dispersés et les
fragments `from-X to-Y` orphelins. Chacun fournit un couple fond + texte **validé AA sur sa
propre composition**, pas sur une couleur déclarée.

Règle non négociable, héritée des incidents précédents : **aucune classe Tailwind ne doit
être assemblée par interpolation.** Les jetons d'état sont des chaînes littérales complètes
dans un module partagé, comme `lib/accent-colors.ts`.

### 4.2 À supprimer de `index.css`

- la barre de défilement en dégradé → filet discret, rayon 0 ;
- `glass-morphism`, `glass-morphism-dark`, `glass-effect`, `gradient-text-animate`,
  `gradient-border`, `card-hover`, `btn-professional`, `interactive-element`,
  `animate-float`, `animate-slide-up`, `animate-fade-in-scale`, `shadow-3xl` ;
- le bloc `--carbon-*` et ses 23 utilitaires.

### 4.3 Typographie

Échelle déjà en place, à appliquer uniformément :

| Usage | Jeton |
|---|---|
| Accueil public uniquement | `text-display`, `text-headline` |
| **Titre d'écran applicatif** | `text-page`, `font-serif`, `font-medium` |
| Titre de bloc | `text-title`, `font-serif` |
| Sur-titre de section | `text-eyebrow`, `font-mono`, `uppercase`, `text-ink-mute` |
| Chiffre d'indicateur | `font-serif`, `text-4xl`, `text-ink` |
| Repère technique (code OT, référence) | `font-mono` |

**Casse française partout** : capitale au premier mot seulement.

### 4.4 Composants partagés à introduire

| Composant | Rôle | Remplace |
|---|---|---|
| `AppShell` | Gabarit unique : barre de navigation + fil d'Ariane + zone de titre + contenu | 25 montages manuels de `<ModernNavigation />`, 60 pages sans navigation |
| `EnTetePage` | Sur-titre, titre, phrase unique, action principale à droite | 85 en-têtes différents |
| `Indicateur` | Libellé, valeur, précision contextuelle, liseré d'alerte | les 6 styles de cartes de KPI recensés |
| `PuceEtat` | Pastille d'état à partir des 4 jetons | `bg-red-100 text-red-800…` et les fragments orphelins |
| `TableauDonnees` | Tableau dense avec recherche, tri, filtres, état vide explicite | listes en cartes |
| `EtatVide` | Titre, phrase, action — jamais un écran blanc | 12 variantes recensées |

### 4.5 Règles d'écriture de l'interface

1. Un objectif principal par écran, une seule action en bouton plein.
2. Pas de paragraphe explicatif dans une vue opérationnelle : l'explication va en infobulle
   ou en panneau d'aide repliable.
3. Aucun indicateur affiché par défaut s'il ne sert pas une décision du jour.
4. Un chiffre non mesuré s'écrit « — », jamais une valeur plausible. Toute valeur affichée
   doit dériver d'un `useQuery`.
5. Aucun nom de fichier, de variable d'environnement, de bibliothèque, d'éditeur de modèle
   ni d'état d'avancement interne dans l'interface.
6. Un état vide dit quoi faire ; il ne se remplit pas pour paraître occupé.

---

## 5. Plan de refonte progressive

| Étape | Contenu | État |
|---|---|---|
| **A — Diagnostic** | Le présent document | **livré** |
| **B — Prototype** | Socle de design system (`AppShell`, jetons d'état, nettoyage CSS) + refonte du tableau de bord, de l'Ingénierie de maintenance et de la GMAO + captures avant/après | **livré** |
| **C — Validation** | « Design validé avec des couleurs de fonds de l'ingénierie » — le traitement des fonds de l'écran d'ingénierie devient la référence | **validé le 19/10/2026** |
| **D — Déploiement** | Socle appliqué aux 45 écrans restants ; couleurs d'état, dégradés orphelins et contrastes traités sur l'ensemble du produit | **livré** |
| **E — Recette** | Tests unitaires, d'intégration, accessibilité, non-régression ; E2E Playwright restant | **partielle — voir 5.5** |

Le découpage en lots est délibéré : chaque lot est un commit isolé, vérifiable à l'écran et
réversible seul.

### 5.1 Ce que l'étape B a livré

**Socle de design system** — trois fichiers nouveaux, additifs, qu'aucune page existante
n'est obligée d'utiliser :

| Fichier | Contenu |
|---|---|
| `client/src/lib/etats.ts` | Cinq registres d'état (critique, alerte, nominal, en cours, neutre) en chaînes littérales, plus la traduction des statuts et priorités renvoyés par le serveur |
| `client/src/components/app-shell.tsx` | `AppShell` (navigation + fil d'Ariane + contenu), `EnTetePage`, `ActionPrincipale`, `ActionSecondaire`, `EtatVide` |
| `client/src/components/indicateurs.tsx` | `Indicateur`, `RangeeIndicateurs`, `IndicateurCalcule`, `PuceEtat`, `PointEtat` |

Les couleurs d'état sont déclarées dans `tailwind.config.ts` sous `etat` ; `index.css` passe
de 399 à 131 lignes.

**Écrans refondus** — mesures prises dans le navigateur, avant puis après :

| Mesure | Avant | Après |
|---|---|---|
| `/maintenance-platform` — mots de texte | 497 | **207** |
| `/maintenance-platform` — barre de navigation | absente | **présente** |
| `/maintenance-platform` — requêtes de données | 0 | **2** (parc + méthodes d'ingénierie) |
| `/gmao` — textes sous le seuil AA | 6 | **0** |
| `/dashboard` — classes de couleur inertes rendues | 20 | **0** |
| `/dashboard` — champs sans étiquette associée | 7 | **0** |
| Niveau d'urgence « Faible / Moyen / Élevé » | `rgb(29,37,48)` ×3 | **`rgb(27,94,52)` / `rgb(121,80,10)` / `rgb(143,32,18)`** |
| Barre de défilement | `linear-gradient(#3b82f6, #8b5cf6)` | **`rgb(182,195,208)`, rayon 0** |
| Débordement horizontal à 375 px | 97 px | **0** |
| Classes `carbon-*` inertes dans tout le produit | 159 | **0** |

**Anomalies closes** : P0-1 (sur les 3 écrans), P0-2, P0-3, P0-4, P0-5, P0-6, P1-1, P1-2,
P1-6, P1-7, P1-8 (diagnostic), P1-9, P1-10, P1-11 (diagnostic), P1-12, P2-1, P2-2 (GMAO),
P2-8, P2-9, P2-10, P2-12.

**Restent ouvertes, pour l'étape D** : P0-1 sur les 24 autres écrans sans navigation, P1-3
(95 fragments de dégradé orphelins sur 20 pages), P1-4 (thème sombre), P1-5 (contrastes
résiduels sur `/predictive-insights`, `/modules-overview`, `/oee`, `/localhost-diagnostic`,
`/sensor-hub`), P1-13 (PDF, traité ailleurs), P2-3 à P2-7, P2-11, P2-13 à P2-15.

### 5.2 Résultats des tests

Exécutés le 19 octobre 2026 sur une grappe PostgreSQL 17 jetable (port 55433, base
`maintrix_test`), serveur lancé depuis le bundle (`node dist/index.js`, `NODE_ENV=test`).

| Barrière | Commande | Résultat |
|---|---|---|
| Typage application | `npm run check` | **vert** |
| Typage des tests | `npm run check:tests` | **vert** |
| Tests unitaires | `jest --selectProjects unit` | **24 suites, 175 tests, tous verts** |
| Tests d'intégration | `jest --selectProjects integration` | **10 suites, 96 tests verts**, 4 ignorés, 7 à écrire |
| Tests E2E | `npx playwright test` | **non exécuté** — la suite exige un fichier `.env.test-cloud` décrivant un environnement de test infonuagique, qui n'existe pas sur ce poste. À reprendre en étape E. |
| Rendu de toutes les pages | relevé dans le navigateur, 40 routes | **40/40 rendues**, aucune classe inerte, aucune page blanche |

Un fichier de tests est ajouté : `tests/unit/refonte-ui.test.ts`, **20 vérifications** qui
gardent les corrections contre une régression — absence de classes `text-carbon-*`, absence
de fragments de dégradé orphelins, absence de dégradé dans la barre de défilement, absence
de nom de fichier Markdown ou de variable d'environnement dans l'interface, absence des
chiffres fabriqués de la GMAO, liaison des étiquettes du formulaire de diagnostic, présence
du focus clavier sur la navigation.

> **Note de méthode.** Au premier lancement, la voie d'intégration rapportait 59 échecs.
> Vérification faite, ils venaient du harnais et non du code : le serveur avait été démarré
> sans `SUPER_ADMIN_PASSWORD_HASH`, et toutes les suites qui passent par une connexion
> super-administrateur tombaient. Le hachage posé, les 10 suites passent. Le présent chantier
> ne touche **aucun fichier de `server/`, `shared/` ou `migrations/`** — vérifiable par
> `git status`.

### 5.3 Non-régression fonctionnelle

Aucune fonctionnalité n'a été retirée. Ce qui a été déplacé ou supprimé, et où cela se
trouve désormais :

| Retiré | Pourquoi | Où est-ce maintenant |
|---|---|---|
| Onglet GMAO « Alertes » (écran de chantier) | Annonçait un développement en cours | Le même onglet liste les alertes réelles et mène à `/smart-alerts` |
| Bande « Accès rapide » de la GMAO (4 cartes) | Troisième chemin vers des écrans déjà présents dans les onglets ET la grille de modules | Onglets « Équipements » / « Inventaire », grille de modules, menu « Plus » |
| Graphique « Évolution des OT (6 mois) » | Traçait la même série que « Statistiques mensuelles » | « Activité sur douze mois », qui porte la saisonnalité |
| Camembert « Répartition par type » | Retombait sur 35 équipements fictifs en cas d'échec de l'API | Liste à barres, affichée seulement si le serveur renvoie des données |
| Deux modales d'alertes de la GMAO | Inatteignables (`setShowAlertsModal(true)` n'existait nulle part) et doublons l'une de l'autre | Onglet « Alertes » |
| Cartes « Tendances » et « Recommandations prioritaires » | Six constantes présentées comme des mesures du parc du client | Renvoi vers `/maintenance-recommendations`, qui calcule à partir des données du locataire |
| Seconde barre de raccourcis du tableau de bord (6 entrées) | Doublait la navigation principale, débordait sur deux lignes | Barre de navigation principale, en haut |
| « Application à installer » | Formulation de notice d'installation | Même tuile, renommée « Application mobile » ; également dans « Ressources → Télécharger » |
| `components/header.tsx` | Monté nulle part ; son état actif/inactif était de toute façon invisible | — |
| `pillar-collaboration-map.tsx`, `platform-edition-badge.tsx` | Devenus orphelins ; leur contenu est repris dans la page refondue | Dépliant « Comment ces domaines s'enchaînent », mention de licence sur les domaines non inclus |

Les parcours métier ont été exercés dans le navigateur après refonte : consultation du parc,
lecture de la liste « À traiter », ouverture d'un ordre de travail, bascule entre les cinq
onglets de la GMAO et les huit sous-onglets « Plus », soumission du formulaire de diagnostic.
Les tests d'intégration couvrent les mêmes workflows côté API (GMAO, diagnostic, multi-locataire,
intégrité transactionnelle, concurrence, CSRF, RBAC, contrat d'API).

---

### 5.4 Ce que l'étape D a livré

**Consigne de validation appliquée :** « Design validé avec des couleurs de fonds de
l'ingénierie ». Le traitement des fonds de l'écran d'ingénierie — `paper` pour
l'application, `paper-deep` pour les tuiles et zones encastrées, aucune teinte brute de
Tailwind, les états passant par les jetons dont le contraste est mesuré — devient la
référence des 45 écrans repris.

#### Résultats mesurés, avant et après l'ensemble du chantier

| Mesure | Avant | Après |
|---|---|---|
| Écrans applicatifs sans barre de navigation | **45** | **0** |
| Couleurs brutes de Tailwind (hors `dark:`) | 4 067 | **141** |
| Fragments de dégradé orphelins | 97 | **2** |
| `rounded-xl` / `2xl` / `3xl` | 269 | **4** |
| `shadow-md` / `lg` / `xl` | 62 | **16** |
| Textes sous le seuil WCAG AA, sur 68 routes mesurées | — | **0** |
| Débordement horizontal à 1440 px, sur 68 routes | — | **0** |
| Écrans ne rendant rien (page blanche) | 1 | **0** |

Les 141 couleurs brutes restantes et les 2 fragments de dégradé subsistent dans des
primitives de la bibliothèque (`components/ui/`) et dans des éléments graphiques non
textuels ; aucune ne produit de texte sous le seuil AA, ce qui a été vérifié route par route.

#### Les cinq lots

| Lot | Écrans |
|---|---|
| 1 — Exploitation | ordres de travail, plan de maintenance, maintenance préventive, inventaire, historique, cycle de vie des actifs, exécution |
| 2 — Conformité et partenaires | permis de travail, étalonnages, habilitations, garanties, fournisseurs, CCTP |
| 3 — Prédictif et IA | maintenance prédictive, jumeau numérique, documentation technique, graphe de causalité, équipe multi-agent, expertise d'ingénierie, supervision adaptative, adaptation fédérée, diagnostic assisté, diagnostic vocal, santé des machines, alertes, capteurs, analyse prédictive, engagements de service |
| 4 — Analyse | OEE, causes racines, AMDEC, cycle de vie, budget, management de la maintenance, rapports, modules |
| 5 — Administration et ressources | santé du système, organisations, utilisateurs, profils, permissions, import/export, importation, intégrations, communications, apprentissage, perception IoT, codes QR, validation, configuration ERP, accès, notifications, recommandations, indice cognitif, simulation prospective, optimiseur multi-actifs, journal cryptographique |

#### Trois défauts fonctionnels trouvés pendant l'harmonisation

Ils ne relèvent pas de l'apparence, mais ils ont été découverts en ouvrant chaque écran —
ce qu'un audit purement visuel n'aurait pas fait.

1. **L'écran de conformité CCTP était entièrement blanc, et depuis longtemps.**
   L'identifiant d'organisation valait la chaîne littérale `"default-tenant"`, laissée avec
   son commentaire « à adapter selon votre système d'auth ». Mesuré :
   `/api/cctp/tenant/default-tenant/purchase-order-config` répond **200 avec `{}`** — pas
   une erreur, un objet vide. Le composant lisait `poConfig.companyHeader.name` sur un
   `companyHeader` absent, levait une exception, et l'arbre React entier disparaissait.
   Conséquence plus grave que l'affichage : l'écran **écrivait** aussi sa configuration sous
   cet identifiant fictif — les seuils de bon de commande et l'entête d'entreprise d'un
   client n'arrivaient jamais chez lui. Corrigé : l'organisation authentifiée est utilisée,
   les requêtes attendent qu'elle soit connue, et les accès imbriqués sont gardés pour qu'un
   champ absent ne puisse plus blanchir l'écran.
2. **Le même écran affichait « 8/9 exigences conformes » et « 1 configuration requise »
   écrits en dur**, à côté d'un score global, lui, bien calculé. L'API en renvoie **cinq**,
   dont trois conformes et deux partielles. Sur un écran de conformité réglementaire —
   exactement là où un industriel vérifie ce qu'il peut opposer à un donneur d'ordre. Les
   trois tuiles comptent désormais ce que le serveur rapporte.
3. **Le calculateur OEE était illisible.** Sa carte était restée en fond bleu nuit après le
   passage au thème clair, mais ses textes avaient suivi : titre en encre sur encre, et six
   étiquettes de champ mesurées à 3,05:1. C'est l'outil même de cet écran — on ne lisait
   plus ce qu'on saisissait.

#### Défauts de contraste systémiques corrigés

- **`--destructive` échouait de peu, partout.** `hsl(4, 79%, 55%)` = rgb(231, 62, 50) ; le
  texte blanc que la bibliothèque pose dessus n'atteignait que 4,09:1. Assombri à 48 % :
  4,87:1. Un seul jeton, mais il sert à chaque badge et bouton d'action destructive.
- **Des jetons d'état posés en fond translucide.** `bg-etat-nominal-vif/20` se compose sur
  son parent avant tout calcul : le texte tombait à 4,27:1. Sur l'écran IMCA, qui affiche
  une pastille par équipement, le même défaut se répétait **250 fois**. 18 fichiers
  corrigés — les jetons `fond` sont opaques et mesurés.
- **Le cyan du logo portait du texte sur fond clair.** `signal-light` (#00B9F2) plafonne à
  2,3:1 — sous le seuil AA pour du texte comme pour un élément graphique porteur de sens.
  16 fichiers ramenés sur `signal`.
- **Deux cartes à fond encre dont le texte était aussi passé à l'encre** : ratio 1:1,
  invisible (recommandations de maintenance, tableau de bord d'essai).

#### Couleur d'état restaurée sur les tuiles de statistiques

Dix écrans affichaient la même rangée — « En retard », « Expirent ≤ 30j », « Conformes »,
« Hors service » — dont les teintes avaient disparu avec les dégradés, laissant quatre
tuiles identiques. `registreDepuisLibelle` déduit le registre du libellé et chaque tuile
retrouve sa couleur ; un libellé qu'aucune règle ne reconnaît reste neutre, car mieux vaut
une tuile muette qu'une tuile qui affirme la mauvaise chose.

### 5.5 Le thème sombre — retiré, et pourquoi

**Décision prise le 19 octobre 2026, sur demande d'arbitrage de l'utilisateur
(« répare-le ou retire le bouton »). Le thème sombre est retiré.**

#### Il ne pouvait pas fonctionner

Le bloc `.dark` de `index.css` redéfinissait vingt variables de la bibliothèque
(`--background`, `--foreground`, `--card`, `--border`…). Mais les jetons de la **charte**
— `paper`, `ink`, `rule`, `signal`, `etat` — sont déclarés dans `tailwind.config.ts`
comme des **valeurs hexadécimales littérales**, pas comme des variables CSS. Ils ne
peuvent donc pas changer avec le thème. Vérifié à la sonde dans le navigateur :

| Classe | En thème clair | En thème sombre |
|---|---|---|
| `bg-paper` | `rgb(244, 247, 250)` | `rgb(244, 247, 250)` |
| `text-ink` | `rgb(1, 21, 53)` | `rgb(1, 21, 53)` |
| `border-rule` | `rgb(211, 220, 229)` | `rgb(211, 220, 229)` |

Or **toute la refonte repose sur ces jetons**. En sombre, le fond de page et la barre de
navigation passaient au bleu nuit pendant que chaque carte restait blanche et chaque
texte restait encre.

#### L'étendue des dégâts, mesurée

Sur douze écrans, **241 textes sur 800 sous le seuil WCAG AA** — 30 %, avec des rapports
descendant à **1,04:1**, c'est-à-dire invisibles.

| Écran | Textes sous le seuil |
|---|---|
| `/budget` | **63 %** |
| `/work-orders` | **44 %** |
| `/smart-diagnostic` | **40 %** |
| `/dashboard` | 26 % |
| `/oee` | 24 % |

#### Ce n'était pas réservé à qui cliquait le bouton

`getInitialTheme()` retombait sur `prefers-color-scheme: dark`. **Un visiteur dont le
système est en thème sombre — cas très courant — arrivait dans cet état dès sa première
visite, sans avoir rien demandé et sans savoir comment en sortir.** C'est ce point qui
fait basculer la décision : il ne s'agissait pas d'une option dégradée que l'on choisit,
mais de l'expérience par défaut d'une partie des utilisateurs.

#### Ce qu'une vraie réparation aurait coûté

| À faire | Volume |
|---|---|
| Jetons de charte à convertir en variables CSS, avec une valeur sombre dont le contraste soit validé pour chacun | **26** |
| Occurrences de `bg-white` à tokeniser (une carte blanche reste blanche en sombre) | **467** |
| Couleurs littérales passées aux graphiques, que Recharts n'accepte pas autrement | **110** |
| Variantes `dark:` à réauditer une par une | **454** |
| Écrans à revérifier en sombre | **86** |

Soit un chantier de la taille de l'harmonisation complète — pour une fonction que la
charte validée ne demande pas (elle dit « bleu marine, fond gris très clair ») et dont une
campagne précédente avait déjà éloigné 56 pages.

#### Ce qui a été retiré

La bascule des deux barres (bureau et mobile), le crochet `hooks/use-theme.ts`, le bloc
`.dark` de la feuille de style, et **441 variantes `dark:`** devenues inapplicables dans
le code applicatif. Les deux variantes de `components/ui/` sont conservées : c'est la
bibliothèque, elle resservira le jour où un vrai thème sombre sera construit — sur des
jetons variabilisés, délibérément.

Vérifié dans le pire cas : système en thème sombre **et** `maintrix-theme: dark` encore
mémorisé d'une visite précédente. La classe `.dark` n'est plus jamais posée, le fond
reste `rgb(249, 250, 251)`, et aucune bascule n'apparaît dans la barre.

#### Quatre défauts trouvés en retirant les `dark:`

Le nettoyage a mis au jour des chaînes de classes dégénérées, qu'aucune erreur ne
signale — une classe absente laisse simplement hériter du parent :

1. **`trial-dashboard.tsx`** — `statusBg` valait littéralement `" dark: dark:"`. À
   l'origine des fragments de dégradé orphelins ; **la passe d'harmonisation les a
   retirés sans rien mettre à la place, et a laissé les préfixes.** Deux défauts
   successifs au même endroit, dont le second est de mon fait.
2. **`oee.tsx`** — `oeeBg` renvoyait `""` dans ses trois branches. Même cause : le badge
   de qualité OEE s'affichait **toujours de la même couleur**, quel que soit le niveau.
   Également introduit par la passe d'harmonisation.
3. **`calibration.tsx`** — la pastille de conformité d'un point de mesure affichait une
   couleur et **aucun texte**, quelle que soit la conformité. Illisible pour qui ne
   distingue pas le vert du rouge, muette pour un lecteur d'écran. *Antérieur à la
   refonte.*
4. **`validation-dashboard-simple.tsx`** — le repère de type de document renvoyait la
   chaîne vide dans ses deux branches : le numéro de commande s'affichait précédé d'un
   espace. *Antérieur à la refonte.*

Cinq nouveaux garde-fous couvrent ces familles, dont deux qui auraient attrapé mes
propres erreurs.

### 5.6 Recette — ce qui est vérifié et ce qui ne l'est pas

| Barrière | Résultat |
|---|---|
| `npm run check` | **vert** |
| `npm run check:tests` | **vert** |
| Tests unitaires | **24 suites, 184 tests verts**, dont 29 garde-fous de refonte |
| Tests d'intégration | **10 suites, 96 tests verts**, 4 ignorés, 7 à écrire |
| Rendu, navigation, débordement | **68 routes mesurées au navigateur : 0 anomalie** |
| Contraste WCAG AA sur fond composé | **68 routes : 0 texte sous le seuil** |
| **Tests end-to-end (Playwright)** | **NON EXÉCUTÉS** |

> **La voie end-to-end n'a pas pu être lancée, et ce n'est pas un détail.** `npx playwright
> test` s'arrête sur `ENOENT: .env.test-cloud` : la suite `tests/e2e/tester-journey.spec.ts`
> lit ce fichier pour se connecter à un environnement de test infonuagique qui n'existe pas
> sur ce poste. Les parcours critiques sont donc couverts par les tests d'intégration
> (API) et par la vérification manuelle au navigateur, **mais aucun parcours utilisateur
> complet n'a été rejoué automatiquement**. C'est le seul livrable de la phase 7 qui reste
> ouvert ; il demande soit le fichier d'environnement, soit une variante locale de la suite.

---

## 6. Améliorations supplémentaires recommandées

Hors périmètre de ce chantier, à arbitrer séparément :

1. **Découper le bundle** par `lazy()` sur les 82 pages importées en statique.
2. ~~**Trancher sur le thème sombre**~~ — **fait le 19/10/2026 : retiré.** Voir 5.5.
3. **Retirer les pages de développement** de la table de routage (`/localhost-diagnostic`,
   `/enterprise-auth-test`, `/payment-test`, `/email-diagnostic`).
4. **Remonter la GMAO dans la navigation principale** avec ses sous-entrées (ordres de
   travail, équipements, préventif) — décision de navigation, à valider en étape C.
5. **Renommer les écrans de recherche** (IMCA, Adaptation fédérée, Simulation prospective)
   en vocabulaire de maintenance, ou les regrouper sous un espace « Travaux avancés ».
6. **Remplacer les listes en cartes par des tableaux** sur les ordres de travail et les
   équipements.
7. **Nettoyer les 481 variantes `dark:`** une fois la décision 2 prise.

---

## 7. Déploiement et retour arrière

### Déploiement

Le chantier est exclusivement frontend. Aucune route, aucun contrat d'API, aucun algorithme
industriel n'est modifié. La procédure reste celle du dépôt :

```
npm run check && npm run check:tests
npm run build
```

puis déploiement du dossier `dist/` selon `docs/DEPLOY_OVH.md`.

**Aucune migration de base de données n'est nécessaire.**

### Retour arrière

Chaque étape du plan est un commit distinct sur la branche `claude/frosty-hodgkin-56e834`.
Trois niveaux de retour :

1. **Par écran** — `git revert` du commit de l'écran concerné. Les pages refondues
   n'introduisent aucune dépendance croisée : annuler la refonte de la GMAO n'affecte pas
   le tableau de bord.
2. **Par socle** — le gabarit `AppShell` est additif. Les pages non migrées continuent de
   monter leur navigation comme avant ; revenir en arrière sur le socle ne casse aucune page
   déjà en production.
3. **Complet** — `git revert` de la plage de commits, puis `npm run build`. L'état
   d'origine est le commit `3dcc080`.

**Rien n'est poussé sur `main` et rien n'est fusionné** : ces décisions appartiennent à
l'utilisateur.

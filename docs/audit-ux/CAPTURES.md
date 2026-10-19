# Captures avant / après — étape B

Prises sur une instance réelle (serveur lancé depuis le bundle, base PostgreSQL de test,
locataire `TENANT_ALPHA` authentifié en `admin`), à 1440 px de large, page entière.

---

## 1. Ingénierie de maintenance — `/maintenance-platform`

| | |
|---|---|
| **Avant** | [`captures/avant-ingenierie-maintenance.jpg`](captures/avant-ingenierie-maintenance.jpg) |
| **Après** | [`captures/apres-ingenierie-maintenance.jpg`](captures/apres-ingenierie-maintenance.jpg) |

**Ce qui change, et pourquoi**

- **La page n'avait aucune navigation.** On y arrivait depuis la barre principale, et on ne
  pouvait plus en repartir autrement qu'avec le bouton « précédent ». Elle passe sous le
  gabarit `AppShell` : barre de navigation, fil d'Ariane, zone de titre.
- **497 mots d'explication, zéro donnée → 207 mots et deux séries de chiffres mesurés.**
  L'écran s'ouvrait sur une dénégation (« Ce n'est plus une GMAO — c'est une plateforme
  d'ingénierie de maintenance à 8 piliers ») suivie d'un état d'avancement du développement
  (« 8 / 8 piliers ont du code réel aujourd'hui — voir
  `ARCHITECTURE_CIBLE_INGENIEUR_MAINTENANCE.md` pour le détail »). Il commence maintenant
  par l'état du parc : équipements, ordres de travail, alertes critiques, préventif sous
  sept jours. Puis par ce que l'ingénieur a réellement produit : analyses de causes racines,
  AMDEC, maintenance basée fiabilité, règles de diagnostic — comptées en base.
- **Les journaux de chantier disparaissent des cartes.** « CRUD équipements opérationnel —
  cycle de vie ISO 55000 complet non encore construit », « Cœur historique de Maintrix,
  désormais un pilier parmi d'autres », « les 5 briques (Health Score → RUL → Anomaly →
  Failure Prediction → OT auto) tournent maintenant ensemble », « recherche sémantique
  (embeddings OpenAI) […] consulté par le pipeline diagnostic avant l'appel à Claude ».
  Chaque domaine reçoit **une** phrase disant ce qu'on vient y faire.
- **Le badge de licence ne s'affiche plus que lorsqu'il contraint.** « Inclus — Starter »
  répété sur sept cartes sur huit n'apprenait rien et occupait un tiers de chaque carte.
  Seul « Nécessite l'édition X » subsiste, là où le domaine n'est pas compris dans
  l'abonnement.
- **Les douze pastilles « Connecté avec » et le ruban de flux** passent dans un dépliant
  « Comment ces domaines s'enchaînent », replié par défaut. L'information est utile à qui
  prend ses marques, inutile tous les autres jours.
- **Arbitrage assumé :** on aurait pu supprimer la carte d'enchaînement. Elle a été
  conservée parce qu'elle répond à une vraie question d'ingénieur — « qu'est-ce qui
  déclenche quoi ? » — mais elle ne mérite pas d'ouvrir l'écran.

---

## 2. GMAO — `/gmao`

| | |
|---|---|
| **Avant** | [`captures/avant-gmao.jpg`](captures/avant-gmao.jpg) |
| **Après** | [`captures/apres-gmao.jpg`](captures/apres-gmao.jpg) |

**Ce qui change, et pourquoi**

- **La page parlait deux langues.** Sa moitié haute — en-tête, indicateurs à filet, « À
  traiter », grille de modules — était déjà à la charte. Sa moitié basse était restée au
  vocabulaire précédent : boîtes teintées à coins arrondis, pastilles rondes de couleur,
  disques d'icônes bleu, vert et turquoise, et trois cartes d'indicateurs voisines dont
  deux portaient une ombre et la troisième non. Tout passe au filet, au chiffre en romain
  et aux jetons d'état partagés.
- **Un onglet principal sur cinq était un écran de chantier.** « Alertes » affichait
  « Gestion des alertes système en cours de développement » alors que `/smart-alerts`
  existe et fonctionne. Il liste désormais les alertes réelles, avec leur gravité, et mène
  au centre d'alertes.
- **Les chiffres fabriqués de la modale « Analyses détaillées » sont retirés** : taux
  d'utilisation 85,2 %, taux de performance 92,1 %, coût horaire 127 €, économies 12,3 k€,
  ROI +24 %, « MTBF en hausse de 12 % sur 3 mois », « réduction de 8 % des coûts »,
  « modèles prédictifs améliorés de 15 % », trois recommandations numérotées identiques
  pour tous les locataires, et quatre compteurs d'alertes (3, 7, 5, 12). Aucune de ces
  valeurs n'avait de source en base. À la place : ce qui serait nécessaire pour les
  calculer, et le lien vers l'écran qui les calculera.
- **Le camembert « Répartition par type » retombait sur 35 équipements fictifs** — Moteurs
  12, Pompes 8, Compresseurs 5, Convoyeurs 6, Autres 4 — dès que les données étaient
  absentes, c'est-à-dire **précisément en cas d'échec de l'API**, où la page affiche déjà
  son bandeau d'erreur. Il devient une liste à barres, qui ne s'affiche que si le serveur
  a renvoyé des données.
- **Deux graphiques traçaient la même série** (une aire sur six mois, des barres sur douze).
  Un seul reste : douze mois, qui portent la saisonnalité. Les aplats en dégradé des aires
  partent avec le premier.
- **La bande « Accès rapide »** (Équipements, Préventif, Inventaire, Santé) était un
  troisième chemin vers des écrans déjà présents dans les onglets **et** dans la grille de
  modules. Retirée.
- **« Application à installer »** devient « Application mobile ». La formulation d'origine
  était une consigne d'installation, pas un module de maintenance.
- **Trois cases grises vides** apparaissaient sous « Données et échanges » : trois entrées
  dans une grille figée à six colonnes. Le nombre de colonnes suit désormais le nombre
  d'entrées.
- **Deux modales d'alertes, pilotées par le même état, et inatteignables** (rien n'appelait
  `setShowAlertsModal(true)`) : elles se seraient affichées l'une sur l'autre. Retirées.
- **Arbitrage assumé :** les huit sous-onglets du menu « Plus » — maintenance préventive,
  historique, achats, rapports, indicateurs, santé des équipements, validation
  multi-niveaux, configuration de l'entreprise — sont **conservés tels quels**. Ils sont
  peu visibles, mais chacun porte un vrai métier. Les ranger est un sujet de navigation,
  à arbitrer en étape C, pas une suppression à décider seul.

---

## 3. Tableau de bord — `/dashboard`

| | |
|---|---|
| **Avant** | [`captures/avant-tableau-de-bord.jpg`](captures/avant-tableau-de-bord.jpg) |
| **Après** | [`captures/apres-tableau-de-bord.jpg`](captures/apres-tableau-de-bord.jpg) |

**Ce qui change, et pourquoi**

- **Le niveau d'urgence n'avait plus de couleur.** « Faible », « Moyen » et « Élevé » se
  rendaient tous en `rgb(29, 37, 48)` — l'encre par défaut. Les classes
  `text-carbon-green`, `text-carbon-orange` et `text-carbon-red` n'avaient jamais été
  déclarées : `index.css` définissait `.carbon-green` et `.bg-carbon-green`, jamais
  `.text-carbon-green`. Le `className` paraissait correct dans les deux cas. Mesure après
  correction : `rgb(27,94,52)`, `rgb(121,80,10)`, `rgb(143,32,18)`. Vingt éléments de cet
  écran étaient dans ce cas, 159 dans le produit.
- **Une seconde barre de raccourcis doublait la navigation.** Onze entrées sur une ligne —
  Validation, GMAO, Apprentissage, Capteurs, Profils, Import / Export s'ajoutaient aux cinq
  onglets du diagnostic. « Import / Export » se brisait sur deux lignes, le reste partait
  en défilement horizontal, et la barre de défilement — un dégradé bleu-violet — traversait
  l'écran juste sous les onglets. Les six destinations figurent toutes dans la barre
  principale. Seuls restent les cinq onglets qui sont le travail de cet écran.
- **Cinq `console.log` imprimaient le formulaire brut**, sérialisation JSON comprise. Les
  symptômes saisis décrivent l'installation du client.
- **La notification de succès réintroduisait le vocabulaire d'algorithme.** Le formulaire
  avait été soigneusement réécrit en « Standard / Avancée / Approfondie / Maximale », mais
  la notification annonçait encore « Diagnostic terminé (Ensemble ML) ». Elle rend
  désormais à l'utilisateur le niveau qu'il a demandé, dans ses mots.
- **Sept champs du formulaire n'étaient liés à aucune étiquette** : visuellement présentes,
  mais sans `htmlFor`. Lecteur d'écran : champs anonymes ; et cliquer sur l'étiquette ne
  donnait pas le focus au champ.
- **`FeatureCards` était importé sans être rendu.** Le composant `QuickStats` qu'il contient
  affiche des chiffres de démonstration écrits en dur (« 24 équipements », « 7 alertes
  actives »). L'import mort retiré, plus rien ne risque de le faire réapparaître ici.
- **Arbitrage assumé :** la route s'appelle `/dashboard` mais l'écran est un poste de
  diagnostic (« Identifier la panne, guider la réparation »). Le renommer touche des liens
  et des signets ; c'est une décision de navigation, à arbitrer en étape C.

---

## Hors captures : ce qui change sur tous les écrans à la fois

- **La barre de défilement n'est plus un dégradé bleu → violet.** Règle d'origine mesurée :
  `::-webkit-scrollbar-thumb { background: linear-gradient(rgb(59,130,246), rgb(139,92,246)); border-radius: 4px }`.
  Elle apparaissait sous les rangées d'onglets, dans chaque modale et chaque tableau
  défilant — c'était la pièce de l'interface qui contredisait le plus visiblement la charte,
  et la seule à le faire partout en même temps.
- **Environ deux cents lignes de CSS décoratif** (verre dépoli, dégradé de texte animé,
  soulèvement de carte de 12 px, balayage brillant des boutons, flottement) étaient livrées
  à chaque chargement sans qu'aucun composant ne les utilise.
- **L'onglet inactif de la bibliothèque passait à 4,41:1**, juste sous le seuil AA de
  4,5:1 — un seul jeton (`--muted-foreground`), mais il faisait échouer six écrans au moins,
  toujours de la même quantité. Assombri de 45 % à 40 % de clarté : 5,26:1, mesuré.
- **Les cinq déclencheurs de la navigation principale n'avaient aucun indicateur de focus
  clavier** (`outline-none` sans contrepartie). WCAG 2.4.7.

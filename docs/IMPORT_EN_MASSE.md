# L'import en masse est restreint

*Lot du 26 octobre 2026. Suite directe de la restriction de la création d'un
ordre de travail (voir `DEMANDES_INTERVENTION.md`, « La création directe est
restreinte »), qui avait laissé une porte ouverte à côté.*

---

## Ce qui était ouvert, et pourquoi c'était pire que prévu

En posant la restriction sur `POST /api/work-orders`, le constat suivant avait
été **signalé sans être changé** : l'import en masse créait des ordres de
travail sans aucun contrôle de rôle. Le relevé d'alors nommait **trois**
routes. Le relevé fait pour ce lot en a trouvé **sept** :

| Route | Écrit | Locataire | Rôle |
|---|---|---|---|
| `POST /api/data-import-export/import` | équipements, historique, **ordres**, pièces | ✓ session | ✗ |
| `POST /api/import/user-historical-data` | équipements, cas, **ordres** | ✓ session | ✗ |
| `POST /api/import/default-historical-data` | cas de maintenance | ✓ session | ✗ |
| `POST /api/import/maintenance-csv` | cas de maintenance | ✗ **aucun** | ✗ |
| `POST /api/import/reported-cases-csv` | cas signalés | ✗ **aucun** | ✗ |
| `POST /api/diagnostic/process-excel-sheets` | équipements, cas, gammes | ✓ session | ✗ |
| `POST /api/diagnostic/upload-excel` | équipements, cas, gammes | ✓ session | ✗ |

Deux écarts par rapport au relevé initial, et le second est le plus grave :

1. **sept portes et non trois.** Les deux routes CSV et les deux routes
   `/api/diagnostic/*` n'avaient pas été vues. Quatre portes fermées sur sept
   auraient donné une restriction d'apparence, exactement le défaut qu'on
   cherchait à corriger.

2. **deux routes n'avaient AUCUN cloisonnement.**
   `/api/import/maintenance-csv` et `/api/import/reported-cases-csv`
   n'appelaient même pas `tenantRequis` : elles écrivaient des lignes avec
   `tenant_id` NULL. Ces lignes n'appartenaient à personne — pas même à
   l'entreprise qui venait de les charger, qui ne les voyait donc jamais
   réapparaître. Ces deux routes avaient échappé à la campagne de
   cloisonnement qui avait traité leurs voisines (le commentaire « *il écrivait
   auparavant des lignes sans locataire* » figure sur les autres, pas sur
   elles).

Vérifié en base, et non déduit du code : `maintenance_cases.tenant_id` et
`reported_cases.tenant_id` sont `NULL`-ables et **sans valeur par défaut**.
Aucune valeur ne venait donc compenser l'oubli.

---

## Le seuil retenu : `maintenance_manager` (4)

La valeur vit à **un seul endroit**, `shared/import-en-masse.ts`, lue par le
serveur *et* par l'interface. Deux copies pouvaient se désaccorder sans que
rien ne le signale : un bouton offert à qui le serveur refuse, ou masqué à qui
en a le droit.

Trois bornes, dans l'ordre où elles contraignent :

1. **Plancher — au moins `team_leader` (2).** Deux chemins d'import créent des
   ordres de travail. Les laisser sous le seuil de `POST /api/work-orders`
   rendait la restriction de la veille **contournable avec un tableur**. Ce
   n'est pas un choix, c'est une conséquence.

2. **Au-dessus du plancher — `maintenance_manager` (4).** Un import écrit en
   masse et **aucune annulation en masse n'existe**. Chaque ligne créée doit
   ensuite être supprimée une par une, et certaines suppressions sont
   réservées au `technical_director`. Le dépôt portait déjà ce constat dans
   ses propres tests : `tests/integration/csrf.test.ts` qualifie cet import
   d'« écriture volumineuse et difficilement réversible ».

3. **Plafond — sous `technical_director` (5).** Ce dépôt réserve le niveau 5
   aux actes **destructeurs** (supprimer un équipement, un plan, un compteur).
   Un import n'efface rien : il ajoute. Le placer au-dessus de la suppression
   aurait été incohérent.

`procurement` (3) tombe donc dehors, et c'est voulu : les achats engagent la
dépense, pas le référentiel du parc.

> **C'est une décision de politique, pas une évidence technique.** Elle se
> change en une ligne dans `shared/import-en-masse.ts`, et deux tests la
> constatent explicitement pour que le changement soit relu plutôt que subi.

---

## Ce qui reste ouvert, et pourquoi

**`POST /api/data-import-export/validate` n'est pas gardée.** Elle compte les
lignes et signale les erreurs de format : **elle n'écrit rien**. Préparer et
vérifier un fichier reste le travail de celui qui connaît le parc ; seul le
*chargement* demande le niveau. C'est cette route que le refus désigne — un
refus qui se contente d'interdire pousse à contourner, un refus qui nomme
l'étape utile fait travailler.

Un test verrouille son **absence** de garde, pour qu'on ne la ferme pas par
réflexe.

---

## La garde est posée avant la lecture du fichier

Deux routes font parser le fichier par un middleware (`upload.single('file')`,
`uploadMiddleware`) **avant** d'entrer dans leur gestionnaire. Un contrôle
écrit dans le corps aurait laissé un appelant non habilité faire lire, filtrer
et mettre en mémoire 5 Mo avant d'être refusé — un refus qui coûte exactement
le travail qu'il refuse.

La garde est donc un **middleware placé avant** celui d'upload. Ce n'est pas
qu'une question de coût : c'est observable, et un test le prouve plutôt que de
le supposer. Un fichier de type interdit (`.exe`) envoyé par un technicien
reçoit le **403 de rôle**, et non l'erreur de format qu'aurait produite le
`fileFilter` de multer. Le témoin inverse accompagne le test : le même fichier
envoyé par un responsable n'est plus refusé pour le rôle.

Le contrôle **échoue fermé** : sans identité sur la requête, il refuse. Toutes
ces routes sont déclarées après `app.use('/api', requireAuthentication)`, donc
`req.user` vient de la session — jamais du corps de la requête.

---

## Côté interface : remplacé, pas masqué

Cinq écrans offraient un import : l'inventaire, l'historique de maintenance,
l'import/export de données, le poste de diagnostic et la page d'import Excel.
Chacun décidait pour lui-même — ou plutôt ne décidait rien.

Un bouton simplement retiré laisse croire que la fonction n'existe pas, ou
qu'elle est en panne : l'utilisateur cherche, recharge, finit par demander. Le
composant partagé `ImportReserve` prend donc **la place** du contrôle et
nomme la règle, le niveau attendu, et ce qui reste faisable tout de suite.

Un détail qui compte : l'état vide de l'historique proposait
« *Vous pouvez aussi reprendre un historique existant depuis un fichier* ».
Cette phrase n'apparaît plus qu'à qui peut réellement le faire — l'annoncer
puis refuser aurait été pire que se taire.

Aucun écran ne contient de rôle en dur ; un test le vérifie sur les cinq.

---

## Ce qui n'est PAS fermé par ce lot

- **`POST /api/equipment` n'a aucune garde de rôle.** Un technicien peut
  toujours créer un équipement — *un par un*. La restriction porte sur le
  **volume** et son irréversibilité, pas sur le geste. Cet écart est assumé :
  le refermer demanderait une décision de politique sur la création unitaire,
  qui n'a pas été prise.
- **`/api/diagnostic/upload-excel` est enregistrée deux fois** (`server/routes.ts`,
  lignes 278 et ~3040). Express ne retient que la première ; la seconde est du
  code mort. **Les deux** portent la garde, pour que retirer celle qui
  s'exécute ne rouvre pas la porte par surprise. Le doublon lui-même n'a pas
  été supprimé : c'est un nettoyage sans rapport avec la restriction.
- **`simpleImportService` est importé sans être appelé** dans
  `server/data-import-export-routes.ts` — import mort, signalé, pas touché.
- **`GUIDE_IMPORTATION_DONNEES.md` ne nomme aucun rôle ni public.** C'est un
  mode d'emploi de formats de fichier. La crainte d'un coût sur le parcours
  d'accueil, avancée au moment du relevé initial, ne s'appuyait donc sur rien :
  aucune documentation ne promettait l'import à tout le monde.

---

## Vérification

Banc sans Docker : grappe PostgreSQL jetable (`initdb -E UTF8`, port 55441),
schéma par `drizzle-kit push`, `tests/seed.ts`, serveur de production bâti
(`npm run build`) sur le port 55551.

**Mesuré en pilotant la vraie API, puis relu dans la table** — et non à travers
la réponse de l'API, qui aurait pu dire n'importe quoi :

| Rôle | Niveau | `POST /api/import/maintenance-csv` | Ligne écrite |
|---|---|---|---|
| `technician` | 1 | **403** | aucune |
| `team_leader` | 2 | **403** | aucune |
| `procurement` | 3 | **403** | aucune |
| `maintenance_manager` | 4 | **200** — 1 cas importé | `tenant_id = …a1fa` |

La dernière colonne est le cœur de la correction : avant ce lot, cette même
ligne aurait porté `tenant_id = NULL`.

- `tests/integration/import-masse-restreint.test.ts` — **26 tests**, dont les
  sept portes × trois rôles refusés, l'ordre garde/multer, l'absence
  d'écriture sur refus, et le cloisonnement entre deux locataires ;
- `tests/unit/import-masse-garde.test.ts` — **32 tests**, dont un **balayage**
  de la source : toute route d'écriture dont le chemin contient « import »
  doit porter la garde, y compris une route ajoutée demain. C'est ainsi que
  ces sept routes se sont retrouvées sans contrôle, et l'énumération seule ne
  l'aurait pas empêché de se reproduire ;
- lanes complètes : **401 tests unitaires** et **430 tests d'intégration**
  verts ;
- `npm run check`, `check:tests`, `check:scripts` : verts (codes de sortie
  relevés explicitement, `--incremental false`) ;
- `npm run verify:migrations` : 15 réussis, 0 échoué (aucune migration ajoutée
  par ce lot — la correction est du code, pas du schéma).

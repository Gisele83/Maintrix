# Environnement de test cloud — Maintrix

Environnement destiné à des **testeurs externes**. Séparé du développement,
sans donnée de production, reproductible d'une commande.

## Monter l'environnement

```bash
node scripts/provision-test-env.mjs
```

De zéro à un environnement vérifié : secrets générés, certificat TLS, image
construite, stack démarrée, schéma appliqué, données de test chargées,
conformité contrôlée, informations d'accès affichées.

| Commande | Effet |
|---|---|
| `node scripts/provision-test-env.mjs` | Monte l'environnement (idempotent) |
| `node scripts/provision-test-env.mjs --reset` | Détruit puis remonte à neuf |
| `node scripts/provision-test-env.mjs --down` | Détruit tout (volumes compris) |
| `node scripts/verify-test-environment.mjs` | Contrôle de conformité seul |

Prérequis : Docker. Rien d'autre à préparer.

## Composition

Trois services : **app**, **db**, **nginx** — définis dans
[docker-compose.test.yml](../docker-compose.test.yml).

```
Internet ──► nginx :80 / :443 ──► app :5000 ──► db :5432
                (public)          (boucle locale)   (interne)
```

### Ce qui est délibérément absent

`docker-compose.yml` embarque quatre services de plus. Ils ne sont **pas
supprimés du dépôt** — ils n'ont simplement pas leur place ici :

| Service | Pourquoi il est écarté |
|---|---|
| **redis** | Référencé par **aucun** code serveur (constat F03). Surface d'attaque sans usage |
| **prometheus** | Scrute `app:5000/api/metrics` — **cet endpoint n'existe pas**. Ses jobs nginx, postgres et redis n'ont pas d'exportateurs. Aucun des cinq ne remonterait rien |
| **grafana** | Sans données Prometheus : tableaux de bord vides |
| **backup** | `deploy.replicas: 0` — jamais démarré |

Livrer une pile de supervision qui ne mesure rien donnerait une **fausse
confiance**. L'observabilité repose ici sur ce qui fonctionne réellement (§ Observabilité).

## ⚠️ Le schéma se pose avec `push`, jamais avec `migrate`

**`drizzle-kit migrate` produit un schéma faux sur ce dépôt.** Le journal
`migrations/meta/_journal.json` s'arrête à `0010` alors que **20 fichiers SQL**
existent : les migrations `0011` → `0019` ne sont enregistrées nulle part et ne
sont donc jamais appliquées.

Mesuré sur deux bases vierges, `migrate` contre `push` :

| | `migrate` | `push` |
|---|---|---|
| Tables | 105 | **112** |
| Colonnes | 1462 | **1658** |

**7 tables entièrement absentes** : `budget_plans`, `budget_transactions`,
`oee_records`, `asset_lifecycle`, `calibration_records`, `warranties`,
`technician_habilitations`.

**10 colonnes `tenant_id` manquantes**, dont sur des tables pourtant créées —
`rca_analyses`, `fmea_analyses`, `maintenance_plans` : un déploiement provisionné
par `migrate` serait donc **sans cloisonnement multi-tenant**, avec fuite de
données entre testeurs.

`drizzle-kit push` dérive le schéma de `shared/schema.ts`, seule source de vérité
utilisée par l'application. C'est la méthode retenue, et
`verify-test-environment.mjs` contrôle le résultat (nombre de tables, présence
des 7 tables marqueurs, présence des colonnes `tenant_id`).

> **Avant d'écrire un pipeline de déploiement** : ne pas y mettre
> `drizzle-kit migrate`. Soit `push`, soit régénérer un journal cohérent au
> préalable — décision à prendre séparément, elle touche l'historique des
> migrations.

## Secrets

`.env.test-cloud`, généré à la volée, **jamais versionné** (`.gitignore`).
Contient les secrets applicatifs, le mot de passe PostgreSQL et le compte
super-admin (dont le mot de passe en clair, pour l'exploitant).

Aucune valeur secrète n'existe dans le dépôt : `docker-compose.test.yml`
n'utilise que des interpolations `${VAR:?...}` qui **échouent** si la variable
manque, sans repli silencieux (héritage F03).

## TLS

Le bloc `443` de `nginx/conf.d/maintrix.conf` exige `/etc/ssl/maintrix.crt` et
`.key`. Le répertoire `ssl/` du dépôt est **vide** : sans certificat, nginx
refuse de démarrer.

Le provisionnement génère un certificat **auto-signé** pour que la stack
fonctionne. Les navigateurs afficheront un avertissement.

> **Avant d'ouvrir aux testeurs (phase 12)** : remplacer par un certificat réel
> (Let's Encrypt ou fourni), placé dans `ssl/maintrix.crt` et `ssl/maintrix.key`,
> puis `docker compose -p maintrix-test restart nginx`.

## Observabilité

| Ce qu'on observe | Comment |
|---|---|
| L'application répond-elle ? | `GET /api/health` — public, 200/503, vérifie PostgreSQL en direct |
| État détaillé | `GET /api/system/health` — **admin uniquement** : base, mémoire, modules, et **état des tâches de fond** (compteurs d'échec, circuits ouverts, dernière erreur) depuis F02 |
| Santé conteneur | `docker compose -p maintrix-test ps` — healthchecks Docker |
| Journaux | `docker compose -p maintrix-test logs -f app` — tâches de fond nommées, journalisation bornée (F02) |

```bash
# Santé publique
curl -k https://<hôte>/api/health

# Suivre les journaux
docker compose --env-file .env.test-cloud -f docker-compose.test.yml -p maintrix-test logs -f app
```

## Exposition réseau

Contrôlé à chaque exécution de `verify-test-environment.mjs` :

- **nginx** : `0.0.0.0:80` et `0.0.0.0:443` — seul point d'entrée public ;
- **app** : `127.0.0.1:5000` — boucle locale de l'hôte, pour le diagnostic ;
- **db** : **aucun port publié** — joignable seulement depuis le réseau interne.

Le pare-feu de l'hôte cloud ne doit ouvrir que **80 et 443**.

## Données

Chargées par [tests/seed.ts](../tests/seed.ts) : 3 tenants de test, 3 comptes.
Déterministes, rejouables. `verify-test-environment.mjs` refuse tout tenant ou
compte dont le nom ne relève pas du jeu de test — garde-fou contre l'introduction
accidentelle de données réelles.

**Aucune donnée de production ne doit être copiée ici**, même anonymisée : cet
environnement est accessible à des tiers.

## Accueillir un testeur

Voir [TESTER_ONBOARDING.md](TESTER_ONBOARDING.md). En résumé : connexion
super-admin, création du tenant, transmission des identifiants temporaires,
changement de mot de passe imposé à la première connexion.

## Avant d'ouvrir aux testeurs

- [ ] Certificat TLS réel en place
- [ ] Pare-feu limité à 80/443
- [ ] `node scripts/verify-test-environment.mjs` → conforme
- [ ] `npm test` → PASS
- [ ] `node scripts/verify-deployment-security.mjs` → 0 échec
- [ ] Rotation de la creds Neon exposée dans l'historique public (phase 1)
- [ ] Sauvegarde et procédure de suppression des comptes en fin de pilote

## ⚠️ Noms de conteneurs : ne jamais les faire coïncider

L'environnement testeur utilise `maintrix-test-app`, `maintrix-test-db`,
`maintrix-test-nginx` — **durables**.

La suite de tests (`npm test`) crée puis **détruit de force** son propre
PostgreSQL jetable. Il s'appelait initialement `maintrix-test-db` : lancer
`npm test` sur l'hôte du pilote **supprimait la base des testeurs**, sans
avertissement. Constaté en montant cet environnement.

Le conteneur éphémère s'appelle désormais `maintrix-jest-db`, et
`scripts/run-tests.mjs` **refuse de démarrer** si son nom correspond à un
conteneur durable. Vérifié : `npm test` s'exécute pendant que l'environnement
testeur tourne, sans l'affecter.

> Règle : tout script qui fait `docker rm -f` doit viser un nom qui lui est
> propre et manifestement éphémère.

## Plusieurs testeurs en même temps

Mesuré sur l'environnement réel (`node scripts/verify-concurrent-testers.mjs`) :

| Situation | Résultat |
|---|---|
| Trois testeurs se connectent simultanément | ✓ toutes les sessions aboutissent |
| **Huit connexions valides de suite** depuis une même adresse | ✓ aucun blocage |
| Sept tentatives erronées | ✓ blocage après cinq — protection intacte |
| 60 lectures simultanées | ✓ **348 ms**, aucune requête perdue |
| Après la charge | ✓ sonde verte, aucun redémarrage |

**Défaut corrigé en F10.** Le limiteur du login incrémentait son compteur à
chaque requête, **succès compris** : six connexions RÉUSSIES depuis une même
adresse déclenchaient 30 minutes de blocage, sans le moindre échec. Six testeurs
derrière un même NAT d'entreprise verrouillaient donc tout le groupe en se
connectant normalement. Seuls les échecs sont désormais comptés.

⚠️ **Ce qui subsiste, et qu'il faut dire aux testeurs.** Les échecs restent
comptés **par adresse IP** — c'est le rôle d'un limiteur anti-force-brute. Des
testeurs partageant une sortie réseau restent donc groupés : cinq erreurs de
mot de passe de l'un bloquent les autres 30 minutes. Nginx pose
`X-Forwarded-For` et l'application a `trust proxy`, si bien que des testeurs
sur des réseaux distincts ne se gênent pas.

### Capacité

Le pool applicatif est fixé à **10 connexions** (`server/db.ts`), avec attente
plafonnée à 10 s ; PostgreSQL en accepte 100. Le pool est donc la contrainte —
mais 60 lectures simultanées passent en 348 ms sans perte, largement au-delà des
besoins d'un pilote. Les tâches de fond puisent dans le même pool (F02).

### Identifiants d'équipement

L'unicité de `equipment_id` est **globale**, pas par tenant : le premier
testeur qui crée « POMPE-01 » empêche tous les autres tenants d'utiliser cet
identifiant. Le refus est propre (400, message actionnable, aucune corruption),
y compris sous création simultanée — mais c'est une friction à signaler aux
testeurs. La corriger demanderait une migration vers un index composite
`tenant_id + equipment_id`.

## Limites connues

- **Mono-instance obligatoire** — voir
  [SINGLE_INSTANCE_ASSUMPTION.md](SINGLE_INSTANCE_ASSUMPTION.md). Ne jamais
  utiliser `--scale`, ni une stratégie de déploiement `RollingUpdate`.
- **Pas de sauvegarde automatique.** Le service `backup` de
  `docker-compose.yml` n'est pas repris ici et n'a jamais tourné.
- **Aucune métrique Prometheus** — l'application n'expose pas `/api/metrics`.
- **Le contrôle de licence est inerte** (constat F08) : aucun tenant ne sera
  bloqué, même expiré. Voir [TESTER_ONBOARDING.md](TESTER_ONBOARDING.md).
- **Volumes locaux à l'hôte** : détruire la stack avec `--down` supprime les
  données. Pas de persistance externalisée.

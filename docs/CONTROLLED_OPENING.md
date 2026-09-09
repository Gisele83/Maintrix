# Ouverture contrôlée aux testeurs — F12

```bash
npm run verify:opening
```

Cette commande refuse l'ouverture tant que quelque chose manque. Elle ne dit pas
« l'application marche » — les barrières F01→F11 le disent déjà — mais
**« quelqu'un qui n'est pas sur cette machine peut s'en servir »**, ce qui est
une autre question.

---

## ✅ Déployé et ouvert — https://maintrix-test.techlearn-saem.com

Déploiement effectué sur OVHcloud Public Cloud le **9 septembre 2026**. Vérifié
**depuis l'extérieur**, comme le ferait un testeur — et non depuis la machine qui
l'héberge :

| Contrôle | Résultat |
|---|---|
| Certificat | `CN=maintrix-test.techlearn-saem.com`, émis par **Let's Encrypt**, chaîne validée (`Verify return code: 0`), expire le 8 déc. 2026 |
| Navigateur | page servie **sans aucun avertissement** — là où le certificat auto-signé était refusé net |
| Sonde de santé | `{"status":"ok","checks":{"database":"ok"}}` en 0,15 s |
| Redirection HTTP → HTTPS | `301` |
| Connexion depuis le domaine | **acceptée** — le piège `ORIGIN_NOT_ALLOWED` est évité |
| Origine non déclarée | **403** — le filtre protège réellement |
| Parcours navigateur complet | connexion → tableau de bord rendu, valeurs conformes à l'API (0 équipement, 0 alerte, 0 OT), `localStorage.sessionToken = "cookie"` |
| En-têtes de sécurité | CSP, HSTS, `X-Frame-Options: DENY`, nosniff, Referrer-Policy, `X-Robots-Tag: noindex` |
| Version nginx | masquée (`Server: nginx`) |
| Swagger `/api-docs` | non exposé |
| Ports internes (5432, 5000, 6379, 3000, 9090) | **tous fermés** depuis Internet |
| Provisionnement des testeurs | possible — `/api/super-admin/login` répond `401`, donc configuré |

**Les deux réserves ci-dessous sont levées** : l'adresse est publique, le
certificat est reconnu. Elles restent documentées parce qu'elles se reposeraient
à l'identique sur un nouvel hébergement.

<details>
<summary>Les deux réserves, telles qu'elles se présentaient avant le déploiement</summary>

## État avant déploiement : deux réserves, aucun blocage technique

Dernière exécution : **15 contrôles réussis, 0 échec, 2 réserves.**

| Réserve | Conséquence pour un testeur |
|---|---|
| L'adresse déclarée est **privée** (`172.25.88.119`, RFC1918) | joignable depuis le réseau local seulement — un testeur distant n'atteint rien |
| Certificat **auto-signé** (`CN=maintrix-test`) | avertissement de sécurité du navigateur à chaque visite |

> **Notre propre outillage masquait cette seconde réserve.** La suite E2E tourne
> avec `ignoreHTTPSErrors: true` : elle passe au vert sur un certificat qu'un
> navigateur ordinaire refuse. Constaté en tentant d'ouvrir
> `https://172.25.88.119/login` dans un navigateur non instrumenté — navigation
> **bloquée**, alors que le même parcours est vert en E2E. C'est pourquoi la
> vérification du certificat appartient à `npm run verify:opening`, et non à
> Playwright.

Ces deux points relèvent de l'**hébergement**, pas de l'application. Tout le
reste — schéma, données, authentification, cloisonnement, sondes, tâches de
fond, PDF, limitation de débit — est vérifié et vert.

### Ce que la machine actuelle permet, et ne permet pas

L'environnement tourne sur un poste Windows derrière un NAT (sortie
`194.214.167.186`). Toutes ses adresses sont privées. Sans redirection de port
ni tunnel, **aucun testeur extérieur ne peut l'atteindre** — c'est un constat de
réseau, pas un défaut de Maintrix.

Deux usages sont donc possibles :

| | Répétition interne | Ouverture externe |
|---|---|---|
| Qui | vous, des collègues sur le même réseau | testeurs distants |
| Adresse | `https://172.25.88.119` — **opérationnelle** | domaine public, à obtenir |
| Certificat | auto-signé, avertissement à écarter | Let's Encrypt |
| Prêt ? | **oui, maintenant** | après hébergement |

</details>

---

## Le piège qui aurait gâché le premier jour

Avec `ALLOWED_ORIGINS` limité à `localhost`, une connexion depuis toute autre
adresse renvoie **403 `ORIGIN_NOT_ALLOWED`**. Reproduit sur l'adresse LAN avant
correction :

```
https://172.25.88.119/login          → HTTP 200   (la page s'affiche)
POST /api/enterprise-auth/login      → HTTP 403   ORIGIN_NOT_ALLOWED
```

Le testeur voit un écran de connexion normal qui refuse ses identifiants
corrects, sans message exploitable. Rien dans les journaux ne ressemble à une
panne.

L'adresse publique est désormais une **entrée explicite** du provisionnement, et
la porte d'ouverture échoue si elle manque :

```bash
node scripts/provision-test-env.mjs --public-url=https://maintrix-test.exemple.fr
```

Relançable sur un environnement déjà monté : l'origine est ajoutée sans rien
détruire — les comptes testeurs déjà créés sont conservés. Redémarrez ensuite
l'application pour qu'elle prenne effet.

Vérifié dans les deux sens : `403` avant, `200` après, et les origines locales
continuent de fonctionner. La porte contrôle aussi qu'une origine **non
déclarée** est bien refusée — sans quoi une configuration permissive passerait
pour correcte.

---

## Répétition faite : le parcours complet passe par l'adresse publique

Un testeur a été provisionné et son parcours déroulé de bout en bout **via
`https://172.25.88.119`**, jamais via `localhost` :

| Étape | Résultat |
|---|---|
| Connexion super-admin | jeton obtenu |
| Création du locataire testeur | identifiants temporaires restitués (pas de SendGrid) |
| Première connexion du testeur | changement de mot de passe imposé, jeton temporaire de 64 caractères |
| Changement du mot de passe | `HTTP 200` |
| Connexion avec le nouveau mot de passe | `HTTP 200` |
| Accès à l'application (`GET /api/equipment`) | `HTTP 200` |
| Réutilisation de l'ancien mot de passe | `HTTP 401` |

Rien ne reste à valider côté application : ce qui manque est l'hébergement.

---

## Ouvrir réellement : ce qu'il reste à réunir

### 1. Un hôte joignable

Un VPS modeste suffit (2 vCPU, 4 Go, Docker). L'environnement est reproductible
d'une commande : `node scripts/provision-test-env.mjs`.

Contraintes déjà tenues par `docker-compose.test.yml`, à ne pas défaire :
- **nginx est le seul point d'entrée public** ; l'application n'écoute que sur la
  boucle locale, la base ne publie aucun port ;
- aucune donnée de production ;
- secrets générés au provisionnement, jamais versionnés.

Au niveau du pare-feu de l'hôte, n'ouvrez que **80 et 443**.

> **La porte a déjà servi.** Entre deux exécutions, l'adresse déclarée
> (`172.25.88.119`, une interface virtuelle) a disparu et la machine s'est
> retrouvée en `192.168.1.100`. La porte est passée de *POSSIBLE SOUS RÉSERVE* à
> **REFUSÉE**, en signalant `/api/health` injoignable — alors que les conteneurs
> étaient sains et que les 118 tests restaient verts.
>
> C'est la démonstration du besoin : **une adresse attribuée dynamiquement n'est
> pas une adresse d'ouverture.** Un testeur aurait eu un lien mort, sans qu'aucune
> autre barrière ne bronche. Lancez `npm run verify:opening` avant chaque session,
> pas seulement à la première.

### 2. Un nom de domaine et un certificat reconnu

Un certificat auto-signé apprend aux testeurs à ignorer les avertissements de
sécurité — et rend indétectable un vrai incident. Avec un domaine pointant sur
l'hôte :

```bash
docker run --rm -v "$PWD/ssl:/etc/letsencrypt" -p 80:80 \
  certbot/certbot certonly --standalone -d maintrix-test.exemple.fr
```

puis pointez `ssl/maintrix.crt` et `ssl/maintrix.key` sur les fichiers émis et
redémarrez nginx.

### 3. Relancer la porte

```bash
node scripts/provision-test-env.mjs --public-url=https://maintrix-test.exemple.fr
npm run verify:opening
```

Attendu : **OUVERTURE : AUTORISÉE**, sans réserve.

---

## Conduite de l'ouverture

### Provisionner les testeurs

Un compte par testeur, créé par le super-admin — voir
[TESTER_ONBOARDING.md](TESTER_ONBOARDING.md). Le mot de passe temporaire est
restitué dans la réponse API tant que SendGrid n'est pas configuré ; il doit être
changé à la première connexion, et le jeton de ce changement est à usage unique.

**Commencez petit.** Deux ou trois testeurs sur la première session : les défauts
qui comptent apparaissent dès les premiers parcours, et un incident sur trois
personnes se gère, sur trente il se subit.

### Ce qu'il faut leur dire

- l'adresse, et qu'un avertissement de certificat est attendu **si** vous ouvrez
  avant d'avoir un certificat reconnu ;
- que les données sont **fictives et effaçables** — ils peuvent tout casser ;
- que 5 échecs de connexion en 15 minutes bloquent 30 minutes (limiteur
  anti-force-brute, actif en production) ;
- où signaler ce qu'ils observent.

### Observer pendant la session

```bash
docker compose -f docker-compose.test.yml -p maintrix-test logs -f app
curl -sk https://<adresse>/api/health
docker stats --no-stream maintrix-test-app maintrix-test-db
```

La sonde de santé est publique et sans donnée sensible : elle peut être
surveillée par un service externe.

### Arrêter, revenir en arrière

| Besoin | Commande | Effet |
|---|---|---|
| Fermer l'accès immédiatement | `docker stop maintrix-test-nginx` | seul le point d'entrée public tombe ; données et application intactes |
| Rouvrir | `docker start maintrix-test-nginx` | immédiat |
| Repartir de données propres | `node scripts/provision-test-env.mjs --reset` | **détruit les données et les comptes testeurs** |
| Tout démonter | `node scripts/provision-test-env.mjs --down` | conserve le fichier de secrets |

L'arrêt de nginx est le geste à retenir : il coupe l'accès en une seconde, sans
rien perdre.

---

## Limites connues à annoncer

- **Une seule instance.** Sessions, limiteur de débit, tâches de fond et jetons
  temporaires vivent en mémoire — voir
  [SINGLE_INSTANCE_ASSUMPTION.md](SINGLE_INSTANCE_ASSUMPTION.md). Ne lancez pas
  deux exemplaires derrière un répartiteur.
- **Testeurs derrière un même NAT d'entreprise.** Le limiteur indexe par IP :
  ils partagent un compteur. Les connexions réussies ne le consomment pas
  (corrigé en F10), mais des échecs répétés peuvent gêner les voisins d'adresse.
- **Écrans non couverts en E2E** : GMAO, diagnostic, budgets. Les parcours y sont
  moins éprouvés — c'est précisément ce que les testeurs vont révéler.
- **`purchase_orders` n'a pas de colonne `tenant_id`** : les bons de commande ne
  sont pas cloisonnés par locataire. À ne pas utiliser pour éprouver l'isolation.

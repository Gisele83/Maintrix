# Déployer l'environnement de test sur OVHcloud Public Cloud

Objectif : passer de « ça tourne sur mon poste » à **`https://maintrix-test.techlearn-saem.com`**,
joignable par des testeurs externes, avec un vrai certificat.

Une fois l'instance créée et le DNS posé (étapes 1 et 3), tout le reste tient en
une commande :

```bash
sudo bash scripts/deploy-ovh.sh maintrix-test.techlearn-saem.com vous@techlearn-saem.com
```

---

## Étape 1 — Créer l'instance

Espace client OVHcloud → **Public Cloud** → votre projet → **Instances** →
*Créer une instance*.

| Réglage | Valeur | Pourquoi |
|---|---|---|
| Modèle | **D2-4** (2 vCPU, 4 Go) minimum — **B2-7** (2 vCPU, 7 Go) confortable | la construction de l'image (Vite + esbuild) est le moment le plus gourmand ; en dessous de 4 Go elle échoue par manque de mémoire |
| Image | **Ubuntu 24.04** | Docker et Node y sont directement disponibles |
| Disque | **40 Go** minimum | l'image applicative pèse 2,6 Go, plus les couches de construction et les données PostgreSQL |
| Région | **GRA / SBG / DE** | proche de vos testeurs |
| Clé SSH | ajoutez la vôtre | OVH n'envoie pas de mot de passe root pour Public Cloud |

> **Si vous prenez 4 Go**, ajoutez du swap avant la première construction, sinon
> elle peut être tuée par le noyau :
> ```bash
> sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
> sudo mkswap /swapfile && sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

Notez l'**IP publique** affichée à la fin.

---

## Étape 2 — Préparer le serveur

```bash
ssh ubuntu@<IP-publique>
```

```bash
sudo apt update && sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc >/dev/null
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

Node.js 20 (indispensable : les scripts de provisionnement tournent sur l'hôte) :

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**Aucun serveur web ne doit occuper les ports 80 et 443** — nginx tourne dans un
conteneur :

```bash
sudo systemctl disable --now apache2 nginx 2>/dev/null || true
```

### Pare-feu

Deux niveaux à vérifier, l'oubli de l'un est la cause la plus fréquente d'un
« ça ne répond pas » inexplicable :

```bash
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw --force enable
```

Côté OVH, si vous avez attaché un **groupe de sécurité** à l'instance
(Public Cloud → Network → Security groups), autorisez-y aussi 22, 80 et 443 en
entrée. Un groupe restrictif bloque avant même que le paquet n'atteigne `ufw`.

**PostgreSQL n'est jamais exposé** : il n'a aucun port publié, et l'application
n'écoute que sur la boucle locale. Seul nginx est joignable.

---

## Étape 3 — Pointer le domaine

Dans la zone DNS de `techlearn-saem.com`, créez :

| Type | Sous-domaine | Cible |
|---|---|---|
| **A** | `maintrix-test` | l'IP publique de l'instance |

> ### ⚠️ Votre domaine passe par Cloudflare
>
> Mesuré : `techlearn-saem.com` résout vers `188.114.96.2` et `188.114.97.2` —
> des adresses Cloudflare, pas votre hébergement. Vos enregistrements sont donc
> gérés là-bas, et non dans la zone OVH.
>
> **Créez l'enregistrement dans Cloudflare, en mode « DNS only » (nuage gris),
> pas « Proxied » (nuage orange).** Avec le proxy actif, Let's Encrypt valide
> Cloudflare et non votre instance : l'émission du certificat échoue, et le
> déploiement s'arrête à l'étape 2 du script.

Vérifiez la propagation depuis le serveur :

```bash
getent ahostsv4 maintrix-test.techlearn-saem.com
curl -s https://api.ipify.org   # doit afficher la même adresse
```

Le script refuse de continuer si les deux diffèrent — il vaut mieux un refus
clair qu'un échec de certificat obscur.

---

## Étape 4 — Déployer

```bash
git clone https://github.com/Gisele83/Maintrix.git
cd Maintrix
sudo bash scripts/deploy-ovh.sh maintrix-test.techlearn-saem.com vous@techlearn-saem.com
```

Le script enchaîne :

1. **Prérequis** — Docker, ports 80/443 libres, DNS pointant vers *cette* machine.
2. **Certificat** — Let's Encrypt, puis installation dans `ssl/`.
3. **Provisionnement** — secrets générés, image construite, schéma appliqué,
   données de test chargées, `ALLOWED_ORIGINS` réglé sur votre domaine.
4. **Renouvellement** — tâche hebdomadaire installée.
5. **Porte d'ouverture** — `verify-opening.mjs` ; le script sort en erreur si
   elle refuse.

Comptez **10 à 20 minutes** à la première exécution, l'essentiel étant la
construction de l'image. Le script est **relançable** sans rien casser : un
certificat encore valide n'est pas redemandé (Let's Encrypt plafonne à
5 certificats par domaine et par semaine).

Attendu en fin d'exécution :

```
  OUVERTURE : AUTORISÉE   —   17 réussis, 0 échoués, 0 réserve(s)
```

Les deux réserves de la phase 12 — adresse privée, certificat auto-signé —
tombent d'elles-mêmes : l'adresse devient publique et le certificat est signé
par Let's Encrypt.

---

## Étape 5 — Ouvrir aux testeurs

Créez un compte par testeur — voir [TESTER_ONBOARDING.md](TESTER_ONBOARDING.md).
Les identifiants du super-admin sont dans `.env.test-cloud` sur le serveur
(fichier jamais versionné) :

```bash
grep SUPER_ADMIN .env.test-cloud
```

**Commencez par deux ou trois testeurs.** Les défauts qui comptent apparaissent
dès les premiers parcours, et un incident sur trois personnes se gère.

Conduite de session, observation et arrêt d'urgence :
[CONTROLLED_OPENING.md](CONTROLLED_OPENING.md).

---

## Exploiter

```bash
docker compose --env-file .env.test-cloud -f docker-compose.test.yml -p maintrix-test logs -f app
curl -s https://maintrix-test.techlearn-saem.com/api/health
node scripts/verify-opening.mjs        # avant chaque session
```

| Besoin | Commande |
|---|---|
| Fermer l'accès immédiatement | `docker stop maintrix-test-nginx` |
| Rouvrir | `docker start maintrix-test-nginx` |
| Repartir de données propres | `node scripts/provision-test-env.mjs --reset` ⚠️ efface les comptes testeurs |
| Mettre à jour le code | voir « Mettre à jour sans casser la production » ci-dessous |

### Mettre à jour sans casser la production

> ⚠️ **Ne lancez jamais un `git pull` sec sur ce serveur.**
>
> Le premier déploiement a été fait en copiant un arbre de travail, pas depuis
> Git : le serveur porte donc des modifications locales non commitées, et son
> `origin/main` ne les contenait pas. Un `git pull` écraserait la production
> avec une version antérieure — sans sonde de santé (le healthcheck Docker
> tomberait), sans les correctifs CSRF, Swagger public.

Procédure sûre, à dérouler dans l'ordre :

```bash
cd /opt/maintrix-git   # adaptez au chemin de VOTRE clone

# 1. Ce qui n'est pas dans Git — secrets et certificats — est mis à l'abri.
sudo cp -a .env.test-cloud ssl ~/sauvegarde-maintrix-$(date +%F)/ 2>/dev/null || \
  { mkdir -p ~/sauvegarde-maintrix-$(date +%F) && sudo cp -a .env.test-cloud ssl ~/sauvegarde-maintrix-$(date +%F)/; }

# 2. Voir ce qui diffère AVANT de toucher à quoi que ce soit.
git fetch origin
git status --porcelain | head -30

# 3. Mettre les modifications locales de côté (récupérables par `git stash pop`).
git stash push -u -m "etat-deploye-$(date +%F)"

# 4. Basculer sur la version publiée.
git checkout main && git pull --ff-only

# 5. Reconstruire et vérifier.
sudo bash scripts/deploy-ovh.sh maintrix-test.techlearn-saem.com vous@techlearn-saem.com
```

Si la porte d'ouverture refuse à l'étape 5, revenez en arrière :

```bash
git stash pop        # restaure l'état qui fonctionnait
sudo bash scripts/deploy-ovh.sh maintrix-test.techlearn-saem.com vous@techlearn-saem.com
```

Faites-le **hors session de test**, et prévenez les testeurs : la reconstruction
de l'image coupe le service quelques minutes.

### Le certificat

Il vit 90 jours. `/etc/cron.weekly/maintrix-renouveler-cert`, installé par le
script, le renouvelle sous 30 jours de validité, recopie les fichiers dans
`ssl/` et recharge nginx.

Pour vérifier que le mécanisme fonctionne **avant** d'en dépendre :

```bash
sudo /etc/cron.weekly/maintrix-renouveler-cert && echo "renouvellement OK"
```

Le renouvellement passe par `/.well-known/acme-challenge/`, servi en clair par
nginx. Ce chemin a dû être ajouté explicitement : le bloc HTTP redirigeait
**tout** vers HTTPS, y compris le défi — le premier certificat s'obtenait, puis
le renouvellement échouait en silence, et le site devenait inaccessible
90 jours plus tard sur une erreur de certificat expiré.

---

## Si quelque chose bloque

| Symptôme | Cause la plus probable |
|---|---|
| `ne résout vers aucune adresse IPv4` | enregistrement A absent ou non propagé |
| `pointe vers 188.114.x.x` | proxy Cloudflare actif — passez le sous-domaine en « DNS only » |
| `Le port 80 est occupé` | apache2 ou nginx système actif : `sudo systemctl disable --now apache2 nginx` |
| Émission du certificat échouée | port 80 fermé côté pare-feu OVH **ou** `ufw` |
| Construction tuée sans message | mémoire insuffisante — ajoutez du swap (étape 1) |
| `403 ORIGIN_NOT_ALLOWED` à la connexion | l'application n'a pas été relancée après changement du domaine : `docker compose … up -d app` |

---

## Ce que ce déploiement ne couvre pas

- **Une seule instance.** Sessions, limiteur de débit et tâches de fond vivent en
  mémoire — voir [SINGLE_INSTANCE_ASSUMPTION.md](SINGLE_INSTANCE_ASSUMPTION.md).
  Ne lancez pas deux exemplaires derrière un répartiteur de charge.
- **Aucune sauvegarde automatique.** Les données sont fictives et régénérables
  par `--reset` ; si vous voulez conserver un état, prenez un instantané du
  volume Docker ou une image de l'instance côté OVH.
- **Aucune supervision externe.** `/api/health` est public et sans donnée
  sensible : branchez-y un service de surveillance si les sessions s'étalent.

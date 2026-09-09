# Maintrix — Guide d'installation v2.6.0

## Prérequis système

| Composant | Minimum | Recommandé |
|-----------|---------|------------|
| CPU | 2 cœurs | 4 cœurs |
| RAM | 4 Go | 8 Go |
| Disque | 20 Go | 50 Go SSD |
| OS | Ubuntu 20.04+ / Windows 10+ | Ubuntu 22.04 LTS |
| Node.js | 20 LTS | 20 LTS |
| PostgreSQL | 14+ | 15 |
| Docker | 24+ | 25+ |

---

## Installation 1 — Docker (recommandé pour production)

### Étape 1 — Cloner le dépôt
```bash
git clone https://github.com/maintrix/maintrix.git
cd maintrix
```

### Étape 2 — Configurer l'environnement
```bash
cp .env.example .env
nano .env   # Renseigner DATABASE_URL, SESSION_SECRET, ANTHROPIC_API_KEY, etc.
```

### Étape 3 — Créer les répertoires de données
```bash
mkdir -p data/{postgres,redis,uploads,logs,backups,prometheus,grafana}
chmod 755 data/
```

### Étape 4 — Démarrer les services
```bash
docker-compose up -d
```

### Étape 5 — Vérifier le démarrage
```bash
docker-compose ps
curl http://localhost:5000/api/health
```

### Étape 6 — Accéder à l'application
- Application : via nginx sur http://votre-serveur (80) ou https://votre-serveur (443)
- Documentation API : http://votre-serveur/api-docs

Les services d'administration ne sont plus publiés sur Internet. Ils écoutent
uniquement sur la boucle locale du serveur ; y accéder via un tunnel SSH :

```bash
ssh -L 3000:127.0.0.1:3000 -L 5000:127.0.0.1:5000 utilisateur@votre-serveur
```

- Grafana : http://127.0.0.1:3000 — identifiant `admin`, mot de passe = valeur
  de `GRAFANA_ADMIN_PASSWORD` dans votre fichier `.env.docker` (généré par
  `scripts/generate-docker-env.sh`, jamais versionné).
- Prometheus : non publié — `docker compose exec prometheus wget -qO- localhost:9090/-/healthy`

---

## Installation 2 — Manuelle (Linux/macOS)

### Prérequis
```bash
# Ubuntu/Debian
sudo apt-get install -y nodejs npm postgresql-15 redis-server

# Vérifier les versions
node --version   # v20.x.x
npm --version    # 10.x.x
psql --version   # 15.x
```

### Base de données
```bash
sudo -u postgres psql
CREATE DATABASE maintrix_db;
CREATE USER maintrix_user WITH ENCRYPTED PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE maintrix_db TO maintrix_user;
\q
```

### Application
```bash
git clone https://github.com/maintrix/maintrix.git
cd maintrix
npm install
cp .env.example .env
# Éditer .env
npm run db:push
npm run build
npm start
```

### Systemd (démarrage automatique)
```bash
sudo nano /etc/systemd/system/maintrix.service
```
```ini
[Unit]
Description=Maintrix Platform
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=maintrix
WorkingDirectory=/opt/maintrix
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=10
EnvironmentFile=/opt/maintrix/.env

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable maintrix
sudo systemctl start maintrix
sudo systemctl status maintrix
```

---

## Installation 3 — Windows (Desktop)

### Via l'installeur (.EXE)
1. Télécharger `Maintrix-Setup-2.6.0.exe` depuis maintrix.io/download
2. Exécuter l'installeur en tant qu'administrateur
3. Suivre l'assistant (choisir répertoire, créer raccourcis)
4. Lancer Maintrix depuis le bureau ou le menu Démarrer
5. Configurer la connexion à la base de données au premier démarrage

### Via l'installeur (.MSI — déploiement entreprise)
```powershell
# Installation silencieuse pour GPO
msiexec /i Maintrix-2.6.0.msi /quiet /norestart INSTALLDIR="C:\Program Files\Maintrix"
```

### Mises à jour automatiques
Maintrix Desktop vérifie les mises à jour au démarrage.
Cliquer "Télécharger" dans la notification pour installer.

---

## Installation 4 — Cloud (AWS / Azure / OVH)

### AWS EC2
```bash
# Instance recommandée : t3.medium (2 vCPU, 4 Go RAM)
# AMI : Ubuntu Server 22.04 LTS

# Installation automatisée
bash <(curl -s https://install.maintrix.io/cloud/aws.sh)
```

### Azure VM
```bash
# VM recommandée : Standard_B2s (2 vCPU, 4 Go RAM)
bash <(curl -s https://install.maintrix.io/cloud/azure.sh)
```

### Déploiement avec script
```bash
# Script de déploiement inclus
chmod +x scripts/deploy-aws.sh
./scripts/deploy-aws.sh --domain votre-domaine.com --email admin@votre-domaine.com
```

---

## SSL / HTTPS

### Let's Encrypt (automatique)
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

### Certificat personnalisé
Copier vos fichiers dans `ssl/` :
```
ssl/
├── maintrix.crt    # Certificat
└── maintrix.key    # Clé privée
```

---

## Première connexion

### Créer le compte administrateur
Au premier démarrage, accéder à `/register` pour créer le compte admin :
- **Email** : admin@votre-entreprise.com
- **Mot de passe** : minimum 12 caractères
- **Rôle** : admin (sélectionner lors de l'invitation via super-admin)

### Activer la licence
1. Se connecter à l'application
2. Aller dans **Paramètres → Licence**
3. Saisir la clé de licence reçue par email
4. Cliquer **Activer**

### Essai gratuit 14 jours
Sans clé de licence, l'application démarre automatiquement en mode essai :
- Accès complet à toutes les fonctionnalités pendant 14 jours
- Compteur de jours affiché dans la bannière supérieure
- Notification 3 jours avant expiration
- Redirection vers la page d'abonnement à l'expiration

---

## Sauvegarde et restauration

### Sauvegarde manuelle
```bash
# Base de données
pg_dump -U maintrix_user maintrix_db > backup_$(date +%Y%m%d).sql

# Fichiers uploadés
tar -czf uploads_$(date +%Y%m%d).tar.gz data/uploads/
```

### Sauvegarde automatique (via Docker)
Le service `backup` dans docker-compose effectue une sauvegarde quotidienne à 2h du matin.
Les sauvegardes sont stockées dans `data/backups/`.

### Restauration
```bash
# Restaurer la base de données
psql -U maintrix_user maintrix_db < backup_20240101.sql

# Restaurer les fichiers
tar -xzf uploads_20240101.tar.gz -C data/
```

---

## Résolution des problèmes courants

| Problème | Solution |
|----------|----------|
| Port 5000 déjà utilisé | `lsof -i :5000` puis `kill -9 <PID>` |
| Erreur connexion DB | Vérifier `DATABASE_URL` dans `.env` |
| `MODULE_NOT_FOUND` | Exécuter `npm install` |
| CSRF token invalide | Vider les cookies du navigateur |
| Licence expirée | Accéder à `/subscription` pour renouveler |
| Erreur 502 (Nginx) | Vérifier `docker-compose logs app` |

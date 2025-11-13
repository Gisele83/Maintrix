# 🚀 Installation Locale - Maintrix
## Guide d'Installation Complète pour Déploiement Local

---

## 📋 **PRÉREQUIS SYSTÈME**

### **Environnement Technique :**
- **Node.js** : Version 18.x ou 20.x (LTS)
- **PostgreSQL** : Version 13+ 
- **Git** : Pour cloner le repository
- **RAM** : Minimum 4GB, recommandé 8GB
- **Stockage** : Minimum 2GB d'espace libre

### **Systèmes Supportés :**
- ✅ **Windows** 10/11 (voir [INSTALLATION_WINDOWS.md](./INSTALLATION_WINDOWS.md) pour guide spécifique)
- ✅ **macOS** 12+ (Intel/Apple Silicon)
- ✅ **Linux** Ubuntu 20.04+, CentOS 8+, Debian 11+
- ✅ **Docker** (toutes plateformes)

---

## 🪟 **INSTALLATION WINDOWS**

**Pour les utilisateurs Windows, consultez le guide dédié : [INSTALLATION_WINDOWS.md](./INSTALLATION_WINDOWS.md)**

Ce guide contient :
- ✅ Instructions PowerShell et CMD adaptées
- ✅ Script d'installation automatique (`scripts\windows-setup.bat`)
- ✅ Résolution des problèmes spécifiques Windows
- ✅ Configuration service Windows avec PM2 ou NSSM

**Installation rapide Windows :**
```powershell
# Exécuter PowerShell en tant qu'Administrateur
cd chemin\vers\maintrix
.\scripts\windows-setup.bat
```

---

## 📦 **MÉTHODE 1 : INSTALLATION STANDARD (Linux/macOS)**

### **Étape 1 : Cloner le Repository**
```bash
# Cloner le projet
git clone https://github.com/votre-organisation/maintrix.git
cd maintrix

# Vérifier les prérequis
node --version  # Doit afficher v18.x ou v20.x
npm --version   # Doit afficher 8.x+
```

### **Étape 2 : Installation des Dépendances**
```bash
# Installation des packages npm
npm install

# Vérification de l'installation
npm list --depth=0
```

### **Étape 3 : Configuration Base de Données**
```bash
# Installation PostgreSQL (Ubuntu/Debian)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Installation PostgreSQL (macOS avec Homebrew)
brew install postgresql
brew services start postgresql

# Installation PostgreSQL (Windows)
# Télécharger depuis https://www.postgresql.org/download/windows/
```

### **Étape 4 : Configuration Environnement**
```bash
# Copier le fichier d'environnement
cp .env.example .env

# Éditer le fichier .env
nano .env
```

**Contenu du fichier .env :**
```env
# Base de données
DATABASE_URL="postgresql://username:password@localhost:5432/maintrix_db"
PGHOST=localhost
PGPORT=5432
PGUSER=maintrix_user
PGPASSWORD=votre_mot_de_passe_securise
PGDATABASE=maintrix_db

# Application
NODE_ENV=production
PORT=5000
SESSION_SECRET=votre_cle_session_securisee_tres_longue

# IA et ML (optionnel)
OPENAI_API_KEY=votre_cle_openai_optionnelle

# Stockage Objets (optionnel)
PUBLIC_OBJECT_SEARCH_PATHS="/bucket/public"
PRIVATE_OBJECT_DIR="/bucket/private"
```

### **Étape 5 : Initialisation Base de Données**
```bash
# Créer la base de données
createdb maintrix_db

# Exécuter les migrations
npm run db:push

# Charger les données de démonstration (120 cas industriels)
npx tsx server/seed.ts
```

### **Étape 6 : Construction et Démarrage**
```bash
# Mode développement (avec hot reload)
npm run dev

# OU mode production
npm run build
npm start

# L'application sera accessible sur http://localhost:5000
```

### **Étape 7 : Connexion Initiale**

Une fois l'application démarrée, connectez-vous avec les identifiants par défaut :

- **URL** : http://localhost:5000
- **Email** : admin@maintrix.local
- **Mot de passe** : Maintrix2024!

⚠️ **IMPORTANT** : Changez ces identifiants en production !

Pour créer de nouveaux utilisateurs, utilisez l'interface d'administration après connexion.

---

## 🐳 **MÉTHODE 2 : INSTALLATION DOCKER**

### **Dockerfile**
```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copie des fichiers de configuration
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY drizzle.config.ts ./

# Installation des dépendances
RUN npm ci --only=production

# Copie du code source
COPY . .

# Construction de l'application
RUN npm run build

# Exposition du port
EXPOSE 5000

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=5000

# Commande de démarrage
CMD ["npm", "start"]
```

### **docker-compose.yml**
```yaml
version: '3.8'

services:
  # Application Maintrix
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://maintrix_user:smart_password@db:5432/maintrix_db
      - SESSION_SECRET=votre_cle_session_securisee_docker
    depends_on:
      - db
    restart: unless-stopped
    volumes:
      - ./uploads:/app/uploads

  # Base de données PostgreSQL
  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=maintrix_db
      - POSTGRES_USER=maintrix_user
      - POSTGRES_PASSWORD=smart_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped

  # Redis pour cache et sessions (optionnel)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    restart: unless-stopped
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### **Commandes Docker :**
```bash
# Construction et démarrage
docker-compose up -d --build

# Vérification des logs
docker-compose logs -f app

# Charger les données de démo (si nécessaire)
docker-compose exec app npx tsx server/seed.ts

# Arrêt
docker-compose down

# Mise à jour
docker-compose pull && docker-compose up -d --build
```

**Connexion après installation Docker** :
- **URL** : http://localhost:5000
- **Email** : admin@maintrix.local
- **Mot de passe** : Maintrix2024!

---

## 🔧 **CONFIGURATION AVANCÉE**

### **Configuration Nginx (Reverse Proxy)**
```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    # Redirection HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name votre-domaine.com;

    # Certificats SSL
    ssl_certificate /etc/ssl/certs/votre-domaine.crt;
    ssl_certificate_key /etc/ssl/private/votre-domaine.key;

    # Configuration SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

    # Proxy vers l'application
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Configuration fichiers statiques
    location /static/ {
        alias /app/dist/client/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### **Service Systemd (Linux)**
```ini
[Unit]
Description=Maintrix
After=network.target postgresql.service

[Service]
Type=simple
User=maintrix
WorkingDirectory=/opt/maintrix
Environment=NODE_ENV=production
Environment=PORT=5000
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Installation du service
sudo cp maintrix.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable maintrix
sudo systemctl start maintrix

# Vérification du statut
sudo systemctl status maintrix
```

---

## 📊 **MONITORING ET MAINTENANCE**

### **Logs et Monitoring**
```bash
# Visualisation des logs
tail -f /var/log/maintrix/app.log

# Monitoring des performances
htop
iotop
nethogs

# Surveillance base de données
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

### **Sauvegarde Automatique**
```bash
#!/bin/bash
# Script de sauvegarde (/opt/scripts/backup-maintrix.sh)

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/maintrix"
DB_NAME="maintrix_db"

# Création du répertoire de sauvegarde
mkdir -p $BACKUP_DIR

# Sauvegarde base de données
pg_dump $DB_NAME > $BACKUP_DIR/db_backup_$DATE.sql

# Sauvegarde fichiers uploads
tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz /app/uploads

# Nettoyage des anciennes sauvegardes (>30 jours)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Sauvegarde terminée : $DATE"
```

```bash
# Ajout au crontab pour sauvegarde quotidienne
crontab -e
# Ajouter : 0 2 * * * /opt/scripts/backup-maintrix.sh
```

---

## 🔒 **SÉCURITÉ**

### **Configuration Firewall (UFW)**
```bash
# Configuration firewall
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 5432/tcp  # PostgreSQL (si accès externe nécessaire)

# Vérification
sudo ufw status
```

### **SSL/TLS avec Let's Encrypt**
```bash
# Installation Certbot
sudo apt install certbot python3-certbot-nginx

# Génération certificat
sudo certbot --nginx -d votre-domaine.com

# Renouvellement automatique
sudo crontab -e
# Ajouter : 0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 📱 **INSTALLATION APPLICATION MOBILE**

### **Prérequis Mobile :**
- **React Native CLI** : `npm install -g @react-native-community/cli`
- **Android Studio** (pour Android)
- **Xcode** (pour iOS, macOS uniquement)

### **Configuration Mobile :**
```bash
# Navigation vers le dossier mobile
cd mobile

# Installation dépendances
npm install

# Installation pods iOS (macOS uniquement)
cd ios && pod install && cd ..

# Configuration de l'API endpoint
# Éditer mobile/src/config/api.ts
export const API_BASE_URL = 'https://votre-domaine.com/api';
```

### **Compilation Mobile :**
```bash
# Android
npx react-native run-android

# iOS (macOS uniquement)
npx react-native run-ios

# Build de production Android
cd android
./gradlew assembleRelease

# Build de production iOS
npx react-native run-ios --configuration Release
```

---

## 🚀 **DÉPLOIEMENT PRODUCTION**

### **Checklist Pré-Déploiement :**
- [ ] Variables d'environnement configurées
- [ ] Base de données initialisée avec données
- [ ] Certificats SSL en place
- [ ] Firewall configuré
- [ ] Monitoring actif
- [ ] Sauvegardes automatiques
- [ ] Tests fonctionnels passés

### **Mise à Jour Application :**
```bash
#!/bin/bash
# Script de mise à jour (/opt/scripts/update-maintrix.sh)

echo "🔄 Début mise à jour Maintrix..."

# Arrêt de l'application
sudo systemctl stop maintrix

# Sauvegarde avant mise à jour
/opt/scripts/backup-maintrix.sh

# Mise à jour du code
cd /opt/maintrix
git pull origin main

# Mise à jour des dépendances
npm install

# Migration base de données
npm run db:push

# Construction de la nouvelle version
npm run build

# Redémarrage de l'application
sudo systemctl start maintrix

# Vérification du fonctionnement
sleep 10
curl -f http://localhost:5000/api/health || echo "❌ Échec démarrage"

echo "✅ Mise à jour terminée"
```

---

## 📞 **SUPPORT ET DÉPANNAGE**

### **Problèmes Courants :**

**1. Erreur de connexion base de données :**
```bash
# Vérifier le statut PostgreSQL
sudo systemctl status postgresql

# Tester la connexion
psql -h localhost -U maintrix_user -d maintrix_db
```

**2. Port déjà utilisé :**
```bash
# Identifier le processus utilisant le port 5000
sudo lsof -i :5000

# Arrêter le processus
sudo kill -9 PID_DU_PROCESSUS
```

**3. Permissions insuffisantes :**
```bash
# Correction des permissions
sudo chown -R maintrix:maintrix /opt/maintrix
sudo chmod +x /opt/maintrix/start.sh
```

### **Logs de Débogage :**
```bash
# Logs application
journalctl -u maintrix -f

# Logs base de données
sudo tail -f /var/log/postgresql/postgresql-15-main.log

# Logs système
sudo tail -f /var/log/syslog
```

---

## 🎯 **CONTACT SUPPORT**

- **Documentation** : https://docs.maintrix-t.com
- **Support Email** : support@maintrix-t.com
- **Site Web** : https://maintrix-t.com
- **Guides Complémentaires** : INSTALL.md, EVALUATION_DEPLOYMENT_MAINTRIX.md

---

*Cette installation locale permet un déploiement complet et sécurisé de Maintrix sur votre infrastructure, avec toutes les fonctionnalités de diagnostic IA et de gestion de maintenance.*
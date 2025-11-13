# 🪟 Installation Maintrix sur Windows
## Guide Complet pour Windows 10/11

---

## 📋 PRÉREQUIS

### Logiciels Nécessaires
- **Windows 10** ou **Windows 11** (64-bit)
- **Node.js 18.x ou 20.x** LTS
- **PostgreSQL 13+**
- **Git pour Windows**
- **4GB RAM** minimum

---

## 🚀 MÉTHODE 1 : INSTALLATION AUTOMATIQUE (Recommandé)

### Étape 1 : Télécharger le Script

```powershell
# Ouvrir PowerShell en tant qu'Administrateur
# Clic droit sur l'icône PowerShell > "Exécuter en tant qu'administrateur"

# Naviguer vers le dossier du projet
cd C:\Users\VotreNom\Downloads\maintrix
```

### Étape 2 : Exécuter le Script d'Installation

```batch
# Exécuter le script d'installation automatique
.\scripts\windows-setup.bat
```

Le script va automatiquement :
- ✅ Installer Node.js si nécessaire
- ✅ Installer PostgreSQL si nécessaire
- ✅ Créer la base de données
- ✅ Installer les dépendances
- ✅ Configurer le service Windows
- ✅ Créer les raccourcis

**L'application sera accessible sur : http://localhost:5000**

---

## 🔧 MÉTHODE 2 : INSTALLATION MANUELLE

### Étape 1 : Installer Node.js

1. Télécharger Node.js LTS depuis : https://nodejs.org/
2. Exécuter l'installateur `node-v18.x.x-x64.msi`
3. Suivre l'assistant d'installation (cocher "Add to PATH")

**Vérifier l'installation :**
```powershell
node --version
npm --version
```

### Étape 2 : Installer PostgreSQL

1. Télécharger PostgreSQL depuis : https://www.postgresql.org/download/windows/
2. Exécuter l'installateur
3. Définir un mot de passe pour l'utilisateur `postgres` (noter ce mot de passe)
4. Port par défaut : `5432`

**Vérifier l'installation :**
```powershell
psql --version
```

### Étape 3 : Installer Git

1. Télécharger Git depuis : https://git-scm.com/download/win
2. Exécuter l'installateur
3. Utiliser les options par défaut

### Étape 4 : Cloner le Projet

```powershell
# Ouvrir PowerShell
# Naviguer vers le dossier souhaité
cd C:\Users\VotreNom\Documents

# Cloner le projet
git clone https://github.com/votre-organisation/maintrix.git
cd maintrix
```

### Étape 5 : Créer la Base de Données

```powershell
# Méthode 1 : Via psql
psql -U postgres

# Dans psql, exécuter :
CREATE DATABASE maintrix_db;
CREATE USER maintrix_user WITH PASSWORD 'votre_mot_de_passe_securise';
GRANT ALL PRIVILEGES ON DATABASE maintrix_db TO maintrix_user;
\q
```

**Méthode 2 : Via pgAdmin (Interface graphique)**
1. Ouvrir pgAdmin 4
2. Se connecter au serveur local
3. Clic droit sur "Databases" > "Create" > "Database"
4. Nom : `maintrix_db`
5. Cliquer "Save"

### Étape 6 : Configuration Environnement

```powershell
# Copier le fichier d'exemple
copy .env.example .env

# Éditer le fichier .env avec Notepad
notepad .env
```

**Contenu du fichier .env :**
```env
# Base de données
DATABASE_URL=postgresql://postgres:votre_mot_de_passe@localhost:5432/maintrix_db
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=votre_mot_de_passe
PGDATABASE=maintrix_db

# Application
NODE_ENV=development
PORT=5000
SESSION_SECRET=votre_cle_session_tres_longue_minimum_32_caracteres

# IA (optionnel)
ANTHROPIC_API_KEY=votre_cle_anthropic_optionnelle
```

**⚠️ IMPORTANT** : Remplacez `votre_mot_de_passe` par le mot de passe PostgreSQL que vous avez défini.

### Étape 7 : Installer les Dépendances

```powershell
# Installer les packages npm
npm install

# Vérifier l'installation
npm list --depth=0
```

### Étape 8 : Initialiser la Base de Données

```powershell
# Appliquer le schéma
npm run db:push

# Charger les données de démonstration (optionnel)
npx tsx server/seed.ts
```

### Étape 9 : Démarrer l'Application

**Mode Développement :**
```powershell
npm run dev
```

**Mode Production :**
```powershell
npm run build
npm start
```

**L'application sera accessible sur : http://localhost:5000**

---

## 🔐 CONNEXION INITIALE

Après le démarrage, ouvrez votre navigateur :

- **URL** : http://localhost:5000
- **Email** : admin@maintrix.local
- **Mot de passe** : Maintrix2024!

⚠️ **Changez ces identifiants immédiatement en production !**

---

## 🐳 MÉTHODE 3 : INSTALLATION DOCKER (Alternative)

### Prérequis Docker
- **Docker Desktop pour Windows** : https://www.docker.com/products/docker-desktop

### Installation avec Docker

```powershell
# Démarrer Docker Desktop

# Naviguer vers le dossier du projet
cd C:\Users\VotreNom\Documents\maintrix

# Construire et démarrer les conteneurs
docker-compose up -d --build

# Vérifier les logs
docker-compose logs -f app

# Charger les données de démo (optionnel)
docker-compose exec app npx tsx server/seed.ts
```

**Accès : http://localhost:5000**

**Arrêter Docker :**
```powershell
docker-compose down
```

---

## 🔧 CONFIGURATION AVANCÉE WINDOWS

### Créer un Service Windows

**Option 1 : Avec PM2 (Recommandé)**

```powershell
# Installer PM2 globalement
npm install -g pm2
npm install -g pm2-windows-service

# Configurer PM2 en tant que service
pm2-service-install

# Démarrer l'application avec PM2
pm2 start npm --name "maintrix" -- start
pm2 save

# Configurer le démarrage automatique
pm2 startup
```

**Option 2 : Avec NSSM (Non-Sucking Service Manager)**

```powershell
# Télécharger NSSM depuis : https://nssm.cc/download
# Extraire et naviguer vers le dossier

# Installer le service
.\nssm.exe install Maintrix "C:\Program Files\nodejs\node.exe"

# Configurer les paramètres
# Dans la fenêtre NSSM :
# - Path: C:\Program Files\nodejs\node.exe
# - Startup directory: C:\Users\VotreNom\Documents\maintrix
# - Arguments: dist/index.js

# Démarrer le service
.\nssm.exe start Maintrix
```

### Configuration Pare-feu Windows

```powershell
# Ouvrir PowerShell en tant qu'Administrateur

# Autoriser le port 5000
New-NetFirewallRule -DisplayName "Maintrix" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

### Configuration Variables d'Environnement Système

```powershell
# Ouvrir PowerShell en tant qu'Administrateur

# Ajouter une variable d'environnement système
[System.Environment]::SetEnvironmentVariable('NODE_ENV', 'production', 'Machine')
[System.Environment]::SetEnvironmentVariable('PORT', '5000', 'Machine')
```

---

## 🛠️ DÉPANNAGE WINDOWS

### Problème 1 : "npm n'est pas reconnu"

**Solution :**
```powershell
# Vérifier le PATH
$env:PATH

# Ajouter Node.js au PATH manuellement
$env:PATH += ";C:\Program Files\nodejs"

# Ou redémarrer le terminal après l'installation de Node.js
```

### Problème 2 : "psql n'est pas reconnu"

**Solution :**
```powershell
# Ajouter PostgreSQL au PATH
$env:PATH += ";C:\Program Files\PostgreSQL\15\bin"

# Ou définir de manière permanente :
# Panneau de configuration > Système > Paramètres système avancés
# > Variables d'environnement > PATH > Modifier
# Ajouter : C:\Program Files\PostgreSQL\15\bin
```

### Problème 3 : "Erreur de connexion PostgreSQL"

**Solution :**
```powershell
# Vérifier que PostgreSQL est démarré
# Ouvrir "Services" (services.msc)
# Chercher "postgresql-x64-15"
# Clic droit > Démarrer

# Ou via PowerShell (en tant qu'Admin)
Start-Service postgresql-x64-15
```

### Problème 4 : "Port 5000 déjà utilisé"

**Solution :**
```powershell
# Identifier le processus utilisant le port
netstat -ano | findstr :5000

# Noter le PID (dernière colonne)
# Arrêter le processus
taskkill /PID <PID> /F

# Ou changer le port dans .env
# PORT=3000
```

### Problème 5 : "Erreur de permissions"

**Solution :**
```powershell
# Exécuter PowerShell en tant qu'Administrateur
# Clic droit sur PowerShell > "Exécuter en tant qu'administrateur"

# Ou définir la politique d'exécution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Problème 6 : "Module non trouvé"

**Solution :**
```powershell
# Supprimer et réinstaller les dépendances
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm cache clean --force
npm install
```

### Problème 7 : "Échec npm run db:push"

**Solution :**
```powershell
# Vérifier la connexion à la base
psql -U postgres -h localhost -d maintrix_db

# Si la base n'existe pas, la créer
psql -U postgres -h localhost
CREATE DATABASE maintrix_db;
\q

# Forcer la migration
npm run db:push -- --force
```

---

## 📊 COMMANDES POWERSHELL UTILES

### Gestion de l'Application

```powershell
# Démarrer en développement
npm run dev

# Construire pour production
npm run build

# Démarrer en production
npm start

# Vérifier la santé de l'application
Invoke-WebRequest http://localhost:5000/api/health
```

### Gestion Base de Données

```powershell
# Se connecter à la base
psql -U postgres -h localhost -d maintrix_db

# Faire un backup
pg_dump -U postgres -h localhost maintrix_db > backup_$(Get-Date -Format "yyyyMMdd_HHmmss").sql

# Restaurer un backup
psql -U postgres -h localhost maintrix_db < backup_20250109_143000.sql
```

### Surveillance

```powershell
# Voir les processus Node.js
Get-Process node

# Surveiller l'utilisation mémoire
Get-Counter '\Memory\Available MBytes'

# Voir les connexions réseau
netstat -ano | findstr :5000
```

---

## 📱 INSTALLATION APPLICATION MOBILE (Windows)

### Prérequis Mobile

1. **Android Studio** : https://developer.android.com/studio
2. **Java JDK 11** : https://www.oracle.com/java/technologies/downloads/

### Configuration

```powershell
# Naviguer vers le dossier mobile
cd mobile

# Installer les dépendances
npm install

# Configurer l'URL de l'API
notepad src\config\api.ts

# Modifier :
# export const API_BASE_URL = 'http://localhost:5000/api';
```

### Build Android

```powershell
# Démarrer l'émulateur Android via Android Studio
# Ou connecter un appareil physique

# Lancer l'application
npx react-native run-android

# Build de production
cd android
.\gradlew assembleRelease
```

---

## ✅ CHECKLIST INSTALLATION

- [ ] Node.js 18.x ou 20.x installé
- [ ] PostgreSQL 13+ installé et démarré
- [ ] Git installé
- [ ] Projet cloné
- [ ] Base de données `maintrix_db` créée
- [ ] Fichier `.env` configuré avec bonnes informations
- [ ] Dépendances installées (`npm install`)
- [ ] Schéma base de données appliqué (`npm run db:push`)
- [ ] Données de démo chargées (`npx tsx server/seed.ts`)
- [ ] Application démarrée (`npm run dev` ou `npm start`)
- [ ] Connexion réussie sur http://localhost:5000
- [ ] Pare-feu configuré (si nécessaire)

---

## 🆘 SUPPORT

### Ressources
- **Guide Rapide** : [INSTALL.md](./INSTALL.md)
- **Guide Détaillé** : [INSTALLATION_LOCALE.md](./INSTALLATION_LOCALE.md)
- **Support Email** : support@maintrix-t.com
- **Site Web** : https://maintrix-t.com

### Scripts Utiles
- **Installation automatique** : `.\scripts\windows-setup.bat`
- **Backup automatique** : Créer une tâche planifiée Windows

---

## 📝 NOTES IMPORTANTES

1. **Toujours exécuter PowerShell en tant qu'Administrateur** pour les installations
2. **Noter vos mots de passe** PostgreSQL et les conserver en sécurité
3. **Changer les identifiants par défaut** en production
4. **Faire des sauvegardes régulières** de la base de données
5. **Utiliser un antivirus** et tenir Windows à jour

---

**Maintrix - Intelligent Maintenance Management Platform**  
© 2025 Maintrix. All rights reserved.

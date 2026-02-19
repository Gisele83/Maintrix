# 🚀 Installation Rapide - Maintrix

Guide d'installation simplifiée pour déploiement local de Maintrix.

**Version** : 3.0 | **Mise à jour** : Février 2026

---

## ⚡ Installation Express (5 minutes)

### Prérequis
- **Node.js 18+** ou **20+** (LTS)
- **PostgreSQL 13+** en cours d'exécution
- **Git**
- **4GB RAM** minimum

### Étapes

```bash
# 1. Cloner le projet
git clone <votre-repo-maintrix>
cd maintrix

# 2. Installer les dépendances
npm install

# 3. Configurer l'environnement
cp .env.example .env
nano .env  # Éditer avec vos paramètres DB

# 4. Créer la base de données
createdb maintrix_db

# 5. Initialiser le schéma
npm run db:push

# 6. (Optionnel) Charger les données de démo
npx tsx server/seed.ts

# 7. Démarrer en développement
npm run dev

# Ou build + production
npm run build
npm start
```

L'application sera accessible sur **http://localhost:5000**

---

## 🔧 Configuration Minimale (.env)

```env
# Base de données
DATABASE_URL="postgresql://maintrix_user:votre_mot_de_passe@localhost:5432/maintrix_db"
PGHOST=localhost
PGPORT=5432
PGUSER=maintrix_user
PGPASSWORD=votre_mot_de_passe_securise
PGDATABASE=maintrix_db

# Application
NODE_ENV=development
PORT=5000
SESSION_SECRET=generez_une_cle_aleatoire_tres_longue_minimum_32_caracteres

# IA Diagnostic (optionnel - Claude Anthropic)
ANTHROPIC_API_KEY=votre_cle_anthropic_optionnelle

# Email (optionnel - SendGrid)
SENDGRID_API_KEY=votre_cle_sendgrid

# Paiements (optionnel)
STRIPE_PUBLISHABLE_KEY=pk_test_votre_cle
STRIPE_SECRET_KEY=sk_test_votre_cle
PAYPAL_CLIENT_ID=votre_client_id
PAYPAL_CLIENT_SECRET=votre_secret
PAYPAL_MODE=sandbox
```

---

## 🎯 Fonctionnalités Principales

### GMAO Complète
- Gestion des équipements avec ID auto-généré
- Ordres de travail (création, suivi, validation multi-niveau)
- Maintenance préventive planifiée
- Gestion des pièces détachées et inventaire
- Budgets et rapports de maintenance

### Diagnostic IA (Claude Anthropic)
- 631 cas industriels de référence
- Analyse de symptômes et recommandations
- Modes ML Standard, Avancé et Ensemble
- Maintenance prédictive

### Fonctionnalités Avancées (Février 2026)
- **Portail Client** - Accès public par token pour suivi des interventions
- **Gestion SLA** - Règles SLA, suivi de conformité, alertes de dépassement
- **Score de Santé Machine** - Scores 0-100, évaluation des risques, recommandations IA
- **Alertes Intelligentes** - Détection de patterns, recommandations d'actions
- **Hub Capteurs IoT** - Monitoring temps réel (Modbus, MQTT, OPC-UA, LoRaWAN)
- **QR Codes Équipements** - Génération et impression de QR codes
- **Création rapide d'équipements** depuis le formulaire d'ordre de travail

### Sécurité et Multi-tenant
- RBAC avec 7 rôles et permissions granulaires
- Architecture multi-tenant avec isolation des données
- Authentification sécurisée (bcrypt, CSRF, rate limiting)
- Conformité SOC 2 / ISO 27001

---

## 🐳 Installation Docker

### Déploiement Simplifié (recommandé pour débuter)
```bash
# Créer les répertoires de données
mkdir -p data/{postgres,uploads,logs,backups}

# Démarrage avec docker-compose simplifié
docker-compose -f docker-compose.simple.yml up -d

# Vérification
docker-compose -f docker-compose.simple.yml ps
docker-compose -f docker-compose.simple.yml logs -f app
```

### Déploiement Complet (production)
```bash
# Créer les répertoires de données
mkdir -p data/{postgres,redis,uploads,logs,backups,prometheus,grafana}

# Démarrage avec tous les services
docker-compose up -d

# Services inclus : App + PostgreSQL + Redis + Nginx + Prometheus + Grafana
```

L'application sera accessible sur **http://localhost:5000**

---

## 🔒 Connexion par Défaut

Après le seed des données :
- **URL** : http://localhost:5000
- **Email** : admin@maintrix.local
- **Mot de passe** : Maintrix2024!

⚠️ **Changez ces identifiants en production !**

---

## ☁️ Déploiement Cloud (Scaleway / OVH)

### Scaleway

```bash
# Sur votre instance Scaleway Ubuntu
curl -O https://raw.githubusercontent.com/votre-repo/maintrix/main/scripts/deploy-scaleway.sh
chmod +x deploy-scaleway.sh
./deploy-scaleway.sh
```

**Prérequis Scaleway :**
- Instance DEV1-S minimum (2 vCPU, 2GB RAM)
- Managed PostgreSQL recommandé
- Domaine pointant vers l'IP de l'instance

### OVH

```bash
# Sur votre VPS OVH Ubuntu
curl -O https://raw.githubusercontent.com/votre-repo/maintrix/main/scripts/deploy-ovh.sh
chmod +x deploy-ovh.sh
./deploy-ovh.sh
```

**Prérequis OVH :**
- VPS Starter ou Essential (2 vCPU, 4GB RAM recommandé)
- PostgreSQL local ou OVH Public Cloud Databases
- Domaine configuré dans OVH DNS

**Fonctionnalités des scripts :**
- ✅ Installation automatique de toutes les dépendances
- ✅ Configuration Nginx avec reverse proxy
- ✅ Certificat SSL automatique (Let's Encrypt)
- ✅ Service systemd / PM2 pour redémarrage automatique
- ✅ Pare-feu et Fail2ban configurés
- ✅ Sauvegardes automatiques quotidiennes

---

## 📋 Commandes Utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarrage développement (hot reload) |
| `npm run build` | Construction production |
| `npm start` | Démarrage production |
| `npm run db:push` | Appliquer migrations DB |
| `npx tsx server/seed.ts` | Charger données de démo |
| `npm run check` | Vérification TypeScript |

---

## 🐛 Dépannage

### Erreur : "Cannot connect to database"
```bash
# Vérifier que PostgreSQL est démarré
sudo systemctl status postgresql  # Linux
brew services list                # macOS

# Vérifier les credentials dans .env
psql -h localhost -U maintrix_user -d maintrix_db
```

### Erreur : "Port 5000 already in use"
```bash
# Changer le port dans .env
PORT=5001

# Ou arrêter le processus utilisant le port
lsof -ti:5000 | xargs kill -9
```

### Erreur : "Module not found"
```bash
# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

### Erreur : "duplicate key value" (équipements)
L'ID d'équipement doit être unique. Laissez le champ vide pour une génération automatique.

---

## 📚 Documentation Complète

- **[ARCHITECTURE_GLOBALE_MAINTRIX.md](./ARCHITECTURE_GLOBALE_MAINTRIX.md)** - Architecture technique détaillée
- **[MANUEL_UTILISATEUR_COMPLET.md](./MANUEL_UTILISATEUR_COMPLET.md)** - Manuel utilisateur
- **[RBAC_GUIDE.md](./RBAC_GUIDE.md)** - Guide des rôles et permissions
- **[SECURITY_GUIDE.md](./SECURITY_GUIDE.md)** - Guide de sécurité

---

## 🆘 Besoin d'Aide ?

- **Email** : support@maintrix-t.com
- **Documentation** : https://docs.maintrix-t.com
- **Issues** : Créer une issue sur le repository

---

**Maintrix - Intelligent Maintenance Management Platform**  
© 2026 Maintrix. All rights reserved.

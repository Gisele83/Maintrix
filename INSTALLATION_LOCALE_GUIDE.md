# 🚀 MAINTRIX - Guide d'Installation Locale

Guide complet pour l'installation et le déploiement de Maintrix sur vos serveurs locaux.

---

## 📋 **Prérequis Système**

### **Configuration Minimale**
- **OS**: Ubuntu 20.04+, CentOS 7+, Debian 10+, macOS 10.15+
- **RAM**: 4 GB minimum (8 GB recommandé)
- **Stockage**: 20 GB minimum (50 GB recommandé)
- **Processeur**: 2 CPU cores minimum

### **Configuration Recommandée Production**
- **OS**: Ubuntu 22.04 LTS ou CentOS Stream 9
- **RAM**: 16 GB ou plus
- **Stockage**: 100 GB SSD
- **Processeur**: 4 CPU cores ou plus
- **Réseau**: Connexion stable 100 Mbps+

### **Logiciels Requis**
- Docker 20.10+
- Docker Compose 2.0+
- Git (pour le téléchargement)
- Curl, wget
- OpenSSL (pour SSL)

---

## 🚀 **Installation Rapide**

### **Méthode 1: Script d'Installation Automatique**

```bash
# Téléchargement du script
wget https://releases.maintrix.com/install-maintrix.sh
chmod +x install-maintrix.sh

# Installation interactive
./install-maintrix.sh
```

**Ou depuis le code source:**

```bash
# Clonage du dépôt
git clone https://github.com/votre-org/maintrix.git
cd maintrix

# Exécution de l'installation
./install-maintrix.sh
```

### **Méthode 2: Installation Manuelle**

```bash
# 1. Préparation des répertoires
sudo mkdir -p /opt/maintrix
sudo chown $USER:$USER /opt/maintrix
cd /opt/maintrix

# 2. Téléchargement des fichiers
wget https://releases.maintrix.com/latest/docker-compose.local.yml
wget https://releases.maintrix.com/latest/Dockerfile
wget https://releases.maintrix.com/latest/.env.local.template

# 3. Configuration
cp .env.local.template .env.local
# Éditez .env.local selon vos besoins

# 4. Démarrage
docker-compose -f docker-compose.local.yml up -d
```

---

## ⚙️ **Configuration**

### **Fichier de Configuration (.env.local)**

Le fichier `.env.local` contient toute la configuration de Maintrix:

```bash
# Configuration de base
MAINTRIX_VERSION=2.0.0
DB_PASSWORD=votre_mot_de_passe_securise
WEB_PORT=8080
SESSION_SECRET=votre_cle_session_securisee

# APIs optionnelles
ANTHROPIC_API_KEY=sk-ant-xxxxx  # IA Claude
SENDGRID_API_KEY=SG.xxxxx       # Emails
```

### **Configuration Avancée**

#### **SSL/HTTPS**
```bash
# Dans .env.local
DOMAIN_NAME=maintrix.votre-entreprise.com
SSL_ENABLED=true
SSL_CERT_PATH=/opt/maintrix/ssl/cert.pem
SSL_KEY_PATH=/opt/maintrix/ssl/key.pem

# Génération certificat auto-signé
maintrix ssl generate
```

#### **Intégrations ERP**
```bash
# SAP ERP
SAP_HOST=sap.entreprise.com
SAP_USER=maintrix_user
SAP_PASSWORD=mot_de_passe

# Microsoft Dynamics
DYNAMICS_URL=https://org.crm4.dynamics.com
DYNAMICS_CLIENT_ID=client_id
DYNAMICS_CLIENT_SECRET=client_secret
```

#### **Notifications**
```bash
# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxxxx
SLACK_CHANNEL=#maintrix-alerts

# Email
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM_EMAIL=noreply@entreprise.com
```

---

## 🛠️ **Gestion et Maintenance**

### **Interface en Ligne de Commande**

Maintrix inclut un CLI complet pour la gestion:

```bash
# Installation du CLI (inclus automatiquement)
maintrix help

# Commandes principales
maintrix start          # Démarrer
maintrix stop           # Arrêter
maintrix restart        # Redémarrer
maintrix status         # Statut
maintrix logs           # Logs en temps réel
maintrix backup         # Sauvegarde
maintrix update         # Mise à jour
```

### **Gestion des Services**

```bash
# Démarrage complet
maintrix start

# Arrêt propre
maintrix stop

# Redémarrage
maintrix restart

# Statut détaillé
maintrix status
```

### **Surveillance des Logs**

```bash
# Logs en temps réel
maintrix logs

# Logs d'un service spécifique
maintrix logs app      # Application
maintrix logs db       # Base de données
maintrix logs nginx    # Proxy web

# Dernières lignes
maintrix logs-tail 100
```

---

## 💾 **Sauvegarde et Restauration**

### **Sauvegarde Automatique**

Configuration dans `.env.local`:
```bash
BACKUP_SCHEDULE=0 2 * * *  # Tous les jours à 2h
BACKUP_RETENTION_DAYS=30   # Rétention 30 jours
```

### **Sauvegardes Manuelles**

```bash
# Sauvegarde complète
maintrix backup

# Sauvegarde base de données uniquement
maintrix backup db

# Sauvegarde fichiers uniquement
maintrix backup files
```

### **Restauration**

```bash
# Lister les sauvegardes
ls /opt/maintrix/backups/

# Restaurer une sauvegarde
maintrix restore /opt/maintrix/backups/maintrix_db_20241201_020000.sql.gz
```

---

## 🔧 **Architecture Technique**

### **Services Docker**

| Service | Description | Port |
|---------|-------------|------|
| `maintrix-app` | Application principale | 5000 |
| `maintrix-db` | Base PostgreSQL | 5433 |
| `maintrix-proxy` | Nginx reverse proxy | 80/443 |
| `maintrix-backup` | Service de sauvegarde | - |

### **Volumes de Données**

```
/opt/maintrix/
├── data/
│   ├── postgres/      # Base de données
│   ├── uploads/       # Fichiers uploadés
│   └── logs/          # Logs application
├── backups/           # Sauvegardes
├── config/            # Configuration
└── ssl/               # Certificats SSL
```

### **Réseau**

- **Réseau interne**: 172.25.0.0/16
- **Ports exposés**: 8080 (web), 80/443 (proxy optionnel)
- **Accès base**: localhost:5433

---

## 🔒 **Sécurité**

### **Configuration de Base**

```bash
# Mots de passe forts (générés automatiquement)
DB_PASSWORD=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 64)

# Restriction d'accès
ALLOWED_ORIGINS=http://localhost:8080,http://votre-domaine.com
```

### **SSL/TLS**

```bash
# Certificat Let's Encrypt (recommandé)
certbot certonly --standalone -d maintrix.votre-entreprise.com

# Ou certificat auto-signé pour test
maintrix ssl generate
```

### **Firewall**

```bash
# Ubuntu/Debian
sudo ufw allow 8080/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# CentOS/RHEL
sudo firewall-cmd --add-port=8080/tcp --permanent
sudo firewall-cmd --reload
```

---

## 🚀 **Déploiement Production**

### **Configuration Production Complète**

```bash
# Variables d'environnement production
NODE_ENV=production
DISABLE_TELEMETRY=true
ENABLE_MONITORING=false

# Limites de sécurité
API_RATE_LIMIT=1000
MAX_FILE_SIZE=100MB
SESSION_TIMEOUT=3600

# Sauvegarde renforcée
BACKUP_SCHEDULE=0 */6 * * *  # Toutes les 6h
BACKUP_RETENTION_DAYS=90
```

### **Monitoring et Alertes**

```bash
# Slack pour alertes
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxxxx
SLACK_CHANNEL=#maintrix-prod

# Métriques système
ENABLE_MONITORING=true
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
```

### **Performance et Optimisation**

```bash
# Configuration PostgreSQL
shared_buffers=256MB
effective_cache_size=1GB
max_connections=100

# Configuration Nginx
client_max_body_size=100M
keepalive_timeout=65
gzip_comp_level=6
```

---

## 🔄 **Mise à Jour**

### **Mise à Jour Automatique**

```bash
# Mise à jour complète avec sauvegarde
maintrix update
```

### **Mise à Jour Manuelle**

```bash
# 1. Sauvegarde préventive
maintrix backup

# 2. Téléchargement nouvelle version
cd /opt/maintrix
wget https://releases.maintrix.com/latest/docker-compose.local.yml -O docker-compose.yml.new

# 3. Arrêt et mise à jour
maintrix stop
mv docker-compose.yml.new docker-compose.yml
docker-compose pull
docker-compose build --no-cache

# 4. Redémarrage
maintrix start
```

---

## 🐛 **Dépannage**

### **Problèmes Courants**

#### **Service qui ne démarre pas**
```bash
# Vérifier les logs
maintrix logs

# Vérifier l'espace disque
df -h /opt/maintrix

# Vérifier les ports
netstat -tlnp | grep :8080
```

#### **Base de données inaccessible**
```bash
# Vérifier le service PostgreSQL
docker-compose logs maintrix-db

# Test de connexion
docker-compose exec maintrix-db psql -U maintrix_admin -d maintrix_local
```

#### **Application lente**
```bash
# Vérifier les ressources
maintrix status

# Optimiser la base
docker-compose exec maintrix-db psql -U maintrix_admin -d maintrix_local -c "VACUUM ANALYZE;"
```

### **Diagnostic Avancé**

```bash
# Health check complet
curl -f http://localhost:8080/api/health

# Logs détaillés
maintrix logs-tail 500

# État des conteneurs
docker-compose ps
docker stats
```

---

## 📞 **Support et Contact**

### **Documentation**
- **Site web**: https://maintrix.com
- **Documentation**: https://docs.maintrix.com
- **FAQ**: https://maintrix.com/faq

### **Support Technique**
- **Email**: support@maintrix.com
- **Slack**: maintrix-community.slack.com
- **Issues GitHub**: https://github.com/maintrix/issues

### **Formation**
- **Formations en ligne**: https://training.maintrix.com
- **Webinaires**: Tous les mardis 14h
- **Certification**: Programme certifié disponible

---

## 📝 **Licence et Conformité**

### **Licence Logicielle**
- **Type**: Licence propriétaire Maintrix
- **Usage**: Selon contrat de licence client
- **Support**: Inclus selon niveau de service

### **Conformité**
- **RGPD**: Conforme réglementation européenne
- **ISO 27001**: Sécurité des systèmes d'information
- **SOC 2**: Contrôles de sécurité validés

### **Propriété Intellectuelle**
- **Copyright**: © 2024 Maintrix. Tous droits réservés.
- **Brevets**: Algorithmes IA protégés
- **Marques**: Maintrix® est une marque déposée

---

**🎯 Installation réussie? Connectez-vous sur http://localhost:8080 avec:**
- **Utilisateur**: admin@maintrix.local
- **Mot de passe**: Maintrix2024!

**⚠️ Changez immédiatement le mot de passe par défaut lors de la première connexion.**
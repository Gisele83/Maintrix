# 🚀 Guide de Démarrage Rapide - Maintrix

## Installation en 5 Minutes

### **Option 1 : Installation Automatique (Recommandée)**
```bash
# Télécharger et exécuter le script d'installation
curl -sSL https://install.maintrix.com | sudo bash

# Ou depuis le code source
sudo ./scripts/install.sh
```

### **Option 2 : Installation Docker**
```bash
# Démarrage rapide avec Docker Compose
docker-compose up -d

# Vérification
docker-compose logs -f app
```

### **Option 3 : Installation Manuelle**
```bash
# 1. Prérequis
sudo apt update && sudo apt install -y nodejs npm postgresql git

# 2. Configuration base de données
sudo -u postgres createuser maintrix_user
sudo -u postgres createdb maintrix_db

# 3. Installation application
npm install
cp .env.example .env
# Éditer .env avec vos paramètres
npm run build
npm run db:push
npm run seed

# 4. Démarrage
npm start
```

---

## ⚡ Accès Rapide

- **Application Web** : http://localhost:5000
- **Smart Diagnostic IA** : http://localhost:5000/smart-diagnostic
- **GMAO Dashboard** : http://localhost:5000/gmao-dashboard
- **API Health** : http://localhost:5000/api/health

---

## 🔧 Commandes Essentielles

```bash
# Démarrage
sudo systemctl start maintrix

# Arrêt
sudo systemctl stop maintrix

# Redémarrage
sudo systemctl restart maintrix

# Statut
sudo systemctl status maintrix

# Logs en temps réel
sudo journalctl -u maintrix -f

# Sauvegarde
sudo -u smart-gmao /opt/maintrix/scripts/backup.sh

# Mise à jour
sudo /opt/maintrix/scripts/update.sh

# Test installation
./scripts/test-installation.sh
```

---

## 📋 Premier Usage

### **1. Interface Smart Diagnostic IA**
1. Accéder à `/smart-diagnostic`
2. Sélectionner un équipement (Kalmar RTG, ZPMC STS, etc.)
3. Décrire les symptômes observés
4. Obtenir le diagnostic IA avec recommandations

### **2. Module GMAO**
1. Accéder à `/gmao-dashboard`
2. Gérer les équipements industriels
3. Créer des ordres de travail
4. Planifier la maintenance préventive
5. Suivre les KPIs (MTBF, MTTR, OEE)

### **3. Application Mobile**
1. Scanner le QR code de l'équipement
2. Suivre les procédures de réparation
3. Mode hors ligne disponible
4. Synchronisation automatique

---

## 🛠️ Configuration Personnalisée

### **Variables d'Environnement Clés**
```env
# Base de données
DATABASE_URL=postgresql://user:password@localhost:5432/maintrix_db

# Application
NODE_ENV=production
PORT=5000
SESSION_SECRET=votre_cle_securisee

# IA (optionnel)
OPENAI_API_KEY=sk-votre_cle_openai
```

### **Personnalisation**
- **Logo** : Remplacer `/uploads/logo.png`
- **Couleurs** : Modifier `client/src/index.css`
- **Langue** : Éditer `client/src/lib/i18n.ts`

---

## 🔒 Sécurité de Base

```bash
# Firewall
sudo ufw enable
sudo ufw allow 22 80 443 5000

# SSL avec Let's Encrypt
sudo certbot --nginx -d votre-domaine.com

# Permissions
sudo chown -R smart-gmao:smart-gmao /opt/maintrix
sudo chmod 600 /opt/maintrix/.env
```

---

## 📊 Monitoring

### **Logs Importants**
- **Application** : `journalctl -u maintrix`
- **Base de données** : `/var/log/postgresql/`
- **Nginx** : `/var/log/nginx/`
- **Sauvegardes** : `/opt/maintrix/backups/backup.log`

### **Métriques Clés**
- Temps de réponse API < 2s
- Utilisation mémoire < 1GB
- Espace disque > 20% libre
- Uptime > 99.5%

---

## 🚨 Dépannage Rapide

### **Application ne démarre pas**
```bash
# Vérifier les logs
sudo journalctl -u maintrix -n 50

# Tester la configuration
npm run build
node dist/server/index.js

# Vérifier la base de données
psql $DATABASE_URL -c "SELECT 1;"
```

### **Erreur de connexion base de données**
```bash
# Redémarrer PostgreSQL
sudo systemctl restart postgresql

# Vérifier les permissions
sudo -u postgres psql -c "\du"

# Recréer l'utilisateur si nécessaire
sudo -u postgres dropuser maintrix_user
sudo -u postgres createuser -P maintrix_user
```

### **Performance dégradée**
```bash
# Redémarrer l'application
sudo systemctl restart maintrix

# Nettoyer les logs
sudo journalctl --vacuum-time=7d

# Vérifier l'espace disque
df -h

# Optimiser la base de données
sudo -u postgres psql maintrix_db -c "VACUUM ANALYZE;"
```

---

## 📱 Application Mobile

### **Installation Android**
```bash
cd mobile
npx react-native run-android
```

### **Installation iOS**
```bash
cd mobile && cd ios && pod install && cd ..
npx react-native run-ios
```

### **Configuration Serveur**
Modifier `mobile/src/config/api.ts` :
```typescript
export const API_BASE_URL = 'https://votre-domaine.com/api';
```

---

## 🌐 Déploiement Production

### **Nginx Configuration**
```nginx
server {
    listen 80;
    server_name votre-domaine.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### **Domaine et SSL**
```bash
# Configuration domaine
echo "127.0.0.1 smart-gmao.local" | sudo tee -a /etc/hosts

# Certificat SSL
sudo certbot --nginx -d votre-domaine.com
```

---

## 📞 Support

- **Documentation** : `DOCUMENTATION_COMPLETE_SMART_GMAO_DIAGFIX.md`
- **API Reference** : http://localhost:5000/api-docs
- **Logs** : `journalctl -u maintrix -f`
- **Test Installation** : `./scripts/test-installation.sh`

---

**🎯 En 5 minutes, vous avez une plateforme GMAO complète avec IA diagnostique prête pour la production !**
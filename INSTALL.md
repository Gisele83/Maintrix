# 🚀 Installation Rapide - Maintrix

Guide d'installation simplifiée pour déploiement local de Maintrix.

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

# IA (optionnel)
ANTHROPIC_API_KEY=votre_cle_anthropic_optionnelle
```

---

## 🐳 Installation Docker

```bash
# Démarrage avec docker-compose
docker-compose up -d

# Vérification
docker-compose ps
docker-compose logs -f app
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

---

## 📚 Documentation Complète

Pour plus de détails, consultez :
- **[INSTALLATION_LOCALE.md](./INSTALLATION_LOCALE.md)** - Guide détaillé
- **[EVALUATION_DEPLOYMENT_MAINTRIX.md](./EVALUATION_DEPLOYMENT_MAINTRIX.md)** - Évaluation déploiement
- **[PRESENTATION_MAINTRIX_2025.md](./PRESENTATION_MAINTRIX_2025.md)** - Présentation complète

---

## 🆘 Besoin d'Aide ?

- **Email** : support@maintrix-t.com
- **Documentation** : https://docs.maintrix-t.com
- **Issues** : Créer une issue sur le repository

---

**Maintrix - Intelligent Maintenance Management Platform**  
© 2025 Maintrix. All rights reserved.

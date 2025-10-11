# 🖥️ Maintrix - Machine Virtuelle Windows

## 🚀 **Démarrage Rapide (1 Commande)**

```powershell
# Démarrage automatique (détecte la meilleure méthode)
.\vm-quick-start.ps1
```

Cette commande détecte automatiquement si vous avez Vagrant, Hyper-V ou Docker et démarre Maintrix avec la meilleure configuration.

---

## 📦 **Fichiers VM Créés**

| Fichier | Description |
|---------|-------------|
| `Vagrantfile` | Configuration Vagrant + VirtualBox (automatique) |
| `vm-setup-windows.ps1` | Script d'installation automatique dans la VM |
| `vm-hyperv-create.ps1` | Création VM avec Hyper-V natif |
| `vm-quick-start.ps1` | **Démarrage rapide automatique** |
| `docker-compose.vm.yml` | Stack Docker complète (PostgreSQL + Redis + pgAdmin) |
| `Dockerfile.vm` | Image Docker optimisée production |
| `VM_GUIDE.md` | Guide complet (30+ pages) |

---

## 🎯 **3 Méthodes de Déploiement**

### **1️⃣ Vagrant + VirtualBox (Recommandé)**

**Avantages** : Automatique, portable, facile

```powershell
# Installer les prérequis
choco install vagrant virtualbox -y

# Démarrer (télécharge Windows Server + installe tout automatiquement)
vagrant up

# Accès: http://localhost:5000
```

**Temps** : 15-30 min (premier lancement)

---

### **2️⃣ Hyper-V Natif (Windows Pro/Enterprise)**

**Avantages** : Performances natives, intégration Windows

```powershell
# Activer Hyper-V
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All

# Créer la VM
.\vm-hyperv-create.ps1

# Suivre les instructions à l'écran
```

**Temps** : 30-60 min (installation manuelle Windows Server)

---

### **3️⃣ Docker Compose (Conteneurs)**

**Avantages** : Léger, rapide, isolation complète

```powershell
# Installer Docker Desktop
choco install docker-desktop -y

# Démarrer la stack complète
docker-compose -f docker-compose.vm.yml up -d

# Accès: http://localhost:5000
# pgAdmin: http://localhost:5050
```

**Temps** : 5-10 min

---

## 🔐 **Identifiants par Défaut**

```
Email:        admin@maintrix.local
Mot de passe: Maintrix2024!
```

**⚠️ À CHANGER EN PRODUCTION**

---

## 📊 **Ressources VM Recommandées**

| Configuration | RAM | CPU | Disque |
|---------------|-----|-----|--------|
| **Minimum** | 4 GB | 2 cœurs | 30 GB |
| **Recommandé** | 8 GB | 4 cœurs | 60 GB |
| **Production** | 16 GB | 8 cœurs | 100 GB |

---

## 🛠️ **Commandes Utiles**

### **Vagrant**

```powershell
vagrant up          # Démarrer
vagrant halt        # Arrêter
vagrant ssh         # Se connecter
vagrant destroy     # Supprimer
vagrant snapshot    # Créer sauvegarde
```

### **Hyper-V**

```powershell
Start-VM -Name Maintrix-Server
Stop-VM -Name Maintrix-Server
Checkpoint-VM -Name Maintrix-Server -SnapshotName "Backup"
vmconnect localhost Maintrix-Server
```

### **Docker**

```powershell
docker-compose up -d        # Démarrer
docker-compose down         # Arrêter
docker-compose logs -f      # Voir logs
docker-compose restart      # Redémarrer
```

---

## 🌐 **Accès aux Services**

| Service | URL | Identifiants |
|---------|-----|--------------|
| **Maintrix** | http://localhost:5000 | admin@maintrix.local / Maintrix2024! |
| **pgAdmin** | http://localhost:5050 | admin@maintrix.local / Maintrix2024! |
| **PostgreSQL** | localhost:5432 | maintrix_user / Maintrix2024! |
| **Redis** | localhost:6379 | Password: Maintrix2024! |

---

## 🔧 **Dépannage Rapide**

### ❌ **Erreur "VT-x is not available"**
→ Activer virtualisation dans BIOS (Intel VT-x ou AMD-V)

### ❌ **Port 5000 déjà utilisé**
```powershell
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### ❌ **VM très lente**
→ Allouer plus de RAM/CPU dans Vagrantfile ou paramètres VM

### ❌ **Docker ne démarre pas**
→ Vérifier WSL 2: `wsl --install` puis redémarrer

---

## 📚 **Documentation Complète**

Consultez `VM_GUIDE.md` pour :
- Configuration réseau avancée
- Optimisations performances
- Sauvegarde/restauration
- Migration vers production
- Troubleshooting détaillé

---

## ✅ **Vérification Installation**

```powershell
# Tester l'API
Invoke-WebRequest http://localhost:5000/health

# Tester la base de données
docker exec maintrix-db psql -U maintrix_user -d maintrix -c "SELECT version();"
```

---

## 🚀 **Mise en Production**

### **Checklist**

- [ ] Changer mot de passe admin
- [ ] Définir `NODE_ENV=production`
- [ ] Configurer SSL/TLS
- [ ] Activer firewall
- [ ] Configurer sauvegardes automatiques
- [ ] Tester plan de reprise
- [ ] Documenter procédures

---

## 📞 **Support**

**Questions VM ?**

📧 support@maintrix-t.com  
📚 https://maintrix-t.com/docs  
💬 https://community.maintrix-t.com

---

**🎉 Votre VM Maintrix est prête !**

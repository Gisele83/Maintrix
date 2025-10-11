# 🖥️ Guide Machine Virtuelle Maintrix Windows

## 📋 **Vue d'Ensemble**

Ce guide présente **3 méthodes** pour déployer Maintrix dans une machine virtuelle Windows :

1. **Vagrant + VirtualBox** (Recommandé - Automatique)
2. **Hyper-V Natif** (Windows Pro/Enterprise)
3. **Docker Desktop dans VM** (Conteneurisation complète)

---

## 🎯 **Méthode 1 : Vagrant + VirtualBox (Recommandé)**

### **Prérequis**

- Windows 10/11 (64-bit)
- 8 GB RAM minimum (4 GB alloués à la VM)
- 50 GB espace disque libre
- VirtualBox 7.0+
- Vagrant 2.3+

### **Installation**

#### **Étape 1 : Installer VirtualBox**

```powershell
# Télécharger depuis https://www.virtualbox.org/
# Ou avec Chocolatey
choco install virtualbox -y
```

#### **Étape 2 : Installer Vagrant**

```powershell
# Télécharger depuis https://www.vagrantup.com/
# Ou avec Chocolatey
choco install vagrant -y
```

#### **Étape 3 : Créer et démarrer la VM**

```powershell
# Dans le dossier Maintrix
cd C:\Maintrix

# Démarrer la VM (télécharge l'image Windows Server si besoin)
vagrant up
```

**⏱️ Premier démarrage : 15-30 minutes** (téléchargement Windows Server ~5GB + installation automatique)

#### **Étape 4 : Accéder à Maintrix**

Une fois la VM démarrée :

```
🌐 Ouvrir navigateur: http://localhost:5000
🔐 Email: admin@maintrix.local
🔑 Mot de passe: Maintrix2024!
```

### **Commandes Vagrant Utiles**

```powershell
# Se connecter à la VM
vagrant ssh

# Arrêter la VM
vagrant halt

# Redémarrer la VM
vagrant reload

# Détruire la VM (supprime tout)
vagrant destroy

# Voir le statut
vagrant status

# Recharger la configuration
vagrant reload --provision
```

### **Accès SSH à la VM**

```powershell
# Se connecter via SSH
vagrant ssh

# Une fois connecté, aller dans Maintrix
cd /maintrix

# Démarrer manuellement le serveur
npm run dev
```

---

## 🔷 **Méthode 2 : Hyper-V Natif (Windows Pro/Enterprise)**

### **Prérequis**

- Windows 10/11 Pro ou Enterprise
- Hyper-V activé
- Droits administrateur
- ISO Windows Server 2022 (téléchargeable gratuitement en version évaluation)

### **Activation Hyper-V**

```powershell
# En tant qu'Administrateur
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All

# Redémarrer Windows
Restart-Computer
```

### **Création de la VM**

```powershell
# Exécuter le script de création
.\vm-hyperv-create.ps1

# Ou avec paramètres personnalisés
.\vm-hyperv-create.ps1 -VMName "Maintrix-Prod" -MemoryGB 8 -CPUs 4
```

### **Installation Windows Server dans la VM**

1. **Démarrer la VM** : `Start-VM -Name Maintrix-Server`
2. **Se connecter** : `vmconnect localhost Maintrix-Server`
3. **Installer Windows Server** (suivre l'assistant d'installation)
4. **Configurer réseau** : IP statique ou DHCP
5. **Installer Guest Additions** (pour performances)

### **Déploiement Maintrix dans Hyper-V**

Une fois Windows Server installé dans la VM :

```powershell
# Dans la VM, copier le dossier Maintrix
# Puis exécuter le script de provisioning
cd C:\maintrix
.\vm-setup-windows.ps1
```

### **Commandes Hyper-V Utiles**

```powershell
# Démarrer VM
Start-VM -Name Maintrix-Server

# Arrêter VM
Stop-VM -Name Maintrix-Server

# Redémarrer VM
Restart-VM -Name Maintrix-Server

# Créer snapshot (sauvegarde instantanée)
Checkpoint-VM -Name Maintrix-Server -SnapshotName "Maintrix-Backup-$(Get-Date -Format 'yyyy-MM-dd')"

# Restaurer snapshot
Restore-VMSnapshot -Name "Maintrix-Backup-2025-01-31" -VMName Maintrix-Server

# Lister les VMs
Get-VM

# Voir état de la VM
Get-VM -Name Maintrix-Server | Select-Object Name, State, CPUUsage, MemoryAssigned
```

---

## 🐳 **Méthode 3 : Docker Desktop dans VM**

### **Prérequis**

- VM Windows avec Docker Desktop installé
- 8 GB RAM minimum
- WSL 2 activé dans la VM

### **Installation Docker Desktop dans la VM**

```powershell
# Dans la VM Windows
# Télécharger et installer Docker Desktop
choco install docker-desktop -y

# Ou télécharger depuis https://www.docker.com/products/docker-desktop
```

### **Déploiement Maintrix avec Docker**

```powershell
# Dans le dossier Maintrix
cd C:\maintrix

# Démarrer avec Docker Compose
docker-compose -f docker-compose.windows.yml up -d

# Voir les logs
docker-compose logs -f

# Arrêter
docker-compose down
```

---

## 🔧 **Configuration Réseau**

### **Accès depuis l'hôte Windows**

#### **Vagrant (VirtualBox)**
- **Port Forwarding automatique** : `localhost:5000` → VM
- Pas de configuration supplémentaire requise

#### **Hyper-V**
- **Commutateur externe** : VM accessible sur réseau local
- **Port Forwarding manuel** (si commutateur interne) :

```powershell
# Rediriger port 5000 de l'hôte vers la VM
netsh interface portproxy add v4tov4 listenport=5000 listenaddress=0.0.0.0 connectport=5000 connectaddress=<IP_VM>
```

#### **Trouver l'IP de la VM Hyper-V**

```powershell
# Dans la VM
ipconfig

# Depuis l'hôte
Get-VMNetworkAdapter -VMName Maintrix-Server | Select-Object IPAddresses
```

---

## 📊 **Comparaison des Méthodes**

| Critère | Vagrant + VirtualBox | Hyper-V Natif | Docker dans VM |
|---------|---------------------|---------------|----------------|
| **Facilité** | ⭐⭐⭐⭐⭐ Automatique | ⭐⭐⭐ Manuel | ⭐⭐⭐⭐ Semi-auto |
| **Windows requis** | Home/Pro/Enterprise | Pro/Enterprise | Home/Pro/Enterprise |
| **Performances** | ⭐⭐⭐ Bonnes | ⭐⭐⭐⭐⭐ Excellentes | ⭐⭐⭐⭐ Très bonnes |
| **Portabilité** | ⭐⭐⭐⭐⭐ Multi-plateforme | ⭐⭐ Windows uniquement | ⭐⭐⭐⭐ Multi-plateforme |
| **Configuration** | 0 min (automatique) | 30-60 min | 10-20 min |

---

## 🛠️ **Dépannage**

### **Vagrant : Erreur "VT-x is not available"**

```powershell
# Activer la virtualisation dans le BIOS
# Redémarrer → F2/DEL → Advanced → CPU Configuration → Intel VT-x (ou AMD-V) → Enabled
```

### **Hyper-V : "Cannot create virtual machine"**

```powershell
# Vérifier que Hyper-V est bien activé
Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V

# Réinstaller si nécessaire
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All
```

### **VM très lente**

```powershell
# Allouer plus de mémoire (Vagrant)
# Éditer Vagrantfile, ligne: vb.memory = "8192"

# Allouer plus de mémoire (Hyper-V)
Set-VM -Name Maintrix-Server -MemoryStartupBytes 8GB
```

### **Port 5000 déjà utilisé**

```powershell
# Trouver le processus utilisant le port
netstat -ano | findstr :5000

# Tuer le processus
taskkill /PID <PID> /F

# Ou changer le port dans .env
# PORT=5001
```

### **Base de données ne démarre pas**

```powershell
# Dans la VM, vérifier PostgreSQL
Get-Service -Name postgresql*

# Redémarrer PostgreSQL
Restart-Service postgresql-x64-15
```

---

## 📈 **Optimisations Performance**

### **VirtualBox**

```powershell
# Allouer plus de CPU (2 → 4)
VBoxManage modifyvm "Maintrix-Windows-VM" --cpus 4

# Activer PAE/NX
VBoxManage modifyvm "Maintrix-Windows-VM" --pae on

# Augmenter VRAM (128 → 256 MB)
VBoxManage modifyvm "Maintrix-Windows-VM" --vram 256
```

### **Hyper-V**

```powershell
# Activer Dynamic Memory
Set-VM -Name Maintrix-Server -DynamicMemory -MemoryMinimumBytes 2GB -MemoryMaximumBytes 8GB

# Augmenter CPUs virtuels
Set-VM -Name Maintrix-Server -ProcessorCount 4

# Activer extensions de virtualisation (nested virtualization)
Set-VMProcessor -VMName Maintrix-Server -ExposeVirtualizationExtensions $true
```

---

## 🔄 **Sauvegarde et Restauration**

### **Vagrant (VirtualBox)**

```powershell
# Créer un snapshot
vagrant snapshot save "maintrix-backup-$(Get-Date -Format 'yyyy-MM-dd')"

# Lister les snapshots
vagrant snapshot list

# Restaurer un snapshot
vagrant snapshot restore "maintrix-backup-2025-01-31"
```

### **Hyper-V**

```powershell
# Créer checkpoint
Checkpoint-VM -Name Maintrix-Server -SnapshotName "Backup-Production"

# Exporter VM complète (pour migration)
Export-VM -Name Maintrix-Server -Path "D:\Backups\VM\"

# Importer VM
Import-VM -Path "D:\Backups\VM\Maintrix-Server\Virtual Machines\*.vmcx"
```

---

## 🚀 **Production Readiness**

### **Checklist Déploiement Production**

- [ ] Désactiver mode développement (`NODE_ENV=production`)
- [ ] Changer mot de passe admin par défaut
- [ ] Configurer SSL/TLS (certificat)
- [ ] Activer firewall VM (ports 5000, 5432)
- [ ] Planifier sauvegardes automatiques
- [ ] Configurer monitoring (logs, CPU, RAM)
- [ ] Tester plan de reprise après sinistre
- [ ] Documenter procédures de mise à jour

---

## 📞 **Support**

**Questions VM Maintrix ?**

- 📧 Email : support@maintrix-t.com
- 📚 Documentation : https://maintrix-t.com/docs
- 💬 Forum : https://community.maintrix-t.com

---

**✅ Votre VM Maintrix est prête pour la production !**

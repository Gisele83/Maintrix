# 📱 Smart GMAO DiagFix - Application Mobile

## Guide Utilisateur Application Mobile

**Version:** 1.0  
**Date:** Janvier 2025  
**Plateforme:** React Native (iOS/Android)

---

## 🎯 Vue d'Ensemble

L'application mobile Smart GMAO DiagFix vous permet d'accéder à toutes les fonctionnalités de la plateforme directement depuis votre smartphone ou tablette, même en mode hors ligne.

### Fonctionnalités Principales
- **Smart Diagnostic IA** : Assistant diagnostic intelligent
- **Smart GMAO Mobile** : Gestion maintenance simplifiée
- **IoT Monitoring** : Surveillance capteurs temps réel
- **Mode Hors Ligne** : Fonctionnement sans connexion
- **Synchronisation Auto** : Sync données cloud automatique

---

## 📲 Installation et Configuration

### Prérequis
- iOS 12.0+ ou Android 8.0+
- 2GB RAM minimum
- 500MB espace libre
- Connexion internet (pour sync)

### Installation
1. Télécharger depuis App Store/Google Play
2. Ouvrir l'application
3. Créer compte ou se connecter
4. Autoriser permissions (camera, stockage)
5. Configuration synchronisation

### Première Utilisation
- **Connexion** : Même identifiants que version web
- **Sync Initiale** : Téléchargement données essentielles
- **Mode Hors Ligne** : Configuration stockage local
- **Notifications** : Autorisation alertes push

---

## 🧠 Smart Diagnostic Mobile

### Interface Diagnostic
```
┌─────────────────────────────┐
│     Smart Diagnostic IA     │
├─────────────────────────────┤
│ 📷 Scanner QR Code          │
│ 🔧 Sélection Équipement     │
│ ⚙️  Type et Zone            │
│ 📝 Symptômes Détectés       │
│ 🤖 Mode ML (Standard/Avancé/│
│    Ensemble ML)             │
│ 📊 Résultats IA             │
│ 📋 Onglets : Diagnostic,    │
│    Réparation, Historique,  │
│    Rapports                 │
└─────────────────────────────┘
```

### Utilisation Diagnostic
1. **Scanner QR Code** : Identification équipement automatique
2. **Saisie Manuelle** : Si pas de QR code disponible
3. **Sélection Symptômes** : Liste adaptée par équipement
4. **Analyse IA** : Traitement local + cloud
5. **Résultats** : Suggestions avec confiance
6. **Procédures Réparation** : Guide étape par étape

### Modes IA Disponibles
- **Standard ML** : Diagnostic rapide avec forêts aléatoires (offline)
- **Avancé ML** : Réseaux neurones et SVM (online)
- **Ensemble ML** : Consensus de 9 algorithmes pour précision maximale (online)

### Navigation Interface Dédiée
- **Page Smart Diagnostic** : Interface dédiée accessible via bouton principal
- **Onglet Diagnostic** : Formulaire ML avec sélection mode
- **Onglet Réparation** : Procédures guidées étape par étape
- **Onglet Historique** : Historique complet des diagnostics
- **Onglet Rapports** : Export et analytics des interventions

---

## 🔧 Smart GMAO Mobile

### Dashboard GMAO
```
┌─────────────────────────────┐
│      Smart GMAO Mobile      │
├─────────────────────────────┤
│ 📊 Vue d'Ensemble           │
│   • 12 Équipements ✅       │
│   • 3 OT En Cours ⏳       │
│   • 1 Urgence ⚠️           │
├─────────────────────────────┤
│ 🏭 Équipements              │
│ 📋 Ordres de Travail        │
│ 📈 Santé Équipements        │
└─────────────────────────────┘
```

### Gestion Équipements
- **Liste Équipements** : Vue complète avec statuts
- **Détails Équipement** : Spécifications et historique
- **Santé Équipements** : Score et tendances
- **QR Code** : Génération pour identification

### Ordres de Travail
- **Création OT** : Formulaire simplifié mobile
- **Attribution** : Assignment techniciens
- **Suivi Statut** : Temps réel avec notifications
- **Validation** : Workflow multi-niveaux mobile

---

## 📱 IoT Monitoring Mobile

### Surveillance Temps Réel
```
┌─────────────────────────────┐
│     IoT Monitoring Live     │
├─────────────────────────────┤
│ 🌡️  Température: 72°C  ✅   │
│ 📳 Vibration: 3.2mm/s  ✅   │
│ 💧 Pression: 4.1bar    ⚠️   │
│ ⚡ Courant: 12.5A      ✅   │
├─────────────────────────────┤
│ 📊 Graphiques Tendances     │
│ 🚨 Alertes Actives          │
│ ⚙️  Configuration Seuils    │
└─────────────────────────────┘
```

### Capteurs Supportés
- **Température** : Seuils configurables
- **Vibration** : Analyse spectrale
- **Pression** : Fluides et gaz
- **Débit** : Liquides et air
- **Courant/Tension** : Électrique
- **Humidité** : Environnement

### Alertes Mobiles
- **Push Notifications** : Alertes temps réel
- **Niveaux Sévérité** : Info, Warning, Critical
- **Historique Alertes** : 30 derniers jours
- **Actions Rapides** : Créer OT depuis alerte

---

## 💾 Mode Hors Ligne

### Fonctionnalités Offline
- **Diagnostic IA** : Mode Standard disponible
- **Consultation Données** : Cache local 7 jours
- **Création OT** : Sauvegarde en attente sync
- **Historique** : Accès données récentes
- **Procédures** : Guides réparation offline

### Synchronisation
- **Auto-Sync** : Toutes les 15 minutes (wifi)
- **Manuel** : Bouton refresh
- **Conflit Resolution** : Priorité données serveur
- **Indicateur Status** : Icône sync temps réel

### Gestion Stockage
```
┌─────────────────────────────┐
│      Gestion Stockage       │
├─────────────────────────────┤
│ 📊 Utilisé: 245MB/500MB     │
│ 📱 App: 85MB                │
│ 💾 Cache: 160MB             │
│ 🗃️  Données: 45MB           │
├─────────────────────────────┤
│ 🗑️  Nettoyer Cache          │
│ ⬇️  Sync Complète           │
│ ⚙️  Paramètres Offline      │
└─────────────────────────────┘
```

---

## 🔒 Sécurité Mobile

### Authentification
- **Biométrique** : Touch ID / Face ID
- **PIN Code** : Code 6 chiffres
- **Session** : Expiration auto 4h
- **2FA** : Authentification deux facteurs

### Protection Données
- **Chiffrement** : AES-256 local
- **Transmission** : HTTPS/TLS 1.3
- **Cache Sécurisé** : Données sensibles chiffrées
- **Remote Wipe** : Effacement à distance

---

## 📊 Analytics Mobile

### Métriques Utilisateur
- **Diagnostics Effectués** : Compteur mensuel
- **Précision IA** : Score feedback utilisateur
- **Temps Réponse** : Performance diagnostics
- **OT Complétés** : Productivité technicien

### Statistiques Équipements
- **Santé Globale** : Score moyen parc
- **Alertes Résolues** : Efficacité maintenance
- **MTBF/MTTR** : Indicateurs fiabilité
- **Coûts Maintenance** : Suivi budgets

---

## 🎮 Gamification Mobile

### Système Points
- **Diagnostic Précis** : +10 XP
- **OT Terminé** : +25 XP
- **Alerte Résolue** : +15 XP
- **Formation Complétée** : +50 XP

### Achievements Mobiles
- 🏆 **Diagnostic Expert** : 100 diagnostics précis
- 🔧 **Réparateur Pro** : 50 OT complétés
- ⚡ **Réactif** : 10 alertes résolues <1h
- 📱 **Mobile Master** : 30 jours consécutifs

### Classement
- **Équipe Local** : Classement site
- **Global** : Tous utilisateurs
- **Spécialités** : Par compétence technique
- **Progression** : Evolution mensuelle

---

## 🔧 Configuration Avancée

### Paramètres Application
```
┌─────────────────────────────┐
│        Paramètres           │
├─────────────────────────────┤
│ 🔔 Notifications            │
│   • Alertes IoT: ✅         │
│   • Nouveaux OT: ✅         │
│   • Sync Status: ❌         │
├─────────────────────────────┤
│ 💾 Stockage                 │
│   • Cache: 7 jours          │
│   • Photos: 30 jours        │
│   • Logs: 3 jours           │
├─────────────────────────────┤
│ 🔒 Sécurité                 │
│   • Biométrique: ✅         │
│   • Auto-lock: 15min        │
│   • 2FA: ✅                 │
└─────────────────────────────┘
```

### Intégrations
- **Caméra** : QR codes et photos
- **GPS** : Géolocalisation équipements
- **Bluetooth** : Capteurs BLE
- **NFC** : Tags équipements

---

## 🆘 Support et Dépannage

### Problèmes Courants

**Sync Échoue**
- Vérifier connexion internet
- Redémarrer application
- Vider cache si nécessaire

**Mode Offline Indisponible**
- Effectuer sync complète une fois
- Vérifier espace stockage libre
- Réinstaller si problème persiste

**Notifications Manquées**
- Autoriser notifications dans système
- Vérifier paramètres application
- Redémarrer si nécessaire

### Support Technique
- **Chat Intégré** : Assistant IA 24/7
- **Email** : support@smartgmaodiagfix.com
- **Documentation** : Centre d'aide intégré
- **Formations** : Modules interactifs

---

## 📈 Évolutions Futures

### Roadmap Mobile
- **Réalité Augmentée** : Superposition données
- **Voice Commands** : Commandes vocales
- **Smartwatch** : Extension Apple Watch/Wear OS
- **API Tiers** : Intégrations ERP mobiles

---

*Guide mis à jour - Janvier 2025*  
*Smart GMAO DiagFix Mobile v1.0*
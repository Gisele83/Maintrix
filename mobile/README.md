# Maintrix Mobile

Application mobile React Native complète pour techniciens de maintenance industrielle, optimisée pour le travail en conditions terrain avec capacités hors ligne.

## Fonctionnalités Principales

### 🏠 Tableau de Bord
- Vue d'ensemble des interventions en cours et terminées
- Statistiques en temps réel (tâches en attente, urgentes, complétées)
- Statut de connexion et synchronisation
- Actions rapides vers diagnostic, scanner QR, interventions
- Téléchargement de données hors ligne

### 🧠 Diagnostic Intelligent
- Interface guidée en 4 étapes (équipement → symptômes → confirmation → résultats)
- Support de 6 types d'équipements industriels (moteurs, pompes, compresseurs, grues, transformateurs, convoyeurs)
- Diagnostic en mode connecté (IA avancée) et hors ligne (base locale)
- Sélection de symptômes prédéfinis + symptômes personnalisés
- Niveaux d'urgence configurables
- Résultats avec niveau de confiance et temps estimé

### 📱 Scanner QR Code
- Scan de codes QR d'équipements avec interface camera native
- Saisie manuelle d'ID équipement en fallback
- Identification automatique d'équipements depuis base locale/serveur
- Création d'entrées pour nouveaux équipements
- Navigation directe vers diagnostic et détails équipement

### 🔧 Guide de Réparation
- Procédures pas-à-pas avec indicateur de progression
- Instructions détaillées avec avertissements sécurité
- Outils requis et temps estimé par étape
- Suivi de complétion par étape
- Navigation visuelle avec indicateurs d'état
- Finalisation automatique d'intervention

### 📋 Gestion des Interventions
- Liste des interventions avec filtres (statut, priorité, équipement)
- Recherche textuelle dans titre/description/équipement
- Statuts : en attente, en cours, terminé, annulé
- Niveaux de priorité avec codes couleur
- Actions directes : commencer, terminer, diagnostiquer
- Informations détaillées (technicien, dates, notes)

### ⚙️ Détails Équipement
- Profil complet avec spécifications techniques
- Historique de maintenance avec timeline
- Statut opérationnel en temps réel
- Actions rapides vers diagnostic et création d'intervention
- Informations fabricant, modèle, numéro série
- Heures de fonctionnement et dates d'installation

### 💾 Gestion Données Hors Ligne
- Base de données SQLite locale complète
- Synchronisation bidirectionnelle automatique/manuelle
- Compteurs de données par catégorie
- Téléchargement de données serveur pour mode hors ligne
- Gestion du cache et nettoyage des données
- Statut de connexion en temps réel

### ⚙️ Paramètres
- Profile utilisateur avec rôle et département
- Notifications push configurables (sons, vibrations)
- Modes synchronisation (automatique, manuel, hors ligne)
- Informations application et serveur
- Actions maintenance (cache, support, déconnexion)
- Interface future mode sombre

## Architecture Technique

### Structure Providers
- **AuthProvider**: Authentification utilisateur et gestion session
- **DatabaseProvider**: Base SQLite locale et initialisation tables
- **OfflineProvider**: Synchronisation, connexion réseau, données hors ligne

### Base de Données Locale (SQLite)
```sql
-- Tables principales
maintenance_cases       -- Cas de maintenance historiques
repair_procedures      -- Procédures de réparation détaillées
equipment             -- Registre équipements
work_orders          -- Interventions et ordres de travail
diagnostic_sessions   -- Sessions diagnostic réalisées
```

### Navigation
- Stack Navigator principal avec écrans authentifiés
- Tab Navigator pour navigation principale (Home, Diagnostic, Scanner, Interventions, Paramètres)
- Écrans modaux pour détails équipement et données hors ligne

### Thème et UI
- React Native Paper pour composants Material Design
- Thème cohérent avec couleurs Maintrix
- Icônes Material Community pour consistance visuelle
- Support responsive pour différentes tailles écran

## Installation et Déploiement

### Prérequis
```bash
# React Native CLI
npm install -g @react-native-community/cli

# Dépendances iOS (macOS uniquement)
cd ios && pod install
```

### Développement
```bash
# Installer dépendances
npm install

# Lancer Metro bundler
npm start

# Android
npm run android

# iOS 
npm run ios
```

### Configuration
- Configurer URL serveur dans `.env`
- Paramétrer permissions caméra (AndroidManifest.xml / Info.plist)
- Configurer certificats push notifications si nécessaire

## Utilisation Terrain

### Mode Hors Ligne
1. **Téléchargement initial** : Connecté à WiFi, télécharger base de données complète
2. **Travail terrain** : Diagnostic et interventions fonctionnent sans connexion
3. **Synchronisation** : De retour connecté, synchroniser automatiquement modifications

### Workflow Technicien
1. Scanner QR code équipement ou saisir ID manuel
2. Lancer diagnostic guidé avec symptômes observés
3. Suivre guide réparation étape par étape
4. Marquer intervention comme terminée
5. Synchroniser données en fin de journée

### Cas d'Usage Typiques
- **Maintenance préventive** : Planning interventions, suivi procédures
- **Maintenance corrective** : Diagnostic panne, réparation guidée
- **Inspection ronde** : Scanner équipements, saisir observations
- **Formation** : Guides détaillés pour nouveaux techniciens

## Intégration Serveur

### APIs Utilisées
```typescript
GET /api/equipment/:id          // Détails équipement
POST /api/diagnostic           // Diagnostic IA
GET /api/maintenance-cases     // Cas historiques
POST /api/work-orders         // Création intervention
PUT /api/work-orders/:id      // Mise à jour statut
GET /api/repair-procedures    // Procédures réparation
```

### Synchronisation
- **Upload** : Interventions créées, diagnostics réalisés, modifications équipements
- **Download** : Nouveaux cas maintenance, procédures mises à jour, données équipements
- **Conflit** : Résolution automatique avec préférence données serveur

Cette application mobile transforme l'approche maintenance industrielle en fournissant aux techniciens terrain tous les outils nécessaires dans une interface intuitive, même sans connexion internet.
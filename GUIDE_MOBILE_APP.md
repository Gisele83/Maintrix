# Guide Complet - Application Mobile Smart GMAO DiagFix

## Vue d'Ensemble

L'application mobile Smart GMAO DiagFix est une solution complète développée en React Native pour les techniciens de maintenance industrielle travaillant en conditions terrain. Elle offre des capacités hors ligne robustes et une synchronisation intelligente avec le système principal.

## Architecture Complète

### 🏗️ Structure du Projet
```
mobile/
├── App.tsx                 # Point d'entrée principal
├── src/
│   ├── components/         # Composants réutilisables
│   ├── navigation/         # Configuration navigation
│   ├── providers/          # Contextes React (Auth, Database, Offline)
│   ├── screens/           # Écrans applicatifs complets
│   ├── utils/             # Utilitaires et helpers
│   └── types/             # Types TypeScript
└── README.md              # Documentation technique
```

### 🔧 Technologies Utilisées
- **React Native** : Framework mobile multiplateforme
- **React Native Paper** : Composants Material Design
- **SQLite** : Base de données locale hors ligne
- **AsyncStorage** : Stockage persistant configuration
- **React Navigation** : Navigation entre écrans
- **TypeScript** : Typage statique et sécurité code

## Fonctionnalités Détaillées

### 🏠 Écran d'Accueil (HomeScreen)
**Fichier**: `mobile/src/screens/HomeScreen.tsx`

**Fonctionnalités** :
- Tableau de bord personnalisé avec nom utilisateur et date
- Statut connexion temps réel (en ligne/hors ligne)
- Statistiques opérationnelles :
  - Interventions en attente
  - Tâches terminées aujourd'hui  
  - Cas urgents
- Actions rapides (4 boutons principaux) :
  - Nouveau Diagnostic → NavigationDiagnostic
  - Scanner QR → Navigation Scanner
  - Interventions → Navigation WorkOrders
  - Guide Réparation → Navigation Repairs
- Notification synchronisation avec compteur éléments en attente
- Téléchargement données hors ligne quand connecté
- FAB (bouton flottant) pour diagnostic rapide

### 🧠 Diagnostic Intelligent (DiagnosticScreen)
**Fichier**: `mobile/src/screens/DiagnosticScreen.tsx`

**Processus en 4 Étapes** :

1. **Sélection Équipement**
   - 6 types prédéfinis : moteur, pompe, compresseur, grue, transformateur, convoyeur
   - Interface en grille avec icônes spécialisées
   - Validation sélection avant passage étape suivante

2. **Identification Symptômes**
   - Symptômes prédéfinis par type d'équipement
   - Sélection multiple via puces (chips) interactives
   - Champ texte libre pour symptômes personnalisés
   - Niveaux urgence : Faible, Moyen, Élevé

3. **Confirmation et Résumé**
   - Récapitulatif complet sélections
   - Indication mode diagnostic (en ligne IA avancée / hors ligne base locale)
   - Validation finale avant analyse

4. **Résultats et Actions**
   - Jusqu'à 3 diagnostics classés par confiance
   - Pourcentage confiance avec code couleur
   - Solution détaillée et temps estimé réparation
   - Bouton "Guide de réparation" → Navigation RepairSteps
   - Sauvegarde session diagnostic en base locale

**Intelligence Diagnostique** :
- **Mode En Ligne** : Appel API serveur pour diagnostic IA avancé
- **Mode Hors Ligne** : Recherche base SQLite locale avec correspondance symptômes
- **Fallback** : Si échec en ligne, basculement automatique hors ligne
- **Historique** : Sauvegarde toutes sessions pour apprentissage

### 📱 Scanner QR (EquipmentScannerScreen)
**Fichier**: `mobile/src/screens/EquipmentScannerScreen.tsx`

**Fonctionnalités Scanner** :
- Interface caméra native avec overlay de visée
- Coins de cadrage visuels pour guidage utilisateur
- Permissions caméra avec gestion erreurs élégante
- Instructions claires affichage permanent

**Traitement Codes QR** :
1. **Recherche Locale** : Base SQLite en priorité
2. **Recherche Serveur** : Si non trouvé localement et connecté
3. **Création Manuelle** : Option création équipement si non trouvé
4. **Saisie Manuelle** : FAB pour saisie ID équipement direct

**Affichage Résultats** :
- Carte détaillée équipement trouvé
- Informations : nom, type, emplacement, statut
- Dates maintenance (dernière/prochaine)
- Actions directes : Diagnostiquer, Voir Détails
- Bouton retour scan pour équipement suivant

### 🔧 Guide Réparation (RepairStepsScreen)
**Fichier**: `mobile/src/screens/RepairStepsScreen.tsx`

**Système de Progression** :
- Indicateur visuel progression horizontal (StepIndicator)
- Navigation libre entre étapes complétées
- Barre progression globale avec pourcentage
- Estimation temps total et temps par étape

**Étapes de Réparation** :
1. **Préparation Sécurité** : Consignation, EPI, vérifications
2. **Diagnostic Visuel** : Inspection, photos, observation
3. **Mesures et Tests** : Relevés instruments, paramètres critiques
4. **Intervention Corrective** : Application solution diagnostique
5. **Tests Fonctionnement** : Validation réparation, contrôles
6. **Finalisation** : Documentation, nettoyage, registres

**Contenu Étapes** :
- **Titre et Description** : Instructions détaillées
- **Avertissements Sécurité** : Encadrés colorés prioritaires
- **Outils Requis** : Liste équipements nécessaires
- **Temps Estimé** : Durée prévue par étape
- **Checkbox Complétion** : Marquage étape terminée
- **Données Base** : Chargement procédures depuis SQLite ou génération générique

### 📋 Gestion Interventions (WorkOrdersScreen)
**Fichier**: `mobile/src/screens/WorkOrdersScreen.tsx`

**Interface Liste** :
- Barre recherche textuelle (titre, description, équipement)
- Filtres par puces : Toutes, En Attente, En Cours, Terminées, Urgentes
- Actualisation par glissement (pull-to-refresh)
- Compteurs dynamiques par filtre

**Cartes Interventions** :
- **En-tête** : Titre + statut avec code couleur
- **Métadonnées** :
  - Priorité avec icône et couleur
  - ID équipement si associé
  - Date création et planification
  - Technicien assigné
- **Actions Contextuelles** :
  - En attente → Bouton "Commencer"
  - En cours → Bouton "Terminer"  
  - Toutes → Bouton "Diagnostiquer"
- **Indicateur Sync** : Icône si non synchronisé

### ⚙️ Détails Équipement (EquipmentDetailsScreen)
**Fichier**: `mobile/src/screens/EquipmentDetailsScreen.tsx`

**Sections Informations** :

1. **En-tête Équipement**
   - Nom, type, ID avec icône spécialisée
   - Puce statut avec code couleur
   - Actions rapides : Diagnostiquer, Créer Intervention

2. **Informations Générales**
   - Emplacement avec icône géolocalisation
   - Dates maintenance (dernière/prochaine)
   - Icônes contextuelles par information

3. **Spécifications Techniques** (si disponibles)
   - Fabricant, modèle, numéro série
   - Date installation, heures fonctionnement
   - Présentation tableau structuré

4. **Historique Maintenance**
   - Timeline chronologique interventions
   - Type intervention, description, technicien
   - Statut et date avec codes couleur
   - Message si historique vide

### 💾 Données Hors Ligne (OfflineDataScreen)
**Fichier**: `mobile/src/screens/OfflineDataScreen.tsx`

**Statut Connexion** :
- Carte état connexion avec couleur contextuelle
- Informations mode fonctionnement (en ligne/hors ligne)
- Disponibilité synchronisation

**Synchronisation** :
- Compteur éléments en attente sync
- Date dernière synchronisation
- Bouton synchronisation avec validation connexion
- Barre progression pendant opérations

**Inventaire Données** :
- Compteurs par catégorie :
  - Cas de maintenance
  - Procédures de réparation  
  - Équipements enregistrés
  - Interventions locales
  - Sessions diagnostic
- Descriptions fonctionnelles par catégorie

**Actions Gestion** :
- Téléchargement dernières données serveur
- Actualisation statistiques locales
- Effacement données locales (avec confirmation)
- Informations pédagogiques utilisation hors ligne

### ⚙️ Paramètres (SettingsScreen)
**Fichier**: `mobile/src/screens/SettingsScreen.tsx`

**Profil Utilisateur** :
- Avatar coloré avec initiales
- Nom, email, rôle (technicien/utilisateur)
- Département d'affectation

**Sections Configuration** :

1. **Notifications**
   - Push notifications (on/off)
   - Sons de notification
   - Vibrations pour alertes

2. **Synchronisation**
   - Mode hors ligne exclusif
   - Synchronisation automatique quand connecté

3. **Interface**
   - Mode sombre (préparé pour future implémentation)

**Informations Application** :
- Version application avec numéro build
- Version serveur API
- Version base données SQLite

**Actions Utilisateur** :
- Contact support avec email prédéfini
- Effacement cache avec confirmation
- À propos application
- Déconnexion avec confirmation sécurisée

## Providers et Architecture

### 🔐 AuthProvider
**Fichier**: `mobile/src/providers/AuthProvider.tsx`

Gestion authentification centralisée avec :
- État utilisateur connecté (nom, email, rôle, département)
- Fonctions login/logout avec gestion erreurs
- Persistance session avec AsyncStorage
- Contexte accessible globalement

### 💾 DatabaseProvider  
**Fichier**: `mobile/src/providers/DatabaseProvider.tsx`

Gestionnaire base SQLite avec :
- Initialisation automatique base et tables
- Schéma complet tables métier
- État connexion base (isReady)
- Transactions sécurisées et gestion erreurs

**Tables Créées** :
```sql
maintenance_cases    -- Cas historiques avec confiance
repair_procedures   -- Procédures détaillées par cas
equipment          -- Registre équipements avec QR
work_orders       -- Interventions avec sync status
diagnostic_sessions -- Sessions utilisateur
```

### 🌐 OfflineProvider
**Fichier**: `mobile/src/providers/OfflineProvider.tsx`

Synchronisation et mode hors ligne :
- Surveillance connexion réseau
- Compteur éléments en attente synchronisation  
- Fonctions sync bidirectionnelle (upload/download)
- Gestion cache et données locales
- Simulation connexion pour démo (en attendant NetInfo)

## Navigation et UX

### 📱 Structure Navigation
**Fichier**: `mobile/src/navigation/AppNavigator.tsx`

- **Stack Navigator** principal avec écrans authentifiés
- **Bottom Tab Navigator** pour navigation principale
- Icônes Material Community cohérentes
- Gestion état authentication pour accès écrans

**Écrans Navigation** :
- Home (Accueil)
- Diagnostic (Module IA)
- Scanner (QR Code)
- WorkOrders (Interventions)  
- Settings (Paramètres)

**Écrans Modaux** :
- RepairSteps (Guide réparation)
- EquipmentDetails (Détails équipement)
- OfflineData (Gestion données)

### 🎨 Design System

**Couleurs Principales** :
- Primary : Bleu Smart GMAO (#2563eb)
- Secondary : Violet complémentaire
- Success : Vert validation (#16a34a)
- Warning : Orange attention (#d97706)
- Error : Rouge critique (#dc2626)

**Composants Standard** :
- Cards avec élévation et coins arrondis
- Buttons avec modes contained/outlined/text
- Chips pour filtres et statuts
- FAB pour actions principales
- Progress indicators pour chargements

## Intégration Backend

### 🔌 APIs Principales
```typescript
// Diagnostic IA
POST /api/diagnostic
Body: { equipmentType, symptoms, urgency }
Response: DiagnosticResult[]

// Équipement par QR
GET /api/equipment/qr/:qrCode
Response: Equipment | 404

// Données synchronisation
GET /api/mobile/sync-data
Response: { maintenanceCases, procedures, equipment }

// Upload modifications
POST /api/mobile/sync-upload  
Body: { workOrders, diagnosticSessions, modifications }
```

### 🔄 Stratégie Synchronisation

**Download (Serveur → Mobile)** :
- Cas maintenance mis à jour
- Nouvelles procédures réparation
- Équipements et spécifications
- Plannings maintenance

**Upload (Mobile → Serveur)** :
- Interventions créées/modifiées
- Sessions diagnostic réalisées
- Observations équipements
- Photos et commentaires

**Gestion Conflits** :
- Préférence données serveur
- Sauvegarde versions locales
- Log conflits pour analyse

## Déploiement et Distribution

### 📦 Build Production
```bash
# Android APK
cd android && ./gradlew assembleRelease

# iOS App Store
cd ios && xcodebuild -workspace SmartGMAO.xcworkspace -scheme SmartGMAO archive
```

### 🔧 Configuration Environnement
```javascript
// .env
API_BASE_URL=https://smartgmao.replit.app
ENABLE_OFFLINE_MODE=true
DEBUG_SYNC=false
```

### 📱 Distribution
- **Android** : Google Play Store ou APK direct
- **iOS** : Apple App Store ou TestFlight beta
- **Enterprise** : Distribution interne via MDM

## Cas d'Usage Métier

### 🏭 Maintenance Préventive
1. Technicien reçoit planning interventions
2. Se rend sur site, scanne QR équipement  
3. Suit procédure préventive étape par étape
4. Marque intervention terminée
5. Synchronise données en fin journée

### 🚨 Maintenance Corrective
1. Alerte panne équipement reçue
2. Diagnostic rapide sur site avec symptômes
3. IA propose solutions classées par confiance
4. Suit guide réparation détaillé
5. Valide réparation et saisit observations

### 👥 Formation Techniciens
1. Nouveaux techniciens utilisent guides détaillés
2. Procédures avec avertissements sécurité
3. Outils requis et temps estimés
4. Validation progression supervisée
5. Historique formations pour certification

Cette application mobile révolutionne l'approche maintenance industrielle en autonomisant les techniciens terrain avec tous les outils nécessaires, même sans connexion internet. L'intelligence artificielle couplée aux données hors ligne garantit une continuité opérationnelle optimale.
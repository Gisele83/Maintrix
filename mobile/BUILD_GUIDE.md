# Guide de Build et Distribution - Application Mobile Smart GMAO DiagFix

## Vue d'Ensemble

Ce guide détaille les étapes de build et distribution de l'application mobile Smart GMAO DiagFix pour Android et iOS, avec options de distribution gratuite et payante.

## 🛠️ Préparatifs Build

### Configuration Environnement
```bash
# Installer React Native CLI globalement
npm install -g @react-native-community/cli

# Vérifier installation
npx react-native doctor
```

### Variables d'Environnement
Créer `.env` dans le dossier mobile :
```bash
# Configuration serveur
API_BASE_URL=https://smartgmao-diagfix.replit.app
ENABLE_OFFLINE_MODE=true
DEBUG_LOGS=false

# Configuration build
APP_VERSION=1.0.0
BUILD_NUMBER=100
```

## 📱 Build Android (Gratuit)

### Préparation Keystore
```bash
# Générer keystore pour signature
cd android/app
keytool -genkeypair -v -storename smartgmao-release-key.keystore -alias smartgmao-key-alias -keyalg RSA -keysize 2048 -validity 10000

# Configurer gradle.properties
echo "MYAPP_RELEASE_STORE_FILE=smartgmao-release-key.keystore" >> ~/.gradle/gradle.properties
echo "MYAPP_RELEASE_KEY_ALIAS=smartgmao-key-alias" >> ~/.gradle/gradle.properties
echo "MYAPP_RELEASE_STORE_PASSWORD=****" >> ~/.gradle/gradle.properties
echo "MYAPP_RELEASE_KEY_PASSWORD=****" >> ~/.gradle/gradle.properties
```

### Build APK Production
```bash
# Build release APK
cd android
./gradlew assembleRelease

# APK généré dans :
# android/app/build/outputs/apk/release/app-release.apk
```

### Build AAB (Google Play Store)
```bash
# Build Android App Bundle
./gradlew bundleRelease

# AAB généré dans :
# android/app/build/outputs/bundle/release/app-release.aab
```

## 🍎 Build iOS (Nécessite macOS)

### Préparation Xcode
```bash
# Installer CocoaPods
sudo gem install cocoapods

# Installation dépendances iOS
cd ios
pod install --repo-update
```

### Build Archive
```bash
# Ouvrir workspace Xcode
open SmartGMAO.xcworkspace

# Dans Xcode :
# 1. Sélectionner schéma "SmartGMAO" 
# 2. Product > Archive
# 3. Organizer > Distribute App
```

## 📦 Options Distribution Gratuite

### 1. Distribution APK Direct (Android)
**Avantages** :
- Complètement gratuit
- Distribution immédiate
- Pas de validation store

**Méthodes** :
- Email/WeTransfer APK aux utilisateurs
- Hébergement sur site web (HTTPS requis)
- Distribution via QR code

**Instructions Installation** :
```
1. Activer "Sources inconnues" dans Paramètres Android
2. Télécharger APK depuis lien sécurisé
3. Installer en suivant instructions
```

### 2. Firebase App Distribution (Gratuit)
**Configuration** :
```bash
# Installer Firebase CLI
npm install -g firebase-tools

# Initialiser projet
firebase init

# Upload APK
firebase appdistribution:distribute app-release.apk \
  --app 1:123456789:android:abcd1234 \
  --groups "testers"
```

**Avantages** :
- Distribution contrôlée par groupes
- Notifications push installation
- Analytics basiques inclus
- Support Android et iOS

### 3. TestFlight (iOS - Gratuit)
**Prérequis** :
- Compte Apple Developer (99€/an)
- App Store Connect configuré

**Processus** :
1. Upload archive depuis Xcode
2. Configurer TestFlight dans App Store Connect
3. Inviter testeurs par email
4. Distribution automatique mises à jour

## 🏪 Distribution Stores (Payante)

### Google Play Store
**Coûts** :
- Inscription développeur : 25€ (une fois)
- Commission : 15% sur premiers 1M$ revenus annuels

**Processus** :
1. Créer compte Google Play Console
2. Upload AAB + métadonnées
3. Test interne/fermé/ouvert
4. Revue Google (24-48h)
5. Publication

### Apple App Store
**Coûts** :
- Compte Apple Developer : 99€/an
- Commission : 15% sur premiers 1M$ revenus annuels

**Processus** :
1. App Store Connect configuration
2. Upload via Xcode/Transporter
3. Métadonnées + captures écran
4. Soumission revue Apple (24-48h)
5. Publication

## 🎯 Stratégie Déploiement Recommandée

### Phase 1 : MVP Gratuit (Immédiat)
1. **Web App** : Déploiement Replit gratuit
2. **Mobile** : APK Android distribution directe
3. **iOS** : TestFlight pour utilisateurs clés

### Phase 2 : Validation Marché (1-3 mois)
1. **Android** : Publication Google Play Store
2. **iOS** : Publication App Store
3. **Web** : Migration vers plan payant si nécessaire

### Phase 3 : Commercialisation (3-6 mois)
1. **Freemium Model** : Version gratuite + premium
2. **Enterprise** : Distribution MDM pour grandes entreprises
3. **White Label** : Personnalisation clients spécifiques

## 📊 Métriques de Suivi Gratuites

### Analytics Recommandés
- **Google Analytics** : Gratuit jusqu'à 10M événements/mois
- **Firebase Analytics** : Gratuit et illimité
- **Mixpanel** : Gratuit jusqu'à 100K événements/mois

### Configuration Tracking
```javascript
// Dans App.tsx mobile
import analytics from '@react-native-firebase/analytics';

// Track écrans
analytics().logScreenView({
  screen_name: 'HomeScreen',
  screen_class: 'HomeScreen'
});

// Track actions utilisateur
analytics().logEvent('diagnostic_completed', {
  equipment_type: 'moteur',
  confidence_level: 85
});
```

## 🔒 Sécurité et Conformité

### Checklist Sécurité
- [ ] Certificats SSL/TLS activés
- [ ] API endpoints sécurisés (HTTPS uniquement)
- [ ] Chiffrement données sensibles
- [ ] Authentification forte
- [ ] Logs sécurisés (pas de données personnelles)

### Conformité RGPD
- [ ] Politique confidentialité intégrée
- [ ] Consentement cookies explicite
- [ ] Droit oubli implémenté
- [ ] Portabilité données assurée

## 💡 Optimisations Performance

### Bundle Size Réduction
```bash
# Analyser bundle Android
./gradlew analyzeReleaseBundle

# Optimisations recommandées :
# - ProGuard/R8 minification activée
# - Images optimisées (WebP)
# - Fonts systèmes privilégiées
# - Dead code elimination
```

### Optimisation iOS
```bash
# Dans Xcode Build Settings :
# - Enable Bitcode : YES
# - Optimization Level : Optimize for Speed [-O3]
# - Strip Debug Symbols : YES
```

Ce guide permet un déploiement progressif gratuit vers payant selon l'adoption utilisateurs.
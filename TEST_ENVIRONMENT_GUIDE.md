# Guide d'utilisation de l'environnement de test

## 🎯 Objectif
L'environnement de test Maintrix permet de tester toutes les fonctionnalités du système avec des données réalistes sans affecter les données de production.

## 🚀 Démarrage rapide

### 1. Configuration initiale
```bash
# Configuration de l'environnement de test avec données
./scripts/test-env-manager.sh setup
```

### 2. Démarrage de l'application
```bash
# Démarre l'application en mode test
./scripts/test-env-manager.sh start
```

### 3. Connexion
Utilisez un des comptes de test suivants :
- **Admin** : `admin@test.smartgmao.com` / `Test123!`
- **Technicien** : `technicien@test.smartgmao.com` / `Test123!`
- **Responsable** : `responsable@test.smartgmao.com` / `Test123!`

## 📋 Commandes disponibles

```bash
# Voir l'aide complète
./scripts/test-env-manager.sh help

# Configuration de l'environnement
./scripts/test-env-manager.sh setup

# Démarrage en mode test
./scripts/test-env-manager.sh start

# Informations de l'environnement
./scripts/test-env-manager.sh info

# Nettoyage des données
./scripts/test-env-manager.sh clean

# Réinitialisation complète
./scripts/test-env-manager.sh reset
```

## 📊 Données de test générées

L'environnement de test comprend :

### 👥 Utilisateurs (6)
- **Admin** : Accès complet au système
- **Technicien** : Gestion des interventions et diagnostics
- **Responsable** : Supervision et rapports
- **Utilisateurs supplémentaires** : Pour tester les workflows

### 🏭 Équipements (20)
- Compresseurs Atlas Copco
- Pompes Grundfos
- Moteurs électriques Siemens
- Convoyeurs Rexnord
- Variateurs ABB
- Transformateurs Schneider
- Groupes électrogènes Caterpillar
- Climatisation Daikin

### 📋 Ordres de travail (40)
- Maintenance préventive
- Réparations urgentes
- Inspections réglementaires
- Mises à niveau

### 🔧 Pièces détachées (60)
- Filtres à air
- Courroies
- Roulements
- Joints toriques
- Contacteurs
- Fusibles
- Huile hydraulique
- Graisse

### 🔄 Plans de maintenance préventive
- Planifications automatiques par type d'équipement
- Fréquences variées (quotidienne, hebdomadaire, mensuelle)

### 🚨 Alertes et notifications
- Maintenance programmée
- Pannes équipement
- Seuils dépassés

### 🔍 Sessions de diagnostic
- Diagnostics automatiques
- Évaluation de confiance
- Recommandations d'intervention

### 📦 Mouvements de stock
- Entrées et sorties de stock
- Historique des mouvements
- Raisons des mouvements (achat, maintenance, retour)

## 🔧 Configuration technique

### Variables d'environnement de test
- **NODE_ENV** : `test`
- **Port** : `5001`
- **Base de données** : PostgreSQL (Neon)
- **Email** : `noreply@smartgmao.com`
- **Sécurité** : Salt rounds réduits (4) pour des tests plus rapides

### Identifiants uniques
Tous les identifiants incluent des timestamps pour éviter les conflits :
- Equipment IDs : `EQ[timestamp]_001`
- Part Numbers : `SP[timestamp]_0001`
- Work Orders : `WO[timestamp]1`

## 🎯 Cas d'usage de test

### Test des rôles utilisateur
1. Connectez-vous avec chaque type de compte
2. Vérifiez les permissions d'accès aux modules
3. Testez les workflows spécifiques à chaque rôle

### Test des fonctionnalités GMAO
1. **Gestion des équipements** : Ajout, modification, consultation
2. **Ordres de travail** : Création, assignation, suivi
3. **Maintenance préventive** : Planification, exécution
4. **Gestion des stocks** : Mouvements, inventaire

### Test du système de diagnostic
1. **Diagnostic standard** : Saisie de symptômes
2. **Diagnostic avancé** : IA et machine learning
3. **Génération de rapports** : PDF, analyses

## 🔄 Réinitialisation

Pour repartir avec des données fraîches :
```bash
./scripts/test-env-manager.sh reset
```

## ⚠️ Notes importantes

- L'environnement de test utilise une base de données séparée
- Les données générées sont fictives mais réalistes
- Les compteurs de maintenance sont temporairement désactivés en attendant la synchronisation complète de la base de données
- Chaque démarrage génère de nouveaux identifiants uniques

## 🆘 Dépannage

### Si l'environnement ne démarre pas :
1. Vérifiez la connexion à la base de données
2. Réinitialisez l'environnement : `./scripts/test-env-manager.sh reset`
3. Vérifiez les logs dans la console

### Si les données semblent incohérentes :
1. Nettoyez et reconfigurez : `./scripts/test-env-manager.sh reset`
2. Vérifiez que NODE_ENV=test est bien défini

## 📞 Support

Pour toute question technique sur l'environnement de test, consultez les logs du système ou relancez la configuration.
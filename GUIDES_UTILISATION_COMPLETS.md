# 🎯 Guides d'Utilisation Complets - Maintrix

## Guides Pratiques par Fonctionnalité

---

# 🧠 Guide Smart Diagnostic IA

## Accès à Smart Diagnostic

### Méthode 1: Bouton Principal Homepage
1. Connectez-vous à Maintrix
2. Sur la page d'accueil, cliquez sur **"Démarrer Diagnostic IA"**
3. Vous êtes redirigé vers `/smart-diagnostic`

### Méthode 2: Cartes Fonctionnalités
1. Faites défiler vers la section **"Fonctionnalités Maintrix"**
2. Localisez la carte **"Smart Diagnostic IA"**
3. Cliquez sur le bouton **"Accéder"**

### Méthode 3: Menu Navigation
1. Cliquez sur **"Smart Diagnostic"** dans la navigation
2. Sélectionnez **"Smart Diagnostic IA"** dans le dropdown

## Utilisation de l'Interface Smart Diagnostic

### Onglet Diagnostic

#### Étape 1: Sélection du Mode ML
```
○ Standard ML - Diagnostic rapide (forêts aléatoires)
○ Avancé ML - Analyse poussée (réseaux neurones + SVM)
○ Ensemble ML - Précision maximale (9 algorithmes)
```

**Recommandations :**
- **Standard ML** : Diagnostic routine, problèmes simples
- **Avancé ML** : Anomalies complexes, cas difficiles
- **Ensemble ML** : Diagnostics critiques, validation croisée

#### Étape 2: Informations Équipement
1. **Type d'équipement** : Sélectionnez dans la liste
   - Moteur électrique
   - Pompe hydraulique
   - Compresseur
   - Transformateur
   - Convertisseur électronique
   - Équipement portuaire
   - Etc.

2. **Zone/Secteur** : Localisez l'équipement
   - Production principale
   - Atelier mécanique
   - Salle électrique
   - Zone logistique
   - Etc.

3. **ID Équipement** : Référence unique (optionnel)

#### Étape 3: Sélection des Symptômes
**Symptômes organisés par catégories :**

**Mécaniques :**
- Vibrations anormales
- Bruits inhabituels
- Désalignement
- Usure prématurée

**Thermiques :**
- Surchauffe
- Température instable
- Refroidissement insuffisant

**Électriques :**
- Court-circuit
- Surintensité
- Chute tension
- Isolation défaillante

**Fluides :**
- Fuite hydraulique
- Pression anormale
- Débit réduit
- Contamination

**Performance :**
- Rendement dégradé
- Arrêt intempestif
- Démarrage difficile

#### Étape 4: Contexte et Urgence
1. **Niveau d'urgence** :
   - 🔴 Critique (arrêt production)
   - 🟡 Important (performance dégradée)
   - 🟢 Mineur (surveillance)

2. **Conditions d'utilisation** :
   - Charge de travail
   - Environnement
   - Historique récent

#### Étape 5: Lancement du Diagnostic
1. Cliquez sur **"Lancer le Diagnostic IA"**
2. Patientez pendant l'analyse (2-10 secondes selon mode)
3. Consultez les résultats détaillés

### Interprétation des Résultats

#### Scoring de Confiance
```
🟢 95-100% : Diagnostic très fiable
🟡 80-94%  : Diagnostic probable  
🟠 60-79%  : Diagnostic possible
🔴 <60%    : Analyse incertaine
```

#### Informations Fournies
- **Diagnostic Principal** : Cause la plus probable
- **Diagnostics Alternatifs** : Autres possibilités
- **Recommandations** : Actions immédiates
- **Pièces Suggérées** : Liste prévisions besoins
- **Coût Estimé** : Budget prévisionnel
- **Urgence Évaluée** : Priorité intervention

### Onglet Réparation

#### Procédures Guidées
1. **Visualisation étapes** : Instructions illustrées
2. **Consignes sécurité** : Précautions obligatoires
3. **Outils requis** : Liste équipements nécessaires
4. **Temps estimé** : Durée prévisionnelle
5. **Validation progression** : Confirmation chaque étape

#### Types de Procédures
- **Dépannage immédiat** : Actions urgentes
- **Réparation standard** : Intervention classique
- **Remplacement** : Changement composant
- **Révision complète** : Maintenance approfondie

### Onglet Historique

#### Navigation Historique
1. **Vue chronologique** : Tous diagnostics par date
2. **Filtres avancés** :
   - Par équipement
   - Par technicien
   - Par période
   - Par résultat
3. **Recherche sémantique** : Mots-clés intelligents
4. **Comparaison cas** : Analyses similaires

#### Export des Données
- **CSV** : Données brutes pour Excel
- **Excel** : Rapport formaté
- **PDF** : Document professionnel

### Onglet Rapports

#### Types de Rapports
1. **Rapport d'Intervention** : Document technique
2. **Analyse Tendances** : Évolution performance
3. **KPIs Diagnostic** : Métriques efficacité
4. **Rapport Coûts** : Analyse économique

---

# 🔧 Guide Smart GMAO

## Accès Dashboard GMAO

### Navigation
```
Menu Navigation → Smart GMAO → Dashboard GMAO
URL directe : /gmao
```

## Gestion des Équipements

### Création Nouvel Équipement
1. **Accès** : Dashboard GMAO → Gestion Équipements
2. **Bouton** : "Nouvel Équipement"
3. **Formulaire requis** :
   - ID Équipement (unique)
   - Nom équipement
   - Type et catégorie
   - Localisation (zone/secteur)
   - Date mise service
   - Spécifications techniques
   - Criticité (1-5)
   - Responsable assigné

### Consultation Fiche Équipement
1. **Recherche** : Nom ou ID équipement
2. **Sélection** dans liste
3. **Informations disponibles** :
   - Caractéristiques techniques
   - Historique maintenance
   - Documents attachés
   - État actuel et santé
   - Planning maintenance
   - Coûts cumulés

### Modification Équipement
1. **Sélection** équipement existant
2. **Bouton** "Modifier"
3. **Champs éditables** : Toutes données techniques
4. **Validation** : Sauvegarde automatique

## Ordres de Travail (OT)

### Création OT Manuel
1. **Accès** : Dashboard GMAO → Ordres de Travail
2. **Bouton** : "Nouvel Ordre de Travail"
3. **Informations requises** :
   - Équipement concerné
   - Type intervention
   - Description problème
   - Priorité (1-5)
   - Technicien assigné
   - Date planifiée
   - Durée estimée

### Création OT depuis Smart Diagnostic
1. **Diagnostic terminé** dans Smart Diagnostic
2. **Bouton** : "Créer Ordre de Travail"
3. **Conversion automatique** :
   - Équipement pré-rempli
   - Description du diagnostic
   - Procédures réparation attachées
   - Pièces suggérées
   - Priorité selon urgence IA

### Workflow Validation OT
```
Création → Chef Service → Chef Maintenance → Exécution
```

#### Niveau 1: Chef de Service
- **Validation technique** : Pertinence intervention
- **Ressources** : Disponibilité techniciens
- **Planning** : Créneaux possibles
- **Actions** : Approuver / Modifier / Rejeter

#### Niveau 2: Chef Maintenance
- **Validation finale** : Autorisation exécution
- **Budget** : Validation coûts
- **Ressources** : Attribution définitive
- **Planification** : Date/heure intervention

### Suivi Exécution OT
1. **État temps réel** : Statut progression
2. **Photos/Rapports** : Documentation terrain
3. **Consommation** : Pièces et temps
4. **Validation finale** : Clôture intervention

## Maintenance Préventive

### Configuration Planning
1. **Accès** : Dashboard GMAO → Maintenance Préventive
2. **Sélection équipement**
3. **Type planification** :
   - Calendaire (hebdo/mensuel/annuel)
   - Basée usage (heures/cycles/km)
   - Conditionnelle (état/IoT)

### Compteurs Automatiques
#### Configuration Seuils
1. **Heures fonctionnement** :
   - Seuil maintenance (ex: 500h)
   - Alerte anticipée (ex: 450h)
   - Reset automatique

2. **Cycles d'utilisation** :
   - Nombre cycles max (ex: 1000)
   - Comptage automatique
   - Projection usure

3. **Kilométrage** :
   - Distance parcourue
   - Maintenance périodique
   - Suivi véhicules/engins

#### Monitoring Temps Réel
- **Dashboard compteurs** : Vue globale
- **Alertes automatiques** : Seuils approchés
- **Projections** : Dates prévisionnelles
- **Optimisation** : Regroupement interventions

### Génération OT Préventifs
1. **Déclenchement automatique** : Seuil atteint
2. **Création OT** : Prérempli données équipement
3. **Procédures standard** : Templates maintenance
4. **Planning optimal** : Selon disponibilités

## Gestion Stocks

### Catalogue Pièces
1. **Accès** : Dashboard GMAO → Gestion Stocks
2. **Création nouvelle pièce** :
   - Référence (unique)
   - Désignation
   - Catégorie
   - Fournisseur(s)
   - Prix unitaire
   - Stock minimum
   - Localisation stockage

### Mouvements Stock
#### Entrées
- **Réception commande** : Augmentation stock
- **Retour pièce** : Pièce non utilisée
- **Ajustement inventaire** : Correction

#### Sorties
- **Consommation OT** : Utilisation intervention
- **Transfert atelier** : Déplacement interne
- **Mise rebut** : Pièce défectueuse

### Réapprovisionnement
1. **Alertes automatiques** : Stock minimum atteint
2. **Suggestions commande** : Quantités optimales
3. **Génération demande achat** : Workflow automatisé
4. **Suivi commandes** : État livraisons

---

# 📱 Guide IoT & Monitoring

## Configuration Capteurs

### Types Capteurs Supportés
1. **Température** : Sondes PT100, thermocouples
2. **Vibration** : Accéléromètres, capteurs vitesse
3. **Pression** : Manomètres électroniques
4. **Débit** : Débitmètres électromagnétiques
5. **Électriques** : Pinces ampères, voltmètres

### Installation Capteur
1. **Déclaration équipement** : Association capteur/machine
2. **Configuration technique** :
   - Type mesure
   - Unité
   - Plage mesure
   - Fréquence acquisition
3. **Seuils d'alerte** :
   - Valeur nominale
   - Seuil attention
   - Seuil critique
   - Seuil d'urgence

### Protocoles Communication
- **MQTT** : Capteurs IoT modernes
- **Modbus** : Équipements industriels
- **OPC-UA** : Systèmes automation
- **HTTP REST** : Intégrations custom

## Dashboard IoT

### Surveillance Temps Réel
1. **Accès** : Navigation → IoT & Monitoring
2. **Vue d'ensemble** :
   - Nombre capteurs actifs
   - Alertes en cours
   - Tendances générales
   - État réseau IoT

3. **Monitoring par équipement** :
   - Graphiques temps réel
   - Historique valeurs
   - Seuils visuels
   - Corrélations multi-capteurs

### Alertes Automatiques
#### Configuration Alertes
1. **Seuils personnalisés** : Par équipement
2. **Escalade** : Niveaux gravité
3. **Notifications** : Email, SMS, push
4. **Actions automatiques** : Création OT

#### Gestion Alertes
- **Accusé réception** : Prise en compte
- **Investigation** : Analyse cause
- **Action corrective** : Intervention
- **Clôture** : Résolution confirmée

## Gamification

### Système Points
1. **Actions récompensées** :
   - Diagnostic IA réussi : +10 points
   - OT terminé à temps : +15 points
   - Maintenance préventive : +20 points
   - Formation complétée : +25 points

2. **Niveaux progression** :
   - Apprenti (0-100 pts)
   - Technicien (101-500 pts)
   - Expert (501-1000 pts)
   - Maître (1000+ pts)

### Badges et Certifications
- **Spécialités équipement** : Moteurs, pompes, etc.
- **Compétences techniques** : Diagnostic, réparation
- **Performance** : Rapidité, qualité
- **Formation** : Modules complétés

---

# 🛡️ Guide Sécurité et Accès

## Gestion Utilisateurs

### Création Utilisateur
1. **Accès** : Navigation → Gestion & Sécurité
2. **Informations requises** :
   - Nom/Prénom
   - Email professionnel
   - Matricule/ID
   - Département
   - Rôle/Fonction
   - Niveau accès

### Rôles et Permissions
#### Technicien
- Smart Diagnostic : Lecture/Écriture
- OT assignés : Exécution
- Équipements : Consultation
- Stocks : Consultation

#### Chef d'Équipe
- Validation OT niveau 1
- Gestion équipe
- Reporting activité
- Planning maintenance

#### Chef Maintenance
- Validation OT niveau 2
- Gestion budget
- Analytics avancées
- Configuration système

#### Administrateur
- Gestion utilisateurs
- Configuration plateforme
- Accès toutes données
- Audit et sécurité

## Audit et Sécurité

### Dashboard Sécurité
1. **Accès** : Navigation → Sécurité
2. **Monitoring temps réel** :
   - Connexions actives
   - Tentatives intrusion
   - Actions sensibles
   - Performance système

### Logs et Traçabilité
- **Actions utilisateurs** : Horodatage complet
- **Modifications données** : Historique changements
- **Accès système** : Connexions/déconnexions
- **Alertes sécurité** : Incidents détectés

---

# 💳 Guide Gestion Commerciale

## Gestion Abonnements

### Plans Disponibles
1. **Freemium** (Gratuit)
   - 1 utilisateur
   - Diagnostic IA basique
   - 5 équipements max
   - Support communautaire

2. **Pro** (49€/mois)
   - 5 utilisateurs
   - Smart Diagnostic complet
   - GMAO basique
   - 50 équipements
   - Support email

3. **Business** (149€/mois)
   - 20 utilisateurs
   - GMAO complet
   - IoT monitoring
   - 200 équipements
   - Support téléphone

4. **Enterprise** (499€/mois)
   - Utilisateurs illimités
   - Toutes fonctionnalités
   - Intégrations ERP
   - Support premium
   - Formation on-site

### Essai Gratuit 14 Jours
1. **Activation automatique** : Nouveau compte
2. **Accès complet** : Toutes fonctionnalités
3. **Support inclus** : Assistance pendant essai
4. **Migration facile** : Vers plan payant

### Paiement et Facturation
1. **Méthodes acceptées** :
   - Cartes bancaires (Visa, MasterCard)
   - Virements bancaires
   - Prélèvements SEPA

2. **Facturation** :
   - Mensuelle ou annuelle
   - Remise 15% paiement annuel
   - Facturation HT entreprises
   - TVA applicable selon pays

---

# 📊 Guide Reporting et Analytics

## KPIs Maintenance

### Métriques Principales
1. **MTBF** (Mean Time Between Failures)
   - Calcul : Temps total / Nombre pannes
   - Objectif : Maximiser fiabilité
   - Suivi : Tendance amélioration

2. **MTTR** (Mean Time To Repair)
   - Calcul : Temps total réparation / Nombre interventions
   - Objectif : Minimiser durée arrêt
   - Facteurs : Compétence, pièces disponibles

3. **OEE** (Overall Equipment Effectiveness)
   - Calcul : Disponibilité × Performance × Qualité
   - Benchmark : >85% excellent
   - Axes amélioration identifiés

4. **Disponibilité**
   - Calcul : (Temps total - Temps arrêt) / Temps total
   - Objectif : >95% pour équipements critiques
   - Impact direct production

### Rapports Automatiques
#### Rapport Quotidien
- État alertes actives
- OT créés/clôturés
- Performance équipements critiques
- Résumé activité techniciens

#### Rapport Hebdomadaire
- Évolution KPIs
- Planning maintenance semaine
- Consommation stocks
- Performance équipes

#### Rapport Mensuel
- Analyse tendances
- Coûts maintenance
- ROI actions préventives
- Recommandations amélioration

### Export et Partage
1. **Formats disponibles** :
   - PDF : Rapports exécutifs
   - Excel : Données analysables
   - CSV : Import autres outils
   - JSON : Intégrations API

2. **Automatisation** :
   - Envoi email planifié
   - Dépôt FTP/cloud
   - Webhooks tiers
   - Dashboard temps réel

Ces guides d'utilisation permettent une maîtrise complète de Maintrix pour tous les rôles utilisateurs.
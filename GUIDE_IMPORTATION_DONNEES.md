# Guide d'Importation des Données Historiques - SMDiagFix

## Vue d'ensemble

Ce guide vous explique comment enrichir votre système SMDiagFix avec l'historique réel de maintenance de votre entreprise. L'importation de données historiques améliore considérablement la précision des diagnostics IA et personnalise le système selon votre contexte industriel spécifique.

## Avantages de l'importation de données réelles

✅ **Amélioration de la précision IA** : Plus de données = diagnostics plus précis  
✅ **Personnalisation industrielle** : Adaptation aux spécificités de vos équipements  
✅ **Historique complet** : Consolidation de toutes vos données maintenance  
✅ **Analyses prédictives** : Identification des patterns spécifiques à votre entreprise  

## Types de données supportées

### 1. Cas de Maintenance Historiques
- **Diagnostics résolus** : Problèmes identifiés et solutions appliquées
- **Durées d'intervention** : Temps réels de réparation
- **Coûts historiques** : Coûts réels des interventions
- **Efficacité techniciens** : Performance par technicien

### 2. Cas Signalés Non Résolus
- **Incidents en cours** : Problèmes actuellement en investigation
- **Problèmes récurrents** : Équipements nécessitant surveillance
- **Alertes préventives** : Signalements avant panne

## Format des données requis

### Fichier CSV - Cas de Maintenance

| Colonne | Description | Exemple | Obligatoire |
|---------|-------------|---------|-------------|
| Type d'équipement | Catégorie d'équipement | "moteur", "pompe", "convoyeur" | ✅ |
| ID Équipement | Identifiant unique | "MOT-001", "PUMP-A1" | ❌ |
| Zone | Zone géographique/fonctionnelle | "production", "maintenance" | ❌ |
| Secteur | Secteur d'activité | "ligne1", "atelier", "entrepôt" | ❌ |
| Symptômes | Description des symptômes | "Surchauffe anormale du moteur" | ✅ |
| Symptômes Cochés | Liste des symptômes (séparés par ;) | "surchauffe;vibrations;bruit" | ❌ |
| Diagnostic | Diagnostic final | "Problème de ventilation" | ✅ |
| Solution | Solution appliquée | "Nettoyer les ailettes de refroidissement" | ✅ |
| Durée (min) | Temps d'intervention en minutes | 90 | ❌ |
| Urgence | Niveau d'urgence | "low", "medium", "high" | ❌ |
| Niveau Risque | Évaluation du risque | "Faible", "Moyen", "Élevé" | ❌ |
| Coût Estimé | Coût de l'intervention | "150€" | ❌ |
| Date | Date de l'intervention | "2024-01-15" | ❌ |
| Technicien | Nom du technicien | "Jean Dupont" | ❌ |
| Notes | Commentaires additionnels | "Intervention en urgence" | ❌ |

### Fichier CSV - Cas Signalés

| Colonne | Description | Exemple | Obligatoire |
|---------|-------------|---------|-------------|
| Type d'équipement | Catégorie d'équipement | "pompe", "moteur" | ✅ |
| ID Équipement | Identifiant unique | "PUMP-A1" | ❌ |
| Zone | Zone géographique | "production" | ❌ |
| Secteur | Secteur d'activité | "ligne2" | ❌ |
| Description | Description du problème | "Bruit anormal et vibrations" | ✅ |
| Urgence | Niveau d'urgence | "medium" | ❌ |
| Signalé par | Nom du rapporteur | "Marie Martin" | ✅ |
| Date Signalé | Date du signalement | "2024-01-16" | ❌ |
| Statut | État actuel | "pending", "in_progress", "resolved" | ❌ |

## Processus d'importation étape par étape

### Étape 1 : Préparation des données

1. **Collecter vos données existantes** :
   - Système GMAO/CMMS existant
   - Fichiers Excel de maintenance
   - Bons de travail numérisés
   - Historiques de pannes

2. **Nettoyer et normaliser** :
   - Uniformiser les noms d'équipements
   - Standardiser les descriptions
   - Vérifier les dates et durées

### Étape 2 : Utilisation des templates

1. **Télécharger les templates** :
   - Accéder à l'onglet "Importation" dans SMDiagFix
   - Télécharger le template approprié
   - Ouvrir avec Excel ou LibreOffice

2. **Remplir le template** :
   - Une ligne = un cas de maintenance
   - Respecter le format des colonnes
   - Utiliser les valeurs suggérées pour l'urgence

### Étape 3 : Import dans le système

1. **Sauvegarder au format CSV** :
   - Format UTF-8 recommandé
   - Séparateur : virgule (,)
   - Guillemets pour les textes contenant des virgules

2. **Importer via l'interface** :
   - Glisser-déposer le fichier CSV
   - Ou utiliser le bouton "Sélectionner un fichier"
   - Vérifier les résultats d'importation

### Étape 4 : Validation et optimisation

1. **Vérifier l'importation** :
   - Consulter le rapport d'importation
   - Corriger les erreurs signalées
   - Re-importer les données corrigées

2. **Entraîner les modèles IA** :
   - Utiliser les boutons d'entraînement ML
   - Tester avec des cas similaires
   - Ajuster si nécessaire

## Bonnes pratiques

### Qualité des données

- **Descriptions précises** : Plus c'est détaillé, mieux c'est
- **Terminologie cohérente** : Utiliser les mêmes termes
- **Dates complètes** : Format YYYY-MM-DD recommandé
- **Durées réalistes** : Indiquer les temps réels, pas estimés

### Organisation

- **Traitement par lots** : Importer par périodes ou zones
- **Sauvegarde** : Garder une copie des fichiers originaux
- **Documentation** : Noter les choix de mapping effectués

### Sécurité

- **Données sensibles** : Anonymiser si nécessaire
- **Validation** : Tester avec un petit échantillon d'abord
- **Contrôle qualité** : Vérifier la cohérence après import

## Résolution des problèmes courants

### Erreurs de format

**Problème** : "Format de date invalide"
**Solution** : Utiliser le format YYYY-MM-DD (ex: 2024-01-15)

**Problème** : "Type d'équipement non reconnu"
**Solution** : Utiliser des termes standards (moteur, pompe, convoyeur, etc.)

**Problème** : "Urgence invalide"
**Solution** : Utiliser uniquement "low", "medium", ou "high"

### Données manquantes

**Problème** : Colonnes obligatoires vides
**Solution** : Remplir au minimum les champs requis (✅)

**Problème** : Descriptions trop courtes
**Solution** : Enrichir avec plus de détails techniques

## Support et assistance

Pour toute question ou problème d'importation :

1. **Vérifier ce guide** : Consulter la section résolution de problèmes
2. **Tester avec l'exemple** : Utiliser les données d'exemple fournie
3. **Importer par petits lots** : Commencer avec 10-20 lignes
4. **Documenter les erreurs** : Noter les messages d'erreur précis

## Exemple concret

Voici un exemple d'enregistrement bien formaté :

```csv
Type d'équipement,ID Équipement,Zone,Secteur,Symptômes,Diagnostic,Solution,Durée (min),Urgence,Coût Estimé,Date,Technicien
moteur,MOT-401,production,ligne1,"Surchauffe excessive moteur principal, température >80°C","Problème ventilation","Nettoyer ailettes refroidissement et remplacer roulement ventilateur",120,high,180€,2024-01-15,Jean Dupont
```

Cet enregistrement contient :
- ✅ Informations techniques précises
- ✅ Identifiant équipement clair  
- ✅ Description détaillée du problème
- ✅ Solution concrète appliquée
- ✅ Données temporelles et financières

---

**Note importante** : Plus vos données historiques sont complètes et précises, plus SMDiagFix pourra vous fournir des diagnostics pertinents et adaptés à votre contexte industriel spécifique.
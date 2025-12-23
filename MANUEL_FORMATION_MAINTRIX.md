# Manuel de Formation Maintrix

## Plateforme de Gestion de Maintenance Assistée par Ordinateur (GMAO)

**Version 2.0 | Janvier 2025**

---

## Table des Matières

1. [Introduction](#1-introduction)
2. [Premiers Pas](#2-premiers-pas)
3. [Tableau de Bord](#3-tableau-de-bord)
4. [Gestion des Équipements](#4-gestion-des-équipements)
5. [Ordres de Travail (OT)](#5-ordres-de-travail-ot)
6. [Maintenance Préventive](#6-maintenance-préventive)
7. [Gestion des Stocks](#7-gestion-des-stocks)
8. [Diagnostic Intelligent (IA)](#8-diagnostic-intelligent-ia)
9. [Rapports et Analyses](#9-rapports-et-analyses)
10. [Rôles et Permissions](#10-rôles-et-permissions)
11. [FAQ et Dépannage](#11-faq-et-dépannage)

---

## 1. Introduction

### 1.1 Qu'est-ce que Maintrix ?

Maintrix est une plateforme complète de Gestion de Maintenance Assistée par Ordinateur (GMAO) qui combine :
- **Gestion des équipements** : Suivi complet de vos actifs industriels
- **Ordres de travail** : Planification et suivi des interventions
- **Maintenance préventive** : Planification basée sur le temps ou les compteurs
- **Diagnostic IA** : Analyse intelligente des pannes avec Claude AI
- **Gestion des stocks** : Inventaire et approvisionnement des pièces détachées
- **Rapports et KPIs** : Tableaux de bord et analyses de performance

### 1.2 Avantages Clés

| Avantage | Description |
|----------|-------------|
| Réduction des pannes | Maintenance préventive et prédictive |
| Gain de temps | Automatisation des tâches répétitives |
| Traçabilité complète | Historique de toutes les interventions |
| Collaboration | Partage des données en temps réel |
| Décisions éclairées | Rapports et KPIs détaillés |

---

## 2. Premiers Pas

### 2.1 Connexion à Maintrix

1. Ouvrez votre navigateur web
2. Accédez à l'URL de votre instance Maintrix
3. Entrez vos identifiants (fournis par l'administrateur)
4. Cliquez sur **Se connecter**

### 2.2 Interface Principale

L'interface se compose de :
- **En-tête** : Logo, recherche, notifications, profil utilisateur
- **Menu de navigation** : Accès aux différents modules
- **Zone principale** : Contenu du module actif
- **Barre d'état** : Informations système

### 2.3 Navigation

| Onglet | Description |
|--------|-------------|
| Vue d'ensemble | Tableau de bord principal avec KPIs |
| Ordres de Travail | Gestion des interventions |
| Équipements | Registre des actifs |
| Inventaire | Stock de pièces détachées |
| Alertes | Centre de notifications |
| Plus | Accès aux modules avancés |

---

## 3. Tableau de Bord

### 3.1 Indicateurs Clés (KPIs)

Le tableau de bord affiche 4 indicateurs principaux :

| KPI | Description | Couleur |
|-----|-------------|---------|
| Équipements | Nombre total d'actifs actifs | Bleu |
| OT en Cours | Ordres de travail actifs | Orange |
| Alertes | Alertes critiques à traiter | Rouge |
| Stock Critique | Pièces à réapprovisionner | Violet |

### 3.2 Graphiques

- **Évolution des OT** : Tendance sur 6 mois (terminés vs en cours)
- **Répartition par type** : Diagramme circulaire des équipements
- **Statistiques mensuelles** : Interventions préventives vs correctives

### 3.3 Indicateurs de Performance

| Indicateur | Description | Objectif |
|------------|-------------|----------|
| Taux de Résolution | % d'OT terminés à temps | > 90% |
| MTTR | Temps moyen de réparation | < 4h |
| Maintenance Préventive | % de maintenance planifiée | > 70% |

---

## 4. Gestion des Équipements

### 4.1 Registre des Équipements

Le registre contient tous vos actifs avec les informations suivantes :
- **ID Équipement** : Identifiant unique
- **Nom** : Désignation de l'équipement
- **Type** : Catégorie (moteur, pompe, convoyeur, etc.)
- **Localisation** : Zone et secteur
- **État** : Opérationnel, En maintenance, Arrêté, Critique

### 4.2 Ajouter un Équipement

1. Cliquez sur **Équipements** dans le menu
2. Cliquez sur le bouton **+ Ajouter**
3. Remplissez le formulaire :
   - Nom de l'équipement (obligatoire)
   - Type d'équipement (obligatoire)
   - Fabricant et modèle
   - Numéro de série
   - Date d'installation
   - Localisation (zone, secteur)
4. Cliquez sur **Enregistrer**

### 4.3 Compteurs d'Utilisation

Maintrix supporte les compteurs pour la maintenance basée sur l'utilisation :

| Type de Compteur | Unité | Exemple |
|------------------|-------|---------|
| Heures | h | Heures de fonctionnement |
| Cycles | cycles | Cycles de production |
| Kilomètres | km | Distance parcourue |
| Unités | unités | Produits fabriqués |

Pour mettre à jour un compteur :
1. Ouvrez la fiche de l'équipement
2. Cliquez sur **Mettre à jour compteur**
3. Entrez la nouvelle valeur
4. Validez

---

## 5. Ordres de Travail (OT)

### 5.1 Types d'OT

| Type | Description | Priorité typique |
|------|-------------|------------------|
| Correctif | Réparation après panne | Haute à Urgente |
| Préventif | Maintenance planifiée | Moyenne |
| Amélioratif | Amélioration de l'équipement | Basse à Moyenne |
| Inspection | Contrôle périodique | Basse |

### 5.2 Statuts d'un OT

```
Nouveau → En attente → En cours → Terminé
                ↓
            Annulé
```

| Statut | Description |
|--------|-------------|
| pending | En attente d'assignation |
| in_progress | Intervention en cours |
| completed | Travail terminé |
| cancelled | OT annulé |

### 5.3 Créer un Ordre de Travail

1. Allez dans **Ordres de Travail**
2. Cliquez sur **+ Nouveau OT**
3. Remplissez les informations :
   - **Titre** : Description courte du problème
   - **Description** : Détails complets
   - **Équipement** : Sélectionnez l'équipement concerné
   - **Priorité** : Basse, Moyenne, Haute, Urgente
   - **Type** : Correctif, Préventif, etc.
   - **Technicien assigné** (optionnel)
4. Cliquez sur **Créer**

### 5.4 Suivre un OT

- **Liste des OT** : Vue d'ensemble avec filtres
- **Détails** : Cliquez sur un OT pour voir les détails
- **Historique** : Toutes les actions enregistrées
- **Pièces utilisées** : Liste des pièces consommées

---

## 6. Maintenance Préventive

### 6.1 Concept

La maintenance préventive permet de planifier des interventions avant qu'une panne ne survienne, basée sur :
- **Le temps** : Tous les X jours/semaines/mois
- **L'utilisation** : Après X heures/cycles/km

### 6.2 Créer un Plan de Maintenance

1. Menu **Plus** → **Maintenance Préventive**
2. Cliquez sur **+ Nouveau Plan**
3. Configurez :
   - **Nom du plan** : Ex: "Révision trimestrielle pompe P-001"
   - **Équipement** : Sélectionnez l'équipement
   - **Fréquence** : Hebdomadaire, Mensuelle, Trimestrielle, etc.
   - **OU Basé sur compteur** : Toutes les X heures/cycles
   - **Tâches à effectuer** : Liste des opérations
   - **Durée estimée**
4. Cliquez sur **Enregistrer**

### 6.3 Suivi des Plans

| Colonne | Description |
|---------|-------------|
| Équipement | Actif concerné |
| Fréquence | Périodicité du plan |
| Prochaine échéance | Date de la prochaine intervention |
| Statut | Actif / Inactif |
| Dernière exécution | Date de la dernière maintenance |

### 6.4 Génération Automatique d'OT

Maintrix génère automatiquement des ordres de travail préventifs :
- Quand la date d'échéance approche
- Quand le seuil du compteur est atteint
- Le technicien reçoit une notification

---

## 7. Gestion des Stocks

### 7.1 Inventaire des Pièces

L'inventaire contient :
- **Numéro de pièce** : Référence unique
- **Désignation** : Nom de la pièce
- **Catégorie** : Type de pièce
- **Stock actuel** : Quantité disponible
- **Seuil de réapprovisionnement** : Stock minimum
- **Emplacement** : Localisation dans le magasin

### 7.2 Ajouter une Pièce

1. Allez dans **Inventaire**
2. Cliquez sur **+ Ajouter pièce**
3. Remplissez :
   - Numéro de pièce
   - Désignation
   - Catégorie
   - Prix unitaire
   - Stock initial
   - Seuil d'alerte
   - Fournisseur
4. Enregistrez

### 7.3 Mouvements de Stock

| Type | Description |
|------|-------------|
| Entrée | Réception de commande |
| Sortie | Consommation sur OT |
| Ajustement | Correction d'inventaire |
| Transfert | Mouvement entre emplacements |

### 7.4 Alertes de Stock

Maintrix génère des alertes quand :
- Le stock atteint le seuil de réapprovisionnement
- Le stock est épuisé (critique)
- Une pièce n'est plus disponible chez le fournisseur

---

## 8. Diagnostic Intelligent (IA)

### 8.1 Fonctionnement

Le module de diagnostic IA utilise Claude (Anthropic) pour :
1. **Analyser les symptômes** décrits par le technicien
2. **Identifier les causes probables** basées sur l'historique
3. **Proposer des solutions** étape par étape
4. **Estimer le temps et les pièces** nécessaires

### 8.2 Lancer un Diagnostic

1. Accédez au module **Diagnostic IA**
2. Sélectionnez l'équipement concerné
3. Décrivez les symptômes observés :
   - Bruits anormaux
   - Vibrations
   - Fuites
   - Messages d'erreur
   - Comportement inhabituel
4. Cliquez sur **Analyser**

### 8.3 Résultats du Diagnostic

Le diagnostic affiche :
- **Causes probables** avec niveau de confiance (%)
- **Actions recommandées** par ordre de priorité
- **Pièces potentiellement nécessaires**
- **Temps estimé** d'intervention
- **Lien vers l'historique** des pannes similaires

### 8.4 Créer un OT depuis le Diagnostic

1. Après analyse, cliquez sur **Créer OT**
2. Les informations sont pré-remplies
3. Ajustez si nécessaire
4. Validez la création

---

## 9. Rapports et Analyses

### 9.1 Types de Rapports

| Rapport | Description | Fréquence suggérée |
|---------|-------------|-------------------|
| Synthèse des interventions | Résumé des OT par période | Hebdomadaire |
| Performance équipements | MTBF, MTTR par équipement | Mensuelle |
| Coûts de maintenance | Analyse des dépenses | Mensuelle |
| Consommation pièces | Suivi des consommations | Mensuelle |
| Efficacité préventive | Ratio préventif/correctif | Trimestrielle |

### 9.2 Générer un Rapport

1. Menu **Plus** → **Rapports**
2. Sélectionnez le type de rapport
3. Définissez la période
4. Choisissez les filtres (équipement, zone, etc.)
5. Cliquez sur **Générer**
6. Exportez en PDF ou Excel si nécessaire

### 9.3 KPIs Principaux

| KPI | Formule | Objectif |
|-----|---------|----------|
| MTBF | Temps total / Nombre de pannes | Maximiser |
| MTTR | Temps de réparation total / Nombre de réparations | Minimiser |
| Disponibilité | (Temps total - Temps arrêt) / Temps total × 100 | > 95% |
| Taux préventif | OT préventifs / OT totaux × 100 | > 70% |

---

## 10. Rôles et Permissions

### 10.1 Hiérarchie des Rôles

```
Administrateur
      ↓
Directeur Technique
      ↓
Responsable Maintenance
      ↓
Planificateur ←→ Service Achats
      ↓
Chef d'Équipe
      ↓
Technicien
```

### 10.2 Matrice des Permissions

| Fonction | Technicien | Chef Équipe | Planificateur | Resp. Maint. | Dir. Tech. | Admin |
|----------|:----------:|:-----------:|:-------------:|:------------:|:----------:|:-----:|
| Voir ses OT | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Voir OT équipe | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| Voir tous les OT | - | - | ✓ | ✓ | ✓ | ✓ |
| Créer OT | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| Modifier OT | Propres | Équipe | Tous | Tous | Tous | Tous |
| Supprimer OT | - | - | - | ✓ | ✓ | ✓ |
| Gérer équipements | - | ✓ | ✓ | ✓ | ✓ | ✓ |
| Gérer préventif | - | - | ✓ | ✓ | ✓ | ✓ |
| Gérer stock | - | - | - | - | - | ✓ |
| Voir rapports | Propres | Équipe | Tous | Tous | Tous | Tous |
| Gérer utilisateurs | - | - | - | - | - | ✓ |

### 10.3 Partage des Données

**Important** : Tous les utilisateurs d'une même entreprise peuvent voir les données créées par leurs collègues (lecture). Les modifications sont limitées selon le rôle.

Exemple :
- Un technicien voit tous les équipements de l'entreprise
- Mais il ne peut modifier que ses propres ordres de travail

---

## 11. FAQ et Dépannage

### 11.1 Questions Fréquentes

**Q : Je ne vois pas les équipements dans la liste**
R : Vérifiez que des équipements ont été créés par un utilisateur autorisé. Contactez votre administrateur si le problème persiste.

**Q : Comment changer mon mot de passe ?**
R : Cliquez sur votre profil (en haut à droite) → Paramètres → Modifier le mot de passe.

**Q : Puis-je modifier un OT créé par un collègue ?**
R : Cela dépend de votre rôle. Consultez la matrice des permissions (section 10.2).

**Q : Comment ajouter une pièce à un OT ?**
R : Ouvrez l'OT → Section "Pièces utilisées" → Cliquez sur "Ajouter pièce" → Sélectionnez et entrez la quantité.

**Q : Le diagnostic IA ne fonctionne pas**
R : Vérifiez votre connexion internet. Si le problème persiste, contactez l'administrateur pour vérifier la configuration API.

### 11.2 Bonnes Pratiques

1. **Documentez chaque intervention** : Plus de détails = meilleur historique
2. **Mettez à jour les compteurs** régulièrement
3. **Vérifiez les alertes** quotidiennement
4. **Utilisez le diagnostic IA** pour les pannes complexes
5. **Planifiez le préventif** : Évitez les urgences

### 11.3 Support

Pour toute assistance :
- **Email** : support@maintrix-t.com
- **Documentation** : Consultez ce manuel
- **Administrateur** : Contactez l'admin de votre entreprise

---

## Annexes

### A. Glossaire

| Terme | Définition |
|-------|------------|
| GMAO | Gestion de Maintenance Assistée par Ordinateur |
| OT | Ordre de Travail |
| MTBF | Mean Time Between Failures (Temps moyen entre pannes) |
| MTTR | Mean Time To Repair (Temps moyen de réparation) |
| Préventif | Maintenance planifiée avant panne |
| Correctif | Maintenance après panne |
| Tenant | Entreprise/Client dans un système multi-locataire |
| RBAC | Role-Based Access Control (Contrôle d'accès par rôles) |

### B. Raccourcis Clavier

| Raccourci | Action |
|-----------|--------|
| Ctrl + N | Nouveau (OT, équipement, etc.) |
| Ctrl + S | Sauvegarder |
| Ctrl + F | Rechercher |
| Échap | Fermer le dialogue |

---

**Document préparé par l'équipe Maintrix**
**© 2025 Maintrix - Tous droits réservés**

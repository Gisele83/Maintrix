# Plan de Continuité d'Activité (PCA)
## Maintrix - GMAO Intelligente

**Version** : 1.0  
**Date d'entrée en vigueur** : [DATE]  
**Prochaine révision** : [DATE + 1 an]  
**Propriétaire** : Direction Générale  
**Classification** : Confidentiel

---

## 1. Introduction

### 1.1 Objectif

Ce Plan de Continuité d'Activité (PCA) définit les stratégies, procédures et ressources nécessaires pour maintenir ou restaurer les activités critiques de Maintrix en cas de sinistre ou d'interruption majeure.

### 1.2 Périmètre

Ce plan couvre :
- L'infrastructure technique (serveurs, bases de données, réseau)
- Les applications métier (plateforme Maintrix SaaS et on-premise)
- Les processus opérationnels critiques
- Les ressources humaines clés

### 1.3 Objectifs de Reprise

| Métrique | Objectif | Justification |
|----------|----------|---------------|
| **RTO** (Recovery Time Objective) | 4 heures | Temps maximum d'interruption acceptable |
| **RPO** (Recovery Point Objective) | 24 heures | Perte de données maximum acceptable |
| **MTPD** (Maximum Tolerable Period of Disruption) | 72 heures | Durée max avant impact irréversible |

---

## 2. Analyse d'Impact (BIA)

### 2.1 Processus Critiques

| Processus | Criticité | RTO | RPO | Impact si indisponible |
|-----------|:---------:|:---:|:---:|------------------------|
| Plateforme SaaS (production) | Critique | 2h | 1h | Clients ne peuvent pas travailler |
| Base de données clients | Critique | 2h | 1h | Perte de données, SLA non respectés |
| Authentification | Critique | 1h | N/A | Aucun accès possible |
| Diagnostic IA | Élevé | 4h | N/A | Fonctionnalité dégradée |
| Notifications email | Moyen | 24h | N/A | Alertes retardées |
| Paiements (Stripe/PayPal) | Élevé | 4h | N/A | Nouveaux abonnements bloqués |
| Backoffice interne | Moyen | 24h | 24h | Support client ralenti |

### 2.2 Ressources Critiques

| Ressource | Type | Fournisseur | Alternative |
|-----------|------|-------------|-------------|
| Base de données | PostgreSQL | Neon | AWS RDS / Local Docker |
| Hébergement | Cloud | Replit / AWS | Multi-cloud failover |
| DNS | Service | [FOURNISSEUR] | DNS secondaire |
| Certificats SSL | Service | Let's Encrypt | Certificats de backup |
| Email transactionnel | API | SendGrid | Mailgun (backup) |
| Paiements | API | Stripe | PayPal (backup) |
| IA Diagnostic | API | Anthropic | Mode dégradé (patterns locaux) |

---

## 3. Scénarios de Sinistre

### 3.1 Matrice des Scénarios

| Scénario | Probabilité | Impact | Stratégie |
|----------|:-----------:|:------:|-----------|
| Panne hébergeur cloud | Moyenne | Critique | Basculement multi-cloud |
| Corruption base de données | Faible | Critique | Restauration backup |
| Cyberattaque (ransomware) | Moyenne | Critique | Restauration + forensique |
| Panne fournisseur tiers (Stripe, SendGrid) | Faible | Élevé | Fournisseur alternatif |
| Catastrophe naturelle (datacenter) | Très faible | Critique | Réplication géographique |
| Erreur humaine majeure | Moyenne | Variable | Rollback, backups |
| Départ personnel clé | Faible | Moyen | Documentation + cross-training |

---

## 4. Stratégies de Continuité

### 4.1 Stratégie Technique

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE HAUTE DISPONIBILITÉ             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐         ┌─────────────┐                       │
│   │  Site       │         │  Site       │                       │
│   │  Principal  │◄───────►│  Secondaire │                       │
│   │  (Replit/   │  Sync   │  (AWS/OVH)  │                       │
│   │   AWS)      │         │             │                       │
│   └──────┬──────┘         └──────┬──────┘                       │
│          │                       │                              │
│          └───────────┬───────────┘                              │
│                      │                                          │
│               ┌──────▼──────┐                                   │
│               │   DNS       │                                   │
│               │   Failover  │                                   │
│               └─────────────┘                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Stratégie de Sauvegarde (3-2-1)

| Règle | Implémentation |
|-------|----------------|
| **3** copies des données | Production + Backup local + Backup distant |
| **2** types de stockage | PostgreSQL + Object Storage |
| **1** copie hors site | Cloud secondaire (AWS S3 / Scaleway) |

**Planification des sauvegardes** :

| Type | Fréquence | Rétention | Destination |
|------|-----------|-----------|-------------|
| Snapshot DB | Toutes les 6h | 7 jours | Même cloud |
| Backup complet DB | Quotidien | 30 jours | Cloud secondaire |
| Backup fichiers | Quotidien | 30 jours | Object storage |
| Backup configuration | À chaque changement | 1 an | Git + cloud |
| Archive mensuelle | Mensuel | 1 an | Stockage froid |

### 4.3 Mode Dégradé

En cas de panne partielle, prioriser :

| Priorité | Fonctionnalité | Mode dégradé |
|:--------:|----------------|--------------|
| 1 | Consultation données existantes | Lecture seule si nécessaire |
| 2 | Création/modification interventions | Mise en file d'attente offline |
| 3 | Diagnostic IA | Désactivé, patterns locaux si disponibles |
| 4 | Notifications | Différées |
| 5 | Rapports | Indisponibles temporairement |

---

## 5. Procédures d'Activation

### 5.1 Critères d'Activation

Le PCA est activé lorsque :
- L'interruption est estimée > 2 heures
- L'intégrité des données est compromise
- Un scénario listé en section 3 se produit
- La Direction le décide

### 5.2 Chaîne d'Alerte

```
Détection incident
       ↓
Évaluation par Équipe Ops (15 min)
       ↓
Notification RSSI / CTO
       ↓
Décision d'activation PCA (Direction)
       ↓
Activation de la cellule de crise
       ↓
Communication aux équipes
       ↓
Exécution du plan de reprise
```

### 5.3 Cellule de Crise

| Rôle | Responsabilité | Suppléant |
|------|----------------|-----------|
| Directeur de crise (DG) | Décisions stratégiques, communication externe | Directeur Adjoint |
| Coordinateur technique (CTO) | Pilotage des actions techniques | Lead Dev |
| Responsable sécurité (RSSI) | Aspects sécurité et conformité | Analyste sécurité |
| Responsable communication | Communication clients et partenaires | Marketing |
| Support client | Gestion des demandes clients | Équipe support |

---

## 6. Plans de Reprise par Scénario

### 6.1 Scénario A : Panne Hébergeur Cloud

**Durée estimée de reprise** : 2-4 heures

**Étapes** :

| # | Action | Responsable | Durée |
|---|--------|-------------|-------|
| 1 | Confirmer l'indisponibilité | Ops | 10 min |
| 2 | Activer le site de secours | CTO | 30 min |
| 3 | Basculer le DNS vers site secondaire | Ops | 15 min |
| 4 | Vérifier la réplication des données | DBA | 30 min |
| 5 | Tester les fonctionnalités critiques | QA | 30 min |
| 6 | Communiquer aux clients | Communication | 15 min |
| 7 | Surveillance renforcée | Ops | Continue |

**Commandes** :

```bash
# 1. Vérifier l'état du site principal
curl -s -o /dev/null -w "%{http_code}" https://app.maintrix-t.com/health

# 2. Activer le site secondaire (AWS)
cd /opt/maintrix-secondary
docker-compose up -d

# 3. Basculer le DNS (exemple Cloudflare)
# Via API ou console : pointer app.maintrix-t.com vers IP secondaire

# 4. Vérifier la synchronisation
docker exec maintrix-postgres psql -U maintrix -c \
  "SELECT MAX(updated_at) FROM equipment"
```

### 6.2 Scénario B : Corruption Base de Données

**Durée estimée de reprise** : 1-4 heures selon gravité

**Étapes** :

| # | Action | Responsable | Durée |
|---|--------|-------------|-------|
| 1 | Arrêter l'application | Ops | 5 min |
| 2 | Évaluer l'étendue de la corruption | DBA | 30 min |
| 3 | Identifier la dernière sauvegarde saine | DBA | 15 min |
| 4 | Restaurer la base de données | DBA | 1-2h |
| 5 | Vérifier l'intégrité des données | DBA + Métier | 30 min |
| 6 | Redémarrer l'application | Ops | 10 min |
| 7 | Informer les clients de la perte potentielle | Communication | 15 min |

**Commandes** :

```bash
# 1. Arrêter l'application
docker-compose stop app

# 2. Lister les sauvegardes disponibles
ls -la /opt/maintrix/backups/

# 3. Restaurer depuis backup
cat /opt/maintrix/backups/backup_YYYYMMDD.sql | \
  docker exec -i maintrix-postgres psql -U maintrix maintrix

# 4. Vérifier l'intégrité
docker exec maintrix-postgres psql -U maintrix -c \
  "SELECT COUNT(*) FROM equipment; SELECT COUNT(*) FROM work_orders;"

# 5. Redémarrer
docker-compose start app
```

### 6.3 Scénario C : Cyberattaque (Ransomware)

**Durée estimée de reprise** : 4-24 heures

**Principes clés** :
- **NE PAS** payer la rançon
- **NE PAS** éteindre les machines (préserver les preuves)
- Isoler immédiatement les systèmes affectés

**Étapes** :

| # | Action | Responsable | Durée |
|---|--------|-------------|-------|
| 1 | Isoler les systèmes (couper réseau) | Ops | Immédiat |
| 2 | Alerter la Direction et le RSSI | Ops | 5 min |
| 3 | Préserver les preuves (logs, snapshots) | RSSI | 1h |
| 4 | Identifier le vecteur d'attaque | RSSI | 2-4h |
| 5 | Notifier les autorités (ANSSI, CNIL) | Juridique | 24h |
| 6 | Reconstruire depuis infrastructure propre | CTO + Ops | 4-12h |
| 7 | Restaurer les données depuis backup hors-ligne | DBA | 2-4h |
| 8 | Changer tous les secrets (clés API, mots de passe) | RSSI | 2h |
| 9 | Tests de sécurité avant remise en service | RSSI | 2h |

### 6.4 Scénario D : Panne Fournisseur Tiers

**Stripe/PayPal indisponible** :
- Activer le fournisseur de backup
- Mode dégradé : nouveaux abonnements différés
- Communication : "Paiements temporairement indisponibles"

**SendGrid indisponible** :
- Basculer vers Mailgun (configuration backup)
- File d'attente des emails pour réessai

**Anthropic (IA) indisponible** :
- Désactiver temporairement le diagnostic IA
- Activer mode "patterns locaux" (120 cas de base)

---

## 7. Communication de Crise

### 7.1 Messages Préparés

**Message Status Page** :

```
[TITRE] Interruption de service en cours

Nous rencontrons actuellement une interruption de service affectant 
[SERVICE]. Nos équipes travaillent activement à la résolution.

Début de l'incident : [HEURE]
Prochaine mise à jour : [HEURE + 1h]

Nous vous remercions de votre patience.
```

**Email Clients (incident majeur)** :

```
Objet : Information importante - Interruption de service Maintrix

Cher client,

Nous vous informons que notre plateforme rencontre actuellement une 
interruption de service depuis [HEURE].

Impact : [DESCRIPTION]
Cause identifiée : [CAUSE ou "en cours d'investigation"]
Estimation de reprise : [HEURE]

Nous mettons tout en œuvre pour rétablir le service dans les meilleurs délais.
Nous vous tiendrons informés de l'évolution de la situation.

Nous vous prions de nous excuser pour la gêne occasionnée.

L'équipe Maintrix
```

### 7.2 Canaux de Communication

| Audience | Canal | Responsable |
|----------|-------|-------------|
| Clients | Email + Status page | Communication |
| Équipe interne | Slack/Teams + Téléphone | CTO |
| Direction | Téléphone + Email | DG |
| Presse (si nécessaire) | Communiqué officiel | DG |
| Autorités | Email officiel | Juridique |

---

## 8. Tests et Exercices

### 8.1 Programme de Tests

| Type de test | Fréquence | Objectif |
|--------------|-----------|----------|
| Test de sauvegarde/restauration | Mensuel | Vérifier l'intégrité des backups |
| Exercice tabletop | Semestriel | Tester la procédure sur scénario fictif |
| Test de basculement (failover) | Annuel | Valider le site de secours |
| Exercice grandeur réelle | Tous les 2 ans | Simulation complète |

### 8.2 Checklist Test de Restauration

```
□ Sélectionner un backup récent
□ Restaurer sur environnement de test
□ Vérifier l'intégrité des tables critiques
□ Tester les fonctionnalités principales
□ Mesurer le temps de restauration
□ Documenter les résultats
□ Identifier les améliorations
```

### 8.3 Documentation des Tests

| Date | Type | Résultat | Temps | Actions |
|------|------|----------|-------|---------|
| [DATE] | Restauration DB | Succès | 45 min | Aucune |
| [DATE] | Failover | Partiel | 2h | Améliorer DNS |

---

## 9. Maintenance du Plan

### 9.1 Révisions

| Événement | Action |
|-----------|--------|
| Annuellement | Revue complète du PCA |
| Après incident majeur | Mise à jour basée sur les leçons apprises |
| Changement d'infrastructure | Mise à jour des procédures techniques |
| Changement de personnel clé | Mise à jour des contacts |
| Nouveau fournisseur critique | Ajout dans les scénarios |

### 9.2 Distribution

Ce document est distribué à :
- Direction Générale
- RSSI
- CTO et équipe technique
- Responsables de département
- Stockage sécurisé accessible hors-ligne

---

## 10. Annexes

### Annexe A : Contacts d'Urgence

| Rôle | Nom | Téléphone | Email |
|------|-----|-----------|-------|
| DG | [NOM] | [TEL] | [EMAIL] |
| CTO | [NOM] | [TEL] | [EMAIL] |
| RSSI | [NOM] | [TEL] | [EMAIL] |
| Ops Lead | [NOM] | [TEL] | [EMAIL] |
| Support Hébergeur | [FOURNISSEUR] | [TEL] | [EMAIL] |

### Annexe B : Inventaire des Systèmes Critiques

| Système | URL/IP | Accès | Documentation |
|---------|--------|-------|---------------|
| Production | app.maintrix-t.com | Admin | /docs/production |
| Base de données | [HOST]:5432 | DBA | /docs/database |
| Backups | [BUCKET S3] | Ops | /docs/backups |
| DNS | [PROVIDER] | Ops | /docs/dns |
| Monitoring | [URL] | Tous | /docs/monitoring |

### Annexe C : Checklist Reprise Complète

```
□ Cellule de crise activée
□ Communication initiale envoyée
□ Cause identifiée
□ Stratégie de reprise choisie
□ Infrastructure de secours opérationnelle
□ Données restaurées et vérifiées
□ Tests fonctionnels réussis
□ DNS basculé (si applicable)
□ Surveillance renforcée active
□ Communication de reprise envoyée
□ Revue post-incident planifiée
□ Plan mis à jour avec leçons apprises
```

---

**Document rédigé conformément aux exigences SOC 2 (CC9) et ISO 27001 (A.17)**

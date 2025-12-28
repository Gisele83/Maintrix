# Registre des Risques de Sécurité
## Maintrix - GMAO Intelligente

**Version** : 1.0  
**Date de dernière mise à jour** : [DATE]  
**Prochaine révision** : [DATE + 6 mois]  
**Propriétaire** : RSSI  
**Classification** : Confidentiel

---

## 1. Méthodologie d'Évaluation des Risques

### 1.1 Échelle de Probabilité

| Niveau | Valeur | Description | Fréquence estimée |
|--------|:------:|-------------|-------------------|
| Très faible | 1 | Rare, exceptionnel | < 1 fois / 10 ans |
| Faible | 2 | Peu probable | 1 fois / 5 ans |
| Moyen | 3 | Possible | 1 fois / an |
| Élevé | 4 | Probable | Plusieurs fois / an |
| Très élevé | 5 | Quasi certain | Mensuel ou plus |

### 1.2 Échelle d'Impact

| Niveau | Valeur | Description | Critères |
|--------|:------:|-------------|----------|
| Négligeable | 1 | Impact minimal | Aucune interruption, pas de fuite de données |
| Mineur | 2 | Impact limité | Interruption < 1h, quelques utilisateurs affectés |
| Modéré | 3 | Impact significatif | Interruption 1-4h, données internes exposées |
| Majeur | 4 | Impact grave | Interruption > 4h, données clients exposées |
| Critique | 5 | Impact catastrophique | Perte de données, fuite massive, réputation |

### 1.3 Matrice de Risque

```
              IMPACT
            1   2   3   4   5
         ┌───┬───┬───┬───┬───┐
       5 │ M │ M │ E │ E │ E │
         ├───┼───┼───┼───┼───┤
       4 │ F │ M │ M │ E │ E │
P        ├───┼───┼───┼───┼───┤
R      3 │ F │ F │ M │ M │ E │
O        ├───┼───┼───┼───┼───┤
B      2 │ F │ F │ F │ M │ M │
A        ├───┼───┼───┼───┼───┤
       1 │ F │ F │ F │ F │ M │
         └───┴───┴───┴───┴───┘

F = Faible (1-6)   : Accepter ou surveiller
M = Moyen (7-14)   : Traiter dans l'année
E = Élevé (15-25)  : Traiter en priorité
```

**Score de risque** = Probabilité × Impact

---

## 2. Registre des Risques

### 2.1 Risques Techniques

#### RISK-001 : Injection SQL

| Attribut | Valeur |
|----------|--------|
| **ID** | RISK-001 |
| **Catégorie** | Technique / Application |
| **Description** | Un attaquant exploite une faille d'injection SQL pour accéder ou modifier des données non autorisées |
| **Probabilité** | 2 (Faible) |
| **Impact** | 5 (Critique) |
| **Score brut** | 10 (Moyen) |
| **Contrôles existants** | ORM Drizzle avec requêtes paramétrées, validation Zod |
| **Score résiduel** | 4 (Faible) |
| **Propriétaire** | Lead Développeur |
| **Statut** | Traité |

---

#### RISK-002 : Cross-Site Scripting (XSS)

| Attribut | Valeur |
|----------|--------|
| **ID** | RISK-002 |
| **Catégorie** | Technique / Application |
| **Description** | Injection de scripts malveillants dans l'interface utilisateur |
| **Probabilité** | 2 (Faible) |
| **Impact** | 4 (Majeur) |
| **Score brut** | 8 (Moyen) |
| **Contrôles existants** | React avec échappement automatique, CSP headers |
| **Score résiduel** | 3 (Faible) |
| **Propriétaire** | Lead Développeur |
| **Statut** | Traité |

---

#### RISK-003 : Compromission de compte administrateur

| Attribut | Valeur |
|----------|--------|
| **ID** | RISK-003 |
| **Catégorie** | Technique / Accès |
| **Description** | Un attaquant obtient les identifiants d'un compte administrateur par phishing, brute force ou fuite |
| **Probabilité** | 3 (Moyen) |
| **Impact** | 5 (Critique) |
| **Score brut** | 15 (Élevé) |
| **Contrôles existants** | MFA obligatoire, politique de mots de passe forts, rate limiting, audit logs |
| **Score résiduel** | 6 (Faible) |
| **Propriétaire** | RSSI |
| **Statut** | Traité |
| **Actions supplémentaires** | Implémenter alertes sur connexions inhabituelles |

---

#### RISK-004 : Fuite de secrets (clés API)

| Attribut | Valeur |
|----------|--------|
| **ID** | RISK-004 |
| **Catégorie** | Technique / Configuration |
| **Description** | Exposition accidentelle de clés API, mots de passe ou tokens dans le code source ou logs |
| **Probabilité** | 3 (Moyen) |
| **Impact** | 4 (Majeur) |
| **Score brut** | 12 (Moyen) |
| **Contrôles existants** | Variables d'environnement, .gitignore, revue de code |
| **Score résiduel** | 6 (Faible) |
| **Propriétaire** | Lead Développeur |
| **Statut** | Traité |
| **Actions supplémentaires** | Ajouter scan automatique des secrets (git-secrets) |

---

#### RISK-005 : Indisponibilité de l'infrastructure

| Attribut | Valeur |
|----------|--------|
| **ID** | RISK-005 |
| **Catégorie** | Technique / Infrastructure |
| **Description** | Panne de l'hébergeur cloud rendant le service inaccessible |
| **Probabilité** | 2 (Faible) |
| **Impact** | 4 (Majeur) |
| **Score brut** | 8 (Moyen) |
| **Contrôles existants** | Sauvegardes quotidiennes, documentation de reprise |
| **Score résiduel** | 6 (Faible) |
| **Propriétaire** | DevOps |
| **Statut** | Partiellement traité |
| **Actions supplémentaires** | Mettre en place site de secours multi-cloud |

---

#### RISK-006 : Perte de données (corruption ou suppression)

| Attribut | Valeur |
|----------|--------|
| **ID** | RISK-006 |
| **Catégorie** | Technique / Données |
| **Description** | Perte de données clients due à une erreur, corruption ou suppression accidentelle |
| **Probabilité** | 2 (Faible) |
| **Impact** | 5 (Critique) |
| **Score brut** | 10 (Moyen) |
| **Contrôles existants** | Sauvegardes quotidiennes, snapshots Neon |
| **Score résiduel** | 4 (Faible) |
| **Propriétaire** | DBA |
| **Statut** | Traité |
| **Actions supplémentaires** | Tests de restauration mensuels documentés |

---

#### RISK-007 : Vulnérabilités dans les dépendances

| Attribut | Valeur |
|----------|--------|
| **ID** | RISK-007 |
| **Catégorie** | Technique / Supply Chain |
| **Description** | Utilisation de bibliothèques tierces contenant des vulnérabilités connues |
| **Probabilité** | 4 (Élevé) |
| **Impact** | 3 (Modéré) |
| **Score brut** | 12 (Moyen) |
| **Contrôles existants** | npm audit périodique |
| **Score résiduel** | 8 (Moyen) |
| **Propriétaire** | Lead Développeur |
| **Statut** | Partiellement traité |
| **Actions supplémentaires** | Automatiser avec Dependabot/Snyk |

---

### 2.2 Risques Organisationnels

#### RISK-008 : Départ de personnel clé

| Attribut | Valeur |
|----------|--------|
| **ID** | RISK-008 |
| **Catégorie** | Organisationnel / RH |
| **Description** | Départ soudain d'un développeur ou administrateur clé entraînant perte de connaissance |
| **Probabilité** | 3 (Moyen) |
| **Impact** | 3 (Modéré) |
| **Score brut** | 9 (Moyen) |
| **Contrôles existants** | Documentation technique, replit.md |
| **Score résiduel** | 6 (Faible) |
| **Propriétaire** | RH / CTO |
| **Statut** | Partiellement traité |
| **Actions supplémentaires** | Cross-training, documentation des procédures |

---

#### RISK-009 : Non-conformité réglementaire (RGPD)

| Attribut | Valeur |
|----------|--------|
| **ID** | RISK-009 |
| **Catégorie** | Organisationnel / Conformité |
| **Description** | Non-respect des exigences RGPD entraînant sanctions ou perte de confiance |
| **Probabilité** | 2 (Faible) |
| **Impact** | 4 (Majeur) |
| **Score brut** | 8 (Moyen) |
| **Contrôles existants** | Politique de confidentialité, droits d'accès implémentés |
| **Score résiduel** | 4 (Faible) |
| **Propriétaire** | DPO / Juridique |
| **Statut** | Traité |

---

#### RISK-010 : Défaillance fournisseur critique

| Attribut | Valeur |
|----------|--------|
| **ID** | RISK-010 |
| **Catégorie** | Organisationnel / Fournisseurs |
| **Description** | Indisponibilité ou cessation d'activité d'un fournisseur critique (Stripe, SendGrid, Anthropic) |
| **Probabilité** | 1 (Très faible) |
| **Impact** | 4 (Majeur) |
| **Score brut** | 4 (Faible) |
| **Contrôles existants** | Fournisseurs alternatifs identifiés (PayPal, Mailgun) |
| **Score résiduel** | 3 (Faible) |
| **Propriétaire** | CTO |
| **Statut** | Traité |

---

### 2.3 Risques Humains

#### RISK-011 : Phishing ciblé (spear phishing)

| Attribut | Valeur |
|----------|--------|
| **ID** | RISK-011 |
| **Catégorie** | Humain / Social Engineering |
| **Description** | Attaque par email ciblée visant à obtenir des identifiants ou installer un malware |
| **Probabilité** | 4 (Élevé) |
| **Impact** | 4 (Majeur) |
| **Score brut** | 16 (Élevé) |
| **Contrôles existants** | MFA, sensibilisation basique |
| **Score résiduel** | 10 (Moyen) |
| **Propriétaire** | RSSI |
| **Statut** | Partiellement traité |
| **Actions supplémentaires** | Formation anti-phishing, simulations régulières |

---

#### RISK-012 : Erreur de configuration

| Attribut | Valeur |
|----------|--------|
| **ID** | RISK-012 |
| **Catégorie** | Humain / Opérations |
| **Description** | Mauvaise configuration exposant des données ou créant une vulnérabilité |
| **Probabilité** | 3 (Moyen) |
| **Impact** | 3 (Modéré) |
| **Score brut** | 9 (Moyen) |
| **Contrôles existants** | Infrastructure as Code, revue des changements |
| **Score résiduel** | 6 (Faible) |
| **Propriétaire** | DevOps |
| **Statut** | Traité |

---

### 2.4 Risques Multi-Tenant SaaS

#### RISK-013 : Fuite de données entre tenants

| Attribut | Valeur |
|----------|--------|
| **ID** | RISK-013 |
| **Catégorie** | Technique / Multi-tenant |
| **Description** | Un utilisateur d'un tenant accède aux données d'un autre tenant |
| **Probabilité** | 2 (Faible) |
| **Impact** | 5 (Critique) |
| **Score brut** | 10 (Moyen) |
| **Contrôles existants** | Isolation par tenantId, middleware de vérification, tests automatisés |
| **Score résiduel** | 4 (Faible) |
| **Propriétaire** | Lead Développeur |
| **Statut** | Traité |

---

#### RISK-014 : Abus de ressources par un tenant

| Attribut | Valeur |
|----------|--------|
| **ID** | RISK-014 |
| **Catégorie** | Technique / Performance |
| **Description** | Un tenant consomme excessivement les ressources, dégradant le service pour les autres |
| **Probabilité** | 3 (Moyen) |
| **Impact** | 2 (Mineur) |
| **Score brut** | 6 (Faible) |
| **Contrôles existants** | Rate limiting par utilisateur |
| **Score résiduel** | 4 (Faible) |
| **Propriétaire** | DevOps |
| **Statut** | Partiellement traité |
| **Actions supplémentaires** | Rate limiting par tenant, quotas |

---

## 3. Vue d'Ensemble des Risques

### 3.1 Répartition par Niveau de Risque Résiduel

| Niveau | Nombre | Risques |
|--------|:------:|---------|
| Élevé (15-25) | 0 | - |
| Moyen (7-14) | 2 | RISK-007, RISK-011 |
| Faible (1-6) | 12 | RISK-001 à RISK-006, RISK-008 à RISK-010, RISK-012 à RISK-014 |

### 3.2 Top 5 des Risques Prioritaires

| Priorité | ID | Risque | Score | Action requise |
|:--------:|:--:|--------|:-----:|----------------|
| 1 | RISK-011 | Phishing ciblé | 10 | Formation anti-phishing |
| 2 | RISK-007 | Vulnérabilités dépendances | 8 | Automatiser scans (Snyk) |
| 3 | RISK-003 | Compromission admin | 6 | Alertes connexions inhabituelles |
| 4 | RISK-005 | Indisponibilité infrastructure | 6 | Site de secours multi-cloud |
| 5 | RISK-004 | Fuite de secrets | 6 | Scan automatique git-secrets |

---

## 4. Plan de Traitement des Risques

### 4.1 Actions Prioritaires

| ID | Action | Responsable | Échéance | Budget | Statut |
|:--:|--------|-------------|:--------:|:------:|:------:|
| ACT-001 | Mettre en place formation anti-phishing | RSSI | T1 2025 | 2 000 € | Planifié |
| ACT-002 | Intégrer Snyk/Dependabot | DevOps | T1 2025 | 500 €/mois | En cours |
| ACT-003 | Alertes connexions inhabituelles | Dev | T1 2025 | 0 € | Planifié |
| ACT-004 | Site de secours AWS | DevOps | T2 2025 | 200 €/mois | Planifié |
| ACT-005 | Scanner git-secrets | Dev | T1 2025 | 0 € | Planifié |
| ACT-006 | Tests de restauration mensuels | DBA | Continu | 0 € | En cours |

### 4.2 Indicateurs de Suivi

| KPI | Cible | Fréquence de mesure |
|-----|-------|---------------------|
| Nombre de risques élevés | 0 | Trimestriel |
| Nombre de risques moyens | < 5 | Trimestriel |
| % des actions complétées à temps | > 80% | Mensuel |
| Temps moyen de correction vulnérabilités critiques | < 48h | Par incident |
| Taux de réussite des tests de restauration | 100% | Mensuel |

---

## 5. Historique des Révisions

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| 1.0 | [DATE] | [NOM] | Création initiale |

---

## 6. Approbation

| Rôle | Nom | Date | Signature |
|------|-----|------|-----------|
| RSSI | [NOM] | [DATE] | _________ |
| CTO | [NOM] | [DATE] | _________ |
| DG | [NOM] | [DATE] | _________ |

---

**Document rédigé conformément aux exigences SOC 2 (CC3, CC4, CC5) et ISO 27001 (6.1, 8.2)**

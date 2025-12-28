# Mapping des Contrôles SOC 2 / ISO 27001
## Maintrix - Traçabilité des Contrôles de Sécurité

**Version** : 1.0  
**Date** : Janvier 2025  
**Propriétaire** : RSSI  
**Classification** : Confidentiel

---

## 1. Vue d'Ensemble

Ce document établit la correspondance entre :
- Les critères SOC 2 Trust Services Criteria (TSC)
- Les contrôles ISO 27001:2022 Annex A
- L'implémentation Maintrix

---

## 2. Mapping SOC 2 Trust Services Criteria

### CC1 : Organisation et Management

| Critère SOC 2 | Description | Contrôle Maintrix | Document de référence | Statut |
|---------------|-------------|-------------------|----------------------|:------:|
| CC1.1 | Engagement éthique | Code de conduite | POLITIQUE_SECURITE_INFORMATION.md §2 | ✅ |
| CC1.2 | Gouvernance | Comité de sécurité mensuel | POLITIQUE_SECURITE_INFORMATION.md §2.2 | ✅ |
| CC1.3 | Structure organisationnelle | Rôles et responsabilités définis | POLITIQUE_SECURITE_INFORMATION.md §2.1 | ✅ |
| CC1.4 | Compétences | Formation sécurité | POLITIQUE_SECURITE_INFORMATION.md §10 | ✅ |
| CC1.5 | Responsabilisation | Sanctions définies | POLITIQUE_SECURITE_INFORMATION.md §12 | ✅ |

### CC2 : Communication

| Critère SOC 2 | Description | Contrôle Maintrix | Document de référence | Statut |
|---------------|-------------|-------------------|----------------------|:------:|
| CC2.1 | Information interne | Documentation technique | replit.md, docs/ | ✅ |
| CC2.2 | Communication externe | Politique de confidentialité, CGU | Site web | ✅ |
| CC2.3 | Signalement interne | Canal de signalement incidents | PROCEDURE_REPONSE_INCIDENTS.md §4.1.2 | ✅ |

### CC3 : Évaluation des Risques

| Critère SOC 2 | Description | Contrôle Maintrix | Document de référence | Statut |
|---------------|-------------|-------------------|----------------------|:------:|
| CC3.1 | Objectifs clairs | Objectifs de sécurité documentés | POLITIQUE_SECURITE_INFORMATION.md §1.2 | ✅ |
| CC3.2 | Identification des risques | Registre des risques | REGISTRE_RISQUES.md | ✅ |
| CC3.3 | Évaluation fraude | Risques de phishing identifiés | REGISTRE_RISQUES.md RISK-011 | ✅ |
| CC3.4 | Changements significatifs | Revue des risques semestrielle | REGISTRE_RISQUES.md §5 | ✅ |

### CC4 : Activités de Contrôle

| Critère SOC 2 | Description | Contrôle Maintrix | Document de référence | Statut |
|---------------|-------------|-------------------|----------------------|:------:|
| CC4.1 | Contrôles de mitigation | Contrôles techniques implémentés | REGISTRE_RISQUES.md §2 | ✅ |
| CC4.2 | Contrôles technologiques | MFA, chiffrement, RBAC | server/middleware/security.ts | ✅ |

### CC5 : Surveillance

| Critère SOC 2 | Description | Contrôle Maintrix | Document de référence | Statut |
|---------------|-------------|-------------------|----------------------|:------:|
| CC5.1 | Évaluation continue | Monitoring applicatif | GUIDE_MAINTENANCE.md | ✅ |
| CC5.2 | Correction des déficiences | Plan d'action risques | REGISTRE_RISQUES.md §4 | ✅ |
| CC5.3 | Reporting | Revue mensuelle comité sécurité | POLITIQUE_SECURITE_INFORMATION.md §2.2 | ✅ |

### CC6 : Contrôles d'Accès Logiques et Physiques

| Critère SOC 2 | Description | Contrôle Maintrix | Document de référence | Statut |
|---------------|-------------|-------------------|----------------------|:------:|
| CC6.1 | Inventaire des actifs | Registre des systèmes | PLAN_CONTINUITE_ACTIVITE.md Annexe B | ✅ |
| CC6.2 | Enregistrement/désenregistrement | Processus RH documenté | POLITIQUE_SECURITE_INFORMATION.md §4.2 | ✅ |
| CC6.3 | Autorisation d'accès | RBAC 7 rôles | server/rbac-permissions.ts | ✅ |
| CC6.4 | Restriction d'accès physique | Cloud hébergé (N/A pour SaaS) | POLITIQUE_SECURITE_INFORMATION.md §15 | ⚠️ |
| CC6.5 | Suppression des accès | Révocation sous 24h | POLITIQUE_SECURITE_INFORMATION.md §4.2 | ✅ |
| CC6.6 | Protection des données | Chiffrement TLS + PostgreSQL | POLITIQUE_SECURITE_INFORMATION.md §5.2 | ✅ |
| CC6.7 | Transmission sécurisée | HTTPS/TLS 1.2+ | server/index.ts | ✅ |
| CC6.8 | Protection contre malware | Rate limiting, validation entrées | server/middleware/security.ts | ✅ |

### CC7 : Gestion des Incidents

| Critère SOC 2 | Description | Contrôle Maintrix | Document de référence | Statut |
|---------------|-------------|-------------------|----------------------|:------:|
| CC7.1 | Détection des incidents | Monitoring, logs | PROCEDURE_REPONSE_INCIDENTS.md §4.1.1 | ✅ |
| CC7.2 | Analyse des incidents | Processus de triage | PROCEDURE_REPONSE_INCIDENTS.md §Phase 2 | ✅ |
| CC7.3 | Réponse aux incidents | IRT définie | PROCEDURE_REPONSE_INCIDENTS.md §3 | ✅ |
| CC7.4 | Récupération | Procédures de restauration | PROCEDURE_REPONSE_INCIDENTS.md §Phase 6 | ✅ |
| CC7.5 | Notification | CNIL, clients | PROCEDURE_REPONSE_INCIDENTS.md §5 | ✅ |

### CC8 : Gestion des Changements

| Critère SOC 2 | Description | Contrôle Maintrix | Document de référence | Statut |
|---------------|-------------|-------------------|----------------------|:------:|
| CC8.1 | Autorisation des changements | Pull requests, revue de code | POLITIQUE_SECURITE_INFORMATION.md §5.1 | ✅ |

### CC9 : Continuité d'Activité

| Critère SOC 2 | Description | Contrôle Maintrix | Document de référence | Statut |
|---------------|-------------|-------------------|----------------------|:------:|
| CC9.1 | Plan de continuité | PCA documenté | PLAN_CONTINUITE_ACTIVITE.md | ✅ |
| CC9.2 | Tests de continuité | Tests trimestriels | PLAN_CONTINUITE_ACTIVITE.md §8 | ✅ |

---

## 3. Mapping ISO 27001:2022 Annex A

### A.5 : Politiques de Sécurité de l'Information (2 contrôles)

| Contrôle ISO | Description | Implémentation Maintrix | Statut |
|--------------|-------------|------------------------|:------:|
| A.5.1 | Politiques de sécurité de l'information | POLITIQUE_SECURITE_INFORMATION.md | ✅ |
| A.5.2-A.5.37 | Politiques organisationnelles | Documents de politique complets | ✅ |

### A.5 : Contrôles Organisationnels (37 contrôles)

| Contrôle ISO | Description | Implémentation Maintrix | Document | Statut |
|--------------|-------------|------------------------|----------|:------:|
| A.5.1 | Politiques de sécurité | Politique globale | POLITIQUE_SECURITE_INFORMATION.md | ✅ |
| A.5.2 | Rôles et responsabilités | Structure organisationnelle | POLITIQUE_SECURITE_INFORMATION.md §2.1 | ✅ |
| A.5.3 | Séparation des tâches | RBAC, validation hiérarchique | server/rbac-permissions.ts | ✅ |
| A.5.4 | Responsabilités de direction | Engagement Direction | POLITIQUE_SECURITE_INFORMATION.md §2.1 | ✅ |
| A.5.5 | Contact avec autorités | CNIL, ANSSI | PROCEDURE_REPONSE_INCIDENTS.md §5 | ✅ |
| A.5.6 | Contact groupes d'intérêt | CERT-FR | PROCEDURE_REPONSE_INCIDENTS.md §6 | ✅ |
| A.5.7 | Renseignement sur menaces | Veille sécurité | REGISTRE_RISQUES.md | ✅ |
| A.5.8 | Sécurité gestion de projet | Revue de code, SDLC | POLITIQUE_SECURITE_INFORMATION.md §5.1 | ✅ |
| A.5.9 | Inventaire des actifs | Registre des systèmes | PLAN_CONTINUITE_ACTIVITE.md Annexe B | ✅ |
| A.5.10 | Utilisation acceptable | Politique d'utilisation | POLITIQUE_SECURITE_INFORMATION.md Annexe A | ⚠️ |
| A.5.11 | Restitution des actifs | Procédure départ | POLITIQUE_SECURITE_INFORMATION.md §4.2 | ✅ |
| A.5.12 | Classification | 3 niveaux (Confidentiel/Interne/Public) | POLITIQUE_SECURITE_INFORMATION.md §3 | ✅ |
| A.5.13 | Étiquetage | Classification des documents | POLITIQUE_SECURITE_INFORMATION.md §3 | ✅ |
| A.5.14 | Transfert d'information | Chiffrement TLS | POLITIQUE_SECURITE_INFORMATION.md §5.2 | ✅ |
| A.5.15 | Contrôle d'accès | RBAC, moindre privilège | POLITIQUE_SECURITE_INFORMATION.md §4 | ✅ |
| A.5.16 | Gestion des identités | Création/révocation comptes | POLITIQUE_SECURITE_INFORMATION.md §4.2 | ✅ |
| A.5.17 | Authentification | MFA, mots de passe forts | POLITIQUE_SECURITE_INFORMATION.md §4.3 | ✅ |
| A.5.18 | Droits d'accès | Revue trimestrielle | POLITIQUE_SECURITE_INFORMATION.md §4.2 | ✅ |
| A.5.19-A.5.22 | Sécurité fournisseurs | Évaluation, NDA | POLITIQUE_SECURITE_INFORMATION.md §9 | ✅ |
| A.5.23 | Sécurité cloud | Fournisseurs certifiés SOC 2 | POLITIQUE_SECURITE_INFORMATION.md §9.2 | ✅ |
| A.5.24 | Planification incidents | IRT, procédures | PROCEDURE_REPONSE_INCIDENTS.md | ✅ |
| A.5.25 | Évaluation incidents | Classification P1-P4 | PROCEDURE_REPONSE_INCIDENTS.md §2.2 | ✅ |
| A.5.26 | Réponse incidents | 7 phases de réponse | PROCEDURE_REPONSE_INCIDENTS.md §4 | ✅ |
| A.5.27 | Leçons apprises | Post-mortem | PROCEDURE_REPONSE_INCIDENTS.md §Phase 7 | ✅ |
| A.5.28 | Collecte de preuves | Préservation forensique | PROCEDURE_REPONSE_INCIDENTS.md §4.3.2 | ✅ |
| A.5.29 | Continuité d'activité | PCA | PLAN_CONTINUITE_ACTIVITE.md | ✅ |
| A.5.30 | Préparation TIC | RTO/RPO définis | PLAN_CONTINUITE_ACTIVITE.md §1.3 | ✅ |
| A.5.31-A.5.36 | Exigences légales | RGPD, conformité | POLITIQUE_SECURITE_INFORMATION.md §11 | ✅ |
| A.5.37 | Procédures documentées | Documentation complète | docs/security/ | ✅ |

### A.6 : Contrôles liés aux Personnes (8 contrôles)

| Contrôle ISO | Description | Implémentation Maintrix | Document | Statut |
|--------------|-------------|------------------------|----------|:------:|
| A.6.1 | Sélection candidats | Vérification antécédents (processus RH) | Processus RH interne | ⚠️ |
| A.6.2 | Conditions d'emploi | Clause confidentialité contrat | Contrat de travail | ⚠️ |
| A.6.3 | Sensibilisation | Formation sécurité | POLITIQUE_SECURITE_INFORMATION.md §10 | ✅ |
| A.6.4 | Processus disciplinaire | Sanctions définies | POLITIQUE_SECURITE_INFORMATION.md §12 | ✅ |
| A.6.5 | Responsabilités fin de contrat | Révocation accès 24h | POLITIQUE_SECURITE_INFORMATION.md §4.2 | ✅ |
| A.6.6 | Accord confidentialité | NDA fournisseurs | POLITIQUE_SECURITE_INFORMATION.md §9.1 | ✅ |
| A.6.7 | Travail à distance | Accès sécurisé, VPN | Politique télétravail | ⚠️ |
| A.6.8 | Signalement événements | Canal de signalement | PROCEDURE_REPONSE_INCIDENTS.md §4.1.2 | ✅ |

### A.7 : Contrôles Physiques (14 contrôles)

| Contrôle ISO | Description | Implémentation Maintrix | Document | Statut |
|--------------|-------------|------------------------|----------|:------:|
| A.7.1 | Périmètres physiques | Cloud hébergé - délégué au fournisseur | N/A SaaS | ⚪ |
| A.7.2 | Contrôles d'entrée | Fournisseurs certifiés SOC 2 | Neon, AWS | ⚪ |
| A.7.3 | Sécurisation bureaux | Non applicable (full remote) | N/A | ⚪ |
| A.7.4 | Surveillance | Délégué au fournisseur cloud | N/A | ⚪ |
| A.7.5 | Protection menaces | Délégué au fournisseur cloud | N/A | ⚪ |
| A.7.6 | Travail zones sécurisées | Non applicable | N/A | ⚪ |
| A.7.7 | Bureau propre | Politique télétravail | À définir | ⚠️ |
| A.7.8 | Emplacement équipements | Cloud uniquement | N/A | ⚪ |
| A.7.9 | Sécurité actifs hors site | Postes de travail chiffrés | Politique équipements | ⚠️ |
| A.7.10 | Supports de stockage | Données cloud uniquement | N/A | ⚪ |
| A.7.11 | Services généraux | Délégué fournisseur | N/A | ⚪ |
| A.7.12 | Sécurité câblage | Délégué fournisseur | N/A | ⚪ |
| A.7.13 | Maintenance équipements | Mises à jour automatiques | Nix, Docker | ✅ |
| A.7.14 | Mise au rebut | Suppression sécurisée données | Procédure suppression | ⚠️ |

**Note** : ⚪ = Non applicable (architecture 100% cloud SaaS)

### A.8 : Contrôles Technologiques (34 contrôles)

| Contrôle ISO | Description | Implémentation Maintrix | Fichier/Document | Statut |
|--------------|-------------|------------------------|------------------|:------:|
| A.8.1 | Terminaux utilisateurs | MFA, sessions limitées | server/auth.ts | ✅ |
| A.8.2 | Accès privilégiés | RBAC Super Admin | server/rbac-permissions.ts | ✅ |
| A.8.3 | Restriction accès info | Isolation tenant | server/middleware/tenant.ts | ✅ |
| A.8.4 | Accès code source | Git, revue PR | GitHub/GitLab | ✅ |
| A.8.5 | Authentification sécurisée | bcrypt, sessions sécurisées | server/auth.ts | ✅ |
| A.8.6 | Gestion capacité | Monitoring cloud | GUIDE_MAINTENANCE.md | ✅ |
| A.8.7 | Protection malware | Validation entrées, CSP | server/middleware/security.ts | ✅ |
| A.8.8 | Vulnérabilités techniques | npm audit, mises à jour | REGISTRE_RISQUES.md ACT-002 | ⚠️ |
| A.8.9 | Gestion configuration | Docker, env vars | docker-compose.yml | ✅ |
| A.8.10 | Suppression information | Droit à l'effacement RGPD | API /api/user/delete | ✅ |
| A.8.11 | Masquage données | Données sensibles non affichées | Frontend masquage | ✅ |
| A.8.12 | Prévention fuite données | Audit logs, alertes | server/audit.ts | ✅ |
| A.8.13 | Sauvegarde | Quotidienne, 30 jours | PLAN_CONTINUITE_ACTIVITE.md §4.2 | ✅ |
| A.8.14 | Redondance | Site de secours planifié | PLAN_CONTINUITE_ACTIVITE.md §4.1 | ⚠️ |
| A.8.15 | Journalisation | Audit logs complets | server/audit.ts | ✅ |
| A.8.16 | Activités surveillance | Rate limiting, alertes | server/middleware/security.ts | ✅ |
| A.8.17 | Synchronisation horloges | NTP serveur cloud | Automatique | ✅ |
| A.8.18 | Accès privilégiés utilitaires | Contrôle admin | RBAC | ✅ |
| A.8.19 | Installation logiciels | Déploiement contrôlé | Docker, CI/CD | ✅ |
| A.8.20 | Sécurité réseaux | HTTPS, pare-feu cloud | Infrastructure | ✅ |
| A.8.21 | Sécurité services réseau | TLS 1.2+ | server/index.ts | ✅ |
| A.8.22 | Ségrégation réseaux | Isolation tenant | server/middleware/tenant.ts | ✅ |
| A.8.23 | Filtrage web | Rate limiting | server/middleware/security.ts | ✅ |
| A.8.24 | Cryptographie | TLS, bcrypt | POLITIQUE_SECURITE_INFORMATION.md §5.2 | ✅ |
| A.8.25 | Cycle développement | SDLC sécurisé | POLITIQUE_SECURITE_INFORMATION.md §5.1 | ✅ |
| A.8.26 | Exigences sécurité apps | Validation Zod, TypeScript | shared/schema.ts | ✅ |
| A.8.27 | Architecture sécurisée | Defense in depth | ARCHITECTURE_MAINTRIX.md | ✅ |
| A.8.28 | Codage sécurisé | OWASP, revue code | POLITIQUE_SECURITE_INFORMATION.md §5.1 | ✅ |
| A.8.29 | Tests sécurité | Pentest annuel planifié | REGISTRE_RISQUES.md | ⚠️ |
| A.8.30 | Développement externalisé | NDA, évaluation sécurité | POLITIQUE_SECURITE_INFORMATION.md §9 | ✅ |
| A.8.31 | Séparation environnements | Dev/Test/Prod | docker-compose, .env | ✅ |
| A.8.32 | Gestion changements | Git, PR, revue | CI/CD | ✅ |
| A.8.33 | Données de test | Données anonymisées | Procédure test | ⚠️ |
| A.8.34 | Protection audits | Logs protégés | Permissions fichiers | ✅ |

---

## 4. Résumé de Couverture

### SOC 2 Trust Services Criteria

| Catégorie | Total | Couverts | Partiels | Statut |
|-----------|:-----:|:--------:|:--------:|:------:|
| CC1 - Organisation | 5 | 5 | 0 | ✅ 100% |
| CC2 - Communication | 3 | 3 | 0 | ✅ 100% |
| CC3 - Risques | 4 | 4 | 0 | ✅ 100% |
| CC4 - Contrôles | 2 | 2 | 0 | ✅ 100% |
| CC5 - Surveillance | 3 | 3 | 0 | ✅ 100% |
| CC6 - Accès | 8 | 7 | 1 | ⚠️ 87% |
| CC7 - Incidents | 5 | 5 | 0 | ✅ 100% |
| CC8 - Changements | 1 | 1 | 0 | ✅ 100% |
| CC9 - Continuité | 2 | 2 | 0 | ✅ 100% |
| **TOTAL** | **33** | **32** | **1** | **97%** |

### ISO 27001 Annex A

| Catégorie | Total | Couverts | Partiels | N/A | Statut |
|-----------|:-----:|:--------:|:--------:|:---:|:------:|
| A.5 Organisationnels | 37 | 35 | 2 | 0 | ⚠️ 95% |
| A.6 Personnes | 8 | 5 | 3 | 0 | ⚠️ 62% |
| A.7 Physiques | 14 | 1 | 3 | 10 | ⚠️ N/A* |
| A.8 Technologiques | 34 | 29 | 5 | 0 | ⚠️ 85% |
| **TOTAL** | **93** | **70** | **13** | **10** | **84%** |

*Les contrôles physiques sont majoritairement non applicables pour une architecture 100% cloud SaaS.

---

## 5. Actions Requises pour Certification

### Priorité 1 : Avant Audit SOC 2 Type I

| ID | Action | Contrôle | Responsable | Échéance |
|:--:|--------|----------|-------------|:--------:|
| 1 | Compléter politique d'utilisation acceptable | A.5.10 | RSSI | T1 |
| 2 | Automatiser scans vulnérabilités (Snyk) | A.8.8 | DevOps | T1 |
| 3 | Documenter processus RH sécurité | A.6.1-A.6.2 | RH | T1 |
| 4 | Définir politique télétravail | A.6.7 | RH/RSSI | T1 |

### Priorité 2 : Avant Audit SOC 2 Type II

| ID | Action | Contrôle | Responsable | Échéance |
|:--:|--------|----------|-------------|:--------:|
| 5 | Effectuer premier pentest | A.8.29 | RSSI | T2 |
| 6 | Mettre en place site de secours | A.8.14 | DevOps | T2 |
| 7 | Créer procédure données de test | A.8.33 | Dev | T2 |
| 8 | Politique mise au rebut équipements | A.7.14 | IT | T2 |

### Priorité 3 : Amélioration Continue

| ID | Action | Contrôle | Responsable | Échéance |
|:--:|--------|----------|-------------|:--------:|
| 9 | Formation anti-phishing | A.6.3 | RSSI | Annuel |
| 10 | Tests de restauration | CC9.2 | DBA | Mensuel |
| 11 | Revue des accès | CC6.5 | RSSI | Trimestriel |

---

## 6. Historique des Révisions

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| 1.0 | Janvier 2025 | Agent Maintrix | Création initiale |

---

**Document établi pour démontrer la traçabilité des contrôles SOC 2 et ISO 27001**

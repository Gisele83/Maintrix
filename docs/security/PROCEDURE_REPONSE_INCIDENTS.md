# Procédure de Réponse aux Incidents de Sécurité
## Maintrix - GMAO Intelligente

**Version** : 1.0  
**Date d'entrée en vigueur** : [DATE]  
**Prochaine révision** : [DATE + 1 an]  
**Propriétaire** : RSSI  
**Classification** : Interne

---

## 1. Objectif

Cette procédure définit les étapes à suivre pour détecter, analyser, contenir, éradiquer et récupérer suite à un incident de sécurité affectant les systèmes Maintrix.

---

## 2. Définitions

### 2.1 Incident de Sécurité

Tout événement qui :
- Compromet la confidentialité, l'intégrité ou la disponibilité des données
- Viole les politiques de sécurité de l'organisation
- Représente une menace pour les systèmes ou les utilisateurs

### 2.2 Classification des Incidents

| Niveau | Description | Exemples | Délai de réponse |
|--------|-------------|----------|------------------|
| **P1 - Critique** | Impact majeur sur la production ou fuite de données | Ransomware, fuite de données clients, indisponibilité totale | Immédiat (< 1h) |
| **P2 - Élevé** | Impact significatif sur les opérations | Intrusion détectée, compromission d'un compte admin | < 4 heures |
| **P3 - Moyen** | Impact limité, service partiellement affecté | Tentatives d'intrusion bloquées, malware isolé | < 24 heures |
| **P4 - Bas** | Impact minimal, pas de compromission | Scan de ports, spam, phishing bloqué | < 72 heures |

---

## 3. Équipe de Réponse aux Incidents (IRT)

### 3.1 Composition

| Rôle | Responsabilités | Contact |
|------|-----------------|---------|
| **Coordinateur d'incident** (RSSI) | Pilotage global, communication direction | [EMAIL] / [TEL] |
| **Analyste sécurité** | Investigation technique, analyse forensique | [EMAIL] / [TEL] |
| **Administrateur systèmes** | Actions de containment et remédiation | [EMAIL] / [TEL] |
| **Responsable développement** | Correction des vulnérabilités applicatives | [EMAIL] / [TEL] |
| **Responsable juridique** | Obligations légales, notification CNIL | [EMAIL] / [TEL] |
| **Responsable communication** | Communication externe si nécessaire | [EMAIL] / [TEL] |

### 3.2 Escalade

```
┌─────────────────────────────────────────────────────────────────┐
│  Niveau 1 : Équipe Opérations                                   │
│  → Détection et classification initiale                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Si P1/P2
┌─────────────────────────────────────────────────────────────────┐
│  Niveau 2 : RSSI + Analyste Sécurité                            │
│  → Investigation approfondie et containment                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Si P1 ou fuite de données
┌─────────────────────────────────────────────────────────────────┐
│  Niveau 3 : Direction Générale + Juridique                      │
│  → Décisions stratégiques, notification régulateur              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Phases de Réponse

### Phase 1 : Détection et Signalement

#### 4.1.1 Sources de Détection

| Source | Type d'alerte |
|--------|---------------|
| Monitoring applicatif | Erreurs anormales, pics de charge |
| Logs d'authentification | Échecs multiples, accès inhabituels |
| Alertes SIEM | Patterns de menaces |
| Signalement utilisateur | Comportement suspect observé |
| Notification externe | Client, chercheur en sécurité, autorité |

#### 4.1.2 Comment Signaler

**Pour les employés** :
1. Email : security@maintrix-t.com (24/7)
2. Téléphone urgence : [NUMÉRO]
3. Ne pas tenter de résoudre seul un incident majeur

**Informations à fournir** :
- Date et heure de détection
- Description de l'événement
- Systèmes/utilisateurs affectés
- Actions déjà entreprises
- Coordonnées du rapporteur

### Phase 2 : Triage et Classification

#### 4.2.1 Évaluation Initiale (15 minutes max)

| Question | Impact sur classification |
|----------|---------------------------|
| Des données clients sont-elles compromises ? | → P1 si oui |
| Le service est-il indisponible ? | → P1 si production, P2 si partiel |
| L'attaquant a-t-il encore accès ? | → P1/P2 selon périmètre |
| L'incident est-il contenu ? | → Baisse de 1 niveau si oui |

#### 4.2.2 Documentation Initiale

Créer un ticket d'incident avec :
- ID unique : INC-YYYYMMDD-XXX
- Classification : P1/P2/P3/P4
- Statut : Ouvert
- Chronologie des événements

### Phase 3 : Containment (Confinement)

#### 4.3.1 Actions Immédiates

**Pour P1/P2** :

| Action | Commande / Procédure |
|--------|---------------------|
| Isoler le système compromis | `docker-compose stop app` |
| Révoquer les accès compromis | Désactiver compte + réinitialiser sessions |
| Bloquer IP malveillante | Mise à jour règles pare-feu |
| Préserver les preuves | Snapshot des logs avant toute action |
| Activer page de maintenance | Rediriger trafic vers page statique |

**Commandes de confinement rapide** :

```bash
# Arrêter l'application (préserve les données)
docker-compose stop app

# Révoquer toutes les sessions actives
docker exec maintrix-app node -e "require('./server/auth').revokeAllSessions()"

# Bloquer une IP (iptables)
sudo iptables -A INPUT -s [IP_MALVEILLANTE] -j DROP

# Sauvegarder les logs avant investigation
docker-compose logs > /backup/incident_$(date +%Y%m%d_%H%M%S).log
```

#### 4.3.2 Préservation des Preuves

**Ne PAS** :
- Redémarrer les systèmes avant sauvegarde
- Supprimer des fichiers
- Modifier des configurations

**FAIRE** :
- Capturer les logs : `docker-compose logs > incident_logs.txt`
- Snapshot de la base : `pg_dump -U maintrix maintrix > incident_db.sql`
- Capturer l'état mémoire si possible
- Noter les timestamps précis

### Phase 4 : Investigation

#### 4.4.1 Analyse des Logs

**Points de vérification** :

```bash
# Rechercher les accès suspects
grep -i "failed\|error\|unauthorized" /var/log/maintrix/*.log

# Analyser les connexions récentes
docker exec maintrix-postgres psql -U maintrix -c \
  "SELECT * FROM sessions WHERE created_at > NOW() - INTERVAL '24 hours'"

# Vérifier les modifications de données
docker exec maintrix-postgres psql -U maintrix -c \
  "SELECT * FROM audit_logs WHERE action IN ('DELETE', 'UPDATE') 
   AND timestamp > NOW() - INTERVAL '24 hours'"
```

#### 4.4.2 Questions Clés

| Question | Source de réponse |
|----------|-------------------|
| Qui a accédé au système ? | Logs d'authentification |
| Quelles données ont été accédées ? | Logs applicatifs |
| Comment l'attaquant est-il entré ? | Logs réseau, vulnérabilités |
| Quand l'incident a-t-il commencé ? | Analyse chronologique |
| L'attaquant est-il encore présent ? | Sessions actives, processus |

### Phase 5 : Éradication

#### 4.5.1 Actions de Remédiation

| Cause | Remédiation |
|-------|-------------|
| Compte compromis | Réinitialiser mot de passe + MFA obligatoire |
| Vulnérabilité logicielle | Déployer correctif, mettre à jour dépendances |
| Configuration incorrecte | Corriger et documenter |
| Malware | Réinstaller depuis image propre |
| Fuite de secret | Rotation de toutes les clés API |

#### 4.5.2 Vérification

- [ ] Vulnérabilité corrigée
- [ ] Accès non autorisés révoqués
- [ ] Backdoors potentielles vérifiées
- [ ] Secrets potentiellement exposés renouvelés

### Phase 6 : Récupération

#### 4.6.1 Restauration des Services

```bash
# 1. Vérifier l'intégrité de la base de données
docker exec maintrix-postgres pg_dump -U maintrix maintrix > /tmp/verify.sql

# 2. Redémarrer les services
docker-compose up -d

# 3. Vérifier le fonctionnement
curl -s http://localhost:5000/health | jq

# 4. Surveillance renforcée (24-48h)
docker-compose logs -f app | grep -i "error\|warn"
```

#### 4.6.2 Critères de Retour à la Normale

- [ ] Tous les services fonctionnels
- [ ] Aucune activité suspecte détectée
- [ ] Monitoring renforcé en place
- [ ] Équipe prête à répondre si récurrence

### Phase 7 : Post-Incident

#### 4.7.1 Revue Post-Mortem

**Réunion obligatoire** dans les 5 jours suivant la clôture (P1/P2).

**Agenda** :
1. Chronologie des faits
2. Ce qui a bien fonctionné
3. Ce qui doit être amélioré
4. Actions correctives avec responsables et délais

#### 4.7.2 Rapport d'Incident

| Section | Contenu |
|---------|---------|
| Résumé exécutif | 1 paragraphe pour la direction |
| Chronologie | Timeline détaillée |
| Impact | Données/systèmes/utilisateurs affectés |
| Cause racine | Analyse technique |
| Actions menées | Containment, éradication, récupération |
| Leçons apprises | Améliorations identifiées |
| Plan d'action | Actions préventives avec délais |

---

## 5. Obligations de Notification

### 5.1 Notification CNIL (RGPD)

**Délai** : 72 heures après prise de connaissance si données personnelles concernées.

**Critères de notification** :
- Fuite de données personnelles
- Accès non autorisé aux données clients
- Destruction ou altération de données

**Contenu de la notification** :
- Nature de la violation
- Catégories et nombre de personnes concernées
- Conséquences probables
- Mesures prises pour remédier

### 5.2 Notification des Clients

**Si données client compromises** :
- Notification individuelle par email
- Contenu : nature de l'incident, données concernées, mesures prises, recommandations
- Délai : Dès que possible après confirmation

### 5.3 Notification des Autorités

| Cas | Autorité | Délai |
|-----|----------|-------|
| Fuite données personnelles | CNIL | 72h |
| Cyberattaque majeure | ANSSI | Sans délai |
| Fraude financière | Police/Gendarmerie | Variable |

---

## 6. Contacts d'Urgence

### Internes

| Rôle | Nom | Téléphone | Email |
|------|-----|-----------|-------|
| RSSI | [NOM] | [TEL] | [EMAIL] |
| CTO | [NOM] | [TEL] | [EMAIL] |
| DG | [NOM] | [TEL] | [EMAIL] |

### Externes

| Service | Contact |
|---------|---------|
| CERT-FR (ANSSI) | cert-fr@ssi.gouv.fr |
| CNIL | notifications@cnil.fr |
| Hébergeur (urgence) | [CONTACT] |
| Assurance cyber | [CONTACT] |

---

## 7. Modèles et Checklists

### 7.1 Checklist Incident P1

```
□ IRT alertée et mobilisée
□ Système compromis isolé
□ Preuves préservées (logs, DB snapshot)
□ Direction informée
□ Investigation en cours
□ Plan de communication préparé
□ CNIL notifiée si applicable (sous 72h)
□ Clients notifiés si applicable
□ Éradication terminée
□ Services restaurés
□ Surveillance renforcée active
□ Revue post-mortem planifiée
□ Rapport d'incident rédigé
□ Actions préventives définies
```

### 7.2 Template Email Notification Client

```
Objet : Information importante concernant la sécurité de vos données

Madame, Monsieur,

Nous vous informons que le [DATE], nous avons détecté [DESCRIPTION DE L'INCIDENT].

**Données potentiellement concernées :**
[LISTE]

**Actions que nous avons prises :**
[LISTE DES MESURES]

**Ce que nous vous recommandons :**
[RECOMMANDATIONS : changer mot de passe, surveiller comptes, etc.]

Nous prenons très au sérieux la sécurité de vos données et nous nous excusons 
pour tout désagrément causé par cet incident.

Pour toute question, contactez-nous à : [EMAIL DÉDIÉ]

Cordialement,
L'équipe Maintrix
```

---

## 8. Tests et Exercices

| Type | Fréquence | Objectif |
|------|-----------|----------|
| Exercice tabletop | Semestriel | Tester la procédure sur scénario fictif |
| Test technique | Annuel | Simuler une intrusion réelle |
| Revue de la procédure | Annuel | Mettre à jour les contacts et processus |

---

## 9. Historique des Révisions

| Version | Date | Auteur | Modifications |
|---------|------|--------|---------------|
| 1.0 | [DATE] | [NOM] | Création initiale |

---

**Document rédigé conformément aux exigences SOC 2 (CC7) et ISO 27001 (A.16)**

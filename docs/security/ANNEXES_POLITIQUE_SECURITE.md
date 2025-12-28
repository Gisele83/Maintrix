# Annexes à la Politique de Sécurité de l'Information
## Maintrix - GMAO Intelligente

**Version** : 1.0  
**Date** : Janvier 2025  
**Classification** : Interne

---

## Annexe A : Politique d'Utilisation Acceptable

### A.1 Objectif

Définir les règles d'utilisation acceptable des ressources informatiques de Maintrix par tous les employés, contractuels et partenaires.

### A.2 Périmètre

Cette politique couvre :
- Ordinateurs et équipements fournis par l'entreprise
- Comptes et accès aux systèmes Maintrix
- Accès internet et email professionnel
- Données de l'entreprise et des clients

### A.3 Utilisation Autorisée

Les ressources informatiques sont destinées à :
- L'exécution des tâches professionnelles
- La communication professionnelle
- La formation et le développement professionnel
- L'utilisation personnelle raisonnable et limitée

### A.4 Utilisation Interdite

Il est strictement interdit de :

| Catégorie | Actions interdites |
|-----------|-------------------|
| **Sécurité** | Partager ses identifiants, désactiver les protections, installer des logiciels non autorisés |
| **Données** | Copier des données clients sur supports personnels, transmettre des données confidentielles sans autorisation |
| **Comportement** | Accéder à des contenus illégaux, harcèlement, utilisation excessive de ressources |
| **Réseau** | Contourner les contrôles de sécurité, utiliser des VPN non autorisés |

### A.5 Email et Communication

- L'email professionnel est destiné à un usage professionnel
- Les communications confidentielles doivent être chiffrées si nécessaire
- La signature électronique officielle doit être utilisée
- Les pièces jointes suspectes ne doivent jamais être ouvertes

### A.6 Mots de Passe

| Exigence | Valeur |
|----------|--------|
| Longueur minimale | 12 caractères |
| Complexité | Majuscules, minuscules, chiffres, symboles |
| Expiration | 90 jours (recommandé) |
| Historique | 5 derniers mots de passe non réutilisables |
| Partage | Strictement interdit |

### A.7 Travail à Distance

Les employés travaillant à distance doivent :
- Utiliser une connexion sécurisée (VPN si requis)
- Verrouiller leur poste en cas d'absence
- Ne pas travailler dans des lieux publics sans écran de confidentialité
- Sécuriser physiquement leurs équipements

### A.8 Signalement

Tout incident ou comportement suspect doit être signalé immédiatement :
- Email : security@maintrix-t.com
- Canal interne : #securite (Slack/Teams)

### A.9 Sanctions

Le non-respect de cette politique peut entraîner des mesures disciplinaires allant de l'avertissement au licenciement, et potentiellement des poursuites judiciaires.

---

## Annexe B : Inventaire des Actifs Informationnels

### B.1 Actifs Logiciels

| Actif | Type | Classification | Propriétaire | Criticité |
|-------|------|----------------|--------------|:---------:|
| Plateforme Maintrix | Application SaaS | Confidentiel | CTO | Critique |
| Code source | Propriété intellectuelle | Confidentiel | CTO | Critique |
| Base de données clients | Données | Confidentiel | DPO | Critique |
| Documentation technique | Documentation | Interne | CTO | Élevée |
| Site web marketing | Application | Public | Marketing | Moyenne |

### B.2 Actifs Infrastructure

| Actif | Type | Fournisseur | Classification | Criticité |
|-------|------|-------------|----------------|:---------:|
| Production SaaS | Hébergement | Replit/AWS | Confidentiel | Critique |
| Base de données | PostgreSQL | Neon | Confidentiel | Critique |
| DNS | Service | Cloudflare | Interne | Élevée |
| Certificats SSL | Sécurité | Let's Encrypt | Confidentiel | Élevée |
| Sauvegardes | Stockage | AWS S3 | Confidentiel | Critique |

### B.3 Actifs Données

| Type de données | Classification | Rétention | Protection |
|-----------------|----------------|-----------|------------|
| Données clients (maintenance) | Confidentiel | Durée contrat + 5 ans | Chiffrement, RBAC |
| Logs d'accès | Interne | 1 an | Accès restreint |
| Logs d'erreur | Interne | 90 jours | Accès équipe technique |
| Données de paiement | Confidentiel | Via Stripe (PCI DSS) | Jamais stockées localement |
| Données RH employés | Confidentiel | Durée emploi + légal | Accès RH uniquement |

### B.4 Actifs Humains (Rôles Clés)

| Rôle | Responsabilité | Suppléant | Accès critique |
|------|----------------|-----------|----------------|
| CTO | Architecture, production | Lead Dev | Tous |
| RSSI | Sécurité | CTO | Sécurité, conformité |
| DBA | Base de données | DevOps | Production DB |
| Lead Dev | Code, déploiement | Senior Dev | Code source |

---

## Annexe C : Processus du Cycle de Vie Sécurisé (SDLC)

### C.1 Phases du Développement Sécurisé

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Conception │───►│ Développement│───►│    Test    │
│   sécurisée │    │   sécurisé  │    │  sécurité  │
└─────────────┘    └─────────────┘    └─────────────┘
                                             │
┌─────────────┐    ┌─────────────┐           │
│   Retrait   │◄───│ Exploitation│◄──────────┘
│   sécurisé  │    │  sécurisée  │
└─────────────┘    └─────────────┘
```

### C.2 Conception Sécurisée

| Activité | Description | Responsable |
|----------|-------------|-------------|
| Modélisation des menaces | Identifier les risques potentiels | Lead Dev + RSSI |
| Revue d'architecture | Valider les choix de sécurité | CTO |
| Définition des exigences sécurité | Documenter les contrôles requis | RSSI |

### C.3 Développement Sécurisé

| Pratique | Implémentation Maintrix |
|----------|------------------------|
| Validation des entrées | Schemas Zod pour toutes les API |
| Échappement des sorties | React JSX automatique |
| Requêtes paramétrées | ORM Drizzle exclusivement |
| Gestion des erreurs | Pas de stack traces exposées |
| Journalisation | Audit des actions sensibles |
| Authentification | bcrypt, sessions sécurisées |
| Autorisation | RBAC centralisé |
| Chiffrement | TLS 1.2+, PostgreSQL |

### C.4 Revue de Code

Toute modification doit :
1. Passer une Pull Request
2. Être revue par au moins 1 développeur
3. Passer les tests automatisés
4. Être approuvée avant merge

### C.5 Tests de Sécurité

| Type | Fréquence | Outil/Méthode |
|------|-----------|---------------|
| Analyse statique (SAST) | À chaque PR | TypeScript, ESLint |
| Scan dépendances | Hebdomadaire | npm audit, Snyk |
| Tests d'intrusion | Annuel | Prestataire externe |
| Tests fonctionnels sécurité | Continu | Tests automatisés |

### C.6 Déploiement Sécurisé

| Étape | Contrôle |
|-------|----------|
| Build | Environnement reproductible (Docker) |
| Configuration | Variables d'environnement, pas de secrets en dur |
| Déploiement | Rolling update, rollback possible |
| Vérification | Health checks automatiques |

---

## Annexe D : Sécurité des Ressources Humaines

### D.1 Avant l'Embauche

| Activité | Description | Responsable |
|----------|-------------|-------------|
| Vérification antécédents | Selon le poste et la législation | RH |
| Référencement | Vérification des précédents employeurs | RH |
| NDA | Signature avant accès aux données | RH/Juridique |

### D.2 Pendant l'Emploi

| Activité | Fréquence | Responsable |
|----------|-----------|-------------|
| Formation sécurité initiale | À l'embauche | RSSI |
| Rappel sécurité | Annuel | RSSI |
| Revue des accès | Trimestriel | Manager + IT |
| Évaluation des compétences | Annuel | Manager |

### D.3 Contenu de la Formation Sécurité

| Module | Durée | Public |
|--------|-------|--------|
| Sensibilisation de base | 2h | Tous |
| Reconnaissance phishing | 1h | Tous |
| Gestion mots de passe | 30min | Tous |
| OWASP Top 10 | 4h | Développeurs |
| Administration sécurisée | 4h | Ops/Admin |
| Gestion incidents | 2h | IRT |

### D.4 Fin de Contrat

| Activité | Délai | Responsable |
|----------|-------|-------------|
| Révocation des accès | Immédiat ou < 24h | IT |
| Récupération des équipements | Dernier jour | IT/RH |
| Transfert des connaissances | Avant départ | Manager |
| Suppression données personnelles | 30 jours | IT |
| Archivage données professionnelles | Selon politique | Manager |

### D.5 Obligations Contractuelles

Tous les contrats de travail incluent :
- Clause de confidentialité
- Accord de propriété intellectuelle
- Engagement de respect des politiques de sécurité
- Obligations post-contrat (confidentialité maintenue)

---

## Annexe E : Sécurité Physique et Environnementale (Architecture Cloud)

### E.1 Justification

Maintrix étant une solution 100% cloud SaaS, les contrôles physiques traditionnels sont délégués aux fournisseurs d'infrastructure cloud.

### E.2 Fournisseurs et Certifications

| Fournisseur | Service | Certifications |
|-------------|---------|----------------|
| Neon | PostgreSQL | SOC 2 Type II |
| Replit | Hébergement dev | En cours |
| AWS | Production/Backup | SOC 2, ISO 27001, PCI DSS |
| Scaleway | Alternative EU | ISO 27001, HDS |
| Cloudflare | CDN/DNS | SOC 2, ISO 27001 |

### E.3 Sécurité des Postes de Travail (Télétravail)

| Exigence | Implémentation |
|----------|----------------|
| Chiffrement disque | Obligatoire (BitLocker/FileVault) |
| Verrouillage automatique | 5 minutes d'inactivité |
| Antivirus/EDR | Recommandé (selon OS) |
| Mises à jour | Automatiques ou sous 7 jours |
| Pare-feu local | Activé |
| VPN | Pour accès ressources sensibles |

### E.4 Mise au Rebut des Équipements

| Type | Procédure |
|------|-----------|
| Ordinateurs | Effacement sécurisé (DoD 5220.22-M) puis destruction physique |
| Téléphones | Réinitialisation usine |
| Supports amovibles | Destruction physique |
| Documents papier | Déchiqueteuse (DIN 66399 niveau P-4 minimum) |

---

## Annexe F : Métriques et Indicateurs de Sécurité

### F.1 Indicateurs Opérationnels (KPI)

| Indicateur | Cible | Fréquence | Source |
|------------|-------|-----------|--------|
| Disponibilité service | > 99.5% | Mensuel | Monitoring |
| Temps moyen de détection incident | < 1h | Par incident | SIEM |
| Temps moyen de résolution incident P1 | < 4h | Par incident | Tickets |
| Taux de patch critique sous 7 jours | 100% | Mensuel | Inventaire |
| Vulnérabilités critiques ouvertes | 0 | Hebdomadaire | Scans |

### F.2 Indicateurs de Conformité (KRI)

| Indicateur | Cible | Fréquence | Source |
|------------|-------|-----------|--------|
| % employés formés sécurité | 100% | Annuel | RH |
| % revues d'accès complétées | 100% | Trimestriel | Audit |
| Incidents de sécurité | Tendance ↓ | Mensuel | Registre |
| Risques élevés non traités | 0 | Mensuel | Registre risques |
| Tests de restauration réussis | 100% | Mensuel | DBA |

### F.3 Tableau de Bord Sécurité

Le RSSI présente mensuellement au Comité de Sécurité :
- Statut des indicateurs (vert/orange/rouge)
- Incidents du mois
- Évolution des risques
- Avancement des plans d'action
- Prochaines échéances (audits, certifications)

---

**Ces annexes complètent la Politique de Sécurité de l'Information principale.**
**Toute modification doit être approuvée par le RSSI et la Direction.**

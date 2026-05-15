# Maintrix — Manuel utilisateur v2.6.0

## Présentation

Maintrix est une plateforme industrielle intelligente qui centralise :
- La **supervision des équipements** en temps réel
- La **gestion de maintenance** (GMAO) préventive et corrective
- Le **diagnostic IA** basé sur 120+ cas historiques et l'IA Claude
- Le **suivi analytique** (OEE, RCA, FMEA, actifs, budget)

---

## 1. Connexion et profil

### Se connecter
1. Ouvrir l'application dans votre navigateur (ou l'application desktop)
2. Saisir votre **nom d'utilisateur** et **mot de passe**
3. Cliquer **Se connecter**
4. Si le MFA est activé, saisir le code de votre application d'authentification

### Modifier son profil
- Cliquer sur votre avatar en haut à droite
- Sélectionner **Mon profil**
- Modifier prénom, nom, téléphone
- Le **nom d'utilisateur ne peut pas être modifié** (sécurité)

### Changer de mot de passe
- Menu **Mon profil → Changer le mot de passe**
- Saisir l'ancien mot de passe puis le nouveau (min. 12 caractères)

---

## 2. Tableau de bord

Le tableau de bord affiche en temps réel :
- **Équipements critiques** — statut et alertes
- **Ordres de travail** — en cours et en attente
- **KPIs** — OEE global, taux de disponibilité, MTBF/MTTR
- **Alertes actives** — classées par priorité
- **Données IoT** — température, vibration, pression

---

## 3. GMAO (Gestion de Maintenance)

### Équipements
**Ajouter un équipement**
1. Menu **GMAO → Équipements**
2. Cliquer **Ajouter un équipement**
3. Renseigner : nom, type, localisation, fabricant, numéro de série
4. Cliquer **Enregistrer**

**Scanner un QR code** (mobile)
- Ouvrir l'application mobile
- Taper l'icône QR code
- Pointer la caméra sur l'étiquette de l'équipement
- La fiche de l'équipement s'ouvre automatiquement

### Ordres de travail
**Créer un ordre de travail**
1. Menu **GMAO → Ordres de travail**
2. Cliquer **Nouvel OT**
3. Renseigner : titre, description, équipement, type (préventif/correctif/urgence)
4. Définir la priorité et la date planifiée
5. Assigner à un technicien
6. Cliquer **Créer**

**Statuts d'un OT**
- **Ouvert** — créé, non démarré
- **En cours** — technicien au travail
- **Terminé** — intervention réalisée
- **Annulé** — abandonné

### Maintenance préventive
- Planifier des inspections périodiques
- Définir la fréquence (journalière, hebdomadaire, mensuelle, annuelle)
- Les OT préventifs sont générés automatiquement à l'échéance

---

## 4. Diagnostic IA

### Lancer un diagnostic
1. Menu **Diagnostic IA**
2. Décrire les **symptômes** observés en texte libre
3. Sélectionner le **type d'équipement**
4. Définir l'**urgence** (faible/moyen/élevé)
5. Cliquer **Analyser**

Le système analyse vos symptômes en combinant :
- La base de 120+ cas historiques industriels
- L'IA Claude Anthropic pour la structuration
- Les règles expertes métier

### Interpréter les résultats
- **Diagnostic** — cause probable identifiée
- **Confiance** — pourcentage de certitude
- **Solution recommandée** — actions à réaliser
- **Durée estimée** — temps d'intervention prévu
- **Coût estimé** — estimation budgétaire
- **Cas similaires** — références historiques
- **Conseils préventifs** — pour éviter la récidive

### Importer vos données historiques
1. Menu **Diagnostic → Importer données**
2. Télécharger le modèle Excel
3. Remplir avec vos cas historiques
4. Importer le fichier

---

## 5. OEE (Overall Equipment Effectiveness)

L'OEE mesure l'efficacité globale d'un équipement :
**OEE = Disponibilité × Performance × Qualité**

### Enregistrer une mesure
1. Menu **OEE**
2. Cliquer **Nouvelle mesure**
3. Sélectionner l'équipement et la date
4. Saisir : disponibilité (%), performance (%), qualité (%)
5. Cliquer **Enregistrer**

### Interpréter les scores
- **≥ 85%** — Classe mondiale
- **60–85%** — Bon
- **40–60%** — À améliorer
- **< 40%** — Critique

---

## 6. RCA — Analyse des causes racines

La RCA permet d'identifier la cause profonde d'une défaillance.

### Créer une analyse
1. Menu **RCA**
2. Cliquer **Nouvelle analyse**
3. Décrire le problème et son impact
4. Choisir la méthode : **5 Pourquoi**, **Ishikawa**, **FMEA**, ou **Arbre des défauts**
5. Renseigner les causes identifiées
6. Définir le plan d'action et les responsables
7. Documenter les leçons apprises

---

## 7. FMEA / AMDEC

L'AMDEC analyse les modes de défaillance, leurs effets et leur criticité.

**IPR (Indice de Priorité du Risque) = Occurrence × Gravité × Détection**

- **IPR < 50** — Acceptable
- **50–100** — À surveiller
- **> 100** — Action corrective obligatoire

---

## 8. Actifs — Cycle de vie

Suivi complet de chaque actif depuis l'acquisition jusqu'au rebut :
- **Acquisition** — achat, mise en service
- **Exploitation** — performances, MTBF/MTTR
- **Maintenance** — historique complet
- **Fin de vie** — critères de remplacement, rebut

---

## 9. Alertes et notifications

### Types d'alertes
- **Critique** (rouge) — arrêt immédiat requis
- **Élevé** (orange) — intervention urgente
- **Moyen** (jaune) — action sous 24h
- **Info** (bleu) — information

### Canaux de notification
- Interface web (bannière en temps réel)
- Email (SendGrid)
- Application mobile (push)
- Slack / Teams / Telegram (si configuré)

---

## 10. Rapports

### Générer un rapport
1. Menu **Rapports**
2. Choisir le type : intervention, mensuel, OEE, budget...
3. Sélectionner la période
4. Cliquer **Générer PDF**

### Rapport automatique mensuel
Les rapports mensuels sont générés automatiquement le 1er de chaque mois et envoyés par email aux managers.

---

## 11. Application mobile

L'application mobile Maintrix (Android / iOS) permet :
- Consulter le tableau de bord en déplacement
- Recevoir les alertes push
- Gérer les interventions terrain
- Scanner les QR codes des équipements
- Prendre des photos d'incidents
- Valider les interventions avec signature électronique
- Travailler **hors ligne** (synchronisation automatique dès reconnexion)

---

## 12. Essai gratuit et abonnement

### Essai gratuit 14 jours
- Accès complet à toutes les fonctionnalités
- Aucune carte bancaire requise
- Compteur visible dans la bannière de l'application

### Plans disponibles
| Plan | Prix | Utilisateurs | Fonctionnalités |
|------|------|-------------|----------------|
| Solo | 29,99€/mois | 1 | GMAO + Diagnostic |
| Équipe | 89,99€/mois | 2-5 | + Collaboration |
| Entreprise S | 189,99€/mois | 6-11 | + Rapports avancés |
| Entreprise M | 349,99€/mois | 12-20 | + IoT + ERP |
| Entreprise L | Sur devis | 21+ | + White-label + 24/7 |

### Passer à un plan payant
1. Menu **Abonnement**
2. Choisir un plan
3. Payer par carte (Stripe) ou PayPal
4. La licence est activée immédiatement

---

## 13. Support et aide

- **Documentation en ligne** : docs.maintrix.io
- **Support** : support@maintrix.io
- **Téléphone** : +33 (0)1 XX XX XX XX (Enterprise uniquement)
- **Chat en direct** : disponible dans l'application (icône bulle)

# 📚 Index Documentation Complète Maintrix

## Infrastructure Cognitive Industrielle - Centre de Documentation v2026

---

# 🎯 Navigation Rapide Documentation

## 📖 Documentation Technique Principale

### 1. Architecture Globale
**Fichier :** `ARCHITECTURE_GLOBALE_MAINTRIX.md`
**Contenu :** Architecture complète de l'Infrastructure Cognitive Industrielle
**Sections :**
- Architecture unifiée Infrastructure Cognitive Industrielle
- Module Diagnostic IA (Claude Anthropic, 631 cas industriels)
- Module GMAO complet (équipements, OT, maintenance préventive)
- Module IoT & Monitoring temps réel
- Module Sécurité avancée (RBAC, multi-tenant)
- Module Paiements (Stripe, PayPal)
- Infrastructure Cognitive (agents, knowledge graph, physics models)

### 2. Guides d'Utilisation Pratiques
**Fichier :** `GUIDES_UTILISATION_COMPLETS.md`
**Contenu :** Guides pratiques détaillés par fonctionnalité
**Sections :**
- Guide Diagnostic IA (accès, modes ML, workflows)
- Guide GMAO (équipements, OT, maintenance préventive, stocks)
- Guide IoT & Monitoring (capteurs, alertes, dashboard)
- Guide Sécurité et accès (rôles, permissions, audit)
- Guide Reporting (KPIs, rapports automatiques, exports)

### 3. Manuel Utilisateur Complet
**Fichier :** `MANUEL_UTILISATEUR_COMPLET.md`
**Contenu :** Manuel de référence utilisateur final
**Sections :**
- Prise en main rapide et première connexion
- Diagnostic IA : utilisation détaillée
- GMAO : workflows complets tous modules
- IoT & Monitoring : surveillance temps réel
- Sécurité et gestion des accès

---

# 🧠 Infrastructure Cognitive

### Tableau de Bord Cognitif
**Route :** `/cognitive-infrastructure`
Dashboard de l'infrastructure cognitive avec vue d'ensemble système, agents, graphe de connaissances et modèles physiques

### Système Multi-Agents
- **Agent Équipement** — Surveillance et diagnostic par équipement individuel
- **Agent Site** — Coordination et optimisation au niveau site
- **Agent Global** — Apprentissage inter-sites et politiques globales

### Graphe de Connaissances
- 48+ nœuds, 46+ arêtes
- Raisonnement causal pour diagnostic avancé
- Apprentissage continu par retour d'expérience

### Modèles Physiques Hybrides
- Durée de vie roulements (bearing life)
- Cavitation pompes (pump cavitation)
- Thermique moteurs (motor thermal)
- Performance compresseurs (compressor efficiency)

### Autonomie Graduée (Niveaux 0-5)
- **Niveau 0** — Manuel : toutes décisions par l'opérateur
- **Niveau 1** — Assisté : suggestions IA avec validation humaine
- **Niveau 2** — Semi-autonome : actions automatiques pour cas simples
- **Niveau 3** — Supervisé : autonomie avec supervision humaine
- **Niveau 4** — Autonome : décisions autonomes avec exceptions escaladées
- **Niveau 5** — Pleinement autonome : gestion complète par l'IA

### Intégrations Communication
**Route :** `/communication-integrations`
Dispatch multi-canal intégré :
- Slack
- Microsoft Teams
- Telegram
- WhatsApp

---

# 🔌 API Cognitive (`/api/cognitive/*`)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/cognitive/status` | GET | Statut du système cognitif |
| `/api/cognitive/agents` | GET | Registre des agents |
| `/api/cognitive/agents/site/:siteId` | GET | Agent de site spécifique |
| `/api/cognitive/agents/equipment/:equipmentId` | GET | Agent d'équipement spécifique |
| `/api/cognitive/closed-loop/:equipmentId` | POST | Traitement en boucle fermée |
| `/api/cognitive/autonomy` | GET/PUT | Niveaux d'autonomie graduée |
| `/api/cognitive/policies` | GET/POST | Moteur de politiques |
| `/api/cognitive/audit-log` | GET | Journal d'audit des décisions |
| `/api/cognitive/knowledge-graph` | GET | Graphe de connaissances |
| `/api/cognitive/knowledge-graph/reason` | POST | Raisonnement causal |
| `/api/cognitive/knowledge-graph/learn` | POST | Apprentissage par expérience |
| `/api/cognitive/physics-model` | POST | Modèles physiques hybrides |
| `/api/cognitive/what-if` | POST | Simulation what-if |
| `/api/cognitive/global-learning` | GET | Apprentissage inter-sites |

---

# 📡 API Communication (`/api/communication-channels`)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/communication-channels` | GET | Liste des canaux configurés |
| `/api/communication-channels/:id` | GET | Détails d'un canal |
| `/api/communication-channels` | POST | Créer un canal |
| `/api/communication-channels/:id` | PATCH | Modifier un canal |
| `/api/communication-channels/:id` | DELETE | Supprimer un canal |
| `/api/communication-channels/:id/test` | POST | Tester un canal |
| `/api/communication-channels/dispatch` | POST | Envoyer un message multi-canal |
| `/api/communication-channels/delivery/logs` | GET | Logs de livraison |
| `/api/communication-channels/delivery/stats` | GET | Statistiques de livraison |

---

# 🆕 Fonctionnalités Avancées (Février 2026)

### Portail Client
**Route :** `/client-portal`
Accès public par token pour clients - suivi des ordres de travail sans authentification

### Gestion SLA
**Route :** `/sla-management`
Règles SLA par priorité, suivi de conformité, alertes de dépassement, escalade automatique

### Score Santé Machine
**Route :** `/machine-health`
Scores de santé 0-100, évaluation des risques, recommandations IA pour maintenance prédictive

### Alertes Intelligentes
**Route :** `/smart-alerts`
Alertes IA avec détection de patterns, recommandations d'actions contextuelles

### Hub Capteurs IoT
**Route :** `/sensor-hub`
Monitoring IoT temps réel - Modbus, MQTT, OPC-UA, LoRaWAN

### QR Codes Équipements
**Route :** `/equipment-qr`
Génération et impression de QR codes pour identification rapide des équipements

---

# 🎓 Formation et Apprentissage

### 4. Manuel de Formation
**Fichier :** `MANUEL_FORMATION_MAINTRIX.md`
**Contenu :** Programme formation professionnel multi-niveaux

### 5. Mise à Jour Formation
**Fichier :** `GUIDE_FORMATION_MISE_A_JOUR.md`
**Contenu :** Nouvelles fonctionnalités et interface moderne

---

# 🔧 Guides Spécialisés et Techniques

### 6. Guide Navigation Interface
**Fichier :** `GUIDE_NOUVELLE_NAVIGATION.md`
**Contenu :** Navigation moderne avec glassmorphisme

### 7. Guide Mobile Application
**Fichier :** `GUIDE_MOBILE_APP.md`
**Contenu :** Application React Native avec mode offline

### 8. Guide Importation Données
**Fichier :** `GUIDE_IMPORTATION_DONNEES.md`
**Contenu :** Import/export données (CSV, Excel, JSON)

### 9. Guide Pièces Justificatives
**Fichier :** `GUIDE_PIECES_JUSTIFICATIVES.md`
**Contenu :** Upload de documents pour bons de commande

### 10. Guide Démarrage Rapide
**Fichier :** `GUIDE_DEMARRAGE_RAPIDE.md`
**Contenu :** Installation et premiers pas en 5 minutes

---

# 📊 Business et Présentation

### 11. Présentation Commerciale
**Fichier :** `PRESENTATION_COMMERCIALE_MAINTRIX.md`
**Contenu :** Présentation commerciale et positionnement marché

### 12. Pitch Deck
**Fichier :** `PITCH_DECK_OUTLINE.md`
**Contenu :** Support commercial structuré - 25 slides

### 13. Arguments Vente
**Fichier :** `ARGUMENTS_VENTE_CLES.md`
**Contenu :** Différenciation concurrentielle, bénéfices mesurables

### 14. Brochure
**Fichier :** `BROCHURE_MAINTRIX.md`
**Contenu :** Brochure commerciale Maintrix

### 15. One Pager
**Fichier :** `MAINTRIX_ONE_PAGER.md`
**Contenu :** Résumé exécutif une page

---

# 🛡️ Sécurité et Conformité

### 16. Guide Sécurité
**Fichier :** `SECURITY_GUIDE.md`
**Contenu :** Sécurité multicouche et conformité (ISO 27001, RGPD)

### 17. Guide RBAC
**Fichier :** `RBAC_GUIDE.md`
**Contenu :** 7 rôles, permissions granulaires, isolation données

### 18. Sécurité Paiements
**Fichier :** `SECURITE_PAIEMENTS_COMPLET.md`
**Contenu :** Sécurité Stripe et PayPal

### 19. Documentation SOC 2 / ISO 27001
**Dossier :** `docs/security/`
**Fichiers :**
- `POLITIQUE_SECURITE_INFORMATION.md` - Politique de sécurité
- `PROCEDURE_REPONSE_INCIDENTS.md` - Réponse aux incidents
- `PLAN_CONTINUITE_ACTIVITE.md` - Plan de continuité (PCA)
- `REGISTRE_RISQUES.md` - 14 risques identifiés
- `MAPPING_CONTROLES_SOC2_ISO27001.md` - Mapping contrôles (97% SOC 2)
- `ANNEXES_POLITIQUE_SECURITE.md` - Annexes politiques

---

# 📈 Installation et Déploiement

### 20. Installation Rapide
**Fichier :** `INSTALL.md`
**Contenu :** Guide express installation locale et cloud

### 21. Installation Locale Détaillée
**Fichier :** `INSTALLATION_LOCALE.md`
**Contenu :** Guide complet pas à pas pour Linux/macOS

### 22. Installation Windows
**Fichier :** `INSTALLATION_WINDOWS.md`
**Contenu :** Guide complet pour Windows 10/11

### 23. FAQ Technique
**Fichier :** `FAQ_TECHNIQUE.md`
**Contenu :** Questions techniques fréquentes

### 24. Guide Démonstration
**Fichier :** `DEMO_GUIDE.md`
**Contenu :** Scénarios démonstration client

---

# 📝 Rapports et Historique

### 25. Rapport Conformité GMAO
**Fichier :** `GMAO_COMPLIANCE_REPORT.md`
**Contenu :** Analyse conformité standards industriels

### 26. Rapport Rebranding
**Fichier :** `REBRANDING_REPORT.md`
**Contenu :** Migration Smart GMAO DiagFix → Maintrix

### 27. Rapport Nettoyage
**Fichier :** `NETTOYAGE_PROJET.md`
**Contenu :** Nettoyage et consolidation du projet

---

# 🔄 Organisation Documentation

## Structure Hiérarchique
```
📚 Documentation Maintrix - Infrastructure Cognitive Industrielle
├── 📖 Documentation Technique
│   ├── Architecture Globale (ARCHITECTURE_GLOBALE_MAINTRIX.md)
│   ├── Manuel Utilisateur (MANUEL_UTILISATEUR_COMPLET.md)
│   └── Guides Utilisation (GUIDES_UTILISATION_COMPLETS.md)
│
├── 🧠 Infrastructure Cognitive
│   ├── Dashboard Cognitif (/cognitive-infrastructure)
│   ├── Système Multi-Agents (Equipment, Site, Global)
│   ├── Graphe de Connaissances (48+ nœuds, 46+ arêtes)
│   ├── Modèles Physiques (roulements, pompes, moteurs, compresseurs)
│   ├── Autonomie Graduée (Niveaux 0-5)
│   └── Communication Multi-Canal (/communication-integrations)
│
├── 🆕 Fonctionnalités Avancées 2026
│   ├── Portail Client (/client-portal)
│   ├── Gestion SLA (/sla-management)
│   ├── Score Santé Machine (/machine-health)
│   ├── Alertes Intelligentes (/smart-alerts)
│   ├── Hub Capteurs IoT (/sensor-hub)
│   └── QR Codes Équipements (/equipment-qr)
│
├── 🎓 Formation
│   ├── Manuel Formation (MANUEL_FORMATION_MAINTRIX.md)
│   └── Mise à Jour (GUIDE_FORMATION_MISE_A_JOUR.md)
│
├── 🔧 Guides Spécialisés
│   ├── Navigation (GUIDE_NOUVELLE_NAVIGATION.md)
│   ├── Mobile (GUIDE_MOBILE_APP.md)
│   ├── Import Données (GUIDE_IMPORTATION_DONNEES.md)
│   └── Pièces Justificatives (GUIDE_PIECES_JUSTIFICATIVES.md)
│
├── 📊 Commercial
│   ├── Présentation (PRESENTATION_COMMERCIALE_MAINTRIX.md)
│   ├── Pitch Deck (PITCH_DECK_OUTLINE.md)
│   └── Brochure (BROCHURE_MAINTRIX.md)
│
├── 🛡️ Sécurité
│   ├── Guide Sécurité (SECURITY_GUIDE.md)
│   ├── RBAC (RBAC_GUIDE.md)
│   └── SOC 2 / ISO 27001 (docs/security/)
│
└── 📈 Déploiement
    ├── Installation (INSTALL.md)
    ├── Docker (Dockerfile, docker-compose.yml)
    └── Scripts (scripts/)
```

---

**Maintrix - Infrastructure Cognitive Industrielle - Documentation Complète v2026**
**© 2026 Maintrix - Tous droits réservés**

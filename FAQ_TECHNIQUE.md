# FAQ Technique - Maintrix

## Questions Techniques Fréquentes

### 🔧 Architecture et Technologie

#### Q: Quelles technologies sont utilisées dans Maintrix ?
**R:** Maintrix utilise une stack moderne complète :
- **Frontend**: React.js 18 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express.js 
- **IA/ML**: Python avec scikit-learn, TensorFlow, pandas, numpy
- **Base de données**: PostgreSQL avec ORM Drizzle
- **Déploiement**: Docker containerisation ready

#### Q: Quelle est la performance des algorithmes ML ?
**R:** Nos métriques de performance :
- **Précision globale**: 85-95% selon le type d'équipement
- **Temps de réponse**: < 2 secondes pour un diagnostic
- **Algorithmes**: 9 modèles ML en mode ensemble
- **Entraînement**: Auto-réentraînement basé sur feedback

#### Q: Comment fonctionne le mode Ensemble ML ?
**R:** Le mode Ensemble combine :
- Random Forest + Gradient Boosting (base)
- Support Vector Machine (SVM)
- Multi-Layer Perceptron (neural network)
- K-Nearest Neighbors
- Decision Tree
- Logistic Regression
- Gaussian Naive Bayes
- AdaBoost
- Extra Trees

Chaque algorithme vote, et un consensus pondéré détermine le diagnostic final.

---

### 🔗 Intégrations et APIs

#### Q: Maintrix peut-il s'intégrer à notre GMAO existante ?
**R:** Oui, via plusieurs méthodes :
- **API REST** complète pour intégration bidirectionnelle
- **Import/Export** CSV, Excel, JSON
- **Webhooks** pour notifications temps réel
- **Connecteurs** pré-construits pour SAP, Oracle, Maximo

#### Q: Quels formats de données sont supportés pour l'import ?
**R:** Formats supportés :
- **CSV** avec templates fournis
- **Excel** (.xlsx) multi-feuilles
- **JSON** via API REST
- **XML** pour systèmes legacy
- **Base de données** directe via connecteurs

#### Q: Comment connecter des capteurs IoT ?
**R:** Intégration IoT prévue via :
- **MQTT** pour capteurs temps réel
- **OPC-UA** pour systèmes industriels
- **Modbus** pour équipements classiques
- **API REST** pour systèmes personnalisés

---

### 🛡️ Sécurité et Conformité

#### Q: Quelles sont les mesures de sécurité ?
**R:** Sécurité multicouche :
- **Chiffrement** bout-en-bout (TLS 1.3)
- **Authentification** multi-facteurs optionnelle
- **RBAC** (Role-Based Access Control)
- **Audit logs** complets
- **Conformité RGPD** native

#### Q: Peut-on déployer on-premise ?
**R:** Oui, plusieurs options :
- **Cloud SaaS** (recommandé pour PME)
- **On-premise** complet (grandes entreprises)
- **Hybride** (données sensibles locales, IA cloud)
- **Air-gapped** (environnements ultra-sécurisés)

#### Q: Comment sont protégées nos données propriétaires ?
**R:** Protection maximale :
- **Isolation tenant** complète en mode SaaS
- **Chiffrement AES-256** au repos
- **Pseudonymisation** automatique des données sensibles
- **Rétention** configurable selon vos politiques

---

### 📱 Accessibilité et Usage

#### Q: Y a-t-il une application mobile ?
**R:** En développement :
- **React Native** app pour iOS/Android
- **Mode offline** avec synchronisation
- **Interface adaptée** pour utilisation terrain
- **Scanner QR codes** équipements
- **Sortie prévue**: Q2 2026

#### Q: Maintrix fonctionne-t-il hors ligne ?
**R:** Capacités offline :
- **Version web**: Cache intelligent pour consultations
- **Version mobile**: Mode offline complet en développement
- **Synchronisation** automatique au retour de connexion
- **Base locale** pour équipements critiques

#### Q: Quels navigateurs sont supportés ?
**R:** Compatibilité étendue :
- **Chrome/Edge** (recommandé) - dernières versions
- **Firefox** - dernières versions
- **Safari** - version 14+
- **Mobile browsers** - iOS Safari, Chrome Mobile

---

### 🧠 Smart Diagnostic IA - Interface Dédiée

#### Q: Comment accéder à la nouvelle page Smart Diagnostic ?
**R:** La page Smart Diagnostic est maintenant dédiée et accessible via :
1. **Bouton principal** : "Démarrer Diagnostic IA" depuis la page d'accueil
2. **Cartes fonctionnalités** : Bouton "Accéder" sous "Smart Diagnostic IA"
3. **Menu navigation** : Smart Diagnostic → Smart Diagnostic IA

#### Q: Quels sont les onglets disponibles dans Smart Diagnostic ?
**R:** La page Smart Diagnostic comporte 4 onglets intégrés :
- **Diagnostic** : Formulaire ML avec sélection mode IA (Standard/Avancé/Ensemble)
- **Réparation** : Procédures guidées étape par étape avec sécurité
- **Historique** : Historique complet des diagnostics avec filtrage
- **Rapports** : Analytics et export des interventions (CSV/Excel/PDF)

#### Q: Quelle est la différence entre les modes ML ?
**R:** Trois modes disponibles selon complexité :
- **Standard ML** : Forêts aléatoires et gradient boosting (rapide)
- **Avancé ML** : Réseaux neurones, SVM, détection anomalies (précis)
- **Ensemble ML** : Consensus de 9 algorithmes pour précision maximale (expert)

#### Q: Comment utiliser le nouveau workflow diagnostic ?
**R:** Workflow intégré Smart Diagnostic → Smart GMAO :
1. Accédez à la page dédiée Smart Diagnostic
2. Sélectionnez le mode ML approprié
3. Remplissez le formulaire équipement/symptômes
4. Analysez les résultats IA avec scoring confiance
5. Conversion automatique en ordre de travail Smart GMAO
6. Suivi intervention via IoT monitoring temps réel

---

### 🧠 Intelligence Artificielle

#### Q: Comment l'IA apprend-elle de nos données ?
**R:** Apprentissage multi-niveaux :
- **Feedback utilisateur** direct via modal d'évaluation
- **Patterns d'usage** pour optimisation continue
- **Données historiques** pour enrichissement modèles
- **Cross-validation** pour éviter l'overfitting

#### Q: Peut-on personnaliser les algorithmes ?
**R:** Personnalisation avancée :
- **Weights ajustables** par type d'équipement
- **Seuils de confiance** configurables
- **Features custom** selon votre métier
- **Entraînement spécialisé** sur vos données

#### Q: Quelle est la taille minimale de dataset pour l'entraînement ?
**R:** Exigences minimales :
- **Démarrage**: 20-30 cas par type d'équipement
- **Performance optimale**: 100+ cas par équipement
- **Amélioration continue**: Chaque nouveau cas enrichit le modèle
- **Bootstrap**: Base de 50+ cas industriels fournie

---

### ⚡ Performance et Scalabilité

#### Q: Maintrix peut-il gérer un grand parc d'équipements ?
**R:** Architecture scalable :
- **Horizontal scaling** automatique
- **Load balancing** intégré
- **Cache Redis** pour performances
- **CDN** pour assets statiques
- **Testé** jusqu'à 10,000+ équipements simultanés

#### Q: Quels sont les prérequis système ?
**R:** Configuration minimale :
- **Serveur**: 4 CPU cores, 8GB RAM, 50GB storage
- **Base de données**: PostgreSQL 13+
- **Réseau**: 10Mbps minimum, 100Mbps recommandé
- **Clients**: Navigateur moderne, 2GB RAM

#### Q: Comment mesurer les performances du système ?
**R:** Métriques complètes :
- **Tableaux de bord** temps réel
- **KPIs métier** (temps diagnostic, précision)
- **Métriques techniques** (latence, throughput)
- **Rapports** automatiques périodiques

---

### 🔄 Maintenance et Support

#### Q: Quelle est la politique de mise à jour ?
**R:** Mises à jour continues :
- **Patches sécurité**: Automatiques
- **Améliorations IA**: Mensuelles
- **Nouvelles fonctionnalités**: Trimestrielles
- **Versions majeures**: Annuelles avec migration assistée

#### Q: Quel support est fourni ?
**R:** Support multicouche :
- **Documentation** complète en ligne
- **Chatbot IA** pour questions courantes
- **Support email** (48h response time)
- **Support téléphone** pour clients premium
- **Formation** sur site incluse

#### Q: Comment sauvegarder les données ?
**R:** Stratégie de sauvegarde :
- **Backups automatiques** quotidiens
- **Point-in-time recovery** (PITR)
- **Réplication multi-zones** en mode cloud
- **Export complet** disponible à tout moment

---

### 💰 Licencing et Coûts

#### Q: Quels sont les modèles de pricing ?
**R:** Options flexibles :
- **SaaS** : Abonnement mensuel par utilisateur
- **On-premise** : Licence perpétuelle + maintenance
- **Hybride** : Combinaison selon besoins
- **POC gratuit** : 30 jours d'évaluation

#### Q: Y a-t-il des coûts cachés ?
**R:** Transparence totale :
- **Tarification claire** par utilisateur/équipement
- **Formation incluse** dans les packages
- **Support standard** inclus
- **Pas de frais** d'import/export de données

#### Q: Comment calculer le ROI ?
**R:** Métriques ROI typiques :
- **Réduction temps diagnostic** : -60% (valeur: €50k/an)
- **Évitement pannes** : -25% coûts maintenance
- **Productivité techniciens** : +40% efficacité
- **ROI typical** : 300-500% sur 3 ans

---

### 🚀 Roadmap et Évolutions

#### Q: Quelles sont les prochaines fonctionnalités ?
**R:** Roadmap 2026 :
- **Q1** : Infrastructure Cognitive Industrielle à 6 couches déployée
- **Q2** : Knowledge Graph industriel et système multi-agents
- **Q3** : Intégrations communication multi-canal (Email, SMS, Slack, Teams)
- **Q4** : Autonomie graduée avancée et jumeaux numériques

#### Q: Peut-on influencer le développement ?
**R:** Collaboration active :
- **Feedback board** pour suggestions
- **Comité utilisateurs** pour orientations
- **Beta testing** des nouvelles fonctionnalités
- **Custom development** pour besoins spécifiques

#### Q: Maintrix évolue-t-il avec l'industrie 4.0 ?
**R:** Vision future :
- **Jumeau numérique** des équipements
- **IA conversationnelle** avancée
- **Maintenance autonome** cognitive
- **Blockchain** pour traçabilité

---

### 🧬 Infrastructure Cognitive Industrielle

#### Q: Qu'est-ce que l'architecture cognitive à 6 couches ?
**R:** L'Infrastructure Cognitive Industrielle de Maintrix repose sur 6 couches :
1. **Perception** : Capteurs IoT multi-protocoles (MQTT, Modbus, OPC-UA, LoRaWAN)
2. **Compréhension** : Moteur de règles expert, corrélation symptômes/causes
3. **Mémoire & Knowledge Graph** : Base de similarité + graphe de connaissances industrielles
4. **Cognition** : IA structurante (Anthropic Claude), raisonnement contextuel
5. **Orchestration** : Système multi-agents, coordination inter-agents
6. **Gouvernance** : Autonomie graduée, conformité, audit continu

#### Q: Qu'est-ce que le Knowledge Graph industriel ?
**R:** Le Knowledge Graph modélise les relations entre :
- **Équipements** : types, composants, historique d'utilisation
- **Défaillances** : modes de panne, symptômes, causes racines
- **Solutions** : actions correctives, pièces nécessaires, compétences requises
- **Contexte** : conditions opérationnelles, environnement, charge de travail
Il permet un raisonnement structuré et explicable au-delà des simples corrélations statistiques.

#### Q: Comment fonctionne le système multi-agents ?
**R:** Le système multi-agents comprend :
- **Agents équipement** : Un agent spécialisé par équipement critique, surveillant ses paramètres en continu
- **Agents site** : Coordination des agents équipement au niveau d'un site industriel
- **Agent global** : Orchestration cross-sites, apprentissage fédéré, optimisation globale
Les agents communiquent entre eux et escaladent selon des règles d'autonomie graduée.

#### Q: Qu'est-ce que l'autonomie graduée ?
**R:** L'autonomie graduée définit 4 niveaux de prise de décision :
- **Niveau 1 — Alerte** : Notification intelligente, l'humain décide
- **Niveau 2 — Diagnostic** : Analyse cognitive complète, recommandation à valider
- **Niveau 3 — Prescription** : Action proposée avec pièces et technicien identifiés
- **Niveau 4 — Action autonome** : Exécution automatique (avec supervision humaine stratégique)
Chaque organisation configure le niveau maximal autorisé selon sa politique.

#### Q: Comment fonctionnent les intégrations de communication ?
**R:** Maintrix propose un dispatcher de communication multi-canal :
- **Email** : Notifications détaillées via SendGrid avec templates personnalisables
- **SMS** : Alertes urgentes pour les techniciens terrain
- **Slack** : Intégration native avec canaux dédiés par site/équipement
- **Microsoft Teams** : Notifications et actions directement dans Teams
- **Webhooks** : Intégration avec tout système tiers via webhooks configurables
Les règles de routage sont basées sur la criticité, le type d'événement et les préférences utilisateur.

---

*Pour toute question technique spécifique non couverte, contactez notre équipe support technique.*
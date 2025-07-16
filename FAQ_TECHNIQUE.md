# FAQ Technique - SMDiagFix

## Questions Techniques Fréquentes

### 🔧 Architecture et Technologie

#### Q: Quelles technologies sont utilisées dans SMDiagFix ?
**R:** SMDiagFix utilise une stack moderne complète :
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

#### Q: SMDiagFix peut-il s'intégrer à notre GMAO existante ?
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
- **Sortie prévue**: Q2 2025

#### Q: SMDiagFix fonctionne-t-il hors ligne ?
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

#### Q: SMDiagFix peut-il gérer un grand parc d'équipements ?
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
**R:** Roadmap 2025 :
- **Q1** : Intégration IoT temps réel
- **Q2** : Application mobile React Native
- **Q3** : IA générative pour documentation
- **Q4** : Réalité augmentée pour réparations

#### Q: Peut-on influencer le développement ?
**R:** Collaboration active :
- **Feedback board** pour suggestions
- **Comité utilisateurs** pour orientations
- **Beta testing** des nouvelles fonctionnalités
- **Custom development** pour besoins spécifiques

#### Q: SMDiagFix évolue-t-il avec l'industrie 4.0 ?
**R:** Vision future :
- **Jumeau numérique** des équipements
- **IA conversationnelle** avancée
- **Maintenance autonome** prédictive
- **Blockchain** pour traçabilité

---

*Pour toute question technique spécifique non couverte, contactez notre équipe support technique.*
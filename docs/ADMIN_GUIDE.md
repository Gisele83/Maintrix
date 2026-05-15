# Maintrix — Guide administrateur v2.6.0

## 1. Rôles et permissions

### Gestion des utilisateurs
1. Menu **Administration → Utilisateurs**
2. Cliquer **Inviter un utilisateur**
3. Saisir l'email et sélectionner le rôle
4. L'utilisateur reçoit un email d'invitation avec un lien de création de compte

### Rôles disponibles
| Rôle | Accès | Cas d'usage |
|------|-------|-------------|
| `admin` | Total | Responsable IT / Chef maintenance |
| `director` | Lecture + rapports | Direction |
| `engineer` | GMAO + Diagnostic + Rapports | Ingénieur maintenance |
| `technician` | Interventions | Technicien terrain |
| `operator` | Tableaux de bord | Opérateur |
| `viewer` | Lecture seule | Auditeur |

### Modifier les permissions avancées
Menu **Administration → Permissions** pour configurer les accès par fonctionnalité.

---

## 2. Configuration de la plateforme

### Paramètres généraux
- **Nom de l'organisation** — affiché dans l'interface et les rapports
- **Fuseau horaire** — utilisé pour les planifications
- **Langue par défaut** — Français ou Anglais
- **Logo** — affiché dans l'entête et les rapports PDF

### Notifications
- **Email** — configurer l'expéditeur SendGrid
- **Slack** — webhook URL de votre workspace
- **Teams** — webhook connector
- **Telegram** — bot token + chat ID

### Intégrations
- **IoT / MQTT** — URL du broker et identifiants
- **SAP ERP** — URL + authentification
- **Maximo** — URL + identifiants
- **SCADA** — endpoint de connexion

---

## 3. Gestion de la licence

### Vérifier le statut
Menu **Administration → Licence** ou API `GET /api/license/status`

### Activer une licence
1. Menu **Administration → Licence → Activer**
2. Saisir la clé (format : `SM` + 13 chiffres)
3. Cliquer **Valider**

### Statuts possibles
| Statut | Description | Actions utilisateurs |
|--------|-------------|----------------------|
| `trial` | Essai gratuit en cours | Toutes fonctions |
| `active` | Licence valide | Toutes fonctions |
| `grace` | Paiement échoué, grâce 7j | Toutes fonctions |
| `expired` | Licence expirée | Bloqué (sauf paiement) |
| `suspended` | Compte suspendu | Bloqué |

### Période de grâce
En cas d'échec de paiement, une période de grâce de **7 jours** permet de régulariser sans interruption de service. Passé ce délai, l'API retourne `402 Payment Required`.

---

## 4. Supervision du système

### Page Santé système
Menu **Administration → Santé système** (admin uniquement)

Affiche en temps réel :
- Statut de la base de données (latence, taille, enregistrements par table)
- Utilisation mémoire et CPU
- Uptime du serveur
- Métriques du code source
- Statut de chacun des 14 modules

### Logs applicatifs
```bash
# Via Docker
docker-compose logs -f app

# Via systemd
journalctl -u maintrix -f

# Fichier log (desktop)
%APPDATA%\Maintrix\maintrix.log  (Windows)
~/.config/Maintrix/maintrix.log  (Linux/macOS)
```

### Grafana (monitoring avancé)
Accéder à http://votre-serveur:3000
- Dashboards : CPU, mémoire, requêtes API, erreurs
- Alertes : configurer des seuils dans Grafana

---

## 5. Sauvegarde et restauration

### Politique de sauvegarde recommandée
- **Quotidienne** — base de données complète (pg_dump)
- **Hebdomadaire** — fichiers uploadés
- **Mensuelle** — sauvegarde complète + archivage

### Commandes de sauvegarde
```bash
# Sauvegarde base de données
pg_dump -U maintrix_user maintrix_db | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Via Docker
docker exec maintrix-db pg_dump -U maintrix_user maintrix_db | gzip > backup.sql.gz

# Script automatisé
./scripts/local-backup.sh
```

### Restauration
```bash
gunzip backup_20240101.sql.gz
psql -U maintrix_user maintrix_db < backup_20240101.sql
```

---

## 6. Mises à jour

### Web / Serveur
```bash
git pull origin main
npm install
npm run build
npm run db:push
# Redémarrer le service
sudo systemctl restart maintrix
# ou
docker-compose up -d --build app
```

### Desktop (Electron)
Les mises à jour sont automatiques au démarrage.
Pour une mise à jour forcée : Aide → Vérifier les mises à jour.

### Mobile (React Native)
Mises à jour distribuées via Google Play Store et Apple App Store.

---

## 7. Sécurité — Bonnes pratiques

### En production, toujours :
- ✅ Utiliser des secrets forts (min. 32 caractères aléatoires)
- ✅ Activer HTTPS (certificat SSL valide)
- ✅ Configurer le pare-feu (n'exposer que les ports 80/443)
- ✅ Activer le MFA pour les comptes admin
- ✅ Limiter les adresses IP autorisées (si réseau privé)
- ✅ Effectuer les sauvegardes quotidiennes
- ✅ Monitorer les logs d'accès

### Ne jamais :
- ❌ Exposer la base de données sur internet
- ❌ Utiliser les valeurs par défaut des secrets
- ❌ Partager les clés API entre environnements
- ❌ Désactiver la validation CSRF

### Journalisation des actions sensibles
Toutes les actions suivantes sont journalisées :
- Connexions/déconnexions
- Modifications de permissions
- Suppressions de données
- Activation/désactivation de licences
- Export de données

---

## 8. Dépannage

### Réinitialiser un mot de passe oublié
```bash
# Via CLI (admin serveur)
node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('NouveauMotDePasse123!', 12).then(h => console.log(h));
"
# Puis mettre à jour en base :
psql -U maintrix_user maintrix_db -c "UPDATE users SET password_hash='<hash>' WHERE username='user@example.com';"
```

### Débloquer un compte verrouillé
```sql
UPDATE users 
SET login_attempts = 0, locked_until = NULL 
WHERE username = 'user@example.com';
```

### Vider le cache Redis
```bash
docker exec maintrix-redis redis-cli FLUSHDB
```

### Reconstruire les index de recherche
```bash
npm run db:push
```

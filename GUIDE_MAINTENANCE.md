# Guide de Maintenance Maintrix
## Pour administrateurs sans expertise en programmation

---

## 1. Tâches de Maintenance Quotidiennes

### 1.1 Vérifier que l'application fonctionne

```bash
# Voir l'état des conteneurs
docker-compose ps

# Résultat attendu: tous les services "Up"
# NAME              STATUS    PORTS
# maintrix-app      Up        0.0.0.0:5000->5000/tcp
# maintrix-postgres Up        5432/tcp
```

### 1.2 Consulter les logs en cas de problème

```bash
# Voir les logs de l'application (dernières 100 lignes)
docker-compose logs --tail=100 app

# Voir les logs en temps réel
docker-compose logs -f app

# Quitter: Ctrl+C
```

---

## 2. Tâches de Maintenance Hebdomadaires

### 2.1 Sauvegarder la base de données

```bash
# Exécuter le script de sauvegarde
./backup.sh

# Les sauvegardes sont stockées dans /opt/maintrix/backups/
# Format: backup_YYYYMMDD_HHMMSS.sql
```

### 2.2 Vérifier l'espace disque

```bash
# Voir l'utilisation du disque
df -h

# Si > 80% utilisé, nettoyer les anciens logs/sauvegardes
```

### 2.3 Vérifier les mises à jour de sécurité

```bash
# Ubuntu/Debian
sudo apt update && sudo apt list --upgradable

# Appliquer les mises à jour de sécurité
sudo apt upgrade -y
```

---

## 3. Tâches de Maintenance Mensuelle

### 3.1 Redémarrer les services (maintenance préventive)

```bash
# Arrêter proprement
docker-compose down

# Redémarrer
docker-compose up -d

# Vérifier le statut
docker-compose ps
```

### 3.2 Nettoyer les ressources Docker inutilisées

```bash
# Supprimer les images et conteneurs orphelins
docker system prune -f

# Attention: ne pas utiliser -a (supprime tout)
```

### 3.3 Vérifier les certificats SSL

```bash
# Voir la date d'expiration du certificat
sudo certbot certificates

# Renouveler si nécessaire (normalement automatique)
sudo certbot renew
```

---

## 4. Procédures de Dépannage

### 4.1 L'application ne répond plus

```bash
# Étape 1: Vérifier les conteneurs
docker-compose ps

# Étape 2: Si un conteneur est "Exited", voir les logs
docker-compose logs app

# Étape 3: Redémarrer les services
docker-compose restart

# Étape 4: Si ça ne marche pas, redémarrer complètement
docker-compose down && docker-compose up -d
```

### 4.2 Erreur de connexion à la base de données

```bash
# Vérifier que PostgreSQL fonctionne
docker-compose ps postgres

# Vérifier les logs PostgreSQL
docker-compose logs postgres

# Redémarrer PostgreSQL
docker-compose restart postgres
```

### 4.3 Erreur "Disk full"

```bash
# Identifier les fichiers volumineux
du -sh /opt/maintrix/*

# Supprimer les anciennes sauvegardes (garder les 7 dernières)
cd /opt/maintrix/backups
ls -t | tail -n +8 | xargs rm -f

# Nettoyer les logs Docker
docker system prune -f
```

### 4.4 Site inaccessible (erreur 502/504)

```bash
# Vérifier Nginx
sudo systemctl status nginx
sudo nginx -t

# Redémarrer Nginx
sudo systemctl restart nginx

# Vérifier que l'app tourne sur le bon port
curl http://localhost:5000/health
```

---

## 5. Mise à Jour de l'Application

### 5.1 Mise à jour standard

```bash
# Se placer dans le répertoire
cd /opt/maintrix

# Télécharger les dernières modifications
git pull

# Reconstruire et redémarrer
docker-compose down
docker-compose up -d --build

# Vérifier le statut
docker-compose ps
docker-compose logs --tail=50 app
```

### 5.2 Restauration en cas de problème

```bash
# Revenir à la version précédente
git checkout HEAD~1

# Reconstruire
docker-compose down
docker-compose up -d --build
```

---

## 6. Gestion des Variables d'Environnement

### 6.1 Fichier .env - Les secrets de l'application

| Variable | Description | Où l'obtenir |
|----------|-------------|--------------|
| DATABASE_URL | Connexion base de données | Généré automatiquement |
| SESSION_SECRET | Clé de session | Généré automatiquement |
| STRIPE_SECRET_KEY | Clé secrète Stripe | Dashboard Stripe |
| STRIPE_PUBLISHABLE_KEY | Clé publique Stripe | Dashboard Stripe |
| PAYPAL_CLIENT_ID | ID PayPal | Dashboard PayPal |
| PAYPAL_CLIENT_SECRET | Secret PayPal | Dashboard PayPal |
| SENDGRID_API_KEY | Clé API emails | Dashboard SendGrid |
| ANTHROPIC_API_KEY | Clé IA diagnostic | Console Anthropic |

### 6.2 Modifier une variable

```bash
# Éditer le fichier .env
nano /opt/maintrix/.env

# Sauvegarder: Ctrl+O, Entrée
# Quitter: Ctrl+X

# Redémarrer pour appliquer
docker-compose restart
```

---

## 7. Sauvegarde et Restauration

### 7.1 Sauvegarde manuelle complète

```bash
# Base de données
docker exec maintrix-postgres pg_dump -U maintrix maintrix > backup_$(date +%Y%m%d).sql

# Fichiers uploadés
tar -czf uploads_$(date +%Y%m%d).tar.gz /opt/maintrix/uploads/

# Configuration
cp /opt/maintrix/.env .env.backup
```

### 7.2 Restauration de la base de données

```bash
# Arrêter l'application
docker-compose stop app

# Restaurer la sauvegarde
cat backup_20250128.sql | docker exec -i maintrix-postgres psql -U maintrix maintrix

# Redémarrer
docker-compose start app
```

---

## 8. Commandes Utiles Résumées

| Action | Commande |
|--------|----------|
| Voir l'état | `docker-compose ps` |
| Voir les logs | `docker-compose logs -f app` |
| Redémarrer | `docker-compose restart` |
| Arrêter | `docker-compose down` |
| Démarrer | `docker-compose up -d` |
| Reconstruire | `docker-compose up -d --build` |
| Sauvegarder | `./backup.sh` |
| Mettre à jour | `git pull && docker-compose up -d --build` |

---

## 9. Contacts et Support

### En cas de problème grave

1. **Consulter les logs** : `docker-compose logs --tail=200 app`
2. **Sauvegarder** avant toute intervention : `./backup.sh`
3. **Redémarrer** : `docker-compose restart`
4. **Contacter le support** : support@maintrix-t.com

### Informations à fournir au support

- Screenshot des erreurs
- Résultat de `docker-compose ps`
- Dernières lignes de log : `docker-compose logs --tail=100 app`
- Date/heure du problème

---

## 10. Checklist de Maintenance

### Quotidien
- [ ] Vérifier que le site est accessible
- [ ] Consulter le tableau de bord des alertes

### Hebdomadaire
- [ ] Vérifier les sauvegardes
- [ ] Consulter l'espace disque
- [ ] Appliquer les mises à jour de sécurité système

### Mensuel
- [ ] Redémarrer les services
- [ ] Nettoyer les ressources Docker
- [ ] Vérifier les certificats SSL
- [ ] Tester la restauration d'une sauvegarde

---

**Ce guide vous permet de gérer Maintrix sans connaissances en programmation.**
**En cas de doute, sauvegardez d'abord, puis contactez le support.**

# Maintrix - Déploiement Automatisé AWS via GitHub Actions

**Version** : 3.0 | **Date** : Février 2026

Ce guide explique comment configurer le déploiement automatique de Maintrix sur AWS à chaque push sur GitHub.

---

## Architecture du Pipeline CI/CD

```
GitHub (push main) → GitHub Actions → Build Docker → Push ECR → Deploy ECS/EC2
                          ↓
                    Tests + Type Check
                          ↓
                    Build Docker Image
                          ↓
                    Push to AWS ECR
                          ↓
              ┌───────────┴───────────┐
              ↓                       ↓
        ECS Fargate              EC2 via SSH
      (recommandé prod)       (budget-friendly)
```

---

## Prérequis

### 1. Compte AWS
- Un compte AWS actif avec les permissions nécessaires
- AWS CLI installé localement (optionnel, pour la configuration initiale)

### 2. Dépôt GitHub
- Le code Maintrix poussé sur un dépôt GitHub (privé recommandé)

---

## Option A : Déploiement ECS Fargate (Recommandé)

### Coût estimé : ~30-50€/mois
- ECS Fargate (1 vCPU, 2GB) : ~25€/mois
- RDS db.t3.micro (free tier 1ère année) : 0-15€/mois
- ALB : ~15€/mois
- ECR : ~1€/mois

### Étape 1 : Créer l'infrastructure AWS

Utilisez le template CloudFormation fourni :

```bash
aws cloudformation create-stack \
  --stack-name maintrix-production \
  --template-body file://aws/cloudformation-infra.yml \
  --parameters \
    ParameterKey=DBPassword,ParameterValue=VotreMotDePasseSecurise123! \
    ParameterKey=DomainName,ParameterValue=maintrix.votre-domaine.com \
  --capabilities CAPABILITY_IAM \
  --region eu-west-3
```

### Étape 2 : Stocker les secrets dans SSM

```bash
chmod +x aws/setup-aws-params.sh
./aws/setup-aws-params.sh
```

### Étape 3 : Configurer les secrets GitHub

Dans votre dépôt GitHub → Settings → Secrets and variables → Actions :

| Secret | Description | Exemple |
|--------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | Clé d'accès AWS IAM | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | Clé secrète AWS IAM | `wJal...` |

Variables (Settings → Variables) :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `AWS_REGION` | Région AWS | `eu-west-3` (Paris) |

### Étape 4 : Pousser le code

```bash
git add .
git commit -m "Setup CI/CD pipeline"
git push origin main
```

Le pipeline se déclenche automatiquement :
1. Type-check TypeScript
2. Build de l'application
3. Build et push de l'image Docker vers ECR
4. Déploiement sur ECS Fargate

---

## Option B : Déploiement EC2 (Budget-Friendly)

### Coût estimé : ~10-20€/mois
- EC2 t3.small : ~15€/mois (ou t3.micro free tier)
- PostgreSQL dans Docker : inclus
- ECR : ~1€/mois

### Étape 1 : Lancer une instance EC2

1. Aller dans AWS Console → EC2 → Launch Instance
2. Choisir **Ubuntu 22.04 LTS**
3. Type : **t3.small** (recommandé) ou t3.micro (free tier)
4. Stockage : **30 GB gp3**
5. Security Group : ouvrir ports **22** (SSH), **80** (HTTP), **443** (HTTPS)
6. Télécharger la clé SSH (.pem)

### Étape 2 : Préparer l'instance EC2

```bash
ssh -i votre-cle.pem ubuntu@ADRESSE-IP-EC2

# Installer Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu

# Installer AWS CLI
sudo apt install -y awscli

# Configurer AWS CLI
aws configure
# → Access Key, Secret Key, Region

# Créer le répertoire de l'application
sudo mkdir -p /opt/maintrix
sudo chown ubuntu:ubuntu /opt/maintrix

# Déconnecter et reconnecter (pour le groupe docker)
exit
```

### Étape 3 : Configuration initiale sur EC2

```bash
ssh -i votre-cle.pem ubuntu@ADRESSE-IP-EC2
cd /opt/maintrix

# Cloner le dépôt
git clone https://github.com/VOTRE-USER/maintrix.git .

# Lancer le script d'installation AWS existant
chmod +x scripts/deploy-aws.sh
./scripts/deploy-aws.sh
```

### Étape 4 : Configurer les secrets GitHub

Dans GitHub → Settings → Secrets and variables → Actions :

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | Clé d'accès AWS IAM |
| `AWS_SECRET_ACCESS_KEY` | Clé secrète AWS IAM |
| `EC2_HOST` | Adresse IP publique de l'instance EC2 |
| `EC2_SSH_KEY` | Contenu du fichier .pem (clé privée SSH) |
| `EC2_USER` | `ubuntu` (par défaut) |

### Étape 5 : Déployer

Le déploiement EC2 se fait **manuellement** via GitHub :
1. Aller dans votre dépôt → Actions → "Deploy to AWS EC2 (SSH)"
2. Cliquer "Run workflow"
3. Choisir l'environnement (production/staging)

---

## Fichiers du Pipeline

```
.github/
└── workflows/
    ├── ci.yml              # Build + test automatique (push/PR)
    ├── deploy-ecs.yml      # Déploiement ECS Fargate (auto après CI)
    └── deploy-ec2.yml      # Déploiement EC2 via SSH (manuel)

aws/
├── cloudformation-infra.yml    # Template infrastructure AWS
├── ecs-task-definition.json    # Définition de tâche ECS
└── setup-aws-params.sh         # Script config SSM Parameters
```

---

## Fonctionnement du Pipeline

### Sur chaque push vers `main` :
```
1. ci.yml → Lint + Type Check
2. ci.yml → Build application
3. ci.yml → Build Docker + Push ECR
4. deploy-ecs.yml → Deploy to ECS (automatique)
```

### Sur chaque Pull Request :
```
1. ci.yml → Lint + Type Check
2. ci.yml → Build application
(pas de déploiement)
```

### Déploiement EC2 manuel :
```
GitHub Actions → Run Workflow → Build Docker → Push ECR → SSH Deploy
```

---

## Rollback

### ECS Fargate
Le rollback est automatique grâce à ECS :
- Si le health check échoue, ECS garde l'ancienne version
- Manuellement : redéployer une version antérieure via GitHub Actions (workflow_dispatch avec un tag spécifique)

### EC2
- Rollback automatique intégré dans le workflow en cas d'échec
- Manuel : `cd /opt/maintrix && docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d`

---

## Monitoring & Logs

### ECS
```bash
# Voir les logs
aws logs tail /ecs/maintrix-production --follow

# Voir le statut du service
aws ecs describe-services --cluster maintrix-cluster --services maintrix-service
```

### EC2
```bash
ssh -i votre-cle.pem ubuntu@ADRESSE-IP
cd /opt/maintrix
docker compose -f docker-compose.prod.yml logs -f
```

---

## Sécurité

- Les secrets sont stockés dans AWS SSM Parameter Store (chiffrés)
- Les clés SSH GitHub ne sont jamais exposées dans les logs
- L'image Docker est scannée pour les vulnérabilités (Trivy)
- Le Security Group limite l'accès aux ports nécessaires
- La base de données RDS est dans un sous-réseau privé (pas d'accès public)

---

## Recommandations par taille d'entreprise

| Taille | Option | Instance | BDD | Coût/mois |
|--------|--------|----------|-----|-----------|
| Startup/TPE | EC2 | t3.micro | Docker PostgreSQL | ~5-10€ |
| PME (< 50 utilisateurs) | EC2 | t3.small | Docker PostgreSQL | ~15-20€ |
| PME (50-200 utilisateurs) | ECS | 1 vCPU/2GB | RDS db.t3.micro | ~40-60€ |
| ETI (200+ utilisateurs) | ECS | 2 vCPU/4GB | RDS db.t3.small | ~80-120€ |

---

## Support

- Documentation complète : `INSTALL.md`
- Architecture : `ARCHITECTURE_GLOBALE_MAINTRIX.md`
- Sécurité : `SECURITY_GUIDE.md`
- Site : maintrix-t.com

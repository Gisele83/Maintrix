# Hypothèse mono-instance — Maintrix

> **Maintrix doit tourner en UNE SEULE instance.**
> Démarrer un second conteneur applicatif sur la même base de données provoque
> des duplications silencieuses et de la corruption d'état. Rien dans le code
> ne le détecte ni ne l'empêche aujourd'hui.

Ce document est le préalable à tout scaling horizontal. Il est délibérément
descriptif : **aucune architecture distribuée n'a été mise en place**, le pilote
cloud reste mono-instance (règle de la phase F02).

---

## Pourquoi cette contrainte existe

Les 13 tâches de fond ([BACKGROUND_TASKS.md](BACKGROUND_TASKS.md)) tournent dans
le processus applicatif lui-même. Aucune n'utilise de verrou : ni verrou
consultatif PostgreSQL, ni bail Redis, ni élection de leader. Chaque instance
exécuterait donc **toutes** les boucles, en parallèle, sans coordination.

## Ce qui casse avec deux instances

### 🔴 Duplication de données — dangereux immédiatement

| Tâche | Ce qui se produit avec N instances |
|---|---|
| **C‑5** `integrations:iot-simulation` | La seule tâche qui **écrit en base** en boucle. N instances × 5 équipements × toutes les 30 s → N fois plus de lignes `iot_sensor_data`. Fausse les moyennes, les seuils, la détection de dérive et les jumeaux numériques. **C'est le risque le plus concret.** |
| **B‑6 / B‑7** `sap-sync`, `maximo-sync` | Synchronisations **bidirectionnelles**. `pushCompletedWorkOrdersToSAP()` pousserait le même bon de travail depuis chaque instance → doublons dans un ERP tiers, hors du contrôle de Maintrix. Le plus coûteux à réparer. |

### 🟠 État en mémoire divergent — incohérences visibles

| Tâche | Ce qui se produit |
|---|---|
| **A‑1** `cognitive-kernel:processing` | File de messages et registre d'agents sont **par processus**. Chaque instance a sa propre vision du système cognitif. Un agent « offline » pour l'une est actif pour l'autre. |
| **B‑1/B‑2/B‑3** agents global/site/équipement | Chaque instance instancie ses propres agents pour les **mêmes** équipements. Les taux de dégradation, scores de santé et corrélations sont calculés N fois sur des historiques mémoire disjoints. Un utilisateur voit une valeur différente selon l'instance qui répond. |
| **C‑1/C‑2** simulateur IoT et détection de symptômes | Lectures simulées indépendantes → N alertes pour un même symptôme. |
| **C‑3** `gamification:expire-challenges` | Défis expirés N fois → récompenses potentiellement dupliquées. |

### 🟡 Bénin ou déjà idempotent

| Tâche | Pourquoi c'est acceptable |
|---|---|
| **B‑4** `super-admin:token-cleanup` | La map de jetons est locale au processus. Chaque instance nettoie la sienne. **Mais** : les jetons super‑admin étant en mémoire, une session ouverte sur l'instance 1 n'est pas reconnue par l'instance 2 → **l'authentification super‑admin est déjà cassée en multi-instances**, indépendamment de la boucle. |
| **B‑5** `scada:tag-polling` | Lecture seule. N instances = N fois plus de charge sur l'automate — à surveiller, pas corrompant. |
| **C‑4** `notifications:cleanup` | Purge de structures mémoire locales. Sans effet croisé. |

### Au-delà des boucles

Trois dépendances à l'instance unique existent hors des tâches de fond et
doivent être traitées dans le même chantier :

- **Jetons super‑admin en mémoire** (`activeSuperAdminTokens`) — voir B‑4.
- **Fichiers téléversés sur disque local** (`/app/uploads`, monté en volume).
  Une pièce jointe écrite par l'instance 1 est introuvable depuis l'instance 2.
  Nécessite un stockage objet partagé (S3 ou équivalent).
- **Secrets éphémères en développement** — `ensureDevelopmentSecrets()` génère
  `SESSION_SECRET` aléatoirement si absent : deux instances signeraient les
  sessions avec des clés différentes. En production le démarrage est bloqué si
  le secret manque, donc ce point ne concerne que le développement.

---

## Avant un scaling horizontal

Dans cet ordre — chaque étape est indépendante et livrable seule.

**1. Rendre l'exécution des boucles exclusive.** Le plus court chemin, sans
   nouvelle infrastructure : un **verrou consultatif PostgreSQL**
   (`pg_try_advisory_lock`) pris par tâche, la base étant déjà partagée.
   L'instance qui obtient le verrou exécute ; les autres passent leur tour.
   S'insère dans `registerBackgroundTask()` — un seul point de code à modifier.

**2. Sortir les tâches écrivantes du processus web.** C‑5, B‑6 et B‑7 dans un
   worker séparé, déployé en **une seule** réplique. Les instances web ne
   portent plus alors que des boucles en lecture ou en mémoire.

**3. Externaliser l'état partagé.** Jetons super‑admin et sessions en Redis
   (le service est déjà déclaré dans `docker-compose.yml` mais **n'est
   référencé par aucun code serveur** — voir la phase F03) ; téléversements en
   stockage objet.

**4. Réconcilier l'état cognitif.** Le plus lourd : agents et noyau cognitif
   supposent une vue mémoire unique. Soit une instance « cognitive » dédiée,
   soit une persistance de l'état des agents. À ne pas entreprendre avant que
   les points 1 à 3 soient acquis.

---

## Faire respecter l'hypothèse en attendant

Rien dans le code n'empêche un second démarrage. **Cela relève donc de la
configuration de déploiement**, et doit être vérifié à chaque déploiement :

- `docker-compose.yml` : ne jamais utiliser `--scale app=N`. Le
  `container_name: maintrix-app` fixe rend d'ailleurs `--scale` impossible —
  protection accidentelle, pas délibérée.
- ECS / Kubernetes : `desiredCount: 1` / `replicas: 1`, et **stratégie de
  déploiement `Recreate`, pas `RollingUpdate`** — un rolling update fait
  cohabiter deux instances pendant la bascule, ce qui suffit à dupliquer des
  écritures. C'est le piège le plus facile à déclencher sans le vouloir.
- Toute mise à l'échelle automatique doit rester désactivée.

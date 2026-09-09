# 🐳 Dockerfile - Maintrix
# Image Docker pour déploiement en production

# Étape 1: Image de base Node.js Alpine (légère)
FROM node:20-alpine AS base

# Installation des outils système nécessaires
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    postgresql-client \
    curl

WORKDIR /app

# Copie des fichiers de configuration package
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY drizzle.config.ts ./
COPY components.json ./

# Étape 2: Installation des dépendances
FROM base AS dependencies

# Installation des dépendances de production uniquement
RUN npm ci --only=production && npm cache clean --force

# Étape 3: Construction de l'application
FROM base AS build

# Installation de toutes les dépendances (dev + prod)
RUN npm ci

# Copie du code source
COPY . .

# Construction de l'application
RUN npm run build

# Étape 4: Image de production finale
FROM node:20-alpine AS production

# Création utilisateur non-root pour sécurité
RUN addgroup -g 1001 -S maintrix && \
    adduser -S maintrix -u 1001 -G maintrix

# Installation outils runtime
#
# `chromium` — F11. La route de génération des bons de commande
# (server/cctp-routes.ts) appelle `puppeteer.launch()`, mais aucun navigateur
# n'était présent dans l'image : chaque appel échouait avec
# « Could not find Chrome ». On installe le Chromium d'Alpine plutôt que de
# laisser Puppeteer télécharger le sien à la construction : la version suit les
# correctifs de sécurité du dépôt Alpine, et l'image ne dépend pas d'un
# téléchargement réseau au build.
RUN apk add --no-cache \
    postgresql-client \
    curl \
    tini \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ttf-freefont

WORKDIR /app

# Copie des dépendances de production
COPY --from=dependencies /app/node_modules ./node_modules

# Copie de l'application construite
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/package*.json ./
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/drizzle.config.ts ./

# Copie des assets et configurations
COPY --from=build /app/attached_assets ./attached_assets
COPY --from=build /app/mobile ./mobile

# Création des répertoires nécessaires
RUN mkdir -p /app/uploads /app/logs /app/backups && \
    chown -R maintrix:maintrix /app

# Changement vers utilisateur non-root
USER maintrix

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=5000
# Puppeteer utilise le Chromium du système : ne pas en télécharger un second
# (≈180 Mo évités), et pointer explicitement l'exécutable Alpine.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV LOG_LEVEL=info
ENV PAYPAL_MODE=sandbox

# Health check — sonde d'infrastructure servie par server/health-routes.ts.
# --max-time 5 borne curl bien en deçà du --timeout=10s : un endpoint lent doit
# se traduire par un échec de sonde net, jamais par un dépassement de délai du
# HEALTHCHECK lui-même. Le port suit PORT au lieu d'être figé à 5000.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -fsS --max-time 5 "http://localhost:${PORT:-5000}/api/health" || exit 1

# Exposition du port
EXPOSE 5000

# Volume pour données persistantes
VOLUME ["/app/uploads", "/app/logs"]

# Point d'entrée avec Tini pour gestion correcte des signaux
ENTRYPOINT ["/sbin/tini", "--"]

# Commande de démarrage.
#
# On lance `node dist/index.js` directement, PAS `npm start`. Le script npm est
# `cross-env NODE_ENV=production node dist/index.js` : `cross-env` est une
# devDependency, absente de l'étape `production` qui installe avec
# `npm ci --only=production`. Le conteneur échouait donc au démarrage sur
# « sh: cross-env: not found » et bouclait en redémarrage (exit 127).
# `cross-env` n'a de toute façon aucune utilité ici — NODE_ENV est déjà posé
# par le `ENV NODE_ENV=production` ci-dessus ; il ne sert qu'au développement
# sous Windows. Appeler node directement évite en prime le processus npm
# intermédiaire, ce qui rend la propagation des signaux par tini exacte.
CMD ["node", "dist/index.js"]
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
RUN apk add --no-cache \
    postgresql-client \
    curl \
    tini

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
ENV LOG_LEVEL=info
ENV PAYPAL_MODE=sandbox

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Exposition du port
EXPOSE 5000

# Volume pour données persistantes
VOLUME ["/app/uploads", "/app/logs"]

# Point d'entrée avec Tini pour gestion correcte des signaux
ENTRYPOINT ["/sbin/tini", "--"]

# Commande de démarrage
CMD ["npm", "start"]
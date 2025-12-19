#!/bin/bash
# Maintrix - Script d'arrêt Docker

echo "Arrêt de Maintrix..."

if [ -f docker-compose.yml ]; then
    docker-compose down
fi

if [ -f docker-compose.simple.yml ]; then
    docker-compose -f docker-compose.simple.yml down
fi

echo "Maintrix arrêté."

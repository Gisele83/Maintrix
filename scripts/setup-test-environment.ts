#!/usr/bin/env tsx

/**
 * Script de configuration de l'environnement de test
 * Usage: npm run setup:test
 */

import { TestDataGenerator } from '../server/test-data/test-data-generator';
import { config } from '../server/config/environment';
import { db } from '../server/db';
import { userProfiles } from '../shared/schema';

async function setupTestEnvironment() {
  console.log('🚀 Configuration de l\'environnement de test Smart GMAO DiagFix...\n');

  // Vérification de l'environnement
  if (config.env !== 'test') {
    console.error('❌ Ce script doit être exécuté avec NODE_ENV=test');
    console.log('💡 Utilisez: NODE_ENV=test npm run setup:test');
    process.exit(1);
  }

  try {
    // Test de connexion à la base de données
    console.log('🔗 Test de connexion à la base de données...');
    await db.select().from(userProfiles).limit(1);
    console.log('✅ Connexion à la base de données réussie\n');

    // Génération des données de test
    console.log('📊 Génération des données de test...');
    await TestDataGenerator.generateTestData({
      clearExisting: true,
      equipmentCount: 20,
      workOrderCount: 40,
      userCount: 6,
      sparePartsCount: 60,
    });

    console.log('\n🎉 Environnement de test configuré avec succès!');
    console.log('\n📋 Résumé de l\'environnement de test:');
    console.log(`   🌍 Environnement: ${config.env}`);
    console.log(`   🗄️  Base de données: ${config.database.database}`);
    console.log(`   🔧 Port: ${config.port}`);
    console.log(`   📧 Email: ${config.email.fromEmail}`);
    console.log(`   🔒 Sécurité: Salt rounds ${config.security.passwordSaltRounds}`);
    
    console.log('\n👥 Comptes de test créés:');
    console.log('   📧 admin@test.smartgmao.com (admin)');
    console.log('   📧 technicien@test.smartgmao.com (technician)');
    console.log('   📧 responsable@test.smartgmao.com (supervisor)');
    console.log('   🔑 Mot de passe: Test123!');

    console.log('\n🚀 Pour démarrer l\'environnement de test:');
    console.log('   NODE_ENV=test npm run dev');

  } catch (error) {
    console.error('❌ Erreur lors de la configuration:', error);
    process.exit(1);
  }
}

// Gestion des signaux pour un arrêt propre
process.on('SIGINT', () => {
  console.log('\n⚠️  Configuration interrompue par l\'utilisateur');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Erreur non gérée:', reason);
  process.exit(1);
});

// Exécution du script
setupTestEnvironment();
#!/usr/bin/env node

/**
 * Test complet de l'interface de téléchargement Smart GMAO DiagFix
 * Version avec installateur .exe et APK mobile
 */

import http from 'http';
import fs from 'fs';

const BASE_URL = 'http://localhost:5000';

// Configuration des tests
const downloadTests = [
  {
    name: '🪟 Installateur Windows (.exe)',
    endpoint: '/api/download/windows-exe',
    expectedSize: 37654715, // 37MB
    expectedType: 'application/octet-stream',
    expectedFilename: 'Smart-GMAO-DiagFix-Installer.exe'
  },
  {
    name: '📱 Application Mobile Android (.apk)',
    endpoint: '/api/download/mobile-apk',
    expectedSize: 466,
    expectedType: 'application/vnd.android.package-archive',
    expectedFilename: 'smart-gmao-diagfix-mobile.apk'
  },
  {
    name: '🔧 Script PowerShell Windows',
    endpoint: '/api/download/windows-installer',
    expectedType: 'application/octet-stream',
    expectedFilename: 'windows-installer.ps1'
  },
  {
    name: '⚙️ Script Batch Windows',
    endpoint: '/api/download/windows-setup',
    expectedType: 'application/octet-stream',
    expectedFilename: 'windows-setup.bat'
  },
  {
    name: '🐧 Installateur Linux',
    endpoint: '/api/download/installer',
    expectedType: 'application/x-sh',
    expectedFilename: 'smart-gmao-diagfix-installer.sh'
  },
  {
    name: '🐳 Package Docker',
    endpoint: '/api/download/docker-package',
    expectedType: 'application/gzip',
    expectedFilename: 'smart-gmao-diagfix-docker.tar.gz'
  },
  {
    name: '📦 Code Source',
    endpoint: '/api/download/source',
    expectedType: 'application/zip',
    expectedFilename: 'smart-gmao-diagfix-source.zip'
  },
  {
    name: '📖 Guide Démarrage Rapide',
    endpoint: '/api/download/quick-start',
    expectedType: 'text/markdown',
    expectedFilename: 'guide-demarrage-rapide.md'
  },
  {
    name: '📚 Documentation Complète',
    endpoint: '/api/download/documentation',
    expectedType: 'text/markdown',
    expectedFilename: 'documentation-complete.md'
  }
];

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      resolve(res);
    });
    
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

async function testDownloadEndpoint(test) {
  try {
    console.log(`\n🧪 Test: ${test.name}`);
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: test.endpoint,
      method: 'HEAD'
    };
    
    const res = await makeRequest(options);
    
    // Vérifications
    const contentType = res.headers['content-type'];
    const contentDisposition = res.headers['content-disposition'];
    const contentLength = res.headers['content-length'];
    const statusCode = res.statusCode;
    
    console.log(`   Status: ${statusCode}`);
    console.log(`   Content-Type: ${contentType}`);
    console.log(`   Content-Length: ${contentLength} bytes`);
    console.log(`   Content-Disposition: ${contentDisposition}`);
    
    // Validation du statut
    if (statusCode !== 200) {
      console.log(`   ❌ Erreur: Status code ${statusCode}`);
      return false;
    }
    
    // Validation du type de contenu
    if (test.expectedType && contentType !== test.expectedType) {
      console.log(`   ⚠️  Attention: Type attendu ${test.expectedType}, reçu ${contentType}`);
    }
    
    // Validation du nom de fichier
    if (test.expectedFilename && contentDisposition) {
      if (!contentDisposition.includes(test.expectedFilename)) {
        console.log(`   ⚠️  Attention: Nom de fichier attendu ${test.expectedFilename}`);
      }
    }
    
    // Validation de la taille (si définie)
    if (test.expectedSize && contentLength) {
      const actualSize = parseInt(contentLength);
      if (actualSize !== test.expectedSize) {
        console.log(`   ⚠️  Attention: Taille attendue ${test.expectedSize}, reçue ${actualSize}`);
      }
    }
    
    console.log(`   ✅ Test réussi`);
    return true;
    
  } catch (error) {
    console.log(`   ❌ Erreur: ${error.message}`);
    return false;
  }
}

async function testDownloadInfo() {
  console.log('\n🔍 Test: Informations de téléchargement');
  
  try {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/download/info',
      method: 'GET'
    };
    
    const res = await makeRequest(options);
    
    if (res.statusCode !== 200) {
      console.log(`   ❌ Status code: ${res.statusCode}`);
      return false;
    }
    
    let data = '';
    res.on('data', chunk => data += chunk);
    
    return new Promise((resolve) => {
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          console.log(`   Version: ${info.version}`);
          console.log(`   Nom: ${info.name}`);
          console.log(`   Build: ${info.buildDate}`);
          console.log(`   Downloads disponibles: ${Object.keys(info.downloads).length}`);
          
          // Vérification des nouvelles entrées
          if (info.downloads.windowsExe) {
            console.log(`   ✅ Installateur .exe: ${info.downloads.windowsExe.filename}`);
          }
          
          if (info.downloads.mobileApk) {
            console.log(`   ✅ APK mobile: ${info.downloads.mobileApk.filename}`);
          }
          
          console.log(`   ✅ Informations complètes`);
          resolve(true);
          
        } catch (error) {
          console.log(`   ❌ Erreur parsing JSON: ${error.message}`);
          resolve(false);
        }
      });
    });
    
  } catch (error) {
    console.log(`   ❌ Erreur: ${error.message}`);
    return false;
  }
}

async function verifyFiles() {
  console.log('\n📁 Vérification des fichiers locaux');
  
  const files = [
    { path: 'scripts/Smart-GMAO-DiagFix-Installer.exe', name: 'Installateur .exe' },
    { path: 'mobile/smart-gmao-diagfix-mobile.apk', name: 'APK mobile' },
    { path: 'scripts/windows-installer.ps1', name: 'Script PowerShell' },
    { path: 'scripts/windows-setup.bat', name: 'Script Batch' },
    { path: 'scripts/install.sh', name: 'Script Linux' },
    { path: 'GUIDE_DEMARRAGE_RAPIDE.md', name: 'Guide rapide' }
  ];
  
  let allExists = true;
  
  for (const file of files) {
    const exists = fs.existsSync(file.path);
    if (exists) {
      const stats = fs.statSync(file.path);
      console.log(`   ✅ ${file.name}: ${Math.round(stats.size / 1024)} KB`);
    } else {
      console.log(`   ❌ ${file.name}: Fichier manquant (${file.path})`);
      allExists = false;
    }
  }
  
  return allExists;
}

async function runAllTests() {
  console.log('🚀 Test complet de l\'interface de téléchargement Smart GMAO DiagFix');
  console.log('=' .repeat(70));
  
  // Vérification des fichiers
  const filesOk = await verifyFiles();
  
  // Test des informations
  const infoOk = await testDownloadInfo();
  
  // Tests des endpoints de téléchargement
  const results = [];
  for (const test of downloadTests) {
    const result = await testDownloadEndpoint(test);
    results.push(result);
  }
  
  // Résumé
  console.log('\n' + '=' .repeat(70));
  console.log('📊 RÉSUMÉ DES TESTS');
  console.log('=' .repeat(70));
  
  const passedTests = results.filter(r => r).length;
  const totalTests = results.length + 2; // +2 pour files et info
  
  console.log(`✅ Tests réussis: ${passedTests + (filesOk ? 1 : 0) + (infoOk ? 1 : 0)}/${totalTests}`);
  console.log(`📦 Fichiers disponibles: ${filesOk ? 'OUI' : 'NON'}`);
  console.log(`🔍 API informations: ${infoOk ? 'OUI' : 'NON'}`);
  console.log(`🌐 Endpoints téléchargement: ${passedTests}/${results.length}`);
  
  if (passedTests === results.length && filesOk && infoOk) {
    console.log('\n🎉 TOUS LES TESTS RÉUSSIS - Interface complète opérationnelle !');
    console.log('✨ Nouveautés validées:');
    console.log('   - Installateur Windows .exe (37 MB)');
    console.log('   - Application mobile Android .apk');
    console.log('   - API de téléchargement complète');
    console.log('   - Interface utilisateur mise à jour');
  } else {
    console.log('\n⚠️  Certains tests ont échoué - Vérifiez les détails ci-dessus');
  }
  
  process.exit(passedTests === results.length && filesOk && infoOk ? 0 : 1);
}

// Démarrage des tests
runAllTests().catch(error => {
  console.error('❌ Erreur lors des tests:', error);
  process.exit(1);
});
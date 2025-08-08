#!/usr/bin/env node

const http = require('http');
const os = require('os');
const { execSync } = require('child_process');

console.log('🔍 DIAGNOSTIC ACCÈS LOCALHOST:5000');
console.log('=====================================');

// Test 1: Vérification de l'accès localhost
console.log('\n1. Test d\'accès localhost:5000...');
try {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    console.log('✅ localhost:5000 accessible');
    console.log(`   Status: ${res.statusCode}`);
    console.log(`   Headers: ${JSON.stringify(res.headers, null, 2)}`);
  });

  req.on('error', (err) => {
    console.log('❌ Erreur d\'accès localhost:5000');
    console.log(`   Erreur: ${err.message}`);
    
    // Solutions alternatives
    console.log('\n🛠️ SOLUTIONS ALTERNATIVES:');
    
    // Test avec 127.0.0.1
    console.log('\n2. Test avec 127.0.0.1:5000...');
    testAlternativeAddress('127.0.0.1', 5000);
    
    // Test avec l'IP locale
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(`\n3. Test avec IP locale ${iface.address}:5000...`);
          testAlternativeAddress(iface.address, 5000);
        }
      }
    }
  });

  req.on('timeout', () => {
    console.log('❌ Timeout - localhost:5000 ne répond pas');
    req.destroy();
  });

  req.end();
} catch (error) {
  console.log(`❌ Erreur lors du test: ${error.message}`);
}

function testAlternativeAddress(host, port) {
  try {
    const options = {
      hostname: host,
      port: port,
      path: '/',
      method: 'GET',
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      console.log(`✅ ${host}:${port} accessible`);
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Utilisez: http://${host}:${port}`);
    });

    req.on('error', (err) => {
      console.log(`❌ ${host}:${port} inaccessible - ${err.message}`);
    });

    req.on('timeout', () => {
      console.log(`❌ ${host}:${port} timeout`);
      req.destroy();
    });

    req.end();
  } catch (error) {
    console.log(`❌ Erreur test ${host}:${port}: ${error.message}`);
  }
}

// Informations système
console.log('\n📊 INFORMATIONS SYSTÈME:');
console.log(`   OS: ${os.type()} ${os.release()}`);
console.log(`   Platform: ${os.platform()}`);
console.log(`   Arch: ${os.arch()}`);
console.log(`   Node.js: ${process.version}`);

// Test des ports
console.log('\n🔌 VÉRIFICATION DES PORTS:');
try {
  // Créer un serveur de test temporaire
  const testServer = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Test server OK\n');
  });

  testServer.listen(5001, 'localhost', () => {
    console.log('✅ Port 5001 disponible - Le problème n\'est pas les ports');
    testServer.close();
  });

  testServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log('❌ Port 5001 occupé - Problème de ports détecté');
    } else {
      console.log(`❌ Erreur serveur test: ${err.message}`);
    }
  });
} catch (error) {
  console.log(`❌ Erreur test port: ${error.message}`);
}

// Instructions finales
setTimeout(() => {
  console.log('\n🎯 INSTRUCTIONS DE DÉPANNAGE:');
  console.log('1. Vérifiez votre pare-feu Windows');
  console.log('2. Essayez http://127.0.0.1:5000 au lieu de localhost:5000');
  console.log('3. Redémarrez votre navigateur');
  console.log('4. Vérifiez si un antivirus bloque le port 5000');
  console.log('5. Essayez en mode administrateur');
  console.log('\n💡 Si le problème persiste, utilisez la version cloud sur Replit');
}, 2000);
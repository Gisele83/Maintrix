<?php
/**
 * 🚀 MAINTRIX - Installateur PHP pour Environnement WAMP
 * Script d'installation et de configuration pour déploiement sur Windows/Apache/MySQL/PHP
 * 
 * Usage: php install_maintrix.php [--port=8080] [--apache-dir=C:\wamp64\www] [--mysql-root-password=password]
 * 
 * Requiert: PHP 7.4+, droits administrateur, Docker Desktop ou WSL2
 */

// Configuration par défaut
define('MAINTRIX_VERSION', '2.0.0');
define('DEFAULT_WEB_PORT', '8080');
define('DEFAULT_APACHE_DIR', 'C:\\wamp64\\www');
define('DEFAULT_INSTALL_DIR', 'C:\\Maintrix');

class MaintrixInstaller {
    private $config = [];
    private $isWindows = true;
    private $hasErrors = false;
    
    public function __construct() {
        $this->isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
        $this->parseArguments();
        $this->initializeConfig();
    }
    
    /**
     * Point d'entrée principal
     */
    public function install() {
        $this->printHeader();
        
        if (!$this->checkPrerequisites()) {
            $this->printError("❌ Prérequis non satisfaits. Installation interrompue.");
            return false;
        }
        
        $this->printSuccess("✅ Prérequis validés");
        
        // Étapes d'installation
        $steps = [
            'createDirectories' => 'Création des répertoires',
            'generateConfiguration' => 'Génération de la configuration',
            'installMaintrixCore' => 'Installation du cœur Maintrix',
            'buildFrontend' => 'Construction du frontend',
            'configureApache' => 'Configuration Apache',
            'setupDatabase' => 'Configuration base de données',
            'startServices' => 'Démarrage des services',
            'verifyInstallation' => 'Vérification de l\'installation'
        ];
        
        foreach ($steps as $method => $description) {
            $this->printInfo("🔧 $description...");
            if (!$this->$method()) {
                $this->printError("❌ Échec: $description");
                return false;
            }
            $this->printSuccess("✅ $description terminé");
        }
        
        $this->printInstallationComplete();
        return true;
    }
    
    /**
     * Vérification des prérequis système
     */
    private function checkPrerequisites() {
        $checks = [];
        
        // Vérification droits administrateur
        if ($this->isWindows) {
            $isAdmin = $this->isRunningAsAdmin();
            $checks['admin'] = $isAdmin;
            if (!$isAdmin) {
                $this->printWarning("⚠️  Droits administrateur requis pour l'installation complète");
            }
        }
        
        // Vérification PHP
        $phpVersion = PHP_VERSION;
        $checks['php'] = version_compare($phpVersion, '7.4.0', '>=');
        $this->printInfo("PHP Version: $phpVersion");
        
        // Vérification extensions PHP
        $requiredExtensions = ['curl', 'json', 'zip'];
        foreach ($requiredExtensions as $ext) {
            $checks["php_$ext"] = extension_loaded($ext);
            if (!$checks["php_$ext"]) {
                $this->printError("Extension PHP manquante: $ext");
            }
        }
        
        // Vérification Docker
        $checks['docker'] = $this->checkDockerAvailability();
        
        // Vérification Node.js (si disponible)
        $checks['node'] = $this->checkNodeAvailability();
        
        // Vérification Apache
        $checks['apache'] = $this->checkApacheDirectory();
        
        return !in_array(false, $checks, true);
    }
    
    /**
     * Création de la structure de répertoires
     */
    private function createDirectories() {
        $directories = [
            $this->config['install_dir'],
            $this->config['install_dir'] . '\\data',
            $this->config['install_dir'] . '\\data\\postgres',
            $this->config['install_dir'] . '\\data\\uploads', 
            $this->config['install_dir'] . '\\data\\logs',
            $this->config['install_dir'] . '\\config',
            $this->config['install_dir'] . '\\backups',
            $this->config['apache_dir'] . '\\maintrix'
        ];
        
        foreach ($directories as $dir) {
            if (!is_dir($dir)) {
                if (!mkdir($dir, 0755, true)) {
                    $this->printError("Impossible de créer le répertoire: $dir");
                    return false;
                }
            }
        }
        
        return true;
    }
    
    /**
     * Génération des fichiers de configuration
     */
    private function generateConfiguration() {
        // Configuration .env.local
        $envContent = $this->generateEnvFile();
        $envPath = $this->config['install_dir'] . '\\.env.local';
        
        if (!file_put_contents($envPath, $envContent)) {
            $this->printError("Impossible de créer le fichier .env.local");
            return false;
        }
        
        // Configuration docker-compose personnalisée
        $dockerComposeContent = $this->generateDockerCompose();
        $dockerPath = $this->config['install_dir'] . '\\docker-compose.yml';
        
        if (!file_put_contents($dockerPath, $dockerComposeContent)) {
            $this->printError("Impossible de créer docker-compose.yml");
            return false;
        }
        
        return true;
    }
    
    /**
     * Installation du cœur Maintrix via PowerShell ou EXE
     */
    private function installMaintrixCore() {
        $installDir = $this->config['install_dir'];
        
        // Vérifier la présence du script PowerShell
        $psScript = $installDir . '\\install-maintrix.ps1';
        $exeInstaller = $installDir . '\\scripts\\Smart-GMAO-DiagFix-Setup-Fixed.exe';
        
        if (file_exists($exeInstaller)) {
            // Utiliser l'installateur EXE
            $cmd = "Start-Process '$exeInstaller' -Verb RunAs -Wait";
            return $this->executePowerShell($cmd);
        } elseif (file_exists($psScript)) {
            // Débloquer et exécuter le script PowerShell
            $commands = [
                "Unblock-File -Path '$psScript'",
                "Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force",
                "& '$psScript' -InstallDir '$installDir' -WebPort {$this->config['web_port']}"
            ];
            
            foreach ($commands as $cmd) {
                if (!$this->executePowerShell($cmd)) {
                    return false;
                }
            }
            return true;
        } else {
            // Installation via Docker directement
            return $this->installViaDocker();
        }
    }
    
    /**
     * Construction du frontend
     */
    private function buildFrontend() {
        $installDir = $this->config['install_dir'];
        
        if (is_dir($installDir . '\\client')) {
            // Construire avec npm si disponible
            if ($this->checkNodeAvailability()) {
                $commands = [
                    "cd '$installDir' && npm ci",
                    "cd '$installDir' && npm run build"
                ];
                
                foreach ($commands as $cmd) {
                    if (!$this->executeCommand($cmd)) {
                        $this->printWarning("Échec construction npm, tentative Docker...");
                        return $this->buildFrontendWithDocker();
                    }
                }
                
                // Copier le build vers Apache
                return $this->copyFrontendToApache();
            }
        }
        
        return $this->buildFrontendWithDocker();
    }
    
    /**
     * Configuration Apache avec reverse proxy
     */
    private function configureApache() {
        $vhostContent = $this->generateApacheVhost();
        $vhostPath = $this->config['apache_dir'] . '\\..\\apache24\\conf\\extra\\httpd-maintrix.conf';
        
        // Créer le fichier de configuration
        if (!file_put_contents($vhostPath, $vhostContent)) {
            $this->printWarning("Impossible de créer la configuration Apache automatiquement");
            $this->printManualApacheConfig();
            return true; // Considérer comme succès pour installation manuelle
        }
        
        $this->printSuccess("Configuration Apache créée: $vhostPath");
        $this->printInfo("Redémarrez Apache pour appliquer les changements");
        
        return true;
    }
    
    /**
     * Configuration de la base de données
     */
    private function setupDatabase() {
        // Pour le moment, utiliser PostgreSQL via Docker
        // L'adaptation MySQL serait une évolution future
        return $this->startPostgreSQLContainer();
    }
    
    /**
     * Démarrage des services
     */
    private function startServices() {
        $installDir = $this->config['install_dir'];
        
        if ($this->checkDockerAvailability()) {
            $cmd = "cd '$installDir' && docker-compose up -d";
            return $this->executeCommand($cmd);
        }
        
        return false;
    }
    
    /**
     * Vérification de l'installation
     */
    private function verifyInstallation() {
        $webPort = $this->config['web_port'];
        $healthUrl = "http://localhost:$webPort/api/health";
        
        // Attendre le démarrage
        sleep(10);
        
        // Vérifier l'API
        $context = stream_context_create([
            'http' => [
                'timeout' => 5,
                'ignore_errors' => true
            ]
        ]);
        
        $response = @file_get_contents($healthUrl, false, $context);
        
        if ($response === false) {
            $this->printWarning("API non accessible sur $healthUrl");
            return false;
        }
        
        $this->printSuccess("API accessible sur $healthUrl");
        return true;
    }
    
    /**
     * Utilitaires de commandes
     */
    private function executeCommand($command) {
        $output = [];
        $returnVar = 0;
        
        exec($command . ' 2>&1', $output, $returnVar);
        
        if ($returnVar !== 0) {
            $this->printError("Commande échouée: $command");
            $this->printError("Sortie: " . implode("\n", $output));
            return false;
        }
        
        return true;
    }
    
    private function executePowerShell($command) {
        $psCommand = "powershell -NoProfile -ExecutionPolicy Bypass -Command \"$command\"";
        return $this->executeCommand($psCommand);
    }
    
    /**
     * Vérifications système
     */
    private function isRunningAsAdmin() {
        if (!$this->isWindows) return true;
        
        $output = [];
        exec('net session 2>&1', $output, $returnVar);
        return $returnVar === 0;
    }
    
    private function checkDockerAvailability() {
        $output = [];
        exec('docker --version 2>nul', $output, $returnVar);
        return $returnVar === 0;
    }
    
    private function checkNodeAvailability() {
        $output = [];
        exec('node --version 2>nul', $output, $returnVar);
        return $returnVar === 0;
    }
    
    private function checkApacheDirectory() {
        return is_dir($this->config['apache_dir']);
    }
    
    /**
     * Génération de contenu de configuration
     */
    private function generateEnvFile() {
        return <<<ENV
# MAINTRIX - Configuration PHP Installer Generated
MAINTRIX_VERSION=2.0.0
DB_PASSWORD={$this->config['db_password']}
SESSION_SECRET={$this->config['session_secret']}
WEB_PORT={$this->config['web_port']}
DB_PORT=5433
WAMP_DEPLOYMENT=true
LOCAL_DEPLOYMENT=true
DISABLE_TELEMETRY=true
APACHE_DIR={$this->config['apache_dir']}
ENV;
    }
    
    private function generateDockerCompose() {
        return <<<YAML
version: '3.8'
services:
  maintrix-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: maintrix
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: {$this->config['db_password']}
    ports:
      - "5433:5432"
    volumes:
      - {$this->config['install_dir']}/data/postgres:/var/lib/postgresql/data
    restart: unless-stopped
    
  maintrix-app:
    build: .
    ports:
      - "{$this->config['web_port']}:3000"
    environment:
      DATABASE_URL: postgresql://postgres:{$this->config['db_password']}@maintrix-db:5432/maintrix
      SESSION_SECRET: {$this->config['session_secret']}
    depends_on:
      - maintrix-db
    restart: unless-stopped
    volumes:
      - {$this->config['install_dir']}/data/uploads:/app/uploads
YAML;
    }
    
    private function generateApacheVhost() {
        $webPort = $this->config['web_port'];
        return <<<APACHE
# Configuration Maintrix pour Apache
<VirtualHost *:80>
    DocumentRoot "{$this->config['apache_dir']}/maintrix"
    
    # Servir les fichiers statiques
    <Directory "{$this->config['apache_dir']}/maintrix">
        AllowOverride All
        Require all granted
        
        # Gestion SPA React
        <IfModule mod_rewrite.c>
            RewriteEngine On
            RewriteBase /maintrix/
            RewriteRule ^index\.html$ - [L]
            RewriteCond %{REQUEST_FILENAME} !-f
            RewriteCond %{REQUEST_FILENAME} !-d
            RewriteRule . /maintrix/index.html [L]
        </IfModule>
    </Directory>
    
    # Proxy vers l'API Node.js
    ProxyPreserveHost On
    ProxyPass /maintrix/api/ http://127.0.0.1:$webPort/api/
    ProxyPassReverse /maintrix/api/ http://127.0.0.1:$webPort/api/
    
    Alias /maintrix "{$this->config['apache_dir']}/maintrix"
</VirtualHost>
APACHE;
    }
    
    /**
     * Méthodes d'installation alternatives
     */
    private function installViaDocker() {
        $installDir = $this->config['install_dir'];
        $commands = [
            "cd '$installDir'",
            "docker-compose build --no-cache",
            "docker-compose up -d maintrix-db",
            "timeout /t 30",
            "docker-compose up -d maintrix-app"
        ];
        
        foreach ($commands as $cmd) {
            if (!$this->executeCommand($cmd)) {
                return false;
            }
        }
        
        return true;
    }
    
    private function buildFrontendWithDocker() {
        $installDir = $this->config['install_dir'];
        $cmd = "cd '$installDir' && docker run --rm -v ${installDir}:/app -w /app node:18-alpine sh -c 'npm ci && npm run build'";
        
        if ($this->executeCommand($cmd)) {
            return $this->copyFrontendToApache();
        }
        
        return false;
    }
    
    private function copyFrontendToApache() {
        $srcDir = $this->config['install_dir'] . '\\client\\dist';
        $destDir = $this->config['apache_dir'] . '\\maintrix';
        
        if (!is_dir($srcDir)) {
            $this->printError("Répertoire de build frontend non trouvé: $srcDir");
            return false;
        }
        
        return $this->copyDirectory($srcDir, $destDir);
    }
    
    private function startPostgreSQLContainer() {
        $installDir = $this->config['install_dir'];
        $cmd = "cd '$installDir' && docker-compose up -d maintrix-db";
        return $this->executeCommand($cmd);
    }
    
    /**
     * Utilitaires de fichiers
     */
    private function copyDirectory($src, $dest) {
        if ($this->isWindows) {
            $cmd = "xcopy \"$src\" \"$dest\" /E /I /Y";
        } else {
            $cmd = "cp -r \"$src\"/* \"$dest\"/";
        }
        
        return $this->executeCommand($cmd);
    }
    
    /**
     * Configuration et arguments
     */
    private function parseArguments() {
        global $argv;
        
        $options = getopt('', [
            'port:',
            'apache-dir:',
            'install-dir:',
            'mysql-root-password:',
            'help'
        ]);
        
        if (isset($options['help'])) {
            $this->printHelp();
            exit(0);
        }
        
        $this->config = [
            'web_port' => $options['port'] ?? DEFAULT_WEB_PORT,
            'apache_dir' => $options['apache-dir'] ?? DEFAULT_APACHE_DIR,
            'install_dir' => $options['install-dir'] ?? DEFAULT_INSTALL_DIR,
            'mysql_root_password' => $options['mysql-root-password'] ?? '',
            'db_password' => $this->generatePassword(),
            'session_secret' => $this->generatePassword(64)
        ];
    }
    
    private function initializeConfig() {
        // Normaliser les chemins Windows
        $this->config['apache_dir'] = rtrim(str_replace('/', '\\', $this->config['apache_dir']), '\\');
        $this->config['install_dir'] = rtrim(str_replace('/', '\\', $this->config['install_dir']), '\\');
    }
    
    private function generatePassword($length = 32) {
        return bin2hex(random_bytes($length / 2));
    }
    
    /**
     * Affichage et logging
     */
    private function printHeader() {
        echo "\n";
        echo "🚀 ================================\n";
        echo "   MAINTRIX - Installateur WAMP   \n";
        echo "   Version: " . MAINTRIX_VERSION . "\n";
        echo "================================\n\n";
    }
    
    private function printInstallationComplete() {
        echo "\n";
        echo "🎉 ================================\n";
        echo "   INSTALLATION TERMINÉE !         \n";
        echo "================================\n\n";
        echo "📍 ACCÈS:\n";
        echo "   • Application: http://localhost/maintrix\n";
        echo "   • API: http://localhost:{$this->config['web_port']}/api\n\n";
        echo "🔑 IDENTIFIANTS PAR DÉFAUT:\n";
        echo "   • Utilisateur: admin@maintrix.local\n";
        echo "   • Mot de passe: Maintrix2024!\n\n";
        echo "📁 RÉPERTOIRES:\n";
        echo "   • Installation: {$this->config['install_dir']}\n";
        echo "   • Web: {$this->config['apache_dir']}\\maintrix\n\n";
        echo "⚠️  PROCHAINES ÉTAPES:\n";
        echo "   1. Redémarrer Apache\n";
        echo "   2. Vérifier http://localhost/maintrix\n";
        echo "   3. Changer le mot de passe par défaut\n\n";
    }
    
    private function printManualApacheConfig() {
        echo "\n📝 CONFIGURATION APACHE MANUELLE:\n";
        echo "Ajoutez ceci dans httpd.conf ou créez un fichier de configuration:\n\n";
        echo $this->generateApacheVhost();
        echo "\n\n";
    }
    
    private function printHelp() {
        echo "\n🚀 MAINTRIX - Installateur WAMP\n\n";
        echo "Usage: php install_maintrix.php [OPTIONS]\n\n";
        echo "Options:\n";
        echo "  --port=8080                Port pour l'application Maintrix\n";
        echo "  --apache-dir=C:\\wamp64\\www  Répertoire web Apache\n";
        echo "  --install-dir=C:\\Maintrix   Répertoire d'installation\n";
        echo "  --mysql-root-password=pwd   Mot de passe root MySQL (future utilisation)\n";
        echo "  --help                      Afficher cette aide\n\n";
        echo "Exemple:\n";
        echo "  php install_maintrix.php --port=9090 --apache-dir=C:\\xampp\\htdocs\n\n";
    }
    
    private function printSuccess($message) {
        echo "\033[32m$message\033[0m\n";
    }
    
    private function printError($message) {
        echo "\033[31m$message\033[0m\n";
        $this->hasErrors = true;
    }
    
    private function printWarning($message) {
        echo "\033[33m$message\033[0m\n";
    }
    
    private function printInfo($message) {
        echo "\033[36m$message\033[0m\n";
    }
}

// Vérification CLI uniquement
if (php_sapi_name() !== 'cli') {
    die("❌ Ce script doit être exécuté en ligne de commande uniquement.\n");
}

// Exécution
$installer = new MaintrixInstaller();
$success = $installer->install();

exit($success ? 0 : 1);
?>
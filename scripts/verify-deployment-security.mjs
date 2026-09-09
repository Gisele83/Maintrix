#!/usr/bin/env node
/**
 * F03 — Vérification de la sécurité de déploiement.
 *
 * Barrière de non-régression : échoue si un secret réapparaît en dur dans un
 * fichier versionné, si un service d'infrastructure est réexposé sur une
 * interface publique, ou si le compose ne suffit plus à démarrer le serveur.
 *
 *   node scripts/verify-deployment-security.mjs
 *
 * Ne nécessite PAS le démon Docker : `docker compose config` résout les
 * fichiers hors ligne. Le test T5 lance le bootstrap du serveur jusqu'au
 * contrôle d'environnement de server/index.ts, sans base de données.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const COMPOSE_FILES = ['docker-compose.yml', 'docker-compose.simple.yml'];

// Variables dont la valeur ne doit JAMAIS être littérale dans un fichier versionné.
const SECRET_KEYS = [
  'POSTGRES_PASSWORD', 'SESSION_SECRET', 'JWT_SECRET', 'KMS_MASTER_KEY',
  'MFA_ENCRYPTION_KEY', 'REDIS_PASSWORD', 'GF_SECURITY_ADMIN_PASSWORD',
  'ANTHROPIC_API_KEY', 'SENDGRID_API_KEY', 'STRIPE_SECRET_KEY', 'PAYPAL_CLIENT_SECRET',
];

// Mots de passe présents dans l'historique public : ils ne doivent plus apparaître.
const LEAKED_LITERALS = [
  'maintrix_secure_password',
  'maintrix_session_secret_very_long_and_secure_for_production',
  'maintrix_admin',
];

// Seuls ports légitimement joignables depuis Internet.
const PUBLIC_ALLOWED = { nginx: ['80', '443'] };

// Les 5 variables sans lesquelles server/index.ts arrête le processus (exit 1).
const CRITICAL_ENV = ['DATABASE_URL', 'KMS_MASTER_KEY', 'JWT_SECRET', 'SESSION_SECRET', 'MFA_ENCRYPTION_KEY'];

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };
const ko = (m, d) => { console.log(`  ✗ ${m}`); if (d) console.log(String(d).split('\n').slice(0, 5).map(l => '      ' + l).join('\n')); fail++; };
const section = (t) => console.log(`\n── ${t}`);

const TMP = mkdtempSync(join(tmpdir(), 'f03-'));
process.on('exit', () => { try { rmSync(TMP, { recursive: true, force: true }); } catch {} });

/** Exécute une commande ; renvoie {code, out} sans lever d'exception. */
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: false, ...opts });
  const stdout = r.stdout || '', stderr = r.stderr || '';
  return { code: r.status ?? 1, stdout, stderr, out: `${stdout}${stderr}` };
}

/**
 * Cherche un littéral employé COMME SECRET dans les fichiers suivis.
 *
 * Un même jeton peut être un nom d'utilisateur (`psql -U maintrix_admin`,
 * `MasterUsername: maintrix_admin`) — ce n'est alors pas un secret. On ne
 * retient donc que les emplois en position de valeur secrète :
 *   - affectation d'une variable de type mot de passe / secret ;
 *   - partie mot de passe d'une URL de connexion (`user:LITTERAL@hote`) ;
 *   - identifiants documentés du type `admin / LITTERAL`.
 */
function findSecretUsages(literal) {
  const r = run('git', ['grep', '-n', '-F', literal, '--', '.']);
  if (r.code !== 0) return [];
  const esc = literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const asSecret = new RegExp(
    '(?:' +
      `[A-Z_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API_?KEY)[A-Z_]*\\s*[:=]\\s*"?${esc}` +
    '|' +
      `:${esc}@` +                                   // mot de passe dans une URL
    '|' +
      `(?:admin|identifiant|login|user)\\s*[/:]\\s*${esc}` + // identifiants documentés
    ')', 'i');
  return r.out.trim().split('\n').filter(Boolean).filter(l => asSecret.test(l));
}

// ═══════════════════════════════════════════════════════════════════
section('T1 — Aucun secret en dur dans les fichiers versionnés');

const keyRe = new RegExp(`^[^#]*\\b(${SECRET_KEYS.join('|')})=(.*)$`);
for (const f of [...COMPOSE_FILES, 'redis/redis.conf', 'Dockerfile']) {
  if (!existsSync(f)) continue;
  const offenders = readFileSync(f, 'utf8').split(/\r?\n/)
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => {
      const m = line.match(keyRe);
      if (!m) return false;
      const value = m[2].trim();
      // Acceptable : vide, ou interpolation ${...} (aucune valeur dans le dépôt).
      return value !== '' && !value.startsWith('${');
    });
  if (offenders.length === 0) ok(`${f} : aucune valeur sensible littérale`);
  else ko(`${f} : valeur(s) en dur`, offenders.map(o => `L${o.n}: ${o.line.trim()}`).join('\n'));
}

for (const lit of LEAKED_LITERALS) {
  const hits = findSecretUsages(lit);
  if (hits.length === 0) ok(`« ${lit} » n'est plus employé comme secret`);
  else ko(`« ${lit} » encore employé comme secret`, hits.join('\n'));
}

if (/^\s*requirepass\s+\S/m.test(readFileSync('redis/redis.conf', 'utf8'))) {
  ko('redis/redis.conf contient un requirepass en dur');
} else {
  ok('redis/redis.conf : aucun mot de passe stocké');
}

if (/^\s*protected-mode\s+no\s*$/m.test(readFileSync('redis/redis.conf', 'utf8'))) {
  ko('redis/redis.conf : protected-mode désactivé');
} else {
  ok('redis/redis.conf : protected-mode actif');
}

// ═══════════════════════════════════════════════════════════════════
section('T2 — Refus immédiat quand les secrets obligatoires sont absents');

const emptyEnv = join(TMP, 'empty.env');
writeFileSync(emptyEnv, '');
for (const f of COMPOSE_FILES) {
  const r = run('docker', ['compose', '-f', f, '--env-file', emptyEnv, 'config']);
  if (r.code === 0) ko(`${f} : configuration acceptée SANS secrets (repli silencieux)`);
  else if (/required/i.test(r.out)) ok(`${f} : refus explicite sans secrets`);
  else ko(`${f} : échec pour un motif inattendu`, r.out);
}

// ═══════════════════════════════════════════════════════════════════
section('T3 — Configuration valide avec un jeu de secrets complet');

const fullEnv = join(TMP, 'full.env');
writeFileSync(fullEnv, [
  'POSTGRES_PASSWORD=verif_pw_not_a_real_secret',
  'SESSION_SECRET=verif_session',
  'JWT_SECRET=verif_jwt',
  'KMS_MASTER_KEY=verif_kms_master_key_at_least_32_chars_long',
  'MFA_ENCRYPTION_KEY=verif_mfa_key_at_least_32_characters_long',
  'REDIS_PASSWORD=verif_redis',
  'GRAFANA_ADMIN_PASSWORD=verif_grafana',
  '',
].join('\n'));

const resolved = {};
for (const f of COMPOSE_FILES) {
  const r = run('docker', ['compose', '-f', f, '--env-file', fullEnv, 'config', '--format', 'json']);
  if (r.code !== 0) { ko(`${f} : configuration invalide`, r.out); continue; }
  try {
    resolved[f] = JSON.parse(r.stdout);
    ok(`${f} : configuration résolue`);
  } catch (e) { ko(`${f} : sortie JSON illisible`, e.message); }
}

// ═══════════════════════════════════════════════════════════════════
section('T4 — Aucun service interne publié sur une interface publique');

for (const [f, cfg] of Object.entries(resolved)) {
  const violations = [];
  const seen = [];
  for (const [name, svc] of Object.entries(cfg.services || {})) {
    for (const p of svc.ports || []) {
      const host = p.host_ip ?? '0.0.0.0';
      const pub = String(p.published ?? '');
      const loopback = host === '127.0.0.1' || host === '::1';
      const allowed = (PUBLIC_ALLOWED[name] || []).includes(pub);
      seen.push(`${name} → ${host}:${pub}${loopback || allowed ? '' : '   ← PUBLIC'}`);
      if (!loopback && !allowed) violations.push(`${name} → ${host}:${pub}`);
    }
  }
  console.log(seen.length ? seen.map(s => '      ' + s).join('\n') : '      (aucun port publié)');
  if (violations.length === 0) ok(`${f} : seuls nginx:80/443 et la boucle locale sont publiés`);
  else ko(`${f} : service interne exposé`, violations.join('\n'));
}

// ═══════════════════════════════════════════════════════════════════
section('T5 — Le serveur franchit son contrôle d\'environnement de production');

const appEnv = {};
{
  const cfg = resolved['docker-compose.yml'];
  const raw = (cfg?.services?.app?.environment) || {};
  for (const [k, v] of Object.entries(raw)) appEnv[k] = v == null ? '' : String(v);
}
console.log(`      variables transmises au service app : ${Object.keys(appEnv).length}`);

const missing = CRITICAL_ENV.filter(k => !appEnv[k]);
if (missing.length === 0) ok('les 5 variables critiques de server/index.ts sont fournies par le compose');
else ko('variables critiques absentes du compose', missing.join(', '));

// Démarrage réel : on n'attend pas que le serveur écoute, seulement que le
// garde `validateProductionEnvironment()` ne provoque plus exit(1).
if (missing.length > 0) {
  ko('démarrage non testé : environnement du service app non résolu');
} else {
  const tsx = join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
  const env = {
    PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
    ...appEnv,
    NODE_ENV: 'production',
    DOTENV_CONFIG_PATH: join(TMP, 'no.env'), // neutralise le .env de développement
  };
  const r = spawnSync(tsx, ['server/index.ts'], { encoding: 'utf8', env, timeout: 120000 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  writeFileSync(join(TMP, 'boot.log'), out);
  if (/DÉMARRAGE BLOQUÉ/.test(out)) {
    const block = out.slice(out.indexOf('DÉMARRAGE BLOQUÉ'), out.indexOf('DÉMARRAGE BLOQUÉ') + 400);
    ko('le garde de production bloque encore le démarrage', block);
  } else {
    ok("le garde de production est franchi (plus d'arrêt sur configuration manquante)");
  }
}

// ═══════════════════════════════════════════════════════════════════
section('T6 — Aucun secret ne fuit dans les commandes rendues par compose');

// `docker compose config` est fréquemment collé dans des tickets ou des logs.
// Les valeurs sensibles ne doivent apparaître que dans les blocs `environment`,
// jamais dans `command:` ni dans `healthcheck:` (où `$$VAR` diffère la
// résolution au shell du conteneur).
{
  const SENTINELS = { REDIS_PASSWORD: 'verif_redis', POSTGRES_PASSWORD: 'verif_pw_not_a_real_secret' };
  for (const [f, cfg] of Object.entries(resolved)) {
    const leaks = [];
    for (const [name, svc] of Object.entries(cfg.services || {})) {
      const rendered = JSON.stringify({ command: svc.command, healthcheck: svc.healthcheck });
      for (const [key, val] of Object.entries(SENTINELS)) {
        if (rendered.includes(val)) leaks.push(`${name}: ${key} interpolé dans command/healthcheck`);
      }
    }
    if (leaks.length === 0) ok(`${f} : aucun secret interpolé dans command/healthcheck`);
    else ko(`${f} : secret exposé par \`docker compose config\``, leaks.join('\n'));
  }
}

// ═══════════════════════════════════════════════════════════════════
section('T7 — Les secrets générés restent hors du dépôt');

for (const path of ['.env.docker', '_pgdata_backup/PG_VERSION']) {
  const r = run('git', ['check-ignore', '-q', path]);
  if (r.code === 0) ok(`${path} est ignoré par git`);
  else ko(`${path} n'est PAS ignoré par git`);
}

if (existsSync('.env.docker.example')) {
  const filled = readFileSync('.env.docker.example', 'utf8').split(/\r?\n/)
    .filter(l => /^(POSTGRES_PASSWORD|SESSION_SECRET|JWT_SECRET|KMS_MASTER_KEY|MFA_ENCRYPTION_KEY|REDIS_PASSWORD|GRAFANA_ADMIN_PASSWORD)=.+/.test(l));
  if (filled.length === 0) ok('.env.docker.example ne contient aucune valeur secrète');
  else ko('.env.docker.example contient une valeur réelle', filled.join('\n'));
} else ko('.env.docker.example est absent');

// ═══════════════════════════════════════════════════════════════════
section('T8 — Surface d\'attaque réduite avant ouverture (F11)');

// ── Bannière nginx ────────────────────────────────────────────────
// `server_tokens on` (défaut) publie la version exacte dans l'en-tête Server
// et sur les pages d'erreur. Cela n'ouvre aucune porte, mais indique à un
// attaquant quelles failles publiées essayer en premier.
if (existsSync('nginx/nginx.conf')) {
  const conf = readFileSync('nginx/nginx.conf', 'utf8');
  if (/^\s*server_tokens\s+off\s*;/m.test(conf)) ok('nginx : server_tokens off (version masquée)');
  else ko('nginx publie sa version exacte', 'Ajoutez `server_tokens off;` dans le bloc http.');
} else ko('nginx/nginx.conf est absent');

// ── Documentation d'API ───────────────────────────────────────────
// /api-docs exposait sans authentification la carte complète des routes, des
// paramètres et des schémas. Conservée — elle sert aux testeurs — mais elle
// doit rester un choix explicite en production.
if (existsSync('server/swagger-config.ts')) {
  const src = readFileSync('server/swagger-config.ts', 'utf8');
  const garde = /NODE_ENV\s*===\s*["']production["']/.test(src) && /ENABLE_API_DOCS/.test(src);
  if (garde) ok('/api-docs désactivé par défaut en production');
  else ko('/api-docs est monté sans condition',
          'La documentation doit exiger ENABLE_API_DOCS=true en production.');
}

const composeTest = existsSync('docker-compose.test.yml') ? readFileSync('docker-compose.test.yml', 'utf8') : '';
if (/ENABLE_API_DOCS=\$\{ENABLE_API_DOCS:-false\}/.test(composeTest)) {
  ok('l\'interrupteur ENABLE_API_DOCS traverse compose (défaut false)');
} else {
  ko('ENABLE_API_DOCS n\'est pas transmis au conteneur',
     'Sans cela, l\'interrupteur est inutilisable : la variable n\'atteint jamais l\'application.');
}

// ── Outillage de construction absent de l'image ───────────────────
// `electron-builder` et `html-pdf-node` étaient déclarés en `dependencies` :
// `npm ci --only=production` les installait donc dans l'image du serveur, avec
// ~1,9 Go de binaires de construction et 25 paquets vulnérables — dont aucun
// n'est importé par le serveur.
{
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const deps = pkg.dependencies || {};
  // Chacun de ces paquets a été retiré après vérification qu'il n'était importé
  // NULLE PART. Ensemble ils pesaient ~1,9 Go d'image et 25 paquets vulnérables,
  // dont les deux seules failles critiques.
  const VESTIGIAUX = {
    'electron-builder': 'construction desktop — desktop/ et electron/ déclarent la leur',
    'electron': 'construction desktop',
    '@electron/rebuild': 'construction desktop',
    'html-pdf-node': 'aucune référence dans le dépôt (409 Mo)',
    'nexe': 'empaqueteur de binaires — aucun import, aucun script',
    'pkg': 'empaqueteur de binaires — aucun import',
    'jspdf': 'chargé par CDN dans le HTML généré, jamais importé depuis npm',
    '@google-cloud/storage': 'aucune référence dans le dépôt',
    '@tailwindcss/vite': 'absent de vite.config.ts — Tailwind v3 passe par PostCSS',
  };
  const tous = { ...deps, ...(pkg.devDependencies || {}) };
  const revenus = Object.keys(VESTIGIAUX).filter(n => n in tous);

  if (revenus.length === 0) {
    ok(`aucun des ${Object.keys(VESTIGIAUX).length} paquets vestigiaux retirés n'est revenu`);
  } else {
    ko(`paquet(s) vestigial(aux) réintroduit(s) : ${revenus.join(', ')}`,
       revenus.map(n => `  ${n} — ${VESTIGIAUX[n]}`).join('\n') +
       "\n\nSi l'un d'eux devient réellement nécessaire, retirez-le de cette liste " +
       'en justifiant son usage.');
  }
}

// ── xlsx : la version corrigée ne vient pas du registre npm ────────
// npm ne publie plus au-delà de 0.18.5, qui reste vulnérable (pollution de
// prototype + ReDoS) — or `XLSX.read()` est appelé sur des fichiers téléversés
// par les utilisateurs. La version corrigée provient de la distribution
// officielle SheetJS. Un `npm install xlsx` ferait silencieusement redescendre
// en 0.18.5.
{
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const decl = pkg.dependencies?.xlsx ?? '';
  if (/cdn\.sheetjs\.com/.test(decl)) ok('xlsx pointe sur la distribution officielle SheetJS');
  else if (decl) ko(`xlsx est revenu au registre npm (${decl})`,
                    'Le registre plafonne à 0.18.5, vulnérable. Réinstallez depuis ' +
                    'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz');
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(45));
console.log(`  RÉUSSIS : ${pass}    ÉCHOUÉS : ${fail}`);
console.log('═'.repeat(45));
process.exit(fail === 0 ? 0 : 1);

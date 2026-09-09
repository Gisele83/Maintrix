#!/usr/bin/env node
/**
 * Orchestrateur de la suite de tests Maintrix — F05.
 *
 *   npm test                → tout : unitaires + intégration
 *   npm run test:fast       → unitaires seuls (aucun Docker, aucune base)
 *   npm run test:integration→ intégration seule
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE FAIT CE SCRIPT
 * ═══════════════════════════════════════════════════════════════════
 * Une seule commande couvre toute la chaîne :
 *
 *   1. construction de l'application si le bundle est périmé
 *   2. démarrage d'un PostgreSQL JETABLE dans Docker, sur un port libre
 *   3. création du schéma (`drizzle-kit push`, depuis shared/schema.ts)
 *   4. seed déterministe (tests/seed.ts)
 *   5. démarrage du serveur applicatif sur un port libre
 *   6. exécution de Jest
 *   7. destruction complète de l'environnement, même en cas d'échec
 *   8. résumé exploitable : PASS/FAIL, compteurs, durée, suites
 *
 * ═══════════════════════════════════════════════════════════════════
 * DÉCISIONS ET LEUR RAISON
 * ═══════════════════════════════════════════════════════════════════
 *
 * • BASE JETABLE, JAMAIS CELLE DE DÉVELOPPEMENT. Le conteneur est créé puis
 *   détruit à chaque exécution, sur un port choisi à l'exécution. Aucune
 *   variable d'environnement locale ne peut le détourner : DATABASE_URL est
 *   imposée aux processus enfants. tests/seed.ts refuse en plus toute base dont
 *   le nom ne contient pas « test ».
 *
 * • NODE_ENV=test, PAS production. Le limiteur de débit du login est désactivé
 *   dans ce mode (server/enterprise-auth-middleware.ts) ; sans cela, la 6ᵉ
 *   authentification d'une suite serait bloquée 30 minutes.
 *
 * • ON LANCE LE BUNDLE `dist/index.js`, PAS LES SOURCES. `serveStatic()` résout
 *   ses assets relativement au dossier du module : depuis les sources il
 *   chercherait `server/public`, qui n'existe pas, et mourrait avant d'écouter.
 *
 * • SERVEUR RÉEL PLUTÔT QU'APP EXPRESS EN MÉMOIRE. `supertest(app)` serait plus
 *   rapide, mais server/index.ts est une IIFE qui s'auto-démarre et n'exporte
 *   pas `app`. L'en extraire imposerait de restructurer le bootstrap — hors de
 *   proportion avec F05, et risqué juste après F01/F02 qui viennent d'y toucher.
 *   Le serveur est donc démarré automatiquement : la dépendance conceptuelle à
 *   « un serveur déjà lancé sur 127.0.0.1:5000 » disparaît quand même, puisque
 *   plus rien n'est manuel ni codé en dur.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const args = process.argv.slice(2);
const lane = args.includes('--unit') ? 'unit'
  : args.includes('--integration') ? 'integration'
  : 'all';
const jestPassthrough = args.filter(a => !['--unit', '--integration'].includes(a));

// ⚠️ NOM DISTINCT DE L'ENVIRONNEMENT TESTEUR.
// Ce conteneur est ÉPHÉMÈRE : il est détruit (`docker rm -f`) au début et à la
// fin de chaque exécution. Il s'appelait `maintrix-test-db` — exactement le nom
// de la base de l'environnement de test cloud (docker-compose.test.yml) :
// lancer `npm test` sur l'hôte du pilote DÉTRUISAIT la base des testeurs.
const PG_CONTAINER = 'maintrix-jest-db';
const PG_USER = 'maintrix_test';
const PG_PASSWORD = 'maintrix_test_ephemeral';
const PG_DB = 'maintrix_test';

const TMP = mkdtempSync(join(tmpdir(), 'maintrix-tests-'));
// Rapport écrit à la racine du projet (ignoré par git) : une CI ou un
// développeur doit pouvoir relire le détail des échecs après coup, sans
// dépendre d'un dossier temporaire déjà supprimé par le nettoyage.
const REPORT = join(ROOT, 'test-report.json');

let serverProc = null;
let torndown = false;

const log = (m) => console.log(m);
const step = (m) => console.log(`\n▶ ${m}`);

function sh(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8', ...opts });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function freePort() {
  const r = spawnSync(process.execPath, ['-e',
    `const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})`],
    { encoding: 'utf8' });
  const p = parseInt((r.stdout || '').trim(), 10);
  if (!p) throw new Error("impossible d'obtenir un port libre");
  return p;
}

/** Le bundle est-il plus ancien que les sources ? */
function buildIsStale() {
  if (!existsSync('dist/index.js') || !existsSync('dist/public/index.html')) return true;
  const builtAt = statSync('dist/index.js').mtimeMs;
  let newest = 0;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p); else newest = Math.max(newest, statSync(p).mtimeMs);
    }
  };
  for (const d of ['server', 'shared', 'client']) { try { walk(d); } catch { /* absent */ } }
  return newest > builtAt;
}

function teardown() {
  if (torndown) return;
  torndown = true;
  step('Nettoyage de l\'environnement de test');
  if (serverProc && serverProc.exitCode === null) {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(serverProc.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try { serverProc.kill('SIGTERM'); } catch { /* déjà mort */ }
    }
    log('   ✓ serveur applicatif arrêté');
  }
  const rm = sh('docker', ['rm', '-f', PG_CONTAINER]);
  if (rm.code === 0) log('   ✓ base de test détruite');
  try { rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }
}
process.on('exit', teardown);
process.on('SIGINT', () => { teardown(); process.exit(130); });

/** Résumé final, format stable et exploitable par une CI. */
function summarise(startedAt, jestExitCode, laneLabel) {
  const durationMs = Date.now() - startedAt;
  let r = null;
  try { r = JSON.parse(readFileSync(REPORT, 'utf8')); } catch { /* rapport absent */ }

  console.log('\n' + '═'.repeat(62));
  if (!r) {
    console.log(`  RÉSULTAT : FAIL — aucun rapport Jest produit (${laneLabel})`);
    console.log(`  Durée    : ${(durationMs / 1000).toFixed(1)} s`);
    console.log('═'.repeat(62));
    return 1;
  }

  const verdict = r.success && r.numFailedTests === 0 ? 'PASS' : 'FAIL';
  console.log(`  RÉSULTAT      : ${verdict}   (${laneLabel})`);
  console.log(`  Tests         : ${r.numTotalTests} au total`);
  console.log(`     réussis    : ${r.numPassedTests}`);
  console.log(`     échoués    : ${r.numFailedTests}`);
  console.log(`     ignorés    : ${r.numPendingTests + r.numTodoTests}`);
  console.log(`  Suites        : ${r.numTotalTestSuites} au total, ${r.numPassedTestSuites} réussie(s), ${r.numFailedTestSuites} échouée(s)`);
  console.log(`  Durée         : ${(durationMs / 1000).toFixed(1)} s`);
  console.log('  ' + '─'.repeat(58));
  for (const suite of r.testResults ?? []) {
    const rel = suite.name.replace(ROOT, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
    const failed = suite.assertionResults.filter(a => a.status === 'failed').length;
    const passed = suite.assertionResults.filter(a => a.status === 'passed').length;
    // Une suite qui échoue au CHARGEMENT (import cassé, module absent) ne
    // produit aucune assertion : sans ce test elle passerait pour réussie.
    const didNotLoad = suite.status === 'failed' && suite.assertionResults.length === 0;
    const mark = didNotLoad || failed > 0 ? '✗' : '✓';
    const detail = didNotLoad ? 'SUITE NON CHARGÉE' : `${passed} ok, ${failed} ko`;
    console.log(`  ${mark} ${rel.padEnd(46)} ${detail}`);
    if (didNotLoad && suite.message) {
      const firstLine = suite.message.split(/\r?\n/).find(l => l.trim()) ?? '';
      console.log(`      ↳ ${firstLine}`.slice(0, 200));
    }
    for (const a of suite.assertionResults.filter(x => x.status === 'failed')) {
      console.log(`      ↳ ${a.fullName}`);
    }
  }
  console.log('═'.repeat(62));
  return verdict === 'PASS' ? 0 : (jestExitCode || 1);
}

function runJest(extraEnv, projects) {
  const jestBin = join('node_modules', '.bin', process.platform === 'win32' ? 'jest.cmd' : 'jest');
  const jestArgs = ['--json', `--outputFile=${REPORT}`, '--runInBand', ...projects, ...jestPassthrough];
  const r = spawnSync(jestBin, jestArgs, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, NODE_ENV: 'test', ...extraEnv },
  });
  return r.status ?? 1;
}

// ═══════════════════════════════════════════════════════════════════
const startedAt = Date.now();

// ── Voie rapide : unitaires seuls, aucune infrastructure ──────────
if (lane === 'unit') {
  step('Tests unitaires (aucune base, aucun serveur)');
  const code = runJest({}, ['--selectProjects', 'unit']);
  process.exit(summarise(startedAt, code, 'unitaires'));
}

// ── Voie complète : infrastructure requise ───────────────────────
step('Vérification des prérequis');
if (sh('docker', ['info', '--format', '{{.ServerVersion}}']).code !== 0) {
  console.error('\n⛔ Le démon Docker n\'est pas joignable.');
  console.error('   Les tests d\'intégration créent une base PostgreSQL jetable.');
  console.error('   Démarrez Docker, ou lancez uniquement : npm run test:fast');
  process.exit(2);
}
log('   ✓ Docker joignable');

if (buildIsStale()) {
  step('Construction de l\'application (bundle absent ou périmé)');
  const b = sh('npm', ['run', 'build'], { shell: true });
  if (b.code !== 0) { console.error(b.out.slice(-1500)); teardown(); process.exit(1); }
  log('   ✓ application construite');
} else {
  log('   ✓ bundle à jour');
}

const pgPort = freePort();
const appPort = freePort();
const DATABASE_URL = `postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${pgPort}/${PG_DB}`;
const API_URL = `http://127.0.0.1:${appPort}`;

step(`Démarrage de la base de test (PostgreSQL jetable, port ${pgPort})`);

// Garde-fou : ce script SUPPRIME de force le conteneur nommé ci-dessus. Il ne
// doit jamais porter le nom d'un environnement durable. Si un environnement
// testeur tourne sur cette machine, on refuse plutôt que de risquer de
// détruire sa base.
{
  const durable = sh('docker', ['ps', '-a', '--filter', 'name=maintrix-test-db', '--format', '{{.Names}}']).out;
  if (durable.split('\n').includes(PG_CONTAINER)) {
    console.error(`\n⛔ Le conteneur « ${PG_CONTAINER} » appartient à un environnement durable.`);
    console.error('   Renommez le conteneur éphémère de ce script avant de continuer.');
    teardown();
    process.exit(2);
  }
}

sh('docker', ['rm', '-f', PG_CONTAINER]);
const up = sh('docker', ['run', '-d', '--name', PG_CONTAINER,
  '-e', `POSTGRES_USER=${PG_USER}`,
  '-e', `POSTGRES_PASSWORD=${PG_PASSWORD}`,
  '-e', `POSTGRES_DB=${PG_DB}`,
  '-p', `${pgPort}:5432`,
  'postgres:15-alpine']);
if (up.code !== 0) { console.error(up.out); teardown(); process.exit(1); }

let ready = false;
for (let i = 0; i < 90; i++) {
  if (sh('docker', ['exec', PG_CONTAINER, 'pg_isready', '-U', PG_USER, '-d', PG_DB]).code === 0) { ready = true; break; }
  await sleep(1000);
}
if (!ready) { console.error('   ✗ PostgreSQL n\'a jamais été prêt'); teardown(); process.exit(1); }
log('   ✓ base de test prête');

step('Création du schéma (drizzle-kit push depuis shared/schema.ts)');
{
  const drizzle = join('node_modules', '.bin', process.platform === 'win32' ? 'drizzle-kit.cmd' : 'drizzle-kit');
  const r = spawnSync(drizzle, ['push', '--force'], {
    encoding: 'utf8', shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL, NODE_ENV: 'test' },
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if ((r.status ?? 1) !== 0) { console.error(out.slice(-2000)); teardown(); process.exit(1); }
  const tables = sh('docker', ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', PG_DB, '-tAc',
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'"]).out;
  log(`   ✓ schéma appliqué — ${tables} table(s)`);
}

step('Seed déterministe');
{
  const tsx = join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
  const r = spawnSync(tsx, ['tests/seed.ts'], {
    encoding: 'utf8', shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL, NODE_ENV: 'test', DOTENV_CONFIG_PATH: join(TMP, 'none.env') },
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  if ((r.status ?? 1) !== 0) { console.error(out.slice(-2000)); teardown(); process.exit(1); }
  out.split('\n').filter(Boolean).forEach(l => log(`   ${l}`));
}

let superAdminEnv = {};

step(`Démarrage du serveur applicatif (port ${appPort})`);
{
  // Identifiants super-admin de TEST, générés à l'exécution. Sans eux,
  // /api/super-admin/* renvoie 503 « non configuré » et le parcours de création
  // de tenant est intestable. Le hash est calculé ici, jamais écrit au dépôt.
  const { createRequire } = await import('node:module');
  const bcrypt = createRequire(import.meta.url)('bcrypt');
  const SUPER_ADMIN_EMAIL = 'superadmin@maintrix.test';
  const SUPER_ADMIN_PASSWORD = 'SuperAdminTest2026!';
  const SUPER_ADMIN_SECRET = 'test-platform-secret-not-a-real-secret';
  const SUPER_ADMIN_PASSWORD_HASH = bcrypt.hashSync(SUPER_ADMIN_PASSWORD, 10);
  superAdminEnv = { SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_SECRET };

  serverProc = spawn(process.execPath, ['dist/index.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(appPort),
      DATABASE_URL,
      SUPER_ADMIN_EMAIL,
      SUPER_ADMIN_SECRET,
      SUPER_ADMIN_PASSWORD_HASH,
      SESSION_SECRET: 'test-session-secret-not-a-real-secret',
      JWT_SECRET: 'test-jwt-secret-not-a-real-secret',
      KMS_MASTER_KEY: 'test-kms-master-key-at-least-32-characters',
      MFA_ENCRYPTION_KEY: 'test-mfa-encryption-key-at-least-32-chars',
      // Neutralise le .env local : la base de test ne doit jamais être détournée.
      DOTENV_CONFIG_PATH: join(TMP, 'none.env'),
    },
  });
  const serverLog = [];
  serverProc.stdout?.on('data', d => serverLog.push(d.toString()));
  serverProc.stderr?.on('data', d => serverLog.push(d.toString()));
  writeFileSync(join(TMP, 'server.log'), '');

  let up2 = false;
  const deadline = Date.now() + 180000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (res.status === 200) { up2 = true; break; }
    } catch { /* pas encore prêt */ }
    if (serverProc.exitCode !== null) break;
    await sleep(1000);
  }
  if (!up2) {
    console.error('   ✗ le serveur n\'a jamais répondu 200 sur /api/health');
    console.error(serverLog.join('').slice(-2500));
    teardown();
    process.exit(1);
  }
  log(`   ✓ serveur sain sur ${API_URL}`);
}

step('Exécution de Jest');
const projects = lane === 'integration' ? ['--selectProjects', 'integration'] : [];
const jestCode = runJest({ API_URL, DATABASE_URL, ...superAdminEnv }, projects);

const exitCode = summarise(startedAt, jestCode, lane === 'integration' ? 'intégration' : 'unitaires + intégration');
teardown();
process.exit(exitCode);

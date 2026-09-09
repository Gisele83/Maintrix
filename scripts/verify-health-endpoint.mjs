#!/usr/bin/env node
/**
 * F01 — Vérification de la sonde de santé GET /api/health.
 *
 *   node scripts/verify-health-endpoint.mjs
 *
 * Preuve du COMPORTEMENT RÉEL, pas seulement de la configuration :
 * un vrai PostgreSQL est démarré dans un conteneur jetable, le vrai serveur
 * Maintrix est lancé contre lui, puis la base est arrêtée et redémarrée pour
 * observer la dégradation et la reprise.
 *
 * Prérequis : démon Docker démarré. Sans lui, le script s'arrête en BLOCKED
 * plutôt que de prétendre avoir vérifié quoi que ce soit.
 *
 * Le conteneur PostgreSQL et le serveur sont détruits en sortie, y compris
 * en cas d'échec ou d'interruption.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import * as fsSync from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const PG_CONTAINER = 'maintrix-health-probe-db';
const PG_USER = 'maintrix_probe';
const PG_DB = 'maintrix_probe';
const PG_PASSWORD = 'probe_only_ephemeral_not_a_real_secret';

/**
 * Ports choisis à l'exécution : la machine de développement héberge déjà
 * plusieurs PostgreSQL (5432, 5433, 5435) et des ports arbitraires peuvent être
 * pris. Un port figé rendrait ce script non reproductible.
 */
function freePort() {
  // On demande au système un port libre, on le note, on le relâche aussitôt.
  const r = spawnSync(process.execPath, ['-e', `
    const net = require('net');
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { console.log(s.address().port); s.close(); });
  `], { encoding: 'utf8' });
  const p = parseInt((r.stdout || '').trim(), 10);
  if (!p) throw new Error("impossible d'obtenir un port libre");
  return p;
}

const PG_PORT = freePort();
const APP_PORT = freePort();
const BASE = `http://127.0.0.1:${APP_PORT}`;

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };
const ko = (m, d) => { console.log(`  ✗ ${m}`); if (d) console.log(String(d).split('\n').slice(0, 6).map(l => '      ' + l).join('\n')); fail++; };
const info = (m) => console.log(`      ${m}`);
const section = (t) => console.log(`\n── ${t}`);

const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let server = null;
const TMP = mkdtempSync(join(tmpdir(), 'f01-'));

function cleanup() {
  try { if (server && !server.killed) spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  sh('docker', ['rm', '-f', PG_CONTAINER]);
  try { rmSync(TMP, { recursive: true, force: true }); } catch {}
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

/**
 * Le bundle est-il plus ancien que les sources qu'il embarque ?
 * Évite de tester une version périmée de l'endpoint — le piège exact qui a
 * fait échouer la première exécution de ce script.
 */
function isBuildStale() {
  const { statSync, existsSync, readdirSync } = fsSync;
  if (!existsSync('dist/index.js') || !existsSync('dist/public/index.html')) return true;
  const builtAt = statSync('dist/index.js').mtimeMs;
  let newest = 0;
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else newest = Math.max(newest, statSync(p).mtimeMs);
    }
  };
  for (const d of ['server', 'shared', 'client']) { try { walk(d); } catch {} }
  return newest > builtAt;
}

/** Interroge /api/health ; ne lève jamais — renvoie {status, body, headers, error}. */
async function probe(path = '/api/health', init = {}) {
  try {
    const res = await fetch(BASE + path, { ...init, signal: AbortSignal.timeout(15000) });
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body, headers: Object.fromEntries(res.headers) };
  } catch (e) {
    return { status: 0, body: null, headers: {}, error: String(e.message || e) };
    }
}

/** Attend qu'une condition sur la sonde soit vraie, ou expire. */
async function waitFor(predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await probe();
    if (predicate(last)) return last;
    await sleep(500);
  }
  info(`délai dépassé en attendant : ${label} (dernier état : ${last?.status} ${JSON.stringify(last?.body)?.slice(0, 120)})`);
  return last;
}

// ═══════════════════════════════════════════════════════════════════
section('T0 — Prérequis');

if (sh('docker', ['info', '--format', '{{.ServerVersion}}']).code !== 0) {
  console.log('\n⛔ BLOCKED — le démon Docker n\'est pas joignable.');
  console.log('   Démarrez Docker Desktop puis relancez ce script.');
  process.exit(2);
}
ok('démon Docker joignable');

// ═══════════════════════════════════════════════════════════════════
section('T1 — Démarrage de PostgreSQL et du serveur');

sh('docker', ['rm', '-f', PG_CONTAINER]);
const up = sh('docker', ['run', '-d', '--name', PG_CONTAINER,
  '-e', `POSTGRES_USER=${PG_USER}`,
  '-e', `POSTGRES_PASSWORD=${PG_PASSWORD}`,
  '-e', `POSTGRES_DB=${PG_DB}`,
  '-p', `${PG_PORT}:5432`,
  'postgres:15-alpine']);
if (up.code !== 0) { ko('démarrage du conteneur PostgreSQL', up.out); process.exit(1); }
ok(`conteneur PostgreSQL démarré (port ${PG_PORT})`);

// Attendre que PostgreSQL accepte les connexions.
let pgReady = false;
for (let i = 0; i < 60; i++) {
  if (sh('docker', ['exec', PG_CONTAINER, 'pg_isready', '-U', PG_USER, '-d', PG_DB]).code === 0) { pgReady = true; break; }
  await sleep(1000);
}
if (!pgReady) { ko('PostgreSQL n\'a jamais été prêt'); process.exit(1); }
ok('PostgreSQL accepte les connexions');

// Lancer le vrai serveur Maintrix contre cette base.
const serverEnv = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: String(APP_PORT),
  DATABASE_URL: `postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${PG_DB}`,
  SESSION_SECRET: 'probe_session_secret_ephemeral',
  JWT_SECRET: 'probe_jwt_secret_ephemeral',
  KMS_MASTER_KEY: 'probe_kms_master_key_at_least_32_characters',
  MFA_ENCRYPTION_KEY: 'probe_mfa_encryption_key_at_least_32_chars',
  DOTENV_CONFIG_PATH: join(TMP, 'none.env'),
};
// On lance le bundle `dist/index.js` — exactement ce que fait le conteneur
// (`npm start` → `node dist/index.js`), et non les sources via tsx. La
// différence n'est pas cosmétique : `serveStatic()` résout ses assets
// relativement au dossier du module, donc `dist/public` depuis le bundle et
// `server/public` (inexistant) depuis les sources. Lancer les sources en
// NODE_ENV=production ferait échouer le serveur avant qu'il n'écoute.
if (isBuildStale()) {
  info('build absent ou périmé — reconstruction (npm run build)…');
  const b = sh('npm', ['run', 'build'], { shell: true });
  if (b.code !== 0) { ko('échec de npm run build', b.out.slice(-1200)); process.exit(1); }
  ok('application reconstruite');
} else {
  ok('build à jour');
}

const serverLog = [];
server = spawn(process.execPath, ['dist/index.js'], { env: serverEnv });
server.stdout.on('data', d => serverLog.push(d.toString()));
server.stderr.on('data', d => serverLog.push(d.toString()));

const booted = await waitFor(r => r.status !== 0, 180000, 'réponse du serveur');
if (booted.status === 0) {
  ko('le serveur n\'a jamais répondu', serverLog.join('').slice(-1500));
  process.exit(1);
}
ok(`serveur Maintrix démarré sur le port ${APP_PORT}`);

// ═══════════════════════════════════════════════════════════════════
section('T2 — Application + base disponibles → 200');

{
  const r = await waitFor(x => x.status === 200, 60000, 'HTTP 200');
  info(`HTTP ${r.status} — ${JSON.stringify(r.body)}`);
  if (r.status === 200) ok('GET /api/health renvoie 200 quand tout est sain');
  else ko(`attendu 200, obtenu ${r.status}`, JSON.stringify(r.body));

  if (r.body?.status === 'ok') ok('le corps indique status="ok"');
  else ko('le corps n\'indique pas status="ok"', JSON.stringify(r.body));

  if (r.body?.checks?.database === 'ok') ok('la vérification PostgreSQL est explicite et positive');
  else ko('la vérification PostgreSQL est absente ou négative', JSON.stringify(r.body));
}

// ═══════════════════════════════════════════════════════════════════
section('T3 — Endpoint accessible SANS authentification');

{
  // Aucun cookie, aucun en-tête d'autorisation, aucun jeton CSRF.
  const r = await probe('/api/health', { headers: { 'Accept': 'application/json' } });
  if (r.status === 200) ok('accessible sans cookie, sans jeton, sans en-tête Authorization');
  else ko(`refusé sans authentification (HTTP ${r.status})`, JSON.stringify(r.body));

  // Contre-épreuve : l'endpoint admin doit, lui, rester protégé.
  const admin = await probe('/api/system/health');
  if ([401, 403].includes(admin.status)) ok(`/api/system/health reste protégé (HTTP ${admin.status})`);
  else ko(`/api/system/health n'est plus protégé (HTTP ${admin.status})`, JSON.stringify(admin.body).slice(0, 300));

  // Non-régression : trois helpers de tests (tests/setup.ts,
  // tests/multi-tenant.test.ts) tirent le cookie csrfToken de /api/health.
  // Ils fonctionnaient sur le 404 de la route absente ; ils doivent continuer
  // de fonctionner maintenant qu'elle répond 200.
  const setCookie = r.headers['set-cookie'] ?? '';
  if (/csrfToken=/.test(String(setCookie))) ok('la sonde pose toujours le cookie csrfToken attendu par les tests');
  else ko('la sonde ne pose plus le cookie csrfToken — tests/setup.ts serait cassé', String(setCookie).slice(0, 200));
}

// ═══════════════════════════════════════════════════════════════════
section('T4 — Aucune information sensible dans la réponse');

{
  const r = await probe();
  const raw = JSON.stringify(r.body ?? '');

  // Motifs qui ne doivent jamais apparaître dans une réponse non authentifiée.
  const FORBIDDEN = [
    { label: 'chaîne de connexion PostgreSQL', re: /postgres(ql)?:\/\//i },
    { label: 'mot de passe de la base',        re: new RegExp(PG_PASSWORD, 'i') },
    { label: 'utilisateur de la base',         re: new RegExp(PG_USER, 'i') },
    { label: 'hôte / port de la base',         re: new RegExp(`\\b${PG_PORT}\\b`) },
    { label: 'secret applicatif',              re: /probe_(jwt|kms|mfa|session)/i },
    { label: 'NODE_ENV',                       re: /"(environment|env|nodeEnv)"\s*:/i },
    { label: 'version applicative',            re: /"version"\s*:/i },
    { label: 'trace de pile',                  re: /at\s+\w+\s+\(|\.ts:\d+|\.js:\d+/ },
    { label: 'chemin système',                 re: /[A-Za-z]:\\|\/app\/|\/home\/|\/usr\// },
    { label: 'nom d\'hôte',                    re: /"(hostname|host)"\s*:/i },
    { label: 'message d\'erreur brut',         re: /ECONNREFUSED|ETIMEDOUT|getaddrinfo|password authentication/i },
  ];
  const leaks = FORBIDDEN.filter(f => f.re.test(raw));
  info(`corps inspecté : ${raw}`);
  if (leaks.length === 0) ok('aucun motif sensible dans la réponse saine');
  else ko('motif(s) sensible(s) exposé(s)', leaks.map(l => l.label).join(', '));

  // Le champ `checks` ne doit rester qu'un verdict, pas un diagnostic.
  const dbVal = r.body?.checks?.database;
  if (typeof dbVal === 'string' && ['ok', 'unavailable'].includes(dbVal)) ok('checks.database est un verdict fermé (ok|unavailable)');
  else ko('checks.database expose autre chose qu\'un verdict fermé', JSON.stringify(dbVal));
}

// ═══════════════════════════════════════════════════════════════════
section('T5 — PostgreSQL indisponible → 503 et dégradation saine');

{
  const stopped = sh('docker', ['stop', PG_CONTAINER]);
  if (stopped.code !== 0) { ko('impossible d\'arrêter PostgreSQL', stopped.out); }

  // Preuve indépendante que la base est bien tombée : sans elle, un 503 pourrait
  // venir de tout autre chose et le test se mentirait à lui-même.
  const stateOff = sh('docker', ['inspect', '-f', '{{.State.Running}}', PG_CONTAINER]).out;
  const pgReadyOff = sh('docker', ['exec', PG_CONTAINER, 'pg_isready', '-U', PG_USER, '-d', PG_DB]).code;
  info(`docker State.Running = ${stateOff} · pg_isready code = ${pgReadyOff}`);
  if (stateOff === 'false') ok('PostgreSQL est réellement arrêté (State.Running=false)');
  else ko(`PostgreSQL tourne encore (State.Running=${stateOff}) — le 503 ne prouverait rien`);

  const t0 = Date.now();
  const r = await waitFor(x => x.status === 503, 60000, 'HTTP 503');
  const elapsed = Date.now() - t0;
  info(`HTTP ${r.status} — ${JSON.stringify(r.body)}`);

  if (r.status === 503) ok('GET /api/health renvoie 503 quand PostgreSQL est indisponible');
  else ko(`attendu 503, obtenu ${r.status}`, JSON.stringify(r.body));

  if (r.body?.status === 'unavailable' && r.body?.checks?.database === 'unavailable')
    ok('le corps désigne explicitement la base comme cause');
  else ko('le corps ne désigne pas la base comme cause', JSON.stringify(r.body));

  // Dégradation SAINE : le serveur répond toujours, il ne s'est pas effondré.
  if (r.status === 503) ok('le processus serveur est resté vivant (dégradation, pas plantage)');

  // Le délai borné est ce qui empêche le HEALTHCHECK Docker de conclure
  // « timeout » au lieu de lire un 503 explicite.
  const timed = await (async () => { const s = Date.now(); const x = await probe(); return { ms: Date.now() - s, x }; })();
  info(`temps de réponse en panne de base : ${timed.ms} ms`);
  if (timed.ms < 10000) ok(`réponse en ${timed.ms} ms, sous le timeout 10s du HEALTHCHECK Docker`);
  else ko(`réponse en ${timed.ms} ms : dépasse le timeout 10s du HEALTHCHECK`);

  // Aucune fuite non plus dans le chemin d'erreur — c'est là qu'on fuit d'habitude.
  const rawErr = JSON.stringify(r.body ?? '');
  if (/ECONNREFUSED|ETIMEDOUT|getaddrinfo|postgres(ql)?:\/\/|password/i.test(rawErr))
    ko('la réponse 503 fuit le détail de l\'erreur', rawErr);
  else ok('la réponse 503 ne fuit aucun détail d\'erreur');
}

// ═══════════════════════════════════════════════════════════════════
section('T6 — Après restauration de PostgreSQL → retour à 200');

{
  const pidBefore = server.pid;
  const started = sh('docker', ['start', PG_CONTAINER]);
  if (started.code !== 0) ko('impossible de redémarrer PostgreSQL', started.out);

  const stateOn = sh('docker', ['inspect', '-f', '{{.State.Running}}', PG_CONTAINER]).out;
  info(`docker State.Running = ${stateOn}`);

  const t0 = Date.now();
  const r = await waitFor(x => x.status === 200, 120000, 'retour à HTTP 200');
  info(`HTTP ${r.status} après ${Date.now() - t0} ms — ${JSON.stringify(r.body)}`);
  if (r.status === 200) ok('la sonde repasse à 200 après restauration de PostgreSQL');
  else ko(`la sonde ne s'est pas rétablie (HTTP ${r.status})`, JSON.stringify(r.body));

  // La reprise doit être celle de l'application, pas celle d'un redémarrage.
  if (server.pid === pidBefore && server.exitCode === null)
    ok('reprise sans redémarrage du serveur (même PID, processus vivant)');
  else ko('le serveur a redémarré ou s\'est arrêté pendant la panne');
}

// ═══════════════════════════════════════════════════════════════════
section('T7 — Les health-checks d\'infrastructure visent bien cet endpoint');

{
  const { readFileSync } = await import('node:fs');
  const TARGETS = [
    ['Dockerfile', /HEALTHCHECK[\s\S]{0,200}?\/api\/health/],
    ['docker-compose.yml', /healthcheck:[\s\S]{0,300}?\/api\/health/],
    ['docker-compose.simple.yml', /healthcheck:[\s\S]{0,300}?\/api\/health/],
    ['aws/ecs-task-definition.json', /\/api\/health/],
    ['aws/cloudformation-infra.yml', /HealthCheckPath:\s*\/api\/health/],
  ];
  for (const [file, re] of TARGETS) {
    try {
      if (re.test(readFileSync(file, 'utf8'))) ok(`${file} sonde /api/health`);
      else ko(`${file} ne sonde pas /api/health`);
    } catch { ko(`${file} illisible`); }
  }

  // Le HEALTHCHECK doit borner sa propre durée, sinon un endpoint lent
  // devient « unhealthy » par dépassement plutôt que par 503.
  const df = readFileSync('Dockerfile', 'utf8');
  if (/--max-time|--connect-timeout/.test(df)) ok('le HEALTHCHECK du Dockerfile borne la durée de curl');
  else ko('le HEALTHCHECK du Dockerfile ne borne pas curl (--max-time absent)');
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(45));
console.log(`  RÉUSSIS : ${pass}    ÉCHOUÉS : ${fail}`);
console.log('═'.repeat(45));
process.exit(fail === 0 ? 0 : 1);

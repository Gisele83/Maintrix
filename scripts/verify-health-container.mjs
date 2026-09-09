#!/usr/bin/env node
/**
 * F01 — Vérification du HEALTHCHECK Docker de bout en bout.
 *
 *   node scripts/verify-health-container.mjs
 *
 * Complète scripts/verify-health-endpoint.mjs, qui teste l'endpoint au niveau
 * applicatif. Ici on teste la boucle complète que verra un orchestrateur :
 * la stack est démarrée avec docker compose, on observe le passage du conteneur
 * `app` à `healthy`, on coupe PostgreSQL et on observe le passage à `unhealthy`,
 * puis la remontée après restauration.
 *
 * C'est le seul test qui prouve que le HEALTHCHECK lui-même fonctionne :
 * que curl est présent dans l'image, que le port sondé est le bon, et que le
 * 503 est bien interprété comme un échec par Docker.
 *
 * Prérequis : démon Docker démarré, image `app` construite
 * (`docker compose --env-file .env.docker -f docker-compose.simple.yml build app`)
 * et un fichier .env.docker (`bash scripts/generate-docker-env.sh`).
 *
 * La stack est détruite en sortie, y compris en cas d'échec.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const COMPOSE = ['compose', '--env-file', '.env.docker', '-f', 'docker-compose.simple.yml', '-p', 'maintrix-f01'];
const APP = 'maintrix-app';
const DB = 'maintrix-db';

/**
 * Port hôte choisi à l'exécution. La machine de développement fait tourner
 * d'autres projets (5000 est occupé par une autre stack) : un port figé ferait
 * échouer le test pour une raison sans rapport avec la santé de Maintrix.
 * docker-compose.simple.yml lit APP_HOST_PORT.
 */
function freePort() {
  const r = spawnSync(process.execPath, ['-e', `
    const net = require('net');
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { console.log(s.address().port); s.close(); });
  `], { encoding: 'utf8' });
  const p = parseInt((r.stdout || '').trim(), 10);
  if (!p) throw new Error("impossible d'obtenir un port libre");
  return p;
}

const APP_HOST_PORT = freePort();
const BASE = `http://127.0.0.1:${APP_HOST_PORT}`;
const ENV = { ...process.env, APP_HOST_PORT: String(APP_HOST_PORT) };

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };
const ko = (m, d) => { console.log(`  ✗ ${m}`); if (d) console.log(String(d).split('\n').slice(0, 8).map(l => '      ' + l).join('\n')); fail++; };
const info = (m) => console.log(`      ${m}`);
const section = (t) => console.log(`\n── ${t}`);

const sh = (args, opts = {}) => {
  const r = spawnSync('docker', args, { encoding: 'utf8', env: ENV, ...opts });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function cleanup() {
  console.log('\n… démontage de la stack de test');
  sh([...COMPOSE, 'down', '-v', '--remove-orphans']);
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

/** État de santé rapporté par Docker pour un conteneur : starting|healthy|unhealthy. */
function healthOf(container) {
  const r = sh(['inspect', '-f', '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}', container]);
  return r.code === 0 ? r.out : 'absent';
}

/** Attend un état de santé donné, en journalisant les transitions observées. */
async function waitHealth(container, target, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    const h = healthOf(container);
    if (h !== last) { info(`${container} : ${last ?? '—'} → ${h}`); last = h; }
    if (h === target) return { reached: true, elapsed: Date.now() - (deadline - timeoutMs) };
    await sleep(2000);
  }
  return { reached: false, last };
}

async function httpStatus() {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(10000) });
    return { status: res.status, body: await res.text() };
  } catch (e) { return { status: 0, body: String(e.message || e) }; }
}

// ═══════════════════════════════════════════════════════════════════
section('T0 — Prérequis');

if (sh(['info', '--format', '{{.ServerVersion}}']).code !== 0) {
  console.log('\n⛔ BLOCKED — démon Docker injoignable.'); process.exit(2);
}
ok('démon Docker joignable');

if (!existsSync('.env.docker')) {
  console.log('\n⛔ BLOCKED — .env.docker absent. Lancez : bash scripts/generate-docker-env.sh');
  process.exit(2);
}
ok('.env.docker présent');
info(`port hôte choisi pour ce test : ${APP_HOST_PORT}`);

// ═══════════════════════════════════════════════════════════════════
section('T1 — Démarrage de la stack');

sh([...COMPOSE, 'down', '-v', '--remove-orphans']);

// `--build` est indispensable : compose nomme l'image d'après le projet
// (`maintrix-f01-app`). Sans reconstruction, un `up` réutilise silencieusement
// l'image d'une exécution antérieure et le test valide alors du code périmé —
// exactement ce qui a masqué la correction du CMD lors de la mise au point.
info('construction de l\'image (peut prendre plusieurs minutes au premier lancement)…');
const up = sh([...COMPOSE, 'up', '-d', '--build']);
if (up.code !== 0) { ko('docker compose up --build a échoué', up.out); process.exit(1); }
ok('docker compose up --build : stack démarrée sur une image fraîche');

// La base doit devenir saine AVANT l'app : `depends_on: condition: service_healthy`.
// C'est aussi ce qui valide le healthcheck pg_isready corrigé en phase 1.
const dbHealth = await waitHealth(DB, 'healthy', 180000);
if (dbHealth.reached) ok('conteneur PostgreSQL : healthy');
else { ko(`PostgreSQL n'est jamais devenu healthy (dernier état : ${dbHealth.last})`, sh(['logs', '--tail', '20', DB]).out); }

// ═══════════════════════════════════════════════════════════════════
section('T2 — Le conteneur applicatif devient healthy via /api/health');

{
  // Détection immédiate d'un échec de DÉMARRAGE (commande absente, crash au
  // boot…). Sans ce contrôle, un conteneur qui boucle en redémarrage se
  // manifeste seulement au bout des 5 minutes d'attente de `healthy`, sans
  // jamais dire pourquoi. C'est exactement ainsi qu'a été trouvé le
  // « cross-env: not found » (exit 127) du CMD d'origine.
  await sleep(8000);
  const st = sh(['inspect', '-f', '{{.State.Status}} {{.State.ExitCode}} {{.RestartCount}}', APP]).out;
  info(`état initial du conteneur app : ${st}`);
  if (/^restarting|^exited/.test(st)) {
    ko('le conteneur app ne démarre pas (boucle de redémarrage ou arrêt)', sh(['logs', '--tail', '20', APP]).out);
    info('→ échec de démarrage : les tests de santé qui suivent seraient sans objet');
  } else {
    ok('le conteneur app démarre sans boucle de redémarrage');
  }

  const appHealth = await waitHealth(APP, 'healthy', 300000);
  if (appHealth.reached) ok('conteneur app : healthy — le HEALTHCHECK Docker réussit');
  else {
    ko(`app n'est jamais devenu healthy (dernier état : ${appHealth.last})`);
    info('--- dernières sondes enregistrées par Docker ---');
    info(sh(['inspect', '-f', '{{range .State.Health.Log}}{{.ExitCode}} {{.Output}}{{end}}', APP]).out.slice(0, 600));
    info('--- logs applicatifs ---');
    info(sh(['logs', '--tail', '25', APP]).out.slice(0, 1200));
  }

  const h = await httpStatus();
  info(`GET ${BASE}/api/health → HTTP ${h.status} ${h.body.slice(0, 140)}`);
  if (h.status === 200) ok('la sonde répond 200 à travers le port publié');
  else ko(`attendu 200 via le port publié, obtenu ${h.status}`, h.body.slice(0, 300));

  // Preuve que le HEALTHCHECK interroge bien /api/health et non autre chose.
  const cfg = sh(['inspect', '-f', '{{json .Config.Healthcheck.Test}}', APP]).out;
  info(`HEALTHCHECK configuré : ${cfg}`);
  if (/\/api\/health/.test(cfg)) ok('le HEALTHCHECK du conteneur cible bien /api/health');
  else ko('le HEALTHCHECK ne cible pas /api/health', cfg);
}

// ═══════════════════════════════════════════════════════════════════
section('T3 — PostgreSQL coupé → le conteneur passe unhealthy');

{
  const stopped = sh([...COMPOSE, 'stop', 'db']);
  if (stopped.code !== 0) ko('impossible d\'arrêter le service db', stopped.out);
  else info('service db arrêté');

  const running = sh(['inspect', '-f', '{{.State.Running}}', DB]).out;
  if (running === 'false') ok('PostgreSQL est réellement arrêté (State.Running=false)');
  else ko(`PostgreSQL tourne encore (${running}) — la suite ne prouverait rien`);

  const h = await httpStatus();
  info(`GET /api/health → HTTP ${h.status} ${h.body.slice(0, 140)}`);
  if (h.status === 503) ok('la sonde répond 503 base coupée');
  else ko(`attendu 503, obtenu ${h.status}`, h.body.slice(0, 300));

  // interval=30s, retries=3 → jusqu'à ~2 min avant le basculement.
  const un = await waitHealth(APP, 'unhealthy', 240000);
  if (un.reached) ok('conteneur app : unhealthy — Docker interprète bien le 503 comme un échec');
  else ko(`app n'est jamais passé unhealthy (dernier état : ${un.last})`);

  // Dégradation, pas plantage : le conteneur doit rester en marche.
  const appRunning = sh(['inspect', '-f', '{{.State.Running}}', APP]).out;
  if (appRunning === 'true') ok('le conteneur app reste en marche (dégradation, pas plantage)');
  else ko(`le conteneur app s'est arrêté (Running=${appRunning})`, sh(['logs', '--tail', '25', APP]).out.slice(0, 1000));
}

// ═══════════════════════════════════════════════════════════════════
section('T4 — PostgreSQL restauré → le conteneur redevient healthy');

{
  const started = sh([...COMPOSE, 'start', 'db']);
  if (started.code !== 0) ko('impossible de redémarrer db', started.out);
  else info('service db redémarré');

  const back = await waitHealth(APP, 'healthy', 300000);
  if (back.reached) ok('conteneur app : healthy à nouveau, sans redémarrage manuel');
  else ko(`app n'est pas redevenu healthy (dernier état : ${back.last})`);

  const h = await httpStatus();
  info(`GET /api/health → HTTP ${h.status} ${h.body.slice(0, 140)}`);
  if (h.status === 200) ok('la sonde répond de nouveau 200');
  else ko(`attendu 200, obtenu ${h.status}`, h.body.slice(0, 300));

  // Le conteneur app ne doit pas avoir été recréé entre-temps.
  const restarts = sh(['inspect', '-f', '{{.RestartCount}}', APP]).out;
  info(`RestartCount du conteneur app : ${restarts}`);
  if (restarts === '0') ok('le conteneur app n\'a jamais redémarré pendant l\'incident');
  else ko(`le conteneur app a redémarré ${restarts} fois`);
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(45));
console.log(`  RÉUSSIS : ${pass}    ÉCHOUÉS : ${fail}`);
console.log('═'.repeat(45));
process.exit(fail === 0 ? 0 : 1);

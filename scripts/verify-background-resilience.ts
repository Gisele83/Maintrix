/**
 * F02 — Vérification de la résistance des tâches de fond.
 *
 *   node_modules/.bin/tsx scripts/verify-background-resilience.ts
 *
 * Deux parties.
 *
 *  PARTIE 1 — le superviseur lui-même (server/background-tasks.ts), piloté
 *  directement avec des intervalles de quelques dizaines de millisecondes.
 *  C'est là que sont injectées les pannes qu'on ne peut pas provoquer de
 *  l'extérieur : exception synchrone, rejet asynchrone, panne prolongée puis
 *  rétablissement. Les intervalles réels (5 s à 30 min) rendraient ces
 *  observations impraticables sur le serveur complet.
 *
 *  PARTIE 2 — le serveur RÉEL, avec de vraies dépendances en panne :
 *  PostgreSQL arrêté puis redémarré, courtier MQTT injoignable, endpoint
 *  Maximo mort, clé IA invalide. On vérifie que l'application reste servie.
 *
 * Prérequis : démon Docker (un PostgreSQL jetable est créé et détruit).
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  registerBackgroundTask,
  stopAllBackgroundTasks,
  getBackgroundTaskStatus,
} from '../server/background-tasks';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

let pass = 0, fail = 0;
const ok = (m: string) => { console.log(`  ✓ ${m}`); pass++; };
const ko = (m: string, d?: unknown) => {
  console.log(`  ✗ ${m}`);
  if (d) console.log(String(d).split('\n').slice(0, 6).map(l => '      ' + l).join('\n'));
  fail++;
};
const info = (m: string) => console.log(`      ${m}`);
const section = (t: string) => console.log(`\n── ${t}`);
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const sh = (cmd: string, args: string[]) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
};

/** Capture les écritures console pendant l'exécution de `fn`. */
async function captureLogs(fn: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const origErr = console.error, origLog = console.log, origWarn = console.warn;
  const grab = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  console.error = grab; console.log = grab; console.warn = grab;
  try { await fn(); } finally {
    console.error = origErr; console.log = origLog; console.warn = origWarn;
  }
  return lines;
}

// ═══════════════════════════════════════════════════════════════════
async function part1(): Promise<void> {
  console.log('\n════════ PARTIE 1 — superviseur de tâches ════════');

  // ── T1 ───────────────────────────────────────────────────────────
  section('T1 — Une exception SYNCHRONE dans une tâche n\'atteint pas le processus');
  {
    let ticks = 0;
    const logs = await captureLogs(async () => {
      registerBackgroundTask({
        name: 't1-sync-throw',
        intervalMs: 30,
        criticality: 'C',
        runImmediately: true,
        run: () => { ticks++; throw new Error('PANNE SYNCHRONE INJECTÉE'); },
      });
      await sleep(400);
      await stopAllBackgroundTasks();
    });

    // Le seul fait d'arriver ici prouve que le processus a survécu : avant F02
    // ce throw devenait une uncaughtException et tuait Node.
    ok(`le processus a survécu à ${ticks} exception(s) synchrone(s)`);
    if (ticks > 1) ok(`la tâche a été relancée après l'échec (${ticks} ticks)`);
    else ko(`la tâche n'a pas été relancée (${ticks} tick)`);

    const logged = logs.filter(l => l.includes('t1-sync-throw') && l.includes('PANNE SYNCHRONE INJECTÉE'));
    if (logged.length > 0) ok(`l'erreur est journalisée avec le nom de la tâche (${logged.length} ligne(s))`);
    else ko('aucune journalisation de l\'erreur', logs.slice(0, 5).join('\n'));
  }

  // ── T2 ───────────────────────────────────────────────────────────
  section('T2 — Un rejet ASYNCHRONE dans une tâche n\'atteint pas le processus');
  {
    let ticks = 0;
    let unhandled = 0;
    const onUnhandled = () => { unhandled++; };
    process.on('unhandledRejection', onUnhandled);

    const logs = await captureLogs(async () => {
      registerBackgroundTask({
        name: 't2-async-reject',
        intervalMs: 30,
        criticality: 'B',
        runImmediately: true,
        run: async () => { ticks++; throw new Error('PANNE ASYNCHRONE INJECTÉE'); },
      });
      await sleep(400);
      await stopAllBackgroundTasks();
    });
    process.off('unhandledRejection', onUnhandled);

    if (unhandled === 0) ok('aucune unhandledRejection émise');
    else ko(`${unhandled} unhandledRejection émise(s) — le processus mourrait en production`);
    if (ticks > 1) ok(`la tâche a été relancée après le rejet (${ticks} ticks)`);
    else ko(`la tâche n'a pas été relancée (${ticks} tick)`);
    if (logs.some(l => l.includes('PANNE ASYNCHRONE INJECTÉE'))) ok('le rejet est journalisé');
    else ko('le rejet n\'est pas journalisé');
  }

  // ── T3 ───────────────────────────────────────────────────────────
  section('T3 — Backoff exponentiel : aucune explosion de retries');
  {
    const stamps: number[] = [];
    await captureLogs(async () => {
      registerBackgroundTask({
        name: 't3-backoff',
        intervalMs: 40,
        criticality: 'C',
        maxConsecutiveFailures: 99, // on observe le backoff, pas le circuit
        runImmediately: true,
        run: () => { stamps.push(Date.now()); throw new Error('échec permanent'); },
      });
      await sleep(1500);
      await stopAllBackgroundTasks();
    });

    const gaps = stamps.slice(1).map((t, i) => t - stamps[i]);
    info(`ticks : ${stamps.length} · écarts (ms) : ${gaps.join(', ')}`);

    // Sans backoff, 1500 ms à 40 ms donneraient ~37 ticks.
    if (stamps.length <= 12) ok(`${stamps.length} tentatives en 1,5 s (≈37 sans backoff) — pas d'explosion`);
    else ko(`${stamps.length} tentatives en 1,5 s — le backoff ne freine pas`);

    const growing = gaps.length >= 3 && gaps[gaps.length - 1] > gaps[0];
    if (growing) ok(`les écarts croissent (${gaps[0]} ms → ${gaps[gaps.length - 1]} ms)`);
    else ko('les écarts ne croissent pas', gaps.join(', '));
  }

  // ── T4 ───────────────────────────────────────────────────────────
  section('T4 — Circuit ouvert après échecs répétés, et journalisation bornée');
  {
    let ticks = 0;
    const logs = await captureLogs(async () => {
      registerBackgroundTask({
        name: 't4-circuit',
        intervalMs: 20,
        criticality: 'B',
        maxConsecutiveFailures: 3,
        maxBackoffMs: 60,
        runImmediately: true,
        run: () => { ticks++; throw new Error('dépendance morte'); },
      });
      await sleep(900);
      await stopAllBackgroundTasks();
    });

    const opened = logs.filter(l => l.includes('circuit ouvert'));
    if (opened.length === 1) ok('le circuit s\'ouvre, et une seule fois');
    else ko(`${opened.length} ligne(s) « circuit ouvert » (1 attendue)`);

    const perFailure = logs.filter(l => l.includes('échec') && l.includes('t4-circuit'));
    info(`ticks : ${ticks} · lignes d'échec détaillées : ${perFailure.length}`);
    if (perFailure.length <= 3) ok(`journalisation bornée : ${perFailure.length} ligne(s) pour ${ticks} échecs`);
    else ko(`journalisation non bornée : ${perFailure.length} lignes pour ${ticks} échecs`);
  }

  // ── T5 ───────────────────────────────────────────────────────────
  section('T5 — La tâche REPREND une fois la panne levée');
  {
    let failing = true;
    let successes = 0;
    const logs = await captureLogs(async () => {
      registerBackgroundTask({
        name: 't5-recovery',
        intervalMs: 25,
        criticality: 'B',
        maxConsecutiveFailures: 3,
        maxBackoffMs: 100,
        runImmediately: true,
        run: () => {
          if (failing) throw new Error('panne temporaire');
          successes++;
        },
      });
      await sleep(600);        // laisse le circuit s'ouvrir
      failing = false;         // la dépendance revient
      await sleep(700);
      await stopAllBackgroundTasks();
    });

    if (successes > 0) ok(`la tâche a repris toute seule (${successes} exécutions réussies)`);
    else ko('la tâche n\'a jamais repris après le rétablissement');
    if (logs.some(l => l.includes('rétablie'))) ok('le rétablissement est journalisé');
    else ko('le rétablissement n\'est pas journalisé');
  }

  // ── T6 ───────────────────────────────────────────────────────────
  section('T6 — Une tâche en panne n\'affecte pas les tâches saines (concurrence)');
  {
    const counts = { sain1: 0, sain2: 0, lent: 0, casse: 0 };
    const logs = await captureLogs(async () => {
      registerBackgroundTask({ name: 't6-sain-1', intervalMs: 25, criticality: 'A', runImmediately: true,
        run: () => { counts.sain1++; } });
      registerBackgroundTask({ name: 't6-sain-2', intervalMs: 25, criticality: 'C', runImmediately: true,
        run: async () => { counts.sain2++; } });
      registerBackgroundTask({ name: 't6-lent', intervalMs: 25, criticality: 'B', runImmediately: true,
        run: async () => { counts.lent++; await sleep(120); } });
      registerBackgroundTask({ name: 't6-casse', intervalMs: 25, criticality: 'B', runImmediately: true,
        run: () => { counts.casse++; throw new Error('tâche cassée'); } });
      await sleep(800);
    });

    info(`exécutions — sain1:${counts.sain1} sain2:${counts.sain2} lent:${counts.lent} casse:${counts.casse}`);
    if (counts.sain1 > 5 && counts.sain2 > 5) ok('les tâches saines continuent au rythme nominal');
    else ko('les tâches saines ont été ralenties par la tâche en panne');

    // Anti-empilement : une tâche de 120 ms sur un intervalle de 25 ms ne doit
    // pas s'exécuter 32 fois en 800 ms — setInterval l'aurait fait.
    if (counts.lent <= 8) ok(`la tâche lente ne s'empile pas (${counts.lent} exécutions, pas ~32)`);
    else ko(`la tâche lente s'empile (${counts.lent} exécutions)`);

    const statuses = getBackgroundTaskStatus();
    const casse = statuses.find(s => s.name === 't6-casse');
    const sain = statuses.find(s => s.name === 't6-sain-1');
    if (casse && casse.totalFailures > 0 && sain && sain.totalFailures === 0)
      ok('l\'état distingue correctement la tâche en panne des tâches saines');
    else ko('l\'état ne reflète pas la panne isolée', JSON.stringify(statuses));

    await stopAllBackgroundTasks();
  }

  // ── T7 ───────────────────────────────────────────────────────────
  section('T7 — Arrêt propre : plus aucun tick après stopAllBackgroundTasks()');
  {
    let ticks = 0;
    await captureLogs(async () => {
      registerBackgroundTask({ name: 't7-stop', intervalMs: 20, criticality: 'C', runImmediately: true,
        run: () => { ticks++; } });
      await sleep(200);
      await stopAllBackgroundTasks();
    });
    const afterStop = ticks;
    await sleep(300);

    if (ticks === afterStop) ok(`aucun tick après l'arrêt (${afterStop} avant, ${ticks} après 300 ms)`);
    else ko(`${ticks - afterStop} tick(s) après l'arrêt`);
    if (getBackgroundTaskStatus().length === 0) ok('le registre est vidé');
    else ko('le registre contient encore des tâches');
  }
}

// ═══════════════════════════════════════════════════════════════════
async function part2(): Promise<void> {
  console.log('\n════════ PARTIE 2 — serveur réel, dépendances en panne ════════');

  section('T8 — Prérequis');
  if (sh('docker', ['info', '--format', '{{.ServerVersion}}']).code !== 0) {
    ko('démon Docker injoignable — partie 2 non exécutée');
    return;
  }
  ok('démon Docker joignable');

  const PG = 'maintrix-f02-db';
  const TMP = mkdtempSync(join(tmpdir(), 'f02-'));
  const freePort = () => {
    const r = spawnSync(process.execPath, ['-e',
      `const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})`],
      { encoding: 'utf8' });
    return parseInt((r.stdout || '').trim(), 10);
  };
  const pgPort = freePort();
  const appPort = freePort();
  const deadPort = freePort(); // port sur lequel rien n'écoute : panne réseau
  const BASE = `http://127.0.0.1:${appPort}`;

  let server: ReturnType<typeof spawn> | null = null;
  const cleanup = () => {
    if (server && !server.killed) {
      try { spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* ignore */ }
    }
    sh('docker', ['rm', '-f', PG]);
    try { rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }
  };

  try {
    sh('docker', ['rm', '-f', PG]);
    const up = sh('docker', ['run', '-d', '--name', PG,
      '-e', 'POSTGRES_USER=f02', '-e', 'POSTGRES_PASSWORD=f02pw', '-e', 'POSTGRES_DB=f02',
      '-p', `${pgPort}:5432`, 'postgres:15-alpine']);
    if (up.code !== 0) { ko('démarrage de PostgreSQL', up.out); return; }
    for (let i = 0; i < 60; i++) {
      if (sh('docker', ['exec', PG, 'pg_isready', '-U', 'f02', '-d', 'f02']).code === 0) break;
      await sleep(1000);
    }
    ok(`PostgreSQL de test démarré (port ${pgPort})`);

    // Le serveur est lancé avec TROIS dépendances externes déjà en panne :
    // MQTT injoignable, Maximo injoignable, clé IA invalide.
    const env = {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(appPort),
      DATABASE_URL: `postgresql://f02:f02pw@127.0.0.1:${pgPort}/f02`,
      SESSION_SECRET: 'f02_session', JWT_SECRET: 'f02_jwt',
      KMS_MASTER_KEY: 'f02_kms_master_key_at_least_32_characters',
      MFA_ENCRYPTION_KEY: 'f02_mfa_key_at_least_32_characters_long',
      MQTT_BROKER_URL: `mqtt://127.0.0.1:${deadPort}`,
      MAXIMO_BASE_URL: `http://127.0.0.1:${deadPort}`,
      MAXIMO_USERNAME: 'none', MAXIMO_PASSWORD: 'none',
      ANTHROPIC_API_KEY: 'sk-ant-invalid-key-for-fault-injection',
      DOTENV_CONFIG_PATH: join(TMP, 'none.env'),
    };

    const log: string[] = [];
    server = spawn(process.execPath, ['dist/index.js'], { env });
    server.stdout?.on('data', d => log.push(d.toString()));
    server.stderr?.on('data', d => log.push(d.toString()));

    const probe = async () => {
      try {
        const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(8000) });
        return { status: res.status, body: await res.text() };
      } catch { return { status: 0, body: '' }; }
    };
    const waitFor = async (pred: (r: { status: number }) => boolean, ms: number) => {
      const end = Date.now() + ms;
      let last = { status: 0, body: '' };
      while (Date.now() < end) { last = await probe(); if (pred(last)) return last; await sleep(500); }
      return last;
    };

    section('T9 — Le serveur démarre malgré MQTT, Maximo et l\'IA en panne');
    {
      const r = await waitFor(x => x.status === 200, 180000);
      if (r.status === 200) ok('HTTP 200 sur /api/health avec 3 dépendances externes mortes');
      else { ko(`le serveur ne répond pas (HTTP ${r.status})`, log.join('').slice(-1200)); return; }

      const joined = log.join('');
      if (/MQTT/i.test(joined)) ok('la panne MQTT est journalisée');
      else info('aucune trace MQTT (connecteur possiblement en mode simulation)');
    }

    section('T10 — PostgreSQL coupé : l\'application reste servie, les tâches échouent proprement');
    {
      const before = log.length;
      sh('docker', ['stop', PG]);
      const running = sh('docker', ['inspect', '-f', '{{.State.Running}}', PG]).out;
      if (running === 'false') ok('PostgreSQL réellement arrêté (State.Running=false)');
      else ko(`PostgreSQL tourne encore (${running})`);

      const r = await waitFor(x => x.status === 503, 60000);
      if (r.status === 503) ok('l\'application répond toujours — 503 explicite, pas d\'effondrement');
      else ko(`attendu 503, obtenu ${r.status}`);

      // Laisse les tâches DB échouer plusieurs fois.
      await sleep(75000);

      if (server.exitCode === null) ok('le processus serveur est toujours vivant après 75 s de panne DB');
      else ko(`le processus est mort (code ${server.exitCode})`, log.join('').slice(-1500));

      const since = log.slice(before).join('');
      const taskErrors = since.match(/\[tâche [^\]]+\]/g) ?? [];
      const uniques = [...new Set(taskErrors)];
      info(`lignes de tâche depuis la coupure : ${taskErrors.length} · tâches concernées : ${uniques.join(', ') || 'aucune'}`);
      if (taskErrors.length > 0) ok('les échecs de tâches sont journalisés avec leur nom');
      else ko('aucun échec de tâche journalisé pendant la panne DB');

      // Garde-fou anti-explosion : sur 75 s, une boucle de 30 s sans backoff
      // produirait ~3 lignes ; plusieurs tâches en produisent quelques dizaines.
      // Des centaines signaleraient une tempête de retries.
      if (taskErrors.length < 200) ok(`volume de journalisation borné (${taskErrors.length} lignes en 75 s)`);
      else ko(`explosion de journalisation (${taskErrors.length} lignes en 75 s)`);
    }

    section('T11 — PostgreSQL restauré : les tâches reprennent');
    {
      const before = log.length;
      sh('docker', ['start', PG]);
      const r = await waitFor(x => x.status === 200, 120000);
      if (r.status === 200) ok('l\'application repasse à 200');
      else ko(`l'application ne s'est pas rétablie (HTTP ${r.status})`);

      // Laisse le temps aux tâches en backoff de retenter.
      await sleep(90000);
      const since = log.slice(before).join('');
      if (/rétablie/.test(since)) ok('au moins une tâche journalise son rétablissement');
      else info('aucun message de rétablissement observé dans la fenêtre (backoff possiblement plus long)');

      if (server.exitCode === null) ok('le processus a traversé panne + rétablissement sans redémarrer');
      else ko(`le processus est mort (code ${server.exitCode})`);
    }

    section('T12 — Réponse IA invalide : dégradation dans la requête, pas dans le processus');
    {
      // L'IA n'est appelée par AUCUNE tâche de fond (voir docs/BACKGROUND_TASKS.md).
      // On vérifie donc le chemin réel : une route HTTP avec une clé invalide.
      let status = 0;
      try {
        const res = await fetch(`${BASE}/api/ai/diagnostic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symptoms: 'test', equipmentType: 'moteur' }),
          signal: AbortSignal.timeout(30000),
        });
        status = res.status;
      } catch { status = 0; }
      info(`POST /api/ai/diagnostic → HTTP ${status}`);

      await sleep(2000);
      if (server.exitCode === null) ok('le processus survit à un appel IA avec clé invalide');
      else ko(`le processus est mort après l'appel IA (code ${server.exitCode})`);

      const still = await probe();
      if (still.status === 200) ok('l\'application reste disponible après l\'échec IA');
      else ko(`l'application ne répond plus correctement (HTTP ${still.status})`);
    }

    // L'arrêt propre sur SIGTERM ne peut pas être vérifié ici : Windows n'a
    // pas de vrai SIGTERM (`taskkill` ferme la fenêtre, `process.kill` termine
    // brutalement). C'est l'objet de la partie 3, dans un conteneur Linux —
    // qui est de toute façon la cible réelle du déploiement.
  } finally {
    cleanup();
  }
}

// ═══════════════════════════════════════════════════════════════════
/**
 * PARTIE 3 — arrêt propre sur un VRAI SIGTERM, dans un conteneur Linux.
 *
 * `docker stop` envoie SIGTERM puis SIGKILL après un délai : c'est exactement
 * ce que fait un redéploiement. Windows n'ayant pas de SIGTERM utilisable, ce
 * comportement ne peut être observé qu'ici — et c'est de toute façon la cible
 * de déploiement réelle.
 *
 * Requiert l'image `maintrix-f01-app` (construite par
 * scripts/verify-health-container.mjs) ou `maintrix-app`.
 */
async function part3(): Promise<void> {
  console.log('\n════════ PARTIE 3 — arrêt propre (SIGTERM) en conteneur ════════');

  section('T13 — SIGTERM déclenche la séquence d\'arrêt ordonné');

  const image = ['maintrix-f01-app', 'maintrix-app'].find(
    i => sh('docker', ['image', 'inspect', i]).code === 0,
  );
  if (!image) {
    ko('aucune image applicative disponible — construisez-la puis relancez',
       'docker compose --env-file .env.docker -f docker-compose.simple.yml -p maintrix-f01 build app');
    return;
  }
  ok(`image utilisée : ${image}`);

  const NET = 'maintrix-f02-net';
  const PG = 'maintrix-f02-pg';
  const APP = 'maintrix-f02-app';
  const clean = () => {
    sh('docker', ['rm', '-f', APP]);
    sh('docker', ['rm', '-f', PG]);
    sh('docker', ['network', 'rm', NET]);
  };
  clean();

  try {
    sh('docker', ['network', 'create', NET]);
    sh('docker', ['run', '-d', '--name', PG, '--network', NET,
      '-e', 'POSTGRES_USER=f02', '-e', 'POSTGRES_PASSWORD=f02pw', '-e', 'POSTGRES_DB=f02',
      'postgres:15-alpine']);
    for (let i = 0; i < 60; i++) {
      if (sh('docker', ['exec', PG, 'pg_isready', '-U', 'f02', '-d', 'f02']).code === 0) break;
      await sleep(1000);
    }
    ok('PostgreSQL prêt sur le réseau du conteneur');

    const run = sh('docker', ['run', '-d', '--name', APP, '--network', NET,
      '-e', 'NODE_ENV=production', '-e', 'PORT=5000',
      '-e', `DATABASE_URL=postgresql://f02:f02pw@${PG}:5432/f02`,
      '-e', 'SESSION_SECRET=f02_session', '-e', 'JWT_SECRET=f02_jwt',
      '-e', 'KMS_MASTER_KEY=f02_kms_master_key_at_least_32_characters',
      '-e', 'MFA_ENCRYPTION_KEY=f02_mfa_key_at_least_32_characters_long',
      image]);
    if (run.code !== 0) { ko('démarrage du conteneur applicatif', run.out); return; }

    // Attendre que le serveur écoute (sonde depuis l'intérieur du conteneur).
    let up = false;
    for (let i = 0; i < 90; i++) {
      if (sh('docker', ['exec', APP, 'curl', '-fsS', '--max-time', '3',
                        'http://localhost:5000/api/health']).code === 0) { up = true; break; }
      await sleep(2000);
    }
    if (!up) { ko('le serveur n\'a jamais répondu dans le conteneur',
                  sh('docker', ['logs', '--tail', '25', APP]).out); return; }
    ok('serveur démarré et sain dans le conteneur');

    // `docker stop` = SIGTERM, puis SIGKILL après le délai de grâce.
    const t0 = Date.now();
    const stopped = sh('docker', ['stop', '-t', '20', APP]);
    const elapsed = Date.now() - t0;
    if (stopped.code !== 0) ko('docker stop a échoué', stopped.out);
    info(`docker stop terminé en ${elapsed} ms`);

    const logs = sh('docker', ['logs', '--tail', '40', APP]).out;
    const exitCode = sh('docker', ['inspect', '-f', '{{.State.ExitCode}}', APP]).out;

    const steps: Array<[string, RegExp]> = [
      ['séquence d\'arrêt engagée', /Arrêt demandé \(SIGTERM\)/],
      ['tâches de fond arrêtées', /tâche\(s\) de fond arrêtée\(s\)/],
      ['serveur HTTP fermé', /serveur HTTP fermé/],
      ['pool PostgreSQL fermé', /pool PostgreSQL fermé/],
      ['arrêt terminé proprement', /Arrêt terminé \(code 0\)/],
    ];
    for (const [label, re] of steps) {
      if (re.test(logs)) ok(label);
      else ko(`étape absente : ${label}`, logs.slice(-900));
    }

    if (exitCode === '0') ok(`code de sortie 0 (arrêt volontaire, pas un plantage)`);
    else ko(`code de sortie ${exitCode} (0 attendu)`);

    // Un arrêt propre est rapide ; si docker stop a dû attendre les 20 s de
    // grâce puis SIGKILL, c'est que le signal n'a pas été traité.
    if (elapsed < 18000) ok(`arrêt en ${elapsed} ms, sans attendre le SIGKILL de secours`);
    else ko(`arrêt en ${elapsed} ms : le SIGTERM n'a pas été honoré`);
  } finally {
    clean();
  }
}

// ═══════════════════════════════════════════════════════════════════
// `--part1` limite l'exécution au superviseur (quelques secondes) ; sans
// argument, la partie intégration s'exécute aussi (plusieurs minutes).
const only = process.argv.slice(2);
await part1();
if (only.includes('--part1')) {
  console.log('\n(parties 2 et 3 ignorées : --part1)');
} else {
  await part2();
  await part3();
}

console.log('\n' + '═'.repeat(45));
console.log(`  RÉUSSIS : ${pass}    ÉCHOUÉS : ${fail}`);
console.log('═'.repeat(45));
process.exit(fail === 0 ? 0 : 1);

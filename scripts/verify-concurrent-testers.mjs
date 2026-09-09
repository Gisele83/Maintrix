#!/usr/bin/env node
/**
 * Plusieurs testeurs simultanés sur l'environnement réel — F10.
 *
 *   node scripts/verify-concurrent-testers.mjs
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE SCRIPT EXISTE À CÔTÉ DE `npm test`
 * ═══════════════════════════════════════════════════════════════════
 * `tests/integration/concurrency.test.ts` vérifie la CORRECTION en concurrence
 * (isolation, écritures, pool). Mais il tourne en `NODE_ENV=test`, mode dans
 * lequel le limiteur de débit du login est DÉSACTIVÉ
 * (server/enterprise-auth-middleware.ts).
 *
 * Or l'environnement destiné aux testeurs tourne en `production` : le limiteur
 * y est actif, à 5 tentatives / 15 minutes et 30 minutes de blocage. Son
 * comportement multi-utilisateur ne peut donc être mesuré QUE sur
 * l'environnement réel — c'est l'objet de ce script.
 *
 * La question posée est concrète : **les échecs de connexion d'un testeur
 * peuvent-ils bloquer les autres ?**
 *
 * Prérequis : environnement monté (`node scripts/provision-test-env.mjs`).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const ENV_FILE = process.env.MAINTRIX_TEST_ENV_FILE || '.env.test-cloud';
if (!existsSync(ENV_FILE)) {
  console.error(`⛔ ${ENV_FILE} absent. Lancez : node scripts/provision-test-env.mjs`);
  process.exit(2);
}
const env = Object.fromEntries(
  readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)
    .filter(l => /^[A-Z_]+=/.test(l))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

const APP_PORT = env.APP_HOST_PORT || '5000';
const BASE = `http://127.0.0.1:${APP_PORT}`;
const DB = 'maintrix-test-db';
const PG_USER = env.POSTGRES_USER || 'maintrix_test';
const PG_DB = env.POSTGRES_DB || 'maintrix_test';

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };
const ko = (m, d) => { console.log(`  ✗ ${m}`); if (d) console.log(`      ${String(d).slice(0, 300)}`); fail++; };
const info = (m) => console.log(`      ${m}`);
const section = (t) => console.log(`\n── ${t}`);

const docker = (a) => {
  const r = spawnSync('docker', a, { encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
};
const purgerLimiteur = () =>
  docker(['exec', DB, 'psql', '-U', PG_USER, '-d', PG_DB, '-c', 'DELETE FROM rate_limits']);

/** Tentative de connexion, en simulant l'en-tête Origin d'un navigateur. */
async function connexion(email, motDePasse) {
  try {
    const res = await fetch(`${BASE}/api/enterprise-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE },
      body: JSON.stringify({ email, password: motDePasse }),
      signal: AbortSignal.timeout(15000),
    });
    return res.status;
  } catch { return 0; }
}

// ═══════════════════════════════════════════════════════════════════
section('T0 — Prérequis');
if (docker(['inspect', '-f', '{{.State.Status}}', 'maintrix-test-app']).out !== 'running') {
  console.error('\n⛔ L\'environnement de test ne tourne pas.');
  console.error('   node scripts/provision-test-env.mjs');
  process.exit(2);
}
ok('environnement de test en fonctionnement');
info(`mode : NODE_ENV=${docker(['exec', 'maintrix-test-app', 'printenv', 'NODE_ENV']).out}`);

// ═══════════════════════════════════════════════════════════════════
section('T1 — Plusieurs testeurs se connectent en même temps');
{
  purgerLimiteur();
  const comptes = [
    ['admin@maintrix.local', 'Maintrix2024!'],
    ['tech@maintrix.local', 'Maintrix2024!'],
    ['admin-beta@maintrix.local', 'Maintrix2024!'],
  ];

  const codes = await Promise.all(comptes.map(([e, p]) => connexion(e, p)));
  info(`codes obtenus : ${codes.join(', ')}`);

  if (codes.every(c => c === 200)) ok('trois testeurs se connectent simultanément');
  else ko(`toutes les connexions n'ont pas abouti : ${codes.join(', ')}`);
}

// ═══════════════════════════════════════════════════════════════════
section('T2 — Les échecs d\'UN testeur bloquent-ils les AUTRES ?');
{
  // Le compteur est indexé par `req.tenantId || req.ip`. Avant authentification
  // il n'y a pas de tenant : c'est donc l'IP. Des testeurs derrière une même
  // sortie réseau (NAT d'entreprise, VPN) partagent alors un unique compteur.
  purgerLimiteur();

  // Un testeur se trompe six fois de mot de passe.
  const echecs = [];
  for (let i = 0; i < 6; i++) {
    echecs.push(await connexion('admin@maintrix.local', 'mauvais-mot-de-passe'));
  }
  info(`six tentatives erronées → ${echecs.join(', ')}`);

  const bloque = echecs.some(c => c === 429);
  if (bloque) ok('le limiteur se déclenche bien après le seuil');
  else ko('aucun blocage après six échecs — le limiteur ne protège pas');

  // Un AUTRE testeur, identifiants corrects, depuis la même adresse.
  //
  // ⚠️ Ce point est OBSERVÉ, pas jugé : bloquer une adresse après plusieurs
  // échecs est précisément ce qu'un limiteur anti-force-brute doit faire.
  // L'effet collatéral sur des testeurs partageant une sortie réseau est un
  // compromis assumé, pas un défaut — et il ne se déclenche désormais que si
  // quelqu'un se trompe réellement cinq fois (voir T2b).
  const autre = await connexion('tech@maintrix.local', 'Maintrix2024!');
  info(`un autre testeur, identifiants VALIDES depuis la même IP → HTTP ${autre}`);

  if (autre === 200) {
    info('→ compteur non partagé sur cet accès (adresses distinctes)');
  } else if (autre === 429) {
    info('→ compteur PARTAGÉ : les échecs répétés bloquent aussi les voisins d\'adresse.');
    info('  Sur cette machine, tous les appels viennent de la passerelle Docker.');
    info('  En production, nginx pose X-Forwarded-For et l\'app a `trust proxy` :');
    info('  chaque client a son compteur. Des testeurs derrière un même NAT');
    info('  d\'entreprise resteraient toutefois groupés — à documenter au pilote.');
  } else {
    ko(`réponse inattendue à une connexion valide : HTTP ${autre}`);
  }

  purgerLimiteur();
}

// ═══════════════════════════════════════════════════════════════════
section('T2b — Les connexions RÉUSSIES ne consomment pas le quota');
{
  // ⚠️ C'est le défaut le plus lourd trouvé en F10, et il ne demandait AUCUN
  // échec : le compteur s'incrémentait à chaque requête, succès compris.
  // Six connexions valides depuis une même adresse suffisaient à bloquer
  // 30 minutes — soit six testeurs derrière un même NAT d'entreprise verrouillés
  // en se connectant simplement.
  purgerLimiteur();

  const codes = [];
  for (let i = 0; i < 8; i++) {
    codes.push(await connexion('admin@maintrix.local', 'Maintrix2024!'));
  }
  info(`huit connexions valides consécutives → ${codes.join(', ')}`);

  if (codes.every(c => c === 200)) {
    ok('huit connexions réussies de suite, aucun blocage');
  } else {
    ko(`blocage sur un usage NORMAL (${codes.filter(c => c === 429).length} × 429)`,
       'Un limiteur anti-force-brute ne doit compter que les tentatives infructueuses.');
  }

  // La protection contre le bourrinage doit rester entière.
  purgerLimiteur();
  const echecs = [];
  for (let i = 0; i < 7; i++) {
    echecs.push(await connexion('admin@maintrix.local', 'mauvais'));
  }
  info(`sept tentatives erronées → ${echecs.join(', ')}`);
  if (echecs.includes(429)) ok('les échecs répétés restent bloqués — protection intacte');
  else ko('aucun blocage après sept échecs — la protection a été perdue');

  purgerLimiteur();
}

// ═══════════════════════════════════════════════════════════════════
section('T3 — Charge simultanée sur les routes applicatives');
{
  purgerLimiteur();

  // Session unique, puis 60 lectures simultanées : on éprouve le pool de
  // connexions (max: 10, attente plafonnée à 10 s) pendant que les tâches de
  // fond consomment elles aussi ce pool.
  const res = await fetch(`${BASE}/api/enterprise-auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email: 'admin@maintrix.local', password: 'Maintrix2024!' }),
  });
  if (res.status !== 200) { ko(`connexion impossible (HTTP ${res.status}) — T3 non exécuté`); }
  else {
    const cookies = (res.headers.getSetCookie?.() ?? []).join('; ');
    const debut = Date.now();
    const codes = await Promise.all(Array.from({ length: 60 }, () =>
      fetch(`${BASE}/api/equipment`, { headers: { Cookie: cookies }, signal: AbortSignal.timeout(30000) })
        .then(r => r.status).catch(() => 0),
    ));
    const duree = Date.now() - debut;

    const ko200 = codes.filter(c => c !== 200);
    info(`60 lectures simultanées en ${duree} ms · échecs : ${ko200.length}`);

    if (ko200.length === 0) ok('aucune requête perdue sous 60 appels simultanés');
    else ko(`${ko200.length} requête(s) en échec (${[...new Set(ko200)].join(', ')})`,
            'Pool saturé : server/db.ts fixe max:10 et connectionTimeoutMillis:10000.');

    if (duree < 30000) ok(`temps total ${duree} ms — contention acceptable`);
    else ko(`temps total ${duree} ms — contention perceptible pour les testeurs`);
  }
}

// ═══════════════════════════════════════════════════════════════════
section('T4 — L\'application reste saine après la charge');
{
  const sante = await fetch(`${BASE}/api/health`).then(r => r.json()).catch(() => null);
  if (sante?.status === 'ok' && sante?.checks?.database === 'ok') ok('sonde de santé toujours verte');
  else ko('sonde dégradée après la charge', JSON.stringify(sante));

  const redemarrages = docker(['inspect', '-f', '{{.RestartCount}}', 'maintrix-test-app']).out;
  if (redemarrages === '0') ok('le conteneur n\'a pas redémarré');
  else ko(`le conteneur a redémarré ${redemarrages} fois sous la charge`);

  purgerLimiteur();
  info('compteurs de limitation purgés');
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(52));
console.log(`  MULTI-UTILISATEURS : ${fail === 0 ? 'OK' : 'CONSTATS'}   —   ${pass} réussis, ${fail} échoués`);
console.log('═'.repeat(52));
process.exit(fail === 0 ? 0 : 1);

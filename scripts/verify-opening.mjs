#!/usr/bin/env node
/**
 * Porte d'ouverture aux testeurs externes — F12.
 *
 *   node scripts/verify-opening.mjs
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QU'ELLE VÉRIFIE, ET POURQUOI
 * ═══════════════════════════════════════════════════════════════════
 * Les barrières précédentes (F01→F11) valident que l'application FONCTIONNE.
 * Celle-ci valide qu'elle est ATTEIGNABLE et UTILISABLE par quelqu'un qui n'est
 * pas sur la machine — ce qui est une autre question, et celle qui décide de
 * l'ouverture.
 *
 * Le piège central est mesuré, pas supposé : avec `ALLOWED_ORIGINS` limité à
 * `localhost`, une connexion depuis toute autre adresse renvoie
 * **403 ORIGIN_NOT_ALLOWED**. La page s'affiche, l'API répond, le certificat est
 * accepté — seule l'authentification échoue. Un testeur voit un écran de
 * connexion qui refuse ses identifiants corrects, sans explication.
 * Reproduit sur l'adresse LAN de la machine avant correction.
 *
 * Cette barrière échoue tant que l'ouverture n'est pas RÉELLEMENT possible.
 * C'est son rôle : dire non tant que quelque chose manque.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const ENV_FILE = process.env.MAINTRIX_TEST_ENV_FILE || '.env.test-cloud';

let pass = 0, fail = 0, avert = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };
const ko = (m, d) => { console.log(`  ✗ ${m}`); if (d) console.log(String(d).split('\n').map(l => `      ${l}`).join('\n')); fail++; };
const warn = (m, d) => { console.log(`  ⚠ ${m}`); if (d) console.log(String(d).split('\n').map(l => `      ${l}`).join('\n')); avert++; };
const info = (m) => console.log(`      ${m}`);
const section = (t) => console.log(`\n── ${t}`);

const docker = (a) => {
  const r = spawnSync('docker', a, { encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
};

if (!existsSync(ENV_FILE)) {
  console.error(`⛔ ${ENV_FILE} absent. Lancez : node scripts/provision-test-env.mjs`);
  process.exit(2);
}
const env = Object.fromEntries(
  readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)
    .filter(l => /^[A-Z_]+=/.test(l))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

const estLocale = (u) => /(^|\/\/)(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(u);

/** Adresse privée (RFC1918) : joignable sur un réseau local, jamais depuis Internet. */
const estPrivee = (hote) => {
  const m = hote.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127;
};

console.log('\n🚪 Ouverture contrôlée aux testeurs externes\n');

// ═══════════════════════════════════════════════════════════════════
section('T1 — L\'environnement tourne');
{
  for (const c of ['maintrix-test-app', 'maintrix-test-db', 'maintrix-test-nginx']) {
    const etat = docker(['inspect', '-f', '{{.State.Health.Status}}', c]).out;
    if (etat === 'healthy') ok(`${c} : healthy`);
    else ko(`${c} : ${etat || 'absent'}`);
  }
  if (fail > 0) {
    console.log('\n⛔ Environnement non opérationnel — ouverture impossible.');
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════
section('T2 — Une adresse publique est déclarée');

const publique = (env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
const origines = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

if (!publique) {
  ko('FRONTEND_URL n\'est pas défini');
} else if (estLocale(publique)) {
  ko(`l'adresse déclarée est locale : ${publique}`,
     'Aucun testeur distant ne peut l\'atteindre. Déclarez l\'adresse réelle :\n' +
     '  node scripts/provision-test-env.mjs --public-url=https://votre-domaine');
} else {
  ok(`adresse publique déclarée : ${publique}`);
}

const hote = publique.replace(/^https?:\/\//, '').split(':')[0];
if (publique && !estLocale(publique)) {
  if (estPrivee(hote)) {
    warn(`${hote} est une adresse privée (RFC1918)`,
         'Joignable depuis le réseau local seulement. Convient à une répétition\n' +
         'ou à des testeurs internes ; pas à des testeurs distants.');
  } else {
    ok(`${hote} n'est pas une adresse privée`);
  }
}

if (publique && !origines.includes(publique)) {
  ko('l\'adresse publique n\'est PAS dans ALLOWED_ORIGINS',
     'Toute connexion renverra 403 ORIGIN_NOT_ALLOWED. C\'est le défaut le plus\n' +
     'silencieux de cette liste : la page s\'affiche, seule l\'authentification échoue.');
} else if (publique) {
  ok('l\'adresse publique figure dans ALLOWED_ORIGINS');
}

if (!publique || estLocale(publique)) {
  console.log('\n' + '═'.repeat(56));
  console.log('  OUVERTURE : IMPOSSIBLE — aucune adresse publique exploitable');
  console.log('═'.repeat(56));
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════
section('T3 — L\'application répond sur cette adresse');

const req = async (chemin, opts = {}) => {
  try {
    const r = await fetch(`${publique}${chemin}`, { signal: AbortSignal.timeout(20000), ...opts });
    return { status: r.status, corps: await r.text().catch(() => ''), entetes: r.headers };
  } catch (e) { return { status: 0, erreur: String(e.message || e) }; }
};

// Le certificat auto-signé fait échouer fetch : on l'accepte pour la mesure,
// et T5 juge séparément de sa validité.
const naguereTLS = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

{
  const sante = await req('/api/health');
  if (sante.status === 200) {
    let corps = {};
    try { corps = JSON.parse(sante.corps); } catch { /* ignoré */ }
    if (corps.status === 'ok' && corps.checks?.database === 'ok') ok('GET /api/health : ok, base ok');
    else ko('sonde de santé dégradée', sante.corps.slice(0, 200));
  } else {
    ko(`/api/health injoignable sur ${publique} (HTTP ${sante.status})`, sante.erreur);
  }

  const page = await req('/login');
  if (page.status === 200 && /<!doctype html/i.test(page.corps)) ok('la page de connexion est servie');
  else ko(`page de connexion non servie (HTTP ${page.status})`);
}

// ═══════════════════════════════════════════════════════════════════
section('T4 — Un testeur peut réellement se connecter depuis cette adresse');
{
  // Le limiteur de connexion est ACTIF en production (5/15 min). On purge les
  // compteurs pour que le résultat mesure l'origine, pas un blocage résiduel.
  docker(['exec', 'maintrix-test-db', 'psql', '-U', env.POSTGRES_USER || 'maintrix_test',
          '-d', env.POSTGRES_DB || 'maintrix_test', '-c', 'DELETE FROM rate_limits']);

  const r = await req('/api/enterprise-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: publique },
    body: JSON.stringify({ email: 'admin@maintrix.local', password: 'Maintrix2024!' }),
  });

  if (r.status === 200) {
    ok(`connexion acceptée avec Origin: ${publique}`);
  } else if (r.status === 403 && /ORIGIN_NOT_ALLOWED/.test(r.corps || '')) {
    ko('403 ORIGIN_NOT_ALLOWED — les testeurs ne pourront pas se connecter',
       `L'origine ${publique} n'est pas acceptée par le serveur.\n` +
       'Si vous venez de l\'ajouter, redémarrez l\'application :\n' +
       '  docker compose -f docker-compose.test.yml -p maintrix-test --env-file ' + ENV_FILE + ' up -d app');
  } else {
    ko(`connexion refusée (HTTP ${r.status})`, (r.corps || r.erreur || '').slice(0, 200));
  }

  // Contrôle négatif : une origine non déclarée DOIT être refusée. Sans lui,
  // une configuration qui accepte tout passerait pour correcte.
  const pirate = await req('/api/enterprise-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://site-non-declare.invalid' },
    body: JSON.stringify({ email: 'admin@maintrix.local', password: 'Maintrix2024!' }),
  });
  if (pirate.status === 403) ok('une origine non déclarée est bien refusée');
  else ko(`une origine non déclarée est acceptée (HTTP ${pirate.status}) — le filtre ne protège rien`);

  docker(['exec', 'maintrix-test-db', 'psql', '-U', env.POSTGRES_USER || 'maintrix_test',
          '-d', env.POSTGRES_DB || 'maintrix_test', '-c', 'DELETE FROM rate_limits']);
}

if (naguereTLS === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
else process.env.NODE_TLS_REJECT_UNAUTHORIZED = naguereTLS;

// ═══════════════════════════════════════════════════════════════════
section('T5 — Certificat TLS');
{
  const port = publique.startsWith('https://') ? (publique.split(':')[2] || '443') : null;
  if (!port) {
    ko('l\'adresse publique n\'est pas en HTTPS',
       'Les identifiants des testeurs circuleraient en clair.');
  } else {
    const r = spawnSync('openssl',
      ['s_client', '-connect', `${hote}:${port}`, '-servername', hote],
      { input: '', encoding: 'utf8', timeout: 25000 });
    const sortie = `${r.stdout || ''}${r.stderr || ''}`;

    const sujet = (sortie.match(/subject=(.*)/) || [])[1]?.trim() || '';
    const emetteur = (sortie.match(/issuer=(.*)/) || [])[1]?.trim() || '';
    const verif = (sortie.match(/Verify return code: (\d+) \(([^)]+)\)/) || []);

    info(`sujet   : ${sujet || 'inconnu'}`);
    info(`émetteur: ${emetteur || 'inconnu'}`);

    if (sujet && emetteur && sujet === emetteur) {
      warn('certificat AUTO-SIGNÉ',
           'Chaque testeur verra un avertissement de sécurité et devra passer outre.\n' +
           'Cela leur apprend à ignorer ces avertissements — et empêche de distinguer\n' +
           'un vrai incident. Utilisez un certificat reconnu (Let\'s Encrypt) avant\n' +
           'd\'ouvrir à des tiers.');
    } else if (verif[1] === '0') {
      ok(`certificat validé par une autorité reconnue (${verif[2]})`);
    } else if (verif[1]) {
      warn(`certificat non validé : ${verif[2]}`);
    } else {
      warn('validité du certificat indéterminée');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
section('T6 — Aucun service interne exposé');
{
  const publies = docker(['ps', '--format', '{{.Names}}\t{{.Ports}}']).out.split('\n').filter(Boolean);
  let exposition = 0;
  for (const ligne of publies) {
    const [nom, ports = ''] = ligne.split('\t');
    if (!/^maintrix-test/.test(nom)) continue;
    if (/^maintrix-test-nginx/.test(nom)) continue; // point d'entrée assumé

    const surToutes = /0\.0\.0\.0:|\[::\]:/.test(ports);
    if (surToutes) { ko(`${nom} est publié sur toutes les interfaces`, ports); exposition++; }
    else ok(`${nom} : ${ports || 'aucun port publié'}`);
  }
  if (exposition === 0) ok('seul nginx est exposé — base et application restent internes');
}

// ═══════════════════════════════════════════════════════════════════
section('T7 — Capacité et arrêt d\'urgence');
{
  const q = (sql) => docker(['exec', 'maintrix-test-db', 'psql', '-U', env.POSTGRES_USER || 'maintrix_test',
                             '-d', env.POSTGRES_DB || 'maintrix_test', '-Atc', sql]).out;

  const tenants = q('SELECT count(*) FROM tenants') || '?';
  const comptes = q('SELECT count(*) FROM user_profiles') || '?';
  info(`${tenants} locataire(s), ${comptes} compte(s) — état de départ connu`);

  if (env.SUPER_ADMIN_EMAIL && env.SUPER_ADMIN_SECRET) ok('provisionnement des testeurs possible (super-admin configuré)');
  else ko('compte super-admin absent — aucun testeur ne peut être créé');

  // Fermer l'accès doit être immédiat et sans effet de bord : arrêter nginx
  // coupe le seul point d'entrée public, sans toucher aux données.
  const nginxTourne = docker(['inspect', '-f', '{{.State.Running}}', 'maintrix-test-nginx']).out === 'true';
  if (nginxTourne) ok('arrêt d\'urgence disponible : docker stop maintrix-test-nginx');
  else ko('nginx n\'est pas en fonctionnement');

  const redemarrages = docker(['inspect', '-f', '{{.RestartCount}}', 'maintrix-test-app']).out;
  if (redemarrages === '0') ok('l\'application n\'a jamais redémarré depuis son lancement');
  else warn(`l'application a redémarré ${redemarrages} fois — à expliquer avant d'ouvrir`);
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(56));
const verdict = fail > 0 ? 'REFUSÉE' : avert > 0 ? 'POSSIBLE SOUS RÉSERVE' : 'AUTORISÉE';
console.log(`  OUVERTURE : ${verdict}   —   ${pass} réussis, ${fail} échoués, ${avert} réserve(s)`);
console.log('═'.repeat(56));
if (avert > 0 && fail === 0) {
  console.log('\n  Les réserves ci-dessus ne bloquent pas techniquement, mais elles');
  console.log('  dégradent l\'expérience ou la sécurité des testeurs. À trancher');
  console.log('  explicitement — voir docs/CONTROLLED_OPENING.md.');
}
process.exit(fail === 0 ? 0 : 1);

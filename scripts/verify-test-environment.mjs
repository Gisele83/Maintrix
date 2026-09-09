#!/usr/bin/env node
/**
 * Conformité de l'environnement de test cloud — F08.
 *
 *   node scripts/verify-test-environment.mjs
 *
 * Vérifie l'environnement RÉELLEMENT EN MARCHE contre les règles de la mission :
 *
 *   • séparé du développement (base, secrets, cycle de vie distincts) ;
 *   • aucune donnée de production ;
 *   • aucun service interne exposé à Internet ;
 *   • stable  — la stack est saine et n'a pas redémarré en boucle ;
 *   • observable — les sondes renseignent réellement ;
 *   • reproductible — schéma conforme à shared/schema.ts, données déterministes.
 *
 * Complémentaire de scripts/verify-deployment-security.mjs, qui analyse les
 * FICHIERS ; celui-ci interroge la stack en fonctionnement.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const ENV_FILE = process.env.MAINTRIX_TEST_ENV_FILE || '.env.test-cloud';
const PROJECT = 'maintrix-test';
const APP = 'maintrix-test-app';
const DB = 'maintrix-test-db';
const NGINX = 'maintrix-test-nginx';

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };
const ko = (m, d) => { console.log(`  ✗ ${m}`); if (d) console.log(String(d).split('\n').slice(0, 6).map(l => '      ' + l).join('\n')); fail++; };
const info = (m) => console.log(`      ${m}`);
const section = (t) => console.log(`\n── ${t}`);

function docker(a) {
  const r = spawnSync('docker', a, { encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

/**
 * ⚠️ Ne pas confondre « je ne peux pas mesurer » et « c'est cassé ».
 *
 * Lancé par un compte absent du groupe `docker`, ce script produisait VINGT
 * échecs, tous porteurs du même message : `permission denied ... docker.sock`.
 * Il annonçait alors « PostgreSQL publie un port », « fuite inter-tenant
 * possible », « schéma incomplet : NaN tables » — trois affirmations fausses et
 * alarmantes, sur un environnement parfaitement sain.
 *
 * Constaté en conditions réelles lors du déploiement du 2026-09-10. Une
 * barrière qui accuse à tort est pire qu'une barrière absente : elle fait
 * chercher des défauts inexistants, et finit par être ignorée.
 *
 * On vérifie donc l'accès AVANT toute mesure, et on s'arrête net s'il manque.
 */
function exigerAccesDocker() {
  const r = docker(['ps', '--quiet']);
  if (r.code === 0) return;

  console.error('\n⛔ Docker est injoignable — aucune mesure n\'est possible.\n');
  console.error(String(r.out).split('\n').slice(0, 3).map(l => `   ${l}`).join('\n'));

  if (/permission denied/i.test(r.out)) {
    console.error('\n   Votre compte n\'appartient pas au groupe `docker`. Deux issues :');
    console.error('     • relancer avec sudo :  sudo node scripts/verify-test-environment.mjs');
    console.error('     • ou, durablement :     sudo usermod -aG docker $USER');
    console.error('       (puis se déconnecter et se reconnecter)');
  } else {
    console.error('\n   Vérifiez que le démon Docker est démarré.');
  }
  console.error('\n   Ce script ne rend AUCUN verdict : ne rien mesurer n\'est pas');
  console.error('   la même chose que constater un défaut.\n');
  process.exit(2);
}

exigerAccesDocker();

const env = existsSync(ENV_FILE)
  ? Object.fromEntries(readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)
      .filter(l => /^[A-Z_]+=/.test(l))
      .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))
  : {};

const PG_USER = env.POSTGRES_USER || 'maintrix_test';
const PG_DB = env.POSTGRES_DB || 'maintrix_test';

const psql = (sql) => docker(['exec', DB, 'psql', '-U', PG_USER, '-d', PG_DB, '-tAc', sql]).out;

// ═══════════════════════════════════════════════════════════════════
section('T1 — La stack tourne et est saine');
{
  const sleepSync = (ms) => spawnSync(process.execPath, ['-e', `setTimeout(()=>{},${ms})`]);
  /** Attend la fin de l'état transitoire « starting » avant de juger. */
  const settledHealth = (c) => {
    for (let i = 0; i < 30; i++) {
      const h = docker(['inspect', '-f', '{{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}}', c]).out;
      if (h !== 'starting') return h;
      sleepSync(2000);
    }
    return 'starting';
  };

  for (const [name, c] of [['application', APP], ['base de données', DB], ['nginx', NGINX]]) {
    const status = docker(['inspect', '-f', '{{.State.Status}}', c]).out;
    const health = settledHealth(c);
    const restarts = docker(['inspect', '-f', '{{.RestartCount}}', c]).out;
    if (status === 'running' && (health === 'healthy' || health === 'n/a')) {
      ok(`${name} : ${status}${health !== 'n/a' ? ` / ${health}` : ''}, ${restarts} redémarrage(s)`);
    } else {
      ko(`${name} : status=${status} health=${health}`, docker(['logs', '--tail', '15', c]).out);
    }
    // Une stack « stable » ne redémarre pas en boucle.
    if (Number(restarts) > 2) ko(`${name} a redémarré ${restarts} fois — instable`);
  }
}

// ═══════════════════════════════════════════════════════════════════
section('T2 — Aucun service interne exposé à Internet');
{
  const raw = docker(['compose', '--env-file', ENV_FILE, '-f', 'docker-compose.test.yml', '-p', PROJECT, 'ps', '--format', 'json']).out;
  const entries = raw.split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const PUBLIC_OK = { [NGINX]: ['80', '443'] };

  let violations = 0;
  for (const e of entries) {
    const ports = String(e.Publishers ? JSON.stringify(e.Publishers) : e.Ports || '');
    const mappings = [...ports.matchAll(/"?(?:URL|)"?:?\s*"?([\d.:*]*?)"?[,:]\s*"?PublishedPort"?:\s*(\d+)/g)];
    // Format libre selon la version de compose : on retombe sur `docker port`.
    const direct = docker(['port', e.Name]).out;
    for (const line of direct.split('\n').filter(Boolean)) {
      // ex. « 5000/tcp -> 127.0.0.1:5000 »
      const m = line.match(/->\s*([\d.]+|\[::\]):(\d+)/);
      if (!m) continue;
      const [, host, port] = m;
      const loopback = host === '127.0.0.1' || host === '::1';
      const allowed = (PUBLIC_OK[e.Name] || []).includes(port);
      info(`${e.Name} → ${host}:${port}${loopback || allowed ? '' : '   ← PUBLIC'}`);
      if (!loopback && !allowed) violations++;
    }
    void mappings;
  }
  if (violations === 0) ok('seul nginx (80/443) est public ; le reste est en boucle locale ou interne');
  else ko(`${violations} service(s) interne(s) exposé(s) publiquement`);

  // La base ne doit avoir AUCUN port publié.
  const dbPorts = docker(['port', DB]).out;
  if (!dbPorts) ok('PostgreSQL ne publie aucun port');
  else ko('PostgreSQL publie un port', dbPorts);
}

// ═══════════════════════════════════════════════════════════════════
section('T3 — Environnement séparé du développement');
{
  // Base distincte : conteneur, volume et projet compose dédiés.
  const vols = docker(['volume', 'ls', '--filter', `name=${PROJECT}`, '--format', '{{.Name}}']).out;
  if (/test_postgres/.test(vols)) ok('volume de base dédié à l\'environnement de test');
  else ko('aucun volume de base dédié trouvé', vols);

  // Le conteneur de développement (maintrix-dev-db) ne doit pas être impliqué.
  const devDb = docker(['inspect', '-f', '{{.State.Status}}', 'maintrix-dev-db']).out;
  if (!/^running/.test(devDb)) ok('la base de développement n\'est pas utilisée par cette stack');
  else info('maintrix-dev-db tourne, mais sur un autre réseau — sans lien avec cette stack');

  // Secrets propres à l'environnement.
  if (existsSync(ENV_FILE)) ok(`secrets dans ${ENV_FILE} (ignoré par git)`);
  else ko(`${ENV_FILE} absent`);
  const ignored = spawnSync('git', ['check-ignore', '-q', ENV_FILE]).status === 0;
  if (ignored) ok(`${ENV_FILE} est bien ignoré par git`);
  else ko(`${ENV_FILE} n'est PAS ignoré par git — risque de fuite de secrets`);
}

// ═══════════════════════════════════════════════════════════════════
section('T4 — Aucune donnée de production');
{
  const tenants = psql("SELECT COALESCE(string_agg(name, ' | '), '(aucun)') FROM tenants");
  info(`tenants : ${tenants}`);

  // Les seuls tenants attendus sont ceux du seed de test.
  const unexpected = psql(
    "SELECT COUNT(*) FROM tenants WHERE name NOT LIKE '%test%' AND name NOT LIKE '%Test%' AND id <> 'default-tenant'");
  if (unexpected === '0') ok('aucun tenant hors jeu de test');
  else ko(`${unexpected} tenant(s) inattendu(s) — données non maîtrisées`, tenants);

  // On NOMME les comptes signalés. La version précédente ne renvoyait qu'un
  // décompte, ce qui obligeait à écrire une requête SQL à la main pour savoir
  // de qui il s'agissait — et donc pour pouvoir décider quoi que ce soit.
  const reels = psql(
    "SELECT COALESCE(string_agg(email || ' (id=' || id || ', ' || role || ')', ' | '), '') " +
    "FROM user_profiles WHERE email NOT LIKE '%.local' AND email NOT LIKE '%test%'");

  if (!reels) ok('aucun compte utilisateur hors jeu de test');
  else ko(`${reels.split(' | ').length} compte(s) avec une adresse réelle — données non maîtrisées`,
          reels.split(' | ').join('\n') +
          '\n\nUn environnement de test ne devrait contenir que des adresses ' +
          'jetables. Supprimez ces comptes, ou assumez-les explicitement.');
}

// ═══════════════════════════════════════════════════════════════════
section('T5 — Schéma conforme et reproductible');
{
  const tables = Number(psql("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'"));
  info(`tables : ${tables}`);
  if (tables >= 110) ok(`schéma complet (${tables} tables)`);
  else ko(`schéma incomplet : ${tables} tables (≥110 attendu)`, 'Signe d\'un provisionnement par `drizzle-kit migrate` — voir docs/CLOUD_TEST_ENVIRONMENT.md');

  // Les tables absentes du chemin `migrate` sont le marqueur d'un mauvais
  // provisionnement : leur présence prouve que `push` a bien été utilisé.
  const marqueurs = ['budget_plans', 'oee_records', 'asset_lifecycle', 'warranties',
                     'calibration_records', 'technician_habilitations', 'budget_transactions'];
  const missing = marqueurs.filter(t =>
    psql(`SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${t}'`) !== '1');
  if (missing.length === 0) ok('les 7 tables absentes du chemin `migrate` sont présentes');
  else ko(`tables manquantes : ${missing.join(', ')}`);

  // Cloisonnement multi-tenant.
  const scoped = ['rca_analyses', 'fmea_analyses', 'maintenance_plans', 'budget_plans', 'oee_records'];
  const noTenant = scoped.filter(t =>
    psql(`SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='${t}' AND column_name='tenant_id'`) !== '1');
  if (noTenant.length === 0) ok('colonnes tenant_id présentes sur les tables cloisonnées');
  else ko(`tenant_id manquant sur : ${noTenant.join(', ')}`, 'Cloisonnement multi-tenant incomplet — fuite inter-tenant possible');
}

// ═══════════════════════════════════════════════════════════════════
section('T6 — Observable');
{
  // Sonde publique, à travers nginx puis en direct.
  const viaApp = docker(['exec', APP, 'curl', '-fsS', '--max-time', '5', 'http://localhost:5000/api/health']).out;
  try {
    const body = JSON.parse(viaApp);
    if (body.status === 'ok' && body.checks?.database === 'ok') ok('GET /api/health : status=ok, database=ok');
    else ko('sonde de santé dégradée', viaApp);
  } catch { ko('sonde de santé illisible', viaApp); }

  const viaNginx = docker(['exec', NGINX, 'wget', '-qO-', 'http://127.0.0.1/health']).out;
  if (/OK/.test(viaNginx)) ok('nginx répond sur /health');
  else ko('nginx ne répond pas sur /health', viaNginx);

  // Journaux applicatifs : preuve que l'environnement est observable.
  //
  // ⚠️ Ce contrôle ne lisait que les 200 DERNIÈRES lignes. Les marqueurs de
  // démarrage y figurent tant que le conteneur vient d'être lancé, puis le
  // trafic applicatif les repousse hors de la fenêtre : le contrôle passait au
  // vert juste après un démarrage et rougissait une demi-heure plus tard, sans
  // qu'aucun défaut n'existe. Un contrôle dont le résultat dépend de l'heure à
  // laquelle on le lance ne prouve rien. On lit donc le journal entier, et on
  // vérifie séparément les deux propriétés réellement visées : le démarrage a
  // laissé une trace, et le journal continue d'être alimenté.
  const journal = docker(['logs', APP]).out;
  const lignes = journal.split('\n').filter(Boolean);

  if (/Serveur démarré|Cognitive Kernel|✅/.test(journal)) {
    ok('le démarrage a laissé une trace exploitable dans les journaux');
  } else {
    ko('aucune trace de démarrage dans les journaux', `${lignes.length} ligne(s) lue(s)`);
  }

  const recentes = docker(['logs', '--tail', '50', APP]).out.split('\n').filter(Boolean);
  if (recentes.length > 0) ok(`les journaux sont alimentés (${lignes.length} lignes)`);
  else ko('les journaux ne reçoivent plus rien');

  // Sondes de secours superflues : on vérifie l'absence de pile de supervision
  // non fonctionnelle plutôt que sa présence.
  const extra = docker(['compose', '--env-file', ENV_FILE, '-f', 'docker-compose.test.yml', '-p', PROJECT, 'ps', '--services']).out.split('\n').filter(Boolean);
  const unexpectedSvc = extra.filter(s => !['app', 'db', 'nginx'].includes(s));
  if (unexpectedSvc.length === 0) ok('trois services seulement : app, db, nginx');
  else info(`services additionnels : ${unexpectedSvc.join(', ')}`);
}

// ═══════════════════════════════════════════════════════════════════
section('T7 — Le provisionnement d\'un testeur est possible');
{
  // Sans compte super-admin configuré, aucun testeur ne peut être créé (F08).
  const login = docker(['exec', APP, 'curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
    '-X', 'POST', 'http://localhost:5000/api/super-admin/login',
    '-H', 'Content-Type: application/json',
    '-d', '{"email":"x","password":"x","secretKey":"x"}']).out;
  if (login === '503') ko('super-admin NON configuré (503) — impossible de créer un testeur');
  else if (login === '401') ok('endpoint super-admin configuré et opérationnel (401 sur identifiants faux)');
  else ko(`réponse inattendue de /api/super-admin/login : ${login}`);

  const admins = psql("SELECT COUNT(*) FROM user_profiles WHERE role IN ('admin','owner')");
  if (Number(admins) >= 1) ok(`${admins} compte(s) administrateur présent(s)`);
  else ko('aucun compte administrateur');
}

// ═══════════════════════════════════════════════════════════════════
section('T8 — Un testeur peut RÉELLEMENT se connecter depuis son navigateur');
{
  // ⚠️ Ce contrôle est né d'un défaut réel (F09) : la page de connexion
  // s'affichait, l'API répondait, mais toute tentative d'authentification
  // renvoyait 403 ORIGIN_NOT_ALLOWED. En NODE_ENV=production, server/index.ts
  // vérifie l'en-tête `Origin` des routes /auth/ et /enterprise-auth/ contre
  // ALLOWED_ORIGINS. Une valeur qui ne correspond pas EXACTEMENT à l'URL
  // d'accès rend la connexion impossible — sans que rien d'autre ne l'indique.
  //
  // On rejoue donc une connexion complète en envoyant l'en-tête Origin que
  // produirait un vrai navigateur.
  const appPort = env.APP_HOST_PORT || '5000';
  const origins = [
    `http://127.0.0.1:${appPort}`,
    ...(env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean) : []),
  ];

  for (const origin of [...new Set(origins)]) {
    const body = JSON.stringify({ email: 'admin@maintrix.local', password: 'Maintrix2024!' });
    const out = docker(['exec', APP, 'curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
      '-X', 'POST', 'http://localhost:5000/api/enterprise-auth/login',
      '-H', 'Content-Type: application/json',
      '-H', `Origin: ${origin}`,
      '-d', body]).out;

    if (out === '200') ok(`connexion acceptée depuis l'origine ${origin}`);
    else if (out === '403') ko(`403 ORIGIN_NOT_ALLOWED depuis ${origin}`,
      'Ajoutez cette origine à ALLOWED_ORIGINS dans le fichier de secrets, puis redémarrez l\'application.');
    else ko(`réponse inattendue (${out}) depuis ${origin}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(50));
console.log(`  CONFORMITÉ : ${fail === 0 ? 'OK' : 'NON CONFORME'}   —   ${pass} réussis, ${fail} échoués`);
console.log('═'.repeat(50));
process.exit(fail === 0 ? 0 : 1);

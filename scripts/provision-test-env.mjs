#!/usr/bin/env node
/**
 * Provisionnement de l'environnement de TEST pour testeurs externes — F08.
 *
 *   node scripts/provision-test-env.mjs            # monte l'environnement
 *   node scripts/provision-test-env.mjs --down     # l'arrête (volumes et données CONSERVÉS)
 *
 * ⚠️ Aucune option ne supprime de volume. Les données des testeurs doivent
 * survivre jusqu'en production : voir scripts/deploy-ovh.sh.
 *
 * Une seule commande, de zéro à un environnement vérifié :
 *
 *   1. fichier de secrets généré s'il manque (jamais versionné)
 *   2. certificat TLS auto-signé généré si `ssl/` est vide
 *   3. volumes permanents créés s'ils n'existent pas (jamais recréés)
 *   4. image construite, base démarrée
 *   5. schéma appliqué depuis shared/schema.ts — sur une base existante,
 *      seulement après restauration vérifiée (MAINTRIX_SCHEMA_VERIFIE)
 *   6. comptes de démonstration retirés
 *   7. compte de sonde des contrôles créé ou aligné
 *   8. application et nginx démarrés, environnement vérifié
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI `push` ET NON `migrate`
 * ═══════════════════════════════════════════════════════════════════
 * `drizzle-kit migrate` produit un schéma FAUX sur ce dépôt : le journal
 * (migrations/meta/_journal.json) s'arrête à 0010 alors que 20 fichiers SQL
 * existent. Mesuré sur base vierge : 7 tables absentes (budget_plans,
 * budget_transactions, oee_records, asset_lifecycle, calibration_records,
 * warranties, technician_habilitations) et 10 colonnes `tenant_id` manquantes,
 * y compris sur des tables présentes (rca_analyses, fmea_analyses,
 * maintenance_plans) — c'est-à-dire SANS cloisonnement multi-tenant.
 *
 * `drizzle-kit push` dérive le schéma de shared/schema.ts, seule source de
 * vérité utilisée par l'application. C'est la méthode retenue, et
 * scripts/verify-test-environment.mjs vérifie que le résultat est conforme.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const ENV_FILE = process.env.MAINTRIX_TEST_ENV_FILE || '.env.test-cloud';
const COMPOSE = ['compose', '--env-file', ENV_FILE, '-f', 'docker-compose.test.yml', '-p', 'maintrix-test'];
const APP = 'maintrix-test-app';
const DB = 'maintrix-test-db';

const args = process.argv.slice(2);
const wantDown = args.includes('--down');
const wantReset = args.includes('--reset');

/**
 * Adresse publique par laquelle les testeurs accéderont — F12.
 *
 *   node scripts/provision-test-env.mjs --public-url=https://maintrix-test.exemple.fr
 *
 * Sans elle, `ALLOWED_ORIGINS` ne contient que des origines locales, et TOUTE
 * tentative de connexion depuis une autre adresse échoue en 403
 * ORIGIN_NOT_ALLOWED — la page s'affiche, l'API répond, seule l'authentification
 * est refusée. Reproduit sur l'adresse LAN de la machine avant correction.
 *
 * Un simple avertissement ne suffisait pas : le jour de l'ouverture, l'oubli
 * passe. L'adresse devient donc une entrée explicite, et
 * `scripts/verify-opening.mjs` refuse de déclarer l'environnement ouvrable tant
 * qu'elle n'est pas déclarée ET vérifiée.
 */
const publicUrlArg = args.find(a => a.startsWith('--public-url='));
const PUBLIC_URL = (publicUrlArg ? publicUrlArg.slice('--public-url='.length) : process.env.MAINTRIX_PUBLIC_URL || '').trim().replace(/\/+$/, '');

if (PUBLIC_URL && !/^https?:\/\/[^\/\s]+$/.test(PUBLIC_URL)) {
  console.error(`⛔ --public-url invalide : ${PUBLIC_URL}`);
  console.error('   Attendu : une origine seule, sans chemin — ex. https://maintrix-test.exemple.fr');
  process.exit(2);
}

const step = (m) => console.log(`\n▶ ${m}`);
const ok = (m) => console.log(`   ✓ ${m}`);
const warn = (m) => console.log(`   ⚠ ${m}`);
const die = (m, detail) => {
  console.error(`\n⛔ ${m}`);
  if (detail) console.error(String(detail).split('\n').slice(-25).join('\n'));
  process.exit(1);
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function sh(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf8', ...opts });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

function docker(a, opts) { return sh('docker', a, opts); }

// ═══════════════════════════════════════════════════════════════════
if (wantReset) {
  // L'ancienne option détruisait conteneurs ET volumes (`down -v`). Les données
  // des testeurs devant être conservées jusqu'en production, elle n'existe plus.
  console.error('\n⛔ --reset est supprimé : il effaçait les volumes, donc les données des testeurs.');
  console.error('   Repartir de zéro reste possible, mais seulement à la main et en connaissance de cause :');
  console.error('   sauvegarde (scripts/sauvegarde-chiffree.sh), puis suppression explicite des volumes.');
  process.exit(2);
}
if (wantDown) {
  step('Arrêt de l\'environnement de test');
  // Jamais `-v` : les volumes sont conservés. Ils sont de toute façon déclarés
  // `external`, que docker compose ne supprime pas.
  const r = docker([...COMPOSE, 'down', '--remove-orphans']);
  console.log(r.out.split('\n').slice(-8).join('\n'));
  ok('conteneurs et réseau arrêtés — volumes et données conservés');
  process.exit(0);
}

// ── 0. Prérequis ────────────────────────────────────────────────────
step('Prérequis');
if (docker(['info', '--format', '{{.ServerVersion}}']).code !== 0) {
  die('Démon Docker injoignable. Démarrez Docker puis relancez.');
}
ok('Docker joignable');

// ── 1. Secrets ──────────────────────────────────────────────────────
step('Secrets de l\'environnement');
if (!existsSync(ENV_FILE)) {
  const g = sh('bash', ['scripts/generate-docker-env.sh', ENV_FILE], { shell: true });
  if (g.code !== 0) die(`Génération de ${ENV_FILE} échouée`, g.out);

  // Le générateur produit `maintrix_db` / `maintrix_user`, valables pour un
  // déploiement générique. Ici la base doit être NOMMÉE pour ce qu'elle est :
  // tests/seed.ts refuse de charger des données dans une base dont le nom ne
  // contient pas « test » — garde-fou contre un seed accidentel ailleurs.
  {
    const { readFileSync, writeFileSync } = await import('node:fs');
    const txt = readFileSync(ENV_FILE, 'utf8')
      .replace(/^POSTGRES_DB=.*$/m, 'POSTGRES_DB=maintrix_test')
      .replace(/^POSTGRES_USER=.*$/m, 'POSTGRES_USER=maintrix_test');
    writeFileSync(ENV_FILE, txt);
  }
  ok(`${ENV_FILE} généré (base « maintrix_test », permissions 600, ignoré par git)`);
} else {
  ok(`${ENV_FILE} déjà présent — réutilisé`);
}

// Le compte super-admin n'est pas produit par generate-docker-env.sh : sans
// lui, aucun testeur ne peut être provisionné (F08).
{
  const { readFileSync, appendFileSync } = await import('node:fs');
  const content = readFileSync(ENV_FILE, 'utf8');
  if (!/^SUPER_ADMIN_EMAIL=/m.test(content)) {
    const { createRequire } = await import('node:module');
    const bcrypt = createRequire(import.meta.url)('bcrypt');
    const crypto = await import('node:crypto');
    const password = crypto.randomBytes(18).toString('base64url');
    const hash = bcrypt.hashSync(password, 10);
    const secret = crypto.randomBytes(32).toString('hex');
    // ⚠️ Un hash bcrypt commence par `$2b$10$…`. Docker Compose interprète `$`
    // comme une référence de variable dans un `--env-file` : sans échappement,
    // `$2b`, `$10` et la suite sont remplacés par du vide, le hash arrive
    // tronqué au conteneur, et l'authentification super-admin devient
    // impossible. `$$` produit un `$` littéral.
    // (Piège déjà documenté dans .env.docker.example en phase F03.)
    const escaped = hash.replace(/\$/g, '$$$$');
    appendFileSync(ENV_FILE,
      `\n# Compte super-admin — provisionnement des testeurs (F08)\n` +
      `# Le hash est échappé pour Docker Compose : chaque $ y est doublé.\n` +
      `SUPER_ADMIN_EMAIL=superadmin@maintrix.test\n` +
      `SUPER_ADMIN_PASSWORD_HASH=${escaped}\n` +
      `SUPER_ADMIN_SECRET=${secret}\n` +
      `# Mot de passe en clair, conservé ici pour l'exploitant de l'environnement.\n` +
      `# Ce fichier n'est jamais versionné.\n` +
      `SUPER_ADMIN_PASSWORD=${password}\n`);
    ok('compte super-admin généré');
    warn(`mot de passe super-admin écrit dans ${ENV_FILE} — ne le partagez pas`);
  } else {
    ok('compte super-admin déjà configuré');
  }
}

// ── 1b. Ports de l'hôte ─────────────────────────────────────────────
step('Ports de l\'hôte');
{
  const { readFileSync, appendFileSync, writeFileSync } = await import('node:fs');
  const net = await import('node:net');

  // Ports déjà publiés par d'AUTRES conteneurs Docker sur cet hôte. Un simple
  // test de socket ne suffit pas : sous Docker Desktop, un port tenu par le
  // proxy Docker peut paraître libre à Node et refuser malgré tout la liaison.
  const dockerPorts = new Set(
    (sh('docker', ['ps', '--format', '{{.Ports}}']).out.match(/:(\d+)->/g) || [])
      .map(m => m.replace(/[^\d]/g, '')),
  );

  /** Le port est-il réellement disponible sur l'hôte ? */
  const isFree = async (port) => {
    if (dockerPorts.has(String(port))) return false;
    return new Promise((resolve) => {
      const srv = net.createServer();
      srv.once('error', () => resolve(false));
      srv.once('listening', () => srv.close(() => resolve(true)));
      srv.listen(port, '0.0.0.0');
    });
  };
  const anyFree = () => new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
  });

  const content = readFileSync(ENV_FILE, 'utf8');
  const lines = [];
  // Ports SOUHAITÉS : sur un hôte cloud dédié, 80/443 sont libres et c'est ce
  // qu'on veut. Sur une machine de développement partagée, ils sont souvent
  // pris — on bascule alors sur un port libre plutôt que d'échouer.
  for (const [key, preferred] of [['HTTP_PORT', 80], ['HTTPS_PORT', 443], ['APP_HOST_PORT', 5000]]) {
    if (new RegExp(`^${key}=`, 'm').test(content)) continue;
    const port = (await isFree(preferred)) ? preferred : await anyFree();
    lines.push(`${key}=${port}`);
    if (port === preferred) ok(`${key}=${port}`);
    else warn(`${key}=${port} — le port ${preferred} est déjà occupé sur cet hôte`);
  }
  if (lines.length) {
    appendFileSync(ENV_FILE, `\n# Ports de l'hôte, choisis au provisionnement\n${lines.join('\n')}\n`);
  } else {
    ok('ports déjà fixés dans le fichier de secrets');
  }

  // ── Origines autorisées ───────────────────────────────────────────
  // ⚠️ CRITIQUE. En NODE_ENV=production, server/index.ts refuse toute requête
  // vers /auth/ ou /enterprise-auth/ dont l'en-tête Origin n'est pas listé :
  //   403 ORIGIN_NOT_ALLOWED
  // Autrement dit, si ALLOWED_ORIGINS ne correspond pas EXACTEMENT à l'URL par
  // laquelle on accède, PERSONNE NE PEUT SE CONNECTER — l'API répond, la page
  // s'affiche, seule l'authentification échoue. Constaté en phase F09 en
  // ouvrant réellement un navigateur : la valeur par défaut `https://localhost`
  // ne correspondait à aucun des points d'accès réels.
  const current = readFileSync(ENV_FILE, 'utf8');
  if (!/^ALLOWED_ORIGINS=/m.test(current)) {
    const get = (k, d) => (current.match(new RegExp(`^${k}=(.*)$`, 'm')) || [, d])[1];
    const httpPort = get('HTTP_PORT', '80');
    const httpsPort = get('HTTPS_PORT', '443');
    const appPort = get('APP_HOST_PORT', '5000');

    const origins = [
      `http://127.0.0.1:${appPort}`,          // diagnostic en boucle locale
      `http://localhost:${appPort}`,
      httpsPort === '443' ? 'https://localhost' : `https://localhost:${httpsPort}`,
      httpPort === '80' ? 'http://localhost' : `http://localhost:${httpPort}`,
    ];
    // L'adresse publique passe EN PREMIER : `FRONTEND_URL` en découle, et c'est
    // elle que l'application utilise pour fabriquer les liens envoyés aux
    // testeurs. Pointer sur `localhost` produirait des liens inutilisables.
    if (PUBLIC_URL) origins.unshift(PUBLIC_URL);

    appendFileSync(ENV_FILE,
      `\n# Origines autorisées pour l'authentification.\n` +
      `# ⚠️ Le domaine public réel DOIT y figurer avant d'ouvrir aux testeurs,\n` +
      `#    sinon 403 ORIGIN_NOT_ALLOWED à chaque tentative de connexion.\n` +
      `#    Pour l'ajouter : --public-url=https://… (relançable à tout moment)\n` +
      `ALLOWED_ORIGINS=${origins.join(',')}\n` +
      `FRONTEND_URL=${PUBLIC_URL || origins.find(o => o.startsWith('https://')) || origins[0]}\n`);
    ok(`origines autorisées : ${origins.join(', ')}`);
    if (PUBLIC_URL) ok(`adresse publique déclarée : ${PUBLIC_URL}`);
    else warn('aucune adresse publique déclarée — inutilisable par des testeurs distants');
  } else if (PUBLIC_URL) {
    // Environnement déjà provisionné : on ajoute l'adresse sans repartir de
    // zéro. Détruire et reconstruire pour ajouter une origine ferait perdre les
    // comptes testeurs déjà créés.
    const ligne = current.match(/^ALLOWED_ORIGINS=(.*)$/m);
    const existantes = (ligne?.[1] || '').split(',').map(s => s.trim()).filter(Boolean);

    if (existantes.includes(PUBLIC_URL)) {
      ok(`adresse publique déjà autorisée : ${PUBLIC_URL}`);
    } else {
      const maj = current
        .replace(/^ALLOWED_ORIGINS=.*$/m, `ALLOWED_ORIGINS=${[PUBLIC_URL, ...existantes].join(',')}`)
        .replace(/^FRONTEND_URL=.*$/m, `FRONTEND_URL=${PUBLIC_URL}`);
      writeFileSync(ENV_FILE, maj);
      ok(`adresse publique ajoutée aux origines : ${PUBLIC_URL}`);
      warn('redémarrez l\'application pour qu\'elle prenne effet : docker compose … up -d app');
    }
  } else {
    ok('origines autorisées déjà définies');
    const ligne = current.match(/^ALLOWED_ORIGINS=(.*)$/m)?.[1] || '';
    const distante = ligne.split(',').some(o => !/localhost|127\.0\.0\.1/.test(o));
    if (!distante) warn('aucune origine distante — les testeurs externes ne pourront pas se connecter');
  }
}

// ── 2. Certificat TLS ───────────────────────────────────────────────
step('Certificat TLS');
{
  const crt = join('ssl', 'maintrix.crt');
  const key = join('ssl', 'maintrix.key');
  if (!existsSync('ssl')) mkdirSync('ssl');
  const sslEmpty = !existsSync(crt) || !existsSync(key);
  if (sslEmpty) {
    // Le bloc 443 de nginx/conf.d/maintrix.conf référence ces deux fichiers ;
    // sans eux nginx refuse de démarrer. Le répertoire ssl/ du dépôt est vide.
    const gen = docker(['run', '--rm', '-v', `${process.cwd()}/ssl:/ssl`, 'alpine/openssl',
      'req', '-x509', '-nodes', '-newkey', 'rsa:2048', '-days', '365',
      '-keyout', '/ssl/maintrix.key', '-out', '/ssl/maintrix.crt',
      '-subj', '/CN=maintrix-test']);
    if (gen.code !== 0) die('Génération du certificat auto-signé échouée', gen.out);
    ok('certificat auto-signé généré (365 jours)');
    warn('AUTO-SIGNÉ : les navigateurs afficheront un avertissement.');
    warn('Remplacez-le par un certificat réel avant d\'ouvrir aux testeurs.');
  } else {
    ok('certificat déjà présent');
  }
}

// ── 3. Volumes permanents ───────────────────────────────────────────
step('Volumes permanents');
{
  // Noms figés dans docker-compose.test.yml (`external: true`). Docker compose
  // ne les crée ni ne les supprime : c'est fait ici, une seule fois.
  const VOLUMES = ['maintrix-test_test_postgres', 'maintrix-test_test_uploads', 'maintrix-test_test_logs'];
  const baseExistante = docker(['inspect', DB]).code === 0;
  for (const v of VOLUMES) {
    if (docker(['volume', 'inspect', v]).code === 0) { ok(`${v} présent`); continue; }
    if (v.endsWith('_postgres') && baseExistante) {
      // Créer ici un volume vide masquerait la base réelle derrière une base
      // neuve : les testeurs se retrouveraient devant une application vide.
      die(`Le volume ${v} est introuvable alors qu'une base ${DB} existe déjà.`,
        'Refus de créer une base vide à sa place.\n' +
        `Volume réellement utilisé : docker inspect ${DB} --format '{{range .Mounts}}{{.Name}} {{end}}'`);
    }
    const c = docker(['volume', 'create', '--label', 'maintrix.permanent=oui', v]);
    if (c.code !== 0) die(`Création du volume ${v} impossible`, c.out);
    ok(`${v} créé (première installation)`);
  }
}

// ── 4. Image et base ────────────────────────────────────────────────
step('Construction de l\'image applicative (peut prendre plusieurs minutes)');
{
  const b = docker([...COMPOSE, 'build', 'app']);
  if (b.code !== 0) die('Construction de l\'image échouée', b.out.split('\n').slice(-25).join('\n'));
  ok('image construite');
}

step('Démarrage de la base');
{
  const u = docker([...COMPOSE, 'up', '-d', 'db']);
  if (u.code !== 0) die('Démarrage de la base échoué', u.out);
  let saine = false;
  for (let i = 0; i < 60; i++) {
    if (docker(['inspect', '-f', '{{.State.Health.Status}}', DB]).out === 'healthy') { saine = true; break; }
    await sleep(2000);
  }
  if (!saine) die('La base ne devient pas saine', docker(['logs', '--tail', '30', DB]).out);
  ok('base saine');
}

// ── 5. Schéma ───────────────────────────────────────────────────────
step('Application du schéma (drizzle-kit depuis shared/schema.ts)');
{
  const { readFileSync } = await import('node:fs');
  const env = Object.fromEntries(
    readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)
      .filter(l => /^[A-Z_]+=/.test(l))
      .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
  const PGU = env.POSTGRES_USER || 'maintrix_test';
  const PGD = env.POSTGRES_DB || 'maintrix_test';

  // ⚠️ GARDE-FOU DES DONNÉES. `drizzle-kit push --force` accepte sans
  // confirmation la suppression de colonnes et de tables. Mesuré : une colonne
  // retirée du schéma disparaît avec ses données. Sur une base qui contient
  // déjà des tables, le schéma n'est donc appliqué que si une restauration
  // vérifiée l'a appliqué AVANT sur une copie, pour ce même commit, sans rien
  // perdre (scripts/restauration-verifiee.sh, appelé par deploy-ovh.sh).
  const tablesAvant = Number(docker(['exec', DB, 'psql', '-U', PGU, '-d', PGD, '-tAc',
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'"]).out) || 0;

  if (tablesAvant > 0) {
    const attestation = process.env.MAINTRIX_SCHEMA_VERIFIE;
    const commit = sh('git', ['rev-parse', '--short', 'HEAD']).out;
    if (!attestation || !existsSync(attestation)) {
      die(`Base existante (${tablesAvant} tables) : mise à jour du schéma REFUSÉE sans restauration vérifiée.`,
        'Passez par la procédure complète :\n  sudo bash scripts/deploy-ovh.sh <domaine> <courriel>\n' +
        '(sauvegarde chiffrée, puis schéma éprouvé sur une copie restaurée dans une base isolée).');
    }
    const contenu = readFileSync(attestation, 'utf8');
    if (!contenu.includes(`commit=${commit}`)) {
      die('La restauration vérifiée porte sur un autre commit que celui en cours de déploiement.', contenu);
    }
    ok(`restauration vérifiée pour le commit ${commit} — schéma déjà éprouvé sur une copie, sans perte`);
  } else {
    ok('base vide — première installation');
  }

  const netInspect = docker(['network', 'ls', '--filter', 'name=maintrix-test', '--format', '{{.Name}}']).out.split('\n')[0];
  const drizzle = join('node_modules', '.bin', process.platform === 'win32' ? 'drizzle-kit.cmd' : 'drizzle-kit');

  // Accès temporaire à la base, sur la boucle locale, le temps du push.
  const net2 = await import('node:net');
  const dockerBusy = new Set(
    (sh('docker', ['ps', '--format', '{{.Ports}}']).out.match(/:(\d+)->/g) || [])
      .map(m => m.replace(/[^\d]/g, '')),
  );
  const tmpPort = await new Promise((resolve) => {
    const srv = net2.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close(() => resolve(dockerBusy.has(String(p)) ? p + 1 : p));
    });
  });
  docker(['rm', '-f', 'maintrix-test-dbproxy']);
  const proxy = docker(['run', '-d', '--rm', '--name', 'maintrix-test-dbproxy',
    '--network', netInspect || 'maintrix-test_maintrix-test',
    '-p', `127.0.0.1:${tmpPort}:${tmpPort}`,
    'alpine/socat', `TCP-LISTEN:${tmpPort},fork,reuseaddr`, 'TCP:db:5432']);
  if (proxy.code !== 0) die('Impossible d\'ouvrir un accès temporaire à la base', proxy.out);
  await sleep(2000);

  try {
    const url = `postgresql://${PGU}:${env.POSTGRES_PASSWORD}@127.0.0.1:${tmpPort}/${PGD}`;
    const r = spawnSync(drizzle, ['push', '--force'], {
      encoding: 'utf8', shell: process.platform === 'win32',
      env: { ...process.env, DATABASE_URL: url, NODE_ENV: 'production' },
    });
    const sortie = `${r.stdout || ''}${r.stderr || ''}`;
    // drizzle-kit peut échouer en renvoyant 0 (mesuré) : on lit aussi sa sortie.
    if ((r.status ?? 1) !== 0 || /^Error:|Interactive prompts require a TTY|\[✗\]/m.test(sortie)) {
      die('drizzle-kit push a échoué', sortie);
    }
  } finally {
    docker(['rm', '-f', 'maintrix-test-dbproxy']);
  }

  const tables = docker(['exec', DB, 'psql', '-U', PGU, '-d', PGD, '-tAc',
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'"]).out;
  ok(`schéma à jour — ${tables} tables`);

  // ── 6. Comptes de démonstration retirés ─────────────────────────
  // Leur mot de passe commun figure dans la documentation d'un dépôt public.
  // Dans une base dont les données iront en production, ce sont des portes
  // ouvertes. Ils restent disponibles pour les tests automatisés, qui tournent
  // sur une base jetable (tests/seed.ts). Si un compte est référencé par des
  // données, il est désactivé et anonymisé plutôt que supprimé : on ne casse
  // pas les enregistrements qui le citent.
  step('Retrait des comptes de démonstration');
  {
    const retrait = spawnSync('docker', ['exec', '-i', DB, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', PGU, '-d', PGD], {
      encoding: 'utf8',
      input: `
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, email FROM user_profiles
           WHERE email IN ('admin@maintrix.local', 'tech@maintrix.local', 'admin-beta@maintrix.local') LOOP
    BEGIN
      DELETE FROM user_sessions WHERE user_id = r.id;
      DELETE FROM user_profiles WHERE id = r.id;
      RAISE NOTICE 'supprime : %', r.email;
    EXCEPTION WHEN foreign_key_violation THEN
      DELETE FROM user_sessions WHERE user_id = r.id;
      UPDATE user_profiles
         SET is_active = false, password = '!compte-retire',
             email = 'retire-' || r.id || '@demo.test.local', username = 'retire-' || r.id
       WHERE id = r.id;
      RAISE NOTICE 'desactive et anonymise (reference par des donnees) : %', r.email;
    END;
  END LOOP;
END $$;`,
    });
    if ((retrait.status ?? 1) !== 0) die('Retrait des comptes de démonstration échoué', `${retrait.stdout}${retrait.stderr}`);
    const notes = (retrait.stderr || '').split('\n').filter(l => /NOTICE/.test(l)).map(l => l.replace(/^.*NOTICE:\s*/, ''));
    if (notes.length) notes.forEach(n => ok(n));
    else ok('aucun compte de démonstration présent');
  }

  // ── 7. Compte de sonde ─────────────────────────────────────────
  // Les contrôles automatiques doivent se connecter pour vérifier que les
  // testeurs le peuvent. Ils utilisent un compte DÉDIÉ : technicien, dans un
  // locataire vide qui lui est propre, mot de passe tiré au hasard et gardé
  // dans le fichier de secrets du serveur. Il ne voit aucune donnée de testeur.
  step('Compte de sonde des contrôles automatiques');
  {
    const { appendFileSync, readFileSync: relire } = await import('node:fs');
    if (!/^SONDE_PASSWORD=/m.test(relire(ENV_FILE, 'utf8'))) {
      const crypto = await import('node:crypto');
      appendFileSync(ENV_FILE,
        '\n# Compte de sonde des contrôles de déploiement (jamais un compte de testeur)\n' +
        'SONDE_EMAIL=sonde-deploiement@maintrix.local\n' +
        `SONDE_PASSWORD=${crypto.randomBytes(24).toString('base64url')}\n`);
      ok(`identifiants de sonde générés dans ${ENV_FILE}`);
    }
    const envSonde = Object.fromEntries(relire(ENV_FILE, 'utf8').split(/\r?\n/)
      .filter(l => /^SONDE_/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

    const { createRequire } = await import('node:module');
    const bcrypt = createRequire(import.meta.url)('bcrypt');
    const hash = bcrypt.hashSync(envSonde.SONDE_PASSWORD, 10);

    const sonde = spawnSync('docker', ['exec', '-i', DB, 'psql', '-v', 'ON_ERROR_STOP=1',
      '-v', `hash=${hash}`, '-v', `email=${envSonde.SONDE_EMAIL}`, '-U', PGU, '-d', PGD], {
      encoding: 'utf8',
      input: `
INSERT INTO tenants (id, name, domain, plan, is_active, max_users, contact_email, trial_start_date, trial_end_date, license_status)
SELECT 'sonde-deploiement', 'Sonde de déploiement (tests)', 'sonde.test.local', 'free', true, 1,
       'sonde@sonde.test.local', NOW(), NOW() + INTERVAL '3650 days', 'trial'
WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE id = 'sonde-deploiement');

UPDATE user_profiles
   SET password = :'hash', is_active = true, must_change_password = false, is_default_credentials = false,
       mfa_enabled = false, failed_login_attempts = 0, account_locked_until = NULL, password_expires_at = NULL,
       tenant_id = 'sonde-deploiement', role = 'technician'
 WHERE email = :'email';

INSERT INTO user_profiles (tenant_id, username, email, password, first_name, last_name, role,
                           is_active, must_change_password, is_default_credentials, mfa_enabled)
SELECT 'sonde-deploiement', 'sonde-deploiement', :'email', :'hash', 'Sonde', 'Déploiement', 'technician',
       true, false, false, false
WHERE NOT EXISTS (SELECT 1 FROM user_profiles WHERE email = :'email');`,
    });
    if ((sonde.status ?? 1) !== 0) die('Création du compte de sonde échouée', `${sonde.stdout}${sonde.stderr}`);
    ok(`compte de sonde prêt : ${envSonde.SONDE_EMAIL} (technicien, locataire isolé)`);
  }
}

// ── 8. Application et nginx ─────────────────────────────────────────
// Démarrés APRÈS le schéma : la nouvelle version ne tourne jamais sur l'ancien.
step('Démarrage de l\'application et de nginx');
{
  const up = docker([...COMPOSE, 'up', '-d', '--no-build', 'app', 'nginx']);
  if (up.code !== 0) die('docker compose up a échoué', up.out);
  let healthy = false;
  for (let i = 0; i < 150; i++) {
    const h = docker(['inspect', '-f', '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}', APP]).out;
    const state = docker(['inspect', '-f', '{{.State.Status}}', APP]).out;
    if (/^restarting|^exited/.test(state)) die('Le conteneur applicatif ne démarre pas', docker(['logs', '--tail', '30', APP]).out);
    if (h === 'healthy') { healthy = true; break; }
    await sleep(2000);
  }
  if (!healthy) die('L\'application n\'est jamais devenue saine', docker(['logs', '--tail', '30', APP]).out);
  ok('application saine');
}

// ── 6. Vérification ─────────────────────────────────────────────────
step('Vérification de conformité de l\'environnement');
{
  const v = spawnSync(process.execPath, ['scripts/verify-test-environment.mjs'], { stdio: 'inherit' });
  if ((v.status ?? 1) !== 0) {
    console.error('\n⛔ L\'environnement est monté mais NON CONFORME — voir ci-dessus.');
    process.exit(1);
  }
}

// ── 7. Accès ────────────────────────────────────────────────────────
const { readFileSync } = await import('node:fs');
const envTxt = readFileSync(ENV_FILE, 'utf8');
const pick = (k) => (envTxt.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1] || '(non défini)';

console.log(`
╔════════════════════════════════════════════════════════════════╗
║  ENVIRONNEMENT DE TEST MAINTRIX — PRÊT                         ║
╚════════════════════════════════════════════════════════════════╝

  Accès testeurs   https://<hôte>:${pick('HTTPS_PORT')}/      (nginx — seul point d'entrée public)
  Diagnostic local http://127.0.0.1:${pick('APP_HOST_PORT')}/api/health

  Super-admin      ${pick('SUPER_ADMIN_EMAIL')}
                   mot de passe et clé secrète dans ${ENV_FILE}

  Provisionner un testeur :  docs/TESTER_ONBOARDING.md
  Journaux         docker compose -f docker-compose.test.yml -p maintrix-test logs -f app
  Arrêter          node scripts/provision-test-env.mjs --down   (données conservées)
`);

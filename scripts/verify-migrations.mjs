#!/usr/bin/env node
/**
 * Le chemin `drizzle-kit migrate` produit-il le MÊME schéma que `push` ? — F11.
 *
 *   node scripts/verify-migrations.mjs
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CETTE BARRIÈRE EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * `migrations/meta/_journal.json` ne listait que 11 des 20 migrations : il
 * s'arrêtait à `0010_platform_edition`. Les migrations `0011`→`0019` existaient
 * bien sur le disque mais étaient INCONNUES de drizzle.
 *
 * Or ce sont précisément celles du cloisonnement par locataire. Un déploiement
 * fondé sur `drizzle-kit migrate` produisait donc une base à laquelle il
 * manquait des tables et des colonnes `tenant_id` — sans la moindre erreur :
 * la commande se terminait avec succès.
 *
 * Les tests contournaient le problème en utilisant `push`, qui part du schéma
 * TypeScript. Le défaut restait donc invisible tant qu'on ne déployait pas.
 *
 * Cette barrière construit deux bases neuves — l'une par `migrate`, l'autre par
 * `push` — et compare ce qu'on obtient réellement. Elle échoue à la moindre
 * divergence.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI ELLE A DEUX VOIES DE MESURE
 * ═══════════════════════════════════════════════════════════════════
 * Première version : deux conteneurs Docker. Or Docker n'est pas démarré sur
 * les postes de développement de ce projet — la barrière refusait donc de
 * partir, et personne ne la lançait.
 *
 * Ce que cela a coûté, mesuré le 2026-10-25 : `drizzle-kit migrate` était cassé
 * sur `main` — exit 1, ZÉRO table créée, pour TOUTES les migrations — parce
 * qu'un commentaire de `0022_company_config_tenant_scoped.sql` citait en prose
 * le marqueur de coupure d'instruction de drizzle, et que le découpeur de
 * drizzle coupe sur cette chaîne partout où elle apparaît, commentaires
 * compris. Trois chemins restaient verts (`psql -f` applique le fichier sans
 * broncher, `push` ne lit jamais ces fichiers, les tests utilisent `push`) :
 * seule la voie de déploiement était rouge. La barrière qui l'aurait vu
 * existait — elle était simplement inatteignable.
 *
 * D'où la voie de repli : une grappe PostgreSQL jetable montée avec les
 * binaires locaux (`initdb`/`pg_ctl`), dans un répertoire temporaire, sur un
 * port libre, détruite en fin de course. Aucune base existante n'est touchée,
 * et aucun processus que la barrière n'a pas lancé n'est arrêté.
 *
 * Prérequis : Docker démarré, OU PostgreSQL installé localement — l'un suffit.
 * `MIGCHECK_VOIE=docker|locale` force une voie, ce qui permet d'éprouver celle
 * qu'on n'emploie pas d'habitude.
 */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const IMAGE = 'postgres:15-alpine';
const USER = 'maintrix_mig';
const BASES = { migrate: 'maintrix_migration_test', push: 'maintrix_push_test' };

// Mot de passe tiré à chaque exécution. Il n'y a rien à protéger ici — les
// bases vivent quelques minutes sur 127.0.0.1 puis sont détruites — mais une
// chaîne en dur dans un dépôt finit toujours par être recopiée ailleurs, où
// elle protège quelque chose.
const MDP = randomBytes(12).toString('hex');

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };
const ko = (m, d) => { console.log(`  ✗ ${m}`); if (d) console.log(String(d).split('\n').slice(0, 12).map(l => `      ${l}`).join('\n')); fail++; };
const section = (t) => console.log(`\n── ${t}`);

const run = (cmd, args, env, options) =>
  spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, ...env }, ...options });

/**
 * Exécution d'un binaire PostgreSQL : JAMAIS de shell.
 *
 * ⚠️ `run()` active `shell: true` sous Windows — indispensable pour invoquer
 * `npx` — mais le shell réinterprète alors les apostrophes du SQL, qui arrive
 * mutilé à psql. La première version de cette barrière relevait ainsi 0 table
 * des DEUX côtés et se déclarait verte : une comparaison vide compare deux fois
 * rien. D'où l'exécution sans shell, et les garde-fous de volumétrie en T3.
 */
const sansShell = (exe, args, env, options) =>
  spawnSync(exe, args, { encoding: 'utf8', shell: false, env: { ...process.env, ...env }, ...options });

const lignes = (r) => (r.stdout || '').split('\n').map(s => s.trim()).filter(Boolean);

/** Port libre, vérifié aussi contre les ports déjà publiés par Docker. */
async function portLibre({ consulterDocker }) {
  const publies = new Set(
    consulterDocker
      ? (run('docker', ['ps', '--format', '{{.Ports}}']).stdout || '')
        .match(/:(\d+)->/g)?.map(s => s.slice(1, -2)) ?? []
      : [],
  );
  for (let essai = 0; essai < 40; essai++) {
    const p = await new Promise((res) => {
      const s = createServer();
      s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); });
      s.on('error', () => res(0));
    });
    if (p && !publies.has(String(p))) return p;
  }
  throw new Error('aucun port libre trouvé');
}

// ═══════════════════════════════════════════════════════════════════
// LES DEUX VOIES DE MESURE
//
// Chacune rend deux bases NEUVES, chacune sachant se lire elle-même
// (`lire(sql)`), et sait détruire ce qu'elle a créé. T2 et T3 ne savent pas
// laquelle des deux les a servies : les relevés et les comparaisons sont donc
// rigoureusement les mêmes par l'une et par l'autre.
// ═══════════════════════════════════════════════════════════════════

function voieDocker() {
  const conteneurs = { migrate: 'maintrix-migcheck-migrate', push: 'maintrix-migcheck-push' };

  /** Crée un conteneur PostgreSQL jetable et attend qu'il accepte les connexions. */
  async function conteneurJetable(nom, base) {
    const port = await portLibre({ consulterDocker: true });
    run('docker', ['rm', '-f', nom]);
    const r = run('docker', ['run', '-d', '--name', nom,
      '-e', `POSTGRES_USER=${USER}`, '-e', `POSTGRES_PASSWORD=${MDP}`, '-e', `POSTGRES_DB=${base}`,
      '-p', `127.0.0.1:${port}:5432`, IMAGE]);
    if (r.status !== 0) throw new Error(`création du conteneur impossible : ${r.stderr}`);

    const limite = Date.now() + 90_000;
    while (Date.now() < limite) {
      if (run('docker', ['exec', nom, 'pg_isready', '-U', USER, '-d', base]).status === 0) {
        return {
          port,
          url: `postgresql://${USER}:${MDP}@127.0.0.1:${port}/${base}`,
          lire: (sql) => lignes(sansShell('docker', ['exec', nom, 'psql', '-U', USER, '-d', base, '-Atc', sql])),
        };
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error(`${nom} n'est jamais devenu disponible`);
  }

  return {
    etiquette: `conteneurs Docker jetables (${IMAGE})`,
    async preparer() {
      const bases = {}, annonces = [];
      for (const cle of ['migrate', 'push']) {
        bases[cle] = await conteneurJetable(conteneurs[cle], BASES[cle]);
        annonces.push(`base « ${cle} » prête sur le port ${bases[cle].port}`);
      }
      return { bases, annonces };
    },
    async detruire() {
      for (const nom of Object.values(conteneurs)) run('docker', ['rm', '-f', nom]);
      return 'conteneurs jetables supprimés';
    },
  };
}

function voieLocale(bin) {
  const dossier = mkdtempSync(join(tmpdir(), 'maintrix-migcheck-'));
  const donnees = join(dossier, 'grappe');
  const trace = join(dossier, 'postgres.log');
  let port = 0;
  let demarre = false;

  const psql = (base, sql) => sansShell(bin.outil('psql'),
    ['-h', '127.0.0.1', '-p', String(port), '-U', USER, '-d', base, '-Atc', sql],
    { PGPASSWORD: MDP, PGCLIENTENCODING: 'UTF8' });

  return {
    etiquette: `grappe PostgreSQL locale jetable — ${bin.version}, ${bin.dossier ?? 'trouvée dans le PATH'}`,
    async preparer() {
      const motdepasse = join(dossier, 'mot-de-passe');
      writeFileSync(motdepasse, `${MDP}\n`, 'utf8');
      // ⚠️ `-E UTF8` n'est pas facultatif : sans lui la grappe naît en
      // SQL_ASCII sur un poste Windows, et la moindre donnée accentuée casse
      // les lectures. `--locale=C` pour que les tris soient les mêmes d'un
      // poste à l'autre. `scram-sha-256` plutôt que `md5` : même pour une
      // grappe jetable, on n'inscrit pas une méthode obsolète dans un dépôt.
      const ri = sansShell(bin.outil('initdb'),
        ['-D', donnees, '-U', USER, '-A', 'scram-sha-256', `--pwfile=${motdepasse}`, '-E', 'UTF8', '--locale=C']);
      rmSync(motdepasse, { force: true }); // le mot de passe ne traîne pas sur le disque
      if (ri.status !== 0) throw new Error(`initdb a échoué :\n${ri.stdout}\n${ri.stderr}`);

      // On ne touche JAMAIS une grappe déjà en écoute : le port est choisi en le
      // réservant pour de vrai, et s'il a été pris entre-temps on en essaie un
      // autre — plutôt que d'insister, et sans arrêter quoi que ce soit.
      for (let essai = 1; essai <= 3 && !demarre; essai++) {
        port = await portLibre({ consulterDocker: false });
        // stdio ignoré : le serveur hérite des descripteurs de pg_ctl et ne les
        // referme jamais. Avec des tuyaux, spawnSync attendrait la fin du
        // SERVEUR et non celle de pg_ctl — donc indéfiniment. La trace du
        // serveur part dans `-l`, qu'on relit en cas d'échec.
        const rs = sansShell(bin.outil('pg_ctl'),
          ['-D', donnees, '-o', `-p ${port} -h 127.0.0.1`, '-l', trace, '-w', 'start'],
          {}, { stdio: ['ignore', 'ignore', 'ignore'] });
        if (rs.status === 0) { demarre = true; break; }
        const journal = existsSync(trace) ? readFileSync(trace, 'utf8') : '';
        const portPris = /bind|in use|déjà utilisée/i.test(journal.slice(-2000));
        if (!portPris || essai === 3) {
          throw new Error(`pg_ctl start a échoué (port ${port}) :\n${journal.split('\n').slice(-8).join('\n')}`);
        }
      }

      const limite = Date.now() + 60_000;
      let prete = false;
      while (Date.now() < limite && !prete) {
        if (psql('postgres', 'SELECT 1').status === 0) prete = true;
        else await new Promise(r => setTimeout(r, 500));
      }
      if (!prete) throw new Error(`la grappe locale n'accepte pas les connexions sur le port ${port}`);

      const bases = {}, annonces = [`grappe locale prête sur le port ${port}`];
      for (const cle of ['migrate', 'push']) {
        // TEMPLATE template0 : template1 est le modèle que les installations
        // locales personnalisent parfois, et on veut deux bases comparables.
        const r = psql('postgres', `CREATE DATABASE "${BASES[cle]}" ENCODING 'UTF8' TEMPLATE template0`);
        if (r.status !== 0) throw new Error(`création de la base ${BASES[cle]} impossible :\n${r.stderr}`);
        bases[cle] = {
          port,
          url: `postgresql://${USER}:${MDP}@127.0.0.1:${port}/${BASES[cle]}`,
          lire: (sql) => lignes(psql(BASES[cle], sql)),
        };
      }
      annonces.push('bases « migrate » et « push » créées dans la grappe jetable');
      return { bases, annonces };
    },
    async detruire() {
      if (demarre) {
        const r = sansShell(bin.outil('pg_ctl'), ['-D', donnees, '-m', 'immediate', '-w', 'stop'],
          {}, { stdio: ['ignore', 'ignore', 'ignore'] });
        if (r.status !== 0) {
          return `⚠ grappe locale NON arrêtée — à arrêter à la main : pg_ctl -D ${donnees} stop`;
        }
        demarre = false;
      }
      // Windows garde le verrou du répertoire quelques instants après l'arrêt.
      for (let essai = 1; essai <= 6; essai++) {
        try {
          rmSync(dossier, { recursive: true, force: true });
          return 'grappe jetable arrêtée et supprimée';
        } catch {
          await new Promise(r => setTimeout(r, 500));
        }
      }
      return `⚠ grappe arrêtée, mais répertoire non supprimé — à supprimer : ${dossier}`;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// DÉTECTION DES MOYENS DISPONIBLES
// ═══════════════════════════════════════════════════════════════════

const EXE = process.platform === 'win32' ? '.exe' : '';
const OUTILS = ['initdb', 'pg_ctl', 'psql'];

const dockerPret = () => run('docker', ['info', '--format', '{{.ServerVersion}}'], {}, { timeout: 20_000 }).status === 0;

/** Les emplacements habituels d'une installation PostgreSQL, du plus récent au plus ancien. */
function dossiersCandidats() {
  const familles = process.platform === 'win32'
    ? [{ racine: 'C:\\Program Files\\PostgreSQL', motif: /^\d+$/ },
      { racine: 'C:\\Program Files (x86)\\PostgreSQL', motif: /^\d+$/ }]
    : [{ racine: '/usr/lib/postgresql', motif: /^\d+$/ },
      { racine: '/usr', motif: /^pgsql-\d+$/ },
      { racine: '/opt/homebrew/opt', motif: /^postgresql@\d+$/ },
      { racine: '/usr/local/opt', motif: /^postgresql@\d+$/ }];

  const dossiers = [];
  const numero = (s) => Number((s.match(/\d+/) ?? [0])[0]);
  for (const { racine, motif } of familles) {
    let entrees;
    try { entrees = readdirSync(racine); } catch { continue; }
    for (const e of entrees.filter(e => motif.test(e)).sort((a, b) => numero(b) - numero(a))) {
      dossiers.push(join(racine, e, 'bin'));
    }
  }
  return [...dossiers, '/usr/local/pgsql/bin', '/usr/bin', '/usr/local/bin'];
}

/** initdb/pg_ctl/psql : dans le PATH, sinon aux emplacements habituels. */
function binairesPostgres() {
  const v = run('initdb', ['--version']);
  if (v.status === 0 && run('pg_ctl', ['--version']).status === 0 && run('psql', ['--version']).status === 0) {
    return { dossier: null, version: (v.stdout || '').trim(), outil: (o) => o + EXE };
  }
  // L'installateur Windows n'ajoute rien au PATH : sans cette recherche, un
  // poste qui a PostgreSQL depuis des mois passerait pour dépourvu.
  for (const d of dossiersCandidats()) {
    if (!OUTILS.every(o => existsSync(join(d, o + EXE)))) continue;
    const r = sansShell(join(d, `initdb${EXE}`), ['--version']);
    if (r.status === 0) return { dossier: d, version: (r.stdout || '').trim(), outil: (o) => join(d, o + EXE) };
  }
  return null;
}

/**
 * Jamais d'échec pour la mauvaise raison : on n'annonce « rien de disponible »
 * qu'après avoir cherché les DEUX moyens, et on dit quoi installer ou démarrer.
 */
function choisirVoie() {
  const forcee = (process.env.MIGCHECK_VOIE || '').trim().toLowerCase();
  if (forcee && !['docker', 'locale'].includes(forcee)) {
    throw new Error(`MIGCHECK_VOIE=${forcee} : valeurs acceptées « docker » ou « locale »`);
  }
  const manques = [];

  if (forcee !== 'locale') {
    if (dockerPret()) return voieDocker();
    manques.push("• Docker : `docker info` échoue — le démon n'est pas démarré, ou Docker n'est pas installé.");
  }
  if (forcee !== 'docker') {
    const bin = binairesPostgres();
    if (bin) return voieLocale(bin);
    manques.push('• PostgreSQL local : ni initdb, ni pg_ctl, ni psql dans le PATH ou aux emplacements habituels'
      + (process.platform === 'win32' ? ' (C:\\Program Files\\PostgreSQL\\<version>\\bin).' : '.'));
  }

  throw new Error([
    'Aucun moyen de construire deux bases jetables :',
    ...manques,
    // Dire qu'une voie a été forcée, sinon le rapport laisse croire que les
    // deux ont été essayées — et on chercherait le défaut au mauvais endroit.
    ...(forcee ? [`(voie forcée par MIGCHECK_VOIE=${forcee} : l'autre n'a PAS été essayée)`] : []),
    '',
    "L'UN des deux suffit :",
    '  → démarrer Docker Desktop ;',
    '  → ou installer PostgreSQL (https://www.postgresql.org/download/), qui fournit initdb et pg_ctl.',
    '',
    'Cette barrière compare deux bases NEUVES : elle ne peut pas se replier sur une base',
    "existante sans en détruire le contenu. Elle s'arrête donc ici, plutôt que de se déclarer",
    "verte sans avoir rien mesuré.",
  ].join('\n'));
}

/**
 * Pourquoi drizzle vient-il d'échouer : une migration, ou une base injoignable ?
 *
 * `drizzle-kit` n'affiche, en cas d'échec, que « applying migrations... » suivi
 * de ses cadres d'animation : le message de la cause est avalé. Le rapport de
 * la barrière ressemblait donc à « migration en échec » quelle que fût la
 * raison — et une base inaccessible se corrige ailleurs qu'une migration
 * fautive. Mesuré le 2026-10-25, en éprouvant la voie Docker : la connexion
 * échouait à l'authentification, et il a fallu tracer le réseau pour le voir.
 *
 * Deux canaux différents, et c'est tout l'intérêt : le relevé (`lire`) parle à
 * la base par le chemin de la barrière, drizzle par l'URL. Quand le premier
 * répond et le second non, le défaut est dans la liaison — port publié,
 * identifiants — et pas une ligne de SQL.
 */
async function pourquoiDrizzleAEchoue(base) {
  let releveOk = false;
  try { releveOk = base.lire('SELECT 1').includes('1'); } catch { releveOk = false; }

  let urlOk = null, erreurUrl = '';
  try {
    const mod = await import('pg');
    const { Client } = mod.default ?? mod;
    const client = new Client({ connectionString: base.url, connectionTimeoutMillis: 5000 });
    try {
      await client.connect();
      await client.query('SELECT 1');
      urlOk = true;
    } finally {
      await client.end().catch(() => {});
    }
  } catch (e) {
    if (urlOk === null) { urlOk = false; erreurUrl = e.message; }
  }

  if (!releveOk) {
    return 'DIAGNOSTIC : la base ne répond même pas au relevé de la barrière. '
      + 'Rien n\'a été construit de ce côté — ce n\'est pas une migration qu\'il faut relire.';
  }
  if (urlOk === false) {
    return 'DIAGNOSTIC : la base RÉPOND au relevé de la barrière, mais pas par l\'URL que '
      + `drizzle emploie (${erreurUrl}). Donc liaison ou identifiants, PAS une migration.`;
  }
  return 'DIAGNOSTIC : la base répond, et l\'URL de drizzle aussi. La cause est donc dans les '
    + 'fichiers de migration eux-mêmes ; drizzle ne dit pas laquelle, mais\n'
    + '  psql "<url>" -f migrations/<fichier>.sql\n'
    + '  l\'affiche. Un commentaire citant le marqueur de coupure suffit à tout casser.';
}

// ═══════════════════════════════════════════════════════════════════
// RELEVÉ DU SCHÉMA RÉELLEMENT OBTENU
// ═══════════════════════════════════════════════════════════════════

const SQL = {
  tables: "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1",
  tenant: "SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenant_id' ORDER BY 1",
  // Nullabilité : une colonne `tenant_id` facultative d'un côté et obligatoire
  // de l'autre, c'est un cloisonnement qui tient sur un chemin et pas sur
  // l'autre — des lignes SANS locataire entrent par le plus permissif.
  tenantNullable: "SELECT table_name||'|'||is_nullable FROM information_schema.columns"
    + " WHERE table_schema='public' AND column_name='tenant_id' ORDER BY 1",
  // Actions ON DELETE, identifiées par (table fille, colonnes, table cible) et
  // NON par le nom de la contrainte : les deux chemins ne les nomment pas
  // pareil, et comparer des noms produirait un écart à chaque exécution.
  // C'est ce relevé qui a montré qu'un `ON DELETE CASCADE` était inerte parce
  // que la table fille restait en « no action » : à la suppression d'un
  // locataire, ses lignes filles restaient derrière lui.
  fkDelete: `SELECT c.conrelid::regclass::text||'('||(
      SELECT string_agg(a.attname, ',' ORDER BY a.attnum) FROM pg_attribute a
       WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    )||') -> '||c.confrelid::regclass::text||' : '||CASE c.confdeltype
      WHEN 'a' THEN 'no action' WHEN 'r' THEN 'restrict' WHEN 'c' THEN 'cascade'
      WHEN 'n' THEN 'set null' WHEN 'd' THEN 'set default' ELSE c.confdeltype::text END
    FROM pg_constraint c
   WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
   ORDER BY 1`,
};

function releverSchema(base) {
  return {
    tables: new Set(base.lire(SQL.tables).filter(t => t !== '__drizzle_migrations')),
    tenantCols: new Set(base.lire(SQL.tenant)),
    tenantNullable: new Map(base.lire(SQL.tenantNullable).map(l => {
      const [table, nullable] = l.split('|');
      return [table, nullable === 'YES' ? 'facultative' : 'obligatoire'];
    })),
    fkDelete: new Set(base.lire(SQL.fkDelete)),
  };
}

const ecart = (a, b) => [...a].filter(x => !b.has(x)).sort();

// ═══════════════════════════════════════════════════════════════════
console.log('\n🔎 Comparaison des deux chemins de création de schéma\n');

// La voie est annoncée AVANT toute mesure : un rapport qui ne dit pas comment
// il a mesuré ne permet pas de juger sa portée.
let voie = null, echecDetection = null;
try { voie = choisirVoie(); } catch (e) { echecDetection = e.message; }
console.log(`   voie de mesure : ${voie ? voie.etiquette : 'AUCUNE'}`);

try {
  section('T1 — Le journal décrit toutes les migrations présentes');
  {
    const sql = readdirSync('migrations').filter(f => /^\d{4}_.*\.sql$/.test(f)).map(f => f.replace(/\.sql$/, '')).sort();
    const journal = JSON.parse(readFileSync('migrations/meta/_journal.json', 'utf8'));
    const tags = journal.entries.map(e => e.tag);

    const absentes = sql.filter(t => !tags.includes(t));
    if (absentes.length === 0) ok(`les ${sql.length} migrations sont toutes au journal`);
    else ko(`${absentes.length} migration(s) absente(s) du journal`,
      absentes.join('\n') + '\n\n`drizzle-kit migrate` ne les appliquera PAS : le schéma produit sera incomplet.');

    const orphelines = tags.filter(t => !sql.includes(t));
    if (orphelines.length === 0) ok('aucune entrée de journal sans fichier SQL');
    else ko(`entrée(s) de journal sans fichier : ${orphelines.join(', ')}`);

    const idx = journal.entries.map(e => e.idx);
    const croissant = idx.every((v, i) => i === 0 || v > idx[i - 1]);
    if (croissant) ok('les index du journal sont strictement croissants');
    else ko('les index du journal ne sont pas ordonnés');
  }

  section('T2 — Construction des deux bases');
  if (!voie) {
    ko('aucune voie de mesure disponible', echecDetection);
  } else {
    const { bases, annonces } = await voie.preparer();
    annonces.forEach(ok);

    // Le diagnostic passe AVANT la sortie de drizzle : `ko` ne montre que les
    // douze premières lignes du détail, et les cadres d'animation de drizzle
    // les mangeaient toutes.
    const rMigrate = run('npx', ['drizzle-kit', 'migrate'], { DATABASE_URL: bases.migrate.url });
    if (rMigrate.status === 0) ok('drizzle-kit migrate s\'est terminé sans erreur');
    else ko('drizzle-kit migrate a échoué',
      `${await pourquoiDrizzleAEchoue(bases.migrate)}\n\n${rMigrate.stdout}\n${rMigrate.stderr}`);

    const rPush = run('npx', ['drizzle-kit', 'push', '--force'], { DATABASE_URL: bases.push.url });
    if (rPush.status === 0) ok('drizzle-kit push s\'est terminé sans erreur');
    else ko('drizzle-kit push a échoué',
      `${await pourquoiDrizzleAEchoue(bases.push)}\n\n${rPush.stdout}\n${rPush.stderr}`);

    section('T3 — Les deux chemins produisent-ils le même schéma ?');
    const sMigrate = releverSchema(bases.migrate);
    const sPush = releverSchema(bases.push);

    const resume = (s) => `${s.tables.size} tables, ${s.tenantCols.size} colonnes tenant_id, ${s.fkDelete.size} clés étrangères`;
    console.log(`      migrate : ${resume(sMigrate)}`);
    console.log(`      push    : ${resume(sPush)}`);

    // Garde-fou anti-faux-vert : sans lui, un relevé défaillant renvoie deux
    // ensembles vides, toutes les comparaisons réussissent, et la barrière
    // certifie une équivalence qu'elle n'a jamais mesurée. C'est exactement ce
    // qui s'est produit à la première exécution.
    const SEUIL = 100;
    if (sPush.tables.size >= SEUIL && sMigrate.tables.size >= SEUIL) {
      ok(`relevé plausible des deux côtés (≥ ${SEUIL} tables)`);
    } else {
      ko(`relevé invraisemblable (migrate=${sMigrate.tables.size}, push=${sPush.tables.size})`,
        'Le schéma Maintrix compte ~112 tables. Un relevé quasi vide signale soit une ' +
        'défaillance de la MESURE, soit un chemin qui n\'a RIEN créé : les comparaisons ' +
        'qui suivent ne prouveraient rien.');
    }

    // Le même garde-fou pour les deux relevés fins : une requête qui échoue rend
    // une liste vide, et deux listes vides se comparent parfaitement.
    const SEUIL_FK = 100, SEUIL_TENANT = 50;
    if (sPush.fkDelete.size >= SEUIL_FK && sPush.tenantCols.size >= SEUIL_TENANT) {
      ok(`relevés fins plausibles (${sPush.fkDelete.size} clés étrangères, ${sPush.tenantCols.size} colonnes tenant_id)`);
    } else {
      ko(`relevés fins invraisemblables (${sPush.fkDelete.size} clés étrangères, ${sPush.tenantCols.size} colonnes tenant_id)`,
        'Côté `push`, le schéma compte ~200 clés étrangères et ~81 colonnes tenant_id. Si ces ' +
        'nombres s\'effondrent, c\'est la requête de relevé qui a échoué : les comparaisons de ' +
        'nullabilité et d\'ON DELETE ne mesureraient alors rien.');
    }

    const tablesManquantes = ecart(sPush.tables, sMigrate.tables);
    if (tablesManquantes.length === 0) ok('aucune table manquante côté migrate');
    else ko(`${tablesManquantes.length} table(s) absente(s) du chemin migrate`,
      tablesManquantes.join(', ') +
      '\n\nUn déploiement par `migrate` produirait une base incomplète.');

    const tenantManquants = ecart(sPush.tenantCols, sMigrate.tenantCols);
    if (tenantManquants.length === 0) ok('aucune colonne tenant_id manquante côté migrate');
    else ko(`${tenantManquants.length} table(s) sans tenant_id côté migrate`,
      tenantManquants.join(', ') +
      '\n\nLe cloisonnement entre locataires serait INCOMPLET après un déploiement par `migrate`.');

    const nullDivergentes = [...sPush.tenantNullable]
      .filter(([t, n]) => sMigrate.tenantNullable.has(t) && sMigrate.tenantNullable.get(t) !== n)
      .map(([t, n]) => `${t} : push=${n}, migrate=${sMigrate.tenantNullable.get(t)}`);
    if (nullDivergentes.length === 0) ok('les colonnes tenant_id ont la même nullabilité des deux côtés');
    else ko(`${nullDivergentes.length} colonne(s) tenant_id de nullabilité différente`,
      nullDivergentes.join('\n') +
      '\n\nLà où la colonne est facultative, des lignes SANS locataire peuvent entrer : le ' +
      'cloisonnement ne tient que sur le chemin le plus strict.');

    const fkManquantes = ecart(sPush.fkDelete, sMigrate.fkDelete);
    if (fkManquantes.length === 0) ok('les actions ON DELETE du schéma se retrouvent toutes côté migrate');
    else ko(`${fkManquantes.length} clé(s) étrangère(s) absente(s) ou d'action différente côté migrate`,
      fkManquantes.join('\n') +
      '\n\nUne action ON DELETE qui diffère, c\'est un CASCADE inerte ou une suppression qui ' +
      'échoue : à la suppression d\'un locataire, les deux bases ne se comportent pas pareil.');

    // L'inverse compte aussi : `migrate` ne doit pas créer ce que le schéma ignore.
    const enTrop = ecart(sMigrate.tables, sPush.tables);
    if (enTrop.length === 0) ok('migrate ne crée aucune table étrangère au schéma');
    else ko(`${enTrop.length} table(s) créée(s) par migrate mais absente(s) du schéma`, enTrop.join(', '));

    const fkEnTrop = ecart(sMigrate.fkDelete, sPush.fkDelete);
    if (fkEnTrop.length === 0) ok('migrate ne pose aucune action ON DELETE étrangère au schéma');
    else ko(`${fkEnTrop.length} clé(s) étrangère(s) posée(s) par migrate et absente(s) du schéma`, fkEnTrop.join('\n'));
  }
} catch (e) {
  ko('barrière interrompue', e.message);
} finally {
  if (voie) console.log(`\n      ${await voie.detruire()}`);
}

// « ÉCART DÉTECTÉ » serait faux quand aucune base n'a pu être construite : rien
// n'a été comparé. Un rapport doit distinguer « j'ai mesuré et c'est différent »
// de « je n'ai rien pu mesurer » — les deux sortent en 1, mais ne se corrigent
// pas au même endroit.
const verdict = fail === 0 ? 'OK' : (voie ? 'ÉCART DÉTECTÉ' : 'NON MESURÉ');
console.log('\n' + '═'.repeat(50));
console.log(`  MIGRATIONS : ${verdict}   —   ${pass} réussis, ${fail} échoués`);
console.log(`  voie employée : ${voie ? voie.etiquette : 'AUCUNE — rien n\'a été mesuré'}`);
console.log('═'.repeat(50));
process.exit(fail === 0 ? 0 : 1);

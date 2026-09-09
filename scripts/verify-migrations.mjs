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
 * Prérequis : Docker démarré. Aucune base existante n'est touchée.
 */
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const IMAGE = 'postgres:15-alpine';
const USER = 'maintrix_mig';
const MDP = 'verification_migrations';
const BASE = 'maintrix_migration_test';

let pass = 0, fail = 0;
const ok = (m) => { console.log(`  ✓ ${m}`); pass++; };
const ko = (m, d) => { console.log(`  ✗ ${m}`); if (d) console.log(String(d).split('\n').slice(0, 12).map(l => `      ${l}`).join('\n')); fail++; };
const section = (t) => console.log(`\n── ${t}`);

const run = (cmd, args, env) =>
  spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, ...env } });

/** Port libre, vérifié aussi contre les ports déjà publiés par Docker. */
async function portLibre() {
  const publies = new Set(
    (run('docker', ['ps', '--format', '{{.Ports}}']).stdout || '')
      .match(/:(\d+)->/g)?.map(s => s.slice(1, -2)) ?? [],
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

/** Crée un conteneur PostgreSQL jetable et attend qu'il accepte les connexions. */
async function baseJetable(nom) {
  const port = await portLibre();
  run('docker', ['rm', '-f', nom]);
  const r = run('docker', ['run', '-d', '--name', nom,
    '-e', `POSTGRES_USER=${USER}`, '-e', `POSTGRES_PASSWORD=${MDP}`, '-e', `POSTGRES_DB=${BASE}`,
    '-p', `127.0.0.1:${port}:5432`, IMAGE]);
  if (r.status !== 0) throw new Error(`création du conteneur impossible : ${r.stderr}`);

  const limite = Date.now() + 90_000;
  while (Date.now() < limite) {
    if (run('docker', ['exec', nom, 'pg_isready', '-U', USER, '-d', BASE]).status === 0) {
      return { nom, port, url: `postgresql://${USER}:${MDP}@127.0.0.1:${port}/${BASE}` };
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`${nom} n'est jamais devenu disponible`);
}

const detruire = (nom) => run('docker', ['rm', '-f', nom]);

/**
 * Relevé du schéma réellement obtenu : tables, et colonnes tenant_id.
 *
 * ⚠️ On n'utilise PAS `run()` ici. `run()` active `shell: true` sous Windows —
 * indispensable pour invoquer `npx` — mais le shell réinterprète alors les
 * apostrophes du SQL, qui arrive mutilé à psql. La première version de cette
 * barrière relevait ainsi 0 table des DEUX côtés et se déclarait verte : une
 * comparaison vide compare deux fois rien. D'où l'exécution sans shell, et le
 * garde-fou de volumétrie en T3.
 */
function releverSchema(conteneur) {
  const psql = (sql) => {
    const r = spawnSync('docker', ['exec', conteneur, 'psql', '-U', USER, '-d', BASE, '-Atc', sql],
      { encoding: 'utf8', shell: false });
    return (r.stdout || '').split('\n').map(s => s.trim()).filter(Boolean);
  };
  return {
    tables: new Set(psql(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1",
    ).filter(t => t !== '__drizzle_migrations')),
    tenantCols: new Set(psql(
      "SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='tenant_id' ORDER BY 1",
    )),
  };
}

const ecart = (a, b) => [...a].filter(x => !b.has(x)).sort();

// ═══════════════════════════════════════════════════════════════════
console.log('\n🔎 Comparaison des deux chemins de création de schéma\n');

let cMigrate = 'maintrix-migcheck-migrate';
let cPush = 'maintrix-migcheck-push';

try {
  section('T1 — Le journal décrit toutes les migrations présentes');
  {
    const { readdirSync, readFileSync } = await import('node:fs');
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
  const bMigrate = await baseJetable(cMigrate);
  ok(`base « migrate » prête sur le port ${bMigrate.port}`);
  const bPush = await baseJetable(cPush);
  ok(`base « push » prête sur le port ${bPush.port}`);

  const rMigrate = run('npx', ['drizzle-kit', 'migrate'], { DATABASE_URL: bMigrate.url });
  if (rMigrate.status === 0) ok('drizzle-kit migrate s\'est terminé sans erreur');
  else ko('drizzle-kit migrate a échoué', `${rMigrate.stdout}\n${rMigrate.stderr}`);

  const rPush = run('npx', ['drizzle-kit', 'push', '--force'], { DATABASE_URL: bPush.url });
  if (rPush.status === 0) ok('drizzle-kit push s\'est terminé sans erreur');
  else ko('drizzle-kit push a échoué', `${rPush.stdout}\n${rPush.stderr}`);

  section('T3 — Les deux chemins produisent-ils le même schéma ?');
  {
    const sMigrate = releverSchema(cMigrate);
    const sPush = releverSchema(cPush);

    console.log(`      migrate : ${sMigrate.tables.size} tables, ${sMigrate.tenantCols.size} colonnes tenant_id`);
    console.log(`      push    : ${sPush.tables.size} tables, ${sPush.tenantCols.size} colonnes tenant_id`);

    // Garde-fou anti-faux-vert : sans lui, un relevé défaillant renvoie deux
    // ensembles vides, toutes les comparaisons réussissent, et la barrière
    // certifie une équivalence qu'elle n'a jamais mesurée. C'est exactement ce
    // qui s'est produit à la première exécution.
    const SEUIL = 100;
    if (sPush.tables.size >= SEUIL && sMigrate.tables.size >= SEUIL) {
      ok(`relevé plausible des deux côtés (≥ ${SEUIL} tables)`);
    } else {
      ko(`relevé invraisemblable (migrate=${sMigrate.tables.size}, push=${sPush.tables.size})`,
         'Le schéma Maintrix compte ~112 tables. Un relevé quasi vide signale une ' +
         'défaillance de la MESURE, pas une équivalence : les comparaisons qui suivent ' +
         'ne prouveraient rien.');
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

    // L'inverse compte aussi : `migrate` ne doit pas créer ce que le schéma ignore.
    const enTrop = ecart(sMigrate.tables, sPush.tables);
    if (enTrop.length === 0) ok('migrate ne crée aucune table étrangère au schéma');
    else ko(`${enTrop.length} table(s) créée(s) par migrate mais absente(s) du schéma`, enTrop.join(', '));
  }
} catch (e) {
  ko('barrière interrompue', e.message);
} finally {
  detruire(cMigrate);
  detruire(cPush);
  console.log('\n      bases jetables supprimées');
}

console.log('\n' + '═'.repeat(50));
console.log(`  MIGRATIONS : ${fail === 0 ? 'OK' : 'ÉCART DÉTECTÉ'}   —   ${pass} réussis, ${fail} échoués`);
console.log('═'.repeat(50));
process.exit(fail === 0 ? 0 : 1);

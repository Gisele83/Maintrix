/**
 * Le jeu de démonstration refuse-t-il ce qu'il doit refuser ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CETTE SUITE EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Un script qui écrit et surtout qui SUPPRIME des organisations entières ne
 * se relit pas, il se mesure. La garde précédente tenait en une ligne —
 * refuser si le nom de la base contient « prod » — et laissait passer toute
 * base nommée sobrement, `--retirer` compris.
 *
 * Chaque cas ci-dessous crée sa PROPRE base jetable, y pose ce qu'il faut
 * pour que le verdict attendu tombe, puis lance le script en sous-processus
 * et lit ce qu'il a réellement fait. Aucun cas ne partage son état avec un
 * autre : un refus mal rendu ne peut pas se masquer derrière le passage
 * précédent.
 *
 * ⚠️ Ces tests ne passent pas par `API_URL` — ils n'ont pas besoin du
 * serveur, seulement d'un PostgreSQL. Ils se lancent avec la voie
 * d'intégration (`npm test`), qui en fournit un.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';
import { join } from 'node:path';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL absente — lancez `npm test`.');

const RACINE = join(__dirname, '..', '..');
const SCRIPT = join('scripts', 'jeu-de-demonstration.ts');
const TSX = join(RACINE, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const TENANT_DEMO = '00000000-0000-4000-8000-0000000de401';

const STAMP = Date.now();
let adminUrl: string;
const basesCreees: string[] = [];

/** Crée une base jetable portant le nom demandé, schéma compris. */
async function baseJetable(nom: string): Promise<string> {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${nom}"`);
  await admin.query(`CREATE DATABASE "${nom}"`);
  await admin.end();
  basesCreees.push(nom);

  const url = new URL(DATABASE_URL!);
  url.pathname = `/${nom}`;
  const cible = url.toString();

  execFileSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['drizzle-kit', 'push', '--force'],
    { cwd: RACINE, env: { ...process.env, DATABASE_URL: cible }, stdio: 'pipe', shell: process.platform === 'win32' },
  );
  return cible;
}

/** Lance le script et rend son issue, sans jamais faire échouer le test. */
function lancer(url: string, args: string[] = [], env: Record<string, string> = {}) {
  try {
    const sortie = execFileSync(process.execPath, [TSX, SCRIPT, ...args], {
      cwd: RACINE,
      env: { ...process.env, DATABASE_URL: url, ...env },
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { code: 0, sortie };
  } catch (e) {
    const err = e as { status: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, sortie: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

async function compter(url: string, table: string, tenant?: string): Promise<number> {
  const c = new Client({ connectionString: url });
  await c.connect();
  // `tenants` se désigne par `id`, pas par `tenant_id` : une organisation ne
  // porte pas de référence à elle-même. Sans ce cas particulier, la requête
  // échoue sur « column tenant_id does not exist » — ce qui a fait tomber six
  // cas de cette suite pour une faute du test, pas du produit.
  const colonne = table === 'tenants' ? 'id' : 'tenant_id';
  const { rows } = tenant
    ? await c.query(`SELECT COUNT(*)::int n FROM ${table} WHERE ${colonne} = $1`, [tenant])
    : await c.query(`SELECT COUNT(*)::int n FROM ${table}`);
  await c.end();
  return rows[0].n;
}

beforeAll(() => {
  const u = new URL(DATABASE_URL!);
  u.pathname = '/postgres';
  adminUrl = u.toString();
}, 60_000);

afterAll(async () => {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  for (const nom of basesCreees) {
    await admin.query(`DROP DATABASE IF EXISTS "${nom}"`).catch(() => undefined);
  }
  await admin.end();
}, 120_000);

// ═══════════════════════════════════════════════════════════════════
describe("Garde d'environnement — ce qui doit être refusé", () => {
  it('REFUSE une base dont le nom désigne la production', async () => {
    const url = await baseJetable(`maintrix_prod_${STAMP}`);
    const r = lancer(url);

    expect(r.code).not.toBe(0);
    expect(r.sortie).toMatch(/REFUS/);
    expect(r.sortie).toMatch(/PRODUCTION/i);
    // Et surtout : rien n'a été écrit.
    expect(await compter(url, 'tenants')).toBe(0);
  }, 180_000);

  it('REFUSE la SUPPRESSION sur une base de production, ce que l\'ancienne garde laissait passer', async () => {
    const url = await baseJetable(`maintrix_prod_suppr_${STAMP}`);
    // Une organisation cliente, qu'un retrait mal gardé pourrait amputer.
    const c = new Client({ connectionString: url });
    await c.connect();
    await c.query(
      `INSERT INTO tenants (id, name, domain, plan, is_active)
       VALUES ('11111111-1111-4111-8111-111111111111', 'Client Réel SA', 'client-reel.fr', 'pro', true)`);
    await c.end();

    const r = lancer(url, ['--retirer']);

    expect(r.code).not.toBe(0);
    expect(r.sortie).toMatch(/REFUS/);
    // L'organisation cliente est toujours là.
    expect(await compter(url, 'tenants')).toBe(1);
  }, 180_000);

  it('REFUSE une base au nom neutre : l\'inconnu ne vaut pas permission', async () => {
    const url = await baseJetable(`maintrix_${STAMP}`);
    const r = lancer(url);

    expect(r.code).not.toBe(0);
    expect(r.sortie).toMatch(/indéterminé|ambigu/i);
    expect(await compter(url, 'tenants')).toBe(0);
  }, 180_000);

  it("REFUSE même avec NODE_ENV=development : ce n'est pas une preuve", async () => {
    const url = await baseJetable(`maintrix_${STAMP}_neutre`);
    const r = lancer(url, [], { NODE_ENV: 'development' });

    expect(r.code).not.toBe(0);
    expect(r.sortie).toMatch(/REFUS/);
  }, 180_000);

  it('REFUSE une base nommée « test » qui contient de VRAIS clients', async () => {
    // Le signal de contenu doit l'emporter sur le nom : c'est celui qu'on ne
    // peut pas tromper en renommant sa base.
    const url = await baseJetable(`maintrix_test_habite_${STAMP}`);
    const c = new Client({ connectionString: url });
    await c.connect();
    await c.query(
      `INSERT INTO tenants (id, name, domain, plan, is_active)
       VALUES ('22222222-2222-4222-8222-222222222222', 'Aciéries du Nord', 'acieries-nord.fr', 'enterprise', true)`);
    await c.query(
      `INSERT INTO equipment_registry (tenant_id, equipment_id, equipment_name, equipment_type)
       VALUES ('22222222-2222-4222-8222-222222222222', 'REEL-001', 'Four à arc', 'four')`);
    await c.end();

    const r = lancer(url);

    expect(r.code).not.toBe(0);
    expect(r.sortie).toMatch(/PRODUCTION/i);
    expect(await compter(url, 'tenants', TENANT_DEMO)).toBe(0);
  }, 180_000);

  it('le forçage NE LÈVE PAS un signal de production', async () => {
    const url = await baseJetable(`maintrix_test_force_${STAMP}`);
    const c = new Client({ connectionString: url });
    await c.connect();
    await c.query(
      `INSERT INTO tenants (id, name, domain, plan, is_active)
       VALUES ('33333333-3333-4333-8333-333333333333', 'Papeterie Durand', 'durand.com', 'pro', true)`);
    await c.query(
      `INSERT INTO equipment_registry (tenant_id, equipment_id, equipment_name, equipment_type)
       VALUES ('33333333-3333-4333-8333-333333333333', 'REEL-002', 'Machine à papier', 'machine')`);
    await c.end();

    const r = lancer(url, [], { MAINTRIX_DEMO_FORCER: 'oui-je-sais-ce-que-je-fais' });

    expect(r.code).not.toBe(0);
    expect(r.sortie).toMatch(/aucune variable|ne peut l'autoriser/i);
    expect(await compter(url, 'tenants', TENANT_DEMO)).toBe(0);
  }, 180_000);

  it('REFUSE un mot de passe imposé par variable d\'environnement', async () => {
    const url = await baseJetable(`maintrix_test_mdp_${STAMP}`);
    const r = lancer(url, [], { MAINTRIX_DEMO_PASSWORD: 'un-mot-de-passe-impose' });

    expect(r.code).not.toBe(0);
    expect(r.sortie).toMatch(/MAINTRIX_DEMO_PASSWORD/);
    expect(await compter(url, 'tenants', TENANT_DEMO)).toBe(0);
  }, 180_000);
});

// ═══════════════════════════════════════════════════════════════════
describe('Garde d\'environnement — ce qui doit être autorisé', () => {
  let urlTest: string;

  beforeAll(async () => {
    urlTest = await baseJetable(`maintrix_test_ok_${STAMP}`);
  }, 180_000);

  it('ACCEPTE une base de test, sur hôte privé, sans client réel', async () => {
    const r = lancer(urlTest);

    expect(r.code).toBe(0);
    expect(r.sortie).toMatch(/JEU DE DÉMONSTRATION CHARGÉ/);
    expect(await compter(urlTest, 'tenants', TENANT_DEMO)).toBe(1);
    expect(await compter(urlTest, 'equipment_registry', TENANT_DEMO)).toBeGreaterThan(10);
  }, 240_000);

  it('donne QUATRE secrets DISTINCTS, un par compte', async () => {
    const r = lancer(urlTest);
    expect(r.code).toBe(0);

    const secrets = [...r.sortie.matchAll(/^\s+(Demo-[A-Za-z0-9]{20,})\s/gm)].map((m) => m[1]);
    expect(secrets.length).toBe(4);
    expect(new Set(secrets).size).toBe(4);
    for (const s of secrets) expect(s.length).toBeGreaterThanOrEqual(24);
  }, 240_000);

  it('deux chargements successifs aboutissent, sans doublon', async () => {
    const premier = lancer(urlTest);
    const equipementsApres1 = await compter(urlTest, 'equipment_registry', TENANT_DEMO);
    const second = lancer(urlTest);
    const equipementsApres2 = await compter(urlTest, 'equipment_registry', TENANT_DEMO);

    expect(premier.code).toBe(0);
    expect(second.code).toBe(0);
    expect(second.sortie).toMatch(/retrait avant rechargement/i);
    expect(equipementsApres2).toBe(equipementsApres1);
  }, 300_000);

  it('la désactivation coupe les accès sans effacer les données', async () => {
    lancer(urlTest);
    const avant = await compter(urlTest, 'equipment_registry', TENANT_DEMO);

    const r = lancer(urlTest, ['--desactiver']);
    expect(r.code).toBe(0);

    const c = new Client({ connectionString: urlTest });
    await c.connect();
    const { rows: actifs } = await c.query(
      'SELECT COUNT(*)::int n FROM user_profiles WHERE tenant_id = $1 AND is_active = true', [TENANT_DEMO]);
    const { rows: total } = await c.query(
      'SELECT COUNT(*)::int n FROM user_profiles WHERE tenant_id = $1', [TENANT_DEMO]);
    await c.end();

    expect(actifs[0].n).toBe(0);          // plus aucun accès
    expect(total[0].n).toBeGreaterThan(0); // mais les comptes existent toujours
    expect(await compter(urlTest, 'equipment_registry', TENANT_DEMO)).toBe(avant); // données intactes
  }, 300_000);

  it('le retrait efface le jeu ENTIER et préserve un locataire témoin', async () => {
    lancer(urlTest);

    const TEMOIN = '44444444-4444-4444-8444-444444444444';
    const c = new Client({ connectionString: urlTest });
    await c.connect();
    await c.query(
      `INSERT INTO tenants (id, name, domain, plan, is_active)
       VALUES ($1, 'Témoin [démo]', 'temoin.test.local', 'pro', true) ON CONFLICT DO NOTHING`, [TEMOIN]);
    await c.query(
      `INSERT INTO equipment_registry (tenant_id, equipment_id, equipment_name, equipment_type)
       VALUES ($1, 'TEM-001', 'Équipement témoin', 'pompe') ON CONFLICT DO NOTHING`, [TEMOIN]);
    // Une alerte SANS locataire sur un équipement de démonstration, comme en
    // produit le moteur d'alertes du serveur : c'est elle qui faisait échouer
    // le retrait sur contrainte de clé étrangère.
    const { rows: eqDemo } = await c.query(
      'SELECT id FROM equipment_registry WHERE tenant_id = $1 LIMIT 1', [TENANT_DEMO]);
    await c.query(
      `INSERT INTO alerts_notifications (equipment_id, alert_type, severity, title, message)
       VALUES ($1, 'threshold', 'high', 'Alerte sans locataire', 'posée par le simulateur')`,
      [eqDemo[0].id]);
    await c.end();

    const r = lancer(urlTest, ['--retirer']);

    expect(r.code).toBe(0);
    expect(await compter(urlTest, 'tenants', TENANT_DEMO)).toBe(0);
    expect(await compter(urlTest, 'equipment_registry', TENANT_DEMO)).toBe(0);
    expect(await compter(urlTest, 'oee_records', TENANT_DEMO)).toBe(0);
    // Le témoin, lui, n'a pas bougé.
    expect(await compter(urlTest, 'equipment_registry', TEMOIN)).toBe(1);
  }, 300_000);
});

// ═══════════════════════════════════════════════════════════════════
describe('Intégrité après interruption', () => {
  it("une organisation à moitié chargée est reprise, pas laissée en l'état", async () => {
    const url = await baseJetable(`maintrix_test_reprise_${STAMP}`);

    // On simule l'interruption : l'organisation et ses comptes existent, le
    // parc non. C'est exactement l'état que laissait un chargement coupé.
    const c = new Client({ connectionString: url });
    await c.connect();
    await c.query(
      `INSERT INTO tenants (id, name, domain, plan, is_active)
       VALUES ($1, 'Usine Verrières [démo]', 'usine.demo.invalid', 'enterprise', true)`, [TENANT_DEMO]);
    await c.query(
      `INSERT INTO user_profiles (tenant_id, username, email, password, role, is_active)
       VALUES ($1, 'demo_direction', 'direction@usine.demo.invalid', 'empreinte-tronquee', 'owner', true)`,
      [TENANT_DEMO]);
    await c.end();

    expect(await compter(url, 'equipment_registry', TENANT_DEMO)).toBe(0);

    const r = lancer(url);

    expect(r.code).toBe(0);
    // Le parc est là, et il n'y a pas deux organisations.
    expect(await compter(url, 'equipment_registry', TENANT_DEMO)).toBeGreaterThan(10);
    expect(await compter(url, 'tenants', TENANT_DEMO)).toBe(1);
  }, 300_000);

  it("refuse d'écrire dans une organisation qui n'est pas la sienne", async () => {
    const url = await baseJetable(`maintrix_test_usurpe_${STAMP}`);

    // Même identifiant, mais sans le marqueur : ce n'est pas notre jeu.
    const c = new Client({ connectionString: url });
    await c.connect();
    await c.query(
      `INSERT INTO tenants (id, name, domain, plan, is_active)
       VALUES ($1, 'Vraie organisation', 'vraie.fr', 'pro', true)`, [TENANT_DEMO]);
    await c.end();

    const r = lancer(url);

    expect(r.code).not.toBe(0);
    expect(r.sortie).toMatch(/marqueur/i);
    expect(await compter(url, 'equipment_registry', TENANT_DEMO)).toBe(0);
  }, 240_000);
});

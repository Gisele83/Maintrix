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
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { Client } from 'pg';
import { dirname, join } from 'node:path';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL absente — lancez `npm test`.');

const RACINE = join(__dirname, '..', '..');
const SCRIPT = join('scripts', 'jeu-de-demonstration.ts');
const SCRIPT_SECRETS = join('scripts', 'secrets-demonstration.ts');
const TSX = join(RACINE, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const TENANT_DEMO = '00000000-0000-4000-8000-0000000de401';

const STAMP = Date.now();
let adminUrl: string;
const basesCreees: string[] = [];
const depotsCrees: string[] = [];

/**
 * Un dépôt de secrets neuf, propre à ce cas.
 *
 * Aucun cas de cette suite ne doit toucher au dépôt par défaut : celui-ci
 * appartient au poste de développement, et l'écraser ferait perdre à
 * quelqu'un les secrets de SA démonstration en cours. `lancer()` en fournit
 * donc un à chaque appel, même aux cas qui ne s'y intéressent pas.
 */
function depotNeuf(): string {
  const dossier = mkdtempSync(join(tmpdir(), 'maintrix-depot-'));
  depotsCrees.push(dossier);
  return join(dossier, 'secrets.txt');
}

/** Ayants droit réellement accordés sur un fichier, selon le système. */
function ayantsDroit(chemin: string): string[] {
  if (process.platform !== 'win32') return [];
  const sortie = execFileSync(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'icacls.exe'), [chemin], { encoding: 'utf8' });
  const noms: string[] = [];
  for (const ligne of sortie.split(/\r?\n/)) {
    const nette = (ligne.startsWith(chemin) ? ligne.slice(chemin.length) : ligne).trim();
    if (!nette) break;
    const m = /^(.*?):\(/.exec(nette);
    if (m) noms.push(m[1]);
  }
  return noms;
}

/** Les secrets d'un dépôt, tels qu'ils y figurent. */
function secretsDuDepot(chemin: string): string[] {
  return [...readFileSync(chemin, 'utf8').matchAll(/(Demo-[A-Za-z0-9]{20,})/g)].map((m) => m[1]);
}

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

/** Lance un script du dépôt et rend son issue, sans jamais faire échouer le test. */
function lancerScript(script: string, args: string[], env: Record<string, string>) {
  try {
    const sortie = execFileSync(process.execPath, [TSX, script, ...args], {
      cwd: RACINE,
      env: { ...process.env, ...env },
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { code: 0, sortie };
  } catch (e) {
    const err = e as { status: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, sortie: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

/** Lance le chargeur. Le dépôt des secrets est isolé d'office — voir depotNeuf(). */
function lancer(url: string, args: string[] = [], env: Record<string, string> = {}) {
  return lancerScript(SCRIPT, args, {
    DATABASE_URL: url,
    MAINTRIX_DEMO_SECRETS_FICHIER: depotNeuf(),
    ...env,
  });
}

/** Lance la récupération des secrets sur un dépôt donné. */
function recuperer(depot: string, args: string[] = []) {
  return lancerScript(SCRIPT_SECRETS, args, { MAINTRIX_DEMO_SECRETS_FICHIER: depot });
}

/** Pose le marqueur d'environnement de test sur une base, comme le ferait un développeur. */
async function poserLeMarqueur(url: string): Promise<void> {
  const c = new Client({ connectionString: url });
  await c.connect();
  const nom = new URL(url).pathname.replace(/^\//, '');
  await c.query(`COMMENT ON DATABASE "${nom}" IS 'maintrix:environnement=test'`);
  await c.end();
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
  // Les dépôts contiennent des secrets en clair : on ne les laisse pas
  // derrière nous, même dans un répertoire temporaire.
  for (const dossier of depotsCrees) rmSync(dossier, { recursive: true, force: true });
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
    const depot = depotNeuf();
    const r = lancer(urlTest, [], { MAINTRIX_DEMO_SECRETS_FICHIER: depot });
    expect(r.code).toBe(0);

    // Lus dans le dépôt, PAS sur la sortie standard : c'est tout l'objet du
    // cas suivant.
    const secrets = secretsDuDepot(depot);
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

// ═══════════════════════════════════════════════════════════════════
/**
 * Le forçage demande-t-il bien DEUX choses ?
 *
 * La version précédente acceptait le forçage sur la seule présence de
 * `MAINTRIX_DEMO_FORCER=oui-je-sais-ce-que-je-fais`. Cette chaîne est écrite
 * en clair dans le script : connaître le dépôt suffisait à autoriser une
 * opération qui supprime des organisations entières.
 *
 * Les quatre cas ci-dessous mesurent les quatre combinaisons qui comptent :
 * ni l'une ni l'autre, l'intention seule, l'habilitation seule, les deux.
 * Seule la dernière doit passer.
 */
describe('Forçage — intention ET habilitation de la base', () => {
  const FORCER = { MAINTRIX_DEMO_FORCER: 'oui-je-sais-ce-que-je-fais' };

  it("REFUSE l'intention SEULE : la chaîne de forçage est publique", async () => {
    // Base au nom neutre, donc verdict « ambigu » : exactement le cas que le
    // forçage est censé pouvoir lever. Ni marqueur, ni liste.
    const url = await baseJetable(`maintrix_${STAMP}_force_nu`);
    const r = lancer(url, [], FORCER);

    expect(r.code).not.toBe(0);
    expect(r.sortie).toMatch(/habilitation/i);
    expect(r.sortie).toMatch(/DEUX choses/);
    // Et le message doit nommer ce qui manque — l'habilitation — sans
    // prétendre que l'intention manque, puisqu'elle est là.
    expect(r.sortie).toMatch(/✗ l'habilitation de la base/);
    expect(r.sortie).not.toMatch(/✗ l'intention/);
    expect(await compter(url, 'tenants', TENANT_DEMO)).toBe(0);
  }, 180_000);

  it("REFUSE l'habilitation SEULE : le marqueur n'est pas une intention", async () => {
    const url = await baseJetable(`maintrix_${STAMP}_marque_sans_force`);
    await poserLeMarqueur(url);
    const r = lancer(url);

    expect(r.code).not.toBe(0);
    expect(r.sortie).toMatch(/✗ l'intention/);
    expect(r.sortie).not.toMatch(/✗ l'habilitation/);
    expect(await compter(url, 'tenants', TENANT_DEMO)).toBe(0);
  }, 180_000);

  it('ACCEPTE le forçage quand la base PORTE LE MARQUEUR', async () => {
    const url = await baseJetable(`maintrix_${STAMP}_marque`);
    await poserLeMarqueur(url);
    const r = lancer(url, [], FORCER);

    expect(r.code).toBe(0);
    expect(r.sortie).toMatch(/Forçage accepté/);
    expect(r.sortie).toMatch(/marqueur posé sur la base/);
    // Accepté veut dire chargé : un forçage qui passe la garde sans rien
    // charger ne prouverait rien.
    expect(await compter(url, 'tenants', TENANT_DEMO)).toBe(1);
    expect(await compter(url, 'equipment_registry', TENANT_DEMO)).toBeGreaterThan(10);
  }, 300_000);

  it('ACCEPTE le forçage quand la base FIGURE DANS LA LISTE', async () => {
    const nom = `maintrix_${STAMP}_liste`;
    const url = await baseJetable(nom);
    const r = lancer(url, [], { ...FORCER, MAINTRIX_DEMO_BASES_AUTORISEES: `une_autre,${nom},encore_une` });

    expect(r.code).toBe(0);
    expect(r.sortie).toMatch(/Forçage accepté/);
    expect(r.sortie).toMatch(/liste MAINTRIX_DEMO_BASES_AUTORISEES/);
    expect(await compter(url, 'tenants', TENANT_DEMO)).toBe(1);
  }, 300_000);

  it("REFUSE une liste qui ne nomme pas CETTE base : pas de joker", async () => {
    const nom = `maintrix_${STAMP}_hors_liste`;
    const url = await baseJetable(nom);
    // Une liste non vide, mais qui parle d'autres bases. Le préfixe commun ne
    // doit rien donner : l'habilitation désigne une base, nommément.
    const r = lancer(url, [], { ...FORCER, MAINTRIX_DEMO_BASES_AUTORISEES: `maintrix_,maintrix_${STAMP}_hors_liste_bis,*` });

    expect(r.code).not.toBe(0);
    expect(r.sortie).toMatch(/ne figure pas dans la liste autorisée/);
    expect(await compter(url, 'tenants', TENANT_DEMO)).toBe(0);
  }, 180_000);

  it("le marqueur ne lève PAS un signal de production", async () => {
    // Les deux moitiés du forçage réunies, sur une base qui héberge un vrai
    // client. Le forçage ne lève que l'ambiguïté : ici, il ne doit rien lever.
    const nom = `maintrix_${STAMP}_marque_habitee`;
    const url = await baseJetable(nom);
    await poserLeMarqueur(url);
    const c = new Client({ connectionString: url });
    await c.connect();
    await c.query(
      `INSERT INTO tenants (id, name, domain, plan, is_active)
       VALUES ('55555555-5555-4555-8555-555555555555', 'Cimenterie Lahaye', 'lahaye.fr', 'pro', true)`);
    await c.query(
      `INSERT INTO equipment_registry (tenant_id, equipment_id, equipment_name, equipment_type)
       VALUES ('55555555-5555-4555-8555-555555555555', 'REEL-003', 'Broyeur à boulets', 'broyeur')`);
    await c.end();

    const r = lancer(url, ['--retirer'], { ...FORCER, MAINTRIX_DEMO_BASES_AUTORISEES: nom });

    expect(r.code).not.toBe(0);
    expect(r.sortie).toMatch(/PRODUCTION/i);
    // L'organisation cliente est intacte.
    expect(await compter(url, 'tenants')).toBe(1);
  }, 180_000);
});

// ═══════════════════════════════════════════════════════════════════
/**
 * Les secrets quittent-ils le processus par un canal, ou par la sortie ?
 *
 * Un secret tiré au hasard et publié sur la sortie standard n'est pas un
 * secret : cette sortie reste dans l'historique du terminal et, dès que la
 * commande est lancée par un outil, dans des journaux persistants que
 * personne ne relit mais que tout le monde peut lire.
 *
 * Ces cas mesurent donc deux choses distinctes : que les secrets ne sont PAS
 * là où ils étaient, et qu'ils SONT là où ils doivent être, avec les droits
 * qu'on prétend leur donner.
 */
describe('Canal des secrets', () => {
  let urlCanal: string;

  beforeAll(async () => {
    urlCanal = await baseJetable(`maintrix_test_canal_${STAMP}`);
  }, 180_000);

  it('la sortie standard ne contient AUCUN secret', async () => {
    const depot = depotNeuf();
    const r = lancer(urlCanal, [], { MAINTRIX_DEMO_SECRETS_FICHIER: depot });

    expect(r.code).toBe(0);
    // Le dépôt en contient quatre : la sortie, aucun. C'est la comparaison
    // qui fait la preuve — sans elle, une sortie vide pourrait simplement
    // signifier que rien n'a été généré.
    expect(secretsDuDepot(depot).length).toBe(4);
    expect(r.sortie).not.toMatch(/Demo-[A-Za-z0-9]{20,}/);
    // Elle dit en revanche où ils sont, sinon le canal serait inutilisable.
    expect(r.sortie).toContain(depot);
    expect(r.sortie).toMatch(/npm run demo:secrets/);
    // Et les adresses, qui ne sont pas des secrets, restent affichées.
    expect(r.sortie).toContain('direction@usine.demo.invalid');
  }, 300_000);

  it("le dépôt n'est accessible qu'à son propriétaire", async () => {
    const depot = depotNeuf();
    expect(lancer(urlCanal, [], { MAINTRIX_DEMO_SECRETS_FICHIER: depot }).code).toBe(0);

    if (process.platform === 'win32') {
      // `chmod` ne protège rien sous Windows : ce qui compte est l'ACL, et
      // une ACL restreinte n'a qu'une entrée — ni SYSTEM, ni les
      // administrateurs, ni le groupe Utilisateurs hérité du répertoire.
      expect(ayantsDroit(depot)).toHaveLength(1);
    } else {
      expect(statSync(depot).mode & 0o777).toBe(0o600);
    }
  }, 300_000);

  it('la récupération affiche les secrets UNE fois, puis efface le dépôt', async () => {
    const depot = depotNeuf();
    expect(lancer(urlCanal, [], { MAINTRIX_DEMO_SECRETS_FICHIER: depot }).code).toBe(0);
    const attendus = secretsDuDepot(depot);
    expect(attendus).toHaveLength(4);

    const r = recuperer(depot);

    expect(r.code).toBe(0);
    for (const secret of attendus) expect(r.sortie).toContain(secret);
    expect(existsSync(depot)).toBe(false);
  }, 300_000);

  it("une seconde récupération refuse, sans rien inventer", async () => {
    const depot = depotNeuf();
    expect(lancer(urlCanal, [], { MAINTRIX_DEMO_SECRETS_FICHIER: depot }).code).toBe(0);
    expect(recuperer(depot).code).toBe(0);

    const r = recuperer(depot);

    expect(r.code).not.toBe(0);
    expect(r.sortie).toMatch(/Aucun dépôt de secrets/);
    expect(r.sortie).not.toMatch(/Demo-[A-Za-z0-9]{20,}/);
  }, 300_000);

  it('--conserver affiche sans effacer, et le dit', async () => {
    const depot = depotNeuf();
    expect(lancer(urlCanal, [], { MAINTRIX_DEMO_SECRETS_FICHIER: depot }).code).toBe(0);

    const r = recuperer(depot, ['--conserver']);

    expect(r.code).toBe(0);
    expect(r.sortie).toMatch(/CONSERVÉ/);
    expect(existsSync(depot)).toBe(true);
    // Et il reste lisible une seconde fois, puisqu'il est encore là.
    expect(recuperer(depot).code).toBe(0);
    expect(existsSync(depot)).toBe(false);
  }, 300_000);

  it('un rechargement écarte le dépôt précédent et en pose un autre', async () => {
    const depot = depotNeuf();
    expect(lancer(urlCanal, [], { MAINTRIX_DEMO_SECRETS_FICHIER: depot }).code).toBe(0);
    const premiers = secretsDuDepot(depot);

    const second = lancer(urlCanal, [], { MAINTRIX_DEMO_SECRETS_FICHIER: depot });
    expect(second.code).toBe(0);
    expect(second.sortie).toMatch(/non récupéré a été écarté/);

    const seconds = secretsDuDepot(depot);
    expect(seconds).toHaveLength(4);
    // Aucun secret du premier chargement ne survit : les comptes ont été
    // recréés avec de nouvelles empreintes, un dépôt périmé serait un piège.
    for (const s of seconds) expect(premiers).not.toContain(s);
  }, 300_000);

  it('le retrait efface le dépôt : ces secrets n\'ouvrent plus rien', async () => {
    const depot = depotNeuf();
    expect(lancer(urlCanal, [], { MAINTRIX_DEMO_SECRETS_FICHIER: depot }).code).toBe(0);
    expect(existsSync(depot)).toBe(true);

    expect(lancer(urlCanal, ['--retirer'], { MAINTRIX_DEMO_SECRETS_FICHIER: depot }).code).toBe(0);
    expect(existsSync(depot)).toBe(false);
  }, 300_000);

  it('la désactivation efface le dépôt pour la même raison', async () => {
    const depot = depotNeuf();
    expect(lancer(urlCanal, [], { MAINTRIX_DEMO_SECRETS_FICHIER: depot }).code).toBe(0);

    const r = lancer(urlCanal, ['--desactiver'], { MAINTRIX_DEMO_SECRETS_FICHIER: depot });

    expect(r.code).toBe(0);
    expect(existsSync(depot)).toBe(false);
  }, 300_000);

  it("refuse de déposer à travers un lien, et n'écrit alors rien en base", async () => {
    // Un chemin qui n'est pas un fichier ordinaire : ici un répertoire, le
    // seul cas qu'on puisse fabriquer sans droit particulier sous Windows.
    // Si le canal le suivait, les secrets atterriraient ailleurs — là où
    // pointe le lien, éventuellement lisible par tous.
    const depot = depotNeuf();
    const urlNeuve = await baseJetable(`maintrix_test_lien_${STAMP}`);
    execFileSync(process.execPath, ['-e', `require('fs').mkdirSync(${JSON.stringify(depot)}, { recursive: true })`]);

    const r = lancer(urlNeuve, [], { MAINTRIX_DEMO_SECRETS_FICHIER: depot });

    expect(r.code).not.toBe(0);
    expect(r.sortie).toMatch(/n'est pas un fichier ordinaire/);
    // Et le refus a eu lieu AVANT le chargement : rien en base.
    expect(await compter(urlNeuve, 'tenants', TENANT_DEMO)).toBe(0);
    rmSync(dirname(depot), { recursive: true, force: true });
  }, 300_000);
});

// ═══════════════════════════════════════════════════════════════════
/**
 * Le retrait survit-il aux alertes — et le témoin y survit-il entier ?
 *
 * C'est par là que le défaut des alertes sans propriétaire s'est manifesté :
 * `effacer()` butait sur une contrainte de clé étrangère, parce que le moteur
 * d'alertes avait posé, sur un équipement de démonstration, des lignes que
 * personne ne savait rattacher. Le code ne produit plus de telles lignes,
 * mais une base ayant déjà tourné en porte : le cas ci-dessous en fabrique
 * une À LA MAIN, exprès, pour que le retrait reste éprouvé contre l'héritage
 * et pas seulement contre ce que le code écrit aujourd'hui.
 *
 * Le témoin, lui, est mesuré ENTIER : une empreinte table par table avant et
 * après. Vérifier que son équipement est toujours là ne prouverait rien sur
 * ses alertes, ses ordres de travail ou son magasin.
 */
describe('Retrait après génération d\'alertes', () => {
  it('efface les alertes du jeu, préserve le témoin dans son intégralité', async () => {
    const url = await baseJetable(`maintrix_test_alertes_${STAMP}`);
    expect(lancer(url).code).toBe(0);

    const TEMOIN = '66666666-6666-4666-8666-666666666666';
    const c = new Client({ connectionString: url });
    await c.connect();

    // ── Le témoin, avec de quoi mesurer sa préservation ──
    await c.query(
      `INSERT INTO tenants (id, name, domain, plan, is_active)
       VALUES ($1, 'Témoin Alertes SA', 'temoin-alertes.test.local', 'pro', true)`, [TEMOIN]);
    const { rows: eqTemoin } = await c.query(
      `INSERT INTO equipment_registry (tenant_id, equipment_id, equipment_name, equipment_type)
       VALUES ($1, 'TEM-ALR-001', 'Pompe témoin', 'pompe') RETURNING id`, [TEMOIN]);
    await c.query(
      `INSERT INTO alerts_notifications (tenant_id, equipment_id, alert_type, severity, title, message)
       VALUES ($1, $2, 'threshold', 'high', 'Alerte du témoin', 'doit survivre au retrait')`,
      [TEMOIN, eqTemoin[0].id]);

    // ── Côté démonstration : une alerte en règle, et une orpheline d'héritage ──
    const { rows: eqDemo } = await c.query(
      'SELECT id FROM equipment_registry WHERE tenant_id = $1 ORDER BY id LIMIT 1', [TENANT_DEMO]);
    await c.query(
      `INSERT INTO alerts_notifications (tenant_id, equipment_id, alert_type, severity, title, message)
       VALUES ($1, $2, 'anomaly', 'critical', 'Alerte de démonstration', 'posée en règle')`,
      [TENANT_DEMO, eqDemo[0].id]);
    await c.query(
      `INSERT INTO alerts_notifications (equipment_id, alert_type, severity, title, message)
       VALUES ($1, 'threshold', 'high', 'Alerte héritée sans locataire', 'comme avant la correction')`,
      [eqDemo[0].id]);

    /** Empreinte du témoin : combien de lignes lui appartiennent, table par table. */
    const empreinte = async () => {
      const tables = ['equipment_registry', 'alerts_notifications', 'work_orders',
        'spare_parts', 'iot_sensor_data', 'user_profiles'];
      const compte: Record<string, number> = {};
      for (const t of tables) {
        const { rows } = await c.query(
          `SELECT COUNT(*)::int n FROM ${t} WHERE tenant_id = $1`, [TEMOIN]);
        compte[t] = rows[0].n;
      }
      return compte;
    };
    const avant = await empreinte();
    expect(avant.alerts_notifications).toBe(1);
    expect(avant.equipment_registry).toBe(1);

    const r = lancer(url, ['--retirer']);
    expect(r.code).toBe(0);

    // Le jeu est parti, alertes comprises — y compris l'orpheline héritée,
    // qui est précisément celle qui bloquait le retrait.
    expect(await compter(url, 'alerts_notifications', TENANT_DEMO)).toBe(0);
    expect(await compter(url, 'equipment_registry', TENANT_DEMO)).toBe(0);
    const { rows: orphelines } = await c.query(
      "SELECT COUNT(*)::int n FROM alerts_notifications WHERE tenant_id IS NULL");
    expect(orphelines[0].n).toBe(0);

    // Le témoin est intact, table par table — pas seulement son équipement.
    expect(await empreinte()).toEqual(avant);
    const { rows: titre } = await c.query(
      'SELECT title FROM alerts_notifications WHERE tenant_id = $1', [TEMOIN]);
    expect(titre[0].title).toBe('Alerte du témoin');

    await c.end();
  }, 300_000);
});

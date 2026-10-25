/**
 * Le relevé de conformité CCTP mesure-t-il quelque chose ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ
 * ═══════════════════════════════════════════════════════════════════
 * Deux routes servaient un « état de conformité », et aucune ne mesurait
 * l'essentiel :
 *
 *   • `GET /api/cctp/tenant/:id/cctp-compliance/report` rendait un document
 *     HTML ENTIÈREMENT écrit en dur — « Score: 90% » et dix verdicts de
 *     conformité rédigés à la main, identiques pour tous les locataires. C'est
 *     la pièce qu'un industriel imprime pour l'opposer à un donneur d'ordre ;
 *   • `GET /api/cctp/tenant/:id/cctp-compliance` notait cinq exigences, dont
 *     DEUX écrites en dur à `compliant` / 100.
 *
 * Deux affirmations étaient FAUSSES, pas seulement non mesurées :
 *
 *   • « Isolation tenant par RLS PostgreSQL » — ce dépôt ne déclare aucune
 *     politique RLS. Le cloisonnement est fait en code applicatif, une colonne
 *     `tenant_id` par table, et c'est l'objet des migrations 0011 à 0022 ;
 *   • « Validation hiérarchique multi-niveaux opérationnelle » — jusqu'au
 *     2026-10-25, n'importe quel compte authentifié approuvait n'importe quoi.
 *
 * Et une exigence réellement mesurée l'était mal : `purchaseOrderConfig ? 100 : 0`
 * sur une colonne `jsonb DEFAULT '{}'`. `{}` étant TRUTHY, tout locataire neuf
 * était noté « Configuration complète » avec une configuration vide — le même
 * piège que F11 avait déjà corrigé dans `generatePurchaseDocument`.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE MESURE
 * ═══════════════════════════════════════════════════════════════════
 * Que le relevé SUIT L'ÉTAT RÉEL. La façon la plus directe de l'établir n'est
 * pas de comparer à des valeurs attendues codées en dur — ce serait remplacer
 * un chiffre inventé par un autre — mais de CHANGER l'état en base et de
 * vérifier que le relevé change avec lui, dans le sens voulu.
 *
 * Les comptes habilités sont de même comptés EN BASE au moment d'affirmer,
 * plutôt que déduits du contenu du seed : d'autres suites écrivent dans la même
 * base. On vérifie une propriété, pas une valeur.
 *
 * ⚠️ Cette suite ne se lance pas avec `jest` seul : `npm test` provisionne la
 * base, le serveur et les variables (voir scripts/run-tests.mjs).
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import {
  authenticateUser,
  createAuthenticatedRequest,
  SEEDED,
  type AuthenticatedAgent,
} from '../helpers/setup';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL absente — lancez `npm test`.');
const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

const STAMP = `CONF${Date.now()}`;

let alpha: AuthenticatedAgent;

interface Exigence {
  libelle?: string;
  status: string;
  score: number | null;
  details: string;
  verifiePar?: string;
}
interface Releve {
  tenantId: string;
  overallScore: number | null;
  exigencesMesurees: number;
  exigencesNonMesurees: number;
  requirements: Record<string, Exigence>;
}

/** Configuration de bon de commande d'Alpha, posée directement en base. */
async function poserConfig(config: unknown): Promise<void> {
  await pool.query(
    'UPDATE tenants SET purchase_order_config = $2::jsonb WHERE id = $1',
    [SEEDED.tenantAlpha, JSON.stringify(config)],
  );
}

async function relever(): Promise<Releve> {
  const r = await createAuthenticatedRequest(
    'get', `/api/cctp/tenant/${SEEDED.tenantAlpha}/cctp-compliance`, alpha,
  );
  expect(r.status).toBe(200);
  return r.body as Releve;
}

async function rapportHtml(): Promise<string> {
  const r = await createAuthenticatedRequest(
    'get', `/api/cctp/tenant/${SEEDED.tenantAlpha}/cctp-compliance/report`, alpha,
  );
  expect(r.status).toBe(200);
  return String(r.text ?? '');
}

/** Une configuration complète et cohérente. */
const CONFIG_UTILISABLE = {
  letterOrderThreshold: 1000,
  purchaseOrderThreshold: 5000,
  companyHeader: {
    name: `Alpha Industries ${STAMP}`,
    address: '1 rue des Essais', phone: '+33100000000', email: 'achats@alpha.test',
  },
  validationLevels: [
    { level: 1, name: 'Chef de Service', maxAmount: 2000, roleRequired: 'team_leader' },
    { level: 2, name: 'Directeur Maintenance', maxAmount: 10000, roleRequired: 'maintenance_manager' },
  ],
  autoGenerate: true,
  numberingPrefix: 'BC',
};

let configInitiale: unknown = null;

beforeAll(async () => {
  alpha = await authenticateUser(SEEDED.admin, SEEDED.password);
  const { rows } = await pool.query(
    'SELECT purchase_order_config AS c FROM tenants WHERE id = $1', [SEEDED.tenantAlpha],
  );
  configInitiale = rows[0]?.c ?? {};
}, 60_000);

afterAll(async () => {
  // Rendre la configuration telle qu'on l'a trouvée : les autres suites
  // partagent cette base.
  await poserConfig(configInitiale ?? {});
  await pool.end();
}, 60_000);

// ═══════════════════════════════════════════════════════════════════
describe('Le relevé suit la configuration réelle', () => {
  it("une configuration VIDE n'est plus notée « complète » — « {} » est truthy", async () => {
    // Le défaut exact : `purchase_order_config` vaut `'{}'::jsonb` par défaut,
    // et l'ancien test `config ? 100 : 0` y voyait une configuration présente.
    // Tout locataire nouvellement créé était donc noté 100 sur cette exigence.
    await poserConfig({});

    const releve = await relever();
    const exigence = releve.requirements.configurationBonsDeCommande;

    expect(exigence.status).toBe('missing');
    expect(exigence.score).toBe(0);
    // Et le détail le dit, au lieu d'annoncer « Configuration complète ».
    expect(exigence.details).toMatch(/entête|{}/i);
  }, 60_000);

  it('une configuration UTILISABLE est notée conforme, en citant ce qui a été lu', async () => {
    await poserConfig(CONFIG_UTILISABLE);

    const releve = await relever();
    const exigence = releve.requirements.configurationBonsDeCommande;

    expect(exigence.status).toBe('compliant');
    expect(exigence.score).toBe(100);
    // Le détail cite l'entête RÉELLEMENT enregistrée : c'est la preuve que la
    // valeur vient de la base et non du source.
    expect(exigence.details).toContain(STAMP);
    expect(exigence.details).toContain('2 niveau(x)');
  }, 60_000);

  it('le score global CHANGE avec la configuration — il est donc calculé', async () => {
    await poserConfig({});
    const avant = await relever();

    await poserConfig(CONFIG_UTILISABLE);
    const apres = await relever();

    expect(avant.overallScore).not.toBeNull();
    expect(apres.overallScore).not.toBeNull();
    // Deux exigences dépendent de cette configuration (la config elle-même et
    // l'échelle des plafonds) : le score doit monter, pas rester à 90.
    expect(apres.overallScore as number).toBeGreaterThan(avant.overallScore as number);
  }, 60_000);

  it("une échelle de plafonds incohérente est signalée, pas arrondie à conforme", async () => {
    // Niveau 2 dont le plafond ne dépasse pas celui du niveau 1 : l'échelon
    // supérieur n'apporte alors aucun pouvoir d'approbation supplémentaire.
    await poserConfig({
      ...CONFIG_UTILISABLE,
      validationLevels: [
        { level: 1, name: 'Chef de Service', maxAmount: 5000, roleRequired: 'team_leader' },
        { level: 2, name: 'Directeur', maxAmount: 5000, roleRequired: 'maintenance_manager' },
      ],
    });

    const releve = await relever();
    const exigence = releve.requirements.echelleDesPlafonds;

    expect(exigence.status).toBe('partial');
    expect(exigence.score).toBe(50);
    expect(exigence.details).toMatch(/ne dépasse pas/);
  }, 60_000);

  it("la dotation de la chaîne de validation correspond aux comptes EN BASE", async () => {
    // Compté ici plutôt que déduit du seed : la propriété vérifiée est
    // « le relevé dit ce que la base contient », pas « la base contient 3 ».
    const { rows: [compte] } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE can_validate_work_orders AND validation_level >= 1) AS ot,
         COUNT(*) FILTER (WHERE can_validate_purchase_orders AND validation_level >= 1) AS bc
       FROM user_profiles WHERE tenant_id = $1 AND is_active = true`,
      [SEEDED.tenantAlpha],
    );
    const ot = Number(compte.ot);
    const bc = Number(compte.bc);

    const releve = await relever();
    const exigence = releve.requirements.chaineDeValidationDotee;

    const attendu = ot > 0 && bc > 0 ? 'compliant' : (ot > 0 || bc > 0 ? 'partial' : 'missing');
    expect(exigence.status).toBe(attendu);
    expect(exigence.details).toContain(String(ot));
    expect(exigence.details).toContain(String(bc));
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
describe("Ce qui n'est pas mesuré est déclaré, pas noté", () => {
  it('les exigences non mesurables ne portent AUCUNE note', async () => {
    const releve = await relever();
    const nonMesurees = Object.entries(releve.requirements)
      .filter(([, e]) => e.status === 'non_mesure');

    // Elles existent, et elles sont nommées : les retirer laisserait croire que
    // le relevé couvre tout le CCTP.
    expect(nonMesurees.length).toBeGreaterThanOrEqual(3);

    for (const [cle, e] of nonMesurees) {
      // `null`, et non 0 : zéro est une note, « non mesuré » est une absence
      // de note.
      expect(e.score).toBeNull();
      // Et chacune dit où l'exigence est vraiment vérifiée.
      expect(e.verifiePar).toBeTruthy();
      expect(String(e.verifiePar)).not.toHaveLength(0);
      expect(cle).toBeTruthy();
    }

    expect(releve.exigencesNonMesurees).toBe(nonMesurees.length);
  }, 60_000);

  it('le cloisonnement ne se déclare plus conforme, et ne parle plus de RLS', async () => {
    const releve = await relever();
    const exigence = releve.requirements.cloisonnementParLocataire;

    expect(exigence.status).toBe('non_mesure');
    expect(exigence.score).toBeNull();
    // Le relevé renvoie vers ce qui le vérifie réellement.
    expect(String(exigence.verifiePar)).toMatch(/isolation|0011|0022/);
  }, 60_000);

  it('le score global ne moyenne QUE les exigences notées', async () => {
    const releve = await relever();
    const notees = Object.values(releve.requirements).filter((e) => e.score !== null);

    expect(releve.exigencesMesurees).toBe(notees.length);

    const attendu = Math.round(
      notees.reduce((somme, e) => somme + (e.score as number), 0) / notees.length,
    );
    // Si les non mesurées pesaient 100, la moyenne serait plus haute : c'est le
    // mécanisme exact qui produisait « 90 % ».
    expect(releve.overallScore).toBe(attendu);
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
describe('Le rapport imprimable rend le relevé, et rien de plus', () => {
  it("ni « 90 % », ni verdict écrit en dur, ni RLS", async () => {
    await poserConfig(CONFIG_UTILISABLE);
    const html = await rapportHtml();

    expect(html).not.toMatch(/Score:\s*90\s*%/);
    expect(html).not.toMatch(/RLS/);
    // Les dix verdicts rédigés à la main ont disparu avec le reste.
    expect(html).not.toMatch(/Isolation tenant par RLS|Ensemble ML avec 9 algorithmes/);
    expect(html).not.toMatch(/Conformité RGPD active/);
  }, 60_000);

  it('il porte le score mesuré et le nombre d\'exigences réellement notées', async () => {
    await poserConfig(CONFIG_UTILISABLE);
    const releve = await relever();
    const html = await rapportHtml();

    expect(html).toContain(`${releve.overallScore} %`);
    expect(html).toContain(`${releve.exigencesMesurees} exigence(s)`);
    // L'entête enregistrée se retrouve dans le document : il lit la base.
    expect(html).toContain(STAMP);
    // Et la réserve sur ce qui n'est pas mesuré y est écrite noir sur blanc.
    expect(html).toMatch(/NON MESURÉ ICI/);
    expect(html).toMatch(/ne les déclare pas conformes/);
  }, 60_000);

  it("une entête d'entreprise contenant du balisage est échappée", async () => {
    // `companyHeader.name` est écrit par l'administrateur du locataire via
    // `PUT /purchase-order-config`, et le relevé le CITE dans ses détails :
    // c'est donc une valeur d'utilisateur qui arrive dans ce HTML.
    await poserConfig({
      ...CONFIG_UTILISABLE,
      companyHeader: {
        ...CONFIG_UTILISABLE.companyHeader,
        name: `<script>alert(1)</script>${STAMP}`,
      },
    });

    const html = await rapportHtml();

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  }, 60_000);
});

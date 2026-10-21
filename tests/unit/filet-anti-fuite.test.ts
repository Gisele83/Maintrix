/**
 * Le filet anti-fuite : ce qu'il attrape, ce qu'il laisse passer, et sous
 * quel code de retour il refuse.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE VERROUILLE, ET POURQUOI ELLE ÉNONCE DES LIMITES
 * ═══════════════════════════════════════════════════════════════════
 * `antiLeakageValidator` a longtemps été présenté comme une garantie
 * d'isolation — le fichier qui le porte annonçait « ZERO DATA LEAKAGE » et
 * « 0% de fuite de données », et le rapport d'audit affichait l'isolation
 * multi-locataire en « OK ». Mesuré le 2026-10-21 : il n'inspecte que le
 * PREMIER NIVEAU de la charge, et laisse passer six des huit formes porteuses
 * d'une donnée étrangère. Sur les 158 routes de lecture qui ont servi une
 * charge réelle, 152 sont hors de sa portée.
 *
 * Cette suite est donc écrite à l'envers de l'habitude : la moitié de ses cas
 * affirme que le filet NE VOIT PAS. Ce n'est pas une concession, c'est le
 * point. Une limite qu'aucun test n'énonce se reprend pour une garantie à la
 * première relecture — c'est exactement ce qui s'est produit ici. Si un jour
 * l'un de ces cas « passe » devient « bloque », ce n'est pas une régression :
 * c'est que la décision documentée sur le middleware a changé, et le tableau
 * de ce fichier et celui du middleware doivent changer ensemble.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉCHOUE SUR LE CODE D'AVANT
 * ═══════════════════════════════════════════════════════════════════
 * Vérifié en rejouant cette suite contre le commit b5ed333 : 6 échecs,
 * 8 cas qui passent.
 *
 *   • objet plat refusé en 403            → 200 reçu, ÉCHEC
 *   • tableau de 1er niveau refusé en 403  → 200 reçu, ÉCHEC
 *   • ligne de SQL brut vue et refusée     → traverse intacte, ÉCHEC
 *   • le middleware ne promet plus zéro fuite  → promesse présente, ÉCHEC
 *   • le middleware nomme ses angles morts     → rien de nommé, ÉCHEC
 *   • le rapport d'audit ne l'annonce plus OK  → « OK », ÉCHEC
 *
 * Les cinq cas qui décrivent les angles morts, et les trois témoins, passent
 * AVANT comme APRÈS : ils documentent une limite inchangée et une absence de
 * régression, ils ne corrigent rien.
 *
 * Aucune base ni aucun serveur : le filet est monté dans une application
 * Express minimale. `server/db.ts` lève à l'import si `DATABASE_URL` est
 * absente, d'où l'URL factice et l'import différé ci-dessous — le pool
 * n'ouvre aucune connexion tant que personne ne l'interroge.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import express from 'express';
import request from 'supertest';
import type { Express, Response } from 'express';

const RACINE = join(__dirname, '..', '..');
const ALPHA = '00000000-0000-4000-8000-00000000a1fa';
const BETA = '00000000-0000-4000-8000-00000000be7a';

/** Les charges du tableau documenté sur `antiLeakageValidator`. */
const CHARGES: Record<string, (res: Response) => void> = {
  'objet-plat': (res) => res.json({ id: 1, tenantId: BETA, nom: 'PIECE DE BETA' }),
  'tableau-plat': (res) => res.json([{ id: 1, tenantId: BETA, motif: 'motif de Beta' }]),
  'sql-brut': (res) => res.json([{ id: 1, tenant_id: BETA, nom: 'LIGNE SQL DE BETA' }]),
  'tableau-imbrique': (res) => res.json({
    alerts: [{ id: 1, tenantId: BETA, nom: 'ROULEMENT SECRET DE BETA' }],
    recommendations: [],
  }),
  'objet-imbrique': (res) => res.json({ data: { id: 1, tenantId: BETA, nom: 'DONNEE DE BETA' } }),
  'tableau-2d': (res) => res.json([[{ id: 1, tenantId: BETA, nom: 'DONNEE DE BETA' }]]),
  'non-json': (res) => res.type('text/csv').send(`id,tenant_id,nom\n1,${BETA},PIECE DE BETA\n`),
  'projection': (res) => res.json({ available: true, currentStock: 1, shortage: 0 }),

  // Témoins : rien d'étranger. Sans eux, un filet qui bloquerait TOUT
  // passerait pour un filet qui bloque bien.
  'temoin-objet': (res) => res.json({ id: 1, tenantId: ALPHA, nom: 'MA PIECE' }),
  'temoin-tableau': (res) => res.json([{ id: 1, tenantId: ALPHA, nom: 'MA PIECE' }]),
  'temoin-agregat': (res) => res.json({ total: 42, moyenne: 3.5 }),
};

let app: Express;

beforeAll(async () => {
  // Posée avant l'import : server/db.ts refuse de se charger sans elle.
  process.env.DATABASE_URL ||= 'postgresql://inutilise:inutilise@127.0.0.1:1/inutilise';

  const { antiLeakageValidator } = await import('../../server/tenant-security-middleware');

  app = express();
  app.use((req, _res, next) => { (req as any).tenantId = ALPHA; next(); });
  app.use(antiLeakageValidator);
  for (const [nom, servir] of Object.entries(CHARGES)) {
    app.get(`/${nom}`, (_req, res) => servir(res));
  }
});

const BLOCAGE = 'CROSS_TENANT_DATA_DETECTED';

// ═══════════════════════════════════════════════════════════════════
describe('Un blocage se voit au code de retour, pas seulement dans le corps', () => {
  /*
   * Le défaut central : le filet répondait **200** avec un corps d'erreur. Un
   * client ne pouvait pas distinguer ce refus d'un succès sans inspecter le
   * corps — `res.ok` était vrai, le `.map` qui suivait tombait, et /dashboard
   * se rendait entièrement blanc (mesuré le 2026-10-20). La convention du
   * dépôt, posée au lot D5, est 403 = refusé, 404 = absent.
   */
  it('un objet plat portant un locataire étranger est refusé en 403', async () => {
    const res = await request(app).get('/objet-plat');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(BLOCAGE);
    // Le corps de la fuite ne doit pas traverser, même accompagné de l'erreur.
    expect(res.text).not.toContain('PIECE DE BETA');
  });

  it('un tableau de premier niveau est refusé en 403', async () => {
    const res = await request(app).get('/tableau-plat');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(BLOCAGE);
    expect(res.text).not.toContain('motif de Beta');
  });

  it("une ligne de SQL brut (`tenant_id`) est vue, et refusée en 403", async () => {
    /*
     * Drizzle rend `tenantId`, mais les lectures en SQL brut rendent
     * `tenant_id` — 166 occurrences dans server/. Ne contrôler que la première
     * orthographe rendait le filet aveugle au format de ligne le plus répandu
     * du dépôt : cette charge traversait intacte.
     */
    const res = await request(app).get('/sql-brut');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(BLOCAGE);
    expect(res.text).not.toContain('LIGNE SQL DE BETA');
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Ce que le filet ne voit pas — limites énoncées, pas corrigées', () => {
  /*
   * Quatre formes mesurées le 2026-10-21. Les deux dernières resteraient
   * invisibles à TOUTE profondeur de parcours : une projection calculée sur
   * les lignes d'autrui ne porte aucun marqueur, et un export n'est pas du
   * JSON. C'est la raison de fond pour laquelle ce filet ne peut pas servir de
   * garantie d'isolation, et pour laquelle il n'est pas devenu récursif (voir
   * la décision documentée sur `antiLeakageValidator`).
   */
  it('un tableau imbriqué sous une clé traverse', async () => {
    // La charge de /api/stock/alerts/low-stock, qui a bien fui pendant la
    // campagne : `{ alerts: [...], recommendations: [...] }`.
    const res = await request(app).get('/tableau-imbrique');
    expect(res.status).toBe(200);
    expect(res.body.alerts[0].nom).toBe('ROULEMENT SECRET DE BETA');
  });

  it('un objet imbriqué sous une clé traverse', async () => {
    const res = await request(app).get('/objet-imbrique');
    expect(res.status).toBe(200);
    expect(res.body.data.tenantId).toBe(BETA);
  });

  it('un tableau à deux niveaux traverse', async () => {
    const res = await request(app).get('/tableau-2d');
    expect(res.status).toBe(200);
    expect(res.body[0][0].tenantId).toBe(BETA);
  });

  it('une charge non-JSON traverse (CSV, Excel, PDF)', async () => {
    // Cinq routes de lecture servent un export : /api/comprehensive-report/pdf,
    // /api/comprehensive-report/excel, /api/export/equipment-types et deux
    // gabarits CSV. Aucune n'est inspectable par un détecteur JSON.
    const res = await request(app).get('/non-json');
    expect(res.status).toBe(200);
    expect(res.text).toContain(BETA);
  });

  it("une projection sans identifiant de locataire traverse", async () => {
    // La charge de /api/stock/:id/availability/:qty : `{ available,
    // currentStock, shortage }`. La donnée EST celle d'un autre locataire,
    // mais rien dans la réponse ne le dit. 142 des 158 charges mesurées sont
    // dans ce cas.
    const res = await request(app).get('/projection');
    expect(res.status).toBe(200);
    expect(res.body.currentStock).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe("Témoins — le filet ne bloque pas ce qui est légitime", () => {
  it('un objet du demandeur traverse intact', async () => {
    const res = await request(app).get('/temoin-objet');
    expect(res.status).toBe(200);
    expect(res.body.nom).toBe('MA PIECE');
  });

  it('un tableau du demandeur traverse intact', async () => {
    const res = await request(app).get('/temoin-tableau');
    expect(res.status).toBe(200);
    expect(res.body[0].nom).toBe('MA PIECE');
  });

  it('un agrégat sans identifiant de locataire traverse intact', async () => {
    const res = await request(app).get('/temoin-agregat');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(42);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe("Rien ne présente plus ce filet comme une garantie", () => {
  /*
   * La contrepartie d'assumer que ce filet n'est qu'une alarme : plus aucune
   * promesse de cloisonnement total ne doit subsister dans le dépôt. Sans ces
   * trois cas, la documentation redériverait vers « OK » à la première
   * relecture — c'est ainsi que la formule « 0% de fuite » a survécu.
   */
  const MIDDLEWARE = join(RACINE, 'server', 'tenant-security-middleware.ts');

  it('le middleware ne promet plus zéro fuite', () => {
    const source = readFileSync(MIDDLEWARE, 'utf8');
    for (const promesse of ['ZERO DATA LEAKAGE', '0% de fuite', 'Empêche tout accès inter-tenant']) {
      expect(source).not.toContain(promesse);
    }
  });

  it('le middleware nomme ce qu\'il ne couvre pas', () => {
    const source = readFileSync(MIDDLEWARE, 'utf8');
    // Les trois classes d'angle mort doivent être nommées à l'endroit où un
    // relecteur arrive : au-dessus du middleware lui-même.
    expect(source).toMatch(/alarme de dernier recours|ALARME/i);
    expect(source).toContain('imbriqué');
    expect(source).toContain('non-JSON');
    expect(source).toContain('projection');
  });

  it("le rapport d'audit n'annonce plus l'isolation comme acquise", () => {
    const rapport = readFileSync(join(RACINE, 'server', 'security-audit-report.ts'), 'utf8');
    const item = rapport.split('\n').find(l => l.includes("label: 'Isolation multi-tenant'"));
    expect(item).toBeDefined();
    // L'item annonçait « OK » avec pour justification « tenantId sur toutes
    // les requêtes DB » — une affirmation que la campagne a réfutée.
    expect(item).not.toContain("status: 'OK'");
    expect(item).not.toContain('tenantId sur toutes les requêtes DB');
  });
});

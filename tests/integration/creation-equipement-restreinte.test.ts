/**
 * Inscrire un équipement au référentiel du parc est définitif.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT
 * ═══════════════════════════════════════════════════════════════════
 * `POST /api/equipment` n'avait AUCUN contrôle de rôle. En posant la
 * restriction de l'import en masse, l'écart avait été assumé — « la
 * restriction porte sur le volume, pas sur le geste ». Il est fermé sur
 * décision de l'utilisateur, et le relevé fait pour ce lot a montré que
 * l'argument était plus fort que prévu : **il n'existe aucune route de
 * suppression d'équipement**. Une inscription erronée est donc définitive.
 *
 * Le même relevé a trouvé une SECONDE porte, invisible depuis l'URL :
 * `POST /api/work-orders` avec un `equipmentName` inconnu inscrivait
 * silencieusement un équipement dégradé (`equipmentType: 'Generic'`, lieu
 * « Non spécifié »). Un chef d'équipe (2) peuplait donc le parc par la route
 * des ordres de travail — la garde de `POST /api/equipment` aurait été
 * contournable d'une faute de frappe.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE VERROUILLE
 * ═══════════════════════════════════════════════════════════════════
 *   1. les DEUX portes refusent sous `maintenance_manager` ;
 *   2. le seuil est strictement au-dessus de `team_leader` (2) et de
 *      `procurement` (3) ;
 *   3. sur refus, AUCUNE ligne n'apparaît dans `equipment_registry` ;
 *   4. le refus de la seconde porte ne casse PAS la création d'ordre : un chef
 *      d'équipe crée toujours un ordre sur un équipement EXISTANT. C'est le
 *      cœur du lot — restreindre l'inscription sans amputer l'arbitrage ;
 *   5. témoin — un responsable maintenance inscrit toujours, et la ligne porte
 *      son locataire.
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
import { NIVEAU_CREATION_EQUIPEMENT } from '@shared/creation-equipement';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL absente — lancez `npm test`.');
const pool = new Pool({ connectionString: DATABASE_URL, max: 6 });

const STAMP = `EQR${Date.now()}`;

let technicien: AuthenticatedAgent;    // 1
let chefEquipe: AuthenticatedAgent;    // 2 — crée des ORDRES, pas du référentiel
let achats: AuthenticatedAgent;        // 3
let responsable: AuthenticatedAgent;   // 4 — le seuil retenu

/**
 * Les rôles sous le seuil, en ACCESSEURS DIFFÉRÉS et non en valeurs.
 *
 * La boucle `for` qui s'en sert tourne au moment où Jest COLLECTE les tests,
 * donc avant `beforeAll` : capturer les agents ici les figerait à `undefined`,
 * et chaque test échouerait sur une erreur sans rapport avec ce qu'il mesure.
 */
const SOUS_LE_SEUIL = [
  ['technicien (1)', () => technicien],
  ["chef d'équipe (2)", () => chefEquipe],
  ['achats (3)', () => achats],
] as const;

const inscrire = (auth: AuthenticatedAgent, suffixe: string) =>
  createAuthenticatedRequest('post', '/api/equipment', auth).send({
    equipmentId: `EQ-${STAMP}-${suffixe}`,
    equipmentName: `PARC-${STAMP}-${suffixe}`,
    equipmentType: 'Pompe hydraulique',
    zone: 'Zone restriction',
    location: 'Atelier',
    criticalityLevel: 'medium',
    operationalState: 'operational',
  });

/** Les équipements de cette suite, repérés par leur nom. */
async function inscrits(suffixe: string): Promise<Array<{ tenant_id: string | null }>> {
  const { rows } = await pool.query<{ tenant_id: string | null }>(
    `SELECT tenant_id FROM equipment_registry WHERE equipment_name = $1`,
    [`PARC-${STAMP}-${suffixe}`],
  );
  return rows;
}

/** Un équipement existant, créé hors HTTP pour servir de cible aux ordres. */
async function equipementExistant(): Promise<{ id: number; nom: string }> {
  const nom = `PARC-${STAMP}-cible`;
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO equipment_registry (tenant_id, equipment_id, equipment_name, equipment_type, location)
     VALUES ($1, $2, $3, 'pompe', 'Atelier restriction') RETURNING id`,
    [SEEDED.tenantAlpha, `EQ-${STAMP}-cible`, nom],
  );
  return { id: rows[0].id, nom };
}

beforeAll(async () => {
  technicien = await authenticateUser(SEEDED.technician, SEEDED.password);
  chefEquipe = await authenticateUser(SEEDED.validateurN1, SEEDED.password);
  achats = await authenticateUser(SEEDED.validateurN3, SEEDED.password);
  responsable = await authenticateUser(SEEDED.validateurN2, SEEDED.password);
});

afterAll(async () => {
  // Les ordres référencent les équipements : on les retire d'abord, sinon la
  // clé étrangère refuse la suppression (défaut déjà rencontré sur ce dépôt).
  await pool.query(`DELETE FROM work_orders WHERE title LIKE $1`, [`ORDRE-${STAMP}-%`]);
  await pool.query(`DELETE FROM equipment_registry WHERE equipment_name LIKE $1`, [`PARC-${STAMP}-%`]);
  await pool.end();
});

describe('Le seuil retenu', () => {
  it('est `maintenance_manager`, comme celui de l\'import en masse', () => {
    // Même acte — inscrire au référentiel — à des volumes différents. Deux
    // seuils distincts rendraient l'ajout d'une machine plus difficile que
    // celui de cent.
    expect(NIVEAU_CREATION_EQUIPEMENT).toBe('maintenance_manager');
  });
});

describe('Porte 1 — POST /api/equipment', () => {
  for (const [libelle, qui] of SOUS_LE_SEUIL) {
    it(`refuse ${libelle}, et n'écrit rien`, async () => {
      const suffixe = `p1-${libelle.replace(/\W+/g, '')}`;
      const res = await inscrire(qui(), suffixe);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
      // La preuve n'est pas le code de retour mais l'absence de la ligne.
      expect(await inscrits(suffixe)).toHaveLength(0);
    });
  }

  it('le refus nomme le niveau et le geste qui reste ouvert', async () => {
    const res = await inscrire(technicien, 'p1-message');

    expect(res.status).toBe(403);
    expect(res.body.niveauRequis).toBe('maintenance_manager');
    expect(res.body.alternative).toBe('/api/demandes-intervention');
    // Le motif réel — l'irréversibilité — doit être dit, pas sous-entendu.
    expect(res.body.message).toMatch(/aucune suppression/i);
  });

  it('témoin : un responsable inscrit, et la ligne porte son locataire', async () => {
    const res = await inscrire(responsable, 'p1-temoin');

    expect([200, 201]).toContain(res.status);
    const lignes = await inscrits('p1-temoin');
    expect(lignes).toHaveLength(1);
    expect(lignes[0].tenant_id).toBe(SEEDED.tenantAlpha);
  });
});

describe('Porte 2 — la création implicite par POST /api/work-orders', () => {
  /**
   * DEUX barrières différentes, selon le rôle — et c'est le constat mesuré, pas
   * une supposition. Un technicien (1) ne peut pas créer d'ordre du tout : il
   * est arrêté par la garde de `POST /api/work-orders` (`team_leader`) et
   * n'atteint JAMAIS la branche qui inscrit l'équipement. Un chef d'équipe (2)
   * et les achats (3) franchissent cette première garde, et c'est alors la
   * seconde qui les arrête.
   *
   * Distinguer les deux importe : ne tester que le technicien aurait donné un
   * 403 rassurant qui ne prouve RIEN sur la porte dérobée, puisque l'appelant
   * ne l'avait pas atteinte.
   */
  const FRANCHISSENT_LA_GARDE_DES_ORDRES = [
    ["chef d'équipe (2)", () => chefEquipe],
    ['achats (3)', () => achats],
  ] as const;

  it("un technicien est arrêté AVANT cette porte, par la garde des ordres", async () => {
    const res = await createAuthenticatedRequest('post', '/api/work-orders', technicien).send({
      title: `ORDRE-${STAMP}-p2-tech`,
      description: 'Ordre visant un équipement absent du référentiel.',
      equipmentName: `PARC-${STAMP}-p2-tech`,
      category: 'Correctif',
    });

    expect(res.status).toBe(403);
    // Le refus vient de la création d'ordre, pas de l'inscription : il renvoie
    // donc vers la demande d'intervention, et ne nomme aucun champ.
    expect(res.body.alternative).toBe('/api/demandes-intervention');
    expect(res.body.champ).toBeUndefined();
    expect(await inscrits('p2-tech')).toHaveLength(0);
  });

  for (const [libelle, qui] of FRANCHISSENT_LA_GARDE_DES_ORDRES) {
    it(`un equipmentName inconnu est refusé à ${libelle}, sans rien inscrire`, async () => {
      const suffixe = `p2-${libelle.replace(/\W+/g, '')}`;
      const res = await createAuthenticatedRequest('post', '/api/work-orders', qui()).send({
        title: `ORDRE-${STAMP}-${suffixe}`,
        description: 'Ordre visant un équipement absent du référentiel.',
        equipmentName: `PARC-${STAMP}-${suffixe}`,
        category: 'Correctif',
      });

      expect(res.status).toBe(403);
      // `champ` atteste que c'est bien la SECONDE garde qui a parlé : celui-ci
      // avait le droit de créer l'ordre.
      expect(res.body.champ).toBe('equipmentName');
      // Rien d'inscrit — c'était la porte dérobée.
      expect(await inscrits(suffixe)).toHaveLength(0);
    });
  }

  it("le message désigne l'équipement demandé, pas un « droits insuffisants » opaque", async () => {
    const res = await createAuthenticatedRequest('post', '/api/work-orders', chefEquipe).send({
      title: `ORDRE-${STAMP}-p2-msg`,
      description: 'Contrôle du message.',
      equipmentName: `PARC-${STAMP}-p2-msg`,
      category: 'Correctif',
    });

    expect(res.status).toBe(403);
    // L'appelant A le droit de créer l'ordre : le refus doit lui dire que
    // c'est l'INSCRIPTION qui bloque, et quoi faire à la place.
    expect(res.body.message).toContain(`PARC-${STAMP}-p2-msg`);
    expect(res.body.message).toMatch(/choisissez un équipement existant/i);
  });

  it("CŒUR DU LOT : un chef d'équipe crée toujours un ordre sur un équipement EXISTANT", async () => {
    const cible = await equipementExistant();

    const res = await createAuthenticatedRequest('post', '/api/work-orders', chefEquipe).send({
      title: `ORDRE-${STAMP}-p2-ok`,
      description: "L'arbitrage n'est pas amputé par la restriction du référentiel.",
      equipmentId: cible.id,
      category: 'Correctif',
    });

    // Sans ce test, une restriction qui aurait cassé la création d'ordre
    // passerait pour un succès.
    expect([200, 201]).toContain(res.status);

    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM work_orders WHERE title = $1`,
      [`ORDRE-${STAMP}-p2-ok`],
    );
    expect(Number(rows[0].n)).toBe(1);
  });

  it('un responsable peut toujours inscrire par cette porte', async () => {
    const res = await createAuthenticatedRequest('post', '/api/work-orders', responsable).send({
      title: `ORDRE-${STAMP}-p2-resp`,
      description: 'Inscription implicite, autorisée au niveau requis.',
      equipmentName: `PARC-${STAMP}-p2-resp`,
      category: 'Correctif',
    });

    expect([200, 201]).toContain(res.status);
    expect(await inscrits('p2-resp')).toHaveLength(1);
  });
});

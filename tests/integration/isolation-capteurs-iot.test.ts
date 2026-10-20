/**
 * Les relevés de capteurs d'un locataire restent-ils chez lui — et servent-ils
 * bien à calculer SON équipement ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ
 * ═══════════════════════════════════════════════════════════════════
 * `iot_sensor_data` ne portait pas de `tenant_id`. Le recensement de ses
 * lectures a montré deux familles de défauts, et la seconde n'est pas une
 * question d'isolation :
 *
 *   • FUITES. `getIotSensorData(equipmentId?)` avait un équipement FACULTATIF :
 *     appelée sans lui par `GET /api/iot-data`, elle partait sans aucune
 *     condition. `POST /api/equipment/:id/predict`,
 *     `POST /api/advanced-diagnostic` et `/api/equipment/:id/sensor-data`
 *     prenaient l'équipement de la requête sans vérifier à qui il appartient.
 *     `/api/jsd/global-status` agrégeait toute l'instance.
 *
 *   • CHIFFRES SANS OBJET. `/api/jsd/equipment/:id` et
 *     `/api/stochastic-rul/equipment/:id` recevaient un identifiant
 *     d'équipement, le renvoyaient dans leur réponse — et ne s'en servaient
 *     JAMAIS dans la requête. Leur seule condition était une fenêtre
 *     temporelle. La dérive et la DURÉE DE VIE RESTANTE annoncées pour un
 *     équipement étaient donc ajustées sur les relevés mêlés de tout le parc de
 *     tous les locataires. Un exploitant pouvait lire « il reste tant de jours »
 *     sur une machine dont aucune mesure n'était entrée dans le calcul.
 *
 * ═══════════════════════════════════════════════════════════════════
 * COMMENT C'EST VÉRIFIÉ
 * ═══════════════════════════════════════════════════════════════════
 * Les deux routes de calcul exposent le nombre de relevés qui ont alimenté le
 * résultat (`totalReadings`, `nReadings`). C'est la mesure la plus directe du
 * défaut : avant, ce nombre comptait les relevés de tout le monde.
 *
 * Les comptes attendus sont relus EN BASE au moment d'affirmer, et non codés en
 * dur : d'autres suites et le simulateur IoT écrivent dans la même base. On
 * vérifie donc une propriété — « ce calcul a vu exactement les relevés de CET
 * équipement, et strictement moins que tout ce qui existe » — plutôt qu'une
 * valeur qui dépendrait de l'ordre des suites.
 *
 * Les relevés portent un `sensor_id` marqué, ce qui permet en plus de chercher
 * nommément ceux de Beta dans ce qui est rendu à Alpha.
 *
 * ⚠️ Cette suite ne se lance pas avec `jest` seul : `npm test` provisionne la
 * base, le serveur et les variables (voir scripts/run-tests.mjs).
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import {
  anonymousRequest,
  authenticateUser,
  createAuthenticatedRequest,
  SEEDED,
  type AuthenticatedAgent,
} from '../helpers/setup';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL absente — lancez `npm test`.');
const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

const STAMP = `IOT${Date.now()}`;

/** Volumes distincts, pour qu'aucune confusion ne passe pour une égalité. */
const RELEVES_ALPHA_EQ1 = 12;
const RELEVES_ALPHA_EQ2 = 7;
const RELEVES_BETA = 40;

let alpha: AuthenticatedAgent;
let beta: AuthenticatedAgent;

let eqAlpha1 = 0;
let eqAlpha2 = 0;
let eqBeta = 0;

async function creerEquipement(tenantId: string, suffixe: string): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO equipment_registry (tenant_id, equipment_id, equipment_name, equipment_type)
     VALUES ($1, $2, $3, 'Pompe') RETURNING id`,
    [tenantId, `EQ-${STAMP}-${suffixe}`, `Équipement ${suffixe} ${STAMP}`],
  );
  return rows[0].id;
}

/**
 * Relevés étalés sur un jour chacun : `/api/stochastic-rul` regroupe par
 * tranches de 24 h et exige au moins trois tranches distinctes pour ajuster
 * quoi que ce soit.
 */
async function creerReleves(tenantId: string, equipmentId: number | null, suffixe: string, combien: number) {
  for (let i = 0; i < combien; i++) {
    await pool.query(
      `INSERT INTO iot_sensor_data
         (tenant_id, equipment_id, sensor_type, sensor_id, value, unit, timestamp, quality, alarm_state)
       VALUES ($1, $2, 'temperature', $3, $4, '°C', now() - ($5 || ' days')::interval, 'good', 'normal')`,
      [tenantId, equipmentId, `CAPT-${STAMP}-${suffixe}`, (40 + i * 1.5).toFixed(2), String(i)],
    );
  }
}

/** Nombre de relevés marqués, en base, pour un locataire et un équipement. */
async function compter(where: string, params: unknown[]): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS c FROM iot_sensor_data WHERE sensor_id LIKE $1 AND ${where}`,
    [`CAPT-${STAMP}-%`, ...params],
  );
  return rows[0].c;
}

beforeAll(async () => {
  alpha = await authenticateUser(SEEDED.admin, SEEDED.password);
  beta = await authenticateUser(SEEDED.adminBeta, SEEDED.password);

  eqAlpha1 = await creerEquipement(SEEDED.tenantAlpha, 'A1');
  eqAlpha2 = await creerEquipement(SEEDED.tenantAlpha, 'A2');
  eqBeta = await creerEquipement(SEEDED.tenantBeta, 'B1');

  await creerReleves(SEEDED.tenantAlpha, eqAlpha1, 'A1', RELEVES_ALPHA_EQ1);
  await creerReleves(SEEDED.tenantAlpha, eqAlpha2, 'A2', RELEVES_ALPHA_EQ2);
  await creerReleves(SEEDED.tenantBeta, eqBeta, 'B1', RELEVES_BETA);

  // Un relevé SANS équipement, chez Alpha : c'est le cas qu'un cloisonnement
  // par jointure sur equipment_registry aurait fait disparaître de la vue de
  // son propre propriétaire au lieu de le protéger.
  await creerReleves(SEEDED.tenantAlpha, null, 'ORPH', 1);
});

afterAll(async () => {
  await pool.query('DELETE FROM iot_sensor_data WHERE sensor_id LIKE $1', [`CAPT-${STAMP}-%`]);
  await pool.query('DELETE FROM equipment_registry WHERE equipment_id LIKE $1', [`EQ-${STAMP}-%`]);
  await pool.end();
});

// ═══════════════════════════════════════════════════════════════════
describe('Dérive conceptuelle : le calcul ne voit que SON équipement', () => {
  it("Alpha obtient une dérive calculée sur ses 12 relevés, pas sur les 60 de l'instance", async () => {
    const res = await createAuthenticatedRequest(
      'get', `/api/jsd/equipment/${eqAlpha1}?windowDays=30&windowSize=3`, alpha,
    );

    expect(res.status).toBe(200);

    const attendu = await compter('tenant_id = $2 AND equipment_id = $3', [SEEDED.tenantAlpha, eqAlpha1]);
    const total = await compter('1 = 1', []);

    // Le cœur du défaut : ce nombre comptait tous les relevés de la période.
    expect(res.body.totalReadings).toBe(attendu);
    expect(res.body.totalReadings).toBe(RELEVES_ALPHA_EQ1);
    expect(res.body.totalReadings).toBeLessThan(total);
  });

  it("Beta ne tire aucune dérive de l'équipement d'Alpha", async () => {
    const res = await createAuthenticatedRequest(
      'get', `/api/jsd/equipment/${eqAlpha1}?windowDays=30&windowSize=3`, beta,
    );

    expect(res.status).toBe(200);
    // Aucun relevé visible : la route répond sa forme « pas de données » plutôt
    // que de calculer sur le parc d'autrui.
    expect(res.body.totalReadings ?? 0).toBe(0);
    expect(res.body.globalDrift).toBe(0);
  });

  it("l'état global d'Alpha ne mentionne pas un capteur propre à Beta", async () => {
    // ⚠️ Cette route ne regarde que les DERNIÈRES 24 H, et le simulateur IoT du
    // serveur y insère en continu : comparer son `totalReadings` à un compte
    // relevé en base serait une course, pas une vérification. On s'appuie donc
    // sur `perSensor`, qui est indexé par TYPE de capteur : Beta reçoit un type
    // qui n'existe que chez lui, et ce type ne doit pas apparaître dans l'état
    // global rendu à Alpha. La propriété est exacte et ne dépend d'aucun
    // volume.
    const typeBeta = `vib-${STAMP}`;
    await pool.query(
      `INSERT INTO iot_sensor_data
         (tenant_id, equipment_id, sensor_type, sensor_id, value, unit, timestamp, quality, alarm_state)
       VALUES ($1, $2, $3, $4, '3.20', 'mm/s', now(), 'good', 'normal')`,
      [SEEDED.tenantBeta, eqBeta, typeBeta, `CAPT-${STAMP}-BVIB`],
    );

    const res = await createAuthenticatedRequest('get', '/api/jsd/global-status', alpha);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.perSensor ?? {})).not.toContain(typeBeta);

    // Et Beta, lui, le voit : le refus ci-dessus vise le locataire, pas le
    // capteur — sans quoi le test passerait aussi sur une route cassée.
    const vuParBeta = await createAuthenticatedRequest('get', '/api/jsd/global-status', beta);
    expect(Object.keys(vuParBeta.body.perSensor ?? {})).toContain(typeBeta);
  });

  it("sans session, aucune dérive n'est servie", async () => {
    const res = await anonymousRequest('get', `/api/jsd/equipment/${eqAlpha1}`);
    expect([401, 403]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('RUL stochastique : la durée de vie restante porte sur le bon équipement', () => {
  it("Alpha obtient un RUL ajusté sur ses 12 relevés", async () => {
    const res = await createAuthenticatedRequest(
      'get', `/api/stochastic-rul/equipment/${eqAlpha1}?windowDays=90`, alpha,
    );

    expect(res.status).toBe(200);

    // C'est la grandeur la plus lourde de conséquences du lot : avant, elle
    // était ajustée sur les relevés mêlés de tout le parc de tous les
    // locataires, puis étiquetée du nom de cet équipement.
    expect(res.body.nReadings).toBe(RELEVES_ALPHA_EQ1);
    expect(res.body.equipmentName).toContain(STAMP);
  });

  it("Beta n'obtient ni RUL ni nom pour l'équipement d'Alpha", async () => {
    const res = await createAuthenticatedRequest(
      'get', `/api/stochastic-rul/equipment/${eqAlpha1}?windowDays=90`, beta,
    );

    expect(res.status).toBe(200);
    expect(res.body.nReadings ?? 0).toBe(0);
    expect(res.body.result).toBeNull();
    // Le nom de l'équipement d'Alpha ne doit pas filtrer non plus : la lecture
    // de equipment_registry est désormais bornée au locataire, et la route
    // retombe sur son libellé par défaut.
    expect(res.body.equipmentName ?? '').not.toContain(STAMP);
  });
});

// ═══════════════════════════════════════════════════════════════════
describe('Lecture brute des relevés', () => {
  it("sans équipement précisé, Alpha ne reçoit que ses propres relevés", async () => {
    // C'était la fuite la plus simple : l'équipement étant facultatif, la
    // requête partait sans la moindre condition.
    const res = await createAuthenticatedRequest('get', '/api/iot-data?limit=5000', alpha);

    expect(res.status).toBe(200);

    const marques = (res.body as Array<{ sensorId: string }>).filter(r => r.sensorId?.startsWith(`CAPT-${STAMP}-`));
    const idsCapteurs = new Set(marques.map(r => r.sensorId));

    expect(idsCapteurs.has(`CAPT-${STAMP}-A1`)).toBe(true);
    expect(idsCapteurs.has(`CAPT-${STAMP}-A2`)).toBe(true);
    expect(idsCapteurs.has(`CAPT-${STAMP}-B1`)).toBe(false);
  });

  it("un relevé sans équipement reste visible à son locataire", async () => {
    // Le rattachement est porté par une colonne, non déduit d'une jointure :
    // un relevé orphelin d'équipement garde donc son propriétaire.
    const res = await createAuthenticatedRequest('get', '/api/iot-data?limit=5000', alpha);

    const orphelins = (res.body as Array<{ sensorId: string; equipmentId: number | null }>)
      .filter(r => r.sensorId === `CAPT-${STAMP}-ORPH`);

    expect(orphelins).toHaveLength(1);
    expect(orphelins[0].equipmentId).toBeNull();
  });

  it("Beta ne lit pas les capteurs d'un équipement d'Alpha désigné par son id", async () => {
    const res = await createAuthenticatedRequest('get', `/api/equipment/${eqAlpha1}/sensor-data`, beta);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("Alpha lit bien les siens par le même chemin", async () => {
    const res = await createAuthenticatedRequest('get', `/api/equipment/${eqAlpha1}/sensor-data`, alpha);

    expect(res.status).toBe(200);
    expect((res.body as unknown[]).length).toBeGreaterThan(0);
    for (const releve of res.body as Array<{ sensorId: string }>) {
      expect(releve.sensorId).toBe(`CAPT-${STAMP}-A1`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
describe("Export des relevés", () => {
  it("l'export d'Alpha ne contient aucun capteur de Beta", async () => {
    const res = await createAuthenticatedRequest(
      'get', '/api/data-import-export/export?type=iot-data&format=csv&days=90', alpha,
    );

    expect(res.status).toBe(200);
    const csv = res.text ?? String(res.body);
    expect(csv).toContain(`CAPT-${STAMP}-A1`);
    expect(csv).not.toContain(`CAPT-${STAMP}-B1`);
  });

  it("l'export d'Alpha garde son relevé sans équipement", async () => {
    // Le cloisonnement provisoire passait par une jointure INTERNE, qui
    // excluait ces lignes de l'export de leur propre propriétaire. La colonne
    // les y ramène.
    const res = await createAuthenticatedRequest(
      'get', '/api/data-import-export/export?type=iot-data&format=csv&days=90', alpha,
    );

    expect(res.text ?? String(res.body)).toContain(`CAPT-${STAMP}-ORPH`);
  });
});

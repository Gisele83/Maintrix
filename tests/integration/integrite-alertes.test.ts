/**
 * Une alerte appartient-elle toujours à quelqu'un — et au bon ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ
 * ═══════════════════════════════════════════════════════════════════
 * `alerts_notifications.tenant_id` est nullable, et quatre des cinq chemins
 * d'écriture ne le renseignaient pas :
 *
 *   • le seuil de capteur et l'analyse prédictive, dans le connecteur IoT —
 *     alors que le locataire venait d'y être résolu TROIS LIGNES PLUS HAUT,
 *     pour le relevé lui-même, et simplement pas transmis ;
 *   • l'alerte de stock bas, alors que le locataire était dans la portée de
 *     la fonction depuis le début ;
 *   • la route `POST /api/alerts`, qui prenait le `tenantId` dans le CORPS de
 *     la requête — donc chez le client.
 *
 * Le simulateur IoT tournant toutes les 30 secondes, toute instance en
 * fonctionnement accumulait des alertes n'appartenant à personne. Invisibles
 * dans l'interface, puisque les lectures filtrent par locataire, mais liées
 * aux équipements par clé étrangère : elles ont fini par faire échouer le
 * retrait du jeu de démonstration. C'est le seul symptôme qui ait émergé d'un
 * défaut présent depuis le début.
 *
 * Deux routes de lecture et de modification ne vérifiaient par ailleurs rien :
 * `PUT /api/alerts/:id` et `GET /api/equipment/:id/alerts` travaillaient sur
 * un identifiant numérique nu.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE MESURE
 * ═══════════════════════════════════════════════════════════════════
 * Chaque cas vérifie l'ÉTAT EN BASE après coup, pas seulement le code de
 * retour : une route peut rendre 201 et avoir écrit une ligne orpheline.
 *
 * Le chemin du simulateur est exercé pour de vrai, avec un connecteur
 * construit dans le test et des seuils choisis pour être franchis à coup sûr.
 * On n'attend pas qu'un hasard déclenche une alerte : on la provoque.
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
import { gmaoStorage } from '../../server/gmao-storage';
import { IoTConnector, type SensorReading } from '../../server/integrations/iot-connector';
import { smartNotificationEngine } from '../../server/integrations/smart-notification-engine';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL absente — lancez `npm test`.');
const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

const STAMP = `ALR${Date.now()}`;

let alpha: AuthenticatedAgent;
let beta: AuthenticatedAgent;
let eqAlpha = 0;
let eqBeta = 0;
let userAlpha = 0;
let userBeta = 0;

/**
 * Connecteur piloté par le test : seuils volontairement bas, pour que le
 * dépassement soit certain au lieu d'être probable. Jamais `initialize()`,
 * qui ouvrirait une connexion MQTT dont on n'a que faire.
 */
const connecteur = new IoTConnector({
  mqttBrokerUrl: '',
  sensorThresholds: [
    { sensorType: 'temperature', warningThreshold: 1, criticalThreshold: 2, unit: '°C' },
  ],
});

async function creerEquipement(tenantId: string, suffixe: string): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO equipment_registry (tenant_id, equipment_id, equipment_name, equipment_type)
     VALUES ($1, $2, $3, 'moteur') RETURNING id`,
    [tenantId, `EQ-${STAMP}-${suffixe}`, `Équipement ${suffixe} ${STAMP}`],
  );
  return rows[0].id;
}

/** Un compte actif, au rôle attendu par la règle de notification critique. */
async function creerResponsable(tenantId: string, suffixe: string): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO user_profiles (tenant_id, username, email, password, role, is_active)
     VALUES ($1, $2, $3, 'x', 'maintenance_manager', true) RETURNING id`,
    [tenantId, `resp_${STAMP}_${suffixe}`, `resp-${STAMP}-${suffixe}@essai.invalid`],
  );
  return rows[0].id;
}

async function alertesMarquees(tenantId?: string): Promise<Array<{ id: number; tenant_id: string | null; equipment_id: number | null }>> {
  const { rows } = await pool.query(
    `SELECT id, tenant_id, equipment_id FROM alerts_notifications
     WHERE title LIKE $1 ${tenantId ? 'AND tenant_id = $2' : ''}
     ORDER BY id`,
    tenantId ? [`%${STAMP}%`, tenantId] : [`%${STAMP}%`],
  );
  return rows;
}

async function compterOrphelines(): Promise<number> {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM alerts_notifications WHERE tenant_id IS NULL',
  );
  return rows[0].n;
}

beforeAll(async () => {
  alpha = await authenticateUser(SEEDED.admin, SEEDED.password);
  beta = await authenticateUser(SEEDED.adminBeta, SEEDED.password);

  eqAlpha = await creerEquipement(SEEDED.tenantAlpha, 'A');
  eqBeta = await creerEquipement(SEEDED.tenantBeta, 'B');
  userAlpha = await creerResponsable(SEEDED.tenantAlpha, 'A');
  userBeta = await creerResponsable(SEEDED.tenantBeta, 'B');
}, 60_000);

afterAll(async () => {
  const miens = [eqAlpha, eqBeta];
  await pool.query('DELETE FROM smart_notifications WHERE recipient_id = ANY($1::int[]) OR equipment_id = ANY($2::int[])',
    [[userAlpha, userBeta], miens]);
  // Par ÉQUIPEMENT, et pas seulement par titre marqué : pendant la fenêtre
  // d'observation du simulateur, le serveur réel écrit ses propres alertes et
  // ses propres relevés sur les équipements qu'il tire — dont les miens, le
  // parc de test étant petit. Nettoyer sur le seul marqueur laissait ces
  // lignes-là, et la suppression de l'équipement échouait sur la clé
  // étrangère, après que tous les cas soient passés.
  await pool.query('DELETE FROM alerts_notifications WHERE title LIKE $1 OR equipment_id = ANY($2::int[])',
    [`%${STAMP}%`, miens]);
  await pool.query('DELETE FROM iot_sensor_data WHERE sensor_id LIKE $1 OR equipment_id = ANY($2::int[])',
    [`CAPT-${STAMP}-%`, miens]);
  await pool.query('DELETE FROM predictive_analytics WHERE equipment_id = ANY($1::int[])', [miens]);
  await pool.query('DELETE FROM user_profiles WHERE id = ANY($1::int[])', [[userAlpha, userBeta]]);
  await pool.query('DELETE FROM equipment_registry WHERE equipment_id LIKE $1', [`EQ-${STAMP}-%`]);
  await pool.end();

  // Les modules serveur importés plus haut ouvrent leur propre pool au
  // chargement. Sans cette fermeture, Jest reste suspendu après le dernier
  // cas — « Jest did not exit one second after the test run » — et bloquerait
  // la voie d'intégration entière. Chaque fichier de test a son propre
  // registre de modules, donc ce pool n'est partagé avec aucune autre suite.
  const { pool: poolServeur } = await import('../../server/db');
  await poolServeur.end();
}, 60_000);

// ═══════════════════════════════════════════════════════════════════
describe('Création — deux organisations distinctes', () => {
  it('chaque alerte atterrit chez son auteur, et chacun ne voit que les siennes', async () => {
    const poserAlerte = (agent: AuthenticatedAgent, equipmentId: number, qui: string) =>
      createAuthenticatedRequest('post', '/api/alerts', agent).send({
        alertType: 'threshold',
        equipmentId,
        severity: 'high',
        title: `Seuil ${qui} ${STAMP}`,
        message: `Relevé au-dessus du seuil (${qui})`,
      });

    expect((await poserAlerte(alpha, eqAlpha, 'alpha')).status).toBe(201);
    expect((await poserAlerte(beta, eqBeta, 'beta')).status).toBe(201);

    // En base : deux alertes, deux propriétaires distincts, aucune orpheline.
    const toutes = await alertesMarquees();
    expect(toutes).toHaveLength(2);
    expect(toutes.map((a) => a.tenant_id).sort())
      .toEqual([SEEDED.tenantAlpha, SEEDED.tenantBeta].sort());

    // Et dans l'interface : chacun ne lit que la sienne.
    const vueAlpha = await createAuthenticatedRequest('get', '/api/alerts?limit=500', alpha);
    expect(vueAlpha.status).toBe(200);
    const titresAlpha = (vueAlpha.body as Array<{ title: string }>).map((a) => a.title);
    expect(titresAlpha).toContain(`Seuil alpha ${STAMP}`);
    expect(titresAlpha).not.toContain(`Seuil beta ${STAMP}`);
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
describe('Création — locataire absent ou incohérent', () => {
  it("REFUSE une alerte sans organisation, au lieu d'écrire NULL", async () => {
    // Appel direct du point de passage : c'est lui la barrière, pas la route.
    await expect(gmaoStorage.createAlert({
      alertType: 'threshold',
      equipmentId: eqAlpha,
      severity: 'high',
      title: `Sans locataire ${STAMP}`,
      message: 'ne doit pas être écrite',
    } as any)).rejects.toThrow(/ALERTE_SANS_LOCATAIRE/);

    expect(await alertesMarquees()).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ tenant_id: null })]),
    );
  }, 60_000);

  it("IGNORE le tenantId du corps et retient celui de la session", async () => {
    const r = await createAuthenticatedRequest('post', '/api/alerts', alpha).send({
      tenantId: SEEDED.tenantBeta,           // ← ce que le client prétend
      alertType: 'anomaly',
      equipmentId: eqAlpha,                  // ← son propre équipement
      severity: 'medium',
      title: `Corps menteur ${STAMP}`,
      message: 'le tenantId du corps doit être écrasé',
    });

    expect(r.status).toBe(201);
    const { rows } = await pool.query(
      'SELECT tenant_id FROM alerts_notifications WHERE title = $1',
      [`Corps menteur ${STAMP}`],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].tenant_id).toBe(SEEDED.tenantAlpha);
  }, 60_000);

  it("REFUSE une alerte sur l'équipement d'une AUTRE organisation", async () => {
    const r = await createAuthenticatedRequest('post', '/api/alerts', alpha).send({
      alertType: 'threshold',
      equipmentId: eqBeta,                   // ← l'équipement du voisin
      severity: 'critical',
      title: `Vol d'équipement ${STAMP}`,
      message: 'ne doit pas être écrite',
    });

    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toMatch(/ALERTE_HORS_LOCATAIRE/);
    const { rows } = await pool.query(
      'SELECT id FROM alerts_notifications WHERE title = $1', [`Vol d'équipement ${STAMP}`]);
    expect(rows).toHaveLength(0);
  }, 60_000);

  it("REFUSE une alerte dont l'équipement n'existe pas", async () => {
    await expect(gmaoStorage.createAlert({
      tenantId: SEEDED.tenantAlpha,
      alertType: 'threshold',
      equipmentId: 2_000_000_000,
      severity: 'high',
      title: `Équipement fantôme ${STAMP}`,
      message: 'ne doit pas être écrite',
    })).rejects.toThrow(/ALERTE_EQUIPEMENT_INCONNU/);
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
describe('Génération simultanée', () => {
  it('vingt alertes en parallèle, deux organisations, aucune orpheline', async () => {
    const orphelinesAvant = await compterOrphelines();

    const envois = Array.from({ length: 20 }, (_, i) => {
      const versAlpha = i % 2 === 0;
      return createAuthenticatedRequest('post', '/api/alerts', versAlpha ? alpha : beta).send({
        alertType: 'threshold',
        equipmentId: versAlpha ? eqAlpha : eqBeta,
        severity: 'low',
        title: `Rafale ${i} ${STAMP}`,
        message: 'écriture concurrente',
      });
    });
    const reponses = await Promise.all(envois);
    expect(reponses.every((r: { status: number }) => r.status === 201)).toBe(true);

    const { rows } = await pool.query(
      `SELECT a.tenant_id, e.tenant_id AS proprietaire
       FROM alerts_notifications a JOIN equipment_registry e ON e.id = a.equipment_id
       WHERE a.title LIKE $1`, [`Rafale%${STAMP}`]);
    expect(rows).toHaveLength(20);
    // La propriété qui compte : l'alerte et son équipement ont le MÊME
    // propriétaire. Compter les alertes par locataire ne le prouverait pas.
    for (const l of rows) expect(l.tenant_id).toBe(l.proprietaire);
    expect(await compterOrphelines()).toBe(orphelinesAvant);
  }, 120_000);
});

// ═══════════════════════════════════════════════════════════════════
describe('Simulateur et ingestion de relevés', () => {
  it("le chemin du simulateur écrit désormais l'organisation", async () => {
    const releve: SensorReading = {
      equipmentId: eqAlpha,
      sensorId: `CAPT-${STAMP}-SIM`,
      sensorType: 'temperature',
      value: 999,                  // au-delà du seuil critique posé à 2
      unit: '°C',
      timestamp: new Date(),
      quality: 'good',
      metadata: { simulated: true },
    };

    // `processSensorReading` est privée : c'est pourtant ELLE le chemin
    // corrigé, celui qui résout le locataire puis le transmet. L'atteindre
    // par `simulateSensorData` laisserait le hasard décider si un seuil est
    // franchi.
    await (connecteur as any).processSensorReading(releve);

    const { rows } = await pool.query(
      `SELECT tenant_id, equipment_id FROM alerts_notifications
       WHERE equipment_id = $1 AND alert_type = 'threshold'
       ORDER BY id DESC LIMIT 1`, [eqAlpha]);
    expect(rows).toHaveLength(1);
    expect(rows[0].tenant_id).toBe(SEEDED.tenantAlpha);

    // Et le relevé lui-même est bien rattaché, comme avant la correction.
    const { rows: releves } = await pool.query(
      'SELECT tenant_id FROM iot_sensor_data WHERE sensor_id = $1', [`CAPT-${STAMP}-SIM`]);
    expect(releves).toHaveLength(1);
    expect(releves[0].tenant_id).toBe(SEEDED.tenantAlpha);

    await pool.query('DELETE FROM alerts_notifications WHERE equipment_id = $1', [eqAlpha]);
  }, 60_000);

  it("un relevé d'équipement inconnu ne produit NI relevé NI alerte", async () => {
    const orphelinesAvant = await compterOrphelines();
    const releve: SensorReading = {
      equipmentId: 2_000_000_001,
      sensorId: `CAPT-${STAMP}-FANTOME`,
      sensorType: 'temperature',
      value: 999,
      unit: '°C',
      timestamp: new Date(),
      quality: 'good',
    };

    await (connecteur as any).processSensorReading(releve);

    const { rows } = await pool.query(
      'SELECT id FROM iot_sensor_data WHERE sensor_id = $1', [`CAPT-${STAMP}-FANTOME`]);
    expect(rows).toHaveLength(0);
    expect(await compterOrphelines()).toBe(orphelinesAvant);
  }, 60_000);

  it('le simulateur du serveur tourne, et ne laisse aucune alerte orpheline', async () => {
    // Observation du serveur réel, qui simule toutes les 30 secondes. Ce cas
    // ne force rien : il constate. Sa valeur tient à ce qu'il mesure que le
    // simulateur a BIEN tourné pendant la fenêtre — sans cela, « zéro
    // orpheline » ne voudrait rien dire.
    const { rows: avant } = await pool.query(
      "SELECT COUNT(*)::int AS n FROM iot_sensor_data WHERE sensor_id LIKE 'SIM\\_%'");
    const orphelinesAvant = await compterOrphelines();

    await new Promise((r) => setTimeout(r, 35_000));

    const { rows: apres } = await pool.query(
      "SELECT COUNT(*)::int AS n FROM iot_sensor_data WHERE sensor_id LIKE 'SIM\\_%'");
    expect(apres[0].n).toBeGreaterThan(avant[0].n);        // il a tourné
    expect(await compterOrphelines()).toBe(orphelinesAvant); // sans rien orpheliner
  }, 120_000);
});

// ═══════════════════════════════════════════════════════════════════
describe('Traitements asynchrones et notifications', () => {
  it("ne prévient que les comptes de l'organisation concernée", async () => {
    await smartNotificationEngine.processThresholdAlert({
      equipmentId: eqAlpha,
      severity: 'critical',
      title: `Seuil critique ${STAMP}`,
      message: `Température anormale ${STAMP}`,
      deviceId: `DEV-${STAMP}`,
      sensorReading: { sensorType: 'temperature', value: 999 },
      threshold: { criticalLevel: 2 },
    });

    const { rows } = await pool.query(
      `SELECT n.recipient_id, u.tenant_id
       FROM smart_notifications n JOIN user_profiles u ON u.id = n.recipient_id
       WHERE n.equipment_id = $1`, [eqAlpha]);

    // Au moins un destinataire — sinon le cas ne prouverait rien.
    expect(rows.length).toBeGreaterThan(0);
    for (const l of rows) expect(l.tenant_id).toBe(SEEDED.tenantAlpha);
    expect(rows.map((l: { recipient_id: number }) => l.recipient_id)).not.toContain(userBeta);
  }, 60_000);

  it("ne prévient PERSONNE quand l'équipement est inconnu", async () => {
    const { rows: avant } = await pool.query('SELECT COUNT(*)::int AS n FROM smart_notifications');

    await smartNotificationEngine.processThresholdAlert({
      equipmentId: 2_000_000_002,
      severity: 'critical',
      title: `Orpheline ${STAMP}`,
      message: 'aucun destinataire légitime',
    });

    const { rows: apres } = await pool.query('SELECT COUNT(*)::int AS n FROM smart_notifications');
    expect(apres[0].n).toBe(avant[0].n);
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
describe('Lecture et modification', () => {
  it("PUT /api/alerts/:id ne touche pas l'alerte d'une autre organisation", async () => {
    const creation = await createAuthenticatedRequest('post', '/api/alerts', beta).send({
      alertType: 'threshold',
      equipmentId: eqBeta,
      severity: 'high',
      title: `À ne pas modifier ${STAMP}`,
      message: 'propriété de Beta',
    });
    expect(creation.status).toBe(201);
    const id = (creation.body as { id: number }).id;

    const r = await createAuthenticatedRequest('put', `/api/alerts/${id}`, alpha).send({ status: 'dismissed' });

    expect(r.status).toBe(404);
    const { rows } = await pool.query('SELECT status FROM alerts_notifications WHERE id = $1', [id]);
    expect(rows[0].status).not.toBe('dismissed');
  }, 60_000);

  it("GET /api/equipment/:id/alerts ne rend rien sur l'équipement d'autrui", async () => {
    const r = await createAuthenticatedRequest('get', `/api/equipment/${eqBeta}/alerts`, alpha);

    expect(r.status).toBe(200);
    expect(Array.isArray(r.body)).toBe(true);
    // Beta a au moins une alerte sur cet équipement — et Alpha n'en voit aucune.
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM alerts_notifications WHERE equipment_id = $1', [eqBeta]);
    expect(rows[0].n).toBeGreaterThan(0);
    expect(r.body).toHaveLength(0);
  }, 60_000);
});

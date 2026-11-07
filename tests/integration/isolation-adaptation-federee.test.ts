/**
 * Un locataire lit-il encore le nom et les métriques des autres sites dans le
 * module d'adaptation fédérée ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT CASSÉ
 * ═══════════════════════════════════════════════════════════════════
 * `GET /api/federated-adapt/sites` et `/specialization` servaient le profil
 * COMPLET de chaque locataire de l'instance : nom en clair, score de maturité,
 * nombre de cas, taux de succès de maintenance, spécialisations dominantes et
 * vecteur de modèle local à 12 dimensions. Les six routes du module n'étaient
 * gardées que par `requireAuthentication` — aucun contrôle de rôle, et pas une
 * seule lecture de `req.tenantId` dans le fichier.
 *
 * Ce n'était pas un filtre oublié : l'en-tête du module annonçait « profils de
 * maturité de tous les sites ». C'était donc une décision produit, et elle a
 * été tranchée sur la mesure (la démonstration est au-dessus de
 * `SITES_MIN_POUR_AGREGAT`, server/federated-adaptation.ts).
 *
 * Le relevé du 2026-11-07 a corrigé le constat d'origine sur trois points, et
 * ces trois points sont ce que cette suite garde :
 *
 *   • le plancher n'était pas l'administrateur mais le `viewer`, niveau 0,
 *     « consulte sans rien modifier » ;
 *   • `GET /site/:id` avec l'identifiant d'autrui n'était arrêté que PAR
 *     ACCIDENT, par le filet anti-fuite, parce que sa charge est un objet plat
 *     dont `tenantId` est au premier niveau — et le lot A4 a documenté ce filet
 *     comme une alarme, pas comme une garantie ;
 *   • `POST /aggregate` laissait un `viewer` relancer une agrégation sur TOUTE
 *     l'instance, écritures comprises.
 *
 * ═══════════════════════════════════════════════════════════════════
 * COMMENT C'EST VÉRIFIÉ
 * ═══════════════════════════════════════════════════════════════════
 * On cherche NOMMÉMENT le nom et l'identifiant du locataire d'en face dans la
 * charge sérialisée — pas dans un champ précis. Une projection qui renommerait
 * `tenantName` en `site` continuerait de fuir ; c'est le texte servi qui
 * tranche, et non la forme qu'on suppose.
 *
 * Chaque refus est doublé de son TÉMOIN : sans lui, une route cassée pour tout
 * le monde passerait pour une route bien cloisonnée. Le demandeur doit donc
 * garder accès à SES propres métriques, et ces métriques doivent être des
 * nombres, pas des cases vides.
 *
 * Le contrôle est SYMÉTRIQUE : Alpha ne doit pas voir Beta, et Beta ne doit pas
 * voir Alpha. Un filtre codé en dur sur un seul locataire passerait le premier
 * test et échouerait le second.
 *
 * Les agrégats de flotte sont vérifiés comme une PROPRIÉTÉ et non comme une
 * valeur : d'autres suites créent des locataires (parcours testeur), donc le
 * nombre de sites actifs dépend de l'ordre d'exécution. On vérifie l'implication
 * « assez de sites ⇒ moyennes servies / trop peu ⇒ moyennes absentes ET motif
 * donné », qui tient quel que soit cet ordre.
 *
 * ⚠️ Cette suite ne se lance pas avec `jest` seul : `npm test` provisionne la
 * base, le serveur et les variables (voir scripts/run-tests.mjs).
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  authenticateUser,
  createAuthenticatedRequest,
  anonymousRequest,
  SEEDED,
  type AuthenticatedAgent,
} from '../helpers/setup';
import { db, pool } from '../../server/db';
import { userProfiles, tenants } from '@shared/schema';
import { eq } from 'drizzle-orm';

/** Au-dessous de ce nombre de sites actifs, une moyenne désigne un pair. */
const SITES_MIN_POUR_AGREGAT = 4;

let adminAlpha: AuthenticatedAgent;
let adminBeta: AuthenticatedAgent;

let nomAlpha = '';
let nomBeta = '';

/**
 * Le rôle du technicien du seed est détourné le temps d'un test, puis rendu.
 * C'est le procédé déjà employé par roles-serveur.test.ts : Jest tourne en
 * `--runInBand`, donc aucune autre suite ne lit ce compte pendant ce temps.
 */
async function imposerRole(email: string, role: string): Promise<void> {
  await db.update(userProfiles).set({ role }).where(eq(userProfiles.email, email));
}

async function nomDuLocataire(id: string): Promise<string> {
  const [t] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, id));
  if (!t?.name) throw new Error(`Locataire ${id} absent — le seed a-t-il été appliqué ?`);
  return t.name;
}

beforeAll(async () => {
  adminAlpha = await authenticateUser(SEEDED.admin, SEEDED.password);
  adminBeta = await authenticateUser(SEEDED.adminBeta, SEEDED.password);
  // Relus en base plutôt que codés en dur : c'est le nom RÉELLEMENT servi
  // qu'on doit chercher dans les charges.
  nomAlpha = await nomDuLocataire(SEEDED.tenantAlpha);
  nomBeta = await nomDuLocataire(SEEDED.tenantBeta);
});

afterAll(async () => {
  await imposerRole(SEEDED.technician, 'technician');
  // Sans cette fermeture, Jest signale « did not exit one second after the
  // test run » : le pool de `server/db` reste ouvert.
  await pool.end();
});

describe('A — un locataire ne lit jamais le nom ni les métriques d’un autre', () => {
  it('/sites ne sert à Alpha que son propre site', async () => {
    const res = await createAuthenticatedRequest('get', '/api/federated-adapt/sites', adminAlpha);
    expect(res.status).toBe(200);

    const charge = JSON.stringify(res.body);
    expect(charge).not.toContain(nomBeta);
    expect(charge).not.toContain(SEEDED.tenantBeta);

    expect(Array.isArray(res.body.sites)).toBe(true);
    expect(res.body.sites).toHaveLength(1);
    expect(res.body.sites[0].tenantId).toBe(SEEDED.tenantAlpha);
  });

  it('TÉMOIN — Alpha garde ses propres métriques, et ce sont des nombres', async () => {
    // Sans ce témoin, une route qui renverrait `{sites: []}` à tout le monde
    // passerait le test précédent.
    const res = await createAuthenticatedRequest('get', '/api/federated-adapt/sites', adminAlpha);
    const sien = res.body.sites[0];

    expect(sien.tenantName).toBe(nomAlpha);
    expect(typeof sien.maturityScore).toBe('number');
    expect(typeof sien.mixingCoefficient).toBe('number');
    expect(typeof sien.avgSuccessRate).toBe('number');
    expect(Array.isArray(sien.localModelVector)).toBe(true);
    expect(sien.localModelVector).toHaveLength(12);
  });

  it('/specialization ne sert à Alpha que sa propre ligne SPI', async () => {
    const res = await createAuthenticatedRequest(
      'get', '/api/federated-adapt/specialization', adminAlpha,
    );
    expect(res.status).toBe(200);

    const charge = JSON.stringify(res.body);
    expect(charge).not.toContain(nomBeta);
    expect(charge).not.toContain(SEEDED.tenantBeta);

    expect(res.body.spiReport).toHaveLength(1);
    expect(res.body.spiReport[0].tenantId).toBe(SEEDED.tenantAlpha);
  });

  it('TÉMOIN — le rapport SPI d’Alpha reste exploitable', async () => {
    const res = await createAuthenticatedRequest(
      'get', '/api/federated-adapt/specialization', adminAlpha,
    );
    const ligne = res.body.spiReport[0];

    expect(ligne.tenantName).toBe(nomAlpha);
    expect(typeof ligne.spi).toBe('number');
    expect(typeof ligne.lambda).toBe('number');
    expect(Array.isArray(ligne.specializedDims)).toBe(true);
    expect(['generic', 'emerging', 'specialized', 'artefact']).toContain(ligne.riskLevel);
  });

  it('SYMÉTRIE — Beta ne voit pas Alpha non plus', async () => {
    // Un filtre écrit en dur sur un seul locataire passerait les tests
    // précédents et échouerait celui-ci.
    for (const chemin of ['/api/federated-adapt/sites', '/api/federated-adapt/specialization']) {
      const res = await createAuthenticatedRequest('get', chemin, adminBeta);
      expect(res.status).toBe(200);

      const charge = JSON.stringify(res.body);
      expect(charge).not.toContain(nomAlpha);
      expect(charge).not.toContain(SEEDED.tenantAlpha);
    }
  });

  it('les alertes de dérive ne nomment que le site demandeur', async () => {
    // ⚠️ Vérification de PROPRIÉTÉ, qui tient aussi quand la liste est vide —
    // et elle l'est sur les données du seed, car aucun site n'atteint les
    // seuils de dérive. Assumé : fabriquer un site dérivant obligerait à créer
    // un locataire de plus, dont la seule présence déplacerait les agrégats
    // que les autres suites mesurent. La garde utile reste que la liste
    // EXISTE et qu'aucune entrée étrangère ne puisse y apparaître.
    const res = await createAuthenticatedRequest(
      'get', '/api/federated-adapt/specialization', adminAlpha,
    );
    const alertes = res.body.summary?.driftAlerts;
    expect(Array.isArray(alertes)).toBe(true);
    for (const a of alertes) {
      expect(a.tenantId).toBe(SEEDED.tenantAlpha);
    }
  });
});

describe('B — le rôle le moins privilégié est cloisonné lui aussi', () => {
  it('un `viewer` ne lit pas le nom d’un autre locataire', async () => {
    // Mesuré avant correction : le `viewer` d'Alpha — niveau 0 du référentiel,
    // « consulte sans rien modifier » — lisait le taux de succès de
    // maintenance de Beta.
    await imposerRole(SEEDED.technician, 'viewer');
    const lecteur = await authenticateUser(SEEDED.technician, SEEDED.password);

    const res = await createAuthenticatedRequest('get', '/api/federated-adapt/sites', lecteur);
    expect(res.status).toBe(200);

    const charge = JSON.stringify(res.body);
    expect(charge).not.toContain(nomBeta);
    expect(charge).not.toContain(SEEDED.tenantBeta);
  });

  it('TÉMOIN — ce `viewer` voit toujours SON site', async () => {
    await imposerRole(SEEDED.technician, 'viewer');
    const lecteur = await authenticateUser(SEEDED.technician, SEEDED.password);

    const res = await createAuthenticatedRequest('get', '/api/federated-adapt/sites', lecteur);
    expect(res.body.sites).toHaveLength(1);
    expect(res.body.sites[0].tenantId).toBe(SEEDED.tenantAlpha);
  });

  it('un `viewer` ne relance PAS une agrégation de toute la flotte', async () => {
    // Ce n'est pas une lecture : le traitement parcourt tous les locataires
    // actifs et écrit dans `federated_sync_state` pour chacun.
    await imposerRole(SEEDED.technician, 'viewer');
    const lecteur = await authenticateUser(SEEDED.technician, SEEDED.password);

    const res = await createAuthenticatedRequest(
      'post', '/api/federated-adapt/aggregate', lecteur,
    );
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PRIVILEGES_INSUFFISANTS');
  });

  it('un technicien ne la relance pas davantage', async () => {
    await imposerRole(SEEDED.technician, 'technician');
    const technicien = await authenticateUser(SEEDED.technician, SEEDED.password);

    const res = await createAuthenticatedRequest(
      'post', '/api/federated-adapt/aggregate', technicien,
    );
    expect(res.status).toBe(403);
  });

  it('TÉMOIN — le pilotage de la maintenance la relance bien', async () => {
    // Sans ce témoin, un 403 rendu à TOUT LE MONDE passerait pour un
    // cloisonnement réussi.
    const res = await createAuthenticatedRequest(
      'post', '/api/federated-adapt/aggregate', adminAlpha,
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('et sa charge ne porte pas les poids d’agrégation des autres', async () => {
    const res = await createAuthenticatedRequest(
      'post', '/api/federated-adapt/aggregate', adminAlpha,
    );
    const charge = JSON.stringify(res.body);
    expect(charge).not.toContain(SEEDED.tenantBeta);
    expect(Object.keys(res.body.aggregationWeights ?? {}))
      .not.toContain(SEEDED.tenantBeta);
  });
});

describe('C — le profil d’un site se demande pour soi, et pas par son identifiant', () => {
  it('Alpha est REFUSÉ sur le site de Beta — par un contrôle, pas par le filet', async () => {
    // Avant, la charge plate de cette route faisait réagir le filet
    // anti-fuite : HTTP 200 avec `CROSS_TENANT_DATA_DETECTED`. C'était une
    // coïncidence de forme, documentée comme une alarme de dernier recours.
    // La route a désormais son propre contrôle, et refuse franchement.
    const res = await createAuthenticatedRequest(
      'get', `/api/federated-adapt/site/${SEEDED.tenantBeta}`, adminAlpha,
    );
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('TENANT_MISMATCH');
  });

  it('et Beta est refusé sur le site d’Alpha', async () => {
    const res = await createAuthenticatedRequest(
      'get', `/api/federated-adapt/site/${SEEDED.tenantAlpha}`, adminBeta,
    );
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('TENANT_MISMATCH');
  });

  it('TÉMOIN — chacun obtient son propre profil, renseigné', async () => {
    const res = await createAuthenticatedRequest(
      'get', `/api/federated-adapt/site/${SEEDED.tenantAlpha}`, adminAlpha,
    );
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe(SEEDED.tenantAlpha);
    expect(typeof res.body.mixingCoefficient).toBe('number');
    expect(res.body.localVector).toHaveLength(12);
  });
});

describe('D — les agrégats de flotte ne se retournent pas contre la flotte', () => {
  /**
   * Propriété vérifiée, et non valeur attendue : le nombre de sites actifs
   * dépend des suites qui créent des locataires.
   */
  it('assez de sites ⇒ moyennes servies ; trop peu ⇒ moyennes absentes ET motivées', async () => {
    const res = await createAuthenticatedRequest('get', '/api/federated-adapt/sites', adminAlpha);
    const stats = res.body.fleetStats;

    expect(typeof stats.nSites).toBe('number');
    expect(stats.nSites).toBeGreaterThanOrEqual(1);

    if (stats.nSites >= SITES_MIN_POUR_AGREGAT) {
      expect(typeof stats.fleetMaturityAvg).toBe('number');
      expect(typeof stats.fleetSPIAvg).toBe('number');
      expect(res.body.agregatsMasques).toBeNull();
    } else {
      expect(stats.fleetMaturityAvg).toBeNull();
      expect(stats.fleetLambdaAvg).toBeNull();
      expect(stats.fleetSPIAvg).toBeNull();
      expect(stats.nSitesMature).toBeNull();
      expect(stats.nSitesSpecialized).toBeNull();
      // L'absence doit être MOTIVÉE : une case vide sans explication passe
      // pour une panne, et fait rouvrir un défaut déjà traité.
      expect(typeof res.body.agregatsMasques).toBe('string');
      expect(res.body.agregatsMasques.length).toBeGreaterThan(0);
    }
  });

  it('le modèle global suit la même règle que les moyennes', async () => {
    // θ_global est une moyenne pondérée des vecteurs locaux : avec un seul
    // pair, le servir révèle le vecteur de ce pair exactement.
    const res = await createAuthenticatedRequest(
      'get', '/api/federated-adapt/specialization', adminAlpha,
    );
    const nSites = res.body.summary?.nSites;
    expect(typeof nSites).toBe('number');

    if (nSites >= SITES_MIN_POUR_AGREGAT) {
      expect(Array.isArray(res.body.globalModel)).toBe(true);
    } else {
      expect(res.body.globalModel).toBeNull();
      expect(res.body.summary.maxSPI).toBeNull();
      expect(res.body.summary.nSpecialized).toBeNull();
    }
  });
});

describe('E — la barrière d’authentification tient toujours', () => {
  it('les six routes du module refusent un anonyme', async () => {
    for (const chemin of [
      '/api/federated-adapt/config',
      '/api/federated-adapt/model-dims',
      '/api/federated-adapt/sites',
      '/api/federated-adapt/specialization',
      `/api/federated-adapt/site/${SEEDED.tenantAlpha}`,
    ]) {
      const res = await anonymousRequest('get', chemin);
      expect(res.status).toBe(401);
    }
    // L'écriture est arrêtée plus tôt, par la protection CSRF : 403 et non 401.
    const ecriture = await anonymousRequest('post', '/api/federated-adapt/aggregate');
    expect(ecriture.status).toBe(403);
  });

  it('`/config` et `/model-dims` ne portent aucune donnée de locataire', async () => {
    // Mesurés sans aucun nom ni identifiant : ils restent ouverts à tout
    // utilisateur authentifié, et cette suite garde ce constat.
    for (const chemin of ['/api/federated-adapt/config', '/api/federated-adapt/model-dims']) {
      const res = await createAuthenticatedRequest('get', chemin, adminAlpha);
      expect(res.status).toBe(200);

      const charge = JSON.stringify(res.body);
      expect(charge).not.toContain(nomAlpha);
      expect(charge).not.toContain(nomBeta);
      expect(charge).not.toContain(SEEDED.tenantAlpha);
      expect(charge).not.toContain(SEEDED.tenantBeta);
    }
  });
});

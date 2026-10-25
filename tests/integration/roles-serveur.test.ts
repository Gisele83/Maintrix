/**
 * Les cinq défauts de rôles du lot serveur — tests de non-régression.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CES TESTS GARDENT
 * ═══════════════════════════════════════════════════════════════════
 * Chacun reproduit un défaut MESURÉ avant correction, et échouerait sur le
 * code d'avant. Les codes attendus suivent la convention du dépôt : le
 * contrôle de rôle précède la lecture en base, donc sur un identifiant
 * inexistant **403 = rôle refusé** et **404 = rôle accepté, objet absent**.
 *
 * D1 — `PATCH /api/tenant/users/:id/permissions` acceptait `z.string()` libre :
 *      `director`, `super_admin`, `nimporte_quoi` étaient écrits tels quels.
 * D2 — le propriétaire du locataire recevait 403 sur la gestion des comptes.
 * D3 — quatre routes déclarées avant les middlewares répondaient 401/403 à
 *      tout le monde, et étaient atteignables sans session.
 * D4 — `adminConfigGuard` citait « Super-admin », qui n'existe pas.
 * D5 — supprimer un plan préventif inexistant répondait 200.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  authenticateUser,
  createAuthenticatedRequest,
  anonymousRequest,
  SEEDED,
  type AuthenticatedAgent,
} from '../helpers/setup';
import { db } from '../../server/db';
import { userProfiles } from '@shared/schema';
import { eq } from 'drizzle-orm';

const INEXISTANT = 99999999;

let admin: AuthenticatedAgent;
let technicien: AuthenticatedAgent;

/** Rôle réellement écrit en base — un code HTTP ne dit pas ce qui a été stocké. */
async function roleEnBase(email: string): Promise<string | null> {
  const [u] = await db.select({ role: userProfiles.role }).from(userProfiles).where(eq(userProfiles.email, email));
  return u?.role ?? null;
}

async function imposerRole(email: string, role: string): Promise<void> {
  await db.update(userProfiles).set({ role }).where(eq(userProfiles.email, email));
}

beforeAll(async () => {
  admin = await authenticateUser(SEEDED.admin, SEEDED.password);
  technicien = await authenticateUser(SEEDED.technician, SEEDED.password);
});

afterAll(async () => {
  // Les suites voisines s'appuient sur les rôles du seed.
  await imposerRole(SEEDED.technician, 'technician');
});

describe('D1 — le rôle écrit en base appartient au référentiel', () => {
  afterAll(async () => {
    await imposerRole(SEEDED.technician, 'technician');
  });

  it('refuse `super_admin`, qui n\'est pas un rôle de locataire', async () => {
    const avant = await roleEnBase(SEEDED.technician);
    const res = await createAuthenticatedRequest('patch', `/api/tenant/users/${technicien.userId}/permissions`, admin)
      .send({ role: 'super_admin' });

    expect(res.status).toBe(400);
    // Le contrôle porte sur ce qui est STOCKÉ, pas sur le seul code HTTP.
    expect(await roleEnBase(SEEDED.technician)).toBe(avant);
  });

  it('refuse une valeur inventée', async () => {
    const avant = await roleEnBase(SEEDED.technician);
    const res = await createAuthenticatedRequest('patch', `/api/tenant/users/${technicien.userId}/permissions`, admin)
      .send({ role: 'nimporte_quoi' });

    expect(res.status).toBe(400);
    expect(await roleEnBase(SEEDED.technician)).toBe(avant);
  });

  it('accepte les identifiants du catalogue, en les normalisant', async () => {
    // `GET /api/tenant/roles` propose encore `supervisor`, `manager` et
    // `director`, et l'écran de permissions renvoie cet identifiant tel quel.
    // Le parcours doit continuer de fonctionner, en stockant le rôle réel.
    for (const [envoye, attendu] of [
      ['supervisor', 'team_leader'],
      ['manager', 'maintenance_manager'],
      ['director', 'technical_director'],
      ['technician', 'technician'],
    ] as const) {
      const res = await createAuthenticatedRequest('patch', `/api/tenant/users/${technicien.userId}/permissions`, admin)
        .send({ role: envoye });

      expect(res.status).toBe(200);
      expect(await roleEnBase(SEEDED.technician)).toBe(attendu);
    }
  });

  it('aucun compte non privilégié ne peut se promouvoir', async () => {
    // L'élévation a été cherchée depuis quatre rôles de départ : elle doit
    // être refusée, et le rôle rester inchangé EN BASE.
    for (const depart of ['technician', 'team_leader', 'maintenance_manager'] as const) {
      await imposerRole(SEEDED.technician, depart);
      const session = await authenticateUser(SEEDED.technician, SEEDED.password);
      const res = await createAuthenticatedRequest('patch', `/api/tenant/users/${session.userId}/permissions`, session)
        .send({ role: 'admin' });

      expect(res.status).toBe(403);
      expect(await roleEnBase(SEEDED.technician)).toBe(depart);
    }
  });
});

describe('D1/D2 — les suppressions raisonnent par niveau, pas par liste', () => {
  afterAll(async () => {
    await imposerRole(SEEDED.technician, 'technician');
  });

  it('le technicien reste refusé sur les trois suppressions', async () => {
    for (const chemin of [
      `/api/work-orders/${INEXISTANT}`,
      `/api/preventive-maintenance-plans/${INEXISTANT}`,
      `/api/spare-parts/${INEXISTANT}`,
    ]) {
      const res = await createAuthenticatedRequest('delete', chemin, technicien);
      expect(res.status).toBe(403);
    }
  });

  it('`technical_director` les obtient — il était nommé, il reste autorisé', async () => {
    await imposerRole(SEEDED.technician, 'technical_director');
    const session = await authenticateUser(SEEDED.technician, SEEDED.password);

    for (const chemin of [
      `/api/work-orders/${INEXISTANT}`,
      `/api/preventive-maintenance-plans/${INEXISTANT}`,
      `/api/spare-parts/${INEXISTANT}`,
    ]) {
      const res = await createAuthenticatedRequest('delete', chemin, session);
      // 404 : le rôle passe, seul l'objet manque.
      expect(res.status).toBe(404);
    }
  });

  it('une orthographe héritée passe aussi — elle était refusée avant', async () => {
    // `directeur_technique` désigne un rôle autorisé ; la comparaison
    // littérale le refusait, produisant un refus inexplicable.
    await imposerRole(SEEDED.technician, 'directeur_technique');
    const session = await authenticateUser(SEEDED.technician, SEEDED.password);
    const res = await createAuthenticatedRequest('delete', `/api/work-orders/${INEXISTANT}`, session);
    expect(res.status).toBe(404);
  });

  it('un rôle inconnu échoue fermé, sans erreur serveur', async () => {
    await imposerRole(SEEDED.technician, 'nimporte_quoi');
    const session = await authenticateUser(SEEDED.technician, SEEDED.password);
    const res = await createAuthenticatedRequest('delete', `/api/work-orders/${INEXISTANT}`, session);
    expect(res.status).toBe(403);
  });
});

describe('D2 — le propriétaire administre son propre locataire', () => {
  afterAll(async () => {
    await imposerRole(SEEDED.technician, 'technician');
  });

  it('`owner` obtient la liste des comptes, que `!== "admin"` lui refusait', async () => {
    await imposerRole(SEEDED.technician, 'owner');
    const proprietaire = await authenticateUser(SEEDED.technician, SEEDED.password);

    const res = await createAuthenticatedRequest('get', '/api/tenant/users', proprietaire);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('`owner` peut créer un rôle personnalisé', async () => {
    await imposerRole(SEEDED.technician, 'owner');
    const proprietaire = await authenticateUser(SEEDED.technician, SEEDED.password);

    const res = await createAuthenticatedRequest('post', '/api/tenant/roles', proprietaire).send({
      name: 'Rôle de test', description: 'créé par le test de non-régression', level: 2,
      permissions: [], moduleAccess: {},
      validationCapabilities: { workOrders: false, purchaseOrders: false, maxAmount: 0 },
    });
    expect(res.status).toBe(200);
  });

  it("l'encadrement technique n'administre PAS les comptes", async () => {
    // La correction ouvre à `owner`, pas à tout le monde : le seuil reste
    // `admin`, donc `technical_director` (niveau 5) est refusé.
    await imposerRole(SEEDED.technician, 'technical_director');
    const session = await authenticateUser(SEEDED.technician, SEEDED.password);

    const res = await createAuthenticatedRequest('get', '/api/tenant/users', session);
    expect(res.status).toBe(403);
  });
});

describe('D3 — les routes voient enfin leur session et leur locataire', () => {
  it('les statistiques fédérées répondent, au lieu de « Tenant ID requis »', async () => {
    const res = await createAuthenticatedRequest('get', '/api/federated-ai/improvement-stats', admin);
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
  });

  it('les recommandations fédérées répondent pour un locataire authentifié', async () => {
    const res = await createAuthenticatedRequest('post', '/api/federated-ai/recommendations', admin)
      .send({ symptoms: ['vibration'] });
    expect(res.status).toBe(200);
  });

  it('ces routes ne sont plus servies sans session', async () => {
    // Déclarées avant la barrière d'authentification, elles étaient
    // atteignables par un anonyme (qui recevait leur propre refus, pas 401).
    const res = await anonymousRequest('get', '/api/tenant/security-stats');
    expect(res.status).toBe(401);
  });
});

describe('D4 — la configuration des modules suit le référentiel', () => {
  afterAll(async () => {
    await imposerRole(SEEDED.technician, 'technician');
  });

  it("l'administrateur configure, le technicien non", async () => {
    expect((await createAuthenticatedRequest('get', '/api/tenant/modules', admin)).status).toBe(200);
    expect((await createAuthenticatedRequest('get', '/api/tenant/modules', technicien)).status).toBe(403);
  });

  it('le propriétaire configure lui aussi', async () => {
    await imposerRole(SEEDED.technician, 'owner');
    const proprietaire = await authenticateUser(SEEDED.technician, SEEDED.password);
    expect((await createAuthenticatedRequest('get', '/api/tenant/modules', proprietaire)).status).toBe(200);
  });
});

describe('D5 — une suppression ne se confirme que si elle a eu lieu', () => {
  it('un plan préventif inexistant rend 404, comme les deux autres suppressions', async () => {
    const plan = await createAuthenticatedRequest('delete', `/api/preventive-maintenance-plans/${INEXISTANT}`, admin);
    const piece = await createAuthenticatedRequest('delete', `/api/spare-parts/${INEXISTANT}`, admin);
    const ordre = await createAuthenticatedRequest('delete', `/api/work-orders/${INEXISTANT}`, admin);

    expect(plan.status).toBe(404);
    // Les trois suppressions du module partagent désormais le même contrat.
    expect(piece.status).toBe(404);
    expect(ordre.status).toBe(404);
  });
});

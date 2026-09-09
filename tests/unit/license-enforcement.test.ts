/**
 * Le contrôle de licence agit-il réellement ? — F11.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Le middleware était monté globalement dans server/index.ts AVANT
 * `registerRoutes`. L'authentification étant posée route par route à
 * l'intérieur de celles-ci, `req.user` n'existait pas encore à son passage :
 * la première condition (`if (!user) next()`) laissait donc passer TOUTES les
 * requêtes. Le contrôle était inerte, sans que rien ne le signale.
 *
 * Vérifié expérimentalement avant correction : licence d'un locataire forcée à
 * « expirée » en base, puis requête authentifiée → HTTP 200 au lieu de 402.
 *
 * Il est désormais enchaîné après `validateSession`, seul endroit où
 * `req.user` est renseigné, et gouverné par `ENABLE_LICENSE_ENFORCEMENT` —
 * activer le blocage étant une décision commerciale, pas technique.
 *
 * Ce test épingle les deux comportements : l'interrupteur est respecté, et
 * lorsqu'il est armé, une licence expirée bloque VRAIMENT.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Le middleware appelle LicenseService.getLicenseStatus, qui interroge la base.
// On l'isole : ce test porte sur la DÉCISION du middleware, pas sur le calcul
// du statut de licence (couvert ailleurs).
const getLicenseStatus = jest.fn<(tenantId: string) => Promise<unknown>>();
jest.mock('../../server/license-service', () => ({
  LicenseService: { getLicenseStatus: (id: string) => getLicenseStatus(id) },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { licenseEnforcementMiddleware } = require('../../server/license-enforcement-middleware');

/** Fabrique une requête authentifiée minimale, telle que la voit le middleware. */
function requete(path = '/equipment') {
  return { path, user: { id: 1, tenantId: 'tenant-test' } } as any;
}

/** Réponse Express minimale, qui enregistre ce qui a été renvoyé. */
function reponse() {
  const etat: { code?: number; corps?: any; entetes: Record<string, string> } = { entetes: {} };
  const res: any = {
    status(c: number) { etat.code = c; return res; },
    json(b: any) { etat.corps = b; return res; },
    setHeader(k: string, v: string) { etat.entetes[k] = v; },
  };
  return { res, etat };
}

const LICENCE_EXPIREE = {
  canOperate: false,
  status: 'expired',
  plan: 'free',
  isTrialActive: false,
  trialDaysRemaining: 0,
  isGracePeriodActive: false,
  gracePeriodDaysRemaining: 0,
};

const LICENCE_VALIDE = { ...LICENCE_EXPIREE, canOperate: true, status: 'active', plan: 'enterprise' };

describe('F11 — Application des licences', () => {
  const envInitial = process.env.ENABLE_LICENSE_ENFORCEMENT;

  beforeEach(() => { getLicenseStatus.mockReset(); });
  afterEach(() => {
    if (envInitial === undefined) delete process.env.ENABLE_LICENSE_ENFORCEMENT;
    else process.env.ENABLE_LICENSE_ENFORCEMENT = envInitial;
  });

  it('interrupteur absent : le contrôle ne bloque pas et n\'interroge même pas la licence', async () => {
    delete process.env.ENABLE_LICENSE_ENFORCEMENT;
    getLicenseStatus.mockResolvedValue(LICENCE_EXPIREE);

    const next = jest.fn();
    const { res, etat } = reponse();
    await licenseEnforcementMiddleware(requete(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(etat.code).toBeUndefined();
    // Aucune requête inutile en base lorsque le contrôle est désactivé.
    expect(getLicenseStatus).not.toHaveBeenCalled();
  });

  it('interrupteur armé + licence expirée : la requête est BLOQUÉE en 402', async () => {
    process.env.ENABLE_LICENSE_ENFORCEMENT = 'true';
    getLicenseStatus.mockResolvedValue(LICENCE_EXPIREE);

    const next = jest.fn();
    const { res, etat } = reponse();
    await licenseEnforcementMiddleware(requete(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(etat.code).toBe(402);
    expect(etat.corps.error).toBe('LICENSE_EXPIRED');
  });

  it('interrupteur armé + licence valide : la requête passe', async () => {
    process.env.ENABLE_LICENSE_ENFORCEMENT = 'true';
    getLicenseStatus.mockResolvedValue(LICENCE_VALIDE);

    const next = jest.fn();
    const { res, etat } = reponse();
    await licenseEnforcementMiddleware(requete(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(etat.code).toBeUndefined();
  });

  it('interrupteur armé : une requête NON authentifiée n\'est pas bloquée', async () => {
    // Le contrôle ne remplace pas l'authentification : une requête sans
    // utilisateur relève du filtre d'authentification, pas du contrôle de
    // licence. Le laisser bloquer ici masquerait un 401 derrière un 402.
    process.env.ENABLE_LICENSE_ENFORCEMENT = 'true';
    getLicenseStatus.mockResolvedValue(LICENCE_EXPIREE);

    const next = jest.fn();
    const { res, etat } = reponse();
    await licenseEnforcementMiddleware({ path: '/equipment' } as any, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(etat.code).toBeUndefined();
  });

  /**
   * Les tests ci-dessus valident la DÉCISION du middleware. Mais le défaut
   * d'origine n'était pas sa logique — elle était complète et correcte : c'était
   * son PLACEMENT. Monté avant que l'authentification ne renseigne `req.user`,
   * il sortait systématiquement par `if (!user) next()`.
   *
   * Un test qui fabrique lui-même une requête avec `user` ne peut pas voir ce
   * défaut. Cette barrière-ci vise donc la structure du câblage.
   */
  it('le contrôle est câblé APRÈS l\'authentification, et pas monté globalement', () => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const lire = (f: string) => readFileSync(join(__dirname, '..', '..', 'server', f), 'utf8');

    const index = lire('index.ts');
    const auth = lire('enterprise-auth-middleware.ts');

    // 1. Plus de montage global : il s'exécuterait avant `registerRoutes`,
    //    donc avant toute authentification, et serait de nouveau inerte.
    const montageGlobal = /app\.use\(\s*['"]\/api['"]\s*,\s*licenseEnforcementMiddleware/.test(index);
    expect(montageGlobal ? 'server/index.ts remonte le contrôle de licence globalement — il redeviendrait inerte' : '')
      .toBe('');

    // 2. Le contrôle est bien invoqué depuis la chaîne d'authentification,
    //    à la suite de validateSession — seul endroit où `req.user` existe.
    expect(auth).toMatch(/validateSession\([^)]*\)/);
    expect(auth).toContain('licenseEnforcementMiddleware');
  });

  it('interrupteur armé : une base injoignable ne ferme pas la plateforme', async () => {
    // Un incident d'infrastructure ne doit pas se traduire par un verrouillage
    // commercial de tous les locataires.
    process.env.ENABLE_LICENSE_ENFORCEMENT = 'true';
    getLicenseStatus.mockRejectedValue(new Error('base injoignable'));

    const next = jest.fn();
    const { res, etat } = reponse();
    await licenseEnforcementMiddleware(requete(), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(etat.code).toBeUndefined();
  });
});

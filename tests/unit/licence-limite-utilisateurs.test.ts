/**
 * La limite d'utilisateurs suit-elle l'interrupteur de licence ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * `ENABLE_LICENSE_ENFORCEMENT` éteignait le blocage des appels API, mais PAS
 * `LicenseService.enforceUserLimit`. La licence était donc mi-active : des
 * testeurs se voyaient refuser la création de compte avec « Nombre
 * d'utilisateurs atteint pour votre licence » alors que le contrôle de licence
 * était censé être hors service (constaté le 2026-09-17).
 *
 * Deux propriétés sont épinglées ici :
 *   1. interrupteur éteint → aucune limite, et la base n'est même pas
 *      interrogée (preuve que le contrôle sort immédiatement) ;
 *   2. interrupteur armé → le plafond du locataire est bien opposé.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

/** Résultats que la fausse base renverra, dans l'ordre des requêtes. */
let resultats: unknown[][] = [];
let requetes = 0;

const selectFictif = () => {
  requetes++;
  const suite = { where: () => Promise.resolve(resultats.shift() ?? []) };
  return { from: () => suite };
};

jest.mock('../../server/db', () => ({
  db: { select: () => selectFictif() },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LicenseService, UTILISATEURS_SANS_LIMITE } = require('../../server/license-service');

describe('Limite d\'utilisateurs et interrupteur de licence', () => {
  const envInitial = process.env.ENABLE_LICENSE_ENFORCEMENT;

  beforeEach(() => { resultats = []; requetes = 0; });
  afterEach(() => {
    if (envInitial === undefined) delete process.env.ENABLE_LICENSE_ENFORCEMENT;
    else process.env.ENABLE_LICENSE_ENFORCEMENT = envInitial;
  });

  it('interrupteur absent : aucune limite opposée, base jamais interrogée', async () => {
    delete process.env.ENABLE_LICENSE_ENFORCEMENT;
    // Un locataire saturé (1 place, 1 utilisateur) ne doit RIEN bloquer.
    resultats = [[{ id: 'tenant-test', maxUsers: 1, licensedUsers: 1 }], [{ count: 1 }]];

    await expect(LicenseService.enforceUserLimit('tenant-test')).resolves.toBeUndefined();
    expect(requetes).toBe(0);
  });

  it('interrupteur armé : le plafond du locataire est opposé', async () => {
    process.env.ENABLE_LICENSE_ENFORCEMENT = 'true';
    resultats = [[{ id: 'tenant-test', maxUsers: 1, licensedUsers: 1, licenseType: 'custom' }], [{ count: 1 }]];

    await expect(LicenseService.enforceUserLimit('tenant-test')).rejects.toMatchObject({
      code: 'USER_LIMIT_REACHED',
    });
    expect(requetes).toBe(2);
  });

  it('interrupteur armé : un locataire sans limite laisse créer des comptes', async () => {
    process.env.ENABLE_LICENSE_ENFORCEMENT = 'true';
    // Défaut de création d'un locataire depuis le 2026-09-17 : sans limite.
    resultats = [
      [{ id: 'entreprise', maxUsers: UTILISATEURS_SANS_LIMITE, licensedUsers: UTILISATEURS_SANS_LIMITE }],
      [{ count: 42 }],
    ];

    await expect(LicenseService.enforceUserLimit('entreprise')).resolves.toBeUndefined();
  });
});

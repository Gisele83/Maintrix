/**
 * La consultation du statut fabrique-t-elle sa propre alerte ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * En ligne, la bannière annonçait « Période de grâce — 7 jour(s) restant(s)
 * avant interruption du service », en orange sur toute la largeur, et le
 * compteur ne descendait jamais. Boucle fermée :
 *
 *   la bannière interroge /api/license/status toutes les 5 minutes
 *     → la route appelait recordLicenseCheck()
 *       → qui repoussait grace_period_end à « maintenant + 7 jours »
 *         → la lecture suivante voyait une période de grâce en cours
 *           → la bannière l'affichait, et relançait le cycle
 *
 * Remettre `grace_period_end` à NULL en base ne tenait pas cinq minutes.
 * Deux propriétés sont épinglées ici :
 *   1. consulter son statut n'ouvre AUCUNE période de grâce ;
 *   2. un locataire en essai n'est jamais « en période de grâce » — on ne
 *      gracie pas une licence qui n'a pas expiré.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

/** Ligne `tenants` renvoyée par la fausse base. */
let locataire: Record<string, unknown> = {};
/** Dernier objet passé à `update().set()`. */
let derniereMaj: Record<string, unknown> | null = null;

jest.mock('../../server/db', () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([locataire]) }) }) }),
    update: () => ({
      set: (valeurs: Record<string, unknown>) => {
        derniereMaj = valeurs;
        return { where: () => Promise.resolve() };
      },
    }),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LicenseService } = require('../../server/license-service');

const JOUR = 24 * 60 * 60 * 1000;
const dans = (ms: number) => new Date(Date.now() + ms);

describe('Période de grâce', () => {
  beforeEach(() => { derniereMaj = null; });

  it('consulter son statut n\'ouvre pas de période de grâce', async () => {
    await LicenseService.recordLicenseCheck('locataire-test');

    expect(derniereMaj).not.toBeNull();
    expect(derniereMaj).toHaveProperty('lastLicenseCheckAt');
    // La propriété doit être ABSENTE : c'est elle qui nourrissait la boucle.
    expect(derniereMaj).not.toHaveProperty('gracePeriodEnd');
  });

  it('une expiration réelle ouvre bien la période de grâce', async () => {
    await LicenseService.recordLicenseCheck('locataire-test', true);

    expect(derniereMaj).toHaveProperty('gracePeriodEnd');
    expect((derniereMaj as any).gracePeriodEnd.getTime()).toBeGreaterThan(Date.now());
  });

  it('un locataire en essai n\'est jamais en période de grâce', async () => {
    // Situation exacte observée en ligne : essai en cours, et une fenêtre de
    // grâce laissée ouverte par les anciens appels.
    locataire = {
      id: 'locataire-test',
      plan: 'free',
      subscriptionId: null,
      trialStartDate: dans(-3 * JOUR),
      trialEndDate: dans(27 * JOUR),
      gracePeriodEnd: dans(7 * JOUR),
      licenseStatus: 'trial',
    };

    const statut = await LicenseService.getLicenseStatus('locataire-test');

    expect(statut.status).toBe('trial');
    expect(statut.isTrialActive).toBe(true);
    expect(statut.isGracePeriodActive).toBe(false);
    expect(statut.gracePeriodDaysRemaining).toBe(0);
    expect(statut.canOperate).toBe(true);
  });

  it('un abonnement actif écarte aussi la période de grâce', async () => {
    locataire = {
      id: 'locataire-test',
      plan: 'business',
      subscriptionId: 'sub_123',
      trialStartDate: null,
      trialEndDate: null,
      gracePeriodEnd: dans(7 * JOUR),
      licenseStatus: 'active',
    };

    const statut = await LicenseService.getLicenseStatus('locataire-test');

    expect(statut.status).toBe('active');
    expect(statut.isGracePeriodActive).toBe(false);
  });

  it('essai terminé et fenêtre ouverte : là, c\'est bien une période de grâce', async () => {
    locataire = {
      id: 'locataire-test',
      plan: 'free',
      subscriptionId: null,
      trialStartDate: dans(-40 * JOUR),
      trialEndDate: dans(-10 * JOUR),
      gracePeriodEnd: dans(3 * JOUR),
      licenseStatus: 'grace',
    };

    const statut = await LicenseService.getLicenseStatus('locataire-test');

    expect(statut.status).toBe('grace');
    expect(statut.isGracePeriodActive).toBe(true);
    expect(statut.gracePeriodDaysRemaining).toBe(3);
  });
});

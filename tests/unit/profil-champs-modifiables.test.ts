/**
 * Que peut-on écrire dans un profil depuis l'interface ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * `PUT /api/user-profiles/:id` écartait trois champs — `id`, `createdAt`,
 * `tenantId` — et écrivait tout le reste du corps de la requête en base.
 *
 * Un membre quelconque du locataire pouvait donc, en une seule requête :
 *   • se nommer `owner` et obtenir tous les droits ;
 *   • poser `isActive: false` sur le compte d'un collègue ;
 *   • remplacer le `password` d'autrui par une empreinte de son choix ;
 *   • se donner un `maxPurchaseAmount` arbitraire, ou le droit de valider
 *     les ordres de travail et les commandes.
 *
 * Et sans malveillance : le formulaire renvoie l'objet profil COMPLET, donc un
 * `isActive` recopié depuis un état périmé désactive le compte comme effet de
 * bord d'une modification sans rapport. Deux comptes ont été retrouvés
 * désactivés sans que personne ne l'ait demandé, les 2026-09-27 et 2026-10-11.
 *
 * La route liste désormais ce qui est modifiable, et non ce qui ne l'est pas :
 * une colonne ajoutée demain est refusée par défaut plutôt qu'acceptée par
 * oubli. Ce test épingle la frontière.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..');

/** La liste blanche telle qu'elle est écrite dans la route. */
function champsModifiables(): Set<string> {
  const source = readFileSync(join(RACINE, 'server', 'routes.ts'), 'utf8');
  const bloc = source.match(/const CHAMPS_MODIFIABLES = new Set\(\[([\s\S]*?)\]\);/);
  if (!bloc) throw new Error('CHAMPS_MODIFIABLES introuvable dans server/routes.ts');
  return new Set([...bloc[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
}

/** Les colonnes réelles de `user_profiles`, relues depuis le schéma. */
function colonnesDuProfil(): string[] {
  const schema = readFileSync(join(RACINE, 'shared', 'schema.ts'), 'utf8');
  const table = schema.match(/export const userProfiles = pgTable\([\s\S]*?\n\}\);/);
  if (!table) throw new Error('table userProfiles introuvable');
  return [...table[0].matchAll(/^\s{2}([a-zA-Z]+):/gm)].map((m) => m[1]);
}

describe('Champs modifiables depuis PUT /api/user-profiles/:id', () => {
  const autorises = champsModifiables();
  const colonnes = colonnesDuProfil();

  it('le test lit bien les deux côtés', () => {
    expect(autorises.size).toBeGreaterThan(3);
    expect(colonnes).toContain('isActive');
    expect(colonnes).toContain('password');
  });

  it('aucun champ sensible n\'est modifiable par cette route', () => {
    // Chacun de ces champs décide d'un accès, d'un privilège ou d'une identité.
    // Ils relèvent des routes d'administration dédiées, jamais d'un formulaire
    // de profil.
    const interdits = [
      'id', 'tenantId', 'username', 'email', 'password', 'role', 'isActive',
      'validationLevel', 'canValidateWorkOrders', 'canValidatePurchaseOrders',
      'maxPurchaseAmount', 'mfaSecret', 'mfaEnabled', 'mfaBackupCodes',
      'mustChangePassword', 'isDefaultCredentials', 'passwordExpiresAt',
      'defaultCredentialsGeneratedAt', 'defaultCredentialsGeneratedBy',
      'lastPasswordChange', 'failedLoginAttempts', 'accountLockedUntil',
      'passwordResetToken', 'passwordResetTokenExpiresAt',
      'passwordResetRequestedAt', 'lastLogin', 'createdAt', 'updatedAt',
    ];

    const fuites = interdits.filter((c) => autorises.has(c));
    expect(fuites).toEqual([]);
  });

  it('toute colonne autorisée existe réellement dans le schéma', () => {
    // Un nom mal orthographié passerait le filtre sans jamais rien écrire :
    // la mise à jour semblerait réussir et ne ferait rien.
    const inconnus = [...autorises].filter((c) => !colonnes.includes(c));
    expect(inconnus).toEqual([]);
  });

  it('toute colonne du schéma est soit autorisée, soit délibérément exclue', () => {
    // Garde-fou pour l'avenir : une colonne ajoutée demain apparaîtra ici, et
    // il faudra décider de son sort — plutôt que de la laisser filtrer par
    // hasard dans un sens ou dans l'autre.
    const interdits = new Set([
      'id', 'tenantId', 'username', 'email', 'password', 'role', 'isActive',
      'validationLevel', 'canValidateWorkOrders', 'canValidatePurchaseOrders',
      'maxPurchaseAmount', 'mfaSecret', 'mfaEnabled', 'mfaBackupCodes',
      'mustChangePassword', 'isDefaultCredentials', 'passwordExpiresAt',
      'defaultCredentialsGeneratedAt', 'defaultCredentialsGeneratedBy',
      'lastPasswordChange', 'failedLoginAttempts', 'accountLockedUntil',
      'passwordResetToken', 'passwordResetTokenExpiresAt',
      'passwordResetRequestedAt', 'lastLogin', 'createdAt', 'updatedAt',
    ]);
    const nonClasses = colonnes.filter((c) => !autorises.has(c) && !interdits.has(c));
    expect(nonClasses).toEqual([]);
  });
});

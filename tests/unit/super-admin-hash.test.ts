/**
 * Un hash super-admin mal configuré est-il nommé comme tel ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Docker Compose interprète « $ » comme une référence de variable dans un
 * fichier d'environnement. Or un hash bcrypt commence par `$2b$10$`. Sans
 * échappement (`$$`), le hash arrive TRONQUÉ au conteneur : `bcrypt.compare`
 * renvoie false, et le serveur répondait « identifiants super-admin
 * incorrects » — exactement le message d'un mot de passe erroné.
 *
 * L'exploitant cherche alors du côté de son mot de passe, qui est pourtant
 * bon. C'est arrivé le 2026-09-24. Le serveur distingue désormais les deux
 * situations, et ce test épingle la frontière : une regex trop laxiste
 * laisserait repasser la confusion, une regex trop stricte refuserait des
 * hashes valides et interdirait TOUTE connexion à la console.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import bcrypt from 'bcrypt';

const DOLLAR = '$';

/** La regex telle qu'elle est écrite dans la route, relue depuis la source. */
function regexDeLaRoute(): RegExp {
  const source = readFileSync(
    join(__dirname, '..', '..', 'server', 'super-admin-routes.ts'), 'utf8');
  const ligne = source.match(/const HASH_BCRYPT = (\/.+\/);/);
  if (!ligne) throw new Error('HASH_BCRYPT introuvable dans super-admin-routes.ts');
  // eslint-disable-next-line no-eval
  return eval(ligne[1]) as RegExp;
}

describe('Reconnaissance du hash super-admin', () => {
  const HASH_BCRYPT = regexDeLaRoute();

  it('accepte un hash réellement produit par bcrypt', () => {
    // Le cas qui compte : si ceci échoue, PLUS PERSONNE ne peut se connecter.
    const vrai = bcrypt.hashSync('un mot de passe quelconque', 10);
    expect(vrai).toHaveLength(60);
    expect(HASH_BCRYPT.test(vrai)).toBe(true);
  });

  it('accepte les trois variantes de préfixe', () => {
    const corps = 'N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    for (const cout of ['10', '12']) {
      for (const lettre of ['a', 'b', 'y']) {
        const hash = `${DOLLAR}2${lettre}${DOLLAR}${cout}${DOLLAR}${corps}`;
        expect({ hash: hash.slice(0, 7), accepte: HASH_BCRYPT.test(hash) })
          .toEqual({ hash: hash.slice(0, 7), accepte: true });
      }
    }
  });

  it("refuse un hash mangé par l'interpolation de Docker Compose", () => {
    const vrai = bcrypt.hashSync('secret', 10);
    // Ce que Compose produit quand les « $ » ne sont pas doublés : chaque
    // référence de variable inexistante est remplacée par du vide.
    const mange = vrai.replace(/\$2[aby]\$\d{2}\$/, '');
    expect(mange).not.toBe(vrai);
    expect(HASH_BCRYPT.test(mange)).toBe(false);
  });

  it('refuse les autres formes de configuration ratée', () => {
    const vrai = bcrypt.hashSync('secret', 10);
    const ratees: Array<[string, string]> = [
      ['variable vide', ''],
      ['mot de passe en clair au lieu du hash', 'monMotDePasse'],
      ['tronqué', vrai.slice(0, 59)],
      ['retour à la ligne collé', `${vrai}x`],
      ['espace avant', ` ${vrai}`],
      // L'échappement est destiné à Compose ; s'il reste dans la valeur lue par
      // l'application, le hash est faux d'un caractère sur deux.
      ['échappement laissé dans la valeur', vrai.split(DOLLAR).join(DOLLAR + DOLLAR)],
      ['préfixe inexistant', `${DOLLAR}2c${DOLLAR}10${DOLLAR}${vrai.slice(7)}`],
    ];

    for (const [nom, valeur] of ratees) {
      expect({ nom, accepte: HASH_BCRYPT.test(valeur) })
        .toEqual({ nom, accepte: false });
    }
  });
});

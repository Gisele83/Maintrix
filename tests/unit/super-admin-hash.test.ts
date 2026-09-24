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

/**
 * L'échappement survit-il à son écriture dans le fichier ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * `reparer-super-admin.mjs` doublait correctement les « $ », puis posait la
 * ligne avec `String.replace(motif, "CLE=" + valeur)`. Or `replace` interprète
 * « $$ » DANS LA CHAÎNE DE REMPLACEMENT comme un « $ » littéral : l'échappement
 * était défait au moment même de l'écriture.
 *
 * Le hash est donc parti nu dans le fichier. Docker Compose y a vu une
 * référence de variable, a prévenu (« the "B2VInGBfJOvgvVka2Q5zw" variable is
 * not set »), et a livré au conteneur un hash de 38 caractères sur 60. Le
 * super-administrateur s'est retrouvé dehors — par la faute de l'outil censé
 * l'y faire rentrer, le 2026-09-24.
 *
 * On épingle donc la chaîne complète : échapper → écrire → interpoler →
 * vérifier le mot de passe.
 */
describe('Écriture du hash dans le fichier d\'environnement', () => {
  const HASH_BCRYPT = regexDeLaRoute();
  const DOUBLE = DOLLAR + DOLLAR;

  /**
   * Ce que Docker Compose fait d'une valeur, modélisé en une passe :
   *   • `$$` est l'échappement, il redonne un `$` littéral ;
   *   • `$NOM` et `${NOM}` sont des références ; non définies, elles
   *     disparaissent (« variable is not set. Defaulting to a blank string ») ;
   *   • un `$` suivi d'un chiffre n'ouvre pas un identifiant valide et reste tel
   *     quel — c'est pourquoi `$2b$10` a survécu là où le reste a été mangé.
   */
  const interpoler = (valeur: string) =>
    valeur.replace(/\$\$|\$\{[A-Za-z_]\w*\}|\$[A-Za-z_]\w*/g,
      (trouve) => (trouve === DOUBLE ? DOLLAR : ''));

  /** La pose de ligne, telle que l'écrit le script (version corrigée). */
  const poser = (contenu: string, cle: string, valeur: string) => {
    const motif = new RegExp(`^${cle}=.*$`, 'm');
    return motif.test(contenu)
      ? contenu.replace(motif, () => `${cle}=${valeur}`)
      : `${contenu.replace(/\n?$/, '\n')}${cle}=${valeur}\n`;
  };

  it('le hash traverse écriture puis interpolation sans perdre un caractère', () => {
    const motDePasse = 'Un_MotDePasse-Exemple123';
    const hash = bcrypt.hashSync(motDePasse, 10);
    const echappe = hash.split(DOLLAR).join(DOUBLE);

    const fichier = poser('SUPER_ADMIN_PASSWORD_HASH=ancien\n',
      'SUPER_ADMIN_PASSWORD_HASH', echappe);

    const ecrit = fichier.match(/^SUPER_ADMIN_PASSWORD_HASH=(.*)$/m)![1];
    // Le fichier doit contenir des « $ » DOUBLÉS : c'est là que ça cassait.
    expect(ecrit).toBe(echappe);
    expect(ecrit).toContain(DOUBLE);

    const vuParCompose = interpoler(ecrit);
    expect(vuParCompose).toBe(hash);
    expect(vuParCompose).toHaveLength(60);
    expect(bcrypt.compareSync(motDePasse, vuParCompose)).toBe(true);
  });

  it('une chaîne de remplacement, elle, casse l\'échappement', () => {
    // Le bug d'origine, conservé comme repère : si ceci se met à passer, c'est
    // que le comportement de `String.replace` a changé sous nos pieds.
    const hash = bcrypt.hashSync('secret', 10);
    const echappe = hash.split(DOLLAR).join(DOUBLE);

    const casse = 'SUPER_ADMIN_PASSWORD_HASH=ancien\n'
      .replace(/^SUPER_ADMIN_PASSWORD_HASH=.*$/m, `SUPER_ADMIN_PASSWORD_HASH=${echappe}`);
    const ecrit = casse.match(/^SUPER_ADMIN_PASSWORD_HASH=(.*)$/m)![1];

    // L'échappement a disparu : la valeur part nue, à la merci de Compose.
    // Ce qu'il en reste dépend du sel — d'où le cas déterministe ci-dessous,
    // qui rejoue la mutilation réellement observée.
    expect(ecrit).not.toBe(echappe);
    expect(ecrit).not.toContain(DOUBLE);
    expect(ecrit).toBe(hash);
  });

  it('reproduit la mutilation observée en production le 2026-09-24', () => {
    // Hash réel de la panne : le sel commence par « B2VInGBfJOvgvVka2Q5zw ».
    // Compose a nommé cet identifiant dans son avertissement, puis l'a effacé.
    const hash = `${DOLLAR}2b${DOLLAR}10${DOLLAR}B2VInGBfJOvgvVka2Q5zw.O1PqRsTuVwXyZaBcDeFgHiJkLmNoPqR`;
    expect(hash).toHaveLength(60);
    expect(HASH_BCRYPT.test(hash)).toBe(true);

    const mutile = interpoler(hash); // non échappé : ce qui est parti au conteneur
    expect(mutile).toHaveLength(38);
    expect(mutile.startsWith(`${DOLLAR}2b${DOLLAR}`)).toBe(true);
    expect(HASH_BCRYPT.test(mutile)).toBe(false);

    // Échappé, le même hash traverse intact.
    expect(interpoler(hash.split(DOLLAR).join(DOUBLE))).toBe(hash);
  });

  it('la ligne du mot de passe en clair n\'est pas confondue avec celle du hash', () => {
    // `^SUPER_ADMIN_PASSWORD=` ne doit pas attraper `SUPER_ADMIN_PASSWORD_HASH=`.
    const fichier = 'SUPER_ADMIN_PASSWORD_HASH=abc\nSUPER_ADMIN_PASSWORD=vrai\n';
    expect(fichier.match(/^SUPER_ADMIN_PASSWORD=(.*)$/m)![1]).toBe('vrai');
    expect(poser(fichier, 'SUPER_ADMIN_PASSWORD', 'neuf'))
      .toBe('SUPER_ADMIN_PASSWORD_HASH=abc\nSUPER_ADMIN_PASSWORD=neuf\n');
  });
});

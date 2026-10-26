/**
 * Les commandes d'interface de la clôture — garde-fous statiques.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CES VÉRIFICATIONS PEUVENT, ET CE QU'ELLES NE PEUVENT PAS
 * ═══════════════════════════════════════════════════════════════════
 * Elles LISENT LA SOURCE. Ce dépôt n'a ni `@testing-library/react` ni `jsdom`,
 * et la convention y est déjà celle du contrôle statique
 * (`refonte-ui.test.ts`, `roles-cote-client.test.ts`, `cles-de-requete.test.ts`).
 *
 * Elles ne prouvent donc PAS que l'écran fonctionne — cela se vérifie en
 * ouvrant la page, et ça a été fait au navigateur (voir
 * docs/CLOTURE_ORDRE_TRAVAIL.md). Ce qu'elles verrouillent, ce sont trois
 * défauts qui ne se voient pas à la relecture et qui reviendraient
 * silencieusement :
 *
 *   1. UN SECOND CHEMIN VERS LA CLÔTURE. Le sélecteur de statut de la fiche
 *      de détail mutait directement vers `completed`, ce qui donnait deux
 *      clôtures aux effets inégaux : par là, aucune pièce ne pouvait être
 *      déclarée et un refus de magasin n'avait nulle part où s'afficher. Cet
 *      écran a DÉJÀ eu cette forme de défaut une fois — deux implémentations
 *      d'ordres de travail aux contrats de champs différents.
 *
 *   2. UN FILTRE DANS UNE CLÉ DE REQUÊTE. La `queryFn` par défaut de ce
 *      client fait `queryKey.join("/")` : un filtre placé dans un segment
 *      séparé produit `/api/maintenance-counters/?planId=3`, donc un 404
 *      muet, donc un encart vide qu'on prend pour « aucun compteur ».
 *
 *   3. DES ÉCRANS NON RAFRAÎCHIS. La clôture écrit dans le stock, le
 *      préventif, les compteurs et le parc. Sans invalidation, l'utilisateur
 *      lit des valeurs périmées et conclut que la clôture n'a rien fait — ce
 *      qui était précisément le défaut d'avant, et serait alors reproduit en
 *      apparence après l'avoir corrigé en substance.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..');
const ECRAN = join(RACINE, 'client', 'src', 'components', 'work-order-management.tsx');
const source = readFileSync(ECRAN, 'utf8');

/**
 * Les lignes de code, commentaires exclus.
 *
 * Indispensable ici, et pour la raison exacte qui a déjà piégé ce dépôt : les
 * commentaires de ce composant CITENT les motifs qu'ils interdisent, pour
 * expliquer pourquoi ils sont interdits. Sans ce filtre, le test punirait
 * l'explication du défaut au lieu du défaut.
 */
function lignesDeCode(contenu: string): string[] {
  let dansBloc = false;
  return contenu.split('\n').filter((brute) => {
    const texte = brute.trim();
    if (dansBloc) {
      if (texte.includes('*/')) dansBloc = false;
      return false;
    }
    if (texte.startsWith('/*')) {
      if (!texte.includes('*/')) dansBloc = true;
      return false;
    }
    if (texte.startsWith('//') || texte.startsWith('*')) return false;
    return texte.length > 0;
  });
}

const code = lignesDeCode(source);
const codeJoint = code.join('\n');

describe("Le test lit bien l'écran attendu", () => {
  it('la source est trouvée et substantielle', () => {
    // Sans ce témoin, un renommage de fichier rendrait toutes les
    // vérifications suivantes vertes sur une chaîne vide.
    expect(source.length).toBeGreaterThan(10_000);
    expect(code.length).toBeGreaterThan(200);
  });

  it('les commentaires sont bien écartés', () => {
    // Le filtre est lui-même éprouvé : ce composant contient en commentaire
    // des motifs que les tests ci-dessous interdisent.
    expect(source).toContain('// Les compteurs sont lus avec leur filtre');
    expect(codeJoint).not.toContain('Les compteurs sont lus avec leur filtre');
  });
});

describe('Un seul chemin vers la clôture', () => {
  it("aucun appel ne mute le statut vers `completed` directement", () => {
    // `changerStatut` ne transmet rien : il ne fait qu'un PUT de statut. La
    // clôture, elle, consomme des pièces, replanifie et peut être refusée en
    // 409. Passer par `changerStatut` pour clôturer perdrait tout cela.
    const fautifs = code.filter((l) =>
      /changerStatut\.mutate\s*\(/.test(l) && /completed/.test(l),
    );
    expect(fautifs).toEqual([]);
  });

  it('la clôture passe par une mutation dédiée', () => {
    expect(codeJoint).toMatch(/const cloturer = useMutation/);
    expect(codeJoint).toMatch(/status:\s*["']completed["']/);
  });

  it("le bouton « Terminer » ouvre la boîte de clôture", () => {
    expect(codeJoint).toMatch(/onClick=\{\(\)\s*=>\s*ouvrirCloture\(ordre\)\}/);
  });

  it('le sélecteur de statut détourne `completed` vers la boîte de clôture', () => {
    // C'était le second chemin. Il doit intercepter la valeur AVANT de muter.
    expect(codeJoint).toMatch(/if\s*\(e\.target\.value === ["']completed["']\)/);
    expect(codeJoint).toMatch(/ouvrirCloture\(ordreConsulte\)/);
  });
});

describe('Déclaration des pièces', () => {
  it('les pièces partent sous le nom que le serveur lit', () => {
    // La route lit `partsUsed` (lirePiecesDeclarees). Tout autre nom serait
    // ignoré en silence : le serveur reconstruit son objet champ par champ.
    expect(codeJoint).toMatch(/partsUsed:\s*piecesUtilisees/);
  });

  it('un tableau vide n\'est pas envoyé', () => {
    // Une clôture sans pièces est le cas normal (tournée de graissage).
    expect(codeJoint).toMatch(/piecesUtilisees\.length > 0/);
  });

  it('seules les quantités entières et positives sont retenues', () => {
    // Le serveur refuse une quantité nulle ou non entière. Écarter les lignes
    // vides ici évite un 400 pour un champ que l'utilisateur n'a pas rempli.
    expect(codeJoint).toMatch(/Number\.isInteger\(p\.quantity\) && p\.quantity > 0/);
  });

  it('le refus 409 est relu et réaffiché, pas avalé', () => {
    // `apiRequest` aplatit le corps de la réponse dans le message d'erreur :
    // sans cette relecture, la liste des manques que le serveur prend soin de
    // rendre n'arriverait jamais à l'écran.
    expect(codeJoint).toMatch(/function lireRefusStock/);
    expect(codeJoint).toMatch(/STOCK_INSUFFISANT/);
    expect(codeJoint).toMatch(/setManques\(refus\)/);
  });
});

describe('Rattachement au plan préventif', () => {
  it("n'est proposé que pour un ordre préventif", () => {
    expect(codeJoint).toMatch(/formulaire\.orderType === ["']preventive["'] &&/);
  });

  it("n'est envoyé que pour un ordre préventif", () => {
    // Un correctif naît d'une panne, pas d'une échéance : lui attacher un plan
    // ferait avancer à sa clôture une gamme qui n'a pas été exécutée.
    //
    // La vérification porte sur les DEUX SEULS points d'envoi — la
    // construction du corps du POST, et le corps du PUT — et non sur toute
    // ligne contenant `planId`. Un balayage large attraperait les
    // déclarations de type, l'état du formulaire et le pré-remplissage de la
    // fiche, qui n'envoient rien : le test échouerait alors sur du code
    // correct, ce qui est pire qu'un test absent (mesuré, première version).
    const envoiPost = code.filter((l) => /corps\.planId\s*=/.test(l));
    expect(envoiPost).toHaveLength(1);
    expect(envoiPost[0]).toMatch(/orderType === ["']preventive["']/);

    // Dans le corps du PUT, `planId` est un ternaire sur le type. On relit les
    // deux lignes qui le portent, le ternaire étant écrit sur plusieurs lignes.
    const indexPut = code.findIndex((l) => /^\s*planId:\s*formulaire\.orderType/.test(l));
    expect(indexPut).toBeGreaterThanOrEqual(0);
    const ternaire = code.slice(indexPut, indexPut + 3).join(' ');
    expect(ternaire).toMatch(/orderType === ["']preventive["']/);
    expect(ternaire).toMatch(/:\s*null/);
  });

  it('passer un ordre de préventif à correctif le DÉTACHE de son plan', () => {
    // `null` explicite et non `undefined` : PUT recopie le corps, donc
    // `undefined` laisserait l'ancien rattachement en place.
    expect(codeJoint).toMatch(/:\s*null,?\s*$/m);
    expect(codeJoint).toMatch(/formulaire\.orderType === ["']preventive["'] && formulaire\.planId/);
  });

  it('un plan désactivé reste proposé si l\'ordre le porte déjà', () => {
    // Sinon le sélecteur s'afficherait vide sur une fiche existante, et un
    // simple enregistrement effacerait le rattachement sans qu'on le demande.
    expect(codeJoint).toMatch(/p\.isActive !== false \|\| String\(p\.id\) === planActuel/);
  });
});

describe("Indicateur d'arrêt machine", () => {
  it('est une case à cocher explicite, et non une déduction', () => {
    expect(codeJoint).toMatch(/id="ot-arret"/);
    expect(codeJoint).toMatch(/requiresShutdown: e\.target\.checked/);
  });

  it('part au serveur à la création comme à la modification', () => {
    expect(codeJoint).toMatch(/corps\.requiresShutdown = true/);
    expect(codeJoint).toMatch(/requiresShutdown: formulaire\.requiresShutdown/);
  });
});

describe('Compteurs du plan dans la boîte de clôture', () => {
  it("le filtre tient dans UN seul segment de clé de requête", () => {
    // `queryKey.join("/")` : un filtre en segment séparé produirait
    // `/api/maintenance-counters/?planId=3`, soit un 404 muet.
    expect(codeJoint).toMatch(/queryKey:\s*\[`\/api\/maintenance-counters\?planId=\$\{[^}]+\}`\]/);
    // Et jamais le filtre comme second élément de la clé.
    expect(codeJoint).not.toMatch(/\["\/api\/maintenance-counters",/);
  });

  it("la requête ne part pas quand l'ordre n'a pas de plan", () => {
    expect(codeJoint).toMatch(/enabled:\s*Boolean\(ordreACloturer\?\.planId\)/);
  });

  it('le relevé est montré avec la valeur qu\'il prendra après', () => {
    expect(codeJoint).toMatch(/après clôture/);
  });
});

describe('Les écrans que la clôture modifie sont rafraîchis', () => {
  // Chacun lit quelque chose que la clôture vient d'écrire. Un écran périmé
  // donnerait à l'utilisateur la même impression que le défaut d'origine :
  // « j'ai clôturé, et rien n'a bougé ».
  const attendus = ['/api/spare-parts', '/api/preventive-maintenance-plans', '/api/equipment'];
  for (const cle of attendus) {
    it(`invalide ${cle}`, () => {
      expect(codeJoint).toContain(`queryKey: ["${cle}"]`);
    });
  }

  it('invalide les compteurs PAR PRÉFIXE, puisque leur clé porte un filtre', () => {
    // Une clé exacte ne les atteindrait pas : elle contient `?planId=…`.
    expect(codeJoint).toMatch(/startsWith\("\/api\/maintenance-counters"\)/);
  });
});

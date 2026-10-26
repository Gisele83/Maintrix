/**
 * L'écran des demandes d'intervention — garde-fous statiques.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CES VÉRIFICATIONS PEUVENT, ET CE QU'ELLES NE PEUVENT PAS
 * ═══════════════════════════════════════════════════════════════════
 * Elles LISENT LA SOURCE. Ce dépôt n'a ni `@testing-library/react` ni `jsdom`,
 * et la convention y est celle du contrôle statique. Elles ne prouvent pas que
 * l'écran fonctionne — cela se vérifie en l'ouvrant, et ça a été fait (voir
 * docs/DEMANDES_INTERVENTION.md). Elles verrouillent trois choses qui ne se
 * voient pas à la relecture, et dont chacune viderait la séparation DI / OT de
 * son sens :
 *
 *   1. LA PRIORITÉ DÉCIDÉE NE REPREND PAS L'URGENCE PERÇUE. Si le formulaire
 *      d'arbitrage pré-remplissait la priorité avec l'urgence du demandeur, la
 *      séparation deviendrait décorative : celui qui signale fixerait de fait
 *      la priorité d'un travail qu'il ne planifie pas.
 *   2. SIGNALER N'A AUCUN GARDE DE RÔLE. C'est le point de toute la
 *      séparation : un opérateur qui voit une fuite doit pouvoir la signaler
 *      sans habilitation. Un garde ajouté « par prudence » reproduirait le
 *      défaut qu'on corrige.
 *   3. LE REFUS EXIGE UN MOTIF jusque dans l'interface. Sans lui, la charge
 *      écartée n'est pas analysable — défaut n° 2 de l'audit.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..');
const ECRAN = join(RACINE, 'client', 'src', 'pages', 'demandes-intervention.tsx');
const source = readFileSync(ECRAN, 'utf8');

/**
 * Les lignes de code, commentaires exclus — **y compris les commentaires JSX**
 * `{/* … *\/}`, qui sont la forme majoritaire dans un écran React et que les
 * filtres des autres suites de ce dépôt ne retirent pas.
 *
 * Le détail compte : un commentaire JSX laissé dans le « code » ferait passer
 * les assertions négatives ci-dessous sur leur propre documentation. Mesuré sur
 * cet écran, qui en porte neuf.
 */
function lignesDeCode(contenu: string): string[] {
  let dansBloc = false;
  return contenu.split('\n').filter((brute) => {
    const texte = brute.trim();
    if (dansBloc) {
      if (texte.includes('*/')) dansBloc = false;
      return false;
    }
    // `{/*` ouvre un commentaire JSX, `/*` un commentaire de bloc.
    if (texte.startsWith('{/*') || texte.startsWith('/*')) {
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
    expect(source.length).toBeGreaterThan(10_000);
    expect(code.length).toBeGreaterThan(200);
  });

  it('les commentaires de ligne sont écartés', () => {
    expect(source).toContain("// Une acceptation crée un ordre de travail");
    expect(codeJoint).not.toContain("Une acceptation crée un ordre de travail");
  });

  it('les commentaires JSX aussi — ils sont la forme majoritaire ici', () => {
    // Sans ce filtre, les assertions négatives passeraient sur leur propre
    // documentation : cet écran porte neuf commentaires `{/* … */}`.
    expect(source).toContain("La priorité est DEMANDÉE, pas reprise de l'urgence");
    expect(codeJoint).not.toContain("La priorité est DEMANDÉE, pas reprise de l'urgence");
  });
});

describe('Les deux échelles restent séparées', () => {
  it("la priorité d'arbitrage ne s'initialise PAS depuis l'urgence de la demande", () => {
    // LE DÉFAUT QU'ON EMPÊCHE : `priority: demande.urgency` rendrait la
    // séparation décorative.
    const fautifs = code.filter((l) =>
      /priority\s*:/.test(l) && /urgency/.test(l),
    );
    expect(fautifs).toEqual([]);
  });

  it("l'état initial de la décision porte une priorité fixe, indépendante", () => {
    expect(codeJoint).toMatch(/orderType:\s*["']corrective["'],\s*priority:\s*["']medium["']/);
  });

  it("l'écran dit que c'est la maintenance qui fixe la priorité", () => {
    expect(codeJoint).toMatch(/C'est la maintenance qui la fixe, pas le demandeur/);
  });

  it("l'urgence est présentée comme PERÇUE, partout où elle s'affiche", () => {
    // Trois endroits : la pastille de la liste, le récapitulatif de
    // l'arbitrage, et l'aide du formulaire de signalement.
    const mentions = code.filter((l) => /[Uu]rgence perçue/.test(l));
    expect(mentions.length).toBeGreaterThanOrEqual(2);
  });

  it("le formulaire de signalement prévient que l'urgence n'est pas la priorité", () => {
    expect(codeJoint).toMatch(/pas la priorité du travail/);
  });
});

describe('Signaler est ouvert', () => {
  it("aucun garde de rôle n'entoure l'action de signalement", () => {
    // Le point de toute la séparation. Un garde ici reproduirait le défaut
    // qu'on corrige : « n'importe qui devait créer directement un OT ».
    const ouvertures = code.filter((l) => /setFormulaireOuvert\(true\)/.test(l));
    expect(ouvertures.length).toBeGreaterThan(0);
    for (const ligne of ouvertures) {
      expect(ligne).not.toMatch(/peutArbitrer/);
    }
  });

  it("l'action principale de l'en-tête n'est pas conditionnée à un rôle", () => {
    // `action={peutArbitrer ? … : undefined}` masquerait « Signaler » aux
    // opérateurs, qui sont justement ceux qui signalent.
    const i = code.findIndex((l) => /action=\{/.test(l));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(code.slice(i, i + 5).join(' ')).not.toMatch(/peutArbitrer/);
  });

  it('les boutons d\'arbitrage, eux, SONT conditionnés', () => {
    // Le témoin : si rien n'était conditionné, le test précédent passerait
    // aussi sur un écran sans aucun contrôle de rôle.
    expect(codeJoint).toMatch(/\{peutArbitrer && \(/);
    expect(codeJoint).toMatch(/setDemandeArbitree\(d\)/);
    expect(codeJoint).toMatch(/setDemandeRefusee\(d\)/);
  });

  it('les droits passent par le référentiel de rôles, pas par une égalité', () => {
    // `owner` est au-dessus d'`admin` et serait refusé par `role === "admin"`.
    expect(codeJoint).toMatch(/auMoins\(user\?\.role, "team_leader"\)/);
    const litteraux = code.filter((l) => /role\s*===\s*["']/.test(l));
    expect(litteraux).toEqual([]);
  });
});

describe('Le refus exige un motif', () => {
  it('le bouton reste inactif sous cinq caractères', () => {
    // Le serveur exige cinq caractères ; laisser le bouton actif produirait un
    // 400 pour un champ que l'utilisateur n'a pas rempli.
    expect(codeJoint).toMatch(/motifRefus\.trim\(\)\.length < 5/);
  });

  it("le motif part bien dans la requête", () => {
    expect(codeJoint).toMatch(/rejectionReason:\s*motifRefus\.trim\(\)/);
  });

  it("l'écran dit à quoi sert le motif", () => {
    expect(codeJoint).toMatch(/rend la charge écartée\s*$|charge écartée/);
  });

  it('le motif enregistré est RÉAFFICHÉ sur la demande refusée', () => {
    // Un motif conservé mais jamais montré ne rendrait pas la charge
    // analysable : il faut le lire sans requête SQL.
    expect(codeJoint).toMatch(/d\.rejectionReason/);
  });
});

describe('La chaîne est traçable depuis l\'écran', () => {
  it("une demande acceptée affiche son ordre de travail", () => {
    expect(codeJoint).toMatch(/d\.workOrderNumber/);
    expect(codeJoint).toMatch(/href="\/work-orders"/);
  });

  it("une demande née d'une alerte le dit", () => {
    expect(codeJoint).toMatch(/\{d\.alertId && \(/);
    expect(codeJoint).toMatch(/née d'une alerte/);
  });

  it("le signalement d'une alerte passe par la route dédiée", () => {
    expect(codeJoint).toMatch(/\/api\/alerts\/\$\{alertId\}\/demande-intervention/);
  });

  it('le 409 « déjà signalée » n\'est pas présenté comme un échec', () => {
    // C'est une information : la demande existe déjà. L'afficher en rouge
    // ferait croire à une erreur de l'utilisateur.
    expect(codeJoint).toMatch(/ALERTE_DEJA_SIGNALEE/);
    expect(codeJoint).toMatch(/dejaSignalee \?/);
  });
});

describe("Les écrans que l'arbitrage modifie sont rafraîchis", () => {
  it('invalide les demandes et les ordres de travail', () => {
    // Une acceptation crée un ordre : sans invalidation, l'écran des OT
    // resterait périmé et l'ordre qui vient de naître paraîtrait absent.
    expect(codeJoint).toContain('queryKey: ["/api/demandes-intervention"]');
    expect(codeJoint).toContain('queryKey: ["/api/work-orders"]');
  });
});

describe('Aucun chiffre fabriqué', () => {
  it('la charge vient du serveur, et non d\'un comptage local partiel', () => {
    // Compter côté client sur la liste FILTRÉE donnerait un total faux dès
    // qu'un filtre est actif — et le chiffre paraîtrait juste.
    expect(codeJoint).toMatch(/charge = data\?\.charge/);
    expect(codeJoint).toMatch(/String\(charge\.pending\)/);
    expect(codeJoint).toMatch(/String\(charge\.rejected\)/);
  });

  it("le repli de charge est explicite, et n'invente aucun total", () => {
    // `?? { pending: 0, … }` affiche zéro AVANT la réponse, pas un chiffre
    // deviné.
    expect(codeJoint).toMatch(/\?\? \{ pending: 0, accepted: 0, rejected: 0, cancelled: 0 \}/);
  });
});

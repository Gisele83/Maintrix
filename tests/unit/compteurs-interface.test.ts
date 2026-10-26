/**
 * L'écran des compteurs d'usage — garde-fous statiques.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CES VÉRIFICATIONS PEUVENT, ET CE QU'ELLES NE PEUVENT PAS
 * ═══════════════════════════════════════════════════════════════════
 * Elles LISENT LA SOURCE. Ce dépôt n'a ni `@testing-library/react` ni `jsdom`,
 * et la convention y est déjà celle du contrôle statique. Elles ne prouvent
 * donc pas que l'écran fonctionne — cela se vérifie en l'ouvrant, et ça a été
 * fait (voir docs/CLOTURE_ORDRE_TRAVAIL.md). Elles verrouillent quatre choses
 * qui ne se voient pas à la relecture :
 *
 *   1. LE CHAMP DEMANDE UN ÉCART, PAS UN RELEVÉ ABSOLU. Un opérateur qui
 *      saisirait 1 240 au lieu de 40 porterait le compteur très au-delà de son
 *      seuil et déclencherait une alerte fausse. Trois parades sont dans
 *      l'écran : le libellé, la date du dernier relevé, et la valeur
 *      résultante calculée avant confirmation.
 *   2. AUCUN CHIFFRE N'EST FABRIQUÉ. Un compteur sans seuil n'est pas « à
 *      0 % », il est SANS ÉCHÉANCE : rendre zéro afficherait une jauge
 *      rassurante là où il n'y a aucune mesure. Le dépôt a une barrière
 *      dédiée contre les chiffres inventés.
 *   3. LE SEUIL D'ALERTE VIENT DU COMPTEUR, pas d'une constante de l'écran.
 *      Une constante donnerait une pastille qui contredit l'alerte réellement
 *      émise par le serveur.
 *   4. LES DROITS PASSENT PAR LE RÉFÉRENTIEL DE RÔLES, pas par une égalité de
 *      chaînes : `owner` est au-dessus d'`admin` et serait refusé par une
 *      comparaison littérale.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..');
const ECRAN = join(RACINE, 'client', 'src', 'pages', 'compteurs.tsx');
const source = readFileSync(ECRAN, 'utf8');

/**
 * Les lignes de code, commentaires exclus — indispensable ici pour la même
 * raison que dans les autres suites de ce dépôt : les commentaires de cet
 * écran CITENT les motifs qu'ils interdisent, pour expliquer pourquoi.
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
    expect(source.length).toBeGreaterThan(10_000);
    expect(code.length).toBeGreaterThan(200);
  });

  it('les commentaires sont bien écartés', () => {
    expect(source).toContain("// Un compteur sans seuil ne déclenche rien");
    expect(codeJoint).not.toContain("Un compteur sans seuil ne déclenche rien");
  });
});

describe("Le relevé demande un ÉCART, et montre ce qu'il va écrire", () => {
  it('le libellé du champ dit « depuis le dernier relevé »', () => {
    // Première parade : nommer l'écart, pas « le relevé ».
    expect(codeJoint).toMatch(/Usage depuis le dernier relevé/);
  });

  it("la date du dernier relevé est affichée dans la boîte", () => {
    // Deuxième parade : donner une borne de départ à l'écart.
    expect(codeJoint).toMatch(/Dernière remise à zéro/);
  });

  it('la valeur résultante est calculée AVANT confirmation', () => {
    // Troisième parade, et la plus efficace : on voit ce qu'on va écrire.
    expect(codeJoint).toMatch(/valeurApres/);
    expect(codeJoint).toMatch(/Le compteur passera à/);
  });

  it('le franchissement du seuil est annoncé', () => {
    expect(codeJoint).toMatch(/franchiraSeuil/);
    expect(codeJoint).toMatch(/une alerte sera émise/);
  });

  it("le bouton reste inactif tant que l'usage n'est pas strictement positif", () => {
    // Le serveur refuse zéro et le négatif ; laisser le bouton actif
    // produirait un 400 pour un champ que l'utilisateur n'a pas rempli.
    expect(codeJoint).toMatch(/usageValide/);
    expect(codeJoint).toMatch(/usageNombre > 0/);
    expect(codeJoint).toMatch(/disabled=\{!usageValide/);
  });

  it("n'envoie pas de note vide", () => {
    expect(codeJoint).toMatch(/notes\.trim\(\)/);
  });
});

describe("Aucun chiffre fabriqué", () => {
  it("un compteur sans seuil rend `null`, et non zéro", () => {
    // LE DÉFAUT QU'ON EMPÊCHE : « 0 % » sur un compteur sans échéance est une
    // jauge rassurante là où il n'y a rien à mesurer.
    const i = code.findIndex((l) => /function partConsommee/.test(l));
    expect(i).toBeGreaterThanOrEqual(0);
    const corps = code.slice(i, i + 5).join(' ');
    expect(corps).toMatch(/return null/);
  });

  it("affiche « aucun seuil défini » plutôt qu'une jauge vide", () => {
    expect(codeJoint).toMatch(/aucun seuil défini/);
    expect(codeJoint).toMatch(/Sans échéance/);
  });

  it('la jauge ne se dessine que si la part est mesurée', () => {
    expect(codeJoint).toMatch(/\{part != null && \(/);
  });

  it("aucune valeur de repli numérique ne déguise une absence en mesure", () => {
    // `?? 0` sur une VALEUR AFFICHÉE transformerait « pas de donnée » en
    // « zéro ». Il reste permis sur les comparaisons et les cumuls, pas sur ce
    // que l'écran imprime : `nombre()` rend « — » pour une absence.
    const i = code.findIndex((l) => /const nombre =/.test(l));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(code.slice(i, i + 3).join(' ')).toMatch(/"—"/);
  });
});

describe("Le seuil d'alerte vient du compteur", () => {
  it("lit `warningThresholdPct`, et ne code pas 90 en dur comme règle", () => {
    // Une constante de l'écran donnerait une pastille qui contredit l'alerte
    // réellement émise par le serveur, qui utilise ce champ par compteur.
    expect(codeJoint).toMatch(/c\.warningThresholdPct \?\? 90/);
  });

  it("le défaut 90 n'apparaît QUE comme repli d'un champ nul", () => {
    // Chaque 90 du code doit être adossé à `warningThresholdPct`, soit comme
    // repli de lecture, soit comme valeur initiale du formulaire.
    const nonAdosses = code.filter(
      (l) => /\b90\b/.test(l) && !/warningThresholdPct/.test(l),
    );
    expect(nonAdosses).toEqual([]);
  });
});

describe('Les droits passent par le référentiel de rôles', () => {
  it('utilise `auMoins`, pas une égalité de chaînes', () => {
    // `owner` est au-dessus d'`admin` et serait refusé par `role === "admin"`.
    expect(codeJoint).toMatch(/import \{ auMoins \} from "@shared\/roles"/);
    expect(codeJoint).toMatch(/auMoins\(user\?\.role, "team_leader"\)/);
    expect(codeJoint).toMatch(/auMoins\(user\?\.role, "technical_director"\)/);
  });

  it("ne compare jamais un rôle littéralement", () => {
    const fautifs = code.filter((l) => /role\s*===\s*["']/.test(l));
    expect(fautifs).toEqual([]);
  });

  it('relever reste ouvert : aucun garde de rôle sur ce bouton', () => {
    // Exiger un chef d'équipe pour saisir un relevé garantirait que personne
    // ne le saisit. Le serveur n'exige aucun niveau, l'écran non plus.
    const i = code.findIndex((l) => /setCompteurReleve\(c\)/.test(l));
    expect(i).toBeGreaterThanOrEqual(0);
    const alentours = code.slice(Math.max(0, i - 4), i + 4).join(' ');
    expect(alentours).not.toMatch(/peutRegler|peutSupprimer/);
  });
});

describe("La valeur courante ne se modifie pas depuis le formulaire", () => {
  it("n'envoie pas `currentValue` dans une modification", () => {
    // Le serveur le refuse (schéma `.strict()`), et c'est voulu : faire bouger
    // un usage par une édition de champ le laisserait changer sans trace.
    const i = code.findIndex((l) => /id: compteurEdite\.id/.test(l));
    expect(i).toBeGreaterThanOrEqual(0);
    const corpsPut = code.slice(i, i + 8).join(' ');
    expect(corpsPut).not.toMatch(/currentValue/);
  });

  it("le dit à l'utilisateur au lieu d'un champ grisé inexpliqué", () => {
    expect(codeJoint).toMatch(/ne se\s*$|ne se modifie pas ici|n'avance que par un relevé/);
  });
});

describe('Les clés de requête supportent leur filtre', () => {
  it("l'historique tient son identifiant dans UN seul segment", () => {
    // `queryKey.join("/")` : un identifiant en segment séparé produirait
    // `/api/maintenance-counters/3/history/` et un 404 muet.
    expect(codeJoint).toMatch(/queryKey:\s*\[`\/api\/maintenance-counters\/\$\{[^}]+\}\/history`\]/);
  });

  it("la requête d'historique ne part pas sans compteur choisi", () => {
    expect(codeJoint).toMatch(/enabled:\s*Boolean\(compteurHistorique\)/);
  });

  it('invalide les clés filtrées PAR PRÉFIXE', () => {
    expect(codeJoint).toMatch(/startsWith\("\/api\/maintenance-counters\/"\)/);
  });
});

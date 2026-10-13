/**
 * Cotation AMDEC — RPN et classe de criticité.
 *
 * ═══════════════════════════════════════════════════════════════════
 * LA RÈGLE QUI MANQUAIT
 * ═══════════════════════════════════════════════════════════════════
 * La classe de criticité ne dépendait que du RPN. Or en AMDEC (AIAG-VDA,
 * IEC 60812), une GRAVITÉ de 9 ou 10 — blessure, atteinte à la vie,
 * non-conformité réglementaire — impose une action QUEL QUE SOIT le RPN.
 * C'est la règle cardinale de la méthode, et elle prime sur le produit.
 *
 * Sans elle, un mode coté S=10, O=1, D=1 donne RPN = 10 et se classait
 * « low » : la rupture d'un organe de sécurité, rare et détectable, était
 * rangée tout en bas de la liste. Les défaillances les plus dangereuses
 * étaient précisément les moins bien classées. Constaté le 2026-10-13.
 *
 * Deuxième règle retenue, dite de criticité S×O : une gravité forte (7-8)
 * conjuguée à une occurrence non négligeable (≥ 4) mérite d'être traitée même
 * si une bonne détectabilité écrase le produit. La détectabilité réduit la
 * probabilité qu'un défaut ATTEIGNE le client ; elle ne réduit en rien la
 * gravité de ce qui arrive s'il l'atteint.
 *
 * Les seuils RPN (200 / 100 / 50) sont conventionnels.
 */

export type ClasseCriticite = 'low' | 'medium' | 'high' | 'critical';

export interface CotationAmdec {
  rpn: number;
  criticalityClass: ClasseCriticite;
  /** Pourquoi cette classe. Un classement inexplicable n'est pas suivi. */
  motifsCriticite: string[];
}

/** Gravité à partir de laquelle une action est requise, RPN ou non. */
export const GRAVITE_ACTION_OBLIGATOIRE = 9;

export function coterModeDefaillance(s: number, o: number, d: number): CotationAmdec {
  const rpn = s * o * d;

  let cls: ClasseCriticite = 'low';
  if (rpn >= 200) cls = 'critical';
  else if (rpn >= 100) cls = 'high';
  else if (rpn >= 50) cls = 'medium';

  const motifsCriticite: string[] = [`RPN ${rpn} (S${s} × O${o} × D${d})`];

  if (s >= GRAVITE_ACTION_OBLIGATOIRE) {
    cls = 'critical';
    motifsCriticite.push(
      `Gravité ${s} : conséquence sécurité ou réglementaire — action requise `
      + 'indépendamment du RPN',
    );
  } else if (s >= 7 && o >= 4 && cls === 'low') {
    cls = 'medium';
    motifsCriticite.push(
      `Gravité ${s} avec occurrence ${o} : la détectabilité écrase le RPN sans `
      + 'réduire la gravité de la défaillance',
    );
  }

  return { rpn, criticalityClass: cls, motifsCriticite };
}

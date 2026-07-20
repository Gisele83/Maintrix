/**
 * ParametersDelta — synchronisation inter-sites à schéma fermé, zéro donnée
 * brute. Brevet MAINTRIX-SCA-ISC, revendications 1c et 15.
 *
 * Seuls les deltas de poids/nœuds/arêtes, une signature cryptographique et un
 * horodatage sont transmis entre un site et l'agrégation globale — jamais de
 * valeur capteur instantanée, d'identité de personnel, ou d'horodatage
 * opérationnel. Le schéma zod `.strict()` fait échouer le parsing sur tout
 * champ additionnel : c'est la propriété "vérifiable par audit du code source
 * et par assertions techniques de tests automatisés" citée en revendication 15.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const DeltaNodeSchema = z.object({
  id: z.string(),
  weight: z.number(),
}).strict();

const DeltaEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  weight: z.number(),
}).strict();

export const ParametersDeltaSchema = z.object({
  deltaWeights: z.array(z.number()).nullable(),
  deltaNodes: z.array(DeltaNodeSchema).nullable(),
  deltaEdges: z.array(DeltaEdgeSchema).nullable(),
  sourceSignature: z.string(),
  timestamp: z.string(),
}).strict();

export type ParametersDelta = z.infer<typeof ParametersDeltaSchema>;

function getSecret(): string {
  const secret = process.env.PARAMETERS_DELTA_SECRET;
  if (!secret) {
    throw new Error(
      "PARAMETERS_DELTA_SECRET n'est pas configuré — requis pour signer/vérifier les ParametersDelta."
    );
  }
  return secret;
}

/** Sérialisation canonique (clés triées) du contenu signé — exclut la signature elle-même. */
function canonicalPayload(delta: Omit<ParametersDelta, "sourceSignature">): string {
  return JSON.stringify({
    deltaWeights: delta.deltaWeights,
    deltaNodes: delta.deltaNodes,
    deltaEdges: delta.deltaEdges,
    timestamp: delta.timestamp,
  });
}

export function signDelta(delta: Omit<ParametersDelta, "sourceSignature">, secret: string = getSecret()): string {
  return createHmac("sha256", secret).update(canonicalPayload(delta)).digest("hex");
}

export function verifyParametersDelta(delta: ParametersDelta, secret: string = getSecret()): boolean {
  const parsed = ParametersDeltaSchema.safeParse(delta);
  if (!parsed.success) return false;

  const expected = signDelta(delta, secret);
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(delta.sourceSignature, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Construit un ParametersDelta signé à partir de deux vecteurs de poids
 * successifs (vecteur local envoyé précédemment vs. vecteur courant) — seule
 * la différence terme à terme est transmise, jamais le vecteur complet ni
 * les données opérationnelles sous-jacentes.
 */
export function buildParametersDelta(
  previousVector: number[] | null,
  currentVector: number[],
  secret: string = getSecret()
): ParametersDelta {
  const deltaWeights = previousVector
    ? currentVector.map((v, i) => v - (previousVector[i] ?? 0))
    : currentVector.slice();

  const withoutSignature = {
    deltaWeights,
    deltaNodes: null,
    deltaEdges: null,
    timestamp: new Date().toISOString(),
  };

  return { ...withoutSignature, sourceSignature: signDelta(withoutSignature, secret) };
}

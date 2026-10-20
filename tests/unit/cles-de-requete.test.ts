/**
 * Les clés de requête du client désignent des URL que le serveur sert.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * La `queryFn` par défaut du projet construit l'URL par
 * `queryKey.join("/")` (client/src/lib/queryClient.ts). Une clé à plusieurs
 * éléments devient donc un CHEMIN. C'est juste quand les éléments suivants
 * sont de vrais segments — `["/api/repair", caseId]` → `/api/repair/42` — et
 * faux dès qu'ils sont des filtres, qui appartiennent à la chaîne de requête.
 *
 * Deux écrans en souffraient, mesurés au navigateur le 2026-10-21 :
 *
 *   • « Santé des machines » envoyait `/api/equipment/health/all/24h` → 404.
 *     L'écran gardait son titre, ses filtres et ses onglets, et restait vide.
 *   • « Apprentissage » envoyait `/api/learning-metrics/` tant que le filtre
 *     valait « all » — ce qui passait, par la barre finale — puis
 *     `/api/learning-metrics/pompe` → 404 dès qu'on s'en servait. Un défaut
 *     qu'aucune capture à l'état initial ne montre.
 *
 * Les deux routes attendaient ces valeurs en PARAMÈTRES. Rien ne signalait
 * l'écart : le code compile, l'écran se rend, et la seule trace est un 404
 * dans la console du navigateur.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI EST VÉRIFIÉ, ET LA LIMITE ASSUMÉE
 * ═══════════════════════════════════════════════════════════════════
 * On recense les `useQuery` qui s'appuient sur la `queryFn` par défaut ET
 * dont la clé a plusieurs éléments, puis on compare cette liste à un
 * inventaire explicite. Chaque entrée de l'inventaire est un cas où les
 * éléments suivants sont vraiment des segments de chemin, vérifié à la main.
 *
 * Un nouveau cas fait donc échouer ce test avec sa localisation, et son auteur
 * doit trancher : soit c'est un segment, et il l'inscrit ici ; soit c'est un
 * filtre, et il le passe en paramètre.
 *
 * ⚠️ Limite : ce test lit la source. Il ne dit pas que la route existe côté
 * serveur — seulement que personne n'a ajouté une clé composée sans y penser.
 * La vérification de l'URL réellement émise se fait au navigateur.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..');
const CLIENT = join(RACINE, 'client', 'src');

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    return statSync(chemin).isDirectory() ? sources(chemin)
      : /\.tsx?$/.test(entree) ? [chemin] : [];
  });
}

/**
 * Les clés composées légitimes : leurs éléments suivants sont de vrais
 * segments de chemin. Relevées une à une, et confrontées aux routes du
 * serveur le 2026-10-21.
 */
const SEGMENTS_LEGITIMES = [
  '"/api/repair", caseId',
  '"/api/cctp/tenant", tenantId, "purchase-order-config"',
  '"/api/cctp/tenant", tenantId, "reporting-config"',
  '"/api/cctp/tenant", tenantId, "cctp-compliance"',
  "'/api/client-portal', token",
  '"/api/digital-twin", selectedId',
  '"/api/interventions/by-work-order", selectedWorkOrderId',
  '"/api/interventions", execution?.id',
  '"/api/interventions", executionId, "steps", stepId, "attachments"',
  '"/api/interventions", executionId, "steps", stepId, "measurements"',
] as const;

/**
 * Un `useQuery` et sa clé, pour les appels qui n'apportent pas leur propre
 * `queryFn` — les seuls que la jointure concerne.
 */
interface Appel { fichier: string; ligne: number; cle: string; }

function appelsSansQueryFn(): Appel[] {
  const trouves: Appel[] = [];

  for (const chemin of sources(CLIENT)) {
    const lignes = readFileSync(chemin, 'utf8').split(/\r?\n/);

    for (let i = 0; i < lignes.length; i++) {
      const m = lignes[i].match(/^\s*queryKey:\s*\[(.+)\]\s*,?\s*$/);
      if (!m) continue;

      const cle = m[1].trim();
      // Une clé d'un seul élément ne pose aucun problème : la jointure la
      // rend telle quelle, paramètres de requête compris.
      if (!cle.includes(',')) continue;

      // Les clés nées d'un `invalidateQueries` ne produisent aucune requête.
      const contexte = lignes.slice(Math.max(0, i - 3), i + 1).join(' ');
      if (contexte.includes('invalidateQueries') || contexte.includes('removeQueries')) continue;

      // Une `queryFn` propre dans le même objet : la clé n'est qu'une clé de
      // cache, et aucune URL n'en est tirée. On regarde la fenêtre qui suit,
      // l'option pouvant précéder ou suivre la clé.
      const fenetre = lignes.slice(Math.max(0, i - 4), i + 8).join(' ');
      if (/queryFn\s*:/.test(fenetre)) continue;

      trouves.push({
        fichier: chemin.replace(RACINE, '').split('\\').join('/'),
        ligne: i + 1,
        cle,
      });
    }
  }
  return trouves;
}

describe('Les clés de requête composées désignent des chemins, pas des filtres', () => {
  it("aucune clé composée n'est apparue hors de l'inventaire", () => {
    // Le message d'échec porte le fichier et la ligne : l'auteur n'a pas à
    // chercher lequel de ses `useQuery` est en cause.
    const hors = appelsSansQueryFn()
      .filter((a) => !SEGMENTS_LEGITIMES.some((s) => a.cle.startsWith(s)))
      .map((a) => `${a.fichier}:${a.ligne} → queryKey: [${a.cle}]`);

    expect(hors).toEqual([]);
  });

  it('les deux écrans corrigés passent bien leurs filtres en paramètres', () => {
    // Vérification nominative, pour que le retour en arrière soit visible :
    // le garde-fou ci-dessus ne se déclencherait pas si quelqu'un remettait
    // une clé composée qui figure dans l'inventaire par erreur.
    const sante = readFileSync(
      join(CLIENT, 'components', 'equipment-health-dashboard.tsx'), 'utf8');
    expect({ ecran: 'santé des machines', enParametres: /\/api\/equipment\/health\?equipmentId=/.test(sante) })
      .toEqual({ ecran: 'santé des machines', enParametres: true });

    const apprentissage = readFileSync(
      join(CLIENT, 'pages', 'learning-dashboard.tsx'), 'utf8');
    expect({ ecran: 'apprentissage', enParametres: /\/api\/learning-metrics\?equipmentType=/.test(apprentissage) })
      .toEqual({ ecran: 'apprentissage', enParametres: true });
  });

  it("la `queryFn` par défaut joint toujours la clé — l'hypothèse de ce test", () => {
    // Si cette ligne changeait, tout ce qui précède perdrait son objet. On
    // l'ancre, pour que la refonte de la `queryFn` fasse échouer ce test
    // plutôt que de le rendre silencieusement inutile.
    const client = readFileSync(join(CLIENT, 'lib', 'queryClient.ts'), 'utf8');
    expect(client).toContain('queryKey.join("/")');
  });
});

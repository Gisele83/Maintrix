/**
 * L'interface compare-t-elle encore les rôles à la main ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Le référentiel `shared/roles.ts` a été créé pour le serveur, mais cinq
 * endroits de l'interface continuaient à comparer `user.role` à une chaîne
 * littérale. Deux conséquences mesurées :
 *
 *   • `/system-health` refusait l'accès au rôle `owner` — le compte principal
 *     de chaque organisation, donc précisément la personne qui surveille sa
 *     propre plateforme — parce que `role !== "admin"` est vrai pour lui ;
 *   • la liste des comptes affichait « Utilisateur » pour sept rôles sur neuf :
 *     un directeur technique et un magasinier y étaient indiscernables.
 *
 * Une comparaison littérale ne lève jamais d'erreur : elle refuse ou elle
 * étiquette de travers, en silence. Ce test relit les sources de l'interface
 * et échoue si le motif réapparaît, y compris dans un fichier neuf.
 */
import { describe, it, expect } from '@jest/globals';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RACINE = join(__dirname, '..', '..', 'client', 'src');

function sources(dossier: string): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) return sources(chemin);
    return /\.tsx?$/.test(entree) ? [chemin] : [];
  });
}

/**
 * `user.role === "admin"`, `profile?.role !== 'owner'`… quel que soit le
 * préfixe, l'espacement ou le type de guillemets.
 */
const COMPARAISON_LITTERALE =
  /\b[A-Za-z_$][\w$]*\??\.role\s*[!=]==?\s*["'`][^"'`]+["'`]/g;

/**
 * La forme qui échappait au garde-fou ci-dessus :
 * `["admin","director"].includes(user.role || "")`.
 *
 * Elle ne contient aucun `===`, donc la première expression ne la voyait pas,
 * et elle est pourtant plus trompeuse : la liste a l'air d'être un référentiel
 * alors qu'elle est écrite à la main, elle ne rattrape aucun alias de la base
 * (`manager`, `supervisor`, `maintainer`) et elle oublie les rôles AU-DESSUS
 * de ceux qu'elle nomme — `owner` n'est dans aucune des deux listes relevées.
 */
const LISTE_LITTERALE =
  /\[[^\]\n]*["'`][^\]\n]*\]\s*\.includes\(\s*[A-Za-z_$][\w$]*\??\.role/g;

/**
 * Les écarts tolérés — **aucun**, et c'est le résultat d'une séquence.
 *
 * Deux occurrences avaient été gelées ici : `modern-navigation.tsx` et
 * `tenant-permissions.tsx`. Elles n'étaient pas un oubli — elles RECOPIAIENT
 * le contrôle du serveur, qui comparait lui aussi littéralement à
 * `["admin", "director"]`. Mesuré alors : `GET /api/tenant/users` rendait 200
 * à l'administrateur et **403 au propriétaire**. Les élargir seules aurait
 * rouvert la promesse creuse qu'on venait de fermer, cette fois au détriment
 * du compte principal de l'organisation.
 *
 * Le serveur a depuis été repris (lot serveur, `auMoins(role, 'admin')` sur
 * `GET /api/tenant/users`, `PATCH …/permissions` et `POST /api/tenant/roles`),
 * et le propriétaire y obtient 200. L'interface a donc pu suivre, et la liste
 * est vide.
 *
 * **Elle doit le rester.** Un écart gelé est une dette dont le test ne se
 * plaint pas : il la tait. Si une occurrence réapparaît, corrigez-la plutôt
 * que de l'inscrire ici — et si le serveur l'impose vraiment, écrivez la
 * mesure qui le prouve dans ce commentaire avant d'ajouter la ligne.
 */
const ECARTS_GELES = new Set<string>([]);

describe('Rôles dans l\'interface', () => {
  it('aucune comparaison littérale de rôle ne subsiste', () => {
    const fautifs: string[] = [];

    for (const fichier of sources(RACINE)) {
      const contenu = readFileSync(fichier, 'utf8');
      for (const occurrence of contenu.match(COMPARAISON_LITTERALE) ?? []) {
        const ligne = contenu.slice(0, contenu.indexOf(occurrence)).split('\n').length;
        fautifs.push(`${fichier.replace(RACINE, 'client/src')}:${ligne} → ${occurrence}`);
      }
    }

    expect(fautifs).toEqual([]);
  });

  it('aucune liste de rôles écrite à la main ne réapparaît', () => {
    const fautifs: string[] = [];
    const gelesRencontres = new Set<string>();

    for (const fichier of sources(RACINE)) {
      const relatif = fichier.replace(RACINE, 'client/src').replace(/\\/g, '/');
      const contenu = readFileSync(fichier, 'utf8');
      for (const occurrence of contenu.match(LISTE_LITTERALE) ?? []) {
        if (ECARTS_GELES.has(relatif)) {
          gelesRencontres.add(relatif);
          continue;
        }
        const ligne = contenu.slice(0, contenu.indexOf(occurrence)).split('\n').length;
        fautifs.push(`${relatif}:${ligne} → ${occurrence}`);
      }
    }

    expect(fautifs).toEqual([]);

    // Un écart gelé qui disparaît doit sortir de la liste : sans cela, elle
    // deviendrait une permission dormante, prête à couvrir une occurrence
    // future que personne n'aurait examinée.
    expect([...gelesRencontres].sort()).toEqual([...ECARTS_GELES].sort());
  });

  /**
   * Les actions que le serveur réserve à un rôle doivent être gardées PAR LE
   * RÉFÉRENTIEL dans le fichier qui les propose. On vérifie la présence du
   * garde, pas sa valeur : la valeur, elle, se mesure en se connectant.
   */
  const ACTIONS_GARDEES: ReadonlyArray<readonly [string, string, string]> = [
    // fichier, appel réservé, seuil attendu
    ['components/work-order-management.tsx', '/api/work-orders/', 'technical_director'],
    ['components/preventive-maintenance.tsx', '/api/preventive-maintenance-plans/', 'technical_director'],
    ['components/inventory-simple.tsx', '/api/spare-parts/', 'technical_director'],
    ['pages/permit-to-work.tsx', '/api/permits/', 'team_leader'],
    ['pages/erp-configuration.tsx', '/api/tenant/modules', 'admin'],
    ['pages/system-health.tsx', '/api/system/health', 'admin'],
    ['pages/user-management.tsx', '/api/enterprise-auth/admin/users', 'admin'],
    // Le dernier écran à avoir rejoint le référentiel, une fois le serveur
    // repris : c'est lui qui portait l'un des deux écarts gelés.
    ['pages/tenant-permissions.tsx', '/api/tenant/users', 'admin'],
  ];

  it.each(ACTIONS_GARDEES)(
    '%s garde son action réservée par auMoins(…, %p au moins %p)',
    (fichier, appel, seuil) => {
      const contenu = readFileSync(join(RACINE, ...fichier.split('/')), 'utf8');
      // L'écran appelle bien l'action réservée…
      expect(contenu).toContain(appel);
      // …et c'est le référentiel qui décide, au seuil mesuré sur le serveur.
      expect(contenu).toMatch(/from ["']@shared\/roles["']/);
      expect(contenu).toMatch(
        new RegExp(`auMoins\\([^)]*["']${seuil}["']\\s*\\)`),
      );
    },
  );

  it('le référentiel est bien importable depuis le client', () => {
    // L'alias `@shared` doit résoudre : une erreur ici casse la compilation
    // de toutes les pages corrigées.
    const config = readFileSync(join(__dirname, '..', '..', 'vite.config.ts'), 'utf8');
    expect(config).toMatch(/@shared/);
  });
});

/**
 * Référentiel CENTRAL des rôles — source unique pour le serveur et l'interface.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Plusieurs nomenclatures coexistaient dans le code :
 *
 *   • `shared/schema.ts` documentait deux vocabulaires différents selon la
 *     table (`owner, admin, maintainer, viewer, technician` d'un côté,
 *     `technician, team_leader, planner, procurement, maintenance_manager,
 *     technical_director, admin` de l'autre) ;
 *   • `server/rbac-permissions.ts` n'en connaissait que sept, sans `owner` —
 *     or `owner` est précisément le rôle donné au propriétaire d'un locataire
 *     à sa création. `hasPermission("owner", …)` lisait donc `undefined` et
 *     LEVAIT une exception ;
 *   • `permit-to-work-routes.ts` et `simple-validation-routes.ts` comparaient à
 *     `manager` et `supervisor`, qui n'existent dans aucune des deux listes :
 *     ces contrôles ne pouvaient jamais être satisfaits ;
 *   • le formulaire super-admin acceptait du texte libre, donc « Administrateur »
 *     là où le système attend `admin`.
 *
 * Un rôle mal orthographié ne produit pas d'erreur visible : il produit un
 * refus d'accès inexplicable, ou une permission accordée par accident. D'où ce
 * référentiel unique, avec une fonction de normalisation qui rattrape les
 * anciennes valeurs déjà présentes en base.
 */

export interface DefinitionRole {
  /** Valeur stockée en base et comparée dans le code. Jamais traduite. */
  readonly id: string;
  /** Libellé affiché à l'utilisateur. */
  readonly libelle: string;
  /** À quoi sert ce rôle, en une phrase. */
  readonly description: string;
  /** Position hiérarchique — sert aux comparaisons « au moins ce niveau ». */
  readonly niveau: number;
}

/**
 * Rôles d'un locataire, du plus étendu au plus restreint.
 * `super_admin` n'y figure pas : il vit hors des locataires (voir plus bas).
 */
export const ROLES = [
  {
    id: 'owner',
    libelle: 'Propriétaire',
    description: "Compte principal de l'entreprise, créé avec le locataire.",
    niveau: 7,
  },
  {
    id: 'admin',
    libelle: 'Administrateur',
    description: 'Administre les comptes et les réglages du locataire.',
    niveau: 6,
  },
  {
    id: 'technical_director',
    libelle: 'Directeur technique',
    description: 'Vue complète, validation et budget.',
    niveau: 5,
  },
  {
    id: 'maintenance_manager',
    libelle: 'Responsable maintenance',
    description: 'Pilote les interventions et les plans de maintenance.',
    niveau: 4,
  },
  {
    id: 'planner',
    libelle: 'Planificateur',
    description: 'Planifie les interventions et les préventifs.',
    niveau: 3,
  },
  {
    id: 'procurement',
    libelle: 'Achats / Magasin',
    description: 'Gère le stock de pièces et les commandes.',
    niveau: 3,
  },
  {
    id: 'team_leader',
    libelle: "Chef d'équipe",
    description: 'Suit et affecte le travail de son équipe.',
    niveau: 2,
  },
  {
    id: 'technician',
    libelle: 'Technicien',
    description: 'Exécute les interventions qui lui sont affectées.',
    niveau: 1,
  },
  {
    id: 'viewer',
    libelle: 'Lecture seule',
    description: 'Consulte sans rien modifier.',
    niveau: 0,
  },
] as const satisfies readonly DefinitionRole[];

export type RoleLocataire = (typeof ROLES)[number]['id'];

/** Les identifiants seuls, dans l'ordre d'affichage. */
export const IDENTIFIANTS_ROLES: readonly RoleLocataire[] = ROLES.map((r) => r.id);

/** Rôle attribué quand rien n'est précisé — le moins privilégié qui reste utile. */
export const ROLE_PAR_DEFAUT: RoleLocataire = 'technician';

/**
 * Rôle de la plateforme, hors locataire : il n'appartient à aucune entreprise
 * et n'est jamais stocké dans `user_profiles.role`. Il est nommé ici pour que
 * les contrôles qui l'acceptent puissent s'y référer sans le réécrire.
 */
export const ROLE_SUPER_ADMIN = 'super_admin';

export const NIVEAU_ROLE: Record<RoleLocataire, number> = Object.fromEntries(
  ROLES.map((r) => [r.id, r.niveau]),
) as Record<RoleLocataire, number>;

const PAR_IDENTIFIANT = new Map<string, DefinitionRole>(ROLES.map((r) => [r.id, r]));

/**
 * Anciennes valeurs, rattrapées silencieusement.
 *
 * Elles existent déjà en base et dans du code ancien : les refuser casserait
 * des comptes en service. Elles ne doivent PAS être proposées à la saisie —
 * seule `ROLES` alimente les listes déroulantes.
 */
const ALIAS: Record<string, RoleLocataire> = {
  // Nomenclature anglaise divergente
  manager: 'maintenance_manager',
  supervisor: 'team_leader',
  maintainer: 'technician',
  operator: 'technician',
  // `user` servait de valeur de repli quand aucun rôle n'était connu : on le
  // traite comme le rôle le moins privilégié, jamais comme un administrateur.
  user: 'viewer',
  guest: 'viewer',
  readonly: 'viewer',
  // Saisies en français (le champ était libre)
  proprietaire: 'owner',
  administrateur: 'admin',
  directeur_technique: 'technical_director',
  responsable_maintenance: 'maintenance_manager',
  planificateur: 'planner',
  achats: 'procurement',
  magasin: 'procurement',
  chef_dequipe: 'team_leader',
  chef_equipe: 'team_leader',
  technicien: 'technician',
  superviseur: 'team_leader',
  lecteur: 'viewer',
  lecture_seule: 'viewer',
};

/**
 * Minuscules, sans accents, espaces et tirets ramenés à « _ ».
 *
 * Les apostrophes sont SUPPRIMÉES et non remplacées : « Chef d'équipe » donne
 * `chef_dequipe`, et non `chef_d_equipe` — une seule forme à connaître.
 */
function simplifier(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_');
}

/**
 * Ramène une valeur quelconque à un rôle du référentiel.
 * Renvoie `null` si la valeur ne correspond à rien de connu — l'appelant
 * REFUSE alors l'accès, au lieu de deviner.
 */
export function normaliserRole(valeur: unknown): RoleLocataire | null {
  if (typeof valeur !== 'string' || valeur.trim() === '') return null;
  const cle = simplifier(valeur);
  if (PAR_IDENTIFIANT.has(cle)) return cle as RoleLocataire;
  return ALIAS[cle] ?? null;
}

export function estRoleConnu(valeur: unknown): valeur is RoleLocataire {
  return typeof valeur === 'string' && PAR_IDENTIFIANT.has(valeur);
}

/** Le rôle est-il au moins au niveau demandé ? (`owner` ≥ `admin` ≥ …) */
export function auMoins(role: unknown, minimum: RoleLocataire): boolean {
  const normalise = normaliserRole(role);
  if (!normalise) return false;
  return NIVEAU_ROLE[normalise] >= NIVEAU_ROLE[minimum];
}

/** Libellé affichable ; retombe sur la valeur brute si elle est inconnue. */
export function libelleRole(valeur: unknown): string {
  const normalise = normaliserRole(valeur);
  if (normalise) return PAR_IDENTIFIANT.get(normalise)!.libelle;
  return typeof valeur === 'string' && valeur ? valeur : 'Rôle inconnu';
}

export function definitionRole(valeur: unknown): DefinitionRole | null {
  const normalise = normaliserRole(valeur);
  return normalise ? PAR_IDENTIFIANT.get(normalise)! : null;
}

/**
 * Forme attendue par `z.enum()` : un tuple non vide. Les schémas de validation
 * s'appuient dessus au lieu de recopier la liste des rôles à la main.
 */
export const ROLES_ZOD = IDENTIFIANTS_ROLES as unknown as [RoleLocataire, ...RoleLocataire[]];

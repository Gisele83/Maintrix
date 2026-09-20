# Rôles et permissions — référentiel unique

Source de vérité : [shared/roles.ts](../shared/roles.ts). Toute liste de rôles
écrite ailleurs est un défaut en puissance.

## Les rôles d'un locataire

| Identifiant (en base) | Libellé affiché | Niveau |
|---|---|---|
| `owner` | Propriétaire | 7 |
| `admin` | Administrateur | 6 |
| `technical_director` | Directeur technique | 5 |
| `maintenance_manager` | Responsable maintenance | 4 |
| `planner` | Planificateur | 3 |
| `procurement` | Achats / Magasin | 3 |
| `team_leader` | Chef d'équipe | 2 |
| `technician` | Technicien (défaut) | 1 |
| `viewer` | Lecture seule | 0 |

`super_admin` n'est pas un rôle de locataire : il appartient à la plateforme et
n'est jamais stocké dans `user_profiles.role`.

## Ce qui a été réparé

Quatre nomenclatures coexistaient, et deux contrôles d'accès ne pouvaient
**jamais** être satisfaits :

- `server/rbac-permissions.ts` ignorait `owner` — le rôle du propriétaire de
  chaque locataire. `hasPermission("owner", …)` lisait `undefined` puis
  appelait `.includes` : une **exception**, pas un refus propre.
- `permit-to-work-routes.ts` exigeait `admin`, `manager` ou `supervisor`, et
  `simple-validation-routes.ts` classait les niveaux de validation avec les
  mêmes valeurs. Or `manager` et `supervisor` n'existaient dans aucune liste :
  personne ne pouvait approuver un permis de travail.
- Le formulaire super-admin acceptait du texte libre. « Administrateur » y était
  accepté là où le système attend `admin` : le compte était créé avec un rôle
  que rien ne reconnaît, donc sans droits, sans message d'erreur.

## Les règles à suivre

1. **Ne jamais écrire une liste de rôles en dur.** Importer `ROLES`,
   `IDENTIFIANTS_ROLES` ou `ROLES_ZOD`.
2. **Comparer par niveau**, avec `auMoins(role, 'team_leader')`, plutôt que par
   une liste d'identifiants : un rôle ajouté plus tard s'insère alors tout seul.
3. **Normaliser toute valeur venue de l'extérieur** (base ancienne, formulaire,
   API) avec `normaliserRole()`. Elle rattrape les valeurs héritées
   (`manager`, `supervisor`, `maintainer`, `operator`, `user`) et les saisies en
   français.
4. **Une valeur inconnue vaut refus.** `normaliserRole()` renvoie `null` ;
   `hasPermission()` répond `false`. Jamais de rôle deviné, jamais d'exception.

## Ce qui reste à reprendre

Le référentiel est appliqué aux points de décision : `rbac-permissions`,
`security-middleware`, permis de travail, niveaux de validation, invitations,
génération d'identifiants, formulaire super-admin.

Il reste des écrans qui affichent ou filtrent des rôles avec leurs propres
listes (gestion des utilisateurs, portails fournisseur et client, quelques
tableaux de bord métier). Ils ne décident d'aucun accès : la reprise peut se
faire écran par écran, en remplaçant les listes locales par `ROLES`.

/**
 * Le référentiel des rôles tient-il ses promesses ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Quatre nomenclatures coexistaient : `shared/schema.ts` en documentait deux,
 * `rbac-permissions.ts` en connaissait sept (sans `owner`, pourtant donné au
 * propriétaire de CHAQUE locataire), et des routes comparaient à `manager` ou
 * `supervisor`, qui n'existaient nulle part.
 *
 * Un rôle mal orthographié ne lève pas d'erreur visible : il refuse un accès
 * sans raison lisible, ou — bien pire — laisse passer. Ce test épingle donc :
 *   1. la normalisation des anciennes valeurs ;
 *   2. le refus net d'une valeur inconnue (jamais une exception, jamais un
 *      privilège accordé par défaut) ;
 *   3. la présence de TOUS les rôles dans la matrice de permissions.
 */
import { describe, it, expect } from '@jest/globals';
import {
  ROLES,
  IDENTIFIANTS_ROLES,
  ROLE_PAR_DEFAUT,
  normaliserRole,
  estRoleConnu,
  auMoins,
  libelleRole,
} from '../../shared/roles';
import { ROLE_PERMISSIONS, hasPermission, getPermissions } from '../../server/rbac-permissions';

describe('Référentiel des rôles', () => {
  it('les identifiants sont uniques et les niveaux cohérents', () => {
    expect(new Set(IDENTIFIANTS_ROLES).size).toBe(IDENTIFIANTS_ROLES.length);
    // Du plus étendu au plus restreint : l'ordre d'affichage suit la hiérarchie.
    const niveaux = ROLES.map((r) => r.niveau);
    expect([...niveaux].sort((a, b) => b - a)).toEqual(niveaux);
  });

  it('rattrape les valeurs héritées présentes en base', () => {
    expect(normaliserRole('manager')).toBe('maintenance_manager');
    expect(normaliserRole('supervisor')).toBe('team_leader');
    expect(normaliserRole('maintainer')).toBe('technician');
    expect(normaliserRole('operator')).toBe('technician');
    // `user` servait de repli sans rôle : le moins privilégié, jamais admin.
    expect(normaliserRole('user')).toBe('viewer');
  });

  it('rattrape les saisies libres du formulaire super-admin', () => {
    // Le champ était un texte libre : « Administrateur », « Technicien »…
    expect(normaliserRole('Administrateur')).toBe('admin');
    expect(normaliserRole('  TECHNICIEN ')).toBe('technician');
    expect(normaliserRole("Chef d'équipe")).toBe('team_leader');
    expect(normaliserRole('Responsable maintenance')).toBe('maintenance_manager');
  });

  it('refuse ce qui ne correspond à rien, sans deviner', () => {
    for (const valeur of ['sorcier', '', '   ', null, undefined, 42, {}]) {
      expect(normaliserRole(valeur as unknown)).toBeNull();
    }
    expect(estRoleConnu('manager')).toBe(false); // alias, pas un rôle canonique
    expect(estRoleConnu('admin')).toBe(true);
  });

  it('compare par niveau, alias compris', () => {
    expect(auMoins('owner', 'admin')).toBe(true);
    expect(auMoins('admin', 'admin')).toBe(true);
    expect(auMoins('technician', 'team_leader')).toBe(false);
    // Le cas qui bloquait l'approbation des permis de travail.
    expect(auMoins('supervisor', 'team_leader')).toBe(true);
    expect(auMoins('manager', 'team_leader')).toBe(true);
    // Un rôle inconnu n'atteint jamais aucun niveau.
    expect(auMoins('sorcier', 'viewer')).toBe(false);
  });

  it('affiche un libellé lisible', () => {
    expect(libelleRole('maintenance_manager')).toBe('Responsable maintenance');
    expect(libelleRole('manager')).toBe('Responsable maintenance');
    expect(libelleRole(null)).toBe('Rôle inconnu');
  });
});

describe('Matrice des permissions', () => {
  it('couvre TOUS les rôles du référentiel', () => {
    const manquants = IDENTIFIANTS_ROLES.filter((id) => !Array.isArray(ROLE_PERMISSIONS[id]));
    expect(manquants).toEqual([]);
  });

  it('le propriétaire a les droits de l\'administrateur', () => {
    // `owner` était absent : hasPermission levait une exception sur le rôle du
    // propriétaire de chaque locataire.
    expect(() => hasPermission('owner', 'manage_users')).not.toThrow();
    expect(hasPermission('owner', 'manage_users')).toBe(true);
    expect(getPermissions('owner')).toEqual(ROLE_PERMISSIONS.admin);
  });

  it('la lecture seule ne peut rien modifier', () => {
    const ecritures = getPermissions('viewer').filter((p) => /^(create|edit|delete|manage|validate)/.test(p));
    expect(ecritures).toEqual([]);
    expect(hasPermission('viewer', 'view_equipment')).toBe(true);
  });

  it('un rôle inconnu est refusé proprement, sans exception', () => {
    expect(() => hasPermission('sorcier', 'manage_users')).not.toThrow();
    expect(hasPermission('sorcier', 'manage_users')).toBe(false);
    expect(hasPermission(undefined, 'view_equipment')).toBe(false);
    expect(getPermissions(null)).toEqual([]);
  });

  it('le rôle par défaut existe et reste modeste', () => {
    expect(IDENTIFIANTS_ROLES).toContain(ROLE_PAR_DEFAUT);
    expect(hasPermission(ROLE_PAR_DEFAUT, 'manage_users')).toBe(false);
  });
});

/**
 * Alertes sans propriétaire, ou rattachées au mauvais.
 *
 *   npm run alertes:examiner                 (lecture seule — ne touche à rien)
 *   npm run alertes:examiner -- --rattacher  (rattache les cas SANS AMBIGUÏTÉ)
 *   npm run alertes:examiner -- --corriger-incoherents
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CET OUTIL EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * `alerts_notifications.tenant_id` est nullable, et quatre des cinq chemins
 * d'écriture ne le renseignaient pas. Le moteur de simulation produisant des
 * alertes toutes les 30 secondes, toute instance ayant tourné porte un stock
 * d'alertes n'appartenant à personne.
 *
 * Corriger le code arrête l'hémorragie ; il reste à traiter ce qui a déjà été
 * écrit. Et « traiter » ne veut pas dire « supprimer » : une alerte orpheline
 * reste la trace d'un dépassement de seuil réel sur un équipement réel. On
 * commence donc par REGARDER, et on ne touche qu'à ce dont le propriétaire ne
 * fait aucun doute.
 *
 * ═══════════════════════════════════════════════════════════════════
 * LES QUATRE CATÉGORIES, ET CE QU'ON EN FAIT
 * ═══════════════════════════════════════════════════════════════════
 *
 *   A. RATTACHABLE SANS AMBIGUÏTÉ — tenant_id NULL, equipment_id présent,
 *      équipement existant et rattaché à une organisation.
 *      → Le propriétaire est déterminé par la donnée elle-même, pas deviné.
 *        `--rattacher` les corrige.
 *
 *   B. SANS RATTACHEMENT POSSIBLE — tenant_id NULL, equipment_id NULL.
 *      Typiquement les alertes de stock bas, qui ne portent aucun équipement.
 *      → On ne les rattache PAS. Rien dans la ligne ne dit à qui elle est ;
 *        le seul moyen serait de deviner, et une alerte attribuée au hasard
 *        est pire qu'une alerte orpheline — elle devient visible chez
 *        quelqu'un. Elles restent NULL, donc invisibles de tous : c'est déjà
 *        l'isolement. L'outil les exporte pour examen.
 *
 *   C. ÉQUIPEMENT INTROUVABLE OU SANS ORGANISATION — tenant_id NULL,
 *      equipment_id présent mais l'équipement a disparu ou n'est lui-même
 *      rattaché à personne.
 *      → Même traitement que B : signalées, pas touchées. Si l'équipement
 *        est sans organisation, c'est LUI qu'il faut examiner d'abord.
 *
 *   D. INCOHÉRENTES — tenant_id présent, mais DIFFÉRENT de celui de
 *      l'équipement visé.
 *      → La plus grave des quatre, et la seule qui soit visible par le
 *        mauvais locataire : l'alerte apparaît chez A alors qu'elle décrit
 *        l'équipement de B, nom et valeurs relevées compris. Elle a son
 *        propre indicateur, `--corriger-incoherents`, parce que la corriger
 *        RETIRE quelque chose de la vue de quelqu'un — ce n'est pas le même
 *        geste que rendre visible une ligne que personne ne voyait.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CET OUTIL NE FAIT JAMAIS
 * ═══════════════════════════════════════════════════════════════════
 *   • il ne SUPPRIME aucune ligne, sous aucun indicateur ;
 *   • il n'écrit rien sans indicateur explicite — l'exécution nue est en
 *     lecture seule, et c'est le mode par défaut à dessein : on l'exécute
 *     d'abord pour savoir, on décide ensuite ;
 *   • il ne pose pas de valeur par défaut globale ; chaque rattachement est
 *     justifié ligne à ligne par l'équipement visé ;
 *   • il ne s'appuie sur aucune session : le propriétaire vient de la donnée.
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';

interface Ligne {
  id: number;
  tenant_id: string | null;
  equipment_id: number | null;
  alert_type: string;
  severity: string | null;
  status: string | null;
  created_at: Date | null;
  title: string;
  proprietaire_equipement: string | null;
  equipement_existe: boolean;
}

function rangs<T>(resultat: unknown): T[] {
  return ((resultat as { rows?: unknown[] }).rows ?? resultat) as T[];
}

function tableau(lignes: Ligne[], limite = 10): string {
  if (!lignes.length) return '     (aucune)';
  const vues = lignes.slice(0, limite).map((l) => {
    const date = l.created_at ? new Date(l.created_at).toISOString().slice(0, 10) : '          ';
    return `     #${String(l.id).padEnd(7)} ${date}  ${String(l.alert_type).padEnd(18)}`
      + `éq.${String(l.equipment_id ?? '—').padEnd(6)} ${String(l.title).slice(0, 38)}`;
  });
  if (lignes.length > limite) vues.push(`     … et ${lignes.length - limite} autres`);
  return vues.join('\n');
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL absent.');

  const rattacher = process.argv.includes('--rattacher');
  const corrigerIncoherents = process.argv.includes('--corriger-incoherents');

  const { db, pool } = await import('../server/db');

  try {
    // Une seule lecture, enrichie du propriétaire réel de l'équipement :
    // c'est la jointure qui tranche, pas une supposition.
    const toutes = rangs<Ligne>(await db.execute(sql`
      SELECT a.id, a.tenant_id, a.equipment_id, a.alert_type, a.severity,
             a.status, a.created_at, a.title,
             e.tenant_id          AS proprietaire_equipement,
             (e.id IS NOT NULL)   AS equipement_existe
      FROM alerts_notifications a
      LEFT JOIN equipment_registry e ON e.id = a.equipment_id
      ORDER BY a.id
    `));

    const saines = toutes.filter((l) => l.tenant_id
      && (l.equipment_id == null || l.proprietaire_equipement === l.tenant_id));

    const a = toutes.filter((l) => !l.tenant_id && l.equipment_id != null
      && l.equipement_existe && l.proprietaire_equipement);
    const b = toutes.filter((l) => !l.tenant_id && l.equipment_id == null);
    const c = toutes.filter((l) => !l.tenant_id && l.equipment_id != null
      && (!l.equipement_existe || !l.proprietaire_equipement));
    const d = toutes.filter((l) => l.tenant_id && l.equipment_id != null
      && l.equipement_existe && l.proprietaire_equipement !== l.tenant_id);

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║  ALERTES — ÉTAT DU RATTACHEMENT                                ║
╚════════════════════════════════════════════════════════════════╝

  ${String(toutes.length).padStart(7)} alertes au total
  ${String(saines.length).padStart(7)} saines — propriétaire présent et cohérent
`);

    console.log(`  A. RATTACHABLES SANS AMBIGUÏTÉ : ${a.length}`);
    console.log('     tenant_id absent, mais l\'équipement visé désigne son propriétaire');
    console.log(tableau(a));

    console.log(`\n  B. SANS RATTACHEMENT POSSIBLE : ${b.length}`);
    console.log('     tenant_id absent ET aucun équipement — rien dans la ligne ne dit à qui elle est');
    console.log(tableau(b));

    console.log(`\n  C. ÉQUIPEMENT INTROUVABLE OU ORPHELIN : ${c.length}`);
    console.log('     tenant_id absent, équipement disparu ou lui-même sans organisation');
    console.log(tableau(c));

    console.log(`\n  D. INCOHÉRENTES : ${d.length}`);
    console.log('     tenant_id présent mais DIFFÉRENT du propriétaire de l\'équipement');
    console.log('     — ce sont les seules visibles par la mauvaise organisation');
    console.log(tableau(d));

    if (d.length) {
      console.log('\n     Détail des incohérences :');
      for (const l of d.slice(0, 20)) {
        console.log(`       #${l.id} : alerte chez ${l.tenant_id}, équipement #${l.equipment_id} chez ${l.proprietaire_equipement}`);
      }
    }

    // ── Écritures, uniquement sur demande explicite ─────────────────
    if (!rattacher && !corrigerIncoherents) {
      console.log(`
  ────────────────────────────────────────────────────────────────
  LECTURE SEULE — rien n'a été modifié.

  Pour rattacher les ${a.length} alertes de la catégorie A :
      npm run alertes:examiner -- --rattacher
${d.length ? `
  Pour corriger les ${d.length} incohérences de la catégorie D — ce qui
  RETIRE ces alertes de la vue d'une organisation qui les voyait :
      npm run alertes:examiner -- --corriger-incoherents
` : ''}
  Les catégories B et C ne sont pas corrigeables automatiquement : leur
  propriétaire n'est pas déterminable par la donnée. Elles restent à NULL,
  donc invisibles de tous — c'est l'isolement, pas l'oubli. Exportez-les et
  décidez au cas par cas.
`);
      return;
    }

    if (rattacher) {
      if (!a.length) {
        console.log('\n  Rien à rattacher : la catégorie A est vide.');
      } else {
        // Une transaction, et un UPDATE qui RECALCULE le propriétaire au lieu
        // de faire confiance à ce qu'on a lu plus haut : entre la lecture et
        // l'écriture, l'équipement a pu changer de mains. La condition
        // `tenant_id IS NULL` garantit en outre qu'on n'écrase jamais un
        // rattachement existant.
        const r = await db.execute(sql`
          UPDATE alerts_notifications a
          SET tenant_id = e.tenant_id
          FROM equipment_registry e
          WHERE a.equipment_id = e.id
            AND a.tenant_id IS NULL
            AND e.tenant_id IS NOT NULL
        `);
        const n = (r as { rowCount?: number }).rowCount ?? 0;
        console.log(`\n  ✓ ${n} alertes rattachées à l'organisation de leur équipement.`);
        console.log('    Aucune ligne supprimée. Les catégories B et C sont intactes.');
      }
    }

    if (corrigerIncoherents) {
      if (!d.length) {
        console.log('\n  Aucune incohérence à corriger.');
      } else {
        const r = await db.execute(sql`
          UPDATE alerts_notifications a
          SET tenant_id = e.tenant_id
          FROM equipment_registry e
          WHERE a.equipment_id = e.id
            AND a.tenant_id IS NOT NULL
            AND e.tenant_id IS NOT NULL
            AND a.tenant_id <> e.tenant_id
        `);
        const n = (r as { rowCount?: number }).rowCount ?? 0;
        console.log(`\n  ✓ ${n} alertes réattribuées au propriétaire de leur équipement.`);
        console.log('    Elles ne sont plus visibles par l\'organisation qui les voyait à tort.');
      }
    }

    // Relecture : on ne rend pas compte de ce qu'on a demandé, mais de ce
    // qu'on constate après coup.
    const restant = rangs<{ n: number }>(await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM alerts_notifications WHERE tenant_id IS NULL
    `))[0]?.n ?? 0;
    console.log(`\n  Après opération : ${restant} alertes sans organisation (catégories B et C).`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(`\n${(e as Error).message}\n`);
  process.exit(1);
});

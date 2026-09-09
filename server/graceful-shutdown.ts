/**
 * Arrêt propre et filet de sécurité process — F02.
 *
 * ═══════════════════════════════════════════════════════════════════
 * DEUX RÔLES DISTINCTS, À NE PAS CONFONDRE
 * ═══════════════════════════════════════════════════════════════════
 *
 * 1. ARRÊT PROPRE (SIGTERM / SIGINT) — le cas NORMAL.
 *    `docker stop`, un redéploiement, un `Ctrl-C` envoient SIGTERM. Avant F02,
 *    Maintrix n'avait aucun gestionnaire : le processus mourait sur-le-champ,
 *    sans fermer le serveur HTTP (requêtes en vol coupées) ni le pool
 *    PostgreSQL (connexions laissées au serveur de base jusqu'à expiration).
 *    On ferme désormais dans l'ordre : tâches de fond → serveur HTTP → pool.
 *
 * 2. FILET DE SÉCURITÉ (unhandledRejection / uncaughtException) — le cas ANORMAL.
 *    Ce N'EST PAS la correction de F02. La correction, c'est que chaque boucle
 *    de fond est supervisée (server/background-tasks.ts) et n'envoie plus
 *    d'erreur jusqu'au processus. Ce filet n'attrape que ce qui a échappé à
 *    tout le reste — c'est-à-dire un défaut inconnu.
 *
 *    Il ne MASQUE donc rien : il journalise bruyamment puis provoque un arrêt
 *    CONTRÔLÉ avec un code de sortie non nul, pour que Docker / ECS redémarrent
 *    proprement le service. Continuer à tourner après une `uncaughtException`
 *    laisserait le processus dans un état indéterminé — c'est précisément ce
 *    qu'il ne faut pas faire.
 */

import type { Server } from 'http';
import { stopAllBackgroundTasks } from './background-tasks';

/** Délai au-delà duquel on cesse d'attendre et on sort en force. */
const SHUTDOWN_DEADLINE_MS = 15_000;

let shuttingDown = false;

interface SafetyNetOptions {
  /** Serveur HTTP à fermer. */
  server: Server;
  /** Fermeture du pool de base de données. */
  closeDatabase?: () => Promise<void>;
}

/**
 * Séquence d'arrêt, idempotente : un second signal pendant l'arrêt est ignoré
 * (sauf le cas explicite ci-dessous où l'utilisateur insiste).
 */
async function shutdown(reason: string, exitCode: number, opts: SafetyNetOptions): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n🛑 Arrêt demandé (${reason}) — fermeture ordonnée…`);

  // Filet ultime : si une fermeture se bloque, on ne reste pas suspendu.
  const forceExit = setTimeout(() => {
    console.error(`⛔ Arrêt non terminé après ${SHUTDOWN_DEADLINE_MS} ms — sortie forcée.`);
    process.exit(exitCode);
  }, SHUTDOWN_DEADLINE_MS);
  forceExit.unref();

  // 1) Tâches de fond d'abord : inutile de les laisser écrire en base pendant
  //    qu'on ferme le pool.
  try {
    const stopped = await stopAllBackgroundTasks(5000);
    console.log(`   ✓ ${stopped} tâche(s) de fond arrêtée(s)`);
  } catch (e) {
    console.error('   ✗ arrêt des tâches de fond :', e);
  }

  // 2) Serveur HTTP : cesse d'accepter, laisse finir les requêtes en vol.
  try {
    await new Promise<void>((resolve) => {
      opts.server.close(() => resolve());
      // `close()` n'agit pas sur les connexions keep-alive déjà ouvertes ;
      // la borne globale ci-dessus couvre ce cas.
    });
    console.log('   ✓ serveur HTTP fermé');
  } catch (e) {
    console.error('   ✗ fermeture du serveur HTTP :', e);
  }

  // 3) Base de données en dernier.
  if (opts.closeDatabase) {
    try {
      await opts.closeDatabase();
      console.log('   ✓ pool PostgreSQL fermé');
    } catch (e) {
      console.error('   ✗ fermeture du pool :', e);
    }
  }

  console.log(`✅ Arrêt terminé (code ${exitCode})`);
  process.exit(exitCode);
}

/**
 * Installe les gestionnaires de signaux et le filet de sécurité.
 * À appeler une seule fois, après que le serveur HTTP écoute.
 */
export function installProcessSafetyNet(opts: SafetyNetOptions): void {
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      if (shuttingDown) {
        // L'utilisateur insiste (second Ctrl-C) : on abrège.
        console.warn(`\n⚠️  ${signal} reçu pendant l'arrêt — sortie immédiate.`);
        process.exit(130);
      }
      void shutdown(signal, 0, opts);
    });
  }

  process.on('unhandledRejection', (reason) => {
    // Ne devrait plus arriver depuis F02 : toute tâche de fond est supervisée.
    // Si cela se produit, c'est un chemin non couvert — on le rend visible.
    console.error('⛔ unhandledRejection — promesse rejetée sans gestionnaire.');
    console.error('   Ceci signale un défaut NON COUVERT : une promesse hors du superviseur');
    console.error('   de tâches de fond. Motif :', reason instanceof Error ? reason.stack : reason);
    void shutdown('unhandledRejection', 1, opts);
  });

  process.on('uncaughtException', (err) => {
    console.error('⛔ uncaughtException — exception non interceptée.');
    console.error('   L\'état du processus est désormais indéterminé : on redémarre plutôt');
    console.error('   que de continuer. Erreur :', err?.stack ?? err);
    void shutdown('uncaughtException', 1, opts);
  });

  console.log('🛡️  Arrêt propre armé (SIGTERM/SIGINT) + filet unhandledRejection/uncaughtException');
}

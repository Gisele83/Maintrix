/**
 * Superviseur de tâches de fond — F02.
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE MODULE
 * ═══════════════════════════════════════════════════════════════════
 * Maintrix exécute 13 boucles périodiques dans le processus Node principal.
 * Elles étaient toutes planifiées par `setInterval(fn, ms)` nu. Conséquences
 * mesurées avant correction :
 *
 *   • une exception SYNCHRONE dans un callback devient une `uncaughtException`
 *     → le processus meurt. Reproduit : une erreur dans la boucle de 5 s du
 *       noyau cognitif arrête l'API entière, pour tous les tenants (exit 1).
 *   • une rejection ASYNCHRONE non interceptée devient une
 *     `unhandledRejection` → depuis Node 15, le processus meurt aussi.
 *   • aucune boucle n'était arrêtable : pas de gestionnaire SIGTERM, donc
 *     `docker stop` tuait le processus sans fermer le serveur HTTP ni le pool.
 *   • `setInterval` ne tient pas compte de la durée du tick : si un tick dure
 *     plus longtemps que la période (base lente), les exécutions s'empilent.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE FAIT LE SUPERVISEUR
 * ═══════════════════════════════════════════════════════════════════
 * Il remplace `setInterval` par une planification en `setTimeout` qui se
 * reprogramme après chaque tick. Cela donne, sans changer une ligne de la
 * logique métier de chaque boucle :
 *
 *   1. ISOLATION — le callback est appelé dans un try/catch et son résultat
 *      est `await`é, ce qui capture aussi bien les throws synchrones que les
 *      promesses rejetées. Aucune erreur de tâche n'atteint plus le processus.
 *   2. PAS D'EMPILEMENT — le tick suivant n'est programmé qu'à la fin du
 *      précédent. Une tâche lente ralentit, elle ne sature pas.
 *   3. BACKOFF EXPONENTIEL — après un échec, l'intervalle double (plafonné).
 *      C'est ce qui empêche l'explosion de retries quand une dépendance tombe.
 *   4. CIRCUIT OUVERT — après `maxConsecutiveFailures`, la tâche passe en
 *      `paused` : elle continue de sonder au rythme plafonné mais ne journalise
 *      plus chaque échec. Elle repart seule dès qu'un tick réussit.
 *   5. JOURNALISATION BORNÉE — premiers échecs détaillés, puis une seule ligne
 *      à l'ouverture du circuit, puis silence jusqu'au rétablissement.
 *   6. ARRÊT PROPRE — `stopAllBackgroundTasks()` annule les timers et attend
 *      les ticks en cours, avec une borne de temps.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE LE SUPERVISEUR NE FAIT PAS
 * ═══════════════════════════════════════════════════════════════════
 * Ce n'est ni une file de tâches, ni un ordonnanceur distribué, ni un worker
 * séparé. Les tâches restent dans le processus principal — c'est l'hypothèse
 * assumée du pilote. Voir docs/SINGLE_INSTANCE_ASSUMPTION.md pour la liste des
 * tâches à déplacer ou verrouiller avant tout passage multi-instances.
 */

/** Criticité d'une tâche, telle que classée dans l'inventaire F02. */
export type TaskCriticality =
  | 'A' // critique : son arrêt prolongé dégrade une fonction cœur
  | 'B' // importante mais récupérable : rattrapage au tick suivant
  | 'C'; // secondaire : hygiène, confort, simulation

export type TaskState = 'idle' | 'running' | 'paused' | 'stopped';

export interface BackgroundTaskOptions {
  /** Identifiant unique et lisible, ex. `cognitive-kernel:processing`. */
  name: string;
  /** Période nominale entre deux ticks, en millisecondes. */
  intervalMs: number;
  criticality: TaskCriticality;
  /**
   * Le traitement. Peut être synchrone ou asynchrone : les deux sont couverts.
   * La valeur de retour est ignorée — seul compte le fait de lever ou non.
   */
  run: () => unknown;
  /**
   * Nombre d'échecs consécutifs après lequel le circuit s'ouvre.
   * Défaut : 5.
   */
  maxConsecutiveFailures?: number;
  /**
   * Plafond du backoff. Défaut : 30 × l'intervalle, borné à 15 minutes.
   * Empêche qu'une tâche horaire ne parte à plusieurs heures d'écart.
   */
  maxBackoffMs?: number;
  /** Exécuter un premier tick immédiatement plutôt qu'après un intervalle. */
  runImmediately?: boolean;
}

export interface BackgroundTaskStatus {
  name: string;
  criticality: TaskCriticality;
  state: TaskState;
  intervalMs: number;
  currentDelayMs: number;
  consecutiveFailures: number;
  totalRuns: number;
  totalFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  /** Message de la dernière erreur, tronqué. Jamais exposé publiquement. */
  lastError: string | null;
}

class BackgroundTask {
  private timer: NodeJS.Timeout | null = null;
  private inFlight: Promise<void> | null = null;
  private stopping = false;

  private state: TaskState = 'idle';
  /**
   * Circuit ouvert. Drapeau DÉDIÉ, et non déduit de `state` : `state` repasse à
   * 'running' au début de chaque tick, si bien qu'un test `state !== 'paused'`
   * dans onFailure() serait toujours vrai — le message d'ouverture serait alors
   * répété à chaque échec, exactement le bruit qu'on cherche à supprimer.
   */
  private circuitOpen = false;
  private consecutiveFailures = 0;
  private totalRuns = 0;
  private totalFailures = 0;
  private lastSuccessAt: Date | null = null;
  private lastFailureAt: Date | null = null;
  private lastError: string | null = null;
  private currentDelayMs: number;

  private readonly maxConsecutiveFailures: number;
  private readonly maxBackoffMs: number;

  constructor(private readonly opts: BackgroundTaskOptions) {
    this.currentDelayMs = opts.intervalMs;
    this.maxConsecutiveFailures = opts.maxConsecutiveFailures ?? 5;
    this.maxBackoffMs = opts.maxBackoffMs ?? Math.min(opts.intervalMs * 30, 15 * 60 * 1000);
  }

  get name(): string {
    return this.opts.name;
  }

  start(): void {
    if (this.timer || this.stopping) return;
    this.schedule(this.opts.runImmediately ? 0 : this.opts.intervalMs);
  }

  private schedule(delayMs: number): void {
    if (this.stopping) return;
    this.timer = setTimeout(() => { void this.tick(); }, delayMs);
    // Un timer de fond ne doit jamais, à lui seul, empêcher le processus de
    // se terminer : sans `unref`, l'arrêt propre attendrait le prochain tick.
    this.timer.unref?.();
  }

  private async tick(): Promise<void> {
    this.timer = null;
    if (this.stopping) return;

    this.state = 'running';
    this.totalRuns++;

    // `Promise.resolve().then(...)` convertit un throw SYNCHRONE en rejet :
    // un seul chemin d'erreur à traiter, quel que soit le style du callback.
    this.inFlight = Promise.resolve()
      .then(() => this.opts.run())
      .then(
        () => { this.onSuccess(); },
        (err) => { this.onFailure(err); },
      );

    await this.inFlight;
    this.inFlight = null;

    if (this.stopping) { this.state = 'stopped'; return; }
    this.schedule(this.currentDelayMs);
  }

  private onSuccess(): void {
    const wasOpen = this.circuitOpen;
    this.circuitOpen = false;
    this.consecutiveFailures = 0;
    this.currentDelayMs = this.opts.intervalMs;
    this.lastSuccessAt = new Date();
    this.state = 'idle';
    if (wasOpen) {
      console.log(`✅ [tâche ${this.opts.name}] rétablie — reprise au rythme nominal (${this.opts.intervalMs} ms)`);
    }
  }

  private onFailure(err: unknown): void {
    this.consecutiveFailures++;
    this.totalFailures++;
    this.lastFailureAt = new Date();
    this.lastError = truncate(errorMessage(err), 300);

    // Backoff exponentiel : 2× à chaque échec, plafonné. C'est la garantie
    // « aucune explosion de retries » : une dépendance morte est sondée de
    // moins en moins souvent, jamais plus.
    this.currentDelayMs = Math.min(this.currentDelayMs * 2, this.maxBackoffMs);

    if (this.consecutiveFailures < this.maxConsecutiveFailures) {
      console.error(
        `⚠️  [tâche ${this.opts.name}] échec ${this.consecutiveFailures}/${this.maxConsecutiveFailures} ` +
        `(criticité ${this.opts.criticality}) — prochain essai dans ${this.currentDelayMs} ms : ${this.lastError}`,
      );
      this.state = 'idle';
      return;
    }

    if (!this.circuitOpen) {
      // Une seule ligne à l'ouverture du circuit, puis silence : sans cela une
      // panne de base produit des milliers de lignes identiques et noie les
      // journaux au moment précis où on en a besoin.
      console.error(
        `⛔ [tâche ${this.opts.name}] circuit ouvert après ${this.consecutiveFailures} échecs consécutifs ` +
        `(criticité ${this.opts.criticality}). Sondage réduit à ${this.currentDelayMs} ms, ` +
        `journalisation suspendue jusqu'au rétablissement. Dernière erreur : ${this.lastError}`,
      );
    }
    this.circuitOpen = true;
    this.state = 'paused';
  }

  /** Annule le timer et attend le tick en cours, borné par `graceMs`. */
  async stop(graceMs = 5000): Promise<void> {
    this.stopping = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.inFlight) {
      await Promise.race([this.inFlight, sleep(graceMs)]);
    }
    this.state = 'stopped';
  }

  status(): BackgroundTaskStatus {
    return {
      name: this.opts.name,
      criticality: this.opts.criticality,
      state: this.state,
      intervalMs: this.opts.intervalMs,
      currentDelayMs: this.currentDelayMs,
      consecutiveFailures: this.consecutiveFailures,
      totalRuns: this.totalRuns,
      totalFailures: this.totalFailures,
      lastSuccessAt: this.lastSuccessAt?.toISOString() ?? null,
      lastFailureAt: this.lastFailureAt?.toISOString() ?? null,
      lastError: this.lastError,
    };
  }
}

const registry = new Map<string, BackgroundTask>();

/**
 * Planifie une tâche de fond supervisée et la démarre.
 * Remplace tout appel direct à `setInterval` dans le code serveur.
 */
export function registerBackgroundTask(opts: BackgroundTaskOptions): { stop: () => Promise<void> } {
  if (registry.has(opts.name)) {
    // Un nom réutilisé signalerait deux planifications concurrentes de la même
    // tâche — exactement le doublon qu'on cherche à éviter.
    console.warn(`⚠️  [tâches de fond] « ${opts.name} » déjà enregistrée — l'ancienne est arrêtée puis remplacée.`);
    void registry.get(opts.name)!.stop();
  }
  const task = new BackgroundTask(opts);
  registry.set(opts.name, task);
  task.start();
  return { stop: () => stopBackgroundTask(opts.name) };
}

export async function stopBackgroundTask(name: string, graceMs = 5000): Promise<void> {
  const task = registry.get(name);
  if (!task) return;
  await task.stop(graceMs);
  registry.delete(name);
}

/** Arrête toutes les tâches. Appelé par la séquence d'arrêt propre. */
export async function stopAllBackgroundTasks(graceMs = 5000): Promise<number> {
  const tasks = [...registry.values()];
  registry.clear();
  await Promise.all(tasks.map(t => t.stop(graceMs)));
  return tasks.length;
}

/** Instantané de l'état de toutes les tâches — pour le diagnostic administrateur. */
export function getBackgroundTaskStatus(): BackgroundTaskStatus[] {
  return [...registry.values()].map(t => t.status());
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === 'string') return err;
  try { return JSON.stringify(err); } catch { return String(err); }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => { const t = setTimeout(resolve, ms); t.unref?.(); });
}

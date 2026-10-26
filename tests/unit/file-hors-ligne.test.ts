/**
 * Une saisie faite hors ligne ne disparaît jamais en silence.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUI ÉTAIT
 * ═══════════════════════════════════════════════════════════════════
 * `syncPendingActions` rejouait les actions mises en file pendant une coupure.
 * Après `MAX_RETRY_COUNT` échecs, elle faisait `removePendingAction` avec un
 * simple `console.warn` : **la saisie était détruite**, et le technicien qui
 * l'avait faite sur le terrain n'en savait rien.
 *
 * Ce n'est pas un chemin théorique. Le producteur vivant de cette file est le
 * diagnostic hors ligne (`client/src/components/OfflineDiagnostic.tsx`, qui
 * enfile `type: 'diagnostic'`) : ce qui se perdait était un relevé
 * d'intervention.
 *
 * ═══════════════════════════════════════════════════════════════════
 * CE QUE CETTE SUITE VERROUILLE
 * ═══════════════════════════════════════════════════════════════════
 *   1. après épuisement des tentatives, l'action quitte la file mais est
 *      RETROUVABLE, avec sa charge utile intacte ;
 *   2. le motif du dernier échec est conservé — sans lui, on sait qu'il y a eu
 *      un problème mais pas lequel ;
 *   3. elle peut être remise en file, compteur remis à zéro ;
 *   4. témoin — une action qui réussit est bien retirée, et ne s'accumule pas
 *      dans les mises de côté. Sans lui, un code qui ne supprimerait jamais
 *      rien passerait ce test.
 *
 * L'environnement Jest de ce dépôt est `node` : `localStorage` et `navigator`
 * n'existent pas. On les double, ce qui suffit — la classe ne touche qu'à eux.
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

/** Une doublure de `localStorage` : une Map, et le même contrat. */
function faireLocalStorage() {
  const contenu = new Map<string, string>();
  return {
    getItem: (c: string) => (contenu.has(c) ? contenu.get(c)! : null),
    setItem: (c: string, v: string) => void contenu.set(c, v),
    removeItem: (c: string) => void contenu.delete(c),
    clear: () => contenu.clear(),
    get length() { return contenu.size; },
    key: (i: number) => [...contenu.keys()][i] ?? null,
  };
}

const CLE_EN_ATTENTE = 'gmao_pending_actions';
const CLE_MISES_DE_COTE = 'gmao_abandoned_actions';

let faux: ReturnType<typeof faireLocalStorage>;

beforeEach(() => {
  // ⚠️ Le module pose un `setInterval` dès son CHARGEMENT (offline-storage.ts
  // ligne ~400). Avec les vrais minuteurs, la boucle d'événements ne se vide
  // jamais et Jest attend indéfiniment — la suite ne rendait aucun résultat.
  // Les minuteurs simulés retiennent l'intervalle sans tenir le processus.
  jest.useFakeTimers();

  faux = faireLocalStorage();
  (globalThis as any).localStorage = faux;
  (globalThis as any).navigator = { onLine: true };
  // Le module s'abonne aussi aux événements `online`/`offline` au chargement :
  // sans cette doublure, l'import échoue avant qu'aucun test ne s'exécute.
  (globalThis as any).window = { addEventListener: () => {} };
  jest.resetModules();
});

afterEach(() => {
  jest.useRealTimers();
  delete (globalThis as any).localStorage;
  delete (globalThis as any).navigator;
  delete (globalThis as any).window;
});

/** Le module, chargé après la pose des doublures. */
async function chargerFile() {
  const mod = await import('@/lib/offline-storage');
  return (mod as any).offlineStorage ?? (mod as any).default;
}

const lire = (cle: string) => JSON.parse(faux.getItem(cle) || '[]');

describe('Une action qui échoue trois fois est mise de côté, pas détruite', () => {
  it('la charge utile reste retrouvable, avec le motif', async () => {
    const file = await chargerFile();

    // Un diagnostic saisi hors ligne : exactement ce que le producteur vivant
    // met dans cette file.
    file.addPendingAction({
      type: 'diagnostic',
      data: { equipmentType: 'pompe', symptoms: 'Vibration anormale au démarrage' },
    });
    expect(lire(CLE_EN_ATTENTE)).toHaveLength(1);

    // Le serveur refuse systématiquement : on épuise les tentatives.
    const echec = jest.fn(async () => { throw new Error('Serveur injoignable'); });
    (file as any).processPendingAction = echec;

    for (let i = 0; i < 4; i++) await file.syncPendingActions();

    // Elle a quitté la file…
    expect(lire(CLE_EN_ATTENTE)).toHaveLength(0);

    // …mais elle n'est PAS perdue : c'est tout l'objet du correctif.
    const misesDeCote = file.getAbandonedActions();
    expect(misesDeCote).toHaveLength(1);
    expect(misesDeCote[0].type).toBe('diagnostic');
    expect(misesDeCote[0].data.symptoms).toBe('Vibration anormale au démarrage');
    // Le motif, sans quoi on sait qu'il y a eu un échec mais pas lequel.
    expect(misesDeCote[0].motif).toContain('Serveur injoignable');
    expect(typeof misesDeCote[0].abandonneeLe).toBe('number');
  });

  it('une action mise de côté peut être remise en file, compteur à zéro', async () => {
    const file = await chargerFile();

    file.addPendingAction({ type: 'diagnostic', data: { symptoms: 'Fuite' } });
    (file as any).processPendingAction = jest.fn(async () => { throw new Error('coupure'); });
    for (let i = 0; i < 4; i++) await file.syncPendingActions();

    const [miseDeCote] = file.getAbandonedActions();
    expect(file.rejouerActionAbandonnee(miseDeCote.id)).toBe(true);

    const enAttente = lire(CLE_EN_ATTENTE);
    expect(enAttente).toHaveLength(1);
    expect(enAttente[0].data.symptoms).toBe('Fuite');
    // Sans remise à zéro, l'action serait réabandonnée au premier échec.
    expect(enAttente[0].retryCount).toBe(0);
    // Et elle ne reste pas en double dans les mises de côté.
    expect(file.getAbandonedActions()).toHaveLength(0);
  });

  it('un identifiant inconnu ne prétend pas avoir été rejoué', async () => {
    const file = await chargerFile();
    expect(file.rejouerActionAbandonnee('inexistant')).toBe(false);
  });
});

describe('Témoin — une action qui réussit est simplement retirée', () => {
  it("ne s'accumule pas dans les mises de côté", async () => {
    // Sans ce témoin, un code qui ne supprimerait JAMAIS rien passerait les
    // tests ci-dessus.
    const file = await chargerFile();

    file.addPendingAction({ type: 'diagnostic', data: { symptoms: 'Bruit' } });
    (file as any).processPendingAction = jest.fn(async () => undefined);

    await file.syncPendingActions();

    expect(lire(CLE_EN_ATTENTE)).toHaveLength(0);
    expect(lire(CLE_MISES_DE_COTE)).toHaveLength(0);
  });
});

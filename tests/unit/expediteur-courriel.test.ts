/**
 * L'expéditeur des courriels vient-il bien de la configuration ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Six endroits du serveur portaient une adresse d'expéditeur ÉCRITE EN DUR —
 * « noreply@maintrix-t.com », « noreply@smartgmao.com » — dont aucune ne
 * correspondait au domaine réellement exploité. Or SendGrid refuse tout message
 * dont l'expéditeur n'est pas une identité vérifiée.
 *
 * Conséquence : on pouvait configurer une clé valide, tout croire en place, et
 * n'envoyer aucun courriel. Les échecs n'étant que journalisés, rien ne
 * l'aurait signalé — ni à l'exploitant, ni au destinataire qui attend son lien.
 *
 * Ce test échoue si une adresse réapparaît dans le code.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe("Expéditeur des courriels", () => {
  const initial = { cle: process.env.SENDGRID_API_KEY, exp: process.env.SENDGRID_FROM_EMAIL };

  beforeEach(() => {
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;
    jest.resetModules();
  });

  afterEach(() => {
    if (initial.cle === undefined) delete process.env.SENDGRID_API_KEY; else process.env.SENDGRID_API_KEY = initial.cle;
    if (initial.exp === undefined) delete process.env.SENDGRID_FROM_EMAIL; else process.env.SENDGRID_FROM_EMAIL = initial.exp;
  });

  it("aucune adresse d'expéditeur n'est écrite dans le code", () => {
    const fautifs: string[] = [];
    for (const fichier of readdirSync('server').filter((f) => f.endsWith('.ts'))) {
      const chemin = join('server', fichier);
      const lignes = readFileSync(chemin, 'utf8').split('\n');
      lignes.forEach((ligne, i) => {
        // On ignore les commentaires : ils CITENT les anciennes adresses pour
        // expliquer pourquoi elles ont disparu.
        if (/^\s*(\/\/|\*|\/\*)/.test(ligne)) return;
        if (/from:\s*['"][^'"]*@[^'"]*['"]/.test(ligne)) {
          fautifs.push(`${chemin}:${i + 1} ${ligne.trim().slice(0, 80)}`);
        }
      });
    }
    expect(fautifs).toEqual([]);
  });

  it("l'envoi n'est déclaré possible que si la clé ET l'expéditeur sont présents", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sansRien = require('../../server/email-service');
    expect(sansRien.envoiCourrielConfigure()).toBe(false);
    expect(sansRien.expediteurCourriel()).toBe('');

    jest.resetModules();
    process.env.SENDGRID_API_KEY = 'SG.fausse-cle-de-test';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cleSeule = require('../../server/email-service');
    expect(cleSeule.envoiCourrielConfigure()).toBe(false); // une clé seule ne suffit pas

    jest.resetModules();
    process.env.SENDGRID_FROM_EMAIL = '  noreply@techlearn-saem.com  ';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const complet = require('../../server/email-service');
    expect(complet.envoiCourrielConfigure()).toBe(true);
    expect(complet.expediteurCourriel()).toBe('noreply@techlearn-saem.com'); // espaces retirés
  });
});

/**
 * Le motif du refus de SendGrid ressort-il dans les journaux ?
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI CE TEST EXISTE
 * ═══════════════════════════════════════════════════════════════════
 * Les échecs d'envoi étaient journalisés par `console.error('Erreur envoi
 * email', error)`. Or le motif d'un refus SendGrid ne se trouve pas dans
 * `error.message` mais dans `error.response.body.errors`, que le formatage par
 * défaut n'affiche pas. L'exploitant lisait donc « Erreur envoi email » suivi
 * d'une pile d'appels, sans jamais apprendre que SendGrid répondait « from
 * address does not match a verified Sender Identity ».
 *
 * Constaté le 2026-09-27 : aucun courriel ne partait, et rien dans les
 * journaux ne disait pourquoi.
 */
describe('Raison du refus d\'envoi', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { raisonErreurCourriel } = require('../../server/email-service');

  const erreurSendGrid = (code: number, errors: unknown[]) =>
    Object.assign(new Error('Forbidden'), { code, response: { body: { errors } } });

  it('rend le motif exact d\'un expéditeur non vérifié', () => {
    const raison = raisonErreurCourriel(erreurSendGrid(403, [{
      message: 'The from address does not match a verified Sender Identity.',
      field: 'from',
      help: 'Mail cannot be sent until this error is resolved.',
    }]));

    expect(raison).toContain('403');
    expect(raison).toContain('verified Sender Identity');
    expect(raison).toContain('from');
  });

  it('assemble plusieurs motifs sans en perdre', () => {
    const raison = raisonErreurCourriel(erreurSendGrid(400, [
      { message: 'Premier motif' },
      { message: 'Second motif' },
    ]));

    expect(raison).toContain('Premier motif');
    expect(raison).toContain('Second motif');
  });

  it('sur un 403 sans corps, pointe quand même vers l\'expéditeur', () => {
    const raison = raisonErreurCourriel(Object.assign(new Error('Forbidden'), { code: 403 }));
    expect(raison).toMatch(/identité d'expéditeur vérifiée/);
  });

  it('ne casse pas sur ce qui n\'est pas une erreur SendGrid', () => {
    for (const valeur of [new Error('réseau injoignable'), 'texte brut', null, undefined, {}]) {
      expect(typeof raisonErreurCourriel(valeur)).toBe('string');
      expect(raisonErreurCourriel(valeur).length).toBeGreaterThan(0);
    }
  });
});

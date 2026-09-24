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

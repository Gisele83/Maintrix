/**
 * Récupération des secrets du jeu de démonstration.
 *
 *   npm run demo:secrets               (affiche, puis efface le dépôt)
 *   npm run demo:secrets -- --conserver (affiche sans effacer)
 *
 * ═══════════════════════════════════════════════════════════════════
 * POURQUOI UNE COMMANDE SÉPARÉE
 * ═══════════════════════════════════════════════════════════════════
 * Le chargement dépose les secrets dans un fichier protégé et n'affiche que
 * son chemin — voir `scripts/canal-secrets.ts` pour le pourquoi. Il faut donc
 * un moment, DISTINCT du chargement, où l'on vient les chercher.
 *
 * Ce découpage n'est pas qu'une commodité. Il sépare deux publics :
 *
 *   • le chargement est souvent lancé par un outil — un script
 *     d'installation, une tâche de CI, un collègue qui prépare le poste — et
 *     sa sortie est journalisée ;
 *   • la récupération est lancée à la main, par la personne qui va se
 *     connecter, dans son propre terminal.
 *
 * Seule la seconde affiche les secrets. Et comme elle les affiche, elle les
 * efface : le dépôt n'a pas de raison de survivre à sa lecture. C'est là tout
 * l'intérêt d'une suppression contrôlée plutôt qu'automatique — elle a lieu
 * au moment où quelqu'un a effectivement reçu les secrets, pas à l'expiration
 * d'un délai qui n'a rien observé.
 *
 * `--conserver` existe pour le cas où l'on veut vérifier le dépôt sans le
 * consommer — relire après une coupure de terminal, par exemple. Il le dit
 * franchement : le fichier reste sur le disque.
 */
import { recupererLesSecrets } from './canal-secrets';

function principal(): void {
  const conserver = process.argv.includes('--conserver');
  const r = recupererLesSecrets({ conserver });

  console.log(`
╔════════════════════════════════════════════════════════════════╗
║  SECRETS DU JEU DE DÉMONSTRATION                               ║
╚════════════════════════════════════════════════════════════════╝

${r.comptes}
`);

  if (conserver) {
    console.log(
      `  Dépôt CONSERVÉ : ${r.chemin}\n`
      + `  Il reste en clair sur le disque. Effacez-le dès que vous n'en avez\n`
      + `  plus besoin :  npm run demo:secrets\n`,
    );
    return;
  }

  if (r.efface) {
    console.log(
      `  Dépôt effacé : ${r.chemin}\n`
      + `  Ces secrets ne sont plus récupérables — la base n'en garde qu'une\n`
      + `  empreinte. Notez-les maintenant ; pour en obtenir de nouveaux,\n`
      + `  rechargez le jeu :  npm run demo:charger\n`,
    );
    return;
  }

  // Lu mais pas effacé : il faut le dire, pas le taire. Un fichier de secrets
  // dont on croit à tort qu'il a disparu est pire qu'un fichier qu'on sait là.
  console.error(
    `  ⚠ Le dépôt n'a PAS pu être effacé : ${r.chemin}\n`
    + `    Les secrets ci-dessus sont encore en clair sur le disque.\n`
    + `    Supprimez ce fichier à la main.\n`,
  );
  process.exitCode = 1;
}

try {
  principal();
} catch (e) {
  console.error(`\n${(e as Error).message}\n`);
  process.exit(1);
}

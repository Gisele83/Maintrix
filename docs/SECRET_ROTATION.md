# Identifiant PostgreSQL publié — enquête et conclusion

```bash
npm run verify:secrets
```

---

## Le constat qui a été porté pendant onze phases

Une chaîne de connexion PostgreSQL Neon complète figurait dans l'historique d'un
dépôt GitHub **public** (`.env.test`, commit `f70752a`). Le commit `0ab95cf`
l'avait retirée de l'arbre de travail — ce qui ne change rien : l'historique
reste lisible.

Conclusion tirée alors, et répétée à chaque phase : *secret compromis, rotation
urgente, blocage de l'ouverture aux testeurs*.

**Ce constat était faux.** Il reposait sur la présence de la chaîne, jamais sur
un examen de sa valeur ni sur un test.

## Ce que mesure l'enquête

### 1. La valeur publiée est caviardée

Le mot de passe présent dans l'historique fait 20 caractères, dont **6
astérisques littéraux** et 13 caractères alphanumériques. Ce n'est pas un mot de
passe Neon : c'est une valeur masquée à la main avant le commit.

### 2. Une seule occurrence, dans tout le dépôt

Balayage de **3 292 blobs** — tous les objets, y compris ceux devenus
inatteignables après réécriture ou force-push, que `git log -S` ne voit pas :

| | |
|---|---|
| Chaînes `neondb_owner:…@` distinctes | **1** |
| Portant une valeur réelle | **0** |

Le balayage est validé par contrôle positif (1 890 occurrences de « Maintrix »
trouvées par le même pipeline) : un résultat vide aurait pu venir d'un pipeline
défaillant.

Étendu à l'ensemble des motifs de secrets (clés AWS, jetons GitHub, SendGrid,
Slack, Google, clés privées) sur les 1 678 commits : **37 candidats**, dont
20 gabarits, 16 identifiants visant `localhost` ou un service Docker, et
1 exemple `sk-votre_cle_reelle`. **Une seule chaîne visait un hôte joignable
depuis Internet** — celle-ci.

### 3. Le projet Neon existe toujours, et refuse cette chaîne

Interrogé avec un mot de passe **délibérément faux**, donc sans jamais tenter de
s'authentifier :

```
ERROR: password authentication failed for user 'neondb_owner'
```

Ce message — et non « endpoint introuvable » — établit que le projet et le rôle
existent encore, et que le serveur authentifie normalement.

Puis avec la chaîne publiée elle-même : **refusée**.

Le témoin est indispensable. Sans lui, un endpoint supprimé ou une panne réseau
produirait le même « échec de connexion », et l'on conclurait à tort que tout va
bien : « refusé » et « injoignable » ne sont pas la même chose.

## Conclusion

**Aucun identifiant utilisable n'a été trouvé dans l'historique public, et la
chaîne qui s'y trouve n'ouvre pas la base.** La rotation n'est pas le préalable
bloquant qui a été annoncé.

### Ce que cela ne prouve pas

- Qu'aucun secret réel n'ait **jamais** été poussé. Un objet supprimé côté
  GitHub avant ce clone échapperait à l'examen. GitHub conserve un temps les
  objets devenus inaccessibles.
- Que le mot de passe n'ait pas fuité **ailleurs** : capture d'écran, journal
  d'exécution Replit, copie dans un ticket.

Ces deux réserves ne sont pas vérifiables depuis le dépôt. Si l'une inquiète,
la rotation reste une assurance à faible coût — ci-dessous.

## Faire tourner l'identifiant, si vous le souhaitez

L'ordre compte : **purger l'historique ne remplace jamais la rotation.** Un
secret public depuis des mois doit être considéré comme copié ; seule la
rotation le neutralise.

1. Console Neon → projet → **Roles** → `neondb_owner` → **Reset password**.
2. Reporter la nouvelle chaîne dans les fichiers `.env` **hors du dépôt**
   (ils sont ignorés par git — vérifié par
   [scripts/verify-deployment-security.mjs](../scripts/verify-deployment-security.mjs)).
3. Vérifier :
   ```bash
   ANCIENNE_CHAINE_NEON="postgresql://neondb_owner:…@…/neondb" npm run verify:secrets
   ```
   L'ancienne chaîne doit être **refusée**.

> L'environnement de test des testeurs n'utilise pas Neon : il tourne sur un
> PostgreSQL conteneurisé, dont le mot de passe est généré au provisionnement et
> reste hors du dépôt. Une rotation Neon est donc **sans effet** sur lui.

## Purger l'historique — pourquoi ce n'est pas recommandé ici

Réécrire 1 678 commits et forcer la publication sur un dépôt public a un coût
réel : toutes les empreintes de commits changent, les clones et forks existants
divergent, les demandes de fusion ouvertes cassent, et les références externes
aux commits deviennent caduques.

En regard : la valeur à purger est **caviardée**. Le bénéfice est nul.

Si vous décidiez malgré tout de le faire, cela viendrait **après** une rotation,
avec [git-filter-repo](https://github.com/newren/git-filter-repo), et exige une
décision explicite — ce n'est pas une opération à lancer sans y penser.

## Empêcher la récidive

La chaîne était entrée sans que rien ne s'y oppose. Deux barrières le corrigent :

| Barrière | Ce qu'elle bloque |
|---|---|
| `secret-scan` dans [ci.yml](../.github/workflows/ci.yml) | tout `utilisateur:motdepasse@hôte` en clair visant un hôte externe, à chaque push |
| `npm run verify:secrets` | l'état du dépôt, et la validité de la chaîne publiée |

Les deux écartent délibérément les gabarits (`${VAR}`), les valeurs caviardées et
les hôtes internes (`localhost`, services Docker) : une barrière qui crie au loup
finit désactivée.

Vérifiées par injection : un identifiant externe factice ajouté à l'arbre les
fait échouer toutes les deux ; leur retrait les remet au vert.

## Reste à traiter, sans urgence

`vm-setup-windows.ps1:103` contient un mot de passe en dur pour
`maintrix_user@localhost`. Le script **crée** cette base locale avec ce mot de
passe : il n'est joignable par personne depuis Internet. À remplacer par une
valeur générée, par hygiène.

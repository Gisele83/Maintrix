# Accueil d'un testeur externe — Maintrix

Procédure de provisionnement d'un compte testeur, et état vérifié du parcours.

## Le parcours, de bout en bout

```
super-admin crée le tenant
        ↓  tenant + administrateur + licence d'essai (une seule transaction)
identifiants temporaires transmis
        ↓  e-mail SendGrid, ou restitués dans la réponse API
1ʳᵉ connexion du testeur
        ↓  refusée telle quelle : changement de mot de passe imposé
changement de mot de passe
        ↓  drapeaux levés, session ouverte
le testeur utilise Maintrix
```

Vérifié de bout en bout par
[tests/integration/tester-onboarding.test.ts](../tests/integration/tester-onboarding.test.ts)
(13 tests) :

```bash
npm test -- --testPathPatterns=tester-onboarding
```

## 1. Créer le tenant testeur

Requiert une session super-admin. `SUPER_ADMIN_EMAIL`,
`SUPER_ADMIN_PASSWORD_HASH` et `SUPER_ADMIN_SECRET` doivent être configurés côté
serveur, sans quoi `/api/super-admin/login` répond `503 SUPER_ADMIN_NOT_CONFIGURED`.

```bash
# 1) Se connecter
curl -s -X POST "$API/api/super-admin/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"...","password":"...","secretKey":"..."}'
# → { "token": "..." }

# 2) Créer le tenant (jeton CSRF requis depuis F06)
CSRF=$(curl -si "$API/api/health" | sed -nE 's/.*csrfToken=([^;]+).*/\1/p' | tr -d '\r')
curl -s -X POST "$API/api/super-admin/tenants" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-CSRF-Token: $CSRF" -H "Cookie: csrfToken=$CSRF" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Testeur Untel","domain":"untel.test.local",
       "adminEmail":"untel@exemple.fr","adminFirstName":"Untel",
       "adminLastName":"Testeur","maxUsers":3}'
```

L'opération est **atomique** (F04) : tenant, administrateur, licence et
historique sont créés ensemble ou pas du tout.

## 2. Récupérer les identifiants temporaires

Deux cas, et **un seul des deux se produit** :

| `credentials.sent` | Ce qui se passe |
|---|---|
| `true` | L'e-mail est parti. Le mot de passe n'est **pas** dans la réponse |
| `false` | SendGrid n'est pas configuré : la réponse contient `temporaryCredentials` avec `username`, `email`, `password`, `expiresAt` |

⚠️ **Corrigé en F08.** Auparavant, `sendTenantCredentials()` renvoyait `false`
sans lever d'exception quand SendGrid n'était pas configuré. La branche `catch`
censée restituer les identifiants « en cas d'échec email » n'était donc jamais
atteinte : **le compte était créé et son mot de passe perdu définitivement**.
Personne ne pouvait s'y connecter, et le seul recours était une écriture
manuelle en base.

Le mot de passe temporaire expire au bout de **7 jours**. Transmettez-le par un
canal sûr — il n'est affiché qu'une fois.

## 3. Première connexion

Le testeur se connecte avec son mot de passe temporaire. La réponse **n'est pas**
une session :

```json
{ "requirePasswordChange": true, "isFirstLogin": true,
  "userId": 42, "tempSessionToken": "..." }
```

Aucune session n'est créée à ce stade — vérifié par test.

## 4. Changement de mot de passe

```
POST /api/enterprise-auth/force-password-change
{ userId, currentPassword, newPassword, tempSessionToken }
```

Exigences : 8 caractères minimum, majuscule, minuscule, chiffre et caractère
spécial ; le nouveau mot de passe doit différer de l'ancien.

En cas de succès : `mustChangePassword` et `isDefaultCredentials` repassent à
`false`, `passwordExpiresAt` est effacé, une session normale est ouverte, et
l'ancien mot de passe temporaire cesse de fonctionner.

⚠️ **`tempSessionToken` n'est vérifié que par sa présence** (`z.string().min(1)`).
Il est généré aléatoirement à la connexion et **n'est stocké nulle part** :
n'importe quelle chaîne non vide est acceptée. La véritable garde reste la
vérification de `currentPassword` et des drapeaux `mustChangePassword` /
`isDefaultCredentials` — il n'y a donc pas de contournement d'authentification,
mais ce jeton ne protège rien. Non corrigé : hors du périmètre F08, à traiter
avec le durcissement de la phase 11.

## 5. Licence et période d'essai

Depuis F08, `initializeTenantLicense()` ouvre un **essai de 30 jours** dans la
transaction de création : `trialStartDate`, `trialEndDate`, `licenseStatus =
"trial"`. Le `plan` choisi par le super-admin n'est pas écrasé.

Auparavant, un tenant neuf n'avait ni abonnement, ni essai, ni période de
grâce : `getLicenseStatus()` le classait **`expired`** et `canOperate` valait
`false` dès la création.

### ⚠️ Le contrôle de licence est actuellement INERTE

`licenseEnforcementMiddleware` ne bloque **jamais** rien, pour deux raisons
cumulées :

1. **Ordre des middlewares.** Il est monté ligne 363 de `server/index.ts`,
   c'est-à-dire **avant** `registerRoutes()` qui installe l'authentification
   (`routes.ts:331`). `req.user` est donc toujours indéfini, et le middleware
   sort immédiatement par `if (!user) { next(); return; }`.
2. **Préfixe de montage.** Monté via `app.use('/api', …)`, Express retire le
   préfixe du `req.path`. Sa liste d'exemptions, entièrement écrite avec
   `/api/…`, ne peut donc jamais correspondre. Même symptôme que le bug
   historique de `publicPaths` dans `EnterpriseAuthMiddleware`.

Vérifié par test : une licence rendue expirée en base ne bloque aucun accès.

**Conséquence pour la suite.** Ce n'est pas un problème pour le pilote — au
contraire, cela évite tout verrouillage accidentel. Mais **rétablir cet ordre
verrouillerait instantanément tout tenant sans essai ni abonnement valides**. Si
vous décidez d'activer le contrôle (phase 11 ou 12) :

- vérifier que **tous** les tenants existants ont un essai ou un abonnement —
  y compris `default-tenant` ;
- corriger d'abord la liste d'exemptions (préfixe de montage), sinon
  `/api/license/activate` et `/api/trial/start` seront eux-mêmes bloqués et un
  tenant expiré n'aura **aucun moyen de se débloquer** ;
- le seed de test pose déjà un essai sur ses tenants
  ([tests/seed.ts](../tests/seed.ts)), la suite ne cassera donc pas.

## 6. Ce que le testeur peut faire

Vérifié par test : lecture et écriture dans son propre tenant, et **isolation
dans les deux sens** — ses données n'apparaissent pas chez un autre tenant, et il
ne voit aucune donnée d'un autre tenant.

## Points non couverts

- **Aucun test frontend** : le parcours a été vérifié par API, pas dans le
  navigateur. Les pages `login` et `first-login-password-change` ne sont pas
  couvertes.
- **L'envoi d'e-mail réel n'a pas été testé** — SendGrid n'est pas configuré
  dans l'environnement de test. Seule la branche « e-mail non envoyé » est
  vérifiée.
- **Aucune limite d'utilisateurs testée.** `maxUsers` est enregistré, mais
  l'application de cette limite lors de l'ajout d'un second utilisateur n'a pas
  été vérifiée.
- **Aucune procédure de suppression** d'un compte testeur en fin de pilote.

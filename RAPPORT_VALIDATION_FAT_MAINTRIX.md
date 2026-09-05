# RAPPORT DE VALIDATION — FACTORY ACCEPTANCE TEST MAINTRIX
**Date :** 23 juillet 2026
**Portée :** Mise à jour ciblée du FAT 16 phases (exécuté lors d'une session précédente) après découverte et correction d'une classe de bugs systémique lors d'une re-vérification approfondie du frontend.
**Remplace :** `RAPPORT_TEST_GLOBAL.md` (18 mai 2026) — rapport antérieur, périmètre plus restreint (test de fumée API), désormais obsolète (référence un port différent, précède la création des tables de plusieurs modules).

---

## 1. CONTEXTE ET MÉTHODE

Un Factory Acceptance Test complet en 16 phases a été exécuté lors d'une session antérieure de cet engagement (audit plateforme, licences, tests unitaires/intégration, multi-agent, simulation industrielle, stress test à échelle réduite, sécurité, UX, conformité métier, IA, Digital Twin, Analytics, robustesse, scénario de démonstration Port de Douala). Son rapport a été livré directement dans la conversation de cette session-là et n'a pas été persisté en fichier — il n'est donc pas reproduit ici in extenso.

Ce document couvre ce qui s'est passé **depuis** : en demandant de vérifier en direct les pages frontend des 7 modules reconstruits pour l'isolation tenant, une classe de bugs **invisible aux tests API/curl utilisés dans le FAT initial** a été découverte — des champs silencieusement `undefined` côté navigateur, sans erreur console ni requête en échec. Le présent rapport documente cette découverte, son ampleur réelle (bien au-delà des 7 modules initiaux), les corrections apportées, et une nouvelle passe de régression sur le reste de la plateforme.

**Leçon méthodologique retenue :** un test qui vérifie uniquement les codes de statut HTTP et l'isolation tenant peut déclarer un module "fonctionnel" alors que la moitié de ses champs n'atteint jamais l'écran. La vérification doit comparer, champ par champ, ce que l'interface déclare attendre et ce que l'API renvoie réellement.

---

## 2. DÉCOUVERTE PRINCIPALE : FUITE SNAKE_CASE → CAMELCASE

### 2.1 Mécanisme
PostgreSQL renvoie les noms de colonnes tels quels (`fiscal_year`, `total_allocated`, `rca_number`...). Chaque page React de ce projet ne lit que des clés camelCase (`fiscalYear`, `totalAllocated`, `rcaNumber`...). Les fichiers de routes qui utilisent `pg.Pool.query()` directement (par opposition à Drizzle, qui mappe automatiquement vers camelCase) doivent traduire explicitement chaque ligne avant `res.json(...)`. Le motif fautif observé partout : `res.json({ ...row, champCalculé })` — l'étalement (`...row`) laisse toutes les colonnes non explicitement renommées en snake_case, silencieusement `undefined` côté client.

### 2.2 Périmètre réel : 10 fichiers, pas 7
| Fichier | Statut avant | Défauts trouvés |
|---|---|---|
| `budget-routes.ts` | ❌ | Badge année fiscale, badge type, numéro de budget, **cartes de synthèse** (alloué/dépensé/engagé/disponible), **historique des transactions** entier — tous vides |
| `oee-routes.ts` | ❌ | Date "Invalid Date", équipement "Éq. undefined", toutes les cartes de synthèse à 0% |
| `asset-lifecycle-routes.ts` | ❌ | Tag actif, stade de cycle de vie, coûts, MTBF/MTTR, valeur actuelle amortie |
| `habilitation-routes.ts` | ❌ | Quasi tous les champs (nom technicien, dates, n° certificat) — page fortement affectée |
| `calibration-routes.ts` | ❌ | Champs instrument + **2 cartes de stats sur 4** (Bientôt échus, Hors service) |
| `warranty-routes.ts` | ❌ | Champs garantie + réclamations |
| `supplier-routes.ts` | ❌ | **Bug de plantage** : `s.supplierCode.toLowerCase()` sur `undefined` → page qui plante dès qu'une recherche ne correspond pas au nom |
| `maintenance-plan-routes.ts` | ❌ | **Bug de plantage identique** : `p.planNumber.includes(search)` |
| `rca-routes.ts` *(trouvé hors périmètre initial)* | ❌ | Numéro RCA, perte estimée, récurrence élevée + **même bug de plantage** sur la recherche |
| `fmea-routes.ts` *(trouvé hors périmètre initial)* | ❌ | Numéro FMEA, équipement, étape process + **même bug de plantage** |

Les deux derniers (`rca-routes.ts`, `fmea-routes.ts`) n'étaient pas dans la liste initiale des 7 modules à vérifier ; ils ont été trouvés en élargissant systématiquement la recherche à **tous** les fichiers du projet utilisant `pg.Pool.query()` directement (13 fichiers identifiés au total), plutôt que de supposer que le bug était limité aux modules récemment reconstruits.

**Fichiers audités et confirmés sains** (pattern différent, sans bug) :
- `techlearn-bridge-service.ts` / `techlearn-bridge-routes.ts` — frontend et backend utilisent snake_case de façon cohérente des deux côtés, aucune incohérence.
- `agents/functional/functional-agents.ts` — déstructure les résultats bruts et reconstruit des objets typés explicitement, sans jamais étaler une ligne SQL brute.

### 2.3 Correction appliquée
Pour chacun des 10 fichiers fautifs : une fonction `toApiShape(row)` (ou `enrichX`) traduisant explicitement chaque colonne, appliquée à **tous** les points `res.json(...)` du fichier (liste, stats, lecture unitaire, création, mise à jour, sous-ressources). Deux bugs annexes corrigés au passage :
- **`calibration-routes.ts` — `/renew`** : revalidait les anciennes valeurs via Zod, mais Postgres renvoie `null` pour un champ optionnel non renseigné alors que `.optional()` en Zod n'accepte que `undefined` — le renouvellement échouait avec une 400 dès qu'un champ optionnel était vide (cas fréquent). Corrigé par coercition `?? undefined`.

### 2.4 Vérification
Chaque module a été testé en direct : création d'un enregistrement réel via l'API exacte utilisée par le frontend, lecture de la liste/stats/détail, comparaison champ par champ avec l'interface TypeScript de la page, puis suppression des données de test. Pour les deux bugs de plantage, le scénario exact (recherche ne correspondant pas au nom/titre) a été rejoué en direct dans le navigateur après correction pour confirmer l'absence de crash.

---

## 3. DEUXIÈME DÉCOUVERTE : FUITES INTER-TENANT SUR DES ENDPOINTS DE DIAGNOSTIC

Deux endpoints, non couverts par les tests d'isolation tenant précédents car non identifiés comme portant des données métier, exposaient des compteurs agrégés **sans filtrage par tenant** :

| Endpoint | Problème | Correction |
|---|---|---|
| `GET /api/engineering-expertise/overview` | Comptait les analyses RCA/FMEA/RCM de **tous les tenants confondus** (la requête ignorait même `req`, nommé `_req`) | Ajout du filtrage `WHERE tenant_id = $1` sur les 3 comptages |
| `GET /api/system/health` | 10 des 11 compteurs de tables (équipements, OT, budgets, calibrations...) agrégeaient tous les tenants ; accessible à tout utilisateur ayant le rôle `admin` (rôle **tenant**, pas seulement plateforme) | Comptages scopés par tenant ; mémoire/CPU/taille DB restent globaux (métriques d'infrastructure, pas de données métier) ; `iot_sensor_data` reste global (table sans `tenant_id`) |

**Vérification :** création d'un 2ᵉ tenant isolé (`audit-tenant-y`) avec un utilisateur `admin`. Confirmé : ce tenant voit `0` partout sur ses propres compteurs après correction, alors que le tenant par défaut continue de voir ses vrais chiffres (`rca_analyses: 1, fmea_analyses: 1` après création d'un enregistrement de test). Tenant de test et utilisateur supprimés après vérification.

---

## 4. BALAYAGE DE RÉGRESSION

Après les 10 corrections + rebuild + redémarrage du serveur, un balayage rapide a confirmé l'absence de régression sur les zones non touchées cette session :

- **Compilation** : `npx tsc --noEmit` → 0 erreur (à chaque étape de correction).
- **Build production** : `npm run build` → succès, à chaque étape.
- **Licences** (`/api/platform/entitlements`, `/api/platform/editions`) : 200 OK, forme correcte, 8 domaines actifs pour l'édition "complete" — aucune régression.
- **Pages spot-vérifiées sans erreur console** : `/gmao-dashboard`, `/digital-twin`, `/knowledge-hub`, `/advanced-reporting`, `/multi-agent-team`, `/maintenance-platform`, `/work-orders`.
- **Authentification** : les 3 niveaux (super-admin, admin tenant, utilisateur tenant standard) confirmés fonctionnels de bout en bout après création de comptes de test dédiés.

Les phases du FAT initial non liées à cette classe de bug (stress test, sécurité OWASP, accessibilité, conformité ISO, Digital Twin, robustesse panne réseau/DB) n'ont pas été ré-exécutées dans leur intégralité — rien dans les changements de cette session ne les affecte directement, et une ré-exécution complète représenterait plusieurs heures supplémentaires sans nouvelle information pour ces phases spécifiques.

---

## 5. RÉCAPITULATIF DES DÉFAUTS

### Critiques (corrigés)
1. Fuite inter-tenant sur `/api/engineering-expertise/overview` — comptages toutes tenants confondues.
2. Fuite inter-tenant sur `/api/system/health` — 10 compteurs toutes tenants confondues, accessible à un simple admin tenant.
3. Plantage page `/supplier-portal` sur recherche non correspondante (`Cannot read properties of undefined`).
4. Plantage page `/maintenance-plan` sur recherche non correspondante (même cause).
5. Plantage potentiel pages `/rca` et `/fmea` sur recherche non correspondante (même cause, corrigé avant exposition).

### Majeurs (corrigés)
6–15. Absence de traduction snake_case→camelCase sur 10 fichiers de routes (budget, OEE, asset-lifecycle, habilitation, calibration, warranty, supplier, maintenance-plan, RCA, FMEA) — champs silencieusement vides sur les pages correspondantes, y compris des cartes de synthèse financières et opérationnelles.
16. Renouvellement de calibration en échec systématique dès qu'un champ optionnel de l'enregistrement d'origine était vide.

### Mineurs
- Avertissement React/Radix `Missing Description for DialogContent` sur plusieurs boîtes de dialogue (accessibilité, cosmétique, sans impact fonctionnel) — observé mais non corrigé, hors périmètre de cette passe.

---

## 6. CONCLUSION

☑ **Prêt avec réserves.**

L'architecture applicative reste solide (17 sessions de travail cumulées, isolation tenant désormais vérifiée sur l'ensemble des 15 modules métier audités, build/typecheck propres). Mais cette passe démontre qu'un module ayant passé un test d'isolation API (curl, codes de statut) peut néanmoins être **inutilisable côté écran** sans qu'aucune alarme technique ne se déclenche — c'est précisément ce qui s'est produit sur au moins 10 modules avant cette vérification. Recommandation avant mise en production :

1. **Appliquer systématiquement** le principe de vérification champ-par-champ (interface TypeScript vs. réponse API réelle) à tout module non couvert par cette passe, en particulier ceux ajoutés après ce rapport.
2. **Auditer les rôles RBAC** : la découverte sur `/api/system/health` montre qu'un rôle nommé `admin` dans `userProfiles.role` est tenant-scopé alors que certains endpoints le traitent comme un rôle plateforme — vérifier qu'aucun autre endpoint ne partage cette confusion.
3. Ré-exécuter à terme les phases non couvertes ici (stress test à échelle réelle, sécurité OWASP complète) sur une infrastructure de test dédiée, distincte de ce poste de développement local.

---
*Rapport généré lors de la session de validation ciblée du 23 juillet 2026, en complément du FAT 16 phases exécuté précédemment.*

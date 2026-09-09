# Tâches de fond de Maintrix — inventaire F02

Toutes les boucles périodiques du processus serveur. Chacune est planifiée par
`registerBackgroundTask()` ([server/background-tasks.ts](../server/background-tasks.ts)) :
plus aucun `setInterval` nu ne subsiste dans `server/`.

État en direct (administrateur authentifié) : `GET /api/system/health`, champ
`backgroundTasks`.

---

## Ce qui existait avant

Les 13 boucles étaient planifiées par `setInterval(fn, ms)` nu.

- 8 sur 13 n'avaient **aucune** gestion d'erreur.
- Une exception synchrone tuait le processus entier. **Reproduit** : une erreur
  injectée dans la boucle de 5 s du noyau cognitif arrête l'API pour tous les
  tenants (`exit 1`).
- Aucun gestionnaire `SIGTERM` : `docker stop` coupait les requêtes en vol et
  laissait les connexions PostgreSQL ouvertes.
- Les 5 boucles « protégées » l'étaient par un `try { } catch { console.error }`
  sans backoff : une dépendance morte était re-sondée au même rythme
  indéfiniment.

## Classement

| Classe | Définition | Effet d'un arrêt prolongé |
|---|---|---|
| **A** | Critique au fonctionnement | Le cœur cognitif cesse d'avancer ; dégradation fonctionnelle visible |
| **B** | Importante mais récupérable | Rattrapage au tick suivant, aucune perte définitive |
| **C** | Secondaire | Hygiène, confort, simulation ; sans effet fonctionnel |

---

## Inventaire

### A — critique

| | |
|---|---|
| **A‑1** | `cognitive-kernel:processing` |
| Fichier / fonction | [server/cognitive-kernel/index.ts](../server/cognitive-kernel/index.ts) · `processingLoop()` |
| Fréquence | 5 s |
| Dépendances | État en mémoire (file de messages, registre d'agents) |
| DB / réseau / MQTT / IA / notifications | aucune / aucun / aucun / **aucun** / aucune (émet des événements internes) |
| Avant F02 | Aucun try/catch. **C'est cette boucle qui a servi à prouver le plantage du processus.** |
| Après F02 | Erreurs isolées, backoff, circuit ouvert à 5 échecs, arrêt propre via `shutdown()` |

### B — importante mais récupérable

| | |
|---|---|
| **B‑1** | `agents:global-learning` |
| Fichier / fonction | [server/agents/global-agent.ts](../server/agents/global-agent.ts) · `globalLearningCycle()` |
| Fréquence | 30 s |
| Dépendances | Agrégation en mémoire des sites |
| DB / réseau / MQTT / IA | aucune / aucun / aucun / **aucun** |
| Avant F02 | Aucun try/catch |

| | |
|---|---|
| **B‑2** | `agents:site-coordination:<siteId>` |
| Fichier / fonction | [server/agents/site-agent.ts](../server/agents/site-agent.ts) · `coordinationCycle()` |
| Fréquence | 15 s — **une instance par site** |
| Dépendances | Agents équipement du site |
| DB / réseau / MQTT / IA | aucune / aucun / aucun / **aucun** |
| Avant F02 | Aucun try/catch |

| | |
|---|---|
| **B‑3** | `agents:equipment-monitoring:<equipmentId>` |
| Fichier / fonction | [server/agents/equipment-agent.ts](../server/agents/equipment-agent.ts) · `monitoringCycle()` |
| Fréquence | 10 s — **une instance par équipement, jusqu'à 20 enregistrés au démarrage** |
| Dépendances | Historique capteurs en mémoire, calcul de divergence Jensen‑Shannon |
| DB / réseau / MQTT / IA | aucune / aucun / aucun / **aucun** |
| Avant F02 | Aucun try/catch. Le compte réel de timers vivants n'est donc pas 13 mais **jusqu'à ~32** |

| | |
|---|---|
| **B‑4** | `super-admin:token-cleanup` |
| Fichier / fonction | [server/super-admin-routes.ts](../server/super-admin-routes.ts) · purge en ligne |
| Fréquence | 1 h |
| Dépendances | `Map` des jetons super‑admin en mémoire |
| DB / réseau / MQTT / IA | aucune / aucun / aucun / **aucun** |
| Avant F02 | Aucun try/catch. Classée B et non C : son arrêt laisse des jetons expirés exploitables en mémoire |

| | |
|---|---|
| **B‑5** | `scada:tag-polling` |
| Fichier / fonction | [server/integrations/scada-connector.ts](../server/integrations/scada-connector.ts) · `readTagValues()` |
| Fréquence | `SCADA_POLL_INTERVAL_MS`, défaut 10 s |
| Dépendances | Automate / passerelle SCADA (OPC‑UA ou pont REST) |
| DB / réseau / **SCADA** / IA | aucune / **HTTP sortant** / **oui** / aucun |
| Avant F02 | try/catch présent, **sans backoff** : un automate injoignable était sondé toutes les 10 s indéfiniment |
| Activation | Uniquement si `SCADA_ENDPOINT` **et** `SCADA_PLC_ADDRESSES` sont définis |

| | |
|---|---|
| **B‑6** | `integrations:sap-sync` |
| Fichier / fonction | [server/integrations/index.ts](../server/integrations/index.ts) · `syncWithSAP()` |
| Fréquence | 15 min |
| Dépendances | OData SAP |
| DB / réseau / MQTT / IA | indirecte / **HTTP sortant** / aucun / **aucun** |
| Avant F02 | **Échec totalement silencieux.** `syncWithSAP()` intercepte en interne et renvoie `{success:false}` sans lever — le `catch` du site d'appel était du code mort, aucun journal n'était produit |
| Après F02 | Le résultat est inspecté et converti en erreur : journal, backoff, circuit |
| Activation | Uniquement si `config.sap` est fourni (non configuré par défaut) |

| | |
|---|---|
| **B‑7** | `integrations:maximo-sync` |
| Fichier / fonction | [server/integrations/index.ts](../server/integrations/index.ts) · `syncWithMaximo()` |
| Fréquence | 30 min |
| Dépendances | API REST IBM Maximo |
| DB / réseau / MQTT / IA | indirecte / **HTTP sortant** / aucun / **aucun** |
| Avant F02 | Même défaut silencieux que B‑6 |
| Activation | `MAXIMO_BASE_URL` + `MAXIMO_USERNAME` + `MAXIMO_PASSWORD` |

### C — secondaire

| | |
|---|---|
| **C‑1** | `iot:sensor-collection` |
| Fichier / fonction | [server/integrations/advanced-iot-connector.ts](../server/integrations/advanced-iot-connector.ts) · `collectSensorData()` |
| Fréquence | 5 s |
| Dépendances | Simulateur interne, état en mémoire |
| DB / réseau / MQTT / IA | aucune / aucun / aucun / **aucun** |
| Avant F02 | Aucun try/catch |

| | |
|---|---|
| **C‑2** | `iot:symptom-detection` |
| Fichier / fonction | même fichier · `analyzeForSymptoms()` |
| Fréquence | 10 s |
| Dépendances | Lectures capteurs en mémoire ; peut émettre des notifications |
| DB / réseau / MQTT / IA | aucune / aucun / aucun / **aucun** |
| Avant F02 | Aucun try/catch |

| | |
|---|---|
| **C‑3** | `gamification:expire-challenges` |
| Fichier / fonction | [server/integrations/gamification-engine.ts](../server/integrations/gamification-engine.ts) · `checkExpiredChallenges()` |
| Fréquence | 60 s |
| Dépendances | Défis actifs en mémoire |
| DB / réseau / MQTT / IA | aucune / aucun / aucun / **aucun** |
| Avant F02 | Aucun try/catch |

| | |
|---|---|
| **C‑4** | `notifications:cleanup` |
| Fichier / fonction | [server/integrations/smart-notification-engine.ts](../server/integrations/smart-notification-engine.ts) · `cleanupOldNotifications()` |
| Fréquence | 1 h |
| Dépendances | Cooldowns en mémoire |
| DB / réseau / MQTT / IA | aucune / aucun / aucun / **aucun** |
| Avant F02 | Fonction `async` appelée sans `await` ni `.catch()` — promesse flottante. Un rejet échappant au try/catch interne aurait tué le processus |

| | |
|---|---|
| **C‑5** | `integrations:iot-simulation` |
| Fichier / fonction | [server/integrations/index.ts](../server/integrations/index.ts) |
| Fréquence | 30 s |
| Dépendances | PostgreSQL (`equipment_registry`), écritures `iot_sensor_data` |
| DB / réseau / MQTT / IA | **lecture + écriture** / aucun / aucun / **aucun** |
| Avant F02 | try/catch avec compteur ad hoc `iotErrorCount` qui **arrêtait la boucle définitivement** au‑delà de 5 erreurs (`if (iotErrorCount > 5) return;`) — elle ne repartait jamais, même une fois la base revenue |
| Après F02 | Circuit du superviseur, qui se **referme automatiquement** au premier tick réussi |

---

## Points établis contre le rapport d'audit

1. **Aucune boucle de fond n'appelle l'IA.** Aucune référence à `anthropic` /
   `claude` dans `server/agents/`, `server/cognitive-kernel/` ni
   `server/integrations/`. L'IA n'est invoquée que dans des routes HTTP.
2. **Aucune boucle ne parle MQTT.** MQTT est piloté par événements
   (`client.on('message')`) dans `iot-connector.ts`, pas par une boucle. Ce
   gestionnaire est `async` mais son corps est intégralement sous try/catch.
3. **Le nombre de timers vivants dépasse 13.** B‑2 et B‑3 sont instanciées par
   site et par équipement : ~32 timers avec 20 équipements enregistrés.

## Politique appliquée à chaque tâche

| Aspect | Règle |
|---|---|
| Gestion des erreurs | try/catch dans le superviseur ; sync et async traités par le même chemin |
| Journalisation | Échecs 1 à 4 détaillés (nom, compteur, criticité, délai suivant, message tronqué à 300 car.) ; une ligne à l'ouverture du circuit ; silence ensuite ; une ligne au rétablissement |
| Retry | Implicite — le tick suivant est le retry |
| Backoff | Exponentiel ×2, plafonné à `min(30 × intervalle, 15 min)` |
| Échec permanent | Circuit ouvert après 5 échecs consécutifs : sondage réduit, jamais d'abandon définitif ; réouverture automatique |
| Arrêt propre | `stopAllBackgroundTasks()` sur SIGTERM/SIGINT ; timers `unref()` ; attente bornée du tick en cours |

**Aucune tâche n'est configurée pour arrêter le processus en cas d'échec.**
Y compris A‑1 : son arrêt dégrade une fonction, il ne justifie pas de couper
l'API pour tous les tenants. L'arrêt contrôlé est réservé aux défauts *inconnus*
remontant jusqu'à `uncaughtException` / `unhandledRejection`
([server/graceful-shutdown.ts](../server/graceful-shutdown.ts)).

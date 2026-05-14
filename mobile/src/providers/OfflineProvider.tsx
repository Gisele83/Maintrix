import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDatabase } from './DatabaseProvider';
import { getServerUrl, getApiBaseUrl, fetchWithTimeout } from '../config/api.config';

// ─── Types ─────────────────────────────────────────────────────────────────

interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

interface OfflineContextType {
  isConnected: boolean;
  isOnlineMode: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;
  lastSyncTime: Date | null;
  syncErrors: string[];
  syncData: () => Promise<SyncResult>;
  downloadOfflineData: () => Promise<void>;
  getPendingSyncItems: () => Promise<any[]>;
  checkConnectivity: () => Promise<boolean>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

const LAST_SYNC_KEY = 'maintrix_last_sync';
const CONNECTIVITY_INTERVAL = 20000; // 20 seconds
const RETRY_DELAYS = [2000, 5000, 15000]; // exponential backoff

// ─── Provider ──────────────────────────────────────────────────────────────

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [isOnlineMode, setIsOnlineMode] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  const { db, isReady } = useDatabase();
  const prevConnected = useRef<boolean>(true);
  const syncInProgress = useRef(false);

  // ── Connectivity check via actual server ping ─────────────────────────
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      const server = await getServerUrl();
      const res = await fetchWithTimeout(`${server}/api/health`, {}, 8000);
      // Server may return 401 (auth required) — that's still "connected"
      return res.status < 600;
    } catch {
      return false;
    }
  }, []);

  // ── Poll connectivity every 20s ───────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const online = await checkConnectivity();
      if (!mounted) return;
      setIsConnected(online);

      // Auto-sync when coming back online
      if (online && !prevConnected.current && !syncInProgress.current) {
        console.log('📶 Connection restored — triggering auto-sync...');
        syncData();
      }
      prevConnected.current = online;
    };

    check();
    const interval = setInterval(check, CONNECTIVITY_INTERVAL);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // ── Load persisted data on mount ─────────────────────────────────────
  useEffect(() => {
    if (isReady) {
      updatePendingSyncCount();
      loadLastSyncTime();
    }
  }, [isReady]);

  const loadLastSyncTime = async () => {
    try {
      const stored = await AsyncStorage.getItem(LAST_SYNC_KEY);
      if (stored) setLastSyncTime(new Date(stored));
    } catch { /* ignore */ }
  };

  // ── Count pending items ───────────────────────────────────────────────
  const updatePendingSyncCount = useCallback(() => {
    if (!db) return;

    db.transaction((tx) => {
      tx.executeSql('SELECT COUNT(*) as c FROM work_orders WHERE synced = 0', [], (_, { rows }) => {
        const wo = rows.item(0).c;
        tx.executeSql('SELECT COUNT(*) as c FROM diagnostic_sessions WHERE synced = 0', [], (_, { rows }) => {
          const ds = rows.item(0).c;
          // pending_feedback table — may not exist yet
          tx.executeSql(
            "SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name='pending_feedback'",
            [],
            (_, { rows: r }) => {
              if (r.item(0).c > 0) {
                tx.executeSql('SELECT COUNT(*) as c FROM pending_feedback WHERE synced = 0', [], (_, { rows }) => {
                  setPendingSyncCount(wo + ds + rows.item(0).c);
                });
              } else {
                setPendingSyncCount(wo + ds);
              }
            }
          );
        });
      });
    });
  }, [db]);

  // ── Read all pending items ────────────────────────────────────────────
  const getPendingSyncItems = async (): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      if (!db) { reject(new Error('Database not ready')); return; }

      const items: any[] = [];
      db.transaction((tx) => {
        tx.executeSql('SELECT * FROM work_orders WHERE synced = 0', [], (_, { rows }) => {
          for (let i = 0; i < rows.length; i++) {
            items.push({ table: 'work_orders', id: rows.item(i).id, data: rows.item(i) });
          }
          tx.executeSql('SELECT * FROM diagnostic_sessions WHERE synced = 0', [], (_, { rows }) => {
            for (let i = 0; i < rows.length; i++) {
              items.push({ table: 'diagnostic_sessions', id: rows.item(i).id, data: rows.item(i) });
            }
            tx.executeSql(
              "SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name='pending_feedback'",
              [],
              (_, { rows: r }) => {
                if (r.item(0).c > 0) {
                  tx.executeSql('SELECT * FROM pending_feedback WHERE synced = 0', [], (_, { rows }) => {
                    for (let i = 0; i < rows.length; i++) {
                      items.push({ table: 'pending_feedback', id: rows.item(i).id, data: rows.item(i) });
                    }
                    resolve(items);
                  });
                } else {
                  resolve(items);
                }
              }
            );
          });
        });
      });
    });
  };

  // ── Mark a record as synced ───────────────────────────────────────────
  const markSynced = (table: string, id: number) => {
    if (!db) return;
    db.transaction((tx) => {
      tx.executeSql(`UPDATE ${table} SET synced = 1 WHERE id = ?`, [id]);
    });
  };

  // ── Retry helper ──────────────────────────────────────────────────────
  const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 2): Promise<Response | null> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetchWithTimeout(url, options, 12000);
        if (res.ok || res.status === 400 || res.status === 422) {
          // 400/422 = validation error — data already sent, mark synced
          return res;
        }
        if (res.status === 401 || res.status === 403) {
          // Auth error — skip retry
          return res;
        }
        // 5xx — retry
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt] || 5000));
        }
      } catch (err) {
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt] || 5000));
        }
      }
    }
    return null;
  };

  // ── Main sync function ────────────────────────────────────────────────
  const syncData = useCallback(async (): Promise<SyncResult> => {
    if (!isConnected || !db) {
      return { synced: 0, failed: 0, errors: ['Hors ligne ou base de données non prête'] };
    }
    if (syncInProgress.current) {
      return { synced: 0, failed: 0, errors: ['Synchronisation déjà en cours'] };
    }

    syncInProgress.current = true;
    setIsSyncing(true);
    setSyncErrors([]);

    const result: SyncResult = { synced: 0, failed: 0, errors: [] };

    try {
      const apiBase = await getApiBaseUrl();
      const items = await getPendingSyncItems();

      for (const item of items) {
        try {
          let url = '';
          let body: any = {};

          if (item.table === 'work_orders') {
            url = `${apiBase}/work-orders`;
            body = {
              title: item.data.title || 'Intervention mobile',
              description: item.data.description || '',
              equipmentId: item.data.equipment_id,
              priority: item.data.priority || 'medium',
              status: item.data.status || 'pending',
              assignedTechnician: item.data.assigned_technician,
              scheduledDate: item.data.scheduled_date,
              notes: item.data.notes || '',
              createdFrom: 'mobile_offline'
            };
          } else if (item.table === 'diagnostic_sessions') {
            url = `${apiBase}/diagnostic-sessions`;
            body = {
              equipmentType: item.data.equipment_type,
              symptoms: item.data.symptoms,
              results: item.data.results,
              confidence: item.data.confidence,
              createdAt: item.data.created_at,
              source: 'mobile_offline'
            };
          } else if (item.table === 'pending_feedback') {
            url = `${apiBase}/diagnostic-feedback`;
            body = {
              sessionId: item.data.session_id,
              rating: item.data.rating,
              helpful: item.data.helpful === 1 || item.data.helpful === true,
              comments: item.data.comments || '',
              suggestionsAccuracy: item.data.suggestions_accuracy || 'accurate',
              source: 'mobile_offline'
            };
          }

          if (!url) continue;

          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          const res = await fetchWithRetry(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
          });

          if (res && (res.ok || res.status === 400 || res.status === 422)) {
            markSynced(item.table, item.id);
            result.synced++;
          } else {
            result.failed++;
            const errMsg = `${item.table}#${item.id}: ${res ? `HTTP ${res.status}` : 'Timeout'}`;
            result.errors.push(errMsg);
          }
        } catch (err: any) {
          result.failed++;
          result.errors.push(`${item.table}#${item.id}: ${err.message || 'Erreur inconnue'}`);
        }
      }

      const now = new Date();
      setLastSyncTime(now);
      await AsyncStorage.setItem(LAST_SYNC_KEY, now.toISOString());
      setSyncErrors(result.errors);
      updatePendingSyncCount();

      console.log(`✅ Sync terminée: ${result.synced} synchronisés, ${result.failed} échecs`);
    } catch (err: any) {
      result.errors.push(`Erreur générale: ${err.message}`);
      setSyncErrors(result.errors);
      console.error('❌ Sync error:', err);
    } finally {
      setIsSyncing(false);
      syncInProgress.current = false;
    }

    return result;
  }, [isConnected, db]);

  // ── Download offline data from server ─────────────────────────────────
  const downloadOfflineData = async (): Promise<void> => {
    if (!isConnected || !db) {
      throw new Error('Hors ligne ou base de données non prête');
    }

    const apiBase = await getApiBaseUrl();

    // Download maintenance cases (diagnostic patterns)
    try {
      const casesRes = await fetchWithTimeout(`${apiBase}/maintenance-history?limit=200`, {}, 15000);
      if (casesRes.ok) {
        const cases = await casesRes.json();
        const caseList = Array.isArray(cases) ? cases : (cases.cases || cases.data || []);

        await new Promise<void>((resolve, reject) => {
          db.transaction((tx) => {
            tx.executeSql('DELETE FROM maintenance_cases');
            for (const c of caseList) {
              tx.executeSql(
                'INSERT OR REPLACE INTO maintenance_cases (equipment_type, symptoms, diagnosis, solution, urgency, confidence) VALUES (?, ?, ?, ?, ?, ?)',
                [
                  c.equipmentType || c.equipment_type || '',
                  c.symptoms || '',
                  c.diagnosis || '',
                  c.solution || '',
                  c.urgency || 'medium',
                  c.confidence || 0.7
                ]
              );
            }
          }, reject, resolve);
        });
        console.log(`📥 ${caseList.length} cas de maintenance téléchargés`);
      }
    } catch (err) {
      console.warn('⚠️ Impossible de télécharger les cas de maintenance:', err);
    }

    // Download equipment list
    try {
      const eqRes = await fetchWithTimeout(`${apiBase}/equipment`, {}, 12000);
      if (eqRes.ok) {
        const equipment = await eqRes.json();
        const eqList = Array.isArray(equipment) ? equipment : (equipment.equipment || equipment.data || []);

        await new Promise<void>((resolve, reject) => {
          db.transaction((tx) => {
            tx.executeSql('DELETE FROM equipment WHERE synced = 1');
            for (const eq of eqList) {
              tx.executeSql(
                `INSERT OR REPLACE INTO equipment 
                 (equipment_id, name, type, location, status, last_maintenance, next_maintenance, qr_code, synced)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [
                  String(eq.id || eq.equipment_id || ''),
                  eq.name || eq.equipment_name || '',
                  eq.type || eq.equipment_type || '',
                  eq.location || eq.zone || '',
                  eq.status || 'operational',
                  eq.last_maintenance || null,
                  eq.next_maintenance || null,
                  eq.qr_code || null
                ]
              );
            }
          }, reject, resolve);
        });
        console.log(`📥 ${eqList.length} équipements téléchargés`);
      }
    } catch (err) {
      console.warn('⚠️ Impossible de télécharger les équipements:', err);
    }

    // Download repair procedures
    try {
      const procRes = await fetchWithTimeout(`${apiBase}/repair-procedures?limit=100`, {}, 12000);
      if (procRes.ok) {
        const procedures = await procRes.json();
        const procList = Array.isArray(procedures) ? procedures : (procedures.procedures || procedures.data || []);

        if (procList.length > 0) {
          await new Promise<void>((resolve, reject) => {
            db.transaction((tx) => {
              tx.executeSql('DELETE FROM repair_procedures');
              for (const proc of procList) {
                tx.executeSql(
                  'INSERT INTO repair_procedures (case_id, step_number, title, description, safety_warning, tools_required, estimated_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  [
                    proc.caseId || proc.case_id || null,
                    proc.stepNumber || proc.step_number || 1,
                    proc.title || '',
                    proc.description || '',
                    proc.safetyWarning || proc.safety_warning || null,
                    proc.toolsRequired || proc.tools_required || null,
                    proc.estimatedTime || proc.estimated_time || null
                  ]
                );
              }
            }, reject, resolve);
          });
          console.log(`📥 ${procList.length} procédures téléchargées`);
        }
      }
    } catch (err) {
      console.warn('⚠️ Impossible de télécharger les procédures:', err);
    }

    const now = new Date();
    setLastSyncTime(now);
    await AsyncStorage.setItem(LAST_SYNC_KEY, now.toISOString());
    updatePendingSyncCount();
  };

  const value: OfflineContextType = {
    isConnected,
    isOnlineMode,
    isSyncing,
    pendingSyncCount,
    lastSyncTime,
    syncErrors,
    syncData,
    downloadOfflineData,
    getPendingSyncItems,
    checkConnectivity,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (context === undefined) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}

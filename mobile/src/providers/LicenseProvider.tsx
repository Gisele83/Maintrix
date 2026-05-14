import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const LICENSE_CACHE_KEY = 'maintrix_license_cache';
const LICENSE_CHECK_KEY = 'maintrix_last_license_check';
const GRACE_PERIOD_DAYS = 7;
const CACHE_TTL_HOURS = 24;

export type LicenseStatus = 'trial' | 'active' | 'grace' | 'expired' | 'suspended' | 'unknown';

export interface LicenseState {
  status: LicenseStatus;
  plan: string;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  trialEndDate: string | null;
  isGracePeriodActive: boolean;
  gracePeriodDaysRemaining: number;
  gracePeriodEnd: string | null;
  canOperate: boolean;
  warningMessage: string | null;
  lastCheckedAt: string | null;
  isOfflineCached: boolean;
}

interface LicenseContextType {
  license: LicenseState;
  isLoading: boolean;
  error: string | null;
  refreshLicense: () => Promise<void>;
  activateLicense: (licenseKey: string) => Promise<{ success: boolean; message: string }>;
  startTrial: () => Promise<{ success: boolean; message: string }>;
}

const defaultLicense: LicenseState = {
  status: 'unknown',
  plan: 'free',
  isTrialActive: false,
  trialDaysRemaining: 0,
  trialEndDate: null,
  isGracePeriodActive: false,
  gracePeriodDaysRemaining: 0,
  gracePeriodEnd: null,
  canOperate: false,
  warningMessage: null,
  lastCheckedAt: null,
  isOfflineCached: false,
};

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

function isCacheStillValid(lastCheckIso: string | null): boolean {
  if (!lastCheckIso) return false;
  const lastCheck = new Date(lastCheckIso).getTime();
  const now = Date.now();
  const hoursDiff = (now - lastCheck) / (1000 * 60 * 60);
  return hoursDiff < CACHE_TTL_HOURS;
}

function isGracePeriodValid(gracePeriodEnd: string | null): boolean {
  if (!gracePeriodEnd) return false;
  return new Date(gracePeriodEnd).getTime() > Date.now();
}

export function LicenseProvider({
  children,
  serverUrl,
  authToken,
}: {
  children: React.ReactNode;
  serverUrl: string;
  authToken: string | null;
}) {
  const [license, setLicense] = useState<LicenseState>(defaultLicense);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCachedLicense = useCallback(async (): Promise<LicenseState | null> => {
    try {
      const cached = await AsyncStorage.getItem(LICENSE_CACHE_KEY);
      if (cached) {
        const parsed: LicenseState = JSON.parse(cached);
        if (isCacheStillValid(parsed.lastCheckedAt)) {
          return { ...parsed, isOfflineCached: true };
        }
        if (isGracePeriodValid(parsed.gracePeriodEnd)) {
          const graceEnd = new Date(parsed.gracePeriodEnd!);
          const daysLeft = Math.ceil((graceEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return {
            ...parsed,
            status: 'grace',
            isGracePeriodActive: true,
            gracePeriodDaysRemaining: daysLeft,
            canOperate: true,
            warningMessage: `⚠️ Mode hors ligne — grâce offline : ${daysLeft} jour(s) restant(s)`,
            isOfflineCached: true,
          };
        }
        return {
          ...parsed,
          status: 'expired',
          canOperate: false,
          warningMessage: 'Licence expirée. Reconnectez-vous pour revalider.',
          isOfflineCached: true,
        };
      }
    } catch {
      // ignore cache errors
    }
    return null;
  }, []);

  const saveCachedLicense = useCallback(async (state: LicenseState) => {
    try {
      await AsyncStorage.setItem(LICENSE_CACHE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, []);

  const fetchLicenseFromServer = useCallback(async (): Promise<LicenseState | null> => {
    if (!authToken) return null;
    try {
      const response = await fetch(`${serverUrl}/api/license/status`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (!response.ok) return null;
      const data = await response.json();
      const now = new Date().toISOString();
      const gracePeriodEnd = data.gracePeriodEnd
        ? data.gracePeriodEnd
        : new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

      return {
        status: data.status,
        plan: data.plan || 'free',
        isTrialActive: data.isTrialActive || false,
        trialDaysRemaining: data.trialDaysRemaining || 0,
        trialEndDate: data.trialEndDate || null,
        isGracePeriodActive: data.isGracePeriodActive || false,
        gracePeriodDaysRemaining: data.gracePeriodDaysRemaining || GRACE_PERIOD_DAYS,
        gracePeriodEnd,
        canOperate: data.canOperate !== false,
        warningMessage: data.warningMessage || null,
        lastCheckedAt: now,
        isOfflineCached: false,
      };
    } catch {
      return null;
    }
  }, [serverUrl, authToken]);

  const refreshLicense = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fromServer = await fetchLicenseFromServer();
      if (fromServer) {
        setLicense(fromServer);
        await saveCachedLicense(fromServer);
        return;
      }
      const fromCache = await loadCachedLicense();
      if (fromCache) {
        setLicense(fromCache);
        return;
      }
      setLicense({
        ...defaultLicense,
        status: 'unknown',
        canOperate: false,
        warningMessage: 'Impossible de vérifier la licence. Vérifiez votre connexion.',
      });
    } catch (e) {
      setError('Erreur lors de la vérification de licence');
      const fromCache = await loadCachedLicense();
      if (fromCache) setLicense(fromCache);
    } finally {
      setIsLoading(false);
    }
  }, [fetchLicenseFromServer, loadCachedLicense, saveCachedLicense]);

  const activateLicense = useCallback(
    async (licenseKey: string): Promise<{ success: boolean; message: string }> => {
      if (!authToken) return { success: false, message: 'Non authentifié' };
      try {
        const response = await fetch(`${serverUrl}/api/license/activate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ licenseKey }),
          credentials: 'include',
        });
        const data = await response.json();
        if (response.ok && data.success) {
          await refreshLicense();
          return { success: true, message: 'Licence activée avec succès' };
        }
        return { success: false, message: data.message || 'Clé de licence invalide' };
      } catch {
        return { success: false, message: 'Erreur réseau. Vérifiez votre connexion.' };
      }
    },
    [serverUrl, authToken, refreshLicense]
  );

  const startTrial = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (!authToken) return { success: false, message: 'Non authentifié' };
    try {
      const response = await fetch(`${serverUrl}/api/trial/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      const data = await response.json();
      if (response.ok && data.success) {
        await refreshLicense();
        return { success: true, message: data.message || 'Essai démarré avec succès' };
      }
      return { success: false, message: data.message || 'Impossible de démarrer l\'essai' };
    } catch {
      return { success: false, message: 'Erreur réseau. Vérifiez votre connexion.' };
    }
  }, [serverUrl, authToken, refreshLicense]);

  useEffect(() => {
    refreshLicense();
  }, [authToken]);

  return (
    <LicenseContext.Provider value={{ license, isLoading, error, refreshLicense, activateLicense, startTrial }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const context = useContext(LicenseContext);
  if (!context) throw new Error('useLicense must be used within a LicenseProvider');
  return context;
}

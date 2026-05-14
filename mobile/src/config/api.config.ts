import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Default Maintrix server URL ───────────────────────────────────────────
// Change this to your Replit domain or your production server URL.
// Can also be overridden at runtime via Settings screen or AsyncStorage.
export const DEFAULT_SERVER_URL = 'https://39ace9b4-1788-4681-b0fc-5dfa699bfaaa-00-39d1rkmv0qfax.worf.replit.dev';

const SERVER_URL_KEY = 'maintrix_server_url';

let _cachedServerUrl: string | null = null;

export async function getServerUrl(): Promise<string> {
  if (_cachedServerUrl) return _cachedServerUrl;
  try {
    const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
    _cachedServerUrl = stored || DEFAULT_SERVER_URL;
  } catch {
    _cachedServerUrl = DEFAULT_SERVER_URL;
  }
  return _cachedServerUrl;
}

export async function setServerUrl(url: string): Promise<void> {
  const normalized = url.replace(/\/$/, ''); // strip trailing slash
  _cachedServerUrl = normalized;
  await AsyncStorage.setItem(SERVER_URL_KEY, normalized);
}

export async function getApiBaseUrl(): Promise<string> {
  const server = await getServerUrl();
  return `${server}/api`;
}

// ─── CSRF token cache ──────────────────────────────────────────────────────
let _csrfToken: string | null = null;

export async function fetchCsrfToken(serverUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${serverUrl}/api/health`, { credentials: 'include' });
    const cookieHeader = res.headers.get('set-cookie') || '';
    const match = cookieHeader.match(/csrfToken=([^;]+)/);
    if (match) {
      _csrfToken = match[1];
      return _csrfToken;
    }
    // Fallback: read from cookie jar if available (React Native limitation)
    return null;
  } catch {
    return null;
  }
}

export function getCachedCsrfToken(): string | null {
  return _csrfToken;
}

// ─── Auth token helper ─────────────────────────────────────────────────────
import * as SecureStore from 'expo-secure-store';

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token && token !== 'demo_token_12345') {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (_csrfToken) {
      headers['X-CSRF-Token'] = _csrfToken;
    }
  } catch {
    // ignore
  }
  return headers;
}

// ─── Fetch with timeout ────────────────────────────────────────────────────
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

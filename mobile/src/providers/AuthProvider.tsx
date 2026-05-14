import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'maintrix_auth_token';
const USER_KEY = 'maintrix_user_data';
const COOKIE_KEY = 'maintrix_session_cookie';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId?: string;
  department?: string;
}

interface AuthContextType {
  user: User | null;
  authToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  saveUserData: (userData: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const [userData, token] = await Promise.all([
        AsyncStorage.getItem(USER_KEY),
        SecureStore.getItemAsync(TOKEN_KEY),
      ]);
      if (userData) setUser(JSON.parse(userData));
      if (token) setAuthToken(token);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/enterprise-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      if (!data.success && !data.user) return false;

      const sessionCookie = response.headers.get('set-cookie') || '';
      const tokenMatch = sessionCookie.match(/sessionToken=([^;]+)/);
      const token = tokenMatch ? tokenMatch[1] : `mobile_session_${Date.now()}`;

      const userData: User = {
        id: String(data.user?.id || '1'),
        name: `${data.user?.firstName || ''} ${data.user?.lastName || data.user?.username || email.split('@')[0]}`.trim(),
        email: data.user?.email || email,
        role: data.user?.role || 'technician',
        tenantId: data.user?.tenantId || 'default-tenant',
        department: data.user?.department || 'Maintenance',
      };

      await saveUserData(userData);
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      setAuthToken(token);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/enterprise-auth/logout`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
      await AsyncStorage.removeItem(USER_KEY);
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setUser(null);
      setAuthToken(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const saveUserData = async (userData: User) => {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Error saving user data:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, authToken, isAuthenticated: !!user, isLoading, login, logout, saveUserData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

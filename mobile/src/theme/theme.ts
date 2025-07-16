import { DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2563eb',
    primaryContainer: '#dbeafe',
    secondary: '#64748b',
    secondaryContainer: '#f1f5f9',
    surface: '#ffffff',
    surfaceVariant: '#f8fafc',
    background: '#f8fafc',
    onBackground: '#1e293b',
    onSurface: '#1e293b',
    error: '#dc2626',
    errorContainer: '#fef2f2',
    success: '#16a34a',
    successContainer: '#f0fdf4',
    warning: '#f59e0b',
    warningContainer: '#fefbeb',
    outline: '#e2e8f0',
    outlineVariant: '#cbd5e1',
  },
  roundness: 12,
};

export const gradients = {
  primary: ['#3b82f6', '#1d4ed8'],
  secondary: ['#6366f1', '#4338ca'],
  success: ['#10b981', '#059669'],
  warning: ['#f59e0b', '#d97706'],
  error: ['#ef4444', '#dc2626'],
  dark: ['#1e293b', '#0f172a'],
  light: ['#f8fafc', '#e2e8f0'],
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  h4: {
    fontSize: 18,
    fontWeight: '500' as const,
    lineHeight: 24,
  },
  body1: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  body2: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
};
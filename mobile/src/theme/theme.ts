import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#6366f1',
    primaryContainer: '#e0e7ff',
    secondary: '#8b5cf6',
    secondaryContainer: '#f3e8ff',
    tertiary: '#06b6d4',
    tertiaryContainer: '#cffafe',
    surface: '#ffffff',
    surfaceVariant: '#f1f5f9',
    background: '#f8fafc',
    error: '#ef4444',
    errorContainer: '#fee2e2',
    onPrimary: '#ffffff',
    onSecondary: '#ffffff',
    onSurface: '#0f172a',
    onBackground: '#0f172a',
    outline: '#cbd5e1',
    outlineVariant: '#e2e8f0',
  },
};

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#818cf8',
    primaryContainer: '#3730a3',
    secondary: '#a78bfa',
    secondaryContainer: '#6b46c1',
    tertiary: '#22d3ee',
    tertiaryContainer: '#0891b2',
    surface: '#1e293b',
    surfaceVariant: '#334155',
    background: '#0f172a',
    error: '#f87171',
    errorContainer: '#7f1d1d',
    onPrimary: '#ffffff',
    onSecondary: '#ffffff',
    onSurface: '#f8fafc',
    onBackground: '#f8fafc',
    outline: '#64748b',
    outlineVariant: '#475569',
  },
};

export default lightTheme;
export { darkTheme };
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import { DatabaseProvider } from './src/providers/DatabaseProvider';
import { AuthProvider, useAuth } from './src/providers/AuthProvider';
import { OfflineProvider } from './src/providers/OfflineProvider';
import { LicenseProvider } from './src/providers/LicenseProvider';
import theme from './src/theme/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

function AppWithLicense() {
  const { authToken } = useAuth();
  return (
    <LicenseProvider serverUrl={API_URL} authToken={authToken}>
      <OfflineProvider>
        <NavigationContainer>
          <AppNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </OfflineProvider>
    </LicenseProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <DatabaseProvider>
          <AuthProvider>
            <AppWithLicense />
          </AuthProvider>
        </DatabaseProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

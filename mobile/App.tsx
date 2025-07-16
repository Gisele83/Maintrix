import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation/AppNavigator';
import { OfflineProvider } from './src/context/OfflineContext';
import { DatabaseProvider } from './src/context/DatabaseContext';
import { theme } from './src/theme/theme';
import { initializeOfflineStorage } from './src/services/OfflineStorage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export default function App() {
  useEffect(() => {
    initializeOfflineStorage();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={theme}>
          <DatabaseProvider>
            <OfflineProvider>
              <NavigationContainer>
                <AppNavigator />
                <StatusBar style="auto" />
              </NavigationContainer>
            </OfflineProvider>
          </DatabaseProvider>
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
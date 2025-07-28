import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Context Providers
import { ThemeProvider } from './src/contexts/ThemeContext';
import { DatabaseProvider } from './src/contexts/DatabaseContext';
import { OfflineProvider } from './src/contexts/OfflineContext';

// Screens
import HomeScreen from './src/screens/HomeScreen';
import DiagnosticScreen from './src/screens/DiagnosticScreen';
import RepairGuidanceScreen from './src/screens/RepairGuidanceScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import QRScannerScreen from './src/screens/QRScannerScreen';
import OfflineDataScreen from './src/screens/OfflineDataScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Diagnostic') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'History') {
            iconName = focused ? 'time' : 'time-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1e40af',
        tabBarInactiveTintColor: 'gray',
        headerStyle: {
          backgroundColor: '#1e40af',
        },
        headerTintColor: 'white',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ title: 'Accueil' }}
      />
      <Tab.Screen 
        name="Diagnostic" 
        component={DiagnosticScreen} 
        options={{ title: 'Diagnostic IA' }}
      />
      <Tab.Screen 
        name="History" 
        component={HistoryScreen} 
        options={{ title: 'Historique' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ title: 'Paramètres' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Initialize app resources
    const initializeApp = async () => {
      try {
        // Simulate initialization time
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setIsReady(true);
      }
    };

    initializeApp();
  }, []);

  if (!isReady) {
    return null; // You could show a splash screen here
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DatabaseProvider>
          <OfflineProvider>
            <NavigationContainer>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="MainTabs" component={MainTabs} />
                <Stack.Screen 
                  name="RepairGuidance" 
                  component={RepairGuidanceScreen}
                  options={{ 
                    headerShown: true,
                    title: 'Guide de Réparation',
                    headerStyle: { backgroundColor: '#1e40af' },
                    headerTintColor: 'white'
                  }}
                />
                <Stack.Screen 
                  name="QRScanner" 
                  component={QRScannerScreen}
                  options={{ 
                    headerShown: true,
                    title: 'Scanner QR Code',
                    headerStyle: { backgroundColor: '#1e40af' },
                    headerTintColor: 'white'
                  }}
                />
                <Stack.Screen 
                  name="OfflineData" 
                  component={OfflineDataScreen}
                  options={{ 
                    headerShown: true,
                    title: 'Données Hors Ligne',
                    headerStyle: { backgroundColor: '#1e40af' },
                    headerTintColor: 'white'
                  }}
                />
                <Stack.Screen 
                  name="Feedback" 
                  component={FeedbackScreen}
                  options={{ 
                    headerShown: true,
                    title: 'Évaluation',
                    headerStyle: { backgroundColor: '#1e40af' },
                    headerTintColor: 'white'
                  }}
                />
              </Stack.Navigator>
            </NavigationContainer>
            <StatusBar style="light" />
          </OfflineProvider>
        </DatabaseProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
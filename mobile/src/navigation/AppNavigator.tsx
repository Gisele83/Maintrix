import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { DiagnosticScreen } from '../screens/DiagnosticScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ScannerScreen } from '../screens/ScannerScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { RepairGuidanceScreen } from '../screens/RepairGuidanceScreen';
import { OfflineDataScreen } from '../screens/OfflineDataScreen';
import { FeedbackScreen } from '../screens/FeedbackScreen';
import { theme } from '../theme/theme';

export type RootStackParamList = {
  MainTabs: undefined;
  RepairGuidance: { caseId: number; diagnosis: string };
  Feedback: { sessionId: number; diagnosis: string; solution: string };
  OfflineData: undefined;
};

export type TabParamList = {
  Diagnostic: undefined;
  History: undefined;
  Scanner: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createStackNavigator<RootStackParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Diagnostic':
              iconName = 'search';
              break;
            case 'History':
              iconName = 'history';
              break;
            case 'Scanner':
              iconName = 'qr-code-scanner';
              break;
            case 'Settings':
              iconName = 'settings';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.secondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen 
        name="Diagnostic" 
        component={DiagnosticScreen}
        options={{
          title: 'Diagnostic',
          headerTitle: 'SMDiagFix - Diagnostic IA',
        }}
      />
      <Tab.Screen 
        name="History" 
        component={HistoryScreen}
        options={{
          title: 'Historique',
          headerTitle: 'Historique Maintenance',
        }}
      />
      <Tab.Screen 
        name="Scanner" 
        component={ScannerScreen}
        options={{
          title: 'Scanner',
          headerTitle: 'Scanner Équipement',
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{
          title: 'Réglages',
          headerTitle: 'Paramètres',
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen 
        name="MainTabs" 
        component={MainTabs} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="RepairGuidance" 
        component={RepairGuidanceScreen}
        options={{
          title: 'Guidance Réparation',
          headerBackTitle: 'Retour',
        }}
      />
      <Stack.Screen 
        name="Feedback" 
        component={FeedbackScreen}
        options={{
          title: 'Évaluation',
          headerBackTitle: 'Retour',
        }}
      />
      <Stack.Screen 
        name="OfflineData" 
        component={OfflineDataScreen}
        options={{
          title: 'Données Hors-ligne',
          headerBackTitle: 'Retour',
        }}
      />
    </Stack.Navigator>
  );
}
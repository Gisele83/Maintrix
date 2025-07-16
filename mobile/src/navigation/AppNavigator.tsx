import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { DiagnosticScreen } from '../screens/DiagnosticScreen';
import { RepairGuidanceScreen } from '../screens/RepairGuidanceScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { CameraScreen } from '../screens/CameraScreen';
import { OfflineLibraryScreen } from '../screens/OfflineLibraryScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function DiagnosticStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="DiagnosticMain" 
        component={DiagnosticScreen}
        options={{ title: 'Diagnostic' }}
      />
      <Stack.Screen 
        name="Camera" 
        component={CameraScreen}
        options={{ title: 'Photo Équipement' }}
      />
      <Stack.Screen 
        name="RepairGuidance" 
        component={RepairGuidanceScreen}
        options={{ title: 'Guide Réparation' }}
      />
    </Stack.Navigator>
  );
}

function LibraryStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="OfflineLibraryMain" 
        component={OfflineLibraryScreen}
        options={{ title: 'Bibliothèque Hors Ligne' }}
      />
      <Stack.Screen 
        name="RepairGuidanceOffline" 
        component={RepairGuidanceScreen}
        options={{ title: 'Guide Réparation' }}
      />
    </Stack.Navigator>
  );
}

export function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Diagnostic':
              iconName = 'search';
              break;
            case 'Bibliothèque':
              iconName = 'library-books';
              break;
            case 'Historique':
              iconName = 'history';
              break;
            case 'Paramètres':
              iconName = 'settings';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Diagnostic" component={DiagnosticStack} />
      <Tab.Screen name="Bibliothèque" component={LibraryStack} />
      <Tab.Screen name="Historique" component={HistoryScreen} />
      <Tab.Screen name="Paramètres" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Screens
import HomeScreen from '../screens/HomeScreen';
import DiagnosticScreen from '../screens/DiagnosticScreen';
import RepairGuidanceScreen from '../screens/RepairGuidanceScreen';
import WorkOrdersScreen from '../screens/WorkOrdersScreen';
import EquipmentScannerScreen from '../screens/EquipmentScannerScreen';
import OfflineDataScreen from '../screens/OfflineDataScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RepairStepsScreen from '../screens/RepairStepsScreen';
import EquipmentDetailsScreen from '../screens/EquipmentDetailsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  const theme = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          
          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Diagnostic':
              iconName = focused ? 'brain' : 'brain';
              break;
            case 'Repairs':
              iconName = focused ? 'wrench' : 'wrench-outline';
              break;
            case 'WorkOrders':
              iconName = focused ? 'clipboard-list' : 'clipboard-list-outline';
              break;
            case 'Scanner':
              iconName = focused ? 'qrcode-scan' : 'qrcode-scan';
              break;
            default:
              iconName = 'circle';
          }
          
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.outline,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
        },
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.onPrimary,
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
        options={{ title: 'Diagnostic' }}
      />
      <Tab.Screen 
        name="Repairs" 
        component={RepairGuidanceScreen}
        options={{ title: 'Réparations' }}
      />
      <Tab.Screen 
        name="WorkOrders" 
        component={WorkOrdersScreen}
        options={{ title: 'Interventions' }}
      />
      <Tab.Screen 
        name="Scanner" 
        component={EquipmentScannerScreen}
        options={{ title: 'Scanner' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const theme = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary,
        },
        headerTintColor: theme.colors.onPrimary,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="MainTabs" 
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="RepairSteps" 
        component={RepairStepsScreen}
        options={{ title: 'Guide de Réparation' }}
      />
      <Stack.Screen 
        name="EquipmentDetails" 
        component={EquipmentDetailsScreen}
        options={{ title: 'Détails Équipement' }}
      />
      <Stack.Screen 
        name="OfflineData" 
        component={OfflineDataScreen}
        options={{ title: 'Données Hors Ligne' }}
      />
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ title: 'Paramètres' }}
      />
    </Stack.Navigator>
  );
}
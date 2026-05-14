import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAuth } from '../providers/AuthProvider';
import { useLicense } from '../providers/LicenseProvider';

import HomeScreen from '../screens/HomeScreen';
import DiagnosticScreen from '../screens/DiagnosticScreen';
import RepairGuidanceScreen from '../screens/RepairGuidanceScreen';
import WorkOrdersScreen from '../screens/WorkOrdersScreen';
import EquipmentScannerScreen from '../screens/EquipmentScannerScreen';
import OfflineDataScreen from '../screens/OfflineDataScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RepairStepsScreen from '../screens/RepairStepsScreen';
import EquipmentDetailsScreen from '../screens/EquipmentDetailsScreen';
import LoginScreen from '../screens/LoginScreen';
import LicenseActivationScreen from '../screens/LicenseActivationScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function LoadingScreen() {
  const theme = useTheme();
  return (
    <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
      <Icon name="cog-transfer" size={64} color="#6366f1" />
      <ActivityIndicator size="large" color="#6366f1" style={{ marginTop: 24 }} />
      <Text variant="bodyMedium" style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>
        Chargement…
      </Text>
    </View>
  );
}

function MainTabs() {
  const theme = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;
          switch (route.name) {
            case 'Home':       iconName = focused ? 'home' : 'home-outline'; break;
            case 'Diagnostic': iconName = 'brain'; break;
            case 'Repairs':    iconName = focused ? 'wrench' : 'wrench-outline'; break;
            case 'WorkOrders': iconName = focused ? 'clipboard-list' : 'clipboard-list-outline'; break;
            case 'Scanner':    iconName = 'qrcode-scan'; break;
            default:           iconName = 'circle';
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#6366f1',
        tabBarInactiveTintColor: theme.colors.outline,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
          paddingBottom: 4,
          height: 60,
        },
        headerStyle: { backgroundColor: '#6366f1' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: 'bold' },
      })}
    >
      <Tab.Screen name="Home"       component={HomeScreen}            options={{ title: 'Accueil' }} />
      <Tab.Screen name="Diagnostic" component={DiagnosticScreen}      options={{ title: 'Diagnostic' }} />
      <Tab.Screen name="Repairs"    component={RepairGuidanceScreen}  options={{ title: 'Réparations' }} />
      <Tab.Screen name="WorkOrders" component={WorkOrdersScreen}      options={{ title: 'Interventions' }} />
      <Tab.Screen name="Scanner"    component={EquipmentScannerScreen} options={{ title: 'Scanner' }} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

function LicenseStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LicenseActivation" component={LicenseActivationScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#6366f1' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen name="MainTabs"         component={MainTabs}              options={{ headerShown: false }} />
      <Stack.Screen name="RepairSteps"      component={RepairStepsScreen}     options={{ title: 'Guide de Réparation' }} />
      <Stack.Screen name="EquipmentDetails" component={EquipmentDetailsScreen} options={{ title: 'Détails Équipement' }} />
      <Stack.Screen name="OfflineData"      component={OfflineDataScreen}     options={{ title: 'Données Hors Ligne' }} />
      <Stack.Screen name="Settings"         component={SettingsScreen}        options={{ title: 'Paramètres' }} />
      <Stack.Screen
        name="LicenseActivation"
        component={LicenseActivationScreen}
        options={{ title: 'Licence & Abonnement', headerStyle: { backgroundColor: '#6366f1' }, headerTintColor: '#fff' }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { license, isLoading: licenseLoading } = useLicense();

  if (authLoading || (isAuthenticated && licenseLoading)) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <AuthStack />;
  }

  if (!license.canOperate && license.status !== 'unknown') {
    return <LicenseStack />;
  }

  return <AppStack />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

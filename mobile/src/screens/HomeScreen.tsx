import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useOffline } from '../contexts/OfflineContext';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const HomeScreen = () => {
  const { theme } = useTheme();
  const { isOnline, pendingSyncCount } = useOffline();
  const navigation = useNavigation();

  const features = [
    {
      id: 1,
      title: 'Diagnostic IA',
      subtitle: 'Analyse intelligente des pannes',
      icon: 'search',
      color: ['#3b82f6', '#1e40af'],
      route: 'Diagnostic',
    },
    {
      id: 2,
      title: 'Scanner QR',
      subtitle: 'Identification équipement',
      icon: 'qr-code',
      color: ['#10b981', '#059669'],
      route: 'QRScanner',
    },
    {
      id: 3,
      title: 'Historique',
      subtitle: 'Consultez vos diagnostics',
      icon: 'time',
      color: ['#f59e0b', '#d97706'],
      route: 'History',
    },
    {
      id: 4,
      title: 'Données Hors Ligne',
      subtitle: 'Gestion mode offline',
      icon: 'cloud-offline',
      color: ['#8b5cf6', '#7c3aed'],
      route: 'OfflineData',
    },
  ];

  const stats = [
    {
      label: 'Diagnostics Réalisés',
      value: '24',
      icon: 'checkmark-circle',
      color: theme.colors.success,
    },
    {
      label: 'Temps Économisé',
      value: '12h',
      icon: 'time',
      color: theme.colors.info,
    },
    {
      label: 'Réparations Guidées',
      value: '18',
      icon: 'build',
      color: theme.colors.warning,
    },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    headerGradient: {
      paddingHorizontal: 20,
      paddingVertical: 30,
      borderBottomLeftRadius: 25,
      borderBottomRightRadius: 25,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: 'white',
      marginBottom: 5,
    },
    headerSubtitle: {
      fontSize: 16,
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: 15,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderRadius: 20,
    },
    statusText: {
      color: 'white',
      marginLeft: 8,
      fontSize: 14,
      fontWeight: '500',
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 15,
    },
    featuresGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 30,
    },
    featureCard: {
      width: (width - 50) / 2,
      height: 140,
      marginBottom: 15,
      borderRadius: 15,
      overflow: 'hidden',
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    featureGradient: {
      flex: 1,
      padding: 15,
      justifyContent: 'space-between',
    },
    featureIcon: {
      alignSelf: 'flex-start',
    },
    featureTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: 'white',
      marginBottom: 5,
    },
    featureSubtitle: {
      fontSize: 12,
      color: 'rgba(255, 255, 255, 0.8)',
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: theme.colors.surface,
      borderRadius: 15,
      paddingVertical: 20,
      marginBottom: 20,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 5,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    quickActions: {
      backgroundColor: theme.colors.surface,
      borderRadius: 15,
      padding: 20,
    },
    quickAction: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    quickActionLast: {
      borderBottomWidth: 0,
    },
    quickActionIcon: {
      marginRight: 15,
    },
    quickActionText: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.text,
    },
    quickActionArrow: {
      opacity: 0.5,
    },
  });

  const navigateToFeature = (route: string) => {
    navigation.navigate(route as never);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e40af', '#3b82f6']}
        style={styles.headerGradient}
      >
        <Text style={styles.headerTitle}>Smart GMAO DiagFix</Text>
        <Text style={styles.headerSubtitle}>Assistant intelligent de maintenance</Text>
        
        <View style={styles.statusContainer}>
          <Ionicons 
            name={isOnline ? 'wifi' : 'wifi-off'} 
            size={16} 
            color="white" 
          />
          <Text style={styles.statusText}>
            {isOnline ? 'En ligne' : 'Hors ligne'}
            {pendingSyncCount > 0 && ` • ${pendingSyncCount} en attente de sync`}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Fonctionnalités</Text>
        
        <View style={styles.featuresGrid}>
          {features.map((feature) => (
            <TouchableOpacity
              key={feature.id}
              style={styles.featureCard}
              onPress={() => navigateToFeature(feature.route)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={feature.color}
                style={styles.featureGradient}
              >
                <Ionicons
                  name={feature.icon as any}
                  size={32}
                  color="white"
                  style={styles.featureIcon}
                />
                <View>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Statistiques</Text>
        
        <View style={styles.statsContainer}>
          {stats.map((stat, index) => (
            <View key={index} style={styles.statItem}>
              <Ionicons name={stat.icon as any} size={24} color={stat.color} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Actions Rapides</Text>
        
        <View style={styles.quickActions}>
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => navigation.navigate('Diagnostic' as never)}
          >
            <Ionicons 
              name="flash" 
              size={20} 
              color={theme.colors.primary} 
              style={styles.quickActionIcon}
            />
            <Text style={styles.quickActionText}>Nouveau diagnostic rapide</Text>
            <Ionicons 
              name="chevron-forward" 
              size={16} 
              color={theme.colors.textSecondary}
              style={styles.quickActionArrow}
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickAction}
            onPress={() => navigation.navigate('QRScanner' as never)}
          >
            <Ionicons 
              name="camera" 
              size={20} 
              color={theme.colors.primary} 
              style={styles.quickActionIcon}
            />
            <Text style={styles.quickActionText}>Scanner un équipement</Text>
            <Ionicons 
              name="chevron-forward" 
              size={16} 
              color={theme.colors.textSecondary}
              style={styles.quickActionArrow}
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.quickAction, styles.quickActionLast]}
            onPress={() => navigation.navigate('History' as never)}
          >
            <Ionicons 
              name="document-text" 
              size={20} 
              color={theme.colors.primary} 
              style={styles.quickActionIcon}
            />
            <Text style={styles.quickActionText}>Consulter l'historique</Text>
            <Ionicons 
              name="chevron-forward" 
              size={16} 
              color={theme.colors.textSecondary}
              style={styles.quickActionArrow}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default HomeScreen;
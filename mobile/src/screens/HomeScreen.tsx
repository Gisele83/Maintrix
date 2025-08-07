import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Title, Paragraph, Button, FAB, Surface, Text, ProgressBar } from 'react-native-paper';
import { useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../providers/AuthProvider';
import { useOffline } from '../providers/OfflineProvider';
import { useDatabase } from '../providers/DatabaseProvider';

export default function HomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { isConnected, pendingSyncCount, syncData, downloadOfflineData } = useOffline();
  const { db } = useDatabase();
  
  const [stats, setStats] = useState({
    pendingWorkOrders: 0,
    completedToday: 0,
    urgentCases: 0
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadDashboardStats();
  }, [db]);

  const loadDashboardStats = () => {
    if (!db) return;

    db.transaction((tx) => {
      // Pending work orders
      tx.executeSql(
        "SELECT COUNT(*) as count FROM work_orders WHERE status = 'pending'",
        [],
        (_, { rows }) => {
          const pendingCount = rows.item(0).count;
          
          // Completed today
          tx.executeSql(
            "SELECT COUNT(*) as count FROM work_orders WHERE status = 'completed' AND DATE(completed_date) = DATE('now')",
            [],
            (_, { rows }) => {
              const completedCount = rows.item(0).count;
              
              // Urgent cases
              tx.executeSql(
                "SELECT COUNT(*) as count FROM work_orders WHERE priority = 'high' AND status != 'completed'",
                [],
                (_, { rows }) => {
                  const urgentCount = rows.item(0).count;
                  
                  setStats({
                    pendingWorkOrders: pendingCount,
                    completedToday: completedCount,
                    urgentCases: urgentCount
                  });
                }
              );
            }
          );
        }
      );
    });
  };

  const handleSync = async () => {
    setIsLoading(true);
    try {
      await syncData();
      Alert.alert('Synchronisation', 'Données synchronisées avec succès');
      loadDashboardStats();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de synchroniser les données');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadOfflineData = async () => {
    setIsLoading(true);
    try {
      await downloadOfflineData();
      Alert.alert('Téléchargement', 'Données hors-ligne téléchargées avec succès');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de télécharger les données');
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    {
      title: 'Nouveau Diagnostic',
      subtitle: 'Diagnostiquer un équipement',
      icon: 'brain',
      color: theme.colors.primary,
      onPress: () => navigation.navigate('Diagnostic')
    },
    {
      title: 'Scanner QR',
      subtitle: 'Identifier un équipement',
      icon: 'qrcode-scan',
      color: theme.colors.secondary,
      onPress: () => navigation.navigate('Scanner')
    },
    {
      title: 'Interventions',
      subtitle: 'Voir mes tâches',
      icon: 'clipboard-list',
      color: theme.colors.tertiary,
      onPress: () => navigation.navigate('WorkOrders')
    },
    {
      title: 'Guide Réparation',
      subtitle: 'Procédures détaillées',
      icon: 'wrench',
      color: '#f59e0b',
      onPress: () => navigation.navigate('Repairs')
    }
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Welcome Section */}
        <Surface style={[styles.welcomeCard, { backgroundColor: theme.colors.primary }]}>
          <View style={styles.welcomeContent}>
            <View>
              <Text variant="headlineSmall" style={{ color: theme.colors.onPrimary }}>
                Bonjour {user?.name || 'Technicien'}
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onPrimary, opacity: 0.8 }}>
                {new Date().toLocaleDateString('fr-FR', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </Text>
            </View>
            <View style={styles.connectionStatus}>
              <Icon 
                name={isConnected ? 'wifi' : 'wifi-off'} 
                size={24} 
                color={theme.colors.onPrimary}
              />
              <Text variant="bodySmall" style={{ color: theme.colors.onPrimary, marginLeft: 8 }}>
                {isConnected ? 'En ligne' : 'Hors ligne'}
              </Text>
            </View>
          </View>
        </Surface>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <Card style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
            <Card.Content style={styles.statContent}>
              <Icon name="clock-alert" size={32} color="#dc2626" />
              <View>
                <Text variant="headlineMedium" style={{ color: '#dc2626', fontWeight: 'bold' }}>
                  {stats.pendingWorkOrders}
                </Text>
                <Text variant="bodySmall" style={{ color: '#991b1b' }}>
                  En attente
                </Text>
              </View>
            </Card.Content>
          </Card>

          <Card style={[styles.statCard, { backgroundColor: '#dcfce7' }]}>
            <Card.Content style={styles.statContent}>
              <Icon name="check-circle" size={32} color="#16a34a" />
              <View>
                <Text variant="headlineMedium" style={{ color: '#16a34a', fontWeight: 'bold' }}>
                  {stats.completedToday}
                </Text>
                <Text variant="bodySmall" style={{ color: '#15803d' }}>
                  Terminées aujourd'hui
                </Text>
              </View>
            </Card.Content>
          </Card>

          <Card style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
            <Card.Content style={styles.statContent}>
              <Icon name="alert" size={32} color="#d97706" />
              <View>
                <Text variant="headlineMedium" style={{ color: '#d97706', fontWeight: 'bold' }}>
                  {stats.urgentCases}
                </Text>
                <Text variant="bodySmall" style={{ color: '#b45309' }}>
                  Urgentes
                </Text>
              </View>
            </Card.Content>
          </Card>
        </View>

        {/* Sync Status */}
        {pendingSyncCount > 0 && (
          <Card style={[styles.syncCard, { backgroundColor: theme.colors.tertiaryContainer }]}>
            <Card.Content>
              <View style={styles.syncContent}>
                <Icon name="sync" size={24} color={theme.colors.onTertiaryContainer} />
                <View style={styles.syncText}>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onTertiaryContainer }}>
                    {pendingSyncCount} élément(s) en attente de synchronisation
                  </Text>
                  <Button 
                    mode="contained-tonal" 
                    onPress={handleSync}
                    disabled={!isConnected || isLoading}
                    style={{ marginTop: 8 }}
                  >
                    Synchroniser
                  </Button>
                </View>
              </View>
              {isLoading && <ProgressBar indeterminate style={{ marginTop: 8 }} />}
            </Card.Content>
          </Card>
        )}

        {/* Quick Actions */}
        <Text variant="headlineSmall" style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
          Actions rapides
        </Text>
        
        <View style={styles.actionsGrid}>
          {quickActions.map((action, index) => (
            <Card key={index} style={styles.actionCard} onPress={action.onPress}>
              <Card.Content style={styles.actionContent}>
                <Icon name={action.icon} size={40} color={action.color} />
                <Title style={[styles.actionTitle, { color: theme.colors.onSurface }]}>
                  {action.title}
                </Title>
                <Paragraph style={[styles.actionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {action.subtitle}
                </Paragraph>
              </Card.Content>
            </Card>
          ))}
        </View>

        {/* Offline Data Download */}
        {isConnected && (
          <Card style={styles.offlineCard}>
            <Card.Content>
              <Title>Données hors-ligne</Title>
              <Paragraph>
                Télécharger les dernières données pour travailler sans connexion
              </Paragraph>
              <Button 
                mode="outlined" 
                onPress={handleDownloadOfflineData}
                disabled={isLoading}
                style={{ marginTop: 12 }}
              >
                Télécharger
              </Button>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => navigation.navigate('Diagnostic')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  welcomeCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 4,
  },
  welcomeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  syncCard: {
    marginBottom: 16,
    borderRadius: 8,
  },
  syncContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncText: {
    flex: 1,
    marginLeft: 12,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionCard: {
    width: '48%',
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
  },
  actionContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  actionTitle: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionSubtitle: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 4,
  },
  offlineCard: {
    marginBottom: 20,
    borderRadius: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 28,
  },
});
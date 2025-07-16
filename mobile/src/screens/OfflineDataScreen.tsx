import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Card,
  Button,
  List,
  ProgressBar,
  Surface,
  Divider,
  Chip,
  ActivityIndicator,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useOffline } from '../context/OfflineContext';
import { useDatabase } from '../context/DatabaseContext';
import { theme, spacing, typography, gradients } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type OfflineDataScreenNavigationProp = StackNavigationProp<RootStackParamList, 'OfflineData'>;

export function OfflineDataScreen() {
  const navigation = useNavigation<OfflineDataScreenNavigationProp>();
  const { isOnline, syncPending, pendingCount, syncOfflineData, clearCache } = useOffline();
  const { storage, isInitialized } = useDatabase();

  const [storageInfo, setStorageInfo] = useState({
    pendingFeedback: 0,
    pendingDiagnostics: 0,
    cachedHistory: 0,
    equipmentTypes: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadStorageInfo();
  }, []);

  const loadStorageInfo = async () => {
    try {
      setIsLoading(true);
      const info = await storage.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('Error loading storage info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadStorageInfo();
    setIsRefreshing(false);
  };

  const handleSync = async () => {
    if (!isOnline) {
      Alert.alert(
        'Connexion requise',
        'La synchronisation nécessite une connexion internet',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await syncOfflineData();
      await loadStorageInfo();
      Alert.alert('Synchronisation', 'Données synchronisées avec succès');
    } catch (error) {
      Alert.alert('Erreur', 'Échec de la synchronisation');
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Vider le cache',
      'Cette action supprimera toutes les données mises en cache. Les données non synchronisées seront perdues. Continuer ?',
      [
        { text: 'Annuler' },
        {
          text: 'Vider',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearCache();
              await loadStorageInfo();
              Alert.alert('Cache', 'Cache vidé avec succès');
            } catch (error) {
              Alert.alert('Erreur', 'Échec de la suppression du cache');
            }
          }
        }
      ]
    );
  };

  const handleClearSpecificData = (dataType: string) => {
    Alert.alert(
      'Supprimer les données',
      `Voulez-vous supprimer les données de type "${dataType}" ?`,
      [
        { text: 'Annuler' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            // Implement specific data clearing logic
            Alert.alert('Information', 'Fonctionnalité en développement');
          }
        }
      ]
    );
  };

  const getTotalCacheSize = () => {
    return storageInfo.pendingFeedback + 
           storageInfo.pendingDiagnostics + 
           storageInfo.cachedHistory + 
           storageInfo.equipmentTypes;
  };

  const getStorageUsage = () => {
    const total = getTotalCacheSize();
    const maxStorage = 1000; // Arbitrary max for demonstration
    return total / maxStorage;
  };

  const getConnectionStatus = () => {
    if (syncPending) return 'Synchronisation en cours...';
    if (isOnline) return 'Connecté';
    return 'Hors ligne';
  };

  const getConnectionColor = () => {
    if (syncPending) return theme.colors.warning;
    if (isOnline) return theme.colors.success;
    return theme.colors.error;
  };

  const getConnectionIcon = () => {
    if (syncPending) return 'sync';
    if (isOnline) return 'wifi';
    return 'wifi-off';
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={gradients.primary} style={styles.header}>
          <Text style={styles.headerTitle}>Données Hors-ligne</Text>
          <Text style={styles.headerSubtitle}>Chargement...</Text>
        </LinearGradient>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          colors={[theme.colors.primary]}
        />
      }
    >
      <LinearGradient colors={gradients.primary} style={styles.header}>
        <Text style={styles.headerTitle}>Données Hors-ligne</Text>
        <Text style={styles.headerSubtitle}>
          Gestion du stockage local
        </Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Connection Status */}
        <Card style={styles.statusCard}>
          <Card.Content>
            <View style={styles.statusRow}>
              <View style={styles.statusInfo}>
                <Text style={styles.statusTitle}>État de Connexion</Text>
                <View style={styles.statusDetails}>
                  <Icon 
                    name={getConnectionIcon()} 
                    size={20} 
                    color={getConnectionColor()} 
                  />
                  <Text style={[styles.statusText, { color: getConnectionColor() }]}>
                    {getConnectionStatus()}
                  </Text>
                </View>
              </View>
              {pendingCount > 0 && (
                <Chip
                  icon="sync"
                  style={styles.pendingChip}
                  textStyle={styles.pendingText}
                >
                  {pendingCount} en attente
                </Chip>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Storage Overview */}
        <Card style={styles.overviewCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Aperçu du Stockage</Text>
            <View style={styles.storageOverview}>
              <View style={styles.storageItem}>
                <Text style={styles.storageValue}>{getTotalCacheSize()}</Text>
                <Text style={styles.storageLabel}>Éléments total</Text>
              </View>
              <View style={styles.storageItem}>
                <Text style={styles.storageValue}>
                  {Math.round(getStorageUsage() * 100)}%
                </Text>
                <Text style={styles.storageLabel}>Utilisation</Text>
              </View>
            </View>
            <ProgressBar
              progress={getStorageUsage()}
              color={theme.colors.primary}
              style={styles.progressBar}
            />
          </Card.Content>
        </Card>

        {/* Data Details */}
        <Card style={styles.detailsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Détails des Données</Text>
            
            <List.Item
              title="Feedback en attente"
              description={`${storageInfo.pendingFeedback} éléments non synchronisés`}
              left={(props) => <List.Icon {...props} icon="rate-review" />}
              right={() => (
                <View style={styles.itemActions}>
                  <Text style={styles.itemCount}>{storageInfo.pendingFeedback}</Text>
                  {storageInfo.pendingFeedback > 0 && (
                    <Icon
                      name="delete"
                      size={20}
                      color={theme.colors.error}
                      onPress={() => handleClearSpecificData('feedback')}
                    />
                  )}
                </View>
              )}
            />
            <Divider />
            
            <List.Item
              title="Diagnostics en attente"
              description={`${storageInfo.pendingDiagnostics} diagnostics non synchronisés`}
              left={(props) => <List.Icon {...props} icon="search" />}
              right={() => (
                <View style={styles.itemActions}>
                  <Text style={styles.itemCount}>{storageInfo.pendingDiagnostics}</Text>
                  {storageInfo.pendingDiagnostics > 0 && (
                    <Icon
                      name="delete"
                      size={20}
                      color={theme.colors.error}
                      onPress={() => handleClearSpecificData('diagnostics')}
                    />
                  )}
                </View>
              )}
            />
            <Divider />
            
            <List.Item
              title="Historique en cache"
              description={`${storageInfo.cachedHistory} cas de maintenance`}
              left={(props) => <List.Icon {...props} icon="history" />}
              right={() => (
                <View style={styles.itemActions}>
                  <Text style={styles.itemCount}>{storageInfo.cachedHistory}</Text>
                  {storageInfo.cachedHistory > 0 && (
                    <Icon
                      name="delete"
                      size={20}
                      color={theme.colors.error}
                      onPress={() => handleClearSpecificData('history')}
                    />
                  )}
                </View>
              )}
            />
            <Divider />
            
            <List.Item
              title="Types d'équipements"
              description={`${storageInfo.equipmentTypes} types en cache`}
              left={(props) => <List.Icon {...props} icon="build" />}
              right={() => (
                <View style={styles.itemActions}>
                  <Text style={styles.itemCount}>{storageInfo.equipmentTypes}</Text>
                  {storageInfo.equipmentTypes > 0 && (
                    <Icon
                      name="delete"
                      size={20}
                      color={theme.colors.error}
                      onPress={() => handleClearSpecificData('equipment')}
                    />
                  )}
                </View>
              )}
            />
          </Card.Content>
        </Card>

        {/* Sync Status */}
        {pendingCount > 0 && (
          <Card style={styles.syncCard}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Synchronisation</Text>
              <Text style={styles.syncDescription}>
                {pendingCount} élément{pendingCount > 1 ? 's' : ''} en attente de synchronisation
              </Text>
              <Text style={styles.syncNote}>
                {isOnline 
                  ? 'Vous pouvez synchroniser maintenant'
                  : 'Synchronisation disponible une fois connecté'
                }
              </Text>
            </Card.Content>
          </Card>
        )}

        {/* Actions */}
        <Card style={styles.actionsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Actions</Text>
            
            <Button
              mode="contained"
              onPress={handleSync}
              disabled={!isOnline || syncPending || pendingCount === 0}
              loading={syncPending}
              style={styles.actionButton}
              icon="sync"
            >
              {syncPending ? 'Synchronisation...' : 'Synchroniser maintenant'}
            </Button>
            
            <Button
              mode="outlined"
              onPress={handleClearCache}
              disabled={getTotalCacheSize() === 0}
              style={styles.actionButton}
              icon="delete"
            >
              Vider tout le cache
            </Button>
            
            <Button
              mode="outlined"
              onPress={handleRefresh}
              style={styles.actionButton}
              icon="refresh"
            >
              Actualiser les infos
            </Button>
          </Card.Content>
        </Card>

        {/* Info Card */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text style={styles.infoTitle}>💡 Informations</Text>
            <Text style={styles.infoText}>
              • Les données sont automatiquement mises en cache pour une utilisation hors-ligne{'\n'}
              • La synchronisation se fait automatiquement quand une connexion est disponible{'\n'}
              • Vous pouvez vider le cache pour libérer de l'espace{'\n'}
              • Les données non synchronisées seront perdues si vous videz le cache
            </Text>
          </Card.Content>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  headerTitle: {
    ...typography.h2,
    color: '#ffffff',
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    ...typography.body1,
    color: '#ffffff',
    opacity: 0.9,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  content: {
    padding: spacing.md,
  },
  statusCard: {
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    ...typography.h4,
    marginBottom: spacing.sm,
  },
  statusDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    ...typography.body1,
    marginLeft: spacing.sm,
    fontWeight: '500',
  },
  pendingChip: {
    backgroundColor: theme.colors.warningContainer,
  },
  pendingText: {
    ...typography.body2,
    color: theme.colors.warning,
  },
  overviewCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    marginBottom: spacing.md,
  },
  storageOverview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  storageItem: {
    alignItems: 'center',
  },
  storageValue: {
    ...typography.h2,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  storageLabel: {
    ...typography.body2,
    color: theme.colors.secondary,
    marginTop: spacing.xs,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  detailsCard: {
    marginBottom: spacing.md,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemCount: {
    ...typography.body1,
    color: theme.colors.primary,
    fontWeight: '500',
    marginRight: spacing.sm,
  },
  syncCard: {
    marginBottom: spacing.md,
    backgroundColor: theme.colors.primaryContainer,
  },
  syncDescription: {
    ...typography.body1,
    marginBottom: spacing.sm,
  },
  syncNote: {
    ...typography.body2,
    color: theme.colors.secondary,
  },
  actionsCard: {
    marginBottom: spacing.md,
  },
  actionButton: {
    marginBottom: spacing.sm,
  },
  infoCard: {
    backgroundColor: theme.colors.surfaceVariant,
    marginBottom: spacing.lg,
  },
  infoTitle: {
    ...typography.h4,
    marginBottom: spacing.sm,
  },
  infoText: {
    ...typography.body2,
    color: theme.colors.secondary,
    lineHeight: 20,
  },
});
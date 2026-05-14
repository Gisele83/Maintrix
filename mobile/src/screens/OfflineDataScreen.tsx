import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card, Text, Button, ProgressBar, Surface, Banner } from 'react-native-paper';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useOffline } from '../providers/OfflineProvider';
import { useDatabase } from '../providers/DatabaseProvider';

export default function OfflineDataScreen() {
  const theme = useTheme();
  const {
    isConnected,
    isSyncing,
    pendingSyncCount,
    lastSyncTime,
    syncErrors,
    syncData,
    downloadOfflineData,
  } = useOffline();
  const { db } = useDatabase();

  const [stats, setStats] = useState({
    maintenanceCases: 0,
    repairProcedures: 0,
    equipment: 0,
    workOrders: 0,
    diagnosticSessions: 0,
    pendingFeedback: 0,
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [lastSyncLabel, setLastSyncLabel] = useState<string>('Jamais');

  useEffect(() => {
    loadOfflineStats();
  }, [db]);

  useEffect(() => {
    if (lastSyncTime) {
      setLastSyncLabel(formatSyncDate(lastSyncTime));
    }
  }, [lastSyncTime]);

  const formatSyncDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'À l\'instant';
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH}h`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  const loadOfflineStats = () => {
    if (!db) return;

    db.transaction((tx) => {
      tx.executeSql('SELECT COUNT(*) as count FROM maintenance_cases', [], (_, { rows }) => {
        const maintenanceCases = rows.item(0).count;

        tx.executeSql('SELECT COUNT(*) as count FROM repair_procedures', [], (_, { rows }) => {
          const repairProcedures = rows.item(0).count;

          tx.executeSql('SELECT COUNT(*) as count FROM equipment', [], (_, { rows }) => {
            const equipment = rows.item(0).count;

            tx.executeSql('SELECT COUNT(*) as count FROM work_orders', [], (_, { rows }) => {
              const workOrders = rows.item(0).count;

              tx.executeSql('SELECT COUNT(*) as count FROM diagnostic_sessions', [], (_, { rows }) => {
                const diagnosticSessions = rows.item(0).count;

                // pending_feedback may not exist — check first
                tx.executeSql(
                  "SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name='pending_feedback'",
                  [],
                  (_, { rows: r }) => {
                    if (r.item(0).c > 0) {
                      tx.executeSql(
                        'SELECT COUNT(*) as count FROM pending_feedback WHERE synced = 0',
                        [],
                        (_, { rows }) => {
                          setStats({ maintenanceCases, repairProcedures, equipment, workOrders, diagnosticSessions, pendingFeedback: rows.item(0).count });
                        }
                      );
                    } else {
                      setStats({ maintenanceCases, repairProcedures, equipment, workOrders, diagnosticSessions, pendingFeedback: 0 });
                    }
                  }
                );
              });
            });
          });
        });
      });
    });
  };

  const handleDownloadData = async () => {
    if (!isConnected) {
      Alert.alert('Pas de connexion', 'Une connexion internet est requise pour télécharger les données');
      return;
    }
    setIsDownloading(true);
    try {
      await downloadOfflineData();
      loadOfflineStats();
      Alert.alert('Succès', 'Données téléchargées avec succès');
    } catch (error: any) {
      Alert.alert('Erreur', error?.message || 'Impossible de télécharger les données');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSyncData = async () => {
    if (!isConnected) {
      Alert.alert('Pas de connexion', 'Une connexion internet est requise pour synchroniser');
      return;
    }
    try {
      const result = await syncData();
      loadOfflineStats();
      if (result.failed > 0) {
        Alert.alert(
          'Synchronisation partielle',
          `${result.synced} élément(s) synchronisé(s), ${result.failed} échec(s).\n${result.errors.slice(0, 3).join('\n')}`
        );
      } else if (result.synced === 0) {
        Alert.alert('Info', 'Aucune donnée en attente de synchronisation');
      } else {
        Alert.alert('Succès', `${result.synced} élément(s) synchronisé(s)`);
      }
    } catch (error: any) {
      Alert.alert('Erreur', error?.message || 'Impossible de synchroniser les données');
    }
  };

  const clearOfflineData = () => {
    Alert.alert(
      'Effacer les données',
      'Êtes-vous sûr de vouloir effacer toutes les données hors ligne ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: () => {
            if (!db) return;
            db.transaction((tx) => {
              tx.executeSql('DELETE FROM maintenance_cases');
              tx.executeSql('DELETE FROM repair_procedures');
              tx.executeSql('DELETE FROM equipment WHERE synced = 1');
              tx.executeSql('DELETE FROM diagnostic_sessions WHERE synced = 1');
            });
            loadOfflineStats();
            Alert.alert('Succès', 'Données effacées');
          }
        }
      ]
    );
  };

  const isLoading = isSyncing || isDownloading;

  const dataItems = [
    { title: 'Cas de maintenance', count: stats.maintenanceCases, icon: 'database', description: 'Historique des cas de maintenance industrielle' },
    { title: 'Procédures de réparation', count: stats.repairProcedures, icon: 'format-list-numbered', description: 'Étapes détaillées de réparation' },
    { title: 'Équipements', count: stats.equipment, icon: 'cog', description: 'Registre des équipements enregistrés' },
    { title: 'Interventions (en attente)', count: stats.workOrders, icon: 'clipboard-list', description: 'Ordres de travail locaux' },
    { title: 'Sessions diagnostic', count: stats.diagnosticSessions, icon: 'brain', description: 'Diagnostics réalisés hors ligne' },
    { title: 'Retours utilisateur', count: stats.pendingFeedback, icon: 'star-outline', description: 'Feedbacks en attente de sync' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Sync errors banner */}
        {syncErrors.length > 0 && (
          <Banner
            visible={true}
            icon="alert"
            actions={[{ label: 'OK', onPress: () => {} }]}
          >
            {`${syncErrors.length} erreur(s) lors de la dernière sync: ${syncErrors[0]}`}
          </Banner>
        )}

        {/* Connection Status */}
        <Card style={[styles.statusCard, { backgroundColor: isConnected ? theme.colors.primaryContainer : theme.colors.errorContainer }]}>
          <Card.Content>
            <View style={styles.statusContent}>
              <Icon
                name={isConnected ? 'wifi' : 'wifi-off'}
                size={32}
                color={isConnected ? theme.colors.primary : theme.colors.error}
              />
              <View style={styles.statusText}>
                <Text variant="titleMedium" style={{ color: isConnected ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer }}>
                  {isConnected ? 'Connexion active' : 'Mode hors ligne'}
                </Text>
                <Text variant="bodyMedium" style={{ color: isConnected ? theme.colors.onPrimaryContainer : theme.colors.onErrorContainer, opacity: 0.8 }}>
                  {isConnected ? 'Synchronisation disponible' : 'Fonctionnement avec données locales'}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Sync Status */}
        <Card style={styles.syncCard}>
          <Card.Content>
            <View style={styles.syncHeader}>
              <Text variant="titleMedium" style={styles.syncTitle}>État de synchronisation</Text>
              <Icon name={isSyncing ? 'sync' : 'check-circle-outline'} size={24} color={isSyncing ? theme.colors.primary : theme.colors.secondary} />
            </View>

            <View style={styles.syncStats}>
              <View style={styles.syncStat}>
                <Text variant="headlineMedium" style={[styles.syncNumber, { color: pendingSyncCount > 0 ? theme.colors.error : theme.colors.primary }]}>
                  {pendingSyncCount}
                </Text>
                <Text variant="bodyMedium" style={styles.syncLabel}>En attente</Text>
              </View>
              <View style={styles.syncStat}>
                <Text variant="titleLarge" style={[styles.syncNumber, { color: theme.colors.secondary }]}>
                  {lastSyncLabel}
                </Text>
                <Text variant="bodyMedium" style={styles.syncLabel}>Dernière sync</Text>
              </View>
            </View>

            {isLoading && (
              <ProgressBar indeterminate style={styles.progressBar} />
            )}

            {isSyncing && (
              <Text variant="bodySmall" style={[styles.syncingLabel, { color: theme.colors.primary }]}>
                Synchronisation en cours…
              </Text>
            )}

            <View style={styles.syncActions}>
              <Button
                mode="contained"
                onPress={handleSyncData}
                disabled={!isConnected || isLoading || pendingSyncCount === 0}
                style={styles.syncButton}
                icon="upload"
                loading={isSyncing}
              >
                {isSyncing ? 'Synchronisation…' : `Synchroniser (${pendingSyncCount})`}
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Data Overview */}
        <Card style={styles.dataCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Données hors ligne</Text>
            {dataItems.map((item, index) => (
              <View key={index} style={styles.dataItem}>
                <View style={styles.dataHeader}>
                  <Icon name={item.icon} size={24} color={theme.colors.primary} />
                  <View style={styles.dataInfo}>
                    <Text variant="titleSmall" style={styles.dataTitle}>{item.title}</Text>
                    <Text variant="bodySmall" style={styles.dataDescription}>{item.description}</Text>
                  </View>
                  <View style={styles.dataCount}>
                    <Text variant="titleLarge" style={[styles.countNumber, { color: theme.colors.primary }]}>{item.count}</Text>
                  </View>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Actions */}
        <Card style={styles.actionsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Gestion des données</Text>
            <View style={styles.actionsList}>
              <Button
                mode="outlined"
                onPress={handleDownloadData}
                disabled={!isConnected || isLoading}
                style={styles.actionButton}
                icon="download"
                loading={isDownloading}
              >
                Télécharger les dernières données
              </Button>
              <Button
                mode="outlined"
                onPress={loadOfflineStats}
                disabled={isLoading}
                style={styles.actionButton}
                icon="refresh"
              >
                Actualiser les statistiques
              </Button>
              <Button
                mode="outlined"
                onPress={clearOfflineData}
                disabled={isLoading}
                style={[styles.actionButton, { borderColor: theme.colors.error }]}
                textColor={theme.colors.error}
                icon="delete"
              >
                Effacer les données locales
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Info */}
        <Surface style={styles.infoCard}>
          <View style={styles.infoContent}>
            <Icon name="information" size={20} color={theme.colors.primary} />
            <Text variant="bodyMedium" style={styles.infoText}>
              Les données hors ligne permettent d'utiliser l'application sans connexion internet.
              La synchronisation s'effectue automatiquement lors du retour en ligne.
            </Text>
          </View>
        </Surface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  statusCard: { marginBottom: 16, borderRadius: 12, elevation: 2 },
  statusContent: { flexDirection: 'row', alignItems: 'center' },
  statusText: { marginLeft: 16, flex: 1 },
  syncCard: { marginBottom: 16, borderRadius: 8, elevation: 2 },
  syncHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  syncTitle: { fontWeight: 'bold' },
  syncStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  syncStat: { alignItems: 'center' },
  syncNumber: { fontWeight: 'bold' },
  syncLabel: { opacity: 0.7, marginTop: 4 },
  progressBar: { marginBottom: 8 },
  syncingLabel: { textAlign: 'center', marginBottom: 12, fontStyle: 'italic' },
  syncActions: { alignItems: 'center' },
  syncButton: { width: '100%' },
  dataCard: { marginBottom: 16, borderRadius: 8, elevation: 2 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 16 },
  dataItem: { marginBottom: 12 },
  dataHeader: { flexDirection: 'row', alignItems: 'center' },
  dataInfo: { flex: 1, marginLeft: 12 },
  dataTitle: { fontWeight: 'bold' },
  dataDescription: { opacity: 0.7, marginTop: 2 },
  dataCount: { alignItems: 'center', justifyContent: 'center', width: 48 },
  countNumber: { fontWeight: 'bold' },
  actionsCard: { marginBottom: 16, borderRadius: 8, elevation: 2 },
  actionsList: { gap: 12 },
  actionButton: { borderRadius: 8 },
  infoCard: { padding: 16, borderRadius: 8, marginBottom: 20 },
  infoContent: { flexDirection: 'row', alignItems: 'center' },
  infoText: { marginLeft: 12, flex: 1, lineHeight: 20, opacity: 0.8 },
});

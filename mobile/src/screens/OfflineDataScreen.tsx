import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useOffline } from '../contexts/OfflineContext';
import { useApiService } from '../services/ApiService';
import * as Progress from 'react-native-progress';

const OfflineDataScreen = () => {
  const { theme } = useTheme();
  const { isOnline, pendingSyncCount, syncData, lastSyncTime } = useOffline();
  const apiService = useApiService();

  const [loading, setLoading] = useState(false);
  const [storageInfo, setStorageInfo] = useState({
    totalDiagnostics: 0,
    pendingSync: 0,
    cacheSize: '0 MB',
    photosSize: '0 MB',
    totalSize: '0 MB',
  });

  useEffect(() => {
    loadStorageInfo();
  }, []);

  const loadStorageInfo = async () => {
    try {
      const diagnostics = await apiService.getOfflineDiagnostics();
      
      setStorageInfo({
        totalDiagnostics: diagnostics.length,
        pendingSync: pendingSyncCount,
        cacheSize: '2.3 MB', // Simulated
        photosSize: '1.8 MB', // Simulated
        totalSize: '15.7 MB', // Simulated
      });
    } catch (error) {
      console.error('Failed to load storage info:', error);
    }
  };

  const handleSyncAll = async () => {
    if (!isOnline) {
      Alert.alert('Hors ligne', 'Vous devez être connecté à Internet pour synchroniser.');
      return;
    }

    setLoading(true);
    try {
      await syncData();
      await loadStorageInfo();
      Alert.alert('Succès', 'Toutes les données ont été synchronisées avec succès.');
    } catch (error) {
      Alert.alert('Erreur', 'Échec de la synchronisation. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Vider le cache',
      'Cette action supprimera toutes les données temporaires. Les diagnostics sauvegardés seront conservés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // Simulate cache clearing
              setTimeout(() => {
                setStorageInfo(prev => ({ ...prev, cacheSize: '0 MB' }));
                setLoading(false);
                Alert.alert('Succès', 'Cache vidé avec succès.');
              }, 1000);
            } catch (error) {
              setLoading(false);
              Alert.alert('Erreur', 'Impossible de vider le cache.');
            }
          },
        },
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Supprimer toutes les données',
      'ATTENTION: Cette action supprimera définitivement tous vos diagnostics et données hors ligne. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // Simulate data clearing
              setTimeout(() => {
                setStorageInfo({
                  totalDiagnostics: 0,
                  pendingSync: 0,
                  cacheSize: '0 MB',
                  photosSize: '0 MB',
                  totalSize: '0 MB',
                });
                setLoading(false);
                Alert.alert('Succès', 'Toutes les données ont été supprimées.');
              }, 1500);
            } catch (error) {
              setLoading(false);
              Alert.alert('Erreur', 'Impossible de supprimer les données.');
            }
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      'Export des données',
      'Cette fonctionnalité permettra d\'exporter toutes vos données vers un fichier CSV ou JSON.',
      [{ text: 'OK' }]
    );
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Jamais synchronisé';
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSyncTime.getTime()) / 1000);
    
    if (diff < 60) return 'Il y a moins d\'une minute';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} minutes`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} heures`;
    return `Il y a ${Math.floor(diff / 86400)} jours`;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerGradient: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: 'white',
      marginBottom: 5,
    },
    headerSubtitle: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.8)',
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    statusCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 15,
      padding: 20,
      marginBottom: 20,
    },
    statusTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 15,
    },
    statusItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    statusItemLast: {
      borderBottomWidth: 0,
    },
    statusIcon: {
      marginRight: 15,
    },
    statusContent: {
      flex: 1,
    },
    statusLabel: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: '500',
    },
    statusValue: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    statusBadge: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 15,
    },
    statusBadgeText: {
      color: 'white',
      fontSize: 12,
      fontWeight: 'bold',
    },
    storageCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 15,
      padding: 20,
      marginBottom: 20,
    },
    storageTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 15,
    },
    storageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    storageItem: {
      width: '48%',
      backgroundColor: theme.colors.background,
      borderRadius: 10,
      padding: 15,
      marginBottom: 10,
      alignItems: 'center',
    },
    storageIcon: {
      marginBottom: 10,
    },
    storageValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.primary,
      marginBottom: 5,
    },
    storageLabel: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    syncCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 15,
      padding: 20,
      marginBottom: 20,
    },
    syncTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 15,
    },
    syncStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderRadius: 10,
      marginBottom: 15,
    },
    syncStatusText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginLeft: 10,
      flex: 1,
    },
    progressContainer: {
      marginBottom: 15,
    },
    progressLabel: {
      fontSize: 14,
      color: theme.colors.text,
      marginBottom: 8,
    },
    progressInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 5,
    },
    progressText: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    actionButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 15,
      paddingVertical: 15,
      alignItems: 'center',
      marginBottom: 10,
      flexDirection: 'row',
      justifyContent: 'center',
    },
    actionButtonSecondary: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionButtonDanger: {
      backgroundColor: '#ef4444',
    },
    actionButtonDisabled: {
      backgroundColor: theme.colors.border,
      opacity: 0.6,
    },
    actionButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '500',
      marginLeft: 8,
    },
    actionButtonTextSecondary: {
      color: theme.colors.text,
    },
    infoCard: {
      backgroundColor: '#e1f5fe',
      borderRadius: 10,
      padding: 15,
      marginBottom: 20,
    },
    infoText: {
      fontSize: 14,
      color: '#01579b',
      lineHeight: 20,
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    loadingContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 15,
      padding: 30,
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.text,
      marginTop: 15,
    },
  });

  const syncProgress = storageInfo.pendingSync > 0 
    ? (storageInfo.totalDiagnostics - storageInfo.pendingSync) / storageInfo.totalDiagnostics 
    : 1;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e40af', '#3b82f6']}
        style={styles.headerGradient}
      >
        <Text style={styles.headerTitle}>Données Hors Ligne</Text>
        <Text style={styles.headerSubtitle}>Gestion du stockage et synchronisation</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Connection Status */}
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>État de la connexion</Text>
          
          <View style={[styles.statusItem, styles.statusItemLast]}>
            <Ionicons
              name={isOnline ? 'wifi' : 'wifi-off'}
              size={24}
              color={isOnline ? '#10b981' : '#ef4444'}
              style={styles.statusIcon}
            />
            <View style={styles.statusContent}>
              <Text style={styles.statusLabel}>
                {isOnline ? 'En ligne' : 'Hors ligne'}
              </Text>
              <Text style={styles.statusValue}>
                {isOnline 
                  ? 'Synchronisation disponible' 
                  : 'Mode hors ligne actif'
                }
              </Text>
            </View>
            <View style={[
              styles.statusBadge,
              { backgroundColor: isOnline ? '#10b981' : '#ef4444' }
            ]}>
              <Text style={styles.statusBadgeText}>
                {isOnline ? 'CONNECTÉ' : 'DÉCONNECTÉ'}
              </Text>
            </View>
          </View>
        </View>

        {/* Storage Information */}
        <View style={styles.storageCard}>
          <Text style={styles.storageTitle}>Utilisation du stockage</Text>
          
          <View style={styles.storageGrid}>
            <View style={styles.storageItem}>
              <Ionicons
                name="document-text"
                size={32}
                color={theme.colors.primary}
                style={styles.storageIcon}
              />
              <Text style={styles.storageValue}>{storageInfo.totalDiagnostics}</Text>
              <Text style={styles.storageLabel}>Diagnostics</Text>
            </View>

            <View style={styles.storageItem}>
              <Ionicons
                name="cloud-upload"
                size={32}
                color={storageInfo.pendingSync > 0 ? '#f59e0b' : '#10b981'}
                style={styles.storageIcon}
              />
              <Text style={styles.storageValue}>{storageInfo.pendingSync}</Text>
              <Text style={styles.storageLabel}>En attente</Text>
            </View>

            <View style={styles.storageItem}>
              <Ionicons
                name="folder"
                size={32}
                color={theme.colors.primary}
                style={styles.storageIcon}
              />
              <Text style={styles.storageValue}>{storageInfo.cacheSize}</Text>
              <Text style={styles.storageLabel}>Cache</Text>
            </View>

            <View style={styles.storageItem}>
              <Ionicons
                name="camera"
                size={32}
                color={theme.colors.primary}
                style={styles.storageIcon}
              />
              <Text style={styles.storageValue}>{storageInfo.photosSize}</Text>
              <Text style={styles.storageLabel}>Photos</Text>
            </View>
          </View>
        </View>

        {/* Sync Status */}
        <View style={styles.syncCard}>
          <Text style={styles.syncTitle}>Synchronisation</Text>
          
          <View style={styles.syncStatus}>
            <Ionicons
              name={storageInfo.pendingSync > 0 ? 'sync-circle' : 'checkmark-circle'}
              size={20}
              color={storageInfo.pendingSync > 0 ? '#f59e0b' : '#10b981'}
            />
            <Text style={styles.syncStatusText}>
              {storageInfo.pendingSync > 0
                ? `${storageInfo.pendingSync} éléments en attente de synchronisation`
                : 'Toutes les données sont synchronisées'
              }
            </Text>
          </View>

          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Progression de la synchronisation</Text>
            <Progress.Bar
              progress={syncProgress}
              width={null}
              height={8}
              color={theme.colors.primary}
              unfilledColor={theme.colors.border}
              borderWidth={0}
              borderRadius={4}
            />
            <View style={styles.progressInfo}>
              <Text style={styles.progressText}>
                {Math.round(syncProgress * 100)}% synchronisé
              </Text>
              <Text style={styles.progressText}>
                Dernière sync: {formatLastSync()}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.actionButton,
              (!isOnline || loading) && styles.actionButtonDisabled
            ]}
            onPress={handleSyncAll}
            disabled={!isOnline || loading}
          >
            <Ionicons name="sync" size={20} color="white" />
            <Text style={styles.actionButtonText}>
              {loading ? 'Synchronisation...' : 'Synchroniser maintenant'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.storageCard}>
          <Text style={styles.storageTitle}>Actions</Text>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={handleExportData}
            disabled={loading}
          >
            <Ionicons name="download" size={20} color={theme.colors.text} />
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              Exporter les données
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={handleClearCache}
            disabled={loading}
          >
            <Ionicons name="trash" size={20} color={theme.colors.text} />
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              Vider le cache
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonDanger]}
            onPress={handleClearAllData}
            disabled={loading}
          >
            <Ionicons name="warning" size={20} color="white" />
            <Text style={styles.actionButtonText}>
              Supprimer toutes les données
            </Text>
          </TouchableOpacity>
        </View>

        {/* Information */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💡 Les données sont automatiquement sauvegardées hors ligne pour vous permettre de travailler même sans connexion Internet. 
            La synchronisation se fait automatiquement dès qu'une connexion est disponible.
          </Text>
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Traitement en cours...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default OfflineDataScreen;
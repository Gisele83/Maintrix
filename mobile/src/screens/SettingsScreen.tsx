import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  TouchableOpacity,
} from 'react-native';
import {
  Card,
  List,
  Button,
  Surface,
  Divider,
  RadioButton,
  Portal,
  Modal,
  TextInput,
  ProgressBar,
  Chip,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DeviceInfo from 'react-native-device-info';

import { useOffline } from '../context/OfflineContext';
import { useDatabase } from '../context/DatabaseContext';
import { theme, spacing, typography, gradients } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type SettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'>;

export function SettingsScreen() {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { isOnline, syncPending, pendingCount, syncOfflineData, clearCache } = useOffline();
  const { storage, isInitialized } = useDatabase();

  const [settings, setSettings] = useState({
    autoSync: true,
    notifications: true,
    offlineMode: false,
    advancedML: false,
    theme: 'system',
    language: 'fr',
    serverUrl: '',
    cacheSize: 0,
    dataUsage: 0,
  });

  const [showServerModal, setShowServerModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [newServerUrl, setNewServerUrl] = useState('');
  const [storageInfo, setStorageInfo] = useState({
    pendingFeedback: 0,
    pendingDiagnostics: 0,
    cachedHistory: 0,
    equipmentTypes: 0,
  });
  const [appInfo, setAppInfo] = useState({
    version: '1.0.0',
    buildNumber: '1',
    deviceModel: '',
    systemName: '',
    systemVersion: '',
  });

  useEffect(() => {
    loadSettings();
    loadStorageInfo();
    loadAppInfo();
  }, []);

  const loadSettings = async () => {
    try {
      const autoSync = await storage.getSetting('autoSync');
      const notifications = await storage.getSetting('notifications');
      const offlineMode = await storage.getSetting('offlineMode');
      const advancedML = await storage.getSetting('advancedML');
      const theme = await storage.getSetting('theme');
      const language = await storage.getSetting('language');
      const serverUrl = await storage.getSetting('serverUrl');

      setSettings({
        autoSync: autoSync !== 'false',
        notifications: notifications !== 'false',
        offlineMode: offlineMode === 'true',
        advancedML: advancedML === 'true',
        theme: theme || 'system',
        language: language || 'fr',
        serverUrl: serverUrl || '',
        cacheSize: 0,
        dataUsage: 0,
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadStorageInfo = async () => {
    try {
      const info = await storage.getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('Error loading storage info:', error);
    }
  };

  const loadAppInfo = async () => {
    try {
      const version = await DeviceInfo.getVersion();
      const buildNumber = await DeviceInfo.getBuildNumber();
      const deviceModel = await DeviceInfo.getModel();
      const systemName = await DeviceInfo.getSystemName();
      const systemVersion = await DeviceInfo.getSystemVersion();

      setAppInfo({
        version,
        buildNumber,
        deviceModel,
        systemName,
        systemVersion,
      });
    } catch (error) {
      console.error('Error loading app info:', error);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    try {
      await storage.setSetting(key, value.toString());
      setSettings(prev => ({ ...prev, [key]: value }));
    } catch (error) {
      console.error('Error updating setting:', error);
    }
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
      'Cette action supprimera toutes les données mises en cache. Continuer ?',
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

  const handleServerUrlChange = async () => {
    if (!newServerUrl.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir une URL valide');
      return;
    }

    try {
      await updateSetting('serverUrl', newServerUrl);
      setShowServerModal(false);
      setNewServerUrl('');
      Alert.alert('Paramètres', 'URL du serveur mise à jour');
    } catch (error) {
      Alert.alert('Erreur', 'Échec de la mise à jour de l\'URL');
    }
  };

  const handleOfflineDataNavigation = () => {
    navigation.navigate('OfflineData');
  };

  const getConnectionStatus = () => {
    if (syncPending) return 'Synchronisation...';
    if (isOnline) return 'En ligne';
    return 'Hors ligne';
  };

  const getConnectionColor = () => {
    if (syncPending) return theme.colors.warning;
    if (isOnline) return theme.colors.success;
    return theme.colors.error;
  };

  const getCacheUsage = () => {
    const total = storageInfo.pendingFeedback + storageInfo.pendingDiagnostics + 
                  storageInfo.cachedHistory + storageInfo.equipmentTypes;
    return total;
  };

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={gradients.primary} style={styles.header}>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <Text style={styles.headerSubtitle}>SMDiagFix Mobile</Text>
      </LinearGradient>

      <View style={styles.content}>
        {/* Connection Status */}
        <Card style={styles.statusCard}>
          <Card.Content>
            <View style={styles.statusRow}>
              <View style={styles.statusInfo}>
                <Text style={styles.statusTitle}>État de Connexion</Text>
                <Text style={[styles.statusText, { color: getConnectionColor() }]}>
                  {getConnectionStatus()}
                </Text>
              </View>
              <View style={styles.statusActions}>
                {pendingCount > 0 && (
                  <Chip
                    icon="sync"
                    style={styles.pendingChip}
                    textStyle={styles.pendingText}
                  >
                    {pendingCount} en attente
                  </Chip>
                )}
                <TouchableOpacity
                  style={styles.syncButton}
                  onPress={handleSync}
                  disabled={!isOnline || syncPending}
                >
                  <Icon
                    name={syncPending ? "sync" : "cloud-sync"}
                    size={24}
                    color={isOnline ? theme.colors.primary : theme.colors.disabled}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* General Settings */}
        <Card style={styles.settingsCard}>
          <Card.Title title="Général" />
          <Card.Content>
            <List.Item
              title="Synchronisation automatique"
              description="Synchroniser automatiquement en ligne"
              left={(props) => <List.Icon {...props} icon="sync" />}
              right={() => (
                <Switch
                  value={settings.autoSync}
                  onValueChange={(value) => updateSetting('autoSync', value)}
                />
              )}
            />
            <Divider />
            <List.Item
              title="Notifications"
              description="Recevoir des notifications"
              left={(props) => <List.Icon {...props} icon="notifications" />}
              right={() => (
                <Switch
                  value={settings.notifications}
                  onValueChange={(value) => updateSetting('notifications', value)}
                />
              )}
            />
            <Divider />
            <List.Item
              title="Mode hors-ligne"
              description="Privilégier les données locales"
              left={(props) => <List.Icon {...props} icon="wifi-off" />}
              right={() => (
                <Switch
                  value={settings.offlineMode}
                  onValueChange={(value) => updateSetting('offlineMode', value)}
                />
              )}
            />
          </Card.Content>
        </Card>

        {/* ML Settings */}
        <Card style={styles.settingsCard}>
          <Card.Title title="Intelligence Artificielle" />
          <Card.Content>
            <List.Item
              title="ML Avancé"
              description="Utiliser les algorithmes ML avancés"
              left={(props) => <List.Icon {...props} icon="psychology" />}
              right={() => (
                <Switch
                  value={settings.advancedML}
                  onValueChange={(value) => updateSetting('advancedML', value)}
                />
              )}
            />
            <Divider />
            <List.Item
              title="Langue"
              description={settings.language === 'fr' ? 'Français' : 'English'}
              left={(props) => <List.Icon {...props} icon="language" />}
              onPress={() => {
                Alert.alert(
                  'Langue',
                  'Sélectionner la langue',
                  [
                    { text: 'Français', onPress: () => updateSetting('language', 'fr') },
                    { text: 'English', onPress: () => updateSetting('language', 'en') },
                    { text: 'Annuler' }
                  ]
                );
              }}
            />
          </Card.Content>
        </Card>

        {/* Storage Settings */}
        <Card style={styles.settingsCard}>
          <Card.Title title="Stockage" />
          <Card.Content>
            <List.Item
              title="Données hors-ligne"
              description={`${getCacheUsage()} éléments en cache`}
              left={(props) => <List.Icon {...props} icon="storage" />}
              onPress={handleOfflineDataNavigation}
            />
            <Divider />
            <List.Item
              title="Vider le cache"
              description="Supprimer les données mises en cache"
              left={(props) => <List.Icon {...props} icon="delete" />}
              onPress={handleClearCache}
            />
            <Divider />
            <List.Item
              title="Infos de stockage"
              description="Détails sur l'utilisation du stockage"
              left={(props) => <List.Icon {...props} icon="info" />}
              onPress={() => setShowStorageModal(true)}
            />
          </Card.Content>
        </Card>

        {/* Advanced Settings */}
        <Card style={styles.settingsCard}>
          <Card.Title title="Avancé" />
          <Card.Content>
            <List.Item
              title="URL du serveur"
              description={settings.serverUrl || 'Non configuré'}
              left={(props) => <List.Icon {...props} icon="dns" />}
              onPress={() => {
                setNewServerUrl(settings.serverUrl);
                setShowServerModal(true);
              }}
            />
            <Divider />
            <List.Item
              title="À propos"
              description={`Version ${appInfo.version}`}
              left={(props) => <List.Icon {...props} icon="info" />}
              onPress={() => setShowAboutModal(true)}
            />
          </Card.Content>
        </Card>

        {/* Debug Info (Dev mode only) */}
        {__DEV__ && (
          <Card style={styles.settingsCard}>
            <Card.Title title="Debug (Dev Mode)" />
            <Card.Content>
              <Text style={styles.debugText}>Database: {isInitialized ? 'Initialisée' : 'En cours...'}</Text>
              <Text style={styles.debugText}>Online: {isOnline ? 'Oui' : 'Non'}</Text>
              <Text style={styles.debugText}>Sync Pending: {syncPending ? 'Oui' : 'Non'}</Text>
              <Text style={styles.debugText}>Pending Count: {pendingCount}</Text>
            </Card.Content>
          </Card>
        )}
      </View>

      {/* Server URL Modal */}
      <Portal>
        <Modal
          visible={showServerModal}
          onDismiss={() => setShowServerModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>URL du Serveur</Text>
          <TextInput
            label="URL"
            value={newServerUrl}
            onChangeText={setNewServerUrl}
            style={styles.modalInput}
            placeholder="https://api.smdiagfix.com"
          />
          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setShowServerModal(false)}
              style={styles.modalButton}
            >
              Annuler
            </Button>
            <Button
              mode="contained"
              onPress={handleServerUrlChange}
              style={styles.modalButton}
            >
              Enregistrer
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Storage Info Modal */}
      <Portal>
        <Modal
          visible={showStorageModal}
          onDismiss={() => setShowStorageModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Informations de Stockage</Text>
          <View style={styles.storageInfo}>
            <View style={styles.storageItem}>
              <Text style={styles.storageLabel}>Feedback en attente</Text>
              <Text style={styles.storageValue}>{storageInfo.pendingFeedback}</Text>
            </View>
            <View style={styles.storageItem}>
              <Text style={styles.storageLabel}>Diagnostics en attente</Text>
              <Text style={styles.storageValue}>{storageInfo.pendingDiagnostics}</Text>
            </View>
            <View style={styles.storageItem}>
              <Text style={styles.storageLabel}>Historique en cache</Text>
              <Text style={styles.storageValue}>{storageInfo.cachedHistory}</Text>
            </View>
            <View style={styles.storageItem}>
              <Text style={styles.storageLabel}>Types d'équipements</Text>
              <Text style={styles.storageValue}>{storageInfo.equipmentTypes}</Text>
            </View>
          </View>
          <Button
            mode="contained"
            onPress={() => setShowStorageModal(false)}
            style={styles.modalButton}
          >
            Fermer
          </Button>
        </Modal>
      </Portal>

      {/* About Modal */}
      <Portal>
        <Modal
          visible={showAboutModal}
          onDismiss={() => setShowAboutModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>À Propos</Text>
          <View style={styles.aboutInfo}>
            <Text style={styles.aboutTitle}>SMDiagFix Mobile</Text>
            <Text style={styles.aboutVersion}>Version {appInfo.version} ({appInfo.buildNumber})</Text>
            <Text style={styles.aboutDescription}>
              Assistant intelligent pour le diagnostic et la maintenance d'équipements industriels
            </Text>
            <Divider style={styles.aboutDivider} />
            <Text style={styles.aboutDevice}>
              Appareil: {appInfo.deviceModel}{'\n'}
              Système: {appInfo.systemName} {appInfo.systemVersion}
            </Text>
          </View>
          <Button
            mode="contained"
            onPress={() => setShowAboutModal(false)}
            style={styles.modalButton}
          >
            Fermer
          </Button>
        </Modal>
      </Portal>
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
    paddingTop: spacing.xxl,
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
  content: {
    padding: spacing.md,
  },
  statusCard: {
    marginBottom: spacing.md,
    backgroundColor: theme.colors.surface,
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
    marginBottom: spacing.xs,
  },
  statusText: {
    ...typography.body2,
    fontWeight: '500',
  },
  statusActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pendingChip: {
    marginRight: spacing.sm,
    backgroundColor: theme.colors.warningContainer,
  },
  pendingText: {
    ...typography.body2,
    color: theme.colors.warning,
  },
  syncButton: {
    padding: spacing.sm,
  },
  settingsCard: {
    marginBottom: spacing.md,
  },
  debugText: {
    ...typography.body2,
    color: theme.colors.secondary,
    marginBottom: spacing.xs,
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: theme.roundness,
  },
  modalTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  modalInput: {
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  storageInfo: {
    marginBottom: spacing.md,
  },
  storageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  storageLabel: {
    ...typography.body1,
  },
  storageValue: {
    ...typography.body1,
    fontWeight: '500',
    color: theme.colors.primary,
  },
  aboutInfo: {
    marginBottom: spacing.md,
  },
  aboutTitle: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  aboutVersion: {
    ...typography.body2,
    textAlign: 'center',
    color: theme.colors.secondary,
    marginBottom: spacing.md,
  },
  aboutDescription: {
    ...typography.body1,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  aboutDivider: {
    marginVertical: spacing.md,
  },
  aboutDevice: {
    ...typography.body2,
    color: theme.colors.secondary,
    textAlign: 'center',
  },
});
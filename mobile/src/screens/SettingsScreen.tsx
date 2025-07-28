import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useOffline } from '../contexts/OfflineContext';
import { useNavigation } from '@react-navigation/native';

const SettingsScreen = () => {
  const { theme, isDark, toggleTheme } = useTheme();
  const { isOnline, isOfflineMode, setOfflineMode, syncData, pendingSyncCount, lastSyncTime } = useOffline();
  const navigation = useNavigation();

  const [notifications, setNotifications] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [savePhotos, setSavePhotos] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  const handleSync = async () => {
    try {
      await syncData();
      Alert.alert('Synchronisation', 'Les données ont été synchronisées avec succès.');
    } catch (error) {
      Alert.alert('Erreur', 'Échec de la synchronisation. Veuillez réessayer.');
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      'Vider le cache',
      'Êtes-vous sûr de vouloir vider le cache local ? Cette action supprimera toutes les données temporaires.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: () => Alert.alert('Info', 'Cache vidé avec succès.') },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      'Export des données',
      'Cette fonctionnalité permettra d\'exporter toutes vos données vers un fichier.',
      [{ text: 'OK' }]
    );
  };

  const handleResetSettings = () => {
    Alert.alert(
      'Réinitialiser les paramètres',
      'Êtes-vous sûr de vouloir remettre tous les paramètres à leur valeur par défaut ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: () => Alert.alert('Info', 'Paramètres réinitialisés.') },
      ]
    );
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
    section: {
      backgroundColor: theme.colors.surface,
      borderRadius: 15,
      padding: 20,
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 15,
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    settingItemLast: {
      borderBottomWidth: 0,
    },
    settingIcon: {
      marginRight: 15,
    },
    settingContent: {
      flex: 1,
    },
    settingTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.colors.text,
    },
    settingDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    settingAction: {
      marginLeft: 10,
    },
    syncStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderRadius: 10,
      marginTop: 10,
    },
    syncStatusText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginLeft: 8,
    },
    actionButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 20,
      alignItems: 'center',
      marginVertical: 5,
    },
    actionButtonSecondary: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionButtonDanger: {
      backgroundColor: '#ef4444',
    },
    actionButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '500',
    },
    actionButtonTextSecondary: {
      color: theme.colors.text,
    },
    infoCard: {
      backgroundColor: theme.colors.background,
      borderRadius: 10,
      padding: 15,
      marginTop: 10,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 5,
    },
    infoText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    storageInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    storageItem: {
      alignItems: 'center',
    },
    storageValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.primary,
    },
    storageLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
  });

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Jamais synchronisé';
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastSyncTime.getTime()) / 1000);
    
    if (diff < 60) return 'Il y a moins d\'une minute';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} minutes`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} heures`;
    return `Il y a ${Math.floor(diff / 86400)} jours`;
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e40af', '#3b82f6']}
        style={styles.headerGradient}
      >
        <Text style={styles.headerTitle}>Paramètres</Text>
        <Text style={styles.headerSubtitle}>Configuration et préférences</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Apparence */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Apparence</Text>
          
          <View style={styles.settingItem}>
            <Ionicons 
              name={isDark ? 'moon' : 'sunny'} 
              size={20} 
              color={theme.colors.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Mode sombre</Text>
              <Text style={styles.settingDescription}>
                Basculer entre le thème clair et sombre
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={isDark ? 'white' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Connectivité et données */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connectivité</Text>
          
          <View style={styles.settingItem}>
            <Ionicons 
              name={isOnline ? 'wifi' : 'wifi-off'} 
              size={20} 
              color={isOnline ? '#10b981' : '#ef4444'}
              style={styles.settingIcon}
            />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Mode hors ligne</Text>
              <Text style={styles.settingDescription}>
                Forcer le mode hors ligne même avec connexion
              </Text>
            </View>
            <Switch
              value={isOfflineMode}
              onValueChange={setOfflineMode}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={isOfflineMode ? 'white' : '#f4f3f4'}
            />
          </View>

          <View style={[styles.settingItem, styles.settingItemLast]}>
            <Ionicons 
              name="sync" 
              size={20} 
              color={theme.colors.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Synchronisation automatique</Text>
              <Text style={styles.settingDescription}>
                Synchroniser automatiquement quand en ligne
              </Text>
            </View>
            <Switch
              value={autoSync}
              onValueChange={setAutoSync}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={autoSync ? 'white' : '#f4f3f4'}
            />
          </View>

          <View style={styles.syncStatus}>
            <Ionicons 
              name={pendingSyncCount > 0 ? 'cloud-upload' : 'checkmark-circle'} 
              size={16} 
              color={pendingSyncCount > 0 ? '#f59e0b' : '#10b981'}
            />
            <Text style={styles.syncStatusText}>
              {pendingSyncCount > 0 
                ? `${pendingSyncCount} éléments en attente`
                : 'Toutes les données sont synchronisées'
              }
            </Text>
          </View>
          
          <Text style={[styles.syncStatusText, { marginTop: 5, marginLeft: 0 }]}>
            Dernière sync: {formatLastSync()}
          </Text>

          <TouchableOpacity
            style={[styles.actionButton, !isOnline && { opacity: 0.5 }]}
            onPress={handleSync}
            disabled={!isOnline}
          >
            <Text style={styles.actionButtonText}>Synchroniser maintenant</Text>
          </TouchableOpacity>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingItem}>
            <Ionicons 
              name="notifications" 
              size={20} 
              color={theme.colors.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Notifications push</Text>
              <Text style={styles.settingDescription}>
                Recevoir des notifications pour les diagnostics
              </Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={notifications ? 'white' : '#f4f3f4'}
            />
          </View>

          <View style={[styles.settingItem, styles.settingItemLast]}>
            <Ionicons 
              name="camera" 
              size={20} 
              color={theme.colors.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Sauvegarder les photos</Text>
              <Text style={styles.settingDescription}>
                Enregistrer automatiquement les photos prises
              </Text>
            </View>
            <Switch
              value={savePhotos}
              onValueChange={setSavePhotos}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={savePhotos ? 'white' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Stockage et données */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stockage</Text>
          
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Utilisation du stockage</Text>
            <View style={styles.storageInfo}>
              <View style={styles.storageItem}>
                <Text style={styles.storageValue}>12.5 MB</Text>
                <Text style={styles.storageLabel}>Diagnostics</Text>
              </View>
              <View style={styles.storageItem}>
                <Text style={styles.storageValue}>3.2 MB</Text>
                <Text style={styles.storageLabel}>Cache</Text>
              </View>
              <View style={styles.storageItem}>
                <Text style={styles.storageValue}>1.8 MB</Text>
                <Text style={styles.storageLabel}>Photos</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => navigation.navigate('OfflineData' as never)}
          >
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              Gérer les données hors ligne
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={handleExportData}
          >
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              Exporter les données
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={handleClearCache}
          >
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              Vider le cache
            </Text>
          </TouchableOpacity>
        </View>

        {/* Développement */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Développement</Text>
          
          <View style={styles.settingItem}>
            <Ionicons 
              name="bug" 
              size={20} 
              color={theme.colors.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Mode debug</Text>
              <Text style={styles.settingDescription}>
                Afficher les informations de débogage
              </Text>
            </View>
            <Switch
              value={debugMode}
              onValueChange={setDebugMode}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={debugMode ? 'white' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonDanger]}
            onPress={handleResetSettings}
          >
            <Text style={styles.actionButtonText}>Réinitialiser les paramètres</Text>
          </TouchableOpacity>
        </View>

        {/* À propos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>À propos</Text>
          
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Smart GMAO DiagFix Mobile</Text>
            <Text style={styles.infoText}>
              Version 1.0.0{'\n'}
              Application mobile de diagnostic intelligent pour la maintenance industrielle.
              {'\n\n'}
              Développé avec React Native et Expo.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;
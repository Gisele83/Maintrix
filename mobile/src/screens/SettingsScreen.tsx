import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Text, Switch, Button, Divider, Surface } from 'react-native-paper';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../providers/AuthProvider';

export default function SettingsScreen() {
  const theme = useTheme();
  const { user, logout } = useAuth();

  const [settings, setSettings] = useState({
    notifications: true,
    offlineMode: false,
    autoSync: true,
    soundEnabled: true,
    vibrationEnabled: true,
    darkMode: false,
  });

  const toggleSetting = (key: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de se déconnecter');
            }
          }
        }
      ]
    );
  };

  const clearCache = () => {
    Alert.alert(
      'Effacer le cache',
      'Cette action supprimera toutes les données mises en cache. Continuer ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          onPress: () => {
            // Clear cache logic here
            Alert.alert('Succès', 'Cache effacé');
          }
        }
      ]
    );
  };

  const settingSections = [
    {
      title: 'Notifications',
      items: [
        {
          key: 'notifications',
          title: 'Notifications push',
          subtitle: 'Recevoir les notifications de l\'app',
          icon: 'bell',
          type: 'switch'
        },
        {
          key: 'soundEnabled',
          title: 'Sons',
          subtitle: 'Sons de notification',
          icon: 'volume-high',
          type: 'switch'
        },
        {
          key: 'vibrationEnabled',
          title: 'Vibrations',
          subtitle: 'Vibrations pour les alertes',
          icon: 'vibrate',
          type: 'switch'
        }
      ]
    },
    {
      title: 'Synchronisation',
      items: [
        {
          key: 'offlineMode',
          title: 'Mode hors ligne',
          subtitle: 'Fonctionner uniquement avec les données locales',
          icon: 'wifi-off',
          type: 'switch'
        },
        {
          key: 'autoSync',
          title: 'Synchronisation automatique',
          subtitle: 'Synchroniser automatiquement quand connecté',
          icon: 'sync',
          type: 'switch'
        }
      ]
    },
    {
      title: 'Interface',
      items: [
        {
          key: 'darkMode',
          title: 'Mode sombre',
          subtitle: 'Interface sombre (bientôt disponible)',
          icon: 'theme-light-dark',
          type: 'switch',
          disabled: true
        }
      ]
    }
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* User Profile */}
        <Card style={styles.profileCard}>
          <Card.Content>
            <View style={styles.profileHeader}>
              <View style={styles.profileAvatar}>
                <Icon name="account" size={48} color={theme.colors.onPrimary} />
              </View>
              <View style={styles.profileInfo}>
                <Text variant="headlineSmall" style={styles.profileName}>
                  {user?.name || 'Utilisateur'}
                </Text>
                <Text variant="bodyMedium" style={styles.profileEmail}>
                  {user?.email || 'utilisateur@email.com'}
                </Text>
                <Text variant="bodySmall" style={styles.profileRole}>
                  {user?.role === 'technician' ? 'Technicien' : 'Utilisateur'} • {user?.department || 'Maintenance'}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Settings Sections */}
        {settingSections.map((section, sectionIndex) => (
          <Card key={sectionIndex} style={styles.settingsCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                {section.title}
              </Text>
              
              {section.items.map((item, itemIndex) => (
                <View key={item.key}>
                  <View style={styles.settingItem}>
                    <View style={styles.settingInfo}>
                      <Icon 
                        name={item.icon} 
                        size={24} 
                        color={item.disabled ? theme.colors.outline : theme.colors.primary} 
                      />
                      <View style={styles.settingText}>
                        <Text 
                          variant="bodyLarge" 
                          style={[
                            styles.settingTitle,
                            { color: item.disabled ? theme.colors.outline : theme.colors.onSurface }
                          ]}
                        >
                          {item.title}
                        </Text>
                        <Text 
                          variant="bodySmall" 
                          style={[
                            styles.settingSubtitle,
                            { color: item.disabled ? theme.colors.outline : theme.colors.onSurfaceVariant }
                          ]}
                        >
                          {item.subtitle}
                        </Text>
                      </View>
                    </View>
                    
                    {item.type === 'switch' && (
                      <Switch
                        value={settings[item.key]}
                        onValueChange={() => toggleSetting(item.key)}
                        disabled={item.disabled}
                      />
                    )}
                  </View>
                  {itemIndex < section.items.length - 1 && <Divider style={styles.divider} />}
                </View>
              ))}
            </Card.Content>
          </Card>
        ))}

        {/* App Info */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Informations
            </Text>
            
            <View style={styles.infoItem}>
              <Icon name="information" size={20} color={theme.colors.primary} />
              <View style={styles.infoText}>
                <Text variant="bodyMedium" style={styles.infoTitle}>
                  Version de l'application
                </Text>
                <Text variant="bodySmall" style={styles.infoValue}>
                  1.0.0 (Build 100)
                </Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <Icon name="server" size={20} color={theme.colors.primary} />
              <View style={styles.infoText}>
                <Text variant="bodyMedium" style={styles.infoTitle}>
                  Version du serveur
                </Text>
                <Text variant="bodySmall" style={styles.infoValue}>
                  API v2.1.0
                </Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <Icon name="database" size={20} color={theme.colors.primary} />
              <View style={styles.infoText}>
                <Text variant="bodyMedium" style={styles.infoTitle}>
                  Base de données locale
                </Text>
                <Text variant="bodySmall" style={styles.infoValue}>
                  SQLite 3.39.0
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Actions */}
        <Card style={styles.actionsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Actions
            </Text>
            
            <View style={styles.actionsList}>
              <Button
                mode="outlined"
                onPress={() => Alert.alert('Support', 'Contactez support@smartgmao.com pour obtenir de l\'aide')}
                style={styles.actionButton}
                icon="help-circle"
              >
                Contacter le support
              </Button>
              
              <Button
                mode="outlined"
                onPress={clearCache}
                style={styles.actionButton}
                icon="delete-sweep"
              >
                Effacer le cache
              </Button>
              
              <Button
                mode="outlined"
                onPress={() => Alert.alert('À propos', 'Maintrix Mobile\nVersion 1.0.0\n\nDéveloppé pour optimiser la maintenance industrielle')}
                style={styles.actionButton}
                icon="information-outline"
              >
                À propos
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Logout */}
        <Surface style={styles.logoutCard}>
          <Button
            mode="contained"
            onPress={handleLogout}
            style={[styles.logoutButton, { backgroundColor: theme.colors.error }]}
            textColor={theme.colors.onError}
            icon="logout"
          >
            Se déconnecter
          </Button>
        </Surface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  profileCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontWeight: 'bold',
  },
  profileEmail: {
    opacity: 0.8,
    marginTop: 2,
  },
  profileRole: {
    opacity: 0.6,
    marginTop: 4,
  },
  settingsCard: {
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 16,
    flex: 1,
  },
  settingTitle: {
    fontWeight: '500',
  },
  settingSubtitle: {
    opacity: 0.7,
    marginTop: 2,
  },
  divider: {
    marginVertical: 8,
  },
  infoCard: {
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoText: {
    marginLeft: 12,
    flex: 1,
  },
  infoTitle: {
    fontWeight: '500',
  },
  infoValue: {
    opacity: 0.7,
    marginTop: 2,
  },
  actionsCard: {
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
  },
  actionsList: {
    gap: 12,
  },
  actionButton: {
    borderRadius: 8,
  },
  logoutCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  logoutButton: {
    borderRadius: 8,
  },
});
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Text, Switch, Button, Divider, Surface, Chip } from 'react-native-paper';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../providers/AuthProvider';
import { useLicense } from '../providers/LicenseProvider';

export default function SettingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();
  const { license, isLoading: licenseLoading, refreshLicense } = useLicense();

  const [settings, setSettings] = useState({
    notifications: true,
    offlineMode: false,
    autoSync: true,
    soundEnabled: true,
    vibrationEnabled: true,
    darkMode: false,
  });

  const toggleSetting = (key: string) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Êtes-vous sûr de vouloir vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter',
        style: 'destructive',
        onPress: async () => {
          try { await logout(); }
          catch { Alert.alert('Erreur', 'Impossible de se déconnecter'); }
        },
      },
    ]);
  };

  const clearCache = () => {
    Alert.alert('Effacer le cache', 'Supprimer toutes les données mises en cache ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', onPress: () => Alert.alert('Succès', 'Cache effacé') },
    ]);
  };

  const getLicenseStatusColor = () => {
    switch (license.status) {
      case 'active':  return '#16a34a';
      case 'trial':   return '#2563eb';
      case 'grace':   return '#d97706';
      case 'expired': return '#dc2626';
      default:        return theme.colors.outline;
    }
  };

  const getLicenseStatusLabel = () => {
    switch (license.status) {
      case 'active':    return 'Actif';
      case 'trial':     return `Essai — ${license.trialDaysRemaining}j restant(s)`;
      case 'grace':     return `Grâce offline — ${license.gracePeriodDaysRemaining}j`;
      case 'expired':   return 'Expiré';
      case 'suspended': return 'Suspendu';
      default:          return 'Inconnu';
    }
  };

  const getLicenseIcon = () => {
    switch (license.status) {
      case 'active':  return 'check-circle';
      case 'trial':   return 'clock-outline';
      case 'grace':   return 'wifi-off';
      case 'expired': return 'alert-circle';
      default:        return 'help-circle';
    }
  };

  const settingSections = [
    {
      title: 'Notifications',
      items: [
        { key: 'notifications', title: 'Notifications push', subtitle: "Recevoir les alertes de l'app", icon: 'bell', type: 'switch' },
        { key: 'soundEnabled', title: 'Sons', subtitle: 'Sons de notification', icon: 'volume-high', type: 'switch' },
        { key: 'vibrationEnabled', title: 'Vibrations', subtitle: 'Vibrations pour les alertes', icon: 'vibrate', type: 'switch' },
      ],
    },
    {
      title: 'Synchronisation',
      items: [
        { key: 'offlineMode', title: 'Mode hors ligne', subtitle: 'Fonctionner avec les données locales', icon: 'wifi-off', type: 'switch' },
        { key: 'autoSync', title: 'Synchronisation auto', subtitle: 'Synchroniser quand connecté', icon: 'sync', type: 'switch' },
      ],
    },
    {
      title: 'Interface',
      items: [
        { key: 'darkMode', title: 'Mode sombre', subtitle: 'Bientôt disponible', icon: 'theme-light-dark', type: 'switch', disabled: true },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* User Profile */}
        <Card style={styles.profileCard}>
          <Card.Content>
            <View style={styles.profileHeader}>
              <View style={[styles.profileAvatar, { backgroundColor: '#6366f1' }]}>
                <Icon name="account" size={36} color="#fff" />
              </View>
              <View style={styles.profileInfo}>
                <Text variant="titleLarge" style={styles.profileName}>
                  {user?.name || 'Utilisateur'}
                </Text>
                <Text variant="bodySmall" style={styles.profileEmail}>
                  {user?.email || '—'}
                </Text>
                <View style={styles.roleRow}>
                  <Chip compact style={styles.roleChip} textStyle={styles.roleChipText}>
                    {user?.role === 'admin' ? 'Administrateur' : user?.role === 'technician' ? 'Technicien' : (user?.role || 'Utilisateur')}
                  </Chip>
                </View>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* ── LICENCE SECTION ── */}
        <Card style={[styles.licenseCard, { borderColor: getLicenseStatusColor(), borderWidth: 1.5 }]}>
          <Card.Content>
            <View style={styles.licenseTitleRow}>
              <Icon name="shield-key" size={20} color="#6366f1" />
              <Text variant="titleMedium" style={[styles.sectionTitle, { marginLeft: 8, marginBottom: 0 }]}>
                Licence & Abonnement
              </Text>
            </View>

            {licenseLoading ? (
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                Vérification…
              </Text>
            ) : (
              <>
                <View style={styles.licenseStatusRow}>
                  <Icon name={getLicenseIcon()} size={18} color={getLicenseStatusColor()} />
                  <Text variant="bodyMedium" style={[styles.licenseStatusText, { color: getLicenseStatusColor() }]}>
                    {getLicenseStatusLabel()}
                  </Text>
                </View>

                {license.isTrialActive && license.trialEndDate && (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                    Essai jusqu'au {new Date(license.trialEndDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                  </Text>
                )}

                {license.isGracePeriodActive && (
                  <View style={[styles.graceBanner, { backgroundColor: '#fef3c7' }]}>
                    <Icon name="wifi-off" size={14} color="#d97706" />
                    <Text variant="bodySmall" style={{ color: '#92400e', marginLeft: 6 }}>
                      Grâce offline — {license.gracePeriodDaysRemaining} jour(s) restant(s)
                    </Text>
                  </View>
                )}

                {license.warningMessage && license.status !== 'grace' && (
                  <Text variant="bodySmall" style={{ color: getLicenseStatusColor(), marginTop: 8 }}>
                    {license.warningMessage}
                  </Text>
                )}

                <View style={styles.licenseActions}>
                  <Button
                    mode="outlined"
                    onPress={refreshLicense}
                    compact
                    icon="refresh"
                    style={styles.licenseBtn}
                  >
                    Actualiser
                  </Button>
                  <Button
                    mode="contained"
                    onPress={() => navigation.navigate('LicenseActivation')}
                    compact
                    icon="key"
                    style={[styles.licenseBtn, { backgroundColor: '#6366f1' }]}
                  >
                    Gérer
                  </Button>
                </View>
              </>
            )}
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
                        size={22}
                        color={(item as any).disabled ? theme.colors.outline : '#6366f1'}
                      />
                      <View style={styles.settingText}>
                        <Text
                          variant="bodyLarge"
                          style={[styles.settingTitle, { color: (item as any).disabled ? theme.colors.outline : theme.colors.onSurface }]}
                        >
                          {item.title}
                        </Text>
                        <Text
                          variant="bodySmall"
                          style={[styles.settingSubtitle, { color: (item as any).disabled ? theme.colors.outline : theme.colors.onSurfaceVariant }]}
                        >
                          {item.subtitle}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={settings[item.key as keyof typeof settings]}
                      onValueChange={() => toggleSetting(item.key)}
                      disabled={(item as any).disabled}
                      color="#6366f1"
                    />
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
            {[
              { icon: 'information', label: "Version de l'application", value: '2.0.0 (Build 200)' },
              { icon: 'server', label: 'API serveur', value: 'v2.1.0' },
              { icon: 'database', label: 'Base locale', value: 'SQLite 3.39.0' },
              { icon: 'shield-check', label: 'Plan', value: license.plan?.charAt(0).toUpperCase() + license.plan?.slice(1) || '—' },
            ].map((info, i) => (
              <View key={i} style={styles.infoItem}>
                <Icon name={info.icon} size={18} color="#6366f1" />
                <View style={styles.infoText}>
                  <Text variant="bodyMedium" style={styles.infoTitle}>{info.label}</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{info.value}</Text>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Actions */}
        <Card style={styles.actionsCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Actions</Text>
            <View style={styles.actionsList}>
              <Button mode="outlined" icon="help-circle" style={styles.actionButton}
                onPress={() => Alert.alert('Support', 'Contactez support@maintrix.app pour obtenir de l\'aide')}>
                Contacter le support
              </Button>
              <Button mode="outlined" icon="delete-sweep" style={styles.actionButton} onPress={clearCache}>
                Effacer le cache
              </Button>
              <Button mode="outlined" icon="information-outline" style={styles.actionButton}
                onPress={() => Alert.alert('À propos', 'Maintrix Mobile v2.0.0\n\nSupervision industrielle adaptative\nGMAO • Diagnostic IA • Contrôle temps réel\n\n© 2025 Maintrix SAS')}>
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
  container: { flex: 1, padding: 16 },
  profileCard: { marginBottom: 16, borderRadius: 12, elevation: 3 },
  profileHeader: { flexDirection: 'row', alignItems: 'center' },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  profileInfo: { marginLeft: 16, flex: 1 },
  profileName: { fontWeight: 'bold' },
  profileEmail: { opacity: 0.7, marginTop: 2 },
  roleRow: { flexDirection: 'row', marginTop: 6 },
  roleChip: { backgroundColor: '#ede9fe', height: 24 },
  roleChipText: { color: '#6366f1', fontSize: 11 },
  licenseCard: { marginBottom: 16, borderRadius: 12, elevation: 2 },
  licenseTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  licenseStatusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  licenseStatusText: { fontWeight: '600', marginLeft: 6 },
  graceBanner: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 6, marginTop: 8 },
  licenseActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  licenseBtn: { flex: 1, borderRadius: 8 },
  settingsCard: { marginBottom: 16, borderRadius: 8, elevation: 2 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 12 },
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  settingInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  settingText: { marginLeft: 14, flex: 1 },
  settingTitle: { fontWeight: '500' },
  settingSubtitle: { opacity: 0.7, marginTop: 2 },
  divider: { marginVertical: 6 },
  infoCard: { marginBottom: 16, borderRadius: 8, elevation: 2 },
  infoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  infoText: { marginLeft: 12, flex: 1 },
  infoTitle: { fontWeight: '500' },
  actionsCard: { marginBottom: 16, borderRadius: 8, elevation: 2 },
  actionsList: { gap: 10 },
  actionButton: { borderRadius: 8 },
  logoutCard: { padding: 16, borderRadius: 8, marginBottom: 24 },
  logoutButton: { borderRadius: 8 },
});

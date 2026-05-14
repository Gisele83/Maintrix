import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput as RNTextInput,
  Linking,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  Surface,
  ActivityIndicator,
  Chip,
  ProgressBar,
  Divider,
} from 'react-native-paper';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useLicense, LicenseStatus } from '../providers/LicenseProvider';

interface StatusConfig {
  color: string;
  bg: string;
  icon: string;
  label: string;
  canContinue: boolean;
}

function getStatusConfig(status: LicenseStatus, theme: any): StatusConfig {
  switch (status) {
    case 'active':
      return { color: '#16a34a', bg: '#dcfce7', icon: 'check-circle', label: 'Actif', canContinue: true };
    case 'trial':
      return { color: '#2563eb', bg: '#dbeafe', icon: 'clock-outline', label: 'Essai gratuit', canContinue: true };
    case 'grace':
      return { color: '#d97706', bg: '#fef3c7', icon: 'wifi-off', label: 'Grâce offline', canContinue: true };
    case 'expired':
      return { color: '#dc2626', bg: '#fee2e2', icon: 'alert-circle', label: 'Expiré', canContinue: false };
    case 'suspended':
      return { color: '#6b7280', bg: '#f3f4f6', icon: 'pause-circle', label: 'Suspendu', canContinue: false };
    default:
      return { color: '#6b7280', bg: '#f3f4f6', icon: 'help-circle', label: 'Inconnu', canContinue: false };
  }
}

interface Plan {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'pro',
    name: 'Pro',
    price: '49€/mois',
    description: 'Techniciens indépendants & petites équipes',
    features: ['Smart Diagnostic IA', 'GMAO complète', 'Export PDF/CSV', '5 utilisateurs'],
    highlighted: false,
  },
  {
    id: 'business',
    name: 'Business',
    price: '149€/mois',
    description: 'Équipes de maintenance industrielle',
    features: ['Tout le plan Pro', 'IoT / MQTT', 'API ERP (SAP)', 'Multi-sites', '20 utilisateurs'],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Entreprise',
    price: '399€/mois',
    description: 'Grandes organisations multi-sites',
    features: ['Tout Business', 'SLA 99.9%', 'Support 24/7', 'Illimité', 'White-label'],
    highlighted: false,
  },
];

export default function LicenseActivationScreen({ navigation }: any) {
  const theme = useTheme();
  const { license, isLoading, refreshLicense, activateLicense, startTrial } = useLicense();

  const [licenseKey, setLicenseKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'activate' | 'plans'>('status');

  const statusConfig = getStatusConfig(license.status, theme);

  const trialProgress =
    license.isTrialActive && license.trialDaysRemaining > 0
      ? Math.max(0, 1 - license.trialDaysRemaining / 30)
      : license.status === 'trial' ? 1 : 0;

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir une clé de licence valide');
      return;
    }
    setIsActivating(true);
    const result = await activateLicense(licenseKey.trim());
    setIsActivating(false);
    if (result.success) {
      Alert.alert('Succès', result.message, [
        { text: 'OK', onPress: () => navigation?.goBack?.() },
      ]);
    } else {
      Alert.alert('Échec', result.message);
    }
  };

  const handleStartTrial = async () => {
    setIsStartingTrial(true);
    const result = await startTrial();
    setIsStartingTrial(false);
    Alert.alert(result.success ? 'Essai démarré' : 'Information', result.message);
  };

  const handleContinue = () => {
    if (license.canOperate) {
      navigation?.goBack?.();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <Surface style={styles.header} elevation={2}>
        <View style={styles.headerContent}>
          <View style={styles.headerBrand}>
            <Icon name="shield-key" size={32} color="#6366f1" />
            <View style={styles.headerTextBlock}>
              <Text variant="titleLarge" style={styles.headerTitle}>
                Licence Maintrix
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Gestion de votre abonnement
              </Text>
            </View>
          </View>
          {license.canOperate && (
            <Button mode="text" onPress={handleContinue} compact>
              Fermer
            </Button>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['status', 'activate', 'plans'] as const).map((tab) => (
            <Button
              key={tab}
              mode={activeTab === tab ? 'contained' : 'text'}
              onPress={() => setActiveTab(tab)}
              compact
              style={styles.tabBtn}
              contentStyle={styles.tabBtnContent}
            >
              {tab === 'status' ? 'Statut' : tab === 'activate' ? 'Activer' : 'Plans'}
            </Button>
          ))}
        </View>
      </Surface>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── TAB: STATUS ── */}
        {activeTab === 'status' && (
          <View style={styles.section}>
            {/* License Status Badge */}
            <Surface style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]} elevation={0}>
              <Icon name={statusConfig.icon} size={48} color={statusConfig.color} />
              <Text variant="headlineMedium" style={[styles.statusLabel, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
              {license.warningMessage && (
                <Text variant="bodySmall" style={[styles.warningText, { color: statusConfig.color }]}>
                  {license.warningMessage}
                </Text>
              )}
            </Surface>

            {/* Trial Progress */}
            {license.isTrialActive && (
              <Card style={styles.card}>
                <Card.Content>
                  <View style={styles.trialHeader}>
                    <Icon name="clock-fast" size={20} color="#2563eb" />
                    <Text variant="titleMedium" style={styles.cardTitle}>
                      Essai gratuit 30 jours
                    </Text>
                  </View>
                  <View style={styles.daysRow}>
                    <Text variant="displaySmall" style={{ color: '#2563eb', fontWeight: 'bold' }}>
                      {license.trialDaysRemaining}
                    </Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8, alignSelf: 'flex-end', marginBottom: 4 }}>
                      jour(s) restant(s)
                    </Text>
                  </View>
                  <ProgressBar
                    progress={trialProgress}
                    color={license.trialDaysRemaining <= 3 ? '#dc2626' : license.trialDaysRemaining <= 7 ? '#d97706' : '#2563eb'}
                    style={styles.progressBar}
                  />
                  {license.trialEndDate && (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
                      Expire le {new Date(license.trialEndDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                  )}
                </Card.Content>
              </Card>
            )}

            {/* Grace Period */}
            {license.isGracePeriodActive && (
              <Card style={[styles.card, { borderColor: '#d97706', borderWidth: 1 }]}>
                <Card.Content>
                  <View style={styles.trialHeader}>
                    <Icon name="wifi-off" size={20} color="#d97706" />
                    <Text variant="titleMedium" style={[styles.cardTitle, { color: '#d97706' }]}>
                      Période de grâce offline
                    </Text>
                  </View>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                    {license.gracePeriodDaysRemaining} jour(s) — reconnectez-vous pour revalider
                  </Text>
                  {license.gracePeriodEnd && (
                    <Text variant="bodySmall" style={{ color: '#d97706', marginTop: 8 }}>
                      Expire le {new Date(license.gracePeriodEnd).toLocaleDateString('fr-FR')}
                    </Text>
                  )}
                </Card.Content>
              </Card>
            )}

            {/* Plan Info */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.trialHeader}>
                  <Icon name="crown" size={20} color="#6366f1" />
                  <Text variant="titleMedium" style={styles.cardTitle}>
                    Plan actuel
                  </Text>
                </View>
                <Chip
                  icon="star"
                  style={[styles.planChip, { backgroundColor: '#ede9fe' }]}
                  textStyle={{ color: '#6366f1', fontWeight: 'bold' }}
                >
                  {license.plan.charAt(0).toUpperCase() + license.plan.slice(1)}
                </Chip>
              </Card.Content>
            </Card>

            {/* Start Trial (if not started) */}
            {license.status === 'unknown' || license.status === 'expired' ? (
              <Card style={styles.card}>
                <Card.Content>
                  <Text variant="titleMedium" style={styles.cardTitle}>
                    Démarrer l'essai gratuit
                  </Text>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
                    Accédez à toutes les fonctionnalités pendant 30 jours, sans carte bancaire.
                  </Text>
                  <Button
                    mode="contained"
                    onPress={handleStartTrial}
                    loading={isStartingTrial}
                    disabled={isStartingTrial}
                    icon="rocket-launch"
                    style={{ borderRadius: 8 }}
                  >
                    Démarrer l'essai 30 jours
                  </Button>
                </Card.Content>
              </Card>
            ) : null}

            {/* Actions */}
            <View style={styles.actionsRow}>
              <Button
                mode="outlined"
                onPress={refreshLicense}
                loading={isLoading}
                icon="refresh"
                style={styles.actionBtn}
              >
                Actualiser
              </Button>
              <Button
                mode="contained"
                onPress={() => setActiveTab('activate')}
                icon="key"
                style={[styles.actionBtn, { backgroundColor: '#6366f1' }]}
              >
                Activer clé
              </Button>
            </View>
          </View>
        )}

        {/* ── TAB: ACTIVATE ── */}
        {activeTab === 'activate' && (
          <View style={styles.section}>
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.trialHeader}>
                  <Icon name="key-variant" size={24} color="#6366f1" />
                  <Text variant="titleLarge" style={styles.cardTitle}>
                    Activer une licence
                  </Text>
                </View>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 20 }}>
                  Saisissez votre clé de licence reçue après votre souscription.
                </Text>

                <Text variant="labelMedium" style={styles.inputLabel}>
                  Clé de licence
                </Text>
                <RNTextInput
                  style={[styles.keyInput, {
                    borderColor: theme.colors.outline,
                    color: theme.colors.onSurface,
                    backgroundColor: theme.colors.surfaceVariant,
                  }]}
                  value={licenseKey}
                  onChangeText={setLicenseKey}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  placeholderTextColor={theme.colors.onSurfaceVariant}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  multiline={false}
                />

                <Button
                  mode="contained"
                  onPress={handleActivate}
                  loading={isActivating}
                  disabled={isActivating || !licenseKey.trim()}
                  icon="check-circle"
                  style={[styles.activateBtn, { backgroundColor: '#6366f1' }]}
                  contentStyle={{ paddingVertical: 4 }}
                >
                  Activer la licence
                </Button>
              </Card.Content>
            </Card>

            <Divider style={styles.divider} />

            {/* Trial option */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Pas encore de licence ?
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
                  Démarrez votre essai gratuit de 30 jours sans engagement.
                </Text>
                <Button
                  mode="outlined"
                  onPress={handleStartTrial}
                  loading={isStartingTrial}
                  icon="rocket-launch"
                  style={{ borderRadius: 8 }}
                >
                  Essai gratuit 30 jours
                </Button>
              </Card.Content>
            </Card>

            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.cardTitle}>
                  Acheter une licence
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
                  Consultez nos offres sur le portail web Maintrix.
                </Text>
                <Button
                  mode="outlined"
                  onPress={() => Linking.openURL('https://maintrix.app/subscription')}
                  icon="open-in-new"
                  style={{ borderRadius: 8 }}
                >
                  Voir les offres en ligne
                </Button>
              </Card.Content>
            </Card>
          </View>
        )}

        {/* ── TAB: PLANS ── */}
        {activeTab === 'plans' && (
          <View style={styles.section}>
            <Text variant="headlineSmall" style={styles.plansTitle}>
              Choisissez votre plan
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 20, textAlign: 'center' }}>
              Tous les plans incluent l'essai gratuit 30 jours
            </Text>

            {PLANS.map((plan) => (
              <Card
                key={plan.id}
                style={[
                  styles.planCard,
                  plan.highlighted && { borderColor: '#6366f1', borderWidth: 2 },
                ]}
              >
                {plan.highlighted && (
                  <View style={styles.popularBadge}>
                    <Text variant="labelSmall" style={styles.popularText}>
                      POPULAIRE
                    </Text>
                  </View>
                )}
                <Card.Content style={{ paddingTop: plan.highlighted ? 24 : 16 }}>
                  <View style={styles.planHeader}>
                    <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: plan.highlighted ? '#6366f1' : theme.colors.onSurface }}>
                      {plan.name}
                    </Text>
                    <Text variant="titleMedium" style={{ color: plan.highlighted ? '#6366f1' : theme.colors.onSurface, fontWeight: 'bold' }}>
                      {plan.price}
                    </Text>
                  </View>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}>
                    {plan.description}
                  </Text>
                  {plan.features.map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      <Icon name="check" size={16} color="#16a34a" />
                      <Text variant="bodySmall" style={styles.featureText}>
                        {f}
                      </Text>
                    </View>
                  ))}
                  <Button
                    mode={plan.highlighted ? 'contained' : 'outlined'}
                    onPress={() => Linking.openURL('https://maintrix.app/subscription')}
                    style={[
                      styles.planBtn,
                      plan.highlighted && { backgroundColor: '#6366f1' },
                    ]}
                    icon="arrow-right"
                    contentStyle={{ flexDirection: 'row-reverse' }}
                  >
                    Choisir {plan.name}
                  </Button>
                </Card.Content>
              </Card>
            ))}

            <Card style={[styles.card, { backgroundColor: '#f0fdf4' }]}>
              <Card.Content>
                <View style={styles.trialHeader}>
                  <Icon name="information" size={20} color="#16a34a" />
                  <Text variant="titleSmall" style={{ color: '#16a34a', marginLeft: 8 }}>
                    Inclus dans tous les plans
                  </Text>
                </View>
                {['Essai gratuit 30 jours', 'Grâce offline 7 jours', 'Mises à jour OTA', 'Données chiffrées'].map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Icon name="check-circle" size={14} color="#16a34a" />
                    <Text variant="bodySmall" style={[styles.featureText, { color: '#15803d' }]}>{f}</Text>
                  </View>
                ))}
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Expired warning */}
        {!license.canOperate && license.status !== 'unknown' && (
          <Surface style={styles.expiredBanner} elevation={0}>
            <Icon name="lock" size={24} color='#dc2626' />
            <Text variant="bodyMedium" style={styles.expiredText}>
              Accès suspendu — activez ou renouvelez votre licence pour continuer.
            </Text>
          </Surface>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text variant="bodyMedium" style={{ marginTop: 12, color: '#6366f1' }}>
            Vérification de la licence...
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 16,
    paddingBottom: 0,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center' },
  headerTextBlock: { marginLeft: 12 },
  headerTitle: { fontWeight: 'bold' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabBtn: { flex: 1, borderRadius: 0 },
  tabBtnContent: { paddingVertical: 4 },
  scroll: { flex: 1 },
  section: { padding: 16 },
  statusBadge: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 16,
    marginBottom: 16,
  },
  statusLabel: { fontWeight: 'bold', marginTop: 12 },
  warningText: { textAlign: 'center', marginTop: 8, opacity: 0.8 },
  card: { marginBottom: 16, borderRadius: 12, elevation: 2 },
  trialHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontWeight: 'bold', marginLeft: 8 },
  daysRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  progressBar: { height: 8, borderRadius: 4 },
  planChip: { alignSelf: 'flex-start', marginTop: 8 },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  actionBtn: { flex: 1, borderRadius: 8 },
  inputLabel: { marginBottom: 8, fontWeight: '600' },
  keyInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'monospace',
    letterSpacing: 2,
    marginBottom: 16,
  },
  activateBtn: { borderRadius: 8 },
  divider: { marginVertical: 16 },
  plansTitle: { fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  planCard: { marginBottom: 16, borderRadius: 12, elevation: 2 },
  popularBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#6366f1',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingVertical: 4,
    alignItems: 'center',
  },
  popularText: { color: '#fff', fontWeight: 'bold', letterSpacing: 1 },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  featureText: { marginLeft: 8 },
  planBtn: { marginTop: 16, borderRadius: 8 },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  expiredText: { flex: 1, marginLeft: 12, color: '#991b1b' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

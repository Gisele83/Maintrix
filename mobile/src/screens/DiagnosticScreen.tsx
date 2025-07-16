import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import {
  Button,
  Card,
  TextInput,
  Checkbox,
  RadioButton,
  Portal,
  Modal,
  ActivityIndicator,
  Chip,
  Surface,
  Divider,
} from 'react-native-paper';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { apiService, DiagnosticRequest, DiagnosticSuggestion } from '../services/ApiService';
import { useOffline } from '../context/OfflineContext';
import { theme, spacing, typography, gradients } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type DiagnosticScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'>;

interface DiagnosticFormData {
  equipmentType: string;
  symptoms: string;
  symptomsChecked: string[];
  urgency: 'low' | 'medium' | 'high';
  zone: string;
  sector: string;
  equipmentId: string;
  advancedMode: boolean;
  enhancedMode: boolean;
  ensembleMode: boolean;
}

const equipmentTypes = [
  'moteur', 'pompe', 'compresseur', 'ventilateur', 'transformateur',
  'variateur', 'convertisseur', 'onduleur', 'ups', 'redresseur',
  'sts', 'rtg', 'mobile_crane', 'reach_stacker', 'straddle_carrier', 'spreader'
];

const commonSymptoms = [
  'Vibrations anormales', 'Surchauffe', 'Bruit inhabituel', 'Fuite d\'huile',
  'Dysfonctionnement électrique', 'Perte de puissance', 'Arrêt inopiné',
  'Problème de démarrage', 'Consommation excessive', 'Odeur de brûlé'
];

const zones = [
  'Atelier Production', 'Zone Stockage', 'Salle Machines', 'Terminal Container',
  'Quai Chargement', 'Centrale Énergie', 'Traitement Eau', 'Air Comprimé',
  'Laboratoire', 'Maintenance', 'Bureaux', 'Extérieur', 'Sous-sol', 'Toiture'
];

const sectors = [
  'Ligne 1', 'Ligne 2', 'Ligne 3', 'Atelier Mécanique', 'Atelier Électrique',
  'Poste 1', 'Poste 2', 'Poste 3', 'Armoire A', 'Armoire B', 'Armoire C',
  'Grue 1', 'Grue 2', 'Convoyeur 1', 'Convoyeur 2', 'Station Pompage',
  'Compresseur Principal', 'Groupe Froid'
];

export function DiagnosticScreen() {
  const navigation = useNavigation<DiagnosticScreenNavigationProp>();
  const { isOnline, syncPending } = useOffline();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<DiagnosticFormData>({
    equipmentType: '',
    symptoms: '',
    symptomsChecked: [],
    urgency: 'medium',
    zone: '',
    sector: '',
    equipmentId: '',
    advancedMode: false,
    enhancedMode: false,
    ensembleMode: false,
  });

  const [showResults, setShowResults] = useState(false);
  const [suggestions, setSuggestions] = useState<DiagnosticSuggestion[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [showSymptomsModal, setShowSymptomsModal] = useState(false);

  // Diagnostic mutation
  const diagnosticMutation = useMutation({
    mutationFn: async (request: DiagnosticRequest) => {
      return await apiService.getDiagnostic(request);
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions || []);
      setSessionId(data.sessionId);
      setShowResults(true);
    },
    onError: (error) => {
      Alert.alert(
        'Erreur Diagnostic',
        isOnline ? 'Erreur lors du diagnostic' : 'Diagnostic hors-ligne indisponible',
        [{ text: 'OK' }]
      );
    },
  });

  const handleSubmit = () => {
    if (!formData.equipmentType || !formData.symptoms) {
      Alert.alert(
        'Champs manquants',
        'Veuillez sélectionner un équipement et décrire les symptômes',
        [{ text: 'OK' }]
      );
      return;
    }

    const request: DiagnosticRequest = {
      equipmentType: formData.equipmentType,
      symptoms: formData.symptoms,
      symptomsChecked: formData.symptomsChecked,
      urgency: formData.urgency,
      zone: formData.zone,
      sector: formData.sector,
      equipmentId: formData.equipmentId,
      advancedMode: formData.advancedMode,
      enhancedMode: formData.enhancedMode,
      ensembleMode: formData.ensembleMode,
    };

    diagnosticMutation.mutate(request);
  };

  const handleSymptomToggle = (symptom: string) => {
    const newSymptoms = formData.symptomsChecked.includes(symptom)
      ? formData.symptomsChecked.filter(s => s !== symptom)
      : [...formData.symptomsChecked, symptom];
    
    setFormData(prev => ({ ...prev, symptomsChecked: newSymptoms }));
  };

  const handleStartRepair = (suggestion: DiagnosticSuggestion) => {
    navigation.navigate('RepairGuidance', {
      caseId: suggestion.id,
      diagnosis: suggestion.diagnosis,
    });
  };

  const handleFeedback = (suggestion: DiagnosticSuggestion) => {
    if (sessionId) {
      navigation.navigate('Feedback', {
        sessionId,
        diagnosis: suggestion.diagnosis,
        solution: suggestion.solution,
      });
    }
  };

  const resetForm = () => {
    setFormData({
      equipmentType: '',
      symptoms: '',
      symptomsChecked: [],
      urgency: 'medium',
      zone: '',
      sector: '',
      equipmentId: '',
      advancedMode: false,
      enhancedMode: false,
      ensembleMode: false,
    });
    setShowResults(false);
    setSuggestions([]);
    setSessionId(null);
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return theme.colors.error;
      case 'medium': return theme.colors.warning;
      case 'low': return theme.colors.success;
      default: return theme.colors.secondary;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return theme.colors.success;
    if (confidence >= 0.6) return theme.colors.warning;
    return theme.colors.error;
  };

  if (showResults) {
    return (
      <ScrollView style={styles.container}>
        <LinearGradient
          colors={gradients.primary}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Résultats du Diagnostic</Text>
          <Text style={styles.headerSubtitle}>
            {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''} trouvée{suggestions.length > 1 ? 's' : ''}
          </Text>
        </LinearGradient>

        <View style={styles.content}>
          {suggestions.map((suggestion, index) => (
            <Card key={index} style={styles.suggestionCard}>
              <Card.Content>
                <View style={styles.suggestionHeader}>
                  <View style={styles.confidenceContainer}>
                    <Text style={[styles.confidenceText, { color: getConfidenceColor(suggestion.confidence) }]}>
                      {Math.round(suggestion.confidence * 100)}%
                    </Text>
                    <Text style={styles.confidenceLabel}>Confiance</Text>
                  </View>
                  <View style={styles.urgencyContainer}>
                    <Chip
                      icon="priority-high"
                      style={[styles.urgencyChip, { backgroundColor: getUrgencyColor(suggestion.urgency) }]}
                      textStyle={styles.urgencyText}
                    >
                      {suggestion.urgency.toUpperCase()}
                    </Chip>
                  </View>
                </View>

                <Text style={styles.diagnosisTitle}>{suggestion.diagnosis}</Text>
                <Text style={styles.solutionText}>{suggestion.solution}</Text>

                <Divider style={styles.divider} />

                <View style={styles.metricsContainer}>
                  <View style={styles.metricItem}>
                    <Icon name="schedule" size={16} color={theme.colors.secondary} />
                    <Text style={styles.metricText}>{suggestion.estimatedDuration} min</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Icon name="euro" size={16} color={theme.colors.secondary} />
                    <Text style={styles.metricText}>{suggestion.estimatedCost}</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Icon name="warning" size={16} color={theme.colors.secondary} />
                    <Text style={styles.metricText}>{suggestion.riskLevel}</Text>
                  </View>
                </View>

                {suggestion.aiInsights && (
                  <Surface style={styles.insightsContainer}>
                    <Text style={styles.insightsTitle}>💡 Insights IA</Text>
                    <Text style={styles.insightsText}>{suggestion.aiInsights}</Text>
                  </Surface>
                )}

                <View style={styles.actionButtons}>
                  <Button
                    mode="contained"
                    onPress={() => handleStartRepair(suggestion)}
                    style={styles.repairButton}
                    icon="build"
                  >
                    Réparer
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => handleFeedback(suggestion)}
                    style={styles.feedbackButton}
                    icon="rate-review"
                  >
                    Feedback
                  </Button>
                </View>
              </Card.Content>
            </Card>
          ))}

          <Button
            mode="outlined"
            onPress={resetForm}
            style={styles.newDiagnosticButton}
            icon="refresh"
          >
            Nouveau Diagnostic
          </Button>
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.container}>
        <LinearGradient
          colors={gradients.primary}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>Diagnostic IA</Text>
          <Text style={styles.headerSubtitle}>
            {isOnline ? 'Diagnostic en ligne' : 'Mode hors-ligne'}
          </Text>
          {!isOnline && (
            <Surface style={styles.offlineWarning}>
              <Icon name="wifi-off" size={16} color={theme.colors.warning} />
              <Text style={styles.offlineText}>Mode hors-ligne actif</Text>
            </Surface>
          )}
        </LinearGradient>

        <View style={styles.content}>
          <Card style={styles.formCard}>
            <Card.Title title="Informations Équipement" />
            <Card.Content>
              <TextInput
                label="Type d'équipement *"
                value={formData.equipmentType}
                onChangeText={(text) => setFormData(prev => ({ ...prev, equipmentType: text }))}
                style={styles.input}
                right={<TextInput.Icon icon="chevron-down" />}
              />

              <TextInput
                label="Zone"
                value={formData.zone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, zone: text }))}
                style={styles.input}
              />

              <TextInput
                label="Secteur"
                value={formData.sector}
                onChangeText={(text) => setFormData(prev => ({ ...prev, sector: text }))}
                style={styles.input}
              />

              <TextInput
                label="ID Équipement"
                value={formData.equipmentId}
                onChangeText={(text) => setFormData(prev => ({ ...prev, equipmentId: text }))}
                style={styles.input}
              />
            </Card.Content>
          </Card>

          <Card style={styles.formCard}>
            <Card.Title title="Symptômes" />
            <Card.Content>
              <TextInput
                label="Description des symptômes *"
                value={formData.symptoms}
                onChangeText={(text) => setFormData(prev => ({ ...prev, symptoms: text }))}
                multiline
                numberOfLines={3}
                style={styles.textArea}
              />

              <Button
                mode="outlined"
                onPress={() => setShowSymptomsModal(true)}
                style={styles.symptomsButton}
                icon="checklist"
              >
                Sélectionner symptômes ({formData.symptomsChecked.length})
              </Button>

              {formData.symptomsChecked.length > 0 && (
                <View style={styles.selectedSymptoms}>
                  {formData.symptomsChecked.map((symptom, index) => (
                    <Chip
                      key={index}
                      onClose={() => handleSymptomToggle(symptom)}
                      style={styles.symptomChip}
                    >
                      {symptom}
                    </Chip>
                  ))}
                </View>
              )}
            </Card.Content>
          </Card>

          <Card style={styles.formCard}>
            <Card.Title title="Urgence" />
            <Card.Content>
              <RadioButton.Group
                onValueChange={(value) => setFormData(prev => ({ ...prev, urgency: value as 'low' | 'medium' | 'high' }))}
                value={formData.urgency}
              >
                <View style={styles.radioGroup}>
                  <RadioButton.Item label="Faible" value="low" />
                  <RadioButton.Item label="Moyenne" value="medium" />
                  <RadioButton.Item label="Élevée" value="high" />
                </View>
              </RadioButton.Group>
            </Card.Content>
          </Card>

          {isOnline && (
            <Card style={styles.formCard}>
              <Card.Title title="Options IA" />
              <Card.Content>
                <View style={styles.checkboxContainer}>
                  <Checkbox.Item
                    label="Mode Avancé"
                    status={formData.advancedMode ? 'checked' : 'unchecked'}
                    onPress={() => setFormData(prev => ({ ...prev, advancedMode: !prev.advancedMode }))}
                  />
                  <Checkbox.Item
                    label="Mode Amélioré"
                    status={formData.enhancedMode ? 'checked' : 'unchecked'}
                    onPress={() => setFormData(prev => ({ ...prev, enhancedMode: !prev.enhancedMode }))}
                  />
                  <Checkbox.Item
                    label="Mode Ensemble"
                    status={formData.ensembleMode ? 'checked' : 'unchecked'}
                    onPress={() => setFormData(prev => ({ ...prev, ensembleMode: !prev.ensembleMode }))}
                  />
                </View>
              </Card.Content>
            </Card>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={diagnosticMutation.isPending}
            disabled={diagnosticMutation.isPending || !formData.equipmentType || !formData.symptoms}
            style={styles.submitButton}
            icon="search"
          >
            {diagnosticMutation.isPending ? 'Analyse en cours...' : 'Lancer le Diagnostic'}
          </Button>
        </View>

        {/* Symptoms Modal */}
        <Portal>
          <Modal
            visible={showSymptomsModal}
            onDismiss={() => setShowSymptomsModal(false)}
            contentContainerStyle={styles.modalContainer}
          >
            <Text style={styles.modalTitle}>Sélectionner les symptômes</Text>
            <ScrollView style={styles.modalContent}>
              {commonSymptoms.map((symptom, index) => (
                <Checkbox.Item
                  key={index}
                  label={symptom}
                  status={formData.symptomsChecked.includes(symptom) ? 'checked' : 'unchecked'}
                  onPress={() => handleSymptomToggle(symptom)}
                />
              ))}
            </ScrollView>
            <Button
              mode="contained"
              onPress={() => setShowSymptomsModal(false)}
              style={styles.modalButton}
            >
              Fermer
            </Button>
          </Modal>
        </Portal>
      </ScrollView>
    </KeyboardAvoidingView>
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
  offlineWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.warningContainer,
    padding: spacing.sm,
    borderRadius: theme.roundness,
    marginTop: spacing.sm,
  },
  offlineText: {
    ...typography.body2,
    color: theme.colors.warning,
    marginLeft: spacing.xs,
  },
  content: {
    padding: spacing.md,
  },
  formCard: {
    marginBottom: spacing.md,
  },
  input: {
    marginBottom: spacing.sm,
  },
  textArea: {
    marginBottom: spacing.sm,
  },
  symptomsButton: {
    marginBottom: spacing.sm,
  },
  selectedSymptoms: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  symptomChip: {
    margin: spacing.xs,
  },
  radioGroup: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  checkboxContainer: {
    paddingVertical: spacing.sm,
  },
  submitButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    margin: spacing.lg,
    borderRadius: theme.roundness,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  modalContent: {
    maxHeight: 400,
  },
  modalButton: {
    marginTop: spacing.md,
  },
  suggestionCard: {
    marginBottom: spacing.md,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  confidenceContainer: {
    alignItems: 'center',
  },
  confidenceText: {
    ...typography.h3,
    fontWeight: 'bold',
  },
  confidenceLabel: {
    ...typography.caption,
    color: theme.colors.secondary,
  },
  urgencyContainer: {
    alignItems: 'center',
  },
  urgencyChip: {
    minWidth: 80,
  },
  urgencyText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  diagnosisTitle: {
    ...typography.h4,
    marginBottom: spacing.sm,
  },
  solutionText: {
    ...typography.body1,
    marginBottom: spacing.md,
  },
  divider: {
    marginVertical: spacing.md,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricText: {
    ...typography.body2,
    marginLeft: spacing.xs,
  },
  insightsContainer: {
    backgroundColor: theme.colors.primaryContainer,
    padding: spacing.md,
    borderRadius: theme.roundness,
    marginBottom: spacing.md,
  },
  insightsTitle: {
    ...typography.h4,
    marginBottom: spacing.sm,
  },
  insightsText: {
    ...typography.body2,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  repairButton: {
    flex: 1,
    marginRight: spacing.sm,
  },
  feedbackButton: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  newDiagnosticButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
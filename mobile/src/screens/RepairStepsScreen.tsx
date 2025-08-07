import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Text, Button, Checkbox, Surface, ProgressBar, Chip } from 'react-native-paper';
import { useTheme } from 'react-native-paper';
import { useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import StepIndicator from 'react-native-step-indicator';
import { useDatabase } from '../providers/DatabaseProvider';

interface RepairStep {
  id: number;
  stepNumber: number;
  title: string;
  description: string;
  safetyWarning?: string;
  toolsRequired?: string;
  estimatedTime: number;
  isCompleted: boolean;
}

export default function RepairStepsScreen() {
  const theme = useTheme();
  const route = useRoute();
  const { db } = useDatabase();
  
  const { diagnosis, solution, equipmentType } = route.params as {
    diagnosis: string;
    solution: string;
    equipmentType: string;
  };

  const [steps, setSteps] = useState<RepairStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRepairSteps();
  }, []);

  const loadRepairSteps = () => {
    if (!db) {
      generateGenericSteps();
      return;
    }

    // Try to load steps from database first
    db.transaction((tx) => {
      tx.executeSql(
        'SELECT * FROM repair_procedures WHERE case_id IN (SELECT id FROM maintenance_cases WHERE diagnosis = ? OR equipment_type = ?) ORDER BY step_number',
        [diagnosis, equipmentType],
        (_, { rows }) => {
          if (rows.length > 0) {
            const dbSteps: RepairStep[] = [];
            for (let i = 0; i < rows.length; i++) {
              const row = rows.item(i);
              dbSteps.push({
                id: row.id,
                stepNumber: row.step_number,
                title: row.title,
                description: row.description,
                safetyWarning: row.safety_warning,
                toolsRequired: row.tools_required,
                estimatedTime: row.estimated_time || 15,
                isCompleted: row.is_completed === 1
              });
            }
            setSteps(dbSteps);
            setCompletedSteps(dbSteps.filter(step => step.isCompleted).map(step => step.stepNumber - 1));
          } else {
            generateGenericSteps();
          }
          setIsLoading(false);
        },
        (_, error) => {
          console.error('Error loading repair steps:', error);
          generateGenericSteps();
          return false;
        }
      );
    });
  };

  const generateGenericSteps = () => {
    const genericSteps: RepairStep[] = [
      {
        id: 1,
        stepNumber: 1,
        title: 'Préparation et sécurité',
        description: 'Mettre l\'équipement hors tension. Vérifier l\'arrêt complet. Porter les EPI requis.',
        safetyWarning: 'ATTENTION: Toujours vérifier l\'absence de tension avant toute intervention',
        toolsRequired: 'EPI complets, multimètre, cadenas de consignation',
        estimatedTime: 10,
        isCompleted: false
      },
      {
        id: 2,
        stepNumber: 2,
        title: 'Diagnostic visuel',
        description: 'Inspecter visuellement l\'équipement. Rechercher des signes évidents de défaillance.',
        safetyWarning: 'Ne pas toucher aux composants électriques',
        toolsRequired: 'Lampe torche, appareil photo',
        estimatedTime: 15,
        isCompleted: false
      },
      {
        id: 3,
        stepNumber: 3,
        title: 'Mesures et tests',
        description: 'Effectuer les mesures nécessaires selon le diagnostic. Vérifier les paramètres critiques.',
        toolsRequired: 'Multimètre, manomètre, thermomètre infrarouge',
        estimatedTime: 20,
        isCompleted: false
      },
      {
        id: 4,
        stepNumber: 4,
        title: 'Intervention corrective',
        description: solution || 'Appliquer la solution recommandée par le diagnostic.',
        safetyWarning: 'Respecter les procédures de sécurité spécifiques à l\'intervention',
        toolsRequired: 'Outils spécialisés selon l\'intervention',
        estimatedTime: 45,
        isCompleted: false
      },
      {
        id: 5,
        stepNumber: 5,
        title: 'Tests de fonctionnement',
        description: 'Tester le bon fonctionnement de l\'équipement. Vérifier tous les paramètres.',
        toolsRequired: 'Instruments de mesure, check-list de contrôle',
        estimatedTime: 20,
        isCompleted: false
      },
      {
        id: 6,
        stepNumber: 6,
        title: 'Finalisation et documentation',
        description: 'Nettoyer l\'aire de travail. Documenter l\'intervention. Mettre à jour les registres.',
        toolsRequired: 'Formulaires d\'intervention, appareil photo',
        estimatedTime: 10,
        isCompleted: false
      }
    ];

    setSteps(genericSteps);
    setIsLoading(false);
  };

  const toggleStepCompletion = (stepIndex: number) => {
    const step = steps[stepIndex];
    if (!step) return;

    const newCompletionState = !completedSteps.includes(stepIndex);
    let newCompletedSteps;

    if (newCompletionState) {
      newCompletedSteps = [...completedSteps, stepIndex];
    } else {
      newCompletedSteps = completedSteps.filter(index => index !== stepIndex);
    }

    setCompletedSteps(newCompletedSteps);

    // Update database if available
    if (db && step.id) {
      db.transaction((tx) => {
        tx.executeSql(
          'UPDATE repair_procedures SET is_completed = ? WHERE id = ?',
          [newCompletionState ? 1 : 0, step.id]
        );
      });
    }

    // Move to next step if this one is completed
    if (newCompletionState && stepIndex === currentStep && stepIndex < steps.length - 1) {
      setCurrentStep(stepIndex + 1);
    }
  };

  const getStepIndicatorLabels = () => {
    return steps.map((step, index) => `${step.stepNumber}`);
  };

  const stepIndicatorStyles = {
    stepIndicatorSize: 40,
    currentStepIndicatorSize: 50,
    separatorStrokeWidth: 3,
    currentStepStrokeWidth: 5,
    stepStrokeCurrentColor: theme.colors.primary,
    stepStrokeWidth: 3,
    stepStrokeFinishedColor: theme.colors.primary,
    stepStrokeUnFinishedColor: theme.colors.outline,
    separatorFinishedColor: theme.colors.primary,
    separatorUnFinishedColor: theme.colors.outline,
    stepIndicatorFinishedColor: theme.colors.primary,
    stepIndicatorUnFinishedColor: theme.colors.surface,
    stepIndicatorCurrentColor: theme.colors.primary,
    stepIndicatorLabelFontSize: 14,
    currentStepIndicatorLabelFontSize: 16,
    stepIndicatorLabelCurrentColor: theme.colors.onPrimary,
    stepIndicatorLabelFinishedColor: theme.colors.onPrimary,
    stepIndicatorLabelUnFinishedColor: theme.colors.onSurfaceVariant,
  };

  const renderStepContent = (step: RepairStep, index: number) => (
    <Card key={step.id} style={[
      styles.stepCard,
      completedSteps.includes(index) && { borderLeftColor: theme.colors.primary, borderLeftWidth: 4 }
    ]}>
      <Card.Content>
        <View style={styles.stepHeader}>
          <View style={styles.stepTitleContainer}>
            <Text variant="titleMedium" style={styles.stepTitle}>
              {step.title}
            </Text>
            <Chip 
              icon="clock" 
              style={styles.timeChip}
            >
              {step.estimatedTime} min
            </Chip>
          </View>
          <Checkbox
            status={completedSteps.includes(index) ? 'checked' : 'unchecked'}
            onPress={() => toggleStepCompletion(index)}
          />
        </View>

        <Text variant="bodyMedium" style={styles.stepDescription}>
          {step.description}
        </Text>

        {step.safetyWarning && (
          <Surface style={[styles.warningBox, { backgroundColor: '#fef3c7' }]}>
            <View style={styles.warningContent}>
              <Icon name="alert" size={20} color="#d97706" />
              <Text style={[styles.warningText, { color: '#92400e' }]}>
                {step.safetyWarning}
              </Text>
            </View>
          </Surface>
        )}

        {step.toolsRequired && (
          <View style={styles.toolsContainer}>
            <Text variant="bodySmall" style={styles.toolsLabel}>
              Outils requis:
            </Text>
            <Text variant="bodySmall" style={styles.toolsText}>
              {step.toolsRequired}
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );

  const completionPercentage = (completedSteps.length / steps.length) * 100;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ProgressBar indeterminate />
        <Text style={{ marginTop: 16 }}>Chargement des étapes...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <Text variant="headlineSmall" style={styles.diagnosisTitle}>
              {diagnosis}
            </Text>
            <Text variant="bodyMedium" style={styles.equipmentType}>
              Équipement: {equipmentType}
            </Text>
            
            <View style={styles.progressContainer}>
              <Text variant="bodyMedium" style={styles.progressText}>
                Progression: {completedSteps.length}/{steps.length} étapes
              </Text>
              <ProgressBar 
                progress={completionPercentage / 100} 
                style={styles.progressBar}
              />
              <Text variant="bodySmall" style={styles.progressPercentage}>
                {Math.round(completionPercentage)}%
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Step Indicator */}
        <Surface style={styles.indicatorContainer}>
          <StepIndicator
            customStyles={stepIndicatorStyles}
            currentPosition={currentStep}
            labels={getStepIndicatorLabels()}
            stepCount={steps.length}
            direction="horizontal"
            onPress={setCurrentStep}
          />
        </Surface>

        {/* Current Step Detail */}
        <Text variant="headlineSmall" style={styles.sectionTitle}>
          Étape en cours
        </Text>
        {steps[currentStep] && renderStepContent(steps[currentStep], currentStep)}

        {/* All Steps */}
        <Text variant="headlineSmall" style={styles.sectionTitle}>
          Toutes les étapes
        </Text>
        {steps.map((step, index) => renderStepContent(step, index))}

        {/* Completion Actions */}
        {completedSteps.length === steps.length && (
          <Card style={[styles.completionCard, { backgroundColor: theme.colors.primaryContainer }]}>
            <Card.Content>
              <View style={styles.completionContent}>
                <Icon name="check-circle" size={48} color={theme.colors.primary} />
                <Text variant="headlineSmall" style={{ color: theme.colors.primary, marginTop: 8 }}>
                  Intervention terminée !
                </Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onPrimaryContainer, textAlign: 'center', marginTop: 8 }}>
                  Toutes les étapes ont été complétées avec succès.
                </Text>
                <Button
                  mode="contained"
                  style={{ marginTop: 16 }}
                  onPress={() => Alert.alert('Succès', 'Intervention enregistrée avec succès')}
                >
                  Finaliser l'intervention
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  diagnosisTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  equipmentType: {
    opacity: 0.8,
    marginBottom: 16,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressText: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  progressPercentage: {
    textAlign: 'center',
    marginTop: 4,
    fontWeight: 'bold',
  },
  indicatorContainer: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  sectionTitle: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  stepCard: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 12,
  },
  stepTitle: {
    fontWeight: 'bold',
    flex: 1,
  },
  timeChip: {
    marginLeft: 8,
  },
  stepDescription: {
    marginBottom: 12,
    lineHeight: 20,
  },
  warningBox: {
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    fontWeight: 'bold',
  },
  toolsContainer: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  toolsLabel: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  toolsText: {
    opacity: 0.8,
  },
  completionCard: {
    marginTop: 16,
    marginBottom: 20,
    borderRadius: 12,
    elevation: 4,
  },
  completionContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
});
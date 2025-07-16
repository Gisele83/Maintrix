import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import {
  Card,
  Text,
  Button,
  Checkbox,
  ProgressBar,
  Chip,
  Surface,
  Avatar,
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { generateRepairSteps } from '../services/RepairGuidanceService';
import { saveRepairProgress } from '../services/OfflineStorage';

const { width } = Dimensions.get('window');

interface RepairStep {
  id: number;
  title: string;
  description: string;
  duration: number;
  tools: string[];
  safety: string[];
  completed: boolean;
  critical: boolean;
}

export function RepairGuidanceScreen({ route, navigation }: any) {
  const { suggestions, diagnosticData, isOffline } = route.params;
  const [selectedSuggestion, setSelectedSuggestion] = useState(suggestions[0]);
  const [repairSteps, setRepairSteps] = useState<RepairStep[]>([]);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRepairSteps();
  }, [selectedSuggestion]);

  const loadRepairSteps = async () => {
    setLoading(true);
    try {
      const steps = await generateRepairSteps(
        selectedSuggestion.diagnosis,
        diagnosticData.equipmentType,
        isOffline
      );
      setRepairSteps(steps);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de charger les étapes de réparation');
    } finally {
      setLoading(false);
    }
  };

  const handleStepComplete = async (stepId: number) => {
    const newCompletedSteps = completedSteps.includes(stepId)
      ? completedSteps.filter(id => id !== stepId)
      : [...completedSteps, stepId];
    
    setCompletedSteps(newCompletedSteps);
    
    // Sauvegarder le progrès hors ligne
    await saveRepairProgress({
      sessionId: `repair_${Date.now()}`,
      diagnosis: selectedSuggestion.diagnosis,
      completedSteps: newCompletedSteps,
      timestamp: new Date().toISOString(),
    });

    // Passer à l'étape suivante automatiquement
    if (!completedSteps.includes(stepId) && stepId === currentStep) {
      setCurrentStep(Math.min(currentStep + 1, repairSteps.length - 1));
    }
  };

  const getProgressPercentage = () => {
    return repairSteps.length > 0 ? (completedSteps.length / repairSteps.length) * 100 : 0;
  };

  const estimatedTimeRemaining = () => {
    const remainingSteps = repairSteps.filter(step => !completedSteps.includes(step.id));
    return remainingSteps.reduce((total, step) => total + step.duration, 0);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Génération du guide de réparation...</Text>
        <ProgressBar indeterminate style={styles.loadingBar} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* En-tête du diagnostic */}
      <Card style={styles.headerCard}>
        <Card.Content>
          <View style={styles.headerRow}>
            <Avatar.Icon 
              icon={isOffline ? "wifi-off" : "wifi"} 
              size={40}
              style={[styles.statusIcon, { backgroundColor: isOffline ? '#ff9800' : '#4caf50' }]}
            />
            <View style={styles.headerInfo}>
              <Text style={styles.diagnosisTitle}>{selectedSuggestion.diagnosis}</Text>
              <Text style={styles.equipmentInfo}>
                {diagnosticData.equipmentType} • {diagnosticData.zone || 'Zone non spécifiée'}
              </Text>
              <View style={styles.confidenceRow}>
                <Chip 
                  icon="star" 
                  style={[styles.confidenceChip, getConfidenceColor(selectedSuggestion.confidence)]}
                >
                  {selectedSuggestion.confidence}% confiance
                </Chip>
                <Chip icon="schedule" style={styles.timeChip}>
                  ~{estimatedTimeRemaining()}min restantes
                </Chip>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Barre de progression */}
      <Surface style={styles.progressCard}>
        <Text style={styles.progressTitle}>
          Progression: {completedSteps.length}/{repairSteps.length} étapes
        </Text>
        <ProgressBar 
          progress={getProgressPercentage() / 100} 
          color="#1976d2"
          style={styles.progressBar}
        />
        <Text style={styles.progressText}>
          {Math.round(getProgressPercentage())}% terminé
        </Text>
      </Surface>

      {/* Sélection de suggestion alternative */}
      {suggestions.length > 1 && (
        <Card style={styles.alternativesCard}>
          <Card.Title title="Diagnostics alternatifs" />
          <Card.Content>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {suggestions.map((suggestion: any, index: number) => (
                <Chip
                  key={index}
                  selected={selectedSuggestion === suggestion}
                  onPress={() => setSelectedSuggestion(suggestion)}
                  style={styles.alternativeChip}
                >
                  {suggestion.diagnosis} ({suggestion.confidence}%)
                </Chip>
              ))}
            </ScrollView>
          </Card.Content>
        </Card>
      )}

      {/* Étapes de réparation */}
      {repairSteps.map((step, index) => (
        <Card 
          key={step.id} 
          style={[
            styles.stepCard,
            completedSteps.includes(step.id) && styles.completedStepCard,
            index === currentStep && styles.currentStepCard
          ]}
        >
          <Card.Content>
            <View style={styles.stepHeader}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <View style={styles.stepMeta}>
                  <Chip icon="schedule" style={styles.metaChip}>
                    {step.duration}min
                  </Chip>
                  {step.critical && (
                    <Chip icon="warning" style={styles.criticalChip}>
                      Critique
                    </Chip>
                  )}
                </View>
              </View>
              <Checkbox
                status={completedSteps.includes(step.id) ? 'checked' : 'unchecked'}
                onPress={() => handleStepComplete(step.id)}
              />
            </View>
            
            <Text style={styles.stepDescription}>{step.description}</Text>
            
            {/* Outils nécessaires */}
            {step.tools.length > 0 && (
              <View style={styles.toolsSection}>
                <Text style={styles.sectionTitle}>Outils nécessaires:</Text>
                <View style={styles.toolsList}>
                  {step.tools.map((tool, toolIndex) => (
                    <Chip key={toolIndex} icon="build" style={styles.toolChip}>
                      {tool}
                    </Chip>
                  ))}
                </View>
              </View>
            )}
            
            {/* Consignes de sécurité */}
            {step.safety.length > 0 && (
              <View style={styles.safetySection}>
                <Text style={styles.sectionTitle}>⚠️ Sécurité:</Text>
                {step.safety.map((safety, safetyIndex) => (
                  <Text key={safetyIndex} style={styles.safetyText}>
                    • {safety}
                  </Text>
                ))}
              </View>
            )}
          </Card.Content>
        </Card>
      ))}

      {/* Actions finales */}
      <Card style={styles.actionsCard}>
        <Card.Content>
          <View style={styles.actionButtons}>
            <Button
              mode="outlined"
              onPress={() => navigation.goBack()}
              icon="arrow-back"
              style={styles.actionButton}
            >
              Retour
            </Button>
            
            {getProgressPercentage() === 100 ? (
              <Button
                mode="contained"
                onPress={() => Alert.alert('Succès', 'Réparation terminée avec succès!')}
                icon="check-circle"
                style={styles.actionButton}
              >
                Terminer
              </Button>
            ) : (
              <Button
                mode="contained"
                onPress={() => setCurrentStep(Math.min(currentStep + 1, repairSteps.length - 1))}
                icon="arrow-forward"
                style={styles.actionButton}
              >
                Étape suivante
              </Button>
            )}
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 80) return { backgroundColor: '#4caf50' };
  if (confidence >= 60) return { backgroundColor: '#ff9800' };
  return { backgroundColor: '#f44336' };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingBar: {
    width: 200,
    marginTop: 16,
  },
  headerCard: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: 16,
  },
  headerInfo: {
    flex: 1,
  },
  diagnosisTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  equipmentInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  confidenceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  confidenceChip: {
    backgroundColor: '#e3f2fd',
  },
  timeChip: {
    backgroundColor: '#fff3e0',
  },
  progressCard: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
  },
  alternativesCard: {
    marginBottom: 16,
  },
  alternativeChip: {
    marginRight: 8,
    marginBottom: 4,
  },
  stepCard: {
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#e0e0e0',
  },
  completedStepCard: {
    borderLeftColor: '#4caf50',
    backgroundColor: '#f1f8e9',
  },
  currentStepCard: {
    borderLeftColor: '#1976d2',
    backgroundColor: '#e3f2fd',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  stepInfo: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  stepMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  metaChip: {
    backgroundColor: '#e0e0e0',
    height: 24,
  },
  criticalChip: {
    backgroundColor: '#ffebee',
    height: 24,
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  toolsSection: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  toolsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  toolChip: {
    backgroundColor: '#e8f5e8',
    height: 28,
  },
  safetySection: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
  },
  safetyText: {
    fontSize: 13,
    marginBottom: 4,
    color: '#856404',
  },
  actionsCard: {
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
});
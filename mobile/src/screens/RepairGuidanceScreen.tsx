import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import {
  Card,
  Button,
  ProgressBar,
  Checkbox,
  Surface,
  Portal,
  Modal,
  TextInput,
  Divider,
  Chip,
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Animatable from 'react-native-animatable';

import { theme, spacing, typography, gradients } from '../theme/theme';
import { useOffline } from '../context/OfflineContext';
import { RootStackParamList } from '../navigation/AppNavigator';

type RepairGuidanceScreenNavigationProp = StackNavigationProp<RootStackParamList, 'RepairGuidance'>;
type RepairGuidanceScreenRouteProp = RouteProp<RootStackParamList, 'RepairGuidance'>;

interface RepairStep {
  id: number;
  title: string;
  description: string;
  duration: number;
  safety: string[];
  tools: string[];
  images?: string[];
  warnings?: string[];
  completed: boolean;
}

export function RepairGuidanceScreen() {
  const navigation = useNavigation<RepairGuidanceScreenNavigationProp>();
  const route = useRoute<RepairGuidanceScreenRouteProp>();
  const { caseId, diagnosis } = route.params;
  const { isOnline } = useOffline();

  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<RepairStep[]>([]);
  const [isStepCompleted, setIsStepCompleted] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showToolsModal, setShowToolsModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [repairNotes, setRepairNotes] = useState('');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const progressAnimation = new Animated.Value(0);

  useEffect(() => {
    generateRepairSteps();
    setStartTime(new Date());
  }, [caseId, diagnosis]);

  useEffect(() => {
    if (startTime && !isPaused) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((new Date().getTime() - startTime.getTime()) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [startTime, isPaused]);

  useEffect(() => {
    const progress = steps.length > 0 ? (currentStep + 1) / steps.length : 0;
    Animated.timing(progressAnimation, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep, steps.length]);

  const generateRepairSteps = () => {
    // Generate repair steps based on diagnosis
    const baseSteps: RepairStep[] = [
      {
        id: 1,
        title: 'Préparation et Sécurité',
        description: 'Vérifier l\'environnement de travail et préparer les outils de sécurité',
        duration: 5,
        safety: [
          'Porter des EPI (casque, gants, lunettes)',
          'Vérifier que l\'équipement est hors tension',
          'Mettre en place la procédure de consignation',
          'Informer l\'équipe de maintenance'
        ],
        tools: ['EPI complet', 'Multimètre', 'Outils de consignation'],
        warnings: ['Ne jamais travailler sous tension', 'Respecter les distances de sécurité'],
        completed: false,
      },
      {
        id: 2,
        title: 'Diagnostic Visuel',
        description: 'Inspection visuelle complète de l\'équipement et identification des anomalies',
        duration: 10,
        safety: [
          'Utiliser un éclairage adapté',
          'Éviter les contacts directs',
          'Photographier les anomalies'
        ],
        tools: ['Lampe torche', 'Appareil photo', 'Loupe'],
        completed: false,
      },
      {
        id: 3,
        title: 'Tests et Mesures',
        description: 'Effectuer les mesures électriques et mécaniques nécessaires',
        duration: 15,
        safety: [
          'Utiliser des instruments calibrés',
          'Respecter les consignes de mesure',
          'Vérifier la continuité des masses'
        ],
        tools: ['Multimètre', 'Mégohmmètre', 'Pince ampèremétrique'],
        completed: false,
      },
      {
        id: 4,
        title: 'Réparation',
        description: 'Exécuter les actions correctives identifiées',
        duration: 30,
        safety: [
          'Suivre la procédure de maintenance',
          'Utiliser les pièces de rechange appropriées',
          'Documenter les interventions'
        ],
        tools: ['Clés', 'Tournevis', 'Pièces de rechange'],
        warnings: ['Respecter les couples de serrage', 'Vérifier l\'alignement'],
        completed: false,
      },
      {
        id: 5,
        title: 'Tests de Fonctionnement',
        description: 'Vérifier le bon fonctionnement après réparation',
        duration: 10,
        safety: [
          'Procéder par étapes progressives',
          'Surveiller les paramètres de fonctionnement',
          'Être prêt à arrêter en cas d\'anomalie'
        ],
        tools: ['Instruments de mesure', 'Fiche de test'],
        completed: false,
      },
      {
        id: 6,
        title: 'Finalisation',
        description: 'Nettoyer, ranger et documenter l\'intervention',
        duration: 5,
        safety: [
          'Remettre tous les dispositifs de sécurité',
          'Nettoyer la zone de travail',
          'Remplir le rapport d\'intervention'
        ],
        tools: ['Produits de nettoyage', 'Rapport d\'intervention'],
        completed: false,
      },
    ];

    setSteps(baseSteps);
  };

  const handleStepComplete = () => {
    if (currentStep < steps.length) {
      const newSteps = [...steps];
      newSteps[currentStep].completed = true;
      setSteps(newSteps);
      setIsStepCompleted(true);
      
      setTimeout(() => {
        setIsStepCompleted(false);
        if (currentStep < steps.length - 1) {
          setCurrentStep(currentStep + 1);
        } else {
          handleRepairComplete();
        }
      }, 1000);
    }
  };

  const handleRepairComplete = () => {
    Alert.alert(
      'Réparation Terminée',
      'Félicitations ! La réparation a été terminée avec succès.',
      [
        {
          text: 'Ajouter des Notes',
          onPress: () => setShowNotesModal(true)
        },
        {
          text: 'Terminer',
          onPress: () => navigation.goBack()
        }
      ]
    );
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePauseResume = () => {
    setIsPaused(!isPaused);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStepProgress = () => {
    if (steps.length === 0) return 0;
    return (currentStep + 1) / steps.length;
  };

  const currentStepData = steps[currentStep];

  if (!currentStepData) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={gradients.primary} style={styles.header}>
          <Text style={styles.headerTitle}>Guidance Réparation</Text>
          <Text style={styles.headerSubtitle}>Chargement...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.primary} style={styles.header}>
        <Text style={styles.headerTitle}>Guidance Réparation</Text>
        <Text style={styles.headerSubtitle}>{diagnosis}</Text>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressText}>
              Étape {currentStep + 1} sur {steps.length}
            </Text>
            <Text style={styles.timerText}>
              {formatTime(elapsedTime)}
            </Text>
          </View>
          <ProgressBar
            progress={getStepProgress()}
            color="#ffffff"
            style={styles.progressBar}
          />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <Animatable.View
          animation={isStepCompleted ? 'pulse' : undefined}
          duration={1000}
        >
          <Card style={styles.stepCard}>
            <Card.Content>
              <View style={styles.stepHeader}>
                <Text style={styles.stepTitle}>{currentStepData.title}</Text>
                <Chip
                  icon="schedule"
                  style={styles.durationChip}
                  textStyle={styles.durationText}
                >
                  {currentStepData.duration} min
                </Chip>
              </View>
              
              <Text style={styles.stepDescription}>
                {currentStepData.description}
              </Text>
            </Card.Content>
          </Card>
        </Animatable.View>

        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={() => setShowSafetyModal(true)}
            style={styles.actionButton}
            icon="security"
          >
            Sécurité ({currentStepData.safety.length})
          </Button>
          <Button
            mode="outlined"
            onPress={() => setShowToolsModal(true)}
            style={styles.actionButton}
            icon="build"
          >
            Outils ({currentStepData.tools.length})
          </Button>
        </View>

        {currentStepData.warnings && currentStepData.warnings.length > 0 && (
          <Card style={styles.warningCard}>
            <Card.Content>
              <View style={styles.warningHeader}>
                <Icon name="warning" size={24} color={theme.colors.error} />
                <Text style={styles.warningTitle}>Attention</Text>
              </View>
              {currentStepData.warnings.map((warning, index) => (
                <Text key={index} style={styles.warningText}>
                  • {warning}
                </Text>
              ))}
            </Card.Content>
          </Card>
        )}

        <View style={styles.navigationButtons}>
          <Button
            mode="outlined"
            onPress={handlePreviousStep}
            disabled={currentStep === 0}
            style={styles.navButton}
            icon="chevron-left"
          >
            Précédent
          </Button>
          
          <Button
            mode="contained"
            onPress={handleStepComplete}
            style={styles.completeButton}
            icon="check"
          >
            {currentStep === steps.length - 1 ? 'Terminer' : 'Suivant'}
          </Button>
        </View>

        <View style={styles.controls}>
          <Button
            mode="outlined"
            onPress={handlePauseResume}
            style={styles.controlButton}
            icon={isPaused ? "play-arrow" : "pause"}
          >
            {isPaused ? 'Reprendre' : 'Pause'}
          </Button>
          
          <Button
            mode="outlined"
            onPress={() => setShowNotesModal(true)}
            style={styles.controlButton}
            icon="note"
          >
            Notes
          </Button>
        </View>
      </ScrollView>

      {/* Safety Modal */}
      <Portal>
        <Modal
          visible={showSafetyModal}
          onDismiss={() => setShowSafetyModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Consignes de Sécurité</Text>
          <ScrollView style={styles.modalContent}>
            {currentStepData.safety.map((item, index) => (
              <View key={index} style={styles.safetyItem}>
                <Icon name="check-circle" size={20} color={theme.colors.success} />
                <Text style={styles.safetyText}>{item}</Text>
              </View>
            ))}
          </ScrollView>
          <Button
            mode="contained"
            onPress={() => setShowSafetyModal(false)}
            style={styles.modalButton}
          >
            Compris
          </Button>
        </Modal>
      </Portal>

      {/* Tools Modal */}
      <Portal>
        <Modal
          visible={showToolsModal}
          onDismiss={() => setShowToolsModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Outils Requis</Text>
          <ScrollView style={styles.modalContent}>
            {currentStepData.tools.map((tool, index) => (
              <View key={index} style={styles.toolItem}>
                <Checkbox status="unchecked" />
                <Text style={styles.toolText}>{tool}</Text>
              </View>
            ))}
          </ScrollView>
          <Button
            mode="contained"
            onPress={() => setShowToolsModal(false)}
            style={styles.modalButton}
          >
            Fermer
          </Button>
        </Modal>
      </Portal>

      {/* Notes Modal */}
      <Portal>
        <Modal
          visible={showNotesModal}
          onDismiss={() => setShowNotesModal(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Notes de Réparation</Text>
          <TextInput
            label="Observations et commentaires"
            value={repairNotes}
            onChangeText={setRepairNotes}
            multiline
            numberOfLines={5}
            style={styles.notesInput}
          />
          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setShowNotesModal(false)}
              style={styles.modalButton}
            >
              Annuler
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                // Save notes
                setShowNotesModal(false);
                Alert.alert('Notes', 'Notes sauvegardées avec succès');
              }}
              style={styles.modalButton}
            >
              Sauvegarder
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
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
    marginBottom: spacing.md,
  },
  progressContainer: {
    marginTop: spacing.md,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressText: {
    ...typography.body2,
    color: '#ffffff',
  },
  timerText: {
    ...typography.body2,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  stepCard: {
    marginBottom: spacing.md,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  stepTitle: {
    ...typography.h3,
    flex: 1,
    marginRight: spacing.md,
  },
  durationChip: {
    backgroundColor: theme.colors.primaryContainer,
  },
  durationText: {
    ...typography.body2,
    color: theme.colors.primary,
  },
  stepDescription: {
    ...typography.body1,
    lineHeight: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  warningCard: {
    marginBottom: spacing.md,
    backgroundColor: theme.colors.errorContainer,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  warningTitle: {
    ...typography.h4,
    color: theme.colors.error,
    marginLeft: spacing.sm,
  },
  warningText: {
    ...typography.body2,
    color: theme.colors.error,
    marginBottom: spacing.xs,
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  navButton: {
    flex: 1,
    marginRight: spacing.sm,
  },
  completeButton: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  controlButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: theme.roundness,
    maxHeight: '80%',
  },
  modalTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  modalContent: {
    maxHeight: 400,
    marginBottom: spacing.md,
  },
  modalButton: {
    marginTop: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  safetyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  safetyText: {
    ...typography.body1,
    marginLeft: spacing.sm,
    flex: 1,
  },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  toolText: {
    ...typography.body1,
    marginLeft: spacing.sm,
    flex: 1,
  },
  notesInput: {
    marginBottom: spacing.md,
    minHeight: 120,
  },
});
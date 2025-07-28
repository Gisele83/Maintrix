import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as Progress from 'react-native-progress';

const RepairGuidanceScreen = () => {
  const { theme } = useTheme();
  const route = useRoute();
  const navigation = useNavigation();
  const { diagnostic, equipmentType } = route.params as any;

  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [showSafetyWarning, setShowSafetyWarning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Generate repair steps based on diagnostic results
  const repairSteps = [
    {
      id: 1,
      title: 'Préparation et sécurité',
      description: 'Mise en sécurité de l\'équipement et préparation des outils',
      duration: 15,
      tools: ['Multimètre', 'Clés de sécurité', 'EPI complet'],
      safety: 'ATTENTION: Couper l\'alimentation électrique avant intervention',
      instructions: [
        'Consigner l\'équipement selon la procédure LOTO',
        'Vérifier l\'absence de tension',
        'Porter les équipements de protection individuelle',
        'Préparer les outils nécessaires'
      ]
    },
    {
      id: 2,
      title: 'Diagnostic visuel',
      description: 'Inspection visuelle des composants principaux',
      duration: 20,
      tools: ['Lampe d\'inspection', 'Appareil photo'],
      safety: 'Attention aux pièces chaudes ou sous pression',
      instructions: [
        'Inspecter visuellement l\'état général de l\'équipement',
        'Rechercher des signes d\'usure, de corrosion ou de dommages',
        'Photographier les anomalies constatées',
        'Noter toutes les observations'
      ]
    },
    {
      id: 3,
      title: 'Démontage ciblé',
      description: 'Démontage des pièces défectueuses identifiées',
      duration: 45,
      tools: ['Clés dynamométriques', 'Extracteurs', 'Contenants étiquetés'],
      safety: 'Respecter l\'ordre de démontage, marquer les positions',
      instructions: [
        'Suivre la séquence de démontage recommandée',
        'Marquer la position des pièces avant démontage',
        'Nettoyer et inspecter chaque pièce démontée',
        'Ranger les pièces dans des contenants étiquetés'
      ]
    },
    {
      id: 4,
      title: 'Remplacement des pièces',
      description: 'Installation des nouvelles pièces de rechange',
      duration: 30,
      tools: ['Pièces de rechange', 'Graisse/lubrifiant', 'Chiffons'],
      safety: 'Vérifier la compatibilité des pièces de rechange',
      instructions: [
        'Vérifier les références des pièces de rechange',
        'Appliquer le lubrifiant selon les spécifications',
        'Installer les nouvelles pièces en respectant les couples',
        'Contrôler l\'alignement et le jeu fonctionnel'
      ]
    },
    {
      id: 5,
      title: 'Remontage et réglages',
      description: 'Remontage de l\'équipement et réglages finaux',
      duration: 35,
      tools: ['Clés dynamométriques', 'Jauges d\'épaisseur'],
      safety: 'Respecter les couples de serrage spécifiés',
      instructions: [
        'Remonter dans l\'ordre inverse du démontage',
        'Appliquer les couples de serrage spécifiés',
        'Effectuer les réglages de jeu et d\'alignement',
        'Vérifier la liberté de mouvement'
      ]
    },
    {
      id: 6,
      title: 'Tests et validation',
      description: 'Tests de fonctionnement et validation de la réparation',
      duration: 25,
      tools: ['Instruments de mesure', 'Protocole de test'],
      safety: 'Effectuer les tests par étapes progressives',
      instructions: [
        'Effectuer les vérifications électriques',
        'Démarrer l\'équipement à vide',
        'Monter progressivement en charge',
        'Valider tous les paramètres de fonctionnement'
      ]
    }
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setElapsedTime(time => time + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 15,
    },
    headerGradient: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: 'white',
      marginBottom: 5,
    },
    headerSubtitle: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.8)',
      marginBottom: 15,
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    progressInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    progressText: {
      color: 'white',
      fontSize: 14,
      marginLeft: 10,
    },
    timerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 15,
    },
    timerText: {
      color: 'white',
      fontSize: 14,
      marginLeft: 5,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    stepCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 15,
      padding: 20,
      marginBottom: 20,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
    },
    activeStepCard: {
      borderLeftColor: '#10b981',
      backgroundColor: `${theme.colors.success}10`,
    },
    completedStepCard: {
      borderLeftColor: '#6b7280',
      opacity: 0.7,
    },
    stepHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    stepNumber: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumberCompleted: {
      backgroundColor: '#10b981',
    },
    stepNumberText: {
      color: 'white',
      fontSize: 14,
      fontWeight: 'bold',
    },
    stepTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      flex: 1,
      marginLeft: 15,
    },
    stepDuration: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
    },
    stepDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 15,
    },
    safetyWarning: {
      backgroundColor: '#fef3cd',
      borderRadius: 8,
      padding: 12,
      marginBottom: 15,
      flexDirection: 'row',
      alignItems: 'center',
    },
    safetyText: {
      fontSize: 14,
      color: '#856404',
      marginLeft: 10,
      flex: 1,
    },
    toolsContainer: {
      marginBottom: 15,
    },
    toolsTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 8,
    },
    toolsList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    toolChip: {
      backgroundColor: theme.colors.background,
      borderRadius: 15,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginRight: 8,
      marginBottom: 5,
    },
    toolText: {
      fontSize: 12,
      color: theme.colors.text,
    },
    instructionsList: {
      marginBottom: 20,
    },
    instructionItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    instructionBullet: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      marginTop: 2,
    },
    instructionText: {
      fontSize: 14,
      color: theme.colors.text,
      flex: 1,
      lineHeight: 20,
    },
    stepActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    actionButton: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      marginHorizontal: 5,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    actionButtonSecondary: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionButtonDisabled: {
      backgroundColor: theme.colors.border,
      opacity: 0.5,
    },
    actionButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '500',
      marginLeft: 5,
    },
    actionButtonTextSecondary: {
      color: theme.colors.text,
    },
    completedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#10b981',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 15,
    },
    completedBadgeText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '500',
      marginLeft: 5,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 15,
      padding: 20,
      margin: 20,
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 15,
      textAlign: 'center',
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
    },
    modalButton: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      marginHorizontal: 5,
      alignItems: 'center',
    },
    modalButtonSecondary: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '500',
    },
    modalButtonTextSecondary: {
      color: theme.colors.text,
    },
  });

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const handleStartTimer = () => {
    setIsTimerRunning(true);
  };

  const handlePauseTimer = () => {
    setIsTimerRunning(false);
  };

  const handleCompleteStep = (stepIndex: number) => {
    if (!completedSteps.includes(stepIndex)) {
      setCompletedSteps([...completedSteps, stepIndex]);
    }
    if (stepIndex < repairSteps.length - 1) {
      setCurrentStep(stepIndex + 1);
    }
  };

  const handleShowSafetyWarning = () => {
    setShowSafetyWarning(true);
  };

  const handleFinishRepair = () => {
    Alert.alert(
      'Réparation terminée',
      'Félicitations ! Vous avez terminé la procédure de réparation. Souhaitez-vous donner votre avis ?',
      [
        {
          text: 'Plus tard',
          style: 'cancel',
          onPress: () => navigation.goBack(),
        },
        {
          text: 'Évaluer',
          onPress: () => navigation.navigate('Feedback' as never, { diagnostic } as never),
        },
      ]
    );
  };

  const progress = completedSteps.length / repairSteps.length;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e40af', '#3b82f6']}
        style={styles.headerGradient}
      >
        <Text style={styles.headerTitle}>Guide de Réparation</Text>
        <Text style={styles.headerSubtitle}>
          {diagnostic?.suggestions?.[0]?.issue || 'Procédure de maintenance'}
        </Text>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressInfo}>
            <Progress.Bar
              progress={progress}
              width={150}
              height={8}
              color="white"
              unfilledColor="rgba(255, 255, 255, 0.3)"
              borderWidth={0}
            />
            <Text style={styles.progressText}>
              {completedSteps.length}/{repairSteps.length} étapes
            </Text>
          </View>
          
          <View style={styles.timerContainer}>
            <Ionicons name="time" size={14} color="white" />
            <Text style={styles.timerText}>{formatTime(elapsedTime)}</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {repairSteps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = completedSteps.includes(index);
          const isAccessible = index === 0 || completedSteps.includes(index - 1);

          return (
            <View
              key={step.id}
              style={[
                styles.stepCard,
                isActive && styles.activeStepCard,
                isCompleted && styles.completedStepCard,
              ]}
            >
              <View style={styles.stepHeader}>
                <View style={styles.stepNumber}>
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={16} color="white" />
                  ) : (
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  )}
                </View>
                <Text style={styles.stepTitle}>{step.title}</Text>
                {isCompleted ? (
                  <View style={styles.completedBadge}>
                    <Ionicons name="checkmark-circle" size={12} color="white" />
                    <Text style={styles.completedBadgeText}>Terminé</Text>
                  </View>
                ) : (
                  <Text style={styles.stepDuration}>{step.duration} min</Text>
                )}
              </View>

              <Text style={styles.stepDescription}>{step.description}</Text>

              {isActive && (
                <>
                  <View style={styles.safetyWarning}>
                    <Ionicons name="warning" size={16} color="#856404" />
                    <Text style={styles.safetyText}>{step.safety}</Text>
                  </View>

                  <View style={styles.toolsContainer}>
                    <Text style={styles.toolsTitle}>Outils requis :</Text>
                    <View style={styles.toolsList}>
                      {step.tools.map((tool, toolIndex) => (
                        <View key={toolIndex} style={styles.toolChip}>
                          <Text style={styles.toolText}>{tool}</Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={styles.instructionsList}>
                    {step.instructions.map((instruction, instrIndex) => (
                      <View key={instrIndex} style={styles.instructionItem}>
                        <View style={styles.instructionBullet}>
                          <Text style={styles.stepNumberText}>{instrIndex + 1}</Text>
                        </View>
                        <Text style={styles.instructionText}>{instruction}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.stepActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionButtonSecondary]}
                      onPress={handleShowSafetyWarning}
                    >
                      <Ionicons name="shield-checkmark" size={16} color={theme.colors.text} />
                      <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                        Sécurité
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => {
                        if (!isTimerRunning) handleStartTimer();
                        handleCompleteStep(index);
                        if (index === repairSteps.length - 1) {
                          handleFinishRepair();
                        }
                      }}
                    >
                      <Ionicons name="checkmark" size={16} color="white" />
                      <Text style={styles.actionButtonText}>
                        {index === repairSteps.length - 1 ? 'Terminer' : 'Étape suivante'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {!isActive && !isCompleted && !isAccessible && (
                <View style={styles.stepActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonDisabled]}
                    disabled={true}
                  >
                    <Ionicons name="lock-closed" size={16} color="white" />
                    <Text style={styles.actionButtonText}>Verrouillé</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal
        visible={showSafetyWarning}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSafetyWarning(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚠️ Consignes de Sécurité</Text>
            <ScrollView>
              <Text style={styles.instructionText}>
                • Toujours consigner l'équipement avant intervention{'\n'}
                • Porter les équipements de protection individuelle{'\n'}
                • Vérifier l'absence de tension électrique{'\n'}
                • Respecter les procédures LOTO (Lock Out Tag Out){'\n'}
                • Ne jamais travailler seul sur les équipements critiques{'\n'}
                • Signaler immédiatement tout incident ou anomalie{'\n'}
                • Suivre les procédures d'urgence en cas de problème
              </Text>
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowSafetyWarning(false)}
              >
                <Text style={styles.modalButtonText}>Compris</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default RepairGuidanceScreen;
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useApiService } from '../services/ApiService';
import { useNavigation } from '@react-navigation/native';

const DiagnosticScreen = () => {
  const { theme } = useTheme();
  const apiService = useApiService();
  const navigation = useNavigation();

  const [formData, setFormData] = useState({
    equipmentType: '',
    equipmentId: '',
    symptoms: [] as string[],
    zone: '',
    sector: '',
    urgencyLevel: 'medium',
    mlMode: 'standard',
  });

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const equipmentTypes = [
    { id: 'motor', label: 'Moteur électrique', icon: 'flash' },
    { id: 'pump', label: 'Pompe hydraulique', icon: 'water' },
    { id: 'conveyor', label: 'Convoyeur', icon: 'trending-up' },
    { id: 'crane', label: 'Grue portuaire', icon: 'construct' },
    { id: 'generator', label: 'Générateur', icon: 'battery-charging' },
    { id: 'compressor', label: 'Compresseur', icon: 'resize' },
  ];

  const symptomsList = [
    { id: 'vibration', label: 'Vibrations anormales', category: 'mechanical' },
    { id: 'noise', label: 'Bruit inhabituel', category: 'mechanical' },
    { id: 'temperature', label: 'Température élevée', category: 'thermal' },
    { id: 'leak', label: 'Fuite d\'huile/fluide', category: 'fluid' },
    { id: 'performance', label: 'Baisse de performance', category: 'performance' },
    { id: 'electrical', label: 'Problème électrique', category: 'electrical' },
    { id: 'wear', label: 'Usure visible', category: 'mechanical' },
    { id: 'corrosion', label: 'Corrosion', category: 'environmental' },
  ];

  const urgencyLevels = [
    { id: 'low', label: 'Faible', color: '#10b981' },
    { id: 'medium', label: 'Moyenne', color: '#f59e0b' },
    { id: 'high', label: 'Élevée', color: '#ef4444' },
    { id: 'critical', label: 'Critique', color: '#dc2626' },
  ];

  const mlModes = [
    { id: 'standard', label: 'Standard', description: 'Analyse rapide et fiable' },
    { id: 'advanced', label: 'Avancé', description: 'IA approfondie avec réseaux de neurones' },
    { id: 'ensemble', label: 'Ensemble ML', description: 'Consensus de 9 algorithmes' },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    section: {
      marginBottom: 25,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 15,
    },
    input: {
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      paddingHorizontal: 15,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    equipmentGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    equipmentCard: {
      width: '48%',
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      padding: 15,
      marginBottom: 10,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    equipmentCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}15`,
    },
    equipmentIcon: {
      marginBottom: 8,
    },
    equipmentLabel: {
      fontSize: 14,
      color: theme.colors.text,
      textAlign: 'center',
    },
    symptomsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    symptomChip: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      paddingHorizontal: 15,
      paddingVertical: 8,
      marginRight: 10,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    symptomChipSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    symptomText: {
      fontSize: 14,
      color: theme.colors.text,
    },
    symptomTextSelected: {
      color: 'white',
    },
    urgencyContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    urgencyButton: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      paddingVertical: 12,
      marginHorizontal: 3,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    urgencyButtonSelected: {
      borderWidth: 2,
    },
    urgencyText: {
      fontSize: 14,
      fontWeight: '500',
    },
    mlModeCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      padding: 15,
      marginBottom: 10,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    mlModeCardSelected: {
      borderColor: theme.colors.primary,
      backgroundColor: `${theme.colors.primary}15`,
    },
    mlModeTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 5,
    },
    mlModeDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    analyzeButton: {
      borderRadius: 15,
      overflow: 'hidden',
      marginTop: 20,
      marginBottom: 20,
    },
    analyzeGradient: {
      paddingVertical: 15,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    analyzeButtonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: 'bold',
      marginLeft: 10,
    },
    resultsContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: 15,
      padding: 20,
      marginBottom: 20,
    },
    resultsTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 15,
    },
    suggestion: {
      backgroundColor: theme.colors.background,
      borderRadius: 10,
      padding: 15,
      marginBottom: 10,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
    },
    suggestionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 5,
    },
    suggestionText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 10,
    },
    metricRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    metricItem: {
      alignItems: 'center',
    },
    metricValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.primary,
    },
    metricLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 15,
    },
    actionButton: {
      flex: 1,
      backgroundColor: theme.colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      marginHorizontal: 5,
      alignItems: 'center',
    },
    actionButtonSecondary: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '500',
    },
    actionButtonTextSecondary: {
      color: theme.colors.text,
    },
  });

  const handleEquipmentSelect = (equipmentId: string) => {
    setFormData({ ...formData, equipmentType: equipmentId });
  };

  const handleSymptomToggle = (symptomId: string) => {
    const updatedSymptoms = formData.symptoms.includes(symptomId)
      ? formData.symptoms.filter(s => s !== symptomId)
      : [...formData.symptoms, symptomId];
    
    setFormData({ ...formData, symptoms: updatedSymptoms });
  };

  const handleAnalyze = async () => {
    if (!formData.equipmentType || formData.symptoms.length === 0) {
      Alert.alert('Données incomplètes', 'Veuillez sélectionner un type d\'équipement et au moins un symptôme.');
      return;
    }

    setLoading(true);
    try {
      const result = await apiService.performDiagnostic(formData);
      setResults(result);
      
      // Save diagnostic to local database
      await apiService.saveDiagnosticOffline({
        ...formData,
        suggestions: result.suggestions,
        confidenceScore: result.confidenceScore,
        riskLevel: result.riskLevel,
        estimatedCost: result.estimatedCost,
      });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de réaliser le diagnostic. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRepair = () => {
    if (results) {
      navigation.navigate('RepairGuidance' as never, { 
        diagnostic: results,
        equipmentType: formData.equipmentType 
      } as never);
    }
  };

  const handleProvideFeedback = () => {
    if (results) {
      navigation.navigate('Feedback' as never, { 
        diagnostic: results 
      } as never);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Equipment Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Type d'équipement</Text>
          <View style={styles.equipmentGrid}>
            {equipmentTypes.map((equipment) => (
              <TouchableOpacity
                key={equipment.id}
                style={[
                  styles.equipmentCard,
                  formData.equipmentType === equipment.id && styles.equipmentCardSelected
                ]}
                onPress={() => handleEquipmentSelect(equipment.id)}
              >
                <Ionicons
                  name={equipment.icon as any}
                  size={24}
                  color={formData.equipmentType === equipment.id ? theme.colors.primary : theme.colors.textSecondary}
                  style={styles.equipmentIcon}
                />
                <Text style={styles.equipmentLabel}>{equipment.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Equipment ID */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ID Équipement (optionnel)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: MOT-001, PUMP-A23..."
            placeholderTextColor={theme.colors.textSecondary}
            value={formData.equipmentId}
            onChangeText={(text) => setFormData({ ...formData, equipmentId: text })}
          />
        </View>

        {/* Symptoms Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Symptômes observés</Text>
          <View style={styles.symptomsContainer}>
            {symptomsList.map((symptom) => (
              <TouchableOpacity
                key={symptom.id}
                style={[
                  styles.symptomChip,
                  formData.symptoms.includes(symptom.id) && styles.symptomChipSelected
                ]}
                onPress={() => handleSymptomToggle(symptom.id)}
              >
                <Text style={[
                  styles.symptomText,
                  formData.symptoms.includes(symptom.id) && styles.symptomTextSelected
                ]}>
                  {symptom.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Urgency Level */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Niveau d'urgence</Text>
          <View style={styles.urgencyContainer}>
            {urgencyLevels.map((level) => (
              <TouchableOpacity
                key={level.id}
                style={[
                  styles.urgencyButton,
                  formData.urgencyLevel === level.id && {
                    ...styles.urgencyButtonSelected,
                    borderColor: level.color,
                    backgroundColor: `${level.color}15`,
                  }
                ]}
                onPress={() => setFormData({ ...formData, urgencyLevel: level.id })}
              >
                <Text style={[
                  styles.urgencyText,
                  { color: formData.urgencyLevel === level.id ? level.color : theme.colors.text }
                ]}>
                  {level.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ML Mode Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mode d'analyse IA</Text>
          {mlModes.map((mode) => (
            <TouchableOpacity
              key={mode.id}
              style={[
                styles.mlModeCard,
                formData.mlMode === mode.id && styles.mlModeCardSelected
              ]}
              onPress={() => setFormData({ ...formData, mlMode: mode.id })}
            >
              <Text style={styles.mlModeTitle}>{mode.label}</Text>
              <Text style={styles.mlModeDescription}>{mode.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Analyze Button */}
        <TouchableOpacity
          style={styles.analyzeButton}
          onPress={handleAnalyze}
          disabled={loading}
        >
          <LinearGradient
            colors={['#1e40af', '#3b82f6']}
            style={styles.analyzeGradient}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Ionicons name="search" size={20} color="white" />
            )}
            <Text style={styles.analyzeButtonText}>
              {loading ? 'Analyse en cours...' : 'Lancer le diagnostic IA'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Results */}
        {results && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Résultats du diagnostic</Text>
            
            {results.suggestions.map((suggestion: any, index: number) => (
              <View key={index} style={styles.suggestion}>
                <Text style={styles.suggestionTitle}>{suggestion.issue}</Text>
                <Text style={styles.suggestionText}>{suggestion.solution}</Text>
                
                <View style={styles.metricRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>
                      {Math.round(results.confidenceScore * 100)}%
                    </Text>
                    <Text style={styles.metricLabel}>Confiance</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{results.riskLevel}</Text>
                    <Text style={styles.metricLabel}>Risque</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>{results.estimatedCost}€</Text>
                    <Text style={styles.metricLabel}>Coût estimé</Text>
                  </View>
                </View>
              </View>
            ))}

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleStartRepair}
              >
                <Text style={styles.actionButtonText}>Guide de réparation</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={handleProvideFeedback}
              >
                <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                  Évaluer
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default DiagnosticScreen;
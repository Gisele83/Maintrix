import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { 
  Card, 
  Text, 
  Button, 
  RadioButton, 
  Checkbox, 
  TextInput, 
  Surface,
  ProgressBar,
  Chip
} from 'react-native-paper';
import { useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDatabase } from '../providers/DatabaseProvider';
import { useOffline } from '../providers/OfflineProvider';

interface DiagnosticResult {
  diagnosis: string;
  confidence: number;
  solution: string;
  urgency: 'low' | 'medium' | 'high';
  estimatedTime: number;
}

export default function DiagnosticScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { db } = useDatabase();
  const { isConnected } = useOffline();

  const [currentStep, setCurrentStep] = useState(1);
  const [equipmentType, setEquipmentType] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);

  const equipmentTypes = [
    { value: 'moteur', label: 'Moteur Principal', icon: 'engine' },
    { value: 'pompe', label: 'Pompe Hydraulique', icon: 'pump' },
    { value: 'compresseur', label: 'Compresseur', icon: 'air-purifier' },
    { value: 'grue', label: 'Grue', icon: 'crane' },
    { value: 'transformateur', label: 'Transformateur', icon: 'electric-switch' },
    { value: 'convoyeur', label: 'Convoyeur', icon: 'conveyor-belt' }
  ];

  const commonSymptoms = {
    moteur: [
      'Vibrations anormales',
      'Surchauffe',
      'Bruit inhabituel',
      'Perte de puissance',
      'Fumée visible',
      'Arrêts inattendus'
    ],
    pompe: [
      'Pression insuffisante',
      'Fuite d\'huile',
      'Bruit de cavitation',
      'Surchauffe',
      'Vibrations',
      'Débit réduit'
    ],
    compresseur: [
      'Pression d\'air faible',
      'Surchauffe',
      'Bruit métallique',
      'Fuites d\'air',
      'Consommation excessive',
      'Arrêts fréquents'
    ],
    grue: [
      'Mouvement saccadé',
      'Bruit de freinage',
      'Câble endommagé',
      'Perte de capacité',
      'Oscillations',
      'Problème de direction'
    ],
    transformateur: [
      'Surchauffe',
      'Bruit de ronronnement',
      'Décharge électrique',
      'Fumée',
      'Variation de tension',
      'Isolation défaillante'
    ],
    convoyeur: [
      'Courroie qui glisse',
      'Alignement défectueux',
      'Bruit de roulement',
      'Arrêts fréquents',
      'Vitesse irrégulière',
      'Accumulation de matière'
    ]
  };

  const performOfflineDiagnostic = async (): Promise<DiagnosticResult[]> => {
    return new Promise((resolve) => {
      if (!db) {
        resolve([]);
        return;
      }

      const symptomsText = [...symptoms, customSymptom].filter(Boolean).join(', ');
      
      db.transaction((tx) => {
        tx.executeSql(
          `SELECT * FROM maintenance_cases 
           WHERE equipment_type = ? 
           AND (symptoms LIKE ? OR symptoms LIKE ? OR symptoms LIKE ?)
           ORDER BY confidence DESC LIMIT 3`,
          [
            equipmentType,
            `%${symptoms[0]}%`,
            `%${symptoms[1] || symptoms[0]}%`,
            `%${customSymptom}%`
          ],
          (_, { rows }) => {
            const results: DiagnosticResult[] = [];
            for (let i = 0; i < rows.length; i++) {
              const row = rows.item(i);
              results.push({
                diagnosis: row.diagnosis,
                confidence: row.confidence || 0.8,
                solution: row.solution,
                urgency: row.urgency || 'medium',
                estimatedTime: 60
              });
            }

            if (results.length === 0) {
              // Provide generic result if no match found
              results.push({
                diagnosis: `Problème détecté sur ${equipmentType}`,
                confidence: 0.6,
                solution: 'Inspection approfondie recommandée. Vérifier les composants principaux.',
                urgency: urgency as 'low' | 'medium' | 'high',
                estimatedTime: 90
              });
            }

            resolve(results);
          },
          (_, error) => {
            console.error('Database query error:', error);
            resolve([]);
            return false;
          }
        );
      });
    });
  };

  const performOnlineDiagnostic = async (): Promise<DiagnosticResult[]> => {
    // This would call the web app's diagnostic API
    try {
      const response = await fetch('https://your-server.com/api/diagnostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentType,
          symptoms: [...symptoms, customSymptom].filter(Boolean),
          urgency
        })
      });
      return await response.json();
    } catch (error) {
      console.error('Online diagnostic error:', error);
      return [];
    }
  };

  const runDiagnostic = async () => {
    setIsAnalyzing(true);
    try {
      let diagnosticResults: DiagnosticResult[];
      
      if (isConnected) {
        diagnosticResults = await performOnlineDiagnostic();
        if (diagnosticResults.length === 0) {
          diagnosticResults = await performOfflineDiagnostic();
        }
      } else {
        diagnosticResults = await performOfflineDiagnostic();
      }

      setResults(diagnosticResults);
      
      // Save diagnostic session
      if (db) {
        db.transaction((tx) => {
          tx.executeSql(
            'INSERT INTO diagnostic_sessions (equipment_type, symptoms, results, confidence) VALUES (?, ?, ?, ?)',
            [
              equipmentType,
              [...symptoms, customSymptom].filter(Boolean).join(', '),
              JSON.stringify(diagnosticResults),
              diagnosticResults[0]?.confidence || 0.5
            ]
          );
        });
      }

      setCurrentStep(4);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de réaliser le diagnostic');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSymptomToggle = (symptom: string) => {
    if (symptoms.includes(symptom)) {
      setSymptoms(symptoms.filter(s => s !== symptom));
    } else {
      setSymptoms([...symptoms, symptom]);
    }
  };

  const startNewDiagnostic = () => {
    setCurrentStep(1);
    setEquipmentType('');
    setSymptoms([]);
    setCustomSymptom('');
    setUrgency('medium');
    setResults([]);
  };

  const viewRepairGuide = (result: DiagnosticResult) => {
    navigation.navigate('RepairSteps', {
      diagnosis: result.diagnosis,
      solution: result.solution,
      equipmentType
    });
  };

  const renderStepIndicator = () => (
    <Surface style={styles.stepIndicator}>
      {[1, 2, 3, 4].map((step) => (
        <View key={step} style={styles.stepItem}>
          <View style={[
            styles.stepCircle,
            { 
              backgroundColor: step <= currentStep ? theme.colors.primary : theme.colors.outline,
            }
          ]}>
            <Text style={{ 
              color: step <= currentStep ? theme.colors.onPrimary : theme.colors.onSurface,
              fontWeight: 'bold' 
            }}>
              {step}
            </Text>
          </View>
          {step < 4 && (
            <View style={[
              styles.stepLine,
              { backgroundColor: step < currentStep ? theme.colors.primary : theme.colors.outline }
            ]} />
          )}
        </View>
      ))}
    </Surface>
  );

  const renderEquipmentSelection = () => (
    <Card style={styles.stepCard}>
      <Card.Content>
        <Text variant="headlineSmall" style={styles.stepTitle}>
          Sélectionnez l'équipement
        </Text>
        <View style={styles.equipmentGrid}>
          {equipmentTypes.map((equipment) => (
            <Card 
              key={equipment.value}
              style={[
                styles.equipmentCard,
                equipmentType === equipment.value && { 
                  backgroundColor: theme.colors.primaryContainer 
                }
              ]}
              onPress={() => setEquipmentType(equipment.value)}
            >
              <Card.Content style={styles.equipmentContent}>
                <Icon 
                  name={equipment.icon} 
                  size={32} 
                  color={equipmentType === equipment.value ? theme.colors.primary : theme.colors.onSurface} 
                />
                <Text style={[
                  styles.equipmentLabel,
                  { color: equipmentType === equipment.value ? theme.colors.primary : theme.colors.onSurface }
                ]}>
                  {equipment.label}
                </Text>
              </Card.Content>
            </Card>
          ))}
        </View>
        <Button
          mode="contained"
          onPress={() => setCurrentStep(2)}
          disabled={!equipmentType}
          style={styles.nextButton}
        >
          Suivant
        </Button>
      </Card.Content>
    </Card>
  );

  const renderSymptomSelection = () => (
    <Card style={styles.stepCard}>
      <Card.Content>
        <Text variant="headlineSmall" style={styles.stepTitle}>
          Sélectionnez les symptômes observés
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Équipement: {equipmentTypes.find(eq => eq.value === equipmentType)?.label}
        </Text>
        
        <View style={styles.symptomsContainer}>
          {commonSymptoms[equipmentType as keyof typeof commonSymptoms]?.map((symptom) => (
            <Chip
              key={symptom}
              selected={symptoms.includes(symptom)}
              onPress={() => handleSymptomToggle(symptom)}
              style={styles.symptomChip}
            >
              {symptom}
            </Chip>
          ))}
        </View>

        <TextInput
          label="Autre symptôme (optionnel)"
          value={customSymptom}
          onChangeText={setCustomSymptom}
          style={styles.customInput}
          multiline
        />

        <Text variant="titleMedium" style={styles.urgencyTitle}>
          Niveau d'urgence
        </Text>
        <RadioButton.Group value={urgency} onValueChange={setUrgency}>
          {[
            { value: 'low', label: 'Faible - Maintenance préventive', color: '#16a34a' },
            { value: 'medium', label: 'Moyen - Intervention programmée', color: '#d97706' },
            { value: 'high', label: 'Élevé - Intervention immédiate', color: '#dc2626' }
          ].map((option) => (
            <View key={option.value} style={styles.radioItem}>
              <RadioButton value={option.value} />
              <Text style={{ color: option.color, flex: 1 }}>
                {option.label}
              </Text>
            </View>
          ))}
        </RadioButton.Group>

        <View style={styles.buttonRow}>
          <Button
            mode="outlined"
            onPress={() => setCurrentStep(1)}
            style={styles.backButton}
          >
            Retour
          </Button>
          <Button
            mode="contained"
            onPress={() => setCurrentStep(3)}
            disabled={symptoms.length === 0 && !customSymptom}
            style={styles.nextButton}
          >
            Suivant
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  const renderConfirmation = () => (
    <Card style={styles.stepCard}>
      <Card.Content>
        <Text variant="headlineSmall" style={styles.stepTitle}>
          Confirmation du diagnostic
        </Text>
        
        <Surface style={styles.summaryCard}>
          <Text variant="titleMedium" style={styles.summaryTitle}>
            Résumé
          </Text>
          <Text variant="bodyMedium">
            <Text style={{ fontWeight: 'bold' }}>Équipement:</Text> {equipmentTypes.find(eq => eq.value === equipmentType)?.label}
          </Text>
          <Text variant="bodyMedium" style={{ marginTop: 8 }}>
            <Text style={{ fontWeight: 'bold' }}>Symptômes:</Text> {[...symptoms, customSymptom].filter(Boolean).join(', ')}
          </Text>
          <Text variant="bodyMedium" style={{ marginTop: 8 }}>
            <Text style={{ fontWeight: 'bold' }}>Urgence:</Text> {
              urgency === 'low' ? 'Faible' : 
              urgency === 'medium' ? 'Moyen' : 'Élevé'
            }
          </Text>
        </Surface>

        <View style={styles.diagnosticMode}>
          <Icon 
            name={isConnected ? 'cloud-check' : 'database'} 
            size={24} 
            color={theme.colors.primary} 
          />
          <Text style={{ marginLeft: 8, color: theme.colors.primary }}>
            Mode {isConnected ? 'en ligne (IA avancée)' : 'hors-ligne (base locale)'}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <Button
            mode="outlined"
            onPress={() => setCurrentStep(2)}
            style={styles.backButton}
          >
            Retour
          </Button>
          <Button
            mode="contained"
            onPress={runDiagnostic}
            disabled={isAnalyzing}
            style={styles.nextButton}
          >
            {isAnalyzing ? 'Analyse...' : 'Diagnostiquer'}
          </Button>
        </View>

        {isAnalyzing && (
          <ProgressBar indeterminate style={styles.progressBar} />
        )}
      </Card.Content>
    </Card>
  );

  const renderResults = () => (
    <View>
      <Text variant="headlineSmall" style={styles.stepTitle}>
        Résultats du diagnostic
      </Text>
      
      {results.map((result, index) => (
        <Card key={index} style={[styles.resultCard, index === 0 && styles.primaryResult]}>
          <Card.Content>
            <View style={styles.resultHeader}>
              <Text variant="titleMedium" style={styles.diagnosisTitle}>
                {result.diagnosis}
              </Text>
              <Chip 
                style={[
                  styles.confidenceChip,
                  { backgroundColor: result.confidence > 0.8 ? '#dcfce7' : result.confidence > 0.6 ? '#fef3c7' : '#fee2e2' }
                ]}
              >
                {Math.round(result.confidence * 100)}%
              </Chip>
            </View>
            
            <Text variant="bodyMedium" style={styles.solution}>
              {result.solution}
            </Text>
            
            <View style={styles.resultMeta}>
              <View style={styles.metaItem}>
                <Icon name="clock" size={16} color={theme.colors.onSurfaceVariant} />
                <Text style={styles.metaText}>
                  ~{result.estimatedTime} min
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Icon 
                  name="alert" 
                  size={16} 
                  color={result.urgency === 'high' ? '#dc2626' : result.urgency === 'medium' ? '#d97706' : '#16a34a'} 
                />
                <Text style={[
                  styles.metaText,
                  { color: result.urgency === 'high' ? '#dc2626' : result.urgency === 'medium' ? '#d97706' : '#16a34a' }
                ]}>
                  {result.urgency === 'high' ? 'Urgent' : result.urgency === 'medium' ? 'Normal' : 'Faible'}
                </Text>
              </View>
            </View>
            
            <Button
              mode="contained-tonal"
              onPress={() => viewRepairGuide(result)}
              style={styles.guideButton}
            >
              Voir le guide de réparation
            </Button>
          </Card.Content>
        </Card>
      ))}
      
      <Button
        mode="outlined"
        onPress={startNewDiagnostic}
        style={styles.newDiagnosticButton}
      >
        Nouveau diagnostic
      </Button>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {renderStepIndicator()}
        
        {currentStep === 1 && renderEquipmentSelection()}
        {currentStep === 2 && renderSymptomSelection()}
        {currentStep === 3 && renderConfirmation()}
        {currentStep === 4 && renderResults()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: 8,
  },
  stepCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  stepTitle: {
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  subtitle: {
    marginBottom: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  equipmentCard: {
    width: '48%',
    marginBottom: 12,
    borderRadius: 8,
  },
  equipmentContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  equipmentLabel: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  symptomsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  symptomChip: {
    margin: 4,
  },
  customInput: {
    marginBottom: 16,
  },
  urgencyTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  backButton: {
    flex: 0.4,
  },
  nextButton: {
    flex: 0.5,
  },
  summaryCard: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  summaryTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
  },
  diagnosticMode: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    justifyContent: 'center',
  },
  progressBar: {
    marginTop: 16,
  },
  resultCard: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
  },
  primaryResult: {
    borderLeftWidth: 4,
    borderLeftColor: '#16a34a',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  diagnosisTitle: {
    flex: 1,
    fontWeight: 'bold',
  },
  confidenceChip: {
    marginLeft: 8,
  },
  solution: {
    marginBottom: 12,
    lineHeight: 20,
  },
  resultMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    marginLeft: 4,
    fontSize: 12,
  },
  guideButton: {
    marginTop: 8,
  },
  newDiagnosticButton: {
    marginTop: 16,
    marginBottom: 20,
  },
});
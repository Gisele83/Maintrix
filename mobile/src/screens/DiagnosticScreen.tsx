import React, { useState, useContext } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Card,
  TextInput,
  Button,
  Chip,
  Text,
  RadioButton,
  Portal,
  Modal,
  List,
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { OfflineContext } from '../context/OfflineContext';
import { performDiagnosis } from '../services/DiagnosticService';
import { saveDiagnosticSession } from '../services/OfflineStorage';

const EQUIPMENT_TYPES = [
  'Moteur', 'Pompe', 'Compresseur', 'Convoyeur', 
  'Variateur', 'Capteur', 'Automate', 'Autre'
];

const SYMPTOM_CATEGORIES = {
  'Mécanique': [
    'Vibrations anormales', 'Bruit excessif', 'Blocage mécanique',
    'Usure visible', 'Jeu mécanique', 'Désalignement'
  ],
  'Thermique': [
    'Surchauffe', 'Température anormale', 'Refroidissement insuffisant',
    'Échauffement localisé'
  ],
  'Électrique': [
    'Coupure électrique', 'Court-circuit', 'Tension anormale',
    'Étincelles', 'Défaut isolement'
  ],
  'Fluide': [
    'Fuite hydraulique', 'Perte de pression', 'Débit insuffisant',
    'Contamination fluide'
  ],
  'Performance': [
    'Vitesse anormale', 'Rendement dégradé', 'Arrêts fréquents',
    'Fonctionnement irrégulier'
  ]
};

export function DiagnosticScreen({ navigation }: any) {
  const { isOnline } = useContext(OfflineContext);
  const [equipmentType, setEquipmentType] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [urgency, setUrgency] = useState('medium');
  const [zone, setZone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSymptomModal, setShowSymptomModal] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string>('');

  const handleSymptomToggle = (symptom: string) => {
    setSelectedSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const handleDiagnosis = async () => {
    if (!equipmentType || !symptoms.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    setLoading(true);
    try {
      const diagnosticData = {
        equipmentType: equipmentType.toLowerCase(),
        symptoms,
        symptomsChecked: selectedSymptoms,
        urgency,
        zone,
        sector: 'mobile_diagnostic',
      };

      const result = await performDiagnosis(diagnosticData, isOnline);
      
      // Sauvegarder la session hors ligne
      await saveDiagnosticSession({
        ...diagnosticData,
        timestamp: new Date().toISOString(),
        results: result.suggestions,
        sessionId: `mobile_${Date.now()}`,
      });

      // Naviguer vers les résultats
      navigation.navigate('RepairGuidance', { 
        suggestions: result.suggestions,
        diagnosticData,
        isOffline: !isOnline
      });
      
    } catch (error) {
      Alert.alert('Erreur', 'Diagnostic impossible. Vérifiez votre connexion ou utilisez le mode hors ligne.');
    } finally {
      setLoading(false);
    }
  };

  const openCamera = () => {
    navigation.navigate('Camera');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView}>
        <Card style={styles.card}>
          <Card.Title 
            title="Nouveau Diagnostic"
            subtitle={isOnline ? "Mode en ligne" : "Mode hors ligne"}
            left={(props) => <Icon {...props} name="search" size={24} />}
            right={(props) => (
              <Icon 
                {...props} 
                name={isOnline ? "wifi" : "wifi-off"} 
                size={24} 
                color={isOnline ? "green" : "orange"}
              />
            )}
          />
          <Card.Content>
            {/* Type d'équipement */}
            <Text style={styles.label}>Type d'équipement *</Text>
            <View style={styles.chipContainer}>
              {EQUIPMENT_TYPES.map(type => (
                <Chip
                  key={type}
                  selected={equipmentType === type}
                  onPress={() => setEquipmentType(type)}
                  style={styles.chip}
                >
                  {type}
                </Chip>
              ))}
            </View>

            {/* Description des symptômes */}
            <TextInput
              label="Description des symptômes *"
              value={symptoms}
              onChangeText={setSymptoms}
              multiline
              numberOfLines={3}
              style={styles.textInput}
              placeholder="Décrivez le problème observé..."
            />

            {/* Symptômes prédéfinis */}
            <View style={styles.symptomSection}>
              <Text style={styles.label}>Symptômes observés</Text>
              <Button
                mode="outlined"
                onPress={() => setShowSymptomModal(true)}
                icon="playlist-add"
                style={styles.symptomButton}
              >
                Sélectionner ({selectedSymptoms.length})
              </Button>
              
              {selectedSymptoms.length > 0 && (
                <View style={styles.selectedSymptoms}>
                  {selectedSymptoms.map(symptom => (
                    <Chip
                      key={symptom}
                      onClose={() => handleSymptomToggle(symptom)}
                      style={styles.selectedChip}
                    >
                      {symptom}
                    </Chip>
                  ))}
                </View>
              )}
            </View>

            {/* Niveau d'urgence */}
            <Text style={styles.label}>Niveau d'urgence</Text>
            <RadioButton.Group
              onValueChange={setUrgency}
              value={urgency}
            >
              <View style={styles.radioContainer}>
                <RadioButton.Item label="Faible" value="low" />
                <RadioButton.Item label="Moyen" value="medium" />
                <RadioButton.Item label="Élevé" value="high" />
              </View>
            </RadioButton.Group>

            {/* Zone/Localisation */}
            <TextInput
              label="Zone/Localisation"
              value={zone}
              onChangeText={setZone}
              style={styles.textInput}
              placeholder="Ex: Ligne 1, Atelier A..."
            />

            {/* Boutons d'action */}
            <View style={styles.actionButtons}>
              <Button
                mode="outlined"
                onPress={openCamera}
                icon="camera"
                style={styles.actionButton}
              >
                Photo
              </Button>
              
              <Button
                mode="contained"
                onPress={handleDiagnosis}
                loading={loading}
                disabled={loading}
                icon="search"
                style={styles.actionButton}
              >
                Diagnostic
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* Modal de sélection des symptômes */}
      <Portal>
        <Modal
          visible={showSymptomModal}
          onDismiss={() => setShowSymptomModal(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>Sélectionner les symptômes</Text>
          <ScrollView style={styles.modalScroll}>
            {Object.entries(SYMPTOM_CATEGORIES).map(([category, symptoms]) => (
              <List.Accordion
                key={category}
                title={category}
                expanded={expandedCategory === category}
                onPress={() => setExpandedCategory(
                  expandedCategory === category ? '' : category
                )}
              >
                {symptoms.map(symptom => (
                  <List.Item
                    key={symptom}
                    title={symptom}
                    onPress={() => handleSymptomToggle(symptom)}
                    right={() => (
                      selectedSymptoms.includes(symptom) ? 
                        <Icon name="check" size={24} color="green" /> : null
                    )}
                  />
                ))}
              </List.Accordion>
            ))}
          </ScrollView>
          <Button
            mode="contained"
            onPress={() => setShowSymptomModal(false)}
            style={styles.modalButton}
          >
            Fermer
          </Button>
        </Modal>
      </Portal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  chip: {
    margin: 4,
  },
  textInput: {
    marginBottom: 16,
  },
  symptomSection: {
    marginBottom: 16,
  },
  symptomButton: {
    marginBottom: 8,
  },
  selectedSymptoms: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  selectedChip: {
    margin: 2,
  },
  radioContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalButton: {
    marginTop: 16,
  },
});
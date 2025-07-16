import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import {
  Button,
  Card,
  Surface,
  ActivityIndicator,
  Portal,
  Modal,
  TextInput,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { launchImageLibrary } from 'react-native-image-picker';

import { theme, spacing, typography, gradients } from '../theme/theme';
import { useOffline } from '../context/OfflineContext';
import { RootStackParamList } from '../navigation/AppNavigator';

// Mock QR scanner since react-native-qrcode-scanner requires camera setup
const QRCodeScanner = ({ onRead, showMarker, containerStyle, cameraStyle }: any) => {
  useEffect(() => {
    // Simulate QR code scanning after 3 seconds
    const timer = setTimeout(() => {
      onRead({
        data: 'EQUIPMENT_ID_12345|TYPE_MOTEUR|ZONE_ATELIER_A|SECTOR_LIGNE_1'
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [onRead]);

  return (
    <View style={[containerStyle, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: '#fff', fontSize: 16 }}>Simulation Scanner QR</Text>
      <Text style={{ color: '#fff', fontSize: 12, marginTop: 8 }}>Scanning automatique en 3s...</Text>
      <ActivityIndicator color="#fff" size="large" style={{ marginTop: 20 }} />
    </View>
  );
};

type ScannerScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'>;

export function ScannerScreen() {
  const navigation = useNavigation<ScannerScreenNavigationProp>();
  const { isOnline } = useOffline();
  
  const [scanning, setScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scannedData, setScannedData] = useState<any>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualEquipmentId, setManualEquipmentId] = useState('');
  const [flashOn, setFlashOn] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      requestCameraPermission();
    }, [])
  );

  const requestCameraPermission = async () => {
    try {
      const permission = Platform.OS === 'ios' 
        ? PERMISSIONS.IOS.CAMERA 
        : PERMISSIONS.ANDROID.CAMERA;
      
      const result = await request(permission);
      setHasPermission(result === RESULTS.GRANTED);
    } catch (error) {
      console.error('Permission error:', error);
      setHasPermission(false);
    }
  };

  const handleQRScan = (e: any) => {
    if (scanning) return;
    
    setScanning(true);
    try {
      const data = e.data;
      const parts = data.split('|');
      
      if (parts.length >= 4) {
        const equipmentData = {
          equipmentId: parts[0].replace('EQUIPMENT_ID_', ''),
          type: parts[1].replace('TYPE_', ''),
          zone: parts[2].replace('ZONE_', ''),
          sector: parts[3].replace('SECTOR_', ''),
        };
        
        setScannedData(equipmentData);
        setScanning(false);
        
        Alert.alert(
          'Équipement Scanné',
          `ID: ${equipmentData.equipmentId}\nType: ${equipmentData.type}\nZone: ${equipmentData.zone}\nSecteur: ${equipmentData.sector}`,
          [
            { text: 'Annuler', onPress: () => setScannedData(null) },
            { text: 'Diagnostiquer', onPress: () => navigateToDiagnostic(equipmentData) }
          ]
        );
      } else {
        Alert.alert('Erreur', 'Format QR Code invalide');
        setScanning(false);
      }
    } catch (error) {
      console.error('Scan error:', error);
      Alert.alert('Erreur', 'Erreur lors du scan');
      setScanning(false);
    }
  };

  const navigateToDiagnostic = (equipmentData: any) => {
    navigation.navigate('MainTabs', { 
      screen: 'Diagnostic',
      params: { 
        equipmentData: {
          equipmentId: equipmentData.equipmentId,
          equipmentType: equipmentData.type,
          zone: equipmentData.zone,
          sector: equipmentData.sector,
        }
      }
    });
  };

  const handleManualInput = () => {
    if (!manualEquipmentId.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir un ID d\'équipement');
      return;
    }

    const equipmentData = {
      equipmentId: manualEquipmentId,
      type: 'inconnu',
      zone: 'non_definie',
      sector: 'non_defini',
    };

    setShowManualInput(false);
    setManualEquipmentId('');
    navigateToDiagnostic(equipmentData);
  };

  const handleImagePicker = () => {
    const options = {
      mediaType: 'photo' as const,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
    };

    launchImageLibrary(options, (response) => {
      if (response.assets && response.assets[0]) {
        Alert.alert(
          'Image sélectionnée',
          'Fonctionnalité de reconnaissance d\'image en développement',
          [{ text: 'OK' }]
        );
      }
    });
  };

  const resetScanner = () => {
    setScanning(false);
    setScannedData(null);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={gradients.primary} style={styles.header}>
          <Text style={styles.headerTitle}>Scanner QR</Text>
          <Text style={styles.headerSubtitle}>Demande d'autorisation caméra...</Text>
        </LinearGradient>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={gradients.primary} style={styles.header}>
          <Text style={styles.headerTitle}>Scanner QR</Text>
          <Text style={styles.headerSubtitle}>Autorisation caméra requise</Text>
        </LinearGradient>
        <View style={styles.centerContent}>
          <Surface style={styles.permissionCard}>
            <Icon name="camera-alt" size={48} color={theme.colors.error} />
            <Text style={styles.permissionTitle}>Caméra Non Autorisée</Text>
            <Text style={styles.permissionText}>
              Veuillez autoriser l'accès à la caméra dans les paramètres pour utiliser le scanner QR.
            </Text>
            <Button
              mode="contained"
              onPress={requestCameraPermission}
              style={styles.permissionButton}
              icon="camera"
            >
              Autoriser la Caméra
            </Button>
          </Surface>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.primary} style={styles.header}>
        <Text style={styles.headerTitle}>Scanner QR</Text>
        <Text style={styles.headerSubtitle}>
          Scannez le QR Code de l'équipement
        </Text>
        {!isOnline && (
          <Surface style={styles.offlineWarning}>
            <Icon name="wifi-off" size={16} color={theme.colors.warning} />
            <Text style={styles.offlineText}>Mode hors-ligne actif</Text>
          </Surface>
        )}
      </LinearGradient>

      <View style={styles.scannerContainer}>
        <QRCodeScanner
          onRead={handleQRScan}
          showMarker={true}
          containerStyle={styles.scanner}
          cameraStyle={styles.camera}
        />
        
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          
          <Text style={styles.scannerInstruction}>
            Centrez le QR Code dans le cadre
          </Text>
        </View>

        <View style={styles.scannerControls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setFlashOn(!flashOn)}
          >
            <Icon 
              name={flashOn ? "flash-on" : "flash-off"} 
              size={24} 
              color="#ffffff" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.controlButton}
            onPress={resetScanner}
          >
            <Icon name="refresh" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.alternativeOptions}>
        <Card style={styles.optionCard}>
          <Card.Content>
            <Text style={styles.optionTitle}>Options Alternatives</Text>
            <View style={styles.optionButtons}>
              <Button
                mode="outlined"
                onPress={() => setShowManualInput(true)}
                style={styles.optionButton}
                icon="keyboard"
              >
                Saisie Manuelle
              </Button>
              <Button
                mode="outlined"
                onPress={handleImagePicker}
                style={styles.optionButton}
                icon="image"
              >
                Depuis Image
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.helpCard}>
          <Card.Content>
            <Text style={styles.helpTitle}>💡 Aide</Text>
            <Text style={styles.helpText}>
              • Positionnez le QR Code dans le cadre{'\n'}
              • Assurez-vous d'avoir un bon éclairage{'\n'}
              • Maintenez l'appareil stable{'\n'}
              • Le scan se fait automatiquement
            </Text>
          </Card.Content>
        </Card>
      </View>

      {/* Manual Input Modal */}
      <Portal>
        <Modal
          visible={showManualInput}
          onDismiss={() => setShowManualInput(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Saisie Manuelle</Text>
          <TextInput
            label="ID Équipement"
            value={manualEquipmentId}
            onChangeText={setManualEquipmentId}
            style={styles.modalInput}
            placeholder="Ex: MOTOR_001, PUMP_A12"
          />
          <View style={styles.modalButtons}>
            <Button
              mode="outlined"
              onPress={() => setShowManualInput(false)}
              style={styles.modalButton}
            >
              Annuler
            </Button>
            <Button
              mode="contained"
              onPress={handleManualInput}
              style={styles.modalButton}
            >
              Valider
            </Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const { width, height } = Dimensions.get('window');

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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  permissionCard: {
    padding: spacing.xl,
    borderRadius: theme.roundness,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  permissionTitle: {
    ...typography.h3,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  permissionText: {
    ...typography.body1,
    textAlign: 'center',
    marginBottom: spacing.lg,
    color: theme.colors.secondary,
  },
  permissionButton: {
    paddingHorizontal: spacing.lg,
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
  },
  scanner: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: width * 0.7,
    height: width * 0.7,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: theme.colors.primary,
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scannerInstruction: {
    ...typography.body1,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: spacing.md,
    borderRadius: theme.roundness,
  },
  scannerControls: {
    position: 'absolute',
    bottom: spacing.lg,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alternativeOptions: {
    padding: spacing.md,
  },
  optionCard: {
    marginBottom: spacing.md,
  },
  optionTitle: {
    ...typography.h4,
    marginBottom: spacing.sm,
  },
  optionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  helpCard: {
    backgroundColor: theme.colors.primaryContainer,
  },
  helpTitle: {
    ...typography.h4,
    marginBottom: spacing.sm,
  },
  helpText: {
    ...typography.body2,
    color: theme.colors.secondary,
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: theme.roundness,
  },
  modalTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  modalInput: {
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
});
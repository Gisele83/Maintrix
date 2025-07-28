import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Camera, CameraType } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';

const QRScannerScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getCameraPermissions();
  }, []);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    processScannedData(data);
  };

  const processScannedData = (data: string) => {
    try {
      // Try to parse as JSON for detailed equipment info
      const equipmentData = JSON.parse(data);
      
      Alert.alert(
        'Équipement détecté',
        `Type: ${equipmentData.type || 'Non spécifié'}\nID: ${equipmentData.id || data}\nLocalisation: ${equipmentData.location || 'Non spécifiée'}`,
        [
          {
            text: 'Annuler',
            style: 'cancel',
            onPress: () => setScanned(false),
          },
          {
            text: 'Diagnostiquer',
            onPress: () => {
              navigation.navigate('Diagnostic' as never, {
                equipmentId: equipmentData.id || data,
                equipmentType: equipmentData.type || 'unknown',
                location: equipmentData.location,
              } as never);
            },
          },
        ]
      );
    } catch (error) {
      // Simple text/number code
      Alert.alert(
        'Code QR scanné',
        `ID d'équipement: ${data}`,
        [
          {
            text: 'Annuler',
            style: 'cancel',
            onPress: () => setScanned(false),
          },
          {
            text: 'Diagnostiquer',
            onPress: () => {
              navigation.navigate('Diagnostic' as never, {
                equipmentId: data,
                equipmentType: 'unknown',
              } as never);
            },
          },
        ]
      );
    }
  };

  const handleManualInput = () => {
    if (manualCode.trim()) {
      processScannedData(manualCode.trim());
      setShowManualInput(false);
      setManualCode('');
    } else {
      Alert.alert('Erreur', 'Veuillez saisir un code valide.');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    headerGradient: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 20,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: 'white',
      marginBottom: 5,
    },
    headerSubtitle: {
      fontSize: 14,
      color: 'rgba(255, 255, 255, 0.8)',
    },
    cameraContainer: {
      flex: 1,
      margin: 20,
      borderRadius: 20,
      overflow: 'hidden',
      position: 'relative',
    },
    camera: {
      flex: 1,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    scanArea: {
      position: 'absolute',
      top: '25%',
      left: '15%',
      right: '15%',
      bottom: '25%',
      borderWidth: 2,
      borderColor: '#10b981',
      borderRadius: 20,
      backgroundColor: 'transparent',
    },
    scanCorner: {
      position: 'absolute',
      width: 30,
      height: 30,
      borderColor: '#10b981',
      borderWidth: 4,
    },
    topLeft: {
      top: -2,
      left: -2,
      borderRightWidth: 0,
      borderBottomWidth: 0,
      borderTopLeftRadius: 20,
    },
    topRight: {
      top: -2,
      right: -2,
      borderLeftWidth: 0,
      borderBottomWidth: 0,
      borderTopRightRadius: 20,
    },
    bottomLeft: {
      bottom: -2,
      left: -2,
      borderRightWidth: 0,
      borderTopWidth: 0,
      borderBottomLeftRadius: 20,
    },
    bottomRight: {
      bottom: -2,
      right: -2,
      borderLeftWidth: 0,
      borderTopWidth: 0,
      borderBottomRightRadius: 20,
    },
    scanLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 2,
      backgroundColor: '#10b981',
      top: '50%',
    },
    instructionText: {
      position: 'absolute',
      bottom: 100,
      left: 20,
      right: 20,
      textAlign: 'center',
      color: 'white',
      fontSize: 16,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      paddingHorizontal: 20,
      paddingVertical: 15,
      borderRadius: 15,
    },
    controlsContainer: {
      position: 'absolute',
      bottom: 20,
      left: 20,
      right: 20,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    controlButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    controlButtonActive: {
      backgroundColor: theme.colors.primary,
      borderColor: 'white',
    },
    permissionContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    permissionIcon: {
      marginBottom: 20,
    },
    permissionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 10,
      textAlign: 'center',
    },
    permissionText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 30,
    },
    permissionButton: {
      backgroundColor: theme.colors.primary,
      borderRadius: 15,
      paddingHorizontal: 30,
      paddingVertical: 15,
    },
    permissionButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    actionButton: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 15,
      paddingVertical: 15,
      alignItems: 'center',
      marginHorizontal: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    actionButtonPrimary: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    actionButtonText: {
      fontSize: 16,
      color: theme.colors.text,
      fontWeight: '500',
      marginTop: 5,
    },
    actionButtonTextPrimary: {
      color: 'white',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: 30,
      margin: 20,
      width: '90%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    input: {
      backgroundColor: theme.colors.background,
      borderRadius: 10,
      paddingHorizontal: 15,
      paddingVertical: 12,
      fontSize: 16,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 20,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
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
      fontSize: 16,
      fontWeight: '500',
    },
    modalButtonTextSecondary: {
      color: theme.colors.text,
    },
  });

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1e40af', '#3b82f6']}
          style={styles.headerGradient}
        >
          <Text style={styles.headerTitle}>Scanner QR</Text>
          <Text style={styles.headerSubtitle}>Demande d'autorisation...</Text>
        </LinearGradient>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Demande d'accès à la caméra en cours...</Text>
        </View>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1e40af', '#3b82f6']}
          style={styles.headerGradient}
        >
          <Text style={styles.headerTitle}>Scanner QR</Text>
          <Text style={styles.headerSubtitle}>Autorisation requise</Text>
        </LinearGradient>
        <View style={styles.permissionContainer}>
          <Ionicons 
            name="camera-off" 
            size={64} 
            color={theme.colors.textSecondary}
            style={styles.permissionIcon}
          />
          <Text style={styles.permissionTitle}>Accès à la caméra requis</Text>
          <Text style={styles.permissionText}>
            Pour scanner les codes QR des équipements, nous avons besoin d'accéder à votre caméra. 
            Vous pouvez également saisir manuellement l'ID de l'équipement.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={() => Camera.requestCameraPermissionsAsync()}
          >
            <Text style={styles.permissionButtonText}>Autoriser l'accès</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1e40af', '#3b82f6']}
        style={styles.headerGradient}
      >
        <Text style={styles.headerTitle}>Scanner QR</Text>
        <Text style={styles.headerSubtitle}>Pointez vers le code QR de l'équipement</Text>
      </LinearGradient>

      <View style={styles.cameraContainer}>
        <Camera
          style={styles.camera}
          type={CameraType.back}
          flashMode={flashOn ? 'torch' : 'off'}
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          barCodeScannerSettings={{
            barCodeTypes: ['qr', 'pdf417'],
          }}
        >
          <View style={styles.overlay} />
          
          <View style={styles.scanArea}>
            <View style={[styles.scanCorner, styles.topLeft]} />
            <View style={[styles.scanCorner, styles.topRight]} />
            <View style={[styles.scanCorner, styles.bottomLeft]} />
            <View style={[styles.scanCorner, styles.bottomRight]} />
            <View style={styles.scanLine} />
          </View>

          <Text style={styles.instructionText}>
            Positionnez le code QR dans le cadre pour le scanner automatiquement
          </Text>

          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={[styles.controlButton, flashOn && styles.controlButtonActive]}
              onPress={() => setFlashOn(!flashOn)}
            >
              <Ionicons 
                name={flashOn ? 'flash' : 'flash-off'} 
                size={24} 
                color="white" 
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setScanned(false)}
            >
              <Ionicons name="refresh" size={24} color="white" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => setShowManualInput(true)}
            >
              <Ionicons name="keypad" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </Camera>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowManualInput(true)}
        >
          <Ionicons name="create" size={24} color={theme.colors.text} />
          <Text style={styles.actionButtonText}>Saisie manuelle</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={() => navigation.navigate('History' as never)}
        >
          <Ionicons name="time" size={24} color="white" />
          <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
            Historique
          </Text>
        </TouchableOpacity>
      </View>

      {/* Manual Input Modal */}
      <Modal
        visible={showManualInput}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowManualInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Saisie manuelle</Text>
            <Text style={styles.permissionText}>
              Saisissez l'ID ou le code de l'équipement :
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: MOT-001, PUMP-A23..."
              placeholderTextColor={theme.colors.textSecondary}
              value={manualCode}
              onChangeText={setManualCode}
              autoCapitalize="characters"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowManualInput(false);
                  setManualCode('');
                }}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>
                  Annuler
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleManualInput}
              >
                <Text style={styles.modalButtonText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default QRScannerScreen;
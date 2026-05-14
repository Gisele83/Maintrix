import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Dimensions } from 'react-native';
import { Card, Text, Button, Surface, FAB } from 'react-native-paper';
import { useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDatabase } from '../providers/DatabaseProvider';

const { width, height } = Dimensions.get('window');

interface Equipment {
  id: string;
  name: string;
  type: string;
  location: string;
  status: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
}

export default function EquipmentScannerScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { db } = useDatabase();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    getBarCodeScannerPermissions();
  }, []);

  const getBarCodeScannerPermissions = async () => {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setIsLoading(true);
    
    try {
      // First try to find equipment in local database
      const localEquipment = await findEquipmentLocally(data);
      
      if (localEquipment) {
        setEquipment(localEquipment);
      } else {
        // If not found locally, try to fetch from server or create new entry
        const serverEquipment = await findEquipmentOnServer(data);
        
        if (serverEquipment) {
          setEquipment(serverEquipment);
          // Save to local database for future offline use
          await saveEquipmentLocally(serverEquipment);
        } else {
          // Equipment not found, allow manual entry
          Alert.alert(
            'Équipement non trouvé',
            `Code QR: ${data}\n\nVoulez-vous créer une nouvelle entrée pour cet équipement ?`,
            [
              { text: 'Annuler', onPress: () => setScanned(false) },
              { text: 'Créer', onPress: () => createNewEquipment(data) }
            ]
          );
        }
      }
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de traiter le code QR scanné');
    } finally {
      setIsLoading(false);
    }
  };

  const findEquipmentLocally = async (qrCode: string): Promise<Equipment | null> => {
    return new Promise((resolve) => {
      if (!db) {
        resolve(null);
        return;
      }

      db.transaction((tx) => {
        tx.executeSql(
          'SELECT * FROM equipment WHERE qr_code = ? OR equipment_id = ?',
          [qrCode, qrCode],
          (_, { rows }) => {
            if (rows.length > 0) {
              const row = rows.item(0);
              resolve({
                id: row.equipment_id || row.id.toString(),
                name: row.name,
                type: row.type,
                location: row.location || 'Non spécifié',
                status: row.status,
                lastMaintenance: row.last_maintenance,
                nextMaintenance: row.next_maintenance
              });
            } else {
              resolve(null);
            }
          },
          (_, error) => {
            console.error('Error finding equipment locally:', error);
            resolve(null);
            return false;
          }
        );
      });
    });
  };

  const findEquipmentOnServer = async (qrCode: string): Promise<Equipment | null> => {
    try {
      const { getApiBaseUrl, fetchWithTimeout } = await import('../config/api.config');
      const apiBase = await getApiBaseUrl();
      const response = await fetchWithTimeout(`${apiBase}/equipment/qr/${encodeURIComponent(qrCode)}`, {}, 10000);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Error finding equipment on server:', error);
      return null;
    }
  };

  const saveEquipmentLocally = async (equipment: Equipment) => {
    if (!db) return;

    db.transaction((tx) => {
      tx.executeSql(
        `INSERT OR REPLACE INTO equipment 
         (equipment_id, name, type, location, status, last_maintenance, next_maintenance, qr_code) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          equipment.id,
          equipment.name,
          equipment.type,
          equipment.location,
          equipment.status,
          equipment.lastMaintenance,
          equipment.nextMaintenance,
          equipment.id // Use equipment ID as QR code
        ]
      );
    });
  };

  const createNewEquipment = (qrCode: string) => {
    // Navigate to equipment creation screen or show modal
    Alert.prompt(
      'Nouvel équipement',
      'Entrez le nom de l\'équipement:',
      [
        { text: 'Annuler', onPress: () => setScanned(false) },
        {
          text: 'Créer',
          onPress: (name) => {
            if (name) {
              const newEquipment: Equipment = {
                id: qrCode,
                name,
                type: 'Équipement générique',
                location: 'À définir',
                status: 'operational'
              };
              setEquipment(newEquipment);
              saveEquipmentLocally(newEquipment);
            } else {
              setScanned(false);
            }
          }
        }
      ]
    );
  };

  const startDiagnostic = () => {
    if (equipment) {
      navigation.navigate('Diagnostic', {
        preSelectedEquipment: equipment.type.toLowerCase(),
        equipmentId: equipment.id,
        equipmentName: equipment.name
      });
    }
  };

  const viewEquipmentDetails = () => {
    if (equipment) {
      navigation.navigate('EquipmentDetails', { equipment });
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setEquipment(null);
  };

  if (hasPermission === null) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Demande d'autorisation pour utiliser la caméra...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Icon name="camera-off" size={64} color={theme.colors.outline} />
        <Text style={styles.noPermissionText}>
          L'accès à la caméra est nécessaire pour scanner les codes QR
        </Text>
        <Button 
          mode="contained" 
          onPress={getBarCodeScannerPermissions}
          style={styles.permissionButton}
        >
          Autoriser l'accès
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {!scanned ? (
        <View style={styles.scannerContainer}>
          <BarCodeScanner
            onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
            style={styles.scanner}
          />
          
          {/* Scanner Overlay */}
          <View style={styles.overlay}>
            <View style={styles.scannerFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </View>

          {/* Instructions */}
          <Surface style={styles.instructionsCard}>
            <Text variant="titleMedium" style={styles.instructionsTitle}>
              Scannez un code QR d'équipement
            </Text>
            <Text variant="bodyMedium" style={styles.instructionsText}>
              Pointez votre caméra vers le code QR présent sur l'équipement
            </Text>
          </Surface>
        </View>
      ) : (
        <View style={styles.resultContainer}>
          {isLoading ? (
            <View style={[styles.centered, { flex: 1 }]}>
              <Icon name="loading" size={48} color={theme.colors.primary} />
              <Text style={{ marginTop: 16 }}>Recherche de l'équipement...</Text>
            </View>
          ) : equipment ? (
            <View style={styles.equipmentInfoContainer}>
              <Card style={styles.equipmentCard}>
                <Card.Content>
                  <View style={styles.equipmentHeader}>
                    <Icon 
                      name="cog" 
                      size={48} 
                      color={theme.colors.primary}
                    />
                    <View style={styles.equipmentTitleContainer}>
                      <Text variant="headlineSmall" style={styles.equipmentName}>
                        {equipment.name}
                      </Text>
                      <Text variant="bodyMedium" style={styles.equipmentType}>
                        {equipment.type}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.equipmentDetails}>
                    <View style={styles.detailRow}>
                      <Icon name="map-marker" size={20} color={theme.colors.onSurfaceVariant} />
                      <Text style={styles.detailText}>
                        {equipment.location}
                      </Text>
                    </View>

                    <View style={styles.detailRow}>
                      <Icon 
                        name={equipment.status === 'operational' ? 'check-circle' : 'alert-circle'} 
                        size={20} 
                        color={equipment.status === 'operational' ? '#16a34a' : '#dc2626'}
                      />
                      <Text style={[
                        styles.detailText,
                        { color: equipment.status === 'operational' ? '#16a34a' : '#dc2626' }
                      ]}>
                        {equipment.status === 'operational' ? 'Opérationnel' : 'Maintenance requise'}
                      </Text>
                    </View>

                    {equipment.lastMaintenance && (
                      <View style={styles.detailRow}>
                        <Icon name="wrench" size={20} color={theme.colors.onSurfaceVariant} />
                        <Text style={styles.detailText}>
                          Dernière maintenance: {new Date(equipment.lastMaintenance).toLocaleDateString('fr-FR')}
                        </Text>
                      </View>
                    )}

                    {equipment.nextMaintenance && (
                      <View style={styles.detailRow}>
                        <Icon name="calendar" size={20} color={theme.colors.onSurfaceVariant} />
                        <Text style={styles.detailText}>
                          Prochaine maintenance: {new Date(equipment.nextMaintenance).toLocaleDateString('fr-FR')}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.actionButtons}>
                    <Button
                      mode="contained"
                      onPress={startDiagnostic}
                      style={styles.actionButton}
                      icon="brain"
                    >
                      Diagnostiquer
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={viewEquipmentDetails}
                      style={styles.actionButton}
                      icon="information"
                    >
                      Détails
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            </View>
          ) : (
            <View style={[styles.centered, { flex: 1 }]}>
              <Icon name="alert-circle-outline" size={48} color={theme.colors.outline} />
              <Text style={{ marginTop: 16, textAlign: 'center' }}>
                Équipement non trouvé
              </Text>
            </View>
          )}

          <Button
            mode="outlined"
            onPress={resetScanner}
            style={styles.resetButton}
          >
            Scanner un autre code
          </Button>
        </View>
      )}

      {/* Manual Entry FAB */}
      <FAB
        icon="keyboard"
        style={[styles.fab, { backgroundColor: theme.colors.secondary }]}
        onPress={() => {
          Alert.prompt(
            'Saisie manuelle',
            'Entrez l\'ID de l\'équipement:',
            [
              { text: 'Annuler' },
              {
                text: 'Rechercher',
                onPress: (id) => {
                  if (id) {
                    handleBarCodeScanned({ type: 'manual', data: id });
                  }
                }
              }
            ]
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
  },
  scanner: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#ffffff',
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
  instructionsCard: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    padding: 20,
    borderRadius: 12,
  },
  instructionsTitle: {
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  instructionsText: {
    textAlign: 'center',
    opacity: 0.8,
  },
  resultContainer: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  equipmentInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  equipmentCard: {
    borderRadius: 12,
    elevation: 4,
  },
  equipmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  equipmentTitleContainer: {
    flex: 1,
    marginLeft: 16,
  },
  equipmentName: {
    fontWeight: 'bold',
  },
  equipmentType: {
    opacity: 0.7,
    marginTop: 4,
  },
  equipmentDetails: {
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    marginLeft: 12,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 0.48,
  },
  resetButton: {
    marginTop: 20,
  },
  noPermissionText: {
    textAlign: 'center',
    marginVertical: 20,
    fontSize: 16,
  },
  permissionButton: {
    marginTop: 20,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 28,
  },
});
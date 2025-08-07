import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Text, Button, Chip, Surface, Divider } from 'react-native-paper';
import { useTheme } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface Equipment {
  id: string;
  name: string;
  type: string;
  location: string;
  status: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
  specifications?: {
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    installationDate?: string;
    operatingHours?: number;
  };
}

export default function EquipmentDetailsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  
  const { equipment } = route.params as { equipment: Equipment };

  const [maintenanceHistory, setMaintenanceHistory] = useState([
    {
      id: 1,
      date: '2024-01-15',
      type: 'Maintenance préventive',
      description: 'Révision complète du système hydraulique',
      technician: 'Jean Dupont',
      status: 'completed'
    },
    {
      id: 2,
      date: '2024-01-10',
      type: 'Réparation',
      description: 'Remplacement du joint d\'étanchéité',
      technician: 'Marie Martin',
      status: 'completed'
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'operational': case 'opérationnel': return '#16a34a';
      case 'maintenance': case 'en maintenance': return '#d97706';
      case 'fault': case 'en panne': return '#dc2626';
      case 'offline': case 'hors service': return '#6b7280';
      default: return theme.colors.onSurfaceVariant;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'operational': return 'Opérationnel';
      case 'maintenance': return 'En maintenance';
      case 'fault': return 'En panne';
      case 'offline': return 'Hors service';
      default: return status;
    }
  };

  const startDiagnostic = () => {
    navigation.navigate('Diagnostic', {
      preSelectedEquipment: equipment.type.toLowerCase(),
      equipmentId: equipment.id,
      equipmentName: equipment.name
    });
  };

  const createWorkOrder = () => {
    Alert.alert(
      'Créer une intervention',
      'Voulez-vous créer une nouvelle intervention pour cet équipement ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Créer', onPress: () => {
          // In a real app, this would navigate to work order creation
          Alert.alert('Succès', 'Intervention créée avec succès');
        }}
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.equipmentHeader}>
              <Icon name="cog" size={48} color={theme.colors.primary} />
              <View style={styles.equipmentInfo}>
                <Text variant="headlineSmall" style={styles.equipmentName}>
                  {equipment.name}
                </Text>
                <Text variant="bodyLarge" style={styles.equipmentType}>
                  {equipment.type}
                </Text>
                <Text variant="bodyMedium" style={styles.equipmentId}>
                  ID: {equipment.id}
                </Text>
              </View>
              <Chip
                style={[styles.statusChip, { backgroundColor: getStatusColor(equipment.status) + '20' }]}
                textStyle={{ color: getStatusColor(equipment.status), fontWeight: 'bold' }}
              >
                {getStatusLabel(equipment.status)}
              </Chip>
            </View>
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <Card style={styles.actionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Actions rapides
            </Text>
            <View style={styles.quickActions}>
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
                onPress={createWorkOrder}
                style={styles.actionButton}
                icon="clipboard-plus"
              >
                Intervention
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* General Information */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Informations générales
            </Text>
            
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Icon name="map-marker" size={20} color={theme.colors.primary} />
                <View style={styles.infoText}>
                  <Text variant="bodySmall" style={styles.infoLabel}>
                    Emplacement
                  </Text>
                  <Text variant="bodyMedium" style={styles.infoValue}>
                    {equipment.location}
                  </Text>
                </View>
              </View>

              {equipment.lastMaintenance && (
                <View style={styles.infoItem}>
                  <Icon name="wrench" size={20} color={theme.colors.secondary} />
                  <View style={styles.infoText}>
                    <Text variant="bodySmall" style={styles.infoLabel}>
                      Dernière maintenance
                    </Text>
                    <Text variant="bodyMedium" style={styles.infoValue}>
                      {new Date(equipment.lastMaintenance).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                </View>
              )}

              {equipment.nextMaintenance && (
                <View style={styles.infoItem}>
                  <Icon name="calendar" size={20} color={theme.colors.tertiary} />
                  <View style={styles.infoText}>
                    <Text variant="bodySmall" style={styles.infoLabel}>
                      Prochaine maintenance
                    </Text>
                    <Text variant="bodyMedium" style={styles.infoValue}>
                      {new Date(equipment.nextMaintenance).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Technical Specifications */}
        {equipment.specifications && (
          <Card style={styles.infoCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                Spécifications techniques
              </Text>
              
              <View style={styles.specsGrid}>
                {equipment.specifications.manufacturer && (
                  <View style={styles.specItem}>
                    <Text variant="bodySmall" style={styles.specLabel}>
                      Fabricant
                    </Text>
                    <Text variant="bodyMedium" style={styles.specValue}>
                      {equipment.specifications.manufacturer}
                    </Text>
                  </View>
                )}

                {equipment.specifications.model && (
                  <View style={styles.specItem}>
                    <Text variant="bodySmall" style={styles.specLabel}>
                      Modèle
                    </Text>
                    <Text variant="bodyMedium" style={styles.specValue}>
                      {equipment.specifications.model}
                    </Text>
                  </View>
                )}

                {equipment.specifications.serialNumber && (
                  <View style={styles.specItem}>
                    <Text variant="bodySmall" style={styles.specLabel}>
                      N° de série
                    </Text>
                    <Text variant="bodyMedium" style={styles.specValue}>
                      {equipment.specifications.serialNumber}
                    </Text>
                  </View>
                )}

                {equipment.specifications.installationDate && (
                  <View style={styles.specItem}>
                    <Text variant="bodySmall" style={styles.specLabel}>
                      Date d'installation
                    </Text>
                    <Text variant="bodyMedium" style={styles.specValue}>
                      {new Date(equipment.specifications.installationDate).toLocaleDateString('fr-FR')}
                    </Text>
                  </View>
                )}

                {equipment.specifications.operatingHours && (
                  <View style={styles.specItem}>
                    <Text variant="bodySmall" style={styles.specLabel}>
                      Heures de fonctionnement
                    </Text>
                    <Text variant="bodyMedium" style={styles.specValue}>
                      {equipment.specifications.operatingHours.toLocaleString()} h
                    </Text>
                  </View>
                )}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Maintenance History */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Historique de maintenance
            </Text>
            
            {maintenanceHistory.length > 0 ? (
              maintenanceHistory.map((item, index) => (
                <View key={item.id}>
                  <View style={styles.historyItem}>
                    <View style={styles.historyDate}>
                      <Icon name="calendar" size={16} color={theme.colors.primary} />
                      <Text variant="bodySmall" style={styles.historyDateText}>
                        {new Date(item.date).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                    
                    <View style={styles.historyContent}>
                      <Text variant="bodyMedium" style={styles.historyType}>
                        {item.type}
                      </Text>
                      <Text variant="bodySmall" style={styles.historyDescription}>
                        {item.description}
                      </Text>
                      <View style={styles.historyFooter}>
                        <Text variant="bodySmall" style={styles.historyTechnician}>
                          Par: {item.technician}
                        </Text>
                        <Chip
                          style={[styles.historyStatusChip, { backgroundColor: '#dcfce7' }]}
                          textStyle={{ color: '#16a34a', fontSize: 10 }}
                        >
                          Terminée
                        </Chip>
                      </View>
                    </View>
                  </View>
                  {index < maintenanceHistory.length - 1 && <Divider style={styles.historyDivider} />}
                </View>
              ))
            ) : (
              <Surface style={styles.emptyHistory}>
                <Icon name="history" size={32} color={theme.colors.outline} />
                <Text variant="bodyMedium" style={styles.emptyHistoryText}>
                  Aucun historique de maintenance disponible
                </Text>
              </Surface>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  headerCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 3,
  },
  equipmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  equipmentInfo: {
    flex: 1,
    marginLeft: 16,
  },
  equipmentName: {
    fontWeight: 'bold',
  },
  equipmentType: {
    opacity: 0.8,
    marginTop: 4,
  },
  equipmentId: {
    opacity: 0.6,
    marginTop: 2,
  },
  statusChip: {
    marginLeft: 16,
  },
  actionCard: {
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  actionButton: {
    flex: 0.48,
  },
  infoCard: {
    marginBottom: 16,
    borderRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoGrid: {
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    opacity: 0.7,
    marginBottom: 2,
  },
  infoValue: {
    fontWeight: '500',
  },
  specsGrid: {
    gap: 12,
  },
  specItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  specLabel: {
    opacity: 0.7,
    flex: 1,
  },
  specValue: {
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  historyItem: {
    paddingVertical: 12,
  },
  historyDate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyDateText: {
    marginLeft: 6,
    fontWeight: 'bold',
    opacity: 0.8,
  },
  historyContent: {
    marginLeft: 20,
  },
  historyType: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  historyDescription: {
    opacity: 0.8,
    marginBottom: 8,
    lineHeight: 18,
  },
  historyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyTechnician: {
    opacity: 0.6,
  },
  historyStatusChip: {
    height: 24,
  },
  historyDivider: {
    marginVertical: 8,
  },
  emptyHistory: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 8,
  },
  emptyHistoryText: {
    marginTop: 8,
    opacity: 0.7,
  },
});
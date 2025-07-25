import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Button, FAB, Portal, Modal, List, Chip, ProgressBar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface Equipment {
  id: string;
  name: string;
  type: string;
  status: 'operational' | 'maintenance' | 'breakdown';
  healthScore: number;
  lastMaintenance: string;
  nextMaintenance: string;
}

interface WorkOrder {
  id: string;
  title: string;
  equipmentId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed';
  assignedTo: string;
  dueDate: string;
}

export default function GMAODashboardScreen() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'equipment' | 'workorders'>('overview');

  useEffect(() => {
    // Simulated data loading
    setEquipment([
      {
        id: '1',
        name: 'Pompe Hydraulique P-001',
        type: 'Pompe',
        status: 'operational',
        healthScore: 85,
        lastMaintenance: '2025-01-15',
        nextMaintenance: '2025-02-15'
      },
      {
        id: '2', 
        name: 'Moteur Électrique M-002',
        type: 'Moteur',
        status: 'maintenance',
        healthScore: 65,
        lastMaintenance: '2025-01-10',
        nextMaintenance: '2025-01-30'
      },
      {
        id: '3',
        name: 'Compresseur C-003',
        type: 'Compresseur', 
        status: 'breakdown',
        healthScore: 35,
        lastMaintenance: '2024-12-20',
        nextMaintenance: '2025-01-26'
      }
    ]);

    setWorkOrders([
      {
        id: '1',
        title: 'Maintenance préventive pompe hydraulique',
        equipmentId: '1',
        priority: 'medium',
        status: 'pending',
        assignedTo: 'Jean Dupont',
        dueDate: '2025-01-30'
      },
      {
        id: '2',
        title: 'Réparation urgente compresseur',
        equipmentId: '3', 
        priority: 'critical',
        status: 'in_progress',
        assignedTo: 'Marie Martin',
        dueDate: '2025-01-26'
      }
    ]);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return '#4CAF50';
      case 'maintenance': return '#FF9800'; 
      case 'breakdown': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#F44336';
      case 'high': return '#FF5722';
      case 'medium': return '#FF9800';
      case 'low': return '#4CAF50';
      default: return '#9E9E9E';
    }
  };

  const renderOverview = () => (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title>Tableau de Bord GMAO</Title>
          <Paragraph>Smart GMAO - Gestion Maintenance Assistée par Ordinateur</Paragraph>
        </Card.Content>
      </Card>

      <View style={styles.statsContainer}>
        <Card style={[styles.statCard, { backgroundColor: '#E8F5E8' }]}>
          <Card.Content style={styles.statContent}>
            <Title style={{ color: '#4CAF50', fontSize: 24 }}>
              {equipment.filter(e => e.status === 'operational').length}
            </Title>
            <Paragraph>Équipements Opérationnels</Paragraph>
          </Card.Content>
        </Card>

        <Card style={[styles.statCard, { backgroundColor: '#FFF3E0' }]}>
          <Card.Content style={styles.statContent}>
            <Title style={{ color: '#FF9800', fontSize: 24 }}>
              {workOrders.filter(wo => wo.status === 'pending').length}
            </Title>
            <Paragraph>OT Planifiés</Paragraph>
          </Card.Content>
        </Card>

        <Card style={[styles.statCard, { backgroundColor: '#FFEBEE' }]}>
          <Card.Content style={styles.statContent}>
            <Title style={{ color: '#F44336', fontSize: 24 }}>
              {workOrders.filter(wo => wo.priority === 'critical').length}
            </Title>
            <Paragraph>Urgences</Paragraph>
          </Card.Content>
        </Card>
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <Title>Santé Globale des Équipements</Title>
          {equipment.map((eq) => (
            <View key={eq.id} style={styles.healthItem}>
              <Paragraph>{eq.name}</Paragraph>
              <ProgressBar 
                progress={eq.healthScore / 100} 
                color={eq.healthScore > 70 ? '#4CAF50' : eq.healthScore > 40 ? '#FF9800' : '#F44336'}
                style={styles.progressBar}
              />
              <Paragraph style={styles.healthScore}>{eq.healthScore}%</Paragraph>
            </View>
          ))}
        </Card.Content>
      </Card>
    </ScrollView>
  );

  const renderEquipment = () => (
    <ScrollView style={styles.container}>
      {equipment.map((eq) => (
        <Card key={eq.id} style={styles.card}>
          <Card.Content>
            <View style={styles.equipmentHeader}>
              <Title>{eq.name}</Title>
              <Chip 
                style={{ backgroundColor: getStatusColor(eq.status) }}
                textStyle={{ color: 'white' }}
              >
                {eq.status.toUpperCase()}
              </Chip>
            </View>
            <Paragraph>Type: {eq.type}</Paragraph>
            <Paragraph>Santé: {eq.healthScore}%</Paragraph>
            <Paragraph>Dernière maintenance: {eq.lastMaintenance}</Paragraph>
            <Paragraph>Prochaine maintenance: {eq.nextMaintenance}</Paragraph>
            
            <View style={styles.buttonContainer}>
              <Button mode="outlined" compact onPress={() => {}}>
                Détails
              </Button>
              <Button mode="contained" compact onPress={() => {}}>
                Créer OT
              </Button>
            </View>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );

  const renderWorkOrders = () => (
    <ScrollView style={styles.container}>
      {workOrders.map((wo) => (
        <Card key={wo.id} style={styles.card}>
          <Card.Content>
            <View style={styles.workOrderHeader}>
              <Title style={{ flex: 1 }}>{wo.title}</Title>
              <Chip 
                style={{ backgroundColor: getPriorityColor(wo.priority) }}
                textStyle={{ color: 'white' }}
              >
                {wo.priority.toUpperCase()}
              </Chip>
            </View>
            <Paragraph>Assigné à: {wo.assignedTo}</Paragraph>
            <Paragraph>Échéance: {wo.dueDate}</Paragraph>
            <Paragraph>Status: {wo.status}</Paragraph>
            
            <View style={styles.buttonContainer}>
              <Button mode="outlined" compact onPress={() => {}}>
                Modifier
              </Button>
              <Button mode="contained" compact onPress={() => {}}>
                Terminer
              </Button>
            </View>
          </Card.Content>
        </Card>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabContainer}>
        <Button 
          mode={selectedTab === 'overview' ? 'contained' : 'outlined'}
          onPress={() => setSelectedTab('overview')}
          style={styles.tabButton}
        >
          Vue d'ensemble
        </Button>
        <Button 
          mode={selectedTab === 'equipment' ? 'contained' : 'outlined'}
          onPress={() => setSelectedTab('equipment')}
          style={styles.tabButton}
        >
          Équipements
        </Button>
        <Button 
          mode={selectedTab === 'workorders' ? 'contained' : 'outlined'}
          onPress={() => setSelectedTab('workorders')}
          style={styles.tabButton}
        >
          Ordres de Travail
        </Button>
      </View>

      {selectedTab === 'overview' && renderOverview()}
      {selectedTab === 'equipment' && renderEquipment()}
      {selectedTab === 'workorders' && renderWorkOrders()}

      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => setModalVisible(true)}
      />

      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)}>
          <Card style={styles.modal}>
            <Card.Content>
              <Title>Actions Rapides</Title>
              <List.Item
                title="Nouvel équipement"
                left={(props) => <List.Icon {...props} icon="cog" />}
                onPress={() => setModalVisible(false)}
              />
              <List.Item
                title="Ordre de travail"
                left={(props) => <List.Icon {...props} icon="wrench" />}
                onPress={() => setModalVisible(false)}
              />
              <List.Item
                title="Maintenance préventive"
                left={(props) => <List.Icon {...props} icon="calendar" />}
                onPress={() => setModalVisible(false)}
              />
            </Card.Content>
          </Card>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  card: {
    margin: 16,
    marginBottom: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  statCard: {
    flex: 1,
    margin: 8,
  },
  statContent: {
    alignItems: 'center',
  },
  healthItem: {
    marginVertical: 8,
  },
  progressBar: {
    marginVertical: 4,
    height: 8,
  },
  healthScore: {
    textAlign: 'right',
    fontSize: 12,
  },
  equipmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workOrderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  modal: {
    margin: 20,
  },
});
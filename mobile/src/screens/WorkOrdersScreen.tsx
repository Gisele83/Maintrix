import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Card, Text, Button, Chip, FAB, Surface, Searchbar } from 'react-native-paper';
import { useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDatabase } from '../providers/DatabaseProvider';
import { useAuth } from '../providers/AuthProvider';

interface WorkOrder {
  id: number;
  title: string;
  description?: string;
  equipmentId?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedTechnician?: string;
  createdDate: string;
  scheduledDate?: string;
  completedDate?: string;
  notes?: string;
  synced: boolean;
}

export default function WorkOrdersScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { db } = useDatabase();
  const { user } = useAuth();

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<WorkOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const filters = [
    { key: 'all', label: 'Toutes', count: workOrders.length },
    { key: 'pending', label: 'En attente', count: workOrders.filter(wo => wo.status === 'pending').length },
    { key: 'in_progress', label: 'En cours', count: workOrders.filter(wo => wo.status === 'in_progress').length },
    { key: 'completed', label: 'Terminées', count: workOrders.filter(wo => wo.status === 'completed').length },
    { key: 'high', label: 'Urgentes', count: workOrders.filter(wo => wo.priority === 'high').length },
  ];

  useEffect(() => {
    loadWorkOrders();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [workOrders, searchQuery, selectedFilter]);

  const loadWorkOrders = () => {
    if (!db) {
      setIsLoading(false);
      return;
    }

    db.transaction((tx) => {
      tx.executeSql(
        'SELECT * FROM work_orders ORDER BY created_date DESC',
        [],
        (_, { rows }) => {
          const orders: WorkOrder[] = [];
          for (let i = 0; i < rows.length; i++) {
            const row = rows.item(i);
            orders.push({
              id: row.id,
              title: row.title,
              description: row.description,
              equipmentId: row.equipment_id,
              priority: row.priority,
              status: row.status,
              assignedTechnician: row.assigned_technician,
              createdDate: row.created_date,
              scheduledDate: row.scheduled_date,
              completedDate: row.completed_date,
              notes: row.notes,
              synced: row.synced === 1
            });
          }
          setWorkOrders(orders);
          setIsLoading(false);
        },
        (_, error) => {
          console.error('Error loading work orders:', error);
          setIsLoading(false);
          return false;
        }
      );
    });
  };

  const applyFilters = () => {
    let filtered = workOrders;

    // Apply status/priority filter
    if (selectedFilter !== 'all') {
      if (selectedFilter === 'high') {
        filtered = filtered.filter(wo => wo.priority === 'high');
      } else {
        filtered = filtered.filter(wo => wo.status === selectedFilter);
      }
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(wo =>
        wo.title.toLowerCase().includes(query) ||
        wo.description?.toLowerCase().includes(query) ||
        wo.equipmentId?.toLowerCase().includes(query)
      );
    }

    setFilteredOrders(filtered);
  };

  const updateWorkOrderStatus = (workOrderId: number, newStatus: WorkOrder['status']) => {
    if (!db) return;

    const completedDate = newStatus === 'completed' ? new Date().toISOString() : null;

    db.transaction((tx) => {
      tx.executeSql(
        'UPDATE work_orders SET status = ?, completed_date = ?, synced = 0 WHERE id = ?',
        [newStatus, completedDate, workOrderId],
        () => {
          loadWorkOrders();
        },
        (_, error) => {
          console.error('Error updating work order:', error);
          return false;
        }
      );
    });
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadWorkOrders();
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const getPriorityColor = (priority: WorkOrder['priority']) => {
    switch (priority) {
      case 'high': return '#dc2626';
      case 'medium': return '#d97706';
      case 'low': return '#16a34a';
      default: return theme.colors.onSurfaceVariant;
    }
  };

  const getStatusColor = (status: WorkOrder['status']) => {
    switch (status) {
      case 'completed': return '#16a34a';
      case 'in_progress': return '#2563eb';
      case 'pending': return '#d97706';
      case 'cancelled': return '#dc2626';
      default: return theme.colors.onSurfaceVariant;
    }
  };

  const getStatusLabel = (status: WorkOrder['status']) => {
    switch (status) {
      case 'completed': return 'Terminée';
      case 'in_progress': return 'En cours';
      case 'pending': return 'En attente';
      case 'cancelled': return 'Annulée';
      default: return status;
    }
  };

  const getPriorityLabel = (priority: WorkOrder['priority']) => {
    switch (priority) {
      case 'high': return 'Élevée';
      case 'medium': return 'Moyenne';
      case 'low': return 'Faible';
      default: return priority;
    }
  };

  const renderWorkOrderCard = (workOrder: WorkOrder) => (
    <Card key={workOrder.id} style={styles.workOrderCard}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text variant="titleMedium" style={styles.workOrderTitle}>
              {workOrder.title}
            </Text>
            {!workOrder.synced && (
              <Icon name="sync-off" size={16} color={theme.colors.outline} />
            )}
          </View>
          <Chip
            style={[styles.statusChip, { backgroundColor: getStatusColor(workOrder.status) + '20' }]}
            textStyle={{ color: getStatusColor(workOrder.status), fontWeight: 'bold' }}
          >
            {getStatusLabel(workOrder.status)}
          </Chip>
        </View>

        {workOrder.description && (
          <Text variant="bodyMedium" style={styles.description}>
            {workOrder.description}
          </Text>
        )}

        <View style={styles.metaInfo}>
          <View style={styles.metaRow}>
            <Icon name="flag" size={16} color={getPriorityColor(workOrder.priority)} />
            <Text style={[styles.metaText, { color: getPriorityColor(workOrder.priority) }]}>
              Priorité {getPriorityLabel(workOrder.priority)}
            </Text>
          </View>

          {workOrder.equipmentId && (
            <View style={styles.metaRow}>
              <Icon name="cog" size={16} color={theme.colors.onSurfaceVariant} />
              <Text style={styles.metaText}>
                {workOrder.equipmentId}
              </Text>
            </View>
          )}

          <View style={styles.metaRow}>
            <Icon name="calendar" size={16} color={theme.colors.onSurfaceVariant} />
            <Text style={styles.metaText}>
              Créée le {new Date(workOrder.createdDate).toLocaleDateString('fr-FR')}
            </Text>
          </View>

          {workOrder.scheduledDate && (
            <View style={styles.metaRow}>
              <Icon name="clock" size={16} color={theme.colors.primary} />
              <Text style={[styles.metaText, { color: theme.colors.primary }]}>
                Planifiée le {new Date(workOrder.scheduledDate).toLocaleDateString('fr-FR')}
              </Text>
            </View>
          )}

          {workOrder.assignedTechnician && (
            <View style={styles.metaRow}>
              <Icon name="account" size={16} color={theme.colors.onSurfaceVariant} />
              <Text style={styles.metaText}>
                {workOrder.assignedTechnician}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actionButtons}>
          {workOrder.status === 'pending' && (
            <Button
              mode="contained-tonal"
              onPress={() => updateWorkOrderStatus(workOrder.id, 'in_progress')}
              style={styles.actionButton}
              icon="play"
            >
              Commencer
            </Button>
          )}
          {workOrder.status === 'in_progress' && (
            <Button
              mode="contained"
              onPress={() => updateWorkOrderStatus(workOrder.id, 'completed')}
              style={styles.actionButton}
              icon="check"
            >
              Terminer
            </Button>
          )}
          {workOrder.status !== 'completed' && (
            <Button
              mode="outlined"
              onPress={() => {
                // Navigate to diagnostic screen with pre-filled equipment
                if (workOrder.equipmentId) {
                  navigation.navigate('Diagnostic', {
                    preSelectedEquipment: workOrder.equipmentId,
                    workOrderId: workOrder.id
                  });
                } else {
                  navigation.navigate('Diagnostic');
                }
              }}
              style={styles.actionButton}
              icon="brain"
            >
              Diagnostiquer
            </Button>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Search Bar */}
      <Searchbar
        placeholder="Rechercher une intervention..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        {filters.map((filter) => (
          <Chip
            key={filter.key}
            selected={selectedFilter === filter.key}
            onPress={() => setSelectedFilter(filter.key)}
            style={styles.filterChip}
          >
            {filter.label} ({filter.count})
          </Chip>
        ))}
      </ScrollView>

      {/* Work Orders List */}
      <ScrollView
        style={styles.workOrdersList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.centered}>
            <Text>Chargement des interventions...</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <Surface style={styles.emptyContainer}>
            <Icon name="clipboard-list-outline" size={64} color={theme.colors.outline} />
            <Text variant="headlineSmall" style={styles.emptyTitle}>
              {searchQuery || selectedFilter !== 'all' ? 'Aucune intervention trouvée' : 'Aucune intervention'}
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtitle}>
              {searchQuery || selectedFilter !== 'all' 
                ? 'Modifiez vos critères de recherche ou filtres'
                : 'Les nouvelles interventions apparaîtront ici'
              }
            </Text>
          </Surface>
        ) : (
          filteredOrders.map(renderWorkOrderCard)
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => {
          // Navigate to create work order screen or show modal
          navigation.navigate('Diagnostic');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchbar: {
    margin: 16,
    marginBottom: 8,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterChip: {
    marginRight: 8,
  },
  workOrdersList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  workOrderCard: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  workOrderTitle: {
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  statusChip: {
    marginLeft: 8,
  },
  description: {
    marginBottom: 12,
    lineHeight: 20,
    opacity: 0.8,
  },
  metaInfo: {
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  metaText: {
    marginLeft: 8,
    fontSize: 14,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 0.48,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    borderRadius: 12,
    margin: 20,
  },
  emptyTitle: {
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    textAlign: 'center',
    opacity: 0.7,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    borderRadius: 28,
  },
});
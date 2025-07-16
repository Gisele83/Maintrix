import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  FlatList,
} from 'react-native';
import {
  Card,
  Searchbar,
  FilterChip,
  FAB,
  Surface,
  ActivityIndicator,
  Button,
  Chip,
  Portal,
  Modal,
  TextInput,
  Menu,
  Divider,
} from 'react-native-paper';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { apiService, MaintenanceCase } from '../services/ApiService';
import { useOffline } from '../context/OfflineContext';
import { theme, spacing, typography, gradients } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type HistoryScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'>;

export function HistoryScreen() {
  const navigation = useNavigation<HistoryScreenNavigationProp>();
  const { isOnline, syncPending } = useOffline();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [filteredData, setFilteredData] = useState<MaintenanceCase[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'equipment' | 'urgency'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDetails, setShowDetails] = useState<MaintenanceCase | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Fetch history data
  const { data: history = [], isLoading, error, refetch } = useQuery({
    queryKey: ['history'],
    queryFn: () => apiService.getHistory(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Update filtered data when history or filters change
  useEffect(() => {
    let filtered = [...history];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.equipmentType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.symptoms.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.diagnosis.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply equipment type filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(item => item.equipmentType === selectedFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'equipment':
          comparison = a.equipmentType.localeCompare(b.equipmentType);
          break;
        case 'urgency':
          const urgencyOrder = { 'high': 3, 'medium': 2, 'low': 1 };
          comparison = (urgencyOrder[a.urgency as keyof typeof urgencyOrder] || 0) - 
                     (urgencyOrder[b.urgency as keyof typeof urgencyOrder] || 0);
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    setFilteredData(filtered);
  }, [history, searchQuery, selectedFilter, sortBy, sortOrder]);

  const getUniqueEquipmentTypes = () => {
    const types = [...new Set(history.map(item => item.equipmentType))];
    return types;
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return theme.colors.error;
      case 'medium': return theme.colors.warning;
      case 'low': return theme.colors.success;
      default: return theme.colors.secondary;
    }
  };

  const getDurationColor = (duration: number) => {
    if (duration <= 30) return theme.colors.success;
    if (duration <= 60) return theme.colors.warning;
    return theme.colors.error;
  };

  const handleExport = () => {
    if (!isOnline) {
      Alert.alert(
        'Connexion requise',
        'La fonctionnalité d\'export nécessite une connexion internet',
        [{ text: 'OK' }]
      );
      return;
    }

    setShowExportModal(true);
  };

  const handleExportFormat = (format: string) => {
    Alert.alert(
      `Export ${format.toUpperCase()}`,
      `Exporter ${filteredData.length} cas de maintenance en ${format.toUpperCase()}?`,
      [
        { text: 'Annuler' },
        { 
          text: 'Exporter',
          onPress: () => {
            // Simulate export
            setTimeout(() => {
              Alert.alert('Export réussi', `${filteredData.length} cas exportés en ${format.toUpperCase()}`);
              setShowExportModal(false);
            }, 1000);
          }
        }
      ]
    );
  };

  const handleCasePress = (item: MaintenanceCase) => {
    setShowDetails(item);
  };

  const handleStartNewDiagnostic = () => {
    navigation.navigate('MainTabs', { screen: 'Diagnostic' });
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy à HH:mm', { locale: fr });
    } catch (error) {
      return dateString;
    }
  };

  const renderHistoryItem = ({ item }: { item: MaintenanceCase }) => (
    <Card style={styles.historyCard} onPress={() => handleCasePress(item)}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.equipmentInfo}>
            <Text style={styles.equipmentType}>{item.equipmentType}</Text>
            <Text style={styles.equipmentDate}>{formatDate(item.createdAt)}</Text>
          </View>
          <View style={styles.durationContainer}>
            <Text style={[styles.duration, { color: getDurationColor(item.estimatedDuration) }]}>
              {item.estimatedDuration}min
            </Text>
          </View>
        </View>
        
        <Text style={styles.diagnosis} numberOfLines={2}>
          {item.diagnosis}
        </Text>
        
        <Text style={styles.symptoms} numberOfLines={1}>
          Symptômes: {item.symptoms}
        </Text>
        
        <View style={styles.cardFooter}>
          <Chip
            icon="euro"
            style={styles.costChip}
            textStyle={styles.costText}
          >
            {item.estimatedCost}
          </Chip>
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Icon name="visibility" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Icon name="share" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="history" size={64} color={theme.colors.secondary} />
      <Text style={styles.emptyTitle}>Aucun Historique</Text>
      <Text style={styles.emptyText}>
        {isOnline 
          ? 'Commencez par effectuer un diagnostic pour voir l\'historique ici'
          : 'Mode hors-ligne: Historique limité aux données mises en cache'
        }
      </Text>
      <Button
        mode="contained"
        onPress={handleStartNewDiagnostic}
        style={styles.emptyButton}
        icon="add"
      >
        Nouveau Diagnostic
      </Button>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={gradients.primary} style={styles.header}>
          <Text style={styles.headerTitle}>Historique</Text>
          <Text style={styles.headerSubtitle}>Chargement des données...</Text>
        </LinearGradient>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={gradients.primary} style={styles.header}>
          <Text style={styles.headerTitle}>Historique</Text>
          <Text style={styles.headerSubtitle}>Erreur de chargement</Text>
        </LinearGradient>
        <View style={styles.centerContent}>
          <Surface style={styles.errorCard}>
            <Icon name="error" size={48} color={theme.colors.error} />
            <Text style={styles.errorTitle}>Erreur de Chargement</Text>
            <Text style={styles.errorText}>
              {isOnline ? 'Impossible de charger l\'historique' : 'Données hors-ligne indisponibles'}
            </Text>
            <Button
              mode="contained"
              onPress={() => refetch()}
              style={styles.errorButton}
              icon="refresh"
            >
              Réessayer
            </Button>
          </Surface>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={gradients.primary} style={styles.header}>
        <Text style={styles.headerTitle}>Historique</Text>
        <Text style={styles.headerSubtitle}>
          {filteredData.length} cas de maintenance
        </Text>
        {!isOnline && (
          <Surface style={styles.offlineWarning}>
            <Icon name="wifi-off" size={16} color={theme.colors.warning} />
            <Text style={styles.offlineText}>Données hors-ligne</Text>
          </Surface>
        )}
      </LinearGradient>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Rechercher équipement, symptôme..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
        
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Icon name="filter-list" size={20} color={theme.colors.primary} />
            <Text style={styles.filterText}>Filtres</Text>
          </TouchableOpacity>
          
          <Menu
            visible={showSortMenu}
            onDismiss={() => setShowSortMenu(false)}
            anchor={
              <TouchableOpacity
                style={styles.sortButton}
                onPress={() => setShowSortMenu(true)}
              >
                <Icon name="sort" size={20} color={theme.colors.primary} />
                <Text style={styles.sortText}>Trier</Text>
              </TouchableOpacity>
            }
          >
            <Menu.Item
              onPress={() => {
                setSortBy('date');
                setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
                setShowSortMenu(false);
              }}
              title="Date"
              leadingIcon="schedule"
            />
            <Menu.Item
              onPress={() => {
                setSortBy('equipment');
                setSortOrder('asc');
                setShowSortMenu(false);
              }}
              title="Équipement"
              leadingIcon="build"
            />
            <Menu.Item
              onPress={() => {
                setSortBy('urgency');
                setSortOrder('desc');
                setShowSortMenu(false);
              }}
              title="Urgence"
              leadingIcon="priority-high"
            />
          </Menu>
        </View>
      </View>

      {showFilters && (
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <FilterChip
              selected={selectedFilter === 'all'}
              onPress={() => setSelectedFilter('all')}
              style={styles.filterChip}
            >
              Tous
            </FilterChip>
            {getUniqueEquipmentTypes().map(type => (
              <FilterChip
                key={type}
                selected={selectedFilter === type}
                onPress={() => setSelectedFilter(type)}
                style={styles.filterChip}
              >
                {type}
              </FilterChip>
            ))}
          </ScrollView>
        </View>
      )}

      {filteredData.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredData}
          renderItem={renderHistoryItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              colors={[theme.colors.primary]}
            />
          }
        />
      )}

      {isOnline && (
        <FAB
          style={styles.fab}
          icon="download"
          onPress={handleExport}
          label="Export"
        />
      )}

      {/* Details Modal */}
      <Portal>
        <Modal
          visible={!!showDetails}
          onDismiss={() => setShowDetails(null)}
          contentContainerStyle={styles.modalContainer}
        >
          {showDetails && (
            <ScrollView>
              <Text style={styles.modalTitle}>{showDetails.equipmentType}</Text>
              <Text style={styles.modalDate}>{formatDate(showDetails.createdAt)}</Text>
              
              <Divider style={styles.modalDivider} />
              
              <Text style={styles.modalSectionTitle}>Diagnostic</Text>
              <Text style={styles.modalText}>{showDetails.diagnosis}</Text>
              
              <Text style={styles.modalSectionTitle}>Symptômes</Text>
              <Text style={styles.modalText}>{showDetails.symptoms}</Text>
              
              <Text style={styles.modalSectionTitle}>Solution</Text>
              <Text style={styles.modalText}>{showDetails.solution}</Text>
              
              <View style={styles.modalMetrics}>
                <View style={styles.modalMetric}>
                  <Text style={styles.modalMetricLabel}>Durée</Text>
                  <Text style={styles.modalMetricValue}>{showDetails.estimatedDuration} min</Text>
                </View>
                <View style={styles.modalMetric}>
                  <Text style={styles.modalMetricLabel}>Coût</Text>
                  <Text style={styles.modalMetricValue}>{showDetails.estimatedCost}</Text>
                </View>
              </View>
              
              <Button
                mode="contained"
                onPress={() => setShowDetails(null)}
                style={styles.modalButton}
              >
                Fermer
              </Button>
            </ScrollView>
          )}
        </Modal>
      </Portal>

      {/* Export Modal */}
      <Portal>
        <Modal
          visible={showExportModal}
          onDismiss={() => setShowExportModal(false)}
          contentContainerStyle={styles.exportModalContainer}
        >
          <Text style={styles.exportTitle}>Exporter les Données</Text>
          <Text style={styles.exportSubtitle}>
            {filteredData.length} cas de maintenance sélectionnés
          </Text>
          
          <View style={styles.exportOptions}>
            <Button
              mode="contained"
              onPress={() => handleExportFormat('csv')}
              style={styles.exportButton}
              icon="file-delimited"
            >
              Export CSV
            </Button>
            <Button
              mode="contained"
              onPress={() => handleExportFormat('excel')}
              style={styles.exportButton}
              icon="microsoft-excel"
            >
              Export Excel
            </Button>
            <Button
              mode="contained"
              onPress={() => handleExportFormat('pdf')}
              style={styles.exportButton}
              icon="file-pdf"
            >
              Export PDF
            </Button>
          </View>
          
          <Button
            mode="outlined"
            onPress={() => setShowExportModal(false)}
            style={styles.exportCancelButton}
          >
            Annuler
          </Button>
        </Modal>
      </Portal>
    </View>
  );
}

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
  searchContainer: {
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
  },
  searchBar: {
    marginBottom: spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterText: {
    ...typography.body2,
    color: theme.colors.primary,
    marginLeft: spacing.xs,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sortText: {
    ...typography.body2,
    color: theme.colors.primary,
    marginLeft: spacing.xs,
  },
  filtersContainer: {
    padding: spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  filterChip: {
    marginRight: spacing.sm,
  },
  listContent: {
    padding: spacing.md,
  },
  historyCard: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  equipmentInfo: {
    flex: 1,
  },
  equipmentType: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  equipmentDate: {
    ...typography.body2,
    color: theme.colors.secondary,
  },
  durationContainer: {
    alignItems: 'center',
  },
  duration: {
    ...typography.h4,
    fontWeight: 'bold',
  },
  diagnosis: {
    ...typography.body1,
    marginBottom: spacing.sm,
  },
  symptoms: {
    ...typography.body2,
    color: theme.colors.secondary,
    marginBottom: spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costChip: {
    backgroundColor: theme.colors.primaryContainer,
  },
  costText: {
    ...typography.body2,
    color: theme.colors.primary,
  },
  cardActions: {
    flexDirection: 'row',
  },
  actionButton: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.body1,
    textAlign: 'center',
    color: theme.colors.secondary,
    marginBottom: spacing.lg,
  },
  emptyButton: {
    paddingHorizontal: spacing.lg,
  },
  errorCard: {
    padding: spacing.xl,
    borderRadius: theme.roundness,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
  },
  errorTitle: {
    ...typography.h3,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body1,
    textAlign: 'center',
    color: theme.colors.secondary,
    marginBottom: spacing.lg,
  },
  errorButton: {
    paddingHorizontal: spacing.lg,
  },
  fab: {
    position: 'absolute',
    margin: spacing.md,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: theme.roundness,
    maxHeight: '80%',
  },
  modalTitle: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  modalDate: {
    ...typography.body2,
    color: theme.colors.secondary,
  },
  modalDivider: {
    marginVertical: spacing.md,
  },
  modalSectionTitle: {
    ...typography.h4,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  modalText: {
    ...typography.body1,
    marginBottom: spacing.md,
  },
  modalMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: spacing.md,
  },
  modalMetric: {
    alignItems: 'center',
  },
  modalMetricLabel: {
    ...typography.body2,
    color: theme.colors.secondary,
  },
  modalMetricValue: {
    ...typography.h4,
    marginTop: spacing.xs,
  },
  modalButton: {
    marginTop: spacing.lg,
  },
  exportModalContainer: {
    backgroundColor: theme.colors.surface,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: theme.roundness,
  },
  exportTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  exportSubtitle: {
    ...typography.body2,
    color: theme.colors.secondary,
    marginBottom: spacing.lg,
  },
  exportOptions: {
    marginBottom: spacing.lg,
  },
  exportButton: {
    marginBottom: spacing.sm,
  },
  exportCancelButton: {
    marginTop: spacing.md,
  },
});
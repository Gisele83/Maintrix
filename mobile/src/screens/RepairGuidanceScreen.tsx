import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Text, Button, Searchbar, Chip, Surface } from 'react-native-paper';
import { useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useDatabase } from '../providers/DatabaseProvider';
import { useOffline } from '../providers/OfflineProvider';

interface RepairGuide {
  id: number;
  equipmentType: string;
  diagnosis: string;
  solution: string;
  urgency: 'low' | 'medium' | 'high';
  confidence: number;
  estimatedTime: number;
  stepsCount: number;
}

export default function RepairGuidanceScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { db } = useDatabase();
  const { isConnected } = useOffline();

  const [repairGuides, setRepairGuides] = useState<RepairGuide[]>([]);
  const [filteredGuides, setFilteredGuides] = useState<RepairGuide[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEquipmentType, setSelectedEquipmentType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  const equipmentTypes = [
    { key: 'all', label: 'Tous les équipements', icon: 'cog' },
    { key: 'moteur', label: 'Moteurs', icon: 'engine' },
    { key: 'pompe', label: 'Pompes', icon: 'pump' },
    { key: 'compresseur', label: 'Compresseurs', icon: 'air-purifier' },
    { key: 'grue', label: 'Grues', icon: 'crane' },
    { key: 'transformateur', label: 'Transformateurs', icon: 'electric-switch' },
    { key: 'convoyeur', label: 'Convoyeurs', icon: 'conveyor-belt' }
  ];

  useEffect(() => {
    loadRepairGuides();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [repairGuides, searchQuery, selectedEquipmentType]);

  const loadRepairGuides = () => {
    if (!db) {
      setIsLoading(false);
      return;
    }

    db.transaction((tx) => {
      tx.executeSql(`
        SELECT 
          mc.*,
          COUNT(rp.id) as steps_count
        FROM maintenance_cases mc
        LEFT JOIN repair_procedures rp ON mc.id = rp.case_id
        GROUP BY mc.id
        ORDER BY mc.confidence DESC, mc.equipment_type
      `, [], (_, { rows }) => {
        const guides: RepairGuide[] = [];
        for (let i = 0; i < rows.length; i++) {
          const row = rows.item(i);
          guides.push({
            id: row.id,
            equipmentType: row.equipment_type,
            diagnosis: row.diagnosis,
            solution: row.solution,
            urgency: row.urgency || 'medium',
            confidence: row.confidence || 0.8,
            estimatedTime: 60, // Default estimated time
            stepsCount: row.steps_count || 0
          });
        }
        setRepairGuides(guides);
        setIsLoading(false);
      }, (_, error) => {
        console.error('Error loading repair guides:', error);
        setIsLoading(false);
        return false;
      });
    });
  };

  const applyFilters = () => {
    let filtered = repairGuides;

    // Filter by equipment type
    if (selectedEquipmentType !== 'all') {
      filtered = filtered.filter(guide => guide.equipmentType === selectedEquipmentType);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(guide =>
        guide.diagnosis.toLowerCase().includes(query) ||
        guide.solution.toLowerCase().includes(query) ||
        guide.equipmentType.toLowerCase().includes(query)
      );
    }

    setFilteredGuides(filtered);
  };

  const getUrgencyColor = (urgency: RepairGuide['urgency']) => {
    switch (urgency) {
      case 'high': return '#dc2626';
      case 'medium': return '#d97706';
      case 'low': return '#16a34a';
      default: return theme.colors.onSurfaceVariant;
    }
  };

  const getUrgencyLabel = (urgency: RepairGuide['urgency']) => {
    switch (urgency) {
      case 'high': return 'Élevée';
      case 'medium': return 'Moyenne';
      case 'low': return 'Faible';
      default: return urgency;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return '#16a34a';
    if (confidence >= 0.6) return '#d97706';
    return '#dc2626';
  };

  const startRepairGuide = (guide: RepairGuide) => {
    navigation.navigate('RepairSteps', {
      diagnosis: guide.diagnosis,
      solution: guide.solution,
      equipmentType: guide.equipmentType
    });
  };

  const renderGuideCard = (guide: RepairGuide) => (
    <Card key={guide.id} style={styles.guideCard}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={styles.equipmentTypeContainer}>
            <Icon 
              name={equipmentTypes.find(et => et.key === guide.equipmentType)?.icon || 'cog'} 
              size={24} 
              color={theme.colors.primary} 
            />
            <Text variant="bodyMedium" style={styles.equipmentTypeText}>
              {equipmentTypes.find(et => et.key === guide.equipmentType)?.label || guide.equipmentType}
            </Text>
          </View>
          <View style={styles.badgeContainer}>
            <Chip 
              style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(guide.confidence) + '20' }]}
              textStyle={{ color: getConfidenceColor(guide.confidence), fontSize: 12, fontWeight: 'bold' }}
            >
              {Math.round(guide.confidence * 100)}%
            </Chip>
          </View>
        </View>

        <Text variant="titleMedium" style={styles.diagnosisTitle}>
          {guide.diagnosis}
        </Text>

        <Text variant="bodyMedium" style={styles.solutionText} numberOfLines={3}>
          {guide.solution}
        </Text>

        <View style={styles.metaInfo}>
          <View style={styles.metaItem}>
            <Icon name="flag" size={16} color={getUrgencyColor(guide.urgency)} />
            <Text style={[styles.metaText, { color: getUrgencyColor(guide.urgency) }]}>
              {getUrgencyLabel(guide.urgency)}
            </Text>
          </View>

          <View style={styles.metaItem}>
            <Icon name="clock" size={16} color={theme.colors.onSurfaceVariant} />
            <Text style={styles.metaText}>
              ~{guide.estimatedTime} min
            </Text>
          </View>

          {guide.stepsCount > 0 && (
            <View style={styles.metaItem}>
              <Icon name="format-list-numbered" size={16} color={theme.colors.onSurfaceVariant} />
              <Text style={styles.metaText}>
                {guide.stepsCount} étapes
              </Text>
            </View>
          )}

          <View style={styles.metaItem}>
            <Icon 
              name={isConnected ? 'cloud-check' : 'database'} 
              size={16} 
              color={isConnected ? theme.colors.primary : theme.colors.outline} 
            />
            <Text style={[styles.metaText, { color: isConnected ? theme.colors.primary : theme.colors.outline }]}>
              {isConnected ? 'En ligne' : 'Hors ligne'}
            </Text>
          </View>
        </View>

        <Button
          mode="contained"
          onPress={() => startRepairGuide(guide)}
          style={styles.startButton}
          icon="play"
        >
          Démarrer la réparation
        </Button>
      </Card.Content>
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Search Bar */}
      <Searchbar
        placeholder="Rechercher un guide de réparation..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      {/* Equipment Type Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        {equipmentTypes.map((equipment) => (
          <Chip
            key={equipment.key}
            selected={selectedEquipmentType === equipment.key}
            onPress={() => setSelectedEquipmentType(equipment.key)}
            style={styles.filterChip}
            icon={equipment.icon}
          >
            {equipment.label}
          </Chip>
        ))}
      </ScrollView>

      {/* Status Info */}
      <Surface style={styles.statusContainer}>
        <View style={styles.statusItem}>
          <Icon 
            name={isConnected ? 'wifi' : 'wifi-off'} 
            size={20} 
            color={isConnected ? theme.colors.primary : theme.colors.outline} 
          />
          <Text style={[styles.statusText, { color: isConnected ? theme.colors.primary : theme.colors.outline }]}>
            {isConnected ? 'Mode en ligne' : 'Mode hors ligne'}
          </Text>
        </View>
        <Text variant="bodySmall" style={styles.statusDescription}>
          {filteredGuides.length} guide(s) disponible(s)
        </Text>
      </Surface>

      {/* Repair Guides List */}
      <ScrollView style={styles.guidesList} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.centered}>
            <Text>Chargement des guides de réparation...</Text>
          </View>
        ) : filteredGuides.length === 0 ? (
          <Surface style={styles.emptyContainer}>
            <Icon name="wrench-outline" size={64} color={theme.colors.outline} />
            <Text variant="headlineSmall" style={styles.emptyTitle}>
              {searchQuery || selectedEquipmentType !== 'all' ? 'Aucun guide trouvé' : 'Aucun guide disponible'}
            </Text>
            <Text variant="bodyMedium" style={styles.emptySubtitle}>
              {searchQuery || selectedEquipmentType !== 'all' 
                ? 'Modifiez vos critères de recherche ou filtres'
                : 'Les guides de réparation apparaîtront ici après synchronisation'
              }
            </Text>
            {!isConnected && (
              <Button
                mode="outlined"
                onPress={() => Alert.alert('Mode hors ligne', 'Connectez-vous à internet pour synchroniser les derniers guides de réparation')}
                style={styles.syncButton}
                icon="sync"
              >
                Synchroniser
              </Button>
            )}
          </Surface>
        ) : (
          filteredGuides.map(renderGuideCard)
        )}
      </ScrollView>
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
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    margin: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 8,
    fontWeight: 'bold',
  },
  statusDescription: {
    opacity: 0.7,
  },
  guidesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  guideCard: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  equipmentTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  equipmentTypeText: {
    marginLeft: 8,
    fontWeight: 'bold',
    opacity: 0.8,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceBadge: {
    marginLeft: 8,
  },
  diagnosisTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1f2937',
  },
  solutionText: {
    marginBottom: 16,
    lineHeight: 20,
    opacity: 0.8,
  },
  metaInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '500',
  },
  startButton: {
    borderRadius: 8,
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
    marginBottom: 16,
  },
  syncButton: {
    marginTop: 8,
  },
});
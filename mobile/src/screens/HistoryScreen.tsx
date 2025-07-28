import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useApiService } from '../services/ApiService';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const HistoryScreen = () => {
  const { theme } = useTheme();
  const apiService = useApiService();
  const navigation = useNavigation();

  const [diagnostics, setDiagnostics] = useState<any[]>([]);
  const [filteredDiagnostics, setFilteredDiagnostics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  const filters = [
    { id: 'all', label: 'Tous', icon: 'list' },
    { id: 'motor', label: 'Moteurs', icon: 'flash' },
    { id: 'pump', label: 'Pompes', icon: 'water' },
    { id: 'high', label: 'Urgence', icon: 'warning' },
    { id: 'recent', label: 'Récents', icon: 'time' },
  ];

  useEffect(() => {
    loadDiagnostics();
  }, []);

  useEffect(() => {
    filterDiagnostics();
  }, [diagnostics, searchQuery, selectedFilter]);

  const loadDiagnostics = async () => {
    setLoading(true);
    try {
      const data = await apiService.getOfflineDiagnostics();
      setDiagnostics(data);
    } catch (error) {
      console.error('Failed to load diagnostics:', error);
      Alert.alert('Erreur', 'Impossible de charger l\'historique des diagnostics.');
    } finally {
      setLoading(false);
    }
  };

  const filterDiagnostics = () => {
    let filtered = [...diagnostics];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.equipment_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.equipment_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.suggestions?.some((s: any) => s.issue?.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply category filter
    switch (selectedFilter) {
      case 'motor':
        filtered = filtered.filter(item => item.equipment_type === 'motor');
        break;
      case 'pump':
        filtered = filtered.filter(item => item.equipment_type === 'pump');
        break;
      case 'high':
        filtered = filtered.filter(item => item.urgency_level === 'high' || item.urgency_level === 'critical');
        break;
      case 'recent':
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        filtered = filtered.filter(item => new Date(item.created_at) > oneDayAgo);
        break;
    }

    setFilteredDiagnostics(filtered);
  };

  const getRiskLevelColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return '#10b981';
      case 'medium': return '#f59e0b';
      case 'high': return '#ef4444';
      case 'critical': return '#dc2626';
      default: return theme.colors.textSecondary;
    }
  };

  const getEquipmentIcon = (equipmentType: string) => {
    switch (equipmentType) {
      case 'motor': return 'flash';
      case 'pump': return 'water';
      case 'conveyor': return 'trending-up';
      case 'crane': return 'construct';
      case 'generator': return 'battery-charging';
      case 'compressor': return 'resize';
      default: return 'construct';
    }
  };

  const handleDiagnosticPress = (diagnostic: any) => {
    Alert.alert(
      'Actions',
      'Que souhaitez-vous faire avec ce diagnostic ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Voir les détails',
          onPress: () => showDiagnosticDetails(diagnostic),
        },
        {
          text: 'Refaire le diagnostic',
          onPress: () => redoDiagnostic(diagnostic),
        },
        {
          text: 'Guide de réparation',
          onPress: () => navigation.navigate('RepairGuidance' as never, {
            diagnostic: { suggestions: diagnostic.suggestions },
            equipmentType: diagnostic.equipment_type
          } as never),
        },
      ]
    );
  };

  const showDiagnosticDetails = (diagnostic: any) => {
    const details = `
Équipement: ${diagnostic.equipment_type}
ID: ${diagnostic.equipment_id || 'Non spécifié'}
Symptômes: ${diagnostic.symptoms?.join(', ') || 'Non spécifiés'}
Niveau de risque: ${diagnostic.risk_level}
Confiance: ${Math.round((diagnostic.confidence_score || 0) * 100)}%
Coût estimé: ${diagnostic.estimated_cost || 'Non estimé'}€
Date: ${format(new Date(diagnostic.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
    `.trim();

    Alert.alert('Détails du diagnostic', details);
  };

  const redoDiagnostic = (diagnostic: any) => {
    navigation.navigate('Diagnostic' as never);
  };

  const handleExportHistory = () => {
    Alert.alert(
      'Export des données',
      'Cette fonctionnalité permettra d\'exporter l\'historique vers un fichier CSV.',
      [{ text: 'OK' }]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingVertical: 15,
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
      marginBottom: 15,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 10,
      paddingHorizontal: 15,
      paddingVertical: 10,
    },
    searchInput: {
      flex: 1,
      color: 'white',
      fontSize: 16,
      marginLeft: 10,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 20,
    },
    filtersContainer: {
      flexDirection: 'row',
      marginBottom: 20,
    },
    filterChip: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      paddingHorizontal: 15,
      paddingVertical: 8,
      marginRight: 10,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    filterChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterIcon: {
      marginRight: 5,
    },
    filterText: {
      fontSize: 14,
      color: theme.colors.text,
    },
    filterTextActive: {
      color: 'white',
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: theme.colors.surface,
      borderRadius: 15,
      paddingVertical: 15,
      marginBottom: 20,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    diagnosticCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 15,
      padding: 15,
      marginBottom: 15,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.primary,
    },
    diagnosticHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    equipmentInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    equipmentIcon: {
      marginRight: 10,
    },
    equipmentDetails: {
      flex: 1,
    },
    equipmentType: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    equipmentId: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    diagnosticDate: {
      fontSize: 12,
      color: theme.colors.textSecondary,
    },
    symptomsContainer: {
      marginBottom: 10,
    },
    symptomsTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.colors.text,
      marginBottom: 5,
    },
    symptomsList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    symptomChip: {
      backgroundColor: theme.colors.background,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginRight: 5,
      marginBottom: 3,
    },
    symptomText: {
      fontSize: 12,
      color: theme.colors.text,
    },
    resultsContainer: {
      marginBottom: 15,
    },
    resultItem: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginBottom: 2,
    },
    metricsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    metricItem: {
      alignItems: 'center',
    },
    metricValue: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.colors.primary,
    },
    metricLabel: {
      fontSize: 10,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    riskBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      alignSelf: 'flex-start',
    },
    riskText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: 'white',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyIcon: {
      marginBottom: 20,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.colors.text,
      marginBottom: 10,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginTop: 10,
    },
    exportButton: {
      position: 'absolute',
      bottom: 20,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1e40af', '#3b82f6']}
          style={styles.headerGradient}
        >
          <Text style={styles.headerTitle}>Historique</Text>
          <Text style={styles.headerSubtitle}>Chargement...</Text>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Chargement de l'historique...</Text>
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
        <Text style={styles.headerTitle}>Historique</Text>
        <Text style={styles.headerSubtitle}>
          {diagnostics.length} diagnostic{diagnostics.length > 1 ? 's' : ''} enregistré{diagnostics.length > 1 ? 's' : ''}
        </Text>
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color="white" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher..."
            placeholderTextColor="rgba(255, 255, 255, 0.6)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Filters */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterChip,
                selectedFilter === filter.id && styles.filterChipActive
              ]}
              onPress={() => setSelectedFilter(filter.id)}
            >
              <Ionicons
                name={filter.icon as any}
                size={14}
                color={selectedFilter === filter.id ? 'white' : theme.colors.text}
                style={styles.filterIcon}
              />
              <Text style={[
                styles.filterText,
                selectedFilter === filter.id && styles.filterTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Statistics */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{diagnostics.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {diagnostics.filter(d => d.risk_level === 'high' || d.risk_level === 'critical').length}
            </Text>
            <Text style={styles.statLabel}>Urgents</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {diagnostics.filter(d => {
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                return new Date(d.created_at) > oneDayAgo;
              }).length}
            </Text>
            <Text style={styles.statLabel}>Récents</Text>
          </View>
        </View>

        {/* Diagnostics List */}
        {filteredDiagnostics.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name="document-text-outline" 
              size={64} 
              color={theme.colors.textSecondary}
              style={styles.emptyIcon}
            />
            <Text style={styles.emptyTitle}>Aucun diagnostic trouvé</Text>
            <Text style={styles.emptyText}>
              {searchQuery || selectedFilter !== 'all' 
                ? 'Essayez de modifier vos critères de recherche'
                : 'Commencez par réaliser votre premier diagnostic'}
            </Text>
          </View>
        ) : (
          filteredDiagnostics.map((diagnostic, index) => (
            <TouchableOpacity
              key={diagnostic.id || index}
              style={styles.diagnosticCard}
              onPress={() => handleDiagnosticPress(diagnostic)}
            >
              <View style={styles.diagnosticHeader}>
                <View style={styles.equipmentInfo}>
                  <Ionicons
                    name={getEquipmentIcon(diagnostic.equipment_type) as any}
                    size={24}
                    color={theme.colors.primary}
                    style={styles.equipmentIcon}
                  />
                  <View style={styles.equipmentDetails}>
                    <Text style={styles.equipmentType}>
                      {diagnostic.equipment_type === 'motor' ? 'Moteur électrique' :
                       diagnostic.equipment_type === 'pump' ? 'Pompe hydraulique' :
                       diagnostic.equipment_type === 'conveyor' ? 'Convoyeur' :
                       diagnostic.equipment_type === 'crane' ? 'Grue portuaire' :
                       diagnostic.equipment_type === 'generator' ? 'Générateur' :
                       diagnostic.equipment_type === 'compressor' ? 'Compresseur' :
                       diagnostic.equipment_type}
                    </Text>
                    {diagnostic.equipment_id && (
                      <Text style={styles.equipmentId}>ID: {diagnostic.equipment_id}</Text>
                    )}
                  </View>
                </View>
                <Text style={styles.diagnosticDate}>
                  {format(new Date(diagnostic.created_at), 'dd/MM HH:mm', { locale: fr })}
                </Text>
              </View>

              {diagnostic.symptoms && diagnostic.symptoms.length > 0 && (
                <View style={styles.symptomsContainer}>
                  <Text style={styles.symptomsTitle}>Symptômes :</Text>
                  <View style={styles.symptomsList}>
                    {diagnostic.symptoms.map((symptom: string, idx: number) => (
                      <View key={idx} style={styles.symptomChip}>
                        <Text style={styles.symptomText}>{symptom}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.resultsContainer}>
                {diagnostic.suggestions && diagnostic.suggestions[0] && (
                  <Text style={styles.resultItem}>
                    🔧 {diagnostic.suggestions[0].issue}
                  </Text>
                )}
              </View>

              <View style={styles.metricsContainer}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>
                    {Math.round((diagnostic.confidence_score || 0) * 100)}%
                  </Text>
                  <Text style={styles.metricLabel}>Confiance</Text>
                </View>
                <View style={styles.metricItem}>
                  <View style={[
                    styles.riskBadge,
                    { backgroundColor: getRiskLevelColor(diagnostic.risk_level) }
                  ]}>
                    <Text style={styles.riskText}>
                      {diagnostic.risk_level === 'low' ? 'Faible' :
                       diagnostic.risk_level === 'medium' ? 'Moyen' :
                       diagnostic.risk_level === 'high' ? 'Élevé' :
                       diagnostic.risk_level === 'critical' ? 'Critique' :
                       diagnostic.risk_level}
                    </Text>
                  </View>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricValue}>{diagnostic.estimated_cost || 0}€</Text>
                  <Text style={styles.metricLabel}>Coût estimé</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Export Button */}
      <TouchableOpacity
        style={styles.exportButton}
        onPress={handleExportHistory}
      >
        <LinearGradient
          colors={['#1e40af', '#3b82f6']}
          style={styles.exportButton}
        >
          <Ionicons name="download" size={24} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

export default HistoryScreen;
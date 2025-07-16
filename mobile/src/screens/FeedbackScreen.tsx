import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  Card,
  Button,
  TextInput,
  RadioButton,
  Checkbox,
  Surface,
  Divider,
  Chip,
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { apiService, FeedbackData } from '../services/ApiService';
import { useOffline } from '../context/OfflineContext';
import { theme, spacing, typography, gradients } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';

type FeedbackScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Feedback'>;
type FeedbackScreenRouteProp = RouteProp<RootStackParamList, 'Feedback'>;

const ratingOptions = [
  { value: 1, label: 'Très Mauvais', icon: 'sentiment-very-dissatisfied', color: '#f44336' },
  { value: 2, label: 'Mauvais', icon: 'sentiment-dissatisfied', color: '#ff9800' },
  { value: 3, label: 'Moyen', icon: 'sentiment-neutral', color: '#ffc107' },
  { value: 4, label: 'Bon', icon: 'sentiment-satisfied', color: '#8bc34a' },
  { value: 5, label: 'Excellent', icon: 'sentiment-very-satisfied', color: '#4caf50' },
];

const helpfulOptions = [
  { value: true, label: 'Oui, très utile', icon: 'thumb-up' },
  { value: false, label: 'Non, pas utile', icon: 'thumb-down' },
];

const accuracyOptions = [
  { value: 'very_accurate', label: 'Très précis' },
  { value: 'accurate', label: 'Précis' },
  { value: 'partially_accurate', label: 'Partiellement précis' },
  { value: 'inaccurate', label: 'Imprécis' },
];

const improvementSuggestions = [
  'Améliorer la précision du diagnostic',
  'Ajouter plus de détails dans les solutions',
  'Simplifier les instructions',
  'Améliorer les temps de réponse',
  'Ajouter des images/vidéos',
  'Améliorer l\'interface utilisateur',
];

export function FeedbackScreen() {
  const navigation = useNavigation<FeedbackScreenNavigationProp>();
  const route = useRoute<FeedbackScreenRouteProp>();
  const { sessionId, diagnosis, solution } = route.params;
  const { isOnline } = useOffline();
  const queryClient = useQueryClient();

  const [rating, setRating] = useState<number>(3);
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [accuracy, setAccuracy] = useState<string>('accurate');
  const [comments, setComments] = useState<string>('');
  const [selectedImprovements, setSelectedImprovements] = useState<string[]>([]);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);

  const feedbackMutation = useMutation({
    mutationFn: async (feedbackData: FeedbackData) => {
      await apiService.submitFeedback(feedbackData);
    },
    onSuccess: () => {
      Alert.alert(
        'Merci !',
        'Votre feedback a été enregistré avec succès.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    },
    onError: (error) => {
      Alert.alert(
        'Information',
        isOnline 
          ? 'Erreur lors de l\'envoi du feedback'
          : 'Feedback sauvegardé localement, il sera envoyé lors de la prochaine synchronisation',
        [{ text: 'OK' }]
      );
    },
  });

  const handleSubmitFeedback = () => {
    if (helpful === null) {
      Alert.alert(
        'Information manquante',
        'Veuillez indiquer si le diagnostic était utile',
        [{ text: 'OK' }]
      );
      return;
    }

    const feedbackData: FeedbackData = {
      sessionId,
      rating,
      helpful,
      comments,
      suggestionsAccuracy: accuracy,
      timestamp: new Date().toISOString(),
    };

    feedbackMutation.mutate(feedbackData);
  };

  const handleImprovementToggle = (improvement: string) => {
    const newSelected = selectedImprovements.includes(improvement)
      ? selectedImprovements.filter(item => item !== improvement)
      : [...selectedImprovements, improvement];
    
    setSelectedImprovements(newSelected);
  };

  const getRatingColor = (value: number) => {
    const option = ratingOptions.find(opt => opt.value === value);
    return option ? option.color : theme.colors.secondary;
  };

  const getRatingIcon = (value: number) => {
    const option = ratingOptions.find(opt => opt.value === value);
    return option ? option.icon : 'sentiment-neutral';
  };

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={gradients.primary} style={styles.header}>
        <Text style={styles.headerTitle}>Évaluation</Text>
        <Text style={styles.headerSubtitle}>
          Aidez-nous à améliorer SMDiagFix
        </Text>
        {!isOnline && (
          <Surface style={styles.offlineWarning}>
            <Icon name="wifi-off" size={16} color={theme.colors.warning} />
            <Text style={styles.offlineText}>
              Feedback sera synchronisé plus tard
            </Text>
          </Surface>
        )}
      </LinearGradient>

      <View style={styles.content}>
        {/* Diagnostic Summary */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <Text style={styles.summaryTitle}>Diagnostic Évalué</Text>
            <Text style={styles.diagnosisText}>{diagnosis}</Text>
            <Divider style={styles.divider} />
            <Text style={styles.solutionText} numberOfLines={3}>
              {solution}
            </Text>
          </Card.Content>
        </Card>

        {/* Rating Section */}
        <Card style={styles.ratingCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Note Globale</Text>
            <Text style={styles.sectionSubtitle}>
              Comment évaluez-vous ce diagnostic ?
            </Text>
            
            <View style={styles.ratingContainer}>
              {ratingOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.ratingOption,
                    rating === option.value && styles.selectedRating
                  ]}
                  onPress={() => setRating(option.value)}
                >
                  <Icon
                    name={option.icon}
                    size={32}
                    color={rating === option.value ? option.color : theme.colors.secondary}
                  />
                  <Text style={[
                    styles.ratingLabel,
                    rating === option.value && { color: option.color }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.ratingDisplay}>
              <Icon
                name={getRatingIcon(rating)}
                size={24}
                color={getRatingColor(rating)}
              />
              <Text style={[styles.ratingText, { color: getRatingColor(rating) }]}>
                {rating}/5 - {ratingOptions.find(opt => opt.value === rating)?.label}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Usefulness Section */}
        <Card style={styles.helpfulCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Utilité</Text>
            <Text style={styles.sectionSubtitle}>
              Ce diagnostic vous a-t-il aidé à résoudre le problème ?
            </Text>
            
            <View style={styles.helpfulContainer}>
              {helpfulOptions.map((option) => (
                <TouchableOpacity
                  key={option.value.toString()}
                  style={[
                    styles.helpfulOption,
                    helpful === option.value && styles.selectedHelpful
                  ]}
                  onPress={() => setHelpful(option.value)}
                >
                  <Icon
                    name={option.icon}
                    size={24}
                    color={helpful === option.value ? theme.colors.primary : theme.colors.secondary}
                  />
                  <Text style={[
                    styles.helpfulText,
                    helpful === option.value && { color: theme.colors.primary }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Accuracy Section */}
        <Card style={styles.accuracyCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Précision</Text>
            <Text style={styles.sectionSubtitle}>
              Quelle était la précision des suggestions ?
            </Text>
            
            <RadioButton.Group
              onValueChange={setAccuracy}
              value={accuracy}
            >
              {accuracyOptions.map((option) => (
                <RadioButton.Item
                  key={option.value}
                  label={option.label}
                  value={option.value}
                  style={styles.radioItem}
                />
              ))}
            </RadioButton.Group>
          </Card.Content>
        </Card>

        {/* Improvements Section */}
        <Card style={styles.improvementsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Suggestions d'Amélioration</Text>
            <Text style={styles.sectionSubtitle}>
              Quels aspects pourriez-vous améliorer ? (Optionnel)
            </Text>
            
            <View style={styles.improvementsContainer}>
              {improvementSuggestions.map((improvement, index) => (
                <Chip
                  key={index}
                  selected={selectedImprovements.includes(improvement)}
                  onPress={() => handleImprovementToggle(improvement)}
                  style={styles.improvementChip}
                  showSelectedCheck={true}
                >
                  {improvement}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>

        {/* Comments Section */}
        <Card style={styles.commentsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Commentaires</Text>
            <Text style={styles.sectionSubtitle}>
              Partagez vos observations ou suggestions (Optionnel)
            </Text>
            
            <TextInput
              label="Vos commentaires..."
              value={comments}
              onChangeText={setComments}
              multiline
              numberOfLines={4}
              style={styles.commentsInput}
              placeholder="Décrivez votre expérience, suggestions d'amélioration..."
            />
          </Card.Content>
        </Card>

        {/* Recommendation Section */}
        <Card style={styles.recommendCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Recommandation</Text>
            <Text style={styles.sectionSubtitle}>
              Recommanderiez-vous SMDiagFix à un collègue ?
            </Text>
            
            <View style={styles.recommendContainer}>
              <TouchableOpacity
                style={[
                  styles.recommendOption,
                  wouldRecommend === true && styles.selectedRecommend
                ]}
                onPress={() => setWouldRecommend(true)}
              >
                <Icon
                  name="thumb-up"
                  size={24}
                  color={wouldRecommend === true ? theme.colors.success : theme.colors.secondary}
                />
                <Text style={[
                  styles.recommendText,
                  wouldRecommend === true && { color: theme.colors.success }
                ]}>
                  Oui, je recommande
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.recommendOption,
                  wouldRecommend === false && styles.selectedRecommend
                ]}
                onPress={() => setWouldRecommend(false)}
              >
                <Icon
                  name="thumb-down"
                  size={24}
                  color={wouldRecommend === false ? theme.colors.error : theme.colors.secondary}
                />
                <Text style={[
                  styles.recommendText,
                  wouldRecommend === false && { color: theme.colors.error }
                ]}>
                  Non, pas encore
                </Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>

        {/* Submit Button */}
        <Button
          mode="contained"
          onPress={handleSubmitFeedback}
          loading={feedbackMutation.isPending}
          disabled={feedbackMutation.isPending || helpful === null}
          style={styles.submitButton}
          icon="send"
        >
          {feedbackMutation.isPending ? 'Envoi en cours...' : 'Envoyer le Feedback'}
        </Button>

        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.cancelButton}
        >
          Annuler
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
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
  content: {
    padding: spacing.md,
  },
  summaryCard: {
    marginBottom: spacing.md,
    backgroundColor: theme.colors.primaryContainer,
  },
  summaryTitle: {
    ...typography.h4,
    marginBottom: spacing.sm,
  },
  diagnosisText: {
    ...typography.body1,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  divider: {
    marginVertical: spacing.sm,
  },
  solutionText: {
    ...typography.body2,
    color: theme.colors.secondary,
  },
  ratingCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.body2,
    color: theme.colors.secondary,
    marginBottom: spacing.md,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  ratingOption: {
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: theme.roundness,
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  selectedRating: {
    backgroundColor: theme.colors.primaryContainer,
  },
  ratingLabel: {
    ...typography.caption,
    marginTop: spacing.xs,
    textAlign: 'center',
    color: theme.colors.secondary,
  },
  ratingDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.roundness,
  },
  ratingText: {
    ...typography.h4,
    marginLeft: spacing.sm,
    fontWeight: '600',
  },
  helpfulCard: {
    marginBottom: spacing.md,
  },
  helpfulContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  helpfulOption: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: theme.roundness,
    flex: 1,
    marginHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  selectedHelpful: {
    backgroundColor: theme.colors.primaryContainer,
    borderColor: theme.colors.primary,
  },
  helpfulText: {
    ...typography.body2,
    marginTop: spacing.sm,
    textAlign: 'center',
    color: theme.colors.secondary,
  },
  accuracyCard: {
    marginBottom: spacing.md,
  },
  radioItem: {
    paddingVertical: spacing.xs,
  },
  improvementsCard: {
    marginBottom: spacing.md,
  },
  improvementsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  improvementChip: {
    margin: spacing.xs,
  },
  commentsCard: {
    marginBottom: spacing.md,
  },
  commentsInput: {
    minHeight: 100,
    marginTop: spacing.sm,
  },
  recommendCard: {
    marginBottom: spacing.md,
  },
  recommendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  recommendOption: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: theme.roundness,
    flex: 1,
    marginHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.outline,
  },
  selectedRecommend: {
    backgroundColor: theme.colors.primaryContainer,
    borderColor: theme.colors.primary,
  },
  recommendText: {
    ...typography.body2,
    marginTop: spacing.sm,
    textAlign: 'center',
    color: theme.colors.secondary,
  },
  submitButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  cancelButton: {
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
});
import { EventEmitter } from 'events';
import { gmaoStorage } from '../gmao-storage';
import type { 
  InsertMaintenanceSkill,
  InsertUserSkillProgress,
  InsertMaintenanceAchievement,
  InsertUserAchievement,
  InsertSkillChallenge,
  InsertUserChallengeProgress,
  MaintenanceSkill,
  UserSkillProgress,
  MaintenanceAchievement
} from '@shared/schema';

interface SkillGainEvent {
  userId: number;
  skillCategory: string;
  experienceGained: number;
  action: string;
  equipmentType?: string;
  difficulty?: number;
  qualityScore?: number;
  timeEfficiency?: number;
}

interface LevelUpEvent {
  userId: number;
  skillId: number;
  oldLevel: number;
  newLevel: number;
  experiencePoints: number;
}

interface AchievementUnlockEvent {
  userId: number;
  achievementId: number;
  achievementName: string;
  category: string;
  pointsAwarded: number;
}

interface ChallengeEvent {
  userId: number;
  challengeId: number;
  action: 'start' | 'complete' | 'fail';
  score?: number;
  timeElapsed?: number;
}

export class GamificationEngine extends EventEmitter {
  private userSkillCache: Map<number, Map<number, UserSkillProgress>> = new Map();
  private achievementCache: Map<number, MaintenanceAchievement[]> = new Map();
  private activeChallenges: Map<number, any[]> = new Map(); // userId -> active challenges
  private isInitialized: boolean = false;

  constructor() {
    super();
  }

  /**
   * Initialize the gamification engine
   */
  async initialize(): Promise<void> {
    try {
      console.log('🎮 Initializing Gamification Engine...');
      
      // Load skills and achievements data
      await this.loadMasterData();
      
      // Load user progress cache
      await this.loadUserProgressCache();
      
      // Start periodic challenge updates
      this.startChallengeManager();
      
      this.isInitialized = true;
      console.log('✅ Gamification Engine initialized successfully');
      
      this.emit('initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Gamification Engine:', error);
      throw error;
    }
  }

  /**
   * Load master skills and achievements data
   */
  private async loadMasterData(): Promise<void> {
    try {
      // Create maintenance skills if they don't exist
      const skillsData = [
        {
          skillName: 'Diagnostic Mécanique',
          skillCategory: 'mechanical',
          description: 'Expertise en diagnostic des défaillances mécaniques',
          maxLevel: 10,
          experienceMultiplier: 1.0
        },
        {
          skillName: 'Maintenance Électrique',
          skillCategory: 'electrical',
          description: 'Compétences en maintenance électrique et électronique',
          maxLevel: 10,
          experienceMultiplier: 1.2
        },
        {
          skillName: 'Systèmes Hydrauliques',
          skillCategory: 'hydraulic',
          description: 'Expertise des systèmes hydrauliques industriels',
          maxLevel: 10,
          experienceMultiplier: 1.1
        },
        {
          skillName: 'Pneumatique Industrielle',
          skillCategory: 'pneumatic',
          description: 'Maîtrise des systèmes pneumatiques',
          maxLevel: 10,
          experienceMultiplier: 1.0
        },
        {
          skillName: 'Maintenance Prédictive',
          skillCategory: 'predictive',
          description: 'Utilisation des outils de maintenance prédictive',
          maxLevel: 15,
          experienceMultiplier: 1.5
        },
        {
          skillName: 'Sécurité Industrielle',
          skillCategory: 'safety',
          description: 'Respect des procédures de sécurité',
          maxLevel: 8,
          experienceMultiplier: 2.0
        }
      ];

      console.log(`🛠️ Loaded ${skillsData.length} maintenance skills`);

      // Create achievements if they don't exist
      const achievementsData = [
        {
          achievementName: 'Premier Diagnostic',
          description: 'Effectuer votre premier diagnostic avec SMDiagFix',
          category: 'milestone',
          pointsAwarded: 50,
          requirements: { diagnosticsCompleted: 1 },
          rarity: 'common'
        },
        {
          achievementName: 'Expert Diagnostiqueur',
          description: 'Effectuer 100 diagnostics réussis',
          category: 'efficiency',
          pointsAwarded: 500,
          requirements: { diagnosticsCompleted: 100, successRate: 0.85 },
          rarity: 'rare'
        },
        {
          achievementName: 'Maître de la Vitesse',
          description: 'Résoudre 10 pannes en moins de 30 minutes chacune',
          category: 'efficiency',
          pointsAwarded: 300,
          requirements: { fastResolutions: 10, maxTime: 30 },
          rarity: 'epic'
        },
        {
          achievementName: 'Perfectionniste',
          description: 'Maintenir un taux de réussite de 95% sur 50 diagnostics',
          category: 'quality',
          pointsAwarded: 750,
          requirements: { diagnosticsCompleted: 50, successRate: 0.95 },
          rarity: 'epic'
        },
        {
          achievementName: 'Innovateur',
          description: 'Utiliser l\'IA avancée pour 25 diagnostics',
          category: 'innovation',
          pointsAwarded: 200,
          requirements: { aiDiagnostics: 25 },
          rarity: 'rare'
        },
        {
          achievementName: 'Gardien de la Sécurité',
          description: 'Compléter 20 procédures sans incident de sécurité',
          category: 'safety',
          pointsAwarded: 400,
          requirements: { safeCompletions: 20 },
          rarity: 'epic'
        },
        {
          achievementName: 'Légende de la Maintenance',
          description: 'Atteindre le niveau 10 dans 3 compétences différentes',
          category: 'mastery',
          pointsAwarded: 1000,
          requirements: { masterSkills: 3, minLevel: 10 },
          rarity: 'legendary'
        }
      ];

      console.log(`🏆 Loaded ${achievementsData.length} achievements`);

      // Create skill challenges
      const challengesData = [
        {
          challengeName: 'Diagnostic Rapide',
          description: 'Diagnostiquer une panne en moins de 15 minutes',
          skillId: 1, // Diagnostic Mécanique
          difficultyLevel: 2,
          experienceReward: 75,
          requirements: { maxTime: 15, minAccuracy: 0.8 },
          timeLimit: 15
        },
        {
          challengeName: 'Maître de l\'IA',
          description: 'Utiliser l\'IA avancée pour 5 diagnostics consécutifs',
          skillId: 5, // Maintenance Prédictive
          difficultyLevel: 3,
          experienceReward: 150,
          requirements: { consecutiveAI: 5, minConfidence: 0.85 },
          timeLimit: 60
        },
        {
          challengeName: 'Perfectionniste Électrique',
          description: 'Résoudre 3 pannes électriques sans erreur',
          skillId: 2, // Maintenance Électrique
          difficultyLevel: 4,
          experienceReward: 200,
          requirements: { electricalRepairs: 3, errorRate: 0 },
          timeLimit: 120
        }
      ];

      console.log(`🎯 Loaded ${challengesData.length} skill challenges`);
    } catch (error) {
      console.error('Error loading master data:', error);
    }
  }

  /**
   * Load user progress into cache
   */
  private async loadUserProgressCache(): Promise<void> {
    try {
      // In a real implementation, load from database
      // For now, initialize with sample data
      
      // Sample user skill progress
      const sampleUsers = [1, 2, 3]; // User IDs
      
      for (const userId of sampleUsers) {
        const userSkills = new Map<number, UserSkillProgress>();
        
        // Initialize skills for each user
        for (let skillId = 1; skillId <= 6; skillId++) {
          const progress: UserSkillProgress = {
            id: userId * 10 + skillId,
            userId,
            skillId,
            currentLevel: Math.floor(Math.random() * 5) + 1,
            experiencePoints: Math.floor(Math.random() * 500),
            nextLevelThreshold: this.calculateLevelThreshold(Math.floor(Math.random() * 5) + 1),
            achievementsUnlocked: [],
            lastActivityAt: new Date()
          };
          
          userSkills.set(skillId, progress);
        }
        
        this.userSkillCache.set(userId, userSkills);
      }
      
      console.log(`👥 Loaded skill progress for ${sampleUsers.length} users`);
    } catch (error) {
      console.error('Error loading user progress cache:', error);
    }
  }

  /**
   * Process skill gain from maintenance activities
   */
  async processSkillGain(event: SkillGainEvent): Promise<void> {
    try {
      const userSkills = this.userSkillCache.get(event.userId);
      if (!userSkills) {
        console.warn(`User ${event.userId} not found in skill cache`);
        return;
      }

      // Find relevant skills for the action
      const relevantSkills = this.findRelevantSkills(event);
      
      for (const skillId of relevantSkills) {
        const skillProgress = userSkills.get(skillId);
        if (!skillProgress) continue;

        // Calculate experience gain with multipliers
        const baseExperience = event.experienceGained;
        const qualityMultiplier = event.qualityScore ? Math.min(2.0, event.qualityScore) : 1.0;
        const difficultyMultiplier = event.difficulty ? (1.0 + event.difficulty * 0.2) : 1.0;
        const efficiencyMultiplier = event.timeEfficiency ? Math.min(1.5, event.timeEfficiency) : 1.0;
        
        const totalExperience = Math.round(
          baseExperience * qualityMultiplier * difficultyMultiplier * efficiencyMultiplier
        );

        // Add experience to skill
        const oldLevel = skillProgress.currentLevel;
        skillProgress.experiencePoints += totalExperience;
        skillProgress.lastActivityAt = new Date();

        // Check for level up
        while (skillProgress.experiencePoints >= skillProgress.nextLevelThreshold && 
               skillProgress.currentLevel < 15) {
          
          skillProgress.experiencePoints -= skillProgress.nextLevelThreshold;
          skillProgress.currentLevel++;
          skillProgress.nextLevelThreshold = this.calculateLevelThreshold(skillProgress.currentLevel);
          
          console.log(`🎉 Level up! User ${event.userId} reached level ${skillProgress.currentLevel} in skill ${skillId}`);
          
          // Emit level up event
          const levelUpEvent: LevelUpEvent = {
            userId: event.userId,
            skillId,
            oldLevel,
            newLevel: skillProgress.currentLevel,
            experiencePoints: skillProgress.experiencePoints
          };
          
          this.emit('levelUp', levelUpEvent);
          
          // Check for achievements
          await this.checkAchievements(event.userId);
        }

        // Update cache
        userSkills.set(skillId, skillProgress);
        
        console.log(`📈 Skill gain: User ${event.userId}, Skill ${skillId}, XP +${totalExperience} (Level ${skillProgress.currentLevel})`);
      }

      // Emit skill gain event
      this.emit('skillGain', event);
      
    } catch (error) {
      console.error('Error processing skill gain:', error);
    }
  }

  /**
   * Find relevant skills for an action
   */
  private findRelevantSkills(event: SkillGainEvent): number[] {
    const skillMapping: { [key: string]: number[] } = {
      'diagnostic_completed': [1, 5], // Diagnostic Mécanique, Maintenance Prédictive
      'repair_completed': [1, 2, 3, 4], // All technical skills
      'electrical_repair': [2], // Maintenance Électrique
      'hydraulic_repair': [3], // Systèmes Hydrauliques
      'pneumatic_repair': [4], // Pneumatique Industrielle
      'ai_diagnostic': [5], // Maintenance Prédictive
      'safety_procedure': [6], // Sécurité Industrielle
      'predictive_analysis': [5], // Maintenance Prédictive
      'threshold_detection': [5], // Maintenance Prédictive
    };

    const baseSkills = skillMapping[event.action] || [1]; // Default to Diagnostic Mécanique
    
    // Add equipment-specific skills
    if (event.equipmentType) {
      const equipmentSkills: { [key: string]: number[] } = {
        'moteur': [1, 2], // Mécanique + Électrique
        'pompe': [1, 3], // Mécanique + Hydraulique
        'compresseur': [1, 4], // Mécanique + Pneumatique
        'transformateur': [2], // Électrique
        'ventilateur': [1, 2] // Mécanique + Électrique
      };
      
      const additionalSkills = equipmentSkills[event.equipmentType] || [];
      baseSkills.push(...additionalSkills);
    }
    
    // Remove duplicates
    return [...new Set(baseSkills)];
  }

  /**
   * Calculate experience threshold for a level
   */
  private calculateLevelThreshold(level: number): number {
    // Exponential progression: Level N requires N^2 * 100 XP
    return Math.pow(level + 1, 2) * 100;
  }

  /**
   * Check and unlock achievements for a user
   */
  private async checkAchievements(userId: number): Promise<void> {
    try {
      // Get user statistics
      const userStats = await this.getUserStatistics(userId);
      
      // Check each achievement
      const achievements = [
        {
          id: 1,
          name: 'Premier Diagnostic',
          requirements: { diagnosticsCompleted: 1 },
          points: 50
        },
        {
          id: 2,
          name: 'Expert Diagnostiqueur',
          requirements: { diagnosticsCompleted: 100, successRate: 0.85 },
          points: 500
        },
        // Add more achievements as needed
      ];

      for (const achievement of achievements) {
        if (await this.checkAchievementRequirements(userId, achievement.requirements, userStats)) {
          if (!await this.hasUserAchievement(userId, achievement.id)) {
            await this.unlockAchievement(userId, achievement);
          }
        }
      }
      
    } catch (error) {
      console.error('Error checking achievements:', error);
    }
  }

  /**
   * Check if achievement requirements are met
   */
  private async checkAchievementRequirements(userId: number, requirements: any, userStats: any): Promise<boolean> {
    for (const [key, value] of Object.entries(requirements)) {
      if (userStats[key] === undefined || userStats[key] < value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if user has an achievement
   */
  private async hasUserAchievement(userId: number, achievementId: number): Promise<boolean> {
    // In a real implementation, check database
    return false; // For demo, assume user doesn't have achievements yet
  }

  /**
   * Unlock achievement for user
   */
  private async unlockAchievement(userId: number, achievement: any): Promise<void> {
    try {
      console.log(`🏆 Achievement unlocked! User ${userId}: ${achievement.name} (+${achievement.points} points)`);
      
      const unlockEvent: AchievementUnlockEvent = {
        userId,
        achievementId: achievement.id,
        achievementName: achievement.name,
        category: 'milestone',
        pointsAwarded: achievement.points
      };
      
      this.emit('achievementUnlocked', unlockEvent);
      
    } catch (error) {
      console.error('Error unlocking achievement:', error);
    }
  }

  /**
   * Get user statistics for achievement checking
   */
  private async getUserStatistics(userId: number): Promise<any> {
    try {
      // In a real implementation, calculate from database
      return {
        diagnosticsCompleted: Math.floor(Math.random() * 150),
        successRate: 0.8 + Math.random() * 0.15,
        fastResolutions: Math.floor(Math.random() * 20),
        aiDiagnostics: Math.floor(Math.random() * 30),
        safeCompletions: Math.floor(Math.random() * 25)
      };
    } catch (error) {
      console.error('Error getting user statistics:', error);
      return {};
    }
  }

  /**
   * Start a skill challenge for a user
   */
  async startChallenge(userId: number, challengeId: number): Promise<void> {
    try {
      const activeUserChallenges = this.activeChallenges.get(userId) || [];
      
      // Check if already active
      if (activeUserChallenges.some(c => c.challengeId === challengeId)) {
        console.warn(`Challenge ${challengeId} already active for user ${userId}`);
        return;
      }
      
      const challenge = {
        challengeId,
        userId,
        startTime: new Date(),
        status: 'active',
        progress: 0.0
      };
      
      activeUserChallenges.push(challenge);
      this.activeChallenges.set(userId, activeUserChallenges);
      
      console.log(`🎯 Challenge started: User ${userId}, Challenge ${challengeId}`);
      
      const challengeEvent: ChallengeEvent = {
        userId,
        challengeId,
        action: 'start'
      };
      
      this.emit('challengeStarted', challengeEvent);
      
    } catch (error) {
      console.error('Error starting challenge:', error);
    }
  }

  /**
   * Update challenge progress
   */
  async updateChallengeProgress(userId: number, challengeId: number, progress: number): Promise<void> {
    try {
      const activeUserChallenges = this.activeChallenges.get(userId) || [];
      const challenge = activeUserChallenges.find(c => c.challengeId === challengeId);
      
      if (!challenge) {
        console.warn(`Challenge ${challengeId} not found for user ${userId}`);
        return;
      }
      
      challenge.progress = Math.min(1.0, progress);
      
      // Check for completion
      if (challenge.progress >= 1.0) {
        await this.completeChallenge(userId, challengeId);
      }
      
    } catch (error) {
      console.error('Error updating challenge progress:', error);
    }
  }

  /**
   * Complete a skill challenge
   */
  async completeChallenge(userId: number, challengeId: number, score?: number): Promise<void> {
    try {
      const activeUserChallenges = this.activeChallenges.get(userId) || [];
      const challengeIndex = activeUserChallenges.findIndex(c => c.challengeId === challengeId);
      
      if (challengeIndex === -1) {
        console.warn(`Challenge ${challengeId} not found for user ${userId}`);
        return;
      }
      
      const challenge = activeUserChallenges[challengeIndex];
      const timeElapsed = (new Date().getTime() - challenge.startTime.getTime()) / (1000 * 60); // minutes
      
      // Remove from active challenges
      activeUserChallenges.splice(challengeIndex, 1);
      this.activeChallenges.set(userId, activeUserChallenges);
      
      // Award experience based on challenge
      const experienceReward = 150; // Base reward
      const timeBonus = Math.max(0, 50 - timeElapsed); // Bonus for fast completion
      const totalExperience = Math.round(experienceReward + timeBonus);
      
      // Create skill gain event
      const skillGainEvent: SkillGainEvent = {
        userId,
        skillCategory: 'challenge_completion',
        experienceGained: totalExperience,
        action: 'challenge_completed',
        difficulty: 3,
        qualityScore: score ? score / 100 : 1.0
      };
      
      await this.processSkillGain(skillGainEvent);
      
      console.log(`🎯 Challenge completed! User ${userId}, Challenge ${challengeId}, XP +${totalExperience}`);
      
      const challengeEvent: ChallengeEvent = {
        userId,
        challengeId,
        action: 'complete',
        score,
        timeElapsed
      };
      
      this.emit('challengeCompleted', challengeEvent);
      
    } catch (error) {
      console.error('Error completing challenge:', error);
    }
  }

  /**
   * Get user skill progress
   */
  getUserSkillProgress(userId: number): UserSkillProgress[] {
    const userSkills = this.userSkillCache.get(userId);
    if (!userSkills) return [];
    
    return Array.from(userSkills.values());
  }

  /**
   * Get user leaderboard position
   */
  async getUserLeaderboardPosition(userId: number): Promise<any> {
    try {
      const userSkills = this.getUserSkillProgress(userId);
      const totalExperience = userSkills.reduce((sum, skill) => sum + skill.experiencePoints, 0);
      const averageLevel = userSkills.reduce((sum, skill) => sum + skill.currentLevel, 0) / userSkills.length;
      
      return {
        userId,
        totalExperience,
        averageLevel: Math.round(averageLevel * 10) / 10,
        skillsCount: userSkills.length,
        position: Math.floor(Math.random() * 20) + 1, // Mock position
        percentile: Math.floor(Math.random() * 100)
      };
    } catch (error) {
      console.error('Error getting leaderboard position:', error);
      return null;
    }
  }

  /**
   * Get available challenges for user
   */
  getAvailableChallenges(userId: number): any[] {
    const userSkills = this.getUserSkillProgress(userId);
    const activeUserChallenges = this.activeChallenges.get(userId) || [];
    
    // Mock available challenges based on user level
    const allChallenges = [
      {
        id: 1,
        name: 'Diagnostic Rapide',
        description: 'Diagnostiquer une panne en moins de 15 minutes',
        difficulty: 2,
        experienceReward: 75,
        skillRequired: 'mechanical',
        minLevel: 2
      },
      {
        id: 2,
        name: 'Maître de l\'IA',
        description: 'Utiliser l\'IA avancée pour 5 diagnostics consécutifs',
        difficulty: 3,
        experienceReward: 150,
        skillRequired: 'predictive',
        minLevel: 3
      }
    ];
    
    // Filter challenges based on user skills and active challenges
    return allChallenges.filter(challenge => {
      // Check if already active
      if (activeUserChallenges.some(ac => ac.challengeId === challenge.id)) {
        return false;
      }
      
      // Check skill requirements
      const relevantSkill = userSkills.find(skill => 
        skill.skillId === (challenge.skillRequired === 'mechanical' ? 1 : 5)
      );
      
      return relevantSkill && relevantSkill.currentLevel >= challenge.minLevel;
    });
  }

  /**
   * Start challenge manager for periodic updates
   */
  private startChallengeManager(): void {
    // Check for expired challenges every minute
    setInterval(() => {
      this.checkExpiredChallenges();
    }, 60 * 1000);
    
    console.log('🎯 Started challenge manager');
  }

  /**
   * Check for expired challenges
   */
  private checkExpiredChallenges(): void {
    const now = new Date();
    
    this.activeChallenges.forEach((challenges: any[], userId: number) => {
      const expiredChallenges = challenges.filter((challenge: any) => {
        const timeElapsed = (now.getTime() - challenge.startTime.getTime()) / (1000 * 60); // minutes
        return timeElapsed > 120; // 2 hours timeout
      });
      
      expiredChallenges.forEach((challenge: any) => {
        console.log(`⏰ Challenge expired: User ${userId}, Challenge ${challenge.challengeId}`);
        
        // Remove expired challenge
        const index = challenges.indexOf(challenge);
        if (index > -1) {
          challenges.splice(index, 1);
        }
        
        const challengeEvent: ChallengeEvent = {
          userId,
          challengeId: challenge.challengeId,
          action: 'fail'
        };
        
        this.emit('challengeExpired', challengeEvent);
      });
    });
  }

  /**
   * Get gamification statistics
   */
  getGamificationStats(): any {
    const totalUsers = this.userSkillCache.size;
    let totalActiveChallenges = 0;
    
    this.activeChallenges.forEach(challenges => {
      totalActiveChallenges += challenges.length;
    });
    
    return {
      totalUsers,
      skillsTracked: 6,
      achievementsAvailable: 7,
      activeChallenges: totalActiveChallenges,
      isInitialized: this.isInitialized
    };
  }
}

// Export singleton instance
export const gamificationEngine = new GamificationEngine();
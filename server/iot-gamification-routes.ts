import type { Express } from "express";
import { advancedIoTConnector } from './integrations/advanced-iot-connector';
import { smartNotificationEngine } from './integrations/smart-notification-engine';
import { gamificationEngine } from './integrations/gamification-engine';

export function registerIoTGamificationRoutes(app: Express) {
  console.log('🔗 Registering IoT and Gamification routes...');

  // ==================== IoT SENSOR INTEGRATION ROUTES ====================

  /**
   * Get all IoT devices status
   */
  app.get('/api/iot/devices', async (req, res) => {
    try {
      const devices = advancedIoTConnector.getDeviceStatus();
      
      res.json({
        success: true,
        data: devices,
        summary: {
          totalDevices: devices.length,
          activeDevices: devices.filter(d => d.status === 'active').length,
          lowBatteryDevices: devices.filter(d => d.batteryLevel < 0.3).length
        }
      });
    } catch (error) {
      console.error('Error fetching IoT devices:', error);
      res.status(500).json({ message: 'Failed to fetch IoT devices' });
    }
  });

  /**
   * Get sensor readings for a specific device
   */
  app.get('/api/iot/devices/:deviceId/readings', async (req, res) => {
    try {
      const { deviceId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const readings = advancedIoTConnector.getDeviceReadings(deviceId, limit);
      
      res.json({
        success: true,
        deviceId,
        readings,
        count: readings.length
      });
    } catch (error) {
      console.error('Error fetching device readings:', error);
      res.status(500).json({ message: 'Failed to fetch device readings' });
    }
  });

  /**
   * Get all recent sensor readings across devices
   */
  app.get('/api/iot/readings/recent', async (req, res) => {
    try {
      const minutes = parseInt(req.query.minutes as string) || 10;
      
      const readings = advancedIoTConnector.getAllRecentReadings(minutes);
      
      // Group by sensor type for analysis
      const groupedReadings = readings.reduce((acc: any, reading) => {
        if (!acc[reading.sensorType]) {
          acc[reading.sensorType] = [];
        }
        acc[reading.sensorType].push(reading);
        return acc;
      }, {});
      
      res.json({
        success: true,
        timeframe: `${minutes} minutes`,
        totalReadings: readings.length,
        readings: groupedReadings,
        sensorTypes: Object.keys(groupedReadings)
      });
    } catch (error) {
      console.error('Error fetching recent readings:', error);
      res.status(500).json({ message: 'Failed to fetch recent readings' });
    }
  });

  /**
   * Get automated symptom detections
   */
  app.get('/api/iot/symptoms/detected', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string || 'all';
      
      // Mock data for demonstration
      const detectedSymptoms = [
        {
          id: 1,
          equipmentId: 1,
          detectedSymptom: 'Usure roulement',
          symptomCode: 'BEARING_001',
          confidence: 0.87,
          detectionAlgorithm: 'multi_sensor_correlation',
          status: 'pending',
          triggeredAt: new Date(Date.now() - 3600000), // 1 hour ago
          deviceId: 'ACCEL-001-EQ001'
        },
        {
          id: 2,
          equipmentId: 2,
          detectedSymptom: 'Cavitation pompe',
          symptomCode: 'PUMP_001',
          confidence: 0.78,
          detectionAlgorithm: 'pressure_vibration_analysis',
          status: 'verified',
          triggeredAt: new Date(Date.now() - 7200000), // 2 hours ago
          deviceId: 'PRESS-001-EQ002',
          verifiedBy: 1,
          verifiedAt: new Date(Date.now() - 1800000) // 30 minutes ago
        }
      ];
      
      const filteredSymptoms = status === 'all' ? 
        detectedSymptoms : 
        detectedSymptoms.filter(s => s.status === status);
      
      res.json({
        success: true,
        symptoms: filteredSymptoms.slice(0, limit),
        total: filteredSymptoms.length,
        summary: {
          pending: detectedSymptoms.filter(s => s.status === 'pending').length,
          verified: detectedSymptoms.filter(s => s.status === 'verified').length,
          falsePositive: detectedSymptoms.filter(s => s.status === 'false_positive').length
        }
      });
    } catch (error) {
      console.error('Error fetching detected symptoms:', error);
      res.status(500).json({ message: 'Failed to fetch detected symptoms' });
    }
  });

  /**
   * Verify or reject an automated symptom detection
   */
  app.post('/api/iot/symptoms/:symptomId/verify', async (req, res) => {
    try {
      const { symptomId } = req.params;
      const { verified, userId, notes } = req.body;
      
      // In a real implementation, update the database
      console.log(`🎯 Symptom ${symptomId} ${verified ? 'verified' : 'rejected'} by user ${userId}`);
      
      // Award gamification points for verification
      if (verified) {
        await gamificationEngine.processSkillGain({
          userId,
          skillCategory: 'predictive',
          experienceGained: 25,
          action: 'symptom_verification',
          qualityScore: 1.0
        });
      }
      
      res.json({
        success: true,
        message: `Symptom ${verified ? 'verified' : 'rejected'} successfully`,
        symptomId,
        status: verified ? 'verified' : 'false_positive'
      });
    } catch (error) {
      console.error('Error verifying symptom:', error);
      res.status(500).json({ message: 'Failed to verify symptom' });
    }
  });

  // ==================== SMART NOTIFICATIONS ROUTES ====================

  /**
   * Get smart notifications for a user
   */
  app.get('/api/notifications/smart/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const unreadOnly = req.query.unreadOnly === 'true';
      
      // Mock smart notifications
      const notifications = [
        {
          id: 1,
          recipientId: parseInt(userId),
          equipmentId: 1,
          notificationType: 'threshold_breach',
          severity: 'critical',
          title: '🚨 Seuil critique dépassé',
          message: 'Moteur principal: vibration critique (5.2mm/s > 4.5mm/s)',
          actionRequired: 'ARRÊT ÉQUIPEMENT RECOMMANDÉ • Inspecter immédiatement l\'équipement',
          estimatedTimeToFailure: 12,
          isRead: false,
          isActioned: false,
          createdAt: new Date(Date.now() - 1800000), // 30 minutes ago
          metadata: {
            deviceId: 'ACCEL-001-EQ001',
            sensorType: 'vibration',
            threshold: { warningLevel: 4.5, criticalLevel: 6.0 }
          }
        },
        {
          id: 2,
          recipientId: parseInt(userId),
          equipmentId: 2,
          notificationType: 'predictive_alert',
          severity: 'warning',
          title: '🔮 Alerte maintenance prédictive',
          message: 'Pompe hydraulique: défaillance prédite dans 48h (confiance: 82%)',
          actionRequired: 'Planifier maintenance dans les 24-48h • Vérifier disponibilité pièces',
          estimatedTimeToFailure: 48,
          isRead: true,
          isActioned: false,
          createdAt: new Date(Date.now() - 3600000), // 1 hour ago
          metadata: {
            algorithm: 'predictive_analytics',
            confidence: 0.82
          }
        },
        {
          id: 3,
          recipientId: parseInt(userId),
          equipmentId: 1,
          notificationType: 'automated_symptom',
          severity: 'warning',
          title: '🎯 Symptôme détecté: Usure roulement',
          message: 'L\'IA a détecté "Usure roulement" avec 87% de confiance. Algorithme: multi_sensor_correlation',
          actionRequired: 'Vérifier l\'équipement et confirmer le diagnostic',
          isRead: false,
          isActioned: false,
          createdAt: new Date(Date.now() - 7200000), // 2 hours ago
          metadata: {
            detectedSymptom: 'Usure roulement',
            confidence: 0.87,
            algorithm: 'multi_sensor_correlation'
          }
        }
      ];
      
      const filteredNotifications = unreadOnly ? 
        notifications.filter(n => !n.isRead) : 
        notifications;
      
      res.json({
        success: true,
        notifications: filteredNotifications.slice(0, limit),
        total: filteredNotifications.length,
        summary: {
          unread: notifications.filter(n => !n.isRead).length,
          critical: notifications.filter(n => n.severity === 'critical').length,
          actionRequired: notifications.filter(n => !n.isActioned).length
        }
      });
    } catch (error) {
      console.error('Error fetching smart notifications:', error);
      res.status(500).json({ message: 'Failed to fetch smart notifications' });
    }
  });

  /**
   * Mark notification as read
   */
  app.post('/api/notifications/:notificationId/read', async (req, res) => {
    try {
      const { notificationId } = req.params;
      
      console.log(`📖 Notification ${notificationId} marked as read`);
      
      res.json({
        success: true,
        message: 'Notification marked as read',
        notificationId
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ message: 'Failed to mark notification as read' });
    }
  });

  /**
   * Mark notification as actioned
   */
  app.post('/api/notifications/:notificationId/action', async (req, res) => {
    try {
      const { notificationId } = req.params;
      const { userId, actionTaken } = req.body;
      
      console.log(`✅ Notification ${notificationId} actioned by user ${userId}: ${actionTaken}`);
      
      // Award gamification points for taking action
      if (userId) {
        await gamificationEngine.processSkillGain({
          userId,
          skillCategory: 'predictive',
          experienceGained: 15,
          action: 'notification_action',
          qualityScore: 1.0
        });
      }
      
      res.json({
        success: true,
        message: 'Notification marked as actioned',
        notificationId,
        actionTaken
      });
    } catch (error) {
      console.error('Error marking notification as actioned:', error);
      res.status(500).json({ message: 'Failed to mark notification as actioned' });
    }
  });

  // ==================== GAMIFICATION ROUTES ====================

  /**
   * Get user skill progress
   */
  app.get('/api/gamification/skills/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      
      const skillProgress = gamificationEngine.getUserSkillProgress(parseInt(userId));
      const leaderboardPosition = await gamificationEngine.getUserLeaderboardPosition(parseInt(userId));
      
      res.json({
        success: true,
        userId: parseInt(userId),
        skills: skillProgress,
        leaderboard: leaderboardPosition,
        summary: {
          totalSkills: skillProgress.length,
          averageLevel: skillProgress.reduce((sum, s) => sum + s.currentLevel, 0) / skillProgress.length,
          totalExperience: skillProgress.reduce((sum, s) => sum + s.experiencePoints, 0)
        }
      });
    } catch (error) {
      console.error('Error fetching user skills:', error);
      res.status(500).json({ message: 'Failed to fetch user skills' });
    }
  });

  /**
   * Get available challenges for user
   */
  app.get('/api/gamification/challenges/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      
      const availableChallenges = gamificationEngine.getAvailableChallenges(parseInt(userId));
      
      res.json({
        success: true,
        userId: parseInt(userId),
        challenges: availableChallenges,
        count: availableChallenges.length
      });
    } catch (error) {
      console.error('Error fetching challenges:', error);
      res.status(500).json({ message: 'Failed to fetch challenges' });
    }
  });

  /**
   * Start a skill challenge
   */
  app.post('/api/gamification/challenges/:challengeId/start', async (req, res) => {
    try {
      const { challengeId } = req.params;
      const { userId } = req.body;
      
      await gamificationEngine.startChallenge(userId, parseInt(challengeId));
      
      res.json({
        success: true,
        message: 'Challenge started successfully',
        challengeId: parseInt(challengeId),
        userId
      });
    } catch (error) {
      console.error('Error starting challenge:', error);
      res.status(500).json({ message: 'Failed to start challenge' });
    }
  });

  /**
   * Complete a skill challenge
   */
  app.post('/api/gamification/challenges/:challengeId/complete', async (req, res) => {
    try {
      const { challengeId } = req.params;
      const { userId, score } = req.body;
      
      await gamificationEngine.completeChallenge(userId, parseInt(challengeId), score);
      
      res.json({
        success: true,
        message: 'Challenge completed successfully',
        challengeId: parseInt(challengeId),
        userId,
        score
      });
    } catch (error) {
      console.error('Error completing challenge:', error);
      res.status(500).json({ message: 'Failed to complete challenge' });
    }
  });

  /**
   * Award experience points for maintenance activities
   */
  app.post('/api/gamification/experience/award', async (req, res) => {
    try {
      const { userId, action, experienceGained, equipmentType, qualityScore, timeEfficiency } = req.body;
      
      const skillCategory = req.body.skillCategory || 'mechanical';
      
      await gamificationEngine.processSkillGain({
        userId,
        skillCategory,
        experienceGained,
        action,
        equipmentType,
        qualityScore,
        timeEfficiency
      });
      
      res.json({
        success: true,
        message: 'Experience awarded successfully',
        userId,
        experienceGained,
        action
      });
    } catch (error) {
      console.error('Error awarding experience:', error);
      res.status(500).json({ message: 'Failed to award experience' });
    }
  });

  /**
   * Get gamification leaderboard
   */
  app.get('/api/gamification/leaderboard', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      
      // Mock leaderboard data
      const leaderboard = [
        {
          userId: 1,
          fullName: 'Jean Dupont',
          totalExperience: 2450,
          averageLevel: 6.2,
          achievements: 12,
          position: 1
        },
        {
          userId: 2,
          fullName: 'Marie Martin',
          totalExperience: 2180,
          averageLevel: 5.8,
          achievements: 9,
          position: 2
        },
        {
          userId: 3,
          fullName: 'Pierre Durand',
          totalExperience: 1950,
          averageLevel: 5.3,
          achievements: 8,
          position: 3
        }
      ].slice(0, limit);
      
      res.json({
        success: true,
        leaderboard,
        totalPlayers: 25,
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      res.status(500).json({ message: 'Failed to fetch leaderboard' });
    }
  });

  /**
   * Get system status for IoT and gamification
   */
  app.get('/api/iot-gamification/status', async (req, res) => {
    try {
      const iotStatus = {
        connected: advancedIoTConnector.isConnectedToIoT(),
        devicesCount: advancedIoTConnector.getDeviceStatus().length,
        recentReadings: advancedIoTConnector.getAllRecentReadings(5).length
      };
      
      console.log('📊 IoT and Gamification system status requested');
      
      res.json({
        success: true,
        iot: iotStatus,
        notifications: smartNotificationEngine.getNotificationStats(),
        gamification: gamificationEngine.getGamificationStats(),
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error fetching system status:', error);
      res.status(500).json({ message: 'Failed to fetch system status' });
    }
  });

  console.log('✅ IoT and Gamification routes registered successfully');
}
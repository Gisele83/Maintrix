#!/usr/bin/env python3
"""
Advanced ML Features for SMDiagFix
Implements additional ML capabilities: predictive maintenance, failure patterns, and maintenance scheduling
"""

import sys
import json
import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.neural_network import MLPClassifier
from sklearn.svm import SVC
from sklearn.model_selection import cross_val_score
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.preprocessing import MinMaxScaler
from sklearn.cluster import DBSCAN
from sklearn.decomposition import PCA
import joblib
import os
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
import warnings
warnings.filterwarnings('ignore')

class AdvancedMLEngine:
    def __init__(self):
        # Advanced models for different aspects
        self.anomaly_detector = IsolationForest(contamination=0.1, random_state=42)
        self.neural_network = MLPClassifier(hidden_layer_sizes=(100, 50), max_iter=500, random_state=42)
        self.failure_predictor = SVC(probability=True, kernel='rbf', random_state=42)
        self.maintenance_scheduler = DBSCAN(eps=0.5, min_samples=2)
        
        # Scalers and preprocessors
        self.feature_scaler = MinMaxScaler()
        self.pca_reducer = PCA(n_components=10)
        
        # Pattern analysis
        self.failure_patterns = {}
        self.maintenance_intervals = {}
        self.risk_scores = {}
        
        self.is_trained = False
        
    def fetch_comprehensive_data(self) -> Dict[str, List]:
        """Fetch all relevant data from the database"""
        try:
            # Fetch maintenance cases
            cases_response = requests.get('http://localhost:5000/api/maintenance-cases', timeout=10)
            cases = cases_response.json() if cases_response.status_code == 200 else []
            
            # Fetch diagnostic sessions
            sessions_response = requests.get('http://localhost:5000/api/history', timeout=10)
            sessions = sessions_response.json() if sessions_response.status_code == 200 else []
            
            return {
                'maintenance_cases': cases,
                'diagnostic_sessions': sessions
            }
        except Exception as e:
            print(f"Error fetching comprehensive data: {e}", file=sys.stderr)
            return {'maintenance_cases': [], 'diagnostic_sessions': []}
    
    def extract_advanced_features(self, data: Dict[str, List]) -> Tuple[np.ndarray, List[str], List[str]]:
        """Extract advanced features for ML analysis"""
        cases = data['maintenance_cases']
        if not cases:
            return np.array([]), [], []
        
        features = []
        labels = []
        equipment_ids = []
        
        for case in cases:
            # Time-based features
            created_at = pd.to_datetime(case.get('createdAt', datetime.now()))
            day_of_week = created_at.weekday()
            hour_of_day = created_at.hour
            
            # Equipment characteristics
            equipment_type = case['equipmentType']
            zone = case.get('zone', 'unknown')
            sector = case.get('sector', 'unknown')
            
            # Operational features
            duration = case.get('duration', 60)
            urgency_score = {'low': 1, 'medium': 2, 'high': 3}.get(case.get('urgency', 'medium'), 2)
            confidence = case.get('confidence', 0.5)
            
            # Symptom complexity (number of symptoms reported)
            symptom_count = len(case.get('symptomsChecked', []))
            symptom_text_length = len(case.get('symptoms', ''))
            
            # Equipment reliability score (based on historical data)
            equipment_id = case.get('equipmentId', 'unknown')
            reliability_score = self._calculate_reliability_score(equipment_id, cases)
            
            # Create feature vector
            feature_vector = [
                day_of_week, hour_of_day, duration, urgency_score, 
                confidence, symptom_count, symptom_text_length, reliability_score,
                # Add equipment type encoding (simplified)
                hash(equipment_type) % 100,
                hash(zone) % 50,
                hash(sector) % 50
            ]
            
            features.append(feature_vector)
            labels.append(case['diagnosis'])
            equipment_ids.append(equipment_id)
        
        return np.array(features), labels, equipment_ids
    
    def _calculate_reliability_score(self, equipment_id: str, cases: List[Dict]) -> float:
        """Calculate equipment reliability based on historical failures"""
        if equipment_id == 'unknown':
            return 0.5
        
        equipment_cases = [c for c in cases if c.get('equipmentId') == equipment_id]
        if len(equipment_cases) == 0:
            return 1.0  # New equipment, assume reliable
        
        # Calculate failure rate
        total_cases = len(equipment_cases)
        resolved_cases = len([c for c in equipment_cases if c.get('resolved', False)])
        
        reliability = resolved_cases / total_cases if total_cases > 0 else 1.0
        return reliability
    
    def train_advanced_models(self) -> Dict[str, Any]:
        """Train all advanced ML models"""
        print("Fetching comprehensive training data...", file=sys.stderr)
        data = self.fetch_comprehensive_data()
        
        if len(data['maintenance_cases']) < 5:
            return {"success": False, "message": "Insufficient data for advanced training"}
        
        print(f"Training advanced models with {len(data['maintenance_cases'])} cases...", file=sys.stderr)
        
        # Extract features
        features, labels, equipment_ids = self.extract_advanced_features(data)
        
        if features.size == 0:
            return {"success": False, "message": "No features extracted"}
        
        # Scale features
        features_scaled = self.feature_scaler.fit_transform(features)
        
        # Apply PCA for dimensionality reduction
        if features_scaled.shape[1] > 10:
            features_pca = self.pca_reducer.fit_transform(features_scaled)
        else:
            features_pca = features_scaled
        
        # Train anomaly detector
        self.anomaly_detector.fit(features_pca)
        anomaly_scores = self.anomaly_detector.decision_function(features_pca)
        
        # Train neural network for complex pattern recognition
        if len(set(labels)) > 1:  # Need at least 2 different diagnoses
            try:
                self.neural_network.fit(features_pca, labels)
                nn_accuracy = cross_val_score(self.neural_network, features_pca, labels, cv=3).mean()
            except:
                nn_accuracy = 0.0
        else:
            nn_accuracy = 0.0
        
        # Train failure predictor
        try:
            failure_labels = ['failure' if 'défectueux' in label.lower() or 'défaillant' in label.lower() 
                             else 'maintenance' for label in labels]
            if len(set(failure_labels)) > 1:
                self.failure_predictor.fit(features_pca, failure_labels)
                fp_accuracy = cross_val_score(self.failure_predictor, features_pca, failure_labels, cv=3).mean()
            else:
                fp_accuracy = 0.0
        except:
            fp_accuracy = 0.0
        
        # Analyze failure patterns
        self._analyze_failure_patterns(features, labels, equipment_ids)
        
        # Calculate maintenance intervals
        self._calculate_maintenance_intervals(data['maintenance_cases'])
        
        self.is_trained = True
        
        return {
            "success": True,
            "message": "Advanced ML models trained successfully",
            "metrics": {
                "neural_network_accuracy": float(nn_accuracy),
                "failure_predictor_accuracy": float(fp_accuracy),
                "anomaly_detection_coverage": len(anomaly_scores[anomaly_scores < 0]) / len(anomaly_scores),
                "failure_patterns_identified": len(self.failure_patterns),
                "equipment_analyzed": len(set(equipment_ids))
            }
        }
    
    def _analyze_failure_patterns(self, features: np.ndarray, labels: List[str], equipment_ids: List[str]):
        """Analyze patterns in equipment failures"""
        df = pd.DataFrame(features, columns=[
            'day_of_week', 'hour_of_day', 'duration', 'urgency_score',
            'confidence', 'symptom_count', 'symptom_text_length', 'reliability_score',
            'equipment_type_hash', 'zone_hash', 'sector_hash'
        ])
        df['diagnosis'] = labels
        df['equipment_id'] = equipment_ids
        
        # Find patterns by diagnosis
        for diagnosis in set(labels):
            diagnosis_data = df[df['diagnosis'] == diagnosis]
            if len(diagnosis_data) > 1:
                pattern = {
                    'avg_duration': diagnosis_data['duration'].mean(),
                    'common_urgency': diagnosis_data['urgency_score'].mode().iloc[0] if not diagnosis_data['urgency_score'].mode().empty else 2,
                    'typical_symptom_count': diagnosis_data['symptom_count'].mean(),
                    'peak_hour': diagnosis_data['hour_of_day'].mode().iloc[0] if not diagnosis_data['hour_of_day'].mode().empty else 12,
                    'peak_day': diagnosis_data['day_of_week'].mode().iloc[0] if not diagnosis_data['day_of_week'].mode().empty else 1,
                    'frequency': len(diagnosis_data)
                }
                self.failure_patterns[diagnosis] = pattern
    
    def _calculate_maintenance_intervals(self, cases: List[Dict]):
        """Calculate optimal maintenance intervals for different equipment types"""
        equipment_data = {}
        
        for case in cases:
            equipment_type = case['equipmentType']
            created_at = pd.to_datetime(case.get('createdAt', datetime.now()))
            
            if equipment_type not in equipment_data:
                equipment_data[equipment_type] = []
            equipment_data[equipment_type].append(created_at)
        
        # Calculate intervals
        for equipment_type, dates in equipment_data.items():
            if len(dates) > 1:
                dates_sorted = sorted(dates)
                intervals = [(dates_sorted[i+1] - dates_sorted[i]).days 
                            for i in range(len(dates_sorted)-1)]
                
                avg_interval = np.mean(intervals) if intervals else 30
                self.maintenance_intervals[equipment_type] = {
                    'recommended_interval_days': max(15, avg_interval * 0.8),  # 80% of average failure interval
                    'critical_interval_days': max(30, avg_interval * 1.2),
                    'historical_avg_days': avg_interval
                }
    
    def predict_advanced_diagnosis(self, equipment_type: str, symptoms: str, 
                                 symptoms_checked: List[str], urgency: str,
                                 zone: str = "unknown", sector: str = "unknown",
                                 equipment_id: str = "unknown") -> Dict[str, Any]:
        """Advanced prediction using multiple ML models"""
        
        if not self.is_trained:
            train_result = self.train_advanced_models()
            if not train_result["success"]:
                return {"error": train_result["message"]}
        
        try:
            # Prepare features
            current_time = datetime.now()
            day_of_week = current_time.weekday()
            hour_of_day = current_time.hour
            
            duration = 60  # Default estimation
            urgency_score = {'low': 1, 'medium': 2, 'high': 3}.get(urgency, 2)
            confidence = 0.7  # Default
            symptom_count = len(symptoms_checked)
            symptom_text_length = len(symptoms)
            
            # Calculate reliability score (simplified for new prediction)
            reliability_score = 0.7  # Default for unknown equipment
            
            feature_vector = np.array([[
                day_of_week, hour_of_day, duration, urgency_score,
                confidence, symptom_count, symptom_text_length, reliability_score,
                hash(equipment_type) % 100,
                hash(zone) % 50,
                hash(sector) % 50
            ]])
            
            # Scale and transform features
            features_scaled = self.feature_scaler.transform(feature_vector)
            if hasattr(self.pca_reducer, 'components_'):
                features_pca = self.pca_reducer.transform(features_scaled)
            else:
                features_pca = features_scaled
            
            results = {}
            
            # Anomaly detection
            anomaly_score = self.anomaly_detector.decision_function(features_pca)[0]
            is_anomaly = anomaly_score < 0
            
            # Neural network prediction
            if hasattr(self.neural_network, 'classes_'):
                nn_prediction = self.neural_network.predict(features_pca)[0]
                nn_probabilities = self.neural_network.predict_proba(features_pca)[0]
                nn_confidence = np.max(nn_probabilities)
            else:
                nn_prediction = "Analyse NN non disponible"
                nn_confidence = 0.5
            
            # Failure prediction
            if hasattr(self.failure_predictor, 'classes_'):
                failure_prediction = self.failure_predictor.predict(features_pca)[0]
                failure_probabilities = self.failure_predictor.predict_proba(features_pca)[0]
                failure_risk = failure_probabilities[1] if len(failure_probabilities) > 1 else 0.5
            else:
                failure_prediction = "maintenance"
                failure_risk = 0.3
            
            # Pattern matching
            pattern_match = self._find_pattern_match(equipment_type, symptom_count, urgency_score)
            
            # Maintenance recommendation
            maintenance_rec = self._get_maintenance_recommendation(equipment_type, equipment_id)
            
            return {
                "neural_network_prediction": nn_prediction,
                "neural_network_confidence": float(nn_confidence),
                "failure_prediction": failure_prediction,
                "failure_risk_score": float(failure_risk),
                "anomaly_detected": bool(is_anomaly),
                "anomaly_score": float(anomaly_score),
                "pattern_match": pattern_match,
                "maintenance_recommendation": maintenance_rec,
                "advanced_insights": self._generate_advanced_insights(
                    is_anomaly, failure_risk, nn_confidence, equipment_type
                )
            }
            
        except Exception as e:
            return {"error": f"Advanced prediction failed: {str(e)}"}
    
    def _find_pattern_match(self, equipment_type: str, symptom_count: int, urgency_score: int) -> Dict[str, Any]:
        """Find matching failure patterns"""
        best_match = None
        best_score = 0
        
        for diagnosis, pattern in self.failure_patterns.items():
            score = 0
            
            # Symptom count similarity
            if abs(pattern['typical_symptom_count'] - symptom_count) <= 1:
                score += 0.3
            
            # Urgency similarity
            if abs(pattern['common_urgency'] - urgency_score) <= 1:
                score += 0.4
            
            # Frequency weight (more common issues get higher scores)
            score += 0.3 * min(pattern['frequency'] / 10, 1.0)
            
            if score > best_score:
                best_score = score
                best_match = {
                    "diagnosis": diagnosis,
                    "match_score": score,
                    "typical_duration": pattern['avg_duration'],
                    "frequency": pattern['frequency']
                }
        
        return best_match or {"diagnosis": "No pattern match", "match_score": 0}
    
    def _get_maintenance_recommendation(self, equipment_type: str, equipment_id: str) -> Dict[str, Any]:
        """Get maintenance scheduling recommendation"""
        if equipment_type in self.maintenance_intervals:
            interval_data = self.maintenance_intervals[equipment_type]
            return {
                "next_maintenance_days": interval_data['recommended_interval_days'],
                "critical_threshold_days": interval_data['critical_interval_days'],
                "equipment_type_avg_days": interval_data['historical_avg_days'],
                "recommendation": f"Programmer maintenance dans {int(interval_data['recommended_interval_days'])} jours"
            }
        else:
            # Default recommendations by equipment type
            defaults = {
                'moteur': 30,
                'pompe': 45,
                'compresseur': 60,
                'convoyeur': 90,
                'variateur': 120,
                'capteur': 180
            }
            days = defaults.get(equipment_type, 60)
            return {
                "next_maintenance_days": days,
                "critical_threshold_days": days * 1.5,
                "recommendation": f"Maintenance préventive recommandée dans {days} jours"
            }
    
    def _generate_advanced_insights(self, is_anomaly: bool, failure_risk: float, 
                                  nn_confidence: float, equipment_type: str) -> str:
        """Generate advanced AI insights"""
        insights = []
        
        if is_anomaly:
            insights.append("🔍 Comportement anormal détecté - investigation approfondie recommandée")
        
        if failure_risk > 0.7:
            insights.append("⚠️ Risque élevé de panne - maintenance urgente requise")
        elif failure_risk > 0.4:
            insights.append("⚡ Risque modéré de défaillance - surveillance renforcée")
        
        if nn_confidence > 0.8:
            insights.append("🎯 Analyse haute confiance - diagnostic fiable")
        elif nn_confidence < 0.5:
            insights.append("❓ Confiance faible - données supplémentaires nécessaires")
        
        # Equipment-specific insights
        if equipment_type == 'moteur' and failure_risk > 0.5:
            insights.append("🔧 Moteur: Vérifier roulements et alignement")
        elif equipment_type == 'pompe' and failure_risk > 0.5:
            insights.append("💧 Pompe: Contrôler étanchéité et cavitation")
        
        return " • ".join(insights) if insights else "Analyse ML standard appliquée"
    
    def save_advanced_models(self, filepath: str = "advanced_ml_models.joblib"):
        """Save all trained models"""
        if self.is_trained:
            models_data = {
                'anomaly_detector': self.anomaly_detector,
                'neural_network': self.neural_network,
                'failure_predictor': self.failure_predictor,
                'feature_scaler': self.feature_scaler,
                'pca_reducer': self.pca_reducer,
                'failure_patterns': self.failure_patterns,
                'maintenance_intervals': self.maintenance_intervals,
                'is_trained': self.is_trained
            }
            joblib.dump(models_data, filepath)
            return True
        return False
    
    def load_advanced_models(self, filepath: str = "advanced_ml_models.joblib"):
        """Load pre-trained models"""
        if os.path.exists(filepath):
            models_data = joblib.load(filepath)
            self.anomaly_detector = models_data['anomaly_detector']
            self.neural_network = models_data['neural_network']
            self.failure_predictor = models_data['failure_predictor']
            self.feature_scaler = models_data['feature_scaler']
            self.pca_reducer = models_data['pca_reducer']
            self.failure_patterns = models_data['failure_patterns']
            self.maintenance_intervals = models_data['maintenance_intervals']
            self.is_trained = models_data['is_trained']
            return True
        return False

def main():
    """Main function for CLI usage"""
    if len(sys.argv) < 2:
        print("Usage: python advanced_ml_features.py <command> [args...]")
        sys.exit(1)
    
    command = sys.argv[1]
    engine = AdvancedMLEngine()
    
    if command == "train":
        result = engine.train_advanced_models()
        if result["success"]:
            engine.save_advanced_models()
        print(json.dumps(result, ensure_ascii=False))
    
    elif command == "predict":
        if len(sys.argv) < 8:
            print(json.dumps({"error": "Missing parameters for advanced prediction"}))
            sys.exit(1)
        
        equipment_type = sys.argv[2]
        symptoms = sys.argv[3]
        symptoms_checked = sys.argv[4].split(',') if sys.argv[4] else []
        urgency = sys.argv[5]
        zone = sys.argv[6] if len(sys.argv) > 6 else "unknown"
        sector = sys.argv[7] if len(sys.argv) > 7 else "unknown"
        equipment_id = sys.argv[8] if len(sys.argv) > 8 else "unknown"
        
        # Try to load existing models
        engine.load_advanced_models()
        
        result = engine.predict_advanced_diagnosis(
            equipment_type, symptoms, symptoms_checked, urgency, zone, sector, equipment_id
        )
        print(json.dumps(result, ensure_ascii=False))
    
    else:
        print(json.dumps({"error": f"Unknown command: {command}"}))

if __name__ == "__main__":
    main()
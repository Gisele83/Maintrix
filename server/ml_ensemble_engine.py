#!/usr/bin/env python3
"""
Ensemble ML Engine for SMDiagFix
Combines multiple ML models for improved accuracy and robustness
"""

import sys
import json
import pandas as pd
import numpy as np
from sklearn.ensemble import (
    RandomForestClassifier, GradientBoostingClassifier, 
    VotingClassifier, AdaBoostClassifier, ExtraTreesClassifier
)
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from sklearn.pipeline import Pipeline
import joblib
import os
import requests
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

class EnsembleMLEngine:
    def __init__(self):
        # Base models for ensemble
        self.base_models = {
            'random_forest': RandomForestClassifier(n_estimators=100, random_state=42),
            'gradient_boost': GradientBoostingClassifier(n_estimators=100, random_state=42),
            'extra_trees': ExtraTreesClassifier(n_estimators=100, random_state=42),
            'ada_boost': AdaBoostClassifier(n_estimators=50, random_state=42),
            'svm': SVC(probability=True, random_state=42),
            'neural_net': MLPClassifier(hidden_layer_sizes=(100, 50), max_iter=500, random_state=42),
            'knn': KNeighborsClassifier(n_neighbors=5),
            'naive_bayes': GaussianNB(),
            'logistic': LogisticRegression(random_state=42, max_iter=1000)
        }
        
        # Ensemble models
        self.voting_classifier = None
        self.stacking_classifier = None
        
        # Preprocessing components
        self.tfidf_vectorizer = TfidfVectorizer(max_features=100, stop_words='english')
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        
        # Model performance tracking
        self.model_scores = {}
        self.feature_importance = {}
        
        self.is_trained = False
        
    def fetch_training_data(self):
        """Fetch comprehensive training data"""
        try:
            # Fetch maintenance cases
            cases_response = requests.get('http://localhost:5000/api/maintenance-cases', timeout=10)
            cases = cases_response.json() if cases_response.status_code == 200 else []
            
            # Fetch diagnostic sessions for additional context
            sessions_response = requests.get('http://localhost:5000/api/history', timeout=10)
            sessions = sessions_response.json() if sessions_response.status_code == 200 else []
            
            return cases, sessions
        except Exception as e:
            print(f"Error fetching training data: {e}", file=sys.stderr)
            return [], []
    
    def engineer_features(self, cases, sessions):
        """Advanced feature engineering"""
        if not cases:
            return np.array([]), [], []
        
        features = []
        labels = []
        case_ids = []
        
        # Create session lookup for additional context
        session_lookup = {s.get('caseId', 0): s for s in sessions}
        
        for case in cases:
            try:
                # Basic case features
                equipment_type = case.get('equipmentType', 'unknown')
                zone = case.get('zone', 'unknown')
                sector = case.get('sector', 'unknown')
                urgency = case.get('urgency', 'medium')
                symptoms = case.get('symptoms', '')
                symptoms_checked = case.get('symptomsChecked', [])
                
                # Time-based features
                created_at = pd.to_datetime(case.get('createdAt', datetime.now()))
                hour = created_at.hour
                day_of_week = created_at.weekday()
                month = created_at.month
                
                # Symptom analysis
                symptom_count = len(symptoms_checked)
                symptom_text_length = len(symptoms)
                symptom_complexity = symptom_count * symptom_text_length / 100.0
                
                # Equipment encoding
                equipment_hash = hash(equipment_type) % 50
                zone_hash = hash(zone) % 20
                sector_hash = hash(sector) % 20
                
                # Urgency encoding
                urgency_mapping = {'low': 1, 'medium': 2, 'high': 3, 'critical': 4}
                urgency_score = urgency_mapping.get(urgency, 2)
                
                # Duration and confidence
                duration = case.get('duration', 60)
                confidence = case.get('confidence', 0.5)
                
                # Session context if available
                session_data = session_lookup.get(case.get('id', 0), {})
                session_duration = session_data.get('duration', duration)
                session_confidence = session_data.get('confidence', confidence)
                
                # Advanced derived features
                risk_factor = urgency_score * symptom_complexity
                time_pressure = 1.0 if urgency_score >= 3 else 0.5
                equipment_age_factor = hash(f"{equipment_type}_{zone}") % 10 / 10.0
                
                # Weekend/business hours indicators
                is_weekend = 1 if day_of_week >= 5 else 0
                is_business_hours = 1 if 8 <= hour <= 17 else 0
                
                # Seasonal patterns
                is_winter = 1 if month in [12, 1, 2] else 0
                is_summer = 1 if month in [6, 7, 8] else 0
                
                # Build feature vector
                feature_vector = [
                    # Basic features
                    equipment_hash, zone_hash, sector_hash, urgency_score,
                    symptom_count, symptom_text_length, symptom_complexity,
                    duration, confidence, hour, day_of_week, month,
                    
                    # Session features
                    session_duration, session_confidence,
                    
                    # Derived features
                    risk_factor, time_pressure, equipment_age_factor,
                    is_weekend, is_business_hours, is_winter, is_summer,
                    
                    # Equipment type specific features
                    1 if equipment_type == 'moteur' else 0,
                    1 if equipment_type == 'pompe' else 0,
                    1 if equipment_type == 'compresseur' else 0,
                    1 if equipment_type == 'convoyeur' else 0,
                    1 if equipment_type == 'variateur' else 0,
                    
                    # Zone specific features
                    1 if zone == 'production' else 0,
                    1 if zone == 'maintenance' else 0,
                    1 if zone == 'stockage' else 0
                ]
                
                features.append(feature_vector)
                labels.append(case.get('diagnosis', 'Unknown'))
                case_ids.append(case.get('id', 0))
                
            except Exception as e:
                print(f"Error processing case {case.get('id', 'unknown')}: {e}", file=sys.stderr)
                continue
        
        return np.array(features), labels, case_ids
    
    def train_ensemble_models(self):
        """Train ensemble of ML models"""
        print("Fetching training data for ensemble models...", file=sys.stderr)
        cases, sessions = self.fetch_training_data()
        
        if len(cases) < 5:
            return {"success": False, "message": "Insufficient data for ensemble training (minimum 5 cases required)"}
        
        print(f"Engineering features for {len(cases)} cases...", file=sys.stderr)
        X, y, case_ids = self.engineer_features(cases, sessions)
        
        if X.size == 0:
            return {"success": False, "message": "No features could be extracted"}
        
        # Encode labels
        y_encoded = self.label_encoder.fit_transform(y)
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Split data with handling for small datasets
        if len(np.unique(y_encoded)) <= len(y_encoded) // 4:
            # Use stratification if we have enough samples per class
            X_train, X_test, y_train, y_test = train_test_split(
                X_scaled, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
            )
        else:
            # Use simple split for small datasets
            X_train, X_test, y_train, y_test = train_test_split(
                X_scaled, y_encoded, test_size=0.25, random_state=42
            )
        
        print("Training individual base models...", file=sys.stderr)
        
        # Train and evaluate base models
        trained_models = []
        for name, model in self.base_models.items():
            try:
                model.fit(X_train, y_train)
                y_pred = model.predict(X_test)
                score = accuracy_score(y_test, y_pred)
                self.model_scores[name] = score
                
                # Only include models with reasonable performance
                if score > 0.1:  # Lower threshold for small datasets
                    trained_models.append((name, model))
                    print(f"{name}: {score:.3f}", file=sys.stderr)
                
                # Store feature importance if available
                if hasattr(model, 'feature_importances_'):
                    self.feature_importance[name] = model.feature_importances_
                    
            except Exception as e:
                print(f"Error training {name}: {e}", file=sys.stderr)
                continue
        
        if len(trained_models) < 2:
            return {"success": False, "message": "Insufficient models trained successfully"}
        
        print("Creating ensemble models...", file=sys.stderr)
        
        # Create voting classifier with best models
        self.voting_classifier = VotingClassifier(
            estimators=trained_models[:5],  # Use top 5 models
            voting='soft'
        )
        
        try:
            self.voting_classifier.fit(X_train, y_train)
            ensemble_score = self.voting_classifier.score(X_test, y_test)
            self.model_scores['ensemble_voting'] = ensemble_score
            
            print(f"Ensemble voting score: {ensemble_score:.3f}", file=sys.stderr)
            
        except Exception as e:
            print(f"Error training ensemble: {e}", file=sys.stderr)
            return {"success": False, "message": f"Ensemble training failed: {str(e)}"}
        
        self.is_trained = True
        
        # Calculate overall metrics
        best_individual = max([(name, score) for name, score in self.model_scores.items() 
                              if name != 'ensemble_voting'], key=lambda x: x[1], default=("none", 0))
        
        improvement = ensemble_score - best_individual[1] if best_individual[1] > 0 else 0
        
        return {
            "success": True,
            "message": "Ensemble models trained successfully",
            "metrics": {
                "ensemble_accuracy": float(ensemble_score),
                "best_individual_model": best_individual[0],
                "best_individual_accuracy": float(best_individual[1]),
                "ensemble_improvement": float(improvement),
                "models_trained": len(trained_models),
                "total_cases": len(cases),
                "features_used": len(X[0]) if len(X) > 0 else 0
            },
            "model_scores": {k: float(v) for k, v in self.model_scores.items()}
        }
    
    def predict_ensemble(self, equipment_type, symptoms, symptoms_checked, urgency, 
                        zone="unknown", sector="unknown", equipment_id="unknown"):
        """Make prediction using ensemble models"""
        
        if not self.is_trained:
            train_result = self.train_ensemble_models()
            if not train_result["success"]:
                return {"error": train_result["message"]}
        
        try:
            # Engineer features for new case
            current_time = datetime.now()
            hour = current_time.hour
            day_of_week = current_time.weekday()
            month = current_time.month
            
            # Basic features
            equipment_hash = hash(equipment_type) % 50
            zone_hash = hash(zone) % 20
            sector_hash = hash(sector) % 20
            
            urgency_mapping = {'low': 1, 'medium': 2, 'high': 3, 'critical': 4}
            urgency_score = urgency_mapping.get(urgency, 2)
            
            symptom_count = len(symptoms_checked)
            symptom_text_length = len(symptoms)
            symptom_complexity = symptom_count * symptom_text_length / 100.0
            
            # Default values for prediction
            duration = 60
            confidence = 0.7
            session_duration = duration
            session_confidence = confidence
            
            # Derived features
            risk_factor = urgency_score * symptom_complexity
            time_pressure = 1.0 if urgency_score >= 3 else 0.5
            equipment_age_factor = hash(f"{equipment_type}_{zone}") % 10 / 10.0
            
            is_weekend = 1 if day_of_week >= 5 else 0
            is_business_hours = 1 if 8 <= hour <= 17 else 0
            is_winter = 1 if month in [12, 1, 2] else 0
            is_summer = 1 if month in [6, 7, 8] else 0
            
            # Build feature vector
            feature_vector = np.array([[
                equipment_hash, zone_hash, sector_hash, urgency_score,
                symptom_count, symptom_text_length, symptom_complexity,
                duration, confidence, hour, day_of_week, month,
                session_duration, session_confidence,
                risk_factor, time_pressure, equipment_age_factor,
                is_weekend, is_business_hours, is_winter, is_summer,
                1 if equipment_type == 'moteur' else 0,
                1 if equipment_type == 'pompe' else 0,
                1 if equipment_type == 'compresseur' else 0,
                1 if equipment_type == 'convoyeur' else 0,
                1 if equipment_type == 'variateur' else 0,
                1 if zone == 'production' else 0,
                1 if zone == 'maintenance' else 0,
                1 if zone == 'stockage' else 0
            ]])
            
            # Scale features
            X_scaled = self.scaler.transform(feature_vector)
            
            # Make predictions
            ensemble_prediction = self.voting_classifier.predict(X_scaled)[0]
            ensemble_probabilities = self.voting_classifier.predict_proba(X_scaled)[0]
            ensemble_confidence = float(np.max(ensemble_probabilities))
            
            # Decode prediction
            predicted_diagnosis = self.label_encoder.inverse_transform([ensemble_prediction])[0]
            
            # Get individual model predictions for transparency
            individual_predictions = {}
            for name, model in self.base_models.items():
                if name in self.model_scores:
                    try:
                        pred = model.predict(X_scaled)[0]
                        prob = np.max(model.predict_proba(X_scaled)[0]) if hasattr(model, 'predict_proba') else 0.5
                        individual_predictions[name] = {
                            "prediction": self.label_encoder.inverse_transform([pred])[0],
                            "confidence": float(prob)
                        }
                    except:
                        continue
            
            return {
                "ensemble_prediction": predicted_diagnosis,
                "ensemble_confidence": ensemble_confidence,
                "individual_predictions": individual_predictions,
                "model_agreement": len(set([p["prediction"] for p in individual_predictions.values()])),
                "feature_vector_size": len(feature_vector[0]),
                "risk_assessment": {
                    "risk_factor": float(risk_factor),
                    "time_pressure": float(time_pressure),
                    "urgency_level": urgency_score,
                    "complexity_score": float(symptom_complexity)
                }
            }
            
        except Exception as e:
            return {"error": f"Ensemble prediction failed: {str(e)}"}
    
    def save_models(self, filepath="ensemble_ml_models.joblib"):
        """Save trained ensemble models"""
        if self.is_trained:
            models_data = {
                'voting_classifier': self.voting_classifier,
                'base_models': self.base_models,
                'scaler': self.scaler,
                'label_encoder': self.label_encoder,
                'model_scores': self.model_scores,
                'feature_importance': self.feature_importance,
                'is_trained': self.is_trained
            }
            joblib.dump(models_data, filepath)
            return True
        return False
    
    def load_models(self, filepath="ensemble_ml_models.joblib"):
        """Load pre-trained ensemble models"""
        if os.path.exists(filepath):
            models_data = joblib.load(filepath)
            self.voting_classifier = models_data['voting_classifier']
            self.base_models = models_data['base_models']
            self.scaler = models_data['scaler']
            self.label_encoder = models_data['label_encoder']
            self.model_scores = models_data['model_scores']
            self.feature_importance = models_data['feature_importance']
            self.is_trained = models_data['is_trained']
            return True
        return False

def main():
    """Main function for CLI usage"""
    if len(sys.argv) < 2:
        print("Usage: python ml_ensemble_engine.py <command> [args...]")
        sys.exit(1)
    
    command = sys.argv[1]
    engine = EnsembleMLEngine()
    
    if command == "train":
        result = engine.train_ensemble_models()
        if result["success"]:
            engine.save_models()
        print(json.dumps(result, ensure_ascii=False))
    
    elif command == "predict":
        if len(sys.argv) < 8:
            print(json.dumps({"error": "Missing parameters for ensemble prediction"}))
            sys.exit(1)
        
        equipment_type = sys.argv[2]
        symptoms = sys.argv[3]
        symptoms_checked = sys.argv[4].split(',') if sys.argv[4] else []
        urgency = sys.argv[5]
        zone = sys.argv[6] if len(sys.argv) > 6 else "unknown"
        sector = sys.argv[7] if len(sys.argv) > 7 else "unknown"
        equipment_id = sys.argv[8] if len(sys.argv) > 8 else "unknown"
        
        # Try to load existing models
        engine.load_models()
        
        result = engine.predict_ensemble(
            equipment_type, symptoms, symptoms_checked, urgency, zone, sector, equipment_id
        )
        print(json.dumps(result, ensure_ascii=False))
    
    else:
        print(json.dumps({"error": f"Unknown command: {command}"}))

if __name__ == "__main__":
    main()
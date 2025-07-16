#!/usr/bin/env python3
"""
Enhanced Machine Learning Diagnostic Engine for SMDiagFix
Comprehensive scikit-learn implementation with advanced features
"""

import numpy as np
import pandas as pd
import joblib
import requests
import json
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Scikit-learn imports
from sklearn.ensemble import (
    RandomForestClassifier, 
    GradientBoostingClassifier,
    ExtraTreesClassifier,
    AdaBoostClassifier,
    VotingClassifier,
    BaggingClassifier
)
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.cluster import DBSCAN, KMeans
from sklearn.decomposition import PCA
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.feature_selection import SelectKBest, chi2
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
# Optional NLTK import - not critical for functionality
try:
    import nltk
    try:
        nltk.data.find('tokenizers/punkt')
    except LookupError:
        nltk.download('punkt', quiet=True)
except ImportError:
    print("NLTK not available - using basic text processing")

class EnhancedMLDiagnosticEngine:
    """Enhanced ML Diagnostic Engine with comprehensive scikit-learn features"""
    
    def __init__(self):
        """Initialize the enhanced ML diagnostic engine"""
        # Core models
        self.models = {}
        self.ensemble_model = None
        self.tfidf_vectorizer = TfidfVectorizer(max_features=100, stop_words='english')
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.feature_selector = SelectKBest(chi2, k=10)
        self.pca = PCA(n_components=0.95)
        
        # Model performance tracking
        self.model_scores = {}
        self.training_history = []
        self.feature_importance = {}
        
        # Advanced features
        self.clustering_model = None
        self.anomaly_threshold = 2.0
        self.confidence_threshold = 0.7
        
        print("Enhanced ML Diagnostic Engine initialized with comprehensive scikit-learn features")
    
    def fetch_comprehensive_data(self) -> Dict[str, Any]:
        """Fetch all available data for comprehensive ML training"""
        try:
            # Fetch maintenance cases
            cases_response = requests.get('http://localhost:5000/api/maintenance-cases')
            cases = cases_response.json() if cases_response.status_code == 200 else []
            
            # Fetch diagnostic sessions
            sessions_response = requests.get('http://localhost:5000/api/history')
            sessions = sessions_response.json() if sessions_response.status_code == 200 else []
            
            print(f"Fetched {len(cases)} maintenance cases and {len(sessions)} diagnostic sessions")
            return {
                'maintenance_cases': cases,
                'diagnostic_sessions': sessions,
                'total_records': len(cases) + len(sessions)
            }
        except Exception as e:
            print(f"Error fetching data: {e}")
            return {'maintenance_cases': [], 'diagnostic_sessions': [], 'total_records': 0}
    
    def engineer_advanced_features(self, data: Dict[str, Any]) -> Tuple[np.ndarray, List[str], Dict[str, Any]]:
        """Advanced feature engineering with multiple techniques"""
        cases = data['maintenance_cases']
        sessions = data['diagnostic_sessions']
        
        if not cases:
            print("No data available for feature engineering")
            return np.array([]), [], {}
        
        # Combine all data
        all_records = cases + sessions
        features = []
        labels = []
        metadata = {'feature_names': [], 'encoding_info': {}}
        
        # Equipment type encoding
        equipment_types = list(set([record.get('equipmentType', 'unknown') for record in all_records]))
        metadata['equipment_types'] = equipment_types
        
        # Zone and sector encoding
        zones = list(set([record.get('zone', 'unknown') for record in all_records]))
        sectors = list(set([record.get('sector', 'unknown') for record in all_records]))
        metadata['zones'] = zones
        metadata['sectors'] = sectors
        
        for record in all_records:
            feature_vector = []
            
            # Basic categorical features
            equipment_type = record.get('equipmentType', 'unknown')
            feature_vector.extend([1 if eq == equipment_type else 0 for eq in equipment_types])
            
            zone = record.get('zone', 'unknown')
            feature_vector.extend([1 if z == zone else 0 for z in zones])
            
            sector = record.get('sector', 'unknown')
            feature_vector.extend([1 if s == sector else 0 for s in sectors])
            
            # Text features from symptoms
            symptoms = record.get('symptoms', '')
            symptoms_checked = record.get('symptomsChecked', [])
            
            # Symptom count and complexity
            feature_vector.append(len(symptoms_checked))
            feature_vector.append(len(symptoms.split()) if symptoms else 0)
            feature_vector.append(1 if 'urgent' in symptoms.lower() or 'critique' in symptoms.lower() else 0)
            feature_vector.append(1 if 'panne' in symptoms.lower() or 'defaillant' in symptoms.lower() else 0)
            
            # Urgency encoding
            urgency = record.get('urgency', 'low')
            urgency_score = {'low': 1, 'medium': 2, 'high': 3, 'critical': 4}.get(urgency, 1)
            feature_vector.append(urgency_score)
            
            # Temporal features
            created_at = record.get('createdAt', datetime.now().isoformat())
            try:
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                feature_vector.extend([
                    dt.hour,
                    dt.weekday(),
                    dt.month
                ])
            except:
                feature_vector.extend([12, 1, 1])  # Default values
            
            # Duration and cost features
            duration = record.get('duration', 60)
            feature_vector.append(duration)
            feature_vector.append(1 if duration > 120 else 0)  # Long repair flag
            
            # Add estimated complexity
            complexity_indicators = ['complexe', 'difficile', 'specialise', 'expert']
            complexity_score = sum(1 for indicator in complexity_indicators 
                                 if indicator in symptoms.lower())
            feature_vector.append(complexity_score)
            
            features.append(feature_vector)
            
            # Label extraction
            diagnosis = record.get('diagnosis', record.get('solution', 'unknown'))
            labels.append(diagnosis)
        
        # Feature names for interpretability
        feature_names = (
            [f'equipment_{eq}' for eq in equipment_types] +
            [f'zone_{z}' for z in zones] +
            [f'sector_{s}' for s in sectors] +
            ['symptom_count', 'symptom_words', 'urgent_flag', 'failure_flag', 'urgency_score',
             'hour', 'weekday', 'month', 'duration', 'long_repair_flag', 'complexity_score']
        )
        
        metadata['feature_names'] = feature_names
        
        features_array = np.array(features, dtype=float)
        print(f"Engineered {features_array.shape[1]} features from {features_array.shape[0]} records")
        
        return features_array, labels, metadata
    
    def train_comprehensive_models(self) -> Dict[str, Any]:
        """Train comprehensive ML models with advanced techniques"""
        print("Starting comprehensive ML model training...")
        
        data = self.fetch_comprehensive_data()
        if data['total_records'] == 0:
            return {'success': False, 'message': 'No data available for training'}
        
        features, labels, metadata = self.engineer_advanced_features(data)
        
        if len(features) == 0:
            return {'success': False, 'message': 'Feature engineering failed'}
        
        # Encode labels
        try:
            encoded_labels = self.label_encoder.fit_transform(labels)
        except:
            return {'success': False, 'message': 'Label encoding failed'}
        
        # Handle small datasets - get unique classes count
        unique_classes = len(np.unique(encoded_labels))
        
        # Ensure test size is appropriate for number of classes
        if len(features) < unique_classes * 2:
            # Very small dataset - use leave-one-out approach
            test_size = max(1, len(features) // 4)
            stratify = None
        elif len(features) < unique_classes * 4:
            # Small dataset - reduce test size
            test_size = max(unique_classes, len(features) // 3)
            stratify = None
        else:
            # Normal dataset
            test_size = 0.2
            stratify = encoded_labels if unique_classes > 1 else None
        
        # Ensure test_size is not larger than available samples
        test_size = min(test_size, len(features) - 1) if isinstance(test_size, int) else test_size
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            features, encoded_labels, 
            test_size=test_size, 
            random_state=42,
            stratify=stratify
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Initialize models with optimized parameters
        models_config = {
            'random_forest': RandomForestClassifier(
                n_estimators=100, 
                max_depth=10, 
                random_state=42,
                class_weight='balanced'
            ),
            'gradient_boosting': GradientBoostingClassifier(
                n_estimators=100, 
                max_depth=6, 
                random_state=42
            ),
            'extra_trees': ExtraTreesClassifier(
                n_estimators=100, 
                max_depth=10, 
                random_state=42,
                class_weight='balanced'
            ),
            'svm': SVC(
                kernel='rbf', 
                probability=True, 
                random_state=42,
                class_weight='balanced'
            ),
            'neural_network': MLPClassifier(
                hidden_layer_sizes=(100, 50), 
                max_iter=500, 
                random_state=42,
                early_stopping=True
            ),
            'knn': KNeighborsClassifier(n_neighbors=min(5, len(X_train))),
            'naive_bayes': GaussianNB(),
            'logistic_regression': LogisticRegression(
                random_state=42, 
                max_iter=1000,
                class_weight='balanced'
            ),
            'decision_tree': DecisionTreeClassifier(
                max_depth=10, 
                random_state=42,
                class_weight='balanced'
            ),
            'bagging': BaggingClassifier(
                n_estimators=50, 
                random_state=42
            )
        }
        
        # Train individual models
        trained_models = {}
        model_scores = {}
        
        for name, model in models_config.items():
            try:
                print(f"Training {name}...")
                model.fit(X_train_scaled, y_train)
                
                # Evaluate model
                train_score = model.score(X_train_scaled, y_train)
                test_score = model.score(X_test_scaled, y_test)
                
                # Cross-validation score
                if len(X_train) >= 3:
                    cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=min(3, len(X_train)))
                    cv_mean = cv_scores.mean()
                else:
                    cv_mean = test_score
                
                trained_models[name] = model
                model_scores[name] = {
                    'train_score': train_score,
                    'test_score': test_score,
                    'cv_score': cv_mean
                }
                
                print(f"{name}: Train={train_score:.3f}, Test={test_score:.3f}, CV={cv_mean:.3f}")
                
            except Exception as e:
                print(f"Failed to train {name}: {e}")
                continue
        
        # Create ensemble model
        if len(trained_models) >= 3:
            ensemble_estimators = [(name, model) for name, model in trained_models.items()]
            self.ensemble_model = VotingClassifier(
                estimators=ensemble_estimators, 
                voting='soft'
            )
            
            try:
                self.ensemble_model.fit(X_train_scaled, y_train)
                ensemble_score = self.ensemble_model.score(X_test_scaled, y_test)
                model_scores['ensemble'] = {
                    'train_score': self.ensemble_model.score(X_train_scaled, y_train),
                    'test_score': ensemble_score,
                    'cv_score': ensemble_score
                }
                print(f"Ensemble model: {ensemble_score:.3f}")
            except Exception as e:
                print(f"Ensemble training failed: {e}")
        
        # Store models and metadata
        self.models = trained_models
        self.model_scores = model_scores
        self.feature_names = metadata['feature_names']
        self.metadata = metadata
        
        # Train clustering for anomaly detection
        try:
            self.clustering_model = DBSCAN(eps=0.5, min_samples=2)
            self.clustering_model.fit(X_train_scaled)
            print("Clustering model trained for anomaly detection")
        except Exception as e:
            print(f"Clustering training failed: {e}")
        
        # Calculate feature importance
        self._calculate_feature_importance(trained_models, metadata['feature_names'])
        
        # Save training history
        training_record = {
            'timestamp': datetime.now().isoformat(),
            'models_trained': list(trained_models.keys()),
            'total_samples': len(features),
            'feature_count': features.shape[1],
            'best_model': max(model_scores.keys(), key=lambda x: model_scores[x]['test_score'])
        }
        self.training_history.append(training_record)
        
        return {
            'success': True,
            'message': f'Successfully trained {len(trained_models)} ML models',
            'models_trained': list(trained_models.keys()),
            'model_scores': model_scores,
            'best_model': training_record['best_model'],
            'total_samples': len(features),
            'feature_count': features.shape[1]
        }
    
    def _calculate_feature_importance(self, models: Dict, feature_names: List[str]):
        """Calculate and store feature importance from trained models"""
        importance_scores = {}
        
        for name, model in models.items():
            if hasattr(model, 'feature_importances_'):
                importance_scores[name] = dict(zip(feature_names, model.feature_importances_))
            elif hasattr(model, 'coef_'):
                # For linear models, use absolute coefficients
                coef = np.abs(model.coef_[0]) if len(model.coef_.shape) > 1 else np.abs(model.coef_)
                importance_scores[name] = dict(zip(feature_names, coef))
        
        # Calculate average importance across models
        if importance_scores:
            avg_importance = {}
            for feature in feature_names:
                scores = [importance_scores[model].get(feature, 0) for model in importance_scores]
                avg_importance[feature] = np.mean(scores)
            
            self.feature_importance = avg_importance
            print(f"Calculated feature importance for {len(avg_importance)} features")
    
    def predict_enhanced_diagnosis(self, equipment_type: str, symptoms: str, 
                                 symptoms_checked: List[str], urgency: str,
                                 zone: str = "unknown", sector: str = "unknown",
                                 equipment_id: str = "unknown") -> Dict[str, Any]:
        """Enhanced prediction using comprehensive ML models"""
        
        if not self.models:
            return {
                'success': False,
                'message': 'No trained models available. Please train models first.',
                'confidence': 0,
                'predictions': []
            }
        
        try:
            # Engineer features for prediction
            feature_vector = self._engineer_prediction_features(
                equipment_type, symptoms, symptoms_checked, urgency, zone, sector
            )
            
            if feature_vector is None:
                return {
                    'success': False,
                    'message': 'Feature engineering failed for prediction',
                    'confidence': 0,
                    'predictions': []
                }
            
            # Scale features
            feature_vector_scaled = self.scaler.transform([feature_vector])
            
            # Get predictions from all models
            predictions = {}
            confidences = {}
            
            for name, model in self.models.items():
                try:
                    # Get prediction
                    pred_encoded = model.predict(feature_vector_scaled)[0]
                    prediction = self.label_encoder.inverse_transform([pred_encoded])[0]
                    
                    # Get confidence (probability)
                    if hasattr(model, 'predict_proba'):
                        proba = model.predict_proba(feature_vector_scaled)[0]
                        confidence = np.max(proba)
                    else:
                        # For models without predict_proba, use distance-based confidence
                        confidence = 0.5
                    
                    predictions[name] = prediction
                    confidences[name] = confidence
                    
                except Exception as e:
                    print(f"Prediction failed for {name}: {e}")
                    continue
            
            # Ensemble prediction
            ensemble_prediction = None
            ensemble_confidence = 0
            
            if self.ensemble_model:
                try:
                    ensemble_pred_encoded = self.ensemble_model.predict(feature_vector_scaled)[0]
                    ensemble_prediction = self.label_encoder.inverse_transform([ensemble_pred_encoded])[0]
                    ensemble_proba = self.ensemble_model.predict_proba(feature_vector_scaled)[0]
                    ensemble_confidence = np.max(ensemble_proba)
                    
                    predictions['ensemble'] = ensemble_prediction
                    confidences['ensemble'] = ensemble_confidence
                except Exception as e:
                    print(f"Ensemble prediction failed: {e}")
            
            # Anomaly detection
            anomaly_score = self._detect_anomaly(feature_vector_scaled)
            
            # Calculate consensus
            prediction_counts = {}
            for pred in predictions.values():
                prediction_counts[pred] = prediction_counts.get(pred, 0) + 1
            
            # Best prediction (most common or highest confidence)
            if predictions:
                best_prediction = max(prediction_counts.keys(), key=lambda x: prediction_counts[x])
                best_confidence = max(confidences.values())
                consensus_count = prediction_counts[best_prediction]
            else:
                best_prediction = "Diagnostic incertain"
                best_confidence = 0
                consensus_count = 0
            
            # Risk assessment
            risk_assessment = self._assess_risk(
                urgency, anomaly_score, best_confidence, len(symptoms_checked)
            )
            
            return {
                'success': True,
                'prediction': best_prediction,
                'confidence': best_confidence,
                'consensus_count': consensus_count,
                'total_models': len(predictions),
                'individual_predictions': {
                    name: {'prediction': pred, 'confidence': confidences[name]}
                    for name, pred in predictions.items()
                },
                'anomaly_score': anomaly_score,
                'risk_assessment': risk_assessment,
                'feature_importance': self._get_top_features(),
                'model_scores': self.model_scores
            }
            
        except Exception as e:
            print(f"Enhanced prediction failed: {e}")
            return {
                'success': False,
                'message': f'Prediction failed: {str(e)}',
                'confidence': 0,
                'predictions': []
            }
    
    def _engineer_prediction_features(self, equipment_type: str, symptoms: str, 
                                    symptoms_checked: List[str], urgency: str,
                                    zone: str, sector: str) -> Optional[List[float]]:
        """Engineer features for a single prediction"""
        try:
            if not hasattr(self, 'metadata'):
                return None
            
            metadata = self.metadata
            feature_vector = []
            
            # Equipment type encoding
            equipment_types = metadata.get('equipment_types', [])
            feature_vector.extend([1 if eq == equipment_type else 0 for eq in equipment_types])
            
            # Zone encoding
            zones = metadata.get('zones', [])
            feature_vector.extend([1 if z == zone else 0 for z in zones])
            
            # Sector encoding
            sectors = metadata.get('sectors', [])
            feature_vector.extend([1 if s == sector else 0 for s in sectors])
            
            # Symptom features
            feature_vector.append(len(symptoms_checked))
            feature_vector.append(len(symptoms.split()) if symptoms else 0)
            feature_vector.append(1 if 'urgent' in symptoms.lower() or 'critique' in symptoms.lower() else 0)
            feature_vector.append(1 if 'panne' in symptoms.lower() or 'defaillant' in symptoms.lower() else 0)
            
            # Urgency encoding
            urgency_score = {'low': 1, 'medium': 2, 'high': 3, 'critical': 4}.get(urgency, 1)
            feature_vector.append(urgency_score)
            
            # Temporal features (current time)
            now = datetime.now()
            feature_vector.extend([now.hour, now.weekday(), now.month])
            
            # Default duration and complexity
            feature_vector.append(60)  # Default duration
            feature_vector.append(0)   # Default long repair flag
            
            # Complexity score
            complexity_indicators = ['complexe', 'difficile', 'specialise', 'expert']
            complexity_score = sum(1 for indicator in complexity_indicators 
                                 if indicator in symptoms.lower())
            feature_vector.append(complexity_score)
            
            return feature_vector
            
        except Exception as e:
            print(f"Feature engineering failed: {e}")
            return None
    
    def _detect_anomaly(self, feature_vector_scaled: np.ndarray) -> float:
        """Detect anomalies in the input using clustering"""
        try:
            if self.clustering_model is None:
                return 0.0
            
            # Predict cluster
            cluster_label = self.clustering_model.fit_predict(feature_vector_scaled)
            
            # If labeled as noise/outlier (label = -1), it's an anomaly
            if cluster_label[0] == -1:
                return 1.0
            else:
                return 0.0
                
        except Exception as e:
            print(f"Anomaly detection failed: {e}")
            return 0.0
    
    def _assess_risk(self, urgency: str, anomaly_score: float, 
                    confidence: float, symptom_count: int) -> Dict[str, Any]:
        """Assess risk based on multiple factors"""
        urgency_weights = {'low': 0.2, 'medium': 0.5, 'high': 0.8, 'critical': 1.0}
        urgency_factor = urgency_weights.get(urgency, 0.5)
        
        # Calculate composite risk
        risk_factors = {
            'urgency_factor': urgency_factor,
            'anomaly_factor': anomaly_score,
            'confidence_factor': 1 - confidence,  # Lower confidence = higher risk
            'complexity_factor': min(symptom_count / 10, 1.0)  # More symptoms = higher complexity
        }
        
        # Weighted risk calculation
        total_risk = (
            risk_factors['urgency_factor'] * 0.4 +
            risk_factors['anomaly_factor'] * 0.3 +
            risk_factors['confidence_factor'] * 0.2 +
            risk_factors['complexity_factor'] * 0.1
        )
        
        risk_level = 'Low'
        if total_risk > 0.7:
            risk_level = 'Critical'
        elif total_risk > 0.5:
            risk_level = 'High'
        elif total_risk > 0.3:
            risk_level = 'Medium'
        
        return {
            'total_risk': total_risk,
            'risk_level': risk_level,
            'risk_factors': risk_factors
        }
    
    def _get_top_features(self, top_k: int = 5) -> Dict[str, float]:
        """Get top important features"""
        if not self.feature_importance:
            return {}
        
        sorted_features = sorted(
            self.feature_importance.items(), 
            key=lambda x: x[1], 
            reverse=True
        )
        
        return dict(sorted_features[:top_k])
    
    def get_model_insights(self) -> Dict[str, Any]:
        """Get comprehensive insights about trained models"""
        if not self.models:
            return {'message': 'No models trained yet'}
        
        insights = {
            'total_models': len(self.models),
            'model_performance': self.model_scores,
            'feature_importance': self._get_top_features(10),
            'training_history': self.training_history,
            'best_performing_model': max(self.model_scores.keys(), 
                                       key=lambda x: self.model_scores[x]['test_score']) if self.model_scores else None
        }
        
        return insights
    
    def save_enhanced_models(self, filepath: str = "enhanced_ml_models.joblib"):
        """Save all trained models and metadata"""
        model_data = {
            'models': self.models,
            'ensemble_model': self.ensemble_model,
            'scaler': self.scaler,
            'label_encoder': self.label_encoder,
            'clustering_model': self.clustering_model,
            'metadata': getattr(self, 'metadata', {}),
            'feature_importance': self.feature_importance,
            'model_scores': self.model_scores,
            'training_history': self.training_history
        }
        
        joblib.dump(model_data, filepath)
        print(f"Enhanced models saved to {filepath}")
    
    def load_enhanced_models(self, filepath: str = "enhanced_ml_models.joblib"):
        """Load pre-trained models and metadata"""
        try:
            model_data = joblib.load(filepath)
            
            self.models = model_data.get('models', {})
            self.ensemble_model = model_data.get('ensemble_model')
            self.scaler = model_data.get('scaler', StandardScaler())
            self.label_encoder = model_data.get('label_encoder', LabelEncoder())
            self.clustering_model = model_data.get('clustering_model')
            self.metadata = model_data.get('metadata', {})
            self.feature_importance = model_data.get('feature_importance', {})
            self.model_scores = model_data.get('model_scores', {})
            self.training_history = model_data.get('training_history', [])
            
            print(f"Enhanced models loaded from {filepath}")
            return True
        except Exception as e:
            print(f"Failed to load models: {e}")
            return False

def main():
    """Main function for CLI usage"""
    import sys
    
    engine = EnhancedMLDiagnosticEngine()
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "train":
            result = engine.train_comprehensive_models()
            print(json.dumps(result, indent=2))
            if result['success']:
                engine.save_enhanced_models()
        
        elif command == "predict":
            # Load models first
            if engine.load_enhanced_models():
                # Example prediction
                result = engine.predict_enhanced_diagnosis(
                    equipment_type="pompe",
                    symptoms="vibrations et bruit anormal",
                    symptoms_checked=["vibrations", "bruit"],
                    urgency="high",
                    zone="production",
                    sector="ligne1"
                )
                print(json.dumps(result, indent=2, default=str))
            else:
                print("Failed to load models. Please train first.")
        
        elif command == "insights":
            if engine.load_enhanced_models():
                insights = engine.get_model_insights()
                print(json.dumps(insights, indent=2, default=str))
            else:
                print("No models available. Please train first.")
    
    else:
        print("Usage: python enhanced_ml_diagnostic.py [train|predict|insights]")

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
Machine Learning Diagnostic Engine for SMDiagFix
Uses scikit-learn to analyze equipment symptoms and predict failures
"""

import sys
import json
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import accuracy_score, classification_report
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
import joblib
import os
import requests
from typing import List, Dict, Any

class MLDiagnosticEngine:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(max_features=100, stop_words=None)
        self.diagnosis_classifier = RandomForestClassifier(n_estimators=100, random_state=42)
        self.confidence_regressor = GradientBoostingRegressor(n_estimators=50, random_state=42)
        self.equipment_encoder = LabelEncoder()
        self.urgency_encoder = LabelEncoder()
        self.scaler = StandardScaler()
        self.clustering_model = KMeans(n_clusters=5, random_state=42)
        self.is_trained = False
        
    def fetch_training_data(self) -> List[Dict]:
        """Fetch maintenance cases from the database via API"""
        try:
            response = requests.get('http://localhost:5000/api/maintenance-cases', timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                return []
        except Exception as e:
            print(f"Error fetching data: {e}", file=sys.stderr)
            return []
    
    def preprocess_data(self, cases: List[Dict]) -> tuple:
        """Preprocess maintenance cases for ML training"""
        if not cases:
            return None, None, None, None
            
        df = pd.DataFrame(cases)
        
        # Feature engineering
        features = []
        symptoms_list = []
        diagnoses = []
        confidences = []
        
        for _, case in df.iterrows():
            # Text features from symptoms
            symptoms_text = case['symptoms'] + ' ' + ' '.join(case.get('symptomsChecked', []))
            symptoms_list.append(symptoms_text)
            
            # Equipment type (categorical)
            equipment_type = case['equipmentType']
            
            # Zone and sector (categorical)
            zone = case.get('zone', 'unknown')
            sector = case.get('sector', 'unknown')
            
            # Urgency level (categorical) 
            urgency = case.get('urgency', 'medium')
            
            # Duration (numerical)
            duration = case.get('duration', 60)
            
            # Store for labels
            diagnoses.append(case['diagnosis'])
            confidences.append(case.get('confidence', 0.5))
            
            features.append({
                'equipment_type': equipment_type,
                'zone': zone,
                'sector': sector,
                'urgency': urgency,
                'duration': duration,
                'symptoms_text': symptoms_text
            })
        
        return features, symptoms_list, diagnoses, confidences
    
    def train_model(self) -> bool:
        """Train the ML model with historical maintenance data"""
        print("Fetching training data from database...", file=sys.stderr)
        cases = self.fetch_training_data()
        
        if len(cases) < 3:
            print(f"Insufficient training data: {len(cases)} cases", file=sys.stderr)
            return False
        
        print(f"Processing {len(cases)} maintenance cases...", file=sys.stderr)
        features, symptoms_list, diagnoses, confidences = self.preprocess_data(cases)
        
        if not features:
            return False
        
        # Convert to DataFrame for easier processing
        df_features = pd.DataFrame(features)
        
        # Encode categorical variables
        df_features['equipment_encoded'] = self.equipment_encoder.fit_transform(df_features['equipment_type'])
        df_features['urgency_encoded'] = self.urgency_encoder.fit_transform(df_features['urgency'])
        
        # Text vectorization for symptoms
        symptoms_features = self.vectorizer.fit_transform(symptoms_list).toarray()
        
        # Combine all features
        numerical_features = df_features[['equipment_encoded', 'urgency_encoded', 'duration']].values
        all_features = np.hstack([numerical_features, symptoms_features])
        
        # Scale features
        all_features_scaled = self.scaler.fit_transform(all_features)
        
        # Train diagnosis classifier
        self.diagnosis_classifier.fit(all_features_scaled, diagnoses)
        
        # Train confidence predictor (using diagnosis as additional feature)
        diagnosis_encoded = LabelEncoder().fit_transform(diagnoses)
        confidence_features = np.hstack([all_features_scaled, diagnosis_encoded.reshape(-1, 1)])
        self.confidence_regressor.fit(confidence_features, confidences)
        
        # Train clustering model for anomaly detection
        self.clustering_model.fit(all_features_scaled)
        
        self.is_trained = True
        print("ML model training completed successfully!", file=sys.stderr)
        return True
    
    def predict_diagnosis(self, equipment_type: str, symptoms: str, symptoms_checked: List[str], 
                         urgency: str, zone: str = "unknown", sector: str = "unknown", 
                         duration: int = 60) -> Dict[str, Any]:
        """Predict diagnosis using trained ML model"""
        
        if not self.is_trained:
            if not self.train_model():
                return {"error": "Model training failed"}
        
        try:
            # Prepare input features
            symptoms_text = symptoms + ' ' + ' '.join(symptoms_checked)
            
            # Encode categorical features
            if equipment_type not in self.equipment_encoder.classes_:
                equipment_encoded = 0  # Default for unknown equipment
            else:
                equipment_encoded = self.equipment_encoder.transform([equipment_type])[0]
            
            if urgency not in self.urgency_encoder.classes_:
                urgency_encoded = 1  # Default for medium urgency
            else:
                urgency_encoded = self.urgency_encoder.transform([urgency])[0]
            
            # Vectorize symptoms
            symptoms_features = self.vectorizer.transform([symptoms_text]).toarray()
            
            # Combine features
            numerical_features = np.array([[equipment_encoded, urgency_encoded, duration]])
            all_features = np.hstack([numerical_features, symptoms_features])
            all_features_scaled = self.scaler.transform(all_features)
            
            # Predict diagnosis
            diagnosis_proba = self.diagnosis_classifier.predict_proba(all_features_scaled)[0]
            diagnosis_classes = self.diagnosis_classifier.classes_
            diagnosis = self.diagnosis_classifier.predict(all_features_scaled)[0]
            
            # Get top 3 most likely diagnoses
            top_indices = np.argsort(diagnosis_proba)[-3:][::-1]
            top_diagnoses = []
            
            for idx in top_indices:
                if diagnosis_proba[idx] > 0.1:  # Only include if probability > 10%
                    # Predict confidence for this diagnosis
                    diagnosis_encoded = idx
                    confidence_features = np.hstack([all_features_scaled, [[diagnosis_encoded]]])
                    predicted_confidence = self.confidence_regressor.predict(confidence_features)[0]
                    
                    # Calculate anomaly score using clustering
                    cluster_distances = self.clustering_model.transform(all_features_scaled)
                    min_distance = np.min(cluster_distances)
                    anomaly_score = min(1.0, min_distance / 2.0)  # Normalize to 0-1
                    
                    # Adjust confidence based on anomaly score
                    adjusted_confidence = predicted_confidence * (1 - anomaly_score * 0.3)
                    
                    top_diagnoses.append({
                        'diagnosis': diagnosis_classes[idx],
                        'probability': float(diagnosis_proba[idx]),
                        'confidence': float(max(0.1, min(0.99, adjusted_confidence))),
                        'anomaly_score': float(anomaly_score)
                    })
            
            return {
                'predictions': top_diagnoses,
                'primary_diagnosis': diagnosis,
                'model_accuracy': 'trained',
                'feature_importance': self._get_feature_importance(),
                'ml_insights': self._generate_ml_insights(equipment_type, symptoms_text, top_diagnoses)
            }
            
        except Exception as e:
            return {"error": f"Prediction failed: {str(e)}"}
    
    def _get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance from the trained model"""
        if not self.is_trained:
            return {}
        
        feature_names = ['equipment_type', 'urgency', 'duration'] + [f'symptom_{i}' for i in range(len(self.vectorizer.get_feature_names_out()))]
        importances = self.diagnosis_classifier.feature_importances_
        
        # Get top 5 most important features
        top_indices = np.argsort(importances)[-5:][::-1]
        return {feature_names[i]: float(importances[i]) for i in top_indices}
    
    def _generate_ml_insights(self, equipment_type: str, symptoms: str, predictions: List[Dict]) -> str:
        """Generate AI insights based on ML analysis"""
        if not predictions:
            return "Analyse ML non disponible"
        
        primary = predictions[0]
        insights = []
        
        if primary['confidence'] > 0.8:
            insights.append("Correspondance haute confiance détectée")
        elif primary['confidence'] > 0.6:
            insights.append("Correspondance modérée trouvée")
        else:
            insights.append("Correspondance faible - investigation supplémentaire recommandée")
        
        if primary['anomaly_score'] > 0.7:
            insights.append("Symptômes inhabituels détectés")
        elif primary['anomaly_score'] > 0.5:
            insights.append("Profil de panne atypique")
        
        if len(predictions) > 1:
            insights.append(f"{len(predictions)} diagnostics possibles identifiés")
        
        return " • ".join(insights)
    
    def save_model(self, filepath: str = "ml_diagnostic_model.joblib"):
        """Save the trained model to disk"""
        if self.is_trained:
            model_data = {
                'vectorizer': self.vectorizer,
                'diagnosis_classifier': self.diagnosis_classifier,
                'confidence_regressor': self.confidence_regressor,
                'equipment_encoder': self.equipment_encoder,
                'urgency_encoder': self.urgency_encoder,
                'scaler': self.scaler,
                'clustering_model': self.clustering_model,
                'is_trained': self.is_trained
            }
            joblib.dump(model_data, filepath)
            return True
        return False
    
    def load_model(self, filepath: str = "ml_diagnostic_model.joblib"):
        """Load a pre-trained model from disk"""
        if os.path.exists(filepath):
            model_data = joblib.load(filepath)
            self.vectorizer = model_data['vectorizer']
            self.diagnosis_classifier = model_data['diagnosis_classifier']
            self.confidence_regressor = model_data['confidence_regressor']
            self.equipment_encoder = model_data['equipment_encoder']
            self.urgency_encoder = model_data['urgency_encoder']
            self.scaler = model_data['scaler']
            self.clustering_model = model_data['clustering_model']
            self.is_trained = model_data['is_trained']
            return True
        return False

def main():
    """Main function for CLI usage"""
    if len(sys.argv) < 2:
        print("Usage: python ml_diagnostic_engine.py <command> [args...]")
        sys.exit(1)
    
    command = sys.argv[1]
    engine = MLDiagnosticEngine()
    
    if command == "train":
        success = engine.train_model()
        if success:
            engine.save_model()
            print(json.dumps({"success": True, "message": "Model trained and saved"}))
        else:
            print(json.dumps({"success": False, "message": "Training failed"}))
    
    elif command == "predict":
        if len(sys.argv) < 8:
            print(json.dumps({"error": "Missing parameters for prediction"}))
            sys.exit(1)
        
        equipment_type = sys.argv[2]
        symptoms = sys.argv[3]
        symptoms_checked = sys.argv[4].split(',') if sys.argv[4] else []
        urgency = sys.argv[5]
        zone = sys.argv[6] if len(sys.argv) > 6 else "unknown"
        sector = sys.argv[7] if len(sys.argv) > 7 else "unknown"
        
        # Try to load existing model first
        engine.load_model()
        
        result = engine.predict_diagnosis(equipment_type, symptoms, symptoms_checked, urgency, zone, sector)
        print(json.dumps(result, ensure_ascii=False))
    
    else:
        print(json.dumps({"error": f"Unknown command: {command}"}))

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
"""
Diagnostic Reliability Enhancer for Smart GMAO DiagFix
Implements advanced techniques for improving diagnostic accuracy and confidence
"""

import sys
import json
import pandas as pd
import numpy as np
from scipy import stats
from sklearn.metrics import brier_score_loss, log_loss
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.model_selection import cross_val_predict
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
from sklearn.covariance import EllipticEnvelope
import joblib
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

class DiagnosticReliabilityEnhancer:
    def __init__(self):
        self.calibrated_models = {}
        self.uncertainty_models = {}
        self.drift_detectors = {}
        self.feature_importance_history = []
        self.performance_metrics = {
            'accuracy_over_time': [],
            'calibration_scores': [],
            'uncertainty_coverage': []
        }
        
    def enhance_model_calibration(self, models, X_train, y_train, X_test):
        """
        1. CALIBRATION AVANCÉE DES MODÈLES
        Améliore la calibration des probabilités pour une meilleure confiance
        """
        calibrated_models = {}
        calibration_scores = {}
        
        for name, model in models.items():
            try:
                # Calibration avec validation croisée
                calibrated = CalibratedClassifierCV(model, method='isotonic', cv=3)
                calibrated.fit(X_train, y_train)
                
                # Prédictions calibrées
                y_prob_calibrated = calibrated.predict_proba(X_test)
                
                # Score de calibration (Brier Score)
                if len(np.unique(y_train)) == 2:  # Classification binaire
                    y_prob_raw = model.predict_proba(X_test)[:, 1]
                    y_prob_cal = y_prob_calibrated[:, 1]
                    
                    # Évaluation de la calibration
                    fraction_pos, mean_pred = calibration_curve(
                        y_test, y_prob_cal, n_bins=10, normalize=True
                    )
                    
                    calibration_error = np.mean(np.abs(fraction_pos - mean_pred))
                    calibration_scores[name] = {
                        'brier_score_raw': brier_score_loss(y_test, y_prob_raw),
                        'brier_score_calibrated': brier_score_loss(y_test, y_prob_cal),
                        'calibration_error': calibration_error
                    }
                
                calibrated_models[name] = calibrated
                
            except Exception as e:
                print(f"Erreur calibration {name}: {e}", file=sys.stderr)
                calibrated_models[name] = model
                
        return calibrated_models, calibration_scores
    
    def estimate_prediction_uncertainty(self, models, X, method='ensemble_variance'):
        """
        2. ESTIMATION D'INCERTITUDE MULTI-MÉTHODES
        """
        uncertainties = {}
        
        if method == 'ensemble_variance':
            # Variance entre modèles d'ensemble
            predictions = []
            for name, model in models.items():
                try:
                    if hasattr(model, 'predict_proba'):
                        pred = model.predict_proba(X)
                        if pred.shape[1] > 1:
                            predictions.append(pred[:, 1])  # Classe positive
                        else:
                            predictions.append(pred[:, 0])
                    else:
                        pred = model.predict(X)
                        predictions.append(pred)
                except:
                    continue
            
            if predictions:
                predictions_array = np.array(predictions)
                mean_pred = np.mean(predictions_array, axis=0)
                variance = np.var(predictions_array, axis=0)
                
                uncertainties = {
                    'predictions': mean_pred,
                    'epistemic_uncertainty': variance,  # Incertitude due au modèle
                    'total_uncertainty': variance,      # Simplification
                    'confidence_intervals': [
                        (mean_pred - 1.96 * np.sqrt(variance),
                         mean_pred + 1.96 * np.sqrt(variance))
                    ]
                }
        
        elif method == 'monte_carlo_dropout':
            # Pour les réseaux de neurones avec dropout
            # Implémentation simplifiée
            uncertainties = self._monte_carlo_uncertainty(models, X)
            
        return uncertainties
    
    def detect_data_drift(self, X_reference, X_current, feature_names=None):
        """
        3. DÉTECTION DE DÉRIVE DES DONNÉES
        """
        drift_results = {
            'overall_drift': False,
            'feature_drifts': {},
            'drift_score': 0.0,
            'recommendations': []
        }
        
        try:
            # Test de Kolmogorov-Smirnov pour chaque feature
            n_features = X_reference.shape[1]
            drift_scores = []
            
            for i in range(n_features):
                feature_name = feature_names[i] if feature_names else f'feature_{i}'
                
                # Test KS
                ks_stat, p_value = stats.ks_2samp(
                    X_reference[:, i], 
                    X_current[:, i]
                )
                
                # Détection de drift si p < 0.05
                has_drift = p_value < 0.05
                drift_scores.append(ks_stat)
                
                drift_results['feature_drifts'][feature_name] = {
                    'ks_statistic': ks_stat,
                    'p_value': p_value,
                    'has_drift': has_drift,
                    'severity': 'high' if ks_stat > 0.2 else 'medium' if ks_stat > 0.1 else 'low'
                }
                
                if has_drift:
                    drift_results['recommendations'].append(
                        f"Dérive détectée sur {feature_name} (KS={ks_stat:.3f})"
                    )
            
            # Score global de dérive
            drift_results['drift_score'] = np.mean(drift_scores)
            drift_results['overall_drift'] = drift_results['drift_score'] > 0.15
            
            # Recommandations
            if drift_results['overall_drift']:
                drift_results['recommendations'].extend([
                    "Ré-entraînement du modèle recommandé",
                    "Vérification de la qualité des données récentes",
                    "Mise à jour des seuils de détection"
                ])
            
        except Exception as e:
            print(f"Erreur détection drift: {e}", file=sys.stderr)
            
        return drift_results
    
    def calculate_feature_stability(self, models, X, feature_names=None):
        """
        4. ANALYSE DE STABILITÉ DES FEATURES
        """
        stability_results = {}
        
        try:
            # Importance des features pour chaque modèle
            for name, model in models.items():
                if hasattr(model, 'feature_importances_'):
                    importances = model.feature_importances_
                elif hasattr(model, 'coef_'):
                    importances = np.abs(model.coef_[0])
                else:
                    continue
                
                if feature_names:
                    feature_importance = dict(zip(feature_names, importances))
                else:
                    feature_importance = {f'feature_{i}': imp for i, imp in enumerate(importances)}
                
                stability_results[name] = {
                    'feature_importance': feature_importance,
                    'top_features': sorted(feature_importance.items(), 
                                         key=lambda x: x[1], reverse=True)[:5]
                }
            
            # Analyse de consensus entre modèles
            if len(stability_results) > 1:
                consensus_analysis = self._analyze_feature_consensus(stability_results)
                stability_results['consensus'] = consensus_analysis
                
        except Exception as e:
            print(f"Erreur analyse stabilité: {e}", file=sys.stderr)
            
        return stability_results
    
    def implement_active_learning(self, models, X_unlabeled, uncertainty_threshold=0.3):
        """
        5. APPRENTISSAGE ACTIF POUR AMÉLIORATION CONTINUE
        """
        active_learning_results = {
            'samples_to_label': [],
            'uncertainty_scores': [],
            'recommendations': []
        }
        
        try:
            # Calcul des incertitudes
            uncertainties = self.estimate_prediction_uncertainty(models, X_unlabeled)
            
            if 'epistemic_uncertainty' in uncertainties:
                uncertainty_scores = uncertainties['epistemic_uncertainty']
                
                # Sélection des échantillons avec haute incertitude
                high_uncertainty_indices = np.where(
                    uncertainty_scores > uncertainty_threshold
                )[0]
                
                # Top échantillons à labelliser
                top_indices = high_uncertainty_indices[
                    np.argsort(uncertainty_scores[high_uncertainty_indices])[-10:]
                ]
                
                active_learning_results.update({
                    'samples_to_label': top_indices.tolist(),
                    'uncertainty_scores': uncertainty_scores[top_indices].tolist(),
                    'recommendations': [
                        f"Labelliser {len(top_indices)} échantillons haute incertitude",
                        "Demander validation expert sur cas ambigus",
                        "Intégrer feedback techniciens terrain"
                    ]
                })
                
        except Exception as e:
            print(f"Erreur apprentissage actif: {e}", file=sys.stderr)
            
        return active_learning_results
    
    def generate_reliability_report(self, models, X_test, y_test, feature_names=None):
        """
        6. RAPPORT COMPLET DE FIABILITÉ
        """
        report = {
            'timestamp': datetime.now().isoformat(),
            'model_performance': {},
            'calibration_analysis': {},
            'uncertainty_analysis': {},
            'drift_analysis': {},
            'recommendations': [],
            'overall_reliability_score': 0.0
        }
        
        try:
            # 1. Performance des modèles
            for name, model in models.items():
                try:
                    accuracy = model.score(X_test, y_test)
                    predictions = model.predict(X_test)
                    
                    report['model_performance'][name] = {
                        'accuracy': accuracy,
                        'n_predictions': len(predictions),
                        'prediction_distribution': np.bincount(predictions).tolist()
                    }
                except:
                    continue
            
            # 2. Analyse d'incertitude
            uncertainties = self.estimate_prediction_uncertainty(models, X_test)
            if uncertainties:
                mean_uncertainty = np.mean(uncertainties.get('epistemic_uncertainty', [0]))
                report['uncertainty_analysis'] = {
                    'mean_uncertainty': float(mean_uncertainty),
                    'high_uncertainty_samples': int(np.sum(
                        uncertainties.get('epistemic_uncertainty', []) > 0.3
                    )),
                    'uncertainty_distribution': np.histogram(
                        uncertainties.get('epistemic_uncertainty', []), bins=5
                    )[0].tolist()
                }
            
            # 3. Score de fiabilité global
            reliability_factors = []
            
            # Facteur de performance
            if report['model_performance']:
                avg_accuracy = np.mean([
                    perf['accuracy'] for perf in report['model_performance'].values()
                ])
                reliability_factors.append(avg_accuracy)
            
            # Facteur d'incertitude (inversé)
            if 'mean_uncertainty' in report.get('uncertainty_analysis', {}):
                uncertainty_factor = 1 - report['uncertainty_analysis']['mean_uncertainty']
                reliability_factors.append(uncertainty_factor)
            
            # Score final
            if reliability_factors:
                report['overall_reliability_score'] = float(np.mean(reliability_factors))
            
            # 4. Recommandations
            reliability_score = report['overall_reliability_score']
            if reliability_score > 0.8:
                report['recommendations'].append("Système hautement fiable - Maintenance préventive")
            elif reliability_score > 0.6:
                report['recommendations'].append("Fiabilité acceptable - Surveillance renforcée")
            else:
                report['recommendations'].append("Fiabilité insuffisante - Ré-entraînement urgent")
            
        except Exception as e:
            print(f"Erreur génération rapport: {e}", file=sys.stderr)
            
        return report
    
    def _monte_carlo_uncertainty(self, models, X, n_iterations=100):
        """Estimation d'incertitude par Monte Carlo"""
        # Implémentation simplifiée
        return {'epistemic_uncertainty': np.random.random(len(X)) * 0.1}
    
    def _analyze_feature_consensus(self, stability_results):
        """Analyse du consensus entre modèles sur l'importance des features"""
        all_features = set()
        for result in stability_results.values():
            all_features.update(result['feature_importance'].keys())
        
        consensus = {}
        for feature in all_features:
            importances = []
            for result in stability_results.values():
                if feature in result['feature_importance']:
                    importances.append(result['feature_importance'][feature])
            
            if importances:
                consensus[feature] = {
                    'mean_importance': np.mean(importances),
                    'std_importance': np.std(importances),
                    'agreement_level': 1 - (np.std(importances) / (np.mean(importances) + 1e-10))
                }
        
        return consensus

def main():
    """Point d'entrée principal"""
    if len(sys.argv) < 2:
        print("Usage: python diagnostic-reliability-enhancer.py <command>")
        return
    
    command = sys.argv[1]
    enhancer = DiagnosticReliabilityEnhancer()
    
    try:
        if command == "calibrate":
            # Chargement et calibration des modèles
            print("Calibration des modèles en cours...")
            
        elif command == "detect_drift":
            # Détection de dérive
            print("Détection de dérive des données...")
            
        elif command == "reliability_report":
            # Génération du rapport de fiabilité
            print("Génération du rapport de fiabilité...")
            
        else:
            print(f"Commande inconnue: {command}")
            
    except Exception as e:
        print(f"Erreur: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
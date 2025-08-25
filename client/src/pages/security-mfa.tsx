/**
 * 🔐 PAGE GESTION MFA SÉCURITÉ
 * 
 * Page dédiée à la gestion de l'authentification multi-facteurs
 * - Configuration et setup MFA
 * - Vérification et tests
 * - Gestion des codes de backup
 * - Interface admin complète
 */

import React, { useState, useEffect } from 'react';
import { MFASetup } from "@/components/MFASetup";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Users, AlertTriangle, CheckCircle, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function SecurityMFAPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 0,
    mfaEnabledUsers: 0,
    adminUsers: 0,
    complianceRate: 0
  });

  useEffect(() => {
    // Simuler des statistiques - en prod, faire un vrai appel API
    setStats({
      totalUsers: 12,
      mfaEnabledUsers: 8,
      adminUsers: 3,
      complianceRate: 67
    });
  }, []);

  // Vérifier si l'utilisateur actuel est admin
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const mfaComplianceRate = Math.round((stats.mfaEnabledUsers / stats.totalUsers) * 100);

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Shield className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sécurité & Authentification</h1>
          <p className="text-lg text-gray-600">Gestion de l'authentification multi-facteurs (MFA)</p>
        </div>
      </div>

      {/* Alertes de sécurité */}
      {isAdmin && mfaComplianceRate < 80 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Attention sécurité :</strong> Seulement {mfaComplianceRate}% des utilisateurs ont activé MFA. 
            Recommandation : rendre MFA obligatoire pour les rôles sensibles.
          </AlertDescription>
        </Alert>
      )}

      {/* Statistiques de sécurité pour les admins */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Utilisateurs Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="text-2xl font-bold">{stats.totalUsers}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">MFA Activé</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-2xl font-bold text-green-600">{stats.mfaEnabledUsers}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Administrateurs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Settings className="w-5 h-5 text-purple-500" />
                <span className="text-2xl font-bold text-purple-600">{stats.adminUsers}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Conformité MFA</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-blue-500" />
                <span className="text-2xl font-bold text-blue-600">{mfaComplianceRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${mfaComplianceRate}%` }}
                ></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Section MFA principale */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Configuration MFA */}
        <div className="lg:col-span-2">
          <MFASetup />
        </div>

        {/* Panel d'information */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <span>Qu'est-ce que MFA ?</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-600">
              <p>
                L'authentification multi-facteurs (MFA) ajoute une couche de sécurité supplémentaire 
                en exigeant deux formes d'identification :
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Quelque chose que vous connaissez</strong> : votre mot de passe</li>
                <li><strong>Quelque chose que vous possédez</strong> : votre téléphone</li>
              </ul>
              <p>
                Cela réduit considérablement les risques d'accès non autorisé, même si votre 
                mot de passe est compromis.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <span>Codes de Récupération</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <p>
                Les codes de récupération vous permettent d'accéder à votre compte si vous 
                perdez votre téléphone.
              </p>
              <div className="space-y-2">
                <Badge variant="outline" className="text-xs">
                  ✓ Sauvegardez-les en lieu sûr
                </Badge>
                <Badge variant="outline" className="text-xs">
                  ✓ Chaque code n'est utilisable qu'une fois
                </Badge>
                <Badge variant="outline" className="text-xs">
                  ✓ Générez-en de nouveaux si nécessaire
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-green-600" />
                <span>Applications Compatibles</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">Google Authenticator</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">Microsoft Authenticator</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">Authy</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">1Password</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Politique de sécurité pour admins */}
          {isAdmin && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-700 flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Politique Admin</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-red-600">
                <p>
                  <strong>MFA obligatoire</strong> pour tous les comptes administrateurs et propriétaires.
                </p>
                <p className="mt-2">
                  Cette mesure de sécurité ne peut pas être désactivée pour les rôles sensibles.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
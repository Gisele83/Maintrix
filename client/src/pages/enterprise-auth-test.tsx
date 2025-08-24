import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Shield, UserPlus, Mail, Key, Clock, Users, CheckCircle, XCircle } from "lucide-react";

/**
 * 🔒 PAGE DE TEST DU SYSTÈME D'AUTHENTIFICATION ENTERPRISE
 * Permet de tester les priorités 1-3 du plan de sécurisation
 */
export default function EnterpriseAuthTest() {
  const { toast } = useToast();
  const [invitationData, setInvitationData] = useState({
    email: "",
    role: "technician",
    expirationHours: 24
  });
  const [invitationResult, setInvitationResult] = useState<any>(null);
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
    tenantId: ""
  });
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [verifyToken, setVerifyToken] = useState("");
  const [verificationResult, setVerificationResult] = useState<any>(null);

  /**
   * PRIORITÉ 3: TEST CRÉATION D'INVITATION
   */
  const handleCreateInvitation = async () => {
    try {
      const response = await apiRequest('POST', '/api/enterprise-auth/invitations/create', { body: invitationData });
      
      setInvitationResult(response);
      toast({
        title: "✅ Invitation créée",
        description: `Invitation envoyée à ${invitationData.email}`,
        variant: "default"
      });
    } catch (error: any) {
      console.error("Invitation creation error:", error);
      toast({
        title: "❌ Erreur d'invitation",
        description: error.message || "Échec de création de l'invitation",
        variant: "destructive"
      });
    }
  };

  /**
   * PRIORITÉ 1-2: TEST LOGIN ENTERPRISE
   */
  const handleEnterpriseLogin = async () => {
    try {
      const response = await apiRequest('POST', '/api/enterprise-auth/login', { body: loginData });
      
      setSessionInfo(response);
      localStorage.setItem('sessionToken', response.sessionToken);
      
      toast({
        title: "🔐 Connexion réussie",
        description: `Bienvenue ${response.user.username}`,
        variant: "default"
      });
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "🚫 Connexion échouée",
        description: error.message || "Échec de connexion",
        variant: "destructive"
      });
    }
  };

  /**
   * TEST VÉRIFICATION D'INVITATION
   */
  const handleVerifyInvitation = async () => {
    try {
      const response = await apiRequest('GET', `/api/enterprise-auth/invitations/verify/${verifyToken}`);
      
      setVerificationResult(response);
      toast({
        title: "🔍 Invitation vérifiée",
        description: response.valid ? "Invitation valide" : "Invitation invalide",
        variant: response.valid ? "default" : "destructive"
      });
    } catch (error: any) {
      console.error("Verification error:", error);
      toast({
        title: "❌ Erreur de vérification",
        description: error.message || "Échec de vérification",
        variant: "destructive"
      });
    }
  };

  /**
   * TEST DÉCONNEXION SÉCURISÉE
   */
  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/enterprise-auth/logout', {});
      
      setSessionInfo(null);
      localStorage.removeItem('sessionToken');
      
      toast({
        title: "👋 Déconnexion réussie",
        description: "Session révoquée avec succès",
        variant: "default"
      });
    } catch (error: any) {
      console.error("Logout error:", error);
      toast({
        title: "❌ Erreur de déconnexion",
        description: error.message || "Échec de déconnexion",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              🔒 Test Authentification Enterprise
            </h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Interface de test pour les priorités 1-3 du plan de sécurisation : 
            Authentification obligatoire + Système d'invitations + Sessions sécurisées
          </p>
        </div>

        <Tabs defaultValue="invitations" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/70 backdrop-blur-sm">
            <TabsTrigger value="invitations" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invitations
            </TabsTrigger>
            <TabsTrigger value="login" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Login Enterprise
            </TabsTrigger>
            <TabsTrigger value="verify" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Vérifier Token
            </TabsTrigger>
            <TabsTrigger value="session" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Session Active
            </TabsTrigger>
          </TabsList>

          {/* PRIORITÉ 3: SYSTÈME D'INVITATIONS */}
          <TabsContent value="invitations">
            <Card className="bg-white/70 backdrop-blur-sm border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-blue-600" />
                  📧 PRIORITÉ 3: Système d'Invitations par Tenant
                </CardTitle>
                <CardDescription>
                  Créer des invitations sécurisées avec contrôle strict de l'inscription
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email">Email du destinataire</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="utilisateur@entreprise.com"
                        value={invitationData.email}
                        onChange={(e) => setInvitationData({...invitationData, email: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="role">Rôle</Label>
                      <Select 
                        value={invitationData.role} 
                        onValueChange={(value) => setInvitationData({...invitationData, role: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="technician">Technicien</SelectItem>
                          <SelectItem value="maintainer">Mainteneur</SelectItem>
                          <SelectItem value="admin">Administrateur</SelectItem>
                          <SelectItem value="viewer">Observateur</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="expiration">Expiration (heures)</Label>
                      <Input
                        id="expiration"
                        type="number"
                        min="1"
                        max="168"
                        value={invitationData.expirationHours}
                        onChange={(e) => setInvitationData({...invitationData, expirationHours: parseInt(e.target.value)})}
                      />
                    </div>
                    
                    <Button onClick={handleCreateInvitation} className="w-full">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Créer Invitation
                    </Button>
                  </div>
                  
                  {invitationResult && (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <h4 className="font-semibold text-green-800 mb-2">✅ Invitation créée</h4>
                      <div className="space-y-2 text-sm">
                        <p><strong>ID:</strong> <code className="bg-green-100 px-1 rounded">{invitationResult.invitationId}</code></p>
                        <p><strong>Lien:</strong></p>
                        <code className="bg-green-100 px-2 py-1 rounded text-xs block break-all">
                          {invitationResult.invitationLink}
                        </code>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PRIORITÉ 1-2: LOGIN ENTERPRISE */}
          <TabsContent value="login">
            <Card className="bg-white/70 backdrop-blur-sm border-purple-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-purple-600" />
                  🔐 PRIORITÉ 1-2: Authentification Obligatoire
                </CardTitle>
                <CardDescription>
                  Test du système de connexion enterprise avec sessions sécurisées
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="loginEmail">Email</Label>
                      <Input
                        id="loginEmail"
                        type="email"
                        placeholder="admin@entreprise.com"
                        value={loginData.email}
                        onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="loginPassword">Mot de passe</Label>
                      <Input
                        id="loginPassword"
                        type="password"
                        placeholder="••••••••"
                        value={loginData.password}
                        onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="tenantId">Tenant ID (optionnel)</Label>
                      <Input
                        id="tenantId"
                        placeholder="uuid-du-tenant"
                        value={loginData.tenantId}
                        onChange={(e) => setLoginData({...loginData, tenantId: e.target.value})}
                      />
                    </div>
                    
                    <Button onClick={handleEnterpriseLogin} className="w-full">
                      <Key className="h-4 w-4 mr-2" />
                      Connexion Enterprise
                    </Button>
                  </div>
                  
                  {sessionInfo && (
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <h4 className="font-semibold text-purple-800 mb-2">🔐 Session Active</h4>
                      <div className="space-y-2 text-sm">
                        <p><strong>Utilisateur:</strong> {sessionInfo.user.username}</p>
                        <p><strong>Rôle:</strong> <Badge variant="outline">{sessionInfo.user.role}</Badge></p>
                        <p><strong>Tenant:</strong> <code className="bg-purple-100 px-1 rounded">{sessionInfo.user.tenantId}</code></p>
                        <p><strong>Expire:</strong> {new Date(sessionInfo.expiresAt).toLocaleString()}</p>
                        <Button onClick={handleLogout} size="sm" variant="outline">
                          Déconnexion
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* VÉRIFICATION D'INVITATION */}
          <TabsContent value="verify">
            <Card className="bg-white/70 backdrop-blur-sm border-green-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-green-600" />
                  🔍 Vérification de Token d'Invitation
                </CardTitle>
                <CardDescription>
                  Valider un token d'invitation avant acceptation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="verifyToken">Token d'invitation</Label>
                      <Input
                        id="verifyToken"
                        placeholder="64-caractères-hexadécimaux..."
                        value={verifyToken}
                        onChange={(e) => setVerifyToken(e.target.value)}
                      />
                    </div>
                    
                    <Button onClick={handleVerifyInvitation} className="w-full">
                      <Mail className="h-4 w-4 mr-2" />
                      Vérifier Token
                    </Button>
                  </div>
                  
                  {verificationResult && (
                    <div className={`p-4 rounded-lg border ${verificationResult.valid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <h4 className={`font-semibold mb-2 ${verificationResult.valid ? 'text-green-800' : 'text-red-800'}`}>
                        {verificationResult.valid ? (
                          <><CheckCircle className="h-4 w-4 inline mr-1" /> Invitation Valide</>
                        ) : (
                          <><XCircle className="h-4 w-4 inline mr-1" /> Invitation Invalide</>
                        )}
                      </h4>
                      
                      {verificationResult.valid && verificationResult.invitation && (
                        <div className="space-y-2 text-sm">
                          <p><strong>Email:</strong> {verificationResult.invitation.email}</p>
                          <p><strong>Rôle:</strong> <Badge variant="outline">{verificationResult.invitation.role}</Badge></p>
                          <p><strong>Organisation:</strong> {verificationResult.invitation.organizationName}</p>
                          <p><strong>Expire:</strong> {new Date(verificationResult.invitation.expiresAt).toLocaleString()}</p>
                        </div>
                      )}
                      
                      {!verificationResult.valid && (
                        <p className="text-sm text-red-600">{verificationResult.error}</p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* STATUS SESSION */}
          <TabsContent value="session">
            <Card className="bg-white/70 backdrop-blur-sm border-indigo-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" />
                  👥 Status Session & Sécurité
                </CardTitle>
                <CardDescription>
                  Informations sur la session active et mesures de sécurité
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Status Authentification */}
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-2">🔒 Authentification</h4>
                    <div className="space-y-1 text-sm">
                      <p>Accès public: <Badge variant="destructive">Bloqué</Badge></p>
                      <p>Session requise: <Badge variant="default">Obligatoire</Badge></p>
                      <p>Cookies: <Badge variant="default">HttpOnly + Secure</Badge></p>
                    </div>
                  </div>
                  
                  {/* Status Rate Limiting */}
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <h4 className="font-semibold text-orange-800 mb-2">📊 Rate Limiting</h4>
                    <div className="space-y-1 text-sm">
                      <p>Login: <Badge variant="outline">5/15min</Badge></p>
                      <p>Invitations: <Badge variant="outline">10/1h</Badge></p>
                      <p>Bruteforce: <Badge variant="default">Protection active</Badge></p>
                    </div>
                  </div>
                  
                  {/* Status Invitations */}
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-2">📧 Invitations</h4>
                    <div className="space-y-1 text-sm">
                      <p>Contrôle: <Badge variant="default">Par tenant</Badge></p>
                      <p>Expiration: <Badge variant="outline">24h-7j</Badge></p>
                      <p>Token: <Badge variant="default">SHA-256</Badge></p>
                    </div>
                  </div>
                </div>
                
                {sessionInfo && (
                  <div className="mt-6 bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                    <h4 className="font-semibold text-indigo-800 mb-2">🔐 Session Courante</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p><strong>Token:</strong> <code className="bg-indigo-100 px-1 rounded">***{sessionInfo.sessionToken.slice(-8)}</code></p>
                        <p><strong>Utilisateur:</strong> {sessionInfo.user.username}</p>
                        <p><strong>Email:</strong> {sessionInfo.user.email}</p>
                      </div>
                      <div>
                        <p><strong>Rôle:</strong> <Badge variant="outline">{sessionInfo.user.role}</Badge></p>
                        <p><strong>Tenant:</strong> <code className="bg-indigo-100 px-1 rounded">{sessionInfo.user.tenantId}</code></p>
                        <p><strong>Expire:</strong> {new Date(sessionInfo.expiresAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
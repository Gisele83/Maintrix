import React, { lazy } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import Dashboard from "@/pages/dashboard";
import ModernHome from "@/pages/modern-home";
import LandingPage from "@/pages/landing";
import RegisterPage from "@/pages/register";
import SmartDiagnostic from "@/pages/smart-diagnostic";
import GMAODashboard from "@/pages/gmao-dashboard";
import UserProfiles from "@/pages/user-profiles";
import Documentation from "@/pages/documentation";
import Training from "@/pages/training";
import LearningDashboard from "@/pages/learning-dashboard";
import IoTGamificationDashboard from "@/pages/iot-gamification-dashboard";
import AccessManagement from "@/pages/access-management";
import CCTPCompliancePage from "@/pages/cctp-compliance";
import ERPConfiguration from "@/pages/erp-configuration";
import TenantPermissions from "@/pages/tenant-permissions";
// ✅ MIGRATION COMPLÈTE : Security dashboard legacy supprimé
import SupportChatbot from "@/pages/support-chatbot";
import AIAssistantPage from "@/pages/ai-assistant";
import DataImportExport from "@/pages/data-import-export";
import AdvancedReporting from "@/pages/advanced-reporting";
import WorkOrders from "@/pages/work-orders";
import MaintenanceExecutionPage from "@/pages/maintenance-execution";
import KnowledgeGraphPage from "@/pages/knowledge-graph";
import MaintenanceEngineeringPlatformPage from "@/pages/maintenance-engineering-platform";
import SmmPage from "@/pages/smm";
import KnowledgeHubPage from "@/pages/knowledge-hub";
import DigitalTwinPage from "@/pages/digital-twin";
import PredictiveEnginePage from "@/pages/predictive-engine";
import EngineeringExpertisePage from "@/pages/engineering-expertise";
import MultiAgentTeamPage from "@/pages/multi-agent-team";
import EquipmentLifecyclePage from "@/pages/equipment-lifecycle";
import { EquipmentManagement } from "@/components/equipment-management";
import PreventiveMaintenance from "@/pages/preventive-maintenance";
import MaintenanceDashboard from "@/pages/maintenance-dashboard";
import VoiceDiagnostic from "@/pages/voice-diagnostic";
import ModulesOverview from "@/pages/modules-overview";
import DataImport from "@/pages/data-import";
import Historique from "@/pages/historique";
import Inventaire from "@/pages/inventaire";
import AdvancedIntegrations from "@/pages/advanced-integrations";

import LocalhostDiagnostic from "@/pages/localhost-diagnostic";
import TenantManagement from "@/pages/tenant-management";
import SuperAdminLogin from "@/pages/super-admin-login";
import SuperAdminDashboard from "@/pages/super-admin-dashboard";
import EmailDiagnostic from "@/pages/email-diagnostic";
import ChangeCredentials from "@/pages/change-credentials";
import UserManagement from "@/pages/user-management";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import FirstLoginPasswordChange from "@/pages/first-login-password-change";
import LoginPage from "@/pages/login";
import ForceLogout from "@/pages/force-logout";
import NotFound from "@/pages/not-found";
import PaymentTest from "@/pages/payment-test";
import SubscriptionPage from "@/pages/subscription";
import TrialDashboard from "@/pages/trial-dashboard";
import { LicenseBanner } from "@/components/license-banner";
import ClientPortalPage from "@/pages/client-portal";
import SLAManagement from "@/pages/sla-management";
import MachineHealth from "@/pages/machine-health";
import SmartAlerts from "@/pages/smart-alerts";
import SensorHub from "@/pages/sensor-hub";
import PredictiveInsights from "@/pages/predictive-insights";
import EquipmentQR from "@/pages/equipment-qr";
import CognitiveInfrastructure from "@/pages/cognitive-infrastructure";
import SystemHealthPage from "@/pages/system-health";
import CommunicationIntegrations from "@/pages/communication-integrations";
import PermitToWork from "@/pages/permit-to-work";
import RcaPage from "@/pages/rca";
import OeePage from "@/pages/oee";
import FmeaPage from "@/pages/fmea";
import AssetLifecyclePage from "@/pages/asset-lifecycle";
import CalibrationPage from "@/pages/calibration";
import HabilitationPage from "@/pages/habilitation";
import DownloadCenterPage from "@/pages/download-center";
import BudgetPage from "@/pages/budget";
import SupplierPage from "@/pages/supplier-portal";
import WarrantyPage from "@/pages/warranty";
import MaintenancePlanPage from "@/pages/maintenance-plan";
import MaintenanceRecommendations from "@/pages/maintenance-recommendations";
import MobileNotificationsPage from "@/pages/mobile-notifications";
import IMCADashboard from "@/pages/imca-dashboard";
import ProspectiveSimulationPage from "@/pages/prospective-simulation";
import MultiAssetOptimizerPage from "@/pages/multi-asset-optimizer";
import CryptoJournalPage from "@/pages/crypto-journal";
import FederatedAdaptationPage from "@/pages/federated-adaptation";

function ProtectedRoute({ component: Component, ...props }: any) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">Chargement...</h2>
          <p className="text-gray-500">Vérification de votre authentification</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <Component {...props} />;
}

function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();

  // Always show landing page for non-authenticated users (no loading state)
  // Check if there's a session token to determine if we should wait
  const hasToken = typeof window !== 'undefined' && localStorage.getItem("sessionToken");
  
  // If no token exists, show landing page immediately without waiting
  if (!hasToken) {
    return <LandingPage />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700">Chargement...</h2>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <ModernHome />;
  }

  return <LandingPage />;
}

function Router() {
  return (
    <>
    <LicenseBanner />
    <Switch>
      {/* Public routes - Landing and Registration */}
      <Route path="/welcome" component={LandingPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/first-login-password-change" component={FirstLoginPasswordChange} />
      <Route path="/change-credentials">
        {(params) => <ProtectedRoute component={ChangeCredentials} {...params} />}
      </Route>
      <Route path="/user-management">
        {(params) => <ProtectedRoute component={UserManagement} {...params} />}
      </Route>
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/force-logout" component={ForceLogout} />
      <Route path="/payment-test" component={PaymentTest} />
      <Route path="/" component={HomePage} />
      <Route path="/dashboard">
        {(params) => <ProtectedRoute component={Dashboard} {...params} />}
      </Route>
      <Route path="/diagnostic">
        {(params) => <ProtectedRoute component={SmartDiagnostic} {...params} />}
      </Route>
      <Route path="/smart-diagnostic">
        {(params) => <ProtectedRoute component={SmartDiagnostic} {...params} />}
      </Route>
      <Route path="/gmao">
        {(params) => <ProtectedRoute component={GMAODashboard} {...params} />}
      </Route>
      <Route path="/dashboard/gmao">
        {(params) => <ProtectedRoute component={GMAODashboard} {...params} />}
      </Route>
      <Route path="/gmao-dashboard">
        {(params) => <ProtectedRoute component={GMAODashboard} {...params} />}
      </Route>
      <Route path="/profiles">
        {(params) => <ProtectedRoute component={UserProfiles} {...params} />}
      </Route>
      <Route path="/documentation">
        {(params) => <ProtectedRoute component={Documentation} {...params} />}
      </Route>
      <Route path="/training">
        {(params) => <ProtectedRoute component={Training} {...params} />}
      </Route>
      <Route path="/learning">
        {(params) => <ProtectedRoute component={LearningDashboard} {...params} />}
      </Route>
      <Route path="/iot-gamification">
        {(params) => <ProtectedRoute component={IoTGamificationDashboard} {...params} />}
      </Route>
      <Route path="/access-management">
        {(params) => <ProtectedRoute component={AccessManagement} {...params} />}
      </Route>
      {/* ✅ MIGRATION COMPLÈTE : Security dashboard legacy supprimé */}
      <Route path="/support-chatbot">
        {(params) => <ProtectedRoute component={SupportChatbot} {...params} />}
      </Route>
      <Route path="/ai-assistant">
        {(params) => <ProtectedRoute component={AIAssistantPage} {...params} />}
      </Route>
      <Route path="/data-import-export">
        {(params) => <ProtectedRoute component={DataImportExport} {...params} />}
      </Route>
      <Route path="/historique">
        {(params) => <ProtectedRoute component={Historique} {...params} />}
      </Route>
      <Route path="/inventaire">
        {(params) => <ProtectedRoute component={Inventaire} {...params} />}
      </Route>
      <Route path="/advanced-integrations">
        {(params) => <ProtectedRoute component={AdvancedIntegrations} {...params} />}
      </Route>
      <Route path="/advanced-reporting">
        {(params) => <ProtectedRoute component={AdvancedReporting} {...params} />}
      </Route>
      <Route path="/equipment">
        {(params) => <ProtectedRoute component={EquipmentManagement} {...params} />}
      </Route>
      <Route path="/equipment-management">
        {(params) => <ProtectedRoute component={EquipmentManagement} {...params} />}
      </Route>
      <Route path="/work-orders">
        {(params) => <ProtectedRoute component={WorkOrders} {...params} />}
      </Route>
      <Route path="/maintenance-execution/:workOrderId?">
        {(params) => <ProtectedRoute component={MaintenanceExecutionPage} {...params} />}
      </Route>
      <Route path="/knowledge-graph">
        {(params) => <ProtectedRoute component={KnowledgeGraphPage} {...params} />}
      </Route>
      <Route path="/maintenance-platform">
        {(params) => <ProtectedRoute component={MaintenanceEngineeringPlatformPage} {...params} />}
      </Route>
      <Route path="/smm">
        {(params) => <ProtectedRoute component={SmmPage} {...params} />}
      </Route>
      <Route path="/knowledge-hub">
        {(params) => <ProtectedRoute component={KnowledgeHubPage} {...params} />}
      </Route>
      <Route path="/digital-twin">
        {(params) => <ProtectedRoute component={DigitalTwinPage} {...params} />}
      </Route>
      <Route path="/predictive-engine">
        {(params) => <ProtectedRoute component={PredictiveEnginePage} {...params} />}
      </Route>
      <Route path="/engineering-expertise">
        {(params) => <ProtectedRoute component={EngineeringExpertisePage} {...params} />}
      </Route>
      <Route path="/multi-agent-team">
        {(params) => <ProtectedRoute component={MultiAgentTeamPage} {...params} />}
      </Route>
      <Route path="/equipment-lifecycle">
        {(params) => <ProtectedRoute component={EquipmentLifecyclePage} {...params} />}
      </Route>
      <Route path="/permit-to-work">
        {(params) => <ProtectedRoute component={PermitToWork} {...params} />}
      </Route>
      <Route path="/permits">
        {(params) => <ProtectedRoute component={PermitToWork} {...params} />}
      </Route>
      <Route path="/rca">
        {(params) => <ProtectedRoute component={RcaPage} {...params} />}
      </Route>
      <Route path="/oee">
        {(params) => <ProtectedRoute component={OeePage} {...params} />}
      </Route>
      <Route path="/fmea">
        {(params) => <ProtectedRoute component={FmeaPage} {...params} />}
      </Route>
      <Route path="/asset-lifecycle">
        {(params) => <ProtectedRoute component={AssetLifecyclePage} {...params} />}
      </Route>
      <Route path="/calibration">
        {(params) => <ProtectedRoute component={CalibrationPage} {...params} />}
      </Route>
      <Route path="/habilitation">
        {(params) => <ProtectedRoute component={HabilitationPage} {...params} />}
      </Route>
      <Route path="/budget">
        {(params) => <ProtectedRoute component={BudgetPage} {...params} />}
      </Route>
      <Route path="/supplier-portal">
        {(params) => <ProtectedRoute component={SupplierPage} {...params} />}
      </Route>
      <Route path="/warranty">
        {(params) => <ProtectedRoute component={WarrantyPage} {...params} />}
      </Route>
      <Route path="/maintenance-plan">
        {(params) => <ProtectedRoute component={MaintenancePlanPage} {...params} />}
      </Route>
      <Route path="/maintenance-recommendations">
        {(params) => <ProtectedRoute component={MaintenanceRecommendations} {...params} />}
      </Route>
      <Route path="/mobile-notifications">
        {(params) => <ProtectedRoute component={MobileNotificationsPage} {...params} />}
      </Route>
      <Route path="/imca">
        {(params) => <ProtectedRoute component={IMCADashboard} {...params} />}
      </Route>
      <Route path="/prospective-simulation">
        {(params) => <ProtectedRoute component={ProspectiveSimulationPage} {...params} />}
      </Route>
      <Route path="/multi-asset-optimizer">
        {(params) => <ProtectedRoute component={MultiAssetOptimizerPage} {...params} />}
      </Route>
      <Route path="/crypto-journal">
        {(params) => <ProtectedRoute component={CryptoJournalPage} {...params} />}
      </Route>
      <Route path="/federated-adaptation">
        {(params) => <ProtectedRoute component={FederatedAdaptationPage} {...params} />}
      </Route>
      <Route path="/download">
        {() => <DownloadCenterPage />}
      </Route>
      <Route path="/preventive">
        {(params) => <ProtectedRoute component={PreventiveMaintenance} {...params} />}
      </Route>
      <Route path="/preventive-maintenance">
        {(params) => <ProtectedRoute component={PreventiveMaintenance} {...params} />}
      </Route>
      <Route path="/maintenance-dashboard">
        {(params) => <ProtectedRoute component={MaintenanceDashboard} {...params} />}
      </Route>
      <Route path="/voice-diagnostic">
        {(params) => <ProtectedRoute component={VoiceDiagnostic} {...params} />}
      </Route>
      <Route path="/modules">
        {(params) => <ProtectedRoute component={ModulesOverview} {...params} />}
      </Route>
      <Route path="/modules-overview">
        {(params) => <ProtectedRoute component={ModulesOverview} {...params} />}
      </Route>
      <Route path="/data-import">
        {(params) => <ProtectedRoute component={DataImport} {...params} />}
      </Route>
      <Route path="/import-data">
        {(params) => <ProtectedRoute component={DataImport} {...params} />}
      </Route>

      <Route path="/localhost-diagnostic">
        {(params) => <ProtectedRoute component={LocalhostDiagnostic} {...params} />}
      </Route>
      <Route path="/diagnostic-localhost">
        {(params) => <ProtectedRoute component={LocalhostDiagnostic} {...params} />}
      </Route>
      <Route path="/tenant-management">
        {(params) => <ProtectedRoute component={TenantManagement} {...params} />}
      </Route>
      <Route path="/enterprise-auth-test">
        {(params) => <ProtectedRoute component={lazy(() => import("./pages/enterprise-auth-test"))} {...params} />}
      </Route>
      <Route path="/secure-validation">
        {(params) => <ProtectedRoute component={lazy(() => import("./pages/secure-validation"))} {...params} />}
      </Route>
      <Route path="/security-mfa">
        {(params) => <ProtectedRoute component={lazy(() => import("./pages/security-mfa"))} {...params} />}
      </Route>
      <Route path="/cctp-compliance">
        {(params) => <ProtectedRoute component={CCTPCompliancePage} {...params} />}
      </Route>
      <Route path="/erp-configuration">
        {(params) => <ProtectedRoute component={ERPConfiguration} {...params} />}
      </Route>
      <Route path="/tenant-permissions">
        {(params) => <ProtectedRoute component={TenantPermissions} {...params} />}
      </Route>
      <Route path="/configuration-erp">
        {(params) => <ProtectedRoute component={ERPConfiguration} {...params} />}
      </Route>
      <Route path="/client-portal" component={ClientPortalPage} />
      <Route path="/client-portal/:token" component={ClientPortalPage} />
      <Route path="/sla-management">
        {(params) => <ProtectedRoute component={SLAManagement} {...params} />}
      </Route>
      <Route path="/sla">
        {(params) => <ProtectedRoute component={SLAManagement} {...params} />}
      </Route>
      <Route path="/machine-health">
        {(params) => <ProtectedRoute component={MachineHealth} {...params} />}
      </Route>
      <Route path="/health-scoring">
        {(params) => <ProtectedRoute component={MachineHealth} {...params} />}
      </Route>
      <Route path="/smart-alerts">
        {(params) => <ProtectedRoute component={SmartAlerts} {...params} />}
      </Route>
      <Route path="/sensor-hub">
        {(params) => <ProtectedRoute component={SensorHub} {...params} />}
      </Route>
      <Route path="/sensors">
        {(params) => <ProtectedRoute component={SensorHub} {...params} />}
      </Route>
      <Route path="/predictive-insights">
        {(params) => <ProtectedRoute component={PredictiveInsights} {...params} />}
      </Route>
      <Route path="/predictive">
        {(params) => <ProtectedRoute component={PredictiveInsights} {...params} />}
      </Route>
      <Route path="/equipment-qr">
        {(params) => <ProtectedRoute component={EquipmentQR} {...params} />}
      </Route>
      <Route path="/qr-codes">
        {(params) => <ProtectedRoute component={EquipmentQR} {...params} />}
      </Route>
      <Route path="/cognitive-infrastructure">
        {(params) => <ProtectedRoute component={CognitiveInfrastructure} {...params} />}
      </Route>
      <Route path="/system-health">
        {(params) => <ProtectedRoute component={SystemHealthPage} {...params} />}
      </Route>
      <Route path="/cognitive">
        {(params) => <ProtectedRoute component={CognitiveInfrastructure} {...params} />}
      </Route>
      <Route path="/communication-integrations">
        {(params) => <ProtectedRoute component={CommunicationIntegrations} {...params} />}
      </Route>
      <Route path="/subscription">
        {(params) => <ProtectedRoute component={SubscriptionPage} {...params} />}
      </Route>
      <Route path="/trial-dashboard">
        {(params) => <ProtectedRoute component={TrialDashboard} {...params} />}
      </Route>
      <Route path="/trial">
        {(params) => <ProtectedRoute component={TrialDashboard} {...params} />}
      </Route>
      {/* 🚀 SUPER-ADMIN INTERFACE - Accessible directement sans authentification client */}
      <Route path="/admin-login" component={SuperAdminLogin} />
      <Route path="/super-admin-login" component={SuperAdminLogin} />
      <Route path="/super-admin" component={SuperAdminDashboard} />
      <Route path="/super-admin-dashboard" component={SuperAdminDashboard} />
      <Route path="/email-diagnostic" component={EmailDiagnostic} />
      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

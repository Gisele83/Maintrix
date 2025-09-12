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
// ✅ MIGRATION COMPLÈTE : Security dashboard legacy supprimé
import SupportChatbot from "@/pages/support-chatbot";
import DataImportExport from "@/pages/data-import-export";
import AdvancedReporting from "@/pages/advanced-reporting";
import InventoryManagement from "@/pages/inventory-management";
import WorkOrders from "@/pages/work-orders";
import { EquipmentManagement } from "@/components/equipment-management";
import PreventiveMaintenance from "@/pages/preventive-maintenance";
import MaintenanceDashboard from "@/pages/maintenance-dashboard";
import VoiceDiagnostic from "@/pages/voice-diagnostic";
import ModulesOverview from "@/pages/modules-overview";
import DataImport from "@/pages/data-import";

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

function Router() {
  return (
    <Switch>
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
      <Route path="/">
        {(params) => <ProtectedRoute component={ModernHome} {...params} />}
      </Route>
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
      <Route path="/data-import-export">
        {(params) => <ProtectedRoute component={DataImportExport} {...params} />}
      </Route>
      <Route path="/advanced-reporting">
        {(params) => <ProtectedRoute component={AdvancedReporting} {...params} />}
      </Route>
      <Route path="/inventory">
        {(params) => <ProtectedRoute component={InventoryManagement} {...params} />}
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
      <Route path="/configuration-erp">
        {(params) => <ProtectedRoute component={ERPConfiguration} {...params} />}
      </Route>
      {/* 🚀 SUPER-ADMIN INTERFACE - Accessible directement sans authentification client */}
      <Route path="/admin-login" component={SuperAdminLogin} />
      <Route path="/super-admin-login" component={SuperAdminLogin} />
      <Route path="/super-admin" component={SuperAdminDashboard} />
      <Route path="/super-admin-dashboard" component={SuperAdminDashboard} />
      <Route path="/email-diagnostic" component={EmailDiagnostic} />
      <Route component={NotFound} />
    </Switch>
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

import React, { lazy } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import ModernHome from "@/pages/modern-home";
import GMAODashboard from "@/pages/gmao-dashboard";
import UserProfiles from "@/pages/user-profiles";
import Documentation from "@/pages/documentation";
import Training from "@/pages/training";
import LearningDashboard from "@/pages/learning-dashboard";
import Pricing from "@/pages/pricing";
import Payment from "@/pages/payment";
import IoTGamificationDashboard from "@/pages/iot-gamification-dashboard";
import AccessManagement from "@/pages/access-management";
import SecurityDashboard from "@/pages/security-dashboard";
import SupportChatbot from "@/pages/support-chatbot";
import DataImportExport from "@/pages/data-import-export";
import AdvancedReporting from "@/pages/advanced-reporting";
import InventoryManagement from "@/pages/inventory-management";
import WorkOrders from "@/pages/work-orders";
import EquipmentManagement from "@/pages/equipment-management";
import PreventiveMaintenance from "@/pages/preventive-maintenance";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ModernHome} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/gmao" component={GMAODashboard} />
      <Route path="/dashboard/gmao" component={GMAODashboard} />
      <Route path="/profiles" component={UserProfiles} />
      <Route path="/documentation" component={Documentation} />
      <Route path="/training" component={Training} />
      <Route path="/learning" component={LearningDashboard} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/payment" component={Payment} />
      <Route path="/iot-gamification" component={IoTGamificationDashboard} />
      <Route path="/access-management" component={AccessManagement} />
      <Route path="/security-dashboard" component={SecurityDashboard} />
      <Route path="/support-chatbot" component={SupportChatbot} />
      <Route path="/data-import-export" component={DataImportExport} />
      <Route path="/advanced-reporting" component={AdvancedReporting} />
      <Route path="/inventory" component={InventoryManagement} />
      <Route path="/equipment" component={EquipmentManagement} />
      <Route path="/work-orders" component={WorkOrders} />
      <Route path="/preventive" component={PreventiveMaintenance} />
      <Route path="/secure-validation" component={lazy(() => import("./pages/secure-validation"))} />
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

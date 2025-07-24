import React, { lazy } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import GMAODashboard from "@/pages/gmao-dashboard";
import UserProfiles from "@/pages/user-profiles";
import Documentation from "@/pages/documentation";
import Training from "@/pages/training";
import LearningDashboard from "@/pages/learning-dashboard";
import Pricing from "@/pages/pricing";
import Payment from "@/pages/payment";
import IoTGamificationDashboard from "@/pages/iot-gamification-dashboard";
import AccessManagement from "@/pages/access-management";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
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

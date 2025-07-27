import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Activity,
  Settings,
  Users,
  BarChart3,
  Shield,
  FileText,
  Wrench,
  Brain,
  Zap,
  DollarSign,
  AlertTriangle,
  HelpCircle,
  Menu,
  X,
  Home,
  Cpu,
  Database,
  ChevronDown
} from "lucide-react";

export default function ModernNavigation() {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    {
      name: "Accueil",
      href: "/",
      icon: Home,
      current: location === "/",
    },
    {
      name: "Smart Diagnostic",
      href: "/smart-diagnostic",
      icon: Brain,
      current: location === "/smart-diagnostic" || location === "/diagnostic",
      badge: "IA",
    },
    {
      name: "Smart GMAO",
      href: "/gmao",
      icon: Settings,
      current: location === "/gmao",
      submenu: [
        { name: "Dashboard GMAO", href: "/gmao", icon: Activity },
        { name: "Dashboard Maintenance", href: "/maintenance-dashboard", icon: BarChart3 },
        { name: "Équipements", href: "/equipment", icon: Cpu },
        { name: "Ordres de Travail", href: "/work-orders", icon: Wrench },
        { name: "Maintenance Préventive", href: "/preventive", icon: Settings },
        { name: "Stock & Pièces", href: "/inventory", icon: Database },
      ]
    },
    {
      name: "IoT & Monitoring",
      href: "/iot-gamification",
      icon: Zap,
      current: location === "/iot-gamification",
      badge: "Live",
    },
    {
      name: "Reporting",
      href: "/advanced-reporting",
      icon: BarChart3,
      current: location === "/advanced-reporting",
      submenu: [
        { name: "Dashboard Exécutif", href: "/advanced-reporting", icon: BarChart3 },
        { name: "Analytics Budget", href: "/advanced-reporting", icon: DollarSign },
        { name: "KPI Metrics", href: "/advanced-reporting", icon: Activity },
      ]
    },
    {
      name: "Gestion",
      href: "/access-management",
      icon: Users,
      current: location.startsWith("/access-management") || location.startsWith("/security-dashboard"),
      submenu: [
        { name: "Utilisateurs", href: "/profiles", icon: Users },
        { name: "Accès & Droits", href: "/access-management", icon: Shield },
        { name: "Sécurité", href: "/security-dashboard", icon: Shield },
        { name: "Validation", href: "/secure-validation", icon: FileText },
      ]
    },
    {
      name: "Support",
      href: "/support-chatbot",
      icon: HelpCircle,
      current: location.startsWith("/support-chatbot") || location.startsWith("/documentation"),
      submenu: [
        { name: "Assistant IA", href: "/support-chatbot", icon: Brain },
        { name: "Documentation", href: "/documentation", icon: FileText },
        { name: "Formation", href: "/training", icon: Users },
        { name: "Import/Export", href: "/data-import-export", icon: Database },
      ]
    },
  ];

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden lg:block bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl">
                  <Activity className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Smart GMAO DiagFix
                  </h1>
                  <p className="text-xs text-gray-500">Maintenance Intelligence Platform</p>
                </div>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="flex items-center space-x-1">
              {navigation.map((item) => (
                <div key={item.name} className="relative">
                  {item.submenu ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant={item.current ? "default" : "ghost"}
                          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-200 ${
                            item.current 
                              ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg" 
                              : "hover:bg-gray-100 text-gray-700"
                          }`}
                        >
                          <item.icon className="h-4 w-4" />
                          <span className="font-medium">{item.name}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="text-xs px-2">
                              {item.badge}
                            </Badge>
                          )}
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 mt-2">
                        {item.submenu.map((subItem) => (
                          <DropdownMenuItem key={subItem.name} asChild>
                            <Link href={subItem.href}>
                              <div className="flex items-center space-x-2 px-3 py-2 w-full">
                                <subItem.icon className="h-4 w-4" />
                                <span>{subItem.name}</span>
                              </div>
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Link href={item.href}>
                      <Button
                        variant={item.current ? "default" : "ghost"}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-200 ${
                          item.current 
                            ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg" 
                            : "hover:bg-gray-100 text-gray-700"
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="font-medium">{item.name}</span>
                        {"badge" in item && item.badge && (
                          <Badge variant="secondary" className="text-xs px-2">
                            {item.badge}
                          </Badge>
                        )}
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* Right side actions */}
            <div className="flex items-center space-x-3">
              <Link href="/pricing">
                <Button variant="outline" className="rounded-xl border-purple-200 text-purple-600 hover:bg-purple-50">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Tarifs
                </Button>
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-green-100 rounded-full">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
                <span className="text-sm text-gray-600">Système opérationnel</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="lg:hidden bg-white/90 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50">
        <div className="px-4 sm:px-6">
          <div className="flex justify-between items-center h-16">
            
            {/* Mobile Logo */}
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Smart GMAO
                </h1>
              </div>
            </div>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="rounded-xl"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>

          {/* Mobile menu */}
          {isMobileMenuOpen && (
            <div className="pb-4 space-y-2">
              {navigation.map((item) => (
                <div key={item.name}>
                  <Link href={item.href}>
                    <Button
                      variant={item.current ? "default" : "ghost"}
                      className={`w-full justify-start space-x-3 rounded-xl ${
                        item.current 
                          ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white" 
                          : "text-gray-700"
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.name}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="text-xs ml-auto">
                          {item.badge}
                        </Badge>
                      )}
                    </Button>
                  </Link>
                  {item.submenu && item.current && (
                    <div className="ml-6 mt-2 space-y-1">
                      {item.submenu.map((subItem) => (
                        <Link key={subItem.name} href={subItem.href}>
                          <Button
                            variant="ghost"
                            className="w-full justify-start text-sm text-gray-600 pl-8"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <subItem.icon className="h-4 w-4 mr-3" />
                            {subItem.name}
                          </Button>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </nav>
    </>
  );
}
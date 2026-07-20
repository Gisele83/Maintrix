import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { 
  Menu, 
  X, 
  Brain, 
  Settings, 
  BarChart3, 
  FileText, 
  Users, 
  Shield,
  LogOut,
  User,
  Building,
  ArrowLeft,
  History,
  Package,
  Download,
  Database,
  CreditCard,
  Home,
  TrendingUp,
  Activity,
  Sparkles,
  Bell,
  LayoutGrid
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function ModernNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [showReturnToAdmin, setShowReturnToAdmin] = useState(false);

  const { data: notifData } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/mobile/notifications"],
    refetchInterval: 30_000,
    select: (d: any) => ({ unreadCount: d?.unreadCount ?? 0 }),
  });
  const unreadCount = notifData?.unreadCount ?? 0;

  const handleLogout = () => {
    logout();
  };

  // Vérifier si l'utilisateur vient du contexte super-admin
  useEffect(() => {
    const superAdminContext = localStorage.getItem('superAdminContext');
    const superAdminToken = localStorage.getItem('superAdminToken');
    setShowReturnToAdmin(superAdminContext === 'true' && !!superAdminToken);
  }, []);

  const handleReturnToAdmin = () => {
    // Nettoyer le marqueur de contexte et retourner au dashboard super-admin
    localStorage.removeItem('superAdminContext');
    setLocation('/super-admin');
  };

  // Écouter les changements de localStorage pour synchroniser l'état
  useEffect(() => {
    const handleStorageChange = () => {
      const superAdminContext = localStorage.getItem('superAdminContext');
      const superAdminToken = localStorage.getItem('superAdminToken');
      setShowReturnToAdmin(superAdminContext === 'true' && !!superAdminToken);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleStorageChange);
    };
  }, []);

  const navigation = [
    { name: "Accueil", href: "/", icon: Home },
    { name: "Plateforme Maintenance", href: "/maintenance-platform", icon: LayoutGrid },
    { name: "Engineering Expertise", href: "/engineering-expertise", icon: Database },
    { name: "Équipe Multi-Agent", href: "/multi-agent-team", icon: Users },
    { name: "IMCA — Indice Cognitif", href: "/imca", icon: Brain },
    { name: "Simulation Prospective", href: "/prospective-simulation", icon: Brain },
    { name: "Optimiseur Multi-Actifs", href: "/multi-asset-optimizer", icon: BarChart3 },
    { name: "Journal Cryptographique", href: "/crypto-journal", icon: Shield },
    { name: "Adaptation Fédérée", href: "/federated-adaptation", icon: Brain },
    { name: "Supervision Adaptative", href: "/cognitive-infrastructure", icon: Brain },
    { name: "Diagnostic Hybride", href: "/smart-diagnostic", icon: Database },
    { name: "GMAO Intégrée", href: "/gmao", icon: Settings },
    { name: "Recommandations", href: "/maintenance-recommendations", icon: Sparkles },
    { name: "Insights Prédictifs", href: "/predictive-insights", icon: TrendingUp },
    { name: "Perception IoT", href: "/iot-gamification", icon: BarChart3 },
    { name: "Inventaire", href: "/inventaire", icon: Package },
    { name: "Historique", href: "/historique", icon: History },
    ...(user && ["admin", "director"].includes(user.role || "") ? [{ name: "Permissions", href: "/tenant-permissions", icon: Shield }] : []),
    ...(user && user.role === "admin" ? [{ name: "Santé système", href: "/system-health", icon: Activity }] : []),
    { name: "Documentation", href: "/documentation", icon: FileText },
    { name: "Télécharger", href: "/download", icon: Download },
  ];

  return (
    <nav className="bg-white/10 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50 shadow-lg shadow-blue-500/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25 group-hover:shadow-xl group-hover:shadow-blue-500/40 transition-all duration-300 group-hover:scale-110">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse"></div>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent group-hover:from-purple-600 group-hover:via-pink-600 group-hover:to-blue-600 transition-all duration-500">
                  Maintrix
                </span>
                <span className="text-xs text-gray-500 font-medium tracking-wider uppercase">
                  Supervision Adaptative
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link 
                  key={item.name} 
                  href={item.href}
                  className={`group relative flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                    isActive 
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-700 shadow-lg backdrop-blur-sm border border-blue-200/50' 
                      : 'text-gray-600 hover:text-blue-600 hover:bg-white/20 hover:backdrop-blur-sm hover:shadow-md'
                  }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-xl blur-sm"></div>
                  )}
                  <Icon className={`w-4 h-4 relative z-10 transition-transform duration-300 ${
                    isActive ? 'scale-110' : 'group-hover:scale-110'
                  }`} />
                  <span className={`text-sm font-medium relative z-10 ${
                    isActive ? 'font-semibold' : ''
                  }`}>{item.name}</span>
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Notification Bell */}
            <Link href="/mobile-notifications">
              <button className="relative p-2 rounded-xl text-gray-600 hover:text-blue-600 hover:bg-white/20 transition-all duration-200">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </Link>

            <div className="flex items-center space-x-3 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-700">{user?.firstName || user?.username}</span>
                <span className="text-xs text-gray-500">Utilisateur connecté</span>
              </div>
            </div>
            
            {/* Bouton de retour au super-admin si venant de ce contexte */}
            {showReturnToAdmin && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleReturnToAdmin}
                className="flex items-center space-x-2 bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                title="Retourner à l'interface super-admin"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-xs">Retour Admin</span>
              </Button>
            )}
            
            {/* Lien d'administration discret */}
            {!showReturnToAdmin && (
              <Link href="/admin-login">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="flex items-center space-x-2 text-gray-500 hover:text-blue-600"
                  title="Accès administration plateforme"
                >
                  <Shield className="w-4 h-4" />
                  <span className="text-xs">Admin</span>
                </Button>
              </Link>
            )}
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="flex items-center space-x-2 text-gray-600 hover:text-red-600 border-white/20 bg-white/10 backdrop-blur-sm hover:bg-red-50/50 hover:border-red-300/50 transition-all duration-300 shadow-lg hover:shadow-red-200/50"
            >
              <LogOut className="w-4 h-4" />
              <span>Déconnexion</span>
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
              className="p-2"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden bg-white/90 backdrop-blur-lg border-t border-white/30 shadow-xl">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link 
                  key={item.name} 
                  href={item.href}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors block ${
                    isActive 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
            
            {/* Mobile User Info */}
            <div className="border-t border-gray-200 pt-3 mt-3">
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span className="text-sm text-gray-600">
                    {user?.firstName || user?.username}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {/* Bouton de retour au super-admin si venant de ce contexte */}
                  {showReturnToAdmin && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        handleReturnToAdmin();
                        setIsOpen(false);
                      }}
                      className="flex items-center space-x-1 bg-purple-50 text-purple-700"
                      title="Retourner à l'interface super-admin"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span className="text-xs">Retour Admin</span>
                    </Button>
                  )}
                  
                  {/* Lien d'administration discret */}
                  {!showReturnToAdmin && (
                    <Link href="/admin-login">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex items-center space-x-1"
                        title="Administration"
                        onClick={() => setIsOpen(false)}
                      >
                        <Shield className="w-4 h-4" />
                        <span className="text-xs">Admin</span>
                      </Button>
                    </Link>
                  )}
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleLogout}
                    className="flex items-center space-x-1"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Déconnexion</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default ModernNavigation;
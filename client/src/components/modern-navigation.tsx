import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
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
  ArrowLeft
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function ModernNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [showReturnToAdmin, setShowReturnToAdmin] = useState(false);

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
    window.location.href = '/super-admin';
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
    { name: "Accueil", href: "/", icon: BarChart3 },
    { name: "Diagnostic IA", href: "/smart-diagnostic", icon: Brain },
    { name: "GMAO", href: "/gmao", icon: Settings },
    { name: "Configuration ERP", href: "/erp-configuration", icon: Building },
    { name: "Documentation", href: "/documentation", icon: FileText },
    { name: "Formation", href: "/training", icon: Users },
    // ✅ MIGRATION COMPLÈTE : Administration SaaS déplacée vers interface super-admin séparée (/admin-login)
  ];

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Smart GMAO
                </span>
                {/* ✅ ENTERPRISE AUTH : Plus de mode démonstration */}
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link 
                  key={item.name} 
                  href={item.href}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <User className="w-4 h-4" />
              <span>{user?.firstName || user?.username}</span>
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
              className="flex items-center space-x-2"
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
        <div className="md:hidden bg-white border-t border-gray-200">
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
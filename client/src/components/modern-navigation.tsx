import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  LayoutGrid,
  GitCommitHorizontal,
  Sun,
  Moon,
  ChevronDown
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/use-theme";

export function ModernNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [showReturnToAdmin, setShowReturnToAdmin] = useState(false);
  const { theme, toggleTheme } = useTheme();

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

  // La barre horizontale ne peut pas accueillir ~20 libellés complets sans déborder de l'écran
  // (constaté à partir du 10e élément, "Adaptation Fédérée"). Plutôt qu'un simple scroll ou un
  // retour à la ligne, les éléments sont regroupés par thématique sous des menus déroulants —
  // seuls 2 liens directs (Accueil, Plateforme Maintenance) et 5 déclencheurs de groupe restent
  // sur la barre, quel que soit le nombre total de modules.
  const standaloneLinks = [
    { name: "Accueil", href: "/", icon: Home },
    { name: "Plateforme", href: "/maintenance-platform", icon: LayoutGrid },
  ];

  const navGroups: { label: string; icon: typeof Home; items: { name: string; href: string; icon: typeof Home }[] }[] = [
    {
      // La GMAO elle-même reste accessible via "Plateforme" (qui l'intègre comme un de ses
      // 8 domaines) — pas de lien direct redondant ici, seulement les outils d'exploitation
      // qui n'ont pas leur place sur le hub Plateforme.
      label: "Exploitation",
      icon: Settings,
      items: [
        { name: "Équipe Multi-Agent", href: "/multi-agent-team", icon: Users },
        { name: "Cycle de vie ISO 55000", href: "/equipment-lifecycle", icon: GitCommitHorizontal },
        { name: "Inventaire", href: "/inventaire", icon: Package },
        { name: "Historique", href: "/historique", icon: History },
      ],
    },
    {
      label: "IA & Diagnostic",
      icon: Brain,
      items: [
        { name: "Diagnostic Hybride", href: "/smart-diagnostic", icon: Database },
        { name: "Recommandations", href: "/maintenance-recommendations", icon: Sparkles },
        { name: "Insights Prédictifs", href: "/predictive-insights", icon: TrendingUp },
        { name: "Engineering Expertise", href: "/engineering-expertise", icon: Database },
        { name: "IMCA — Indice Cognitif", href: "/imca", icon: Brain },
        { name: "Simulation Prospective", href: "/prospective-simulation", icon: Brain },
        { name: "Supervision Adaptative", href: "/cognitive-infrastructure", icon: Brain },
        { name: "Adaptation Fédérée", href: "/federated-adaptation", icon: Brain },
      ],
    },
    {
      label: "Optimisation",
      icon: BarChart3,
      items: [
        { name: "Optimiseur Multi-Actifs", href: "/multi-asset-optimizer", icon: BarChart3 },
        { name: "Perception IoT", href: "/iot-gamification", icon: BarChart3 },
      ],
    },
    {
      label: "Sécurité",
      icon: Shield,
      items: [
        { name: "Journal Cryptographique", href: "/crypto-journal", icon: Shield },
        ...(user && ["admin", "director"].includes(user.role || "") ? [{ name: "Permissions", href: "/tenant-permissions", icon: Shield }] : []),
        ...(user && user.role === "admin" ? [{ name: "Santé système", href: "/system-health", icon: Activity }] : []),
      ],
    },
    {
      label: "Ressources",
      icon: FileText,
      items: [
        { name: "Documentation", href: "/documentation", icon: FileText },
        { name: "Télécharger", href: "/download", icon: Download },
      ],
    },
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

          {/* Desktop Navigation — overflow-x-auto est un filet de sécurité, pas la stratégie
              principale : à 1280px de large, même les 7 déclencheurs regroupés + le bloc
              utilisateur compact ne tiennent pas toujours exactement : ce conteneur défile
              alors dans sa propre largeur allouée plutôt que de déborder de la page entière
              (le bug d'origine). scrollbar-thin + la classe utilitaire ci-dessous masquent la
              barre de défilement tant qu'elle n'est pas nécessaire visuellement. */}
          <div
            className="hidden md:flex items-center min-w-0 overflow-x-auto [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            {standaloneLinks.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group relative flex items-center space-x-1.5 px-2 py-2.5 rounded-xl transition-all duration-300 whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-700 shadow-lg backdrop-blur-sm border border-blue-200/50'
                      : 'text-gray-600 hover:text-blue-600 hover:bg-white/20 hover:backdrop-blur-sm hover:shadow-md'
                  }`}
                >
                  <Icon className={`w-4 h-4 relative z-10 transition-transform duration-300 ${
                    isActive ? 'scale-110' : 'group-hover:scale-110'
                  }`} />
                  <span className={`text-sm font-medium relative z-10 ${isActive ? 'font-semibold' : ''}`}>{item.name}</span>
                </Link>
              );
            })}

            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              const isGroupActive = group.items.some((i) => i.href === location);
              return (
                <DropdownMenu key={group.label}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`group relative flex items-center space-x-1 px-2 py-2.5 rounded-xl transition-all duration-300 whitespace-nowrap shrink-0 outline-none ${
                        isGroupActive
                          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-700 shadow-lg backdrop-blur-sm border border-blue-200/50'
                          : 'text-gray-600 hover:text-blue-600 hover:bg-white/20 hover:backdrop-blur-sm hover:shadow-md'
                      }`}
                    >
                      <GroupIcon className={`w-4 h-4 transition-transform duration-300 ${isGroupActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                      <span className={`text-sm font-medium ${isGroupActive ? 'font-semibold' : ''}`}>{group.label}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-64">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = location === item.href;
                      return (
                        <DropdownMenuItem key={item.name} asChild className={isActive ? 'bg-accent font-medium' : ''}>
                          <Link href={item.href} className="flex items-center gap-2.5 cursor-pointer">
                            <Icon className="w-4 h-4 text-gray-500" />
                            <span>{item.name}</span>
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </div>

          {/* User Menu — volontairement compact (icônes + tooltips plutôt que boutons texte) :
              ce bloc et la nav se disputent le même espace restreint une fois le logo posé. */}
          <div className="hidden md:flex items-center space-x-1.5 shrink-0">
            {/* Bascule thème clair/sombre */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-gray-600 hover:text-blue-600 hover:bg-white/20 transition-all duration-200 dark:text-gray-300 dark:hover:text-blue-400"
              title={theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
              aria-label={theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notification Bell */}
            <Link href="/mobile-notifications">
              <button className="relative p-2 rounded-xl text-gray-600 hover:text-blue-600 hover:bg-white/20 transition-all duration-200" title="Notifications" aria-label="Notifications">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </Link>

            <div className="flex items-center space-x-2 pl-2 pr-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg" title="Utilisateur connecté">
              <div className="w-7 h-7 shrink-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-700 max-w-28 truncate">{user?.firstName || user?.username}</span>
            </div>

            {/* Bouton de retour au super-admin si venant de ce contexte */}
            {showReturnToAdmin && (
              <button
                onClick={handleReturnToAdmin}
                className="p-2 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 transition-all duration-200"
                title="Retourner à l'interface super-admin"
                aria-label="Retourner à l'interface super-admin"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            {/* Lien d'administration discret */}
            {!showReturnToAdmin && (
              <Link href="/admin-login">
                <button
                  className="p-2 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-white/20 transition-all duration-200"
                  title="Accès administration plateforme"
                  aria-label="Accès administration plateforme"
                >
                  <Shield className="w-4 h-4" />
                </button>
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-gray-600 hover:text-red-600 hover:bg-red-50/50 transition-all duration-200"
              title="Déconnexion"
              aria-label="Déconnexion"
            >
              <LogOut className="w-4 h-4" />
            </button>
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
        <div className="md:hidden bg-white/90 backdrop-blur-lg border-t border-white/30 shadow-xl max-h-[75vh] overflow-y-auto">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {standaloneLinks.map((item) => {
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

            {navGroups.map((group) => (
              <div key={group.label} className="pt-3 mt-2 border-t border-gray-100 first:border-t-0 first:mt-0 first:pt-0">
                <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <group.icon className="w-3.5 h-3.5" />
                  {group.label}
                </p>
                {group.items.map((item) => {
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
              </div>
            ))}

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
                  {/* Bascule thème clair/sombre */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleTheme}
                    className="flex items-center space-x-1"
                    title={theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
                  >
                    {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </Button>

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
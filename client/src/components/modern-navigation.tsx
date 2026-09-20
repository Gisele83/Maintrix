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
    <nav className="sticky top-0 z-50 bg-paper border-b border-rule dark:bg-ink dark:border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Le logo de la marque, et rien d'autre. La version précédente
                empilait une tuile en dégradé tricolore, une pastille verte
                clignotante et un texte en dégradé animé : trois effets pour dire
                une chose que le logo dit seul. */}
            <Link href="/" className="flex items-center gap-3" aria-label="Maintrix — accueil">
              <img
                src="/logo-maintrix.png"
                alt="Maintrix"
                width={640}
                height={213}
                className="h-8 w-auto dark:hidden"
              />
              <img
                src="/logo-maintrix-clair.png"
                alt="Maintrix"
                width={640}
                height={213}
                className="hidden h-8 w-auto dark:block"
              />
              <span className="hidden lg:inline font-mono text-eyebrow uppercase tracking-wider text-ink-mute dark:text-paper/60">
                Supervision industrielle
              </span>
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
                  className={`flex items-center gap-1.5 px-3 h-16 border-b-2 text-sm transition-colors whitespace-nowrap shrink-0 ${
                    isActive ? 'text-ink border-signal dark:text-paper' : 'text-ink-soft border-transparent hover:text-ink hover:border-rule dark:text-paper/70 dark:hover:text-paper'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className={isActive ? 'font-medium' : ''}>{item.name}</span>
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
                      className={`flex items-center gap-1.5 px-3 h-16 border-b-2 text-sm outline-none transition-colors whitespace-nowrap shrink-0 ${
                        isGroupActive ? 'text-ink border-signal dark:text-paper' : 'text-ink-soft border-transparent hover:text-ink hover:border-rule dark:text-paper/70 dark:hover:text-paper'
                      }`}
                    >
                      <GroupIcon className="w-4 h-4" />
                      <span className={isGroupActive ? 'font-medium' : ''}>{group.label}</span>
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
              className="p-2 text-ink-soft hover:text-ink hover:bg-paper-deep transition-colors dark:text-paper/70 dark:hover:text-paper dark:hover:bg-white/10"
              title={theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
              aria-label={theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notification Bell */}
            <Link href="/mobile-notifications">
              <button className="relative p-2 text-ink-soft hover:text-ink hover:bg-paper-deep transition-colors dark:text-paper/70 dark:hover:text-paper dark:hover:bg-white/10" title="Notifications" aria-label="Notifications">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-signal-deep text-white font-mono text-[10px] leading-4 text-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </Link>

            <div className="flex items-center gap-2 pl-3 border-l border-rule dark:border-white/10" title="Utilisateur connecté">
              <User className="w-4 h-4 text-ink-mute dark:text-paper/60" />
              <span className="text-sm text-ink max-w-28 truncate dark:text-paper">{user?.firstName || user?.username}</span>
            </div>

            {/* Bouton de retour au super-admin si venant de ce contexte */}
            {showReturnToAdmin && (
              <button
                onClick={handleReturnToAdmin}
                className="p-2 text-signal-deep hover:bg-paper-deep transition-colors dark:text-signal-light dark:hover:bg-white/10"
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
                  className="p-2 text-ink-mute hover:text-ink hover:bg-paper-deep transition-colors dark:text-paper/60 dark:hover:text-paper dark:hover:bg-white/10"
                  title="Accès administration plateforme"
                  aria-label="Accès administration plateforme"
                >
                  <Shield className="w-4 h-4" />
                </button>
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="p-2 text-ink-soft hover:text-ink hover:bg-paper-deep transition-colors dark:text-paper/70 dark:hover:text-paper dark:hover:bg-white/10"
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
        <div className="md:hidden bg-paper border-t border-rule max-h-[75vh] overflow-y-auto dark:bg-ink dark:border-white/10">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {standaloneLinks.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 border-l-2 transition-colors ${
                    isActive
                      ? 'border-signal bg-paper-deep text-ink dark:bg-white/5 dark:text-paper'
                      : 'border-transparent text-ink-soft hover:bg-paper-deep dark:text-paper/70 dark:hover:bg-white/5'
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}

            {navGroups.map((group) => (
              <div key={group.label} className="pt-3 mt-2 border-t border-rule first:border-t-0 first:mt-0 first:pt-0 dark:border-white/10">
                <p className="px-3 pb-1 font-mono text-eyebrow uppercase tracking-wider text-ink-mute flex items-center gap-1.5 dark:text-paper/50">
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
                      className={`flex items-center gap-3 px-3 py-2.5 border-l-2 transition-colors ${
                        isActive
                          ? 'border-signal bg-paper-deep text-ink dark:bg-white/5 dark:text-paper'
                          : 'border-transparent text-ink-soft hover:bg-paper-deep dark:text-paper/70 dark:hover:bg-white/5'
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
            <div className="border-t border-rule pt-3 mt-3 dark:border-white/10">
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
                      className="flex items-center gap-1 text-signal-deep"
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
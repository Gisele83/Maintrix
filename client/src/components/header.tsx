import { Settings, User, Wrench, Factory, Home, Shield, Bot, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import { t } from "@/lib/i18n";
import { Link, useLocation } from "wouter";

export function Header() {
  const { language, toggleLanguage } = useLanguage();
  const [location] = useLocation();

  return (
    <header className="bg-carbon-gray-90 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <Wrench className="text-carbon-blue text-2xl" />
              <h1 className="text-xl font-semibold">{t("appTitle", language)}</h1>
            </div>
            <span className="text-carbon-gray-50 text-sm hidden sm:block">
              {t("appSubtitle", language)}
            </span>
          </div>
          
          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center space-x-2 transition-all duration-200 ${
                  location === "/" 
                    ? "bg-carbon-blue/20 text-carbon-blue" 
                    : "text-carbon-gray-30 hover:text-white hover:bg-carbon-gray-70"
                }`}
              >
                <Home className="w-4 h-4" />
                <span>Smart Diagnostic</span>
              </Button>
            </Link>
            <Link href="/gmao">
              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center space-x-2 transition-all duration-200 ${
                  location === "/gmao" 
                    ? "bg-carbon-blue/20 text-carbon-blue" 
                    : "text-carbon-gray-30 hover:text-white hover:bg-carbon-gray-70"
                }`}
              >
                <Factory className="w-4 h-4" />
                <span>Smart GMAO</span>
              </Button>
            </Link>
            <Link href="/access-management">
              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center space-x-2 transition-all duration-200 ${
                  location === "/access-management" 
                    ? "bg-carbon-blue/20 text-carbon-blue" 
                    : "text-carbon-gray-30 hover:text-white hover:bg-carbon-gray-70"
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Accès</span>
              </Button>
            </Link>
            {/* ✅ MIGRATION COMPLÈTE : Sécurité intégrée dans enterprise auth */}
            <Link href="/support-chatbot">
              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center space-x-2 transition-all duration-200 ${
                  location === "/support-chatbot" 
                    ? "bg-carbon-blue/20 text-carbon-blue" 
                    : "text-carbon-gray-30 hover:text-white hover:bg-carbon-gray-70"
                }`}
              >
                <Bot className="w-4 h-4" />
                <span>Assistant</span>
              </Button>
            </Link>
            <Link href="/payment-security">
              <Button
                variant="ghost"
                size="sm"
                className={`flex items-center space-x-2 transition-all duration-200 ${
                  location === "/payment-security" 
                    ? "bg-carbon-blue/20 text-carbon-blue" 
                    : "text-carbon-gray-30 hover:text-white hover:bg-carbon-gray-70"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Paiements</span>
              </Button>
            </Link>
          </nav>
          
          <div className="flex items-center space-x-4">
            {/* Language Toggle */}
            <div className="flex bg-carbon-gray-70 rounded-md p-1">
              <Button
                variant="ghost"
                size="sm"
                className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${
                  language === "fr" 
                    ? "bg-carbon-blue text-white" 
                    : "text-carbon-gray-20 hover:text-white"
                }`}
                onClick={() => language !== "fr" && toggleLanguage()}
              >
                FR
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${
                  language === "en" 
                    ? "bg-carbon-blue text-white" 
                    : "text-carbon-gray-20 hover:text-white"
                }`}
                onClick={() => language !== "en" && toggleLanguage()}
              >
                EN
              </Button>
            </div>
            
            {/* User Menu */}
            <div className="flex items-center space-x-2">
              <User className="text-carbon-gray-20 text-xl" />
              <span className="text-sm hidden md:block">{t("technician", language)}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

import { useState, useEffect } from "react";
import { Language } from "@/lib/i18n";

export function useLanguage() {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("smdiagfix-language");
    return (saved as Language) || "fr";
  });

  useEffect(() => {
    localStorage.setItem("smdiagfix-language", language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === "fr" ? "en" : "fr");
  };

  return { language, setLanguage, toggleLanguage };
}

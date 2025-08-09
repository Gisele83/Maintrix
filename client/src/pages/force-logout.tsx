import { useEffect } from "react";

export default function ForceLogout() {
  useEffect(() => {
    // Clear all authentication data
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_data");
    sessionStorage.clear();
    
    // Force page reload to login page
    setTimeout(() => {
      window.location.href = "/login";
    }, 1000);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-700">Déconnexion en cours...</h2>
        <p className="text-gray-500">Redirection vers la page de connexion...</p>
      </div>
    </div>
  );
}
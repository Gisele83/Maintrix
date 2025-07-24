import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus, Loader2 } from "lucide-react";

export function ValidationDemoButton() {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const createDemoData = async () => {
    setIsCreating(true);
    try {
      const result = await apiRequest("/api/create-validation-demo", { 
        method: "POST" 
      });
      
      if (result.success) {
        toast({
          title: "Données de démonstration créées",
          description: "2 ordres de travail et 2 bons de commande sont maintenant en attente de validation",
          variant: "default",
        });
        
        // Refresh the page to show new data
        window.location.reload();
      } else {
        throw new Error(result.error || "Erreur inconnue");
      }
    } catch (error) {
      console.error("Error creating demo data:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer les données de démonstration",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Button 
      onClick={createDemoData}
      disabled={isCreating}
      className="bg-blue-600 hover:bg-blue-700"
    >
      {isCreating ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Création...
        </>
      ) : (
        <>
          <Plus className="h-4 w-4 mr-2" />
          Créer Données Démo
        </>
      )}
    </Button>
  );
}
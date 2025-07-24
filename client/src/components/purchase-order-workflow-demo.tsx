import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, FileText, Check, Eye, Printer, Building, User, Crown } from "lucide-react";

const WORKFLOW_STEPS = [
  {
    id: 1,
    role: "Service Achat",
    title: "Création du Bon de Commande",
    description: "Le service achat initie le bon de commande avec les documents justificatifs",
    icon: Building,
    color: "bg-blue-500",
    status: "completed"
  },
  {
    id: 2,
    role: "Chef de Service Utilisateur",
    title: "Validation Niveau 1",
    description: "Vérification des besoins et validation technique",
    icon: User,
    color: "bg-yellow-500",
    status: "pending"
  },
  {
    id: 3,
    role: "Directeur Général",
    title: "Validation Niveau 2",
    description: "Validation finale et vérification des documents justificatifs",
    icon: Crown,
    color: "bg-purple-500",
    status: "waiting"
  },
  {
    id: 4,
    role: "Service Achat",
    title: "Impression & Envoi",
    description: "Récupération du bon validé pour impression et envoi au fournisseur",
    icon: Printer,
    color: "bg-green-500",
    status: "waiting"
  }
];

interface PurchaseOrderWorkflowDemoProps {
  currentUserRole: string;
  validationLevel: number;
}

export default function PurchaseOrderWorkflowDemo({ 
  currentUserRole, 
  validationLevel 
}: PurchaseOrderWorkflowDemoProps) {
  const [currentStep, setCurrentStep] = useState(2); // Chef de Service validation pending
  const { toast } = useToast();

  const handleStepAction = (stepId: number) => {
    if (stepId === currentStep) {
      // Simulate validation
      if (stepId === 2) {
        setCurrentStep(3);
        toast({
          title: "Validation Chef de Service",
          description: "Bon de commande validé par le Chef de Service - Envoyé au Directeur Général",
        });
      } else if (stepId === 3) {
        setCurrentStep(4);
        toast({
          title: "Validation Directeur Général",
          description: "Bon de commande validé par le Directeur - Retour au Service Achat pour impression",
        });
      } else if (stepId === 4) {
        setCurrentStep(5);
        toast({
          title: "Processus Terminé",
          description: "Bon de commande imprimé et envoyé au fournisseur",
        });
      }
    }
  };

  const getStepStatus = (stepId: number) => {
    if (stepId < currentStep) return "completed";
    if (stepId === currentStep) return "active";
    return "waiting";
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Workflow de Validation des Bons de Commande
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Utilisateur: {currentUserRole}</Badge>
          <Badge variant="outline">Niveau: {validationLevel}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {WORKFLOW_STEPS.map((step, index) => {
            const Icon = step.icon;
            const status = getStepStatus(step.id);
            const isCurrentUser = step.role === currentUserRole && step.id === currentStep;
            
            return (
              <div key={step.id} className="flex items-center gap-4">
                <div className={`
                  relative flex items-center justify-center w-12 h-12 rounded-full
                  ${status === "completed" ? "bg-green-500 text-white" : 
                    status === "active" ? step.color + " text-white animate-pulse" : 
                    "bg-gray-200 text-gray-400"}
                `}>
                  {status === "completed" ? (
                    <Check className="h-6 w-6" />
                  ) : (
                    <Icon className="h-6 w-6" />
                  )}
                  {step.id === 1 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-xs text-white font-bold">1</span>
                    </div>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{step.title}</h4>
                    <Badge 
                      variant={status === "completed" ? "default" : status === "active" ? "secondary" : "outline"}
                      className={status === "active" ? "bg-yellow-100 text-yellow-800" : ""}
                    >
                      {step.role}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{step.description}</p>
                  
                  {isCurrentUser && (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleStepAction(step.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Valider
                      </Button>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Eye className="h-4 w-4 mr-1" />
                            Voir le bon
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Bon de Commande PO-2025-001</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <h5 className="font-medium mb-2">Détails du Bon de Commande</h5>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><strong>Numéro:</strong> PO-2025-001</div>
                                <div><strong>Type:</strong> Pièces de rechange</div>
                                <div><strong>Fournisseur:</strong> Roulement Industriel SA</div>
                                <div><strong>Montant:</strong> 654.00 €</div>
                              </div>
                            </div>
                            
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <h5 className="font-medium mb-2">Documents Justificatifs</h5>
                              <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  <span>Demande d'achat DA-2025-001.pdf</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  <span>Devis_Roulement_Industriel.pdf</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  <span>Spécifications_techniques.pdf</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex justify-end">
                              <Button 
                                onClick={() => window.open('/api/purchase-orders/1/letterhead', '_blank')}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                Voir avec papier en-tête
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
                
                {index < WORKFLOW_STEPS.length - 1 && (
                  <ArrowRight className="h-5 w-5 text-gray-400 ml-4" />
                )}
              </div>
            );
          })}
        </div>
        
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h5 className="font-medium text-amber-800 mb-2">Processus de Validation</h5>
          <div className="text-sm text-amber-700">
            <p><strong>Étape actuelle:</strong> {WORKFLOW_STEPS.find(s => s.id === currentStep)?.title || "Processus terminé"}</p>
            <p><strong>Responsable:</strong> {WORKFLOW_STEPS.find(s => s.id === currentStep)?.role || "Aucun"}</p>
            {currentStep <= 4 && (
              <p className="mt-2 font-medium">
                Le bon de commande doit être validé à chaque niveau avant de passer au suivant.
                Une fois validé par le Directeur Général, il retourne au Service Achat pour impression.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
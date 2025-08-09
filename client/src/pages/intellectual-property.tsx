import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  FileText, 
  Download, 
  CheckCircle2, 
  Clock, 
  Euro,
  Building,
  Gavel,
  Lock,
  AlertTriangle,
  Calendar,
  Target,
  Book,
  FileCheck
} from "lucide-react";

interface ProtectionStep {
  id: string;
  title: string;
  description: string;
  status: "completed" | "in-progress" | "pending";
  priority: "high" | "medium" | "low";
  deadline: string;
  cost: string;
  documents: string[];
}

interface DocumentTemplate {
  id: string;
  title: string;
  description: string;
  type: "dossier" | "formulaire" | "guide";
  category: string;
  pages: number;
  lastUpdate: string;
}

export default function IntellectualProperty() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const { toast } = useToast();

  const protectionSteps: ProtectionStep[] = [
    {
      id: "trademark",
      title: "Dépôt de Marque INPI",
      description: "Protection de la marque 'Smart GMAO DiagFix' en France",
      status: "pending",
      priority: "high",
      deadline: "2025-02-15",
      cost: "330€",
      documents: ["Logo officiel", "Formulaire M1", "Justificatifs identité"]
    },
    {
      id: "software",
      title: "Dépôt de Logiciel",
      description: "Protection du code source et documentation technique",
      status: "pending",
      priority: "high",
      deadline: "2025-02-10",
      cost: "60€",
      documents: ["Code source", "Documentation", "Formulaire DL1"]
    },
    {
      id: "patent-research",
      title: "Recherche Antériorités",
      description: "Étude de brevetabilité des innovations techniques",
      status: "in-progress",
      priority: "medium",
      deadline: "2025-03-15",
      cost: "520€",
      documents: ["Rapport technique", "Analyse concurrence"]
    },
    {
      id: "trade-secrets",
      title: "Protection Secrets d'Affaires",
      description: "Mise en place mesures de confidentialité",
      status: "completed",
      priority: "high",
      deadline: "2025-01-30",
      cost: "0€",
      documents: ["NDAs", "Procédures sécurité", "Chiffrement données"]
    }
  ];

  const documentTemplates: DocumentTemplate[] = [
    {
      id: "main-dossier",
      title: "Dossier Complet INPI",
      description: "Documentation complète pour tous les dépôts INPI",
      type: "dossier",
      category: "Principal",
      pages: 25,
      lastUpdate: "24/01/2025"
    },
    {
      id: "action-guide",
      title: "Guide d'Actions Concrètes",
      description: "Timeline et actions immédiates à entreprendre",
      type: "guide",
      category: "Opérationnel",
      pages: 12,
      lastUpdate: "24/01/2025"
    },
    {
      id: "forms-templates",
      title: "Templates Formulaires INPI",
      description: "Formulaires pré-remplis M1, DL1, DA1",
      type: "formulaire",
      category: "Administratif",
      pages: 8,
      lastUpdate: "24/01/2025"
    }
  ];

  const handleDownloadDocument = (docId: string, title: string) => {
    toast({
      title: "Téléchargement démarré",
      description: `Téléchargement de: ${title}`,
    });

    let filename = "";
    let content = "";

    switch(docId) {
      case "main-dossier":
        filename = "DOSSIER_PROPRIETE_INTELLECTUELLE_INPI.md";
        content = `# Dossier de Protection de la Propriété Intellectuelle – Smart GMAO DiagFix

Ce document contient la documentation complète pour la protection de la propriété intellectuelle de Smart GMAO DiagFix selon les exigences INPI.

## Contenu:
1. Dépôt de Marque (Classes 9, 42, 37)
2. Dépôt de Logiciel et Œuvre
3. Étude de Brevet (optionnel recommandé)
4. Protection Secrets d'Affaires
5. Documentation complémentaire
6. Procédure de dépôt et budget

Voir le fichier complet: DOSSIER_PROPRIETE_INTELLECTUELLE_INPI.md`;
        break;
        
      case "action-guide":
        filename = "GUIDE_PROTECTION_PI_SMART_GMAO_DIAGFIX.md";
        content = `# Guide de Protection de la Propriété Intellectuelle - Actions Concrètes

## Actions Immédiates:
- Finaliser logo officiel Smart GMAO DiagFix
- Vérifier disponibilité marque
- Constituer dossiers INPI
- Contacter conseil PI spécialisé

## Budget: 4000-5000€
## Timeline: 6 mois pour protection complète

Voir le guide complet: GUIDE_PROTECTION_PI_SMART_GMAO_DIAGFIX.md`;
        break;
        
      case "forms-templates":
        filename = "TEMPLATE_FORMULAIRES_INPI.md";
        content = `# Templates Formulaires INPI - Smart GMAO DiagFix

## Formulaires inclus:
- M1: Dépôt de Marque
- DL1: Dépôt de Logiciel
- DA1: Dépôt de Brevet (si applicable)

## Informations pré-remplies:
- Titulaire: Dr. Gisèle Béatrice Sonfack
- Marque: Smart GMAO DiagFix
- Classes: 9, 42, 37

Voir les templates complets: TEMPLATE_FORMULAIRES_INPI.md`;
        break;
    }

    const element = document.createElement('a');
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "completed": return "bg-green-100 text-green-800";
      case "in-progress": return "bg-blue-100 text-blue-800";
      case "pending": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case "high": return "destructive";
      case "medium": return "outline";
      case "low": return "secondary";
      default: return "outline";
    }
  };

  const completedSteps = protectionSteps.filter(step => step.status === "completed").length;
  const progressPercentage = (completedSteps / protectionSteps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Propriété Intellectuelle
          </h1>
          <p className="text-gray-600 text-lg">
            Protection et valorisation de Smart GMAO DiagFix
          </p>
        </div>

        {/* Progress Overview */}
        <Card className="mb-8 border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span>Progression Protection</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Avancement global</span>
                <span className="text-sm text-muted-foreground">{completedSteps}/{protectionSteps.length} étapes</span>
              </div>
              <Progress value={progressPercentage} className="h-3" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{completedSteps}</div>
                  <div className="text-sm text-green-600">Terminées</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">1</div>
                  <div className="text-sm text-blue-600">En cours</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">2</div>
                  <div className="text-sm text-orange-600">En attente</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <Shield className="w-4 h-4" />
              <span>Vue d'ensemble</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>Planning</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Documents</span>
            </TabsTrigger>
            <TabsTrigger value="legal" className="flex items-center space-x-2">
              <Gavel className="w-4 h-4" />
              <span>Juridique</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {protectionSteps.map((step) => (
                <Card key={step.id} className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{step.title}</CardTitle>
                      <Badge variant={getPriorityColor(step.priority)}>
                        {step.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(step.status)}>
                        {step.status === "completed" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {step.status === "in-progress" && <Clock className="w-3 h-3 mr-1" />}
                        {step.status === "pending" && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {step.status === "completed" ? "Terminé" : 
                         step.status === "in-progress" ? "En cours" : "En attente"}
                      </Badge>
                      <Badge variant="outline" className="flex items-center space-x-1">
                        <Euro className="w-3 h-3" />
                        <span>{step.cost}</span>
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">{step.description}</p>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 mr-2" />
                        Échéance: {step.deadline}
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Documents requis:</div>
                        <div className="flex flex-wrap gap-1">
                          {step.documents.map((doc, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {doc}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span>Calendrier de Protection</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  <div className="border-l-2 border-blue-200 pl-6 relative">
                    <div className="absolute -left-2 top-0 w-4 h-4 bg-blue-600 rounded-full"></div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-blue-600">Phase 1 - Actions Immédiates</h3>
                      <p className="text-sm text-muted-foreground">Semaines 1-2 (25 Jan - 7 Fév 2025)</p>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• Finalisation logo et éléments graphiques</li>
                        <li>• Vérification disponibilité marque</li>
                        <li>• Contact conseil PI spécialisé</li>
                        <li>• Compilation documentation technique</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="border-l-2 border-orange-200 pl-6 relative">
                    <div className="absolute -left-2 top-0 w-4 h-4 bg-orange-500 rounded-full"></div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-orange-600">Phase 2 - Dépôts Prioritaires</h3>
                      <p className="text-sm text-muted-foreground">Semaines 3-4 (8-21 Fév 2025)</p>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• Dépôt marque "Smart GMAO DiagFix" (3 classes)</li>
                        <li>• Dépôt logiciel code source + documentation</li>
                        <li>• Mise en place accords confidentialité</li>
                      </ul>
                    </div>
                  </div>

                  <div className="border-l-2 border-purple-200 pl-6 relative">
                    <div className="absolute -left-2 top-0 w-4 h-4 bg-purple-500 rounded-full"></div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-purple-600">Phase 3 - Étude Brevet</h3>
                      <p className="text-sm text-muted-foreground">Mois 2-3 (Mars-Avril 2025)</p>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• Recherche antériorités approfondie</li>
                        <li>• Évaluation brevetabilité avec expert</li>
                        <li>• Rédaction revendications techniques</li>
                        <li>• Analyse coût/bénéfice protection</li>
                      </ul>
                    </div>
                  </div>

                  <div className="border-l-2 border-green-200 pl-6 relative">
                    <div className="absolute -left-2 top-0 w-4 h-4 bg-green-500 rounded-full"></div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-green-600">Phase 4 - Protection Avancée</h3>
                      <p className="text-sm text-muted-foreground">Mois 4-6 (Mai-Juillet 2025)</p>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• Dépôt brevet si validé</li>
                        <li>• Étude extension territoriale (UE, US)</li>
                        <li>• Renforcement secrets d'affaires</li>
                        <li>• Mise en place veille concurrentielle</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              {documentTemplates.map((doc) => (
                <Card key={doc.id} className="border-0 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{doc.title}</CardTitle>
                        <Badge variant="outline">{doc.category}</Badge>
                      </div>
                      <div className="text-right">
                        {doc.type === "dossier" && <FileText className="w-6 h-6 text-blue-600" />}
                        {doc.type === "formulaire" && <FileCheck className="w-6 h-6 text-green-600" />}
                        {doc.type === "guide" && <Book className="w-6 h-6 text-purple-600" />}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm mb-4">{doc.description}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                      <span>{doc.pages} pages</span>
                      <span>MAJ: {doc.lastUpdate}</span>
                    </div>
                    <Button 
                      onClick={() => handleDownloadDocument(doc.id, doc.title)}
                      className="w-full"
                      size="sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="legal" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Building className="w-5 h-5 text-blue-600" />
                    <span>Protection par Marque</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">Smart GMAO DiagFix</h4>
                    <p className="text-sm text-muted-foreground mb-2">Marque verbale et figurative</p>
                    <div className="space-y-1">
                      <Badge variant="outline">Classe 9 - Logiciels</Badge>
                      <Badge variant="outline">Classe 42 - Services SaaS</Badge>
                      <Badge variant="outline">Classe 37 - Maintenance</Badge>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Coût estimé:</span>
                      <span className="font-medium">330€</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Durée protection:</span>
                      <span className="font-medium">10 ans (renouvelable)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Lock className="w-5 h-5 text-green-600" />
                    <span>Secrets d'Affaires</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">Éléments Protégés</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Modèles IA (9 algorithmes ensemble)</li>
                      <li>• Base historique 120 cas industriels</li>
                      <li>• Algorithmes de diagnostic propriétaires</li>
                      <li>• Protocoles intégration APIs</li>
                      <li>• Logique métier interface unifiée</li>
                    </ul>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Coût protection:</span>
                      <span className="font-medium">Intégré</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Durée protection:</span>
                      <span className="font-medium">Illimitée</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-lg md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Gavel className="w-5 h-5 text-purple-600" />
                    <span>Innovations Brevetables</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-semibold mb-2">Système d'Ensemble ML</h4>
                      <p className="text-sm text-muted-foreground">
                        Combinaison unique de 9 algorithmes avec consensus pondéré pour diagnostic industriel avec 98% de précision.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Interface Unifiée GMAO + IA</h4>
                      <p className="text-sm text-muted-foreground">
                        Architecture modulaire permettant basculement transparent entre gestion maintenance et diagnostic intelligent.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Mode Offline-First Mobile</h4>
                      <p className="text-sm text-muted-foreground">
                        Synchronisation bidirectionnelle intelligente avec résolution automatique de conflits pour environnements industriels.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">Apprentissage Continu</h4>
                      <p className="text-sm text-muted-foreground">
                        Système de feedback intégré permettant amélioration continue des modèles avec base de données enrichie automatiquement.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-purple-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-purple-700">Évaluation Brevet Recommandée</p>
                        <p className="text-sm text-purple-600">Potentiel de protection fort sur innovations clés</p>
                      </div>
                      <Badge className="bg-purple-100 text-purple-700">3000-6000€</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
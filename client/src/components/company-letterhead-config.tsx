import React, { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Eye, 
  Save, 
  Download, 
  Palette, 
  FileText, 
  Building2,
  Printer,
  Settings
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface CompanyConfig {
  id?: number;
  companyName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  taxNumber: string;
  logoBase64?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  headerTemplate?: string;
  footerTemplate?: string;
  letterheadTemplate?: string;
  documentFooter?: string;
}

export function CompanyLetterheadConfig() {
  const [config, setConfig] = useState<CompanyConfig>({
    companyName: "Votre Entreprise",
    address: "123 Rue de l'Industrie\n75001 Paris, France",
    phone: "+33 1 23 45 67 89",
    email: "contact@entreprise.fr",
    website: "www.entreprise.fr",
    taxNumber: "FR 12 345 678 901",
    primaryColor: "#0066cc",
    secondaryColor: "#f8f9fa",
    fontFamily: "Arial, sans-serif"
  });
  
  const [previewMode, setPreviewMode] = useState<"letterhead" | "purchase_order">("letterhead");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
          title: "Erreur",
          description: "Le fichier logo doit faire moins de 2MB",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setConfig(prev => ({ ...prev, logoBase64: base64 }));
        toast({
          title: "Logo téléchargé",
          description: "Le logo a été ajouté avec succès",
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const generateLetterheadTemplate = () => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { 
      font-family: ${config.fontFamily}; 
      margin: 0; 
      padding: 20mm;
      color: #333;
    }
    .letterhead-header {
      display: flex;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 3px solid ${config.primaryColor};
      margin-bottom: 30px;
    }
    .logo-section {
      flex: 0 0 auto;
      margin-right: 30px;
    }
    .logo {
      max-height: 80px;
      max-width: 200px;
    }
    .company-info {
      flex: 1;
    }
    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: ${config.primaryColor};
      margin-bottom: 10px;
    }
    .company-details {
      font-size: 12px;
      line-height: 1.4;
      color: #666;
    }
    .document-content {
      min-height: 400px;
      margin: 30px 0;
    }
    .document-footer {
      border-top: 2px solid ${config.secondaryColor};
      padding-top: 15px;
      margin-top: 30px;
      text-align: center;
      font-size: 10px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="letterhead-header">
    ${config.logoBase64 ? `
    <div class="logo-section">
      <img src="${config.logoBase64}" alt="Logo" class="logo">
    </div>
    ` : ''}
    <div class="company-info">
      <div class="company-name">${config.companyName}</div>
      <div class="company-details">
        ${config.address.replace(/\n/g, '<br>')}<br>
        Tél: ${config.phone} | Email: ${config.email}<br>
        Web: ${config.website} | SIRET: ${config.taxNumber}
      </div>
    </div>
  </div>
  
  <div class="document-content">
    {{DOCUMENT_CONTENT}}
  </div>
  
  <div class="document-footer">
    ${config.companyName} - ${config.phone} - ${config.email}
  </div>
</body>
</html>`;
  };

  const generatePurchaseOrderExample = () => {
    const letterhead = generateLetterheadTemplate();
    const purchaseOrderContent = `
    <div style="margin-bottom: 30px;">
      <h2 style="color: ${config.primaryColor}; margin-bottom: 20px;">BON DE COMMANDE</h2>
      <div style="display: flex; justify-content: space-between;">
        <div>
          <strong>Numéro:</strong> PO-2025-001<br>
          <strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR')}<br>
          <strong>Demandeur:</strong> Jean Martin
        </div>
        <div style="text-align: right;">
          <strong>Fournisseur:</strong><br>
          Roulement Industriel SA<br>
          456 Avenue des Machines<br>
          69000 Lyon, France
        </div>
      </div>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background-color: ${config.primaryColor}; color: white;">
          <th style="border: 1px solid #ddd; padding: 12px; text-align: left;">Article</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: center;">Qté</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Prix Unit.</th>
          <th style="border: 1px solid #ddd; padding: 12px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="border: 1px solid #ddd; padding: 10px;">Roulement SKF 6308</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">4</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">125,50 €</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">502,00 €</td>
        </tr>
        <tr>
          <td style="border: 1px solid #ddd; padding: 10px;">Joint hydraulique NBR</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">10</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">15,20 €</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">152,00 €</td>
        </tr>
        <tr style="font-weight: bold; background-color: #f5f5f5;">
          <td colspan="3" style="border: 1px solid #ddd; padding: 10px; text-align: right;">TOTAL HT:</td>
          <td style="border: 1px solid #ddd; padding: 10px; text-align: right;">654,00 €</td>
        </tr>
      </tbody>
    </table>
    
    <div style="margin-top: 30px;">
      <p><strong>Conditions:</strong> Livraison sous 10 jours ouvrés</p>
      <p><strong>Validation:</strong> En attente validation niveau 2</p>
    </div>`;
    
    return letterhead.replace('{{DOCUMENT_CONTENT}}', purchaseOrderContent);
  };

  const saveConfiguration = async () => {
    try {
      const templateData = {
        ...config,
        letterheadTemplate: generateLetterheadTemplate(),
        headerTemplate: generateLetterheadTemplate().split('{{DOCUMENT_CONTENT}}')[0],
        footerTemplate: generateLetterheadTemplate().split('{{DOCUMENT_CONTENT}}')[1],
        documentFooter: `${config.companyName} - ${config.phone} - ${config.email}`
      };

      await apiRequest("/api/company-config", {
        method: "POST",
        body: templateData
      });

      toast({
        title: "Configuration sauvegardée",
        description: "Le papier en-tête a été enregistré avec succès",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la configuration",
        variant: "destructive",
      });
    }
  };

  const downloadTemplate = () => {
    if (previewMode === "purchase_order") {
      // Use server route for purchase order PDF generation
      const timestamp = new Date().getTime();
      const randomId = Math.random().toString(36).substring(7);
      const url = `/api/purchase-orders/1/letterhead?cache_bust=${timestamp}&rand=${randomId}`;
      
      const newWindow = window.open('about:blank', '_blank');
      if (newWindow) {
        newWindow.location.href = url;
      } else {
        // Fallback if popup blocked
        window.location.assign(url);
      }

      toast({
        title: "Génération du PDF",
        description: "Le bon de commande exemple s'ouvre en PDF dans un nouvel onglet",
      });
    } else {
      // Keep HTML download for letterhead template
      const template = generateLetterheadTemplate();
      
      const blob = new Blob([template], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `letterhead_template.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Template téléchargé",
        description: "Le template d'en-tête a été téléchargé en HTML",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configuration Papier En-tête</h2>
          <p className="text-muted-foreground">
            Personnalisez l'apparence de vos documents officiels et bons de commande
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadTemplate} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Télécharger
          </Button>
          <Button onClick={saveConfiguration}>
            <Save className="h-4 w-4 mr-2" />
            Sauvegarder
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Informations Entreprise
              </CardTitle>
              <CardDescription>
                Définissez les informations de base de votre entreprise
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="companyName">Nom de l'entreprise</Label>
                <Input
                  id="companyName"
                  value={config.companyName}
                  onChange={(e) => setConfig(prev => ({ ...prev, companyName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="address">Adresse</Label>
                <Textarea
                  id="address"
                  value={config.address}
                  onChange={(e) => setConfig(prev => ({ ...prev, address: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    value={config.phone}
                    onChange={(e) => setConfig(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={config.email}
                    onChange={(e) => setConfig(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="website">Site web</Label>
                  <Input
                    id="website"
                    value={config.website}
                    onChange={(e) => setConfig(prev => ({ ...prev, website: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="taxNumber">SIRET</Label>
                  <Input
                    id="taxNumber"
                    value={config.taxNumber}
                    onChange={(e) => setConfig(prev => ({ ...prev, taxNumber: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Logo de l'entreprise
              </CardTitle>
              <CardDescription>
                Téléchargez le logo de votre entreprise (PNG, JPG, max 2MB)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choisir un fichier
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                {config.logoBase64 && (
                  <Badge variant="secondary">
                    Logo téléchargé
                  </Badge>
                )}
              </div>
              {config.logoBase64 && (
                <div className="mt-4">
                  <img
                    src={config.logoBase64}
                    alt="Logo preview"
                    className="max-h-20 max-w-40 border rounded"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Style et couleurs
              </CardTitle>
              <CardDescription>
                Personnalisez l'apparence de vos documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primaryColor">Couleur principale</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={config.primaryColor}
                      onChange={(e) => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-16 h-10"
                    />
                    <Input
                      value={config.primaryColor}
                      onChange={(e) => setConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                      placeholder="#0066cc"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="secondaryColor">Couleur secondaire</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondaryColor"
                      type="color"
                      value={config.secondaryColor}
                      onChange={(e) => setConfig(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="w-16 h-10"
                    />
                    <Input
                      value={config.secondaryColor}
                      onChange={(e) => setConfig(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      placeholder="#f8f9fa"
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="fontFamily">Police de caractère</Label>
                <select
                  id="fontFamily"
                  value={config.fontFamily}
                  onChange={(e) => setConfig(prev => ({ ...prev, fontFamily: e.target.value }))}
                  className="w-full border border-input bg-background px-3 py-2 rounded-md"
                >
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="Helvetica, sans-serif">Helvetica</option>
                  <option value="Times New Roman, serif">Times New Roman</option>
                  <option value="Calibri, sans-serif">Calibri</option>
                  <option value="Georgia, serif">Georgia</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Aperçu
              </CardTitle>
              <CardDescription>
                Visualisez l'apparence de vos documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={previewMode} onValueChange={(value) => setPreviewMode(value as any)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="letterhead">
                    <FileText className="h-4 w-4 mr-2" />
                    En-tête
                  </TabsTrigger>
                  <TabsTrigger value="purchase_order">
                    <Printer className="h-4 w-4 mr-2" />
                    Bon de Commande
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="letterhead" className="mt-4">
                  <div 
                    className="border rounded-lg p-4 bg-white text-black overflow-auto max-h-96"
                    dangerouslySetInnerHTML={{
                      __html: generateLetterheadTemplate().replace('{{DOCUMENT_CONTENT}}', 
                        '<p style="margin: 20px 0; color: #666; font-style: italic;">Contenu du document sera inséré ici...</p>')
                    }}
                  />
                </TabsContent>
                
                <TabsContent value="purchase_order" className="mt-4">
                  <div 
                    className="border rounded-lg p-2 bg-white text-black overflow-auto max-h-96 text-xs"
                    dangerouslySetInnerHTML={{
                      __html: generatePurchaseOrderExample()
                    }}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
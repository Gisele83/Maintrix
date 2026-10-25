import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  QrCode, Download, Printer, Search, Factory, MapPin,
  CheckCircle, AlertTriangle, Eye, Copy, Grid3X3, List,
  Smartphone, ScanLine
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModernNavigation } from "@/components/modern-navigation";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

const statusColors: Record<string, string> = {
  operational: "bg-etat-nominal-vif",
  maintenance: "bg-etat-alerte-vif",
  offline: "bg-etat-critique-vif",
  decommissioned: "bg-gray-500"
};

const statusLabels: Record<string, string> = {
  operational: "Opérationnel",
  maintenance: "En maintenance",
  offline: "Hors service",
  decommissioned: "Décommissionné"
};

export default function EquipmentQR() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ['/api/equipment-qr-batch'],
  });

  if (isLoading) {
    return (
      <AppShell filAriane={[{ libelle: "Exploitation" }, { libelle: "Codes QR" }]} largeur="large">
      <div className="space-y-6">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin w-12 h-12 border-4 border-etat-encours-filet border-t-transparent rounded-full" />
        </div>
      </div>
    </AppShell>
    );
  }

  const equipmentList = data?.equipment || [];
  const filtered = equipmentList.filter((item: any) =>
    !searchTerm || item.equipment.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.equipment.equipmentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.equipment.equipmentType?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const printAllQR = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const qrHtml = filtered.map((item: any) => `
      <div style="display:inline-block;width:200px;margin:15px;padding:15px;border:2px solid #333;border-radius:8px;text-align:center;page-break-inside:avoid;">
        <div style="margin-bottom:8px;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="150" height="150">
            <text x="128" y="128" text-anchor="middle" dominant-baseline="middle" font-size="12">QR: ${item.equipment.equipmentId || item.equipment.id}</text>
          </svg>
        </div>
        <div style="font-weight:bold;font-size:12px;">${item.equipment.equipmentName}</div>
        <div style="font-size:10px;color:#666;">${item.equipment.equipmentId || ''}</div>
        <div style="font-size:10px;color:#666;">${item.equipment.location || 'N/A'}</div>
      </div>
    `).join('');
    
    printWindow.document.write(`
      <html><head><title>QR Codes - Maintrix</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;}h1{text-align:center;}</style></head>
      <body><h1>QR Codes Équipements - Maintrix</h1><div style="text-align:center;">${qrHtml}</div></body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const downloadSVG = (qrData: string, name: string) => {
    const svg = document.querySelector(`#qr-${name}`)?.closest('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${name}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-paper-deep">
      <ModernNavigation />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-paper-deep rounded-none flex items-center justify-center">
              <QrCode className="w-6 h-6 text-ink" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-ink">QR Code Équipements</h1>
              <p className="text-ink-mute">Générez et imprimez des QR codes pour un accès rapide aux fiches équipements</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-rule text-ink-soft" onClick={printAllQR}>
              <Printer className="w-4 h-4 mr-2" /> Imprimer tout
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
            <Input placeholder="Rechercher un équipement..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9" />
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant={viewMode === "grid" ? "default" : "outline"} onClick={() => setViewMode("grid")}
              className={viewMode === "grid" ? "bg-etat-encours-vif" : "border-rule text-ink-soft"}>
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button size="sm" variant={viewMode === "list" ? "default" : "outline"} onClick={() => setViewMode("list")}
              className={viewMode === "list" ? "bg-etat-encours-vif" : "border-rule text-ink-soft"}>
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Badge variant="outline" className="text-ink-mute border-rule">{filtered.length} équipements</Badge>
        </div>

        <Card className="bg-paper-deep border-rule">
          <CardHeader className="pb-2">
            <CardTitle className="text-ink text-sm flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-signal" />
              Comment utiliser les QR codes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: "1", title: "Imprimez", desc: "Imprimez les QR codes et collez-les sur vos équipements", icon: Printer },
                { step: "2", title: "Scannez", desc: "Utilisez l'app mobile Maintrix pour scanner le QR code", icon: ScanLine },
                { step: "3", title: "Accédez", desc: "Accédez instantanément à la fiche complète de l'équipement", icon: Eye }
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-signal-deep/20 text-signal flex items-center justify-center text-sm font-bold shrink-0">{s.step}</div>
                  <div>
                    <p className="text-sm font-medium text-ink">{s.title}</p>
                    <p className="text-xs text-ink-mute">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div ref={printRef} className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "space-y-3"}>
          {filtered.map((item: any) => {
            const eq = item.equipment;
            const qrValue = `${window.location.origin}/equipment/${eq.id}`;
            
            if (viewMode === "list") {
              return (
                <Card key={eq.id} className="bg-paper-deep border-rule hover:bg-white transition-colors cursor-pointer"
                  onClick={() => setSelectedEquipment(item)}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="bg-white p-2 rounded-lg shrink-0">
                      <QRCodeSVG value={qrValue} size={60} level="M" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-ink font-medium">{eq.equipmentName}</p>
                      <p className="text-xs text-ink-mute">{eq.equipmentId} · {eq.equipmentType}</p>
                      <p className="text-xs text-ink-mute flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {eq.location || 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${statusColors[eq.operationalState] || 'bg-gray-500'}`} />
                      <span className="text-xs text-ink-mute">{statusLabels[eq.operationalState] || eq.operationalState}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card key={eq.id} className="bg-paper-deep border-rule hover:bg-white transition-colors cursor-pointer"
                onClick={() => setSelectedEquipment(item)}>
                <CardContent className="p-4 text-center">
                  <div className="bg-white p-3 rounded-lg inline-block mb-3">
                    <QRCodeSVG value={qrValue} size={120} level="M" includeMargin={false} />
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <div className={`w-2 h-2 rounded-full ${statusColors[eq.operationalState] || 'bg-gray-500'}`} />
                    <p className="text-sm font-medium text-ink truncate">{eq.equipmentName}</p>
                  </div>
                  <p className="text-xs text-ink-mute">{eq.equipmentId}</p>
                  <p className="text-xs text-ink-mute flex items-center justify-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {eq.location || 'N/A'}
                  </p>
                  <Badge variant="outline" className="text-[10px] text-ink-mute border-rule mt-2">{eq.criticalityLevel}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <QrCode className="w-12 h-12 text-ink-soft mx-auto mb-3" />
            <p className="text-ink font-medium">Aucun équipement trouvé</p>
            <p className="text-sm text-ink-mute">Modifiez votre recherche pour trouver des équipements</p>
          </div>
        )}

        <Dialog open={!!selectedEquipment} onOpenChange={() => setSelectedEquipment(null)}>
          <DialogContent className="bg-paper-deep border-rule max-w-md">
            <DialogHeader>
              <DialogTitle className="text-ink">QR Code - {selectedEquipment?.equipment?.equipmentName}</DialogTitle>
            </DialogHeader>
            {selectedEquipment && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-none">
                    <QRCodeSVG
                      id={`qr-detail-${selectedEquipment.equipment.id}`}
                      value={`${window.location.origin}/equipment/${selectedEquipment.equipment.id}`}
                      size={200}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 bg-white rounded">
                    <span className="text-xs text-ink-mute">ID</span>
                    <span className="text-xs text-ink">{selectedEquipment.equipment.equipmentId}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-white rounded">
                    <span className="text-xs text-ink-mute">Type</span>
                    <span className="text-xs text-ink">{selectedEquipment.equipment.equipmentType}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-white rounded">
                    <span className="text-xs text-ink-mute">Localisation</span>
                    <span className="text-xs text-ink">{selectedEquipment.equipment.location || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-white rounded">
                    <span className="text-xs text-ink-mute">Criticité</span>
                    <Badge className={`text-xs ${selectedEquipment.equipment.criticalityLevel === 'critical' ? 'bg-etat-critique-fond text-etat-critique-texte' : selectedEquipment.equipment.criticalityLevel === 'high' ? 'bg-etat-alerte-fond text-etat-alerte-texte' : 'bg-etat-encours-fond text-etat-encours-texte'}`}>
                      {selectedEquipment.equipment.criticalityLevel}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-paper-deep" onClick={() => {
                    const svg = document.querySelector(`#qr-detail-${selectedEquipment.equipment.id}`)?.closest('svg');
                    if (svg) {
                      const svgData = new XMLSerializer().serializeToString(svg);
                      const blob = new Blob([svgData], { type: 'image/svg+xml' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `qr-${selectedEquipment.equipment.equipmentId || selectedEquipment.equipment.id}.svg`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}>
                    <Download className="w-4 h-4 mr-2" /> Télécharger SVG
                  </Button>
                  <Button variant="outline" className="border-rule text-ink-soft" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/equipment/${selectedEquipment.equipment.id}`);
                    toast({ title: "Copié", description: "Lien copié dans le presse-papier" });
                  }}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

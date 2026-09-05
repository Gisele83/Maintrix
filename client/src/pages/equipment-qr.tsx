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

const statusColors: Record<string, string> = {
  operational: "bg-green-500",
  maintenance: "bg-yellow-500",
  offline: "bg-red-500",
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
        <ModernNavigation />
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      </div>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <ModernNavigation />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">QR Code Équipements</h1>
              <p className="text-slate-400">Générez et imprimez des QR codes pour un accès rapide aux fiches équipements</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-white/20 text-slate-300" onClick={printAllQR}>
              <Printer className="w-4 h-4 mr-2" /> Imprimer tout
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Rechercher un équipement..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900/50 border-white/10 text-white" />
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant={viewMode === "grid" ? "default" : "outline"} onClick={() => setViewMode("grid")}
              className={viewMode === "grid" ? "bg-blue-600" : "border-white/10 text-slate-300"}>
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button size="sm" variant={viewMode === "list" ? "default" : "outline"} onClick={() => setViewMode("list")}
              className={viewMode === "list" ? "bg-blue-600" : "border-white/10 text-slate-300"}>
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Badge variant="outline" className="text-slate-400 border-white/10">{filtered.length} équipements</Badge>
        </div>

        <Card className="bg-slate-900/60 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-violet-400" />
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
                <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center text-sm font-bold shrink-0">{s.step}</div>
                  <div>
                    <p className="text-sm font-medium text-white">{s.title}</p>
                    <p className="text-xs text-slate-400">{s.desc}</p>
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
                <Card key={eq.id} className="bg-slate-900/60 border-white/10 hover:bg-slate-800/60 transition-colors cursor-pointer"
                  onClick={() => setSelectedEquipment(item)}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="bg-white p-2 rounded-lg shrink-0">
                      <QRCodeSVG value={qrValue} size={60} level="M" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">{eq.equipmentName}</p>
                      <p className="text-xs text-slate-400">{eq.equipmentId} · {eq.equipmentType}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {eq.location || 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${statusColors[eq.operationalState] || 'bg-gray-500'}`} />
                      <span className="text-xs text-slate-400">{statusLabels[eq.operationalState] || eq.operationalState}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Card key={eq.id} className="bg-slate-900/60 border-white/10 hover:bg-slate-800/60 transition-colors cursor-pointer"
                onClick={() => setSelectedEquipment(item)}>
                <CardContent className="p-4 text-center">
                  <div className="bg-white p-3 rounded-lg inline-block mb-3">
                    <QRCodeSVG value={qrValue} size={120} level="M" includeMargin={false} />
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <div className={`w-2 h-2 rounded-full ${statusColors[eq.operationalState] || 'bg-gray-500'}`} />
                    <p className="text-sm font-medium text-white truncate">{eq.equipmentName}</p>
                  </div>
                  <p className="text-xs text-slate-400">{eq.equipmentId}</p>
                  <p className="text-xs text-slate-500 flex items-center justify-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {eq.location || 'N/A'}
                  </p>
                  <Badge variant="outline" className="text-[10px] text-slate-400 border-white/10 mt-2">{eq.criticalityLevel}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <QrCode className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-white font-medium">Aucun équipement trouvé</p>
            <p className="text-sm text-slate-400">Modifiez votre recherche pour trouver des équipements</p>
          </div>
        )}

        <Dialog open={!!selectedEquipment} onOpenChange={() => setSelectedEquipment(null)}>
          <DialogContent className="bg-slate-900 border-white/10 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white">QR Code - {selectedEquipment?.equipment?.equipmentName}</DialogTitle>
            </DialogHeader>
            {selectedEquipment && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-xl">
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
                  <div className="flex justify-between p-2 bg-slate-800/50 rounded">
                    <span className="text-xs text-slate-400">ID</span>
                    <span className="text-xs text-white">{selectedEquipment.equipment.equipmentId}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-800/50 rounded">
                    <span className="text-xs text-slate-400">Type</span>
                    <span className="text-xs text-white">{selectedEquipment.equipment.equipmentType}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-800/50 rounded">
                    <span className="text-xs text-slate-400">Localisation</span>
                    <span className="text-xs text-white">{selectedEquipment.equipment.location || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-slate-800/50 rounded">
                    <span className="text-xs text-slate-400">Criticité</span>
                    <Badge className={`text-xs ${selectedEquipment.equipment.criticalityLevel === 'critical' ? 'bg-red-500/20 text-red-400' : selectedEquipment.equipment.criticalityLevel === 'high' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                      {selectedEquipment.equipment.criticalityLevel}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600" onClick={() => {
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
                  <Button variant="outline" className="border-white/20 text-slate-300" onClick={() => {
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

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, uploadFile } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { BookOpen, Search, Plus, Sparkles, FileText, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface KnowledgeHubDocument {
  id: number;
  documentType: string;
  title: string;
  description: string | null;
  content: string | null;
  tags: string[] | null;
  equipmentType: string | null;
  fileUrl: string | null;
  fileType: string | null;
}
interface SearchResult {
  document: KnowledgeHubDocument;
  score: number;
  matchType: "semantic" | "keyword";
}

const DOC_TYPE_LABELS: Record<string, string> = {
  schema: "Schéma", plan: "Plan", notice: "Notice", bulletin_technique: "Bulletin technique",
  photo: "Photo", video: "Vidéo", norme: "Norme", procedure_saem: "Procédure SAEM", rex: "REX",
};

export default function KnowledgeHubPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ documentType: "notice", title: "", description: "", content: "", tags: "", equipmentType: "" });
  const [file, setFile] = useState<File | null>(null);

  const { data: status } = useQuery<{ semanticSearchAvailable: boolean }>({ queryKey: ["/api/knowledge-hub/status"] });
  const { data: documents } = useQuery<KnowledgeHubDocument[]>({ queryKey: ["/api/knowledge-hub/documents"] });

  const upload = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append("file", file);
      return uploadFile("/api/knowledge-hub/documents", fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-hub/documents"] });
      toast({ title: "Document ajouté au Knowledge Hub" });
      setOpen(false);
      setForm({ documentType: "notice", title: "", description: "", content: "", tags: "", equipmentType: "" });
      setFile(null);
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const results = await apiRequest(`/api/knowledge-hub/search?q=${encodeURIComponent(query)}`);
      setSearchResults(results);
    } catch (e: any) {
      toast({ title: "Erreur de recherche", description: e.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-600" />
              Engineering Knowledge Hub
            </h1>
            <p className="text-gray-500">Schémas, plans, notices, bulletins techniques, normes IEC/ISO, procédures SAEM, REX.</p>
          </div>
          <Badge variant="outline" className={status?.semanticSearchAvailable ? "text-green-700 border-green-300" : "text-gray-500 border-gray-300"}>
            <Sparkles className="w-3 h-3 mr-1" />
            {status?.semanticSearchAvailable ? "Recherche sémantique active" : "Recherche par mots-clés (pas de clé OpenAI configurée)"}
          </Badge>
        </div>

        {/* Recherche */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ex: vibration variateur, joint d'étanchéité..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && runSearch()}
              />
              <Button onClick={runSearch} disabled={searching || !query.trim()}>
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {searchResults !== null && (
              <div className="space-y-2">
                {searchResults.length === 0 && <p className="text-sm text-gray-400">Aucun résultat.</p>}
                {searchResults.map(r => (
                  <div key={r.document.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{DOC_TYPE_LABELS[r.document.documentType]}</Badge>
                        <span className="font-medium text-sm">{r.document.title}</span>
                      </div>
                      {r.document.description && <p className="text-xs text-gray-500 mt-1">{r.document.description}</p>}
                    </div>
                    <div className="text-right">
                      <Badge className={r.matchType === "semantic" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}>
                        {r.matchType === "semantic" ? "sémantique" : "mot-clé"}
                      </Badge>
                      <p className="text-xs text-gray-400 mt-1">score {r.score}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bibliothèque */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Bibliothèque documentaire</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" />Ajouter un document</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Ajouter un document</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Type</Label>
                  <Select value={form.documentType} onValueChange={v => setForm({ ...form, documentType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DOC_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Titre</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                <div><Label>Contenu recherchable (texte, optionnel)</Label><Textarea rows={4} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Extrait de norme, narration REX, contenu du bulletin..." /></div>
                <div><Label>Tags (séparés par des virgules)</Label><Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="variateur, IGBT, vibration" /></div>
                <div><Label>Type d'équipement (optionnel)</Label><Input value={form.equipmentType} onChange={e => setForm({ ...form, equipmentType: e.target.value })} /></div>
                <div>
                  <Label>Fichier (optionnel)</Label>
                  <Input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                </div>
              </div>
              <DialogFooter><Button onClick={() => upload.mutate()} disabled={!form.title || upload.isPending}>Ajouter</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(documents ?? []).map(doc => (
            <Card key={doc.id}>
              <CardHeader className="pb-2">
                <Badge variant="outline" className="text-xs w-fit mb-1">{DOC_TYPE_LABELS[doc.documentType]}</Badge>
                <CardTitle className="text-sm">{doc.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {doc.description && <p className="text-xs text-gray-500 line-clamp-2">{doc.description}</p>}
                {doc.fileUrl && (
                  <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 flex items-center gap-1">
                    <FileText className="w-3 h-3" />Voir le fichier
                  </a>
                )}
                {(doc.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {doc.tags!.map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {(documents ?? []).length === 0 && <p className="text-sm text-gray-400 col-span-3">Aucun document dans le Knowledge Hub.</p>}
        </div>
      </div>
    </div>
  );
}

// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Upload, Trash2, Search, Download, Eye, Plus } from "lucide-react";
import { toast } from "sonner";

interface Stagiaire {
  id: string;
  first_name: string;
  last_name: string;
}

interface Document {
  id: string;
  stagiaire_id: string;
  nom: string;
  url: string;
  type: string;
  created_at: string;
  created_by: string;
  _stagiaire?: Stagiaire;
}

const CATEGORIES = [
  { value: "contrat", label: "Contrat de formation" },
  { value: "attestation", label: "Attestation de fin" },
  { value: "convocation", label: "Convocation" },
  { value: "emargement", label: "Feuille d'émargement" },
  { value: "carte_pro", label: "Carte professionnelle" },
  { value: "autre", label: "Autre" },
];

function getCategorieFromNom(nom: string): string {
  const n = nom.toLowerCase();
  if (n.includes("contrat")) return "contrat";
  if (n.includes("attestation")) return "attestation";
  if (n.includes("convocation")) return "convocation";
  if (n.includes("emargement") || n.includes("émargement")) return "emargement";
  if (n.includes("carte")) return "carte_pro";
  return "autre";
}

function getCategorieLabel(val: string): string {
  return CATEGORIES.find(c => c.value === val)?.label ?? "Autre";
}

function getBadgeColor(cat: string): string {
  switch (cat) {
    case "contrat": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "attestation": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "convocation": return "bg-purple-500/20 text-purple-400 border-purple-500/30";
    case "emargement": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "carte_pro": return "bg-primary/20 text-primary border-primary/30";
    default: return "bg-secondary text-muted-foreground border-border";
  }
}

function getFileIcon(type: string): string {
  if (type.includes("pdf")) return "📄";
  if (type.includes("word") || type.includes("document")) return "📝";
  if (type.includes("image")) return "🖼️";
  if (type.includes("sheet") || type.includes("excel")) return "📊";
  return "📁";
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Rechercher par nom de fichier ou stagiaire..."
        className="pl-9 bg-secondary/50 border-border/50"
      />
    </div>
  );
}

export default function Documents() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [stagiaires, setStagiaires] = useState<Stagiaire[]>([]);
  const [search, setSearch] = useState("");
  const [filterStagiaire, setFilterStagiaire] = useState("tous");
  const [filterCat, setFilterCat] = useState("tous");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteUrl, setDeleteUrl] = useState<string | null>(null);
  const [uploadForm, setUploadForm] = useState({ stagiaire_id: "", categorie: "autre" });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    document.title = "Documents — SecureCRM";
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data: stags } = await supabase
      .from("stagiaires")
      .select("id, first_name, last_name")
      .order("last_name");
    setStagiaires(stags ?? []);

    const { data: documents } = await supabase
      .from("stagiaire_documents")
      .select("*")
      .order("created_at", { ascending: false });

    const stagsMap: Record<string, Stagiaire> = {};
    (stags ?? []).forEach((s: any) => { stagsMap[s.id] = s; });

    setDocs((documents ?? []).map((d: any) => ({
      ...d,
      _stagiaire: stagsMap[d.stagiaire_id],
    })));
    setLoading(false);
  };

  const handleUpload = async () => {
    if (!file) { toast.error("Sélectionne un fichier"); return; }
    if (!uploadForm.stagiaire_id) { toast.error("Sélectionne un stagiaire"); return; }

    setUploading(true);
    const fileName = `${Date.now()}_${file.name}`;
    const path = `${uploadForm.stagiaire_id}/${fileName}`;

    const { error: storageError } = await supabase.storage
      .from("documents")
      .upload(path, file, { upsert: false });

    if (storageError) {
      toast.error("Erreur upload : " + storageError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);

    const { error: dbError } = await supabase.from("stagiaire_documents").insert({
      stagiaire_id: uploadForm.stagiaire_id,
      nom: file.name,
      url: urlData.publicUrl,
      type: file.type,
    });

    if (dbError) {
      toast.error("Erreur base de données : " + dbError.message);
      setUploading(false);
      return;
    }

    toast.success("Document uploadé avec succès");
    setUploading(false);
    setOpenUpload(false);
    setFile(null);
    setUploadForm({ stagiaire_id: "", categorie: "autre" });
    load();
  };

  const handleDelete = async () => {
    if (!deleteId || !deleteUrl) return;

    // Extraire le path depuis l'URL
    const path = deleteUrl.split("/storage/v1/object/public/documents/")[1];
    if (path) {
      await supabase.storage.from("documents").remove([path]);
    }

    const { error } = await supabase.from("stagiaire_documents").delete().eq("id", deleteId);
    if (error) { toast.error("Erreur suppression"); return; }

    toast.success("Document supprimé");
    setDeleteId(null);
    setDeleteUrl(null);
    load();
  };

  const filtered = docs.filter((d) => {
    const q = search.toLowerCase();
    const matchSearch =
      d.nom.toLowerCase().includes(q) ||
      `${d._stagiaire?.first_name} ${d._stagiaire?.last_name}`.toLowerCase().includes(q);
    const matchStagiaire = filterStagiaire === "tous" || d.stagiaire_id === filterStagiaire;
    const matchCat = filterCat === "tous" || getCategorieFromNom(d.nom) === filterCat;
    return matchSearch && matchStagiaire && matchCat;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow">Documents</h1>
          <p className="text-muted-foreground text-sm mt-1">Gestion des documents stagiaires</p>
        </div>
        <Button onClick={() => setOpenUpload(true)} className="gradient-primary shadow-glow">
          <Plus className="h-4 w-4 mr-2" /> Uploader un document
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 flex-wrap">
        <SearchInput value={search} onChange={setSearch} />
        <Select value={filterStagiaire} onValueChange={setFilterStagiaire}>
          <SelectTrigger className="w-48 bg-secondary/50 border-border/50">
            <SelectValue placeholder="Tous les stagiaires" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les stagiaires</SelectItem>
            {stagiaires.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-44 bg-secondary/50 border-border/50">
            <SelectValue placeholder="Toutes catégories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Toutes catégories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="border-primary/30 text-primary px-3 py-2">
          <FileText className="h-3 w-3 mr-1" /> {docs.length} document{docs.length > 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Table */}
      <Card className="bg-card/60 border-border/50 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Aucun document trouvé</p>
            <Button onClick={() => setOpenUpload(true)} variant="outline" className="mt-3">
              <Upload className="h-4 w-4 mr-2" /> Uploader le premier
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead>Fichier</TableHead>
                <TableHead>Stagiaire</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id} className="border-border/50 hover:bg-secondary/30">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getFileIcon(d.type)}</span>
                      <p className="text-sm font-medium truncate max-w-xs">{d.nom}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {d._stagiaire
                      ? <p className="text-sm">{d._stagiaire.first_name} {d._stagiaire.last_name}</p>
                      : <span className="text-muted-foreground text-xs">—</span>
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getBadgeColor(getCategorieFromNom(d.nom))}>
                      {getCategorieLabel(getCategorieFromNom(d.nom))}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <a href={d.url} target="_blank" rel="noopener noreferrer" title="Voir">
                          <Eye className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <a href={d.url} download={d.nom} title="Télécharger">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { setDeleteId(d.id); setDeleteUrl(d.url); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Dialog upload */}
      <Dialog open={openUpload} onOpenChange={setOpenUpload}>
        <DialogContent className="max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Uploader un document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Stagiaire *</Label>
              <Select value={uploadForm.stagiaire_id} onValueChange={(v) => setUploadForm(f => ({ ...f, stagiaire_id: v }))}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="Sélectionner un stagiaire" />
                </SelectTrigger>
                <SelectContent>
                  {stagiaires.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Fichier *</Label>
              <div className="border-2 border-dashed border-border/50 rounded-lg p-6 text-center hover:border-primary/40 transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  {file ? (
                    <p className="text-sm font-medium text-primary">{file.name}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Cliquer pour sélectionner un fichier</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, Images</p>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenUpload(false); setFile(null); }}>Annuler</Button>
            <Button onClick={handleUpload} className="gradient-primary" disabled={uploading}>
              {uploading ? "Upload en cours..." : "Uploader"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog suppression */}
      <Dialog open={!!deleteId} onOpenChange={() => { setDeleteId(null); setDeleteUrl(null); }}>
        <DialogContent className="max-w-sm bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Supprimer le document ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Le fichier sera supprimé définitivement du stockage.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteId(null); setDeleteUrl(null); }}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
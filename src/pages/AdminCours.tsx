// @ts-nocheck
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, BookOpen, ChevronDown, ChevronRight } from "lucide-react";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

type Cours = {
  id: string;
  formation_type: string;
  chapitre_numero: number;
  titre: string;
  contenu: string;
  created_at?: string;
};

type CoursForm = Omit<Cours, "id" | "created_at">;

const FORMATION_TYPES = [
  { value: "SST", label: "SST — Sauveteur Secouriste du Travail" },
  { value: "SSIAP1", label: "SSIAP 1 — Agent de Sécurité Incendie" },
  { value: "APS", label: "APS — Agent de Prévention et de Sûreté" },
  { value: "EPI", label: "EPI / Extincteurs — Équipier de Première Intervention" },
  { value: "MAC_APS", label: "MAC APS — Maintien et Actualisation des Compétences" },
];

const EMPTY_FORM: CoursForm = {
  formation_type: "",
  chapitre_numero: 1,
  titre: "",
  contenu: "",
};

export default function AdminCours() {
  const [cours, setCours] = useState<Cours[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCours, setEditingCours] = useState<Cours | null>(null);
  const [form, setForm] = useState<CoursForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Cours | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  const fetchCours = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cours")
      .select("*")
      .order("formation_type", { ascending: true })
      .order("chapitre_numero", { ascending: true });

    if (error) {
      toast.error("Erreur lors du chargement des cours");
    } else {
      setCours(data || []);
      const types = new Set((data || []).map((c) => c.formation_type));
      setExpandedTypes(types);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCours();
  }, []);

  const filteredCours =
    filterType === "all" ? cours : cours.filter((c) => c.formation_type === filterType);

  const groupedCours = filteredCours.reduce<Record<string, Cours[]>>((acc, c) => {
    if (!acc[c.formation_type]) acc[c.formation_type] = [];
    acc[c.formation_type].push(c);
    return acc;
  }, {});

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const openCreate = (prefilledType?: string) => {
    setEditingCours(null);
    const typeToUse = prefilledType || "";
    const existingChapitres = cours
      .filter((c) => c.formation_type === typeToUse)
      .map((c) => c.chapitre_numero);
    const nextNum = existingChapitres.length > 0 ? Math.max(...existingChapitres) + 1 : 1;
    setForm({
      ...EMPTY_FORM,
      formation_type: typeToUse,
      chapitre_numero: typeToUse ? nextNum : 1,
    });
    setDialogOpen(true);
  };

  const openEdit = (c: Cours) => {
    setEditingCours(c);
    setForm({
      formation_type: c.formation_type,
      chapitre_numero: c.chapitre_numero,
      titre: c.titre,
      contenu: c.contenu,
    });
    setDialogOpen(true);
  };

  const handleTypeChange = (value: string) => {
    const existingChapitres = cours
      .filter((c) => c.formation_type === value && c.id !== editingCours?.id)
      .map((c) => c.chapitre_numero);
    const nextNum = existingChapitres.length > 0 ? Math.max(...existingChapitres) + 1 : 1;
    setForm((prev) => ({ ...prev, formation_type: value, chapitre_numero: nextNum }));
  };

  const handleSave = async () => {
    if (!form.formation_type) { toast.error("Veuillez sélectionner un type de formation"); return; }
    if (!form.titre.trim()) { toast.error("Le titre est obligatoire"); return; }
    if (!form.contenu.trim()) { toast.error("Le contenu est obligatoire"); return; }
    if (form.chapitre_numero < 1) { toast.error("Le numéro de chapitre doit être ≥ 1"); return; }

    setSaving(true);

    if (editingCours) {
      const { error } = await supabase
        .from("cours")
        .update({
          formation_type: form.formation_type,
          chapitre_numero: form.chapitre_numero,
          titre: form.titre.trim(),
          contenu: form.contenu.trim(),
        })
        .eq("id", editingCours.id);
      if (error) { toast.error("Erreur lors de la mise à jour"); }
      else { toast.success("Chapitre mis à jour"); setDialogOpen(false); fetchCours(); }
    } else {
      const { error } = await supabase.from("cours").insert({
        formation_type: form.formation_type,
        chapitre_numero: form.chapitre_numero,
        titre: form.titre.trim(),
        contenu: form.contenu.trim(),
      });
      if (error) { toast.error("Erreur lors de la création"); }
      else { toast.success("Chapitre créé"); setDialogOpen(false); fetchCours(); }
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("cours").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Erreur lors de la suppression"); }
    else { toast.success(`Chapitre "${deleteTarget.titre}" supprimé`); setDeleteTarget(null); fetchCours(); }
    setDeleting(false);
  };

  const getTypeLabel = (value: string) =>
    FORMATION_TYPES.find((t) => t.value === value)?.label ?? value;

  const badgeColor: Record<string, string> = {
    SST: "bg-green-100 text-green-800 border-green-200",
    SSIAP1: "bg-blue-100 text-blue-800 border-blue-200",
    APS: "bg-yellow-100 text-yellow-800 border-yellow-200",
    EPI: "bg-orange-100 text-orange-800 border-orange-200",
    MAC_APS: "bg-purple-100 text-purple-800 border-purple-200",
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold">Gestion des cours</h1>
            <p className="text-sm text-muted-foreground">
              {cours.length} chapitre{cours.length !== 1 ? "s" : ""} au total
            </p>
          </div>
        </div>
        <Button onClick={() => openCreate()} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouveau chapitre
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">Filtrer par formation :</Label>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les formations</SelectItem>
            {FORMATION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground">Chargement…</div>
      ) : Object.keys(groupedCours).length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground border rounded-lg">
          <BookOpen className="h-10 w-10 opacity-30" />
          <p>Aucun chapitre trouvé</p>
          <Button variant="outline" size="sm" onClick={() => openCreate()}>
            <Plus className="h-4 w-4 mr-1" />Créer le premier chapitre
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedCours).map(([type, chapitres]) => (
            <div key={type} className="border rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                onClick={() => toggleType(type)}
              >
                <div className="flex items-center gap-3">
                  {expandedTypes.has(type) ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${badgeColor[type] ?? "bg-gray-100 text-gray-800 border-gray-200"}`}>
                    {type}
                  </span>
                  <span className="font-medium text-sm">{getTypeLabel(type).split("—")[1]?.trim() ?? type}</span>
                  <span className="text-xs text-muted-foreground">
                    {chapitres.length} chapitre{chapitres.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <Button
                  variant="ghost" size="sm" className="gap-1 text-xs h-7"
                  onClick={(e) => { e.stopPropagation(); openCreate(type); }}
                >
                  <Plus className="h-3 w-3" />Ajouter
                </Button>
              </div>

              {expandedTypes.has(type) && (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-16 text-center">N°</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead className="hidden md:table-cell">Aperçu du contenu</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chapitres.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-100 text-yellow-800 text-xs font-bold border border-yellow-200">
                            {c.chapitre_numero}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{c.titre}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-xs">
                          <span className="line-clamp-1">
                            {c.contenu.length > 120 ? c.contenu.slice(0, 120) + "…" : c.contenu}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} title="Modifier">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)} title="Supprimer">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCours ? "Modifier le chapitre" : "Nouveau chapitre"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="formation_type">Type de formation <span className="text-destructive">*</span></Label>
              <Select value={form.formation_type} onValueChange={handleTypeChange}>
                <SelectTrigger id="formation_type">
                  <SelectValue placeholder="Sélectionner une formation" />
                </SelectTrigger>
                <SelectContent>
                  {FORMATION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chapitre_numero">Numéro de chapitre <span className="text-destructive">*</span></Label>
              <Input
                id="chapitre_numero" type="number" min={1}
                value={form.chapitre_numero}
                onChange={(e) => setForm((prev) => ({ ...prev, chapitre_numero: parseInt(e.target.value) || 1 }))}
                className="w-32"
              />
              {form.formation_type && (
                <p className="text-xs text-muted-foreground">
                  {cours.filter((c) => c.formation_type === form.formation_type && c.id !== editingCours?.id).length} chapitre(s) existant(s) pour cette formation
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="titre">Titre <span className="text-destructive">*</span></Label>
              <Input
                id="titre" placeholder="Ex : Les gestes de premiers secours"
                value={form.titre}
                onChange={(e) => setForm((prev) => ({ ...prev, titre: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contenu">Contenu <span className="text-destructive">*</span></Label>
              <Textarea
                id="contenu" placeholder="Contenu du chapitre, objectifs pédagogiques, texte de cours…"
                value={form.contenu}
                onChange={(e) => setForm((prev) => ({ ...prev, contenu: e.target.value }))}
                rows={10} className="resize-y min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {form.contenu.length} caractère{form.contenu.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Enregistrement…" : editingCours ? "Mettre à jour" : "Créer le chapitre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce chapitre ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous allez supprimer le chapitre <strong>{deleteTarget?.chapitre_numero}. {deleteTarget?.titre}</strong> ({deleteTarget?.formation_type}). Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete} disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
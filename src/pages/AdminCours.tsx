// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, BookOpen, ChevronDown, ChevronRight, Euro, Clock, Package } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

type Template = {
  code: string;
  label: string;
  description: string;
  prix_ht: number;
  prix_unitaire: number;
  duration_hours: number;
  is_pack: boolean;
  pack_items: string[];
};

type Cours = {
  id: string;
  formation_type: string;
  chapitre_numero: number;
  titre: string;
  contenu: string;
  created_at?: string;
};

type CoursForm = Omit<Cours, "id" | "created_at">;

// ─── Constants ─────────────────────────────────────────────────────────────

export const FORMATION_TYPES = [
  { value: "APS",     label: "APS — Agent de Prévention et de Sûreté" },
  { value: "SST",     label: "SST — Sauveteur Secouriste du Travail" },
  { value: "SSIAP1",  label: "SSIAP 1 — Agent de Sécurité Incendie" },
  { value: "SSIAP2",  label: "SSIAP 2 — Chef d'équipe Sécurité Incendie" },
  { value: "SSIAP3",  label: "SSIAP 3 — Chef de service Sécurité Incendie" },
  { value: "EPI",     label: "EPI / Extincteurs — Équipier de Première Intervention" },
  { value: "MAC_APS", label: "MAC APS — Maintien et Actualisation des Compétences" },
  { value: "H0B0",    label: "H0B0 — Habilitation Électrique" },
  { value: "TFP",     label: "TFP — Titre à Finalité Professionnelle" },
  { value: "AUTRE",   label: "Autre formation" },
];

const EMPTY_COURS_FORM: CoursForm = { formation_type: "", chapitre_numero: 1, titre: "", contenu: "" };

export const BADGE_COLOR: Record<string, string> = {
  APS:     "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  SST:     "bg-green-500/15 text-green-400 border-green-500/30",
  SSIAP1:  "bg-blue-500/15 text-blue-400 border-blue-500/30",
  SSIAP2:  "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  SSIAP3:  "bg-violet-500/15 text-violet-400 border-violet-500/30",
  EPI:     "bg-orange-500/15 text-orange-400 border-orange-500/30",
  MAC_APS: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  H0B0:    "bg-red-500/15 text-red-400 border-red-500/30",
  TFP:     "bg-teal-500/15 text-teal-400 border-teal-500/30",
  AUTRE:   "bg-muted/50 text-muted-foreground border-border/50",
};

const fmt = (n: number) => n.toLocaleString("fr-FR");
const SIMPLE_CODES = FORMATION_TYPES.map(t => t.value);

// ─── Catalogue section ─────────────────────────────────────────────────────

function CatalogueSection() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [editForm, setEditForm] = useState({ description: "", prix_unitaire: 0, duration_hours: 0 });
  const [saving, setSaving] = useState(false);

  // Pack creation
  const [packOpen, setPackOpen] = useState(false);
  const [packForm, setPackForm] = useState({ label: "", description: "", prix_unitaire: 0, duration_hours: 0, pack_items: [] as string[] });
  const [savingPack, setSavingPack] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("formation_templates").select("*").order("is_pack").order("code");
    if (error) {
      if (error.code !== "42P01") toast.error(error.message);
    } else {
      setTemplates(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (t: Template) => {
    setEditing(t);
    setEditForm({ description: t.description, prix_unitaire: t.prix_unitaire, duration_hours: t.duration_hours });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("formation_templates")
      .update({ description: editForm.description, prix_unitaire: editForm.prix_unitaire, duration_hours: editForm.duration_hours, updated_at: new Date().toISOString() })
      .eq("code", editing.code);
    if (error) toast.error(error.message);
    else { toast.success("Catalogue mis à jour"); setEditing(null); load(); }
    setSaving(false);
  };

  const togglePackItem = (code: string) => {
    setPackForm(f => ({
      ...f,
      pack_items: f.pack_items.includes(code) ? f.pack_items.filter(c => c !== code) : [...f.pack_items, code],
    }));
  };

  const autoDuration = (items: string[]) =>
    items.reduce((sum, c) => sum + (templates.find(t => t.code === c)?.duration_hours ?? 0), 0);

  const savePack = async () => {
    if (!packForm.label.trim()) { toast.error("Nom du pack obligatoire"); return; }
    if (packForm.pack_items.length < 2) { toast.error("Sélectionnez au moins 2 formations"); return; }
    setSavingPack(true);
    const code = "PACK_" + packForm.pack_items.join("_").toUpperCase().replace(/[^A-Z0-9_]/g, "");
    const { error } = await supabase.from("formation_templates").insert({
      code,
      label: packForm.label.trim(),
      description: packForm.description.trim(),
      prix_ht: packForm.prix_unitaire,
      prix_unitaire: packForm.prix_unitaire,
      duration_hours: packForm.duration_hours || autoDuration(packForm.pack_items),
      is_pack: true,
      pack_items: packForm.pack_items,
    });
    if (error) {
      if (error.code === "23505") toast.error("Un pack avec ces formations existe déjà.");
      else toast.error(error.message);
    } else {
      toast.success("Pack créé");
      setPackOpen(false);
      setPackForm({ label: "", description: "", prix_unitaire: 0, duration_hours: 0, pack_items: [] });
      load();
    }
    setSavingPack(false);
  };

  const deletePack = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("formation_templates").delete().eq("code", deleteTarget.code);
    if (error) toast.error(error.message);
    else { toast.success("Pack supprimé"); setDeleteTarget(null); load(); }
  };

  const formations = templates.filter(t => !t.is_pack);
  const packs = templates.filter(t => t.is_pack);

  if (loading) return <p className="text-sm text-muted-foreground">Chargement du catalogue…</p>;

  if (templates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
        Catalogue non disponible — appliquez les migrations dans Supabase.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Formations */}
      <div className="space-y-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground/60">Formations individuelles</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {formations.map(t => (
            <div key={t.code} className="group relative rounded-xl border border-border bg-card/60 p-4 hover:border-border/80 transition-all">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${BADGE_COLOR[t.code] ?? BADGE_COLOR.AUTRE}`}>
                  {t.code}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => openEdit(t)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-[13px] font-semibold leading-tight mb-1.5">
                {t.label.split("—")[1]?.trim() ?? t.label}
              </p>
              {t.description ? (
                <p className="text-[12px] text-muted-foreground line-clamp-2 mb-3">{t.description}</p>
              ) : (
                <p className="text-[12px] text-muted-foreground/40 italic mb-3">Aucun résumé</p>
              )}
              <div className="flex items-center gap-3 text-[12px]">
                <span className="flex items-center gap-1 text-primary font-semibold">
                  <Euro className="h-3.5 w-3.5" />{fmt(t.prix_unitaire)} € / pers.
                </span>
                {t.duration_hours > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />{t.duration_hours}h
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Packs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold uppercase tracking-widest text-muted-foreground/60">Packs combinés</h2>
          <Button size="sm" variant="outline" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10" onClick={() => setPackOpen(true)}>
            <Plus className="h-3.5 w-3.5" />Créer un pack
          </Button>
        </div>
        {packs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            Aucun pack — cliquez sur "Créer un pack" pour en ajouter.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {packs.map(t => (
              <div key={t.code} className="group relative rounded-xl border border-primary/20 bg-primary/5 p-4 hover:border-primary/40 transition-all">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Package className="h-3.5 w-3.5 text-primary shrink-0" />
                    {t.pack_items.map(c => (
                      <span key={c} className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${BADGE_COLOR[c] ?? BADGE_COLOR.AUTRE}`}>{c}</span>
                    ))}
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(t)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-[13px] font-semibold leading-tight mb-1.5">{t.label}</p>
                {t.description && <p className="text-[12px] text-muted-foreground line-clamp-2 mb-3">{t.description}</p>}
                <div className="flex items-center gap-3 text-[12px]">
                  <span className="flex items-center gap-1 text-primary font-semibold">
                    <Euro className="h-3.5 w-3.5" />{fmt(t.prix_unitaire)} € / pers.
                  </span>
                  {t.duration_hours > 0 && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />{t.duration_hours}h
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={v => !v && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing?.is_pack && <Package className="h-4 w-4 text-primary" />}
              {!editing?.is_pack && <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${BADGE_COLOR[editing?.code ?? ""] ?? BADGE_COLOR.AUTRE}`}>{editing?.code}</span>}
              Modifier — {editing?.is_pack ? editing.label : (editing?.label.split("—")[1]?.trim() ?? editing?.label)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Résumé</Label>
              <Textarea rows={3} placeholder="Description courte de la formation…"
                value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prix par personne (€)</Label>
                <Input type="number" min={0} step={0.01} value={editForm.prix_unitaire}
                  onChange={e => setEditForm(f => ({ ...f, prix_unitaire: parseFloat(e.target.value) || 0 }))} />
                <p className="text-[11px] text-muted-foreground">Multiplié par le nombre de stagiaires</p>
              </div>
              <div className="space-y-1.5">
                <Label>Durée (heures)</Label>
                <Input type="number" min={0} step={0.5} value={editForm.duration_hours}
                  onChange={e => setEditForm(f => ({ ...f, duration_hours: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Annuler</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create pack dialog */}
      <Dialog open={packOpen} onOpenChange={v => { setPackOpen(v); if (!v) setPackForm({ label: "", description: "", prix_unitaire: 0, duration_hours: 0, pack_items: [] }); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />Créer un pack
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Nom du pack <span className="text-destructive">*</span></Label>
              <Input placeholder="Ex : Pack SST + TFP" value={packForm.label}
                onChange={e => setPackForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Formations incluses <span className="text-destructive">*</span> <span className="text-muted-foreground font-normal">(min. 2)</span></Label>
              <div className="grid grid-cols-2 gap-2">
                {formations.map(t => {
                  const selected = packForm.pack_items.includes(t.code);
                  return (
                    <button key={t.code} type="button"
                      onClick={() => togglePackItem(t.code)}
                      className={[
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-[13px] transition-all",
                        selected ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card/50 text-muted-foreground hover:border-border/80",
                      ].join(" ")}
                    >
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${BADGE_COLOR[t.code] ?? BADGE_COLOR.AUTRE}`}>{t.code}</span>
                      <span className="truncate">{t.label.split("—")[1]?.trim() ?? t.code}</span>
                    </button>
                  );
                })}
              </div>
              {packForm.pack_items.length >= 2 && (
                <p className="text-[11px] text-muted-foreground">
                  Durée totale estimée : {autoDuration(packForm.pack_items)}h
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Résumé</Label>
              <Textarea rows={2} placeholder="Description du pack…"
                value={packForm.description} onChange={e => setPackForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prix par personne (€) <span className="text-destructive">*</span></Label>
                <Input type="number" min={0} step={0.01} value={packForm.prix_unitaire}
                  onChange={e => setPackForm(f => ({ ...f, prix_unitaire: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Durée (heures)</Label>
                <Input type="number" min={0} step={0.5}
                  placeholder={packForm.pack_items.length >= 2 ? String(autoDuration(packForm.pack_items)) : ""}
                  value={packForm.duration_hours || ""}
                  onChange={e => setPackForm(f => ({ ...f, duration_hours: parseFloat(e.target.value) || 0 }))} />
                <p className="text-[11px] text-muted-foreground">Laisser vide = somme automatique</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPackOpen(false)} disabled={savingPack}>Annuler</Button>
            <Button onClick={savePack} disabled={savingPack || packForm.pack_items.length < 2 || !packForm.label.trim()}>
              {savingPack ? "Création…" : "Créer le pack"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete pack confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce pack ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous allez supprimer le pack <strong>{deleteTarget?.label}</strong>. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deletePack} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Chapitres section ─────────────────────────────────────────────────────

function ChapitresSection() {
  const [cours, setCours] = useState<Cours[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCours, setEditingCours] = useState<Cours | null>(null);
  const [form, setForm] = useState<CoursForm>(EMPTY_COURS_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Cours | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");

  const fetchCours = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cours").select("*")
      .order("formation_type", { ascending: true })
      .order("chapitre_numero", { ascending: true });
    if (error) { toast.error("Erreur lors du chargement des cours"); }
    else {
      setCours(data || []);
      setExpandedTypes(new Set((data || []).map(c => c.formation_type)));
    }
    setLoading(false);
  };

  useEffect(() => { fetchCours(); }, []);

  const filteredCours = filterType === "all" ? cours : cours.filter(c => c.formation_type === filterType);
  const groupedCours = filteredCours.reduce<Record<string, Cours[]>>((acc, c) => {
    if (!acc[c.formation_type]) acc[c.formation_type] = [];
    acc[c.formation_type].push(c);
    return acc;
  }, {});

  const toggleType = (type: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const openCreate = (prefilledType?: string) => {
    setEditingCours(null);
    const typeToUse = prefilledType || "";
    const existingChapitres = cours.filter(c => c.formation_type === typeToUse).map(c => c.chapitre_numero);
    const nextNum = existingChapitres.length > 0 ? Math.max(...existingChapitres) + 1 : 1;
    setForm({ ...EMPTY_COURS_FORM, formation_type: typeToUse, chapitre_numero: typeToUse ? nextNum : 1 });
    setDialogOpen(true);
  };

  const openEdit = (c: Cours) => {
    setEditingCours(c);
    setForm({ formation_type: c.formation_type, chapitre_numero: c.chapitre_numero, titre: c.titre, contenu: c.contenu });
    setDialogOpen(true);
  };

  const handleTypeChange = (value: string) => {
    const existingChapitres = cours.filter(c => c.formation_type === value && c.id !== editingCours?.id).map(c => c.chapitre_numero);
    const nextNum = existingChapitres.length > 0 ? Math.max(...existingChapitres) + 1 : 1;
    setForm(prev => ({ ...prev, formation_type: value, chapitre_numero: nextNum }));
  };

  const handleSave = async () => {
    if (!form.formation_type) { toast.error("Veuillez sélectionner un type de formation"); return; }
    if (!form.titre.trim()) { toast.error("Le titre est obligatoire"); return; }
    if (!form.contenu.trim()) { toast.error("Le contenu est obligatoire"); return; }
    if (form.chapitre_numero < 1) { toast.error("Le numéro de chapitre doit être ≥ 1"); return; }
    setSaving(true);
    if (editingCours) {
      const { error } = await supabase.from("cours").update({ formation_type: form.formation_type, chapitre_numero: form.chapitre_numero, titre: form.titre.trim(), contenu: form.contenu.trim() }).eq("id", editingCours.id);
      if (error) toast.error("Erreur lors de la mise à jour");
      else { toast.success("Chapitre mis à jour"); setDialogOpen(false); fetchCours(); }
    } else {
      const { error } = await supabase.from("cours").insert({ formation_type: form.formation_type, chapitre_numero: form.chapitre_numero, titre: form.titre.trim(), contenu: form.contenu.trim() });
      if (error) toast.error("Erreur lors de la création");
      else { toast.success("Chapitre créé"); setDialogOpen(false); fetchCours(); }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("cours").delete().eq("id", deleteTarget.id);
    if (error) toast.error("Erreur lors de la suppression");
    else { toast.success(`Chapitre "${deleteTarget.titre}" supprimé`); setDeleteTarget(null); fetchCours(); }
    setDeleting(false);
  };

  const getTypeLabel = (value: string) => FORMATION_TYPES.find(t => t.value === value)?.label ?? value;

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{cours.length} chapitre{cours.length !== 1 ? "s" : ""}</p>
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-60 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les formations</SelectItem>
              {FORMATION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => openCreate()} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />Nouveau chapitre
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Chargement…</div>
      ) : Object.keys(groupedCours).length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground border border-dashed border-border/60 rounded-lg">
          <BookOpen className="h-8 w-8 opacity-30" />
          <p className="text-sm">Aucun chapitre</p>
          <Button variant="outline" size="sm" onClick={() => openCreate()}><Plus className="h-3.5 w-3.5 mr-1" />Créer le premier chapitre</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(groupedCours).map(([type, chapitres]) => (
            <div key={type} className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleType(type)}>
                <div className="flex items-center gap-3">
                  {expandedTypes.has(type) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${BADGE_COLOR[type] ?? BADGE_COLOR.AUTRE}`}>{type}</span>
                  <span className="font-medium text-sm">{getTypeLabel(type).split("—")[1]?.trim() ?? type}</span>
                  <span className="text-xs text-muted-foreground">{chapitres.length} chapitre{chapitres.length !== 1 ? "s" : ""}</span>
                </div>
                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={e => { e.stopPropagation(); openCreate(type); }}>
                  <Plus className="h-3 w-3" />Ajouter
                </Button>
              </div>
              {expandedTypes.has(type) && (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-16 text-center">N°</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead className="hidden md:table-cell">Aperçu</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chapitres.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold border ${BADGE_COLOR[type] ?? BADGE_COLOR.AUTRE}`}>{c.chapitre_numero}</span>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{c.titre}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-xs">
                          <span className="line-clamp-1">{c.contenu.length > 120 ? c.contenu.slice(0, 120) + "…" : c.contenu}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
          <DialogHeader><DialogTitle>{editingCours ? "Modifier le chapitre" : "Nouveau chapitre"}</DialogTitle></DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-1.5">
              <Label>Type de formation <span className="text-destructive">*</span></Label>
              <Select value={form.formation_type} onValueChange={handleTypeChange}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>{FORMATION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Numéro de chapitre <span className="text-destructive">*</span></Label>
              <Input type="number" min={1} value={form.chapitre_numero} onChange={e => setForm(prev => ({ ...prev, chapitre_numero: parseInt(e.target.value) || 1 }))} className="w-32" />
            </div>
            <div className="space-y-1.5">
              <Label>Titre <span className="text-destructive">*</span></Label>
              <Input placeholder="Ex : Les gestes de premiers secours" value={form.titre} onChange={e => setForm(prev => ({ ...prev, titre: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Contenu <span className="text-destructive">*</span></Label>
              <Textarea placeholder="Contenu du chapitre, objectifs pédagogiques…" value={form.contenu} onChange={e => setForm(prev => ({ ...prev, contenu: e.target.value }))} rows={10} className="resize-y min-h-[200px] font-mono text-sm" />
              <p className="text-xs text-muted-foreground">{form.contenu.length} caractères</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Enregistrement…" : editingCours ? "Mettre à jour" : "Créer le chapitre"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce chapitre ?</AlertDialogTitle>
            <AlertDialogDescription>
              Chapitre <strong>{deleteTarget?.chapitre_numero}. {deleteTarget?.titre}</strong> ({deleteTarget?.formation_type}) — irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

type PageTab = "catalogue" | "chapitres";

export default function AdminCours() {
  const [pageTab, setPageTab] = useState<PageTab>("catalogue");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Catalogue de formations</h1>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["catalogue", "chapitres"] as PageTab[]).map(t => (
          <button key={t} onClick={() => setPageTab(t)}
            className={["px-4 py-2 text-[13px] font-semibold tracking-tight transition-all border-b-2 -mb-px",
              pageTab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"].join(" ")}
          >
            {t === "catalogue" ? "Catalogue & tarifs" : "Contenu pédagogique"}
          </button>
        ))}
      </div>

      {pageTab === "catalogue" ? <CatalogueSection /> : <ChapitresSection />}
    </div>
  );
}

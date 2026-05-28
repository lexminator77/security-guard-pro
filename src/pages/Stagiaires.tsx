// @ts-nocheck
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CertificationsTab } from "@/components/CertificationsTab";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Trash2, Users, Upload, FileText, Download, ArrowLeft, Eye, Archive, RotateCcw, Shield, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  status: z.enum(["en_attente", "valide", "rejete", "archive"]),
});

const STATUS_COLOR: Record<string, string> = {
  valide: "bg-success/20 text-success border-success/30",
  en_attente: "bg-warning/20 text-warning border-warning/30",
  rejete: "bg-destructive/20 text-destructive border-destructive/30",
  archive: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<string, string> = {
  valide: "Validé",
  en_attente: "En attente",
  rejete: "Rejeté",
  archive: "Archivé",
};

const CNAPS_BADGE: Record<string, { label: string; cls: string }> = {
  vert:       { label: "CNAPS : Valide",      cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  rouge:      { label: "CNAPS : Problème",    cls: "bg-red-500/10 text-red-400 border-red-500/30" },
  a_verifier: { label: "CNAPS : À vérifier",  cls: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  inconnu:    { label: "CNAPS : Non vérifié", cls: "bg-muted/50 text-muted-foreground border-border/50" },
};

const addMonths = (dateStr: string, months: number): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

export default function Stagiaires() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("administrateur") || roles.includes("secretaire");
  const navigate = useNavigate();

  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [tab, setTab] = useState<"actif" | "archive" | "corbeille" | "activite">("actif");
  const [corbeille, setCorbeille] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loadingCorbeille, setLoadingCorbeille] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<any | null>(null);
  const [archiveNote, setArchiveNote] = useState("");
  const [archiveDialog, setArchiveDialog] = useState(false);
  const [ficheTab, setFicheTab] = useState<"documents" | "certifications">("documents");
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    autorisation_numero: "", autorisation_type: "prealable", autorisation_expiry: "",
    carte_pro_number: "", carte_pro_expiry: "",
    status: "en_attente" as const,
  });

  useEffect(() => { document.title = "Stagiaires — SecureCRM"; load(); }, []);

  useEffect(() => {
    if (tab === "corbeille") loadCorbeille();
    if (tab === "activite") loadAudit();
  }, [tab]);

  const load = async () => {
    const { data, error } = await supabase.from("stagiaires").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setList(data ?? []);
  };

  const loadDocs = async (stagiaireId: string) => {
    const { data, error } = await supabase
      .from("stagiaire_documents").select("*")
      .eq("stagiaire_id", stagiaireId).order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setDocs(data ?? []);
  };

  const openFiche = async (s: any) => {
    setSelected(s);
    setSelectedPhoto(null);
    loadDocs(s.id);
    const { data } = await supabase.from("stagiaire_photos").select("url").eq("stagiaire_id", s.id).single();
    if (data) setSelectedPhoto(data.url);
  };

  const handleAutorisationDate = (value: string) => {
    const expiry = value ? addMonths(value, 6) : "";
    setForm((prev: any) => ({ ...prev, autorisation_expiry: expiry }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = schema.parse(form);
      const payload: any = { ...parsed };
      const optionals = ["autorisation_numero", "autorisation_type", "autorisation_expiry", "carte_pro_number", "carte_pro_expiry"];
      optionals.forEach(k => { if (form[k]) payload[k] = form[k]; });
      if (!payload.email) delete payload.email;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("stagiaires").insert({ ...payload, created_by: user?.id, statut: "actif" });
      if (error) throw error;
      toast.success("Stagiaire ajouté");
      setOpen(false);
      setForm({ first_name: "", last_name: "", email: "", phone: "", autorisation_numero: "", autorisation_type: "prealable", autorisation_expiry: "", carte_pro_number: "", carte_pro_expiry: "", status: "en_attente" });
      load();
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message || err.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce stagiaire ?")) return;
    const { error } = await supabase.from("stagiaires").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Supprimé"); load(); }
  };

  const archiver = async () => {
    if (!selected) return;
    const { error } = await supabase.from("stagiaires").update({
      statut: "archive",
      archive_date: new Date().toISOString(),
      archive_note: archiveNote || null,
    }).eq("id", selected.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${selected.first_name} ${selected.last_name} archivé`);
    setArchiveDialog(false);
    setArchiveNote("");
    setSelected(null);
    load();
  };

  const loadCorbeille = async () => {
    setLoadingCorbeille(true);
    const { data } = await supabase
      .from("stagiaires")
      .select("*, deleted_by_profile:deleted_by(email)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    setCorbeille(data ?? []);
    setLoadingCorbeille(false);
  };

  const loadAudit = async () => {
    setLoadingAudit(true);
    const { data } = await supabase
      .from("audit_log")
      .select("*, user:user_id(email)")
      .eq("table_name", "stagiaires")
      .order("created_at", { ascending: false })
      .limit(100);
    setAuditLog(data ?? []);
    setLoadingAudit(false);
  };

  const restaurer = async (s: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("stagiaires").update({
      deleted_at: null,
      deleted_by: null,
    }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("audit_log").insert({
      organisme_id: "00000000-0000-0000-0000-000000000001",
      user_id: user!.id,
      user_role: "administrateur",
      action: "restore",
      table_name: "stagiaires",
      record_id: s.id,
      payload: { first_name: s.first_name, last_name: s.last_name },
    });
    toast.success(`${s.first_name} ${s.last_name} restauré`);
    loadCorbeille();
  };

  const hardDelete = async () => {
    if (!hardDeleteTarget) return;
    const { error } = await supabase.from("stagiaires").delete().eq("id", hardDeleteTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Stagiaire supprimé définitivement");
    setHardDeleteTarget(null);
    loadCorbeille();
  };

  const reactiver = async (s: any) => {
    if (!confirm(`Réactiver ${s.first_name} ${s.last_name} ?`)) return;
    const { error } = await supabase.from("stagiaires").update({
      statut: "actif", archive_date: null, archive_note: null,
    }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${s.first_name} ${s.last_name} réactivé`);
    if (selected?.id === s.id) setSelected({ ...s, statut: "actif" });
    load();
  };

  const uploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selected || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const path = `${selected.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(path);
      const { data: { user } } = await supabase.auth.getUser();
      const { error: dbError } = await supabase.from("stagiaire_documents").insert({
        stagiaire_id: selected.id, nom: file.name, url: publicUrl, type: file.type, created_by: user?.id,
      });
      if (dbError) throw dbError;
      toast.success("Document uploadé");
      loadDocs(selected.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeDoc = async (doc: any) => {
    if (!confirm("Supprimer ce document ?")) return;
    const path = doc.url.split("/documents/")[1];
    await supabase.storage.from("documents").remove([path]);
    const { error } = await supabase.from("stagiaire_documents").delete().eq("id", doc.id);
    if (error) toast.error(error.message); else { toast.success("Supprimé"); loadDocs(selected.id); }
  };

  const autorisationStatus = (expiry: string | null) => {
    if (!expiry) return null;
    const days = Math.round((new Date(expiry).getTime() - Date.now()) / 86400000);
    if (days < 0) return { label: "Expirée", color: "bg-destructive/20 text-destructive border-destructive/30" };
    if (days <= 30) return { label: `Expire dans ${days}j`, color: "bg-warning/20 text-warning border-warning/30" };
    return { label: `Valide jusqu'au ${new Date(expiry).toLocaleDateString("fr-FR")}`, color: "bg-success/20 text-success border-success/30" };
  };

  const actifs = list.filter((s) => s.statut !== "archive");
  const archives = list.filter((s) => s.statut === "archive");
  const filtered = (tab === "actif" ? actifs : archives).filter((s) =>
    `${s.first_name} ${s.last_name} ${s.email ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );

  // FICHE STAGIAIRE
  if (selected) {
    const isArchived = selected.statut === "archive";
    const autoStatus = autorisationStatus(selected.autorisation_expiry);
    const cnapsBadge = CNAPS_BADGE[selected.cnaps_statut ?? "inconnu"] ?? CNAPS_BADGE.inconnu;

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setSelected(null)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
        </div>

        <Card className="p-6 bg-card/60 border-border/50">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full overflow-hidden bg-muted border-2 border-primary/40 flex-shrink-0 flex items-center justify-center">
                {selectedPhoto ? (
                  <img src={selectedPhoto} alt="Photo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-muted-foreground">
                    {selected.first_name?.[0]}{selected.last_name?.[0]}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-display font-bold">{selected.first_name} {selected.last_name}</h2>
                <p className="text-muted-foreground text-sm mt-1">{selected.email || selected.phone || "Pas de contact"}</p>
                {isArchived && selected.archive_date && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Archivé le {new Date(selected.archive_date).toLocaleDateString("fr-FR")}
                    {selected.archive_note && ` — ${selected.archive_note}`}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={STATUS_COLOR[selected.status]}>
                {STATUS_LABEL[selected.status]}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/passeport-prevention/${selected.id}`)}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Passeport de prévention
              </Button>
              {isAdmin && (
                isArchived ? (
                  <Button size="sm" variant="outline" onClick={() => reactiver(selected)} className="gap-2">
                    <RotateCcw className="h-4 w-4" /> Réactiver
                  </Button>
                ) : (
                  <Dialog open={archiveDialog} onOpenChange={setArchiveDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-2 border-warning/40 text-warning hover:bg-warning/10">
                        <Archive className="h-4 w-4" /> Archiver
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card border-border">
                      <DialogHeader>
                        <DialogTitle>Archiver {selected.first_name} {selected.last_name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Ce stagiaire n'aura plus accès à l'espace stagiaire. Vous pourrez le réactiver à tout moment.
                        </p>
                        <div>
                          <Label>Note (optionnelle)</Label>
                          <Textarea
                            placeholder="Ex : Formation terminée, diplôme obtenu le 12/05/2026"
                            value={archiveNote}
                            onChange={(e) => setArchiveNote(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" onClick={() => setArchiveDialog(false)}>Annuler</Button>
                          <Button onClick={archiver} className="bg-warning text-warning-foreground hover:bg-warning/90">
                            Confirmer l'archivage
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Téléphone</p>
              <p>{selected.phone || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Email</p>
              <p>{selected.email || "—"}</p>
            </div>
          </div>

          <div className="border-t border-border/50 pt-4 mt-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Shield className="h-3.5 w-3.5" /> Autorisation CNAPS
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Type</p>
                <p className="capitalize">{selected.autorisation_type === "prealable" ? "Préalable" : selected.autorisation_type === "provisoire" ? "Provisoire" : "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">N° autorisation</p>
                <p className="font-mono">{selected.autorisation_numero || "—"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Validité</p>
                {autoStatus ? (
                  <Badge variant="outline" className={autoStatus.color}>{autoStatus.label}</Badge>
                ) : <p>—</p>}
              </div>
            </div>
          </div>

          {(selected.carte_pro_number || selected.carte_pro_expiry) && (
            <div className="border-t border-border/50 pt-4 mt-4">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-primary" /> Carte professionnelle CNAPS
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">N° carte pro</p>
                  <p className="font-mono">{selected.carte_pro_number || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Expiration</p>
                  <p>{selected.carte_pro_expiry ? new Date(selected.carte_pro_expiry).toLocaleDateString("fr-FR") : "—"}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="outline" className={`text-xs ${cnapsBadge.cls}`}>
                  {cnapsBadge.label}
                </Badge>
                {selected.cnaps_last_checked && (
                  <span className="text-xs text-muted-foreground">
                    vérifié le {new Date(selected.cnaps_last_checked).toLocaleDateString("fr-FR")}
                  </span>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* TABS: DOCUMENTS / CERTIFICATIONS */}
        <Card className="p-6 bg-card/60 border-border/50">
          <Tabs value={ficheTab} onValueChange={(v) => setFicheTab(v as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="certifications">Certifications</TabsTrigger>
            </TabsList>

            <TabsContent value="documents">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Documents
                </h3>
                {isAdmin && (
                  <div>
                    <input ref={fileRef} type="file" className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={uploadDoc} />
                    <Button onClick={() => fileRef.current?.click()} disabled={uploading}
                      className="gradient-primary text-primary-foreground" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? "Upload..." : "Ajouter un document"}
                    </Button>
                  </div>
                )}
              </div>
              {docs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
                  Aucun document pour ce stagiaire
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{doc.nom}</p>
                          <p className="text-xs text-muted-foreground">{new Date(doc.created_at).toLocaleDateString("fr-FR")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="icon" variant="ghost" asChild>
                          <a href={doc.url} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" /></a>
                        </Button>
                        <Button size="icon" variant="ghost" asChild>
                          <a href={doc.url} download={doc.nom}><Download className="h-4 w-4" /></a>
                        </Button>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={() => removeDoc(doc)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="certifications">
              <CertificationsTab stagiaireId={selected.id} />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    );
  }

  // LISTE STAGIAIRES
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow flex items-center gap-3">
            <Users className="h-7 w-7 text-primary" /> Stagiaires
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {actifs.length} actif(s) · {archives.length} archivé(s)
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground shadow-glow">
                <Plus className="h-4 w-4 mr-2" />Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Nouveau stagiaire</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Prénom *</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></div>
                  <div><Label>Nom *</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></div>
                </div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>

                <div className="border-t border-border pt-3">
                  <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" /> Autorisation CNAPS
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Obligatoire pour entrer en formation APS/SSIAP. Valable 6 mois — l'expiration se calcule automatiquement.
                  </p>
                  <div className="space-y-2">
                    <div>
                      <Label>Type d'autorisation</Label>
                      <Select value={form.autorisation_type} onValueChange={(v) => setForm({ ...form, autorisation_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="prealable">Préalable</SelectItem>
                          <SelectItem value="provisoire">Provisoire</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>N° autorisation</Label>
                        <Input value={form.autorisation_numero} onChange={(e) => setForm({ ...form, autorisation_numero: e.target.value })} placeholder="Ex: AP-2026-XXXX" />
                      </div>
                      <div>
                        <Label>Date de délivrance</Label>
                        <Input type="date" onChange={(e) => handleAutorisationDate(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label>Expiration (auto — 6 mois)</Label>
                      <Input type="date" value={form.autorisation_expiry} onChange={(e) => setForm({ ...form, autorisation_expiry: e.target.value })} className="bg-muted/30" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <h3 className="font-semibold text-sm mb-1">Carte professionnelle CNAPS</h3>
                  <p className="text-xs text-muted-foreground mb-3">À renseigner uniquement si le stagiaire est déjà agent avec une carte pro valide.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>N° carte pro</Label><Input value={form.carte_pro_number} onChange={(e) => setForm({ ...form, carte_pro_number: e.target.value })} /></div>
                    <div><Label>Expiration</Label><Input type="date" value={form.carte_pro_expiry} onChange={(e) => setForm({ ...form, carte_pro_expiry: e.target.value })} /></div>
                  </div>
                </div>

                <div>
                  <Label>Statut</Label>
                  <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en_attente">En attente</SelectItem>
                      <SelectItem value="valide">Validé</SelectItem>
                      <SelectItem value="rejete">Rejeté</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground">Enregistrer</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="p-4 bg-card/60 border-border/50">
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1">
            <TabsList>
              <TabsTrigger value="actif">
                Actifs <Badge variant="secondary" className="ml-2">{actifs.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="archive">
                Archivés <Badge variant="secondary" className="ml-2">{archives.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="corbeille">Corbeille</TabsTrigger>
              <TabsTrigger value="activite">Activité</TabsTrigger>
            </TabsList>
          </Tabs>
          {(tab === "actif" || tab === "archive") && (
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
        </div>

        {(tab === "actif" || tab === "archive") && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                  <th className="pb-3 px-2">Nom</th>
                  <th className="pb-3 px-2">Contact</th>
                  <th className="pb-3 px-2">Autorisation CNAPS</th>
                  <th className="pb-3 px-2">Expiration auto.</th>
                  <th className="pb-3 px-2">Statut</th>
                  <th className="pb-3 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">
                    {tab === "archive" ? "Aucun stagiaire archivé" : "Aucun stagiaire actif"}
                  </td></tr>
                )}
                {filtered.map((s) => {
                  const autoStatus = autorisationStatus(s.autorisation_expiry);
                  return (
                    <tr key={s.id}
                      className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => openFiche(s)}>
                      <td className="py-3 px-2 font-medium">{s.first_name} {s.last_name}</td>
                      <td className="py-3 px-2 text-muted-foreground">{s.email || s.phone || "—"}</td>
                      <td className="py-3 px-2 font-mono text-xs">{s.autorisation_numero || "—"}</td>
                      <td className="py-3 px-2">
                        {autoStatus ? (
                          <Badge variant="outline" className={`text-xs ${autoStatus.color}`}>{autoStatus.label}</Badge>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="py-3 px-2"><Badge variant="outline" className={STATUS_COLOR[s.status]}>{STATUS_LABEL[s.status]}</Badge></td>
                      <td className="py-3 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                        {isAdmin && (
                          tab === "archive" ? (
                            <Button size="sm" variant="ghost" onClick={() => reactiver(s)} className="text-primary">
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" onClick={() => remove(s.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === "corbeille" && (
          loadingCorbeille ? (
            <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
          ) : corbeille.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              La corbeille est vide
            </div>
          ) : (
            <div className="space-y-2">
              {corbeille.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">{s.last_name?.toUpperCase()} {s.first_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Archivé le {new Date(s.deleted_at).toLocaleDateString("fr-FR")}
                      {s.deleted_by_profile?.email && ` par ${s.deleted_by_profile.email}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10" onClick={() => restaurer(s)}>
                      <RotateCcw className="h-3.5 w-3.5" /> Restaurer
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setHardDeleteTarget(s)}>
                      <Trash2 className="h-3.5 w-3.5" /> Supprimer définitivement
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "activite" && (
          loadingAudit ? (
            <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
          ) : auditLog.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              Aucune activité enregistrée
            </div>
          ) : (
            <div className="space-y-1.5">
              {auditLog.map(log => {
                const actionLabel: Record<string, string> = {
                  create: "a créé",
                  update: "a modifié",
                  delete: "a archivé",
                  restore: "a restauré",
                };
                const actionColor: Record<string, string> = {
                  create: "text-emerald-500",
                  update: "text-blue-400",
                  delete: "text-red-400",
                  restore: "text-yellow-500",
                };
                const elapsed = Math.round((Date.now() - new Date(log.created_at).getTime()) / 60000);
                const elapsedStr = elapsed < 60
                  ? `il y a ${elapsed} min`
                  : elapsed < 1440
                  ? `il y a ${Math.round(elapsed / 60)}h`
                  : `le ${new Date(log.created_at).toLocaleDateString("fr-FR")}`;
                const stagiaireName = log.payload?.last_name
                  ? `${log.payload.last_name?.toUpperCase()} ${log.payload.first_name ?? ""}`
                  : log.record_id.slice(0, 8);

                return (
                  <div key={log.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/30 transition-colors">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-primary">
                        {log.user?.email?.[0]?.toUpperCase() ?? "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{log.user?.email ?? "Utilisateur inconnu"}</span>
                        {" "}
                        <span className={actionColor[log.action] ?? "text-foreground"}>{actionLabel[log.action] ?? log.action}</span>
                        {" "}
                        <span className="font-medium">{stagiaireName}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{elapsedStr}</p>
                    </div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${log.user_role === "formateur" ? "bg-blue-500/10 text-blue-400" : "bg-primary/10 text-primary"}`}>
                      {log.user_role}
                    </span>
                  </div>
                );
              })}
            </div>
          )
        )}
      </Card>

      <Dialog open={!!hardDeleteTarget} onOpenChange={() => setHardDeleteTarget(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Supprimer définitivement ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <b>{hardDeleteTarget?.first_name} {hardDeleteTarget?.last_name}</b> sera supprimé définitivement.
            Cette action est <b>irréversible</b>.
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setHardDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" className="flex-1" onClick={hardDelete}>Supprimer définitivement</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
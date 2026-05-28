// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Trash2, UserCheck, Pencil, Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { CERTS_FORMATEUR, alertLevel, badgeClass, formatDate } from "@/lib/certifications";

const schema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

type Formateur = any;

const empty = {
  first_name: "", last_name: "", email: "", phone: "",
  carte_pro_number: "", carte_pro_start: "", carte_pro_expiry: "",
  sst_date: "", sst_expiry: "",
  tfp_aps_date: "", tfp_aps_expiry: "",
  mac_aps_date: "", mac_aps_expiry: "",
  ssiap1_date: "", ssiap1_expiry: "",
  ssiap2_date: "", ssiap2_expiry: "",
  ssiap3_date: "", ssiap3_expiry: "",
  notes: "",
};

const addYears = (dateStr: string, years: number): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
};

const CERT_DURATIONS: Record<string, number> = {
  sst: 2,
  tfp_aps: 5,
  mac_aps: 5,
  ssiap1: 3,
  ssiap2: 3,
  ssiap3: 3,
};

export default function Formateurs() {
  const [list, setList] = useState<Formateur[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"actif" | "archive">("actif");
  const [filter, setFilter] = useState<"all" | "actif" | "inactif" | "alert">("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Formateur | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [archiveDialog, setArchiveDialog] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Formateur | null>(null);
  const [archiveNote, setArchiveNote] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [coursAutorises, setCoursAutorises] = useState<string[]>([]);

  useEffect(() => {
    document.title = "Formateurs — SecureCRM";
    load();
    supabase.from("formation_templates").select("code, label").eq("is_pack", false).order("code").then(({ data }) => {
      if (data) setTemplates(data);
    });
  }, []);

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: f }, { data: actives }] = await Promise.all([
      supabase.from("formateurs").select("*").order("last_name"),
      supabase.from("formations").select("formateur_id").lte("start_date", today).gte("end_date", today),
    ]);
    setList(f ?? []);
    setActiveIds(new Set((actives ?? []).map((x: any) => x.formateur_id).filter(Boolean)));
  };

  const openNew = () => { setEditing(null); setForm(empty); setCoursAutorises([]); setOpen(true); };
  const openEdit = (f: Formateur) => {
    setEditing(f);
    setForm({ ...empty, ...Object.fromEntries(Object.keys(empty).map(k => [k, f[k] ?? ""])) });
    setCoursAutorises(f.cours_autorises ?? []);
    setOpen(true);
  };

  // Quand on change la date début carte CNAPS → auto-remplit TFP APS
  const handleCarteStart = (value: string) => {
    const tfp_expiry = value ? addYears(value, 5) : "";
    setForm((prev: any) => ({
      ...prev,
      carte_pro_start: value,
      tfp_aps_date: value,
      tfp_aps_expiry: tfp_expiry,
    }));
  };

  // Quand on change une date d'obtention certification → calcul expiration auto
  const handleDateObtention = (key: string, value: string) => {
    const duration = CERT_DURATIONS[key];
    const expiry = duration && value ? addYears(value, duration) : "";
    setForm((prev: any) => ({
      ...prev,
      [`${key}_date`]: value,
      [`${key}_expiry`]: expiry,
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      schema.parse({ first_name: form.first_name, last_name: form.last_name, email: form.email, phone: form.phone });
      const payload: any = { ...form, cours_autorises: coursAutorises };
      Object.keys(payload).forEach(k => { if (payload[k] === "" ) payload[k] = null; });
      payload.cours_autorises = coursAutorises;
      if (editing) {
        const { error } = await supabase.from("formateurs").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Formateur mis à jour");
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("formateurs").insert({ ...payload, created_by: user?.id, statut: "actif" });
        if (error) throw error;
        toast.success("Formateur ajouté");
      }
      setOpen(false); load();
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message || err.message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce formateur ?")) return;
    const { error } = await supabase.from("formateurs").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Supprimé"); load(); }
  };

  const ouvrirArchive = (f: Formateur) => { setArchiveTarget(f); setArchiveNote(""); setArchiveDialog(true); };

  const archiver = async () => {
    if (!archiveTarget) return;
    const { error } = await supabase.from("formateurs").update({
      statut: "archive",
      archive_date: new Date().toISOString(),
      archive_note: archiveNote || null,
    }).eq("id", archiveTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${archiveTarget.first_name} ${archiveTarget.last_name} archivé`);
    setArchiveDialog(false); setArchiveTarget(null); load();
  };

  const reactiver = async (f: Formateur) => {
    if (!confirm(`Réactiver ${f.first_name} ${f.last_name} ?`)) return;
    const { error } = await supabase.from("formateurs").update({
      statut: "actif", archive_date: null, archive_note: null,
    }).eq("id", f.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${f.first_name} ${f.last_name} réactivé`); load();
  };

  const enriched = useMemo(() => list.map(f => {
    const isActive = activeIds.has(f.id);
    const levels = CERTS_FORMATEUR.map(c => alertLevel(f[c.date]));
    const hasAlert = levels.some(l => l === "expired" || l === "soon");
    return { ...f, _active: isActive, _hasAlert: hasAlert, _levels: levels };
  }), [list, activeIds]);

  const actifs = enriched.filter(f => f.statut !== "archive");
  const archives = enriched.filter(f => f.statut === "archive");
  const currentList = tab === "actif" ? actifs : archives;

  const filtered = currentList.filter(f => {
    if (q && !`${f.first_name} ${f.last_name} ${f.email ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (tab === "actif") {
      if (filter === "actif") return f._active;
      if (filter === "inactif") return !f._active;
      if (filter === "alert") return f._hasAlert;
    }
    return true;
  });

  const counts = {
    all: actifs.length,
    actif: actifs.filter(f => f._active).length,
    inactif: actifs.filter(f => !f._active).length,
    alert: actifs.filter(f => f._hasAlert).length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow flex items-center gap-3">
            <UserCheck className="h-7 w-7 text-primary" /> Formateurs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{actifs.length} actif(s) · {archives.length} archivé(s)</p>
        </div>
        <Button onClick={openNew} className="gradient-primary text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4 mr-2" />Ajouter
        </Button>
      </div>

      <Card className="p-4 bg-card/60 border-border/50">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setFilter("all"); }}>
            <TabsList>
              <TabsTrigger value="actif">Actifs <Badge variant="secondary" className="ml-2">{actifs.length}</Badge></TabsTrigger>
              <TabsTrigger value="archive">Archivés <Badge variant="secondary" className="ml-2">{archives.length}</Badge></TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === "actif" && (
            <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
              <TabsList>
                <TabsTrigger value="all">Tous ({counts.all})</TabsTrigger>
                <TabsTrigger value="actif">En formation ({counts.actif})</TabsTrigger>
                <TabsTrigger value="inactif">Disponibles ({counts.inactif})</TabsTrigger>
                <TabsTrigger value="alert">À renouveler ({counts.alert})</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="pb-3 px-2">Nom</th>
                <th className="pb-3 px-2">Statut</th>
                {CERTS_FORMATEUR.map(c => <th key={c.key} className="pb-3 px-2">{c.label}</th>)}
                {tab === "archive" && <th className="pb-3 px-2">Archivé le</th>}
                <th className="pb-3 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={CERTS_FORMATEUR.length + 4} className="py-12 text-center text-muted-foreground">
                  {tab === "archive" ? "Aucun formateur archivé" : "Aucun formateur"}
                </td></tr>
              )}
              {filtered.map((f) => (
                <tr key={f.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-2">
                    <div className="font-medium">{f.first_name} {f.last_name}</div>
                    <div className="text-xs text-muted-foreground">{f.email || f.phone || "—"}</div>
                    {tab === "archive" && f.archive_note && <div className="text-xs text-muted-foreground italic">{f.archive_note}</div>}
                  </td>
                  <td className="py-3 px-2">
                    {tab === "archive" ? (
                      <Badge className="bg-muted text-muted-foreground">Archivé</Badge>
                    ) : (
                      <Badge className={f._active ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}>
                        {f._active ? "En formation" : "Disponible"}
                      </Badge>
                    )}
                  </td>
                  {CERTS_FORMATEUR.map(c => {
                    const lvl = alertLevel(f[c.date]);
                    return (
                      <td key={c.key} className="py-3 px-2 whitespace-nowrap">
                        <Badge className={badgeClass(lvl)}>{formatDate(f[c.date])}</Badge>
                      </td>
                    );
                  })}
                  {tab === "archive" && (
                    <td className="py-3 px-2 text-xs text-muted-foreground whitespace-nowrap">
                      {f.archive_date ? new Date(f.archive_date).toLocaleDateString("fr-FR") : "—"}
                    </td>
                  )}
                  <td className="py-3 px-2 text-right whitespace-nowrap">
                    {tab === "archive" ? (
                      <Button size="sm" variant="ghost" onClick={() => reactiver(f)} className="text-primary gap-1">
                        <RotateCcw className="h-4 w-4" /> Réactiver
                      </Button>
                    ) : (
                      <>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => ouvrirArchive(f)} className="text-warning hover:text-warning hover:bg-warning/10"><Archive className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Dialog archivage */}
      <Dialog open={archiveDialog} onOpenChange={setArchiveDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Archiver {archiveTarget?.first_name} {archiveTarget?.last_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Ce formateur n'aura plus accès à l'espace formateur. Vous pourrez le réactiver à tout moment.</p>
            <div>
              <Label>Note (optionnelle)</Label>
              <Textarea placeholder="Ex : Mission terminée, départ le 12/05/2026" value={archiveNote} onChange={(e) => setArchiveNote(e.target.value)} className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setArchiveDialog(false)}>Annuler</Button>
              <Button onClick={archiver} className="bg-warning text-warning-foreground hover:bg-warning/90">Confirmer l'archivage</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog ajout/édition */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Modifier le formateur" : "Nouveau formateur"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">

            {/* Infos perso */}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prénom *</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></div>
              <div><Label>Nom *</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>

            {/* Carte CNAPS */}
            <div className="border-t border-border pt-3">
              <h3 className="font-semibold text-sm mb-1">Carte CNAPS</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Saisir les dates telles qu'indiquées sur la carte délivrée par le CNAPS.<br />
                La date de début remplit automatiquement le TFP APS.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>N° carte pro</Label><Input value={form.carte_pro_number} onChange={(e) => setForm({ ...form, carte_pro_number: e.target.value })} /></div>
                <div>
                  <Label>Date de début</Label>
                  <Input type="date" value={form.carte_pro_start} onChange={(e) => handleCarteStart(e.target.value)} />
                </div>
                <div>
                  <Label>Date de fin</Label>
                  <Input type="date" value={form.carte_pro_expiry} onChange={(e) => setForm({ ...form, carte_pro_expiry: e.target.value })} />
                </div>
              </div>
            </div>

            {/* TFP APS — auto-rempli depuis carte CNAPS */}
            <div className="border-t border-border pt-3">
              <h3 className="font-semibold text-sm mb-1">TFP APS <span className="text-xs font-normal text-muted-foreground">(auto depuis carte CNAPS)</span></h3>
              <p className="text-xs text-muted-foreground mb-3">Validité 5 ans — rempli automatiquement depuis la date de début de carte CNAPS.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date d'obtention</Label>
                  <Input type="date" value={form.tfp_aps_date} onChange={(e) => handleDateObtention("tfp_aps", e.target.value)} className="bg-muted/30" />
                </div>
                <div>
                  <Label>Expiration (auto)</Label>
                  <Input type="date" value={form.tfp_aps_expiry} onChange={(e) => setForm({ ...form, tfp_aps_expiry: e.target.value })} className="bg-muted/30" />
                </div>
              </div>
            </div>

            {/* MAC APS */}
            <div className="border-t border-border pt-3">
              <h3 className="font-semibold text-sm mb-1">MAC APS</h3>
              <p className="text-xs text-muted-foreground mb-3">Validité 5 ans — à renseigner uniquement si un MAC a été effectué. L'expiration se calcule automatiquement.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date du MAC</Label>
                  <Input type="date" value={form.mac_aps_date} onChange={(e) => handleDateObtention("mac_aps", e.target.value)} />
                </div>
                <div>
                  <Label>Expiration (auto)</Label>
                  <Input type="date" value={form.mac_aps_expiry} onChange={(e) => setForm({ ...form, mac_aps_expiry: e.target.value })} className="bg-muted/30" />
                </div>
              </div>
            </div>

            {/* SST */}
            <div className="border-t border-border pt-3">
              <h3 className="font-semibold text-sm mb-1">SST</h3>
              <p className="text-xs text-muted-foreground mb-3">Validité 2 ans — MAC SST 1 jour tous les 2 ans. L'expiration se calcule automatiquement.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date d'obtention / dernier MAC</Label>
                  <Input type="date" value={form.sst_date} onChange={(e) => handleDateObtention("sst", e.target.value)} />
                </div>
                <div>
                  <Label>Expiration (auto)</Label>
                  <Input type="date" value={form.sst_expiry} onChange={(e) => setForm({ ...form, sst_expiry: e.target.value })} className="bg-muted/30" />
                </div>
              </div>
            </div>

            {/* SSIAP 1/2/3 */}
            {[
              { k: "ssiap1", l: "SSIAP 1" },
              { k: "ssiap2", l: "SSIAP 2" },
              { k: "ssiap3", l: "SSIAP 3" },
            ].map(({ k, l }) => (
              <div key={k} className="border-t border-border pt-3">
                <h3 className="font-semibold text-sm mb-1">{l}</h3>
                <p className="text-xs text-muted-foreground mb-3">Validité 3 ans — MAC 2 jours tous les 3 ans. L'expiration se calcule automatiquement.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date d'obtention / dernier MAC</Label>
                    <Input type="date" value={form[`${k}_date`]} onChange={(e) => handleDateObtention(k, e.target.value)} />
                  </div>
                  <div>
                    <Label>Expiration (auto)</Label>
                    <Input type="date" value={form[`${k}_expiry`]} onChange={(e) => setForm({ ...form, [`${k}_expiry`]: e.target.value })} className="bg-muted/30" />
                  </div>
                </div>
              </div>
            ))}

            {/* Cours autorisés */}
            <div className="border-t border-border pt-3">
              <h3 className="font-semibold text-sm mb-1">Cours visibles (accès supplémentaires)</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Le formateur voit automatiquement les cours des formations où il est assigné.
                Cochez ici pour lui donner accès à des cours supplémentaires.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {templates.map(t => {
                  const checked = coursAutorises.includes(t.code);
                  return (
                    <label key={t.code} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${checked ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setCoursAutorises(prev =>
                          checked ? prev.filter(c => c !== t.code) : [...prev, t.code]
                        )}
                        className="accent-primary"
                      />
                      <span className="text-sm font-medium">{t.code}</span>
                      <span className="text-xs text-muted-foreground truncate">{t.label.split("—")[1]?.trim() ?? t.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <Button type="submit" className="w-full gradient-primary text-primary-foreground">Enregistrer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
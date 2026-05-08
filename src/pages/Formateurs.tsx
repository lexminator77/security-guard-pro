import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Trash2, UserCheck, Pencil } from "lucide-react";
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
  carte_pro_number: "", carte_pro_expiry: "",
  sst_date: "", sst_expiry: "",
  tfp_aps_date: "", tfp_aps_expiry: "",
  mac_aps_date: "", mac_aps_expiry: "",
  ssiap1_date: "", ssiap1_expiry: "",
  ssiap2_date: "", ssiap2_expiry: "",
  ssiap3_date: "", ssiap3_expiry: "",
  notes: "",
};

export default function Formateurs() {
  const [list, setList] = useState<Formateur[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "actif" | "inactif" | "alert">("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Formateur | null>(null);
  const [form, setForm] = useState<any>(empty);

  useEffect(() => { document.title = "Formateurs — SecureCRM"; load(); }, []);

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [{ data: f }, { data: actives }] = await Promise.all([
      supabase.from("formateurs").select("*").order("last_name"),
      supabase.from("formations").select("formateur_id").lte("start_date", today).gte("end_date", today),
    ]);
    setList(f ?? []);
    setActiveIds(new Set((actives ?? []).map((x: any) => x.formateur_id).filter(Boolean)));
  };

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (f: Formateur) => {
    setEditing(f);
    setForm({ ...empty, ...Object.fromEntries(Object.keys(empty).map(k => [k, f[k] ?? ""])) });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      schema.parse({ first_name: form.first_name, last_name: form.last_name, email: form.email, phone: form.phone });
      const payload: any = { ...form };
      Object.keys(payload).forEach(k => { if (payload[k] === "") payload[k] = null; });
      if (editing) {
        const { error } = await supabase.from("formateurs").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Formateur mis à jour");
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("formateurs").insert({ ...payload, created_by: user?.id });
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

  const enriched = useMemo(() => list.map(f => {
    const isActive = activeIds.has(f.id);
    const levels = CERTS_FORMATEUR.map(c => alertLevel(f[c.date]));
    const hasAlert = levels.some(l => l === "expired" || l === "soon");
    return { ...f, _active: isActive, _hasAlert: hasAlert, _levels: levels };
  }), [list, activeIds]);

  const filtered = enriched.filter(f => {
    if (q && !`${f.first_name} ${f.last_name} ${f.email ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "actif") return f._active;
    if (filter === "inactif") return !f._active;
    if (filter === "alert") return f._hasAlert;
    return true;
  });

  const counts = {
    all: enriched.length,
    actif: enriched.filter(f => f._active).length,
    inactif: enriched.filter(f => !f._active).length,
    alert: enriched.filter(f => f._hasAlert).length,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow flex items-center gap-3">
            <UserCheck className="h-7 w-7 text-primary" /> Formateurs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{list.length} formateur(s) — statut calculé selon les formations en cours</p>
        </div>
        <Button onClick={openNew} className="gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
      </div>

      <Card className="p-4 bg-card/60 border-border/50">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
            <TabsList>
              <TabsTrigger value="all">Tous ({counts.all})</TabsTrigger>
              <TabsTrigger value="actif">Actifs ({counts.actif})</TabsTrigger>
              <TabsTrigger value="inactif">Inactifs ({counts.inactif})</TabsTrigger>
              <TabsTrigger value="alert">À renouveler ({counts.alert})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="pb-3 px-2">Nom</th>
                <th className="pb-3 px-2">Statut</th>
                {CERTS_FORMATEUR.map(c => <th key={c.key} className="pb-3 px-2">{c.label}</th>)}
                <th className="pb-3 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={CERTS_FORMATEUR.length + 3} className="py-12 text-center text-muted-foreground">Aucun formateur</td></tr>
              )}
              {filtered.map((f) => (
                <tr key={f.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-2">
                    <div className="font-medium">{f.first_name} {f.last_name}</div>
                    <div className="text-xs text-muted-foreground">{f.email || f.phone || "—"}</div>
                  </td>
                  <td className="py-3 px-2">
                    <Badge className={f._active ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}>
                      {f._active ? "Actif" : "Inactif"}
                    </Badge>
                  </td>
                  {CERTS_FORMATEUR.map(c => {
                    const lvl = alertLevel(f[c.date]);
                    return (
                      <td key={c.key} className="py-3 px-2 whitespace-nowrap">
                        <Badge className={badgeClass(lvl)}>{formatDate(f[c.date])}</Badge>
                      </td>
                    );
                  })}
                  <td className="py-3 px-2 text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Modifier le formateur" : "Nouveau formateur"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prénom *</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></div>
              <div><Label>Nom *</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>

            <div className="border-t border-border pt-3">
              <h3 className="font-semibold text-sm mb-3">Carte CNAPS</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>N° carte pro</Label><Input value={form.carte_pro_number} onChange={(e) => setForm({ ...form, carte_pro_number: e.target.value })} /></div>
                <div><Label>Expiration</Label><Input type="date" value={form.carte_pro_expiry} onChange={(e) => setForm({ ...form, carte_pro_expiry: e.target.value })} /></div>
              </div>
            </div>

            {[
              { k: "sst", l: "SST" },
              { k: "tfp_aps", l: "TFP APS" },
              { k: "mac_aps", l: "MAC APS" },
              { k: "ssiap1", l: "SSIAP 1" },
              { k: "ssiap2", l: "SSIAP 2" },
              { k: "ssiap3", l: "SSIAP 3" },
            ].map(({ k, l }) => (
              <div key={k} className="border-t border-border pt-3">
                <h3 className="font-semibold text-sm mb-3">{l}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Date d'obtention</Label><Input type="date" value={form[`${k}_date`]} onChange={(e) => setForm({ ...form, [`${k}_date`]: e.target.value })} /></div>
                  <div><Label>Expiration</Label><Input type="date" value={form[`${k}_expiry`]} onChange={(e) => setForm({ ...form, [`${k}_expiry`]: e.target.value })} /></div>
                </div>
              </div>
            ))}

            <Button type="submit" className="w-full gradient-primary text-primary-foreground">Enregistrer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

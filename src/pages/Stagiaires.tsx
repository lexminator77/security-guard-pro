import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  first_name: z.string().trim().min(1).max(100),
  last_name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  carte_pro_number: z.string().trim().max(50).optional().or(z.literal("")),
  carte_pro_expiry: z.string().optional().or(z.literal("")),
  status: z.enum(["en_attente", "valide", "rejete", "archive"]),
});

const STATUS_COLOR: Record<string, string> = {
  valide: "bg-success/20 text-success border-success/30",
  en_attente: "bg-warning/20 text-warning border-warning/30",
  rejete: "bg-destructive/20 text-destructive border-destructive/30",
  archive: "bg-muted text-muted-foreground border-border",
};

export default function Stagiaires() {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", carte_pro_number: "", carte_pro_expiry: "", status: "en_attente" as const });

  useEffect(() => { document.title = "Stagiaires — SecureCRM"; load(); }, []);

  const load = async () => {
    const { data, error } = await supabase.from("stagiaires").select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message); else setList(data ?? []);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsed = schema.parse(form);
      const payload: any = { ...parsed };
      if (!payload.carte_pro_expiry) delete payload.carte_pro_expiry;
      if (!payload.email) delete payload.email;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("stagiaires").insert({ ...payload, created_by: user?.id });
      if (error) throw error;
      toast.success("Stagiaire ajouté");
      setOpen(false);
      setForm({ first_name: "", last_name: "", email: "", phone: "", carte_pro_number: "", carte_pro_expiry: "", status: "en_attente" });
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

  const filtered = list.filter((s) =>
    `${s.first_name} ${s.last_name} ${s.email ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow flex items-center gap-3">
            <Users className="h-7 w-7 text-primary" /> Stagiaires
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{list.length} fiche(s) au total</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Nouveau stagiaire</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Prénom *</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></div>
                <div><Label>Nom *</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></div>
              </div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Téléphone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>N° carte pro</Label><Input value={form.carte_pro_number} onChange={(e) => setForm({ ...form, carte_pro_number: e.target.value })} /></div>
                <div><Label>Expiration</Label><Input type="date" value={form.carte_pro_expiry} onChange={(e) => setForm({ ...form, carte_pro_expiry: e.target.value })} /></div>
              </div>
              <div>
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en_attente">En attente</SelectItem>
                    <SelectItem value="valide">Validé</SelectItem>
                    <SelectItem value="rejete">Rejeté</SelectItem>
                    <SelectItem value="archive">Archivé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground">Enregistrer</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4 bg-card/60 border-border/50">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher par nom, email…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="pb-3 px-2">Nom</th>
                <th className="pb-3 px-2">Contact</th>
                <th className="pb-3 px-2">Carte pro</th>
                <th className="pb-3 px-2">Expiration</th>
                <th className="pb-3 px-2">Statut</th>
                <th className="pb-3 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Aucun stagiaire</td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-2 font-medium">{s.first_name} {s.last_name}</td>
                  <td className="py-3 px-2 text-muted-foreground">{s.email || s.phone || "—"}</td>
                  <td className="py-3 px-2 font-mono text-xs">{s.carte_pro_number || "—"}</td>
                  <td className="py-3 px-2 text-xs">{s.carte_pro_expiry ? new Date(s.carte_pro_expiry).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="py-3 px-2"><Badge variant="outline" className={STATUS_COLOR[s.status]}>{s.status}</Badge></td>
                  <td className="py-3 px-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

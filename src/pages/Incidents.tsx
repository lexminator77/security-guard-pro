import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

const SEV_COLOR: Record<string, string> = {
  faible: "border-muted text-muted-foreground",
  moyen: "border-primary/40 text-primary",
  eleve: "border-warning/40 text-warning",
  critique: "border-destructive/40 text-destructive",
};
const STATUS_COLOR: Record<string, string> = {
  ouvert: "bg-destructive/20 text-destructive border-destructive/30",
  en_cours: "bg-warning/20 text-warning border-warning/30",
  resolu: "bg-success/20 text-success border-success/30",
};

export default function Incidents() {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", severity: "moyen", location: "", occurred_at: new Date().toISOString().slice(0, 16) });

  useEffect(() => { document.title = "Incidents — SecureCRM"; load(); }, []);

  const load = async () => {
    const { data, error } = await supabase.from("incidents").select("*").order("occurred_at", { ascending: false });
    if (error) toast.error(error.message); else setList(data ?? []);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { toast.error("Titre requis"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("incidents").insert({
      title: form.title, description: form.description, severity: form.severity as any,
      location: form.location, occurred_at: new Date(form.occurred_at).toISOString(),
      author_id: user.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Incident enregistré");
    setOpen(false);
    setForm({ title: "", description: "", severity: "moyen", location: "", occurred_at: new Date().toISOString().slice(0, 16) });
    load();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("incidents").update({ status: status as any }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ?")) return;
    const { error } = await supabase.from("incidents").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Supprimé"); load(); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow flex items-center gap-3">
            <AlertTriangle className="h-7 w-7 text-warning" /> Main courante
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{list.length} incident(s) enregistré(s)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2" />Déclarer</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Nouvel incident</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Titre *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Gravité</Label>
                  <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="faible">Faible</SelectItem>
                      <SelectItem value="moyen">Moyen</SelectItem>
                      <SelectItem value="eleve">Élevé</SelectItem>
                      <SelectItem value="critique">Critique</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Date / heure</Label><Input type="datetime-local" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} /></div>
              </div>
              <div><Label>Lieu</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} /></div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground">Enregistrer</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {list.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground bg-card/40 border-dashed">Aucun incident enregistré.</Card>
        )}
        {list.map((i) => (
          <Card key={i.id} className="p-5 bg-card/60 border-border/50 hover:border-primary/30 transition-all">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline" className={SEV_COLOR[i.severity]}>{i.severity}</Badge>
                  <Badge variant="outline" className={STATUS_COLOR[i.status]}>{i.status.replace("_", " ")}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(i.occurred_at).toLocaleString("fr-FR")}</span>
                </div>
                <h3 className="font-display font-semibold">{i.title}</h3>
                {i.location && <p className="text-xs text-muted-foreground mt-1">📍 {i.location}</p>}
                {i.description && <p className="text-sm text-muted-foreground mt-2">{i.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Select value={i.status} onValueChange={(v) => setStatus(i.id, v)}>
                  <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ouvert">Ouvert</SelectItem>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="resolu">Résolu</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={() => remove(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

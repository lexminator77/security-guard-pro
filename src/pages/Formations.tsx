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
import { Plus, GraduationCap, Trash2, Calendar, MapPin } from "lucide-react";
import { toast } from "sonner";

const TYPES = ["APS", "SST", "SSIAP1", "SSIAP2", "SSIAP3", "MAC_APS", "H0B0", "AUTRE"];

export default function Formations() {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "APS", description: "", start_date: "", end_date: "", location: "", max_participants: 12 });

  useEffect(() => { document.title = "Formations — SecureCRM"; load(); }, []);

  const load = async () => {
    const { data, error } = await supabase.from("formations").select("*").order("start_date", { ascending: false });
    if (error) toast.error(error.message); else setList(data ?? []);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.start_date || !form.end_date) { toast.error("Champs requis manquants"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("formations").insert({ ...form, type: form.type as any, created_by: user?.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Formation créée");
    setOpen(false);
    setForm({ title: "", type: "APS", description: "", start_date: "", end_date: "", location: "", max_participants: 12 });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette formation ?")) return;
    const { error } = await supabase.from("formations").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Supprimée"); load(); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow flex items-center gap-3">
            <GraduationCap className="h-7 w-7 text-primary" /> Formations
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{list.length} session(s)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2" />Nouvelle session</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>Nouvelle formation</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Titre *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Places max</Label><Input type="number" value={form.max_participants} onChange={(e) => setForm({ ...form, max_participants: +e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Début *</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required /></div>
                <div><Label>Fin *</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required /></div>
              </div>
              <div><Label>Lieu</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground">Créer</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.length === 0 && (
          <Card className="col-span-full p-12 text-center text-muted-foreground bg-card/40 border-dashed">
            Aucune formation. Créez votre première session.
          </Card>
        )}
        {list.map((f) => (
          <Card key={f.id} className="p-5 bg-card/60 border-border/50 hover:border-primary/40 hover:shadow-glow transition-all group">
            <div className="flex items-start justify-between mb-3">
              <Badge variant="outline" className="border-primary/40 text-primary">{f.type}</Badge>
              <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => remove(f.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <h3 className="font-display font-semibold mb-2">{f.title}</h3>
            {f.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{f.description}</p>}
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />{new Date(f.start_date).toLocaleDateString("fr-FR")} → {new Date(f.end_date).toLocaleDateString("fr-FR")}</div>
              {f.location && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{f.location}</div>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

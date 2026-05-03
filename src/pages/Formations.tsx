import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, GraduationCap, Trash2, Calendar, MapPin, Users, UserPlus } from "lucide-react";
import { toast } from "sonner";

const TYPES = ["APS", "SST", "SSIAP1", "SSIAP2", "SSIAP3", "MAC_APS", "H0B0", "AUTRE"];
const PARTICIPANT_STATUSES = ["inscrit", "present", "absent", "valide", "echec"] as const;

type Stagiaire = { id: string; first_name: string; last_name: string; email: string | null };
type Participant = { id: string; stagiaire_id: string; status: string; stagiaire?: Stagiaire };

// Returns set of stagiaire IDs already booked on a session overlapping [start,end], excluding `excludeFormationId`.
const getBusyStagiaireIds = (
  formations: any[],
  participantsByFormation: Record<string, Participant[]>,
  start: string,
  end: string,
  excludeFormationId?: string,
): Set<string> => {
  const busy = new Set<string>();
  if (!start || !end) return busy;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  for (const f of formations) {
    if (excludeFormationId && f.id === excludeFormationId) continue;
    const fs = new Date(f.start_date).getTime();
    const fe = new Date(f.end_date).getTime();
    if (fs <= e && fe >= s) {
      (participantsByFormation[f.id] ?? []).forEach((p) => busy.add(p.stagiaire_id));
    }
  }
  return busy;
};

export default function Formations() {
  const [list, setList] = useState<any[]>([]);
  const [stagiaires, setStagiaires] = useState<Stagiaire[]>([]);
  const [participantsByFormation, setParticipantsByFormation] = useState<Record<string, Participant[]>>({});
  const [open, setOpen] = useState(false);
  const [selectedStagiaires, setSelectedStagiaires] = useState<string[]>([]);
  const [form, setForm] = useState({ title: "", type: "APS", description: "", start_date: "", end_date: "", location: "", max_participants: 12 });

  // Manage-participants dialog
  const [manageOpen, setManageOpen] = useState(false);
  const [manageFormation, setManageFormation] = useState<any | null>(null);
  const [manageSelected, setManageSelected] = useState<string[]>([]);

  useEffect(() => { document.title = "Formations — SecureCRM"; load(); }, []);

  const load = async () => {
    const [{ data: f, error: ef }, { data: s, error: es }, { data: p, error: ep }] = await Promise.all([
      supabase.from("formations").select("*").order("start_date", { ascending: false }),
      supabase.from("stagiaires").select("id, first_name, last_name, email").order("last_name"),
      supabase.from("formation_participants").select("id, formation_id, stagiaire_id, status, stagiaire:stagiaires(id, first_name, last_name, email)"),
    ]);
    if (ef || es || ep) { toast.error((ef || es || ep)!.message); return; }
    setList(f ?? []);
    setStagiaires((s ?? []) as Stagiaire[]);
    const grouped: Record<string, Participant[]> = {};
    (p ?? []).forEach((row: any) => {
      grouped[row.formation_id] ??= [];
      grouped[row.formation_id].push(row);
    });
    setParticipantsByFormation(grouped);
  };

  const toggleStagiaire = (id: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.start_date || !form.end_date) { toast.error("Champs requis manquants"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { data: created, error } = await supabase
      .from("formations")
      .insert({ ...form, type: form.type as any, created_by: user?.id })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }

    if (selectedStagiaires.length > 0 && created) {
      const rows = selectedStagiaires.map((sid) => ({ formation_id: created.id, stagiaire_id: sid }));
      const { error: e2 } = await supabase.from("formation_participants").insert(rows);
      if (e2) toast.error("Formation créée mais erreur stagiaires : " + e2.message);
    }

    toast.success(`Formation créée${selectedStagiaires.length ? ` avec ${selectedStagiaires.length} stagiaire(s)` : ""}`);
    setOpen(false);
    setForm({ title: "", type: "APS", description: "", start_date: "", end_date: "", location: "", max_participants: 12 });
    setSelectedStagiaires([]);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette formation ?")) return;
    const { error } = await supabase.from("formations").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Supprimée"); load(); }
  };

  const openManage = (f: any) => {
    setManageFormation(f);
    setManageSelected((participantsByFormation[f.id] ?? []).map((p) => p.stagiaire_id));
    setManageOpen(true);
  };

  const saveManage = async () => {
    if (!manageFormation) return;
    const current = (participantsByFormation[manageFormation.id] ?? []).map((p) => p.stagiaire_id);
    const toAdd = manageSelected.filter((id) => !current.includes(id));
    const toRemove = current.filter((id) => !manageSelected.includes(id));

    if (toAdd.length) {
      const { error } = await supabase.from("formation_participants").insert(
        toAdd.map((sid) => ({ formation_id: manageFormation.id, stagiaire_id: sid }))
      );
      if (error) { toast.error(error.message); return; }
    }
    if (toRemove.length) {
      const { error } = await supabase
        .from("formation_participants")
        .delete()
        .eq("formation_id", manageFormation.id)
        .in("stagiaire_id", toRemove);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Participants mis à jour");
    setManageOpen(false);
    load();
  };

  const updateParticipantStatus = async (participantId: string, status: string) => {
    const { error } = await supabase
      .from("formation_participants")
      .update({ status: status as any })
      .eq("id", participantId);
    if (error) toast.error(error.message); else { toast.success("Statut mis à jour"); load(); }
  };

  const StagiairesPicker = ({ selected, onToggle, busy }: { selected: string[]; onToggle: (id: string) => void; busy: Set<string> }) => {
    const available = stagiaires.filter((s) => !busy.has(s.id));
    return (
      <ScrollArea className="h-48 rounded-md border border-border/60 bg-background/40 p-2">
        {stagiaires.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">Aucun stagiaire. Créez-en d'abord dans l'onglet Stagiaires.</p>
        ) : available.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">Aucun stagiaire disponible sur ces dates (tous déjà inscrits sur une autre session).</p>
        ) : available.map((s) => (
          <label key={s.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/40 cursor-pointer">
            <Checkbox checked={selected.includes(s.id)} onCheckedChange={() => onToggle(s.id)} />
            <span className="text-sm">{s.last_name.toUpperCase()} {s.first_name}</span>
            {s.email && <span className="text-xs text-muted-foreground ml-auto">{s.email}</span>}
          </label>
        ))}
        {busy.size > 0 && available.length > 0 && (
          <p className="text-[10px] text-muted-foreground/70 mt-2 px-1">{busy.size} stagiaire(s) masqué(s) car déjà inscrit(s) sur ces dates.</p>
        )}
      </ScrollArea>
    );
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
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
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
              <div>
                <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Stagiaires inscrits ({selectedStagiaires.length})</Label>
                <StagiairesPicker selected={selectedStagiaires} onToggle={(id) => toggleStagiaire(id, selectedStagiaires, setSelectedStagiaires)} />
              </div>
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
        {list.map((f) => {
          const ps = participantsByFormation[f.id] ?? [];
          return (
            <Card key={f.id} className="p-5 bg-card/60 border-border/50 hover:border-primary/40 hover:shadow-glow transition-all group">
              <div className="flex items-start justify-between mb-3">
                <Badge variant="outline" className="border-primary/40 text-primary">{f.type}</Badge>
                <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => remove(f.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <h3 className="font-display font-semibold mb-2">{f.title}</h3>
              {f.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{f.description}</p>}
              <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" />{new Date(f.start_date).toLocaleDateString("fr-FR")} → {new Date(f.end_date).toLocaleDateString("fr-FR")}</div>
                {f.location && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{f.location}</div>}
                <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />{ps.length}/{f.max_participants ?? "∞"} stagiaire(s)</div>
              </div>

              {ps.length > 0 && (
                <div className="space-y-1 mb-3 max-h-32 overflow-y-auto pr-1">
                  {ps.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-xs bg-muted/30 rounded px-2 py-1">
                      <span className="truncate">{p.stagiaire?.last_name?.toUpperCase()} {p.stagiaire?.first_name}</span>
                      <Select value={p.status} onValueChange={(v) => updateParticipantStatus(p.id, v)}>
                        <SelectTrigger className="h-6 w-[88px] text-[10px] border-border/60"><SelectValue /></SelectTrigger>
                        <SelectContent>{PARTICIPANT_STATUSES.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}

              <Button size="sm" variant="outline" className="w-full border-primary/30 text-primary hover:bg-primary/10" onClick={() => openManage(f)}>
                <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Gérer les stagiaires
              </Button>
            </Card>
          );
        })}
      </div>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Stagiaires — {manageFormation?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{manageSelected.length} sélectionné(s)</p>
            <StagiairesPicker selected={manageSelected} onToggle={(id) => toggleStagiaire(id, manageSelected, setManageSelected)} />
            <Button className="w-full gradient-primary text-primary-foreground" onClick={saveManage}>Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, Award, ChevronDown, ChevronUp, ChevronLeft, CheckCircle, X, Users } from "lucide-react";
import { toast } from "sonner";

const TYPES = ["SST", "APS", "MAC_APS", "SSIAP1", "SSIAP2", "SSIAP3", "EPI", "AUTRE"];

const STATUS_COLOR: Record<string, string> = {
  valide: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  en_attente: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  rejete: "bg-red-500/20 text-red-400 border-red-500/30",
  archive: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

const STATUS_LABEL: Record<string, string> = {
  valide: "Validé", en_attente: "En attente", rejete: "Rejeté", archive: "Archivé",
};

export default function Competences() {
  const [tab, setTab] = useState<"referentiel" | "stagiaires">("stagiaires");
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [openType, setOpenType] = useState<string | null>(null);
  const [form, setForm] = useState({ formation_type: "SST", titre: "", description: "", ordre: 0 });

  const [stagiaires, setStagiaires] = useState<any[]>([]);
  const [stagiairesStats, setStagiairesStats] = useState<Record<string, {
    validees: number;
    total: number;
    formations: string[];
  }>>({});
  const [selectedStagiaire, setSelectedStagiaire] = useState<any | null>(null);
  const [stagiaireCompetences, setStagiaireCompetences] = useState<any[]>([]);
  const [loadingComp, setLoadingComp] = useState(false);

  useEffect(() => { document.title = "Compétences — SecureCRM"; load(); loadStagiaires(); }, []);

  const load = async () => {
    const { data, error } = await supabase.from("competences_formation").select("*").order("formation_type").order("ordre");
    if (error) toast.error(error.message); else setList(data ?? []);
  };

  const loadStagiaires = async () => {
    const { data: s } = await supabase
      .from("stagiaires")
      .select("id, first_name, last_name, email, status")
      .order("last_name");
    setStagiaires(s ?? []);

    if (!s || s.length === 0) return;

    // Récupère les formations de chaque stagiaire
    const { data: fp } = await supabase
      .from("formation_participants")
      .select("stagiaire_id, formation:formations(type)")
      .in("stagiaire_id", s.map((x: any) => x.id));

    // Récupère toutes les compétences validées
    const { data: cv } = await supabase
      .from("competences_validees")
      .select("stagiaire_id, validee");

    // Récupère le référentiel complet
    const { data: ref } = await supabase
      .from("competences_formation")
      .select("formation_type");

    // Compte par type de formation dans le référentiel
    const refCount: Record<string, number> = {};
    (ref ?? []).forEach((c: any) => {
      refCount[c.formation_type] = (refCount[c.formation_type] ?? 0) + 1;
    });

    // Groupe les formations par stagiaire
    const formationsParStagiaire: Record<string, Set<string>> = {};
    (fp ?? []).forEach((p: any) => {
      const sid = p.stagiaire_id;
      const type = p.formation?.type;
      if (!sid || !type) return;
      formationsParStagiaire[sid] ??= new Set();
      formationsParStagiaire[sid].add(type);
    });

    // Calcule le total du référentiel pour chaque stagiaire selon ses formations
    const stats: Record<string, { validees: number; total: number; formations: string[] }> = {};
    s.forEach((stag: any) => {
      const types = [...(formationsParStagiaire[stag.id] ?? new Set())];
      const total = types.reduce((acc, t) => acc + (refCount[t] ?? 0), 0);
      const validees = (cv ?? []).filter((c: any) => c.stagiaire_id === stag.id && c.validee).length;
      stats[stag.id] = { validees, total, formations: types };
    });

    setStagiairesStats(stats);
  };

  const openStagiaire = async (s: any) => {
    setSelectedStagiaire(s);
    setLoadingComp(true);
    const { data } = await supabase
      .from("competences_validees")
      .select("*, formateur:formateurs(first_name, last_name), formation:formations(title, type)")
      .eq("stagiaire_id", s.id)
      .order("valide_le", { ascending: false });
    setStagiaireCompetences(data ?? []);
    setLoadingComp(false);
  };

  const openNew = () => { setEditing(null); setForm({ formation_type: "SST", titre: "", description: "", ordre: 0 }); setOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setForm({ formation_type: c.formation_type, titre: c.titre, description: c.description ?? "", ordre: c.ordre }); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titre) { toast.error("Le titre est requis"); return; }
    if (editing) {
      const { error } = await supabase.from("competences_formation").update(form).eq("id", editing.id);
      if (error) toast.error(error.message); else { toast.success("Compétence mise à jour"); setOpen(false); load(); }
    } else {
      const { error } = await supabase.from("competences_formation").insert(form);
      if (error) toast.error(error.message); else { toast.success("Compétence ajoutée"); setOpen(false); load(); }
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette compétence ?")) return;
    const { error } = await supabase.from("competences_formation").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Supprimée"); load(); }
  };

  const grouped = list.reduce((acc, c) => {
    acc[c.formation_type] ??= [];
    acc[c.formation_type].push(c);
    return acc;
  }, {} as Record<string, any[]>);

  // Vue fiche compétences d'un stagiaire
  if (selectedStagiaire) {
    const groupedComp = stagiaireCompetences.reduce((acc: any, c: any) => {
      const key = `${c.formation?.type} — ${c.formation?.title}`;
      acc[key] ??= [];
      acc[key].push(c);
      return acc;
    }, {});

    const stats = stagiairesStats[selectedStagiaire.id];
    const totalValidees = stagiaireCompetences.filter(c => c.validee).length;

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <button onClick={() => setSelectedStagiaire(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="h-14 w-14 rounded-full bg-muted border-2 border-primary/40 flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-muted-foreground">{selectedStagiaire.first_name?.[0]}{selectedStagiaire.last_name?.[0]}</span>
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold">{selectedStagiaire.first_name} {selectedStagiaire.last_name}</h2>
            <p className="text-muted-foreground text-sm">{selectedStagiaire.email || "—"}</p>
            {stats?.formations?.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Formations : {stats.formations.join(", ")}
              </p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-4">
            {stats && stats.total > 0 && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Progression globale</p>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${(totalValidees / stats.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold">
                    <span className="text-emerald-400">{totalValidees}</span>
                    <span className="text-muted-foreground"> / {stats.total}</span>
                  </span>
                </div>
              </div>
            )}
            <Badge variant="outline" className={STATUS_COLOR[selectedStagiaire.status]}>{STATUS_LABEL[selectedStagiaire.status]}</Badge>
          </div>
        </div>

        {loadingComp ? (
          <Card className="p-12 text-center text-muted-foreground text-sm">Chargement...</Card>
        ) : stagiaireCompetences.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground text-sm border-dashed">
            Aucune compétence enregistrée — le formateur n'a pas encore validé de modules pour ce stagiaire.
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedComp).map(([key, comps]: any) => {
              const validees = comps.filter((c: any) => c.validee).length;
              const typeFormation = (comps[0] as any).formation?.type;
              const totalRef = list.filter(r => r.formation_type === typeFormation).length;
              return (
                <Card key={key} className="bg-card/60 border-border/50 overflow-hidden">
                  <div className="p-4 border-b border-border/50 flex items-center gap-3 flex-wrap">
                    <Badge variant="outline" className="border-primary/40 text-primary">{typeFormation}</Badge>
                    <span className="text-sm font-medium">{(comps[0] as any).formation?.title}</span>
                    <span className="text-xs text-muted-foreground">
                      Formateur : {(comps[0] as any).formateur?.first_name} {(comps[0] as any).formateur?.last_name}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${totalRef > 0 ? (validees / totalRef) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">
                        <span className="text-emerald-400">{validees}</span>
                        <span className="text-muted-foreground"> / {totalRef} modules</span>
                      </span>
                    </div>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border/50">
                        <th className="pb-2 px-4 pt-3">Compétence</th>
                        <th className="pb-2 px-4 pt-3">Note</th>
                        <th className="pb-2 px-4 pt-3">Validé</th>
                        <th className="pb-2 px-4 pt-3">Commentaire</th>
                        <th className="pb-2 px-4 pt-3">Le</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(comps as any[]).map((c: any) => (
                        <tr key={c.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                          <td className="py-3 px-4 font-medium">{c.competence}</td>
                          <td className="py-3 px-4">
                            {c.note !== null ? (
                              <span className={`font-bold ${c.note >= 7 ? "text-emerald-400" : c.note >= 5 ? "text-yellow-400" : "text-red-400"}`}>
                                {c.note}/10
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="py-3 px-4">
                            {c.validee
                              ? <CheckCircle className="h-4 w-4 text-emerald-400" />
                              : <X className="h-4 w-4 text-red-400" />}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-xs max-w-[200px] truncate">{c.commentaire || "—"}</td>
                          <td className="py-3 px-4 text-xs text-muted-foreground">
                            {c.valide_le ? new Date(c.valide_le).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow flex items-center gap-3">
            <Award className="h-7 w-7 text-primary" /> Compétences
          </h1>
        </div>
        {tab === "referentiel" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} className="gradient-primary text-primary-foreground shadow-glow">
                <Plus className="h-4 w-4 mr-2" />Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>{editing ? "Modifier" : "Nouvelle compétence"}</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <Label>Type de formation</Label>
                  <Select value={form.formation_type} onValueChange={(v) => setForm({ ...form, formation_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Titre *</Label><Input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} required /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description de la compétence..." /></div>
                <div><Label>Ordre</Label><Input type="number" value={form.ordre} onChange={(e) => setForm({ ...form, ordre: +e.target.value })} /></div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground">Enregistrer</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
        <TabsList>
          <TabsTrigger value="stagiaires" className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5" /> Suivi stagiaires ({stagiaires.length})
          </TabsTrigger>
          <TabsTrigger value="referentiel" className="flex items-center gap-2">
            <Award className="h-3.5 w-3.5" /> Référentiel ({list.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* SUIVI STAGIAIRES */}
      {tab === "stagiaires" && (
        <Card className="bg-card/60 border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="pb-3 px-4 pt-4">Stagiaire</th>
                <th className="pb-3 px-4 pt-4">Formations</th>
                <th className="pb-3 px-4 pt-4">Statut</th>
                <th className="pb-3 px-4 pt-4">Progression</th>
                <th className="pb-3 px-4 pt-4"></th>
              </tr>
            </thead>
            <tbody>
              {stagiaires.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">Aucun stagiaire</td></tr>
              )}
              {stagiaires.map((s: any) => {
                const stats = stagiairesStats[s.id];
                const pct = stats && stats.total > 0 ? (stats.validees / stats.total) * 100 : 0;
                return (
                  <tr key={s.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => openStagiaire(s)}>
                    <td className="py-3 px-4">
                      <p className="font-medium">{s.first_name} {s.last_name}</p>
                      <p className="text-xs text-muted-foreground">{s.email || "—"}</p>
                    </td>
                    <td className="py-3 px-4">
                      {stats?.formations?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {stats.formations.map(f => (
                            <Badge key={f} variant="outline" className="text-[10px] border-primary/30 text-primary">{f}</Badge>
                          ))}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className={STATUS_COLOR[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      {stats && stats.total > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 max-w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs whitespace-nowrap">
                            <span className="text-emerald-400 font-medium">{stats.validees}</span>
                            <span className="text-muted-foreground"> / {stats.total}</span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pas encore commencé</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-xs text-primary hover:underline">Voir →</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* REFERENTIEL */}
      {tab === "referentiel" && (
        <div className="space-y-3">
          {Object.entries(grouped).map(([type, comps]) => (
            <Card key={type} className="overflow-hidden border-border/50">
              <button
                className="w-full flex items-center justify-between p-5 bg-card/60 hover:bg-card/80 transition-colors text-left"
                onClick={() => setOpenType(openType === type ? null : type)}
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="border-primary/40 text-primary">{type}</Badge>
                  <span className="text-sm text-muted-foreground">{(comps as any[]).length} compétence(s)</span>
                </div>
                {openType === type ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {openType === type && (
                <div className="border-t border-border/50">
                  {(comps as any[]).map((c: any) => (
                    <div key={c.id} className="flex items-start justify-between p-4 border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground font-mono">#{c.ordre}</span>
                          <p className="font-medium text-sm">{c.titre}</p>
                        </div>
                        {c.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
          {list.length === 0 && (
            <Card className="p-12 text-center text-muted-foreground text-sm border-dashed">
              Aucune compétence. Cliquez sur Ajouter pour commencer.
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
// @ts-nocheck
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, GraduationCap, Trash2, Calendar, MapPin, Users, UserPlus, UserCheck, Euro, FileText, Download, CheckCircle2, XCircle, Clock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { generateAttestation, generateConvention } from "@/lib/generateDocs";
import { generateEmargementPdf } from "@/lib/generateEmargementPdf";
import { QUESTIONNAIRE_LABELS } from "@/lib/questionnaireQuestions";
 
const TYPES = ["APS", "SST", "SSIAP1", "SSIAP2", "SSIAP3", "MAC_APS", "H0B0", "AUTRE"];
const PARTICIPANT_STATUSES = ["inscrit", "present", "absent", "valide", "echec"] as const;
const RESULTATS = ["en_attente", "obtenu", "a_repasser"] as const;
 
type Stagiaire = { id: string; first_name: string; last_name: string; email: string | null };
type Formateur = { id: string; first_name: string; last_name: string };
type Participant = {
  id: string;
  stagiaire_id: string;
  status: string;
  tarif: number | null;
  resultat: string | null;
  resultat_commentaire: string | null;
  stagiaire?: Stagiaire;
};
 
const RESULTAT_CONFIG = {
  obtenu: { label: "Obtenu", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  a_repasser: { label: "À repasser", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10 border-destructive/30" },
  en_attente: { label: "En attente", icon: Clock, color: "text-muted-foreground", bg: "bg-muted/30 border-border/50" },
};
 
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
 
function TitleInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>Intitulé *</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Ex: Formation SST Mai 2026" required className="mt-1" />
    </div>
  );
}
 
export default function Formations() {
  const [list, setList] = useState<any[]>([]);
  const [stagiaires, setStagiaires] = useState<Stagiaire[]>([]);
  const [formateurs, setFormateurs] = useState<Formateur[]>([]);
  const [participantsByFormation, setParticipantsByFormation] = useState<Record<string, Participant[]>>({});
  const [open, setOpen] = useState(false);
  const [selectedStagiaires, setSelectedStagiaires] = useState<string[]>([]);
  const [tab, setTab] = useState<"en_cours" | "a_venir" | "passees">("en_cours");
  const [form, setForm] = useState({
    title: "", type: "APS", description: "", start_date: "", end_date: "",
    location: "", max_participants: 12, formateur_id: "", showRemarque: false,
    prix_ht: 0, duration_hours: 0,
  });
  const [manageOpen, setManageOpen] = useState(false);
  const [manageFormation, setManageFormation] = useState<any | null>(null);
  const [manageSelected, setManageSelected] = useState<string[]>([]);
  const [editFormateurOpen, setEditFormateurOpen] = useState(false);
  const [editFormateurFormation, setEditFormateurFormation] = useState<any | null>(null);
  const [editFormateurId, setEditFormateurId] = useState<string>("");
  const [resultatComments, setResultatComments] = useState<Record<string, string>>({});
  const [qStats, setQStats] = useState<Record<string, Record<string, { sent: number; completed: number }>>>({});
  const [qSendOpen, setQSendOpen] = useState(false);
  const [qSendFormation, setQSendFormation] = useState<any | null>(null);
  const [qSendType, setQSendType] = useState<"positionnement" | "satisfaction_chaud" | "satisfaction_froid">("positionnement");
  const [qSendSelected, setQSendSelected] = useState<string[]>([]);
  const [qSending, setQSending] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState<string | null>(null);
  const [qResultsOpen, setQResultsOpen] = useState(false);
  const [qResultsData, setQResultsData] = useState<any[]>([]);
  const [qResultsType, setQResultsType] = useState<string>("");

  // --- NOUVEAU : état pour modifier les dates ---
  const [editDatesOpen, setEditDatesOpen] = useState(false);
  const [editDatesFormation, setEditDatesFormation] = useState<any | null>(null);
  const [editDatesStart, setEditDatesStart] = useState("");
  const [editDatesEnd, setEditDatesEnd] = useState("");
 
  useEffect(() => { document.title = "Formations — SecureCRM"; load(); }, []);
 
  const load = async () => {
    const [{ data: f }, { data: s }, { data: p }, { data: fo }] = await Promise.all([
      supabase.from("formations").select("*").order("start_date", { ascending: false }),
      supabase.from("stagiaires").select("id, first_name, last_name, email").order("last_name"),
      supabase.from("formation_participants").select("id, formation_id, stagiaire_id, status, tarif, resultat, resultat_commentaire, stagiaire:stagiaires(id, first_name, last_name, email)"),
      supabase.from("formateurs").select("id, first_name, last_name").order("last_name"),
    ]);
    setList(f ?? []);
    setStagiaires((s ?? []) as Stagiaire[]);
    setFormateurs((fo ?? []) as Formateur[]);
    const grouped: Record<string, Participant[]> = {};
    (p ?? []).forEach((row: any) => {
      grouped[row.formation_id] ??= [];
      grouped[row.formation_id].push(row);
    });
    setParticipantsByFormation(grouped);
    const comments: Record<string, string> = {};
    (p ?? []).forEach((row: any) => { comments[row.id] = row.resultat_commentaire ?? ""; });
    setResultatComments(comments);
    if (f?.length) await loadQStats(f.map((x: any) => x.id));
  };

  const loadQStats = async (formationIds: string[]) => {
    if (!formationIds.length) return;
    const { data } = await supabase
      .from("questionnaire_tokens")
      .select("formation_id, type, completed_at")
      .in("formation_id", formationIds);
    const stats: Record<string, Record<string, { sent: number; completed: number }>> = {};
    for (const row of (data ?? [])) {
      stats[row.formation_id] ??= {};
      stats[row.formation_id][row.type] ??= { sent: 0, completed: 0 };
      stats[row.formation_id][row.type].sent++;
      if (row.completed_at) stats[row.formation_id][row.type].completed++;
    }
    setQStats(stats);
  };
 
  const toggleStagiaire = (id: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };
 
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.start_date || !form.end_date) { toast.error("Champs requis manquants"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      title: form.title, type: form.type as any, description: form.description || null,
      start_date: form.start_date, end_date: form.end_date, location: form.location || null,
      max_participants: form.max_participants, created_by: user?.id,
      prix_ht: form.prix_ht || 0,
      duration_hours: form.duration_hours || 0,
    };
    if (form.formateur_id && form.formateur_id !== "") payload.formateur_id = form.formateur_id;
    const { data: created, error } = await supabase.from("formations").insert(payload).select().single();
    if (error) { toast.error(error.message); return; }
    if (selectedStagiaires.length > 0 && created) {
      const rows = selectedStagiaires.map((sid) => ({ formation_id: created.id, stagiaire_id: sid, tarif: 0, resultat: "en_attente" }));
      const { error: e2 } = await supabase.from("formation_participants").insert(rows);
      if (e2) toast.error("Formation créée mais erreur stagiaires : " + e2.message);
    }
    toast.success(`Formation créée${selectedStagiaires.length ? ` avec ${selectedStagiaires.length} stagiaire(s)` : ""}`);
    setOpen(false);
    setForm({ title: "", type: "APS", description: "", start_date: "", end_date: "", location: "", max_participants: 12, formateur_id: "", showRemarque: false, prix_ht: 0, duration_hours: 0 });
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
 
  const openEditFormateur = (f: any) => {
    setEditFormateurFormation(f);
    setEditFormateurId(f.formateur_id ?? "none");
    setEditFormateurOpen(true);
  };
 
  // --- NOUVEAU : ouvrir le dialog de modification des dates ---
  const openEditDates = (f: any) => {
    setEditDatesFormation(f);
    setEditDatesStart(f.start_date);
    setEditDatesEnd(f.end_date);
    setEditDatesOpen(true);
  };
 
  // --- NOUVEAU : enregistrer les nouvelles dates ---
  const saveEditDates = async () => {
    if (!editDatesFormation) return;
    if (!editDatesStart || !editDatesEnd) { toast.error("Les deux dates sont obligatoires"); return; }
    if (editDatesEnd < editDatesStart) { toast.error("La date de fin doit être après la date de début"); return; }
    const { error } = await supabase
      .from("formations")
      .update({ start_date: editDatesStart, end_date: editDatesEnd })
      .eq("id", editDatesFormation.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Dates mises à jour");
    setEditDatesOpen(false);
    load();
  };
 
  const openQResults = async (formation: any, type: string) => {
    const { data } = await supabase
      .from("questionnaire_tokens")
      .select("reponses, stagiaire_id, stagiaires(first_name, last_name)")
      .eq("formation_id", formation.id)
      .eq("type", type)
      .not("completed_at", "is", null);
    setQResultsData(data ?? []);
    setQResultsType(type);
    setQResultsOpen(true);
  };

  const sendQuestionnaire = async () => {
    if (!qSendFormation) return;
    setQSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-questionnaire`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          formation_id: qSendFormation.id,
          stagiaire_ids: qSendSelected,
          type: qSendType,
        }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error || "Erreur"); return; }
      toast.success(`${d.sent} email(s) envoyé(s)`);
      setQSendOpen(false);
      await loadQStats([qSendFormation.id]);
    } finally {
      setQSending(false);
    }
  };

  const saveEditFormateur = async () => {
    if (!editFormateurFormation) return;
    const payload: any = {};
    if (!editFormateurId || editFormateurId === "" || editFormateurId === "none") {
      payload.formateur_id = null;
    } else {
      payload.formateur_id = editFormateurId;
    }
    const { error } = await supabase.from("formations").update(payload).eq("id", editFormateurFormation.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Formateur mis à jour");
    setEditFormateurOpen(false);
    load();
  };
 
  const saveManage = async () => {
    if (!manageFormation) return;
    const current = (participantsByFormation[manageFormation.id] ?? []).map((p) => p.stagiaire_id);
    const toAdd = manageSelected.filter((id) => !current.includes(id));
    const toRemove = current.filter((id) => !manageSelected.includes(id));
    if (toAdd.length) {
      const { error } = await supabase.from("formation_participants").insert(
        toAdd.map((sid) => ({ formation_id: manageFormation.id, stagiaire_id: sid, tarif: 0, resultat: "en_attente" }))
      );
      if (error) { toast.error(error.message); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await Promise.all(
          toAdd.map((sid) =>
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-stagiaire-account`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`,
                "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({ stagiaire_id: sid, formation_id: manageFormation.id }),
            }).catch((e) => console.error("create-stagiaire-account failed:", e))
          )
        );
      } else {
        console.warn("No active session — skipping create-stagiaire-account calls");
      }
    }
    if (toRemove.length) {
      const { error } = await supabase.from("formation_participants").delete().eq("formation_id", manageFormation.id).in("stagiaire_id", toRemove);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Participants mis à jour");
    setManageOpen(false);
    load();
  };
 
  const updateParticipantStatus = async (participantId: string, status: string) => {
    const { error } = await supabase.from("formation_participants").update({ status: status as any }).eq("id", participantId);
    if (error) toast.error(error.message); else { toast.success("Statut mis à jour"); load(); }
  };
 
  const updateParticipantTarif = async (participantId: string, tarif: number) => {
    const { error } = await supabase.from("formation_participants").update({ tarif }).eq("id", participantId);
    if (error) toast.error(error.message); else load();
  };
 
  const updateResultat = async (participantId: string, resultat: string) => {
    const { error } = await supabase.from("formation_participants").update({ resultat }).eq("id", participantId);
    if (error) toast.error(error.message);
    else { toast.success("Résultat mis à jour"); load(); }
  };
 
  const updateResultatCommentaire = async (participantId: string) => {
    const commentaire = resultatComments[participantId] ?? "";
    const { error } = await supabase.from("formation_participants").update({ resultat_commentaire: commentaire || null }).eq("id", participantId);
    if (error) toast.error(error.message);
    else toast.success("Commentaire enregistré");
  };
 
  const getFormateurName = (formateurId: string | null) => {
    if (!formateurId) return null;
    const f = formateurs.find(f => f.id === formateurId);
    return f ? `${f.first_name} ${f.last_name}` : null;
  };
 
  const StagiairesPicker = ({ selected, onToggle, busy }: { selected: string[]; onToggle: (id: string) => void; busy: Set<string> }) => {
    const available = stagiaires.filter((s) => !busy.has(s.id));
    return (
      <ScrollArea className="h-48 rounded-md border border-border/60 bg-background/40 p-2">
        {stagiaires.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">Aucun stagiaire. Créez-en d'abord dans l'onglet Stagiaires.</p>
        ) : available.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">Aucun stagiaire disponible sur ces dates.</p>
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
 
  // Tri par onglet
  const today = new Date().toISOString().slice(0, 10);
  const enCours = list.filter(f => f.start_date <= today && f.end_date >= today);
  const aVenir = list.filter(f => f.start_date > today);
  const passees = list.filter(f => f.end_date < today);
  const displayed = tab === "en_cours" ? enCours : tab === "a_venir" ? aVenir : passees;
 
  const FormationCard = ({ f }: { f: any }) => {
    const ps = participantsByFormation[f.id] ?? [];
    const formateurName = getFormateurName(f.formateur_id);
    const formateurObj = formateurs.find(fo => fo.id === f.formateur_id);
    const totalTarif = ps.reduce((acc, p) => acc + (Number(p.tarif) || 0), 0);
    const obtenus = ps.filter(p => p.resultat === "obtenu").length;
    const aRepasser = ps.filter(p => p.resultat === "a_repasser").length;
 
    return (
      <Card className="p-5 bg-card/60 border-border/50 hover:border-primary/40 hover:shadow-glow transition-all group">
        <div className="flex items-start justify-between mb-3">
          <Badge variant="outline" className="border-primary/40 text-primary">{f.type}</Badge>
          <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => remove(f.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
        <h3 className="font-display font-semibold mb-2">{f.title}</h3>
        {f.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{f.description}</p>}
        <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(f.start_date).toLocaleDateString("fr-FR")} → {new Date(f.end_date).toLocaleDateString("fr-FR")}
          </div>
          {f.location && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{f.location}</div>}
          <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />{ps.length}/{f.max_participants ?? "∞"} stagiaire(s)</div>
          {formateurName && <div className="flex items-center gap-2"><UserCheck className="h-3.5 w-3.5 text-emerald-500" /><span className="text-emerald-500 font-medium">{formateurName}</span></div>}
        </div>
 
        {ps.length > 0 && (obtenus > 0 || aRepasser > 0) && (
          <div className="flex gap-2 mb-3">
            {obtenus > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">
                <CheckCircle2 className="h-3 w-3" /> {obtenus} obtenu(s)
              </span>
            )}
            {aRepasser > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-0.5">
                <XCircle className="h-3 w-3" /> {aRepasser} à repasser
              </span>
            )}
          </div>
        )}
 
        {ps.length > 0 && (
          <div className="space-y-2 mb-3 max-h-96 overflow-y-auto pr-1">
            {ps.map((p) => {
              const cfg = RESULTAT_CONFIG[p.resultat as keyof typeof RESULTAT_CONFIG] ?? RESULTAT_CONFIG.en_attente;
              const Icon = cfg.icon;
              return (
                <div key={p.id} className={`rounded-lg border px-2 py-2 space-y-1.5 ${cfg.bg}`}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate flex-1 font-medium">{p.stagiaire?.last_name?.toUpperCase()} {p.stagiaire?.first_name}</span>
                    <input
                      type="number" min="0" step="0.01" defaultValue={Number(p.tarif) || 0}
                      onBlur={(e) => updateParticipantTarif(p.id, parseFloat(e.target.value) || 0)}
                      className="w-16 h-6 text-[10px] bg-background/60 border border-border/60 rounded px-1 text-right"
                      placeholder="0 €"
                    />
                    <Select value={p.status} onValueChange={(v) => updateParticipantStatus(p.id, v)}>
                      <SelectTrigger className="h-6 w-[88px] text-[10px] border-border/60"><SelectValue /></SelectTrigger>
                      <SelectContent>{PARTICIPANT_STATUSES.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Icon className={`h-3 w-3 shrink-0 ${cfg.color}`} />
                    <Select value={p.resultat ?? "en_attente"} onValueChange={(v) => updateResultat(p.id, v)}>
                      <SelectTrigger className="h-6 flex-1 text-[10px] border-border/60"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en_attente" className="text-xs">⏳ En attente</SelectItem>
                        <SelectItem value="obtenu" className="text-xs">✅ Obtenu</SelectItem>
                        <SelectItem value="a_repasser" className="text-xs">❌ À repasser</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text" placeholder="Commentaire (optionnel)..."
                      value={resultatComments[p.id] ?? ""}
                      onChange={(e) => setResultatComments(prev => ({ ...prev, [p.id]: e.target.value }))}
                      onBlur={() => updateResultatCommentaire(p.id)}
                      className="flex-1 h-6 text-[10px] bg-background/60 border border-border/60 rounded px-2 text-muted-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>
              );
            })}
            {totalTarif > 0 && (
              <div className="flex justify-end items-center gap-1 text-[10px] text-yellow-400 pr-1 pt-1">
                <Euro className="h-3 w-3" />
                Total : {totalTarif.toLocaleString("fr-FR")} €
              </div>
            )}
          </div>
        )}
 
        <div className="flex flex-col gap-2">
          {/* --- NOUVEAU : bouton modifier les dates --- */}
          <Button size="sm" variant="outline" className="w-full border-blue-500/30 text-blue-400 hover:bg-blue-500/10" onClick={() => openEditDates(f)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Modifier les dates
          </Button>
 
          <Button size="sm" variant="outline" className="w-full border-primary/30 text-primary hover:bg-primary/10" onClick={() => openManage(f)}>
            <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Gérer les stagiaires
          </Button>
          <Button size="sm" variant="outline" className="w-full border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10" onClick={() => openEditFormateur(f)}>
            <UserCheck className="h-3.5 w-3.5 mr-1.5" /> Gérer le formateur
          </Button>
          {ps.length > 0 && (
            <div className="border-t border-border/30 pt-2 space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Documents Qualiopi</p>
              <Button size="sm" variant="outline"
                className="w-full border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10 text-xs"
                disabled={loadingPdf === f.id}
                onClick={async () => {
                  setLoadingPdf(f.id);
                  try { await generateEmargementPdf(f, supabase); }
                  finally { setLoadingPdf(null); }
                }}>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                {loadingPdf === f.id ? "Génération…" : "Feuille d'émargement"}
              </Button>
              <Button size="sm" variant="outline" className="w-full border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10 text-xs"
                onClick={() => generateConvention(f, ps.map(p => ({ ...p.stagiaire, tarif: p.tarif })).filter(Boolean), formateurObj)}>
                <FileText className="h-3.5 w-3.5 mr-1.5" /> Convention de formation
              </Button>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider pt-1">Attestations individuelles</p>
              {ps.map(p => p.stagiaire).filter(Boolean).map((s: any) => (
                <Button key={s.id} size="sm" variant="outline"
                  className="w-full border-yellow-400/20 text-yellow-300 hover:bg-yellow-400/10 text-xs justify-start"
                  onClick={() => generateAttestation(f, s, formateurObj)}>
                  <Download className="h-3 w-3 mr-1.5 shrink-0" />
                  <span className="truncate">{s.last_name?.toUpperCase()} {s.first_name}</span>
                </Button>
              ))}
            </div>
          )}
          <div className="border-t border-border/30 pt-2 space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Questionnaires Qualiopi</p>
            {(["positionnement", "satisfaction_chaud", "satisfaction_froid"] as const).map((type) => {
              const s = qStats[f.id]?.[type];
              return (
                <div key={type} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground truncate flex-1">{QUESTIONNAIRE_LABELS[type]}</span>
                  {s ? (
                    <span className={`text-[10px] ${s.completed === s.sent ? "text-emerald-400" : "text-yellow-400"}`}>
                      {s.completed}/{s.sent}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/50">—</span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10"
                    onClick={() => {
                      setQSendFormation(f);
                      setQSendType(type);
                      setQSendSelected((participantsByFormation[f.id] ?? []).map((p) => p.stagiaire_id));
                      setQSendOpen(true);
                    }}
                  >
                    Envoyer
                  </Button>
                  {s && s.completed >= 3 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => openQResults(f, type)}
                    >
                      Résultats
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    );
  };
 
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow flex items-center gap-3">
            <GraduationCap className="h-7 w-7 text-primary" /> Formations
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{list.length} session(s) au total</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground shadow-glow"><Plus className="h-4 w-4 mr-2" />Nouvelle session</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvelle formation</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <TitleInput value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Places max</Label><Input type="number" value={form.max_participants} onChange={(e) => setForm({ ...form, max_participants: +e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prix HT (€)</Label>
                  <Input type="number" min="0" step="0.01" value={form.prix_ht} onChange={(e) => setForm({ ...form, prix_ht: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>Durée (heures)</Label>
                  <Input type="number" min="0" step="0.5" value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Début *</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required /></div>
                <div><Label>Fin *</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required /></div>
              </div>
              <div>
                <Label>Lieu</Label>
                <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner le lieu" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Centre de formation">📍 Centre de formation</SelectItem>
                    <SelectItem value="Convocation">📋 Convocation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-2"><UserCheck className="h-4 w-4" /> Formateur</Label>
                <Select value={form.formateur_id} onValueChange={(v) => setForm({ ...form, formateur_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un formateur (optionnel)" /></SelectTrigger>
                  <SelectContent>
                    {formateurs.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.last_name.toUpperCase()} {f.first_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="remarque-check" checked={form.showRemarque} onCheckedChange={(v) => setForm({ ...form, showRemarque: !!v, description: v ? form.description : "" })} />
                <label htmlFor="remarque-check" className="text-sm cursor-pointer">Ajouter une remarque</label>
              </div>
              {form.showRemarque && (
                <div>
                  <Label>Remarque</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Remarque..." />
                </div>
              )}
              <div>
                <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Stagiaires inscrits ({selectedStagiaires.length})</Label>
                <StagiairesPicker selected={selectedStagiaires} onToggle={(id) => toggleStagiaire(id, selectedStagiaires, setSelectedStagiaires)} busy={getBusyStagiaireIds(list, participantsByFormation, form.start_date, form.end_date)} />
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground">Créer</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
 
      {/* Onglets */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="en_cours" className="gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            En cours
            <Badge variant="secondary" className="ml-1">{enCours.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="a_venir" className="gap-2">
            <Clock className="h-3.5 w-3.5 text-primary" />
            À venir
            <Badge variant="secondary" className="ml-1">{aVenir.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="passees" className="gap-2">
            Passées
            <Badge variant="secondary" className="ml-1">{passees.length}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>
 
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayed.length === 0 && (
          <Card className="col-span-full p-12 text-center text-muted-foreground bg-card/40 border-dashed">
            {tab === "en_cours" ? "Aucune formation en cours" : tab === "a_venir" ? "Aucune formation à venir" : "Aucune formation passée"}
          </Card>
        )}
        {displayed.map((f) => <FormationCard key={f.id} f={f} />)}
      </div>
 
      {/* Dialog gérer stagiaires */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Stagiaires — {manageFormation?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{manageSelected.length} sélectionné(s)</p>
            <StagiairesPicker selected={manageSelected} onToggle={(id) => toggleStagiaire(id, manageSelected, setManageSelected)} busy={manageFormation ? getBusyStagiaireIds(list, participantsByFormation, manageFormation.start_date, manageFormation.end_date, manageFormation.id) : new Set()} />
            <Button className="w-full gradient-primary text-primary-foreground" onClick={saveManage}>Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
 
      {/* Dialog modifier formateur */}
      <Dialog open={editFormateurOpen} onOpenChange={setEditFormateurOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Modifier le formateur — {editFormateurFormation?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2 mb-2"><UserCheck className="h-4 w-4" /> Formateur</Label>
              <Select value={editFormateurId} onValueChange={setEditFormateurId}>
                <SelectTrigger><SelectValue placeholder="Aucun formateur" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun formateur</SelectItem>
                  {formateurs.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.last_name.toUpperCase()} {f.first_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gradient-primary text-primary-foreground" onClick={saveEditFormateur}>Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
 
      {/* --- NOUVEAU : Dialog modifier les dates --- */}
      <Dialog open={editDatesOpen} onOpenChange={setEditDatesOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-400" />
              Modifier les dates — {editDatesFormation?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date de début *</Label>
                <Input
                  type="date"
                  value={editDatesStart}
                  onChange={(e) => setEditDatesStart(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Date de fin *</Label>
                <Input
                  type="date"
                  value={editDatesEnd}
                  onChange={(e) => setEditDatesEnd(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            {editDatesStart && editDatesEnd && editDatesEnd < editDatesStart && (
              <p className="text-xs text-destructive">⚠️ La date de fin doit être après la date de début.</p>
            )}
            <Button className="w-full gradient-primary text-primary-foreground" onClick={saveEditDates}>
              Enregistrer les dates
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog envoyer questionnaire */}
      <Dialog open={qSendOpen} onOpenChange={setQSendOpen}>
        <DialogContent className="bg-card border-border max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Envoyer — {qSendFormation?.title} · {QUESTIONNAIRE_LABELS[qSendType]}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Sélectionner les stagiaires à notifier :</p>
            <ScrollArea className="h-48 rounded-md border border-border/60 p-2">
              {(participantsByFormation[qSendFormation?.id] ?? []).map((p) => (
                <label key={p.stagiaire_id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/40 cursor-pointer">
                  <Checkbox
                    checked={qSendSelected.includes(p.stagiaire_id)}
                    onCheckedChange={() =>
                      setQSendSelected((prev) =>
                        prev.includes(p.stagiaire_id)
                          ? prev.filter((id) => id !== p.stagiaire_id)
                          : [...prev, p.stagiaire_id]
                      )
                    }
                  />
                  <span className="text-sm">
                    {p.stagiaire?.last_name?.toUpperCase()} {p.stagiaire?.first_name}
                  </span>
                  {!p.stagiaire?.email && (
                    <span className="text-xs text-destructive ml-auto">pas d'email</span>
                  )}
                </label>
              ))}
            </ScrollArea>
            <Button
              onClick={sendQuestionnaire}
              disabled={qSending || qSendSelected.length === 0}
              className="w-full gradient-primary text-primary-foreground"
            >
              {qSending ? "Envoi…" : `Envoyer à ${qSendSelected.length} stagiaire(s)`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog résultats questionnaire */}
      <Dialog open={qResultsOpen} onOpenChange={setQResultsOpen}>
        <DialogContent className="bg-card border-border max-h-[80vh] overflow-y-auto max-w-2xl">
          <DialogHeader>
            <DialogTitle>Résultats — {QUESTIONNAIRE_LABELS[qResultsType]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {qResultsData.length === 0 ? (
              <p className="text-muted-foreground">Aucune réponse enregistrée.</p>
            ) : (
              qResultsData.map((row: any, i: number) => (
                <div key={i} className="border border-border/40 rounded-lg p-3 space-y-1">
                  <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground">
                    {row.stagiaires?.last_name?.toUpperCase()} {row.stagiaires?.first_name}
                  </p>
                  {row.reponses && Object.entries(row.reponses as Record<string, unknown>).map(([k, v]) => (
                    <p key={k} className="text-xs text-muted-foreground">
                      <span className="font-mono text-primary/70">{k}</span> : {String(v ?? "—")}
                    </p>
                  ))}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
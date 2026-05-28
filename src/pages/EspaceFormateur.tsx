// @ts-nocheck
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar, MapPin, Camera, CheckCircle, Shield, ChevronUp, ChevronDown,
  LayoutDashboard, GraduationCap, LogOut, User, Menu,
  Users, Award, AlertTriangle, PenLine, MessageSquare,
  ChevronLeft, Send, Check, ChevronRight, Eye, BookOpen,
  Plus, Pencil, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { SignatureModal } from "@/components/SignatureModal";
type Page = "dashboard" | "formations" | "stagiaires_fmt" | "cours" | "emargement" | "certifications" | "profil" | "stagiaire" | "messagerie" | "maincourante" | "mcconfig" | "consignes" | "permisfeu" | "rondier";import { FileText } from "lucide-react";
import { MainCouranteFormateur, MainCouranteConfig, ConsignesFormateur, PermisFeuFormateur, RondierFormateur } from "@/components/MainCourante";

const CERT_LABELS: Record<string, string> = {
  sst_date: "SST", tfp_aps_date: "TFP APS", mac_aps_date: "MAC APS",
  ssiap1_date: "SSIAP 1", ssiap2_date: "SSIAP 2", ssiap3_date: "SSIAP 3",
};

function MessagerieChat({ stagiaireId, stagiaireNom, formationId, formationNom, formateurId }: {
  stagiaireId: string; stagiaireNom: string; formationId: string; formationNom: string; formateurId: string;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data } = await supabase.from("messages").select("*").eq("a_stagiaire_id", stagiaireId).order("created_at");
      setMessages(data ?? []);
      setLoading(false);
      await supabase.from("messages").update({ lu: true }).eq("a_stagiaire_id", stagiaireId).not("de_stagiaire_id", "is", null).eq("lu", false);
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [stagiaireId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    if (!msg.trim()) return;
    const { error } = await supabase.from("messages").insert({ de_formateur_id: formateurId, a_stagiaire_id: stagiaireId, formation_id: formationId, contenu: msg });
    if (error) { toast.error(error.message); return; }
    setMsg("");
    const { data } = await supabase.from("messages").select("*").eq("a_stagiaire_id", stagiaireId).order("created_at");
    setMessages(data ?? []);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border/50 bg-muted/20">
        <p className="font-medium text-sm">{stagiaireNom}</p>
        <p className="text-xs text-muted-foreground">{formationNom}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {loading ? <p className="text-xs text-muted-foreground text-center py-4">Chargement…</p>
          : messages.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">Aucun message — commencez la conversation</p>
          : messages.map((m: any) => (
            <div key={m.id} className={`flex ${m.de_formateur_id ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] p-3 rounded-lg text-sm ${m.de_formateur_id ? "bg-primary/20 border border-primary/30" : "bg-muted/40 border border-border/50"}`}>
                <p className="text-[10px] font-medium opacity-50 mb-1">{m.de_formateur_id ? "Vous" : "Stagiaire"}</p>
                <p>{m.contenu}</p>
                <p className="text-[10px] text-muted-foreground mt-1 text-right">{new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
          ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-4 border-t border-border/50 flex gap-2">
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Écrire un message…" rows={2}
          className="flex-1 bg-muted/30 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
        <Button onClick={handleSend} size="icon" className="h-auto self-end"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function PageStagiairesFormateur({ authUserId, formateurId, formations }: { authUserId: string | null; formateurId: string | null; formations: any[] }) {
  const [stagiaires, setStagiaires] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [inscriptionOpen, setInscriptionOpen] = useState(false);
  const [newStagiaireId, setNewStagiaireId] = useState<string | null>(null);
  const [selectedFormationId, setSelectedFormationId] = useState("");
  const [form, setForm] = useState({
    first_name: "", last_name: "", birth_date: "",
    email: "", phone: "", address: "", city: "", postal_code: "", notes: "",
  });

  const emptyForm = {
    first_name: "", last_name: "", birth_date: "",
    email: "", phone: "", address: "", city: "", postal_code: "", notes: "",
  };

  const loadStagiaires = async () => {
    if (!authUserId || !formateurId) return;
    setLoading(true);

    const { data: participants, error: errParticipants } = await supabase
      .from("formation_participants")
      .select("stagiaire_id, formations!inner(formateur_id)")
      .eq("formations.formateur_id", formateurId);
    if (errParticipants) {
      toast.error("Erreur lors du chargement des formations");
      setLoading(false);
      return;
    }

    const idsFromForms: string[] = (participants ?? []).map((p: any) => p.stagiaire_id);

    const { data: bySelf, error: errBySelf } = await supabase
      .from("stagiaires")
      .select("*")
      .eq("created_by", authUserId)
      .is("deleted_at", null);
    if (errBySelf) {
      toast.error("Erreur lors du chargement des stagiaires");
      setLoading(false);
      return;
    }

    const selfIds = new Set((bySelf ?? []).map((s: any) => s.id));
    const extraIds = idsFromForms.filter(id => !selfIds.has(id));

    let byForms: any[] = [];
    if (extraIds.length > 0) {
      const { data, error: errByForms } = await supabase
        .from("stagiaires")
        .select("*")
        .in("id", extraIds)
        .is("deleted_at", null);
      if (errByForms) {
        toast.error("Erreur lors du chargement des stagiaires inscrits");
        setLoading(false);
        return;
      }
      byForms = data ?? [];
    }

    setStagiaires([...(bySelf ?? []), ...byForms]);
    setLoading(false);
  };

  useEffect(() => { loadStagiaires(); }, [authUserId, formateurId]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      first_name: s.first_name ?? "", last_name: s.last_name ?? "", birth_date: s.birth_date ?? "",
      email: s.email ?? "", phone: s.phone ?? "", address: s.address ?? "",
      city: s.city ?? "", postal_code: s.postal_code ?? "", notes: s.notes ?? "",
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.birth_date) {
      toast.error("Prénom, nom et date de naissance sont obligatoires");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const organismeId = "00000000-0000-0000-0000-000000000001";

    if (editing) {
      const { error } = await supabase.from("stagiaires").update({
        ...form, birth_date: form.birth_date || null, updated_at: new Date().toISOString(),
      }).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      await supabase.from("audit_log").insert({
        organisme_id: organismeId, user_id: user!.id, user_role: "formateur",
        action: "update", table_name: "stagiaires", record_id: editing.id, payload: form,
      });
      toast.success("Stagiaire mis à jour");
    } else {
      const { data: created, error } = await supabase.from("stagiaires").insert({
        ...form, birth_date: form.birth_date || null, created_by: user!.id,
        organisme_id: organismeId, statut: "actif",
      }).select().single();
      if (error) { toast.error(error.message); return; }
      await supabase.from("audit_log").insert({
        organisme_id: organismeId, user_id: user!.id, user_role: "formateur",
        action: "create", table_name: "stagiaires", record_id: created.id, payload: form,
      });
      toast.success("Stagiaire créé");
      setNewStagiaireId(created.id);
      setSelectedFormationId("");
      setInscriptionOpen(true);
    }
    setDialogOpen(false);
    loadStagiaires();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { data: { user } } = await supabase.auth.getUser();
    const organismeId = "00000000-0000-0000-0000-000000000001";
    const { error } = await supabase.from("stagiaires").update({
      deleted_at: new Date().toISOString(), deleted_by: user!.id,
    }).eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("audit_log").insert({
      organisme_id: organismeId, user_id: user!.id, user_role: "formateur",
      action: "delete", table_name: "stagiaires", record_id: deleteTarget.id,
      payload: { first_name: deleteTarget.first_name, last_name: deleteTarget.last_name },
    });
    toast.success("Stagiaire archivé");
    setDeleteTarget(null);
    loadStagiaires();
  };

  const inscrire = async () => {
    if (!newStagiaireId || !selectedFormationId) return;
    const { error } = await supabase.from("formation_participants").insert({
      stagiaire_id: newStagiaireId, formation_id: selectedFormationId,
      organisme_id: "00000000-0000-0000-0000-000000000001",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Stagiaire inscrit à la formation");
    setInscriptionOpen(false);
    loadStagiaires();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Mes stagiaires</h1>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> Nouveau stagiaire
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
      ) : stagiaires.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground text-sm border-dashed">
          Aucun stagiaire — cliquez sur "Nouveau stagiaire" pour commencer
        </Card>
      ) : (
        <div className="space-y-2">
          {stagiaires.map(s => (
            <Card key={s.id} className="p-4 border-border/50 bg-card/60">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{s.first_name?.[0]}{s.last_name?.[0]}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{s.last_name.toUpperCase()} {s.first_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.birth_date && new Date(s.birth_date).toLocaleDateString("fr-FR")}
                      {s.city && ` · ${s.city}`}
                      {s.email && ` · ${s.email}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={() => setDeleteTarget(s)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le stagiaire" : "Nouveau stagiaire"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prénom *</Label><Input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} /></div>
              <div><Label>Nom *</Label><Input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} /></div>
            </div>
            <div><Label>Date de naissance *</Label><Input type="date" value={form.birth_date} onChange={e => setForm({...form, birth_date: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div><Label>Téléphone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            </div>
            <div><Label>Adresse</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Ville</Label><Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} /></div>
              <div><Label>Code postal</Label><Input value={form.postal_code} onChange={e => setForm({...form, postal_code: e.target.value})} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="resize-none" /></div>
            <Button className="w-full gradient-primary text-primary-foreground" onClick={submit}>
              {editing ? "Enregistrer" : "Créer le stagiaire"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Archiver ce stagiaire ?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            <b>{deleteTarget?.first_name} {deleteTarget?.last_name}</b> sera archivé.
            L'administrateur pourra le restaurer si besoin. Cette action n'est pas définitive.
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" className="flex-1" onClick={confirmDelete}>Archiver</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={inscriptionOpen} onOpenChange={setInscriptionOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>Inscrire à une formation ?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">
            Stagiaire créé. Voulez-vous l'inscrire directement dans une de vos formations ?
          </p>
          <Select value={selectedFormationId} onValueChange={setSelectedFormationId}>
            <SelectTrigger><SelectValue placeholder="Choisir une formation" /></SelectTrigger>
            <SelectContent>
              {formations.map((f: any) => (
                <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" className="flex-1" onClick={() => setInscriptionOpen(false)}>Passer</Button>
            <Button className="flex-1 gradient-primary text-primary-foreground" onClick={inscrire} disabled={!selectedFormationId}>
              Inscrire
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PageCours({ formateurId }: { formateurId: string | null }) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [cours, setCours] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!formateurId) return;
    Promise.all([
      supabase.from("formation_templates").select("*").eq("is_pack", false).order("code"),
      supabase.from("cours").select("*").order("chapitre_numero", { ascending: true }),
      supabase.from("formations").select("type, template_code").eq("formateur_id", formateurId),
      supabase.from("formateurs").select("cours_autorises").eq("id", formateurId).single(),
    ]).then(([{ data: tpl }, { data: cr }, { data: forms }, { data: fmt }]) => {
      const autoTypes = new Set<string>((forms ?? []).flatMap(f => [f.template_code, f.type].filter(Boolean)));
      const manual: string[] = fmt?.cours_autorises ?? [];
      manual.forEach(c => autoTypes.add(c));
      if (tpl) setTemplates(tpl.filter(t => autoTypes.has(t.code)));
      if (cr) setCours(cr);
    });
  }, [formateurId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Cours & contenus pédagogiques</h1>
      <div className="space-y-3">
        {templates.map(t => {
          const chs = cours.filter(c => c.formation_type === t.code);
          const isOpen = expanded === t.code;
          return (
            <Card key={t.code} className="border-border/50 bg-card/60 overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
                onClick={() => setExpanded(isOpen ? null : t.code)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.duration_hours > 0 ? `${t.duration_hours}h` : "Durée variable"}
                      {chs.length > 0 && ` · ${chs.length} chapitre${chs.length > 1 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t border-border/50">
                  {t.description && (
                    <div className="px-4 py-3 bg-muted/20 border-b border-border/30">
                      <p className="text-sm text-muted-foreground">{t.description}</p>
                    </div>
                  )}
                  {chs.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-muted-foreground text-center">Aucun contenu pédagogique disponible</p>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {chs.map((ch, i) => (
                        <div key={ch.id} className="px-4 py-3 flex gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold mt-0.5">
                            {ch.chapitre_numero ?? i + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium">{ch.titre}</p>
                            {ch.contenu && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{ch.contenu}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {templates.length === 0 && (
          <Card className="p-12 text-center text-muted-foreground text-sm border-dashed">
            Aucun cours disponible
          </Card>
        )}
      </div>
    </div>
  );
}

export default function EspaceFormateur() {
  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formateurId, setFormateurId] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [formateur, setFormateur] = useState<any>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [formations, setFormations] = useState<any[]>([]);
  const [participants, setParticipants] = useState<Record<string, any[]>>({});
  const [emargements, setEmargements] = useState<any[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadPerStagiaire, setUnreadPerStagiaire] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  const [selectedStagiaire, setSelectedStagiaire] = useState<any>(null);
  const [selectedFormation, setSelectedFormation] = useState<any>(null);
  const [stagiairePhoto, setStagiairePhoto] = useState<string | null>(null);
  const [competences, setCompetences] = useState<any[]>([]);
  const [modeConsultation, setModeConsultation] = useState(false); // true = lecture seule

  const [msgStagiaire, setMsgStagiaire] = useState<any>(null);
  const [menuOpsOpen, setMenuOpsOpen] = useState(false);
  const [msgFormation, setMsgFormation] = useState<any>(null);
  const [sigModal, setSigModal] = useState<{ formationId: string; periode: "matin" | "apres_midi" } | null>(null);

  useEffect(() => {
    document.title = "Espace formateur — SecureCRM";
    let intervalId: ReturnType<typeof setInterval>;
    const run = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setErreur("Non connecté"); setLoading(false); return; }
      const { data: fiche, error } = await supabase.from("formateurs").select("*").eq("email", user.email).single();
      if (error || !fiche) { setErreur("Aucune fiche formateur trouvée pour ce compte. Contactez l'administrateur."); setLoading(false); return; }
      setFormateur(fiche);
      setFormateurId(fiche.id);
      setAuthUserId(user.id);
      setLoading(false);
      loadAll(fiche.id);
      intervalId = setInterval(() => loadAll(fiche.id), 10000);
    };
    run();
    return () => clearInterval(intervalId);
  }, []);

  const loadAll = async (fid: string) => {
    const [{ data: p }, { data: form }, { data: em }] = await Promise.all([
      supabase.from("stagiaire_photos").select("*").eq("stagiaire_id", fid).single(),
      supabase.from("formations").select("*").eq("formateur_id", fid).order("start_date", { ascending: false }),
      supabase.from("emargements_formateur").select("*").eq("formateur_id", fid),
    ]);
    if (p) setPhoto(p.url);
    const formList = form ?? [];
    setFormations(formList);
    setEmargements(em ?? []);
    if (formList.length > 0) {
      const { data: parts } = await supabase
        .from("formation_participants")
        .select("*, stagiaire:stagiaires(id, first_name, last_name, email, status)")
        .in("formation_id", formList.map((f: any) => f.id));
      const grouped: Record<string, any[]> = {};
      (parts ?? []).forEach((p: any) => { grouped[p.formation_id] ??= []; grouped[p.formation_id].push(p); });
      setParticipants(grouped);
      const stagiaireIds = (parts ?? []).map((p: any) => p.stagiaire?.id).filter(Boolean);
      if (stagiaireIds.length > 0) {
        const { data: unreadData } = await supabase
          .from("messages")
          .select("a_stagiaire_id")
          .in("a_stagiaire_id", stagiaireIds)
          .not("de_stagiaire_id", "is", null)
          .eq("lu", false);
        const unreadMap: Record<string, number> = {};
        (unreadData ?? []).forEach((m: any) => {
          unreadMap[m.a_stagiaire_id] = (unreadMap[m.a_stagiaire_id] ?? 0) + 1;
        });
        setUnreadCount(Object.values(unreadMap).reduce((a, b) => a + b, 0));
        setUnreadPerStagiaire(unreadMap);


      }
    }
  };

  const openFicheStagiaire = async (stagiaire: any, formation: any, readOnly: boolean) => {
    setSelectedStagiaire(stagiaire);
    setSelectedFormation(formation);
    setModeConsultation(readOnly);
    setPage("stagiaire");
    const [{ data: ph }, { data: compDef }, { data: compVal }] = await Promise.all([
      supabase.from("stagiaire_photos").select("url").eq("stagiaire_id", stagiaire.id).single(),
      supabase.from("competences_formation").select("*").eq("formation_type", formation.type).order("ordre"),
      supabase.from("competences_validees").select("*").eq("stagiaire_id", stagiaire.id).eq("formation_id", formation.id),
    ]);
    setStagiairePhoto(ph?.url ?? null);
    const validees = compVal ?? [];
    setCompetences((compDef ?? []).map((c: any) => {
      const existing = validees.find((v: any) => v.competence_formation_id === c.id || v.competence === c.titre);
      return { id: c.id, label: c.titre, description: c.description, validee: existing?.validee ?? false, note: existing?.note ?? null, commentaire: existing?.commentaire ?? "", validee_id: existing?.id ?? null };
    }));
  };

  const openMessagerie = (stagiaire: any, formation: any) => {
    setMsgStagiaire(stagiaire);
    setMsgFormation(formation);
    setPage("messagerie");
  };

  const toggleCompetence = async (index: number) => {
    if (!formateurId || modeConsultation) return;
    const comp = competences[index];
    const newVal = !comp.validee;
    const updated = [...competences];
    if (comp.validee_id) {
      await supabase.from("competences_validees").update({ validee: newVal, valide_le: new Date().toISOString() }).eq("id", comp.validee_id);
      updated[index] = { ...comp, validee: newVal };
    } else {
      const { data } = await supabase.from("competences_validees").insert({
        stagiaire_id: selectedStagiaire.id, formation_id: selectedFormation.id, formateur_id: formateurId,
        competence: comp.label, competence_formation_id: comp.id, validee: newVal, valide_le: new Date().toISOString(),
      }).select().single();
      updated[index] = { ...comp, validee: newVal, validee_id: data?.id };
    }
    setCompetences(updated);
  };

  const saveNoteCompetence = async (index: number) => {
    if (!formateurId || modeConsultation) return;
    const comp = competences[index];
    const payload = { note: comp.note, commentaire: comp.commentaire };
    if (comp.validee_id) {
      await supabase.from("competences_validees").update(payload).eq("id", comp.validee_id);
    } else {
      const { data } = await supabase.from("competences_validees").insert({
        stagiaire_id: selectedStagiaire.id, formation_id: selectedFormation.id, formateur_id: formateurId,
        competence: comp.label, competence_formation_id: comp.id, ...payload, valide_le: new Date().toISOString(),
      }).select().single();
      const updated = [...competences];
      updated[index] = { ...comp, validee_id: data?.id };
      setCompetences(updated);
    }
    toast.success("Note enregistrée !");
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !formateurId) return;
    const file = e.target.files[0];
    setUploadingPhoto(true);
    try {
      const path = `photos/formateur_${formateurId}_${Date.now()}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(path);
      await supabase.from("stagiaire_photos").upsert({ stagiaire_id: formateurId, url: publicUrl }, { onConflict: "stagiaire_id" });
      setPhoto(publicUrl);
      toast.success("Photo mise à jour !");
    } catch (err: any) { toast.error(err.message); }
    finally { setUploadingPhoto(false); }
  };

  const signerEmargement = async (formationId: string, periode: "matin" | "apres_midi", signatureData: string) => {
    if (!formateurId) return;
    const exists = emargements.find(e => e.formation_id === formationId && e.date === today && e.periode === periode);
    if (exists) { toast.info("Déjà signé !"); return; }
    const { error } = await supabase.from("emargements_formateur").insert({
      formateur_id: formateurId,
      formation_id: formationId,
      date: today,
      periode,
      signe_le: new Date().toISOString(),
      signature_data: signatureData,
    });
    if (error) toast.error(error.message);
    else { toast.success("Émargement signé !"); loadAll(formateurId); }
  };

  const estSigne = (formationId: string, periode: "matin" | "apres_midi") =>
    emargements.some(e => e.formation_id === formationId && e.date === today && e.periode === periode);

  const formationsEnCours = formations.filter(f => f.start_date <= today && f.end_date >= today);
  const formationsAVenir = formations.filter(f => f.start_date > today);
  const formationsPassees = formations.filter(f => f.end_date < today);

  const tousLesStagiaires = Object.entries(participants).flatMap(([formationId, parts]) =>
    parts.map((p: any) => ({ stagiaire: p.stagiaire, formation: formations.find(f => f.id === formationId) }))
  ).filter(({ stagiaire, formation }) => stagiaire && formation);

 const navItems = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "formations", label: "Mes formations", icon: GraduationCap },
    { id: "stagiaires_fmt", label: "Mes stagiaires", icon: Users },
    { id: "cours", label: "Cours", icon: BookOpen },
    { id: "messagerie", label: "Messagerie", icon: MessageSquare, badge: unreadCount },
    { id: "emargement", label: "Émargement", icon: PenLine },
    { id: "maincourante", label: "Main courante", icon: FileText, parent: "operations" },
   { id: "mcconfig", label: "Configuration MC", icon: FileText, parent: "operations" },
    { id: "consignes", label: "Consignes", icon: FileText, parent: "operations" },
    { id: "permisfeu", label: "Permis de feu", icon: FileText, parent: "operations" },
    { id: "rondier", label: "Rondier", icon: FileText, parent: "operations" },
    { id: "certifications", label: "Mes certifications", icon: Award },
    { id: "profil", label: "Mon profil", icon: User },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border/50">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Espace formateur</p>
        <p className="font-display font-bold text-lg text-primary">SecureCRM</p>
      </div>
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full overflow-hidden bg-muted border-2 border-primary/40 cursor-pointer flex-shrink-0 flex items-center justify-center" onClick={() => photoRef.current?.click()}>
            {photo ? <img src={photo} alt="Photo" className="w-full h-full object-cover" /> : <span className="text-lg font-bold text-muted-foreground">{formateur?.first_name?.[0]}{formateur?.last_name?.[0]}</span>}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{formateur?.first_name} {formateur?.last_name}</p>
            <p className="text-xs text-muted-foreground">Formateur</p>
          </div>
        </div>
        <input ref={photoRef} type="file" className="hidden" accept="image/*" onChange={uploadPhoto} />
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {/* Items normaux */}
        {navItems.filter(n => !n.parent).map(({ id, label, icon: Icon, badge }) => (
          <button key={id} onClick={() => { setPage(id as Page); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${page === id || (page === "stagiaire" && id === "formations") ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}>
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {badge > 0 && <span className="h-5 w-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">{badge}</span>}
          </button>
        ))}

        {/* Opérations — accordéon */}
        <div>
          <button
            onClick={() => setMenuOpsOpen(prev => !prev)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-muted-foreground hover:bg-muted/40 hover:text-foreground">
            <Shield className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 text-left font-medium">Opérations</span>
            {menuOpsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {menuOpsOpen && (
            <div className="ml-4 border-l border-border/40 pl-3 space-y-1 mt-1">
              {navItems.filter(n => n.parent === "operations").map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setPage(id as Page); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${page === id ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}>
                  <Icon className="h-4 w-4 flex-shrink-0" />{label}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>
      <div className="p-4 border-t border-border/50">
        <button onClick={() => supabase.auth.signOut().then(() => window.location.href = "/auth")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors">
          <LogOut className="h-4 w-4" /> Déconnexion
        </button>
      </div>
    </div>
  );

  if (loading) return <div className="flex h-screen items-center justify-center bg-background"><p className="text-muted-foreground text-sm">Chargement…</p></div>;
  if (erreur) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center space-y-3 max-w-sm">
        <p className="text-destructive font-medium">{erreur}</p>
        <button onClick={() => supabase.auth.signOut().then(() => window.location.href = "/auth")} className="text-sm text-muted-foreground hover:text-foreground underline">Se déconnecter</button>
      </div>
    </div>
  );

  // Helper pour afficher les stagiaires d'une formation
  const ListeStagiaires = ({ f, readOnly }: { f: any; readOnly: boolean }) => {
    const ps = participants[f.id] ?? [];
    if (ps.length === 0) return null;
    return (
      <div className="mt-3 border-t border-border/30 pt-3">
        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
          <Users className="h-3 w-3" />{ps.length} stagiaire(s)
          {readOnly && <span className="ml-1 text-[10px] bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" /> Consultation</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {ps.map((p: any) => (
            <button key={p.id} onClick={() => openFicheStagiaire(p.stagiaire, f, readOnly)}
              className="text-xs px-3 py-1.5 rounded-full bg-muted/40 border border-border/50 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors">
              {p.stagiaire?.first_name} {p.stagiaire?.last_name}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const PageDashboard = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Bonjour {formateur?.first_name} 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">Voici un résumé de vos formations</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-card/60 border-border/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Formations</p>
          <p className="text-3xl font-bold text-primary">{formations.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{formationsEnCours.length} en cours</p>
        </Card>
        <Card className="p-5 bg-card/60 border-border/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Stagiaires</p>
          <p className="text-3xl font-bold text-primary">{Object.values(participants).reduce((acc, p) => acc + p.length, 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">au total</p>
        </Card>
        <Card className="p-5 bg-card/60 border-border/50 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setPage("messagerie")}>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Messages</p>
          <p className="text-3xl font-bold text-primary">{unreadCount}</p>
          <p className="text-xs text-muted-foreground mt-1">non lu{unreadCount !== 1 ? "s" : ""} — voir</p>
        </Card>
      </div>
      {formationsEnCours.map((f: any) => (
        <Card key={f.id} className="p-6 bg-emerald-500/5 border-emerald-500/30">
          <h2 className="font-semibold flex items-center gap-2 mb-4 text-emerald-400"><CheckCircle className="h-4 w-4" /> Formation en cours</h2>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-medium">{f.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(f.start_date).toLocaleDateString("fr-FR")} → {new Date(f.end_date).toLocaleDateString("fr-FR")}</p>
            </div>
            <Badge variant="outline" className="border-primary/40 text-primary">{f.type}</Badge>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={estSigne(f.id, "matin") ? "default" : "outline"} className={estSigne(f.id, "matin") ? "bg-emerald-600 text-white" : ""} onClick={() => signerEmargement(f.id, "matin")}>
              <PenLine className="h-3.5 w-3.5 mr-1.5" />{estSigne(f.id, "matin") ? "✓ Matin signé" : "Signer matin"}
            </Button>
            <Button size="sm" variant={estSigne(f.id, "apres_midi") ? "default" : "outline"} className={estSigne(f.id, "apres_midi") ? "bg-emerald-600 text-white" : ""} onClick={() => signerEmargement(f.id, "apres_midi")}>
              <PenLine className="h-3.5 w-3.5 mr-1.5" />{estSigne(f.id, "apres_midi") ? "✓ Après-midi signé" : "Signer après-midi"}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );

  const PageFormations = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Mes formations</h1>

      {/* EN COURS */}
      {formationsEnCours.length > 0 && (
        <div>
          <p className="text-xs text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> En cours ({formationsEnCours.length})
          </p>
          <div className="space-y-3">
            {formationsEnCours.map((f: any) => (
              <Card key={f.id} className="p-5 border-emerald-500/30 bg-emerald-500/5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium">{f.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(f.start_date).toLocaleDateString("fr-FR")} → {new Date(f.end_date).toLocaleDateString("fr-FR")}</span>
                      {f.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{f.location}</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className="border-primary/40 text-primary">{f.type}</Badge>
                </div>
                <ListeStagiaires f={f} readOnly={false} />
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* À VENIR */}
      {formationsAVenir.length > 0 && (
        <div>
          <p className="text-xs text-primary uppercase tracking-wider mb-3 flex items-center gap-1">
            <Calendar className="h-3 w-3" /> À venir ({formationsAVenir.length}) — consultation uniquement
          </p>
          <div className="space-y-3">
            {formationsAVenir.map((f: any) => (
              <Card key={f.id} className="p-5 border-border/50 bg-card/60">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium">{f.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(f.start_date).toLocaleDateString("fr-FR")} → {new Date(f.end_date).toLocaleDateString("fr-FR")}</span>
                      {f.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{f.location}</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className="border-primary/40 text-primary">{f.type}</Badge>
                </div>
                <ListeStagiaires f={f} readOnly={true} />
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* PASSÉES */}
      {formationsPassees.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
            <Eye className="h-3 w-3" /> Passées ({formationsPassees.length}) — consultation uniquement
          </p>
          <div className="space-y-3 opacity-70">
            {formationsPassees.map((f: any) => (
              <Card key={f.id} className="p-5 border-border/30 bg-card/40">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium">{f.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(f.start_date).toLocaleDateString("fr-FR")} → {new Date(f.end_date).toLocaleDateString("fr-FR")}</span>
                      {f.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{f.location}</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className="border-primary/40 text-primary">{f.type}</Badge>
                </div>
                <ListeStagiaires f={f} readOnly={true} />
              </Card>
            ))}
          </div>
        </div>
      )}

      {formations.length === 0 && <Card className="p-12 text-center text-muted-foreground text-sm border-dashed">Aucune formation assignée</Card>}
    </div>
  );

  const PageMessagerie = () => {
    if (msgStagiaire && msgFormation) {
      return (
        <div className="flex flex-col" style={{ height: "calc(100vh - 8rem)" }}>
          <button onClick={() => { setMsgStagiaire(null); setMsgFormation(null); if (formateurId) loadAll(formateurId); }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
            <ChevronLeft className="h-4 w-4" /> Retour aux conversations
          </button>
          <Card className="flex-1 overflow-hidden flex flex-col">
            <MessagerieChat stagiaireId={msgStagiaire.id} stagiaireNom={`${msgStagiaire.first_name} ${msgStagiaire.last_name}`} formationId={msgFormation.id} formationNom={msgFormation.title} formateurId={formateurId!} />
          </Card>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold">Messagerie</h1>
        {tousLesStagiaires.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground text-sm border-dashed">Aucun stagiaire dans vos formations</Card>
        ) : (
          <Card className="divide-y divide-border/50 overflow-hidden">
            {tousLesStagiaires.map(({ stagiaire, formation }, i) => {
  const nbNonLus = unreadPerStagiaire[stagiaire?.id] ?? 0;
  return (
    <button key={i} onClick={() => openMessagerie(stagiaire, formation)}
      className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors text-left">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
            {stagiaire?.first_name?.[0]}{stagiaire?.last_name?.[0]}
          </div>
          {nbNonLus > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold">
              {nbNonLus}
            </span>
          )}
        </div>
        <div>
          <p className={`text-sm font-medium ${nbNonLus > 0 ? "text-orange-400" : ""}`}>
            {stagiaire?.first_name} {stagiaire?.last_name}
          </p>
          <p className="text-xs text-muted-foreground">{formation?.title} — {formation?.type}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
})}
          </Card>
        )}
      </div>
    );
  };

  const PageEmargement = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Émargement</h1>
      <p className="text-muted-foreground text-sm">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      {formationsEnCours.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground text-sm border-dashed">Aucune formation en cours aujourd'hui</Card>
      ) : formationsEnCours.map((f: any) => (
        <Card key={f.id} className="p-6 bg-card/60 border-border/50">
          <div className="flex items-start justify-between mb-4">
            <div><p className="font-medium">{f.title}</p><p className="text-xs text-muted-foreground mt-1">{f.location || "—"}</p></div>
            <Badge variant="outline" className="border-primary/40 text-primary">{f.type}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["matin", "apres_midi"] as const).map(periode => (
              <button key={periode}
                onClick={() => !estSigne(f.id, periode) && setSigModal({ formationId: f.id, periode })}
                className={`p-4 rounded-xl border-2 transition-all text-center ${estSigne(f.id, periode) ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 cursor-default" : "border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-primary/5"}`}>
                <p className="font-semibold text-sm">{estSigne(f.id, periode) ? "✓ Signé" : "Signer"}</p>
                <p className="text-xs text-muted-foreground mt-1">{periode === "matin" ? "Matin" : "Après-midi"}</p>
              </button>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );


  const PageCertifications = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Mes certifications</h1>
      <div className="space-y-3">
        {Object.entries(CERT_LABELS).map(([key, label]) => {
          if (!formateur?.[key]) return null;
          const expiryKey = key.replace("_date", "_expiry");
          const expiry = formateur?.[expiryKey];
          const isExpired = expiry && new Date(expiry) < new Date();
          const isSoon = expiry && !isExpired && new Date(expiry) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
          return (
            <Card key={key} className={`p-5 border ${isExpired ? "border-red-500/30 bg-red-500/5" : isSoon ? "border-yellow-500/30 bg-yellow-500/5" : "border-border/50 bg-card/60"}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center ${isExpired ? "bg-red-500/20" : isSoon ? "bg-yellow-500/20" : "bg-emerald-500/20"}`}>
                    {isExpired || isSoon ? <AlertTriangle className={`h-4 w-4 ${isExpired ? "text-red-400" : "text-yellow-400"}`} /> : <CheckCircle className="h-4 w-4 text-emerald-400" />}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">Obtenu le {new Date(formateur[key]).toLocaleDateString("fr-FR")}</p>
                  </div>
                </div>
                {expiry && (
                  <div className="text-right">
                    <p className={`text-xs font-medium ${isExpired ? "text-red-400" : isSoon ? "text-yellow-400" : "text-emerald-400"}`}>{isExpired ? "Expiré" : isSoon ? "Expire bientôt" : "Valide"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(expiry).toLocaleDateString("fr-FR")}</p>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
        {!Object.keys(CERT_LABELS).some(k => formateur?.[k]) && <Card className="p-12 text-center text-muted-foreground text-sm border-dashed">Aucune certification enregistrée</Card>}
      </div>
    </div>
  );

  const PageProfil = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Mon profil</h1>
      <Card className="p-6 bg-card/60 border-border/50">
        <div className="flex items-center gap-6 mb-6">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-muted border-2 border-primary/40 cursor-pointer flex items-center justify-center flex-shrink-0" onClick={() => photoRef.current?.click()}>
            {photo ? <img src={photo} alt="Photo" className="w-full h-full object-cover" /> : <span className="text-3xl font-bold text-muted-foreground">{formateur?.first_name?.[0]}{formateur?.last_name?.[0]}</span>}
          </div>
          <div>
            <p className="font-display text-xl font-bold">{formateur?.first_name} {formateur?.last_name}</p>
            <p className="text-muted-foreground text-sm mt-1">{formateur?.email || "—"}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => photoRef.current?.click()}>
              <Camera className="h-3.5 w-3.5 mr-1.5" />{uploadingPhoto ? "Upload..." : "Changer la photo"}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm border-t border-border/50 pt-6">
          {[["Prénom", formateur?.first_name], ["Nom", formateur?.last_name], ["Email", formateur?.email], ["Téléphone", formateur?.phone], ["Carte CNAPS", formateur?.carte_pro_number]].map(([label, val]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
              <p className="font-medium">{val || "—"}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const PageFicheStagiaire = () => (
    <div className="space-y-6">
      <button onClick={() => setPage("formations")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" /> Retour aux formations
      </button>

      <Card className="p-6 bg-card/60 border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-muted border-2 border-primary/40 flex-shrink-0 flex items-center justify-center">
              {stagiairePhoto ? <img src={stagiairePhoto} alt="Photo" className="w-full h-full object-cover" /> : <span className="text-xl font-bold text-muted-foreground">{selectedStagiaire?.first_name?.[0]}{selectedStagiaire?.last_name?.[0]}</span>}
            </div>
            <div>
              <h2 className="text-xl font-display font-bold">{selectedStagiaire?.first_name} {selectedStagiaire?.last_name}</h2>
              <p className="text-muted-foreground text-sm">{selectedStagiaire?.email || "—"}</p>
              <p className="text-xs text-primary mt-1">Formation : {selectedFormation?.title} ({selectedFormation?.type})</p>
              {modeConsultation && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-muted/50 text-muted-foreground px-2 py-0.5 rounded mt-1">
                  <Eye className="h-3 w-3" /> Mode consultation — aucune modification possible
                </span>
              )}
            </div>
          </div>
          <Button size="sm" variant="outline" className="gap-2 flex-shrink-0" onClick={() => openMessagerie(selectedStagiaire, selectedFormation)}>
            <MessageSquare className="h-3.5 w-3.5" /> Messagerie
          </Button>
        </div>
      </Card>

      <Card className="p-6 bg-card/60 border-border/50">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <CheckCircle className="h-4 w-4 text-primary" />
          Compétences — {selectedFormation?.type} ({competences.length})
          {modeConsultation && <span className="text-xs text-muted-foreground font-normal ml-1">(lecture seule)</span>}
        </h3>
        {competences.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucune compétence définie pour ce type de formation</p>
        ) : (
          <div className="space-y-3">
            {competences.map((c, i) => (
              <div key={i} className={`rounded-lg border transition-all ${c.validee ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/50 bg-muted/10"} ${modeConsultation ? "opacity-80" : ""}`}>
                <div className="flex items-center justify-between p-3">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-sm font-medium">{c.label}</p>
                    {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                  </div>
                  {/* Bouton check — désactivé en mode consultation */}
                  <div className={`flex-shrink-0 h-7 w-7 rounded-full border-2 flex items-center justify-center ${c.validee ? "border-emerald-500 bg-emerald-500 text-white" : "border-border/50"} ${modeConsultation ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-emerald-500/50"}`}
                    onClick={() => !modeConsultation && toggleCompetence(i)}>
                    {c.validee && <Check className="h-3.5 w-3.5" />}
                  </div>
                </div>
                {/* Notes — visibles mais non modifiables en consultation */}
                <div className="px-3 pb-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground w-16">Note /10</p>
                    <div className="flex gap-1">
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <button key={n} disabled={modeConsultation}
                          onClick={() => { if (!modeConsultation) { const u = [...competences]; u[i] = { ...c, note: n }; setCompetences(u); } }}
                          className={`h-6 w-6 rounded text-xs font-bold transition-all ${c.note >= n ? n >= 7 ? "bg-emerald-500 text-white" : n >= 5 ? "bg-yellow-500 text-white" : "bg-red-500 text-white" : "bg-muted/40 text-muted-foreground"} ${modeConsultation ? "cursor-not-allowed opacity-60" : "hover:bg-muted"}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Commentaire" value={c.commentaire ?? ""} readOnly={modeConsultation}
                      onChange={(e) => { if (!modeConsultation) { const u = [...competences]; u[i] = { ...c, commentaire: e.target.value }; setCompetences(u); } }}
                      className={`flex-1 text-xs bg-muted/30 border border-border/50 rounded px-2 py-1 text-foreground placeholder:text-muted-foreground ${modeConsultation ? "cursor-not-allowed opacity-60" : ""}`} />
                    {!modeConsultation && (
                      <button onClick={() => saveNoteCompetence(i)} className="text-xs px-3 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
                        Sauver
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );

 const renderPage = () => {
    switch (page) {
      case "dashboard": return <PageDashboard />;
      case "formations": return <PageFormations />;
      case "stagiaires_fmt": return <PageStagiairesFormateur authUserId={authUserId} formateurId={formateurId} formations={formations} />;
      case "cours": return <PageCours formateurId={formateurId} />;
      case "messagerie": return <PageMessagerie />;
      case "emargement": return <PageEmargement />;
      case "maincourante": return <MainCouranteFormateur formateurId={formateurId!} />;
      case "mcconfig": return <MainCouranteConfig />;
     case "consignes": return <ConsignesFormateur formateurId={formateurId!} />;
     case "permisfeu": return <PermisFeuFormateur />;
     case "rondier": return <RondierFormateur formateurId={formateurId!} />;
      case "certifications": return <PageCertifications />;
      case "profil": return <PageProfil />;
      case "stagiaire": return <PageFicheStagiaire />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="hidden md:flex w-64 flex-col bg-card border-r border-border/50 flex-shrink-0"><SidebarContent /></aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card border-r border-border/50 z-10"><SidebarContent /></aside>
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden flex items-center justify-between p-4 border-b border-border/50 bg-card/80">
          <button onClick={() => setSidebarOpen(true)}><Menu className="h-5 w-5" /></button>
          <p className="font-display font-bold text-primary">SecureCRM</p>
          <div className="w-5" />
        </div>
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto">{renderPage()}</div>
        </main>
      </div>
      <SignatureModal
        open={!!sigModal}
        title={`Signature — ${sigModal?.periode === "matin" ? "Matin" : "Après-midi"}`}
        onConfirm={async (sig) => {
          if (sigModal) await signerEmargement(sigModal.formationId, sigModal.periode, sig);
          setSigModal(null);
        }}
        onClose={() => setSigModal(null)}
      />
    </div>
  );
}
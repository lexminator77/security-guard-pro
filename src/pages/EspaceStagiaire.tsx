// @ts-nocheck
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Download, Eye, Calendar, MapPin, BookOpen, Plus, Shield,
  ChevronDown, ChevronUp, Camera, CheckCircle, Clock,
  LayoutDashboard, GraduationCap, LogOut, User, Menu,
  Award, X, PenLine, MessageSquare, Send
} from "lucide-react";
import { toast } from "sonner";
import { PageMainCourante, ConsignesStagiaire, PermisFeuStagiaire, StatistiquesStagiaire, RondierStagiaire } from "@/components/MainCourante";const STATUS_COLOR: Record<string, string> = {
  valide: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  en_attente: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  rejete: "bg-red-500/20 text-red-400 border-red-500/30",
  archive: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

const STATUS_LABEL: Record<string, string> = {
  valide: "Validé", en_attente: "En attente", rejete: "Rejeté", archive: "Archivé",
};

type Page = "dashboard" | "formations" | "documents" | "cours" | "competences" | "emargement" | "profil" | "messagerie" | "maincourante_nouveau" | "maincourante_consulter" | "consignes" | "permisfeu" | "statistiques" | "rondier";
function Messagerie({ messages, setMessages, stagiaireId }: {
  messages: any[];
  setMessages: (m: any[]) => void;
  stagiaireId: string;
}) {
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!stagiaireId) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*, formateur:formateurs(first_name, last_name)")
        .eq("a_stagiaire_id", stagiaireId)
        .order("created_at");
      setMessages(data ?? []);
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [stagiaireId]);

  const handleSend = async () => {
    if (!msg.trim() || !stagiaireId) return;
    const { error } = await supabase.from("messages").insert({
      de_stagiaire_id: stagiaireId,
      a_stagiaire_id: stagiaireId,
      contenu: msg,
    });
    if (error) { toast.error(error.message); return; }
    setMsg("");
    const { data } = await supabase
      .from("messages")
      .select("*, formateur:formateurs(first_name, last_name)")
      .eq("a_stagiaire_id", stagiaireId)
      .order("created_at");
    setMessages(data ?? []);
    toast.success("Message envoyé !");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Messagerie</h1>
      <Card className="p-6 bg-card/60 border-border/50">
        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun message</p>
          ) : messages.map((m: any) => (
            <div key={m.id} className={`flex ${m.de_stagiaire_id ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xs p-3 rounded-lg text-sm ${m.de_stagiaire_id ? "bg-primary/20 border border-primary/30" : "bg-muted/40 border border-border/50"}`}>
                {!m.de_stagiaire_id && m.formateur && (
                  <p className="text-xs text-primary font-medium mb-1">{m.formateur.first_name} {m.formateur.last_name}</p>
                )}
                <p>{m.contenu}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(m.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t border-border/50 pt-4">
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Écrire un message à votre formateur..."
            className="flex-1 min-h-[60px] bg-muted/30 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <Button onClick={handleSend} size="icon" className="h-auto">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function EspaceStagiaire() {
  const [page, setPage] = useState<Page>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stagiaireId, setStagiaireId] = useState<string | null>(null);
  const [stagiaire, setStagiaire] = useState<any>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [formations, setFormations] = useState<any[]>([]);
  const [cours, setCours] = useState<any[]>([]);
  const [competences, setCompetences] = useState<any[]>([]);
  const [emargements, setEmargements] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [unreadFromFormateur, setUnreadFromFormateur] = useState(0);
  useEffect(() => {
  if (page === "messagerie") setUnreadFromFormateur(0);
}, [page]);
  const [openChapitre, setOpenChapitre] = useState<string | null>(null);
  const [menuMCOpen, setMenuMCOpen] = useState(false);
const [menuOpsOpen, setMenuOpsOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    document.title = "Mon espace — SecureCRM";
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErreur("Non connecté"); setLoading(false); return; }

    const { data: fiche, error } = await supabase
      .from("stagiaires")
      .select("*")
      .eq("email", user.email)
      .single();

    if (error || !fiche) {
      setErreur("Aucune fiche stagiaire trouvée pour ce compte. Contactez l'administrateur.");
      setLoading(false);
      return;
    }

    setStagiaire(fiche);
    setStagiaireId(fiche.id);
    setLoading(false);
    loadAll(fiche.id);
  };

  const loadAll = async (sid: string) => {
    const [{ data: p }, { data: d }, { data: f }, { data: cv }, { data: em }, { data: msgs }] = await Promise.all([
      supabase.from("stagiaire_photos").select("*").eq("stagiaire_id", sid).single(),
      supabase.from("stagiaire_documents").select("*").eq("stagiaire_id", sid).order("created_at", { ascending: false }),
      supabase.from("formation_participants").select("*, formation:formations(*)").eq("stagiaire_id", sid),
      supabase.from("competences_validees").select("*, formation:formations(title, type), formateur:formateurs(first_name, last_name)").eq("stagiaire_id", sid).order("valide_le", { ascending: false }),
      supabase.from("emargements_stagiaire").select("*").eq("stagiaire_id", sid),
      supabase.from("messages").select("*, formateur:formateurs(first_name, last_name)").eq("a_stagiaire_id", sid).order("created_at"),
    ]);

    if (p) setPhoto(p.url);
    setDocs(d ?? []);

    const formationsList = (f ?? []).map((fp: any) => fp.formation).filter(Boolean);
    setFormations(formationsList);

    const types = [...new Set(formationsList.map((fm: any) => fm.type).filter(Boolean))];
    if (types.length > 0) {
      const { data: c } = await supabase
        .from("cours")
        .select("*")
        .in("formation_type", types)
        .order("formation_type")
        .order("chapitre_numero");
      setCours(c ?? []);
    } else {
      setCours([]);
    }

    setCompetences(cv ?? []);
    setEmargements(em ?? []);
    setMessages(msgs ?? []);
    const nonLus = (msgs ?? []).filter((m: any) => m.de_formateur_id && !m.lu).length;
setUnreadFromFormateur(nonLus);
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !stagiaireId) return;
    const file = e.target.files[0];
    setUploadingPhoto(true);
    try {
      const path = `photos/${stagiaireId}_${Date.now()}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("documents").getPublicUrl(path);
      await supabase.from("stagiaire_photos").upsert({ stagiaire_id: stagiaireId, url: publicUrl }, { onConflict: "stagiaire_id" });
      setPhoto(publicUrl);
      toast.success("Photo mise à jour !");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const signerEmargement = async (formationId: string, periode: "matin" | "apres_midi") => {
    if (!stagiaireId) return;
    const exists = emargements.find(e => e.formation_id === formationId && e.date === today && e.periode === periode);
    if (exists) { toast.info("Déjà signé !"); return; }
    const { error } = await supabase.from("emargements_stagiaire").insert({
      stagiaire_id: stagiaireId,
      formation_id: formationId,
      date: today,
      periode,
      signe_le: new Date().toISOString(),
    });
    if (error) toast.error(error.message);
    else { toast.success("Émargement signé !"); loadAll(stagiaireId); }
  };

  const estSigne = (formationId: string, periode: "matin" | "apres_midi") =>
    emargements.some(e => e.formation_id === formationId && e.date === today && e.periode === periode);

  const formationsEnCours = formations.filter(f => f && f.start_date <= today && f.end_date >= today);
  const formationsAVenir = formations.filter(f => f && f.start_date > today);
  const formationsPassees = formations.filter(f => f && f.end_date < today);

  const navItems = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "formations", label: "Mes formations", icon: GraduationCap },
    { id: "emargement", label: "Émargement", icon: PenLine },
    { id: "competences", label: "Mes compétences", icon: Award },
    { id: "documents", label: "Mes documents", icon: FileText },
    { id: "cours", label: "Mes cours", icon: BookOpen },
    { id: "messagerie", label: "Messagerie", icon: MessageSquare, badge: unreadFromFormateur },
    
    { id: "maincourante_nouveau", label: "Nouveau", icon: Plus, parent: "maincourante", parentLabel: "Main courante" },
    { id: "maincourante_consulter", label: "Consulter", icon: Eye, parent: "maincourante", parentLabel: "Main courante" },
    { id: "profil", label: "Mon profil", icon: User },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border/50">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Espace stagiaire</p>
        <p className="font-display font-bold text-lg text-primary">SecureCRM</p>
      </div>
      <div className="p-6 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full overflow-hidden bg-muted border-2 border-primary/40 cursor-pointer flex-shrink-0 flex items-center justify-center"
            onClick={() => photoRef.current?.click()}>
            {photo ? <img src={photo} alt="Photo" className="w-full h-full object-cover" /> : <Camera className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{stagiaire?.first_name} {stagiaire?.last_name}</p>
            <Badge variant="outline" className={`text-[10px] mt-0.5 ${STATUS_COLOR[stagiaire?.status]}`}>{STATUS_LABEL[stagiaire?.status]}</Badge>
          </div>
        </div>
        <input ref={photoRef} type="file" className="hidden" accept="image/*" onChange={uploadPhoto} />
      </div>
     <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {/* Main courante — sous-menu */}
        {/* Main courante — sous-menu accordéon */}
{/* Opérations — menu accordéon */}
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
      {/* Main courante */}
      <div>
        <button
          onClick={() => setMenuMCOpen(prev => !prev)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-muted-foreground hover:bg-muted/40 hover:text-foreground">
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1 text-left">Main courante</span>
          {menuMCOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {menuMCOpen && (
          <div className="ml-4 border-l border-border/40 pl-3 space-y-1 mt-1">
            {navItems.filter(n => n.parent === "maincourante").map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setPage(id as Page); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${page === id ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}>
                <Icon className="h-4 w-4 flex-shrink-0" />{label}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* Consignes */}
      <button onClick={() => { setPage("consignes"); setSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${page === "consignes" ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}>
        <FileText className="h-4 w-4 flex-shrink-0" /> Consignes
      </button>
      {/* Permis de feu */}
      <button onClick={() => { setPage("permisfeu"); setSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${page === "permisfeu" ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}>
        <FileText className="h-4 w-4 flex-shrink-0" /> Permis de feu
      </button>
      {/* Statistiques */}
      <button onClick={() => { setPage("statistiques"); setSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${page === "statistiques" ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}>
        <FileText className="h-4 w-4 flex-shrink-0" /> Statistiques
      </button>
      {/* Rondier */}
      <button onClick={() => { setPage("rondier"); setSidebarOpen(false); }}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${page === "rondier" ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}>
        <FileText className="h-4 w-4 flex-shrink-0" /> Rondier
      </button>
    </div>
  )}
</div>
        {/* Autres items */}
        {navItems.filter(n => !n.parent).map(({ id, label, icon: Icon, badge }) => (
          <button key={id} onClick={() => { setPage(id as Page); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${page === id ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"}`}>
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {badge > 0 && <span className="h-5 w-5 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold">{badge}</span>}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-border/50">
        <button
          onClick={() => supabase.auth.signOut().then(() => window.location.href = "/auth")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors">
          <LogOut className="h-4 w-4" /> Déconnexion
        </button>
      </div>
    </div>
  );

  // Écran de chargement
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Chargement…</p>
      </div>
    );
  }

  // Écran d'erreur
  if (erreur) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-destructive font-medium">{erreur}</p>
          <button
            onClick={() => supabase.auth.signOut().then(() => window.location.href = "/auth")}
            className="text-sm text-muted-foreground hover:text-foreground underline">
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  const PageDashboard = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Bonjour {stagiaire?.first_name} 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">Voici un résumé de votre espace formation</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-card/60 border-border/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Formations</p>
          <p className="text-3xl font-bold text-primary">{formations.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{formationsEnCours.length} en cours</p>
        </Card>
        <Card className="p-5 bg-card/60 border-border/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Compétences</p>
          <p className="text-3xl font-bold text-primary">{competences.filter(c => c.validee).length}</p>
          <p className="text-xs text-muted-foreground mt-1">acquises / {competences.length}</p>
        </Card>
        <Card className="p-5 bg-card/60 border-border/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Documents</p>
          <p className="text-3xl font-bold text-primary">{docs.length}</p>
          <p className="text-xs text-muted-foreground mt-1">disponibles</p>
        </Card>
      </div>
      {formationsEnCours.map((f: any) => (
        <Card key={f.id} className="p-6 bg-emerald-500/5 border-emerald-500/30">
          <h2 className="font-semibold flex items-center gap-2 mb-3 text-emerald-400"><CheckCircle className="h-4 w-4" /> Formation en cours</h2>
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">{f.title}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(f.start_date).toLocaleDateString("fr-FR")} → {new Date(f.end_date).toLocaleDateString("fr-FR")}</p>
              {f.location && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" />{f.location}</p>}
            </div>
            <Badge variant="outline" className="border-primary/40 text-primary">{f.type}</Badge>
          </div>
        </Card>
      ))}
      {formationsAVenir.slice(0, 1).map((f: any) => (
        <Card key={f.id} className="p-6 bg-card/60 border-border/50">
          <h2 className="font-semibold flex items-center gap-2 mb-3"><Clock className="h-4 w-4 text-primary" /> Prochaine formation</h2>
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium">{f.title}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(f.start_date).toLocaleDateString("fr-FR")} → {new Date(f.end_date).toLocaleDateString("fr-FR")}</p>
            </div>
            <Badge variant="outline" className="border-primary/40 text-primary">{f.type}</Badge>
          </div>
        </Card>
      ))}
    </div>
  );

  const PageFormations = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Mes formations</h1>
      {[
        { label: "En cours", list: formationsEnCours, color: "bg-emerald-500/5 border-emerald-500/30" },
        { label: "À venir", list: formationsAVenir, color: "bg-card/60 border-border/50" },
        { label: "Passées", list: formationsPassees, color: "bg-card/40 border-border/30 opacity-60" },
      ].map(({ label, list, color }) => list.length > 0 && (
        <div key={label}>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">{label}</p>
          <div className="space-y-3">
            {list.map((f: any) => (
              <Card key={f.id} className={`p-5 ${color}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{f.title}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(f.start_date).toLocaleDateString("fr-FR")} → {new Date(f.end_date).toLocaleDateString("fr-FR")}</span>
                      {f.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{f.location}</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className="border-primary/40 text-primary">{f.type}</Badge>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
      {formations.length === 0 && <Card className="p-12 text-center text-muted-foreground text-sm border-dashed">Aucune formation assignée</Card>}
    </div>
  );

  const PageEmargement = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Émargement</h1>
      <p className="text-muted-foreground text-sm">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      {formationsEnCours.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground text-sm border-dashed">Aucune formation en cours aujourd'hui</Card>
      ) : formationsEnCours.map((f: any) => (
        <Card key={f.id} className="p-6 bg-card/60 border-border/50">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-medium">{f.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{f.location || "—"}</p>
            </div>
            <Badge variant="outline" className="border-primary/40 text-primary">{f.type}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(["matin", "apres_midi"] as const).map(periode => (
              <button key={periode} onClick={() => signerEmargement(f.id, periode)}
                className={`p-4 rounded-xl border-2 transition-all text-center ${estSigne(f.id, periode) ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-primary/5"}`}>
                <p className="font-semibold text-sm">{estSigne(f.id, periode) ? "✓ Signé" : "Signer"}</p>
                <p className="text-xs text-muted-foreground mt-1">{periode === "matin" ? "Matin" : "Après-midi"}</p>
              </button>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );

  const PageCompetences = () => {
    const grouped = competences.reduce((acc: any, c: any) => {
      const key = `${c.formation?.type} — ${c.formation?.title}`;
      acc[key] ??= [];
      acc[key].push(c);
      return acc;
    }, {});
    const total = competences.length;
    const acquises = competences.filter(c => c.validee).length;
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold">Mes compétences</h1>
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 bg-card/60 border-border/50 text-center">
            <p className="text-2xl font-bold text-primary">{total}</p>
            <p className="text-xs text-muted-foreground mt-1">Total</p>
          </Card>
          <Card className="p-4 bg-emerald-500/5 border-emerald-500/30 text-center">
            <p className="text-2xl font-bold text-emerald-400">{acquises}</p>
            <p className="text-xs text-muted-foreground mt-1">Acquises</p>
          </Card>
          <Card className="p-4 bg-red-500/5 border-red-500/30 text-center">
            <p className="text-2xl font-bold text-red-400">{total - acquises}</p>
            <p className="text-xs text-muted-foreground mt-1">Non acquises</p>
          </Card>
        </div>
        {total === 0 ? (
          <Card className="p-12 text-center text-muted-foreground text-sm border-dashed">Aucune compétence évaluée pour le moment</Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([key, comps]: any) => (
              <Card key={key} className="bg-card/60 border-border/50 overflow-hidden">
                <div className="p-4 border-b border-border/50 flex items-center gap-3">
                  <Badge variant="outline" className="border-primary/40 text-primary">{comps[0]?.formation?.type}</Badge>
                  <span className="text-sm font-medium">{comps[0]?.formation?.title}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{comps.filter((c: any) => c.validee).length}/{comps.length} acquises</span>
                </div>
                <div className="divide-y divide-border/30">
                  {(comps as any[]).map((c: any) => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium">{c.competence}</p>
                        {c.commentaire && <p className="text-xs text-muted-foreground mt-0.5 italic">"{c.commentaire}"</p>}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {c.note !== null && (
                          <span className={`text-sm font-bold ${c.note >= 7 ? "text-emerald-400" : c.note >= 5 ? "text-yellow-400" : "text-red-400"}`}>{c.note}/10</span>
                        )}
                        {c.validee
                          ? <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium"><CheckCircle className="h-4 w-4" /> Acquis</span>
                          : <span className="flex items-center gap-1 text-xs text-red-400 font-medium"><X className="h-4 w-4" /> Non acquis</span>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const PageDocuments = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Mes documents</h1>
      {docs.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground text-sm border-dashed">Aucun document disponible</Card>
      ) : (
        <Card className="p-6 bg-card/60 border-border/50">
          <div className="space-y-2">
            {docs.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{doc.nom}</p>
                    <p className="text-xs text-muted-foreground">Ajouté le {new Date(doc.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer"><Eye className="h-3.5 w-3.5 mr-1.5" /> Voir</a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={doc.url} download={doc.nom}><Download className="h-3.5 w-3.5 mr-1.5" /> Télécharger</a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );

  const PageCours = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Mes cours</h1>
      {cours.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground text-sm border-dashed">Aucun cours disponible</Card>
      ) : (
        <div className="space-y-2">
          {cours.map((c: any) => (
            <Card key={c.id} className="overflow-hidden border-border/50">
              <button className="w-full flex items-center justify-between p-5 bg-card/60 hover:bg-card/80 transition-colors text-left"
                onClick={() => setOpenChapitre(openChapitre === c.id ? null : c.id)}>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">{c.chapitre_numero}</div>
                  <span className="font-medium">{c.titre}</span>
                </div>
                {openChapitre === c.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {openChapitre === c.id && (
                <div className="p-6 bg-muted/10 border-t border-border/50 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{c.contenu}</div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const PageProfil = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Mon profil</h1>
      <Card className="p-6 bg-card/60 border-border/50">
        <div className="flex items-center gap-6 mb-6">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-muted border-2 border-primary/40 cursor-pointer flex items-center justify-center flex-shrink-0"
            onClick={() => photoRef.current?.click()}>
            {photo ? <img src={photo} alt="Photo" className="w-full h-full object-cover" /> : <Camera className="h-8 w-8 text-muted-foreground" />}
          </div>
          <div>
            <p className="font-display text-xl font-bold">{stagiaire?.first_name} {stagiaire?.last_name}</p>
            <p className="text-muted-foreground text-sm mt-1">{stagiaire?.email || "—"}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => photoRef.current?.click()}>
              <Camera className="h-3.5 w-3.5 mr-1.5" />{uploadingPhoto ? "Upload..." : "Changer la photo"}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm border-t border-border/50 pt-6">
          {[["Prénom", stagiaire?.first_name], ["Nom", stagiaire?.last_name], ["Email", stagiaire?.email], ["Téléphone", stagiaire?.phone], ["Carte pro", stagiaire?.carte_pro_number]].map(([label, val]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
              <p className="font-medium">{val || "—"}</p>
            </div>
          ))}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Statut</p>
            <Badge variant="outline" className={STATUS_COLOR[stagiaire?.status]}>{STATUS_LABEL[stagiaire?.status]}</Badge>
          </div>
        </div>
      </Card>
    </div>
  );

 const renderPage = () => {
    switch (page) {
      case "dashboard": return <PageDashboard />;
      case "formations": return <PageFormations />;
      case "emargement": return <PageEmargement />;
      case "competences": return <PageCompetences />;
      case "documents": return <PageDocuments />;
      case "cours": return <PageCours />;
      case "messagerie": return <Messagerie messages={messages} setMessages={setMessages} stagiaireId={stagiaireId!} />;
    case "consignes": return <ConsignesStagiaire />;
    case "permisfeu": return <PermisFeuStagiaire stagiaireId={stagiaireId!} formations={formations} />; 
    case "statistiques": return <StatistiquesStagiaire stagiaireId={stagiaireId!} />;
    case "rondier": return <RondierStagiaire stagiaireId={stagiaireId!} />;
    case "maincourante_nouveau": return <PageMainCourante stagiaireId={stagiaireId!} formations={formations} vue="nouveau" />;
case "maincourante_consulter": return <PageMainCourante stagiaireId={stagiaireId!} formations={formations} vue="consulter" />;
      case "profil": return <PageProfil />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="hidden md:flex w-64 flex-col bg-card border-r border-border/50 flex-shrink-0">
        <SidebarContent />
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card border-r border-border/50 z-10">
            <SidebarContent />
          </aside>
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
    </div>
  );
}
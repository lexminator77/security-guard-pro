// @ts-nocheck
import { useEffect, useState, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, ChevronLeft, Clock, AlertTriangle, CheckCircle,
  FileText, Eye, X
} from "lucide-react";
import { toast } from "sonner";
import { FiltreDateRange, FiltreDateValue, appliquerFiltreDateRange } from "./FiltreDateRange";

const FAMILLES = [
  "ACCIDENT", "ALERTE", "INCIDENT TECHNIQUE", "INCIDENTS SURETE",
  "INFRACTION SURETE", "INTERPELLATION", "SANTE SECURITE AU TRAVAIL", "SECURITE", "SURETE",
];

const TYPES_PAR_FAMILLE: Record<string, string[]> = {
  SECURITE: ["ALARME INTEMPESTIVE INCENDIE", "DEGAGEMENT DE FUMEE", "FUITE D'EAU", "ALARME INCENDIE", "ALARME SSI", "FEU REEL"],
  SURETE: ["INTRUSION", "TENTATIVE D'INTRUSION", "VOL", "TENTATIVE DE VOL", "VANDALISME", "MENACE"],
  ACCIDENT: ["ACCIDENT DE TRAVAIL", "ACCIDENT DE CIRCULATION", "ACCIDENT CORPOREL", "CHUTE"],
  ALERTE: ["ALERTE ATTENTAT", "ALERTE COLIS SUSPECT", "ALERTE BOMBE"],
  "INCIDENT TECHNIQUE": ["PANNE ELECTRIQUE", "PANNE ASCENSEUR", "PANNE SYSTEME SSI", "PANNE VIDÉOSURVEILLANCE"],
  "INCIDENTS SURETE": ["COMPORTEMENT SUSPECT", "BAGARRE", "ATTROUPEMENT", "TAPAGE"],
  "INFRACTION SURETE": ["INFRACTION AU REGLEMENT", "ACCES NON AUTORISE", "PORT D'ARME"],
  INTERPELLATION: ["INTERPELLATION POLICE", "REMISE POLICE", "RONDE POLICE"],
  "SANTE SECURITE AU TRAVAIL": ["MALAISE", "BLESSURE", "MISE EN SECURITE", "PREMIERS SECOURS"],
};

const SEVERITES = ["Sans conséquence", "Conséquence mineure", "Conséquence modérée", "Conséquence grave", "Conséquence très grave"];
const VICTIMES = ["Pas de victime", "Victime légère", "Victime grave", "Victime décédée"];

const FAMILLE_COLOR: Record<string, string> = {
  SECURITE: "bg-red-500/20 text-red-400 border-red-500/40",
  SURETE: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  ACCIDENT: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  ALERTE: "bg-pink-500/20 text-pink-400 border-pink-500/40",
  "INCIDENT TECHNIQUE": "bg-blue-500/20 text-blue-400 border-blue-500/40",
  "INCIDENTS SURETE": "bg-purple-500/20 text-purple-400 border-purple-500/40",
  "INFRACTION SURETE": "bg-slate-500/20 text-slate-400 border-slate-500/40",
  INTERPELLATION: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40",
  "SANTE SECURITE AU TRAVAIL": "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
};

function Formulaire({ stagiaireId, formationId, editData, onSaved, onCancel }: {
  stagiaireId: string; formationId?: string | null; editData?: any; onSaved: () => void; onCancel: () => void;
}) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5);

  const [famille, setFamille] = useState(editData?.famille ?? "");
  const [typeEvt, setTypeEvt] = useState(editData?.type_evenement ?? "");
  const [loc1, setLoc1] = useState(editData?.localisation_1 ?? "");
  const [loc2, setLoc2] = useState(editData?.localisation_2 ?? "");
  const [loc3, setLoc3] = useState(editData?.localisation_3 ?? "");
  const [loc4, setLoc4] = useState(editData?.localisation_4 ?? "");
  const [sevPhys, setSevPhys] = useState(editData?.severite_physique ?? "Sans conséquence");
  const [sevMat, setSevMat] = useState(editData?.severite_materiel ?? "Sans conséquence");
  const [victime, setVictime] = useState(editData?.victime ?? "Pas de victime");
  const [nbVictimes, setNbVictimes] = useState(editData?.nb_victimes ?? 0);
  const [int1, setInt1] = useState(editData?.intervenant_1 ?? "");
  const [appel1, setAppel1] = useState(editData?.appel_1 ?? "");
  const [arrivee1, setArrivee1] = useState(editData?.arrivee_1 ?? "");
  const [depart1, setDepart1] = useState(editData?.depart_1 ?? "");
  const [int2, setInt2] = useState(editData?.intervenant_2 ?? "");
  const [appel2, setAppel2] = useState(editData?.appel_2 ?? "");
  const [arrivee2, setArrivee2] = useState(editData?.arrivee_2 ?? "");
  const [depart2, setDepart2] = useState(editData?.depart_2 ?? "");
  const [dateDeb, setDateDeb] = useState(editData?.date_debut ?? todayStr);
  const [heureDeb, setHeureDeb] = useState(editData?.heure_debut ?? timeStr);
  const [dateFin, setDateFin] = useState(editData?.date_fin ?? "");
  const [heureFin, setHeureFin] = useState(editData?.heure_fin ?? "");
  const [description, setDescription] = useState(editData?.description ?? "");
  const [collegues, setCollegues] = useState<string[]>(editData?.collegues ?? []);
  const [nouveauCollegue, setNouveauCollegue] = useState("");
  const [saving, setSaving] = useState(false);
  const [famillesConfig, setFamillesConfig] = useState<string[]>([]);
  const [typesConfig, setTypesConfig] = useState<any[]>([]);

  useEffect(() => {
    const loadConfig = async () => {
      const { data } = await supabase.from("mc_config").select("*").order("valeur");
      setFamillesConfig((data ?? []).filter(d => d.type === "famille").map(d => d.valeur));
      setTypesConfig((data ?? []).filter(d => d.type === "type_evenement"));
    };
    loadConfig();
  }, []);

  const typesDispos = famille ? typesConfig.filter(t => t.famille_ref === famille).map(t => t.valeur) : [];
  const handleFamilleChange = (val: string) => { setFamille(val); setTypeEvt(""); };

  const save = async (statut: "brouillon" | "valide") => {
    if (!famille || !typeEvt) { toast.error("Famille et type d'événement obligatoires"); return; }
    setSaving(true);
    const payload = {
      stagiaire_id: stagiaireId, formation_id: formationId ?? null, famille, type_evenement: typeEvt,
      localisation_1: loc1 || null, localisation_2: loc2 || null, localisation_3: loc3 || null, localisation_4: loc4 || null,
      severite_physique: sevPhys, severite_materiel: sevMat, victime, nb_victimes: nbVictimes,
      intervenant_1: int1 || null, appel_1: appel1 || null, arrivee_1: arrivee1 || null, depart_1: depart1 || null,
      intervenant_2: int2 || null, appel_2: appel2 || null, arrivee_2: arrivee2 || null, depart_2: depart2 || null,
      date_debut: dateDeb, heure_debut: heureDeb, date_fin: dateFin || null, heure_fin: heureFin || null,
      description: description || null, collegues: collegues.length > 0 ? collegues : [], statut,
    };
    let error; let ficheId = editData?.id;
    if (editData?.id) {
      ({ error } = await supabase.from("main_courante").update(payload).eq("id", editData.id));
    } else {
      const { data: inserted, error: insertError } = await supabase.from("main_courante").insert(payload).select().single();
      error = insertError; ficheId = inserted?.id;
    }
    if (!error && ficheId) {
      await supabase.from("main_courante_historique").insert({
        main_courante_id: ficheId, stagiaire_id: stagiaireId,
        snapshot: { ...payload, sauvegarde_le: new Date().toISOString(), action: editData?.id ? "modification" : "creation" },
      });
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(statut === "valide" ? "Fiche validée !" : "Brouillon enregistré");
    onSaved();
  };

  const inputCls = "w-full bg-muted/30 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const selectCls = `${inputCls} cursor-pointer`;
  const labelCls = "text-xs text-muted-foreground uppercase tracking-wider mb-1 block";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>
        <h1 className="text-xl font-display font-bold">{editData ? "Modifier la fiche" : "Nouvelle fiche main courante"}</h1>
      </div>
      <Card className="p-6 bg-card/60 border-border/50 space-y-4">
        <h2 className="font-semibold text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-primary" /> Qualification de l'événement</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Famille *</label>
            <select className={selectCls} value={famille} onChange={e => handleFamilleChange(e.target.value)}>
              <option value="">— Choisir —</option>
              {famillesConfig.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Type d'événement *</label>
            <select className={selectCls} value={typeEvt} onChange={e => setTypeEvt(e.target.value)} disabled={!famille}>
              <option value="">— Choisir —</option>
              {typesDispos.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </Card>
      <Card className="p-6 bg-card/60 border-border/50 space-y-4">
        <h2 className="font-semibold text-sm">📍 Localisation</h2>
        <div className="grid grid-cols-2 gap-3">
          {[["Niveau 1 (Bâtiment)", loc1, setLoc1], ["Niveau 2 (Étage / Zone)", loc2, setLoc2], ["Niveau 3 (Salle / Local)", loc3, setLoc3], ["Niveau 4 (Précision)", loc4, setLoc4]].map(([label, val, setter]: any) => (
            <div key={label}><label className={labelCls}>{label}</label><input className={inputCls} value={val} onChange={e => setter(e.target.value)} placeholder={label} /></div>
          ))}
        </div>
      </Card>
      <Card className="p-6 bg-card/60 border-border/50 space-y-4">
        <h2 className="font-semibold text-sm">👥 Intervenants</h2>
        {[
          { label: "Intervenant 1", name: int1, setName: setInt1, appel: appel1, setAppel: setAppel1, arrivee: arrivee1, setArrivee: setArrivee1, depart: depart1, setDepart: setDepart1 },
          { label: "Intervenant 2", name: int2, setName: setInt2, appel: appel2, setAppel: setAppel2, arrivee: arrivee2, setArrivee: setArrivee2, depart: depart2, setDepart: setDepart2 },
        ].map(({ label, name, setName, appel, setAppel, arrivee, setArrivee, depart, setDepart }) => (
          <div key={label} className="space-y-2">
            <label className={labelCls}>{label}</label>
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Nom / Service (ex: POMPIERS)" />
            <div className="grid grid-cols-3 gap-2">
              {[["Appel", appel, setAppel], ["Arrivée", arrivee, setArrivee], ["Départ", depart, setDepart]].map(([l, v, s]: any) => (
                <div key={l}><label className={labelCls}>{l}</label><input type="time" className={inputCls} value={v} onChange={e => s(e.target.value)} /></div>
              ))}
            </div>
          </div>
        ))}
      </Card>
      <Card className="p-6 bg-card/60 border-border/50 space-y-4">
        <h2 className="font-semibold text-sm">⚠️ Sévérité & victimes</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className={labelCls}>Sévérité physique</label><select className={selectCls} value={sevPhys} onChange={e => setSevPhys(e.target.value)}>{SEVERITES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label className={labelCls}>Sévérité matérielle</label><select className={selectCls} value={sevMat} onChange={e => setSevMat(e.target.value)}>{SEVERITES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className={labelCls}>Victime</label><select className={selectCls} value={victime} onChange={e => setVictime(e.target.value)}>{VICTIMES.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
          <div><label className={labelCls}>Nombre de victimes</label><input type="number" min={0} className={inputCls} value={nbVictimes} onChange={e => setNbVictimes(Number(e.target.value))} /></div>
        </div>
      </Card>
      <Card className="p-6 bg-card/60 border-border/50 space-y-4">
        <h2 className="font-semibold text-sm">🕐 Précisions complémentaires</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label className={labelCls}>Date début</label><input type="date" className={inputCls} value={dateDeb} onChange={e => setDateDeb(e.target.value)} /></div>
          <div><label className={labelCls}>Heure début</label><input type="time" className={inputCls} value={heureDeb} onChange={e => setHeureDeb(e.target.value)} /></div>
          <div><label className={labelCls}>Date fin</label><input type="date" className={inputCls} value={dateFin} onChange={e => setDateFin(e.target.value)} /></div>
          <div><label className={labelCls}>Heure fin</label><input type="time" className={inputCls} value={heureFin} onChange={e => setHeureFin(e.target.value)} /></div>
        </div>
        <div>
          <label className={labelCls}>Description / Commentaire</label>
          <textarea className={`${inputCls} min-h-[100px] resize-none`} value={description} onChange={e => setDescription(e.target.value)} placeholder="Décrivez les circonstances de l'événement…" />
        </div>
      </Card>
      <Card className="p-6 bg-card/60 border-border/50 space-y-4">
        <h2 className="font-semibold text-sm">👥 Collègues présents</h2>
        <div className="flex gap-2">
          <input className={inputCls} value={nouveauCollegue} onChange={e => setNouveauCollegue(e.target.value)} placeholder="Nom du collègue…"
            onKeyDown={e => { if (e.key === "Enter" && nouveauCollegue.trim()) { setCollegues([...collegues, nouveauCollegue.trim()]); setNouveauCollegue(""); } }} />
          <Button type="button" variant="outline" onClick={() => { if (nouveauCollegue.trim()) { setCollegues([...collegues, nouveauCollegue.trim()]); setNouveauCollegue(""); } }}>Ajouter</Button>
        </div>
        {collegues.length === 0 ? <p className="text-xs text-muted-foreground">Aucun collègue ajouté</p> : (
          <div className="flex flex-wrap gap-2">
            {collegues.map((c, i) => (
              <div key={i} className="flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-full px-3 py-1">
                <span className="text-xs font-medium">{c}</span>
                <button onClick={() => setCollegues(collegues.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-400 transition-colors ml-1"><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        )}
      </Card>
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" disabled={saving} onClick={() => save("brouillon")}>Enregistrer brouillon</Button>
        <Button className="flex-1 bg-primary hover:bg-primary/90" disabled={saving} onClick={() => save("valide")}>
          <CheckCircle className="h-4 w-4 mr-2" />{saving ? "Enregistrement…" : "Valider la fiche"}
        </Button>
      </div>
    </div>
  );
}

function FicheCard({ fiche, onEdit, readOnly = false }: { fiche: any; onEdit?: (f: any) => void; readOnly?: boolean }) {
  const colorCls = FAMILLE_COLOR[fiche.famille] ?? "bg-muted/20 text-muted-foreground border-border/40";
  return (
    <Card className="p-5 bg-card/60 border-border/50 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={`text-xs ${colorCls}`}>{fiche.famille}</Badge>
          <span className="text-sm font-semibold">{fiche.type_evenement}</span>
          {fiche.statut === "brouillon" && <Badge variant="outline" className="text-xs border-yellow-500/40 text-yellow-400 bg-yellow-500/10">Brouillon</Badge>}
          {fiche.statut === "valide" && <Badge variant="outline" className="text-xs border-emerald-500/40 text-emerald-400 bg-emerald-500/10">Validée</Badge>}
        </div>
        {!readOnly && <button onClick={() => onEdit?.(fiche)} className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"><Eye className="h-3.5 w-3.5" /></button>}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(fiche.date_debut).toLocaleDateString("fr-FR")} à {fiche.heure_debut?.slice(0, 5)}</span>
        {(fiche.localisation_1 || fiche.localisation_2) && <span>📍 {[fiche.localisation_1, fiche.localisation_2, fiche.localisation_3].filter(Boolean).join(" › ")}</span>}
        {fiche.victime && fiche.victime !== "Pas de victime" && <span className="text-yellow-400">⚠️ {fiche.victime}</span>}
      </div>
      {fiche.description && <p className="text-xs text-muted-foreground italic border-t border-border/30 pt-2 line-clamp-2">{fiche.description}</p>}
      {readOnly && fiche.stagiaire && (
        <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">
          Par : <span className="text-foreground font-medium">{fiche.stagiaire.first_name} {fiche.stagiaire.last_name}</span>
          {fiche.formation && <span> — {fiche.formation.title}</span>}
        </p>
      )}
    </Card>
  );
}

export function PageMainCourante({ stagiaireId, formations, vue = "nouveau" }: { stagiaireId: string; formations: any[]; vue?: "nouveau" | "consulter" }) {
  const [fiches, setFiches] = useState<any[]>([]);
  const [view, setView] = useState<"liste" | "nouveau" | "edit">(vue === "nouveau" ? "nouveau" : "liste");
  const [editData, setEditData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filtrePeriode, setFiltrePeriode] = useState<"veille" | "semaine" | "mois">("veille");

  const formationEnCours = formations.find(f => { const today = new Date().toISOString().slice(0, 10); return f.start_date <= today && f.end_date >= today; });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("main_courante").select("*").eq("stagiaire_id", stagiaireId).order("created_at", { ascending: false });
    setFiches(data ?? []); setLoading(false);
  };

  useEffect(() => { load(); }, [stagiaireId]);
  useEffect(() => { if (vue === "nouveau") setView("nouveau"); else setView("liste"); }, [vue]);

  const handleEdit = (fiche: any) => { setEditData(fiche); setView("edit"); };

  const fichesFiltrees = fiches.filter(f => {
    const date = new Date(f.created_at); const now = new Date();
    if (filtrePeriode === "veille") { const v = new Date(now); v.setDate(v.getDate() - 1); return date >= v; }
    if (filtrePeriode === "semaine") { const s = new Date(now); s.setDate(s.getDate() - 7); return date >= s; }
    if (filtrePeriode === "mois") { const m = new Date(now); m.setMonth(m.getMonth() - 1); return date >= m; }
    return true;
  });

  if (view === "nouveau" || view === "edit") {
    return <Formulaire stagiaireId={stagiaireId} formationId={formationEnCours?.id ?? null} editData={view === "edit" ? editData : undefined}
      onSaved={() => { setView("liste"); setEditData(null); load(); }} onCancel={() => { setView("liste"); setEditData(null); }} />;
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-display font-bold">Consulter</h1><p className="text-muted-foreground text-sm mt-1">Historique de vos fiches main courante</p></div>
      <div className="flex gap-2">
        {([{ id: "veille", label: "Hier" }, { id: "semaine", label: "7 derniers jours" }, { id: "mois", label: "30 derniers jours" }] as const).map(f => (
          <button key={f.id} onClick={() => setFiltrePeriode(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtrePeriode === f.id ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>{f.label}</button>
        ))}
      </div>
      {loading ? <p className="text-muted-foreground text-sm text-center py-8">Chargement…</p>
        : fichesFiltrees.length === 0 ? <Card className="p-12 text-center border-dashed"><FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground text-sm">Aucune fiche sur cette période</p></Card>
        : <div className="space-y-3">{fichesFiltrees.map(f => <FicheCard key={f.id} fiche={f} onEdit={handleEdit} />)}</div>}
    </div>
  );
}

export function MainCouranteFormateur({ formateurId }: { formateurId: string }) {
  const [fiches, setFiches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<"toutes" | "brouillon" | "valide">("toutes");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from("main_courante").select("*, stagiaire:stagiaires(first_name, last_name), formation:formations(title, type)").order("created_at", { ascending: false });
      const fichesAvecHisto = await Promise.all((data ?? []).map(async (fiche) => {
        const { data: histo } = await supabase.from("main_courante_historique").select("*").eq("main_courante_id", fiche.id).order("created_at", { ascending: true });
        return { ...fiche, historique: histo ?? [] };
      }));
      setFiches(fichesAvecHisto); setLoading(false);
    };
    load();
  }, [formateurId]);

  const fichesFiltrees = filtre === "toutes" ? fiches : fiches.filter(f => f.statut === filtre);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold">Main courante</h1><p className="text-muted-foreground text-sm mt-1">Fiches saisies par vos stagiaires</p></div>
        <Badge variant="outline" className="border-primary/40 text-primary">{fiches.length} fiche{fiches.length > 1 ? "s" : ""}</Badge>
      </div>
      <div className="flex gap-2">
        {(["toutes", "valide", "brouillon"] as const).map(f => (
          <button key={f} onClick={() => setFiltre(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filtre === f ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>
            {f === "toutes" ? "Toutes" : f === "valide" ? "Validées" : "Brouillons"}
          </button>
        ))}
      </div>
      {loading ? <p className="text-muted-foreground text-sm text-center py-8">Chargement…</p>
        : fichesFiltrees.length === 0 ? <Card className="p-12 text-center border-dashed"><p className="text-muted-foreground text-sm">Aucune fiche</p></Card>
        : <div className="space-y-3">{fichesFiltrees.map(f => (
          <div key={f.id} className="space-y-2">
            <FicheCard fiche={f} readOnly />
            {f.historique && f.historique.length > 1 && (
              <div className="ml-4 border-l-2 border-primary/20 pl-4 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Historique des modifications</p>
                {f.historique.map((h: any, i: number) => (
                  <div key={h.id} className="bg-muted/20 border border-border/30 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-primary">{i === 0 ? "Création" : `Modification ${i}`}</span>
                      <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleDateString("fr-FR")} à {new Date(h.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="text-xs text-muted-foreground"><span className="text-foreground font-medium">{h.snapshot.famille}</span> — {h.snapshot.type_evenement}</p>
                    {h.snapshot.description && <p className="text-xs text-muted-foreground italic">"{h.snapshot.description}"</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}</div>}
    </div>
  );
}

export function MainCouranteConfig() {
  const [familles, setFamilles] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [nouvelleFamille, setNouvelleFamille] = useState("");
  const [nouveauType, setNouveauType] = useState("");
  const [familleSelectionnee, setFamilleSelectionnee] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("mc_config").select("*").order("valeur");
    setFamilles((data ?? []).filter(d => d.type === "famille"));
    setTypes((data ?? []).filter(d => d.type === "type_evenement"));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const ajouterFamille = async () => {
    if (!nouvelleFamille.trim()) return;
    const { error } = await supabase.from("mc_config").insert({ type: "famille", valeur: nouvelleFamille.trim().toUpperCase() });
    if (error) { toast.error(error.message); return; }
    toast.success("Famille ajoutée"); setNouvelleFamille(""); load();
  };
  const ajouterType = async () => {
    if (!nouveauType.trim() || !familleSelectionnee) return;
    const { error } = await supabase.from("mc_config").insert({ type: "type_evenement", valeur: nouveauType.trim().toUpperCase(), famille_ref: familleSelectionnee });
    if (error) { toast.error(error.message); return; }
    toast.success("Type ajouté"); setNouveauType(""); load();
  };
  const supprimer = async (id: string) => {
    if (!confirm("Supprimer ?")) return;
    await supabase.from("mc_config").delete().eq("id", id);
    toast.success("Supprimé"); load();
  };

  const inputCls = "w-full bg-muted/30 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const selectCls = `${inputCls} cursor-pointer`;
  if (loading) return <p className="text-muted-foreground text-sm text-center py-8">Chargement…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Configuration main courante</h1>
      <Card className="p-6 bg-card/60 border-border/50 space-y-4">
        <h2 className="font-semibold text-sm">Familles d'événements</h2>
        <div className="flex gap-2">
          <input className={inputCls} value={nouvelleFamille} onChange={e => setNouvelleFamille(e.target.value)} placeholder="Nouvelle famille…" onKeyDown={e => { if (e.key === "Enter") ajouterFamille(); }} />
          <Button variant="outline" onClick={ajouterFamille}>Ajouter</Button>
        </div>
        <div className="space-y-2">
          {familles.map(f => (
            <div key={f.id} className="flex items-center justify-between px-3 py-2 bg-muted/20 rounded-lg border border-border/30">
              <span className="text-sm font-medium">{f.valeur}</span>
              <button onClick={() => supprimer(f.id)} className="text-muted-foreground hover:text-red-400 transition-colors"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-6 bg-card/60 border-border/50 space-y-4">
        <h2 className="font-semibold text-sm">Types d'événements</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select className={selectCls} value={familleSelectionnee} onChange={e => setFamilleSelectionnee(e.target.value)}>
            <option value="">— Famille parente —</option>
            {familles.map(f => <option key={f.id} value={f.valeur}>{f.valeur}</option>)}
          </select>
          <input className={inputCls} value={nouveauType} onChange={e => setNouveauType(e.target.value)} placeholder="Nouveau type…" onKeyDown={e => { if (e.key === "Enter") ajouterType(); }} />
          <Button variant="outline" onClick={ajouterType}>Ajouter</Button>
        </div>
        <div className="space-y-2">
          {familles.map(f => {
            const typesDeFamille = types.filter(t => t.famille_ref === f.valeur);
            if (typesDeFamille.length === 0) return null;
            return (
              <div key={f.id}>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 mt-3">{f.valeur}</p>
                <div className="space-y-1">
                  {typesDeFamille.map(t => (
                    <div key={t.id} className="flex items-center justify-between px-3 py-2 bg-muted/20 rounded-lg border border-border/30">
                      <span className="text-sm">{t.valeur}</span>
                      <button onClick={() => supprimer(t.id)} className="text-muted-foreground hover:text-red-400 transition-colors"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

const TYPE_CONSIGNE = {
  generale: { label: "Générale", color: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
  temporaire: { label: "Temporaire", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" },
  urgente: { label: "Urgente", color: "bg-red-500/20 text-red-400 border-red-500/40" },
};

export function ConsignesFormateur({ formateurId }: { formateurId: string }) {
  const [consignes, setConsignes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [type, setType] = useState("generale");
  const [dateFin, setDateFin] = useState("");
  const [saving, setSaving] = useState(false);
  const [filtreDateRange, setFiltreDateRange] = useState<FiltreDateValue>({ type: "preset", preset: "toutes" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("consignes").select("*, formateur:formateurs(first_name, last_name)").order("created_at", { ascending: false });
    setConsignes(data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!titre.trim() || !contenu.trim()) { toast.error("Titre et contenu obligatoires"); return; }
    setSaving(true);
    const { error } = await supabase.from("consignes").insert({ formateur_id: formateurId, titre: titre.trim(), contenu: contenu.trim(), type, date_fin: dateFin || null, actif: true });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Consigne créée !"); setTitre(""); setContenu(""); setType("generale"); setDateFin(""); setShowForm(false); load();
  };
  const toggleActif = async (id: string, actif: boolean) => { await supabase.from("consignes").update({ actif: !actif }).eq("id", id); load(); };
  const supprimer = async (id: string) => { if (!confirm("Supprimer cette consigne ?")) return; await supabase.from("consignes").delete().eq("id", id); toast.success("Consigne supprimée"); load(); };

  const inputCls = "w-full bg-muted/30 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const selectCls = `${inputCls} cursor-pointer`;

  const consignesFiltrees = consignes.filter(c =>
    appliquerFiltreDateRange(c.created_at, filtreDateRange)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold">Consignes</h1><p className="text-muted-foreground text-sm mt-1">Gérez les consignes pour vos stagiaires</p></div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-primary hover:bg-primary/90 gap-2"><Plus className="h-4 w-4" /> Nouvelle consigne</Button>
      </div>
      {showForm && (
        <Card className="p-6 bg-card/60 border-primary/30 space-y-4">
          <h2 className="font-semibold text-sm">Nouvelle consigne</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Type</label>
              <select className={selectCls} value={type} onChange={e => setType(e.target.value)}>
                <option value="generale">Générale</option><option value="temporaire">Temporaire</option><option value="urgente">Urgente</option>
              </select>
            </div>
            {type === "temporaire" && <div><label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Date de fin</label><input type="date" className={inputCls} value={dateFin} onChange={e => setDateFin(e.target.value)} /></div>}
          </div>
          <div><label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Titre</label><input className={inputCls} value={titre} onChange={e => setTitre(e.target.value)} placeholder="Titre de la consigne…" /></div>
          <div><label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Contenu</label><textarea className={`${inputCls} min-h-[100px] resize-none`} value={contenu} onChange={e => setContenu(e.target.value)} placeholder="Détaillez la consigne…" /></div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90" disabled={saving} onClick={save}>{saving ? "Enregistrement…" : "Créer la consigne"}</Button>
          </div>
        </Card>
      )}
      <FiltreDateRange value={filtreDateRange} onChange={setFiltreDateRange} />
      {loading ? <p className="text-muted-foreground text-sm text-center py-8">Chargement…</p>
        : consignesFiltrees.length === 0 ? <Card className="p-12 text-center border-dashed"><p className="text-muted-foreground text-sm">{consignes.length === 0 ? "Aucune consigne créée" : "Aucune consigne sur cette période"}</p></Card>
        : <div className="space-y-3">{consignesFiltrees.map(c => (
          <Card key={c.id} className={`p-5 border-border/50 space-y-2 ${!c.actif ? "opacity-50" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-xs ${TYPE_CONSIGNE[c.type as keyof typeof TYPE_CONSIGNE]?.color}`}>{TYPE_CONSIGNE[c.type as keyof typeof TYPE_CONSIGNE]?.label}</Badge>
                <span className="font-semibold text-sm">{c.titre}</span>
                {!c.actif && <Badge variant="outline" className="text-xs border-zinc-500/40 text-zinc-400">Désactivée</Badge>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => toggleActif(c.id, c.actif)} className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors text-xs px-2">{c.actif ? "Désactiver" : "Activer"}</button>
                <button onClick={() => supprimer(c.id)} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.contenu}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Par {c.formateur?.first_name} {c.formateur?.last_name}</span>
              <span>{new Date(c.created_at).toLocaleDateString("fr-FR")}</span>
              {c.date_fin && <span className="text-yellow-400">Expire le {new Date(c.date_fin).toLocaleDateString("fr-FR")}</span>}
            </div>
          </Card>
        ))}</div>}
    </div>
  );
}

export function ConsignesStagiaire() {
  const [consignes, setConsignes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreType, setFiltreType] = useState<"toutes" | "generale" | "temporaire" | "urgente">("toutes");
  const [filtreDateRange, setFiltreDateRange] = useState<FiltreDateValue>({ type: "preset", preset: "toutes" });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from("consignes").select("*, formateur:formateurs(first_name, last_name)").eq("actif", true).order("created_at", { ascending: false });
      setConsignes(data ?? []); setLoading(false);
    };
    load();
  }, []);

  const consignesFiltrees = consignes.filter(c => {
    if (filtreType !== "toutes" && c.type !== filtreType) return false;
    return appliquerFiltreDateRange(c.created_at, filtreDateRange);
  });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-display font-bold">Consignes</h1><p className="text-muted-foreground text-sm mt-1">Consignes en vigueur</p></div>
      <div className="flex gap-2 flex-wrap">
        {(["toutes", "urgente", "temporaire", "generale"] as const).map(f => (
          <button key={f} onClick={() => setFiltreType(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtreType === f ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>
            {f === "toutes" ? "Toutes" : TYPE_CONSIGNE[f].label}
          </button>
        ))}
      </div>
      <FiltreDateRange value={filtreDateRange} onChange={setFiltreDateRange} />
      {loading ? <p className="text-muted-foreground text-sm text-center py-8">Chargement…</p>
        : consignesFiltrees.length === 0 ? <Card className="p-12 text-center border-dashed"><p className="text-muted-foreground text-sm">Aucune consigne sur cette période</p></Card>
        : <div className="space-y-3">{consignesFiltrees.map(c => (
          <Card key={c.id} className="p-5 bg-card/60 border-border/50 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-xs ${TYPE_CONSIGNE[c.type as keyof typeof TYPE_CONSIGNE]?.color}`}>{TYPE_CONSIGNE[c.type as keyof typeof TYPE_CONSIGNE]?.label}</Badge>
              <span className="font-semibold text-sm">{c.titre}</span>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{c.contenu}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Par {c.formateur?.first_name} {c.formateur?.last_name}</span>
              <span>{new Date(c.created_at).toLocaleDateString("fr-FR")}</span>
              {c.date_fin && <span className="text-yellow-400">⚠️ Expire le {new Date(c.date_fin).toLocaleDateString("fr-FR")}</span>}
            </div>
          </Card>
        ))}</div>}
    </div>
  );
}

export function PermisFeuStagiaire({ stagiaireId, formations }: { stagiaireId: string; formations: any[] }) {
  const [vue, setVue] = useState<"liste" | "nouveau" | "edit">("liste");
  const [onglet, setOnglet] = useState<"actif" | "archive">("actif");
  const [filtreDateRange, setFiltreDateRange] = useState<FiltreDateValue>({ type: "preset", preset: "toutes" });
  const [permis, setPermis] = useState<any[]>([]);
  const [editData, setEditData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const formationEnCours = formations.find(f => { const today = new Date().toISOString().slice(0, 10); return f.start_date <= today && f.end_date >= today; });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("permis_feu").select("*").eq("stagiaire_id", stagiaireId).order("created_at", { ascending: false });
    setPermis(data ?? []); setLoading(false);
  };
  useEffect(() => { load(); }, [stagiaireId]);

  const archiver = async (id: string) => { await supabase.from("permis_feu").update({ statut: "archive" }).eq("id", id); toast.success("Permis archivé"); load(); };

  const permisFiltres = permis.filter(p => {
    if (onglet === "actif" && p.statut === "archive") return false;
    if (onglet === "archive" && p.statut !== "archive") return false;
    return appliquerFiltreDateRange(p.date_debut, filtreDateRange);
  });

  if (vue === "nouveau" || vue === "edit") {
    return <PermisFeuFormulaire stagiaireId={stagiaireId} formationId={formationEnCours?.id ?? null} editData={vue === "edit" ? editData : undefined}
      onSaved={() => { setVue("liste"); setEditData(null); load(); }} onCancel={() => { setVue("liste"); setEditData(null); }} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold">Permis de feu</h1><p className="text-muted-foreground text-sm mt-1">Gérez vos permis de feu</p></div>
        <Button onClick={() => setVue("nouveau")} className="bg-primary hover:bg-primary/90 gap-2"><Plus className="h-4 w-4" /> Nouveau</Button>
      </div>
      <div className="flex gap-2">
        {([["actif", "En cours"], ["archive", "Archivés"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setOnglet(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${onglet === id ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>{label}</button>
        ))}
      </div>
      <FiltreDateRange value={filtreDateRange} onChange={setFiltreDateRange} />
      {loading ? <p className="text-muted-foreground text-sm text-center py-8">Chargement…</p>
        : permisFiltres.length === 0 ? <Card className="p-12 text-center border-dashed"><p className="text-muted-foreground text-sm">Aucun permis {onglet === "archive" ? "archivé" : "en cours"}</p></Card>
        : <div className="space-y-3">{permisFiltres.map(p => (
          <Card key={p.id} className="p-5 bg-card/60 border-border/50 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-xs ${p.statut === "archive" ? "border-zinc-500/40 text-zinc-400" : p.statut === "actif" ? "border-emerald-500/40 text-emerald-400" : "border-yellow-500/40 text-yellow-400"}`}>
                  {p.statut === "archive" ? "Archivé" : p.statut === "actif" ? "Actif" : "Brouillon"}
                </Badge>
                <span className="font-semibold text-sm">Permis N°{p.numero}</span>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {p.statut !== "archive" && (
                  <>
                    <button onClick={() => { setEditData(p); setVue("edit"); }} className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"><Eye className="h-3.5 w-3.5" /></button>
                    <button onClick={() => archiver(p.id)} className="text-xs px-2 py-1 rounded hover:bg-yellow-500/10 text-muted-foreground hover:text-yellow-400 transition-colors">Archiver</button>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {p.nom_societe && <span>🏢 {p.nom_societe}</span>}
              {p.nom_intervenant && <span>👤 {p.nom_intervenant}</span>}
              {p.lieu_travaux && <span>📍 {p.lieu_travaux}</span>}
              {p.date_debut && <span>📅 {new Date(p.date_debut).toLocaleDateString("fr-FR")}</span>}
            </div>
            {p.nature_travaux && <p className="text-xs text-muted-foreground italic">{p.nature_travaux}</p>}
          </Card>
        ))}</div>}
    </div>
  );
}

function PermisFeuFormulaire({ stagiaireId, formationId, editData, onSaved, onCancel }: {
  stagiaireId: string; formationId?: string | null; editData?: any; onSaved: () => void; onCancel: () => void;
}) {
  const [etape, setEtape] = useState(1);
  const [saving, setSaving] = useState(false);
  const [nomSociete, setNomSociete] = useState(editData?.nom_societe ?? "");
  const [nomIntervenant, setNomIntervenant] = useState(editData?.nom_intervenant ?? "");
  const [dateDeb, setDateDeb] = useState(editData?.date_debut ?? "");
  const [heureDeb, setHeureDeb] = useState(editData?.heure_debut ?? "");
  const [dateFin, setDateFin] = useState(editData?.date_fin ?? "");
  const [heureFin, setHeureFin] = useState(editData?.heure_fin ?? "");
  const [lieu, setLieu] = useState(editData?.lieu_travaux ?? "");
  const [nature, setNature] = useState(editData?.nature_travaux ?? "");
  const [pret, setPret] = useState(editData?.pret_materiel ?? "");
  const [autorisation, setAutorisation] = useState(editData?.autorisation ?? false);
  const [consignes, setConsignes] = useState(editData?.consignes_particulieres ?? "");
  const [risques, setRisques] = useState(editData?.risques_identifies ?? "");
  const [telPC, setTelPC] = useState(editData?.tel_pc_securite ?? "");
  const [extincteurs, setExtincteurs] = useState(editData?.extincteurs ?? false);
  const [ria, setRia] = useState(editData?.ria ?? false);
  const [sprinklers, setSprinklers] = useState(editData?.sprinklers ?? false);
  const [autreProtection, setAutreProtection] = useState(editData?.autre_protection ?? "");
  const [rondesExecution, setRondesExecution] = useState(editData?.rondes_execution ?? false);
  const [surveillanceAccrue, setSurveillanceAccrue] = useState(editData?.surveillance_accrue ?? false);
  const [rondeDebut, setRondeDebut] = useState(editData?.ronde_debut ?? false);
  const [evacuerLiquides, setEvacuerLiquides] = useState(editData?.evacuer_liquides ?? false);
  const [evacuerMateriaux, setEvacuerMateriaux] = useState(editData?.evacuer_materiaux ?? false);
  const [balayerSol, setBalayerSol] = useState(editData?.balayer_sol ?? false);
  const [couvrirOuvertures, setCouvrirOuvertures] = useState(editData?.couvrir_ouvertures ?? false);
  const [suspendreBaches, setSuspendreBaches] = useState(editData?.suspendre_baches ?? false);
  const [verifierIsolation, setVerifierIsolation] = useState(editData?.verifier_isolation ?? false);
  const [verifierMateriaux, setVerifierMateriaux] = useState(editData?.verifier_materiaux ?? false);
  const [nettoyerEquipements, setNettoyerEquipements] = useState(editData?.nettoyer_equipements ?? false);
  const [viderConteneurs, setViderConteneurs] = useState(editData?.vider_conteneurs ?? false);

  const inputCls = "w-full bg-muted/30 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";
  const labelCls = "text-xs text-muted-foreground uppercase tracking-wider mb-1 block";
  const checkCls = "flex items-center gap-2 p-3 rounded-lg border border-border/40 bg-muted/10 hover:bg-muted/20 cursor-pointer transition-colors";

  const save = async (statut: "brouillon" | "actif") => {
    setSaving(true);
    const payload = {
      stagiaire_id: stagiaireId, formation_id: formationId ?? null, statut,
      nom_societe: nomSociete || null, nom_intervenant: nomIntervenant || null,
      date_debut: dateDeb || null, heure_debut: heureDeb || null, date_fin: dateFin || null, heure_fin: heureFin || null,
      lieu_travaux: lieu || null, nature_travaux: nature || null, pret_materiel: pret || null, autorisation,
      consignes_particulieres: consignes || null, risques_identifies: risques || null, tel_pc_securite: telPC || null,
      extincteurs, ria, sprinklers, autre_protection: autreProtection || null,
      rondes_execution: rondesExecution, surveillance_accrue: surveillanceAccrue, ronde_debut: rondeDebut,
      evacuer_liquides: evacuerLiquides, evacuer_materiaux: evacuerMateriaux, balayer_sol: balayerSol,
      couvrir_ouvertures: couvrirOuvertures, suspendre_baches: suspendreBaches,
      verifier_isolation: verifierIsolation, verifier_materiaux: verifierMateriaux,
      nettoyer_equipements: nettoyerEquipements, vider_conteneurs: viderConteneurs,
    };
    let error;
    if (editData?.id) { ({ error } = await supabase.from("permis_feu").update(payload).eq("id", editData.id)); }
    else { ({ error } = await supabase.from("permis_feu").insert(payload)); }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(statut === "actif" ? "Permis validé !" : "Brouillon enregistré"); onSaved();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft className="h-4 w-4" /> Retour</button>
        <h1 className="text-xl font-display font-bold">{editData ? "Modifier le permis" : "Nouveau permis de feu"}</h1>
      </div>
      <div className="flex items-center gap-4">
        {[["1", "Travaux"], ["2", "Précautions"]].map(([num, label], i) => (
          <div key={num} className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${etape === i + 1 ? "bg-primary text-white" : etape > i + 1 ? "bg-emerald-500 text-white" : "bg-muted/40 text-muted-foreground"}`}>{etape > i + 1 ? "✓" : num}</div>
            <span className={`text-sm ${etape === i + 1 ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
            {i === 0 && <div className="w-16 h-px bg-border/50 mx-2" />}
          </div>
        ))}
      </div>
      {etape === 1 && (
        <div className="space-y-4">
          <Card className="p-6 bg-card/60 border-border/50 space-y-4">
            <h2 className="font-semibold text-sm border-b border-border/30 pb-2">Les travaux sont effectués par</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Nom de la société</label><input className={inputCls} value={nomSociete} onChange={e => setNomSociete(e.target.value)} /></div>
              <div><label className={labelCls}>Nom de l'intervenant</label><input className={inputCls} value={nomIntervenant} onChange={e => setNomIntervenant(e.target.value)} /></div>
            </div>
          </Card>
          <Card className="p-6 bg-card/60 border-border/50 space-y-4">
            <h2 className="font-semibold text-sm border-b border-border/30 pb-2">Démarrage travaux</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Date démarrage</label><input type="date" className={inputCls} value={dateDeb} onChange={e => setDateDeb(e.target.value)} /></div>
              <div><label className={labelCls}>Heure démarrage</label><input type="time" className={inputCls} value={heureDeb} onChange={e => setHeureDeb(e.target.value)} /></div>
            </div>
          </Card>
          <Card className="p-6 bg-card/60 border-border/50 space-y-4">
            <h2 className="font-semibold text-sm border-b border-border/30 pb-2">Fin travaux</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Date fin</label><input type="date" className={inputCls} value={dateFin} onChange={e => setDateFin(e.target.value)} /></div>
              <div><label className={labelCls}>Heure fin</label><input type="time" className={inputCls} value={heureFin} onChange={e => setHeureFin(e.target.value)} /></div>
            </div>
            <div><label className={labelCls}>Lieu des travaux</label><input className={inputCls} value={lieu} onChange={e => setLieu(e.target.value)} /></div>
          </Card>
          <Card className="p-6 bg-card/60 border-border/50 space-y-4">
            <p className="text-xs text-red-400 italic">Un permis est exigé pour effectuer des travaux ponctuels nécessitant l'utilisation d'une flamme nue, produisant de la chaleur ou des étincelles (soudure, découpe, meulage, brasure, utilisation d'un chalumeau pour réfection d'étanchéité, etc.)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Nature des travaux</label><input className={inputCls} value={nature} onChange={e => setNature(e.target.value)} /></div>
              <div><label className={labelCls}>Prêt de matériel</label><input className={inputCls} value={pret} onChange={e => setPret(e.target.value)} /></div>
            </div>
            <label className={checkCls}><input type="checkbox" checked={autorisation} onChange={e => setAutorisation(e.target.checked)} className="rounded" /><span className="text-sm">J'autorise la réalisation de ces travaux</span></label>
          </Card>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => save("brouillon")} disabled={saving}>Enregistrer brouillon</Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={() => setEtape(2)}>Suivant →</Button>
          </div>
        </div>
      )}
      {etape === 2 && (
        <div className="space-y-4">
          <Card className="p-6 bg-card/60 border-border/50 space-y-4">
            <h2 className="font-semibold text-sm border-b border-border/30 pb-2">Précautions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Consignes particulières</label><textarea className={`${inputCls} min-h-[80px] resize-none`} value={consignes} onChange={e => setConsignes(e.target.value)} /></div>
              <div><label className={labelCls}>Risques identifiés</label><textarea className={`${inputCls} min-h-[80px] resize-none`} value={risques} onChange={e => setRisques(e.target.value)} /></div>
            </div>
            <div><label className={labelCls}>N° tél. du PC Sécurité</label><input className={inputCls} value={telPC} onChange={e => setTelPC(e.target.value)} /></div>
          </Card>
          <Card className="p-6 bg-card/60 border-border/50 space-y-3">
            <h2 className="font-semibold text-sm border-b border-border/30 pb-2">Moyens de protection</h2>
            <div className="grid grid-cols-2 gap-2">
              {[["Extincteurs", extincteurs, setExtincteurs], ["RIA", ria, setRia], ["Sprinklers", sprinklers, setSprinklers]].map(([label, val, setter]: any) => (
                <label key={label} className={checkCls}><input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} /><span className="text-sm">{label}</span></label>
              ))}
              <div><label className={labelCls}>Autre</label><input className={inputCls} value={autreProtection} onChange={e => setAutreProtection(e.target.value)} placeholder="Préciser…" /></div>
            </div>
          </Card>
          <Card className="p-6 bg-card/60 border-border/50 space-y-3">
            <h2 className="font-semibold text-sm border-b border-border/30 pb-2">Rondes de surveillance</h2>
            <div className="grid grid-cols-1 gap-2">
              {[
                ["Rondes pendant l'exécution des travaux", rondesExecution, setRondesExecution],
                ["Surveillance accrue pendant 2h à la fin des travaux", surveillanceAccrue, setSurveillanceAccrue],
                ["Ronde de début de travaux (vérifications locaux / matériels)", rondeDebut, setRondeDebut],
              ].map(([label, val, setter]: any) => (
                <label key={label} className={checkCls}><input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} /><span className="text-sm">{label}</span></label>
              ))}
            </div>
          </Card>
          <Card className="p-6 bg-card/60 border-border/50 space-y-3">
            <h2 className="font-semibold text-sm border-b border-border/30 pb-2">Précautions à prendre</h2>
            <p className="text-xs text-muted-foreground">Dans un rayon de 10m autour des travaux</p>
            <div className="grid grid-cols-1 gap-2">
              {[
                ["Évacuer les liquides inflammables, enlever la poussière et les dépôts de graisse", evacuerLiquides, setEvacuerLiquides],
                ["Évacuer tous les matériaux combustibles pouvant être déplacés", evacuerMateriaux, setEvacuerMateriaux],
                ["Balayer soigneusement le sol", balayerSol, setBalayerSol],
                ["Couvrir toutes les ouvertures du sol et des murs", couvrirOuvertures, setCouvrirOuvertures],
                ["Suspendre des bâches ignifugées sous les travaux réalisés en hauteur", suspendreBaches, setSuspendreBaches],
              ].map(([label, val, setter]: any) => (
                <label key={label} className={checkCls}><input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} /><span className="text-sm">{label}</span></label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">En cas de travaux sur les murs ou au plafond</p>
            <div className="grid grid-cols-1 gap-2">
              {[
                ["S'assurer que la construction est dépourvue d'isolation ou de revêtement combustible", verifierIsolation, setVerifierIsolation],
                ["Vérifier l'absence de matériau combustible de l'autre côté du mur", verifierMateriaux, setVerifierMateriaux],
              ].map(([label, val, setter]: any) => (
                <label key={label} className={checkCls}><input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} /><span className="text-sm">{label}</span></label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">En cas de travaux sur des équipements clos (chaudière / cuve)</p>
            <div className="grid grid-cols-1 gap-2">
              {[
                ["Nettoyer pour éliminer toute présence de matériaux combustibles", nettoyerEquipements, setNettoyerEquipements],
                ["Conteneurs : vider les liquides inflammables et évacuer les vapeurs", viderConteneurs, setViderConteneurs],
              ].map(([label, val, setter]: any) => (
                <label key={label} className={checkCls}><input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} /><span className="text-sm">{label}</span></label>
              ))}
            </div>
          </Card>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setEtape(1)}>← Retour</Button>
            <Button variant="outline" className="flex-1" onClick={() => save("brouillon")} disabled={saving}>Brouillon</Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90" disabled={saving} onClick={() => save("actif")}>
              <CheckCircle className="h-4 w-4 mr-2" />{saving ? "Enregistrement…" : "Valider le permis"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PermisFeuFormateur() {
  const [permis, setPermis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [onglet, setOnglet] = useState<"actif" | "archive">("actif");
  const [filtreDateRange, setFiltreDateRange] = useState<FiltreDateValue>({ type: "preset", preset: "toutes" });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from("permis_feu").select("*, stagiaire:stagiaires(first_name, last_name)").order("created_at", { ascending: false });
      setPermis(data ?? []); setLoading(false);
    };
    load();
  }, []);

  const permisFiltres = permis.filter(p => {
    const matchOnglet = onglet === "actif" ? p.statut !== "archive" : p.statut === "archive";
    if (!matchOnglet) return false;
    return appliquerFiltreDateRange(p.date_debut, filtreDateRange);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-display font-bold">Permis de feu</h1><p className="text-muted-foreground text-sm mt-1">Permis établis par vos stagiaires</p></div>
        <Badge variant="outline" className="border-primary/40 text-primary">{permis.length} permis</Badge>
      </div>
      <div className="flex gap-2">
        {([["actif", "En cours"], ["archive", "Archivés"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setOnglet(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${onglet === id ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>{label}</button>
        ))}
      </div>
      <FiltreDateRange value={filtreDateRange} onChange={setFiltreDateRange} />
      {loading ? <p className="text-muted-foreground text-sm text-center py-8">Chargement…</p>
        : permisFiltres.length === 0 ? <Card className="p-12 text-center border-dashed"><p className="text-muted-foreground text-sm">Aucun permis</p></Card>
        : <div className="space-y-3">{permisFiltres.map(p => (
          <Card key={p.id} className="p-5 bg-card/60 border-border/50 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-xs ${p.statut === "archive" ? "border-zinc-500/40 text-zinc-400" : p.statut === "actif" ? "border-emerald-500/40 text-emerald-400" : "border-yellow-500/40 text-yellow-400"}`}>
                  {p.statut === "archive" ? "Archivé" : p.statut === "actif" ? "Actif" : "Brouillon"}
                </Badge>
                <span className="font-semibold text-sm">Permis N°{p.numero}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>👤 {p.stagiaire?.first_name} {p.stagiaire?.last_name}</span>
              {p.nom_societe && <span>🏢 {p.nom_societe}</span>}
              {p.lieu_travaux && <span>📍 {p.lieu_travaux}</span>}
              {p.date_debut && <span>📅 {new Date(p.date_debut).toLocaleDateString("fr-FR")}</span>}
            </div>
            {p.nature_travaux && <p className="text-xs text-muted-foreground italic">{p.nature_travaux}</p>}
          </Card>
        ))}</div>}
    </div>
  );
}

// ─── Statistiques ────────────────────────────────────────────────────────────

export function StatistiquesStagiaire({ stagiaireId }: { stagiaireId: string }) {
  const [fiches, setFiches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periode, setPeriode] = useState<"semaine" | "mois" | "tout">("mois");
  const [rapport, setRapport] = useState<string | null>(null);
  const [loadingRapport, setLoadingRapport] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.from("main_courante").select("*").eq("stagiaire_id", stagiaireId).order("created_at", { ascending: false });
      setFiches(data ?? []);
      setLoading(false);
    };
    load();
  }, [stagiaireId]);

  const fichesFiltrees = fiches.filter(f => {
    const date = new Date(f.created_at);
    const now = new Date();
    if (periode === "semaine") { const s = new Date(now); s.setDate(s.getDate() - 7); return date >= s; }
    if (periode === "mois") { const m = new Date(now); m.setMonth(m.getMonth() - 1); return date >= m; }
    return true;
  });

  // Stats par famille
  const statsFamille = fichesFiltrees.reduce((acc: any, f) => {
    acc[f.famille] = (acc[f.famille] ?? 0) + 1;
    return acc;
  }, {});

  // Stats par type
  const statsType = fichesFiltrees.reduce((acc: any, f) => {
    acc[f.type_evenement] = (acc[f.type_evenement] ?? 0) + 1;
    return acc;
  }, {});

  // Stats par sévérité physique
  const statsSev = fichesFiltrees.reduce((acc: any, f) => {
    acc[f.severite_physique] = (acc[f.severite_physique] ?? 0) + 1;
    return acc;
  }, {});

  const topTypes = Object.entries(statsType).sort(([,a]: any, [,b]: any) => b - a).slice(0, 5);
  const total = fichesFiltrees.length;

  const genererRapport = async () => {
    if (total === 0) { toast.error("Aucune fiche sur cette période"); return; }
    setLoadingRapport(true);
    setRapport(null);

    const resume = `
Période : ${periode === "semaine" ? "7 derniers jours" : periode === "mois" ? "30 derniers jours" : "Tout"}.
Nombre total de fiches : ${total}.
Répartition par famille : ${Object.entries(statsFamille).map(([k,v]) => `${k}: ${v}`).join(", ")}.
Top événements : ${topTypes.map(([k,v]) => `${k}: ${v}`).join(", ")}.
Sévérités physiques : ${Object.entries(statsSev).map(([k,v]) => `${k}: ${v}`).join(", ")}.
    `.trim();

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: "Tu es un expert en sécurité et sûreté. Tu analyses les statistiques de main courante d'un stagiaire en formation sécurité (SSIAP, APS, SST) et tu génères un rapport pédagogique en français. Sois concis, constructif et pratique. Structure ta réponse avec : 1) Analyse des points récurrents, 2) Points de vigilance, 3) Recommandations concrètes.",
          messages: [{ role: "user", content: `Voici les statistiques de main courante de ce stagiaire :\n\n${resume}\n\nGénère un rapport d'analyse pédagogique.` }],
        }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text ?? "Impossible de générer le rapport.";
      setRapport(text);
    } catch (err) {
      toast.error("Erreur lors de la génération du rapport");
    } finally {
      setLoadingRapport(false);
    }
  };

  const maxFamille = Math.max(...Object.values(statsFamille) as number[], 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Statistiques</h1>
        <p className="text-muted-foreground text-sm mt-1">Analyse de vos mains courantes</p>
      </div>

      {/* Filtre période */}
      <div className="flex gap-2">
        {([["semaine", "7 jours"], ["mois", "30 jours"], ["tout", "Tout"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => { setPeriode(id); setRapport(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${periode === id ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <p className="text-muted-foreground text-sm text-center py-8">Chargement…</p> : (
        <>
          {/* Total */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-5 bg-card/60 border-border/50 text-center">
              <p className="text-3xl font-bold text-primary">{total}</p>
              <p className="text-xs text-muted-foreground mt-1">Fiches totales</p>
            </Card>
            <Card className="p-5 bg-card/60 border-border/50 text-center">
              <p className="text-3xl font-bold text-primary">{Object.keys(statsFamille).length}</p>
              <p className="text-xs text-muted-foreground mt-1">Familles différentes</p>
            </Card>
            <Card className="p-5 bg-card/60 border-border/50 text-center">
              <p className="text-3xl font-bold text-primary">{fichesFiltrees.filter(f => f.victime !== "Pas de victime").length}</p>
              <p className="text-xs text-muted-foreground mt-1">Avec victimes</p>
            </Card>
          </div>

          {/* Stats par famille */}
          {Object.keys(statsFamille).length > 0 && (
            <Card className="p-6 bg-card/60 border-border/50 space-y-4">
              <h2 className="font-semibold text-sm">Répartition par famille</h2>
              <div className="space-y-3">
                {Object.entries(statsFamille).sort(([,a]: any, [,b]: any) => b - a).map(([famille, count]: any) => (
                  <div key={famille} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{famille}</span>
                      <span className="font-medium text-primary">{count}</span>
                    </div>
                    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${(count / maxFamille) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Top événements */}
          {topTypes.length > 0 && (
            <Card className="p-6 bg-card/60 border-border/50 space-y-3">
              <h2 className="font-semibold text-sm">Top 5 des événements</h2>
              <div className="space-y-2">
                {topTypes.map(([type, count]: any, i) => (
                  <div key={type} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
                    <span className="text-xs font-bold text-primary w-5">{i + 1}</span>
                    <span className="text-sm flex-1">{type}</span>
                    <Badge variant="outline" className="border-primary/40 text-primary text-xs">{count}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Sévérités */}
          {Object.keys(statsSev).length > 0 && (
            <Card className="p-6 bg-card/60 border-border/50 space-y-3">
              <h2 className="font-semibold text-sm">Sévérités physiques</h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(statsSev).map(([sev, count]: any) => (
                  <div key={sev} className={`px-3 py-2 rounded-lg border text-xs font-medium ${sev === "Sans conséquence" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : sev.includes("grave") ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"}`}>
                    {sev} ({count})
                  </div>
                ))}
              </div>
            </Card>
          )}

          {total === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <p className="text-muted-foreground text-sm">Aucune fiche sur cette période</p>
            </Card>
          ) : (
            /* Rapport IA */
            <Card className="p-6 bg-card/60 border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-sm">Rapport IA</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Analyse et recommandations basées sur vos fiches</p>
                </div>
                <Button onClick={genererRapport} disabled={loadingRapport} size="sm" className="bg-primary hover:bg-primary/90 gap-2">
                  {loadingRapport ? "Génération…" : "Générer le rapport"}
                </Button>
              </div>
              {rapport && (
                <div className="bg-muted/20 border border-border/30 rounded-lg p-4 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {rapport}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Rondier ────────────────────────────────────────────────────────────────

export function RondierFormateur({ formateurId }: { formateurId: string }) {
  const [circuits, setCircuits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nomCircuit, setNomCircuit] = useState("");
  const [descCircuit, setDescCircuit] = useState("");
  const [points, setPoints] = useState<{ nom: string; description: string }[]>([{ nom: "", description: "" }]);
  const [saving, setSaving] = useState(false);
  const [qrCircuit, setQrCircuit] = useState<any | null>(null);
  const [rondes, setRondes] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const { data: c } = await supabase.from("circuits_ronde").select("*, points:points_controle(*)").order("created_at", { ascending: false });
    const { data: r } = await supabase.from("rondes").select("*, stagiaire:stagiaires(first_name, last_name), circuit:circuits_ronde(nom), scans:scans_ronde(*, point:points_controle(nom))").order("created_at", { ascending: false }).limit(20);
    setCircuits(c ?? []);
    setRondes(r ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const saveCircuit = async () => {
    if (!nomCircuit.trim()) { toast.error("Nom du circuit obligatoire"); return; }
    const pointsValides = points.filter(p => p.nom.trim());
    if (pointsValides.length === 0) { toast.error("Ajoutez au moins un point de contrôle"); return; }
    setSaving(true);
    const { data: circuit, error } = await supabase.from("circuits_ronde").insert({ formateur_id: formateurId, nom: nomCircuit.trim(), description: descCircuit || null, actif: true }).select().single();
    if (error) { toast.error(error.message); setSaving(false); return; }
    await supabase.from("points_controle").insert(pointsValides.map((p, i) => ({ circuit_id: circuit.id, nom: p.nom.trim(), description: p.description || null, ordre: i + 1 })));
    toast.success("Circuit créé !");
    setNomCircuit(""); setDescCircuit(""); setPoints([{ nom: "", description: "" }]); setShowForm(false);
    setSaving(false); load();
  };

  const supprimerCircuit = async (id: string) => {
    if (!confirm("Supprimer ce circuit ?")) return;
    await supabase.from("circuits_ronde").delete().eq("id", id);
    toast.success("Circuit supprimé"); load();
  };

  const inputCls = "w-full bg-muted/30 border border-border/50 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Rondier</h1>
          <p className="text-muted-foreground text-sm mt-1">Gérez les circuits de ronde et suivez les passages</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="h-4 w-4" /> Nouveau circuit
        </Button>
      </div>

      {showForm && (
        <Card className="p-6 bg-card/60 border-primary/30 space-y-4">
          <h2 className="font-semibold text-sm">Nouveau circuit de ronde</h2>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Nom du circuit</label>
            <input className={inputCls} value={nomCircuit} onChange={e => setNomCircuit(e.target.value)} placeholder="Ex: Ronde nuit bâtiment A" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Description</label>
            <input className={inputCls} value={descCircuit} onChange={e => setDescCircuit(e.target.value)} placeholder="Description optionnelle…" />
          </div>
          <div className="space-y-3">
            <label className="text-xs text-muted-foreground uppercase tracking-wider block">Points de contrôle</label>
            {points.map((p, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="h-6 w-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-2">{i + 1}</div>
                <div className="flex-1 space-y-1">
                  <input className={inputCls} value={p.nom} onChange={e => { const u = [...points]; u[i] = { ...u[i], nom: e.target.value }; setPoints(u); }} placeholder="Nom du point (ex: Hall d'entrée)" />
                  <input className={inputCls} value={p.description} onChange={e => { const u = [...points]; u[i] = { ...u[i], description: e.target.value }; setPoints(u); }} placeholder="Description (optionnel)" />
                </div>
                {points.length > 1 && (
                  <button onClick={() => setPoints(points.filter((_, j) => j !== i))} className="mt-2 text-muted-foreground hover:text-red-400 transition-colors"><X className="h-4 w-4" /></button>
                )}
              </div>
            ))}
            <button onClick={() => setPoints([...points, { nom: "", description: "" }])}
              className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
              <Plus className="h-3 w-3" /> Ajouter un point
            </button>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button className="flex-1 bg-primary hover:bg-primary/90" disabled={saving} onClick={saveCircuit}>
              {saving ? "Enregistrement…" : "Créer le circuit"}
            </Button>
          </div>
        </Card>
      )}

      {/* QR Codes */}
      {qrCircuit && (
        <Card className="p-6 bg-card/60 border-border/50 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">QR Codes — {qrCircuit.nom}</h2>
            <button onClick={() => setQrCircuit(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <p className="text-xs text-muted-foreground">Imprimez ces QR codes et collez-les aux points de contrôle correspondants.</p>
          <div className="grid grid-cols-2 gap-4">
            {(qrCircuit.points ?? []).sort((a: any, b: any) => a.ordre - b.ordre).map((point: any) => (
              <div key={point.id} className="border border-border/50 rounded-lg p-4 text-center space-y-3">
                <p className="font-medium text-sm">{point.ordre}. {point.nom}</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`RONDE:${point.id}:${point.nom}`)}`}
                  alt={`QR ${point.nom}`}
                  className="mx-auto rounded"
                />
                {point.description && <p className="text-xs text-muted-foreground">{point.description}</p>}
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full gap-2" onClick={() => window.print()}>
            🖨️ Imprimer les QR codes
          </Button>
        </Card>
      )}

      {/* Liste des circuits */}
      {loading ? <p className="text-muted-foreground text-sm text-center py-8">Chargement…</p> : (
        <div className="space-y-3">
          {circuits.length === 0 ? (
            <Card className="p-12 text-center border-dashed"><p className="text-muted-foreground text-sm">Aucun circuit créé</p></Card>
          ) : circuits.map(c => (
            <Card key={c.id} className="p-5 bg-card/60 border-border/50 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{c.nom}</p>
                  {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{c.points?.length ?? 0} point(s) de contrôle</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setQrCircuit(c)} className="gap-1 text-xs">
                    QR Codes
                  </Button>
                  <button onClick={() => supprimerCircuit(c.id)} className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {c.points && c.points.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {c.points.sort((a: any, b: any) => a.ordre - b.ordre).map((p: any) => (
                    <span key={p.id} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary">{p.ordre}. {p.nom}</span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Historique des rondes */}
      {rondes.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm">Rondes récentes</h2>
          {rondes.map(r => (
            <Card key={r.id} className="p-4 bg-card/60 border-border/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${r.statut === "terminee" ? "border-emerald-500/40 text-emerald-400" : "border-yellow-500/40 text-yellow-400"}`}>
                    {r.statut === "terminee" ? "Terminée" : "En cours"}
                  </Badge>
                  <span className="text-sm font-medium">{r.circuit?.nom}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(r.debut_le).toLocaleDateString("fr-FR")} {new Date(r.debut_le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <p className="text-xs text-muted-foreground">👤 {r.stagiaire?.first_name} {r.stagiaire?.last_name} — {r.scans?.length ?? 0} point(s) scannés</p>
              {r.scans && r.scans.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {r.scans.map((s: any) => (
                    <span key={s.id} className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      ✓ {s.point?.nom} {new Date(s.scanne_le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function RondierStagiaire({ stagiaireId }: { stagiaireId: string }) {
  const [circuits, setCircuits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rondeEnCours, setRondeEnCours] = useState<any | null>(null);
  const [scans, setScans] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [rondes, setRondes] = useState<any[]>([]);
  const scannerRef = useRef<any>(null);
const scannerDivRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    const { data: c } = await supabase.from("circuits_ronde").select("*, points:points_controle(*)").eq("actif", true).order("created_at", { ascending: false });
    const { data: r } = await supabase.from("rondes").select("*, circuit:circuits_ronde(nom), scans:scans_ronde(*, point:points_controle(nom))").eq("stagiaire_id", stagiaireId).order("created_at", { ascending: false }).limit(10);
    setCircuits(c ?? []);
    setRondes(r ?? []);
    // Vérifier si une ronde est en cours
    const enCours = (r ?? []).find(ro => ro.statut === "en_cours");
    if (enCours) {
      setRondeEnCours(enCours);
      setScans(enCours.scans ?? []);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [stagiaireId]);

  const demarrerRonde = async (circuit: any) => {
    const { data, error } = await supabase.from("rondes").insert({ stagiaire_id: stagiaireId, circuit_id: circuit.id, statut: "en_cours", debut_le: new Date().toISOString() }).select().single();
    if (error) { toast.error(error.message); return; }
    setRondeEnCours({ ...data, circuit, scans: [] });
    setScans([]);
    toast.success(`Ronde démarrée : ${circuit.nom}`);
  };

  const terminerRonde = async () => {
    if (!rondeEnCours) return;
    await supabase.from("rondes").update({ statut: "terminee", fin_le: new Date().toISOString() }).eq("id", rondeEnCours.id);
    toast.success("Ronde terminée !");
    setRondeEnCours(null);
    setScans([]);
    load();
  };

  const scannerPoint = async (pointId: string, pointNom: string) => {
    if (!rondeEnCours) return;
    const dejaScanne = scans.find(s => s.point_controle_id === pointId);
    if (dejaScanne) { toast.info(`${pointNom} déjà scanné !`); return; }
    const { data, error } = await supabase.from("scans_ronde").insert({ ronde_id: rondeEnCours.id, point_controle_id: pointId, scanne_le: new Date().toISOString() }).select("*, point:points_controle(nom)").single();
    if (error) { toast.error(error.message); return; }
   const newScans = [...scans, data];
    setScans(newScans);
    toast.success(`✓ ${pointNom} scanné !`);
    // Vérifier si tous les points sont scannés
    const circuitActuel = circuits.find(c => c.id === rondeEnCours.circuit_id);
    if (circuitActuel && newScans.length >= circuitActuel.points.length) {
      setTimeout(() => toast.success("🎉 Tous les points scannés ! Ronde complète !"), 500);
      await terminerRonde();
    }
  };

 const lancerScanner = async () => {
    setScanning(true);
    setScanResult(null);
    setTimeout(async () => {
      if (!scannerDivRef.current) return;
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const codeReader = new BrowserMultiFormatReader();
        scannerRef.current = codeReader;

        const videoElement = document.createElement("video");
        videoElement.style.width = "100%";
        videoElement.style.borderRadius = "8px";
        videoElement.setAttribute("playsinline", "true");
        scannerDivRef.current.innerHTML = "";
        scannerDivRef.current.appendChild(videoElement);

        await codeReader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoElement,
          (result, err) => {
            if (result && scannerRef.current) {
              const text = result.getText();
              if (text.startsWith("RONDE:")) {
                const parts = text.split(":");
                const pointId = parts[1];
                const pointNom = parts.slice(2).join(":");
                scannerRef.current = null; // bloque les appels suivants
                setTimeout(async () => {
                  arreterScanner();
                  await scannerPoint(pointId, pointNom);
                }, 200);
              }
            }
          }
        );
      } catch (err: any) {
        console.error("Scanner error:", err);
        toast.error("Caméra inaccessible — vérifiez les permissions");
        setScanning(false);
      }
    }, 300);
  };

  const arreterScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.reset();
      } catch {}
      scannerRef.current = null;
    }
    if (scannerDivRef.current) scannerDivRef.current.innerHTML = "";
    setScanning(false);
  };

  // Simuler un scan manuel (pour les tests sans QR code physique)
  const scanManuel = async (point: any) => {
    await scannerPoint(point.id, point.nom);
  };

  if (loading) return <p className="text-muted-foreground text-sm text-center py-8">Chargement…</p>;

  const circuit = rondeEnCours ? circuits.find(c => c.id === rondeEnCours.circuit_id) : null;
  const pointsCircuit = circuit?.points?.sort((a: any, b: any) => a.ordre - b.ordre) ?? [];
  const pointsScannés = scans.length;
  const totalPoints = pointsCircuit.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Rondier</h1>
        <p className="text-muted-foreground text-sm mt-1">Effectuez vos rondes de surveillance</p>
      </div>

      {/* Ronde en cours */}
      {rondeEnCours ? (
        <div className="space-y-4">
          <Card className="p-6 bg-emerald-500/5 border-emerald-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{circuit?.nom}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Démarrée à {new Date(rondeEnCours.debut_le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">En cours</Badge>
            </div>
            {/* Barre de progression */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progression</span>
                <span>{pointsScannés}/{totalPoints} points</span>
              </div>
              <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: totalPoints > 0 ? `${(pointsScannés / totalPoints) * 100}%` : "0%" }} />
              </div>
            </div>
          </Card>

          {/* Points de contrôle */}
          <Card className="p-6 bg-card/60 border-border/50 space-y-3">
            <h2 className="font-semibold text-sm">Points de contrôle</h2>
            <p className="text-xs text-muted-foreground">Approchez votre téléphone du QR code ou appuyez sur le bouton pour simuler le scan.</p>
            <div className="space-y-2">
              {pointsCircuit.map((point: any) => {
                const estScanne = scans.find(s => s.point_controle_id === point.id);
                return (
                  <div key={point.id} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${estScanne ? "border-emerald-500/40 bg-emerald-500/5" : "border-border/40 bg-muted/10"}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${estScanne ? "bg-emerald-500 text-white" : "bg-muted/40 text-muted-foreground"}`}>
                        {estScanne ? "✓" : point.ordre}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{point.nom}</p>
                        {estScanne && <p className="text-xs text-emerald-400">{new Date(estScanne.scanne_le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>}
                        {point.description && !estScanne && <p className="text-xs text-muted-foreground">{point.description}</p>}
                      </div>
                    </div>
                   {!estScanne && (
                      <Button size="sm" variant="outline" onClick={lancerScanner} className="text-xs gap-1">
                        📷 Scanner
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
{/* Scanner QR */}
          {scanning && (
            <Card className="p-4 bg-card/60 border-primary/30 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Scanner le QR code</p>
                <button onClick={arreterScanner} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div id="qr-scanner-div" ref={scannerDivRef} className="w-full rounded-lg overflow-hidden" />
              <p className="text-xs text-muted-foreground text-center">Pointez la caméra vers le QR code du point de contrôle</p>
            </Card>
          )}
          <Button variant="outline" className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={terminerRonde}>
            Terminer la ronde
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="font-semibold text-sm">Circuits disponibles</h2>
          {circuits.length === 0 ? (
            <Card className="p-12 text-center border-dashed"><p className="text-muted-foreground text-sm">Aucun circuit disponible — contactez votre formateur</p></Card>
          ) : circuits.map(c => (
            <Card key={c.id} className="p-5 bg-card/60 border-border/50 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{c.nom}</p>
                  {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{c.points?.length ?? 0} point(s) de contrôle</p>
                </div>
                <Button size="sm" onClick={() => demarrerRonde(c)} className="bg-primary hover:bg-primary/90">
                  Démarrer
                </Button>
              </div>
              {c.points && c.points.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {c.points.sort((a: any, b: any) => a.ordre - b.ordre).map((p: any) => (
                    <span key={p.id} className="text-xs px-2 py-0.5 rounded-full bg-muted/30 border border-border/40 text-muted-foreground">{p.ordre}. {p.nom}</span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Historique */}
      {rondes.filter(r => r.statut === "terminee").length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground">Rondes terminées</h2>
          {rondes.filter(r => r.statut === "terminee").map(r => (
            <Card key={r.id} className="p-4 bg-card/40 border-border/30 space-y-2 opacity-70">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{r.circuit?.nom}</span>
                <span className="text-xs text-muted-foreground">{new Date(r.debut_le).toLocaleDateString("fr-FR")} {new Date(r.debut_le).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <p className="text-xs text-muted-foreground">{r.scans?.length ?? 0} point(s) scannés</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
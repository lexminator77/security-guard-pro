// src/pages/FinancementOpco.tsx
// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Landmark, Trash2, Building2, User } from "lucide-react";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────

type DossierOpco = {
  id: string;
  formation_id: string;
  stagiaire_id: string | null;
  opco_nom: string;
  opco_contact_nom: string | null;
  opco_contact_email: string | null;
  opco_contact_tel: string | null;
  numero_dossier: string | null;
  montant_accorde: number;
  montant_paye: number;
  facture_id: string | null;
  statut: string;
  notes: string | null;
  created_at: string;
  formation: { title: string } | null;
  stagiaire: { first_name: string; last_name: string } | null;
  facture: { numero: string } | null;
};

type DossierCpf = {
  id: string;
  formation_id: string;
  stagiaire_id: string;
  numero_dossier_cpf: string | null;
  code_formation_cpf: string | null;
  montant_cpf: number;
  montant_paye: number;
  statut: string;
  notes: string | null;
  created_at: string;
  formation: { title: string } | null;
  stagiaire: { first_name: string; last_name: string } | null;
};

// ─── Status configs ────────────────────────────────────────────────────────

const SC_OPCO: Record<string, { label: string; color: string; next: string | null }> = {
  brouillon:          { label: "Brouillon",          color: "bg-muted/50 text-muted-foreground border-border/50",        next: "demande_envoyee" },
  demande_envoyee:    { label: "Demande envoyée",    color: "bg-blue-500/10 text-blue-400 border-blue-500/30",           next: "accord_recu" },
  accord_recu:        { label: "Accord reçu",        color: "bg-violet-500/10 text-violet-400 border-violet-500/30",     next: "en_attente_facture" },
  en_attente_facture: { label: "En attente facture", color: "bg-orange-500/10 text-orange-400 border-orange-500/30",     next: "facture" },
  facture:            { label: "Facturé",             color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",    next: "paye" },
  paye:               { label: "Payé",                color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", next: null },
  refuse:             { label: "Refusé",              color: "bg-red-500/10 text-red-400 border-red-500/30",             next: null },
};

const SC_CPF: Record<string, { label: string; color: string; next: string | null }> = {
  demande_envoyee: { label: "Demande envoyée", color: "bg-blue-500/10 text-blue-400 border-blue-500/30",           next: "accord_recu" },
  accord_recu:     { label: "Accord reçu",     color: "bg-violet-500/10 text-violet-400 border-violet-500/30",     next: "paye" },
  paye:            { label: "Payé",             color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", next: null },
  refuse:          { label: "Refusé",           color: "bg-red-500/10 text-red-400 border-red-500/30",             next: null },
};

const fmt = (n: number) => n.toLocaleString("fr-FR");

// ─── OPCO Tab ──────────────────────────────────────────────────────────────

function TabOpco() {
  const [dossiers, setDossiers] = useState<DossierOpco[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState("all");
  const [filtreOpco, setFiltreOpco] = useState("");
  const [editingPaye, setEditingPaye] = useState<string | null>(null);
  const [payeInput, setPayeInput] = useState(0);
  const [lieFactureId, setLieFactureId] = useState<string | null>(null);
  const [facturesCache, setFacturesCache] = useState<Record<string, any[]>>({});
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("financements_opco")
      .select("*, formation:formations(title), stagiaire:stagiaires(first_name, last_name), facture:factures(numero)")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast.error(error.message);
        else setDossiers(data ?? []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey(k => k + 1);

  const updateStatut = async (id: string, statut: string) => {
    const { error } = await supabase.from("financements_opco").update({ statut }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Statut mis à jour"); reload(); }
  };

  const saveMontantPaye = async (id: string) => {
    const { error } = await supabase.from("financements_opco").update({ montant_paye: payeInput }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Montant payé mis à jour"); setEditingPaye(null); reload(); }
  };

  const deleteDossier = async (id: string) => {
    if (!confirm("Supprimer ce dossier OPCO ?")) return;
    const { error } = await supabase.from("financements_opco").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Dossier supprimé"); reload(); }
  };

  const loadFactures = async (formationId: string) => {
    if (facturesCache[formationId]) return;
    const { data } = await supabase.from("factures").select("id, numero").eq("formation_id", formationId);
    setFacturesCache(prev => ({ ...prev, [formationId]: data ?? [] }));
  };

  const lierFacture = async (dossierId: string, factureId: string) => {
    const { error } = await supabase.from("financements_opco")
      .update({ facture_id: factureId, statut: "facture" })
      .eq("id", dossierId);
    if (error) toast.error(error.message);
    else { toast.success("Facture liée"); setLieFactureId(null); reload(); }
  };

  const displayed = dossiers.filter(d => {
    if (filtreStatut !== "all" && d.statut !== filtreStatut) return false;
    if (filtreOpco && !d.opco_nom.toLowerCase().includes(filtreOpco.toLowerCase())) return false;
    return true;
  });

  const totalAccorde = dossiers.filter(d => d.statut !== "refuse").reduce((acc, d) => acc + Number(d.montant_accorde), 0);
  const totalPaye = dossiers.filter(d => d.statut !== "refuse").reduce((acc, d) => acc + Number(d.montant_paye), 0);
  const solde = totalAccorde - totalPaye;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-border/50 rounded-lg p-4 bg-card/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total accordé</p>
          <p className="text-2xl font-bold text-violet-400 mt-1">{fmt(totalAccorde)} €</p>
        </div>
        <div className="border border-border/50 rounded-lg p-4 bg-card/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total payé</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{fmt(totalPaye)} €</p>
        </div>
        <div className="border border-border/50 rounded-lg p-4 bg-card/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Solde en attente</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{fmt(solde)} €</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <Button size="sm" variant={filtreStatut === "all" ? "default" : "outline"} onClick={() => setFiltreStatut("all")}>Tous</Button>
        {Object.entries(SC_OPCO).map(([k, v]) => (
          <Button key={k} size="sm" variant={filtreStatut === k ? "default" : "outline"} onClick={() => setFiltreStatut(k)}>
            {v.label}
          </Button>
        ))}
        <Input className="w-40 h-8 text-sm" placeholder="Filtrer OPCO…"
          value={filtreOpco} onChange={e => setFiltreOpco(e.target.value)} />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : displayed.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun dossier OPCO.</p>
      ) : (
        <div className="space-y-2">
          {displayed.map(d => {
            const cfg = SC_OPCO[d.statut] ?? SC_OPCO.brouillon;
            const perimetre = d.stagiaire
              ? `${d.stagiaire.last_name} ${d.stagiaire.first_name}`
              : "Formation entière";
            return (
              <div key={d.id} className="border border-border/50 rounded-lg p-4 bg-card/50 space-y-2">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-semibold text-sm">{d.opco_nom}</span>
                      {d.numero_dossier && <span className="font-mono text-xs text-muted-foreground">#{d.numero_dossier}</span>}
                      <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{d.formation?.title} — {perimetre}</p>
                  </div>
                  <div className="text-right shrink-0 text-sm">
                    <p>Accordé : <span className="font-semibold">{fmt(Number(d.montant_accorde))} €</span></p>
                    <p className="text-muted-foreground text-xs">
                      Payé :{" "}
                      {editingPaye === d.id ? (
                        <span className="inline-flex items-center gap-1">
                          <Input type="number" min={0} step={0.01} className="h-6 w-20 text-xs" autoFocus
                            value={payeInput} onChange={e => setPayeInput(Number(e.target.value))} />
                          <Button size="sm" className="h-6 text-xs px-2" onClick={() => saveMontantPaye(d.id)}>OK</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs px-1" onClick={() => setEditingPaye(null)}>✕</Button>
                        </span>
                      ) : (
                        <button className="underline decoration-dotted hover:text-foreground"
                          onClick={() => { setEditingPaye(d.id); setPayeInput(Number(d.montant_paye)); }}>
                          {fmt(Number(d.montant_paye))} €
                        </button>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {cfg.next && (
                    <Button size="sm" variant="outline" onClick={() => updateStatut(d.id, cfg.next!)}>
                      → {SC_OPCO[cfg.next]?.label}
                    </Button>
                  )}
                  {d.statut !== "paye" && d.statut !== "refuse" && (
                    <Button size="sm" variant="outline"
                      className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                      onClick={() => updateStatut(d.id, "refuse")}>
                      Refuser
                    </Button>
                  )}
                  {!d.facture_id && d.statut !== "refuse" && d.statut !== "paye" && (
                    <Button size="sm" variant="outline"
                      onClick={async () => { setLieFactureId(d.id); await loadFactures(d.formation_id); }}>
                      Lier facture
                    </Button>
                  )}
                  {lieFactureId === d.id && (
                    <select className="text-xs border border-border rounded px-2 py-1 bg-background"
                      onChange={e => e.target.value && lierFacture(d.id, e.target.value)} defaultValue="">
                      <option value="">Choisir…</option>
                      {(facturesCache[d.formation_id] ?? []).map(f => (
                        <option key={f.id} value={f.id}>{f.numero}</option>
                      ))}
                    </select>
                  )}
                  {d.facture_id && d.facture && (
                    <span className="text-xs text-muted-foreground flex items-center">Facture : {d.facture.numero}</span>
                  )}
                  {d.statut === "brouillon" && (
                    <Button size="sm" variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
                      onClick={() => deleteDossier(d.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── CPF Tab ───────────────────────────────────────────────────────────────

function TabCpf() {
  const [dossiers, setDossiers] = useState<DossierCpf[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState("all");
  const [filtreNom, setFiltreNom] = useState("");
  const [editingPaye, setEditingPaye] = useState<string | null>(null);
  const [payeInput, setPayeInput] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("financements_cpf")
      .select("*, formation:formations(title), stagiaire:stagiaires(first_name, last_name)")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // Table may not be created yet — show friendly message
          if (error.code === "42P01") {
            setDossiers([]);
          } else {
            toast.error(error.message);
          }
        } else {
          setDossiers(data ?? []);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey(k => k + 1);

  const updateStatut = async (id: string, statut: string) => {
    const { error } = await supabase.from("financements_cpf").update({ statut }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Statut mis à jour"); reload(); }
  };

  const saveMontantPaye = async (id: string) => {
    const { error } = await supabase.from("financements_cpf").update({ montant_paye: payeInput }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Montant payé mis à jour"); setEditingPaye(null); reload(); }
  };

  const deleteDossier = async (id: string) => {
    if (!confirm("Supprimer ce dossier CPF ?")) return;
    const { error } = await supabase.from("financements_cpf").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Dossier supprimé"); reload(); }
  };

  const displayed = dossiers.filter(d => {
    if (filtreStatut !== "all" && d.statut !== filtreStatut) return false;
    if (filtreNom) {
      const nom = d.stagiaire ? `${d.stagiaire.last_name} ${d.stagiaire.first_name}`.toLowerCase() : "";
      if (!nom.includes(filtreNom.toLowerCase())) return false;
    }
    return true;
  });

  const totalCpf = dossiers.filter(d => d.statut !== "refuse").reduce((acc, d) => acc + Number(d.montant_cpf), 0);
  const totalPaye = dossiers.filter(d => d.statut !== "refuse").reduce((acc, d) => acc + Number(d.montant_paye), 0);
  const solde = totalCpf - totalPaye;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-border/50 rounded-lg p-4 bg-card/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total CPF engagé</p>
          <p className="text-2xl font-bold text-violet-400 mt-1">{fmt(totalCpf)} €</p>
        </div>
        <div className="border border-border/50 rounded-lg p-4 bg-card/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total encaissé</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{fmt(totalPaye)} €</p>
        </div>
        <div className="border border-border/50 rounded-lg p-4 bg-card/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Solde en attente</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{fmt(solde)} €</p>
        </div>
      </div>

      <div className="rounded-lg border border-border/40 bg-muted/20 px-4 py-3 text-[13px] text-muted-foreground">
        <strong className="text-foreground">CPF</strong> (Compte Personnel de Formation) — financement individuel via{" "}
        <span className="font-mono text-xs">moncompteformation.gouv.fr</span>. Chaque stagiaire utilise ses droits CPF. Les dossiers sont créés depuis la fiche session.
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <Button size="sm" variant={filtreStatut === "all" ? "default" : "outline"} onClick={() => setFiltreStatut("all")}>Tous</Button>
        {Object.entries(SC_CPF).map(([k, v]) => (
          <Button key={k} size="sm" variant={filtreStatut === k ? "default" : "outline"} onClick={() => setFiltreStatut(k)}>
            {v.label}
          </Button>
        ))}
        <Input className="w-44 h-8 text-sm" placeholder="Filtrer stagiaire…"
          value={filtreNom} onChange={e => setFiltreNom(e.target.value)} />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : displayed.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun dossier CPF.</p>
      ) : (
        <div className="space-y-2">
          {displayed.map(d => {
            const cfg = SC_CPF[d.statut] ?? SC_CPF.demande_envoyee;
            const nomStagiaire = d.stagiaire
              ? `${d.stagiaire.last_name.toUpperCase()}, ${d.stagiaire.first_name}`
              : "—";
            return (
              <div key={d.id} className="border border-border/50 rounded-lg p-4 bg-card/50 space-y-2">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-semibold text-sm">{nomStagiaire}</span>
                      {d.numero_dossier_cpf && (
                        <span className="font-mono text-xs text-muted-foreground">#{d.numero_dossier_cpf}</span>
                      )}
                      <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {d.formation?.title}
                      {d.code_formation_cpf && <> · Code CPF : {d.code_formation_cpf}</>}
                    </p>
                  </div>
                  <div className="text-right shrink-0 text-sm">
                    <p>Droits CPF : <span className="font-semibold">{fmt(Number(d.montant_cpf))} €</span></p>
                    <p className="text-muted-foreground text-xs">
                      Encaissé :{" "}
                      {editingPaye === d.id ? (
                        <span className="inline-flex items-center gap-1">
                          <Input type="number" min={0} step={0.01} className="h-6 w-20 text-xs" autoFocus
                            value={payeInput} onChange={e => setPayeInput(Number(e.target.value))} />
                          <Button size="sm" className="h-6 text-xs px-2" onClick={() => saveMontantPaye(d.id)}>OK</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs px-1" onClick={() => setEditingPaye(null)}>✕</Button>
                        </span>
                      ) : (
                        <button className="underline decoration-dotted hover:text-foreground"
                          onClick={() => { setEditingPaye(d.id); setPayeInput(Number(d.montant_paye)); }}>
                          {fmt(Number(d.montant_paye))} €
                        </button>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {cfg.next && (
                    <Button size="sm" variant="outline" onClick={() => updateStatut(d.id, cfg.next!)}>
                      → {SC_CPF[cfg.next]?.label}
                    </Button>
                  )}
                  {d.statut !== "paye" && d.statut !== "refuse" && (
                    <Button size="sm" variant="outline"
                      className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                      onClick={() => updateStatut(d.id, "refuse")}>
                      Refuser
                    </Button>
                  )}
                  {d.statut === "demande_envoyee" && (
                    <Button size="sm" variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
                      onClick={() => deleteDossier(d.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

type Tab = "opco" | "cpf";

export default function FinancementOpco() {
  const [tab, setTab] = useState<Tab>("opco");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Landmark className="h-6 w-6 text-yellow-400" />
        <h1 className="text-2xl font-bold">Financement formation</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["opco", "cpf"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-4 py-2 text-[13px] font-semibold tracking-tight transition-all border-b-2 -mb-px",
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {t === "opco" ? "Dossiers OPCO" : "Dossiers CPF"}
          </button>
        ))}
      </div>

      {tab === "opco" ? <TabOpco /> : <TabCpf />}
    </div>
  );
}

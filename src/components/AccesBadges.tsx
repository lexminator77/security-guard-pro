// @ts-nocheck
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, X, LogIn, LogOut, Key, CreditCard, Users, Clock } from "lucide-react";
import { toast } from "sonner";

function fmt(ts: string) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDateHeure(ts: string) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ─── Tab Visiteurs ────────────────────────────────────────────────────────────

function TabVisiteurs({ ownerId, ownerField }: { ownerId: string; ownerField: string }) {
  const [visiteurs, setVisiteurs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(false);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [motif, setMotif] = useState("");
  const [badgeNum, setBadgeNum] = useState("");
  const [cleNum, setCleNum] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("registre_visiteurs")
      .select("*")
      .eq(ownerField, ownerId)
      .order("heure_entree", { ascending: false })
      .limit(100);
    if (error) toast.error("Erreur chargement visiteurs");
    setVisiteurs(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [ownerId]);

  const enregistrerEntree = async () => {
    if (!nom.trim() || !prenom.trim()) { toast.error("Nom et prénom obligatoires"); return; }
    setSaving(true);
    const { error } = await supabase.from("registre_visiteurs").insert({
      [ownerField]: ownerId,
      nom: nom.trim(),
      prenom: prenom.trim(),
      entreprise: entreprise.trim() || null,
      motif: motif.trim() || null,
      badge_numero: badgeNum.trim() || null,
      cle_numero: cleNum.trim() || null,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Entrée enregistrée");
    setNom(""); setPrenom(""); setEntreprise(""); setMotif(""); setBadgeNum(""); setCleNum("");
    setForm(false); setSaving(false);
    load();
  };

  const enregistrerSortie = async (id: string) => {
    const { error } = await supabase.from("registre_visiteurs").update({
      heure_sortie: new Date().toISOString(),
      statut: "sorti",
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Sortie enregistrée");
    load();
  };

  const presents = visiteurs.filter(v => v.statut === "present");
  const sortis = visiteurs.filter(v => v.statut === "sorti");

  return (
    <div className="space-y-6">
      {form ? (
        <Card className="p-5 bg-card/60 border-border/50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Enregistrer une entrée</h3>
            <button onClick={() => setForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Nom *", val: nom, set: setNom, ph: "Dupont" },
              { label: "Prénom *", val: prenom, set: setPrenom, ph: "Jean" },
              { label: "Entreprise", val: entreprise, set: setEntreprise, ph: "Acme Corp" },
              { label: "Motif", val: motif, set: setMotif, ph: "Réunion, livraison…" },
              { label: "Badge N°", val: badgeNum, set: setBadgeNum, ph: "VIS-001" },
              { label: "Clé N°", val: cleNum, set: setCleNum, ph: "CLE-002" },
            ].map(({ label, val, set, ph }) => (
              <div key={label} className="space-y-1">
                <label className="text-xs text-muted-foreground">{label}</label>
                <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
                  className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
            ))}
          </div>
          <Button onClick={enregistrerEntree} disabled={saving} className="bg-primary hover:bg-primary/90 gap-2 w-full">
            <LogIn className="h-4 w-4" />{saving ? "Enregistrement…" : "Enregistrer l'entrée"}
          </Button>
        </Card>
      ) : (
        <Button onClick={() => setForm(true)} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="h-4 w-4" />Enregistrer une entrée
        </Button>
      )}

      {loading ? <p className="text-muted-foreground text-sm text-center py-8">Chargement…</p> : (
        <>
          {presents.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <h2 className="font-semibold text-sm">En cours ({presents.length})</h2>
              </div>
              {presents.map(v => (
                <Card key={v.id} className="p-4 bg-card/60 border border-emerald-500/20 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{v.prenom} {v.nom}</p>
                      {v.entreprise && <p className="text-xs text-muted-foreground">{v.entreprise}</p>}
                      {v.motif && <p className="text-xs text-muted-foreground italic">{v.motif}</p>}
                    </div>
                    <Button size="sm" onClick={() => enregistrerSortie(v.id)}
                      className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 gap-1.5 flex-shrink-0">
                      <LogOut className="h-3.5 w-3.5" />Sortie
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Entrée {fmt(v.heure_entree)}</span>
                    {v.badge_numero && <span className="flex items-center gap-1"><CreditCard className="h-3 w-3" />Badge {v.badge_numero}</span>}
                    {v.cle_numero && <span className="flex items-center gap-1"><Key className="h-3 w-3" />Clé {v.cle_numero}</span>}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {sortis.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-semibold text-sm text-muted-foreground">Historique ({sortis.length})</h2>
              {sortis.map(v => (
                <Card key={v.id} className="p-4 bg-card/40 border-border/30 space-y-1 opacity-70">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">
                      {v.prenom} {v.nom}
                      {v.entreprise && <span className="text-muted-foreground font-normal"> · {v.entreprise}</span>}
                    </p>
                    <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">Sorti</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Entrée {fmt(v.heure_entree)}</span>
                    {v.heure_sortie && <span>Sortie {fmt(v.heure_sortie)}</span>}
                    {v.badge_numero && <span>Badge {v.badge_numero}</span>}
                    {v.cle_numero && <span>Clé {v.cle_numero}</span>}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {visiteurs.length === 0 && (
            <Card className="p-12 text-center border-dashed">
              <p className="text-muted-foreground text-sm">Aucun visiteur enregistré</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab Inventaire (Clés + Badges) ──────────────────────────────────────────

type InventaireType = "cle" | "badge_visiteur" | "badge_employe";

function TabInventaire({ ownerId, ownerField, type }: { ownerId: string; ownerField: string; type: InventaireType }) {
  const isCle = type === "cle";
  const table = isCle ? "inventaire_cles" : "inventaire_badges";
  const badgeType = type === "badge_visiteur" ? "visiteur" : "employe";

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(false);
  const [numero, setNumero] = useState("");
  const [designation, setDesignation] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [remisA, setRemisA] = useState("");

  const load = async () => {
    setLoading(true);
    let q = supabase.from(table).select("*").eq(ownerField, ownerId);
    if (!isCle) q = q.eq("type", badgeType);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) toast.error("Erreur chargement");
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [ownerId, type]);

  const ajouter = async () => {
    if (!numero.trim() || !designation.trim()) { toast.error("Numéro et désignation obligatoires"); return; }
    setSaving(true);
    const payload: any = { [ownerField]: ownerId, numero: numero.trim(), designation: designation.trim() };
    if (!isCle) payload.type = badgeType;
    const { error } = await supabase.from(table).insert(payload);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Ajouté à l'inventaire");
    setNumero(""); setDesignation(""); setForm(false); setSaving(false);
    load();
  };

  const remettre = async (id: string) => {
    if (!remisA.trim()) { toast.error("Indiquez à qui remettre"); return; }
    const now = new Date().toISOString();
    const update = isCle
      ? { statut: "remise", remis_a: remisA.trim(), remis_le: now, rendu_le: null }
      : { statut: "attribue", attribue_a: remisA.trim(), attribue_le: now, rendu_le: null };
    const { error } = await supabase.from(table).update(update).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(isCle ? "Clé remise" : "Badge attribué");
    setActionId(null); setRemisA(""); load();
  };

  const restituer = async (id: string) => {
    const { error } = await supabase.from(table).update({ statut: "disponible", rendu_le: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Retour enregistré");
    load();
  };

  const marquerPerdu = async (id: string) => {
    if (!confirm("Marquer comme perdu/e ?")) return;
    const { error } = await supabase.from(table).update({ statut: isCle ? "perdue" : "perdu" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marqué comme perdu");
    load();
  };

  const labelSing = isCle ? "clé" : "badge";
  const disponibles = items.filter(i => i.statut === "disponible").length;
  const utilises = items.filter(i => i.statut === (isCle ? "remise" : "attribue")).length;

  return (
    <div className="space-y-6">
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 text-center bg-card/60 border-border/50">
            <p className="text-2xl font-bold">{items.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total</p>
          </Card>
          <Card className="p-4 text-center bg-card/60 border border-emerald-500/20">
            <p className="text-2xl font-bold text-emerald-400">{disponibles}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Disponibles</p>
          </Card>
          <Card className="p-4 text-center bg-card/60 border border-amber-500/20">
            <p className="text-2xl font-bold text-amber-400">{utilises}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{isCle ? "Remises" : "Attribués"}</p>
          </Card>
        </div>
      )}

      {form ? (
        <Card className="p-5 bg-card/60 border-border/50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Ajouter {isCle ? "une clé" : "un badge"}</h3>
            <button onClick={() => setForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Numéro / Référence *</label>
              <input value={numero} onChange={e => setNumero(e.target.value)}
                placeholder={isCle ? "CLE-001" : "VIS-001"}
                className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Désignation *</label>
              <input value={designation} onChange={e => setDesignation(e.target.value)}
                placeholder={isCle ? "Salle de réunion" : "Accès badge principal"}
                className="w-full bg-background border border-border/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
          </div>
          <Button onClick={ajouter} disabled={saving} className="bg-primary hover:bg-primary/90 gap-2 w-full">
            <Plus className="h-4 w-4" />{saving ? "Ajout…" : `Ajouter ${isCle ? "la clé" : "le badge"}`}
          </Button>
        </Card>
      ) : (
        <Button onClick={() => setForm(true)} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="h-4 w-4" />Ajouter {isCle ? "une clé" : "un badge"}
        </Button>
      )}

      {loading ? <p className="text-muted-foreground text-sm text-center py-8">Chargement…</p> : (
        <>
          {items.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <p className="text-muted-foreground text-sm">Aucun{isCle ? "e" : ""} {labelSing} dans l'inventaire</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {items.map(item => {
                const isDisponible = item.statut === "disponible";
                const isPerdu = item.statut === "perdue" || item.statut === "perdu";
                const recipient = isCle ? item.remis_a : item.attribue_a;
                const issuedAt = isCle ? item.remis_le : item.attribue_le;
                const isActioned = actionId === item.id;

                return (
                  <Card key={item.id} className={`p-4 bg-card/60 border-border/50 space-y-3 ${isPerdu ? "opacity-50" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{item.numero}</span>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            isDisponible ? "bg-emerald-500/15 text-emerald-400"
                            : isPerdu ? "bg-red-500/15 text-red-400"
                            : "bg-amber-500/15 text-amber-400"
                          }`}>
                            {isDisponible ? "Disponible" : isPerdu ? "Perdu" : isCle ? "Remise" : "Attribué"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.designation}</p>
                        {recipient && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {isCle ? "Remis à" : "Attribué à"}{" "}
                            <span className="text-foreground font-medium">{recipient}</span>
                            {issuedAt && <span> · {fmtDateHeure(issuedAt)}</span>}
                          </p>
                        )}
                      </div>

                      {!isPerdu && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          {isDisponible && !isActioned && (
                            <>
                              <Button size="sm" onClick={() => { setActionId(item.id); setRemisA(""); }}
                                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs h-7 px-2.5">
                                {isCle ? "Remettre" : "Attribuer"}
                              </Button>
                              <Button size="sm" onClick={() => marquerPerdu(item.id)}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs h-7 px-2.5">
                                Perdu
                              </Button>
                            </>
                          )}
                          {!isDisponible && (
                            <Button size="sm" onClick={() => restituer(item.id)}
                              className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs h-7 px-2.5">
                              Retour
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {isActioned && (
                      <div className="flex gap-2">
                        <input value={remisA} onChange={e => setRemisA(e.target.value)}
                          placeholder={isCle ? "Remis à (nom)…" : "Attribué à (nom)…"}
                          onKeyDown={e => e.key === "Enter" && remettre(item.id)}
                          className="flex-1 bg-background border border-border/50 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50" />
                        <Button size="sm" onClick={() => remettre(item.id)} className="bg-primary hover:bg-primary/90 h-8 px-3">OK</Button>
                        <Button size="sm" onClick={() => setActionId(null)} className="bg-muted/60 hover:bg-muted/80 text-foreground h-8 w-8 p-0">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Export principal ─────────────────────────────────────────────────────────

export function AccesBadges({ formateurId, stagiaireId }: { formateurId?: string; stagiaireId?: string }) {
  const ownerId = formateurId ?? stagiaireId ?? "";
  const ownerField = formateurId ? "formateur_id" : "stagiaire_id";

  const [tab, setTab] = useState<"visiteurs" | "cles" | "badges_visiteur" | "badges_employe">("visiteurs");

  const tabs = [
    { id: "visiteurs" as const, label: "Visiteurs", icon: Users },
    { id: "cles" as const, label: "Clés", icon: Key },
    { id: "badges_visiteur" as const, label: "Badges visiteurs", icon: CreditCard },
    { id: "badges_employe" as const, label: "Badges employés", icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Accès & Badges</h1>
        <p className="text-muted-foreground text-sm mt-1">Gestion des visiteurs, clés et badges</p>
      </div>

      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap flex-1 justify-center ${tab === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {tab === "visiteurs" && <TabVisiteurs ownerId={ownerId} ownerField={ownerField} />}
      {tab === "cles" && <TabInventaire ownerId={ownerId} ownerField={ownerField} type="cle" />}
      {tab === "badges_visiteur" && <TabInventaire ownerId={ownerId} ownerField={ownerField} type="badge_visiteur" />}
      {tab === "badges_employe" && <TabInventaire ownerId={ownerId} ownerField={ownerField} type="badge_employe" />}
    </div>
  );
}

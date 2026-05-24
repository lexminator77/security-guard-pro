// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";

type Statut = "ouverte" | "en_cours" | "cloturee";
type DemandeurType = "stagiaire" | "entreprise" | "autre";

interface Reclamation {
  id: string;
  date_reclamation: string;
  demandeur_nom: string;
  demandeur_type: DemandeurType;
  objet: string;
  description: string;
  statut: Statut;
  reponse: string | null;
  date_cloture: string | null;
  created_at: string;
}

const STATUT_BADGE: Record<Statut, { label: string; className: string }> = {
  ouverte: { label: "Ouverte", className: "bg-destructive/10 text-destructive border-destructive/30" },
  en_cours: { label: "En cours", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  cloturee: { label: "Clôturée", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
};

const emptyForm = {
  date_reclamation: new Date().toISOString().slice(0, 10),
  demandeur_nom: "",
  demandeur_type: "stagiaire" as DemandeurType,
  objet: "",
  description: "",
};

export default function Reclamations() {
  const [list, setList] = useState<Reclamation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState<"all" | Statut>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Reclamation | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editReponse, setEditReponse] = useState("");
  const [editStatut, setEditStatut] = useState<Statut>("ouverte");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Réclamations — SecureCRM";
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("reclamations").select("*").order("date_reclamation", { ascending: false });
    if (error) toast.error(error.message);
    setList((data ?? []) as Reclamation[]);
    setLoading(false);
  };

  const create = async () => {
    if (!form.demandeur_nom || !form.objet || !form.description) {
      toast.error("Tous les champs obligatoires doivent être remplis");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("reclamations").insert({
      ...form,
      statut: "ouverte",
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Réclamation enregistrée");
    setCreateOpen(false);
    setForm(emptyForm);
    setSaving(false);
    load();
  };

  const openEdit = (rec: Reclamation) => {
    setSelected(rec);
    setEditReponse(rec.reponse ?? "");
    setEditStatut(rec.statut);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("reclamations").update({
      reponse: editReponse || null,
      statut: editStatut,
    }).eq("id", selected.id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Mise à jour enregistrée");
    setEditOpen(false);
    setSaving(false);
    load();
  };

  const cloture = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("reclamations").update({
      statut: "cloturee",
      reponse: editReponse || null,
      date_cloture: new Date().toISOString().slice(0, 10),
    }).eq("id", selected.id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Réclamation clôturée");
    setEditOpen(false);
    setSaving(false);
    load();
  };

  const displayed = filterStatut === "all" ? list : list.filter((r) => r.statut === filterStatut);
  const openCount = list.filter((r) => r.statut === "ouverte").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow flex items-center gap-3">
            <MessageSquareWarning className="h-7 w-7 text-primary" /> Réclamations
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {list.length} réclamation(s) au total
            {openCount > 0 && <Badge className="ml-2 bg-destructive/10 text-destructive border-destructive/30">{openCount}</Badge>}
          </p>
        </div>
        <Button className="gradient-primary text-primary-foreground shadow-glow" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nouvelle réclamation
        </Button>
      </div>

      <div className="flex gap-2">
        {(["all", "ouverte", "en_cours", "cloturee"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filterStatut === s ? "default" : "outline"}
            onClick={() => setFilterStatut(s)}
          >
            {s === "all" ? "Toutes" : s === "ouverte" ? "Ouvertes" : s === "en_cours" ? "En cours" : "Clôturées"}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : displayed.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <p className="text-muted-foreground">Aucune réclamation.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {displayed.map((rec) => {
            const badge = STATUT_BADGE[rec.statut];
            return (
              <Card
                key={rec.id}
                className="p-4 bg-card/60 border-border/50 hover:border-primary/30 cursor-pointer transition-colors"
                onClick={() => openEdit(rec)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{rec.objet}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rec.demandeur_nom} · {rec.demandeur_type} · {rec.date_reclamation.split("-").reverse().join("/")}
                    </p>
                  </div>
                  <Badge className={`text-[10px] shrink-0 ${badge.className}`}>{badge.label}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog création */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouvelle réclamation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Date de réception</Label>
              <Input type="date" value={form.date_reclamation} onChange={(e) => setForm({ ...form, date_reclamation: e.target.value })} />
            </div>
            <div>
              <Label>Nom du demandeur *</Label>
              <Input value={form.demandeur_nom} onChange={(e) => setForm({ ...form, demandeur_nom: e.target.value })} />
            </div>
            <div>
              <Label>Type de demandeur</Label>
              <Select value={form.demandeur_type} onValueChange={(v) => setForm({ ...form, demandeur_type: v as DemandeurType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stagiaire">Stagiaire</SelectItem>
                  <SelectItem value="entreprise">Entreprise</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Objet *</Label>
              <Input value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} placeholder="Résumé court" />
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
            </div>
            <Button onClick={create} disabled={saving} className="w-full gradient-primary text-primary-foreground">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog édition */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.objet}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{selected.demandeur_nom} · {selected.demandeur_type}</p>
                <p>Reçue le {selected.date_reclamation.split("-").reverse().join("/")}</p>
              </div>
              <div className="bg-muted/20 rounded-lg p-3 text-sm">{selected.description}</div>
              <div>
                <Label>Statut</Label>
                <Select value={editStatut} onValueChange={(v) => setEditStatut(v as Statut)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ouverte">Ouverte</SelectItem>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="cloturee">Clôturée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Réponse apportée</Label>
                <Textarea value={editReponse} onChange={(e) => setEditReponse(e.target.value)} rows={3} />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveEdit} disabled={saving} className="flex-1 gradient-primary text-primary-foreground">
                  {saving ? "…" : "Enregistrer"}
                </Button>
                {selected.statut !== "cloturee" && (
                  <Button onClick={cloture} disabled={saving} variant="outline" className="flex-1 border-emerald-500/30 text-emerald-400">
                    Clôturer
                  </Button>
                )}
              </div>
              {selected.date_cloture && (
                <p className="text-xs text-muted-foreground">Clôturée le {selected.date_cloture.split("-").reverse().join("/")}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

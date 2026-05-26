// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { generateFacturePdf } from "@/lib/generateFacturePdf";

type Facture = {
  id: string;
  numero: string;
  formation_id: string | null;
  client_nom: string;
  client_adresse: string | null;
  client_siret: string | null;
  montant_ht: number;
  statut: "brouillon" | "envoye" | "paye";
  date_emission: string;
  participant_count: number;
  formation: { title: string; type: string; start_date: string; end_date: string; duration_hours: number | null } | null;
};

const STATUT: Record<string, { label: string; color: string }> = {
  brouillon: { label: "Brouillon", color: "bg-muted/50 text-muted-foreground border-border/50" },
  envoye:    { label: "Envoyé",    color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  paye:      { label: "Payé",      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
};

const NEXT: Record<string, string> = { brouillon: "envoye", envoye: "paye" };

export default function Facturation() {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [filtre, setFiltre] = useState<"all" | "brouillon" | "envoye" | "paye">("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("factures")
      .select("*, formation:formations(title, type, start_date, end_date, duration_hours)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setFactures(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatut = async (id: string, statut: string) => {
    const { error } = await supabase.from("factures").update({ statut }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Statut mis à jour"); load(); }
  };

  const deleteFacture = async (id: string) => {
    if (!confirm("Supprimer cette facture ?")) return;
    const { error } = await supabase.from("factures").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Facture supprimée"); load(); }
  };

  const displayed = filtre === "all" ? factures : factures.filter(f => f.statut === filtre);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Facturation</h1>

      <div className="flex gap-2 flex-wrap">
        {(["all", "brouillon", "envoye", "paye"] as const).map(s => (
          <Button key={s} size="sm" variant={filtre === s ? "default" : "outline"}
            onClick={() => setFiltre(s)}>
            {s === "all" ? "Toutes" : STATUT[s].label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : displayed.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {filtre === "all" ? "Aucune facture pour le moment." : `Aucune facture avec le statut "${STATUT[filtre]?.label}".`}
        </p>
      ) : (
        <div className="space-y-2">
          {displayed.map(f => (
            <div key={f.id} className="border border-border/50 rounded-lg p-4 bg-card/50 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-semibold">{f.numero}</span>
                  <Badge variant="outline" className={`text-xs ${STATUT[f.statut]?.color}`}>
                    {STATUT[f.statut]?.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 truncate">{f.client_nom}</p>
                {f.formation && (
                  <p className="text-xs text-muted-foreground/70 truncate">{f.formation.title}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold">{Number(f.montant_ht).toLocaleString("fr-FR")} € HT</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(f.date_emission).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <Button size="sm" variant="outline"
                  onClick={() => generateFacturePdf(f, f.formation ?? null)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {NEXT[f.statut] && (
                  <Button size="sm" variant="outline"
                    aria-label="Avancer le statut"
                    onClick={() => updateStatut(f.id, NEXT[f.statut])}>
                    → {STATUT[NEXT[f.statut]]?.label}
                  </Button>
                )}
                {f.statut === "brouillon" && (
                  <Button size="sm" variant="outline"
                    className="text-destructive hover:bg-destructive/10 border-destructive/30"
                    onClick={() => deleteFacture(f.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// src/pages/PasseportPrevention.tsx
// @ts-nocheck
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Download, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { generatePasseportPdf } from "@/lib/generatePasseportPdf";

type Stagiaire = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  carte_pro_number: string | null;
  carte_pro_expiry: string | null;
  autorisation_numero: string | null;
  autorisation_type: string | null;
  autorisation_expiry: string | null;
};

type Participation = {
  status: string;
  resultat: string | null;
  formation: {
    title: string;
    type: string;
    start_date: string;
    end_date: string;
    duration_hours: number | null;
  } | null;
};

type CertificationItem = {
  type: string;
  date_obtention: string;
  date_expiration: string | null;
  formation: { title: string } | null;
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR");
}

function ValiditeBadge({ dateExpiration }: { dateExpiration: string | null }) {
  if (!dateExpiration) return <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground border-border/50">Sans limite</Badge>;
  const days = Math.ceil((new Date(dateExpiration + "T00:00:00").getTime() - Date.now()) / 86400000);
  if (days < 0) return <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">Expiré</Badge>;
  if (days <= 60) return <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-400 border-orange-500/30">Expire bientôt</Badge>;
  return <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Valide</Badge>;
}

const STATUT_LABEL: Record<string, string> = {
  inscrit: "Inscrit", present: "Présent", absent: "Absent", valide: "Validé", echec: "Échec",
};
const RESULTAT_LABEL: Record<string, string> = {
  obtenu: "Obtenu", en_attente: "En attente",
};

export default function PasseportPrevention() {
  const { stagiaireId: paramId } = useParams<{ stagiaireId: string }>();
  const navigate = useNavigate();
  const { user, roles } = useAuth();

  const [stagiaire, setStagiaire] = useState<Stagiaire | null>(null);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [effectiveId, setEffectiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const isStagiaire = (roles as string[]).includes("stagiaire");
    if (isStagiaire) {
      supabase.from("stagiaires").select("id").eq("auth_user_id", user.id).single()
        .then(({ data }) => {
          if (data) setEffectiveId(data.id);
          else setLoading(false);
        });
    } else {
      setEffectiveId(paramId ?? null);
    }
  }, [user, roles, paramId]);

  useEffect(() => {
    if (!effectiveId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase
        .from("stagiaires")
        .select("id, first_name, last_name, birth_date, email, phone, carte_pro_number, carte_pro_expiry, autorisation_numero, autorisation_type, autorisation_expiry")
        .eq("id", effectiveId)
        .single(),
      supabase
        .from("formation_participants")
        .select("status, resultat, formation:formations(title, type, start_date, end_date, duration_hours)")
        .eq("stagiaire_id", effectiveId)
        .order("created_at", { ascending: false }),
      supabase
        .from("certifications")
        .select("type, date_obtention, date_expiration, formation:formations(title)")
        .eq("stagiaire_id", effectiveId)
        .order("date_obtention", { ascending: false }),
    ]).then(([s, p, c]) => {
      if (cancelled) return;
      if (s.error) toast.error(s.error.message);
      else setStagiaire(s.data);
      if (p.error) toast.error(p.error.message);
      else setParticipations(p.data ?? []);
      if (c.error) toast.error(c.error.message);
      else setCertifications(c.data ?? []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [effectiveId]);

  const handleDownload = async () => {
    if (!stagiaire) return;
    setGenerating(true);
    try {
      await generatePasseportPdf(stagiaire, participations, certifications);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur PDF");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground text-sm">Chargement…</div>;
  if (!stagiaire) return <div className="p-8 text-muted-foreground text-sm">Passeport introuvable.</div>;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <BookOpen className="h-6 w-6 text-yellow-400" />
          <h1 className="text-2xl font-bold">Passeport de Prévention</h1>
        </div>
        <Button onClick={handleDownload} disabled={generating}>
          <Download className="h-4 w-4 mr-2" />
          {generating ? "Génération…" : "Télécharger le passeport PDF"}
        </Button>
      </div>

      <div className="border border-border/50 rounded-lg p-4 bg-card/50 space-y-1">
        <h2 className="text-lg font-bold">{stagiaire.last_name.toUpperCase()} {stagiaire.first_name}</h2>
        {stagiaire.birth_date && (
          <p className="text-sm text-muted-foreground">Né(e) le {fmtDate(stagiaire.birth_date)}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {stagiaire.email}{stagiaire.phone ? ` · ${stagiaire.phone}` : ""}
        </p>
        <div className="pt-1 text-sm">
          <span className="font-medium">Carte pro CNAPS : </span>
          {stagiaire.carte_pro_number
            ? `${stagiaire.carte_pro_number} (exp. ${fmtDate(stagiaire.carte_pro_expiry)})`
            : "Non renseignée"}
        </div>
        {stagiaire.autorisation_numero && (
          <div className="text-sm">
            <span className="font-medium">Autorisation : </span>
            {stagiaire.autorisation_numero} · {stagiaire.autorisation_type}
            {stagiaire.autorisation_expiry ? ` (exp. ${fmtDate(stagiaire.autorisation_expiry)})` : ""}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-widest">
          Formations suivies ({participations.length})
        </h3>
        {participations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune formation enregistrée.</p>
        ) : (
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="text-left p-3 font-medium text-xs">Intitulé</th>
                  <th className="text-left p-3 font-medium text-xs">Type</th>
                  <th className="text-left p-3 font-medium text-xs">Période</th>
                  <th className="text-left p-3 font-medium text-xs">Durée</th>
                  <th className="text-left p-3 font-medium text-xs">Statut</th>
                  <th className="text-left p-3 font-medium text-xs">Résultat</th>
                </tr>
              </thead>
              <tbody>
                {participations.map((p, i) => (
                  <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                    <td className="p-3">{p.formation?.title ?? "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs">{p.formation?.type ?? "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {fmtDate(p.formation?.start_date)} → {fmtDate(p.formation?.end_date)}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {p.formation?.duration_hours ? `${p.formation.duration_hours}h` : "—"}
                    </td>
                    <td className="p-3 text-xs">{STATUT_LABEL[p.status] ?? p.status}</td>
                    <td className="p-3 text-xs">
                      {p.resultat ? (RESULTAT_LABEL[p.resultat] ?? p.resultat) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-widest">
          Certifications ({certifications.length})
        </h3>
        {certifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune certification enregistrée.</p>
        ) : (
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="text-left p-3 font-medium text-xs">Type</th>
                  <th className="text-left p-3 font-medium text-xs">Date obtention</th>
                  <th className="text-left p-3 font-medium text-xs">Expiration</th>
                  <th className="text-left p-3 font-medium text-xs">Formation associée</th>
                  <th className="text-left p-3 font-medium text-xs">Validité</th>
                </tr>
              </thead>
              <tbody>
                {certifications.map((c, i) => (
                  <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                    <td className="p-3 font-medium text-xs">{c.type.toUpperCase()}</td>
                    <td className="p-3 text-muted-foreground text-xs">{fmtDate(c.date_obtention)}</td>
                    <td className="p-3 text-muted-foreground text-xs">{fmtDate(c.date_expiration)}</td>
                    <td className="p-3 text-muted-foreground text-xs">{c.formation?.title ?? "—"}</td>
                    <td className="p-3"><ValiditeBadge dateExpiration={c.date_expiration} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

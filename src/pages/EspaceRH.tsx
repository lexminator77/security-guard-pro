import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, LogOut, FileText, Download, Calendar, Award } from "lucide-react";
import { CERT_LABELS, certStatusBadge } from "@/lib/certificationUtils";
import type { CertType } from "@/types/certifications";

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
}

interface Certification {
  id: string;
  stagiaire_id: string;
  type: CertType;
  date_obtention: string;
  date_expiration: string;
  source: string;
}

interface Formation {
  id: string;
  stagiaire_id: string;
  title: string;
  start_date: string;
  location: string | null;
}

interface Document {
  id: string;
  stagiaire_id: string;
  nom: string;
  url: string;
  type: string;
  created_at: string;
}

export default function EspaceRH() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entrepriseName, setEntrepriseName] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    document.title = "Espace RH — SecureCRM";
    if (user) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const load = async () => {
    setLoading(true);

    const { data: rhLink } = await supabase
      .from("entreprise_rh")
      .select("entreprise_id")
      .maybeSingle();

    if (!rhLink?.entreprise_id) { setLoading(false); return; }

    const entrepriseId = rhLink.entreprise_id;

    const [entrepriseRes, linksRes] = await Promise.all([
      supabase.from("entreprises").select("nom").eq("id", entrepriseId).maybeSingle(),
      supabase.from("entreprise_stagiaires").select("stagiaire_id").eq("entreprise_id", entrepriseId),
    ]);

    setEntrepriseName(entrepriseRes.data?.nom ?? "");
    const stagIds: string[] = (linksRes.data ?? []).map((r: { stagiaire_id: string }) => r.stagiaire_id);

    if (stagIds.length === 0) { setLoading(false); return; }

    const today = new Date().toISOString().slice(0, 10);

    const [stagsRes, certsRes, fpRes, docsRes] = await Promise.all([
      supabase.from("stagiaires").select("id, first_name, last_name").in("id", stagIds).order("last_name"),
      supabase.from("certifications").select("id, stagiaire_id, type, date_obtention, date_expiration, source").in("stagiaire_id", stagIds),
      supabase.from("formation_participants")
        .select("stagiaire_id, formations(id, title, start_date, location)")
        .in("stagiaire_id", stagIds)
        .gte("formations.start_date", today)
        .order("formations(start_date)"),
      supabase.from("stagiaire_documents").select("id, stagiaire_id, nom, url, type, created_at").in("stagiaire_id", stagIds),
    ]);

    setAgents((stagsRes.data ?? []) as Agent[]);
    setCertifications((certsRes.data ?? []) as Certification[]);

    const fms: Formation[] = [];
    for (const fp of (fpRes.data ?? []) as Array<{ stagiaire_id: string; formations: Formation | null }>) {
      if (fp.formations) fms.push({ ...fp.formations, stagiaire_id: fp.stagiaire_id });
    }
    setFormations(fms);
    setDocuments((docsRes.data ?? []) as Document[]);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Shield className="h-12 w-12 text-primary animate-pulse" />
          <p className="text-muted-foreground text-sm">Chargement…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-display font-bold text-foreground">SecureCRM</span>
            {entrepriseName && (
              <>
                <span className="text-muted-foreground mx-1">·</span>
                <span className="text-sm text-muted-foreground">{entrepriseName}</span>
              </>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Tableau de bord RH</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {agents.length} agent{agents.length > 1 ? "s" : ""} · Vue lecture seule
          </p>
        </div>

        {agents.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <p className="text-muted-foreground">Aucun agent rattaché à votre entreprise.</p>
          </Card>
        ) : (
          agents.map((agent) => {
            const agentCerts = certifications.filter((c) => c.stagiaire_id === agent.id);
            const agentForms = formations.filter((f) => f.stagiaire_id === agent.id);
            const agentDocs = documents.filter((d) => d.stagiaire_id === agent.id);

            return (
              <Card key={agent.id} className="p-6 bg-card/60 border-border/50 space-y-5">
                <h2 className="font-semibold text-lg">
                  {agent.first_name} {agent.last_name}
                </h2>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5" /> Certifications
                  </p>
                  {agentCerts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune certification enregistrée</p>
                  ) : (
                    <div className="space-y-1.5">
                      {agentCerts.map((cert) => {
                        const badge = certStatusBadge(cert.date_expiration);
                        return (
                          <div key={cert.id} className="flex items-center gap-3 text-sm">
                            <span className="w-28 text-muted-foreground shrink-0">
                              {CERT_LABELS[cert.type] ?? cert.type}
                            </span>
                            <Badge className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>
                            <span className="text-muted-foreground text-xs">
                              expire le {cert.date_expiration.split("-").reverse().join("/")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Prochaines formations
                  </p>
                  {agentForms.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune formation à venir</p>
                  ) : (
                    <div className="space-y-1">
                      {agentForms.slice(0, 3).map((f) => (
                        <div key={f.id} className="text-sm">
                          {f.title} — {f.start_date.split("-").reverse().join("/")}
                          {f.location && <span className="text-muted-foreground"> · {f.location}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Documents
                  </p>
                  {agentDocs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun document</p>
                  ) : (
                    <div className="space-y-1">
                      {agentDocs.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-2 text-sm">
                          <span className="flex-1 truncate">{doc.nom}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {doc.created_at.slice(0, 10).split("-").reverse().join("/")}
                          </span>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0"
                            aria-label={`Télécharger ${doc.nom}`}
                          >
                            <Download className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}

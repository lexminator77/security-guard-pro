// src/pages/VerificationCNAPS.tsx
// @ts-nocheck
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Agent = {
  id: string;
  first_name: string;
  last_name: string;
  carte_pro_number: string | null;
  cnaps_statut: "vert" | "rouge" | "a_verifier" | "inconnu";
  cnaps_last_checked: string | null;
};

type Filtre = "tous" | "vert" | "rouge" | "a_verifier" | "inconnu";

const BADGE: Record<string, { label: string; className: string }> = {
  vert:       { label: "Valide",      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  rouge:      { label: "Problème",    className: "bg-red-500/10 text-red-400 border-red-500/30" },
  a_verifier: { label: "À vérifier",  className: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  inconnu:    { label: "Inconnu",     className: "bg-muted/50 text-muted-foreground border-border/50" },
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export default function VerificationCNAPS() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<Set<string>>(new Set());
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [filtre, setFiltre] = useState<Filtre>("tous");

  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const SUPABASE_URL = (supabase as any).supabaseUrl as string;

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("stagiaires")
      .select("id, first_name, last_name, carte_pro_number, cnaps_statut, cnaps_last_checked")
      .order("last_name");
    if (!isMounted.current) return;
    if (error) toast.error(error.message);
    else setAgents(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function callVerifyFunction(stagiaireIds?: string[]) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/verify-cnaps`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(stagiaireIds ? { stagiaire_ids: stagiaireIds } : {}),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  async function handleVerifyAll() {
    setVerifyingAll(true);
    try {
      const result = await callVerifyFunction();
      toast.success(`${result.processed} agents vérifiés`);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur vérification");
    } finally {
      setVerifyingAll(false);
    }
  }

  async function handleVerifyOne(id: string) {
    setVerifying(prev => new Set(prev).add(id));
    try {
      await callVerifyFunction([id]);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur vérification");
    } finally {
      setVerifying(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  async function handleCorrection(id: string, statut: "vert" | "rouge") {
    const { error } = await supabase
      .from("stagiaires")
      .update({ cnaps_statut: statut, cnaps_last_checked: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else await load();
  }

  const FILTRES: { key: Filtre; label: string }[] = [
    { key: "tous", label: "Tous" },
    { key: "vert", label: "Agents valides" },
    { key: "rouge", label: "Agents problème" },
    { key: "a_verifier", label: "À vérifier" },
    { key: "inconnu", label: "Agents inconnus" },
  ];

  const visible = filtre === "tous" ? agents : agents.filter(a => a.cnaps_statut === filtre);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-yellow-400" />
          <div>
            <h1 className="text-2xl font-bold">DRACAR</h1>
            <p className="text-sm text-muted-foreground">Vérification CNAPS — mise à jour automatique tous les 15 jours</p>
          </div>
        </div>
        <Button onClick={handleVerifyAll} disabled={verifyingAll}>
          <RefreshCw className={`h-4 w-4 mr-2 ${verifyingAll ? "animate-spin" : ""}`} />
          {verifyingAll ? "Vérification…" : "Vérifier tous les agents"}
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTRES.map(f => (
          <Button
            key={f.key}
            variant={filtre === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltre(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : (
        <div className="border border-border/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="text-left p-3 font-medium text-xs">Agent</th>
                <th className="text-left p-3 font-medium text-xs">N° carte pro</th>
                <th className="text-left p-3 font-medium text-xs">Statut CNAPS</th>
                <th className="text-left p-3 font-medium text-xs">Dernière vérif</th>
                <th className="text-left p-3 font-medium text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(a => {
                const b = BADGE[a.cnaps_statut] ?? BADGE.inconnu;
                const isVerifying = verifying.has(a.id);
                return (
                  <tr key={a.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                    <td className="p-3 font-medium">
                      <span>{(a.last_name ?? "").toUpperCase()}</span>{" "}
                      <span>{a.first_name}</span>
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {a.carte_pro_number ?? "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-xs ${b.className}`}>
                        {b.label}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {fmtDate(a.cnaps_last_checked)}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {a.carte_pro_number && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isVerifying}
                            onClick={() => handleVerifyOne(a.id)}
                          >
                            <RefreshCw className={`h-3 w-3 mr-1 ${isVerifying ? "animate-spin" : ""}`} />
                            Vérifier
                          </Button>
                        )}
                        {a.cnaps_statut === "a_verifier" && (
                          <>
                            <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300"
                              onClick={() => handleCorrection(a.id, "vert")}>
                              Marquer valide
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300"
                              onClick={() => handleCorrection(a.id, "rouge")}>
                              Marquer problème
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground text-sm">
                    Aucun agent pour ce filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

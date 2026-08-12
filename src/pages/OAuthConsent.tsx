// @ts-nocheck
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Autoriser une application — SecureCRM";
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Paramètre authorization_id manquant");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error: err } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (err) {
        setError(err.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const { data, error: err } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId)
      : await supabase.auth.oauth.denyAuthorization(authorizationId);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Aucune redirection renvoyée par le serveur d'autorisation.");
      return;
    }
    window.location.href = target;
  };

  const clientName = details?.client?.name ?? "cette application";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 gradient-surface" />
      <Card className="w-full max-w-md relative z-10 border-border/50 backdrop-blur-sm bg-card/80 shadow-elegant p-8 animate-fade-in">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="h-14 w-14 rounded-xl gradient-primary flex items-center justify-center shadow-glow mb-4">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-display font-bold text-glow">SecureCRM</h1>
        </div>

        {error ? (
          <p className="text-sm text-destructive text-center">
            Impossible de traiter cette demande d'autorisation : {error}
          </p>
        ) : !details ? (
          <p className="text-sm text-muted-foreground text-center">Chargement…</p>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2 text-center">
              <h2 className="font-semibold">Connecter {clientName} à votre compte</h2>
              <p className="text-sm text-muted-foreground">
                {clientName} pourra consulter et modifier les données SecureCRM auxquelles vous avez
                accès, en votre nom.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
                Refuser
              </Button>
              <Button
                className="flex-1 gradient-primary text-primary-foreground shadow-glow"
                disabled={busy}
                onClick={() => decide(true)}
              >
                {busy ? "..." : "Autoriser"}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

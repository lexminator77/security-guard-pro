import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function ResetPassword() {
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    document.title = "Définir mot de passe — SecureCRM";
    // Supabase pose la session via le hash (#access_token=...) à l'arrivée du lien d'invitation/recovery
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("8 caractères minimum");
    if (pwd !== pwd2) return toast.error("Les mots de passe ne correspondent pas");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success("Mot de passe défini. Reconnecte-toi.");
      await supabase.auth.signOut();
      nav("/auth", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 gradient-surface" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />

      <Card className="w-full max-w-md relative z-10 border-border/50 backdrop-blur-sm bg-card/80 shadow-elegant p-8 animate-fade-in">
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-xl gradient-primary flex items-center justify-center shadow-glow mb-4">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-glow">Définir mon mot de passe</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Choisis un mot de passe pour activer ton compte.
          </p>
        </div>

        {!ready ? (
          <p className="text-sm text-muted-foreground text-center">Vérification du lien…</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="p1">Nouveau mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="p1" type="password" className="pl-9" value={pwd} onChange={(e) => setPwd(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p2">Confirmer</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="p2" type="password" className="pl-9" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={busy} className="w-full gradient-primary text-primary-foreground shadow-glow">
              {busy ? "..." : "Valider et me reconnecter"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

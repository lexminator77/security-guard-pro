import { useState, useEffect } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Shield, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(6, "6 caractères minimum").max(72),
});

export default function Auth() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const rawNext = params.get("next") ?? "";
  // Only same-origin relative paths are accepted.
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : "/";
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  useEffect(() => { document.title = "Connexion — SecureCRM"; }, []);

  if (!loading && user) return <Navigate to={next} replace />;

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (forgot) {
        const email = z.string().email().parse(form.email);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password?next=${encodeURIComponent(next)}`,
        });
        if (error) throw error;
        toast.success("Email envoyé. Vérifie ta boîte de réception.");
        setForgot(false);
      } else {
        const parsed = loginSchema.parse(form);
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.email,
          password: parsed.password,
        });
        if (error) throw error;
        toast.success("Connexion réussie");
        nav(next);
      }
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message || err.message || "Erreur");
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
          <h1 className="text-2xl font-display font-bold text-glow">SecureCRM</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {forgot ? "Réinitialiser le mot de passe" : "Connexion à votre espace"}
          </p>
        </div>

        <form onSubmit={handle} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="email" type="email" className="pl-9" placeholder="vous@exemple.fr"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          {!forgot && (
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" className="pl-9" placeholder="••••••••"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            </div>
          )}

          <Button type="submit" disabled={busy} className="w-full gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-opacity">
            {busy ? "..." : forgot ? "Envoyer le lien" : "Se connecter"}
          </Button>

          <button type="button" onClick={() => setForgot(!forgot)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors w-full text-center">
            {forgot ? "← Retour à la connexion" : "Mot de passe oublié ?"}
          </button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-6">
          L'accès se fait uniquement sur invitation de l'administrateur.
        </p>
      </Card>
    </div>
  );
}

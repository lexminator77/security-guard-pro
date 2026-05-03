import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Shield, Lock, Mail, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(6, "6 caractères minimum").max(72),
});
const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Nom requis").max(100),
});

export default function Auth() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", fullName: "" });

  useEffect(() => { document.title = "Connexion — SecureCRM"; }, []);

  if (!loading && user) return <Navigate to="/" replace />;

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.parse(form);
        const { error } = await supabase.auth.signUp({
          email: parsed.email,
          password: parsed.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: parsed.fullName },
          },
        });
        if (error) throw error;
        toast.success("Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse avant de vous connecter.");
        setMode("login");
      } else {
        const parsed = loginSchema.parse(form);
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.email,
          password: parsed.password,
        });
        if (error) throw error;
        toast.success("Connexion réussie");
        nav("/");
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
          <p className="text-sm text-muted-foreground mt-1">Centre de gestion sécurité & formation</p>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
          <TabsList className="grid grid-cols-2 w-full mb-6">
            <TabsTrigger value="login">Connexion</TabsTrigger>
            <TabsTrigger value="signup">Inscription</TabsTrigger>
          </TabsList>

          <form onSubmit={handle} className="space-y-4">
            <TabsContent value="signup" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nom complet</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="fullName" className="pl-9" placeholder="Jean Dupont"
                    value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                </div>
              </div>
            </TabsContent>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" className="pl-9" placeholder="vous@exemple.fr"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" className="pl-9" placeholder="••••••••"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
            </div>

            <Button type="submit" disabled={busy} className="w-full gradient-primary text-primary-foreground shadow-glow hover:opacity-90 transition-opacity">
              {busy ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </Button>
          </form>
        </Tabs>

        <p className="text-xs text-muted-foreground text-center mt-6">
          Le premier compte créé devient automatiquement administrateur.
        </p>
      </Card>
    </div>
  );
}

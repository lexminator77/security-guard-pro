// @ts-nocheck
import { useEffect, useState } from "react";
import { Mail, UserPlus, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

type Role = "administrateur" | "formateur" | "agent" | "secretaire" | "stagiaire";

interface Row {
  user_id: string;
  role: Role;
  full_name: string | null;
  email: string | null;
}

export default function Utilisateurs() {
  const { roles, loading } = useAuth();
  const [list, setList] = useState<Row[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("formateur");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { document.title = "Utilisateurs — SecureCRM"; load(); }, []);

  const load = async () => {
    const { data: ur } = await supabase.from("user_roles").select("user_id, role");
    if (!ur) return;
    const ids = [...new Set(ur.map((r) => r.user_id))];
    const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    const map = new Map(profs?.map((p) => [p.id, p]) ?? []);
    setList(ur.map((r) => ({
      user_id: r.user_id,
      role: r.role as Role,
      full_name: map.get(r.user_id)?.full_name ?? null,
      email: map.get(r.user_id)?.email ?? null,
    })));
  };

  if (!loading && !roles.includes("administrateur")) return <Navigate to="/" replace />;

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: email.trim().toLowerCase(),
          full_name: name.trim() || null,
          role,
          redirect_to: `${window.location.origin}/reset-password`,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Invitation envoyée à ${email}`);
      setEmail(""); setName("");
      setTimeout(load, 1000);
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async (user_id: string, userRole: Role) => {
    setDeleting(user_id);
    try {
      // Supprime le rôle dans user_roles
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", user_id)
        .eq("role", userRole);

      if (error) throw error;

      // Supprime aussi le profil si plus aucun rôle
      const { data: remaining } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("user_id", user_id);

      if (!remaining || remaining.length === 0) {
        await supabase.from("profiles").delete().eq("id", user_id);
      }

      toast.success("Utilisateur supprimé");
      load();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-glow">Utilisateurs</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Invite par email. La personne reçoit un lien pour définir son mot de passe.
        </p>
      </div>

      <Card className="p-6 border-border/50">
        <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" /> Inviter un utilisateur
        </h2>
        <form onSubmit={invite} className="grid md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label htmlFor="em">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="em" type="email" required className="pl-9"
                value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.fr" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nm">Nom complet</Label>
            <Input id="nm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jean Dupont" />
          </div>
          <div className="space-y-1">
            <Label>Rôle</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="administrateur">Administrateur</SelectItem>
                <SelectItem value="formateur">Formateur</SelectItem>
                <SelectItem value="secretaire">Secrétaire</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="stagiaire">Stagiaire</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={busy} className="w-full gradient-primary text-primary-foreground shadow-glow">
              {busy ? "..." : "Envoyer l'invitation"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6 border-border/50">
        <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" /> Comptes existants ({list.length})
        </h2>
        <div className="space-y-2">
          {list.map((u) => (
            <div key={`${u.user_id}-${u.role}`} className="flex items-center justify-between p-3 rounded-lg bg-card/50 border border-border/50">
              <div>
                <div className="font-medium">{u.full_name || u.email || u.user_id.slice(0, 8)}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{u.role}</Badge>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      disabled={deleting === u.user_id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        <strong>{u.full_name || u.email}</strong> ({u.role}) sera retiré de l'application.
                        Cette action est irréversible.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => deleteUser(u.user_id, u.role)}
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

              </div>
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-muted-foreground">Aucun compte.</p>}
        </div>
      </Card>
    </div>
  );
}
// @ts-nocheck
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Users, GraduationCap, AlertTriangle, ShieldAlert } from "lucide-react";
import ExpirationAlertsCard from "@/components/ExpirationAlertsCard";

interface Stats {
  stagiaires: number;
  formationsActives: number;
  incidentsOuverts: number;
  cartesExpirent: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ stagiaires: 0, formationsActives: 0, incidentsOuverts: 0, cartesExpirent: 0 });

  useEffect(() => {
    document.title = "Dashboard — SecureCRM";
    load();
  }, []);

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    const [stag, form, inc, cards] = await Promise.all([
      supabase.from("stagiaires").select("*", { count: "exact", head: true }),
      supabase.from("formations").select("*", { count: "exact", head: true }).gte("end_date", today),
      supabase.from("incidents").select("*", { count: "exact", head: true }).neq("status", "resolu"),
      supabase.from("stagiaires").select("*", { count: "exact", head: true }).lte("carte_pro_expiry", in90).gte("carte_pro_expiry", today),
    ]);

    setStats({
      stagiaires: stag.count ?? 0,
      formationsActives: form.count ?? 0,
      incidentsOuverts: inc.count ?? 0,
      cartesExpirent: cards.count ?? 0,
    });
  };

  const statCards = [
    { label: "Stagiaires", value: stats.stagiaires, icon: Users, color: "text-primary" },
    { label: "Formations actives", value: stats.formationsActives, icon: GraduationCap, color: "text-success" },
    { label: "Incidents ouverts", value: stats.incidentsOuverts, icon: AlertTriangle, color: "text-warning" },
    { label: "Cartes expirent <90j", value: stats.cartesExpirent, icon: ShieldAlert, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow">Tableau de bord</h1>
          <p className="text-muted-foreground text-sm mt-1">Vue d'ensemble de votre centre de sécurité</p>
        </div>
        <Badge variant="outline" className="border-success/40 text-success gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success animate-pulse-glow" /> Système opérationnel
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c) => (
          <Card key={c.label} className="p-5 bg-card/60 border-border/50 hover:border-primary/40 transition-all hover:shadow-glow group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
                <p className="text-3xl font-display font-bold mt-2">{c.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-lg bg-secondary flex items-center justify-center ${c.color} group-hover:scale-110 transition-transform`}>
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <ExpirationAlertsCard />
    </div>
  );
}
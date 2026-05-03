import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Users, GraduationCap, AlertTriangle, ShieldAlert, TrendingUp, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

interface Stats {
  stagiaires: number;
  formationsActives: number;
  incidentsOuverts: number;
  cartesExpirent: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ stagiaires: 0, formationsActives: 0, incidentsOuverts: 0, cartesExpirent: 0 });
  const [chartData, setChartData] = useState<{ name: string; value: number }[]>([]);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    document.title = "Dashboard — SecureCRM";
    load();
  }, []);

  const load = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const [stag, form, inc, cards, lastInc] = await Promise.all([
      supabase.from("stagiaires").select("*", { count: "exact", head: true }),
      supabase.from("formations").select("*", { count: "exact", head: true }).gte("end_date", today),
      supabase.from("incidents").select("*", { count: "exact", head: true }).neq("status", "resolu"),
      supabase.from("stagiaires").select("*", { count: "exact", head: true }).lte("carte_pro_expiry", in30).gte("carte_pro_expiry", today),
      supabase.from("incidents").select("id, title, severity, status, created_at").order("created_at", { ascending: false }).limit(5),
    ]);

    setStats({
      stagiaires: stag.count ?? 0,
      formationsActives: form.count ?? 0,
      incidentsOuverts: inc.count ?? 0,
      cartesExpirent: cards.count ?? 0,
    });
    setRecent(lastInc.data ?? []);

    const { data: formByType } = await supabase.from("formations").select("type");
    const counts: Record<string, number> = {};
    (formByType ?? []).forEach((f: any) => { counts[f.type] = (counts[f.type] ?? 0) + 1; });
    setChartData(Object.entries(counts).map(([name, value]) => ({ name, value })));
  };

  const cards = [
    { label: "Stagiaires", value: stats.stagiaires, icon: Users, color: "text-primary" },
    { label: "Formations actives", value: stats.formationsActives, icon: GraduationCap, color: "text-success" },
    { label: "Incidents ouverts", value: stats.incidentsOuverts, icon: AlertTriangle, color: "text-warning" },
    { label: "Cartes expirent <30j", value: stats.cartesExpirent, icon: ShieldAlert, color: "text-destructive" },
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
        {cards.map((c) => (
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-6 bg-card/60 border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Formations par type</h2>
          </div>
          <div className="h-64">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune formation enregistrée</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6 bg-card/60 border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Activité récente</h2>
          </div>
          <div className="space-y-3">
            {recent.length === 0 && <p className="text-sm text-muted-foreground">Aucune activité</p>}
            {recent.map((i) => (
              <div key={i.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                <div className={`h-2 w-2 rounded-full mt-1.5 ${
                  i.severity === "critique" ? "bg-destructive" :
                  i.severity === "eleve" ? "bg-warning" : "bg-primary"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{i.title}</p>
                  <p className="text-xs text-muted-foreground">{new Date(i.created_at).toLocaleString("fr-FR")}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

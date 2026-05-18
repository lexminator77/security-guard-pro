// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Users, GraduationCap, TrendingUp, Euro, Award, Calendar } from "lucide-react";

const COLORS = ["hsl(var(--primary))", "#f97316", "#22c55e", "#a855f7", "#06b6d4", "#eab308", "#ef4444"];
const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export default function Statistiques() {
  const [annee, setAnnee] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalStagiaires: 0, totalFormations: 0, totalRevenu: 0, tauxReussite: 0 });
  const [stagiairesParMois, setStagiairesParMois] = useState<any[]>([]);
  const [formationsParType, setFormationsParType] = useState<any[]>([]);
  const [formationsParStatut, setFormationsParStatut] = useState<any[]>([]);
  const [revenusParMois, setRevenusParMois] = useState<any[]>([]);

  const annees = ["2024", "2025", "2026", "2027"];

  useEffect(() => {
    document.title = "Statistiques — SecureCRM";
    load();
  }, [annee]);

  const load = async () => {
    setLoading(true);
    const debut = `${annee}-01-01`;
    const fin = `${annee}-12-31`;

    // Formations de l'année
    const { data: formations } = await supabase
      .from("formations")
      .select("*")
      .gte("start_date", debut)
      .lte("start_date", fin);

    // IDs des formations de l'année
    const formationIds = (formations ?? []).map((f: any) => f.id);

    // Participants de ces formations
    const { data: participants } = formationIds.length > 0
      ? await supabase.from("formation_participants").select("*").in("formation_id", formationIds)
      : { data: [] };

    // Nouveaux stagiaires de l'année
    const { data: stagiaires } = await supabase
      .from("stagiaires")
      .select("created_at")
      .gte("created_at", debut)
      .lte("created_at", fin);

    // Revenus — somme des tarifs des participants
    const totalRevenu = (participants ?? []).reduce((acc: number, p: any) => acc + (Number(p.tarif) || 0), 0);

    // Taux de réussite
    const valides = (participants ?? []).filter((p: any) => p.status === "valide").length;
    const termines = (participants ?? []).filter((p: any) => ["valide", "echec"].includes(p.status)).length;
    const tauxReussite = termines > 0 ? Math.round((valides / termines) * 100) : 0;

    setStats({
      totalStagiaires: stagiaires?.length ?? 0,
      totalFormations: formations?.length ?? 0,
      totalRevenu,
      tauxReussite,
    });

    // Stagiaires par mois
    const stagParMois = Array(12).fill(0);
    (stagiaires ?? []).forEach((s: any) => {
      const m = new Date(s.created_at).getMonth();
      stagParMois[m]++;
    });
    setStagiairesParMois(MOIS.map((name, i) => ({ name, value: stagParMois[i] })));

    // Formations par type
    const typeCount: Record<string, number> = {};
    (formations ?? []).forEach((f: any) => {
      typeCount[f.type] = (typeCount[f.type] ?? 0) + 1;
    });
    setFormationsParType(Object.entries(typeCount).map(([name, value]) => ({ name, value })));

    // Formations par statut
    const statutLabels: Record<string, string> = {
      planifie: "Planifiée", en_cours: "En cours", termine: "Terminée", annule: "Annulée",
    };
    const statutCount: Record<string, number> = {};
    (formations ?? []).forEach((f: any) => {
      const label = statutLabels[f.status] ?? f.status;
      statutCount[label] = (statutCount[label] ?? 0) + 1;
    });
    setFormationsParStatut(Object.entries(statutCount).map(([name, value]) => ({ name, value })));

    // Revenus par mois — on mappe chaque participant sur le mois de sa formation
    const formationMois: Record<string, number> = {};
    (formations ?? []).forEach((f: any) => {
      formationMois[f.id] = new Date(f.start_date).getMonth();
    });
    const revParMois = Array(12).fill(0);
    (participants ?? []).forEach((p: any) => {
      const m = formationMois[p.formation_id];
      if (m !== undefined) revParMois[m] += Number(p.tarif) || 0;
    });
    setRevenusParMois(MOIS.map((name, i) => ({ name, value: revParMois[i] })));

    setLoading(false);
  };

  const summaryCards = [
    { label: "Nouveaux stagiaires", value: stats.totalStagiaires, icon: Users, color: "text-primary", suffix: "" },
    { label: "Formations", value: stats.totalFormations, icon: GraduationCap, color: "text-emerald-400", suffix: "" },
    { label: "Taux de réussite", value: stats.tauxReussite, icon: Award, color: "text-orange-400", suffix: "%" },
    { label: "Revenus", value: stats.totalRevenu.toLocaleString("fr-FR"), icon: Euro, color: "text-yellow-400", suffix: " €" },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow">Statistiques</h1>
          <p className="text-muted-foreground text-sm mt-1">Vue d'ensemble de votre activité</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={annee} onValueChange={setAnnee}>
            <SelectTrigger className="w-32 bg-secondary/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {annees.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((c) => (
          <Card key={c.label} className="p-5 bg-card/60 border-border/50 hover:border-primary/40 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
                <p className={"text-3xl font-display font-bold mt-2 " + c.color}>
                  {loading ? "—" : `${c.value}${c.suffix}`}
                </p>
              </div>
              <div className={"h-10 w-10 rounded-lg bg-secondary flex items-center justify-center " + c.color}>
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6 bg-card/60 border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="font-display font-semibold">Nouveaux stagiaires par mois</h2>
          <Badge variant="outline" className="ml-auto border-primary/30 text-primary">{annee}</Badge>
        </div>
        <div className="h-56">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Chargement...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stagiairesParMois}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Stagiaires" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <Card className="p-6 bg-card/60 border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-yellow-400" />
          <h2 className="font-display font-semibold">Revenus par mois (€)</h2>
          <Badge variant="outline" className="ml-auto border-yellow-400/30 text-yellow-400">{annee}</Badge>
        </div>
        <div className="h-56">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Chargement...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenusParMois}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: any) => [`${Number(v).toLocaleString("fr-FR")} €`, "Revenus"]}
                />
                <Line type="monotone" dataKey="value" stroke="#eab308" strokeWidth={2} dot={{ fill: "#eab308" }} name="Revenus" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6 bg-card/60 border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="h-4 w-4 text-emerald-400" />
            <h2 className="font-display font-semibold">Formations par type</h2>
          </div>
          <div className="h-56">
            {loading ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Chargement...</div>
            ) : formationsParType.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune formation</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={formationsParType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                    {formationsParType.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6 bg-card/60 border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Award className="h-4 w-4 text-orange-400" />
            <h2 className="font-display font-semibold">Formations par statut</h2>
          </div>
          <div className="h-56">
            {loading ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Chargement...</div>
            ) : formationsParStatut.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune formation</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={formationsParStatut} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" fill="#f97316" radius={[0, 6, 6, 0]} name="Formations" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
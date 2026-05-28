// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Users, GraduationCap, TrendingUp, Euro, Award, Calendar,
  Download, FileSpreadsheet, UserCheck, TrendingDown, Minus,
} from "lucide-react";

const COLORS = ["hsl(var(--primary))", "#f97316", "#22c55e", "#a855f7", "#06b6d4", "#eab308", "#ef4444"];
const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const fmt = (n: number) => n.toLocaleString("fr-FR");

export default function Statistiques() {
  const [annee, setAnnee] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);

  // KPIs globaux
  const [kpi, setKpi] = useState({
    totalStagiairesInscrits: 0,
    totalFormations: 0,
    totalCA: 0,
    totalCoutFormateurs: 0,
    marge: 0,
    tauxReussite: 0,
    nouveauxStagiaires: 0,
  });

  // Graphiques
  const [stagiairesParMois, setStagiairesParMois] = useState<any[]>([]);
  const [rentaParMois, setRentaParMois] = useState<any[]>([]);
  const [formationsParType, setFormationsParType] = useState<any[]>([]);
  const [sessionsDetail, setSessionsDetail] = useState<any[]>([]);

  // BPF
  const [bpfLoading, setBpfLoading] = useState(false);
  const [bpfData, setBpfData] = useState<any | null>(null);

  const annees = ["2024", "2025", "2026", "2027"];

  useEffect(() => {
    document.title = "Statistiques — SecureCRM";
    load();
  }, [annee]);

  const load = async () => {
    setLoading(true);
    const debut = `${annee}-01-01`;
    const fin = `${annee}-12-31`;

    const [{ data: formations }, { data: stagiairesNouveaux }] = await Promise.all([
      supabase.from("formations")
        .select("id, title, type, start_date, prix_ht, duration_hours, cout_formateur, formateur_id, template_code")
        .gte("start_date", debut).lte("start_date", fin),
      supabase.from("stagiaires").select("created_at").gte("created_at", debut).lte("created_at", fin),
    ]);

    const fIds = (formations ?? []).map((f: any) => f.id);
    const { data: participants } = fIds.length
      ? await supabase.from("formation_participants").select("formation_id, stagiaire_id, status, resultat").in("formation_id", fIds)
      : { data: [] };

    // ── KPIs ──────────────────────────────────────────────────────────────
    const totalCA = (formations ?? []).reduce((s: number, f: any) => s + (Number(f.prix_ht) || 0), 0);
    const totalCoutFormateurs = (formations ?? []).reduce((s: number, f: any) => s + (Number(f.cout_formateur) || 0), 0);
    const marge = totalCA - totalCoutFormateurs;
    const totalStagiairesInscrits = (participants ?? []).length;
    const valides = (participants ?? []).filter((p: any) => p.resultat === "obtenu").length;
    const termines = (participants ?? []).filter((p: any) => ["obtenu", "a_repasser"].includes(p.resultat ?? "")).length;
    const tauxReussite = termines > 0 ? Math.round((valides / termines) * 100) : 0;

    setKpi({
      totalStagiairesInscrits,
      totalFormations: formations?.length ?? 0,
      totalCA,
      totalCoutFormateurs,
      marge,
      tauxReussite,
      nouveauxStagiaires: stagiairesNouveaux?.length ?? 0,
    });

    // ── Stagiaires par mois ────────────────────────────────────────────────
    const stagParMois = Array(12).fill(0);
    (stagiairesNouveaux ?? []).forEach((s: any) => {
      stagParMois[new Date(s.created_at).getMonth()]++;
    });
    setStagiairesParMois(MOIS.map((name, i) => ({ name, value: stagParMois[i] })));

    // ── Rentabilité par mois (CA, coûts, marge) ───────────────────────────
    const caParMois = Array(12).fill(0);
    const coutsParMois = Array(12).fill(0);
    (formations ?? []).forEach((f: any) => {
      const m = new Date(f.start_date).getMonth();
      caParMois[m] += Number(f.prix_ht) || 0;
      coutsParMois[m] += Number(f.cout_formateur) || 0;
    });
    setRentaParMois(MOIS.map((name, i) => ({
      name,
      CA: caParMois[i],
      Charges: coutsParMois[i],
      Marge: caParMois[i] - coutsParMois[i],
    })));

    // ── Formations par type ───────────────────────────────────────────────
    const typeCount: Record<string, number> = {};
    (formations ?? []).forEach((f: any) => { typeCount[f.type] = (typeCount[f.type] ?? 0) + 1; });
    setFormationsParType(Object.entries(typeCount).map(([name, value]) => ({ name, value })));

    // ── Détail par session ────────────────────────────────────────────────
    const partByFormation: Record<string, any[]> = {};
    (participants ?? []).forEach((p: any) => {
      partByFormation[p.formation_id] ??= [];
      partByFormation[p.formation_id].push(p);
    });
    const detail = (formations ?? []).map((f: any) => {
      const ps = partByFormation[f.id] ?? [];
      const ca = Number(f.prix_ht) || 0;
      const cout = Number(f.cout_formateur) || 0;
      return {
        id: f.id,
        title: f.title,
        type: f.type,
        date: f.start_date,
        nbStagiaires: ps.length,
        ca,
        cout,
        marge: ca - cout,
      };
    }).sort((a, b) => b.date.localeCompare(a.date));
    setSessionsDetail(detail);

    setLoading(false);
  };

  const loadBpf = async () => {
    setBpfLoading(true);
    setBpfData(null);
    try {
      const debut = `${annee}-01-01`;
      const fin = `${annee}-12-31`;
      const [{ data: formations }, { data: tokens }] = await Promise.all([
        supabase.from("formations").select("id, formateur_id, prix_ht, cout_formateur, duration_hours").gte("start_date", debut).lte("start_date", fin),
        supabase.from("questionnaire_tokens").select("type, completed_at, reponses, formation_id"),
      ]);
      const fIds = (formations ?? []).map((f: any) => f.id);
      const { data: participants } = fIds.length
        ? await supabase.from("formation_participants").select("stagiaire_id, formation_id").in("formation_id", fIds)
        : { data: [] };

      const nbFormations = fIds.length;
      const nbStagiaires = new Set((participants ?? []).map((p: any) => p.stagiaire_id)).size;
      const partByF: Record<string, number> = {};
      (participants ?? []).forEach((p: any) => { partByF[p.formation_id] = (partByF[p.formation_id] ?? 0) + 1; });
      const nbHeuresStagiaires = (formations ?? []).reduce((acc: number, f: any) =>
        acc + (Number(f.duration_hours) || 0) * (partByF[f.id] ?? 0), 0);
      const chiffreAffaires = (formations ?? []).reduce((acc: number, f: any) => acc + (Number(f.prix_ht) || 0), 0);
      const totalCouts = (formations ?? []).reduce((acc: number, f: any) => acc + (Number(f.cout_formateur) || 0), 0);
      const nbFormateurs = new Set((formations ?? []).filter((f: any) => f.formateur_id).map((f: any) => f.formateur_id)).size;

      const anneeTokens = (tokens ?? []).filter((t: any) => fIds.includes(t.formation_id));
      const chaudTokens = anneeTokens.filter((t: any) => t.type === "satisfaction_chaud");
      const froidTokens = anneeTokens.filter((t: any) => t.type === "satisfaction_froid");
      const scores: number[] = [];
      chaudTokens.filter((t: any) => t.completed_at && t.reponses).forEach((t: any) => {
        const rep = t.reponses as Record<string, unknown>;
        ["sc1","sc2","sc3","sc4","sc5","sc6","sc7","sc8"].forEach(k => {
          const v = Number(rep[k]);
          if (v >= 1 && v <= 5) scores.push(v);
        });
      });
      const tauxSatisfaction = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;

      setBpfData({
        nbFormations, nbStagiaires, nbHeuresStagiaires, chiffreAffaires, totalCouts,
        marge: chiffreAffaires - totalCouts,
        nbFormateurs,
        tauxSatisfaction,
        tauxCompletionChaud: chaudTokens.length ? `${chaudTokens.filter((t: any) => t.completed_at).length}/${chaudTokens.length}` : "—",
        tauxCompletionFroid: froidTokens.length ? `${froidTokens.filter((t: any) => t.completed_at).length}/${froidTokens.length}` : "—",
      });
    } finally {
      setBpfLoading(false);
    }
  };

  const downloadBpfCsv = () => {
    if (!bpfData) return;
    const rows = [
      ["Rubrique BPF", "Valeur", "Année"],
      ["Nombre d'actions de formation", bpfData.nbFormations, annee],
      ["Nombre de stagiaires formés", bpfData.nbStagiaires, annee],
      ["Nombre d'heures stagiaires", bpfData.nbHeuresStagiaires, annee],
      ["Chiffre d'affaires HT (€)", bpfData.chiffreAffaires, annee],
      ["Coûts formateurs HT (€)", bpfData.totalCouts, annee],
      ["Marge nette (€)", bpfData.marge, annee],
      ["Nombre de formateurs actifs", bpfData.nbFormateurs, annee],
      ["Taux de satisfaction moyen (/5)", bpfData.tauxSatisfaction ?? "N/A", annee],
      ["Complétion satisfaction à chaud", bpfData.tauxCompletionChaud, annee],
      ["Complétion satisfaction à froid", bpfData.tauxCompletionFroid, annee],
    ];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `BPF_${annee}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const margeColor = kpi.marge >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow">Statistiques</h1>
          <p className="text-muted-foreground text-sm mt-1">Vue d'ensemble de l'activité et de la rentabilité</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={annee} onValueChange={setAnnee}>
            <SelectTrigger className="w-32 bg-secondary/50 border-border/50"><SelectValue /></SelectTrigger>
            <SelectContent>{annees.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Stagiaires inscrits", value: kpi.totalStagiairesInscrits, icon: Users, color: "text-primary", suffix: "" },
          { label: "Sessions", value: kpi.totalFormations, icon: GraduationCap, color: "text-emerald-400", suffix: "" },
          { label: "Taux de réussite", value: kpi.tauxReussite, icon: Award, color: "text-orange-400", suffix: "%" },
          { label: "Nouveaux stagiaires", value: kpi.nouveauxStagiaires, icon: UserCheck, color: "text-violet-400", suffix: "" },
        ].map(c => (
          <Card key={c.label} className="p-5 bg-card/60 border-border/50 hover:border-primary/40 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
                <p className={`text-3xl font-display font-bold mt-2 ${c.color}`}>
                  {loading ? "—" : `${c.value}${c.suffix}`}
                </p>
              </div>
              <div className={`h-10 w-10 rounded-lg bg-secondary flex items-center justify-center ${c.color}`}>
                <c.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Rentabilité 3 cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 bg-card/60 border-border/50 hover:border-yellow-400/30 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">CA total HT</p>
              <p className="text-3xl font-display font-bold mt-2 text-yellow-400">
                {loading ? "—" : `${fmt(kpi.totalCA)} €`}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">Revenus stagiaires</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-card/60 border-border/50 hover:border-red-400/30 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Coûts formateurs</p>
              <p className="text-3xl font-display font-bold mt-2 text-red-400">
                {loading ? "—" : `${fmt(kpi.totalCoutFormateurs)} €`}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">Honoraires & salaires</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
              <TrendingDown className="h-5 w-5" />
            </div>
          </div>
        </Card>
        <Card className={`p-5 bg-card/60 border-border/50 transition-all ${kpi.marge >= 0 ? "hover:border-emerald-400/30" : "hover:border-red-400/30"}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Marge nette</p>
              <p className={`text-3xl font-display font-bold mt-2 ${loading ? "text-muted-foreground" : margeColor}`}>
                {loading ? "—" : `${fmt(kpi.marge)} €`}
              </p>
              {!loading && kpi.totalCA > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {Math.round((kpi.marge / kpi.totalCA) * 100)}% du CA
                </p>
              )}
            </div>
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${kpi.marge >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
              <Euro className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Graph rentabilité par mois */}
      <Card className="p-6 bg-card/60 border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-yellow-400" />
          <h2 className="font-display font-semibold">CA, charges et marge par mois</h2>
          <Badge variant="outline" className="ml-auto border-yellow-400/30 text-yellow-400">{annee}</Badge>
        </div>
        <div className="h-64">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Chargement…</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rentaParMois} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: any, name: string) => [`${fmt(Number(v))} €`, name]}
                />
                <Legend />
                <Bar dataKey="CA" fill="#eab308" radius={[4, 4, 0, 0]} name="CA" />
                <Bar dataKey="Charges" fill="#ef4444" radius={[4, 4, 0, 0]} name="Charges" />
                <Bar dataKey="Marge" fill="#22c55e" radius={[4, 4, 0, 0]} name="Marge" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Tableau détail par session */}
      <Card className="p-6 bg-card/60 border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <Euro className="h-4 w-4 text-primary" />
          <h2 className="font-display font-semibold">Rentabilité par session</h2>
          <Badge variant="outline" className="ml-auto border-primary/30 text-primary">{annee}</Badge>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : sessionsDetail.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune session cette année.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-left">
                  <th className="pb-2 font-medium">Formation</th>
                  <th className="pb-2 font-medium text-center">Stag.</th>
                  <th className="pb-2 font-medium text-right">CA HT</th>
                  <th className="pb-2 font-medium text-right">Formateur</th>
                  <th className="pb-2 font-medium text-right">Marge</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {sessionsDetail.map(s => (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="py-2 pr-4">
                      <span className="font-medium truncate max-w-[220px] block">{s.title}</span>
                      <span className="text-[11px] text-muted-foreground">{s.date} · {s.type}</span>
                    </td>
                    <td className="py-2 text-center font-mono">{s.nbStagiaires}</td>
                    <td className="py-2 text-right font-mono text-yellow-400">{s.ca > 0 ? `${fmt(s.ca)} €` : "—"}</td>
                    <td className="py-2 text-right font-mono text-red-400">{s.cout > 0 ? `${fmt(s.cout)} €` : "—"}</td>
                    <td className={`py-2 text-right font-mono font-semibold ${s.marge >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {s.ca > 0 || s.cout > 0 ? `${fmt(s.marge)} €` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-border">
                <tr className="font-semibold">
                  <td className="pt-2 text-muted-foreground">Total</td>
                  <td className="pt-2 text-center font-mono">{sessionsDetail.reduce((s, r) => s + r.nbStagiaires, 0)}</td>
                  <td className="pt-2 text-right font-mono text-yellow-400">{fmt(kpi.totalCA)} €</td>
                  <td className="pt-2 text-right font-mono text-red-400">{kpi.totalCoutFormateurs > 0 ? `${fmt(kpi.totalCoutFormateurs)} €` : "—"}</td>
                  <td className={`pt-2 text-right font-mono ${margeColor}`}>{fmt(kpi.marge)} €</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Deux graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6 bg-card/60 border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-display font-semibold">Nouveaux stagiaires par mois</h2>
          </div>
          <div className="h-48">
            {loading ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Chargement…</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stagiairesParMois}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Stagiaires" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card className="p-6 bg-card/60 border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="h-4 w-4 text-emerald-400" />
            <h2 className="font-display font-semibold">Sessions par type</h2>
          </div>
          <div className="h-48">
            {loading ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Chargement…</div>
            : formationsParType.length === 0 ? <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Aucune session</div>
            : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={formationsParType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72}
                    label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                    {formationsParType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* BPF */}
      <Card className="p-6 bg-card/60 border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <h2 className="font-display font-semibold">Export BPF — Bilan Pédagogique et Financier</h2>
            <Badge variant="outline" className="ml-2 border-emerald-400/30 text-emerald-400">{annee}</Badge>
          </div>
          <Button size="sm" variant="outline" onClick={loadBpf} disabled={bpfLoading} className="border-border/50">
            {bpfLoading ? "Chargement…" : "Calculer"}
          </Button>
        </div>
        {!bpfData ? (
          <p className="text-sm text-muted-foreground">Cliquez sur "Calculer" pour générer le bilan de l'année {annee}.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Actions de formation", value: bpfData.nbFormations },
                { label: "Stagiaires formés", value: bpfData.nbStagiaires },
                { label: "Heures stagiaires", value: bpfData.nbHeuresStagiaires },
                { label: "CA HT (€)", value: fmt(bpfData.chiffreAffaires) },
                { label: "Coûts formateurs (€)", value: fmt(bpfData.totalCouts) },
                { label: "Marge nette (€)", value: fmt(bpfData.marge) },
                { label: "Formateurs actifs", value: bpfData.nbFormateurs },
                { label: "Satisfaction moy. /5", value: bpfData.tauxSatisfaction ?? "N/A" },
                { label: "Complétion chaud", value: bpfData.tauxCompletionChaud },
                { label: "Complétion froid", value: bpfData.tauxCompletionFroid },
              ].map(item => (
                <div key={item.label} className="bg-card/40 rounded-lg p-3 border border-border/40">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className="text-xl font-display font-bold text-primary mt-1">{item.value}</p>
                </div>
              ))}
            </div>
            <Button onClick={downloadBpfCsv} className="gradient-primary text-primary-foreground shadow-glow">
              <Download className="h-4 w-4 mr-2" />Télécharger BPF_{annee}.csv
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

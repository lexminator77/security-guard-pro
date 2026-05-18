// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Search, UserCheck, Users, Clock, ChevronLeft } from "lucide-react";

export default function Audit() {
  const [tab, setTab] = useState<"formateurs" | "stagiaires">("formateurs");
  const [emargFormateurs, setEmargFormateurs] = useState<any[]>([]);
  const [emargStagiaires, setEmargStagiaires] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [selectedFormateur, setSelectedFormateur] = useState<any | null>(null);
  const [selectedStagiaire, setSelectedStagiaire] = useState<any | null>(null);

  useEffect(() => { document.title = "Audit — SecureCRM"; loadAll(); }, []);

  const loadAll = async () => {
    const [{ data: ef }, { data: es }] = await Promise.all([
      supabase.from("emargements_formateur")
        .select("*, formateur:formateurs(id, first_name, last_name), formation:formations(title, type)")
        .order("signe_le", { ascending: false }),
      supabase.from("emargements_stagiaire")
        .select("*, stagiaire:stagiaires(id, first_name, last_name), formation:formations(title, type)")
        .order("signe_le", { ascending: false }),
    ]);
    if (ef) setEmargFormateurs(ef);
    if (es) setEmargStagiaires(es);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("fr-FR");
  const formatDateTime = (d: string) => new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  // Grouper par formateur
  const formateurGroups = emargFormateurs.reduce((acc: any, e: any) => {
    const id = e.formateur?.id;
    if (!id) return acc;
    acc[id] ??= { formateur: e.formateur, signatures: [] };
    acc[id].signatures.push(e);
    return acc;
  }, {});

  // Grouper par stagiaire
  const stagiaireGroups = emargStagiaires.reduce((acc: any, e: any) => {
    const id = e.stagiaire?.id;
    if (!id) return acc;
    acc[id] ??= { stagiaire: e.stagiaire, signatures: [] };
    acc[id].signatures.push(e);
    return acc;
  }, {});

  const filteredFormateurs = Object.values(formateurGroups).filter((g: any) =>
    !q || `${g.formateur.first_name} ${g.formateur.last_name}`.toLowerCase().includes(q.toLowerCase())
  );

  const filteredStagiaires = Object.values(stagiaireGroups).filter((g: any) =>
    !q || `${g.stagiaire.first_name} ${g.stagiaire.last_name}`.toLowerCase().includes(q.toLowerCase())
  );

  // Vue détail formateur
  if (selectedFormateur) {
    const group = formateurGroups[selectedFormateur];
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <button onClick={() => setSelectedFormateur(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>
        <div>
          <h2 className="text-2xl font-display font-bold">{group.formateur.first_name} {group.formateur.last_name}</h2>
          <p className="text-muted-foreground text-sm mt-1">{group.signatures.length} signature(s)</p>
        </div>
        <Card className="bg-card/60 border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="pb-3 px-4 pt-4">Formation</th>
                <th className="pb-3 px-4 pt-4">Date</th>
                <th className="pb-3 px-4 pt-4">Période</th>
                <th className="pb-3 px-4 pt-4">Signé le</th>
              </tr>
            </thead>
            <tbody>
              {group.signatures.map((e: any) => (
                <tr key={e.id} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="py-3 px-4">
                    <div>{e.formation?.title}</div>
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary mt-0.5">{e.formation?.type}</Badge>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{formatDate(e.date)}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className={e.periode === "matin" ? "border-blue-500/30 text-blue-400" : "border-orange-500/30 text-orange-400"}>
                      {e.periode === "matin" ? "Matin" : "Après-midi"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />{e.signe_le ? formatDateTime(e.signe_le) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    );
  }

  // Vue détail stagiaire
  if (selectedStagiaire) {
    const group = stagiaireGroups[selectedStagiaire];
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <button onClick={() => setSelectedStagiaire(null)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" /> Retour
        </button>
        <div>
          <h2 className="text-2xl font-display font-bold">{group.stagiaire.first_name} {group.stagiaire.last_name}</h2>
          <p className="text-muted-foreground text-sm mt-1">{group.signatures.length} signature(s)</p>
        </div>
        <Card className="bg-card/60 border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="pb-3 px-4 pt-4">Formation</th>
                <th className="pb-3 px-4 pt-4">Date</th>
                <th className="pb-3 px-4 pt-4">Période</th>
                <th className="pb-3 px-4 pt-4">Signé le</th>
              </tr>
            </thead>
            <tbody>
              {group.signatures.map((e: any) => (
                <tr key={e.id} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="py-3 px-4">
                    <div>{e.formation?.title}</div>
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary mt-0.5">{e.formation?.type}</Badge>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{formatDate(e.date)}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className={e.periode === "matin" ? "border-blue-500/30 text-blue-400" : "border-orange-500/30 text-orange-400"}>
                      {e.periode === "matin" ? "Matin" : "Après-midi"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />{e.signe_le ? formatDateTime(e.signe_le) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-glow flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-primary" /> Audit & Émargements
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Traçabilité des signatures — formateurs et stagiaires</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <Card className="px-4 py-2 bg-blue-500/10 border-blue-500/30 text-center">
            <p className="text-lg font-bold text-blue-400">{emargFormateurs.length}</p>
            <p className="text-[10px] text-muted-foreground">Émarg. formateurs</p>
          </Card>
          <Card className="px-4 py-2 bg-emerald-500/10 border-emerald-500/30 text-center">
            <p className="text-lg font-bold text-emerald-400">{emargStagiaires.length}</p>
            <p className="text-[10px] text-muted-foreground">Émarg. stagiaires</p>
          </Card>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
        <TabsList>
          <TabsTrigger value="formateurs" className="flex items-center gap-2">
            <UserCheck className="h-3.5 w-3.5" /> Formateurs ({Object.keys(formateurGroups).length})
          </TabsTrigger>
          <TabsTrigger value="stagiaires" className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5" /> Stagiaires ({Object.keys(stagiaireGroups).length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "formateurs" && (
        <Card className="bg-card/60 border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="pb-3 px-4 pt-4">Formateur</th>
                <th className="pb-3 px-4 pt-4">Signatures</th>
                <th className="pb-3 px-4 pt-4">Dernière signature</th>
                <th className="pb-3 px-4 pt-4"></th>
              </tr>
            </thead>
            <tbody>
              {filteredFormateurs.length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">Aucun émargement</td></tr>
              )}
              {filteredFormateurs.map((g: any) => (
                <tr key={g.formateur.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedFormateur(g.formateur.id)}>
                  <td className="py-3 px-4 font-medium">{g.formateur.first_name} {g.formateur.last_name}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="border-blue-500/30 text-blue-400">{g.signatures.length} signature(s)</Badge>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {g.signatures[0]?.signe_le ? formatDateTime(g.signatures[0].signe_le) : "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-xs text-primary hover:underline">Voir →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "stagiaires" && (
        <Card className="bg-card/60 border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="pb-3 px-4 pt-4">Stagiaire</th>
                <th className="pb-3 px-4 pt-4">Signatures</th>
                <th className="pb-3 px-4 pt-4">Dernière signature</th>
                <th className="pb-3 px-4 pt-4"></th>
              </tr>
            </thead>
            <tbody>
              {filteredStagiaires.length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">Aucun émargement</td></tr>
              )}
              {filteredStagiaires.map((g: any) => (
                <tr key={g.stagiaire.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedStagiaire(g.stagiaire.id)}>
                  <td className="py-3 px-4 font-medium">{g.stagiaire.first_name} {g.stagiaire.last_name}</td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">{g.signatures.length} signature(s)</Badge>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {g.signatures[0]?.signe_le ? formatDateTime(g.signatures[0].signe_le) : "—"}
                  </td>
                  <td className="py-3 px-4 text-right text-xs text-primary hover:underline">Voir →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
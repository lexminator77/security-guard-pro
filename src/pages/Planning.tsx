import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ChevronLeft, ChevronRight, CalendarDays, Rows, Download, MapPin, Smartphone,
} from "lucide-react";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay,
  isSameMonth, isWithinInterval, parseISO, startOfMonth, startOfWeek, differenceInCalendarDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { buildIcs, downloadIcs } from "@/lib/ics";

type Formation = {
  id: string;
  title: string;
  type: string;
  start_date: string;
  end_date: string;
  location: string | null;
  description: string | null;
  status: string;
};

const TYPE_COLORS: Record<string, string> = {
  SSIAP1: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  SSIAP2: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  SSIAP3: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  CQP_APS: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  TFP_APS: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  MAC: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  SST: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  AUTRE: "bg-muted text-muted-foreground border-border",
};

export default function Planning() {
  const [formations, setFormations] = useState<Formation[]>([]);
  const [cursor, setCursor] = useState(new Date());
  const [view, setView] = useState<"calendar" | "timeline">("calendar");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("formations")
        .select("id,title,type,start_date,end_date,location,description,status")
        .order("start_date", { ascending: true });
      if (error) toast.error(error.message);
      else setFormations((data as Formation[]) ?? []);
    })();
  }, []);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd]
  );

  const formationsOnDay = (day: Date) =>
    formations.filter((f) =>
      isWithinInterval(day, {
        start: parseISO(f.start_date),
        end: parseISO(f.end_date),
      })
    );

  const monthFormations = useMemo(
    () =>
      formations.filter((f) => {
        const s = parseISO(f.start_date);
        const e = parseISO(f.end_date);
        return s <= monthEnd && e >= monthStart;
      }),
    [formations, monthStart, monthEnd]
  );

  const exportOne = (f: Formation) => {
    const start = parseISO(f.start_date);
    start.setHours(9, 0, 0, 0);
    const end = parseISO(f.end_date);
    end.setHours(17, 0, 0, 0);
    const ics = buildIcs([
      {
        uid: f.id,
        title: `[${f.type}] ${f.title}`,
        description: f.description ?? "",
        location: f.location ?? "",
        start,
        end,
        alarmMinutesBefore: 60,
      },
    ]);
    downloadIcs(`${f.title.replace(/\s+/g, "_")}.ics`, ics);
    toast.success("Fichier téléchargé — ouvre-le sur ton tel pour l'ajouter à ton agenda");
  };

  const exportAll = () => {
    if (!formations.length) return toast.info("Aucune session à exporter");
    const ics = buildIcs(
      formations.map((f) => {
        const start = parseISO(f.start_date);
        start.setHours(9, 0, 0, 0);
        const end = parseISO(f.end_date);
        end.setHours(17, 0, 0, 0);
        return {
          uid: f.id,
          title: `[${f.type}] ${f.title}`,
          description: f.description ?? "",
          location: f.location ?? "",
          start,
          end,
          alarmMinutesBefore: 60,
        };
      })
    );
    downloadIcs(`planning_securecrm.ics`, ics);
    toast.success("Planning complet exporté");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Planning</h1>
          <p className="text-sm text-muted-foreground">
            Vue d'ensemble des sessions de formation. Synchronise sur ton téléphone via .ics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportAll}>
            <Download className="h-4 w-4 mr-2" />
            Exporter tout (.ics)
          </Button>
        </div>
      </div>

      <Card className="p-3 bg-primary/5 border-primary/20 flex items-start gap-3">
        <Smartphone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <strong className="text-foreground">Alertes téléphone :</strong>{" "}
          <span className="text-muted-foreground">
            Clique sur <Download className="inline h-3 w-3" /> à côté d'une session pour télécharger
            un fichier .ics. Ouvre-le depuis ton tel — Google Agenda / Apple Calendrier l'ajoutera
            automatiquement avec un rappel 1 h avant.
          </span>
        </div>
      </Card>

      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <div className="flex items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="calendar"><CalendarDays className="h-4 w-4 mr-2" />Calendrier</TabsTrigger>
            <TabsTrigger value="timeline"><Rows className="h-4 w-4 mr-2" />Timeline</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => setCursor(addMonths(cursor, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-display font-semibold capitalize min-w-[160px] text-center">
              {format(cursor, "MMMM yyyy", { locale: fr })}
            </div>
            <Button size="icon" variant="outline" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCursor(new Date())}>
              Aujourd'hui
            </Button>
          </div>
        </div>

        <TabsContent value="calendar" className="mt-4">
          <Card className="p-3 overflow-hidden">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                <div key={d} className="text-xs uppercase tracking-wider text-muted-foreground text-center py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const inMonth = isSameMonth(day, cursor);
                const today = isSameDay(day, new Date());
                const items = formationsOnDay(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[110px] rounded-md border p-1.5 flex flex-col gap-1 transition-colors ${
                      inMonth ? "bg-card border-border" : "bg-muted/20 border-transparent text-muted-foreground"
                    } ${today ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className="text-xs font-medium">{format(day, "d")}</div>
                    <div className="flex flex-col gap-1">
                      {items.slice(0, 3).map((f) => (
                        <button
                          key={f.id}
                          onClick={() => exportOne(f)}
                          title={`${f.title} — cliquer pour télécharger .ics`}
                          className={`text-[10px] truncate text-left rounded px-1.5 py-0.5 border ${
                            TYPE_COLORS[f.type] ?? TYPE_COLORS.AUTRE
                          } hover:opacity-80`}
                        >
                          {f.title}
                        </button>
                      ))}
                      {items.length > 3 && (
                        <div className="text-[10px] text-muted-foreground">+{items.length - 3} autres</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card className="p-4">
            {monthFormations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Aucune session ce mois-ci
              </div>
            ) : (
              <div className="space-y-3">
                {monthFormations.map((f) => {
                  const s = parseISO(f.start_date);
                  const e = parseISO(f.end_date);
                  const days = differenceInCalendarDays(e, s) + 1;
                  return (
                    <div key={f.id} className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                      <div className="w-32 shrink-0">
                        <div className="text-xs text-muted-foreground uppercase">
                          {format(s, "dd MMM", { locale: fr })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          → {format(e, "dd MMM", { locale: fr })}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={TYPE_COLORS[f.type] ?? TYPE_COLORS.AUTRE}>
                            {f.type}
                          </Badge>
                          <div className="font-medium truncate">{f.title}</div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{days} jour{days > 1 ? "s" : ""}</span>
                          {f.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {f.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => exportOne(f)}>
                        <Download className="h-4 w-4 mr-2" />
                        .ics
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

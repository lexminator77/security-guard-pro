// @ts-nocheck
import { useState, useEffect } from "react";
import {
  format, addDays, startOfWeek, isSameDay, parseISO, isBefore,
} from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, ChevronRight as ArrowR, Tablet, Sparkles,
  SlidersHorizontal, Users, MapPin, Clock, Shield, AlertTriangle, Send,
  Maximize2, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────

interface Formation {
  id: string;
  title: string;
  type: string;
  start_date: string;
  end_date: string;
  location: string | null;
  prix_ht: number | null;
  duration_hours: number | null;
}

interface Participant {
  formation_id: string;
  stagiaire_id: string;
  stagiaire: { id: string; first_name: string; last_name: string } | null;
}

interface Emargement {
  formation_id: string;
  stagiaire_id: string;
  periode: "matin" | "apres_midi";
  signe_le: string | null;
}

// ─── DayStrip ─────────────────────────────────────────────────────────────

function DayStrip({
  selectedDate,
  onSelect,
  weekSessionCounts,
}: {
  selectedDate: Date;
  onSelect: (d: Date) => void;
  weekSessionCounts: Record<string, number>;
}) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { date: d, count: weekSessionCounts[format(d, "yyyy-MM-dd")] ?? 0 };
  });

  return (
    <div className="grid grid-cols-7 gap-2 col-span-2">
      {days.map(({ date, count }) => {
        const isSelected = isSameDay(date, selectedDate);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        return (
          <button
            key={date.toISOString()}
            onClick={() => onSelect(date)}
            className={cn(
              "flex flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-all",
              "hover:border-border/80 hover:bg-card/80",
              isSelected ? "border-primary/40 bg-primary/10" : "border-border bg-card",
              isWeekend && !isSelected && "opacity-50",
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {format(date, "EEE", { locale: fr })}
            </span>
            <span className={cn(
              "font-mono text-xl font-bold tracking-tight leading-none",
              isSelected ? "text-primary" : "text-foreground",
            )}>
              {format(date, "dd")}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn(
                "h-[5px] w-[5px] rounded-full",
                isSelected ? "bg-primary" : "bg-muted-foreground/40",
              )} />
              {count > 0 ? `${count} session${count > 1 ? "s" : ""}` : "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────

type EventState = "past" | "live" | "future" | "soft";

interface TimelineEvent {
  time: string;
  sub?: string;
  state: EventState;
  title: string;
  tag?: string;
  meta?: { icon: any; text: string }[];
  details?: { st: "done" | "todo" | "warn"; text: string }[];
  formation_id?: string;
  actions?: { label: string; icon?: any; primary?: boolean; onClick?: () => void }[];
}

function Timeline({ events, selectedDate }: { events: TimelineEvent[]; selectedDate: Date }) {
  const now = new Date();
  const isToday = isSameDay(selectedDate, now);
  const dayStartH = 8.5;
  const dayEndH = 21.0;
  const currentH = now.getHours() + now.getMinutes() / 60;
  const progress = isToday
    ? Math.min(100, Math.max(0, ((currentH - dayStartH) / (dayEndH - dayStartH)) * 100))
    : isBefore(selectedDate, now) ? 100 : 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <h2 className="text-[15px] font-semibold tracking-tight">Déroulé de la journée</h2>
        <div className="flex flex-1 max-w-[280px] mx-5 items-center gap-2.5">
          <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
            {isToday ? format(now, "HH:mm") : "—"}
          </span>
          <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 shadow-[0_0_10px_hsl(var(--primary)/0.4)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">21:00</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="relative px-5 py-4">
        <div className="absolute left-[89px] top-4 bottom-4 w-px bg-border" />
        <div className="flex flex-col">
          {events.map((ev, i) => (
            <TimelineEventRow key={i} event={ev} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineEventRow({ event: ev }: { event: TimelineEvent }) {
  const isLive = ev.state === "live";
  const isPast = ev.state === "past";
  const isSoft = ev.state === "soft";

  return (
    <div className="grid items-start py-2" style={{ gridTemplateColumns: "68px 1fr" }}>
      <div className={cn(
        "pt-3.5 pr-3 text-right font-mono text-[13px] leading-none",
        isLive ? "font-semibold text-primary" : "text-muted-foreground",
      )}>
        {ev.time}
        {ev.sub && <span className="mt-1 block text-[10px] text-muted-foreground/60">{ev.sub}</span>}
      </div>

      <div className="relative pl-[22px]">
        <div className="absolute -left-[5px] top-3.5">
          {isLive ? (
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.2)]" />
            </span>
          ) : (
            <span className={cn(
              "flex h-2.5 w-2.5 rounded-full border-2",
              isSoft ? "border-dashed border-border/70 bg-card" : "border-border bg-card",
            )} />
          )}
        </div>

        <div className={cn(
          "rounded-xl border px-3.5 py-3 transition-all hover:-translate-y-px",
          isSoft ? "border-dashed border-border/60 bg-transparent py-2"
            : isLive ? "border-primary/30 bg-primary/8 shadow-[0_0_0_1px_hsl(var(--primary)/0.15),0_8px_24px_-12px_hsl(var(--primary)/0.3)]"
            : "border-border bg-secondary/50",
          isPast && "opacity-55",
        )}>
          <div className="flex items-center gap-2.5">
            <span className={cn(
              "text-[14px] font-semibold tracking-tight",
              isPast && "line-through decoration-muted-foreground/50",
              isSoft && "text-[13px] font-medium text-muted-foreground",
            )}>
              {ev.title}
            </span>
            {ev.tag && (
              isLive
                ? <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/90" />{ev.tag}
                  </span>
                : <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {ev.tag}
                  </span>
            )}
          </div>

          {ev.meta && ev.meta.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
              {ev.meta.map((m, j) => (
                <span key={j} className="inline-flex items-center gap-1.5">
                  <m.icon className="h-3 w-3 opacity-70" />{m.text}
                </span>
              ))}
            </div>
          )}

          {ev.details && ev.details.length > 0 && (
            <div className="mt-2.5 border-t border-dashed border-border/60 pt-2.5 flex flex-col gap-1.5">
              {ev.details.map((d, j) => (
                <div key={j} className={cn(
                  "flex items-center gap-2 text-[12px]",
                  d.st === "done" ? "text-foreground" : "text-muted-foreground",
                )}>
                  <span className={cn(
                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                    d.st === "done" && "bg-success/20 text-success",
                    d.st === "warn" && "bg-warning/20 text-warning",
                    d.st === "todo" && "border border-border",
                  )}>
                    {d.st === "done" && "✓"}{d.st === "warn" && "!"}
                  </span>
                  {d.text}
                </div>
              ))}
            </div>
          )}

          {ev.actions && ev.actions.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {ev.actions.map((a, j) => (
                <Button key={j} size="sm" variant={a.primary ? "default" : "outline"} className="h-7 gap-1.5 px-2.5 text-[12px]" onClick={a.onClick}>
                  {a.icon && <a.icon className="h-3 w-3" />}{a.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Rail ─────────────────────────────────────────────────────────────────

function SigCurve({ variant = 0 }: { variant?: number }) {
  const paths = [
    "M2 8 Q5 2 8 6 T14 7 T22 5 T28 8",
    "M2 7 Q6 3 10 6 T18 6 T26 7 T30 5",
    "M2 8 Q4 4 7 7 T13 6 T20 8 T28 6",
    "M2 6 Q5 9 8 5 T15 7 T23 5 T28 7",
  ];
  return (
    <svg viewBox="0 0 30 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
      className="h-3 w-[30px] text-success opacity-90">
      <path d={paths[variant % paths.length]} />
    </svg>
  );
}

function TabletPanel({
  formation,
  roster,
  dateStr,
}: {
  formation: Formation | null;
  roster: { name: string; state: "signed" | "pending"; v: number }[];
  dateStr: string;
}) {
  const signed = roster.filter((p) => p.state === "signed").length;
  const total = roster.length;

  if (!formation) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
        Aucune session active aujourd'hui
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Tablet className="h-[15px] w-[15px] text-primary" />
        <h3 className="text-[13px] font-semibold tracking-tight">Mode salle · émargement</h3>
        {signed > 0 && (
          <span className="ml-auto rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
            EN COURS
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="rounded-xl border border-border bg-background p-3 font-mono text-[12px]">
          <div className="mb-2.5 flex justify-between text-muted-foreground">
            <span className="truncate mr-2">{formation.title} · Matin {dateStr}</span>
            <span className={cn(
              "flex items-center gap-1.5 font-semibold whitespace-nowrap",
              signed === total ? "text-success" : "text-primary",
            )}>
              {signed > 0 && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
              {signed}/{total} signés
            </span>
          </div>

          {roster.length === 0 ? (
            <p className="py-2 text-center text-muted-foreground text-[11px]">Aucun stagiaire inscrit</p>
          ) : (
            <div className="flex flex-col">
              {roster.map((p, i) => (
                <div key={i} className="grid items-center grid-cols-[1fr_auto] border-b border-dashed border-border/40 py-1.5 last:border-0">
                  <span className="text-foreground truncate">{p.name}</span>
                  <span className="font-sans">
                    {p.state === "signed" && <SigCurve variant={p.v} />}
                    {p.state === "pending" && <span className="text-[11px] text-muted-foreground/50">—</span>}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2.5 flex justify-between text-[11px] text-muted-foreground">
            <span>Prochaine signature : <b className="text-primary">13:30</b></span>
            <span>{total - signed} en attente</span>
          </div>
        </div>
        <Button size="sm" className="mt-3 w-full justify-center gap-1.5">
          <Maximize2 className="h-3 w-3" />
          Ouvrir sur tablette
        </Button>
      </div>
    </div>
  );
}

function IAPanel({ absents }: { absents: string[] }) {
  const suggestions = [
    ...(absents.length > 0 ? [{
      tag: "ABSENCE",
      icon: AlertTriangle,
      text: <><b>{absents.length} stagiaire{absents.length > 1 ? "s" : ""}</b> n'ont pas encore signé : {absents.slice(0, 2).join(", ")}{absents.length > 2 ? `… +${absents.length - 2}` : ""}.</>,
      actions: [{ label: "Relancer par mail", primary: true }, { label: "Plus tard" }],
    }] : []),
    {
      tag: "CONFORMITÉ",
      icon: Shield,
      text: <><b>Cartes CNAPS</b> — vérifiez les expirations à venir pour les prochaines sessions.</>,
      actions: [{ label: "Voir les cartes", primary: true }],
    },
    {
      tag: "FACTURATION",
      icon: Send,
      text: <>Pensez à générer les <b>attestations de formation</b> et factures en fin de journée.</>,
      actions: [{ label: "Clôturer la journée", primary: true }],
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Sparkles className="h-[15px] w-[15px] text-primary" />
        <h3 className="text-[13px] font-semibold tracking-tight">Rappels & Suggestions</h3>
        <span className="ml-auto rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {suggestions.length} suggestions
        </span>
      </div>
      <div className="flex flex-col gap-2 p-4">
        {suggestions.map((s, i) => (
          <div key={i} className="rounded-xl border border-border bg-secondary/50 p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <s.icon className="h-3 w-3" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                {s.tag}
              </span>
            </div>
            <p className="text-[13px] leading-[1.45] text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground">
              {s.text}
            </p>
            <div className="mt-2.5 flex gap-1.5">
              {s.actions.map((a, j) => (
                <button key={j} className={cn(
                  "inline-flex items-center gap-1 text-[12px] font-semibold",
                  a.primary ? "text-primary" : "font-medium text-muted-foreground/60",
                )}>
                  {a.primary && <ArrowR className="h-3 w-3" />}{a.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GaugesPanel({ gauges }: {
  gauges: { label: string; val: number; detail: string; state?: "ok" | "warn" | "" }[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <SlidersHorizontal className="h-[15px] w-[15px] text-primary" />
        <h3 className="text-[13px] font-semibold tracking-tight">Jauges du jour</h3>
        <span className="ml-auto rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          temps réel
        </span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        {gauges.map((g, i) => (
          <div key={i}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[13px] font-medium">{g.label}</span>
              <span className="font-mono text-[12px] text-muted-foreground">{g.detail}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  g.state === "ok" ? "bg-success" : g.state === "warn" ? "bg-warning" : "bg-primary",
                )}
                style={{ width: `${g.val}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Timeline builder ─────────────────────────────────────────────────────

function buildTimelineEvents(
  formations: Formation[],
  participantCounts: Record<string, number>,
  emargements: Emargement[],
  selectedDate: Date,
  navigate: (path: string) => void,
): TimelineEvent[] {
  const now = new Date();
  const isToday = isSameDay(selectedDate, now);
  const isPast = isBefore(selectedDate, now) && !isToday;

  if (formations.length === 0) {
    return [{ time: "—", state: "soft", title: "Aucune session prévue pour cette journée" }];
  }

  const events: TimelineEvent[] = [];

  const prepState: EventState = isPast || (isToday && now.getHours() >= 9) ? "past" : "future";
  events.push({
    time: "08:30", sub: "30 min", state: prepState,
    title: "Préparation salle",
    meta: [{ icon: MapPin, text: "Vérification équipements" }],
  });

  const defaultTimes = ["09:00", "14:00", "17:00"];
  const defaultDurations = ["7h", "3h", "4h"];

  formations.forEach((f, i) => {
    const time = defaultTimes[i] ?? "09:00";
    const sub = defaultDurations[i] ?? "4h";
    const startHour = parseInt(time.split(":")[0]);
    const count = participantCounts[f.id] ?? 0;
    const signedMatin = emargements.filter(e => e.formation_id === f.id && e.periode === "matin" && e.signe_le).length;
    const signedAM = emargements.filter(e => e.formation_id === f.id && e.periode === "apres_midi" && e.signe_le).length;

    let state: EventState;
    if (isPast) state = "past";
    else if (isToday) {
      const h = now.getHours();
      if (h >= startHour && h < startHour + 5) state = "live";
      else if (h >= startHour + 5) state = "past";
      else state = "future";
    } else state = "future";

    const start = parseISO(f.start_date);
    const end = parseISO(f.end_date);
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const dayNum = Math.round((selectedDate.getTime() - start.getTime()) / 86400000) + 1;
    const dayTag = totalDays > 1 ? ` · J${dayNum}/${totalDays}` : "";

    const meta: TimelineEvent["meta"] = [];
    if (count > 0) meta.push({ icon: Users, text: `${count} stagiaire${count > 1 ? "s" : ""}` });
    if (f.location) meta.push({ icon: MapPin, text: f.location });
    if (state === "live") meta.push({ icon: Clock, text: "En cours" });

    const details: TimelineEvent["details"] = state === "live" ? [
      { st: signedMatin === count && count > 0 ? "done" : signedMatin > 0 ? "warn" : "todo",
        text: `Matin signé — ${signedMatin}/${count}${count > 0 && signedMatin < count ? ` ⚠ ${count - signedMatin} en attente` : ""}` },
      { st: signedAM === count && count > 0 ? "done" : "todo",
        text: `Après-midi à signer à 13:30 — ${signedAM}/${count}` },
    ] : undefined;

    events.push({
      time, sub, state,
      title: `${f.title}${dayTag}`,
      tag: state === "live" ? "EN COURS" : undefined,
      formation_id: f.id,
      meta, details,
      actions: state === "live"
        ? [
            { label: "Ouvrir l'émargement", icon: Tablet, primary: true, onClick: () => navigate("/formations") },
            { label: "Voir la session", onClick: () => navigate("/formations") },
          ]
        : state === "future"
        ? [
            { label: "Préparer l'émargement", onClick: () => navigate("/formations") },
            { label: "Modifier", onClick: () => navigate("/formations") },
          ]
        : undefined,
    });

    if (i === 0 && formations.length > 1) {
      const lunchState: EventState = isPast || (isToday && now.getHours() >= 14) ? "past" : "soft";
      events.push({ time: "12:30", sub: "1h", state: lunchState, title: "Pause déjeuner" });
    }
  });

  events.push({
    time: "21:00", state: isPast ? "past" : "future",
    title: "Clôturer la journée", tag: "AUTO",
    meta: [{ icon: Sparkles, text: "Génère attestations + factures" }],
    actions: [{ label: "Lancer l'auto-clôture", icon: Sparkles, primary: true, onClick: () => navigate("/formations") }],
  });

  return events;
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function Aujourd_hui() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [formations, setFormations] = useState<Formation[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [emargements, setEmargements] = useState<Emargement[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({});
  const [weekSessionCounts, setWeekSessionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "Aujourd'hui — SecureCRM"; }, []);

  useEffect(() => { loadDay(selectedDate); }, [selectedDate]);

  useEffect(() => {
    loadWeek(startOfWeek(selectedDate, { weekStartsOn: 1 }));
  }, [selectedDate]);

  async function loadDay(date: Date) {
    setLoading(true);
    const dateStr = format(date, "yyyy-MM-dd");

    const { data: forms } = await supabase
      .from("formations")
      .select("id, title, type, start_date, end_date, location, prix_ht, duration_hours")
      .lte("start_date", dateStr)
      .gte("end_date", dateStr)
      .order("start_date");

    const list: Formation[] = forms ?? [];

    if (list.length > 0) {
      const ids = list.map(f => f.id);

      const [{ data: parts }, { data: emargs }] = await Promise.all([
        supabase
          .from("formation_participants")
          .select("formation_id, stagiaire_id, stagiaire:stagiaires(id, first_name, last_name)")
          .in("formation_id", ids),
        supabase
          .from("emargements_stagiaire")
          .select("formation_id, stagiaire_id, periode, signe_le")
          .in("formation_id", ids)
          .eq("date", dateStr),
      ]);

      const allParts: Participant[] = parts ?? [];
      const counts: Record<string, number> = {};
      allParts.forEach(p => { counts[p.formation_id] = (counts[p.formation_id] ?? 0) + 1; });

      setParticipants(allParts);
      setParticipantCounts(counts);
      setEmargements(emargs ?? []);
    } else {
      setParticipants([]);
      setParticipantCounts({});
      setEmargements([]);
    }

    setFormations(list);
    setLoading(false);
  }

  async function loadWeek(weekStart: Date) {
    const weekEnd = addDays(weekStart, 6);
    const { data } = await supabase
      .from("formations")
      .select("start_date, end_date")
      .lte("start_date", format(weekEnd, "yyyy-MM-dd"))
      .gte("end_date", format(weekStart, "yyyy-MM-dd"));

    const counts: Record<string, number> = {};
    if (data) {
      Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).forEach(day => {
        const s = format(day, "yyyy-MM-dd");
        counts[s] = data.filter(f => f.start_date <= s && f.end_date >= s).length;
      });
    }
    setWeekSessionCounts(counts);
  }

  // Derived values
  const totalStagiaires = Object.values(participantCounts).reduce((a, b) => a + b, 0);
  const caPrevu = formations.reduce((s, f) => s + (f.prix_ht ?? 0), 0);
  const totalSignes = emargements.filter(e => e.signe_le).length;
  const isToday = isSameDay(selectedDate, new Date());
  const dateLabel = format(selectedDate, "EEEE d MMMM", { locale: fr });
  const dateStr = format(selectedDate, "dd/MM");

  // Active formation (first live or first of the day)
  const now = new Date();
  const activeFormation = (() => {
    if (!isToday) return formations[0] ?? null;
    for (const f of formations) {
      // Use same logic as timeline: first that started before now
      return f;
    }
    return null;
  })();

  // Real roster for the active formation
  const activeParticipants = activeFormation
    ? participants.filter(p => p.formation_id === activeFormation.id)
    : [];

  const roster = activeParticipants.map((p, i) => {
    const hasSigned = emargements.some(
      e => e.stagiaire_id === p.stagiaire_id &&
           e.formation_id === p.formation_id &&
           e.periode === "matin" &&
           e.signe_le,
    );
    const s = p.stagiaire;
    const name = s ? `${s.last_name.toUpperCase()}, ${s.first_name}` : `Stagiaire #${i + 1}`;
    return { name, state: hasSigned ? "signed" as const : "pending" as const, v: i % 4 };
  });

  // Absent list for IA panel (not signed yet)
  const absents = roster
    .filter(r => r.state === "pending")
    .map(r => r.name.split(",")[0]);

  // Gauges — all dynamic
  const expectedEmargements = totalStagiaires * 2; // matin + apres_midi
  const gauges = [
    {
      label: "Présences",
      val: totalStagiaires > 0 ? Math.round((roster.filter(r => r.state === "signed").length / Math.max(roster.length, 1)) * 100) : 0,
      detail: `${roster.filter(r => r.state === "signed").length} / ${roster.length} stag.`,
      state: roster.filter(r => r.state === "signed").length === roster.length && roster.length > 0 ? "ok" : "" as const,
    },
    {
      label: "Émargements signés",
      val: expectedEmargements > 0 ? Math.round((totalSignes / expectedEmargements) * 100) : 0,
      detail: `${totalSignes} / ${expectedEmargements} attendus`,
      state: "" as const,
    },
    {
      label: "Sessions du jour",
      val: formations.length > 0 ? 100 : 0,
      detail: `${formations.length} session${formations.length !== 1 ? "s" : ""} planifiée${formations.length !== 1 ? "s" : ""}`,
      state: "ok" as const,
    },
    {
      label: "CA prévu du jour",
      val: caPrevu > 0 ? Math.min(100, Math.round((caPrevu / 10000) * 100)) : 0,
      detail: caPrevu > 0 ? `${caPrevu.toLocaleString("fr-FR")} €` : "—",
      state: caPrevu >= 5000 ? "ok" : caPrevu > 0 ? "warn" : "" as const,
    },
  ];

  const timelineEvents = buildTimelineEvents(formations, participantCounts, emargements, selectedDate, navigate);

  return (
    <div className="space-y-5 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold tracking-tight leading-none">
            Aujourd'hui{" "}
            <span className="text-primary font-extrabold">{dateLabel}</span>
          </h1>
          <p className="mt-2 text-[14px] text-muted-foreground">
            <b className="text-foreground font-medium">{formations.length} session{formations.length !== 1 ? "s" : ""}</b>
            {" · "}
            <b className="text-foreground font-medium">{totalStagiaires} stagiaire{totalStagiaires !== 1 ? "s" : ""}</b>
            {totalSignes > 0 && <>{" · "}<b className="text-foreground font-medium">{totalSignes} émargement{totalSignes !== 1 ? "s" : ""} signé{totalSignes !== 1 ? "s" : ""}</b></>}
            {caPrevu > 0 && <>{" · "}<b className="text-foreground font-medium">CA prévu : {caPrevu.toLocaleString("fr-FR")} €</b></>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSelectedDate(d => addDays(d, -1))}>
            <ChevronLeft className="h-3.5 w-3.5" />Hier
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSelectedDate(d => addDays(d, 1))}>
            Demain<ChevronRight className="h-3.5 w-3.5" />
          </Button>
          {!isToday && (
            <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())} className="text-primary border-primary/30">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />Aujourd'hui
            </Button>
          )}
          <Button size="sm" className="gap-1.5">
            <Tablet className="h-3.5 w-3.5" />Mode salle
          </Button>
        </div>
      </div>

      {/* DayStrip */}
      <DayStrip selectedDate={selectedDate} onSelect={setSelectedDate} weekSessionCounts={weekSessionCounts} />

      {/* Two-column layout */}
      <div className="grid grid-cols-[1fr_300px] gap-5 xl:grid-cols-[1fr_320px]">
        {loading ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm animate-pulse">
            Chargement des sessions…
          </div>
        ) : (
          <Timeline events={timelineEvents} selectedDate={selectedDate} />
        )}

        <aside className="flex flex-col gap-4">
          <TabletPanel formation={activeFormation} roster={roster} dateStr={dateStr} />
          <IAPanel absents={absents} />
          <GaugesPanel gauges={gauges} />
        </aside>
      </div>
    </div>
  );
}

export type FiltreDateValue =
  | { type: "preset"; preset: "toutes" | "aujourd_hui" | "semaine" | "mois" }
  | { type: "range"; from: string; to: string }

export function appliquerFiltreDateRange(
  dateStr: string | null | undefined,
  filtre: FiltreDateValue
): boolean {
  if (filtre.type === "preset") {
    if (filtre.preset === "toutes") return true
    if (!dateStr) return false
    const date = new Date(dateStr)
    const now = new Date()
    if (filtre.preset === "aujourd_hui") return date.toDateString() === now.toDateString()
    if (filtre.preset === "semaine") {
      const s = new Date(now); s.setDate(s.getDate() - 7); return date >= s
    }
    if (filtre.preset === "mois") {
      const m = new Date(now); m.setMonth(m.getMonth() - 1); return date >= m
    }
  }
  if (filtre.type === "range") {
    if (!dateStr) return false
    const date = new Date(dateStr)
    if (filtre.from && date < new Date(filtre.from)) return false
    if (filtre.to && date > new Date(filtre.to + "T23:59:59")) return false
    return true
  }
  return true
}

interface FiltreDateRangeProps {
  value: FiltreDateValue
  onChange: (v: FiltreDateValue) => void
}

const PRESETS = [
  { id: "toutes" as const, label: "Toutes les dates" },
  { id: "aujourd_hui" as const, label: "Aujourd'hui" },
  { id: "semaine" as const, label: "7 derniers jours" },
  { id: "mois" as const, label: "30 derniers jours" },
]

const BTN = "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
const ACTIVE = "bg-primary/20 text-primary"
const INACTIVE = "bg-muted/30 text-muted-foreground hover:bg-muted/50"
const INPUT = "bg-muted/30 border border-border/50 rounded-lg px-2 py-1.5 text-xs text-foreground [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-primary"

export function FiltreDateRange({ value, onChange }: FiltreDateRangeProps) {
  const rangeFrom = value.type === "range" ? value.from : ""
  const rangeTo = value.type === "range" ? value.to : ""
  const isRange = rangeFrom !== "" || rangeTo !== ""
  const activePreset = value.type === "preset" && !isRange ? value.preset : null

  return (
    <div className="flex flex-col gap-2">
      <div className={`flex gap-2 flex-wrap ${isRange ? "opacity-40 pointer-events-none" : ""}`}>
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => onChange({ type: "preset", preset: p.id })}
            className={`${BTN} ${activePreset === p.id ? ACTIVE : INACTIVE}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Du</span>
        <input
          type="date"
          value={rangeFrom}
          onChange={e => onChange({ type: "range", from: e.target.value, to: rangeTo })}
          className={INPUT}
        />
        <span className="text-xs text-muted-foreground">au</span>
        <input
          type="date"
          value={rangeTo}
          onChange={e => onChange({ type: "range", from: rangeFrom, to: e.target.value })}
          className={INPUT}
        />
        {isRange && (
          <button
            onClick={() => onChange({ type: "preset", preset: "toutes" })}
            className={`${BTN} ${INACTIVE}`}
          >
            ✕ Réinitialiser
          </button>
        )}
      </div>
    </div>
  )
}

import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { appliquerFiltreDateRange, FiltreDateRange, FiltreDateValue } from "../components/FiltreDateRange"

// ─── Tests de la fonction pure ────────────────────────────────────────────────

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

describe("appliquerFiltreDateRange — preset: toutes", () => {
  it("retourne true pour n'importe quelle date", () => {
    expect(appliquerFiltreDateRange("2020-01-01T00:00:00Z", { type: "preset", preset: "toutes" })).toBe(true)
  })
  it("retourne true même si dateStr est null", () => {
    expect(appliquerFiltreDateRange(null, { type: "preset", preset: "toutes" })).toBe(true)
  })
})

describe("appliquerFiltreDateRange — preset: aujourd_hui", () => {
  it("retourne true pour aujourd'hui", () => {
    expect(appliquerFiltreDateRange(new Date().toISOString(), { type: "preset", preset: "aujourd_hui" })).toBe(true)
  })
  it("retourne false pour hier", () => {
    expect(appliquerFiltreDateRange(daysAgo(1), { type: "preset", preset: "aujourd_hui" })).toBe(false)
  })
  it("retourne false si dateStr est null", () => {
    expect(appliquerFiltreDateRange(null, { type: "preset", preset: "aujourd_hui" })).toBe(false)
  })
})

describe("appliquerFiltreDateRange — preset: semaine", () => {
  it("retourne true pour une date il y a 3 jours", () => {
    expect(appliquerFiltreDateRange(daysAgo(3), { type: "preset", preset: "semaine" })).toBe(true)
  })
  it("retourne false pour une date il y a 8 jours", () => {
    expect(appliquerFiltreDateRange(daysAgo(8), { type: "preset", preset: "semaine" })).toBe(false)
  })
  it("retourne false si dateStr est null", () => {
    expect(appliquerFiltreDateRange(null, { type: "preset", preset: "semaine" })).toBe(false)
  })
})

describe("appliquerFiltreDateRange — preset: mois", () => {
  it("retourne true pour une date il y a 15 jours", () => {
    expect(appliquerFiltreDateRange(daysAgo(15), { type: "preset", preset: "mois" })).toBe(true)
  })
  it("retourne false pour une date il y a 31 jours", () => {
    expect(appliquerFiltreDateRange(daysAgo(31), { type: "preset", preset: "mois" })).toBe(false)
  })
})

describe("appliquerFiltreDateRange — range", () => {
  it("retourne true pour une date dans la plage", () => {
    expect(appliquerFiltreDateRange("2026-05-10T12:00:00Z", { type: "range", from: "2026-05-01", to: "2026-05-22" })).toBe(true)
  })
  it("retourne false pour une date avant from", () => {
    expect(appliquerFiltreDateRange("2026-04-30T12:00:00Z", { type: "range", from: "2026-05-01", to: "2026-05-22" })).toBe(false)
  })
  it("retourne false pour une date après to (même jour 23:59)", () => {
    expect(appliquerFiltreDateRange("2026-05-23T00:00:00Z", { type: "range", from: "2026-05-01", to: "2026-05-22" })).toBe(false)
  })
  it("retourne true quand seul 'from' est défini et la date est après", () => {
    expect(appliquerFiltreDateRange("2026-05-15T12:00:00Z", { type: "range", from: "2026-05-01", to: "" })).toBe(true)
  })
  it("retourne true quand seul 'to' est défini et la date est avant", () => {
    expect(appliquerFiltreDateRange("2026-05-10T12:00:00Z", { type: "range", from: "", to: "2026-05-22" })).toBe(true)
  })
  it("retourne false si dateStr est null avec une plage définie", () => {
    expect(appliquerFiltreDateRange(null, { type: "range", from: "2026-05-01", to: "2026-05-22" })).toBe(false)
  })
})

// ─── Tests du composant ───────────────────────────────────────────────────────

describe("FiltreDateRange — rendu", () => {
  it("affiche les 4 boutons preset", () => {
    render(<FiltreDateRange value={{ type: "preset", preset: "toutes" }} onChange={() => {}} />)
    expect(screen.getByText("Toutes les dates")).toBeInTheDocument()
    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument()
    expect(screen.getByText("7 derniers jours")).toBeInTheDocument()
    expect(screen.getByText("30 derniers jours")).toBeInTheDocument()
  })

  it("appelle onChange avec le bon preset au clic", () => {
    const onChange = vi.fn()
    render(<FiltreDateRange value={{ type: "preset", preset: "toutes" }} onChange={onChange} />)
    fireEvent.click(screen.getByText("Aujourd'hui"))
    expect(onChange).toHaveBeenCalledWith({ type: "preset", preset: "aujourd_hui" })
  })

  it("affiche le bouton Réinitialiser quand une plage est définie", () => {
    render(<FiltreDateRange value={{ type: "range", from: "2026-05-01", to: "2026-05-22" }} onChange={() => {}} />)
    expect(screen.getByText("✕ Réinitialiser")).toBeInTheDocument()
  })

  it("n'affiche pas Réinitialiser quand les champs sont vides", () => {
    render(<FiltreDateRange value={{ type: "range", from: "", to: "" }} onChange={() => {}} />)
    expect(screen.queryByText("✕ Réinitialiser")).not.toBeInTheDocument()
  })

  it("appelle onChange avec preset toutes au clic sur Réinitialiser", () => {
    const onChange = vi.fn()
    render(<FiltreDateRange value={{ type: "range", from: "2026-05-01", to: "2026-05-22" }} onChange={onChange} />)
    fireEvent.click(screen.getByText("✕ Réinitialiser"))
    expect(onChange).toHaveBeenCalledWith({ type: "preset", preset: "toutes" })
  })
})

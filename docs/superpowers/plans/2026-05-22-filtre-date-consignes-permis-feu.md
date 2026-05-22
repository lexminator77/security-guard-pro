# Filtre par date — Consignes & Permis de feu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un filtre date combiné (raccourcis prédéfinis + plage libre) sur les 4 vues Consignes et Permis de feu (Formateur et Stagiaire).

**Architecture:** Un composant réutilisable `FiltreDateRange` et une fonction pure `appliquerFiltreDateRange` sont créés dans `src/components/FiltreDateRange.tsx`. Les 4 composants dans `MainCourante.tsx` sont mis à jour pour l'utiliser — `ConsignesStagiaire` et `PermisFeuStagiaire` migrent depuis leurs boutons inline existants, `ConsignesFormateur` et `PermisFeuFormateur` reçoivent un filtre pour la première fois. Les Permis de feu filtrent sur `date_debut` (date des travaux), les Consignes filtrent sur `created_at`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v3, Vitest + Testing Library (jsdom)

---

## Fichiers concernés

| Action | Fichier | Rôle |
|--------|---------|------|
| Créer | `src/components/FiltreDateRange.tsx` | Composant + type `FiltreDateValue` + fonction `appliquerFiltreDateRange` |
| Créer | `src/test/FiltreDateRange.test.tsx` | Tests unitaires de la fonction et du composant |
| Modifier | `src/components/MainCourante.tsx` | 4 composants : `ConsignesFormateur`, `ConsignesStagiaire`, `PermisFeuFormateur`, `PermisFeuStagiaire` |

---

## Task 1 : Composant `FiltreDateRange` (TDD)

**Files:**
- Create: `src/components/FiltreDateRange.tsx`
- Create: `src/test/FiltreDateRange.test.tsx`

- [ ] **Étape 1 : Écrire les tests qui échouent**

Créer `src/test/FiltreDateRange.test.tsx` :

```tsx
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
```

- [ ] **Étape 2 : Vérifier que les tests échouent**

```bash
cd ~/security-guard-pro && npm test -- --reporter=verbose 2>&1 | tail -20
```

Résultat attendu : erreurs de type "Cannot find module '../components/FiltreDateRange'"

- [ ] **Étape 3 : Créer `src/components/FiltreDateRange.tsx`**

```tsx
import { useState } from "react"

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
```

- [ ] **Étape 4 : Vérifier que les tests passent**

```bash
cd ~/security-guard-pro && npm test -- --reporter=verbose 2>&1 | tail -30
```

Résultat attendu : tous les tests `FiltreDateRange` PASS.

- [ ] **Étape 5 : Commit**

```bash
cd ~/security-guard-pro && git add src/components/FiltreDateRange.tsx src/test/FiltreDateRange.test.tsx
git commit -m "feat: add FiltreDateRange component and appliquerFiltreDateRange utility"
```

---

## Task 2 : `ConsignesFormateur` — ajout du filtre

**Files:**
- Modify: `src/components/MainCourante.tsx` (composant `ConsignesFormateur`, lignes ~468–550)

- [ ] **Étape 1 : Ajouter l'import en tête de `MainCourante.tsx`**

Chercher le bloc d'imports existant en haut du fichier. Ajouter après le dernier import local :

```ts
import { FiltreDateRange, FiltreDateValue, appliquerFiltreDateRange } from "./FiltreDateRange";
```

- [ ] **Étape 2 : Ajouter le state dans `ConsignesFormateur`**

Localiser la déclaration du composant `ConsignesFormateur` (ligne ~468). Après `const [saving, setSaving] = useState(false);`, ajouter :

```ts
const [filtreDateRange, setFiltreDateRange] = useState<FiltreDateValue>({ type: "preset", preset: "toutes" });
```

- [ ] **Étape 3 : Ajouter la variable filtrée**

Juste avant le `return (` de `ConsignesFormateur`, ajouter :

```ts
const consignesFiltrees = consignes.filter(c =>
  appliquerFiltreDateRange(c.created_at, filtreDateRange)
);
```

- [ ] **Étape 4 : Ajouter `<FiltreDateRange>` dans le JSX**

Dans le JSX de `ConsignesFormateur`, après le bloc `{showForm && (...)}` et avant `{loading ? ...}`, ajouter :

```tsx
{!showForm && (
  <FiltreDateRange value={filtreDateRange} onChange={setFiltreDateRange} />
)}
```

- [ ] **Étape 5 : Utiliser `consignesFiltrees` dans le rendu**

Remplacer dans le JSX de `ConsignesFormateur` :

```tsx
: consignes.length === 0 ? <Card className="p-12 text-center border-dashed"><p className="text-muted-foreground text-sm">Aucune consigne créée</p></Card>
        : <div className="space-y-3">{consignes.map(c => (
```

par :

```tsx
: consignesFiltrees.length === 0 ? <Card className="p-12 text-center border-dashed"><p className="text-muted-foreground text-sm">{consignes.length === 0 ? "Aucune consigne créée" : "Aucune consigne sur cette période"}</p></Card>
        : <div className="space-y-3">{consignesFiltrees.map(c => (
```

- [ ] **Étape 6 : Vérifier que les tests passent toujours**

```bash
cd ~/security-guard-pro && npm test 2>&1 | tail -10
```

Résultat attendu : PASS (aucun test cassé).

- [ ] **Étape 7 : Commit**

```bash
cd ~/security-guard-pro && git add src/components/MainCourante.tsx
git commit -m "feat: add date filter to ConsignesFormateur"
```

---

## Task 3 : `ConsignesStagiaire` — migration vers `FiltreDateRange`

**Files:**
- Modify: `src/components/MainCourante.tsx` (composant `ConsignesStagiaire`, lignes ~552–613)

- [ ] **Étape 1 : Remplacer le state `filtrePeriode` par `filtreDateRange`**

Localiser dans `ConsignesStagiaire` (ligne ~556) :

```ts
const [filtrePeriode, setFiltrePeriode] = useState<"toutes" | "aujourd_hui" | "semaine" | "mois">("toutes");
```

Remplacer par :

```ts
const [filtreDateRange, setFiltreDateRange] = useState<FiltreDateValue>({ type: "preset", preset: "toutes" });
```

- [ ] **Étape 2 : Mettre à jour la fonction de filtrage**

Localiser dans `ConsignesStagiaire` (lignes ~567–576) :

```ts
const consignesFiltrees = consignes.filter(c => {
    if (filtreType !== "toutes" && c.type !== filtreType) return false;
    if (filtrePeriode !== "toutes") {
      const date = new Date(c.created_at); const now = new Date();
      if (filtrePeriode === "aujourd_hui") return date.toDateString() === now.toDateString();
      if (filtrePeriode === "semaine") { const s = new Date(now); s.setDate(s.getDate() - 7); return date >= s; }
      if (filtrePeriode === "mois") { const m = new Date(now); m.setMonth(m.getMonth() - 1); return date >= m; }
    }
    return true;
  });
```

Remplacer par :

```ts
const consignesFiltrees = consignes.filter(c => {
    if (filtreType !== "toutes" && c.type !== filtreType) return false;
    return appliquerFiltreDateRange(c.created_at, filtreDateRange);
  });
```

- [ ] **Étape 3 : Remplacer les boutons période dans le JSX**

Localiser dans le JSX de `ConsignesStagiaire` (lignes ~589–594) :

```tsx
      <div className="flex gap-2 flex-wrap">
        {([["toutes", "Toutes les dates"], ["aujourd_hui", "Aujourd'hui"], ["semaine", "7 derniers jours"], ["mois", "30 derniers jours"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFiltrePeriode(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtrePeriode === id ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>{label}</button>
        ))}
      </div>
```

Remplacer par :

```tsx
      <FiltreDateRange value={filtreDateRange} onChange={setFiltreDateRange} />
```

- [ ] **Étape 4 : Vérifier que les tests passent**

```bash
cd ~/security-guard-pro && npm test 2>&1 | tail -10
```

Résultat attendu : PASS.

- [ ] **Étape 5 : Commit**

```bash
cd ~/security-guard-pro && git add src/components/MainCourante.tsx
git commit -m "feat: migrate ConsignesStagiaire to FiltreDateRange"
```

---

## Task 4 : `PermisFeuFormateur` — ajout du filtre

**Files:**
- Modify: `src/components/MainCourante.tsx` (composant `PermisFeuFormateur`, lignes ~894–945)

- [ ] **Étape 1 : Ajouter le state dans `PermisFeuFormateur`**

Localiser dans `PermisFeuFormateur` (ligne ~897) après `const [onglet, setOnglet] = useState...` :

```ts
const [filtreDateRange, setFiltreDateRange] = useState<FiltreDateValue>({ type: "preset", preset: "toutes" });
```

- [ ] **Étape 2 : Mettre à jour la fonction de filtrage**

Localiser dans `PermisFeuFormateur` (ligne ~908) :

```ts
const permisFiltres = permis.filter(p => onglet === "actif" ? p.statut !== "archive" : p.statut === "archive");
```

Remplacer par :

```ts
const permisFiltres = permis.filter(p => {
    const matchOnglet = onglet === "actif" ? p.statut !== "archive" : p.statut === "archive";
    if (!matchOnglet) return false;
    return appliquerFiltreDateRange(p.date_debut, filtreDateRange);
  });
```

- [ ] **Étape 3 : Ajouter `<FiltreDateRange>` dans le JSX**

Dans le JSX de `PermisFeuFormateur`, après le bloc des boutons onglets (lignes ~916–921), ajouter :

```tsx
      <FiltreDateRange value={filtreDateRange} onChange={setFiltreDateRange} />
```

- [ ] **Étape 4 : Vérifier que les tests passent**

```bash
cd ~/security-guard-pro && npm test 2>&1 | tail -10
```

Résultat attendu : PASS.

- [ ] **Étape 5 : Commit**

```bash
cd ~/security-guard-pro && git add src/components/MainCourante.tsx
git commit -m "feat: add date filter to PermisFeuFormateur (filters on date_debut)"
```

---

## Task 5 : `PermisFeuStagiaire` — migration vers `FiltreDateRange`

**Files:**
- Modify: `src/components/MainCourante.tsx` (composant `PermisFeuStagiaire`, lignes ~615–700)

- [ ] **Étape 1 : Remplacer le state `filtrePeriode` par `filtreDateRange`**

Localiser dans `PermisFeuStagiaire` (ligne ~618) :

```ts
const [filtrePeriode, setFiltrePeriode] = useState<"toutes" | "aujourd_hui" | "semaine" | "mois">("toutes");
```

Remplacer par :

```ts
const [filtreDateRange, setFiltreDateRange] = useState<FiltreDateValue>({ type: "preset", preset: "toutes" });
```

- [ ] **Étape 2 : Mettre à jour la fonction de filtrage**

Localiser dans `PermisFeuStagiaire` (lignes ~634–644) :

```ts
const permisFiltres = permis.filter(p => {
    if (onglet === "actif" && p.statut === "archive") return false;
    if (onglet === "archive" && p.statut !== "archive") return false;
    if (filtrePeriode !== "toutes") {
      const date = new Date(p.created_at); const now = new Date();
      if (filtrePeriode === "aujourd_hui") return date.toDateString() === now.toDateString();
      if (filtrePeriode === "semaine") { const s = new Date(now); s.setDate(s.getDate() - 7); return date >= s; }
      if (filtrePeriode === "mois") { const m = new Date(now); m.setMonth(m.getMonth() - 1); return date >= m; }
    }
    return true;
  });
```

Remplacer par :

```ts
const permisFiltres = permis.filter(p => {
    if (onglet === "actif" && p.statut === "archive") return false;
    if (onglet === "archive" && p.statut !== "archive") return false;
    return appliquerFiltreDateRange(p.date_debut, filtreDateRange);
  });
```

> Note : le filtre passe de `created_at` à `date_debut` — comportement intentionnel (date des travaux).

- [ ] **Étape 3 : Remplacer les boutons période dans le JSX**

Localiser dans le JSX de `PermisFeuStagiaire` (lignes ~663–668) :

```tsx
      <div className="flex gap-2 flex-wrap">
        {([["toutes", "Toutes les dates"], ["aujourd_hui", "Aujourd'hui"], ["semaine", "7 derniers jours"], ["mois", "30 derniers jours"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setFiltrePeriode(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtrePeriode === id ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"}`}>{label}</button>
        ))}
      </div>
```

Remplacer par :

```tsx
      <FiltreDateRange value={filtreDateRange} onChange={setFiltreDateRange} />
```

- [ ] **Étape 4 : Vérifier que tous les tests passent**

```bash
cd ~/security-guard-pro && npm test 2>&1 | tail -10
```

Résultat attendu : PASS — tous les tests du projet.

- [ ] **Étape 5 : Vérifier le build TypeScript**

```bash
cd ~/security-guard-pro && npx tsc --noEmit 2>&1
```

Résultat attendu : aucune erreur.

- [ ] **Étape 6 : Commit final**

```bash
cd ~/security-guard-pro && git add src/components/MainCourante.tsx
git commit -m "feat: migrate PermisFeuStagiaire to FiltreDateRange (filters on date_debut)"
```

---

## Vérification manuelle finale

Lancer le serveur de dev :

```bash
cd ~/security-guard-pro && npm run dev
```

Vérifier dans le navigateur :

| Vue | Attendu |
|-----|---------|
| Espace Formateur → Consignes | Filtre combiné visible, boutons fonctionnels, plage libre filtre sur `created_at` |
| Espace Stagiaire → Consignes | Même composant, coexiste avec les boutons de type (Générale / Temporaire / Urgente) |
| Espace Formateur → Permis de feu | Filtre visible après les onglets En cours/Archivés, plage filtre sur `date_debut` |
| Espace Stagiaire → Permis de feu | Même composant, coexiste avec les onglets actif/archive |

# Financement OPCO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le suivi des dossiers de financement OPCO — création par formation ou par participant, workflow de statut en 6 étapes + refus, lien avec les factures existantes, et page globale avec indicateurs financiers.

**Architecture:** Une table `financements_opco` (formation_id obligatoire, stagiaire_id nullable) avec RLS admin/secrétaire. Accès depuis la carte formation via Dialog (liste + formulaire) et depuis une page dédiée `/financement-opco`. Pas de PDF dédié — réutilise `generateFacturePdf` via `facture_id`.

**Tech Stack:** React 18 + TypeScript + Vite, Supabase PostgreSQL, Shadcn UI (Dialog, Badge, Button, Input, Textarea, Label), lucide-react, Vitest + Testing Library.

---

## File Structure

**Nouveaux fichiers :**
- `supabase/migrations/20260526130000_financements_opco.sql` — table + RLS
- `src/pages/FinancementOpco.tsx` — page liste globale avec indicateurs, filtres, actions
- `src/test/FinancementOpco.test.tsx` — 3 tests

**Fichiers modifiés :**
- `src/pages/Formations.tsx` — bouton "Dossiers OPCO" + Dialog (liste + formulaire création)
- `src/App.tsx` — route `/financement-opco`
- `src/components/AppSidebar.tsx` — entrée nav + import `Landmark`

---

## Task 1: Migration SQL — table `financements_opco`

**Files:**
- Create: `supabase/migrations/20260526130000_financements_opco.sql`

- [ ] **Step 1: Créer le fichier de migration**

```sql
-- supabase/migrations/20260526130000_financements_opco.sql

CREATE TABLE public.financements_opco (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id        UUID NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  stagiaire_id        UUID REFERENCES public.stagiaires(id) ON DELETE SET NULL,

  opco_nom            TEXT NOT NULL,
  opco_contact_nom    TEXT,
  opco_contact_email  TEXT,
  opco_contact_tel    TEXT,
  numero_dossier      TEXT,

  montant_accorde     NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_paye        NUMERIC(10,2) NOT NULL DEFAULT 0,
  facture_id          UUID REFERENCES public.factures(id) ON DELETE SET NULL,

  statut              TEXT NOT NULL DEFAULT 'brouillon'
                        CHECK (statut IN (
                          'brouillon', 'demande_envoyee', 'accord_recu',
                          'en_attente_facture', 'facture', 'paye', 'refuse'
                        )),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.financements_opco ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_secretaire_financements_opco" ON public.financements_opco
  FOR ALL
  USING (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  );
```

- [ ] **Step 2: Appliquer via Supabase SQL Editor**

Va sur dashboard Supabase → SQL Editor → colle et exécute le SQL ci-dessus.

- [ ] **Step 3: Marquer la migration comme appliquée**

```bash
supabase migration repair --status applied 20260526130000
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260526130000_financements_opco.sql
git commit -m "feat: add financements_opco table with RLS"
```

---

## Task 2: Page `FinancementOpco.tsx` + tests

**Files:**
- Create: `src/pages/FinancementOpco.tsx`
- Create: `src/test/FinancementOpco.test.tsx`

- [ ] **Step 1: Écrire les tests en premier**

```typescript
// src/test/FinancementOpco.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FinancementOpco from "@/pages/FinancementOpco";

const mockDossiers = [
  {
    id: "1", formation_id: "f1", stagiaire_id: null,
    opco_nom: "AFDAS", numero_dossier: "AFDS-001",
    montant_accorde: 1200, montant_paye: 0,
    statut: "accord_recu", notes: null, facture_id: null,
    opco_contact_nom: null, opco_contact_email: null, opco_contact_tel: null,
    created_at: "2026-05-26",
    formation: { title: "Formation SST" }, stagiaire: null, facture: null,
  },
  {
    id: "2", formation_id: "f2", stagiaire_id: "s1",
    opco_nom: "OPCO EP", numero_dossier: null,
    montant_accorde: 800, montant_paye: 800,
    statut: "paye", notes: null, facture_id: null,
    opco_contact_nom: null, opco_contact_email: null, opco_contact_tel: null,
    created_at: "2026-05-20",
    formation: { title: "Formation SST 2" },
    stagiaire: { first_name: "Jean", last_name: "Dupont" }, facture: null,
  },
  {
    id: "3", formation_id: "f3", stagiaire_id: null,
    opco_nom: "Constructys", numero_dossier: "CTY-002",
    montant_accorde: 500, montant_paye: 0,
    statut: "refuse", notes: null, facture_id: null,
    opco_contact_nom: null, opco_contact_email: null, opco_contact_tel: null,
    created_at: "2026-05-15",
    formation: { title: "Formation CQP" }, stagiaire: null, facture: null,
  },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: mockDossiers, error: null }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("FinancementOpco", () => {
  it("affiche le titre et les dossiers mockés", async () => {
    render(<FinancementOpco />);
    expect(screen.getByText("Financement OPCO")).toBeInTheDocument();
    expect(await screen.findByText("AFDAS")).toBeInTheDocument();
    expect(await screen.findByText("OPCO EP")).toBeInTheDocument();
    expect(await screen.findByText("Constructys")).toBeInTheDocument();
  });

  it("filtre par statut 'Accord reçu' affiche uniquement les dossiers correspondants", async () => {
    render(<FinancementOpco />);
    await screen.findByText("AFDAS");
    fireEvent.click(screen.getByRole("button", { name: /accord reçu/i }));
    expect(screen.getByText("AFDAS")).toBeInTheDocument();
    expect(screen.queryByText("OPCO EP")).not.toBeInTheDocument();
    expect(screen.queryByText("Constructys")).not.toBeInTheDocument();
  });

  it("affiche les labels des indicateurs et inclut le total payé dans le rendu", async () => {
    render(<FinancementOpco />);
    await screen.findByText("AFDAS");
    expect(screen.getByText(/total accordé/i)).toBeInTheDocument();
    expect(screen.getByText(/total payé/i)).toBeInTheDocument();
    expect(screen.getByText(/solde en attente/i)).toBeInTheDocument();
    // Total payé = 0 + 800 + 0 = 800 — apparaît dans le DOM
    const textContent = document.body.textContent ?? "";
    expect(textContent).toContain("800");
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
cd /Users/lexminator/security-guard-pro && npx vitest run src/test/FinancementOpco.test.tsx 2>&1 | tail -10
```

Expected: FAIL — `@/pages/FinancementOpco` not found.

- [ ] **Step 3: Créer `FinancementOpco.tsx`**

```tsx
// src/pages/FinancementOpco.tsx
// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Landmark, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Dossier = {
  id: string;
  formation_id: string;
  stagiaire_id: string | null;
  opco_nom: string;
  opco_contact_nom: string | null;
  opco_contact_email: string | null;
  opco_contact_tel: string | null;
  numero_dossier: string | null;
  montant_accorde: number;
  montant_paye: number;
  facture_id: string | null;
  statut: string;
  notes: string | null;
  created_at: string;
  formation: { title: string } | null;
  stagiaire: { first_name: string; last_name: string } | null;
  facture: { numero: string } | null;
};

const SC: Record<string, { label: string; color: string; next: string | null }> = {
  brouillon:          { label: "Brouillon",          color: "bg-muted/50 text-muted-foreground border-border/50",        next: "demande_envoyee" },
  demande_envoyee:    { label: "Demande envoyée",    color: "bg-blue-500/10 text-blue-400 border-blue-500/30",           next: "accord_recu" },
  accord_recu:        { label: "Accord reçu",        color: "bg-violet-500/10 text-violet-400 border-violet-500/30",     next: "en_attente_facture" },
  en_attente_facture: { label: "En attente facture", color: "bg-orange-500/10 text-orange-400 border-orange-500/30",     next: "facture" },
  facture:            { label: "Facturé",             color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",    next: "paye" },
  paye:               { label: "Payé",                color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", next: null },
  refuse:             { label: "Refusé",              color: "bg-red-500/10 text-red-400 border-red-500/30",             next: null },
};

export default function FinancementOpco() {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState("all");
  const [filtreOpco, setFiltreOpco] = useState("");
  const [editingPaye, setEditingPaye] = useState<string | null>(null);
  const [payeInput, setPayeInput] = useState(0);
  const [lieFactureId, setLieFactureId] = useState<string | null>(null);
  const [facturesCache, setFacturesCache] = useState<Record<string, any[]>>({});
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("financements_opco")
      .select("*, formation:formations(title), stagiaire:stagiaires(first_name, last_name), facture:factures(numero)")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) toast.error(error.message);
        else setDossiers(data ?? []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey(k => k + 1);

  const updateStatut = async (id: string, statut: string) => {
    const { error } = await supabase.from("financements_opco").update({ statut }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Statut mis à jour"); reload(); }
  };

  const saveMontantPaye = async (id: string) => {
    const { error } = await supabase.from("financements_opco").update({ montant_paye: payeInput }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Montant payé mis à jour"); setEditingPaye(null); reload(); }
  };

  const deleteDossier = async (id: string) => {
    if (!confirm("Supprimer ce dossier OPCO ?")) return;
    const { error } = await supabase.from("financements_opco").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Dossier supprimé"); reload(); }
  };

  const loadFactures = async (formationId: string) => {
    if (facturesCache[formationId]) return;
    const { data } = await supabase.from("factures").select("id, numero").eq("formation_id", formationId);
    setFacturesCache(prev => ({ ...prev, [formationId]: data ?? [] }));
  };

  const lierFacture = async (dossierId: string, factureId: string) => {
    const { error } = await supabase.from("financements_opco")
      .update({ facture_id: factureId, statut: "facture" })
      .eq("id", dossierId);
    if (error) toast.error(error.message);
    else { toast.success("Facture liée"); setLieFactureId(null); reload(); }
  };

  const displayed = dossiers.filter(d => {
    if (filtreStatut !== "all" && d.statut !== filtreStatut) return false;
    if (filtreOpco && !d.opco_nom.toLowerCase().includes(filtreOpco.toLowerCase())) return false;
    return true;
  });

  const totalAccorde = dossiers.filter(d => d.statut !== "refuse").reduce((acc, d) => acc + Number(d.montant_accorde), 0);
  const totalPaye = dossiers.reduce((acc, d) => acc + Number(d.montant_paye), 0);
  const solde = totalAccorde - totalPaye;
  const fmt = (n: number) => n.toLocaleString("fr-FR");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Landmark className="h-6 w-6 text-yellow-400" />
        <h1 className="text-2xl font-bold">Financement OPCO</h1>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border border-border/50 rounded-lg p-4 bg-card/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total accordé</p>
          <p className="text-2xl font-bold text-violet-400 mt-1">{fmt(totalAccorde)} €</p>
        </div>
        <div className="border border-border/50 rounded-lg p-4 bg-card/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total payé</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{fmt(totalPaye)} €</p>
        </div>
        <div className="border border-border/50 rounded-lg p-4 bg-card/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Solde en attente</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{fmt(solde)} €</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <Button size="sm" variant={filtreStatut === "all" ? "default" : "outline"} onClick={() => setFiltreStatut("all")}>Tous</Button>
        {Object.entries(SC).map(([k, v]) => (
          <Button key={k} size="sm" variant={filtreStatut === k ? "default" : "outline"} onClick={() => setFiltreStatut(k)}>
            {v.label}
          </Button>
        ))}
        <Input className="w-40 h-8 text-sm" placeholder="Filtrer OPCO…"
          value={filtreOpco} onChange={e => setFiltreOpco(e.target.value)} />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : displayed.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun dossier OPCO.</p>
      ) : (
        <div className="space-y-2">
          {displayed.map(d => {
            const cfg = SC[d.statut] ?? SC.brouillon;
            const perimetre = d.stagiaire
              ? `${d.stagiaire.last_name} ${d.stagiaire.first_name}`
              : "Formation entière";
            return (
              <div key={d.id} className="border border-border/50 rounded-lg p-4 bg-card/50 space-y-2">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{d.opco_nom}</span>
                      {d.numero_dossier && <span className="font-mono text-xs text-muted-foreground">#{d.numero_dossier}</span>}
                      <Badge variant="outline" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{d.formation?.title} — {perimetre}</p>
                  </div>
                  <div className="text-right shrink-0 text-sm">
                    <p>Accordé : <span className="font-semibold">{fmt(Number(d.montant_accorde))} €</span></p>
                    <p className="text-muted-foreground text-xs">
                      Payé :{" "}
                      {editingPaye === d.id ? (
                        <span className="inline-flex items-center gap-1">
                          <Input type="number" min={0} step={0.01} className="h-6 w-20 text-xs" autoFocus
                            value={payeInput} onChange={e => setPayeInput(Number(e.target.value))} />
                          <Button size="sm" className="h-6 text-xs px-2" onClick={() => saveMontantPaye(d.id)}>OK</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs px-1" onClick={() => setEditingPaye(null)}>✕</Button>
                        </span>
                      ) : (
                        <button className="underline decoration-dotted hover:text-foreground"
                          onClick={() => { setEditingPaye(d.id); setPayeInput(Number(d.montant_paye)); }}>
                          {fmt(Number(d.montant_paye))} €
                        </button>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {cfg.next && (
                    <Button size="sm" variant="outline" onClick={() => updateStatut(d.id, cfg.next!)}>
                      → {SC[cfg.next]?.label}
                    </Button>
                  )}
                  {d.statut !== "paye" && d.statut !== "refuse" && (
                    <Button size="sm" variant="outline"
                      className="text-red-400 border-red-400/30 hover:bg-red-400/10"
                      onClick={() => updateStatut(d.id, "refuse")}>
                      Refuser
                    </Button>
                  )}
                  {!d.facture_id && d.statut !== "refuse" && d.statut !== "paye" && (
                    <Button size="sm" variant="outline"
                      onClick={async () => { setLieFactureId(d.id); await loadFactures(d.formation_id); }}>
                      Lier facture
                    </Button>
                  )}
                  {lieFactureId === d.id && (
                    <select className="text-xs border border-border rounded px-2 py-1 bg-background"
                      onChange={e => e.target.value && lierFacture(d.id, e.target.value)} defaultValue="">
                      <option value="">Choisir…</option>
                      {(facturesCache[d.formation_id] ?? []).map(f => (
                        <option key={f.id} value={f.id}>{f.numero}</option>
                      ))}
                    </select>
                  )}
                  {d.facture_id && d.facture && (
                    <span className="text-xs text-muted-foreground flex items-center">Facture : {d.facture.numero}</span>
                  )}
                  {d.statut === "brouillon" && (
                    <Button size="sm" variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
                      onClick={() => deleteDossier(d.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Vérifier que les 3 tests passent**

```bash
cd /Users/lexminator/security-guard-pro && npx vitest run src/test/FinancementOpco.test.tsx 2>&1 | tail -15
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Vérifier la suite complète**

```bash
cd /Users/lexminator/security-guard-pro && npx vitest run 2>&1 | tail -10
```

Expected: tous les tests passent (≥ 119), aucune régression.

- [ ] **Step 6: Commit**

```bash
git add src/pages/FinancementOpco.tsx src/test/FinancementOpco.test.tsx
git commit -m "feat: add FinancementOpco page with indicators, filters and status management"
```

---

## Task 3: Dialog "Dossiers OPCO" dans `Formations.tsx`

**Files:**
- Modify: `src/pages/Formations.tsx`

Context: Le fichier a `// @ts-nocheck` en ligne 1. Il importe déjà `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `Label`, `Input`, `Textarea`, `Button` depuis Shadcn. Il faut ajouter `Landmark` et `Trash2` aux imports lucide-react existants, et `Badge` depuis `@/components/ui/badge` si absent.

- [ ] **Step 1: Vérifier et compléter les imports**

Ouvrir `src/pages/Formations.tsx`. Trouver la ligne d'import lucide-react (ligne ~15) et ajouter `Landmark` et `Trash2` s'ils ne sont pas présents.

Vérifier également que `Badge` est importé depuis `@/components/ui/badge`. Si absent, ajouter :
```tsx
import { Badge } from "@/components/ui/badge";
```

- [ ] **Step 2: Ajouter la constante de statuts OPCO**

Juste après les imports (avant le composant), ajouter :

```tsx
const OPCO_SC: Record<string, { label: string; next: string | null }> = {
  brouillon:          { label: "Brouillon",          next: "demande_envoyee" },
  demande_envoyee:    { label: "Demande envoyée",    next: "accord_recu" },
  accord_recu:        { label: "Accord reçu",        next: "en_attente_facture" },
  en_attente_facture: { label: "En attente facture", next: "facture" },
  facture:            { label: "Facturé",             next: "paye" },
  paye:               { label: "Payé",                next: null },
  refuse:             { label: "Refusé",              next: null },
};
```

- [ ] **Step 3: Ajouter les états pour le modal OPCO**

Trouver la zone des `useState` (près de `contratModal`, `factureModal`). Ajouter après :

```tsx
const [opcoModal, setOpcoModal] = useState<{ formation: any; participants: any[] } | null>(null);
const [opcoDossiers, setOpcoDossiers] = useState<any[]>([]);
const [opcoFormOpen, setOpcoFormOpen] = useState(false);
const [opcoForm, setOpcoForm] = useState({
  perimetre: "formation" as "formation" | "stagiaire",
  stagiaire_id: "",
  opco_nom: "",
  opco_contact_nom: "",
  opco_contact_email: "",
  opco_contact_tel: "",
  numero_dossier: "",
  montant_accorde: 0,
  notes: "",
});
const [savingOpco, setSavingOpco] = useState(false);
const [opcoReloadKey, setOpcoReloadKey] = useState(0);
```

- [ ] **Step 4: Ajouter le useEffect pour charger les dossiers OPCO**

Trouver la zone des `useEffect` dans le composant. Ajouter un nouvel effet :

```tsx
useEffect(() => {
  if (!opcoModal) { setOpcoDossiers([]); return; }
  let cancelled = false;
  supabase
    .from("financements_opco")
    .select("*, stagiaire:stagiaires(first_name, last_name)")
    .eq("formation_id", opcoModal.formation.id)
    .order("created_at", { ascending: false })
    .then(({ data, error }) => {
      if (cancelled) return;
      if (error) toast.error(error.message);
      else setOpcoDossiers(data ?? []);
    });
  return () => { cancelled = true; };
}, [opcoModal?.formation?.id, opcoReloadKey]);
```

- [ ] **Step 5: Ajouter les fonctions OPCO**

Trouver la zone des fonctions (près de `createFacture`, `generateContrat`). Ajouter :

```tsx
const saveOpcoDossier = async () => {
  if (!opcoModal || !opcoForm.opco_nom.trim()) return;
  setSavingOpco(true);
  try {
    const { error } = await supabase.from("financements_opco").insert({
      formation_id: opcoModal.formation.id,
      stagiaire_id: opcoForm.perimetre === "stagiaire" ? opcoForm.stagiaire_id || null : null,
      opco_nom: opcoForm.opco_nom.trim(),
      opco_contact_nom: opcoForm.opco_contact_nom.trim() || null,
      opco_contact_email: opcoForm.opco_contact_email.trim() || null,
      opco_contact_tel: opcoForm.opco_contact_tel.trim() || null,
      numero_dossier: opcoForm.numero_dossier.trim() || null,
      montant_accorde: opcoForm.montant_accorde,
      notes: opcoForm.notes.trim() || null,
    });
    if (error) throw new Error(error.message);
    toast.success("Dossier OPCO créé");
    setOpcoFormOpen(false);
    setOpcoForm({ perimetre: "formation", stagiaire_id: "", opco_nom: "", opco_contact_nom: "", opco_contact_email: "", opco_contact_tel: "", numero_dossier: "", montant_accorde: 0, notes: "" });
    setOpcoReloadKey(k => k + 1);
  } catch (err: any) {
    toast.error(err?.message ?? "Erreur");
  } finally {
    setSavingOpco(false);
  }
};

const updateOpcoStatut = async (id: string, statut: string) => {
  const { error } = await supabase.from("financements_opco").update({ statut }).eq("id", id);
  if (error) toast.error(error.message);
  else { toast.success("Statut mis à jour"); setOpcoReloadKey(k => k + 1); }
};

const deleteOpcoDossier = async (id: string) => {
  if (!confirm("Supprimer ce dossier OPCO ?")) return;
  const { error } = await supabase.from("financements_opco").delete().eq("id", id);
  if (error) toast.error(error.message);
  else { toast.success("Dossier supprimé"); setOpcoReloadKey(k => k + 1); }
};
```

- [ ] **Step 6: Ajouter le bouton "Dossiers OPCO" dans la carte formation**

Dans la section des boutons documents par carte formation (après le bouton "Créer la facture", avant les attestations individuelles), ajouter :

```tsx
<Button size="sm" variant="outline"
  className="w-full border-amber-400/30 text-amber-400 hover:bg-amber-400/10 text-xs"
  onClick={() => {
    setOpcoFormOpen(false);
    setOpcoForm({ perimetre: "formation", stagiaire_id: "", opco_nom: "", opco_contact_nom: "", opco_contact_email: "", opco_contact_tel: "", numero_dossier: "", montant_accorde: 0, notes: "" });
    setOpcoModal({ formation: f, participants: ps });
  }}>
  <Landmark className="h-3.5 w-3.5 mr-1.5" /> Dossiers OPCO
</Button>
```

- [ ] **Step 7: Ajouter le Dialog OPCO**

Juste avant la dernière balise fermante `</div>` du composant (après les autres Dialogs — facture, contrat), ajouter :

```tsx
{opcoModal && (
  <Dialog open={!!opcoModal} onOpenChange={(v) => !v && setOpcoModal(null)}>
    <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          <span className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-amber-400" />
            Dossiers OPCO — {opcoModal.formation.title}
          </span>
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        {opcoDossiers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun dossier OPCO pour cette formation.</p>
        ) : (
          <div className="space-y-2">
            {opcoDossiers.map((d: any) => {
              const cfg = OPCO_SC[d.statut] ?? OPCO_SC.brouillon;
              const perimetre = d.stagiaire
                ? `${d.stagiaire.last_name} ${d.stagiaire.first_name}`
                : "Formation entière";
              return (
                <div key={d.id} className="border border-border/50 rounded p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{d.opco_nom}</span>
                    {d.numero_dossier && (
                      <span className="text-xs text-muted-foreground font-mono">#{d.numero_dossier}</span>
                    )}
                    <Badge variant="outline" className="text-xs">{cfg.label}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{perimetre}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Accordé : {Number(d.montant_accorde).toLocaleString("fr-FR")} €
                    {" · "}Payé : {Number(d.montant_paye).toLocaleString("fr-FR")} €
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {cfg.next && (
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => updateOpcoStatut(d.id, cfg.next)}>
                        → {OPCO_SC[cfg.next]?.label}
                      </Button>
                    )}
                    {d.statut !== "paye" && d.statut !== "refuse" && (
                      <Button size="sm" variant="outline"
                        className="h-7 text-xs text-red-400 border-red-400/30 hover:bg-red-400/10"
                        onClick={() => updateOpcoStatut(d.id, "refuse")}>
                        Refuser
                      </Button>
                    )}
                    {d.statut === "brouillon" && (
                      <Button size="sm" variant="outline"
                        className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 ml-auto"
                        onClick={() => deleteOpcoDossier(d.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Button size="sm" variant="outline" className="w-full"
          onClick={() => setOpcoFormOpen(v => !v)}>
          {opcoFormOpen ? "Annuler" : "+ Nouveau dossier OPCO"}
        </Button>

        {opcoFormOpen && (
          <div className="space-y-3 border border-border/50 rounded-lg p-3">
            <div>
              <Label className="text-sm font-medium">Périmètre</Label>
              <div className="flex gap-4 mt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="opco-perimetre" value="formation"
                    checked={opcoForm.perimetre === "formation"}
                    onChange={() => setOpcoForm(f => ({ ...f, perimetre: "formation", stagiaire_id: "" }))} />
                  Formation entière
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="opco-perimetre" value="stagiaire"
                    checked={opcoForm.perimetre === "stagiaire"}
                    onChange={() => setOpcoForm(f => ({ ...f, perimetre: "stagiaire" }))} />
                  Stagiaire spécifique
                </label>
              </div>
            </div>

            {opcoForm.perimetre === "stagiaire" && (
              <div>
                <Label className="text-sm font-medium">Stagiaire *</Label>
                <select className="mt-1 w-full border border-border rounded px-2 py-1.5 text-sm bg-background"
                  value={opcoForm.stagiaire_id}
                  onChange={e => setOpcoForm(f => ({ ...f, stagiaire_id: e.target.value }))}>
                  <option value="">Sélectionner…</option>
                  {opcoModal.participants.filter((p: any) => p.stagiaire).map((p: any) => (
                    <option key={p.stagiaire.id} value={p.stagiaire.id}>
                      {p.stagiaire.last_name} {p.stagiaire.first_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium">OPCO — Nom *</Label>
              <Input className="mt-1" placeholder="AFDAS, OPCO EP, Constructys…"
                value={opcoForm.opco_nom}
                onChange={e => setOpcoForm(f => ({ ...f, opco_nom: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm font-medium">Contact gestionnaire</Label>
                <Input className="mt-1" placeholder="Nom Prénom"
                  value={opcoForm.opco_contact_nom}
                  onChange={e => setOpcoForm(f => ({ ...f, opco_contact_nom: e.target.value }))} />
              </div>
              <div>
                <Label className="text-sm font-medium">Email gestionnaire</Label>
                <Input className="mt-1" type="email" placeholder="gestionnaire@opco.fr"
                  value={opcoForm.opco_contact_email}
                  onChange={e => setOpcoForm(f => ({ ...f, opco_contact_email: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm font-medium">Téléphone gestionnaire</Label>
                <Input className="mt-1" placeholder="0600000000"
                  value={opcoForm.opco_contact_tel}
                  onChange={e => setOpcoForm(f => ({ ...f, opco_contact_tel: e.target.value }))} />
              </div>
              <div>
                <Label className="text-sm font-medium">N° dossier OPCO</Label>
                <Input className="mt-1" placeholder="Réf. OPCO"
                  value={opcoForm.numero_dossier}
                  onChange={e => setOpcoForm(f => ({ ...f, numero_dossier: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Montant accordé (€)</Label>
              <Input className="mt-1" type="number" min={0} step={0.01}
                value={opcoForm.montant_accorde}
                onChange={e => setOpcoForm(f => ({ ...f, montant_accorde: Number(e.target.value) }))} />
            </div>

            <div>
              <Label className="text-sm font-medium">Notes</Label>
              <Textarea className="mt-1" rows={2} placeholder="Remarques…"
                value={opcoForm.notes}
                onChange={e => setOpcoForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <Button className="w-full"
              disabled={
                !opcoForm.opco_nom.trim() ||
                savingOpco ||
                (opcoForm.perimetre === "stagiaire" && !opcoForm.stagiaire_id)
              }
              onClick={saveOpcoDossier}>
              {savingOpco ? "Création…" : "Créer le dossier"}
            </Button>
          </div>
        )}
      </div>
    </DialogContent>
  </Dialog>
)}
```

- [ ] **Step 8: Vérifier la suite complète**

```bash
cd /Users/lexminator/security-guard-pro && npx vitest run 2>&1 | tail -10
```

Expected: tous les tests passent (≥ 122), aucune régression.

- [ ] **Step 9: Commit**

```bash
git add src/pages/Formations.tsx
git commit -m "feat: add Dossiers OPCO button and dialog in Formations"
```

---

## Task 4: Route + navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppSidebar.tsx`

- [ ] **Step 1: Ajouter l'import et la route dans `App.tsx`**

Trouver les imports de pages (près de `import Facturation from "./pages/Facturation"`). Ajouter :
```tsx
import FinancementOpco from "./pages/FinancementOpco";
```

Trouver la route `/facturation` et ajouter juste après :
```tsx
<Route path="/financement-opco" element={<FinancementOpco />} />
```

- [ ] **Step 2: Ajouter `Landmark` et l'entrée nav dans `AppSidebar.tsx`**

Trouver l'import lucide-react (ligne ~5). Ajouter `Landmark` s'il n'est pas déjà présent.

Dans le groupe `"Administration"`, trouver l'entrée "Facturation" et ajouter juste après :
```tsx
{ title: "Financement OPCO", url: "/financement-opco", icon: Landmark, roles: ["administrateur", "secretaire"] },
```

- [ ] **Step 3: Vérifier la suite complète**

```bash
cd /Users/lexminator/security-guard-pro && npx vitest run 2>&1 | tail -10
```

Expected: tous les tests passent (≥ 122), aucune régression.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/AppSidebar.tsx
git commit -m "feat: add /financement-opco route and nav entry"
```

---

## Rappel post-déploiement

Appliquer la migration `20260526130000_financements_opco.sql` via Supabase SQL Editor avant de tester en production.

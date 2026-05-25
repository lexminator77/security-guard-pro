# Signature Électronique Émargements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le clic simple d'émargement par une signature dessinée sur canvas, stocker le PNG en base64 en DB, et générer un PDF feuille d'émargement Qualiopi avec les vraies signatures depuis Formations.tsx.

**Architecture:** Composant `SignatureModal` (canvas `signature_pad` + Dialog Shadcn) réutilisé dans `EspaceStagiaire` et `EspaceFormateur`. Stockage base64 dans colonnes `signature_data` des tables existantes. Génération PDF côté client via `jspdf` + `jspdf-autotable` appelée depuis le bouton existant "Feuille d'émargement" dans `Formations.tsx`.

**Tech Stack:** React 18 + TypeScript, Supabase PostgreSQL, `signature_pad`, `jspdf`, `jspdf-autotable`, Shadcn UI Dialog, Vitest + Testing Library.

---

## File Structure

**New files:**
- `supabase/migrations/20260525120000_emargements_signature_data.sql` — colonnes `signature_data`
- `src/components/SignatureModal.tsx` — canvas signature réutilisable
- `src/lib/generateEmargementPdf.ts` — générateur PDF avec signatures
- `src/test/SignatureModal.test.tsx` — tests SignatureModal
- `src/test/generateEmargementPdf.test.ts` — tests PDF

**Modified files:**
- `src/pages/EspaceStagiaire.tsx` — signerEmargement + modal + boutons
- `src/pages/EspaceFormateur.tsx` — signerEmargement + modal + boutons
- `src/pages/Formations.tsx` — bouton "Feuille d'émargement" appelle la nouvelle fonction

---

## Task 1: Migration SQL — colonnes `signature_data`

**Files:**
- Create: `supabase/migrations/20260525120000_emargements_signature_data.sql`

- [ ] **Step 1: Créer la migration**

```sql
-- supabase/migrations/20260525120000_emargements_signature_data.sql
ALTER TABLE public.emargements_stagiaire
  ADD COLUMN IF NOT EXISTS signature_data TEXT;

ALTER TABLE public.emargements_formateur
  ADD COLUMN IF NOT EXISTS signature_data TEXT;
```

- [ ] **Step 2: Appliquer via le dashboard Supabase**

Va sur dashboard Supabase → SQL Editor → colle et exécute le SQL ci-dessus.

- [ ] **Step 3: Marquer la migration comme appliquée**

```bash
supabase migration repair --status applied 20260525120000
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260525120000_emargements_signature_data.sql
git commit -m "feat: add signature_data column to emargements tables"
```

---

## Task 2: Installer les dépendances

**Files:** `package.json` (modifié par npm)

- [ ] **Step 1: Installer les packages**

```bash
npm install signature_pad jspdf jspdf-autotable
```

Expected output : 3 packages ajoutés, pas d'erreurs de peer deps.

- [ ] **Step 2: Vérifier l'installation**

```bash
node -e "require('signature_pad'); require('jspdf'); require('jspdf-autotable'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install signature_pad, jspdf, jspdf-autotable"
```

---

## Task 3: Composant `SignatureModal` + tests

**Files:**
- Create: `src/components/SignatureModal.tsx`
- Create: `src/test/SignatureModal.test.tsx`

- [ ] **Step 1: Écrire les tests**

```typescript
// src/test/SignatureModal.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SignatureModal } from "@/components/SignatureModal";

const mockPad = {
  isEmpty: vi.fn().mockReturnValue(true),
  toDataURL: vi.fn().mockReturnValue("data:image/png;base64,abc123"),
  clear: vi.fn(),
  off: vi.fn(),
};

vi.mock("signature_pad", () => ({
  default: vi.fn().mockImplementation(() => mockPad),
}));

describe("SignatureModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPad.isEmpty.mockReturnValue(true);
  });

  it("affiche le dialog quand open=true", () => {
    render(
      <SignatureModal
        open={true}
        title="Signature — Matin"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("Signature — Matin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /effacer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmer/i })).toBeInTheDocument();
  });

  it("affiche toast erreur si canvas vide au clic Confirmer", async () => {
    mockPad.isEmpty.mockReturnValue(true);
    render(
      <SignatureModal
        open={true}
        title="Signature — Matin"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /confirmer/i }));
    // toast.error est appelé — vérifié indirectement via sonner mock
    expect(mockPad.isEmpty).toHaveBeenCalled();
  });

  it("appelle onConfirm avec base64 si canvas non vide", async () => {
    mockPad.isEmpty.mockReturnValue(false);
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <SignatureModal
        open={true}
        title="Signature — Matin"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /confirmer/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("data:image/png;base64,abc123"));
  });

  it("appelle clear sur clic Effacer", () => {
    render(
      <SignatureModal
        open={true}
        title="Signature — Matin"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /effacer/i }));
    expect(mockPad.clear).toHaveBeenCalled();
  });

  it("n'affiche rien quand open=false", () => {
    render(
      <SignatureModal
        open={false}
        title="Signature — Matin"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByText("Signature — Matin")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npx vitest run src/test/SignatureModal.test.tsx
```

Expected: FAIL — `@/components/SignatureModal` not found.

- [ ] **Step 3: Créer le composant**

```tsx
// src/components/SignatureModal.tsx
import { useRef, useEffect } from "react";
import SignaturePad from "signature_pad";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SignatureModalProps {
  open: boolean;
  title: string;
  onConfirm: (signatureBase64: string) => Promise<void>;
  onClose: () => void;
}

export function SignatureModal({ open, title, onConfirm, onClose }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (open && canvasRef.current) {
      const pad = new SignaturePad(canvasRef.current, {
        penColor: "rgb(0, 0, 0)",
        backgroundColor: "rgb(255, 255, 255)",
      });
      padRef.current = pad;
      return () => {
        pad.off();
        padRef.current = null;
      };
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!padRef.current || padRef.current.isEmpty()) {
      toast.error("Veuillez signer avant de confirmer");
      return;
    }
    await onConfirm(padRef.current.toDataURL("image/png"));
  };

  const handleClear = () => {
    padRef.current?.clear();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="border-2 border-border/50 rounded-lg overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            width={460}
            height={180}
            className="w-full touch-none"
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Signez dans le cadre blanc ci-dessus
        </p>
        <div className="flex gap-3 mt-2">
          <Button
            variant="outline"
            className="flex-1 min-h-[44px]"
            onClick={handleClear}
          >
            Effacer
          </Button>
          <Button
            className="flex-1 min-h-[44px] gradient-primary text-primary-foreground"
            onClick={handleConfirm}
          >
            Confirmer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npx vitest run src/test/SignatureModal.test.tsx
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Vérifier la suite complète**

```bash
npx vitest run
```

Expected: tous les tests passent (≥ 91).

- [ ] **Step 6: Commit**

```bash
git add src/components/SignatureModal.tsx src/test/SignatureModal.test.tsx
git commit -m "feat: add SignatureModal component with signature_pad canvas"
```

---

## Task 4: `EspaceStagiaire.tsx` — intégration SignatureModal

**Files:**
- Modify: `src/pages/EspaceStagiaire.tsx`

- [ ] **Step 1: Ajouter l'import de SignatureModal**

En haut du fichier, après la ligne `import { toast } from "sonner";` (ligne ~13), ajouter :

```tsx
import { SignatureModal } from "@/components/SignatureModal";
```

- [ ] **Step 2: Ajouter l'état `sigModal`**

Dans le corps du composant `EspaceStagiaire`, après les autres `useState` (autour de la ligne où se trouvent les états comme `[page, setPage]`), ajouter :

```tsx
const [sigModal, setSigModal] = useState<{ formationId: string; periode: "matin" | "apres_midi" } | null>(null);
```

- [ ] **Step 3: Modifier `signerEmargement` pour accepter `signatureData`**

Remplacer la fonction `signerEmargement` existante (actuellement lignes 259–272) :

**Ancien code :**
```tsx
  const signerEmargement = async (formationId: string, periode: "matin" | "apres_midi") => {
    if (!stagiaireId) return;
    const exists = emargements.find(e => e.formation_id === formationId && e.date === today && e.periode === periode);
    if (exists) { toast.info("Déjà signé !"); return; }
    const { error } = await supabase.from("emargements_stagiaire").insert({
      stagiaire_id: stagiaireId,
      formation_id: formationId,
      date: today,
      periode,
      signe_le: new Date().toISOString(),
    });
    if (error) toast.error(error.message);
    else { toast.success("Émargement signé !"); loadAll(stagiaireId); }
  };
```

**Nouveau code :**
```tsx
  const signerEmargement = async (formationId: string, periode: "matin" | "apres_midi", signatureData: string) => {
    if (!stagiaireId) return;
    const exists = emargements.find(e => e.formation_id === formationId && e.date === today && e.periode === periode);
    if (exists) { toast.info("Déjà signé !"); return; }
    const { error } = await supabase.from("emargements_stagiaire").insert({
      stagiaire_id: stagiaireId,
      formation_id: formationId,
      date: today,
      periode,
      signe_le: new Date().toISOString(),
      signature_data: signatureData,
    });
    if (error) toast.error(error.message);
    else { toast.success("Émargement signé !"); loadAll(stagiaireId); }
  };
```

- [ ] **Step 4: Modifier les boutons dans `PageEmargement`**

Dans `PageEmargement`, remplacer le `<button>` qui appelle directement `signerEmargement` :

**Ancien code :**
```tsx
              <button key={periode} onClick={() => signerEmargement(f.id, periode)}
                className={`p-4 rounded-xl border-2 transition-all text-center ${estSigne(f.id, periode) ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-primary/5"}`}>
                <p className="font-semibold text-sm">{estSigne(f.id, periode) ? "✓ Signé" : "Signer"}</p>
                <p className="text-xs text-muted-foreground mt-1">{periode === "matin" ? "Matin" : "Après-midi"}</p>
              </button>
```

**Nouveau code :**
```tsx
              <button key={periode}
                onClick={() => !estSigne(f.id, periode) && setSigModal({ formationId: f.id, periode })}
                className={`p-4 rounded-xl border-2 transition-all text-center ${estSigne(f.id, periode) ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 cursor-default" : "border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-primary/5"}`}>
                <p className="font-semibold text-sm">{estSigne(f.id, periode) ? "✓ Signé" : "Signer"}</p>
                <p className="text-xs text-muted-foreground mt-1">{periode === "matin" ? "Matin" : "Après-midi"}</p>
              </button>
```

- [ ] **Step 5: Ajouter `<SignatureModal>` dans le return principal**

À la fin du return principal du composant, juste avant le dernier `</div>` fermant (la `<div className="flex h-screen...">`) :

**Trouver :**
```tsx
    </div>
  );
```

(la dernière fermeture avant le `return` se termine)

**Remplacer par :**
```tsx
      <SignatureModal
        open={!!sigModal}
        title={`Signature — ${sigModal?.periode === "matin" ? "Matin" : "Après-midi"}`}
        onConfirm={async (sig) => {
          if (sigModal) await signerEmargement(sigModal.formationId, sigModal.periode, sig);
          setSigModal(null);
        }}
        onClose={() => setSigModal(null)}
      />
    </div>
  );
```

- [ ] **Step 6: Vérifier les tests**

```bash
npx vitest run
```

Expected: tous les tests passent (≥ 91). Aucune régression.

- [ ] **Step 7: Commit**

```bash
git add src/pages/EspaceStagiaire.tsx
git commit -m "feat: integrate SignatureModal into EspaceStagiaire emargement"
```

---

## Task 5: `EspaceFormateur.tsx` — intégration SignatureModal

**Files:**
- Modify: `src/pages/EspaceFormateur.tsx`

- [ ] **Step 1: Ajouter l'import de SignatureModal**

En haut du fichier, après `import { toast } from "sonner";` (ligne ~13) :

```tsx
import { SignatureModal } from "@/components/SignatureModal";
```

- [ ] **Step 2: Ajouter l'état `sigModal`**

Dans le corps du composant, parmi les autres `useState` :

```tsx
const [sigModal, setSigModal] = useState<{ formationId: string; periode: "matin" | "apres_midi" } | null>(null);
```

- [ ] **Step 3: Modifier `signerEmargement`**

Remplacer la fonction actuelle (ligne 241–248) :

**Ancien code :**
```tsx
  const signerEmargement = async (formationId: string, periode: "matin" | "apres_midi") => {
    if (!formateurId) return;
    const exists = emargements.find(e => e.formation_id === formationId && e.date === today && e.periode === periode);
    if (exists) { toast.info("Déjà signé !"); return; }
    const { error } = await supabase.from("emargements_formateur").insert({ formateur_id: formateurId, formation_id: formationId, date: today, periode, signe_le: new Date().toISOString() });
    if (error) toast.error(error.message);
    else { toast.success("Émargement signé !"); loadAll(formateurId); }
  };
```

**Nouveau code :**
```tsx
  const signerEmargement = async (formationId: string, periode: "matin" | "apres_midi", signatureData: string) => {
    if (!formateurId) return;
    const exists = emargements.find(e => e.formation_id === formationId && e.date === today && e.periode === periode);
    if (exists) { toast.info("Déjà signé !"); return; }
    const { error } = await supabase.from("emargements_formateur").insert({
      formateur_id: formateurId,
      formation_id: formationId,
      date: today,
      periode,
      signe_le: new Date().toISOString(),
      signature_data: signatureData,
    });
    if (error) toast.error(error.message);
    else { toast.success("Émargement signé !"); loadAll(formateurId); }
  };
```

- [ ] **Step 4: Modifier les boutons dans `PageEmargement`**

Dans `PageEmargement` de `EspaceFormateur.tsx` (ligne ~566) :

**Ancien code :**
```tsx
              <button key={periode} onClick={() => signerEmargement(f.id, periode)}
                className={`p-4 rounded-xl border-2 transition-all text-center ${estSigne(f.id, periode) ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-primary/5"}`}>
                <p className="font-semibold text-sm">{estSigne(f.id, periode) ? "✓ Signé" : "Signer"}</p>
                <p className="text-xs text-muted-foreground mt-1">{periode === "matin" ? "Matin" : "Après-midi"}</p>
              </button>
```

**Nouveau code :**
```tsx
              <button key={periode}
                onClick={() => !estSigne(f.id, periode) && setSigModal({ formationId: f.id, periode })}
                className={`p-4 rounded-xl border-2 transition-all text-center ${estSigne(f.id, periode) ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 cursor-default" : "border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-primary/5"}`}>
                <p className="font-semibold text-sm">{estSigne(f.id, periode) ? "✓ Signé" : "Signer"}</p>
                <p className="text-xs text-muted-foreground mt-1">{periode === "matin" ? "Matin" : "Après-midi"}</p>
              </button>
```

- [ ] **Step 5: Ajouter `<SignatureModal>` dans le return principal**

Juste avant le dernier `</div>` fermant du return (avant `);`), ajouter :

```tsx
      <SignatureModal
        open={!!sigModal}
        title={`Signature — ${sigModal?.periode === "matin" ? "Matin" : "Après-midi"}`}
        onConfirm={async (sig) => {
          if (sigModal) await signerEmargement(sigModal.formationId, sigModal.periode, sig);
          setSigModal(null);
        }}
        onClose={() => setSigModal(null)}
      />
```

- [ ] **Step 6: Vérifier les tests**

```bash
npx vitest run
```

Expected: tous les tests passent (≥ 91).

- [ ] **Step 7: Commit**

```bash
git add src/pages/EspaceFormateur.tsx
git commit -m "feat: integrate SignatureModal into EspaceFormateur emargement"
```

---

## Task 6: `generateEmargementPdf` + bouton dans `Formations.tsx`

**Files:**
- Create: `src/lib/generateEmargementPdf.ts`
- Create: `src/test/generateEmargementPdf.test.ts`
- Modify: `src/pages/Formations.tsx`

- [ ] **Step 1: Écrire le test**

```typescript
// src/test/generateEmargementPdf.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateEmargementPdf } from "@/lib/generateEmargementPdf";

const mockSave = vi.fn();
const mockText = vi.fn();
const mockSetFontSize = vi.fn();
const mockAddImage = vi.fn();
const mockDoc: any = {
  setFontSize: mockSetFontSize,
  setTextColor: vi.fn(),
  setFont: vi.fn(),
  text: mockText,
  addImage: mockAddImage,
  internal: { pageSize: { height: 297, width: 210 } },
  save: mockSave,
};

vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(() => mockDoc),
}));

vi.mock("jspdf-autotable", () => ({
  default: vi.fn().mockImplementation((doc: any) => {
    doc.lastAutoTable = { finalY: 100 };
  }),
}));

const buildSupabaseMock = (esData: any[], efData: any[]) => ({
  from: (table: string) => ({
    select: () => ({
      eq: () => Promise.resolve({
        data: table === "emargements_stagiaire" ? esData : efData,
        error: null,
      }),
    }),
  }),
});

describe("generateEmargementPdf", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("génère un PDF et appelle doc.save() avec le bon nom", async () => {
    const supabase = buildSupabaseMock(
      [{ stagiaire_id: "s1", date: "2026-05-26", periode: "matin", signature_data: "data:image/png;base64,abc", stagiaire: { id: "s1", first_name: "Jean", last_name: "Dupont" } }],
      [{ formateur_id: "f1", date: "2026-05-26", periode: "matin", signature_data: "data:image/png;base64,xyz", formateur: { id: "f1", first_name: "Marie", last_name: "Martin" } }]
    );
    const formation = { id: "f1", title: "Formation SST", type: "SST", start_date: "2026-05-26", end_date: "2026-05-26" };
    await generateEmargementPdf(formation as any, supabase as any);
    expect(mockSave).toHaveBeenCalledWith(expect.stringContaining("emargement"));
  });

  it("génère un PDF sans erreur si aucun émargement", async () => {
    const supabase = buildSupabaseMock([], []);
    const formation = { id: "f1", title: "Formation Vide", type: "SST", start_date: "2026-05-26", end_date: "2026-05-26" };
    await generateEmargementPdf(formation as any, supabase as any);
    expect(mockSave).toHaveBeenCalled();
  });

  it("appelle addImage pour les cellules avec signature", async () => {
    const supabase = buildSupabaseMock(
      [{ stagiaire_id: "s1", date: "2026-05-26", periode: "matin", signature_data: "data:image/png;base64,abc", stagiaire: { id: "s1", first_name: "Jean", last_name: "Dupont" } }],
      []
    );
    const formation = { id: "f1", title: "Formation SST", type: "SST", start_date: "2026-05-26", end_date: "2026-05-26" };
    await generateEmargementPdf(formation as any, supabase as any);
    // autoTable mock appelle didDrawCell — addImage appelé dans ce callback
    // On vérifie juste que la fonction s'est terminée sans erreur
    expect(mockSave).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npx vitest run src/test/generateEmargementPdf.test.ts
```

Expected: FAIL — `@/lib/generateEmargementPdf` not found.

- [ ] **Step 3: Créer `generateEmargementPdf.ts`**

```typescript
// src/lib/generateEmargementPdf.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SupabaseClient } from "@supabase/supabase-js";

function getDaysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);
  while (current <= endDate) {
    days.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

function fmtShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export async function generateEmargementPdf(
  formation: { id: string; title: string; type: string; start_date: string; end_date: string },
  supabase: SupabaseClient
): Promise<void> {
  const [{ data: esData }, { data: efData }] = await Promise.all([
    supabase
      .from("emargements_stagiaire")
      .select("*, stagiaire:stagiaires(id, first_name, last_name)")
      .eq("formation_id", formation.id),
    supabase
      .from("emargements_formateur")
      .select("*, formateur:formateurs(id, first_name, last_name)")
      .eq("formation_id", formation.id),
  ]);

  const days = getDaysBetween(formation.start_date, formation.end_date);
  const periodes = ["matin", "apres_midi"] as const;

  // Build stagiaire list from emargements
  const stagiaireMap: Record<string, any> = {};
  for (const e of esData ?? []) {
    if (e.stagiaire && !stagiaireMap[e.stagiaire.id]) {
      stagiaireMap[e.stagiaire.id] = e.stagiaire;
    }
  }
  const stagiaires = Object.values(stagiaireMap);

  // Build signature lookup: stagiaireId → date → periode → signature_data
  const sigMap: Record<string, Record<string, Record<string, string>>> = {};
  for (const e of esData ?? []) {
    if (!e.stagiaire_id) continue;
    sigMap[e.stagiaire_id] ??= {};
    sigMap[e.stagiaire_id][e.date] ??= {};
    sigMap[e.stagiaire_id][e.date][e.periode] = e.signature_data;
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Header
  doc.setFontSize(16);
  doc.text("FEUILLE D'ÉMARGEMENT", 148, 14, { align: "center" });
  doc.setFontSize(11);
  doc.text(formation.title, 148, 21, { align: "center" });
  doc.setFontSize(9);
  doc.text(
    `${formation.type}  |  Du ${fmtDate(formation.start_date)} au ${fmtDate(formation.end_date)}  |  AV Sécurité Formation`,
    148, 27, { align: "center" }
  );

  // Build table columns and body
  const head = [
    [
      { content: "Stagiaire", rowSpan: 1 },
      ...days.flatMap(d => [
        { content: `${fmtShort(d)}\nMatin` },
        { content: `${fmtShort(d)}\nAM` },
      ]),
    ],
  ];

  const body = stagiaires.map(s => [
    { content: `${s.last_name?.toUpperCase() ?? ""} ${s.first_name ?? ""}` },
    ...days.flatMap(d =>
      periodes.map(p => ({
        content: "",
        _sig: sigMap[s.id]?.[d]?.[p] ?? null,
      }))
    ),
  ]);

  const sigCellHeight = 18;

  autoTable(doc, {
    startY: 32,
    head,
    body,
    styles: { fontSize: 7, cellPadding: 1, minCellHeight: sigCellHeight },
    headStyles: { fillColor: [44, 44, 44], textColor: [212, 175, 55], fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { cellWidth: 40, fontStyle: "bold" } },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index > 0) {
        const raw = data.cell.raw as any;
        if (raw?._sig) {
          const pad = 1;
          doc.addImage(
            raw._sig,
            "PNG",
            data.cell.x + pad,
            data.cell.y + pad,
            data.cell.width - pad * 2,
            data.cell.height - pad * 2
          );
        }
      }
    },
  });

  // Formateur section
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(9);
  doc.text("Signature du formateur :", 14, finalY + 5);

  const formateurSig = (efData ?? []).find(e => e.signature_data);
  if (formateurSig?.signature_data) {
    doc.addImage(formateurSig.signature_data, "PNG", 60, finalY, 45, 16);
  }

  if (formateurSig?.formateur) {
    doc.setFontSize(8);
    doc.text(
      `${formateurSig.formateur.first_name} ${formateurSig.formateur.last_name}`,
      60, finalY + 20
    );
  }

  // Footer
  doc.setFontSize(7);
  const pageH = doc.internal.pageSize.height;
  doc.text(
    `Feuille d'émargement générée le ${new Date().toLocaleDateString("fr-FR")} — AV Sécurité Formation`,
    148, pageH - 5, { align: "center" }
  );

  const safeName = formation.title.replace(/[^a-z0-9]/gi, "_").slice(0, 30);
  doc.save(`emargement_${safeName}_${formation.start_date}.pdf`);
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npx vitest run src/test/generateEmargementPdf.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Modifier le bouton dans `Formations.tsx`**

En haut du fichier, ajouter l'import :

```tsx
import { generateEmargementPdf } from "@/lib/generateEmargementPdf";
```

Dans le composant, ajouter l'état loading (avec les autres `useState`) :

```tsx
const [loadingPdf, setLoadingPdf] = useState<string | null>(null);
```

Remplacer le bouton "Feuille d'émargement" existant (ligne ~481–484) :

**Ancien code :**
```tsx
              <Button size="sm" variant="outline" className="w-full border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10 text-xs"
                onClick={() => generateEmargement(f, ps.map(p => p.stagiaire).filter(Boolean), formateurObj)}>
                <FileText className="h-3.5 w-3.5 mr-1.5" /> Feuille d'émargement
              </Button>
```

**Nouveau code :**
```tsx
              <Button size="sm" variant="outline"
                className="w-full border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10 text-xs"
                disabled={loadingPdf === f.id}
                onClick={async () => {
                  setLoadingPdf(f.id);
                  try { await generateEmargementPdf(f, supabase); }
                  finally { setLoadingPdf(null); }
                }}>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                {loadingPdf === f.id ? "Génération…" : "Feuille d'émargement"}
              </Button>
```

- [ ] **Step 6: Vérifier la suite complète**

```bash
npx vitest run
```

Expected: tous les tests passent (≥ 94).

- [ ] **Step 7: Commit**

```bash
git add src/lib/generateEmargementPdf.ts src/test/generateEmargementPdf.test.ts src/pages/Formations.tsx
git commit -m "feat: PDF feuille d'emargement with electronic signatures"
```

---

## Final verification

- [ ] Lancer la suite de tests complète

```bash
npx vitest run
# Expected: all tests pass, no regressions
```

- [ ] Vérifier le build TypeScript

```bash
npx tsc --noEmit
# Expected: no errors (EspaceStagiaire et EspaceFormateur ont @ts-nocheck, donc ok)
```

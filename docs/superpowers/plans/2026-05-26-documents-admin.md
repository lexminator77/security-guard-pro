# Documents Admin — Convention PDF Auto + Facturation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la convention Word par un PDF auto-rempli (client depuis DB), et créer un système de facturation minimal conforme au droit français : table `factures`, page admin de suivi, PDF avec toutes les mentions légales obligatoires.

**Architecture:** `generateConventionPdf.ts` remplace le bouton convention Word dans `Formations.tsx`. `generateFacturePdf.ts` (synchrone, pas de Supabase) génère le PDF facture réutilisé depuis `Formations.tsx` (modal création) et `Facturation.tsx` (liste). `Facturation.tsx` est une nouvelle page admin listant toutes les factures avec statuts et actions.

**Tech Stack:** React 18 + TypeScript, Supabase PostgreSQL, jsPDF + jspdf-autotable (déjà installés), Shadcn UI Dialog, lucide-react, Vitest + Testing Library.

---

## File Structure

**New files:**
- `supabase/migrations/20260526120000_factures.sql` — table + fonction numérotation + RLS
- `src/lib/generateConventionPdf.ts` — génère PDF convention A4 portrait
- `src/lib/generateFacturePdf.ts` — génère PDF facture A4 portrait (synchrone)
- `src/pages/Facturation.tsx` — liste factures avec filtres, statuts, actions
- `src/test/generateConventionPdf.test.ts`
- `src/test/generateFacturePdf.test.ts`
- `src/test/Facturation.test.tsx`

**Modified files:**
- `src/pages/Formations.tsx` — remplace bouton convention, ajoute modal facture + bouton
- `src/App.tsx` — ajoute route `/facturation`
- `src/components/AppSidebar.tsx` — ajoute entrée nav "Facturation"

---

## Task 1: Migration SQL — table `factures`

**Files:**
- Create: `supabase/migrations/20260526120000_factures.sql`

- [ ] **Step 1: Créer la migration**

```sql
-- supabase/migrations/20260526120000_factures.sql

CREATE OR REPLACE FUNCTION public.generate_facture_numero()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  next_num INT;
  year_str TEXT;
BEGIN
  year_str := to_char(now(), 'YYYY');
  SELECT COALESCE(
    MAX(CAST(SPLIT_PART(numero, '-', 3) AS INT)), 0
  ) + 1
  INTO next_num
  FROM public.factures
  WHERE SPLIT_PART(numero, '-', 2) = year_str;
  RETURN 'FACT-' || year_str || '-' || lpad(next_num::text, 3, '0');
END;
$$;

CREATE TABLE public.factures (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero           TEXT NOT NULL UNIQUE DEFAULT public.generate_facture_numero(),
  formation_id     UUID REFERENCES public.formations(id) ON DELETE SET NULL,
  client_nom       TEXT NOT NULL,
  client_adresse   TEXT,
  client_siret     TEXT,
  montant_ht       NUMERIC(10,2) NOT NULL DEFAULT 0,
  participant_count INT NOT NULL DEFAULT 0,
  statut           TEXT NOT NULL DEFAULT 'brouillon'
                     CHECK (statut IN ('brouillon', 'envoye', 'paye')),
  date_emission    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_secretaire_factures" ON public.factures
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'secretaire')
    )
  );
```

- [ ] **Step 2: Appliquer via Supabase SQL Editor**

Va sur dashboard Supabase → SQL Editor → colle et exécute le SQL ci-dessus.

- [ ] **Step 3: Marquer la migration comme appliquée**

```bash
supabase migration repair --status applied 20260526120000
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260526120000_factures.sql
git commit -m "feat: add factures table with auto-numbering and RLS"
```

---

## Task 2: `generateConventionPdf` + tests + bouton dans `Formations.tsx`

**Files:**
- Create: `src/lib/generateConventionPdf.ts`
- Create: `src/test/generateConventionPdf.test.ts`
- Modify: `src/pages/Formations.tsx`

- [ ] **Step 1: Écrire les tests**

```typescript
// src/test/generateConventionPdf.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateConventionPdf } from "@/lib/generateConventionPdf";

const mockSave = vi.fn();
const mockText = vi.fn();
const mockDoc: any = {
  setFontSize: vi.fn(),
  setFont: vi.fn(),
  setTextColor: vi.fn(),
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  line: vi.fn(),
  text: mockText,
  internal: { pageSize: { height: 297, width: 210 } },
  save: mockSave,
  splitTextToSize: vi.fn().mockReturnValue(["mocked"]),
};

vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(() => mockDoc),
}));

vi.mock("jspdf-autotable", () => ({
  default: vi.fn().mockImplementation((doc: any) => {
    doc.lastAutoTable = { finalY: 150 };
  }),
}));

const formation = {
  id: "f1", title: "Formation SST", type: "SST",
  start_date: "2026-05-26", end_date: "2026-05-27",
  location: "Paris", duration_hours: 14,
};
const participants = [{ last_name: "Dupont", first_name: "Jean", tarif: 600 }];
const formateur = { first_name: "Marie", last_name: "Martin" };

const buildMock = (entreprises: any[]) => ({
  from: () => ({
    select: () => Promise.resolve({ data: entreprises, error: null }),
  }),
});

describe("generateConventionPdf", () => {
  beforeEach(() => vi.clearAllMocks());

  it("génère et sauvegarde le PDF avec le bon nom", async () => {
    await generateConventionPdf(formation, participants, formateur, buildMock([]) as any);
    expect(mockSave).toHaveBeenCalledWith("convention_SST_2026-05-26.pdf");
  });

  it("inclut le nom entreprise si une seule en DB", async () => {
    const e = [{ nom: "Sécurimax SARL", contact_nom: "Leblanc", contact_prenom: "Paul", adresse: "12 rue des Lilas", code_postal: "75001", ville: "Paris", email: "contact@securimax.fr", telephone: "0123456789", siret: "12345678900012" }];
    await generateConventionPdf(formation, participants, formateur, buildMock(e) as any);
    const textCalls = mockText.mock.calls.flat();
    expect(textCalls.some((a: any) => typeof a === "string" && a.includes("Sécurimax"))).toBe(true);
  });

  it("ne crash pas si plusieurs entreprises (section client laissée vide)", async () => {
    await generateConventionPdf(formation, participants, formateur, buildMock([{ nom: "A" }, { nom: "B" }]) as any);
    expect(mockSave).toHaveBeenCalled();
  });

  it("ne crash pas si formateur null", async () => {
    await generateConventionPdf(formation, participants, null, buildMock([]) as any);
    expect(mockSave).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npx vitest run src/test/generateConventionPdf.test.ts
```

Expected: FAIL — `@/lib/generateConventionPdf` not found.

- [ ] **Step 3: Créer `generateConventionPdf.ts`**

```typescript
// src/lib/generateConventionPdf.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SupabaseClient } from "@supabase/supabase-js";

const ORGANISME = {
  nom: "AV Sécurité Formation",
  adresse: "ADRESSE_ORGANISME",
  siret: "SIRET_ORGANISME",
  nda: "NDA_ORGANISME",
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

function separator(doc: jsPDF, y: number): void {
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.3);
  doc.line(15, y, 195, y);
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(212, 175, 55);
  doc.text(text, 15, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  return y + 6;
}

function labelValue(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(label + " :", 18, y);
  doc.setFont("helvetica", "normal");
  doc.text(value || "……………………………………………………", 70, y);
  return y + 5;
}

export async function generateConventionPdf(
  formation: { id: string; title: string; type: string; start_date: string; end_date: string; location: string | null; duration_hours: number | null },
  participants: { last_name: string; first_name: string; tarif: number | null }[],
  formateur: { first_name: string; last_name: string } | null,
  supabase: SupabaseClient
): Promise<void> {
  const { data: entreprises } = await supabase
    .from("entreprise_rh")
    .select("nom, contact_nom, contact_prenom, adresse, code_postal, ville, email, telephone, siret");
  const e = entreprises?.length === 1 ? entreprises[0] : null;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("CONVENTION DE FORMATION PROFESSIONNELLE", 105, 18, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Art. L. 6353-1 du Code du Travail", 105, 24, { align: "center" });
  separator(doc, 27);

  let y = 33;

  y = sectionTitle(doc, "Article 01 — L'ORGANISME DE FORMATION", y);
  y = labelValue(doc, "Raison sociale", ORGANISME.nom, y);
  y = labelValue(doc, "Adresse", ORGANISME.adresse, y);
  y = labelValue(doc, "SIRET", ORGANISME.siret, y);
  y = labelValue(doc, "N° déclaration d'activité", ORGANISME.nda, y);
  y += 2; separator(doc, y); y += 4;

  y = sectionTitle(doc, "Article 02 — LE CLIENT", y);
  y = labelValue(doc, "Raison sociale / Nom", e?.nom ?? "", y);
  y = labelValue(doc, "Contact", e ? `${e.contact_prenom ?? ""} ${e.contact_nom ?? ""}`.trim() : "", y);
  y = labelValue(doc, "Adresse", e ? `${e.adresse ?? ""} ${e.code_postal ?? ""} ${e.ville ?? ""}`.trim() : "", y);
  y = labelValue(doc, "Email", e?.email ?? "", y);
  y = labelValue(doc, "Téléphone", e?.telephone ?? "", y);
  y = labelValue(doc, "SIRET", e?.siret ?? "", y);
  y += 2; separator(doc, y); y += 4;

  y = sectionTitle(doc, "Article 03 — DÉSIGNATION DE LA FORMATION", y);
  y = labelValue(doc, "Intitulé", formation.title, y);
  y = labelValue(doc, "Type", formation.type, y);
  y = labelValue(doc, "Dates", `Du ${fmtDate(formation.start_date)} au ${fmtDate(formation.end_date)}`, y);
  y = labelValue(doc, "Lieu", formation.location ?? "", y);
  y = labelValue(doc, "Durée", formation.duration_hours ? `${formation.duration_hours}h` : "", y);
  y = labelValue(doc, "Formateur", formateur ? `${formateur.first_name} ${formateur.last_name}` : "", y);
  y = labelValue(doc, "Nombre de stagiaires", String(participants.length), y);
  y += 2; separator(doc, y); y += 4;

  y = sectionTitle(doc, "Article 04 — STAGIAIRES CONCERNÉS", y);
  autoTable(doc, {
    startY: y,
    head: [["Nom", "Prénom"]],
    body: participants.map(p => [p.last_name?.toUpperCase() ?? "", p.first_name ?? ""]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [44, 44, 44], textColor: [212, 175, 55], fontStyle: "bold" },
    margin: { left: 15, right: 15 },
  });
  y = (doc as any).lastAutoTable.finalY + 4;
  separator(doc, y); y += 4;

  const totalHt = participants.reduce((acc, p) => acc + (Number(p.tarif) || 0), 0);
  y = sectionTitle(doc, "Article 05 — PRIX ET MODALITÉS DE RÈGLEMENT", y);
  autoTable(doc, {
    startY: y,
    body: [
      ["Prix total HT", `${totalHt.toLocaleString("fr-FR")} €`],
      ["TVA", "Non applicable — Art. 261-4-4° du CGI"],
      ["Prise en charge OPCO / CPF / Autre", ""],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 80 } },
    margin: { left: 15, right: 15 },
  });

  const pageH = doc.internal.pageSize.height;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Convention générée le ${new Date().toLocaleDateString("fr-FR")} — AV Sécurité Formation`,
    105, pageH - 8, { align: "center" }
  );

  doc.save(`convention_${formation.type}_${formation.start_date}.pdf`);
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npx vitest run src/test/generateConventionPdf.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Mettre à jour `Formations.tsx`**

**5a — Modifier l'import ligne 17 :**

Ancien :
```tsx
import { generateAttestation, generateConvention } from "@/lib/generateDocs";
```

Nouveau :
```tsx
import { generateAttestation } from "@/lib/generateDocs";
import { generateConventionPdf } from "@/lib/generateConventionPdf";
```

**5b — Ajouter l'état `loadingConvention` après `loadingPdf` (ligne ~100) :**

```tsx
const [loadingConvention, setLoadingConvention] = useState<string | null>(null);
```

**5c — Remplacer le bouton "Convention de formation" (lignes ~499-502) :**

Ancien :
```tsx
              <Button size="sm" variant="outline" className="w-full border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10 text-xs"
                onClick={() => generateConvention(f, ps.map(p => ({ ...p.stagiaire, tarif: p.tarif })).filter(Boolean), formateurObj)}>
                <FileText className="h-3.5 w-3.5 mr-1.5" /> Convention de formation
              </Button>
```

Nouveau :
```tsx
              <Button size="sm" variant="outline"
                className="w-full border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10 text-xs"
                disabled={loadingConvention === f.id}
                onClick={async () => {
                  setLoadingConvention(f.id);
                  try {
                    await generateConventionPdf(
                      f,
                      ps.map(p => ({ ...p.stagiaire, tarif: p.tarif })).filter(Boolean),
                      formateurObj ?? null,
                      supabase
                    );
                  } catch (err: any) {
                    toast.error(err?.message ?? "Erreur lors de la génération de la convention");
                  } finally {
                    setLoadingConvention(null);
                  }
                }}>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                {loadingConvention === f.id ? "Génération…" : "Convention de formation"}
              </Button>
```

- [ ] **Step 6: Vérifier la suite complète**

```bash
npx vitest run
```

Expected: tous les tests passent (≥ 103).

- [ ] **Step 7: Commit**

```bash
git add src/lib/generateConventionPdf.ts src/test/generateConventionPdf.test.ts src/pages/Formations.tsx
git commit -m "feat: replace Word convention with PDF auto-fetch entreprise"
```

---

## Task 3: `generateFacturePdf` + tests

**Files:**
- Create: `src/lib/generateFacturePdf.ts`
- Create: `src/test/generateFacturePdf.test.ts`

- [ ] **Step 1: Écrire les tests**

```typescript
// src/test/generateFacturePdf.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateFacturePdf } from "@/lib/generateFacturePdf";

const mockSave = vi.fn();
const mockText = vi.fn();
const mockDoc: any = {
  setFontSize: vi.fn(),
  setFont: vi.fn(),
  setTextColor: vi.fn(),
  setFillColor: vi.fn(),
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  rect: vi.fn(),
  line: vi.fn(),
  text: mockText,
  internal: { pageSize: { height: 297, width: 210 } },
  save: mockSave,
  splitTextToSize: vi.fn().mockReturnValue(["mocked text"]),
};

vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(() => mockDoc),
}));

vi.mock("jspdf-autotable", () => ({
  default: vi.fn().mockImplementation((doc: any) => {
    doc.lastAutoTable = { finalY: 180 };
  }),
}));

const facture = {
  numero: "FACT-2026-001",
  client_nom: "Sécurimax SARL",
  client_adresse: "12 rue des Lilas, 75001 Paris",
  client_siret: "123 456 789 00012",
  montant_ht: 1200,
  date_emission: "2026-05-26",
  participant_count: 3,
};

const formation = {
  title: "Formation SST", type: "SST",
  start_date: "2026-05-26", end_date: "2026-05-27",
  duration_hours: 14,
};

describe("generateFacturePdf", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sauvegarde le PDF avec le bon nom de fichier", () => {
    generateFacturePdf(facture, formation);
    expect(mockSave).toHaveBeenCalledWith("facture_FACT-2026-001.pdf");
  });

  it("inclut la mention TVA obligatoire (art. 261-4-4°)", () => {
    generateFacturePdf(facture, formation);
    const textCalls = mockText.mock.calls.flat();
    expect(textCalls.some((a: any) => typeof a === "string" && a.includes("261-4-4"))).toBe(true);
  });

  it("inclut le label 'Pénalités de retard'", () => {
    generateFacturePdf(facture, formation);
    const textCalls = mockText.mock.calls.flat();
    expect(textCalls.some((a: any) => typeof a === "string" && a.includes("Pénalités"))).toBe(true);
  });

  it("ne crash pas si formation null", () => {
    generateFacturePdf(facture, null);
    expect(mockSave).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npx vitest run src/test/generateFacturePdf.test.ts
```

Expected: FAIL — `@/lib/generateFacturePdf` not found.

- [ ] **Step 3: Créer `generateFacturePdf.ts`**

```typescript
// src/lib/generateFacturePdf.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ORGANISME = {
  nom: "AV Sécurité Formation",
  adresse: "ADRESSE_ORGANISME",
  siret: "SIRET_ORGANISME",
  nda: "NDA_ORGANISME",
};

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("fr-FR");
}

export function generateFacturePdf(
  facture: {
    numero: string;
    client_nom: string;
    client_adresse: string | null;
    client_siret: string | null;
    montant_ht: number;
    date_emission: string;
    participant_count: number;
  },
  formation: {
    title: string;
    type: string;
    start_date: string;
    end_date: string;
    duration_hours: number | null;
  } | null
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Header band
  doc.setFillColor(44, 44, 44);
  doc.rect(0, 0, 210, 35, "F");
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(212, 175, 55);
  doc.text("FACTURE", 15, 18);
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 200);
  doc.text(`N° ${facture.numero}`, 15, 26);
  doc.text(`Date : ${fmtDate(facture.date_emission)}`, 195, 26, { align: "right" });

  // Organisme block (left)
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(ORGANISME.nom, 15, 45);
  doc.setFont("helvetica", "normal");
  doc.text(ORGANISME.adresse, 15, 50);
  doc.text(`SIRET : ${ORGANISME.siret}`, 15, 55);
  doc.text(`N° Déclaration d'activité : ${ORGANISME.nda}`, 15, 60);

  // Client block (right)
  doc.setFont("helvetica", "bold");
  doc.text("FACTURÉ À :", 120, 45);
  doc.setFont("helvetica", "normal");
  doc.text(facture.client_nom, 120, 50);
  if (facture.client_adresse) {
    const lines = doc.splitTextToSize(facture.client_adresse, 70);
    doc.text(lines, 120, 55);
  }
  if (facture.client_siret) {
    doc.text(`SIRET : ${facture.client_siret}`, 120, 65);
  }

  let y = 75;
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.3);
  doc.line(15, y, 195, y);
  y += 6;

  // Formation details
  if (formation) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("OBJET DE LA FACTURE", 15, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      head: [["Désignation", "Détail"]],
      body: [
        ["Intitulé de la formation", formation.title],
        ["Type", formation.type],
        ["Dates", `Du ${fmtDate(formation.start_date)} au ${fmtDate(formation.end_date)}`],
        ["Durée", formation.duration_hours ? `${formation.duration_hours} heures` : "—"],
        ["Nombre de stagiaires", String(facture.participant_count)],
      ],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [44, 44, 44], textColor: [212, 175, 55], fontStyle: "bold" },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
      margin: { left: 15, right: 15 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  } else {
    y += 6;
  }

  // Pricing table
  autoTable(doc, {
    startY: y,
    body: [
      ["Total HT", `${Number(facture.montant_ht).toLocaleString("fr-FR")} €`],
      ["TVA", "Non applicable — Art. 261-4-4° du CGI"],
      ["Total TTC", `${Number(facture.montant_ht).toLocaleString("fr-FR")} €`],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 }, 1: { halign: "right" } },
    margin: { left: 100, right: 15 },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Legal mentions
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Conditions de règlement :", 15, y);
  doc.setFont("helvetica", "normal");
  y += 4;
  doc.text("Paiement à 30 jours à réception de facture.", 15, y);
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Pénalités de retard :", 15, y);
  doc.setFont("helvetica", "normal");
  y += 4;
  const penalite = "En cas de retard de paiement, des pénalités de retard au taux de 3 fois le taux d'intérêt légal seront appliquées, ainsi qu'une indemnité forfaitaire de recouvrement de 40 €.";
  doc.text(doc.splitTextToSize(penalite, 180), 15, y);

  // Footer
  const pageH = doc.internal.pageSize.height;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.line(15, pageH - 15, 195, pageH - 15);
  doc.text(`${ORGANISME.nom} — SIRET : ${ORGANISME.siret} — N° DA : ${ORGANISME.nda}`, 105, pageH - 9, { align: "center" });
  doc.text("TVA non applicable, art. 261-4-4° du CGI", 105, pageH - 5, { align: "center" });

  doc.save(`facture_${facture.numero}.pdf`);
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npx vitest run src/test/generateFacturePdf.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Vérifier la suite complète**

```bash
npx vitest run
```

Expected: tous les tests passent (≥ 107).

- [ ] **Step 6: Commit**

```bash
git add src/lib/generateFacturePdf.ts src/test/generateFacturePdf.test.ts
git commit -m "feat: add generateFacturePdf with mandatory legal mentions"
```

---

## Task 4: Modal "Créer la facture" dans `Formations.tsx`

**Files:**
- Modify: `src/pages/Formations.tsx`

- [ ] **Step 1: Ajouter les imports manquants**

Ligne 15, ajouter `Receipt` dans l'import lucide-react :

Ancien :
```tsx
import { Plus, GraduationCap, Trash2, Calendar, MapPin, Users, UserPlus, UserCheck, Euro, FileText, Download, CheckCircle2, XCircle, Clock, Pencil } from "lucide-react";
```

Nouveau :
```tsx
import { Plus, GraduationCap, Trash2, Calendar, MapPin, Users, UserPlus, UserCheck, Euro, FileText, Download, CheckCircle2, XCircle, Clock, Pencil, Receipt } from "lucide-react";
```

Après l'import de `generateConventionPdf` (déjà ajouté en Task 2), ajouter :
```tsx
import { generateFacturePdf } from "@/lib/generateFacturePdf";
```

- [ ] **Step 2: Ajouter les états pour le modal facture**

Après `const [loadingConvention, setLoadingConvention] = useState<string | null>(null);`, ajouter :

```tsx
const [factureModal, setFactureModal] = useState<{ formation: any; participants: any[] } | null>(null);
const [factureForm, setFactureForm] = useState({ clientNom: "", clientAdresse: "", clientSiret: "", montantHt: 0, dateEmission: new Date().toISOString().slice(0, 10) });
const [creatingFacture, setCreatingFacture] = useState(false);
```

- [ ] **Step 3: Ajouter la fonction `createFacture`**

Après `updateParticipantCommentaire` (ou juste avant le `return`), ajouter :

```tsx
  const createFacture = async () => {
    if (!factureModal || !factureForm.clientNom.trim()) return;
    setCreatingFacture(true);
    try {
      const { data, error } = await supabase.from("factures").insert({
        formation_id: factureModal.formation.id,
        client_nom: factureForm.clientNom.trim(),
        client_adresse: factureForm.clientAdresse.trim() || null,
        client_siret: factureForm.clientSiret.trim() || null,
        montant_ht: factureForm.montantHt,
        participant_count: factureModal.participants.length,
        date_emission: factureForm.dateEmission,
      }).select().single();
      if (error) throw new Error(error.message);
      generateFacturePdf(data, factureModal.formation);
      toast.success(`Facture ${data.numero} créée`);
      setFactureModal(null);
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur lors de la création de la facture");
    } finally {
      setCreatingFacture(false);
    }
  };
```

- [ ] **Step 4: Ajouter le bouton "Créer la facture" dans la carte formation**

Juste après le bouton "Convention de formation" (et avant la section "Attestations individuelles"), ajouter :

```tsx
              <Button size="sm" variant="outline"
                className="w-full border-blue-400/30 text-blue-400 hover:bg-blue-400/10 text-xs"
                onClick={() => {
                  const totalTarif = ps.reduce((acc: number, p: any) => acc + (Number(p.tarif) || 0), 0);
                  setFactureForm({ clientNom: "", clientAdresse: "", clientSiret: "", montantHt: totalTarif, dateEmission: new Date().toISOString().slice(0, 10) });
                  setFactureModal({ formation: f, participants: ps });
                }}>
                <Receipt className="h-3.5 w-3.5 mr-1.5" /> Créer la facture
              </Button>
```

- [ ] **Step 5: Ajouter le Dialog modal facture**

Juste avant la dernière balise fermante `</div>` du composant principal (après tous les autres Dialog), ajouter :

```tsx
      {factureModal && (
        <Dialog open={!!factureModal} onOpenChange={(v) => !v && setFactureModal(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Créer une facture — {factureModal.formation.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-sm font-medium">Client — Nom / Raison sociale *</Label>
                <Input
                  className="mt-1"
                  value={factureForm.clientNom}
                  onChange={e => setFactureForm(f => ({ ...f, clientNom: e.target.value }))}
                  placeholder="Sécurimax SARL / Jean Dupont / France Travail…"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Adresse</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={factureForm.clientAdresse}
                  onChange={e => setFactureForm(f => ({ ...f, clientAdresse: e.target.value }))}
                  placeholder="12 rue des Lilas, 75001 Paris"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">SIRET <span className="text-muted-foreground font-normal">(optionnel — B2B)</span></Label>
                <Input
                  className="mt-1"
                  value={factureForm.clientSiret}
                  onChange={e => setFactureForm(f => ({ ...f, clientSiret: e.target.value }))}
                  placeholder="123 456 789 00012"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Montant HT (€)</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={0}
                    step={0.01}
                    value={factureForm.montantHt}
                    onChange={e => setFactureForm(f => ({ ...f, montantHt: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Date d'émission</Label>
                  <Input
                    className="mt-1"
                    type="date"
                    value={factureForm.dateEmission}
                    onChange={e => setFactureForm(f => ({ ...f, dateEmission: e.target.value }))}
                  />
                </div>
              </div>
              <Button
                className="w-full"
                disabled={!factureForm.clientNom.trim() || creatingFacture}
                onClick={createFacture}
              >
                {creatingFacture ? "Création…" : "Créer et télécharger"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
```

- [ ] **Step 6: Vérifier la suite de tests**

```bash
npx vitest run
```

Expected: tous les tests passent (≥ 107).

- [ ] **Step 7: Commit**

```bash
git add src/pages/Formations.tsx
git commit -m "feat: add facture creation modal in Formations with auto montant"
```

---

## Task 5: Page `Facturation.tsx` + tests

**Files:**
- Create: `src/pages/Facturation.tsx`
- Create: `src/test/Facturation.test.tsx`

- [ ] **Step 1: Écrire les tests**

```typescript
// src/test/Facturation.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Facturation from "@/pages/Facturation";

const mockFactures = [
  { id: "1", numero: "FACT-2026-001", client_nom: "Sécurimax SARL", montant_ht: 1200, statut: "brouillon", date_emission: "2026-05-26", participant_count: 3, formation_id: null, client_adresse: null, client_siret: null, formation: null },
  { id: "2", numero: "FACT-2026-002", client_nom: "France Travail", montant_ht: 800, statut: "paye", date_emission: "2026-05-20", participant_count: 2, formation_id: null, client_adresse: null, client_siret: null, formation: null },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: mockFactures, error: null }),
      }),
    }),
  },
}));

vi.mock("@/lib/generateFacturePdf", () => ({
  generateFacturePdf: vi.fn(),
}));

describe("Facturation", () => {
  it("affiche le titre et les factures", async () => {
    render(<Facturation />);
    expect(screen.getByText("Facturation")).toBeInTheDocument();
    expect(await screen.findByText("FACT-2026-001")).toBeInTheDocument();
    expect(await screen.findByText("FACT-2026-002")).toBeInTheDocument();
  });

  it("filtre par statut 'payé' ne montre que les factures payées", async () => {
    render(<Facturation />);
    await screen.findByText("FACT-2026-001");
    fireEvent.click(screen.getByRole("button", { name: /payé/i }));
    expect(screen.queryByText("FACT-2026-001")).not.toBeInTheDocument();
    expect(screen.getByText("FACT-2026-002")).toBeInTheDocument();
  });

  it("affiche le message vide si aucune facture correspond au filtre", async () => {
    render(<Facturation />);
    await screen.findByText("FACT-2026-001");
    fireEvent.click(screen.getByRole("button", { name: /envoyé/i }));
    expect(screen.getByText(/aucune facture/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npx vitest run src/test/Facturation.test.tsx
```

Expected: FAIL — `@/pages/Facturation` not found.

- [ ] **Step 3: Créer `Facturation.tsx`**

```tsx
// src/pages/Facturation.tsx
// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { generateFacturePdf } from "@/lib/generateFacturePdf";

type Facture = {
  id: string;
  numero: string;
  formation_id: string | null;
  client_nom: string;
  client_adresse: string | null;
  client_siret: string | null;
  montant_ht: number;
  statut: "brouillon" | "envoye" | "paye";
  date_emission: string;
  participant_count: number;
  formation: { title: string; type: string; start_date: string; end_date: string; duration_hours: number | null } | null;
};

const STATUT: Record<string, { label: string; color: string }> = {
  brouillon: { label: "Brouillon", color: "bg-muted/50 text-muted-foreground border-border/50" },
  envoye:    { label: "Envoyé",    color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  paye:      { label: "Payé",      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
};

const NEXT: Record<string, string> = { brouillon: "envoye", envoye: "paye" };

export default function Facturation() {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [filtre, setFiltre] = useState<"all" | "brouillon" | "envoye" | "paye">("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("factures")
      .select("*, formation:formations(title, type, start_date, end_date, duration_hours)")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setFactures(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateStatut = async (id: string, statut: string) => {
    const { error } = await supabase.from("factures").update({ statut }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Statut mis à jour"); load(); }
  };

  const deleteFacture = async (id: string) => {
    if (!confirm("Supprimer cette facture ?")) return;
    const { error } = await supabase.from("factures").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Facture supprimée"); load(); }
  };

  const displayed = filtre === "all" ? factures : factures.filter(f => f.statut === filtre);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Facturation</h1>

      <div className="flex gap-2 flex-wrap">
        {(["all", "brouillon", "envoye", "paye"] as const).map(s => (
          <Button key={s} size="sm" variant={filtre === s ? "default" : "outline"}
            onClick={() => setFiltre(s)}>
            {s === "all" ? "Toutes" : STATUT[s].label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : displayed.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {filtre === "all" ? "Aucune facture pour le moment." : `Aucune facture avec le statut "${STATUT[filtre]?.label}".`}
        </p>
      ) : (
        <div className="space-y-2">
          {displayed.map(f => (
            <div key={f.id} className="border border-border/50 rounded-lg p-4 bg-card/50 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-semibold">{f.numero}</span>
                  <Badge variant="outline" className={`text-xs ${STATUT[f.statut]?.color}`}>
                    {STATUT[f.statut]?.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 truncate">{f.client_nom}</p>
                {f.formation && (
                  <p className="text-xs text-muted-foreground/70 truncate">{f.formation.title}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold">{Number(f.montant_ht).toLocaleString("fr-FR")} € HT</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(f.date_emission).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                <Button size="sm" variant="outline"
                  onClick={() => generateFacturePdf(f, f.formation ?? null)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {NEXT[f.statut] && (
                  <Button size="sm" variant="outline"
                    onClick={() => updateStatut(f.id, NEXT[f.statut])}>
                    → {STATUT[NEXT[f.statut]]?.label}
                  </Button>
                )}
                {f.statut === "brouillon" && (
                  <Button size="sm" variant="outline"
                    className="text-destructive hover:bg-destructive/10 border-destructive/30"
                    onClick={() => deleteFacture(f.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Vérifier que les tests passent**

```bash
npx vitest run src/test/Facturation.test.tsx
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Vérifier la suite complète**

```bash
npx vitest run
```

Expected: tous les tests passent (≥ 110).

- [ ] **Step 6: Commit**

```bash
git add src/pages/Facturation.tsx src/test/Facturation.test.tsx
git commit -m "feat: add Facturation page with list, filters and status management"
```

---

## Task 6: Routing + navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppSidebar.tsx`

- [ ] **Step 1: Ajouter la route dans `App.tsx`**

Ajouter l'import après `import Statistiques from "./pages/Statistiques";` (ligne ~32) :

```tsx
import Facturation from "./pages/Facturation";
```

Ajouter la route après `<Route path="/statistiques" element={<Statistiques />} />` (ligne ~62) :

```tsx
              <Route path="/facturation" element={<Facturation />} />
```

- [ ] **Step 2: Ajouter l'icône `Receipt` dans `AppSidebar.tsx`**

Ligne 4, dans l'import lucide-react, ajouter `Receipt` :

Ancien :
```tsx
  Calendar, FileText, BarChart3, Shield,
```

Nouveau :
```tsx
  Calendar, FileText, BarChart3, Shield, Receipt,
```

- [ ] **Step 3: Ajouter l'entrée nav dans `AppSidebar.tsx`**

Dans le tableau `allItems`, après la ligne "Documents" :

```tsx
  { title: "Documents", url: "/documents", icon: FileText, roles: ["administrateur","secretaire"] },
```

Ajouter :

```tsx
  { title: "Facturation", url: "/facturation", icon: Receipt, roles: ["administrateur","secretaire"] },
```

- [ ] **Step 4: Vérifier la suite complète**

```bash
npx vitest run
```

Expected: tous les tests passent (≥ 110).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/AppSidebar.tsx
git commit -m "feat: add /facturation route and nav entry for admin/secretaire"
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
# Expected: no errors (fichiers avec @ts-nocheck ignorés)
```

- [ ] **Rappel post-déploiement :** remplacer dans `generateConventionPdf.ts` et `generateFacturePdf.ts` :
  - `ADRESSE_ORGANISME` → adresse réelle
  - `SIRET_ORGANISME` → SIRET réel
  - `NDA_ORGANISME` → numéro de déclaration d'activité DREETS réel

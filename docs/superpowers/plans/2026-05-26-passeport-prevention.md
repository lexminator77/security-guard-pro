# Passeport de Prévention — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un passeport de prévention consultable en ligne et téléchargeable en PDF, récapitulant toutes les formations suivies et certifications d'un stagiaire, accessible depuis l'espace stagiaire et le panneau admin.

**Architecture:** Page standalone `PasseportPrevention.tsx` à `/passeport-prevention/:stagiaireId` (hors ProtectedRoute/AppLayout — vue document sans sidebar). Trois requêtes Supabase en lecture seule (stagiaires + formation_participants + certifications). PDF généré à la volée par `generatePasseportPdf.ts` (pattern jsPDF + jspdf-autotable). Bouton dans `Stagiaires.tsx` (admin) et dans `EspaceStagiaire.tsx` (stagiaire connecté).

**Tech Stack:** React 18 + TypeScript, Supabase PostgreSQL, Shadcn UI Badge/Button, lucide-react (BookOpen, Download, ArrowLeft), jsPDF + jspdf-autotable, Vitest + Testing Library.

---

## File Structure

**Nouveaux :**
- `src/lib/generatePasseportPdf.ts` — générateur PDF (jsPDF + autotable)
- `src/pages/PasseportPrevention.tsx` — page vue en ligne + bouton PDF
- `src/test/PasseportPrevention.test.tsx` — 3 tests

**Modifiés :**
- `src/pages/Stagiaires.tsx` — bouton "Passeport de prévention" dans le panneau détail
- `src/pages/EspaceStagiaire.tsx` — bouton "Mon passeport" navigant vers la page
- `src/App.tsx` — route `/passeport-prevention/:stagiaireId` hors ProtectedRoute

---

## Task 1: `generatePasseportPdf.ts`

**Files:**
- Create: `src/lib/generatePasseportPdf.ts`

- [ ] **Step 1: Créer `src/lib/generatePasseportPdf.ts`**

```typescript
// src/lib/generatePasseportPdf.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ORGANISME = "AV Sécurité Formation";

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR");
}

function separator(doc: jsPDF, y: number): void {
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.3);
  doc.line(15, y, 195, y);
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  if (y > 265) { doc.addPage(); y = 20; }
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(212, 175, 55);
  doc.text(text, 15, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  return y + 6;
}

function labelValue(doc: jsPDF, label: string, value: string, y: number): number {
  if (y > 270) { doc.addPage(); y = 20; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(label + " :", 18, y);
  doc.setFont("helvetica", "normal");
  doc.text(value || "……………………………………………………", 70, y);
  return y + 5;
}

type Stagiaire = {
  first_name: string;
  last_name: string;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  carte_pro_number: string | null;
  carte_pro_expiry: string | null;
  autorisation_numero: string | null;
  autorisation_type: string | null;
  autorisation_expiry: string | null;
};

type Participation = {
  status: string;
  resultat: string | null;
  formation: {
    title: string;
    type: string;
    start_date: string;
    end_date: string;
    duration_hours: number | null;
  } | null;
};

type CertificationItem = {
  type: string;
  date_obtention: string;
  date_expiration: string | null;
  formation: { title: string } | null;
};

const STATUT_LABEL: Record<string, string> = {
  inscrit: "Inscrit", present: "Présent", absent: "Absent", valide: "Validé", echec: "Échec",
};
const RESULTAT_LABEL: Record<string, string> = {
  obtenu: "Obtenu", en_attente: "En attente",
};

export async function generatePasseportPdf(
  stagiaire: Stagiaire,
  participations: Participation[],
  certifications: CertificationItem[]
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // En-tête
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("PASSEPORT DE PRÉVENTION", 105, 18, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Loi Santé au Travail — 2 août 2021", 105, 24, { align: "center" });
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(ORGANISME, 105, 29, { align: "center" });
  doc.setTextColor(30, 30, 30);
  separator(doc, 32);

  let y = 38;

  // Article 01 — Titulaire
  y = sectionTitle(doc, "Article 01 — TITULAIRE", y);
  y = labelValue(doc, "Nom", stagiaire.last_name.toUpperCase(), y);
  y = labelValue(doc, "Prénom", stagiaire.first_name, y);
  y = labelValue(doc, "Date de naissance", fmtDate(stagiaire.birth_date), y);
  y = labelValue(doc, "Email", stagiaire.email ?? "", y);
  y = labelValue(doc, "Téléphone", stagiaire.phone ?? "", y);
  y += 2; separator(doc, y); y += 4;

  // Article 02 — Carte professionnelle CNAPS
  y = sectionTitle(doc, "Article 02 — CARTE PROFESSIONNELLE CNAPS", y);
  y = labelValue(doc, "N° carte professionnelle", stagiaire.carte_pro_number ?? "", y);
  y = labelValue(doc, "Expiration carte pro", fmtDate(stagiaire.carte_pro_expiry), y);
  y = labelValue(doc, "Type d'autorisation", stagiaire.autorisation_type ?? "", y);
  y = labelValue(doc, "N° autorisation", stagiaire.autorisation_numero ?? "", y);
  y = labelValue(doc, "Expiration autorisation", fmtDate(stagiaire.autorisation_expiry), y);
  y += 2; separator(doc, y); y += 4;

  // Article 03 — Formations suivies
  y = sectionTitle(doc, "Article 03 — FORMATIONS SUIVIES", y);
  if (participations.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("Aucune formation enregistrée.", 18, y);
    doc.setTextColor(30, 30, 30);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Intitulé", "Type", "Du", "Au", "Durée", "Statut", "Résultat"]],
      body: participations.map(p => [
        p.formation?.title ?? "—",
        p.formation?.type ?? "—",
        fmtDate(p.formation?.start_date),
        fmtDate(p.formation?.end_date),
        p.formation?.duration_hours ? `${p.formation.duration_hours}h` : "—",
        STATUT_LABEL[p.status] ?? p.status,
        p.resultat ? (RESULTAT_LABEL[p.resultat] ?? p.resultat) : "—",
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [44, 44, 44], textColor: [212, 175, 55], fontStyle: "bold" },
      margin: { left: 15, right: 15 },
    });
    y = ((doc as any).lastAutoTable?.finalY ?? y + 20) + 4;
  }
  separator(doc, y); y += 4;

  // Article 04 — Certifications
  y = sectionTitle(doc, "Article 04 — CERTIFICATIONS OBTENUES", y);
  if (certifications.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("Aucune certification enregistrée.", 18, y);
    doc.setTextColor(30, 30, 30);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Type", "Date obtention", "Expiration", "Formation associée"]],
      body: certifications.map(c => [
        c.type.toUpperCase(),
        fmtDate(c.date_obtention),
        fmtDate(c.date_expiration),
        c.formation?.title ?? "—",
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [44, 44, 44], textColor: [212, 175, 55], fontStyle: "bold" },
      margin: { left: 15, right: 15 },
    });
  }

  // Pied de page
  const pageH = doc.internal.pageSize.height;
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Passeport généré le ${new Date().toLocaleDateString("fr-FR")} — ${ORGANISME}`,
    105, pageH - 8, { align: "center" }
  );

  doc.save(`passeport_${stagiaire.last_name.toUpperCase()}_${stagiaire.first_name}.pdf`);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/generatePasseportPdf.ts
git commit -m "feat: add generatePasseportPdf"
```

---

## Task 2: Page `PasseportPrevention.tsx` + tests (TDD)

**Files:**
- Create: `src/test/PasseportPrevention.test.tsx`
- Create: `src/pages/PasseportPrevention.tsx`

- [ ] **Step 1: Écrire les tests en premier**

```typescript
// src/test/PasseportPrevention.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PasseportPrevention from "@/pages/PasseportPrevention";

const mockStagiaire = {
  id: "s1",
  first_name: "Jean",
  last_name: "Dupont",
  birth_date: "1990-05-15",
  email: "jean@example.com",
  phone: "0600000000",
  carte_pro_number: "CNAPS-001",
  carte_pro_expiry: "2027-01-01",
  autorisation_numero: null,
  autorisation_type: null,
  autorisation_expiry: null,
};

const mockParticipations = [
  {
    status: "valide",
    resultat: "obtenu",
    formation: { title: "Formation SST", type: "SST", start_date: "2026-04-01", end_date: "2026-04-02", duration_hours: 14 },
  },
  {
    status: "present",
    resultat: null,
    formation: { title: "Formation CQP", type: "CQP", start_date: "2026-03-01", end_date: "2026-03-03", duration_hours: 21 },
  },
];

const mockCertifications = [
  {
    type: "sst",
    date_obtention: "2026-04-02",
    date_expiration: "2026-01-01", // passé → expiré
    formation: { title: "Formation SST" },
  },
  {
    type: "mac_aps",
    date_obtention: "2026-05-01",
    date_expiration: "2028-05-01", // futur → valide
    formation: null,
  },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "stagiaires") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockStagiaire, error: null }),
            }),
          }),
        };
      }
      if (table === "formation_participants") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockParticipations, error: null }),
            }),
          }),
        };
      }
      if (table === "certifications") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: mockCertifications, error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null }),
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "admin@test.com" }, roles: ["administrateur"] }),
}));

vi.mock("@/lib/generatePasseportPdf", () => ({
  generatePasseportPdf: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/passeport-prevention/s1"]}>
      <Routes>
        <Route path="/passeport-prevention/:stagiaireId" element={<PasseportPrevention />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PasseportPrevention", () => {
  it("affiche l'identité et les formations du stagiaire", async () => {
    renderPage();
    expect(await screen.findByText(/DUPONT/)).toBeInTheDocument();
    expect(await screen.findByText("Formation SST")).toBeInTheDocument();
    expect(await screen.findByText("Formation CQP")).toBeInTheDocument();
  });

  it("affiche badge Expiré pour certification passée et Valide pour certification future", async () => {
    renderPage();
    await screen.findByText(/DUPONT/);
    expect(screen.getByText("Expiré")).toBeInTheDocument();
    expect(screen.getByText("Valide")).toBeInTheDocument();
  });

  it("clic sur Télécharger appelle generatePasseportPdf", async () => {
    const { generatePasseportPdf } = await import("@/lib/generatePasseportPdf");
    renderPage();
    const btn = await screen.findByRole("button", { name: /télécharger/i });
    fireEvent.click(btn);
    await waitFor(() => expect(generatePasseportPdf).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
cd /Users/lexminator/security-guard-pro && npx vitest run src/test/PasseportPrevention.test.tsx 2>&1 | tail -10
```

Expected: FAIL — `@/pages/PasseportPrevention` not found.

- [ ] **Step 3: Créer `src/pages/PasseportPrevention.tsx`**

```tsx
// src/pages/PasseportPrevention.tsx
// @ts-nocheck
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, Download, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { generatePasseportPdf } from "@/lib/generatePasseportPdf";

type Stagiaire = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  carte_pro_number: string | null;
  carte_pro_expiry: string | null;
  autorisation_numero: string | null;
  autorisation_type: string | null;
  autorisation_expiry: string | null;
};

type Participation = {
  status: string;
  resultat: string | null;
  formation: {
    title: string;
    type: string;
    start_date: string;
    end_date: string;
    duration_hours: number | null;
  } | null;
};

type CertificationItem = {
  type: string;
  date_obtention: string;
  date_expiration: string | null;
  formation: { title: string } | null;
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("fr-FR");
}

function ValiditeBadge({ dateExpiration }: { dateExpiration: string | null }) {
  if (!dateExpiration) return <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground border-border/50">Sans limite</Badge>;
  const days = Math.ceil((new Date(dateExpiration + "T00:00:00").getTime() - Date.now()) / 86400000);
  if (days < 0) return <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">Expiré</Badge>;
  if (days <= 60) return <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-400 border-orange-500/30">Expire bientôt</Badge>;
  return <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">Valide</Badge>;
}

const STATUT_LABEL: Record<string, string> = {
  inscrit: "Inscrit", present: "Présent", absent: "Absent", valide: "Validé", echec: "Échec",
};
const RESULTAT_LABEL: Record<string, string> = {
  obtenu: "Obtenu", en_attente: "En attente",
};

export default function PasseportPrevention() {
  const { stagiaireId: paramId } = useParams<{ stagiaireId: string }>();
  const navigate = useNavigate();
  const { user, roles } = useAuth();

  const [stagiaire, setStagiaire] = useState<Stagiaire | null>(null);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [certifications, setCertifications] = useState<CertificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [effectiveId, setEffectiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const isStagiaire = (roles as string[]).includes("stagiaire");
    if (isStagiaire) {
      supabase.from("stagiaires").select("id").eq("auth_user_id", user.id).single()
        .then(({ data }) => {
          if (data) setEffectiveId(data.id);
          else setLoading(false);
        });
    } else {
      setEffectiveId(paramId ?? null);
    }
  }, [user, roles, paramId]);

  useEffect(() => {
    if (!effectiveId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase
        .from("stagiaires")
        .select("id, first_name, last_name, birth_date, email, phone, carte_pro_number, carte_pro_expiry, autorisation_numero, autorisation_type, autorisation_expiry")
        .eq("id", effectiveId)
        .single(),
      supabase
        .from("formation_participants")
        .select("status, resultat, formation:formations(title, type, start_date, end_date, duration_hours)")
        .eq("stagiaire_id", effectiveId)
        .order("created_at", { ascending: false }),
      supabase
        .from("certifications")
        .select("type, date_obtention, date_expiration, formation:formations(title)")
        .eq("stagiaire_id", effectiveId)
        .order("date_obtention", { ascending: false }),
    ]).then(([s, p, c]) => {
      if (cancelled) return;
      if (s.error) toast.error(s.error.message);
      else setStagiaire(s.data);
      if (p.error) toast.error(p.error.message);
      else setParticipations(p.data ?? []);
      if (c.error) toast.error(c.error.message);
      else setCertifications(c.data ?? []);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [effectiveId]);

  const handleDownload = async () => {
    if (!stagiaire) return;
    setGenerating(true);
    try {
      await generatePasseportPdf(stagiaire, participations, certifications);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur PDF");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground text-sm">Chargement…</div>;
  if (!stagiaire) return <div className="p-8 text-muted-foreground text-sm">Passeport introuvable.</div>;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <BookOpen className="h-6 w-6 text-yellow-400" />
          <h1 className="text-2xl font-bold">Passeport de Prévention</h1>
        </div>
        <Button onClick={handleDownload} disabled={generating}>
          <Download className="h-4 w-4 mr-2" />
          {generating ? "Génération…" : "Télécharger PDF"}
        </Button>
      </div>

      <div className="border border-border/50 rounded-lg p-4 bg-card/50 space-y-1">
        <h2 className="text-lg font-bold">{stagiaire.last_name.toUpperCase()} {stagiaire.first_name}</h2>
        {stagiaire.birth_date && (
          <p className="text-sm text-muted-foreground">Né(e) le {fmtDate(stagiaire.birth_date)}</p>
        )}
        <p className="text-sm text-muted-foreground">
          {stagiaire.email}{stagiaire.phone ? ` · ${stagiaire.phone}` : ""}
        </p>
        <div className="pt-1 text-sm">
          <span className="font-medium">Carte pro CNAPS : </span>
          {stagiaire.carte_pro_number
            ? `${stagiaire.carte_pro_number} (exp. ${fmtDate(stagiaire.carte_pro_expiry)})`
            : "Non renseignée"}
        </div>
        {stagiaire.autorisation_numero && (
          <div className="text-sm">
            <span className="font-medium">Autorisation : </span>
            {stagiaire.autorisation_type} · {stagiaire.autorisation_numero}
            {stagiaire.autorisation_expiry ? ` (exp. ${fmtDate(stagiaire.autorisation_expiry)})` : ""}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-widest">
          Formations suivies ({participations.length})
        </h3>
        {participations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune formation enregistrée.</p>
        ) : (
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="text-left p-3 font-medium text-xs">Intitulé</th>
                  <th className="text-left p-3 font-medium text-xs">Type</th>
                  <th className="text-left p-3 font-medium text-xs">Période</th>
                  <th className="text-left p-3 font-medium text-xs">Durée</th>
                  <th className="text-left p-3 font-medium text-xs">Statut</th>
                  <th className="text-left p-3 font-medium text-xs">Résultat</th>
                </tr>
              </thead>
              <tbody>
                {participations.map((p, i) => (
                  <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                    <td className="p-3">{p.formation?.title ?? "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs">{p.formation?.type ?? "—"}</td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {fmtDate(p.formation?.start_date)} → {fmtDate(p.formation?.end_date)}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">
                      {p.formation?.duration_hours ? `${p.formation.duration_hours}h` : "—"}
                    </td>
                    <td className="p-3 text-xs">{STATUT_LABEL[p.status] ?? p.status}</td>
                    <td className="p-3 text-xs">
                      {p.resultat ? (RESULTAT_LABEL[p.resultat] ?? p.resultat) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-widest">
          Certifications ({certifications.length})
        </h3>
        {certifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune certification enregistrée.</p>
        ) : (
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="text-left p-3 font-medium text-xs">Type</th>
                  <th className="text-left p-3 font-medium text-xs">Obtention</th>
                  <th className="text-left p-3 font-medium text-xs">Expiration</th>
                  <th className="text-left p-3 font-medium text-xs">Formation</th>
                  <th className="text-left p-3 font-medium text-xs">Validité</th>
                </tr>
              </thead>
              <tbody>
                {certifications.map((c, i) => (
                  <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                    <td className="p-3 font-medium text-xs">{c.type.toUpperCase()}</td>
                    <td className="p-3 text-muted-foreground text-xs">{fmtDate(c.date_obtention)}</td>
                    <td className="p-3 text-muted-foreground text-xs">{fmtDate(c.date_expiration)}</td>
                    <td className="p-3 text-muted-foreground text-xs">{c.formation?.title ?? "—"}</td>
                    <td className="p-3"><ValiditeBadge dateExpiration={c.date_expiration} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Vérifier que les 3 tests passent**

```bash
cd /Users/lexminator/security-guard-pro && npx vitest run src/test/PasseportPrevention.test.tsx 2>&1 | tail -20
```

Expected: 3/3 PASS. Si un test échoue, déboguer et corriger avant de continuer.

- [ ] **Step 5: Vérifier la suite complète**

```bash
cd /Users/lexminator/security-guard-pro && npx vitest run 2>&1 | tail -10
```

Expected: tous les tests passent (≥ 122), aucune régression.

- [ ] **Step 6: Commit**

```bash
git add src/pages/PasseportPrevention.tsx src/test/PasseportPrevention.test.tsx
git commit -m "feat: add PasseportPrevention page with certification validity badges"
```

---

## Task 3: Intégrations — Stagiaires.tsx et EspaceStagiaire.tsx

**Files:**
- Modify: `src/pages/Stagiaires.tsx`
- Modify: `src/pages/EspaceStagiaire.tsx`

- [ ] **Step 1: Ajouter `useNavigate` et le bouton dans `Stagiaires.tsx`**

Ouvrir `src/pages/Stagiaires.tsx`. Trouver la ligne d'import react-router-dom (probablement absente — vérifier). Si absente, ajouter :
```tsx
import { useNavigate } from "react-router-dom";
```

Si présente, ajouter `useNavigate` à l'import existant.

Dans l'import lucide-react, ajouter `BookOpen` si absent.

Dans le composant `Stagiaires`, ajouter le hook (dans le corps de la fonction, avec les autres hooks) :
```tsx
const navigate = useNavigate();
```

Trouver le panneau détail du stagiaire (bloc `if (selected) { ... }`). Chercher les boutons d'action existants (Archive, Réactiver, etc.). Ajouter ce bouton dans ce groupe de boutons :
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => navigate(`/passeport-prevention/${selected.id}`)}
>
  <BookOpen className="h-4 w-4 mr-2" />
  Passeport de prévention
</Button>
```

- [ ] **Step 2: Ajouter la navigation dans `EspaceStagiaire.tsx`**

Ouvrir `src/pages/EspaceStagiaire.tsx`. La variable `stagiaireId` (string | null) est déjà disponible dans ce composant (l'exploration a confirmé ligne 112 : `const [stagiaireId, setStagiaireId] = useState<string | null>(null)`).

Trouver l'import de `useNavigate` ou ajouter au besoin depuis react-router-dom. Rechercher `useNavigate` dans le fichier — s'il n'est pas déjà importé, ajouter :
```tsx
import { useNavigate } from "react-router-dom";
```
Et dans la fonction principale :
```tsx
const navigate = useNavigate();
```

Trouver la zone de navigation latérale (sidebar) de l'EspaceStagiaire. Les liens de navigation utilisent `setPage(id as Page)`. Trouver un endroit logique (par exemple après le bouton "Profil" ou dans la section principale du dashboard). Ajouter un bouton qui navigue vers le passeport :

Dans le rendu du dashboard (case "dashboard" du switch ou dans la section principale), ajouter :
```tsx
<Button
  variant="outline"
  size="sm"
  disabled={!stagiaireId}
  onClick={() => stagiaireId && navigate(`/passeport-prevention/${stagiaireId}`)}
>
  <BookOpen className="h-4 w-4 mr-2" />
  Mon passeport de prévention
</Button>
```

Note : `BookOpen` est déjà importé dans `EspaceStagiaire.tsx` (confirmé à la ligne 9 de l'exploration).

- [ ] **Step 3: Vérifier la suite complète**

```bash
cd /Users/lexminator/security-guard-pro && npx vitest run 2>&1 | tail -10
```

Expected: ≥ 125 tests passent, aucune régression.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Stagiaires.tsx src/pages/EspaceStagiaire.tsx
git commit -m "feat: add Passeport de prévention button in Stagiaires and EspaceStagiaire"
```

---

## Task 4: Route dans `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Ajouter l'import et la route**

Ouvrir `src/App.tsx`. Ajouter l'import parmi les autres imports de pages :
```tsx
import PasseportPrevention from "./pages/PasseportPrevention";
```

La route doit être placée **en dehors** du bloc `<Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>` car les stagiaires n'ont pas accès aux routes sous ProtectedRoute/AppLayout. Ajouter après la route `/espace-rh` :
```tsx
<Route path="/passeport-prevention/:stagiaireId" element={<PasseportPrevention />} />
```

Le fichier `App.tsx` après modification (section Routes) doit ressembler à :
```tsx
<Routes>
  <Route path="/auth" element={<Auth />} />
  <Route path="/reset-password" element={<ResetPassword />} />
  <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
    {/* ... toutes les routes admin ... */}
  </Route>
  <Route path="/espace-stagiaire" element={<EspaceStagiaire />} />
  <Route path="/espace-formateur" element={<EspaceFormateur />} />
  <Route path="/espace-rh" element={<EspaceRH />} />
  <Route path="/passeport-prevention/:stagiaireId" element={<PasseportPrevention />} />
  <Route path="/q/:token" element={<QuestionnairePublic />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

- [ ] **Step 2: Vérifier la suite complète**

```bash
cd /Users/lexminator/security-guard-pro && npx vitest run 2>&1 | tail -10
```

Expected: ≥ 125 tests passent.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add /passeport-prevention/:stagiaireId route"
```

---

## Rappel post-déploiement

Aucune migration à appliquer — cette feature utilise uniquement des tables existantes.

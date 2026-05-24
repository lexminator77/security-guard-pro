# Qualiopi Quick Wins — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter les questionnaires Qualiopi (positionnement + satisfaction à chaud/froid) avec envoi email, un registre des réclamations, et l'export BPF annuel.

**Architecture:** Trois subsystèmes indépendants sur la base Supabase existante. Les questionnaires reposent sur des tokens UUID publics accessibles sans auth. Les réclamations sont un CRUD admin pur. Le BPF agrège les données côté client et génère un CSV.

**Tech Stack:** React 18 + TypeScript, Supabase (PostgreSQL + Edge Functions + RLS), Resend (email via API REST dans Deno), Vitest + Testing Library. Pas de nouvelle dépendance npm (CSV natif JS).

---

## File Structure

**New files:**
- `supabase/migrations/20260524140000_questionnaire_tokens.sql` — table questionnaire_tokens + RLS
- `supabase/migrations/20260524140001_reclamations.sql` — table reclamations + RLS
- `supabase/migrations/20260524140002_formations_bpf_columns.sql` — ajoute prix_ht, duration_hours
- `supabase/functions/submit-questionnaire/index.ts` — Edge Function publique (écriture réponses)
- `supabase/functions/send-questionnaire/index.ts` — Edge Function admin (crée tokens + envoie emails)
- `src/lib/questionnaireQuestions.ts` — questions hardcodées par type
- `src/pages/QuestionnairePublic.tsx` — page publique `/q/:token`
- `src/pages/Reclamations.tsx` — page admin réclamations
- `src/test/QuestionnairePublic.test.tsx`
- `src/test/Reclamations.test.tsx`

**Modified files:**
- `src/App.tsx` — ajoute routes `/q/:token` et `/reclamations`
- `src/components/AppSidebar.tsx` — ajoute entrée "Réclamations" dans allItems
- `src/pages/Formations.tsx` — ajoute section Questionnaires dans FormationCard + champs prix_ht/duration_hours
- `src/pages/Statistiques.tsx` — ajoute bloc BPF export

---

## Task 1: DB Migrations

**Files:**
- Create: `supabase/migrations/20260524140000_questionnaire_tokens.sql`
- Create: `supabase/migrations/20260524140001_reclamations.sql`
- Create: `supabase/migrations/20260524140002_formations_bpf_columns.sql`

- [ ] **Step 1: Write the failing test (migration idempotency)**

```bash
# Pas de test automatisé pour les migrations — vérification manuelle en Step 4
echo "Migrations will be verified with supabase db reset"
```

- [ ] **Step 2: Create `20260524140000_questionnaire_tokens.sql`**

```sql
-- supabase/migrations/20260524140000_questionnaire_tokens.sql

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'questionnaire_type') THEN
    CREATE TYPE public.questionnaire_type AS ENUM (
      'positionnement',
      'satisfaction_chaud',
      'satisfaction_froid'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.questionnaire_tokens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token          uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  formation_id   uuid NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  stagiaire_id   uuid NOT NULL REFERENCES public.stagiaires(id) ON DELETE CASCADE,
  type           public.questionnaire_type NOT NULL,
  sent_at        timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  reponses       jsonb,
  UNIQUE(formation_id, stagiaire_id, type)
);

ALTER TABLE public.questionnaire_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS qt_admin_all ON public.questionnaire_tokens;
CREATE POLICY qt_admin_all ON public.questionnaire_tokens
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'administrateur') OR has_role(auth.uid(), 'secretaire'))
  WITH CHECK (has_role(auth.uid(), 'administrateur') OR has_role(auth.uid(), 'secretaire'));
```

- [ ] **Step 3: Create `20260524140001_reclamations.sql`**

```sql
-- supabase/migrations/20260524140001_reclamations.sql

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reclamation_demandeur_type') THEN
    CREATE TYPE public.reclamation_demandeur_type AS ENUM ('stagiaire', 'entreprise', 'autre');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reclamation_statut') THEN
    CREATE TYPE public.reclamation_statut AS ENUM ('ouverte', 'en_cours', 'cloturee');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.reclamations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_reclamation date NOT NULL DEFAULT CURRENT_DATE,
  demandeur_nom    text NOT NULL,
  demandeur_type   public.reclamation_demandeur_type NOT NULL,
  objet            text NOT NULL,
  description      text NOT NULL,
  statut           public.reclamation_statut NOT NULL DEFAULT 'ouverte',
  reponse          text,
  date_cloture     date,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reclamations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rec_admin_all ON public.reclamations;
CREATE POLICY rec_admin_all ON public.reclamations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'administrateur') OR has_role(auth.uid(), 'secretaire'))
  WITH CHECK (has_role(auth.uid(), 'administrateur') OR has_role(auth.uid(), 'secretaire'));
```

- [ ] **Step 4: Create `20260524140002_formations_bpf_columns.sql`**

```sql
-- supabase/migrations/20260524140002_formations_bpf_columns.sql

ALTER TABLE public.formations
  ADD COLUMN IF NOT EXISTS prix_ht NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(5,1) DEFAULT 0;
```

- [ ] **Step 5: Apply migrations locally and verify**

```bash
npx supabase db reset
# Expected: "Finished supabase db reset" with no errors
```

Vérifier que les tables existent :
```bash
npx supabase db diff
# Expected: no diff (migrations applied cleanly)
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260524140000_questionnaire_tokens.sql
git add supabase/migrations/20260524140001_reclamations.sql
git add supabase/migrations/20260524140002_formations_bpf_columns.sql
git commit -m "feat: add questionnaire_tokens, reclamations tables and BPF columns on formations"
```

---

## Task 2: Question definitions

**Files:**
- Create: `src/lib/questionnaireQuestions.ts`
- Test: `src/test/questionnaireQuestions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/test/questionnaireQuestions.test.ts
import { describe, it, expect } from "vitest";
import { QUESTIONS, type QuestionDef } from "@/lib/questionnaireQuestions";

describe("QUESTIONS", () => {
  it("has at least 10 questions for positionnement", () => {
    expect(QUESTIONS.positionnement.length).toBeGreaterThanOrEqual(10);
  });

  it("has at least 10 questions for satisfaction_chaud", () => {
    expect(QUESTIONS.satisfaction_chaud.length).toBeGreaterThanOrEqual(10);
  });

  it("has at least 10 questions for satisfaction_froid", () => {
    expect(QUESTIONS.satisfaction_froid.length).toBeGreaterThanOrEqual(10);
  });

  it("every question has id, label, and type", () => {
    const all: QuestionDef[] = [
      ...QUESTIONS.positionnement,
      ...QUESTIONS.satisfaction_chaud,
      ...QUESTIONS.satisfaction_froid,
    ];
    for (const q of all) {
      expect(q.id).toBeTruthy();
      expect(q.label).toBeTruthy();
      expect(["scale", "boolean", "text", "select", "boolean_text"]).toContain(q.type);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/test/questionnaireQuestions.test.ts
# Expected: FAIL — Cannot find module '@/lib/questionnaireQuestions'
```

- [ ] **Step 3: Create `src/lib/questionnaireQuestions.ts`**

```typescript
// src/lib/questionnaireQuestions.ts

export type QuestionType = "scale" | "boolean" | "text" | "select" | "boolean_text";

export interface QuestionDef {
  id: string;
  label: string;
  type: QuestionType;
  options?: string[];
}

export const QUESTIONS: Record<"positionnement" | "satisfaction_chaud" | "satisfaction_froid", QuestionDef[]> = {
  positionnement: [
    { id: "p1", label: "Quel est votre niveau d'expérience dans ce domaine ?", type: "scale" },
    { id: "p2", label: "Avez-vous déjà suivi une formation similaire ?", type: "boolean" },
    { id: "p3", label: "Si oui, il y a combien de temps ?", type: "text" },
    { id: "p4", label: "Quel est votre poste actuel ?", type: "text" },
    { id: "p5", label: "Depuis combien d'années exercez-vous ce métier ?", type: "text" },
    { id: "p6", label: "Quels sont vos objectifs principaux pour cette formation ?", type: "text" },
    { id: "p7", label: "Quelles compétences souhaitez-vous développer en priorité ?", type: "text" },
    { id: "p8", label: "Avez-vous des contraintes particulières (handicap, langue, etc.) ?", type: "boolean_text" },
    { id: "p9", label: "Comment avez-vous entendu parler de cette formation ?", type: "text" },
    { id: "p10", label: "Quelles sont vos disponibilités et contraintes d'organisation ?", type: "text" },
  ],
  satisfaction_chaud: [
    { id: "sc1", label: "La formation a répondu à vos attentes.", type: "scale" },
    { id: "sc2", label: "Les objectifs pédagogiques ont été atteints.", type: "scale" },
    { id: "sc3", label: "Le contenu était adapté à votre niveau.", type: "scale" },
    { id: "sc4", label: "Le formateur maîtrisait son sujet.", type: "scale" },
    { id: "sc5", label: "Le formateur était disponible et à l'écoute.", type: "scale" },
    { id: "sc6", label: "Les supports pédagogiques étaient clairs et utiles.", type: "scale" },
    { id: "sc7", label: "La durée de la formation était adaptée.", type: "scale" },
    { id: "sc8", label: "Les conditions d'accueil et le lieu étaient satisfaisants.", type: "scale" },
    { id: "sc9", label: "Recommanderiez-vous cette formation à un collègue ?", type: "boolean" },
    { id: "sc10", label: "Qu'avez-vous le plus apprécié ?", type: "text" },
    { id: "sc11", label: "Qu'est-ce qui pourrait être amélioré ?", type: "text" },
  ],
  satisfaction_froid: [
    { id: "sf1", label: "Vous souvenez-vous des principaux apports de la formation ?", type: "scale" },
    { id: "sf2", label: "Les compétences acquises sont utiles dans votre travail.", type: "scale" },
    { id: "sf3", label: "Avez-vous pu mettre en pratique ce que vous avez appris ?", type: "boolean" },
    { id: "sf4", label: "À quelle fréquence appliquez-vous les acquis ?", type: "select", options: ["jamais", "parfois", "souvent", "toujours"] },
    { id: "sf5", label: "Votre niveau a-t-il progressé grâce à cette formation ?", type: "scale" },
    { id: "sf6", label: "Votre hiérarchie a-t-elle remarqué une évolution ?", type: "select", options: ["oui", "non", "non applicable"] },
    { id: "sf7", label: "Avez-vous rencontré des difficultés à appliquer les acquis ?", type: "boolean_text" },
    { id: "sf8", label: "Avez-vous eu besoin d'un accompagnement supplémentaire ?", type: "boolean" },
    { id: "sf9", label: "La formation a eu un impact positif sur votre travail au quotidien.", type: "scale" },
    { id: "sf10", label: "Avez-vous des suggestions pour améliorer la formation ?", type: "text" },
  ],
};

export const QUESTIONNAIRE_LABELS: Record<string, string> = {
  positionnement: "Positionnement d'entrée",
  satisfaction_chaud: "Satisfaction à chaud",
  satisfaction_froid: "Satisfaction à froid",
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/test/questionnaireQuestions.test.ts
# Expected: PASS — 4 tests
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/questionnaireQuestions.ts src/test/questionnaireQuestions.test.ts
git commit -m "feat: add questionnaire question definitions for Qualiopi"
```

---

## Task 3: Edge Function `submit-questionnaire`

**Files:**
- Create: `supabase/functions/submit-questionnaire/index.ts`

> This Edge Function is called from the public page without auth. It validates the token and writes the answers.

- [ ] **Step 1: Create `supabase/functions/submit-questionnaire/index.ts`**

```typescript
// supabase/functions/submit-questionnaire/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { token?: string; reponses?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { token, reponses } = body;
  if (!token || !reponses) {
    return new Response(JSON.stringify({ error: "token and reponses are required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: row, error: fetchErr } = await adminClient
    .from("questionnaire_tokens")
    .select("id, completed_at")
    .eq("token", token)
    .maybeSingle();

  if (fetchErr || !row) {
    return new Response(JSON.stringify({ error: "Token not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (row.completed_at) {
    return new Response(JSON.stringify({ error: "Already completed" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: updateErr } = await adminClient
    .from("questionnaire_tokens")
    .update({ reponses, completed_at: new Date().toISOString() })
    .eq("id", row.id);

  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Verify function syntax**

```bash
cd supabase/functions/submit-questionnaire && deno check index.ts
# Expected: no errors (or install deno first: brew install deno)
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/submit-questionnaire/index.ts
git commit -m "feat: add submit-questionnaire Edge Function"
```

---

## Task 4: Page publique `/q/:token`

**Files:**
- Create: `src/pages/QuestionnairePublic.tsx`
- Modify: `src/App.tsx` (add route)
- Test: `src/test/QuestionnairePublic.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/test/QuestionnairePublic.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import QuestionnairePublic from "@/pages/QuestionnairePublic";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const renderPage = (token = "test-token-uuid") =>
  render(
    <MemoryRouter initialEntries={[`/q/${token}`]}>
      <Routes>
        <Route path="/q/:token" element={<QuestionnairePublic />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => { mockFetch.mockReset(); });

describe("QuestionnairePublic", () => {
  it("shows loading initially", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/chargement/i)).toBeInTheDocument();
  });

  it("shows error when token not found (404)", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({ error: "Token not found" }) });
    renderPage();
    await waitFor(() => expect(screen.getByText(/lien invalide/i)).toBeInTheDocument());
  });

  it("shows already completed message (409)", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "Already completed" }) });
    renderPage();
    await waitFor(() => expect(screen.getByText(/déjà rempli/i)).toBeInTheDocument());
  });

  it("renders questionnaire form on success", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        type: "positionnement",
        formation_title: "Formation SST",
        stagiaire_name: "Jean Dupont",
      }),
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/positionnement/i)).toBeInTheDocument());
    expect(screen.getByText("Formation SST")).toBeInTheDocument();
  });

  it("submit button calls submit endpoint", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: "satisfaction_chaud",
          formation_title: "SST",
          stagiaire_name: "Marie Martin",
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

    renderPage();
    await waitFor(() => expect(screen.getByText(/satisfaction à chaud/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/QuestionnairePublic.test.tsx
# Expected: FAIL — Cannot find module '@/pages/QuestionnairePublic'
```

- [ ] **Step 3: Create `src/pages/QuestionnairePublic.tsx`**

```tsx
// src/pages/QuestionnairePublic.tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QUESTIONS, QUESTIONNAIRE_LABELS, type QuestionDef } from "@/lib/questionnaireQuestions";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

type PageState = "loading" | "invalid" | "already_done" | "form" | "submitted";

interface TokenData {
  type: "positionnement" | "satisfaction_chaud" | "satisfaction_froid";
  formation_title: string;
  stagiaire_name: string;
}

function ScaleInput({ qid, value, onChange }: { qid: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(String(n))}
          className={`h-9 w-9 rounded-lg border text-sm font-medium transition-colors ${
            value === String(n) ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-primary/60"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function BooleanInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {["oui", "non"].map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors capitalize ${
            value === opt ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-primary/60"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function SelectInput({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-lg border text-sm capitalize transition-colors ${
            value === opt ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-primary/60"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function QuestionnairePublic() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [textDetails, setTextDetails] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Questionnaire — SecureCRM";
    fetch(`${SUPABASE_URL}/functions/v1/get-questionnaire-info`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (res.status === 404) { setPageState("invalid"); return; }
        if (res.status === 409) { setPageState("already_done"); return; }
        if (!res.ok) { setPageState("invalid"); return; }
        const data = await res.json();
        setTokenData(data);
        setPageState("form");
      })
      .catch(() => setPageState("invalid"));
  }, [token]);

  const setAnswer = (qid: string, value: string) => setAnswers((prev) => ({ ...prev, [qid]: value }));

  const handleSubmit = async () => {
    if (!tokenData) return;
    const questions = QUESTIONS[tokenData.type];
    const reponses: Record<string, unknown> = {};
    for (const q of questions) {
      reponses[q.id] = answers[q.id] ?? null;
      if (q.type === "boolean_text" && answers[q.id] === "oui") {
        reponses[`${q.id}_detail`] = textDetails[q.id] ?? null;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-questionnaire`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({ token, reponses }),
      });
      if (res.status === 409) { toast.error("Ce questionnaire a déjà été complété."); return; }
      if (!res.ok) { const d = await res.json(); toast.error(d.error || "Erreur"); return; }
      setPageState("submitted");
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (q: QuestionDef) => (
    <div key={q.id} className="space-y-2">
      <Label className="text-sm font-medium">{q.label}</Label>
      {q.type === "scale" && <ScaleInput qid={q.id} value={answers[q.id] ?? ""} onChange={(v) => setAnswer(q.id, v)} />}
      {q.type === "boolean" && <BooleanInput value={answers[q.id] ?? ""} onChange={(v) => setAnswer(q.id, v)} />}
      {q.type === "text" && (
        <Textarea value={answers[q.id] ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} rows={2} className="bg-background/60" />
      )}
      {q.type === "select" && q.options && (
        <SelectInput options={q.options} value={answers[q.id] ?? ""} onChange={(v) => setAnswer(q.id, v)} />
      )}
      {q.type === "boolean_text" && (
        <div className="space-y-2">
          <BooleanInput value={answers[q.id] ?? ""} onChange={(v) => setAnswer(q.id, v)} />
          {answers[q.id] === "oui" && (
            <Textarea
              placeholder="Précisez..."
              value={textDetails[q.id] ?? ""}
              onChange={(e) => setTextDetails((prev) => ({ ...prev, [q.id]: e.target.value }))}
              rows={2}
              className="bg-background/60"
            />
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 pt-12">
      <div className="w-full max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg gradient-primary flex items-center justify-center shadow-glow">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-xl">SecureCRM</span>
        </div>

        {pageState === "loading" && (
          <Card className="p-8 text-center bg-card/80 border-border/50">
            <p className="text-muted-foreground">Chargement du questionnaire…</p>
          </Card>
        )}

        {pageState === "invalid" && (
          <Card className="p-8 text-center bg-card/80 border-border/50 space-y-2">
            <p className="font-semibold text-destructive">Lien invalide ou expiré.</p>
            <p className="text-sm text-muted-foreground">Ce lien n'est pas valide ou a déjà été utilisé. Contactez votre centre de formation.</p>
          </Card>
        )}

        {pageState === "already_done" && (
          <Card className="p-8 text-center bg-card/80 border-border/50 space-y-2">
            <p className="font-semibold text-emerald-400">Questionnaire déjà rempli.</p>
            <p className="text-sm text-muted-foreground">Vous avez déjà répondu à ce questionnaire. Merci !</p>
          </Card>
        )}

        {pageState === "submitted" && (
          <Card className="p-8 text-center bg-card/80 border-border/50 space-y-2">
            <p className="font-semibold text-emerald-400">Merci pour vos réponses !</p>
            <p className="text-sm text-muted-foreground">Votre questionnaire a bien été enregistré.</p>
          </Card>
        )}

        {pageState === "form" && tokenData && (
          <Card className="p-6 bg-card/80 border-border/50 space-y-6">
            <div>
              <h1 className="text-xl font-display font-bold">
                {QUESTIONNAIRE_LABELS[tokenData.type]}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {tokenData.formation_title} · {tokenData.stagiaire_name}
              </p>
            </div>

            <div className="space-y-6">
              {QUESTIONS[tokenData.type].map(renderQuestion)}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full gradient-primary text-primary-foreground shadow-glow"
            >
              {submitting ? "Envoi…" : "Envoyer mes réponses"}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add route in `src/App.tsx`**

Ajouter juste après `<Route path="/espace-rh" element={<EspaceRH />} />` (ligne 63) :

```tsx
import QuestionnairePublic from "./pages/QuestionnairePublic";
// ...
<Route path="/q/:token" element={<QuestionnairePublic />} />
```

Le bloc complet dans App.tsx devient :
```tsx
<Route path="/espace-stagiaire" element={<EspaceStagiaire />} />
<Route path="/espace-formateur" element={<EspaceFormateur />} />
<Route path="/espace-rh" element={<EspaceRH />} />
<Route path="/q/:token" element={<QuestionnairePublic />} />
<Route path="*" element={<NotFound />} />
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/test/QuestionnairePublic.test.tsx
# Expected: PASS — 5 tests
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/QuestionnairePublic.tsx src/test/QuestionnairePublic.test.tsx src/App.tsx
git commit -m "feat: add public questionnaire page /q/:token"
```

---

## Task 5: Edge Function `send-questionnaire` + `get-questionnaire-info`

**Files:**
- Create: `supabase/functions/send-questionnaire/index.ts`
- Create: `supabase/functions/get-questionnaire-info/index.ts`

> `get-questionnaire-info` est appelée par la page publique pour charger les métadonnées du token (sans exposer les données sensibles).
> `send-questionnaire` est appelée par l'admin pour créer les tokens et envoyer les emails.

- [ ] **Step 1: Create `supabase/functions/get-questionnaire-info/index.ts`**

```typescript
// supabase/functions/get-questionnaire-info/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { token?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.token) {
    return new Response(JSON.stringify({ error: "token is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: row } = await adminClient
    .from("questionnaire_tokens")
    .select("type, completed_at, formation_id, stagiaire_id")
    .eq("token", body.token)
    .maybeSingle();

  if (!row) {
    return new Response(JSON.stringify({ error: "Token not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (row.completed_at) {
    return new Response(JSON.stringify({ error: "Already completed" }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const [{ data: formation }, { data: stagiaire }] = await Promise.all([
    adminClient.from("formations").select("title").eq("id", row.formation_id).maybeSingle(),
    adminClient.from("stagiaires").select("first_name, last_name").eq("id", row.stagiaire_id).maybeSingle(),
  ]);

  return new Response(
    JSON.stringify({
      type: row.type,
      formation_title: formation?.title ?? "",
      stagiaire_name: stagiaire ? `${stagiaire.first_name} ${stagiaire.last_name}` : "",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
```

- [ ] **Step 2: Create `supabase/functions/send-questionnaire/index.ts`**

```typescript
// supabase/functions/send-questionnaire/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUESTIONNAIRE_SUBJECTS: Record<string, string> = {
  positionnement: "Questionnaire de positionnement — SecureCRM",
  satisfaction_chaud: "Questionnaire de satisfaction — SecureCRM",
  satisfaction_froid: "Questionnaire de satisfaction (bilan) — SecureCRM",
};

const QUESTIONNAIRE_LABELS: Record<string, string> = {
  positionnement: "positionnement d'entrée",
  satisfaction_chaud: "satisfaction à chaud",
  satisfaction_froid: "satisfaction à froid (30 jours après la formation)",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const SITE_URL = Deno.env.get("SITE_URL") ?? "http://localhost:8081";
  const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@securecrm.fr";

  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY || !RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller } } = await callerClient.auth.getUser();
  if (!caller) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: roleRow } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .in("role", ["administrateur", "secretaire"])
    .maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { formation_id?: string; stagiaire_ids?: string[]; type?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { formation_id, stagiaire_ids, type } = body;
  if (!formation_id || !stagiaire_ids?.length || !type) {
    return new Response(JSON.stringify({ error: "formation_id, stagiaire_ids, and type are required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: formation } = await adminClient
    .from("formations")
    .select("title")
    .eq("id", formation_id)
    .maybeSingle();
  if (!formation) {
    return new Response(JSON.stringify({ error: "Formation not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const stagiaire_id of stagiaire_ids) {
    const { data: stagiaire } = await adminClient
      .from("stagiaires")
      .select("first_name, last_name, email")
      .eq("id", stagiaire_id)
      .maybeSingle();

    if (!stagiaire?.email) { errors.push(`${stagiaire_id}: no email`); continue; }

    // Preserve completed_at/reponses if already answered — only update sent_at
    const { data: existing } = await adminClient
      .from("questionnaire_tokens")
      .select("id, token")
      .eq("formation_id", formation_id)
      .eq("stagiaire_id", stagiaire_id)
      .eq("type", type)
      .maybeSingle();

    let tokenValue: string;
    if (existing) {
      await adminClient.from("questionnaire_tokens").update({ sent_at: new Date().toISOString() }).eq("id", existing.id);
      tokenValue = existing.token;
    } else {
      const { data: created, error: insertErr } = await adminClient
        .from("questionnaire_tokens")
        .insert({ formation_id, stagiaire_id, type })
        .select("token")
        .single();
      if (insertErr || !created) { errors.push(`${stagiaire_id}: insert failed`); continue; }
      tokenValue = created.token;
    }

    const link = `${SITE_URL}/q/${tokenValue}`;
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: stagiaire.email,
        subject: QUESTIONNAIRE_SUBJECTS[type] ?? "Questionnaire — SecureCRM",
        html: `<p>Bonjour ${stagiaire.first_name},</p>
<p>Merci de remplir votre questionnaire de ${QUESTIONNAIRE_LABELS[type] ?? type} pour la formation <strong>${formation.title}</strong>.</p>
<p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Remplir le questionnaire</a></p>
<p style="font-size:12px;color:#888;">Lien : ${link}</p>`,
      }),
    });

    if (!emailRes.ok) { errors.push(`${stagiaire_id}: email failed`); continue; }
    sent++;
  }

  return new Response(
    JSON.stringify({ ok: true, sent, errors }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/get-questionnaire-info/index.ts supabase/functions/send-questionnaire/index.ts
git commit -m "feat: add send-questionnaire and get-questionnaire-info Edge Functions"
```

---

## Task 6: Questionnaire UI dans Formations.tsx

**Files:**
- Modify: `src/pages/Formations.tsx`

> Ajouter une section "Questionnaires Qualiopi" dans chaque FormationCard avec stats de complétion + bouton d'envoi + vue résultats.

- [ ] **Step 1: Add state variables for questionnaire tokens**

Dans la fonction `Formations()`, après l'état `resultatComments`, ajouter :

```tsx
const [qStats, setQStats] = useState<Record<string, Record<string, { sent: number; completed: number }>>>({});
const [qSendOpen, setQSendOpen] = useState(false);
const [qSendFormation, setQSendFormation] = useState<any | null>(null);
const [qSendType, setQSendType] = useState<"positionnement" | "satisfaction_chaud" | "satisfaction_froid">("positionnement");
const [qSendSelected, setQSendSelected] = useState<string[]>([]);
const [qSending, setQSending] = useState(false);
const [qResultsOpen, setQResultsOpen] = useState(false);
const [qResultsData, setQResultsData] = useState<any[]>([]);
const [qResultsType, setQResultsType] = useState<string>("");
```

- [ ] **Step 2: Add `loadQStats` function**

Après la fonction `load()`, ajouter :

```tsx
const loadQStats = async (formationIds: string[]) => {
  if (!formationIds.length) return;
  const { data } = await supabase
    .from("questionnaire_tokens")
    .select("formation_id, type, completed_at")
    .in("formation_id", formationIds);
  const stats: Record<string, Record<string, { sent: number; completed: number }>> = {};
  for (const row of (data ?? [])) {
    stats[row.formation_id] ??= {};
    stats[row.formation_id][row.type] ??= { sent: 0, completed: 0 };
    stats[row.formation_id][row.type].sent++;
    if (row.completed_at) stats[row.formation_id][row.type].completed++;
  }
  setQStats(stats);
};
```

- [ ] **Step 3: Update `load()` to call `loadQStats`**

À la fin de la fonction `load()`, juste avant le dernier `}`, ajouter :

```tsx
if (f?.length) await loadQStats(f.map((x: any) => x.id));
```

- [ ] **Step 4: Add `openQResults` function**

```tsx
const openQResults = async (formation: any, type: string) => {
  const { data } = await supabase
    .from("questionnaire_tokens")
    .select("reponses, stagiaire_id, stagiaires(first_name, last_name)")
    .eq("formation_id", formation.id)
    .eq("type", type)
    .not("completed_at", "is", null);
  setQResultsData(data ?? []);
  setQResultsType(type);
  setQResultsOpen(true);
};
```

- [ ] **Step 5: Add `sendQuestionnaire` function**

Ajouter les imports nécessaires en haut du fichier (si pas déjà présents) :
```tsx
import { QUESTIONNAIRE_LABELS } from "@/lib/questionnaireQuestions";
```

Puis ajouter la fonction :
```tsx
const sendQuestionnaire = async () => {
  if (!qSendFormation) return;
  setQSending(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-questionnaire`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
        "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        formation_id: qSendFormation.id,
        stagiaire_ids: qSendSelected,
        type: qSendType,
      }),
    });
    const d = await res.json();
    if (!res.ok) { toast.error(d.error || "Erreur"); return; }
    toast.success(`${d.sent} email(s) envoyé(s)`);
    setQSendOpen(false);
    await loadQStats([qSendFormation.id]);
  } finally {
    setQSending(false);
  }
};
```

- [ ] **Step 6: Add questionnaire section in `FormationCard`**

Dans le composant `FormationCard`, après la div fermante des "Documents Qualiopi" (après `</div>` qui contient les buttons, juste avant `</div>` final du `<div className="flex flex-col gap-2">`), ajouter :

```tsx
<div className="border-t border-border/30 pt-2 space-y-1.5">
  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Questionnaires Qualiopi</p>
  {(["positionnement", "satisfaction_chaud", "satisfaction_froid"] as const).map((type) => {
    const s = qStats[f.id]?.[type];
    return (
      <div key={type} className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground truncate flex-1">{QUESTIONNAIRE_LABELS[type]}</span>
        {s ? (
          <span className={`text-[10px] ${s.completed === s.sent ? "text-emerald-400" : "text-yellow-400"}`}>
            {s.completed}/{s.sent}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/50">—</span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10"
          onClick={() => {
            setQSendFormation(f);
            setQSendType(type);
            setQSendSelected((participantsByFormation[f.id] ?? []).map((p) => p.stagiaire_id));
            setQSendOpen(true);
          }}
        >
          Envoyer
        </Button>
        {s && s.completed >= 3 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => openQResults(f, type)}
          >
            Résultats
          </Button>
        )}
      </div>
    );
  })}
</div>
```

- [ ] **Step 7: Add send dialog and results dialog to the JSX return**

Juste avant la balise fermante `</div>` du `return` principal (à la toute fin du composant), ajouter les deux dialogs :

```tsx
{/* Dialog envoi questionnaire */}
<Dialog open={qSendOpen} onOpenChange={setQSendOpen}>
  <DialogContent className="bg-card border-border max-h-[80vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>
        Envoyer — {qSendFormation?.title} · {QUESTIONNAIRE_LABELS[qSendType]}
      </DialogTitle>
    </DialogHeader>
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Sélectionner les stagiaires à notifier :</p>
      <ScrollArea className="h-48 rounded-md border border-border/60 p-2">
        {(participantsByFormation[qSendFormation?.id] ?? []).map((p) => (
          <label key={p.stagiaire_id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/40 cursor-pointer">
            <Checkbox
              checked={qSendSelected.includes(p.stagiaire_id)}
              onCheckedChange={() =>
                setQSendSelected((prev) =>
                  prev.includes(p.stagiaire_id)
                    ? prev.filter((id) => id !== p.stagiaire_id)
                    : [...prev, p.stagiaire_id]
                )
              }
            />
            <span className="text-sm">
              {p.stagiaire?.last_name?.toUpperCase()} {p.stagiaire?.first_name}
            </span>
            {!p.stagiaire?.email && (
              <span className="text-xs text-destructive ml-auto">pas d'email</span>
            )}
          </label>
        ))}
      </ScrollArea>
      <Button
        onClick={sendQuestionnaire}
        disabled={qSending || qSendSelected.length === 0}
        className="w-full gradient-primary text-primary-foreground"
      >
        {qSending ? "Envoi…" : `Envoyer à ${qSendSelected.length} stagiaire(s)`}
      </Button>
    </div>
  </DialogContent>
</Dialog>

{/* Dialog résultats */}
<Dialog open={qResultsOpen} onOpenChange={setQResultsOpen}>
  <DialogContent className="bg-card border-border max-h-[80vh] overflow-y-auto max-w-2xl">
    <DialogHeader>
      <DialogTitle>Résultats — {QUESTIONNAIRE_LABELS[qResultsType]}</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 text-sm">
      {qResultsData.length === 0 ? (
        <p className="text-muted-foreground">Aucune réponse enregistrée.</p>
      ) : (
        qResultsData.map((row: any, i: number) => (
          <div key={i} className="border border-border/40 rounded-lg p-3 space-y-1">
            <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground">
              {row.stagiaires?.last_name?.toUpperCase()} {row.stagiaires?.first_name}
            </p>
            {row.reponses && Object.entries(row.reponses as Record<string, unknown>).map(([k, v]) => (
              <p key={k} className="text-xs text-muted-foreground">
                <span className="font-mono text-primary/70">{k}</span> : {String(v ?? "—")}
              </p>
            ))}
          </div>
        ))
      )}
    </div>
  </DialogContent>
</Dialog>
```

- [ ] **Step 8: Add `prix_ht` and `duration_hours` to creation form**

Dans le `form.state` initial (ligne ~81), ajouter les deux champs :
```tsx
const [form, setForm] = useState({
  title: "", type: "APS", description: "", start_date: "", end_date: "",
  location: "", max_participants: 12, formateur_id: "", showRemarque: false,
  prix_ht: 0, duration_hours: 0,
});
```

Dans la fonction `submit()`, dans le `payload` object, ajouter :
```tsx
prix_ht: form.prix_ht || 0,
duration_hours: form.duration_hours || 0,
```

Dans le JSX du formulaire, après le champ "Places max", ajouter :
```tsx
<div className="grid grid-cols-2 gap-3">
  <div>
    <Label>Prix HT (€)</Label>
    <Input type="number" min="0" step="0.01" value={form.prix_ht} onChange={(e) => setForm({ ...form, prix_ht: parseFloat(e.target.value) || 0 })} />
  </div>
  <div>
    <Label>Durée (heures)</Label>
    <Input type="number" min="0" step="0.5" value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: parseFloat(e.target.value) || 0 })} />
  </div>
</div>
```

- [ ] **Step 9: Run tests**

```bash
npx vitest run
# Expected: all tests pass (no regression)
```

- [ ] **Step 10: Commit**

```bash
git add src/pages/Formations.tsx src/lib/questionnaireQuestions.ts
git commit -m "feat: add questionnaire section and BPF fields to Formations page"
```

---

## Task 7: Page Réclamations

**Files:**
- Create: `src/pages/Reclamations.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/AppSidebar.tsx`
- Test: `src/test/Reclamations.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/test/Reclamations.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Reclamations from "@/pages/Reclamations";

const mockReclamations = [
  {
    id: "rec-1",
    date_reclamation: "2026-05-20",
    demandeur_nom: "Jean Dupont",
    demandeur_type: "stagiaire",
    objet: "Absence du formateur",
    description: "Le formateur était absent le premier jour.",
    statut: "ouverte",
    reponse: null,
    date_cloture: null,
    created_at: "2026-05-20T10:00:00Z",
  },
  {
    id: "rec-2",
    date_reclamation: "2026-04-10",
    demandeur_nom: "ACME SÉCURITÉ",
    demandeur_type: "entreprise",
    objet: "Support manquant",
    description: "Aucun support remis.",
    statut: "cloturee",
    reponse: "Support envoyé par email.",
    date_cloture: "2026-04-15",
    created_at: "2026-04-10T09:00:00Z",
  },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "reclamations") {
        return {
          select: () => ({ order: () => Promise.resolve({ data: mockReclamations, error: null }) }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: mockReclamations[0], error: null }) }) }),
          update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        };
      }
      return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) };
    },
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, roles: ["administrateur"] }),
}));

const renderPage = () => render(<MemoryRouter><Reclamations /></MemoryRouter>);

describe("Reclamations", () => {
  it("shows page title", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/réclamations/i)).toBeInTheDocument());
  });

  it("lists reclamations after load", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Absence du formateur")).toBeInTheDocument());
    expect(screen.getByText("ACME SÉCURITÉ")).toBeInTheDocument();
  });

  it("shows open count badge", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
  });

  it("filters by statut ouverte", async () => {
    renderPage();
    await waitFor(() => screen.getByText("Absence du formateur"));
    fireEvent.click(screen.getByRole("button", { name: /ouvertes/i }));
    expect(screen.getByText("Absence du formateur")).toBeInTheDocument();
  });

  it("shows create button", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /nouvelle/i })).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/Reclamations.test.tsx
# Expected: FAIL — Cannot find module '@/pages/Reclamations'
```

- [ ] **Step 3: Create `src/pages/Reclamations.tsx`**

```tsx
// src/pages/Reclamations.tsx
// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";

type Statut = "ouverte" | "en_cours" | "cloturee";
type DemandeurType = "stagiaire" | "entreprise" | "autre";

interface Reclamation {
  id: string;
  date_reclamation: string;
  demandeur_nom: string;
  demandeur_type: DemandeurType;
  objet: string;
  description: string;
  statut: Statut;
  reponse: string | null;
  date_cloture: string | null;
  created_at: string;
}

const STATUT_BADGE: Record<Statut, { label: string; className: string }> = {
  ouverte: { label: "Ouverte", className: "bg-destructive/10 text-destructive border-destructive/30" },
  en_cours: { label: "En cours", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  cloturee: { label: "Clôturée", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
};

const emptyForm = {
  date_reclamation: new Date().toISOString().slice(0, 10),
  demandeur_nom: "",
  demandeur_type: "stagiaire" as DemandeurType,
  objet: "",
  description: "",
};

export default function Reclamations() {
  const [list, setList] = useState<Reclamation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatut, setFilterStatut] = useState<"all" | Statut>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<Reclamation | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editReponse, setEditReponse] = useState("");
  const [editStatut, setEditStatut] = useState<Statut>("ouverte");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Réclamations — SecureCRM";
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("reclamations").select("*").order("date_reclamation", { ascending: false });
    if (error) toast.error(error.message);
    setList((data ?? []) as Reclamation[]);
    setLoading(false);
  };

  const create = async () => {
    if (!form.demandeur_nom || !form.objet || !form.description) {
      toast.error("Tous les champs obligatoires doivent être remplis");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("reclamations").insert({
      ...form,
      statut: "ouverte",
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Réclamation enregistrée");
    setCreateOpen(false);
    setForm(emptyForm);
    setSaving(false);
    load();
  };

  const openEdit = (rec: Reclamation) => {
    setSelected(rec);
    setEditReponse(rec.reponse ?? "");
    setEditStatut(rec.statut);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("reclamations").update({
      reponse: editReponse || null,
      statut: editStatut,
    }).eq("id", selected.id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Mise à jour enregistrée");
    setEditOpen(false);
    setSaving(false);
    load();
  };

  const cloture = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase.from("reclamations").update({
      statut: "cloturee",
      reponse: editReponse || null,
      date_cloture: new Date().toISOString().slice(0, 10),
    }).eq("id", selected.id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success("Réclamation clôturée");
    setEditOpen(false);
    setSaving(false);
    load();
  };

  const displayed = filterStatut === "all" ? list : list.filter((r) => r.statut === filterStatut);
  const openCount = list.filter((r) => r.statut === "ouverte").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-glow flex items-center gap-3">
            <MessageSquareWarning className="h-7 w-7 text-primary" /> Réclamations
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {list.length} réclamation(s) au total
            {openCount > 0 && <Badge className="ml-2 bg-destructive/10 text-destructive border-destructive/30">{openCount} ouverte(s)</Badge>}
          </p>
        </div>
        <Button className="gradient-primary text-primary-foreground shadow-glow" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nouvelle réclamation
        </Button>
      </div>

      <div className="flex gap-2">
        {(["all", "ouverte", "en_cours", "cloturee"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filterStatut === s ? "default" : "outline"}
            onClick={() => setFilterStatut(s)}
            className="capitalize"
          >
            {s === "all" ? "Toutes" : s === "ouverte" ? "Ouvertes" : s === "en_cours" ? "En cours" : "Clôturées"}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : displayed.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <p className="text-muted-foreground">Aucune réclamation.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {displayed.map((rec) => {
            const badge = STATUT_BADGE[rec.statut];
            return (
              <Card
                key={rec.id}
                className="p-4 bg-card/60 border-border/50 hover:border-primary/30 cursor-pointer transition-colors"
                onClick={() => openEdit(rec)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{rec.objet}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rec.demandeur_nom} · {rec.demandeur_type} · {rec.date_reclamation.split("-").reverse().join("/")}
                    </p>
                  </div>
                  <Badge className={`text-[10px] shrink-0 ${badge.className}`}>{badge.label}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog création */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouvelle réclamation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Date de réception</Label>
              <Input type="date" value={form.date_reclamation} onChange={(e) => setForm({ ...form, date_reclamation: e.target.value })} />
            </div>
            <div>
              <Label>Nom du demandeur *</Label>
              <Input value={form.demandeur_nom} onChange={(e) => setForm({ ...form, demandeur_nom: e.target.value })} />
            </div>
            <div>
              <Label>Type de demandeur</Label>
              <Select value={form.demandeur_type} onValueChange={(v) => setForm({ ...form, demandeur_type: v as DemandeurType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stagiaire">Stagiaire</SelectItem>
                  <SelectItem value="entreprise">Entreprise</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Objet *</Label>
              <Input value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} placeholder="Résumé court" />
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
            </div>
            <Button onClick={create} disabled={saving} className="w-full gradient-primary text-primary-foreground">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog édition */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.objet}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{selected.demandeur_nom} · {selected.demandeur_type}</p>
                <p>Reçue le {selected.date_reclamation.split("-").reverse().join("/")}</p>
              </div>
              <div className="bg-muted/20 rounded-lg p-3 text-sm">{selected.description}</div>
              <div>
                <Label>Statut</Label>
                <Select value={editStatut} onValueChange={(v) => setEditStatut(v as Statut)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ouverte">Ouverte</SelectItem>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="cloturee">Clôturée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Réponse apportée</Label>
                <Textarea value={editReponse} onChange={(e) => setEditReponse(e.target.value)} rows={3} />
              </div>
              <div className="flex gap-2">
                <Button onClick={saveEdit} disabled={saving} className="flex-1 gradient-primary text-primary-foreground">
                  {saving ? "…" : "Enregistrer"}
                </Button>
                {selected.statut !== "cloturee" && (
                  <Button onClick={cloture} disabled={saving} variant="outline" className="flex-1 border-emerald-500/30 text-emerald-400">
                    Clôturer
                  </Button>
                )}
              </div>
              {selected.date_cloture && (
                <p className="text-xs text-muted-foreground">Clôturée le {selected.date_cloture.split("-").reverse().join("/")}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Add route in `src/App.tsx`**

Ajouter l'import et la route dans le bloc ProtectedRoute/AppLayout :

```tsx
import Reclamations from "./pages/Reclamations";
// Dans le bloc <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
<Route path="/reclamations" element={<Reclamations />} />
```

- [ ] **Step 5: Add nav item in `src/components/AppSidebar.tsx`**

Dans le tableau `allItems`, ajouter après la ligne "Rappels & Alertes" :

```tsx
{ title: "Réclamations", url: "/reclamations", icon: MessageSquareWarning, roles: ["administrateur", "secretaire"] },
```

Ajouter `MessageSquareWarning` aux imports lucide-react en haut du fichier :

```tsx
import {
  LayoutDashboard, Users, GraduationCap, AlertTriangle,
  Calendar, FileText, BarChart3, Shield,
  LogOut, UserCog, UserCheck, Award, ClipboardList, BookOpen, MessageSquare, Bell, Building2,
  MessageSquareWarning
} from "lucide-react";
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/test/Reclamations.test.tsx
# Expected: PASS — 5 tests
npx vitest run
# Expected: all tests pass
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/Reclamations.tsx src/test/Reclamations.test.tsx src/App.tsx src/components/AppSidebar.tsx
git commit -m "feat: add Reclamations page with CRUD and sidebar nav"
```

---

## Task 8: Export BPF dans Statistiques.tsx

**Files:**
- Modify: `src/pages/Statistiques.tsx`

> Ajouter un bloc "Export BPF" avec sélecteur d'année, aperçu des chiffres, et téléchargement CSV. Pas de dépendance npm supplémentaire — CSV généré nativement en JS.

- [ ] **Step 1: Add BPF state variables in `Statistiques.tsx`**

Après les états existants (`revenusParMois`, etc.), ajouter :

```tsx
const [bpfLoading, setBpfLoading] = useState(false);
const [bpfData, setBpfData] = useState<{
  nbFormations: number;
  nbStagiaires: number;
  nbHeuresStagiaires: number;
  chiffreAffaires: number;
  nbFormateurs: number;
  tauxSatisfaction: number | null;
  tauxCompletionChaud: string;
  tauxCompletionFroid: string;
} | null>(null);
```

- [ ] **Step 2: Add `loadBpf` function**

Ajouter après la fonction `load()` :

```tsx
const loadBpf = async () => {
  setBpfLoading(true);
  const debut = `${annee}-01-01`;
  const fin = `${annee}-12-31`;

  const [{ data: formations }, { data: tokens }] = await Promise.all([
    supabase.from("formations").select("id, formateur_id, prix_ht, duration_hours").gte("start_date", debut).lte("start_date", fin),
    supabase.from("questionnaire_tokens").select("type, completed_at, reponses, formation_id"),
  ]);

  const fIds = (formations ?? []).map((f: any) => f.id);
  const { data: participants } = fIds.length
    ? await supabase.from("formation_participants").select("stagiaire_id, formation_id").in("formation_id", fIds)
    : { data: [] };

  const nbFormations = fIds.length;
  const nbStagiaires = new Set((participants ?? []).map((p: any) => p.stagiaire_id)).size;

  const participantsByFormation: Record<string, number> = {};
  (participants ?? []).forEach((p: any) => {
    participantsByFormation[p.formation_id] = (participantsByFormation[p.formation_id] ?? 0) + 1;
  });
  const nbHeuresStagiaires = (formations ?? []).reduce((acc: number, f: any) => {
    return acc + (Number(f.duration_hours) || 0) * (participantsByFormation[f.id] ?? 0);
  }, 0);

  const chiffreAffaires = (formations ?? []).reduce((acc: number, f: any) => acc + (Number(f.prix_ht) || 0), 0);
  const nbFormateurs = new Set((formations ?? []).filter((f: any) => f.formateur_id).map((f: any) => f.formateur_id)).size;

  const anneeTokens = (tokens ?? []).filter((t: any) => fIds.includes(t.formation_id));
  const chaudTokens = anneeTokens.filter((t: any) => t.type === "satisfaction_chaud");
  const froidTokens = anneeTokens.filter((t: any) => t.type === "satisfaction_froid");

  const scores: number[] = [];
  chaudTokens.filter((t: any) => t.completed_at && t.reponses).forEach((t: any) => {
    const rep = t.reponses as Record<string, unknown>;
    ["sc1","sc2","sc3","sc4","sc5","sc6","sc7","sc8"].forEach((k) => {
      const v = Number(rep[k]);
      if (v >= 1 && v <= 5) scores.push(v);
    });
  });
  const tauxSatisfaction = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;

  const chaudCompleted = chaudTokens.filter((t: any) => t.completed_at).length;
  const froidCompleted = froidTokens.filter((t: any) => t.completed_at).length;
  const tauxCompletionChaud = chaudTokens.length ? `${chaudCompleted}/${chaudTokens.length}` : "—";
  const tauxCompletionFroid = froidTokens.length ? `${froidCompleted}/${froidTokens.length}` : "—";

  setBpfData({ nbFormations, nbStagiaires, nbHeuresStagiaires, chiffreAffaires, nbFormateurs, tauxSatisfaction, tauxCompletionChaud, tauxCompletionFroid });
  setBpfLoading(false);
};
```

- [ ] **Step 3: Add `downloadBpfCsv` function**

```tsx
const downloadBpfCsv = () => {
  if (!bpfData) return;
  const rows = [
    ["Rubrique BPF", "Valeur", "Année"],
    ["Nombre d'actions de formation", bpfData.nbFormations, annee],
    ["Nombre de stagiaires formés", bpfData.nbStagiaires, annee],
    ["Nombre d'heures stagiaires", bpfData.nbHeuresStagiaires, annee],
    ["Chiffre d'affaires HT (€)", bpfData.chiffreAffaires, annee],
    ["Nombre de formateurs actifs", bpfData.nbFormateurs, annee],
    ["Taux de satisfaction moyen (/5)", bpfData.tauxSatisfaction ?? "N/A", annee],
    ["Complétion satisfaction à chaud", bpfData.tauxCompletionChaud, annee],
    ["Complétion satisfaction à froid", bpfData.tauxCompletionFroid, annee],
  ];
  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `BPF_${annee}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
```

- [ ] **Step 4: Add BPF block to JSX return**

Ajouter l'import `Download` si pas présent :
```tsx
import { Users, GraduationCap, TrendingUp, Euro, Award, Calendar, Download, FileSpreadsheet } from "lucide-react";
```

À la toute fin du `return`, avant le `</div>` fermant, ajouter :

```tsx
<Card className="p-6 bg-card/60 border-border/50">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-2">
      <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
      <h2 className="font-display font-semibold">Export BPF — Bilan Pédagogique et Financier</h2>
      <Badge variant="outline" className="ml-2 border-emerald-400/30 text-emerald-400">{annee}</Badge>
    </div>
    <Button size="sm" variant="outline" onClick={loadBpf} disabled={bpfLoading} className="border-border/50">
      {bpfLoading ? "Chargement…" : "Calculer"}
    </Button>
  </div>

  {!bpfData ? (
    <p className="text-sm text-muted-foreground">Cliquez sur "Calculer" pour générer le bilan de l'année {annee}.</p>
  ) : (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Actions de formation", value: bpfData.nbFormations },
          { label: "Stagiaires formés", value: bpfData.nbStagiaires },
          { label: "Heures stagiaires", value: bpfData.nbHeuresStagiaires },
          { label: "CA HT (€)", value: bpfData.chiffreAffaires.toLocaleString("fr-FR") },
          { label: "Formateurs actifs", value: bpfData.nbFormateurs },
          { label: "Satisfaction moy. /5", value: bpfData.tauxSatisfaction ?? "N/A" },
          { label: "Complétion chaud", value: bpfData.tauxCompletionChaud },
          { label: "Complétion froid", value: bpfData.tauxCompletionFroid },
        ].map((item) => (
          <div key={item.label} className="bg-card/40 rounded-lg p-3 border border-border/40">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
            <p className="text-xl font-display font-bold text-primary mt-1">{item.value}</p>
          </div>
        ))}
      </div>
      <Button onClick={downloadBpfCsv} className="gradient-primary text-primary-foreground shadow-glow">
        <Download className="h-4 w-4 mr-2" /> Télécharger BPF_{annee}.csv
      </Button>
    </div>
  )}
</Card>
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run
# Expected: all tests pass
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/Statistiques.tsx
git commit -m "feat: add BPF export block in Statistiques page"
```

---

## Final verification

- [ ] Run full test suite

```bash
npx vitest run
# Expected: all tests pass, no regressions
```

- [ ] Verify dev server builds without TypeScript errors

```bash
npm run build
# Expected: no errors
```

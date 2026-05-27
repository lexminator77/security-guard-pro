# DRACAR — Vérification CNAPS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vérifier automatiquement la validité des cartes pro CNAPS de tous les agents toutes les 2 semaines, avec bouton de vérification manuelle immédiate, et afficher le statut vert/rouge/orange/gris par agent dans un onglet "DRACAR".

**Architecture:** Supabase Edge Function `verify-cnaps` (Deno) qui interroge cnaps-securite.fr par numéro de carte, met à jour 3 colonnes sur `stagiaires` (cnaps_statut / cnaps_last_checked / cnaps_last_result). Cron pg_cron toutes les 2 semaines. Page `VerificationCNAPS.tsx` avec tableau filtrable et bouton "Vérifier tous". Badge CNAPS dans le panneau détail stagiaire.

**Tech Stack:** React 18 + TypeScript, Supabase Edge Functions (Deno), pg_cron, Shadcn UI Badge/Button/Table, lucide-react (ShieldCheck), Vitest + Testing Library.

---

## File Structure

**Nouveaux :**
- `supabase/migrations/20260527140000_cnaps_statut.sql` — 3 colonnes sur `stagiaires`
- `supabase/migrations/20260527140001_cnaps_cron.sql` — cron pg_cron toutes les 2 semaines
- `supabase/functions/verify-cnaps/index.ts` — Edge Function Deno
- `src/pages/VerificationCNAPS.tsx` — page DRACAR
- `src/test/VerificationCNAPS.test.tsx` — 3 tests

**Modifiés :**
- `src/components/AppSidebar.tsx` — entrée DRACAR (ShieldCheck icon)
- `src/pages/Stagiaires.tsx` — badge CNAPS dans section "Carte professionnelle CNAPS" (ligne ~322)
- `src/App.tsx` — route `/verification-cnaps` dans ProtectedRoute

---

## Task 1: Migration — colonnes CNAPS sur stagiaires

**Files:**
- Create: `supabase/migrations/20260527140000_cnaps_statut.sql`

- [ ] **Step 1: Créer la migration**

```sql
-- supabase/migrations/20260527140000_cnaps_statut.sql

ALTER TABLE public.stagiaires
  ADD COLUMN IF NOT EXISTS cnaps_statut TEXT NOT NULL DEFAULT 'inconnu'
    CHECK (cnaps_statut IN ('vert', 'rouge', 'a_verifier', 'inconnu')),
  ADD COLUMN IF NOT EXISTS cnaps_last_checked TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cnaps_last_result TEXT;
```

- [ ] **Step 2: Appliquer la migration dans Supabase**

Dans le dashboard Supabase → SQL Editor, coller et exécuter le contenu du fichier. Vérifier qu'il n'y a pas d'erreur. Les stagiaires existants auront `cnaps_statut = 'inconnu'` par défaut.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260527140000_cnaps_statut.sql
git commit -m "feat: add cnaps_statut columns to stagiaires"
```

---

## Task 2: Edge Function `verify-cnaps`

**Files:**
- Create: `supabase/functions/verify-cnaps/index.ts`

**Avant d'écrire la fonction — étape de découverte CNAPS obligatoire :**

L'API CNAPS n'est pas officielle. Il faut inspecter le formulaire de vérification publique pour connaître l'URL exacte et les paramètres. Faire cela AVANT d'implémenter :

1. Ouvrir https://www.cnaps-securite.fr dans un navigateur
2. Trouver la page de vérification de carte professionnelle (souvent "Vérification" dans le menu)
3. Ouvrir les DevTools → onglet "Réseau"
4. Saisir un numéro de carte fictif et soumettre le formulaire
5. Identifier dans DevTools : l'URL de la requête POST, les paramètres du formulaire (FormData), les headers nécessaires, le texte clé dans la réponse HTML qui indique "valide" ou "invalide"
6. Utiliser ces informations pour remplir les constantes `CNAPS_URL`, `buildFormData()`, et `parseResponse()` ci-dessous

- [ ] **Step 1: Créer `supabase/functions/verify-cnaps/index.ts`**

```typescript
// supabase/functions/verify-cnaps/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

// ── À compléter après inspection du site CNAPS (voir note ci-dessus) ──────────
const CNAPS_URL = "https://www.cnaps-securite.fr/verification-carte"; // URL exacte à confirmer
function buildFormData(carteProNumber: string): URLSearchParams {
  const params = new URLSearchParams();
  params.set("numero", carteProNumber); // clé du champ à confirmer
  return params;
}
function parseResponse(html: string): "vert" | "rouge" | "a_verifier" {
  const lower = html.toLowerCase();
  if (lower.includes("valide") || lower.includes("en cours de validité")) return "vert";
  if (
    lower.includes("suspendu") ||
    lower.includes("invalide") ||
    lower.includes("expiré") ||
    lower.includes("retiré") ||
    lower.includes("révoqué")
  ) return "rouge";
  return "a_verifier"; // réponse inattendue → fallback manuel
}
// ─────────────────────────────────────────────────────────────────────────────

async function verifyCarte(carteNumber: string): Promise<{ statut: "vert" | "rouge" | "a_verifier"; result: string }> {
  try {
    const resp = await fetch(CNAPS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (compatible; AVSecuriteBot/1.0)",
      },
      body: buildFormData(carteNumber).toString(),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return { statut: "a_verifier", result: `HTTP ${resp.status}` };
    const html = await resp.text();
    const statut = parseResponse(html);
    const snippet = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    return { statut, result: snippet };
  } catch (e: any) {
    return { statut: "a_verifier", result: e.message ?? "Erreur réseau" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const CRON_SECRET = Deno.env.get("CRON_SECRET");

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth : soit cron secret, soit JWT utilisateur authentifié admin/secrétaire
  const cronSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization") ?? "";
  const isCron = CRON_SECRET && cronSecret === CRON_SECRET;

  if (!isCron) {
    // Vérifier JWT
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", user.id);
    const allowed = (roles ?? []).some((r: any) => ["administrateur", "secretaire"].includes(r.role));
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const stagiaireIds: string[] | undefined = body.stagiaire_ids;

  // Charger les agents à vérifier
  let query = db.from("stagiaires").select("id, carte_pro_number").not("carte_pro_number", "is", null);
  // @ts-ignore — Deno n'a pas les types Supabase en brut
  if (stagiaireIds?.length) query = query.in("id", stagiaireIds);
  const { data: agents, error: fetchErr } = await query;

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Array<{ id: string; statut: string }> = [];
  const now = new Date().toISOString();

  for (const agent of (agents ?? [])) {
    const { statut, result } = await verifyCarte(agent.carte_pro_number);
    await db.from("stagiaires").update({
      cnaps_statut: statut,
      cnaps_last_checked: now,
      cnaps_last_result: result,
    }).eq("id", agent.id);
    results.push({ id: agent.id, statut });
  }

  return new Response(
    JSON.stringify({ ok: true, processed: results.length, results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
```

- [ ] **Step 2: Déployer la Edge Function**

```bash
npx supabase functions deploy verify-cnaps --project-ref <TON_PROJECT_REF>
```

Note : `<TON_PROJECT_REF>` se trouve dans les settings Supabase de ton projet (ex: `abcdefghijklmnop`).

- [ ] **Step 3: Configurer les secrets Supabase**

Dans le dashboard Supabase → Settings → Edge Functions → Secrets, vérifier que `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, et `CRON_SECRET` sont bien définis (ils le sont déjà si `check-expirations` fonctionne).

- [ ] **Step 4: Tester manuellement la fonction**

Dans le dashboard Supabase → Edge Functions → `verify-cnaps` → "Invoke", envoyer :
```json
{ "stagiaire_ids": ["<UUID_D_UN_AGENT_AVEC_CARTE_PRO>"] }
```
Vérifier que la réponse contient `{ "ok": true, "processed": 1, "results": [...] }` et que le statut dans la table `stagiaires` est mis à jour.

- [ ] **Step 5: Ajuster `parseResponse` si nécessaire**

Si le résultat est `a_verifier` alors qu'une carte valide était attendue, inspecter `cnaps_last_result` dans la base (le texte brut retourné par CNAPS) et ajuster les mots-clés dans `parseResponse()`.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/verify-cnaps/index.ts
git commit -m "feat: add verify-cnaps Edge Function with vert/rouge/a_verifier logic"
```

---

## Task 3: Cron pg_cron toutes les 2 semaines

**Files:**
- Create: `supabase/migrations/20260527140001_cnaps_cron.sql`

- [ ] **Step 1: Créer la migration cron**

Remplacer `https://TON_PROJECT_REF.supabase.co` par l'URL de ton projet Supabase et `TON_CRON_SECRET` par la valeur de ton secret `CRON_SECRET`.

```sql
-- supabase/migrations/20260527140001_cnaps_cron.sql

-- Active l'extension pg_net si pas encore active (nécessaire pour net.http_post)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Supprime le job s'il existe déjà (idempotent)
SELECT cron.unschedule('verify-cnaps-auto') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'verify-cnaps-auto'
);

-- Programme la vérification CNAPS les 1er et 15 de chaque mois à 3h
SELECT cron.schedule(
  'verify-cnaps-auto',
  '0 3 1,15 * *',
  $$
    SELECT net.http_post(
      url        := 'https://TON_PROJECT_REF.supabase.co/functions/v1/verify-cnaps',
      headers    := '{"Content-Type": "application/json", "x-cron-secret": "TON_CRON_SECRET"}'::jsonb,
      body       := '{}'::jsonb
    );
  $$
);
```

- [ ] **Step 2: Appliquer la migration dans Supabase**

Dans le dashboard Supabase → SQL Editor, coller et exécuter (après avoir remplacé les deux placeholders). Vérifier le retour sans erreur.

- [ ] **Step 3: Vérifier que le job est enregistré**

```sql
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'verify-cnaps-auto';
```

Expected : une ligne avec `jobname = 'verify-cnaps-auto'` et `schedule = '0 3 1,15 * *'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260527140001_cnaps_cron.sql
git commit -m "feat: schedule verify-cnaps cron every 15 days"
```

---

## Task 4: Page `VerificationCNAPS.tsx` + tests (TDD)

**Files:**
- Create: `src/test/VerificationCNAPS.test.tsx`
- Create: `src/pages/VerificationCNAPS.tsx`

- [ ] **Step 1: Écrire les tests en premier**

```typescript
// src/test/VerificationCNAPS.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import VerificationCNAPS from "@/pages/VerificationCNAPS";

const mockAgents = [
  {
    id: "s1", first_name: "Jean", last_name: "Dupont",
    carte_pro_number: "CNAPS-001",
    cnaps_statut: "vert", cnaps_last_checked: "2026-05-20T10:00:00Z",
  },
  {
    id: "s2", first_name: "Paul", last_name: "Martin",
    carte_pro_number: "CNAPS-002",
    cnaps_statut: "rouge", cnaps_last_checked: "2026-05-15T08:00:00Z",
  },
  {
    id: "s3", first_name: "Marc", last_name: "Durand",
    carte_pro_number: null,
    cnaps_statut: "inconnu", cnaps_last_checked: null,
  },
];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    supabaseUrl: "https://test.supabase.co",
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "test-token" } } }),
    },
    from: (table: string) => {
      if (table === "stagiaires") {
        return {
          select: () => ({
            order: () => Promise.resolve({ data: mockAgents, error: null }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      return {
        select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
      };
    },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, roles: ["administrateur"] }),
}));

const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ ok: true, processed: 3, results: [] }),
});
vi.stubGlobal("fetch", mockFetch);

function renderPage() {
  return render(
    <MemoryRouter>
      <VerificationCNAPS />
    </MemoryRouter>
  );
}

describe("VerificationCNAPS", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("affiche le tableau avec les 3 agents et leurs badges", async () => {
    renderPage();
    expect(await screen.findByText("DUPONT")).toBeInTheDocument();
    expect(screen.getByText("MARTIN")).toBeInTheDocument();
    expect(screen.getByText("DURAND")).toBeInTheDocument();
    expect(screen.getByText("Valide")).toBeInTheDocument();
    expect(screen.getByText("Problème")).toBeInTheDocument();
    expect(screen.getByText("Inconnu")).toBeInTheDocument();
  });

  it("filtre 'Problème' ne montre que l'agent rouge", async () => {
    renderPage();
    await screen.findByText("DUPONT");
    fireEvent.click(screen.getByRole("button", { name: /problème/i }));
    await waitFor(() => {
      expect(screen.queryByText("DUPONT")).not.toBeInTheDocument();
      expect(screen.getByText("MARTIN")).toBeInTheDocument();
    });
  });

  it("bouton 'Vérifier tous' déclenche un POST vers la Edge Function", async () => {
    renderPage();
    await screen.findByText("DUPONT");
    fireEvent.click(screen.getByRole("button", { name: /vérifier tous/i }));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("verify-cnaps"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
cd /Users/lexminator/security-guard-pro && npx vitest run src/test/VerificationCNAPS.test.tsx 2>&1 | tail -10
```

Expected: FAIL — `@/pages/VerificationCNAPS` not found.

- [ ] **Step 3: Créer `src/pages/VerificationCNAPS.tsx`**

```tsx
// src/pages/VerificationCNAPS.tsx
// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Agent = {
  id: string;
  first_name: string;
  last_name: string;
  carte_pro_number: string | null;
  cnaps_statut: "vert" | "rouge" | "a_verifier" | "inconnu";
  cnaps_last_checked: string | null;
};

type Filtre = "tous" | "vert" | "rouge" | "a_verifier" | "inconnu";

const BADGE: Record<string, { label: string; className: string }> = {
  vert:       { label: "Valide",      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  rouge:      { label: "Problème",    className: "bg-red-500/10 text-red-400 border-red-500/30" },
  a_verifier: { label: "À vérifier",  className: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
  inconnu:    { label: "Inconnu",     className: "bg-muted/50 text-muted-foreground border-border/50" },
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
}

export default function VerificationCNAPS() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<Set<string>>(new Set());
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [filtre, setFiltre] = useState<Filtre>("tous");

  const SUPABASE_URL = (supabase as any).supabaseUrl as string;

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("stagiaires")
      .select("id, first_name, last_name, carte_pro_number, cnaps_statut, cnaps_last_checked")
      .order("last_name");
    if (error) toast.error(error.message);
    else setAgents(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function callVerifyFunction(stagiaireIds?: string[]) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/verify-cnaps`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(stagiaireIds ? { stagiaire_ids: stagiaireIds } : {}),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  async function handleVerifyAll() {
    setVerifyingAll(true);
    try {
      const result = await callVerifyFunction();
      toast.success(`${result.processed} agents vérifiés`);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur vérification");
    } finally {
      setVerifyingAll(false);
    }
  }

  async function handleVerifyOne(id: string) {
    setVerifying(prev => new Set(prev).add(id));
    try {
      await callVerifyFunction([id]);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur vérification");
    } finally {
      setVerifying(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  async function handleCorrection(id: string, statut: "vert" | "rouge") {
    const { error } = await supabase
      .from("stagiaires")
      .update({ cnaps_statut: statut, cnaps_last_checked: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else await load();
  }

  const FILTRES: { key: Filtre; label: string }[] = [
    { key: "tous", label: "Tous" },
    { key: "vert", label: "Valide" },
    { key: "rouge", label: "Problème" },
    { key: "a_verifier", label: "À vérifier" },
    { key: "inconnu", label: "Inconnu" },
  ];

  const visible = filtre === "tous" ? agents : agents.filter(a => a.cnaps_statut === filtre);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-yellow-400" />
          <div>
            <h1 className="text-2xl font-bold">DRACAR</h1>
            <p className="text-sm text-muted-foreground">Vérification CNAPS — mise à jour automatique tous les 15 jours</p>
          </div>
        </div>
        <Button onClick={handleVerifyAll} disabled={verifyingAll}>
          <RefreshCw className={`h-4 w-4 mr-2 ${verifyingAll ? "animate-spin" : ""}`} />
          {verifyingAll ? "Vérification…" : "Vérifier tous les agents"}
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTRES.map(f => (
          <Button
            key={f.key}
            variant={filtre === f.key ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltre(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Chargement…</p>
      ) : (
        <div className="border border-border/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="text-left p-3 font-medium text-xs">Agent</th>
                <th className="text-left p-3 font-medium text-xs">N° carte pro</th>
                <th className="text-left p-3 font-medium text-xs">Statut CNAPS</th>
                <th className="text-left p-3 font-medium text-xs">Dernière vérif</th>
                <th className="text-left p-3 font-medium text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(a => {
                const b = BADGE[a.cnaps_statut] ?? BADGE.inconnu;
                const isVerifying = verifying.has(a.id);
                return (
                  <tr key={a.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                    <td className="p-3 font-medium">
                      {a.last_name.toUpperCase()} {a.first_name}
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {a.carte_pro_number ?? "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={`text-xs ${b.className}`}>
                        {b.label}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {fmtDate(a.cnaps_last_checked)}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {a.carte_pro_number && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isVerifying}
                            onClick={() => handleVerifyOne(a.id)}
                          >
                            <RefreshCw className={`h-3 w-3 mr-1 ${isVerifying ? "animate-spin" : ""}`} />
                            Vérifier
                          </Button>
                        )}
                        {a.cnaps_statut === "a_verifier" && (
                          <>
                            <Button variant="ghost" size="sm" className="text-emerald-400 hover:text-emerald-300"
                              onClick={() => handleCorrection(a.id, "vert")}>
                              Marquer valide
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300"
                              onClick={() => handleCorrection(a.id, "rouge")}>
                              Marquer problème
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground text-sm">
                    Aucun agent pour ce filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Vérifier que les 3 tests passent**

```bash
cd /Users/lexminator/security-guard-pro && npx vitest run src/test/VerificationCNAPS.test.tsx 2>&1 | tail -20
```

Expected: 3/3 PASS. Si un test échoue, déboguer avant de continuer.

- [ ] **Step 5: Vérifier la suite complète**

```bash
cd /Users/lexminator/security-guard-pro && npx vitest run 2>&1 | tail -10
```

Expected: tous les tests passent (≥ 125), aucune régression.

- [ ] **Step 6: Commit**

```bash
git add src/pages/VerificationCNAPS.tsx src/test/VerificationCNAPS.test.tsx
git commit -m "feat: add DRACAR VerificationCNAPS page with filter and verify buttons"
```

---

## Task 5: Intégrations — Sidebar + Stagiaires badge + App.tsx route

**Files:**
- Modify: `src/components/AppSidebar.tsx`
- Modify: `src/pages/Stagiaires.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Ajouter `ShieldCheck` à l'import lucide dans `AppSidebar.tsx`**

Ouvrir `src/components/AppSidebar.tsx`. Ligne 1-6, l'import lucide-react est :
```tsx
import {
  LayoutDashboard, Users, GraduationCap, AlertTriangle,
  Calendar, FileText, BarChart3, Shield,
  LogOut, UserCog, UserCheck, Award, ClipboardList, BookOpen, MessageSquare, MessageSquareWarning, Bell, Building2, Receipt, Landmark
} from "lucide-react";
```

Ajouter `ShieldCheck` à la fin de la liste :
```tsx
import {
  LayoutDashboard, Users, GraduationCap, AlertTriangle,
  Calendar, FileText, BarChart3, Shield,
  LogOut, UserCog, UserCheck, Award, ClipboardList, BookOpen, MessageSquare, MessageSquareWarning, Bell, Building2, Receipt, Landmark, ShieldCheck
} from "lucide-react";
```

- [ ] **Step 2: Ajouter l'entrée DRACAR dans la sidebar**

Dans `AppSidebar.tsx`, trouver la ligne :
```tsx
{ title: "Financement OPCO", url: "/financement-opco", icon: Landmark, roles: ["administrateur", "secretaire"] },
```

Ajouter immédiatement après :
```tsx
{ title: "DRACAR", url: "/verification-cnaps", icon: ShieldCheck, roles: ["administrateur", "secretaire"] },
```

- [ ] **Step 3: Ajouter le badge CNAPS dans le panneau détail de `Stagiaires.tsx`**

Ouvrir `src/pages/Stagiaires.tsx`. Trouver la section "Carte professionnelle CNAPS" (autour de la ligne 322) :
```tsx
{(selected.carte_pro_number || selected.carte_pro_expiry) && (
  <div className="border-t border-border/50 pt-4 mt-4">
    <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
      <Shield className="h-3.5 w-3.5 text-primary" /> Carte professionnelle CNAPS
    </h3>
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">N° carte pro</p>
        <p className="font-mono">{selected.carte_pro_number || "—"}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Expiration</p>
        <p>{selected.carte_pro_expiry ? new Date(selected.carte_pro_expiry).toLocaleDateString("fr-FR") : "—"}</p>
      </div>
    </div>
  </div>
)}
```

Remplacer par :
```tsx
{(selected.carte_pro_number || selected.carte_pro_expiry) && (
  <div className="border-t border-border/50 pt-4 mt-4">
    <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
      <Shield className="h-3.5 w-3.5 text-primary" /> Carte professionnelle CNAPS
    </h3>
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">N° carte pro</p>
        <p className="font-mono">{selected.carte_pro_number || "—"}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Expiration</p>
        <p>{selected.carte_pro_expiry ? new Date(selected.carte_pro_expiry).toLocaleDateString("fr-FR") : "—"}</p>
      </div>
    </div>
    {(() => {
      const CNAPS_BADGE: Record<string, { label: string; cls: string }> = {
        vert:       { label: "CNAPS : Valide",      cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
        rouge:      { label: "CNAPS : Problème",    cls: "bg-red-500/10 text-red-400 border-red-500/30" },
        a_verifier: { label: "CNAPS : À vérifier",  cls: "bg-orange-500/10 text-orange-400 border-orange-500/30" },
        inconnu:    { label: "CNAPS : Non vérifié", cls: "bg-muted/50 text-muted-foreground border-border/50" },
      };
      const b = CNAPS_BADGE[selected.cnaps_statut ?? "inconnu"] ?? CNAPS_BADGE.inconnu;
      return (
        <div className="mt-3 flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs ${b.cls}`}>
            {b.label}
          </span>
          {selected.cnaps_last_checked && (
            <span className="text-xs text-muted-foreground">
              vérifié le {new Date(selected.cnaps_last_checked).toLocaleDateString("fr-FR")}
            </span>
          )}
        </div>
      );
    })()}
  </div>
)}
```

Note : `Badge` de Shadcn est déjà importé dans `Stagiaires.tsx` (vérifier l'import en haut du fichier, sinon utiliser le `span` inline ci-dessus qui n'a pas besoin d'import supplémentaire).

- [ ] **Step 4: Ajouter l'import et la route dans `App.tsx`**

Ouvrir `src/App.tsx`. Ajouter l'import avec les autres imports de pages :
```tsx
import VerificationCNAPS from "./pages/VerificationCNAPS";
```

Dans le bloc `<Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>`, ajouter après la route `/financement-opco` :
```tsx
<Route path="/verification-cnaps" element={<VerificationCNAPS />} />
```

- [ ] **Step 5: Vérifier la suite complète**

```bash
cd /Users/lexminator/security-guard-pro && npx vitest run 2>&1 | tail -10
```

Expected: ≥ 125 tests passent, aucune régression.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppSidebar.tsx src/pages/Stagiaires.tsx src/App.tsx
git commit -m "feat: add DRACAR to sidebar, CNAPS badge in stagiaire detail, route /verification-cnaps"
```

---

## Rappel post-déploiement

Après avoir exécuté toutes les tâches :

1. **Migration** : appliquer `20260527140000_cnaps_statut.sql` puis `20260527140001_cnaps_cron.sql` dans Supabase SQL Editor
2. **Edge Function** : déployer avec `supabase functions deploy verify-cnaps`
3. **Cron** : remplacer les placeholders `TON_PROJECT_REF` et `TON_CRON_SECRET` avant d'appliquer la migration cron
4. **Premier run** : depuis la page DRACAR, cliquer "Vérifier tous les agents" pour initialiser tous les statuts

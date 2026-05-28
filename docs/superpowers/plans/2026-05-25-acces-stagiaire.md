# Accès Stagiaire — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer automatiquement un compte Supabase Auth pour chaque stagiaire ajouté à une formation, lui envoyer ses identifiants par email, et bloquer l'accès à l'espace stagiaire en dehors de la fenêtre J → J+15.

**Architecture:** Edge Function `create-stagiaire-account` appelée depuis `saveManage` dans `Formations.tsx` après l'insert des participants. La fenêtre d'accès est vérifiée côté client dans `EspaceStagiaire.tsx` via une fonction `isActive` qui filtre les formations actives. Un onglet "Paramètres" permet au stagiaire de changer son mot de passe.

**Tech Stack:** React 18 + TypeScript, Supabase (PostgreSQL + Edge Functions + Auth admin API), Resend (email), Deno, Vitest + Testing Library.

---

## File Structure

**New files:**
- `supabase/migrations/20260525100000_stagiaires_auth_user_id.sql` — colonne `auth_user_id` sur `stagiaires`
- `supabase/functions/create-stagiaire-account/index.ts` — Edge Function principale
- `src/test/EspaceStagiaire.test.tsx` — tests accès fenêtre + onglet paramètres

**Modified files:**
- `src/pages/Formations.tsx:275-293` — `saveManage` appelle la Edge Function après insert
- `src/pages/EspaceStagiaire.tsx` — `isActive`, `AccessGate`, onglet Paramètres

---

## Task 1: Migration `auth_user_id` sur `stagiaires`

**Files:**
- Create: `supabase/migrations/20260525100000_stagiaires_auth_user_id.sql`

- [ ] **Step 1: Créer la migration**

```sql
-- supabase/migrations/20260525100000_stagiaires_auth_user_id.sql
ALTER TABLE public.stagiaires
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Appliquer via le dashboard Supabase**

Va sur dashboard Supabase → SQL Editor → colle et exécute le SQL ci-dessus.

- [ ] **Step 3: Marquer la migration comme appliquée**

```bash
supabase migration repair --status applied 20260525100000
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260525100000_stagiaires_auth_user_id.sql
git commit -m "feat: add auth_user_id column to stagiaires"
```

---

## Task 2: Edge Function `create-stagiaire-account`

**Files:**
- Create: `supabase/functions/create-stagiaire-account/index.ts`

- [ ] **Step 1: Créer le fichier**

```typescript
// supabase/functions/create-stagiaire-account/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function capitalize(s: string): string {
  if (!s) return "User";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function generatePassword(firstName: string): string {
  const base = capitalize(firstName.replace(/\s+/g, "").slice(0, 10));
  const digits = Math.floor(1000 + Math.random() * 9000).toString();
  const pwd = base + digits;
  return pwd.length >= 8 ? pwd : pwd + Math.floor(1000 + Math.random() * 9000).toString();
}

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

  let body: { stagiaire_id?: string; formation_id?: string };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { stagiaire_id, formation_id } = body;
  if (!stagiaire_id || !formation_id) {
    return new Response(JSON.stringify({ error: "stagiaire_id and formation_id are required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: stagiaire } = await adminClient
    .from("stagiaires")
    .select("id, first_name, last_name, email, auth_user_id")
    .eq("id", stagiaire_id)
    .maybeSingle();

  if (!stagiaire) {
    return new Response(JSON.stringify({ error: "Stagiaire not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!stagiaire.email) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "no_email" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (stagiaire.auth_user_id) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "already_exists" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: formation } = await adminClient
    .from("formations")
    .select("title, start_date")
    .eq("id", formation_id)
    .maybeSingle();

  const password = generatePassword(stagiaire.first_name);

  let userId: string;
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email: stagiaire.email,
    password,
    email_confirm: true,
  });

  if (createErr) {
    // Account may already exist in Auth but not linked — find and link it
    const { data: { users } } = await adminClient.auth.admin.listUsers();
    const existing = users.find((u) => u.email === stagiaire.email);
    if (!existing) {
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = existing.id;
  } else {
    userId = created.user.id;
  }

  await adminClient.from("user_roles").upsert(
    { user_id: userId, role: "stagiaire" },
    { onConflict: "user_id,role" }
  );

  await adminClient.from("stagiaires").update({ auth_user_id: userId }).eq("id", stagiaire_id);

  const startDateFr = formation?.start_date
    ? new Date(formation.start_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: stagiaire.email,
      subject: `Votre accès formation — ${formation?.title ?? "SecureCRM"}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:auto">
        <h2>Bonjour ${stagiaire.first_name},</h2>
        <p>Votre compte a été créé pour la formation <strong>${formation?.title ?? ""}</strong>${startDateFr ? ` débutant le ${startDateFr}` : ""}.</p>
        <p>Voici vos identifiants de connexion :</p>
        <ul>
          <li><strong>Email :</strong> ${stagiaire.email}</li>
          <li><strong>Mot de passe temporaire :</strong> <code style="background:#f0f0f0;padding:2px 6px;border-radius:4px">${password}</code></li>
        </ul>
        <p><a href="${SITE_URL}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Accéder à mon espace</a></p>
        <p style="font-size:12px;color:#888">Nous vous recommandons de changer votre mot de passe dès votre première connexion via l'onglet Paramètres.</p>
      </div>`,
    }),
  });

  return new Response(
    JSON.stringify({ ok: true, user_id: userId }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
```

- [ ] **Step 2: Déployer la Edge Function**

```bash
supabase functions deploy create-stagiaire-account
```

Expected: `Deployed: create-stagiaire-account`

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/create-stagiaire-account/index.ts
git commit -m "feat: add create-stagiaire-account edge function"
```

---

## Task 3: Appel de la Edge Function dans `Formations.tsx`

**Files:**
- Modify: `src/pages/Formations.tsx:275-293` (fonction `saveManage`)

- [ ] **Step 1: Modifier `saveManage`**

Remplacer la fonction `saveManage` actuelle (lignes 275–293) par :

```tsx
const saveManage = async () => {
  if (!manageFormation) return;
  const current = (participantsByFormation[manageFormation.id] ?? []).map((p) => p.stagiaire_id);
  const toAdd = manageSelected.filter((id) => !current.includes(id));
  const toRemove = current.filter((id) => !manageSelected.includes(id));
  if (toAdd.length) {
    const { error } = await supabase.from("formation_participants").insert(
      toAdd.map((sid) => ({ formation_id: manageFormation.id, stagiaire_id: sid, tarif: 0, resultat: "en_attente" }))
    );
    if (error) { toast.error(error.message); return; }
    const { data: { session } } = await supabase.auth.getSession();
    await Promise.all(
      toAdd.map((sid) =>
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-stagiaire-account`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ stagiaire_id: sid, formation_id: manageFormation.id }),
        }).catch((e) => console.error("create-stagiaire-account failed:", e))
      )
    );
  }
  if (toRemove.length) {
    const { error } = await supabase.from("formation_participants").delete().eq("formation_id", manageFormation.id).in("stagiaire_id", toRemove);
    if (error) { toast.error(error.message); return; }
  }
  toast.success("Participants mis à jour");
  setManageOpen(false);
  load();
};
```

- [ ] **Step 2: Vérifier les tests existants**

```bash
npx vitest run
```

Expected: tous les tests passent (86/86). La modification de `saveManage` n'affecte aucun test existant car `global.fetch` n'est pas appelé dans les tests actuels de Formations.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Formations.tsx
git commit -m "feat: call create-stagiaire-account when adding participants to formation"
```

---

## Task 4: Fenêtre d'accès dans `EspaceStagiaire.tsx`

**Files:**
- Modify: `src/pages/EspaceStagiaire.tsx`
- Create: `src/test/EspaceStagiaire.test.tsx`

- [ ] **Step 1: Écrire les tests**

```typescript
// src/test/EspaceStagiaire.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import EspaceStagiaire from "@/pages/EspaceStagiaire";

const makeDate = (daysFromNow: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
};

const mockFormation = (startOffset: number, endOffset: number) => ({
  id: "f1", title: "Formation SST", type: "SST",
  start_date: makeDate(startOffset),
  end_date: makeDate(endOffset),
  location: null,
});

const buildSupabaseMock = (formations: any[]) => ({
  auth: {
    getUser: () => Promise.resolve({ data: { user: { id: "u1", email: "jean@test.fr" } } }),
    signOut: () => Promise.resolve({}),
  },
  from: (table: string) => {
    if (table === "stagiaires") return {
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: "s1", first_name: "Jean", last_name: "Dupont", email: "jean@test.fr", status: "valide" }, error: null }) }) }),
    };
    if (table === "formation_participants") return {
      select: () => ({ eq: () => Promise.resolve({ data: formations.map(f => ({ formation: f })), error: null }) }),
    };
    return {
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
          order: () => Promise.resolve({ data: [], error: null }),
        }),
        in: () => ({ order: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
    };
  },
  storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: buildSupabaseMock([]) }));
vi.mock("@/components/MainCourante", () => ({
  PageMainCourante: () => null,
  ConsignesStagiaire: () => null,
  PermisFeuStagiaire: () => null,
  StatistiquesStagiaire: () => null,
  RondierStagiaire: () => null,
}));
vi.mock("@/lib/certificationUtils", () => ({
  CERT_LABELS: {},
  RECYCLAGE_TYPE: {},
  certStatusBadge: () => ({ status: "valide", label: "Valide", className: "" }),
  daysUntilExpiry: () => 100,
}));

const renderPage = () => render(<MemoryRouter><EspaceStagiaire /></MemoryRouter>);

describe("EspaceStagiaire — fenêtre d'accès", () => {
  it("affiche le dashboard quand une formation est active", async () => {
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: buildSupabaseMock([mockFormation(-2, 5)]),
    }));
    const { default: ES } = await import("@/pages/EspaceStagiaire");
    render(<MemoryRouter><ES /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText(/accès/i)).not.toBeInTheDocument());
  });

  it("affiche message expiré quand formation terminée depuis > 15j", async () => {
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: buildSupabaseMock([mockFormation(-30, -20)]),
    }));
    const { default: ES } = await import("@/pages/EspaceStagiaire");
    render(<MemoryRouter><ES /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/expiré/i)).toBeInTheDocument());
  });

  it("affiche message futur quand formation n'a pas encore débuté", async () => {
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: buildSupabaseMock([mockFormation(10, 15)]),
    }));
    const { default: ES } = await import("@/pages/EspaceStagiaire");
    render(<MemoryRouter><ES /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/ouvrira le/i)).toBeInTheDocument());
  });

  it("affiche message aucune formation si liste vide", async () => {
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: buildSupabaseMock([]),
    }));
    const { default: ES } = await import("@/pages/EspaceStagiaire");
    render(<MemoryRouter><ES /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/aucune formation/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent**

```bash
npx vitest run src/test/EspaceStagiaire.test.tsx
```

Expected: FAIL — les messages "expiré", "ouvrira le", "aucune formation" n'existent pas encore.

- [ ] **Step 3: Ajouter `isActive`, `formationsActives`, `AccessGate` dans `EspaceStagiaire.tsx`**

**3a.** En haut du fichier, après la dernière ligne d'import (ligne ~16), ajouter `Settings` aux imports lucide-react existants et ajouter les imports UI manquants :

Remplacer :
```tsx
import {
  FileText, Download, Eye, Calendar, MapPin, BookOpen, Plus, Shield,
  ChevronDown, ChevronUp, Camera, CheckCircle, Clock,
  LayoutDashboard, GraduationCap, LogOut, User, Menu,
  Award, X, PenLine, MessageSquare, Send
} from "lucide-react";
```

Par :
```tsx
import {
  FileText, Download, Eye, Calendar, MapPin, BookOpen, Plus, Shield,
  ChevronDown, ChevronUp, Camera, CheckCircle, Clock,
  LayoutDashboard, GraduationCap, LogOut, User, Menu,
  Award, X, PenLine, MessageSquare, Send, Settings
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
```

**3b.** Après les lignes existantes (après `formationsPassees`, autour de ligne 276), ajouter :

```tsx
const isActive = (f: any) => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const start = new Date(f.start_date); start.setHours(0, 0, 0, 0);
  const end = new Date(f.end_date ?? f.start_date); end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 15);
  return t >= start && t <= end;
};
const formationsActives = formations.filter(isActive);
const nextFuture = formations.filter(f => new Date(f.start_date) > new Date()).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
```

**3c.** Juste avant `const navItems = [` (ligne 277), ajouter le composant `AccessGate` :

```tsx
const AccessGate = ({ type, date }: { type: "expired" | "future" | "none"; date?: string }) => (
  <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
      <Clock className="h-8 w-8 text-muted-foreground" />
    </div>
    {type === "future" && date && (
      <>
        <h2 className="text-xl font-display font-bold">Accès pas encore ouvert</h2>
        <p className="text-muted-foreground text-sm max-w-xs">Votre espace ouvrira le {new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.</p>
      </>
    )}
    {type === "expired" && (
      <>
        <h2 className="text-xl font-display font-bold">Accès expiré</h2>
        <p className="text-muted-foreground text-sm max-w-xs">Votre accès a expiré. Contactez votre organisme de formation.</p>
      </>
    )}
    {type === "none" && (
      <>
        <h2 className="text-xl font-display font-bold">Aucune formation associée</h2>
        <p className="text-muted-foreground text-sm max-w-xs">Aucune formation n'est associée à votre compte. Contactez votre organisme de formation.</p>
      </>
    )}
  </div>
);
```

**3d.** Dans `renderPage` (ligne 735), ajouter le gate en tête de fonction. Remplacer :

```tsx
 const renderPage = () => {
    switch (page) {
```

Par :

```tsx
 const renderPage = () => {
    if (page !== "parametres") {
      if (formations.length === 0) return <AccessGate type="none" />;
      if (formationsActives.length === 0) {
        if (nextFuture) return <AccessGate type="future" date={nextFuture.start_date} />;
        return <AccessGate type="expired" />;
      }
    }
    switch (page) {
```

- [ ] **Step 4: Vérifier les tests**

```bash
npx vitest run src/test/EspaceStagiaire.test.tsx
```

Expected: PASS — 4 tests.

> Note : les tests utilisent `vi.doMock` + dynamic import pour recréer le module avec un mock différent par test. Si les tests passent avec `vi.mock` statique, c'est aussi acceptable — l'essentiel est que les 4 cas soient testés.

- [ ] **Step 5: Vérifier la suite complète**

```bash
npx vitest run
```

Expected: tous les tests passent (≥ 86).

- [ ] **Step 6: Commit**

```bash
git add src/pages/EspaceStagiaire.tsx src/test/EspaceStagiaire.test.tsx
git commit -m "feat: add access window gate to EspaceStagiaire"
```

---

## Task 5: Onglet Paramètres dans `EspaceStagiaire.tsx`

**Files:**
- Modify: `src/pages/EspaceStagiaire.tsx`

- [ ] **Step 1: Écrire le test**

Dans `src/test/EspaceStagiaire.test.tsx`, ajouter ce describe (dans le même fichier) :

```typescript
describe("EspaceStagiaire — onglet Paramètres", () => {
  it("affiche le formulaire de changement de mot de passe", async () => {
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: buildSupabaseMock([mockFormation(-2, 5)]),
    }));
    const { default: ES } = await import("@/pages/EspaceStagiaire");
    render(<MemoryRouter><ES /></MemoryRouter>);
    await waitFor(() => screen.getByText(/paramètres/i));
    const btn = screen.getByRole("button", { name: /paramètres/i });
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByText(/changer mon mot de passe/i)).toBeInTheDocument());
  });
});
```

Ajouter `fireEvent` aux imports testing-library en haut du fichier :
```typescript
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
```

- [ ] **Step 2: Vérifier que le test échoue**

```bash
npx vitest run src/test/EspaceStagiaire.test.tsx
```

Expected: FAIL — "Paramètres" button not found.

- [ ] **Step 3: Ajouter `"parametres"` au type `Page`**

Ligne 27 dans `EspaceStagiaire.tsx`. Remplacer :

```tsx
type Page = "dashboard" | "formations" | "documents" | "cours" | "competences" | "emargement" | "profil" | "messagerie" | "maincourante_nouveau" | "maincourante_consulter" | "consignes" | "permisfeu" | "statistiques" | "rondier";
```

Par :

```tsx
type Page = "dashboard" | "formations" | "documents" | "cours" | "competences" | "emargement" | "profil" | "messagerie" | "maincourante_nouveau" | "maincourante_consulter" | "consignes" | "permisfeu" | "statistiques" | "rondier" | "parametres";
```

- [ ] **Step 4: Ajouter l'entrée nav "Paramètres"**

Dans le tableau `navItems` (ligne 277+), ajouter à la fin avant la parenthèse fermante :

```tsx
{ id: "parametres", label: "Paramètres", icon: Settings },
```

Le tableau complet doit ressembler à :
```tsx
const navItems = [
  { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { id: "formations", label: "Mes formations", icon: GraduationCap },
  { id: "emargement", label: "Émargement", icon: PenLine },
  { id: "competences", label: "Mes compétences", icon: Award },
  { id: "documents", label: "Mes documents", icon: FileText },
  { id: "cours", label: "Mes cours", icon: BookOpen },
  { id: "messagerie", label: "Messagerie", icon: MessageSquare, badge: unreadFromFormateur },
  { id: "maincourante_nouveau", label: "Nouveau", icon: Plus, parent: "maincourante", parentLabel: "Main courante" },
  { id: "maincourante_consulter", label: "Consulter", icon: Eye, parent: "maincourante", parentLabel: "Main courante" },
  { id: "profil", label: "Mon profil", icon: User },
  { id: "parametres", label: "Paramètres", icon: Settings },
];
```

- [ ] **Step 5: Ajouter le composant `PageParametres`**

Ajouter avant `const renderPage = () => {` (ligne 735) :

```tsx
const PageParametres = () => {
  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [saving, setSaving] = useState(false);
  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd1.length < 8) { toast.error("8 caractères minimum"); return; }
    if (pwd1 !== pwd2) { toast.error("Les mots de passe ne correspondent pas"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd1 });
    if (error) { toast.error(error.message); } else { toast.success("Mot de passe mis à jour"); setPwd1(""); setPwd2(""); }
    setSaving(false);
  };
  return (
    <div className="space-y-6 max-w-md">
      <h1 className="text-2xl font-display font-bold">Paramètres</h1>
      <Card className="p-6 bg-card/60 border-border/50">
        <h2 className="font-semibold mb-4">Changer mon mot de passe</h2>
        <form onSubmit={handleChange} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="pwd1">Nouveau mot de passe</Label>
            <Input id="pwd1" type="password" value={pwd1} onChange={(e) => setPwd1(e.target.value)} placeholder="8 caractères minimum" className="w-full min-h-[44px]" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pwd2">Confirmer le mot de passe</Label>
            <Input id="pwd2" type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} placeholder="Répétez le mot de passe" className="w-full min-h-[44px]" />
          </div>
          <Button type="submit" disabled={saving} className="w-full gradient-primary text-primary-foreground min-h-[44px]">
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      </Card>
    </div>
  );
};
```

- [ ] **Step 6: Ajouter le case dans `renderPage`**

Dans la fonction `renderPage`, après `case "profil": return <PageProfil />;`, ajouter :

```tsx
case "parametres": return <PageParametres />;
```

- [ ] **Step 7: Vérifier les tests**

```bash
npx vitest run src/test/EspaceStagiaire.test.tsx
```

Expected: PASS — 5 tests (4 access window + 1 paramètres).

- [ ] **Step 8: Vérifier la suite complète**

```bash
npx vitest run
```

Expected: tous les tests passent.

- [ ] **Step 9: Commit**

```bash
git add src/pages/EspaceStagiaire.tsx src/test/EspaceStagiaire.test.tsx
git commit -m "feat: add parametres tab with password change to EspaceStagiaire"
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
# Expected: no errors
```

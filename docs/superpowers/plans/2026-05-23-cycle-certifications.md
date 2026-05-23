# Cycle de certifications stagiaires — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter le cycle de vie des certifications par stagiaire : création automatique depuis les formations validées, saisie manuelle externe, alertes multi-destinataires (90j/30j/7j) email + in-app, suggestions de recyclage.

**Architecture:** PostgreSQL trigger pour la création automatique depuis `formation_participants`, Edge Function Deno quotidienne pour les alertes, composants React contrôlés pour les UI admin/stagiaire, Supabase Realtime pour la cloche de notification.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind + Shadcn UI, Supabase (PostgreSQL, Realtime, Edge Functions), Resend (email), Vitest + Testing Library, GitHub Actions (cron).

---

## File Structure

**New files:**
- `supabase/migrations/20260523120000_certifications_tables.sql` — tables + RLS
- `supabase/migrations/20260523120001_certifications_trigger.sql` — trigger auto-création
- `src/types/certifications.ts` — interfaces TypeScript + constantes
- `src/lib/certificationUtils.ts` — fonctions pures (badge, jours, calculs)
- `src/test/certificationUtils.test.ts` — tests unitaires
- `supabase/functions/check-expirations/index.ts` — Edge Function alertes
- `.github/workflows/check-expirations.yml` — cron GitHub Actions
- `src/components/NotificationBell.tsx` — cloche in-app
- `src/test/NotificationBell.test.tsx` — tests composant
- `src/components/CertificationsTab.tsx` — onglet certifications admin
- `src/test/CertificationsTab.test.tsx` — tests composant

**Modified files:**
- `src/pages/Stagiaires.tsx` — ajout card Certifications dans fiche
- `src/pages/Rappels.tsx` — ajout onglet "Certifications stagiaires"
- `src/pages/EspaceStagiaire.tsx` — ajout section "Mes certifications"
- `src/components/AppLayout.tsx` — ajout NotificationBell dans header

---

### Task 1: DB Migration — tables certifications + notifications

**Files:**
- Create: `supabase/migrations/20260523120000_certifications_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Table certifications
CREATE TABLE public.certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stagiaire_id UUID NOT NULL REFERENCES public.stagiaires(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  date_obtention DATE NOT NULL,
  date_expiration DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'auto',
  formation_id UUID REFERENCES public.formations(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stagiaire_id, type)
);

CREATE TRIGGER trg_certifications_updated
  BEFORE UPDATE ON public.certifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY certs_select_auth ON public.certifications
  FOR SELECT TO authenticated
  USING (
    stagiaire_id IN (
      SELECT id FROM public.stagiaires WHERE user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
    OR public.has_role(auth.uid(), 'formateur')
  );

CREATE POLICY certs_write_admin ON public.certifications
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  );

-- Table notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinataire_id UUID NOT NULL,
  destinataire_type TEXT NOT NULL,
  certification_id UUID REFERENCES public.certifications(id) ON DELETE CASCADE,
  type_alerte TEXT NOT NULL,
  email_envoye BOOLEAN DEFAULT false,
  lu BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifs_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (destinataire_id = auth.uid());

CREATE POLICY notifs_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING (destinataire_id = auth.uid())
  WITH CHECK (destinataire_id = auth.uid());

CREATE POLICY notifs_admin_all ON public.notifications
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  );
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: Migration applied without errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260523120000_certifications_tables.sql
git commit -m "feat: add certifications and notifications tables with RLS"
```

---

### Task 2: PostgreSQL Trigger — auto-création certifications

**Files:**
- Create: `supabase/migrations/20260523120001_certifications_trigger.sql`

- [ ] **Step 1: Write the migration**

```sql
CREATE OR REPLACE FUNCTION public.create_certification_from_formation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_type TEXT;
  v_months INT;
  v_end_date DATE;
BEGIN
  IF NEW.status <> 'valide' OR NEW.resultat <> 'obtenu' THEN
    RETURN NEW;
  END IF;

  SELECT
    CASE f.type
      WHEN 'SST'     THEN 'sst'
      WHEN 'MAC_APS' THEN 'mac_aps'
      WHEN 'SSIAP1'  THEN 'ssiap1'
      WHEN 'SSIAP2'  THEN 'ssiap2'
      WHEN 'SSIAP3'  THEN 'ssiap3'
      WHEN 'APS'     THEN 'tfp_aps'
      WHEN 'H0B0'    THEN 'h0b0'
      ELSE NULL
    END,
    CASE f.type
      WHEN 'SST'     THEN 24
      WHEN 'MAC_APS' THEN 60
      WHEN 'SSIAP1'  THEN 36
      WHEN 'SSIAP2'  THEN 36
      WHEN 'SSIAP3'  THEN 36
      WHEN 'APS'     THEN 60
      WHEN 'H0B0'    THEN 36
      ELSE NULL
    END,
    f.end_date
  INTO v_type, v_months, v_end_date
  FROM public.formations f
  WHERE f.id = NEW.formation_id;

  IF v_type IS NULL OR v_end_date IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.certifications (
    stagiaire_id,
    type,
    date_obtention,
    date_expiration,
    source,
    formation_id
  ) VALUES (
    NEW.stagiaire_id,
    v_type,
    v_end_date,
    v_end_date + (v_months || ' months')::INTERVAL,
    'auto',
    NEW.formation_id
  )
  ON CONFLICT (stagiaire_id, type) DO UPDATE SET
    date_obtention = EXCLUDED.date_obtention,
    date_expiration = EXCLUDED.date_expiration,
    formation_id = EXCLUDED.formation_id,
    source = 'auto',
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_certification
  AFTER UPDATE OF status, resultat ON public.formation_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.create_certification_from_formation();
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: Migration applied without errors.

- [ ] **Step 3: Verify trigger exists**

In Supabase dashboard → SQL Editor:

```sql
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trg_auto_certification';
```

Expected: 1 row, `UPDATE`, `AFTER`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260523120001_certifications_trigger.sql
git commit -m "feat: add PostgreSQL trigger for automatic certification creation"
```

---

### Task 3: TypeScript types + utility functions

**Files:**
- Create: `src/types/certifications.ts`
- Create: `src/lib/certificationUtils.ts`
- Create: `src/test/certificationUtils.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/test/certificationUtils.test.ts
import { describe, it, expect } from "vitest";
import {
  CERT_LABELS,
  CERT_DURATIONS_MONTHS,
  RECYCLAGE_TYPE,
  certStatusBadge,
  daysUntilExpiry,
  calcDateExpiration,
} from "../lib/certificationUtils";

describe("CERT_LABELS", () => {
  it("has label for sst", () => { expect(CERT_LABELS.sst).toBe("SST"); });
  it("has label for tfp_aps", () => { expect(CERT_LABELS.tfp_aps).toBe("TFP APS"); });
  it("has label for epi", () => { expect(CERT_LABELS.epi).toBe("EPI / Extincteurs"); });
});

describe("CERT_DURATIONS_MONTHS", () => {
  it("sst is 24 months", () => { expect(CERT_DURATIONS_MONTHS.sst).toBe(24); });
  it("epi is 12 months", () => { expect(CERT_DURATIONS_MONTHS.epi).toBe(12); });
  it("tfp_aps is 60 months", () => { expect(CERT_DURATIONS_MONTHS.tfp_aps).toBe(60); });
});

describe("RECYCLAGE_TYPE", () => {
  it("sst recyclage is mac_sst", () => { expect(RECYCLAGE_TYPE.sst).toBe("mac_sst"); });
  it("tfp_aps recyclage is mac_aps", () => { expect(RECYCLAGE_TYPE.tfp_aps).toBe("mac_aps"); });
});

describe("daysUntilExpiry", () => {
  it("returns positive days for future date", () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    expect(daysUntilExpiry(future.toISOString().slice(0, 10))).toBeCloseTo(30, 0);
  });
  it("returns negative days for past date", () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    expect(daysUntilExpiry(past.toISOString().slice(0, 10))).toBeLessThan(0);
  });
  it("returns null for null input", () => {
    expect(daysUntilExpiry(null)).toBeNull();
  });
});

describe("certStatusBadge", () => {
  it("returns expire for past date", () => {
    const past = new Date(); past.setDate(past.getDate() - 1);
    expect(certStatusBadge(past.toISOString().slice(0, 10)).status).toBe("expire");
  });
  it("returns urgent for <30 days", () => {
    const soon = new Date(); soon.setDate(soon.getDate() + 15);
    expect(certStatusBadge(soon.toISOString().slice(0, 10)).status).toBe("urgent");
  });
  it("returns renouveler for 30-90 days", () => {
    const mid = new Date(); mid.setDate(mid.getDate() + 60);
    expect(certStatusBadge(mid.toISOString().slice(0, 10)).status).toBe("renouveler");
  });
  it("returns valide for >90 days", () => {
    const far = new Date(); far.setDate(far.getDate() + 100);
    expect(certStatusBadge(far.toISOString().slice(0, 10)).status).toBe("valide");
  });
});

describe("calcDateExpiration", () => {
  it("adds 24 months for sst", () => {
    expect(calcDateExpiration("2026-01-15", "sst")).toBe("2028-01-15");
  });
  it("adds 12 months for epi", () => {
    expect(calcDateExpiration("2026-03-01", "epi")).toBe("2027-03-01");
  });
  it("adds 60 months for tfp_aps", () => {
    expect(calcDateExpiration("2026-05-01", "tfp_aps")).toBe("2031-05-01");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/certificationUtils.test.ts
```

Expected: FAIL — imports not found.

- [ ] **Step 3: Create types file**

```typescript
// src/types/certifications.ts
export type CertType =
  | "sst" | "mac_sst" | "ssiap1" | "ssiap2" | "ssiap3"
  | "tfp_aps" | "mac_aps" | "epi" | "h0b0";

export type CertSource = "auto" | "manuel";
export type CertStatus = "valide" | "renouveler" | "urgent" | "expire";

export interface Certification {
  id: string;
  stagiaire_id: string;
  type: CertType;
  date_obtention: string;
  date_expiration: string;
  source: CertSource;
  formation_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CertStatusBadge {
  status: CertStatus;
  label: string;
  className: string;
}
```

- [ ] **Step 4: Create certificationUtils file**

```typescript
// src/lib/certificationUtils.ts
import type { CertType, CertStatusBadge } from "../types/certifications";

export const CERT_LABELS: Record<CertType, string> = {
  sst: "SST",
  mac_sst: "MAC SST",
  ssiap1: "SSIAP 1",
  ssiap2: "SSIAP 2",
  ssiap3: "SSIAP 3",
  tfp_aps: "TFP APS",
  mac_aps: "MAC APS",
  epi: "EPI / Extincteurs",
  h0b0: "H0B0",
};

export const CERT_DURATIONS_MONTHS: Record<CertType, number> = {
  sst: 24, mac_sst: 24,
  ssiap1: 36, ssiap2: 36, ssiap3: 36,
  tfp_aps: 60, mac_aps: 60,
  epi: 12,
  h0b0: 36,
};

export const RECYCLAGE_TYPE: Record<CertType, CertType> = {
  sst: "mac_sst", mac_sst: "mac_sst",
  ssiap1: "ssiap1", ssiap2: "ssiap2", ssiap3: "ssiap3",
  tfp_aps: "mac_aps", mac_aps: "mac_aps",
  epi: "epi",
  h0b0: "h0b0",
};

export function daysUntilExpiry(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export function certStatusBadge(dateExpiration: string): CertStatusBadge {
  const days = daysUntilExpiry(dateExpiration) ?? -1;
  if (days < 0)   return { status: "expire",    label: "Expiré",        className: "bg-destructive/20 text-destructive border-destructive/30" };
  if (days < 30)  return { status: "urgent",    label: "Urgent",        className: "bg-orange-500/20 text-orange-400 border-orange-500/30" };
  if (days <= 90) return { status: "renouveler",label: "À renouveler",  className: "bg-warning/20 text-warning border-warning/30" };
  return           { status: "valide",           label: "Valide",        className: "bg-success/20 text-success border-success/30" };
}

export function calcDateExpiration(dateObtention: string, type: CertType): string {
  const d = new Date(dateObtention);
  d.setMonth(d.getMonth() + CERT_DURATIONS_MONTHS[type]);
  return d.toISOString().slice(0, 10);
}

export function formatDateFr(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR");
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/test/certificationUtils.test.ts
```

Expected: All 12 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/certifications.ts src/lib/certificationUtils.ts src/test/certificationUtils.test.ts
git commit -m "feat: add certification types and utility functions"
```

---

### Task 4: Edge Function check-expirations

**Files:**
- Create: `supabase/functions/check-expirations/index.ts`

- [ ] **Step 1: Create the Edge Function**

```typescript
// supabase/functions/check-expirations/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@3.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RECYCLAGE_TYPE: Record<string, string> = {
  sst: "mac_sst", mac_sst: "mac_sst",
  ssiap1: "ssiap1", ssiap2: "ssiap2", ssiap3: "ssiap3",
  tfp_aps: "mac_aps", mac_aps: "mac_aps",
  epi: "epi", h0b0: "h0b0",
};

const CERT_LABELS: Record<string, string> = {
  sst: "SST", mac_sst: "MAC SST",
  ssiap1: "SSIAP 1", ssiap2: "SSIAP 2", ssiap3: "SSIAP 3",
  tfp_aps: "TFP APS", mac_aps: "MAC APS",
  epi: "EPI / Extincteurs", h0b0: "H0B0",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

  const today = new Date();
  const errors: string[] = [];
  const processed: string[] = [];

  // Collect all certs needing admin summary
  const adminBatch: Array<{ cert: any; stagiaire: any; threshold: number }> = [];

  // --- Process 90j / 30j / 7j thresholds ---
  for (const days of [90, 30, 7]) {
    const target = new Date(today);
    target.setDate(target.getDate() + days);
    const dateStr = target.toISOString().slice(0, 10);

    const { data: certs, error: certsErr } = await db
      .from("certifications")
      .select("*, stagiaires(id, first_name, last_name, email, user_id, entreprise_id)")
      .eq("date_expiration", dateStr);

    if (certsErr) { errors.push(`fetch ${days}j: ${certsErr.message}`); continue; }

    for (const cert of (certs ?? [])) {
      try {
        const stagiaire = cert.stagiaires;
        const alerteType = `${days}j`;

        // Idempotence check
        const { data: dup } = await db
          .from("notifications")
          .select("id")
          .eq("certification_id", cert.id)
          .eq("type_alerte", alerteType)
          .maybeSingle();
        if (dup) { processed.push(`skip:${cert.id}:${alerteType}`); continue; }

        // Recyclage sessions (next 90 days)
        const in90 = new Date(today);
        in90.setDate(in90.getDate() + 90);
        const recyclageType = (RECYCLAGE_TYPE[cert.type] ?? cert.type).toUpperCase();
        const { data: sessions } = await db
          .from("formations")
          .select("id, title, start_date, location")
          .eq("type", recyclageType)
          .gte("start_date", today.toISOString().slice(0, 10))
          .lte("start_date", in90.toISOString().slice(0, 10))
          .order("start_date")
          .limit(3);

        // Insert stagiaire notification
        const { data: stagNotif } = await db
          .from("notifications")
          .insert({
            destinataire_id: stagiaire?.user_id ?? cert.stagiaire_id,
            destinataire_type: "stagiaire",
            certification_id: cert.id,
            type_alerte: alerteType,
          })
          .select("id")
          .single();

        // Insert entreprise notification if applicable
        if (stagiaire?.entreprise_id) {
          await db.from("notifications").insert({
            destinataire_id: stagiaire.entreprise_id,
            destinataire_type: "entreprise",
            certification_id: cert.id,
            type_alerte: alerteType,
          });
        }

        adminBatch.push({ cert, stagiaire, threshold: days });

        // Send stagiaire email
        if (resend && stagiaire?.email) {
          const certLabel = CERT_LABELS[cert.type] ?? cert.type;
          const expiryFr = new Date(cert.date_expiration).toLocaleDateString("fr-FR");
          const sessionsHtml = (sessions ?? []).length > 0
            ? `<ul>${(sessions ?? []).map((s: any) =>
                `<li>${s.title} — ${new Date(s.start_date).toLocaleDateString("fr-FR")}${s.location ? ` — ${s.location}` : ""}</li>`
              ).join("")}</ul>`
            : "<p>Contactez votre formateur pour planifier un recyclage.</p>";

          await resend.emails.send({
            from: "SecureCRM <noreply@secureguardpro.fr>",
            to: stagiaire.email,
            subject: `⚠️ Votre certification ${certLabel} expire dans ${days} jours`,
            html: `<p>Bonjour ${stagiaire.first_name},</p>
<p>Votre certification <strong>${certLabel}</strong> expire le <strong>${expiryFr}</strong> (dans ${days} jours).</p>
<p><strong>Sessions de recyclage disponibles :</strong></p>${sessionsHtml}
<p><a href="https://secureguardpro.fr/espace-stagiaire">Accéder à mon espace stagiaire</a></p>`,
          });

          if (stagNotif) {
            await db.from("notifications").update({ email_envoye: true }).eq("id", stagNotif.id);
          }
        }

        processed.push(`ok:${cert.id}:${alerteType}`);
      } catch (e: any) {
        errors.push(`cert ${cert.id}: ${e.message}`);
      }
    }
  }

  // --- Process expired today ---
  const todayStr = today.toISOString().slice(0, 10);
  const { data: expired } = await db
    .from("certifications")
    .select("*, stagiaires(id, first_name, last_name, email, user_id, entreprise_id)")
    .eq("date_expiration", todayStr);

  for (const cert of (expired ?? [])) {
    try {
      const { data: dup } = await db
        .from("notifications")
        .select("id")
        .eq("certification_id", cert.id)
        .eq("type_alerte", "expire")
        .maybeSingle();
      if (dup) continue;

      await db.from("notifications").insert({
        destinataire_id: cert.stagiaires?.user_id ?? cert.stagiaire_id,
        destinataire_type: "stagiaire",
        certification_id: cert.id,
        type_alerte: "expire",
      });

      adminBatch.push({ cert, stagiaire: cert.stagiaires, threshold: 0 });
      processed.push(`expire:${cert.id}`);
    } catch (e: any) {
      errors.push(`expire ${cert.id}: ${e.message}`);
    }
  }

  // --- Admin summary email (one per run) ---
  if (resend && adminBatch.length > 0) {
    const { data: admins } = await db
      .from("profiles")
      .select("email")
      .eq("role", "administrateur");

    for (const admin of (admins ?? [])) {
      if (!admin.email) continue;
      const rowsHtml = adminBatch.map(({ cert, stagiaire, threshold }) =>
        `<tr><td>${stagiaire?.first_name ?? ""} ${stagiaire?.last_name ?? ""}</td>
<td>${CERT_LABELS[cert.type] ?? cert.type}</td>
<td>${new Date(cert.date_expiration).toLocaleDateString("fr-FR")}</td>
<td>${threshold === 0 ? "Expiré" : `${threshold}j`}</td></tr>`
      ).join("");

      await resend.emails.send({
        from: "SecureCRM <noreply@secureguardpro.fr>",
        to: admin.email,
        subject: `Certifications — ${adminBatch.length} expirations dans les prochains jours`,
        html: `<p>Bonjour,</p>
<p>Récapitulatif des certifications à renouveler :</p>
<table border="1" cellpadding="6" style="border-collapse:collapse">
<thead><tr><th>Stagiaire</th><th>Certification</th><th>Expiration</th><th>Délai</th></tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
<p><a href="https://secureguardpro.fr/rappels">Voir les rappels</a></p>`,
      });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed: processed.length, errors }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
```

- [ ] **Step 2: Deploy**

```bash
npx supabase functions deploy check-expirations
```

Expected: Deployed successfully.

- [ ] **Step 3: Set Resend secret**

```bash
npx supabase secrets set RESEND_API_KEY=<your_resend_api_key>
```

- [ ] **Step 4: Test with curl (empty DB = 0 processed, no errors)**

```bash
curl -sf -X POST \
  "https://hvqbggkfqssvbmracscm.supabase.co/functions/v1/check-expirations" \
  -H "Authorization: Bearer $(npx supabase status | grep anon | awk '{print $NF}')" \
  -H "Content-Type: application/json"
```

Expected: `{"ok":true,"processed":0,"errors":[]}`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/check-expirations/index.ts
git commit -m "feat: add check-expirations Edge Function with Resend email alerts"
```

---

### Task 5: GitHub Actions cron

**Files:**
- Create: `.github/workflows/check-expirations.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
# .github/workflows/check-expirations.yml
name: Check certification expirations

on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Call check-expirations Edge Function
        run: |
          curl -sf -X POST \
            "${{ secrets.SUPABASE_EDGE_FUNCTION_URL }}/check-expirations" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json"
```

- [ ] **Step 2: Add GitHub Secrets (manual)**

In GitHub repo → Settings → Secrets and variables → Actions, add:
- `SUPABASE_EDGE_FUNCTION_URL`: `https://hvqbggkfqssvbmracscm.supabase.co/functions/v1`
- `SUPABASE_ANON_KEY`: value from `npx supabase status`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/check-expirations.yml
git commit -m "feat: add GitHub Actions daily cron for certification expiration checks"
```

---

### Task 6: NotificationBell component

**Files:**
- Create: `src/components/NotificationBell.tsx`
- Create: `src/test/NotificationBell.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/test/NotificationBell.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import NotificationBell from "../components/NotificationBell";

vi.mock("../integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        })),
      })),
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-123" } }),
}));

describe("NotificationBell", () => {
  it("renders bell button", async () => {
    render(<NotificationBell />);
    expect(screen.getByRole("button", { name: /notification/i })).toBeInTheDocument();
  });

  it("shows no badge when 0 unread", async () => {
    render(<NotificationBell />);
    await waitFor(() => {
      expect(screen.queryByText(/^[0-9]+$/)).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/NotificationBell.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

```tsx
// src/components/NotificationBell.tsx
import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Notif {
  id: string;
  type_alerte: string;
  lu: boolean;
  created_at: string;
  certifications?: { type: string; date_expiration: string } | null;
}

const CERT_LABELS: Record<string, string> = {
  sst: "SST", mac_sst: "MAC SST", ssiap1: "SSIAP 1", ssiap2: "SSIAP 2", ssiap3: "SSIAP 3",
  tfp_aps: "TFP APS", mac_aps: "MAC APS", epi: "EPI / Extincteurs", h0b0: "H0B0",
};

const ALERTE_LABEL: Record<string, string> = {
  "90j": "expire dans 90 jours", "30j": "expire dans 30 jours",
  "7j": "expire dans 7 jours", "expire": "est expirée",
};

function dateRelative(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "à l'instant";
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifs.filter((n) => !n.lu).length;

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, type_alerte, lu, created_at, certifications(type, date_expiration)")
      .eq("destinataire_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    setNotifs((data as Notif[]) ?? []);
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ lu: true }).eq("id", id);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, lu: true } : n));
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notif-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `destinataire_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-card shadow-xl">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <Badge variant="outline" className="text-xs border-destructive/40 text-destructive">
                {unread} non lue{unread > 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {notifs.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Aucune notification</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notifs.map((n) => {
                const certType = n.certifications?.type ?? "";
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={"w-full text-left p-3 border-b border-border/50 hover:bg-secondary/40 transition-colors " + (!n.lu ? "bg-primary/5" : "")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm">
                          {certType && `${CERT_LABELS[certType] ?? certType} `}
                          <span className="text-muted-foreground">{ALERTE_LABEL[n.type_alerte] ?? n.type_alerte}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{dateRelative(n.created_at)}</p>
                      </div>
                      {!n.lu && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/NotificationBell.test.tsx
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/NotificationBell.tsx src/test/NotificationBell.test.tsx
git commit -m "feat: add NotificationBell component with Supabase Realtime"
```

---

### Task 7: CertificationsTab component

**Files:**
- Create: `src/components/CertificationsTab.tsx`
- Create: `src/test/CertificationsTab.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// src/test/CertificationsTab.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CertificationsTab from "../components/CertificationsTab";

vi.mock("../integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
      delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
    })),
  },
}));

describe("CertificationsTab", () => {
  it("renders empty state when no certifications", async () => {
    render(<CertificationsTab stagiaireId="stag-123" isAdmin={false} />);
    expect(await screen.findByText(/aucune certification/i)).toBeInTheDocument();
  });

  it("shows Ajouter button for admin", async () => {
    render(<CertificationsTab stagiaireId="stag-123" isAdmin={true} />);
    expect(await screen.findByRole("button", { name: /ajouter/i })).toBeInTheDocument();
  });

  it("hides Ajouter button for non-admin", async () => {
    render(<CertificationsTab stagiaireId="stag-123" isAdmin={false} />);
    await screen.findByText(/aucune certification/i);
    expect(screen.queryByRole("button", { name: /ajouter/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/CertificationsTab.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

```tsx
// src/components/CertificationsTab.tsx
import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Certification, CertType } from "@/types/certifications";
import {
  CERT_LABELS,
  CERT_DURATIONS_MONTHS,
  certStatusBadge,
  calcDateExpiration,
  formatDateFr,
  daysUntilExpiry,
} from "@/lib/certificationUtils";

const CERT_TYPES = Object.keys(CERT_LABELS) as CertType[];

export default function CertificationsTab({ stagiaireId, isAdmin }: { stagiaireId: string; isAdmin: boolean }) {
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Certification | null>(null);
  const [form, setForm] = useState({ type: "sst" as CertType, date_obtention: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const dateExpiration = form.date_obtention ? calcDateExpiration(form.date_obtention, form.type) : "";

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("certifications")
      .select("*")
      .eq("stagiaire_id", stagiaireId)
      .order("date_expiration");
    setCerts((data as Certification[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [stagiaireId]);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ type: "sst", date_obtention: "", notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (c: Certification) => {
    setEditTarget(c);
    setForm({ type: c.type, date_obtention: c.date_obtention, notes: c.notes ?? "" });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.date_obtention) { toast.error("Date d'obtention requise"); return; }
    setSaving(true);
    try {
      const payload = {
        stagiaire_id: stagiaireId,
        type: form.type,
        date_obtention: form.date_obtention,
        date_expiration: dateExpiration,
        source: "manuel" as const,
        notes: form.notes || null,
      };
      if (editTarget) {
        const { error } = await supabase
          .from("certifications")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editTarget.id);
        if (error) throw error;
        toast.success("Certification mise à jour");
      } else {
        const { error } = await supabase.from("certifications").insert(payload);
        if (error) {
          if (error.code === "23505") {
            toast.error("Ce type existe déjà pour ce stagiaire. Modifiez la ligne existante.");
          } else {
            throw error;
          }
          return;
        }
        toast.success("Certification ajoutée");
      }
      setDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: Certification) => {
    if (!confirm(`Supprimer ${CERT_LABELS[c.type] ?? c.type} ?`)) return;
    const { error } = await supabase.from("certifications").delete().eq("id", c.id);
    if (error) toast.error(error.message); else { toast.success("Supprimé"); load(); }
  };

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex justify-end">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gradient-primary text-primary-foreground" onClick={openAdd}>
                <Plus className="h-4 w-4 mr-2" /> Ajouter une certification externe
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>{editTarget ? "Modifier" : "Ajouter une certification externe"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as CertType })}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CERT_TYPES.map((t) => <SelectItem key={t} value={t}>{CERT_LABELS[t]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date d'obtention</Label>
                  <input
                    type="date"
                    className="mt-1 w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm"
                    value={form.date_obtention}
                    onChange={(e) => setForm({ ...form, date_obtention: e.target.value })}
                  />
                </div>
                {dateExpiration && (
                  <p className="text-sm text-muted-foreground">
                    Expiration calculée : <strong>{new Date(dateExpiration).toLocaleDateString("fr-FR")}</strong>
                    {" "}({CERT_DURATIONS_MONTHS[form.type]} mois)
                  </p>
                )}
                <div>
                  <Label>Notes (optionnel)</Label>
                  <Textarea className="mt-1" value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                  <Button onClick={save} disabled={saving} className="gradient-primary text-primary-foreground">
                    {saving ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {certs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
          Aucune certification enregistrée
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="pb-3 px-2">Type</th>
                <th className="pb-3 px-2">Obtenue le</th>
                <th className="pb-3 px-2">Expire le</th>
                <th className="pb-3 px-2">Statut</th>
                <th className="pb-3 px-2">Source</th>
                {isAdmin && <th className="pb-3 px-2"></th>}
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => {
                const badge = certStatusBadge(c.date_expiration);
                const days = daysUntilExpiry(c.date_expiration);
                return (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="py-3 px-2 font-medium">{CERT_LABELS[c.type] ?? c.type}</td>
                    <td className="py-3 px-2 text-muted-foreground">{formatDateFr(c.date_obtention)}</td>
                    <td className="py-3 px-2 text-muted-foreground">{formatDateFr(c.date_expiration)}</td>
                    <td className="py-3 px-2">
                      <Badge variant="outline" className={`text-xs ${badge.className}`}>
                        {badge.label}{days !== null && days >= 0 && ` (${days}j)`}
                      </Badge>
                    </td>
                    <td className="py-3 px-2">
                      <Badge variant="outline" className="text-xs capitalize">{c.source}</Badge>
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-2">
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(c)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/CertificationsTab.test.tsx
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CertificationsTab.tsx src/test/CertificationsTab.test.tsx
git commit -m "feat: add CertificationsTab component for admin fiche stagiaire"
```

---

### Task 8: Stagiaires.tsx — Certifications card in fiche

**Files:**
- Modify: `src/pages/Stagiaires.tsx`

- [ ] **Step 1: Add imports to existing lucide-react line**

Find the existing lucide-react import line (line ~13) and add `Award` to it:

```typescript
import { Plus, Search, Trash2, Users, Upload, FileText, Download, ArrowLeft, Eye, Archive, RotateCcw, Shield, Award } from "lucide-react";
```

Also add after the existing imports:

```typescript
import CertificationsTab from "@/components/CertificationsTab";
```

- [ ] **Step 2: Add Certifications card after the Documents card**

After the closing `</Card>` of the Documents section (the `</Card>` at line ~379, before the final `</div>` that closes the fiche), add:

```tsx
{/* CERTIFICATIONS */}
<Card className="p-6 bg-card/60 border-border/50">
  <div className="flex items-center justify-between mb-4">
    <h3 className="font-display font-semibold flex items-center gap-2">
      <Award className="h-5 w-5 text-primary" /> Certifications
    </h3>
  </div>
  <CertificationsTab stagiaireId={selected.id} isAdmin={isAdmin} />
</Card>
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Stagiaires.tsx
git commit -m "feat: add Certifications card to fiche stagiaire"
```

---

### Task 9: Rappels.tsx — Certifications stagiaires tab

**Files:**
- Modify: `src/pages/Rappels.tsx`

- [ ] **Step 1: Add imports**

After the existing imports in `src/pages/Rappels.tsx`, add:

```typescript
import { Award } from "lucide-react";
import type { CertType } from "@/types/certifications";
import {
  CERT_LABELS,
  certStatusBadge,
  formatDateFr,
  daysUntilExpiry,
} from "@/lib/certificationUtils";
```

- [ ] **Step 2: Add state**

After `const [loading, setLoading] = useState(true);`, add:

```typescript
const [certExpiring, setCertExpiring] = useState<any[]>([]);
const [certLoading, setCertLoading] = useState(true);
const [certTypeFilter, setCertTypeFilter] = useState("tout");
const [certSeuilFilter, setCertSeuilFilter] = useState("tout");
```

- [ ] **Step 3: Add loadCerts function + call it in useEffect**

After the `load` function definition, add:

```typescript
const loadCerts = async () => {
  setCertLoading(true);
  const in90 = new Date();
  in90.setDate(in90.getDate() + 90);
  const { data } = await supabase
    .from("certifications")
    .select("*, stagiaires(first_name, last_name)")
    .lte("date_expiration", in90.toISOString().slice(0, 10))
    .order("date_expiration");
  setCertExpiring(
    (data ?? []).map((c: any) => ({
      ...c,
      stagiaire_nom: `${c.stagiaires?.first_name ?? ""} ${c.stagiaires?.last_name ?? ""}`.trim(),
    }))
  );
  setCertLoading(false);
};
```

In the existing `useEffect`, call `loadCerts()` alongside `load()`:

```typescript
useEffect(() => {
  document.title = "Rappels — SecureCRM";
  load();
  loadCerts();
}, []);
```

- [ ] **Step 4: Add filter logic**

After the existing `const formateurs = ...` filter line, add:

```typescript
const certFiltered = certExpiring.filter((c) => {
  if (certTypeFilter !== "tout" && c.type !== certTypeFilter) return false;
  const days = daysUntilExpiry(c.date_expiration) ?? 0;
  if (certSeuilFilter === "expire") return days < 0;
  if (certSeuilFilter === "30j") return days >= 0 && days < 30;
  if (certSeuilFilter === "90j") return days >= 0 && days < 90;
  return true;
});
```

- [ ] **Step 5: Add TabsTrigger**

In the `<TabsList>` block, after `<TabsTrigger value="stagiaires">`, add:

```tsx
<TabsTrigger value="certs-stagiaires">
  Certifications ({certExpiring.length})
</TabsTrigger>
```

- [ ] **Step 6: Add TabsContent**

After the closing `</TabsContent>` of the "stagiaires" tab, add:

```tsx
<TabsContent value="certs-stagiaires" className="mt-4">
  <div className="flex gap-3 mb-4 flex-wrap">
    <select
      className="bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm"
      value={certTypeFilter}
      onChange={(e) => setCertTypeFilter(e.target.value)}
    >
      <option value="tout">Tous les types</option>
      {(Object.entries(CERT_LABELS) as [CertType, string][]).map(([k, v]) => (
        <option key={k} value={k}>{v}</option>
      ))}
    </select>
    <select
      className="bg-secondary/50 border border-border rounded-lg px-3 py-1.5 text-sm"
      value={certSeuilFilter}
      onChange={(e) => setCertSeuilFilter(e.target.value)}
    >
      <option value="tout">Tous les seuils</option>
      <option value="expire">Expirés</option>
      <option value="30j">Moins de 30j</option>
      <option value="90j">Moins de 90j</option>
    </select>
  </div>

  {certLoading ? (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-4 bg-card/60 border-border/50 animate-pulse h-16" />
      ))}
    </div>
  ) : certFiltered.length === 0 ? (
    <Card className="p-8 bg-card/60 border-border/50 text-center">
      <Award className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
      <p className="text-muted-foreground text-sm">Aucune certification à renouveler dans ce filtre</p>
    </Card>
  ) : (
    <div className="space-y-2">
      {certFiltered.map((c: any) => {
        const badge = certStatusBadge(c.date_expiration);
        const days = daysUntilExpiry(c.date_expiration);
        return (
          <Card
            key={c.id}
            className={
              "p-4 bg-card/60 border-border/50 hover:border-primary/30 transition-all border-l-4 " +
              (badge.status === "expire" ? "border-l-destructive" : "border-l-orange-500")
            }
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-secondary">
                  <Award className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.stagiaire_nom || "—"}</p>
                  <p className="text-xs text-muted-foreground">{CERT_LABELS[c.type as CertType] ?? c.type}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{formatDateFr(c.date_expiration)}</p>
                <Badge variant="outline" className={`text-xs ${badge.className}`}>
                  {badge.label}{days !== null && days >= 0 && ` · ${days}j`}
                </Badge>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  )}
</TabsContent>
```

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/Rappels.tsx
git commit -m "feat: add Certifications stagiaires tab to Rappels page"
```

---

### Task 10: EspaceStagiaire.tsx — Mes certifications block

**Files:**
- Modify: `src/pages/EspaceStagiaire.tsx`

- [ ] **Step 1: Add imports**

After existing imports in `src/pages/EspaceStagiaire.tsx`, add:

```typescript
import { Award } from "lucide-react";
import type { Certification, CertType } from "@/types/certifications";
import {
  CERT_LABELS,
  RECYCLAGE_TYPE,
  certStatusBadge,
  formatDateFr,
  daysUntilExpiry,
} from "@/lib/certificationUtils";
```

- [ ] **Step 2: Add state for certifications**

After existing `useState` declarations in the main component, add:

```typescript
const [certs, setCerts] = useState<Certification[]>([]);
const [recycleSessions, setRecycleSessions] = useState<Record<string, any[]>>({});
```

- [ ] **Step 3: Add loadCerts function**

After the other `load*` function definitions, add:

```typescript
const loadCerts = async (stagId: string) => {
  const { data } = await supabase
    .from("certifications")
    .select("*")
    .eq("stagiaire_id", stagId)
    .order("date_expiration");
  const certData = (data as Certification[]) ?? [];
  setCerts(certData);

  const map: Record<string, any[]> = {};
  const expiring = certData.filter((c) => {
    const d = daysUntilExpiry(c.date_expiration);
    return d !== null && d < 90;
  });
  for (const c of expiring) {
    const recyclageType = (RECYCLAGE_TYPE[c.type] ?? c.type).toUpperCase();
    const in90 = new Date();
    in90.setDate(in90.getDate() + 90);
    const { data: sessions } = await supabase
      .from("formations")
      .select("id, title, start_date, location")
      .eq("type", recyclageType)
      .gte("start_date", new Date().toISOString().slice(0, 10))
      .lte("start_date", in90.toISOString().slice(0, 10))
      .order("start_date")
      .limit(2);
    map[c.id] = sessions ?? [];
  }
  setRecycleSessions(map);
};
```

- [ ] **Step 4: Call loadCerts after stagiaire loads**

Find the line where `setStagiaire(data)` is called (inside the existing load effect). After it, add:

```typescript
if (data?.id) loadCerts(data.id);
```

- [ ] **Step 5: Add Mes certifications block in PageDashboard**

At the end of the JSX returned by `PageDashboard`, just before the final closing `</div>` of the `space-y-6` container, add:

```tsx
{certs.length > 0 && (
  <div className="space-y-3">
    <h2 className="font-semibold flex items-center gap-2">
      <Award className="h-4 w-4 text-primary" /> Mes certifications
    </h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {certs.map((c) => {
        const badge = certStatusBadge(c.date_expiration);
        const days = daysUntilExpiry(c.date_expiration);
        const sessions = recycleSessions[c.id] ?? [];
        return (
          <Card key={c.id} className="p-4 bg-card/60 border-border/50">
            <div className="flex items-start justify-between mb-2">
              <p className="font-medium text-sm">{CERT_LABELS[c.type] ?? c.type}</p>
              <Badge variant="outline" className={`text-xs ${badge.className}`}>
                {badge.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Expire le {formatDateFr(c.date_expiration)}
              {days !== null && days >= 0 && ` · ${days} jour${days > 1 ? "s" : ""}`}
            </p>
            {sessions.length > 0 ? (
              <div className="mt-3 p-2 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-xs font-medium text-primary mb-1">Session de recyclage disponible</p>
                {sessions.slice(0, 1).map((s: any) => (
                  <p key={s.id} className="text-xs text-muted-foreground">
                    {s.title} · {new Date(s.start_date).toLocaleDateString("fr-FR")}
                    {s.location && ` · ${s.location}`}
                  </p>
                ))}
              </div>
            ) : days !== null && days < 90 ? (
              <p className="text-xs text-muted-foreground mt-2 italic">
                Contactez votre formateur pour planifier un recyclage.
              </p>
            ) : null}
          </Card>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/EspaceStagiaire.tsx
git commit -m "feat: add Mes certifications block in espace stagiaire dashboard"
```

---

### Task 11: AppLayout.tsx — NotificationBell in header

**Files:**
- Modify: `src/components/AppLayout.tsx`

- [ ] **Step 1: Add import**

After existing imports in `src/components/AppLayout.tsx`, add:

```typescript
import NotificationBell from "./NotificationBell";
```

- [ ] **Step 2: Wrap right side in a flex div and insert NotificationBell**

Replace the current header's right side:

```tsx
{/* BEFORE */}
<Badge variant="outline" className="capitalize border-primary/40 text-primary">
  {primaryRole}
</Badge>
```

With:

```tsx
{/* AFTER */}
<div className="flex items-center gap-2">
  <NotificationBell />
  <Badge variant="outline" className="capitalize border-primary/40 text-primary">
    {primaryRole}
  </Badge>
</div>
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppLayout.tsx
git commit -m "feat: add NotificationBell to app header"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| Table `certifications` + UNIQUE constraint | Task 1 |
| Table `notifications` | Task 1 |
| RLS policies (stagiaire reads own, admin writes) | Task 1 |
| Trigger auto-création sur status=valide + resultat=obtenu | Task 2 |
| Mapping formation_type→cert_type (UPPERCASE DB values) | Task 2 |
| Protection anti-boucle (UPDATE OF status, resultat) | Task 2 |
| TypeScript types + constantes | Task 3 |
| Fonctions pures (badge, jours, calcul expiration) | Task 3 |
| Edge Function check-expirations (seuils 90j/30j/7j) | Task 4 |
| Idempotence (vérification doublon) | Task 4 |
| Emails stagiaire + admin (Resend) | Task 4 |
| Notification entreprise si renseignée | Task 4 |
| GitHub Actions cron 6h UTC | Task 5 |
| NotificationBell + Supabase Realtime | Task 6 |
| CertificationsTab : tableau + badges + dialog ajout/modif | Task 7 |
| Fiche stagiaire admin : section Certifications | Task 8 |
| Rappels : onglet Certifications + filtres type + seuil | Task 9 |
| Espace stagiaire : Mes certifications + sessions recyclage | Task 10 |
| NotificationBell dans le header | Task 11 |

### Notes
- **EPI** : pas dans `formation_type` enum — uniquement via saisie manuelle (conforme spec).
- **MAC SST** : idem — uniquement manuel.
- **Email entreprise** : notification insérée en DB ; l'email nécessite une table `entreprises` avec un champ `email` (Sprint 5). La logique est en place dans l'Edge Function.

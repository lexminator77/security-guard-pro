# DRACAR — Vérification CNAPS automatisée

## Goal

Vérifier automatiquement la validité des cartes professionnelles CNAPS de tous les agents toutes les 2 semaines, avec possibilité de forcer une vérification immédiate. Chaque agent reçoit un statut vert/rouge/à vérifier/inconnu visible dans un onglet dédié "DRACAR" et sur sa fiche.

## Architecture

Trois composants :
1. **Supabase Edge Function `verify-cnaps`** — interroge cnaps-securite.fr par numéro de carte pro, met à jour `stagiaires.cnaps_statut`
2. **Cron pg_cron** — déclenche la fonction automatiquement les 1er et 15 de chaque mois à 3h
3. **Page `VerificationCNAPS.tsx`** — dashboard DRACAR avec tableau des statuts, bouton "Vérifier tous" et vérification individuelle

**Tech Stack :** React 18 + TypeScript, Supabase Edge Functions (Deno), pg_cron, Shadcn UI Badge/Button/Table, lucide-react (`ShieldCheck`), Vitest + Testing Library.

---

## Data Model

Migration sur `stagiaires` — aucune nouvelle table :

```sql
ALTER TABLE public.stagiaires
  ADD COLUMN cnaps_statut TEXT NOT NULL DEFAULT 'inconnu'
    CHECK (cnaps_statut IN ('vert', 'rouge', 'a_verifier', 'inconnu')),
  ADD COLUMN cnaps_last_checked TIMESTAMPTZ,
  ADD COLUMN cnaps_last_result TEXT;
```

| Statut | Signification |
|---|---|
| `vert` | CNAPS confirme la carte valide |
| `rouge` | CNAPS signale un problème (suspendue, expirée, inexistante) |
| `a_verifier` | Scraping échoué — vérification manuelle requise |
| `inconnu` | Jamais vérifié ou pas de carte_pro_number renseigné |

---

## Edge Function `supabase/functions/verify-cnaps/index.ts`

**Entrée (POST) :**
```json
{ "stagiaire_ids": ["uuid1", "uuid2"] }
```
Si `stagiaire_ids` absent → traite tous les agents ayant un `carte_pro_number` non null.

**Flux par agent :**
1. Récupère `carte_pro_number` depuis `stagiaires`
2. POST sur cnaps-securite.fr avec le numéro de carte — **l'URL exacte et les paramètres du formulaire doivent être déterminés à l'implémentation en inspectant le formulaire de vérification publique du site CNAPS**
3. Parse la réponse HTML :
   - Contient "valide" ou "en cours de validité" → `vert`
   - Contient "suspendu", "invalide", "expiré", "retiré" → `rouge`
   - Timeout / erreur réseau / réponse imprévue → `a_verifier`
4. `UPDATE stagiaires SET cnaps_statut, cnaps_last_checked, cnaps_last_result WHERE id = ...`

**Sécurité :** header `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` obligatoire.

**Résilience :** chaque agent traité indépendamment dans un try/catch — un échec individuel ne bloque pas les autres.

**Réponse :**
```json
{
  "processed": 47,
  "results": [
    { "id": "uuid1", "statut": "vert" },
    { "id": "uuid2", "statut": "rouge" },
    { "id": "uuid3", "statut": "a_verifier" }
  ]
}
```

---

## Cron — `supabase/migrations/20260527140001_cnaps_cron.sql`

```sql
SELECT cron.schedule(
  'verify-cnaps-auto',
  '0 3 1,15 * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/verify-cnaps',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{}'::jsonb
    );
  $$
);
```

Tourne à 3h du matin les 1er et 15 de chaque mois.

---

## Page `src/pages/VerificationCNAPS.tsx`

**Route :** `/verification-cnaps`
**Accès :** administrateur, secrétaire

### En-tête

- Titre "DRACAR — Vérification CNAPS"
- Sous-titre "Mise à jour automatique tous les 15 jours"
- Bouton **"Vérifier tous les agents"** (POST Edge Function sans `stagiaire_ids`)
- Pendant la vérification : spinner + compteur "X / Y agents vérifiés"
- Date de la dernière vérification globale (max de `cnaps_last_checked`)

### Filtres

Boutons : Tous · Valide · Problème · À vérifier · Inconnu

### Tableau

| Agent | N° carte pro | Statut | Dernière vérif | Action |
|---|---|---|---|---|
| DUPONT Jean | CNAPS-001 | 🟢 Valide | 24/05/2026 | Vérifier |
| MARTIN Paul | CNAPS-002 | 🔴 Problème | 20/05/2026 | Vérifier |
| DURAND Marc | — | ⚪ Inconnu | — | — |
| LEBRUN Sophie | CNAPS-004 | 🟠 À vérifier | 22/05/2026 | Vérifier / Corriger |

**Badges :**
- `vert` → Badge vert `bg-emerald-500/10 text-emerald-400` — "Valide"
- `rouge` → Badge rouge `bg-red-500/10 text-red-400` — "Problème"
- `a_verifier` → Badge orange `bg-orange-500/10 text-orange-400` — "À vérifier"
- `inconnu` → Badge gris `bg-muted/50 text-muted-foreground` — "Inconnu"

**Bouton "Vérifier" (par agent) :** POST Edge Function avec `{ stagiaire_ids: [id] }`, met à jour la ligne sans recharger tout le tableau.

**Correction manuelle (agents `a_verifier`) :** menu déroulant "Marquer comme → Valide / Problème" qui fait un UPDATE direct sur `stagiaires.cnaps_statut` sans passer par la Edge Function.

---

## Intégrations

### `src/components/AppSidebar.tsx`

Groupe Administration, après "Financement OPCO" :
```tsx
{ title: "DRACAR", url: "/verification-cnaps", icon: ShieldCheck, roles: ["administrateur", "secretaire"] }
```

### `src/pages/Stagiaires.tsx`

Badge CNAPS dans le panneau détail du stagiaire, sous la carte pro :
```tsx
<Badge cnaps_statut={selected.cnaps_statut} cnaps_last_checked={selected.cnaps_last_checked} />
```

### `src/App.tsx`

```tsx
import VerificationCNAPS from "./pages/VerificationCNAPS";
// ...
<Route path="/verification-cnaps" element={<VerificationCNAPS />} />
```
Route dans le bloc ProtectedRoute (admin/secrétaire uniquement).

---

## Tests — `src/test/VerificationCNAPS.test.tsx`

Mock Supabase : `from("stagiaires").select().order()` → 3 agents (vert, rouge, inconnu).
Mock `fetch` global : simule la réponse de la Edge Function.

**3 tests :**

1. **Affiche le tableau des agents** — 3 agents mockés → vérifie que les 3 noms apparaissent + badges "Valide", "Problème", "Inconnu"
2. **Filtre "Problème" ne montre que les rouges** — clic sur bouton "Problème" → seul l'agent rouge visible, les 2 autres absents du DOM
3. **Bouton "Vérifier tous" déclenche la Edge Function** — mock `fetch` → clic → vérifie que `fetch` est appelé avec la bonne URL et méthode POST

---

## Fichiers

**Nouveaux :**
- `supabase/migrations/20260527140000_cnaps_statut.sql` — colonnes sur stagiaires
- `supabase/migrations/20260527140001_cnaps_cron.sql` — cron pg_cron
- `supabase/functions/verify-cnaps/index.ts` — Edge Function Deno
- `src/pages/VerificationCNAPS.tsx`
- `src/test/VerificationCNAPS.test.tsx`

**Modifiés :**
- `src/components/AppSidebar.tsx` — entrée DRACAR
- `src/pages/Stagiaires.tsx` — badge CNAPS dans panneau détail
- `src/App.tsx` — route `/verification-cnaps`

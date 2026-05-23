# Sprint 5 — Espace RH entreprise

**Date :** 2026-05-23
**Statut :** Approuvé

---

## Objectif

Permettre aux contacts RH des entreprises clientes d'accéder en lecture seule à un dashboard dédié présentant les certifications, formations et documents de leurs agents. L'accès se fait via un compte auth créé par invitation email, lié à une seule entreprise.

---

## Périmètre

| Inclus | Exclu |
|--------|-------|
| Nouveau rôle `rh` dans `app_role` | Modification de données par le RH |
| Table `entreprise_rh` (user_id ↔ entreprise_id) | Plusieurs entreprises par compte RH |
| Invitation RH depuis la fiche entreprise admin | Inscription en formation par le RH |
| Espace `/espace-rh` lecture seule | Messagerie RH |
| Certifications agents (badges Sprint 3) | Notifications RH (futur) |
| Formations à venir des agents | |
| Documents agents (liste + téléchargement) | |
| Redirection automatique après login | |
| RLS scoped à l'entreprise du RH | |

---

## Modèle de données

### Nouveau rôle

```sql
ALTER TYPE public.app_role ADD VALUE 'rh';
```

### Table `entreprise_rh`

```sql
CREATE TABLE public.entreprise_rh (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entreprise_id UUID NOT NULL REFERENCES public.entreprises(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
```

Contrainte `UNIQUE(user_id)` : un RH est lié à une seule entreprise.

---

## Fonction bridge RH

```sql
CREATE OR REPLACE FUNCTION public.get_rh_entreprise_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT entreprise_id
  FROM public.entreprise_rh
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;
```

---

## RLS

### `entreprise_rh`

```sql
ALTER TABLE public.entreprise_rh ENABLE ROW LEVEL SECURITY;

-- RH voit sa propre ligne
CREATE POLICY erh_select_own ON public.entreprise_rh
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'administrateur'));

-- Admin gère tout
CREATE POLICY erh_admin_all ON public.entreprise_rh
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrateur'))
  WITH CHECK (public.has_role(auth.uid(), 'administrateur'));
```

### `certifications` — ajout politique RH

```sql
CREATE POLICY certs_select_rh ON public.certifications
  FOR SELECT TO authenticated
  USING (
    stagiaire_id IN (
      SELECT stagiaire_id FROM public.entreprise_stagiaires
      WHERE entreprise_id = public.get_rh_entreprise_id()
    )
  );
```

### `formation_participants` — politique RH

```sql
CREATE POLICY fp_select_rh ON public.formation_participants
  FOR SELECT TO authenticated
  USING (
    stagiaire_id IN (
      SELECT stagiaire_id FROM public.entreprise_stagiaires
      WHERE entreprise_id = public.get_rh_entreprise_id()
    )
  );
```

### `stagiaire_documents` — politique RH

```sql
CREATE POLICY sd_select_rh ON public.stagiaire_documents
  FOR SELECT TO authenticated
  USING (
    stagiaire_id IN (
      SELECT stagiaire_id FROM public.entreprise_stagiaires
      WHERE entreprise_id = public.get_rh_entreprise_id()
    )
  );
```

---

## Côté admin — invitation RH

Dans `src/pages/Entreprises.tsx`, dans la fiche d'une entreprise (panneau latéral ou dialog) :

- Affichage du compte RH actuel : email + statut (invitation en attente / actif)
- Bouton **"Inviter un contact RH"** (visible seulement si pas de compte RH actif)
- Dialog : champ email → submit appelle :
  1. `supabase.auth.admin.inviteUserByEmail(email)` (nécessite service role — via Edge Function dédiée)
  2. Insertion dans `user_roles` : `{ user_id, role: 'rh' }`
  3. Insertion dans `entreprise_rh` : `{ user_id, entreprise_id }`
- Bouton **"Révoquer l'accès"** si compte RH actif : supprime la ligne `entreprise_rh` + désactive le compte via Edge Function

### Edge Function `invite-rh`

Fichier : `supabase/functions/invite-rh/index.ts`

- Appelée par l'admin depuis le frontend (avec service role via le client admin)
- Reçoit `{ email, entreprise_id }`
- Vérifie que l'appelant est administrateur (via `SUPABASE_SERVICE_ROLE_KEY`)
- Appelle `supabase.auth.admin.inviteUserByEmail(email)`
- Insère dans `user_roles` et `entreprise_rh`
- Retourne `{ ok: true, user_id }`

---

## Redirection post-login

Dans `src/pages/Dashboard.tsx` (ou le composant qui gère la redirection initiale), ajouter :

```typescript
if (hasRole('rh')) navigate('/espace-rh');
```

Après les redirections existantes pour stagiaire et formateur.

---

## Espace RH (`/espace-rh`)

### Route

```tsx
<Route path="/espace-rh" element={<ProtectedRoute><EspaceRH /></ProtectedRoute>} />
```

### Layout

Pas de sidebar. Header simple :
- Logo SecureCRM à gauche
- Nom de l'entreprise au centre
- Bouton "Se déconnecter" à droite

### Contenu

Fetch au chargement :
1. `entreprise_rh` → `entreprise_id` → `entreprises` → nom de l'entreprise
2. `entreprise_stagiaires` → liste des `stagiaire_id`
3. Pour chaque stagiaire : `stagiaires`, `certifications`, `formation_participants + formations`, `documents`

Affichage :
- **En-tête** : nom de l'entreprise, nombre d'agents, date de dernière mise à jour
- **Liste des agents** : une card par agent avec :
  - Nom prénom
  - **Certifications** : tableau type / expiration / badge statut (Sprint 3 `certStatusBadge`)
  - **Formations** : prochaines sessions (start_date ≥ today, ordered asc, limit 3)
  - **Documents** : liste nom + date + bouton téléchargement (lien Supabase Storage, table `stagiaire_documents`)
- Tri des agents : alphabétique par nom
- Filtre global (optionnel) : recherche par nom d'agent

### États

- Loading skeleton pendant le fetch
- Empty state si aucun agent lié à l'entreprise
- Message d'erreur si le compte RH n'est plus lié à une entreprise

---

## Fichiers créés / modifiés

| Fichier | Action |
|---------|--------|
| `supabase/migrations/20260523130000_entreprise_rh.sql` | Créer : rôle rh, table entreprise_rh, RLS, fonction bridge |
| `supabase/migrations/20260523130001_rh_rls_policies.sql` | Créer : policies RH sur certifications, formation_participants, stagiaire_documents |
| `supabase/functions/invite-rh/index.ts` | Créer : Edge Function invitation |
| `src/pages/EspaceRH.tsx` | Créer : dashboard RH |
| `src/pages/Entreprises.tsx` | Modifier : section invitation RH dans la fiche |
| `src/App.tsx` | Modifier : route `/espace-rh` |
| `src/pages/Dashboard.tsx` | Modifier : redirection si rôle rh |

---

## Ce qui ne change pas

- Le flux d'authentification existant
- La structure des tables `entreprises` et `entreprise_stagiaires`
- L'AppLayout admin (le RH n'y accède pas)
- Les rôles existants (administrateur, formateur, secretaire, agent)

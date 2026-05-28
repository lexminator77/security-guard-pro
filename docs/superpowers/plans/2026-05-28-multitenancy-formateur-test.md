# Fondation multi-tenant + accès formateur (phase test) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser les bases multi-tenant (organisme_id, soft delete, audit_log), donner aux formateurs les droits de créer/modifier/archiver des stagiaires depuis leur espace, et donner à l'admin une vue corbeille + activité.

**Architecture:** Migration SQL en deux fichiers (fondation + RLS). Deux modifications de pages React existantes : `EspaceFormateur.tsx` (nouvel onglet "Mes stagiaires") et `Stagiaires.tsx` (onglets "Corbeille" et "Activité"). Pas de nouveau fichier React — on reste cohérent avec les patterns existants (composants internes, `// @ts-nocheck`).

**Tech Stack:** Supabase PostgreSQL (RLS, fonctions SQL), React + TypeScript (`// @ts-nocheck`), Tailwind CSS, Shadcn UI (Card, Button, Input, Dialog), Sonner (toast).

---

## Fichiers touchés

| Fichier | Action |
|---------|--------|
| `supabase/migrations/20260528150000_multitenancy_foundation.sql` | Créer |
| `supabase/migrations/20260528160000_stagiaires_rls_update.sql` | Créer |
| `src/pages/EspaceFormateur.tsx` | Modifier — ajouter page "Mes stagiaires" |
| `src/pages/Stagiaires.tsx` | Modifier — ajouter onglets Corbeille et Activité |

---

## Task 1 — Migration : fondation base de données

**Fichiers :**
- Créer : `supabase/migrations/20260528150000_multitenancy_foundation.sql`

- [ ] **Étape 1 : Créer le fichier de migration**

Contenu complet du fichier :

```sql
-- ─── Table organismes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organismes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  plan       TEXT NOT NULL DEFAULT 'free', -- free | medium | total
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.organismes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organismes_select_auth" ON public.organismes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "organismes_admin_write" ON public.organismes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'administrateur'))
  WITH CHECK (public.has_role(auth.uid(), 'administrateur'));

-- Organisme par défaut (phase test)
INSERT INTO public.organismes (id, nom, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Organisme Principal', 'principal', 'total')
ON CONFLICT (id) DO NOTHING;

-- ─── organisme_id sur profiles ────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organisme_id UUID REFERENCES public.organismes(id);

-- Backfill tous les profils existants
UPDATE public.profiles
  SET organisme_id = '00000000-0000-0000-0000-000000000001'
  WHERE organisme_id IS NULL;

-- Trigger : nouveau profil → organisme par défaut (sera overridé en SaaS)
CREATE OR REPLACE FUNCTION public.set_default_organisme()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.organisme_id IS NULL THEN
    NEW.organisme_id := '00000000-0000-0000-0000-000000000001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_default_organisme ON public.profiles;
CREATE TRIGGER trg_default_organisme
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_default_organisme();

-- ─── organisme_id sur les tables métier ──────────────────────────────────
ALTER TABLE public.stagiaires
  ADD COLUMN IF NOT EXISTS organisme_id UUID REFERENCES public.organismes(id);
UPDATE public.stagiaires SET organisme_id = '00000000-0000-0000-0000-000000000001' WHERE organisme_id IS NULL;

ALTER TABLE public.formations
  ADD COLUMN IF NOT EXISTS organisme_id UUID REFERENCES public.organismes(id);
UPDATE public.formations SET organisme_id = '00000000-0000-0000-0000-000000000001' WHERE organisme_id IS NULL;

ALTER TABLE public.formateurs
  ADD COLUMN IF NOT EXISTS organisme_id UUID REFERENCES public.organismes(id);
UPDATE public.formateurs SET organisme_id = '00000000-0000-0000-0000-000000000001' WHERE organisme_id IS NULL;

ALTER TABLE public.formation_participants
  ADD COLUMN IF NOT EXISTS organisme_id UUID REFERENCES public.organismes(id);
UPDATE public.formation_participants SET organisme_id = '00000000-0000-0000-0000-000000000001' WHERE organisme_id IS NULL;

-- ─── Soft delete sur stagiaires ───────────────────────────────────────────
ALTER TABLE public.stagiaires
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by  UUID REFERENCES auth.users(id);

-- ─── Table audit_log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisme_id UUID REFERENCES public.organismes(id),
  user_id      UUID REFERENCES auth.users(id),
  user_role    TEXT NOT NULL,
  action       TEXT NOT NULL, -- create | update | delete | restore
  table_name   TEXT NOT NULL,
  record_id    UUID NOT NULL,
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_admin_select" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'administrateur') OR public.has_role(auth.uid(), 'secretaire'));
CREATE POLICY "audit_log_insert_auth" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ─── Fonction helper organisme ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_organisme_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT organisme_id FROM public.profiles WHERE id = auth.uid()
$$;
```

- [ ] **Étape 2 : Appliquer la migration**

```bash
supabase db push
```

Réponse attendue : `Applying migration 20260528150000_multitenancy_foundation.sql... Finished supabase db push.`

- [ ] **Étape 3 : Vérifier en console Supabase**

Dans Table Editor → vérifier que :
- La table `organismes` existe avec 1 ligne (Organisme Principal)
- `stagiaires` a les colonnes `organisme_id`, `deleted_at`, `deleted_by`
- `audit_log` existe et est vide

- [ ] **Étape 4 : Commit**

```bash
git add supabase/migrations/20260528150000_multitenancy_foundation.sql
git commit -m "feat(db): add organismes table, organisme_id columns, soft delete, audit_log"
```

---

## Task 2 — Migration : mise à jour des politiques RLS

**Fichiers :**
- Créer : `supabase/migrations/20260528160000_stagiaires_rls_update.sql`

- [ ] **Étape 1 : Créer le fichier de migration**

```sql
-- Supprimer les anciennes politiques stagiaires (trop permissives)
DROP POLICY IF EXISTS "stagiaires_select_auth"    ON public.stagiaires;
DROP POLICY IF EXISTS "stagiaires_admin_write"     ON public.stagiaires;
DROP POLICY IF EXISTS "stagiaires_formateur_write" ON public.stagiaires;
DROP POLICY IF EXISTS "stagiaires_select_own"      ON public.stagiaires;

-- Admin / secrétaire : voient TOUT (y compris soft-deleted)
CREATE POLICY "stag_select_admin" ON public.stagiaires
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  );

-- Admin / secrétaire : écrivent tout (insert, update, delete)
CREATE POLICY "stag_all_admin" ON public.stagiaires
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  );

-- Formateur : SELECT uniquement les non-supprimés du même organisme
CREATE POLICY "stag_select_formateur" ON public.stagiaires
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur')
    AND deleted_at IS NULL
    AND organisme_id = public.get_user_organisme_id()
  );

-- Formateur : INSERT (organisme auto depuis profil, created_by = auth.uid())
CREATE POLICY "stag_insert_formateur" ON public.stagiaires
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur')
    AND organisme_id = public.get_user_organisme_id()
    AND created_by = auth.uid()
  );

-- Formateur : UPDATE des stagiaires qu'il a créés ou qui sont dans ses formations
-- (inclut le soft-delete qui est un UPDATE de deleted_at)
CREATE POLICY "stag_update_formateur" ON public.stagiaires
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur')
    AND deleted_at IS NULL
    AND organisme_id = public.get_user_organisme_id()
    AND (
      created_by = auth.uid()
      OR id IN (
        SELECT fp.stagiaire_id
        FROM public.formation_participants fp
        JOIN public.formations f ON f.id = fp.formation_id
        WHERE f.formateur_id = (
          SELECT fmt.id FROM public.formateurs fmt
          JOIN auth.users u ON u.email = fmt.email
          WHERE u.id = auth.uid()
          LIMIT 1
        )
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur')
    AND organisme_id = public.get_user_organisme_id()
  );

-- Stagiaire connecté : voit sa propre fiche (non-supprimée)
CREATE POLICY "stag_select_own" ON public.stagiaires
  FOR SELECT TO authenticated
  USING (
    auth_user_id = auth.uid()
    AND deleted_at IS NULL
  );

-- Stagiaire connecté : peut mettre à jour sa propre fiche
CREATE POLICY "stag_update_own" ON public.stagiaires
  FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (auth_user_id = auth.uid());

-- Autres rôles authentifiés (agent, rh) : lecture seule des non-supprimés
CREATE POLICY "stag_select_other_roles" ON public.stagiaires
  FOR SELECT TO authenticated
  USING (
    (
      public.has_role(auth.uid(), 'agent')
      OR public.has_role(auth.uid(), 'rh')
    )
    AND deleted_at IS NULL
    AND organisme_id = public.get_user_organisme_id()
  );
```

- [ ] **Étape 2 : Appliquer la migration**

```bash
supabase db push
```

Réponse attendue : `Applying migration 20260528160000_stagiaires_rls_update.sql... Finished supabase db push.`

- [ ] **Étape 3 : Commit**

```bash
git add supabase/migrations/20260528160000_stagiaires_rls_update.sql
git commit -m "feat(rls): update stagiaires policies for formateur write + soft delete + organisme isolation"
```

---

## Task 3 — EspaceFormateur : onglet "Mes stagiaires"

**Fichiers :**
- Modifier : `src/pages/EspaceFormateur.tsx`

**Rappel architecture du fichier :** `// @ts-nocheck`, composants internes (`PageFormations`, `PageCours`, etc.), `formateurId` = UUID de la table `formateurs`, `authUserId` = `auth.uid()` récupéré séparément.

- [ ] **Étape 1 : Ajouter `authUserId` dans le state principal**

Localiser la ligne (environ ligne 88) :
```typescript
const [formateurId, setFormateurId] = useState<string | null>(null);
```

Ajouter juste après :
```typescript
const [authUserId, setAuthUserId] = useState<string | null>(null);
```

- [ ] **Étape 2 : Stocker `authUserId` au chargement**

Localiser (environ ligne 115) le bloc qui charge la fiche formateur :
```typescript
const { data: { user } } = await supabase.auth.getUser();
```

Juste après `setFormateurId(fiche.id);`, ajouter :
```typescript
setAuthUserId(user.id);
```

- [ ] **Étape 3 : Ajouter `"stagiaires_fmt"` au type Page**

Localiser ligne 15 :
```typescript
type Page = "dashboard" | "formations" | "cours" | ...
```

Remplacer par :
```typescript
type Page = "dashboard" | "formations" | "stagiaires_fmt" | "cours" | ...
```

- [ ] **Étape 4 : Ajouter l'item dans navItems**

Localiser `navItems` (environ ligne 270). Ajouter après `{ id: "formations", ... }` :
```typescript
{ id: "stagiaires_fmt", label: "Mes stagiaires", icon: Users },
```

`Users` est déjà importé depuis lucide-react.

- [ ] **Étape 5 : Ajouter le composant `PageStagiairesFormateur`**

Juste avant `const PageCours = () => {`, insérer le composant complet :

```typescript
const PageStagiairesFormateur = () => {
  const [stagiaires, setStagiaires] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [inscriptionOpen, setInscriptionOpen] = useState(false);
  const [newStagiaireId, setNewStagiaireId] = useState<string | null>(null);
  const [selectedFormationId, setSelectedFormationId] = useState("");
  const [form, setForm] = useState({
    first_name: "", last_name: "", birth_date: "",
    email: "", phone: "", address: "", city: "", postal_code: "", notes: "",
  });

  const emptyForm = {
    first_name: "", last_name: "", birth_date: "",
    email: "", phone: "", address: "", city: "", postal_code: "", notes: "",
  };

  const loadStagiaires = async () => {
    if (!authUserId) return;
    setLoading(true);

    // IDs des stagiaires dans les formations du formateur
    const { data: participants } = await supabase
      .from("formation_participants")
      .select("stagiaire_id, formations!inner(formateur_id)")
      .eq("formations.formateur_id", formateurId);

    const idsFromForms: string[] = (participants ?? []).map((p: any) => p.stagiaire_id);

    // Stagiaires créés par ce formateur
    const { data: bySelf } = await supabase
      .from("stagiaires")
      .select("*")
      .eq("created_by", authUserId)
      .is("deleted_at", null);

    // Stagiaires dans ses formations (pas déjà dans bySelf)
    const selfIds = new Set((bySelf ?? []).map((s: any) => s.id));
    const extraIds = idsFromForms.filter(id => !selfIds.has(id));

    let byForms: any[] = [];
    if (extraIds.length > 0) {
      const { data } = await supabase
        .from("stagiaires")
        .select("*")
        .in("id", extraIds)
        .is("deleted_at", null);
      byForms = data ?? [];
    }

    setStagiaires([...(bySelf ?? []), ...byForms]);
    setLoading(false);
  };

  useEffect(() => { loadStagiaires(); }, [authUserId, formateurId]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      first_name: s.first_name ?? "",
      last_name: s.last_name ?? "",
      birth_date: s.birth_date ?? "",
      email: s.email ?? "",
      phone: s.phone ?? "",
      address: s.address ?? "",
      city: s.city ?? "",
      postal_code: s.postal_code ?? "",
      notes: s.notes ?? "",
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!form.first_name.trim() || !form.last_name.trim() || !form.birth_date) {
      toast.error("Prénom, nom et date de naissance sont obligatoires");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const organismeId = "00000000-0000-0000-0000-000000000001";

    if (editing) {
      const { error } = await supabase.from("stagiaires").update({
        ...form,
        birth_date: form.birth_date || null,
        updated_at: new Date().toISOString(),
      }).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      await supabase.from("audit_log").insert({
        organisme_id: organismeId,
        user_id: user!.id,
        user_role: "formateur",
        action: "update",
        table_name: "stagiaires",
        record_id: editing.id,
        payload: form,
      });
      toast.success("Stagiaire mis à jour");
    } else {
      const { data: created, error } = await supabase.from("stagiaires").insert({
        ...form,
        birth_date: form.birth_date || null,
        created_by: user!.id,
        organisme_id: organismeId,
        statut: "en_attente",
      }).select().single();
      if (error) { toast.error(error.message); return; }
      await supabase.from("audit_log").insert({
        organisme_id: organismeId,
        user_id: user!.id,
        user_role: "formateur",
        action: "create",
        table_name: "stagiaires",
        record_id: created.id,
        payload: form,
      });
      toast.success("Stagiaire créé");
      setNewStagiaireId(created.id);
      setSelectedFormationId("");
      setInscriptionOpen(true);
    }
    setDialogOpen(false);
    loadStagiaires();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { data: { user } } = await supabase.auth.getUser();
    const organismeId = "00000000-0000-0000-0000-000000000001";
    const { error } = await supabase.from("stagiaires").update({
      deleted_at: new Date().toISOString(),
      deleted_by: user!.id,
    }).eq("id", deleteTarget.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("audit_log").insert({
      organisme_id: organismeId,
      user_id: user!.id,
      user_role: "formateur",
      action: "delete",
      table_name: "stagiaires",
      record_id: deleteTarget.id,
      payload: { first_name: deleteTarget.first_name, last_name: deleteTarget.last_name },
    });
    toast.success("Stagiaire archivé");
    setDeleteTarget(null);
    loadStagiaires();
  };

  const inscrire = async () => {
    if (!newStagiaireId || !selectedFormationId) return;
    const { error } = await supabase.from("formation_participants").insert({
      stagiaire_id: newStagiaireId,
      formation_id: selectedFormationId,
      organisme_id: "00000000-0000-0000-0000-000000000001",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Stagiaire inscrit à la formation");
    setInscriptionOpen(false);
    loadStagiaires();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Mes stagiaires</h1>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> Nouveau stagiaire
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
      ) : stagiaires.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground text-sm border-dashed">
          Aucun stagiaire — cliquez sur "Nouveau stagiaire" pour commencer
        </Card>
      ) : (
        <div className="space-y-2">
          {stagiaires.map(s => (
            <Card key={s.id} className="p-4 border-border/50 bg-card/60">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">
                      {s.first_name?.[0]}{s.last_name?.[0]}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{s.last_name.toUpperCase()} {s.first_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.birth_date && new Date(s.birth_date).toLocaleDateString("fr-FR")}
                      {s.city && ` · ${s.city}`}
                      {s.email && ` · ${s.email}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive/70 hover:text-destructive" onClick={() => setDeleteTarget(s)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog créer / modifier */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le stagiaire" : "Nouveau stagiaire"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prénom *</Label>
                <Input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} />
              </div>
              <div>
                <Label>Nom *</Label>
                <Input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} />
              </div>
            </div>
            <div>
              <Label>Date de naissance *</Label>
              <Input type="date" value={form.birth_date} onChange={e => setForm({...form, birth_date: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
            </div>
            <div>
              <Label>Adresse</Label>
              <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ville</Label>
                <Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
              </div>
              <div>
                <Label>Code postal</Label>
                <Input value={form.postal_code} onChange={e => setForm({...form, postal_code: e.target.value})} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} className="resize-none" />
            </div>
            <Button className="w-full gradient-primary text-primary-foreground" onClick={submit}>
              {editing ? "Enregistrer" : "Créer le stagiaire"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog confirmation suppression */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Archiver ce stagiaire ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <b>{deleteTarget?.first_name} {deleteTarget?.last_name}</b> sera archivé.
            L'administrateur pourra le restaurer si besoin. Cette action n'est pas définitive.
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" className="flex-1" onClick={confirmDelete}>Archiver</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog inscription rapide */}
      <Dialog open={inscriptionOpen} onOpenChange={setInscriptionOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Inscrire à une formation ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">
            Stagiaire créé. Voulez-vous l'inscrire directement dans une de vos formations ?
          </p>
          <Select value={selectedFormationId} onValueChange={setSelectedFormationId}>
            <SelectTrigger><SelectValue placeholder="Choisir une formation" /></SelectTrigger>
            <SelectContent>
              {formations.map((f: any) => (
                <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" className="flex-1" onClick={() => setInscriptionOpen(false)}>Passer</Button>
            <Button className="flex-1 gradient-primary text-primary-foreground" onClick={inscrire} disabled={!selectedFormationId}>
              Inscrire
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
```

- [ ] **Étape 6 : Ajouter les imports manquants**

En haut du fichier, vérifier que ces éléments sont importés. Si `Plus`, `Pencil`, `Trash2` ne sont pas dans l'import lucide, les ajouter.

Chercher : `import { ... } from "lucide-react";`

Ajouter dans la liste si absents : `Plus, Pencil, Trash2`

Chercher : `import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";`
Si absent : ajouter cet import.

Chercher : `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";`
Si absent : ajouter cet import.

Chercher : `import { Textarea } from "@/components/ui/textarea";`
Si absent : ajouter cet import.

- [ ] **Étape 7 : Ajouter le case dans `renderPage`**

Localiser `const renderPage = () => { switch (page) {`.

Ajouter après `case "formations": return <PageFormations />;` :
```typescript
case "stagiaires_fmt": return <PageStagiairesFormateur />;
```

- [ ] **Étape 8 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Résultat attendu : aucune sortie (aucune erreur).

- [ ] **Étape 9 : Commit**

```bash
git add src/pages/EspaceFormateur.tsx
git commit -m "feat(espace-formateur): add Mes stagiaires tab with create/edit/soft-delete + quick enroll"
```

---

## Task 4 — Admin Stagiaires : onglets Corbeille et Activité

**Fichiers :**
- Modifier : `src/pages/Stagiaires.tsx`

**Rappel architecture :** La page a déjà un système d'onglets `tab` avec "actif" / "archive" (statut applicatif). On ajoute deux nouveaux onglets indépendants : "corbeille" (deleted_at) et "activite" (audit_log). Le `tab` existant prend une valeur string plus large.

- [ ] **Étape 1 : Étendre le type `tab`**

Localiser (environ ligne 68) :
```typescript
const [tab, setTab] = useState<"actif" | "archive">("actif");
```

Remplacer par :
```typescript
const [tab, setTab] = useState<"actif" | "archive" | "corbeille" | "activite">("actif");
```

- [ ] **Étape 2 : Ajouter le state pour corbeille et activité**

Après la ligne du `tab`, ajouter :
```typescript
const [corbeille, setCorbeille] = useState<any[]>([]);
const [auditLog, setAuditLog] = useState<any[]>([]);
const [loadingCorbeille, setLoadingCorbeille] = useState(false);
const [loadingAudit, setLoadingAudit] = useState(false);
const [hardDeleteTarget, setHardDeleteTarget] = useState<any | null>(null);
```

- [ ] **Étape 3 : Ajouter les fonctions de chargement**

Après la fonction `load()` existante, ajouter :

```typescript
const loadCorbeille = async () => {
  setLoadingCorbeille(true);
  const { data } = await supabase
    .from("stagiaires")
    .select("*, deleted_by_profile:deleted_by(email)")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  setCorbeille(data ?? []);
  setLoadingCorbeille(false);
};

const loadAudit = async () => {
  setLoadingAudit(true);
  const { data } = await supabase
    .from("audit_log")
    .select("*, user:user_id(email)")
    .eq("table_name", "stagiaires")
    .order("created_at", { ascending: false })
    .limit(100);
  setAuditLog(data ?? []);
  setLoadingAudit(false);
};
```

- [ ] **Étape 4 : Déclencher le chargement au changement d'onglet**

Localiser le `useEffect` principal. Ajouter juste après :

```typescript
useEffect(() => {
  if (tab === "corbeille") loadCorbeille();
  if (tab === "activite") loadAudit();
}, [tab]);
```

- [ ] **Étape 5 : Ajouter les fonctions restaurer et hard-delete**

```typescript
const restaurer = async (s: any) => {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("stagiaires").update({
    deleted_at: null,
    deleted_by: null,
  }).eq("id", s.id);
  if (error) { toast.error(error.message); return; }
  await supabase.from("audit_log").insert({
    organisme_id: "00000000-0000-0000-0000-000000000001",
    user_id: user!.id,
    user_role: "administrateur",
    action: "restore",
    table_name: "stagiaires",
    record_id: s.id,
    payload: { first_name: s.first_name, last_name: s.last_name },
  });
  toast.success(`${s.first_name} ${s.last_name} restauré`);
  loadCorbeille();
};

const hardDelete = async () => {
  if (!hardDeleteTarget) return;
  const { error } = await supabase.from("stagiaires").delete().eq("id", hardDeleteTarget.id);
  if (error) { toast.error(error.message); return; }
  toast.success("Stagiaire supprimé définitivement");
  setHardDeleteTarget(null);
  loadCorbeille();
};
```

- [ ] **Étape 6 : Ajouter les onglets dans le TabsList**

Localiser dans le JSX le composant `<TabsList>` existant qui contient les onglets "Actifs" / "Archivés".

Ajouter deux onglets supplémentaires dans le `<TabsList>` :
```tsx
<TabsTrigger value="corbeille">Corbeille</TabsTrigger>
<TabsTrigger value="activite">Activité</TabsTrigger>
```

Et s'assurer que le composant `<Tabs>` utilise bien `value={tab}` et `onValueChange={(v) => setTab(v as any)}`.

- [ ] **Étape 7 : Ajouter le contenu de l'onglet Corbeille**

Dans le JSX, après le `<TabsContent value="archive">...</TabsContent>` existant, ajouter :

```tsx
<TabsContent value="corbeille">
  {loadingCorbeille ? (
    <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
  ) : corbeille.length === 0 ? (
    <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
      La corbeille est vide
    </div>
  ) : (
    <div className="space-y-2">
      {corbeille.map(s => (
        <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <div>
            <p className="font-medium text-sm">{s.last_name?.toUpperCase()} {s.first_name}</p>
            <p className="text-xs text-muted-foreground">
              Archivé le {new Date(s.deleted_at).toLocaleDateString("fr-FR")}
              {s.deleted_by_profile?.email && ` par ${s.deleted_by_profile.email}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10" onClick={() => restaurer(s)}>
              <RotateCcw className="h-3.5 w-3.5" /> Restaurer
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setHardDeleteTarget(s)}>
              <Trash2 className="h-3.5 w-3.5" /> Supprimer définitivement
            </Button>
          </div>
        </div>
      ))}
    </div>
  )}
</TabsContent>
```

- [ ] **Étape 8 : Ajouter le contenu de l'onglet Activité**

```tsx
<TabsContent value="activite">
  {loadingAudit ? (
    <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
  ) : auditLog.length === 0 ? (
    <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
      Aucune activité enregistrée
    </div>
  ) : (
    <div className="space-y-1.5">
      {auditLog.map(log => {
        const actionLabel: Record<string, string> = {
          create: "a créé",
          update: "a modifié",
          delete: "a archivé",
          restore: "a restauré",
        };
        const actionColor: Record<string, string> = {
          create: "text-emerald-500",
          update: "text-blue-400",
          delete: "text-red-400",
          restore: "text-yellow-500",
        };
        const elapsed = Math.round((Date.now() - new Date(log.created_at).getTime()) / 60000);
        const elapsedStr = elapsed < 60
          ? `il y a ${elapsed} min`
          : elapsed < 1440
          ? `il y a ${Math.round(elapsed / 60)}h`
          : `le ${new Date(log.created_at).toLocaleDateString("fr-FR")}`;
        const stagiaireName = log.payload?.last_name
          ? `${log.payload.last_name?.toUpperCase()} ${log.payload.first_name ?? ""}`
          : log.record_id.slice(0, 8);

        return (
          <div key={log.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/30 transition-colors">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-primary">
                {log.user?.email?.[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">{log.user?.email ?? "Utilisateur inconnu"}</span>
                {" "}
                <span className={actionColor[log.action] ?? "text-foreground"}>{actionLabel[log.action] ?? log.action}</span>
                {" "}
                <span className="font-medium">{stagiaireName}</span>
              </p>
              <p className="text-xs text-muted-foreground">{elapsedStr}</p>
            </div>
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${log.user_role === "formateur" ? "bg-blue-500/10 text-blue-400" : "bg-primary/10 text-primary"}`}>
              {log.user_role}
            </span>
          </div>
        );
      })}
    </div>
  )}
</TabsContent>
```

- [ ] **Étape 9 : Ajouter le dialog confirmation hard-delete**

À la fin du JSX, avant la dernière `</div>` fermante :

```tsx
<Dialog open={!!hardDeleteTarget} onOpenChange={() => setHardDeleteTarget(null)}>
  <DialogContent className="bg-card border-border">
    <DialogHeader>
      <DialogTitle>Supprimer définitivement ?</DialogTitle>
    </DialogHeader>
    <p className="text-sm text-muted-foreground">
      <b>{hardDeleteTarget?.first_name} {hardDeleteTarget?.last_name}</b> sera supprimé définitivement.
      Cette action est <b>irréversible</b>.
    </p>
    <div className="flex gap-2 mt-2">
      <Button variant="outline" className="flex-1" onClick={() => setHardDeleteTarget(null)}>Annuler</Button>
      <Button variant="destructive" className="flex-1" onClick={hardDelete}>Supprimer définitivement</Button>
    </div>
  </DialogContent>
</Dialog>
```

- [ ] **Étape 10 : Ajouter les imports manquants dans Stagiaires.tsx**

Vérifier que `RotateCcw` est importé depuis lucide-react. Si absent, l'ajouter dans l'import existant.

- [ ] **Étape 11 : Vérifier TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Résultat attendu : aucune sortie.

- [ ] **Étape 12 : Commit**

```bash
git add src/pages/Stagiaires.tsx
git commit -m "feat(admin): add Corbeille and Activité tabs to Stagiaires page"
```

---

## Self-Review

**Couverture spec :**

| Exigence spec | Tâche |
|---------------|-------|
| `organisme_id` sur stagiaires, formations, formateurs, participants | Task 1 |
| Table `organismes` avec organisme par défaut | Task 1 |
| `deleted_at` + `deleted_by` sur stagiaires | Task 1 |
| Table `audit_log` | Task 1 |
| Fonction `get_user_organisme_id()` | Task 1 |
| RLS formateur SELECT (non-supprimés, même organisme) | Task 2 |
| RLS formateur INSERT | Task 2 |
| RLS formateur UPDATE (ses stagiaires / ses formations) | Task 2 |
| Pas de DELETE pour formateur | Task 2 |
| Admin voit tout y compris deleted | Task 2 |
| Isolation inter-organismes | Task 2 |
| Onglet "Mes stagiaires" dans EspaceFormateur | Task 3 |
| Formulaire prénom*, nom*, date naissance*, email, tel, adresse, ville, CP, notes | Task 3 |
| Soft-delete avec confirmation | Task 3 |
| Inscription rapide post-création | Task 3 |
| Écriture dans audit_log côté formateur | Task 3 |
| Onglet Corbeille admin avec Restaurer + Supprimer définitif | Task 4 |
| Onglet Activité admin (100 dernières actions) | Task 4 |
| Écriture audit_log sur restore | Task 4 |

**Cohérence des types :** `organisme_id` vaut `"00000000-0000-0000-0000-000000000001"` partout de façon cohérente. `deleted_at`/`deleted_by` utilisés identiquement en Task 2, 3 et 4.

**Aucun placeholder détecté.**

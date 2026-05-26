# Financement OPCO — Suivi des dossiers de prise en charge

## Goal

Permettre le suivi complet des dossiers de financement OPCO : création d'un dossier par formation (globale) ou par participant (individuel), suivi du statut de la prise en charge, lien avec les factures existantes, et vue d'ensemble financière cross-formations.

## Architecture

Approche hybride : accès contextuel depuis la carte formation (Dialog dossiers OPCO) + page globale `/financement-opco` pour la vue d'ensemble. Une seule table `financements_opco` avec `formation_id` obligatoire et `stagiaire_id` nullable distingue les deux niveaux. Pas de générateur PDF dédié — les factures OPCO réutilisent `generateFacturePdf` via le lien `facture_id`.

**Tech Stack :** React 18 + TypeScript, Supabase PostgreSQL, Shadcn UI Dialog/Select/Badge, lucide-react (`Landmark`), Vitest + Testing Library.

---

## Data Model

### Migration `financements_opco`

```sql
-- supabase/migrations/20260526130000_financements_opco.sql

CREATE TABLE public.financements_opco (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id        UUID NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  stagiaire_id        UUID REFERENCES public.stagiaires(id) ON DELETE SET NULL,
  -- NULL = couvre toute la formation ; renseigné = participant spécifique

  opco_nom            TEXT NOT NULL,
  opco_contact_nom    TEXT,
  opco_contact_email  TEXT,
  opco_contact_tel    TEXT,
  numero_dossier      TEXT,

  montant_accorde     NUMERIC(10,2) NOT NULL DEFAULT 0,
  montant_paye        NUMERIC(10,2) NOT NULL DEFAULT 0,
  facture_id          UUID REFERENCES public.factures(id) ON DELETE SET NULL,

  statut              TEXT NOT NULL DEFAULT 'brouillon'
                        CHECK (statut IN (
                          'brouillon', 'demande_envoyee', 'accord_recu',
                          'en_attente_facture', 'facture', 'paye', 'refuse'
                        )),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.financements_opco ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_secretaire_financements_opco" ON public.financements_opco
  FOR ALL
  USING (
    public.has_role(auth.uid(), 'administrateur')
    OR public.has_role(auth.uid(), 'secretaire')
  );
```

**Règles métier :**
- `formation_id` toujours obligatoire (contexte de la formation)
- `stagiaire_id = null` → dossier formation entière
- `stagiaire_id` renseigné → dossier pour ce participant spécifique
- Les deux types peuvent coexister sur la même formation
- `facture_id` nullable — lien optionnel vers une facture existante de la même formation

---

## Statuts

```
brouillon → demande_envoyee → accord_recu → en_attente_facture → facture → paye
                                                                         ↘
                                                             refuse (depuis n'importe quel statut sauf paye)
```

| Statut | Badge couleur |
|---|---|
| brouillon | gris |
| demande_envoyee | bleu |
| accord_recu | violet |
| en_attente_facture | orange |
| facture | jaune |
| paye | vert |
| refuse | rouge |

---

## Dialog "Dossiers OPCO" dans `Formations.tsx`

Bouton "Dossiers OPCO" (icône `Landmark`, couleur amber) par carte formation. Ouvre un Dialog Shadcn avec deux zones :

### Zone liste (dossiers existants)

Pour chaque dossier :
- Badge statut + nom OPCO + N° dossier (si renseigné)
- Périmètre : "Formation entière" ou nom du stagiaire
- Montant accordé / payé
- Bouton avancer statut (séquentiel, texte court : "→ Demande envoyée", etc.)
- Bouton "Refusé" (rouge, disponible sauf si statut = paye)
- Bouton supprimer (brouillon seulement, avec `window.confirm`)

### Zone formulaire "Nouveau dossier"

Collapsible (toggle "+" en haut du Dialog). Champs :

| Champ | Type | Obligatoire |
|---|---|---|
| Périmètre | radio : "Formation entière" / "Stagiaire spécifique" | oui |
| Stagiaire | select parmi participants (si périmètre = stagiaire) | conditonnel |
| OPCO — Nom | text | oui |
| Contact gestionnaire | text | non |
| Email gestionnaire | email | non |
| Téléphone gestionnaire | text | non |
| N° dossier OPCO | text | non |
| Montant accordé (€) | number, min 0 | non (défaut 0) |
| Notes | textarea | non |

À la création, statut = `brouillon` automatiquement.

---

## Page `src/pages/FinancementOpco.tsx`

**Route :** `/financement-opco`
**Nav :** entrée "Financement OPCO" avec icône `Landmark` dans le groupe "Administration" de `AppSidebar.tsx`, rôles `["administrateur", "secretaire"]`

### Indicateurs en haut de page

Trois cartes :
- **Total accordé** — somme de tous les `montant_accorde` (hors refusé)
- **Total payé** — somme de tous les `montant_paye`
- **Solde en attente** — différence accordé − payé

### Filtres

- Par statut (boutons radio : Tous + chaque statut)
- Par OPCO (input texte, filtre côté client sur `opco_nom`)

### Liste des dossiers

Colonnes par ligne :
- N° dossier (ou "—")
- Formation (titre)
- Périmètre ("Formation entière" ou "Nom Prénom" du stagiaire)
- OPCO nom
- Montant accordé
- Montant payé
- Badge statut
- Actions

**Actions par ligne :**
1. **Avancer statut** — bouton "→ [prochain statut]" (séquentiel, pas de retour arrière sauf refuse)
2. **Refuser** — bouton rouge, disponible sauf si statut = `paye`
3. **Lier facture** — select parmi les factures de la même formation (`formation_id`) — met à jour `facture_id` + passe le statut à `facture` automatiquement
4. **Saisir montant payé** — input inline éditable (disponible si statut = `facture` ou `paye`)
5. **Supprimer** — brouillon seulement, avec `window.confirm`

---

## Tests

**`FinancementOpco.test.tsx` (3 tests) :**
1. Affiche le titre et les dossiers mockés (numéro dossier, OPCO nom)
2. Filtre par statut "accord_recu" affiche uniquement les dossiers correspondants, masque les autres
3. Indicateurs calculés correctement (total accordé = somme montant_accorde hors refusé, solde = accordé − payé)

**Formations.tsx :** pas de nouveaux tests unitaires — le Dialog OPCO suit le même pattern testé que le Dialog facture.

---

## Navigation

- `src/App.tsx` : ajouter `<Route path="/financement-opco" element={<FinancementOpco />} />`
- `src/components/AppSidebar.tsx` : ajouter dans le groupe "Administration" après "Facturation" :
  ```ts
  { title: "Financement OPCO", url: "/financement-opco", icon: Landmark, roles: ["administrateur", "secretaire"] }
  ```

---

## Fichiers

**Nouveaux :**
- `supabase/migrations/20260526130000_financements_opco.sql`
- `src/pages/FinancementOpco.tsx`
- `src/test/FinancementOpco.test.tsx`

**Modifiés :**
- `src/pages/Formations.tsx` — bouton + Dialog dossiers OPCO
- `src/App.tsx` — route `/financement-opco`
- `src/components/AppSidebar.tsx` — entrée nav + import `Landmark`

---

## Placeholders post-déploiement

Aucun — toutes les données OPCO sont saisies par l'utilisateur.

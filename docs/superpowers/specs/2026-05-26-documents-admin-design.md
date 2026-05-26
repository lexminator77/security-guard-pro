# Documents Admin — Convention PDF Auto + Facturation

## Goal

Remplacer la convention Word par un PDF généré côté client avec auto-fetch du client depuis la DB, et créer un système de facturation minimal conforme aux obligations légales françaises : table `factures`, page admin de suivi, PDF téléchargeable.

## Architecture

Deux pièces indépendantes :

1. **Convention PDF auto** — `src/lib/generateConventionPdf.ts` remplace l'appel à `generateConvention` (Word) dans `Formations.tsx`. Auto-fetch `entreprise_rh` si les stagiaires y sont rattachés, sinon section client vide avec pointillés.

2. **Facturation** — migration SQL (`factures` table + fonction de numérotation) + page `src/pages/Facturation.tsx` + `src/lib/generateFacturePdf.ts` + modal "Créer la facture" dans `Formations.tsx`.

**Tech Stack :** React 18 + TypeScript + Vite, Supabase PostgreSQL, Shadcn UI Dialog, `jspdf` + `jspdf-autotable` (déjà installés), Vitest + Testing Library.

---

## Data Model

### Migration `factures`

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
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT NOT NULL UNIQUE DEFAULT public.generate_facture_numero(),
  formation_id    UUID REFERENCES public.formations(id) ON DELETE SET NULL,
  client_nom      TEXT NOT NULL,
  client_adresse  TEXT,
  client_siret    TEXT,            -- obligatoire B2B, facultatif particuliers/CPF
  montant_ht      NUMERIC(10,2) NOT NULL DEFAULT 0,
  participant_count INT NOT NULL DEFAULT 0, -- figé à la création (formation peut changer)
  statut          TEXT NOT NULL DEFAULT 'brouillon'
                    CHECK (statut IN ('brouillon', 'envoye', 'paye')),
  date_emission   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT now()
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

`formation_id` nullable — si une formation est supprimée, la facture reste (traçabilité comptable).

---

## Convention PDF auto

**Fichier :** `src/lib/generateConventionPdf.ts`

**Signature :**
```ts
export async function generateConventionPdf(
  formation: { id: string; title: string; type: string; start_date: string; end_date: string; location: string | null; duration_hours: number | null },
  participants: { last_name: string; first_name: string; tarif: number | null }[],
  formateur: { first_name: string; last_name: string } | null,
  supabase: SupabaseClient
): Promise<void>
```

**Auto-fetch entreprise :**

```ts
const { data: entreprises } = await supabase
  .from("entreprise_rh")
  .select("nom, contact_nom, contact_prenom, adresse, code_postal, ville, email, telephone, siret");

// Si une seule entreprise en DB → on la prend (cas courant pour un petit OF mono-client)
// Si plusieurs → impossible de déduire la bonne, on laisse vide
const entrepriseData = entreprises?.length === 1 ? entreprises[0] : null;
```

Si `entrepriseData` est null → section "02 — LE CLIENT" affiche des lignes pointillées. Si trouvé → champs pré-remplis.

**Structure PDF (A4 portrait, 5 articles) :**

1. **L'ORGANISME DE FORMATION** — données fixes AV Sécurité Formation (raison sociale, adresse, SIRET : `SIRET_ORGANISME`, NDA : `NDA_ORGANISME`)
2. **LE CLIENT** — auto-fetché ou vide
3. **DÉSIGNATION DE LA FORMATION** — titre, type, dates, lieu, formateur, durée en heures, nombre de stagiaires
4. **STAGIAIRES CONCERNÉS** — tableau nom / prénom
5. **PRIX ET MODALITÉS** — total HT (somme des tarifs), mention : `"TVA non applicable — Art. 261-4-4° du CGI"`

**Fichier sauvegardé :** `convention_${formation.type}_${formation.start_date}.pdf`

**Dans `Formations.tsx` :** le bouton "Convention de formation" est mis à jour pour appeler `generateConventionPdf` avec un état `loadingConvention` identique au pattern `loadingPdf`. L'ancienne fonction `generateConvention` reste dans `generateDocs.ts` mais n'est plus appelée depuis l'UI.

---

## Facturation

### Modal "Créer la facture" dans `Formations.tsx`

Bouton "Créer la facture" (visible si `ps.length > 0`) ouvre un Dialog Shadcn avec :

| Champ | Type | Valeur par défaut |
|---|---|---|
| Client — Nom / Raison sociale | text, obligatoire | vide |
| Client — Adresse | textarea, optionnel | vide |
| Client — SIRET | text, optionnel | vide |
| Montant HT (€) | number | somme des tarifs participants |
| Date d'émission | date | aujourd'hui |

Au clic **"Créer et télécharger"** :
1. RPC `generate_facture_numero()` via insert Supabase (le numéro est généré par le DEFAULT)
2. Insert dans `factures`
3. `generateFacturePdf(facture, formation)` → téléchargement PDF
4. `toast.success("Facture ${numero} créée")`

### Page `src/pages/Facturation.tsx`

Accessible depuis le menu admin (nouvelle entrée). Affiche la liste de toutes les factures :

**Colonnes :** Numéro | Formation | Client | Montant HT | Date | Statut | Actions

**Statut badges :**
- `brouillon` → gris
- `envoye` → jaune
- `paye` → vert

**Actions par ligne :**
- Télécharger PDF
- Changer statut (brouillon → envoyé → payé, pas de retour en arrière)
- Supprimer (brouillon seulement, avec confirmation)

**Filtres :** par statut (boutons radio en haut).

### Générateur PDF `generateFacturePdf.ts`

**Signature :**
```ts
export function generateFacturePdf(
  facture: { numero: string; client_nom: string; client_adresse: string | null; client_siret: string | null; montant_ht: number; date_emission: string; participant_count: number },
  formation: { title: string; type: string; start_date: string; end_date: string; duration_hours: number | null } | null
): void
```

**Mentions légales obligatoires sur le PDF (Art. 289 CGI) :**

- **Organisme :** raison sociale, adresse complète, SIRET (`SIRET_ORGANISME`), numéro de déclaration d'activité (`NDA_ORGANISME`)
- **Client :** nom, adresse, SIRET si renseigné
- **Numéro de facture** et **date d'émission**
- **Objet :** intitulé formation, type, dates, durée en heures, nombre de stagiaires
- **Montant HT**
- **TVA :** `"TVA non applicable — Art. 261-4-4° du CGI"`
- **Total TTC = Total HT** (TVA = 0)
- **Conditions de règlement :** `"Paiement à 30 jours à réception de facture"`
- **Pénalités de retard :** `"En cas de retard de paiement, des pénalités de retard au taux de 3 fois le taux d'intérêt légal seront appliquées, ainsi qu'une indemnité forfaitaire de recouvrement de 40 €."`

**Fichier sauvegardé :** `facture_${facture.numero}.pdf`

---

## Navigation

Ajouter "Facturation" dans le menu admin de `Index.tsx` (ou `App.tsx` selon la structure de routage). Icône : `Receipt` de lucide-react.

---

## Tests

**`generateConventionPdf` :**
- Avec entreprise → `doc.save()` appelé, texte entreprise présent
- Sans entreprise (supabase retourne null) → pas de crash, `doc.save()` appelé

**`generateFacturePdf` :**
- Champs obligatoires présents dans `doc.text()` : numéro, client, TVA mention, pénalités
- Avec formation null → pas de crash

**`Facturation.tsx` (composant) :**
- Affiche la liste des factures mockées
- Filtre par statut fonctionne

---

## Placeholders à renseigner

Dans `generateConventionPdf.ts` et `generateFacturePdf.ts`, remplacer avant mise en prod :

```ts
const ORGANISME = {
  nom: "AV Sécurité Formation",
  adresse: "ADRESSE_ORGANISME",
  siret: "SIRET_ORGANISME",
  nda: "NDA_ORGANISME",        // Numéro de déclaration d'activité DREETS
};
```

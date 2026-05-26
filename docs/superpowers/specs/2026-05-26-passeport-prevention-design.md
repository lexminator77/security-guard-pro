# Passeport de Prévention — Suivi individuel des formations et certifications

## Goal

Offrir à chaque agent (stagiaire) un passeport de prévention consultable en ligne et téléchargeable en PDF : document officiel structuré récapitulant toutes ses formations suivies et certifications obtenues dans le CRM.

## Architecture

Page dédiée `PasseportPrevention.tsx` à `/passeport-prevention/:stagiaireId`. Pas de nouvelle table — données en lecture seule depuis `stagiaires` + `formation_participants` (jointure `formations`) + `certifications`. Deux points d'accès contextuels : panneau détail stagiaire (admin/secrétaire) et espace stagiaire (agent connecté via `auth_user_id`). PDF généré à la volée par `generatePasseportPdf.ts` (pattern jsPDF + jspdf-autotable, identique à `generateConventionPdf.ts`).

**Tech Stack :** React 18 + TypeScript, Supabase PostgreSQL, Shadcn UI Badge/Button/Table, lucide-react (`BookOpen`), jsPDF + jspdf-autotable, Vitest + Testing Library.

---

## Data Model

Aucune nouvelle table. Trois requêtes en lecture :

### 1. Identité du stagiaire
```sql
SELECT id, first_name, last_name, birth_date, email, phone,
       carte_pro_number, carte_pro_expiry,
       autorisation_numero, autorisation_type, autorisation_expiry
FROM stagiaires
WHERE id = :stagiaireId
```

### 2. Formations suivies
```sql
SELECT fp.status, fp.resultat, fp.resultat_commentaire,
       f.title, f.type, f.start_date, f.end_date, f.location, f.duration_hours
FROM formation_participants fp
JOIN formations f ON f.id = fp.formation_id
WHERE fp.stagiaire_id = :stagiaireId
ORDER BY f.start_date DESC
```

### 3. Certifications obtenues
```sql
SELECT c.type, c.date_obtention, c.date_expiration, c.notes,
       f.title AS formation_title
FROM certifications c
LEFT JOIN formations f ON f.id = c.formation_id
WHERE c.stagiaire_id = :stagiaireId
ORDER BY c.date_obtention DESC
```

---

## Page `src/pages/PasseportPrevention.tsx`

**Route :** `/passeport-prevention/:stagiaireId`
**Accès :** administrateur, secrétaire (via `:stagiaireId`), stagiaire (détecte son propre ID via `auth.uid()` → `stagiaires.auth_user_id`). La route doit être placée dans une section de `App.tsx` accessible à tous les rôles authentifiés — vérifier que `ProtectedRoute` ne bloque pas le rôle `stagiaire`.

### Détection du stagiaire connecté

Si l'utilisateur a le rôle `stagiaire`, la page ignore le param URL et charge :
```ts
supabase.from("stagiaires").select("id").eq("auth_user_id", user.id).single()
```
puis redirige en interne sur ce `stagiaireId`.

### Vue en ligne

**En-tête :**
- Nom complet (MAJUSCULES Prénom)
- Carte pro CNAPS : numéro + expiry (ou "Non renseignée")
- Autorisation : numéro + type + expiry (si présente)
- Bouton "Télécharger le passeport PDF" (icône `Download`)

**Section "Formations suivies" :**

Tableau avec colonnes :
| Intitulé | Type | Période | Durée | Statut | Résultat |
|---|---|---|---|---|---|
| Formation SST | SST | 26/05 → 27/05/2026 | 14h | Validé | Obtenu |

Statut formaté depuis `formation_participants.status` : inscrit / présent / absent / validé / échec.
Résultat depuis `resultat` : obtenu / en attente / — (si null).

**Section "Certifications" :**

Tableau avec colonnes :
| Type | Date obtention | Expiration | Formation associée | Validité |
|---|---|---|---|---|
| SST | 27/05/2026 | 27/05/2028 | Formation SST | Badge vert |

Badge validité :
- Vert : date_expiration > aujourd'hui + 60 jours
- Orange : expire dans ≤ 60 jours
- Rouge : expiré

---

## Intégration dans les pages existantes

### `src/pages/Stagiaires.tsx`

Dans le panneau détail du stagiaire, ajouter un bouton :
```tsx
<Button variant="outline" onClick={() => navigate(`/passeport-prevention/${selected.id}`)}>
  <BookOpen className="h-4 w-4 mr-2" /> Passeport de prévention
</Button>
```

### `src/pages/EspaceStagiaire.tsx`

Ajouter un bouton "Mon passeport" qui navigue vers `/passeport-prevention/:ownStagiaireId` (ID récupéré au chargement de l'espace via `auth_user_id`).

### `src/App.tsx`

```tsx
import PasseportPrevention from "./pages/PasseportPrevention";
// ...
<Route path="/passeport-prevention/:stagiaireId" element={<PasseportPrevention />} />
```

Pas d'entrée sidebar — accès contextuel uniquement.

---

## PDF `src/lib/generatePasseportPdf.ts`

```ts
export async function generatePasseportPdf(
  stagiaire: {
    first_name: string; last_name: string; birth_date: string | null;
    email: string | null; phone: string | null;
    carte_pro_number: string | null; carte_pro_expiry: string | null;
    autorisation_numero: string | null; autorisation_type: string | null; autorisation_expiry: string | null;
  },
  participations: {
    status: string; resultat: string | null; resultat_commentaire: string | null;
    formation: { title: string; type: string; start_date: string; end_date: string; duration_hours: number | null };
  }[],
  certifications: {
    type: string; date_obtention: string; date_expiration: string | null; notes: string | null;
    formation: { title: string } | null;
  }[]
): Promise<void>
```

**Structure du document (A4 portrait, séparateurs dorés) :**

| Section | Contenu |
|---|---|
| En-tête | "AV Sécurité Formation" + titre "PASSEPORT DE PRÉVENTION" + sous-titre "Loi Santé au Travail — 2 août 2021" |
| Article 01 — Titulaire | Nom, prénom, date naissance, email, téléphone |
| Article 02 — Carte professionnelle CNAPS | Numéro carte pro, type autorisation, dates expiration (pointillés si absent) |
| Article 03 — Formations suivies | Tableau jspdf-autotable : Intitulé · Type · Du…au · Durée · Statut · Résultat |
| Article 04 — Certifications obtenues | Tableau : Type · Date obtention · Expiration · Formation associée |
| Pied de page | "Passeport généré le JJ/MM/AAAA — AV Sécurité Formation" |

**Nom du fichier :** `passeport_DUPONT_Jean.pdf`

---

## Tests

**`src/test/PasseportPrevention.test.tsx` — 3 tests :**

Mock Supabase : chaîne `from().select().eq().order()` → résout avec données mockées.
Mock `generatePasseportPdf` : `vi.fn()`.

1. **Affiche identité et formations** — stagiaire mock + 2 participations → vérifie nom complet + titres des formations dans le DOM
2. **Badge expiration certifications** — certification expirée (date passée) → badge rouge visible ; certification future → badge vert
3. **Bouton PDF appelle generatePasseportPdf** — clic sur "Télécharger" → vérifie que la fonction est appelée

---

## Fichiers

**Nouveaux :**
- `supabase/migrations/` — aucun (pas de nouvelle table)
- `src/pages/PasseportPrevention.tsx`
- `src/lib/generatePasseportPdf.ts`
- `src/test/PasseportPrevention.test.tsx`

**Modifiés :**
- `src/pages/Stagiaires.tsx` — bouton "Passeport de prévention" dans panneau détail
- `src/pages/EspaceStagiaire.tsx` — bouton "Mon passeport"
- `src/App.tsx` — route `/passeport-prevention/:stagiaireId`

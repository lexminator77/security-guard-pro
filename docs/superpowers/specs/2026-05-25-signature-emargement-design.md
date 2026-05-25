# Signature Électronique Émargements — Design Spec

## Goal

Remplacer le clic simple pour émarger par une **signature dessinée** (canvas) pour les stagiaires et les formateurs, stocker la signature en base64 dans la DB, et permettre aux administrateurs de **générer un PDF feuille d'émargement** Qualiopi par formation.

## Architecture

Trois pièces indépendantes :

1. **Migration SQL** — colonne `signature_data TEXT` ajoutée à `emargements_stagiaire` et `emargements_formateur`
2. **Composant `SignatureModal`** — dialog Shadcn avec canvas `signature_pad`, réutilisé dans `EspaceStagiaire.tsx` et `EspaceFormateur.tsx`
3. **Générateur PDF** — `src/lib/generateEmargementPdf.ts` avec `jspdf` + `jspdf-autotable`, appelé depuis un bouton dans `Formations.tsx`

**Tech Stack :** React 18 + TypeScript + Vite, Supabase PostgreSQL, Shadcn UI Dialog, `signature_pad`, `jspdf`, `jspdf-autotable`, Vitest + Testing Library.

---

## Data Model

### Migration

```sql
-- supabase/migrations/20260525120000_emargements_signature_data.sql
ALTER TABLE public.emargements_stagiaire
  ADD COLUMN IF NOT EXISTS signature_data TEXT;

ALTER TABLE public.emargements_formateur
  ADD COLUMN IF NOT EXISTS signature_data TEXT;
```

`signature_data` contient le PNG en base64 produit par `signaturePad.toDataURL("image/png")`. Nullable — les anciens émargements sans signature restent valides.

---

## Composant `SignatureModal`

**Fichier :** `src/components/SignatureModal.tsx`

**Props :**
```tsx
interface SignatureModalProps {
  open: boolean;
  title: string; // ex: "Signature — Matin"
  onConfirm: (signatureBase64: string) => Promise<void>;
  onClose: () => void;
}
```

**Comportement :**
- Dialog Shadcn (`Dialog`, `DialogContent`, `DialogHeader`)
- Canvas 100% largeur, hauteur 180px, fond blanc, trait noir
- Bouton **"Effacer"** : remet le canvas à zéro (`signaturePad.clear()`)
- Bouton **"Confirmer"** :
  - Si canvas vide (`signaturePad.isEmpty()`) → toast.error("Veuillez signer avant de confirmer")
  - Sinon → appelle `onConfirm(signaturePad.toDataURL("image/png"))` → ferme le dialog
- Bouton X (fermeture) → `onClose()` sans sauvegarder
- Sur mobile : canvas tactile nativement géré par `signature_pad`

**Dépendance :** `npm install signature_pad`

---

## Modifications `EspaceStagiaire.tsx`

### État local ajouté

```tsx
const [sigModal, setSigModal] = useState<{ formationId: string; periode: "matin" | "apres_midi" } | null>(null);
```

### `signerEmargement` modifié

La fonction accepte maintenant `signatureData` :

```tsx
const signerEmargement = async (formationId: string, periode: "matin" | "apres_midi", signatureData: string) => {
  if (!stagiaireId) return;
  const exists = emargements.find(e => e.formation_id === formationId && e.date === today && e.periode === periode);
  if (exists) { toast.info("Déjà signé !"); return; }
  const { error } = await supabase.from("emargements_stagiaire").insert({
    stagiaire_id: stagiaireId,
    formation_id: formationId,
    date: today,
    periode,
    signe_le: new Date().toISOString(),
    signature_data: signatureData,
  });
  if (error) toast.error(error.message);
  else { toast.success("Émargement signé !"); loadAll(stagiaireId); }
};
```

### `PageEmargement` modifié

Les boutons "Signer" ouvrent le modal au lieu d'appeler directement `signerEmargement` :

```tsx
<button key={periode} onClick={() => !estSigne(f.id, periode) && setSigModal({ formationId: f.id, periode })}
  className={`p-4 rounded-xl border-2 transition-all text-center ${estSigne(f.id, periode) ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 cursor-default" : "border-border/50 bg-muted/20 hover:border-primary/40 hover:bg-primary/5"}`}>
  <p className="font-semibold text-sm">{estSigne(f.id, periode) ? "✓ Signé" : "Signer"}</p>
  <p className="text-xs text-muted-foreground mt-1">{periode === "matin" ? "Matin" : "Après-midi"}</p>
</button>
```

`SignatureModal` ajouté juste avant la fermeture du composant `EspaceStagiaire` :

```tsx
<SignatureModal
  open={!!sigModal}
  title={`Signature — ${sigModal?.periode === "matin" ? "Matin" : "Après-midi"}`}
  onConfirm={async (sig) => {
    if (sigModal) await signerEmargement(sigModal.formationId, sigModal.periode, sig);
    setSigModal(null);
  }}
  onClose={() => setSigModal(null)}
/>
```

---

## Modifications `EspaceFormateur.tsx`

Identique à `EspaceStagiaire.tsx` :

- État `sigModal` ajouté
- `signerEmargement` accepte `signatureData`, insère dans `emargements_formateur` avec `signature_data`
- Boutons dans `PageEmargement` ouvrent le modal
- `SignatureModal` rendu à la racine du composant

---

## Générateur PDF `generateEmargementPdf.ts`

**Fichier :** `src/lib/generateEmargementPdf.ts`

**Signature :**
```ts
export async function generateEmargementPdf(
  formation: { id: string; title: string; type: string; start_date: string; end_date: string },
  supabase: SupabaseClient
): Promise<void>
```

**Logique :**

1. Requête `emargements_stagiaire` avec join `stagiaires` pour la formation
2. Requête `emargements_formateur` avec join `formateurs` pour la formation
3. Construire la liste des jours de formation (de `start_date` à `end_date`)
4. Construire le tableau :
   - Colonnes : `Stagiaire` + une colonne par combinaison `jour × période` (ex. "26/05 Matin", "26/05 AM")
   - Lignes : une par stagiaire
   - Cellule : image de signature si `signature_data` existe, trait diagonal (absent) sinon
5. Section formateur en bas : nom + image de signature
6. En-tête : titre formation, type, dates
7. Pied de page : "Feuille d'émargement générée le [date]"
8. `doc.save("emargement-[titre]-[date].pdf")`

**Dépendances :** `npm install jspdf jspdf-autotable`

Les images base64 sont passées directement à `jspdf` via `doc.addImage(base64, "PNG", x, y, w, h)`.

---

## Modifications `Formations.tsx`

Ajout d'un bouton "Feuille d'émargement" dans la liste des formations (visible seulement pour admin/secrétaire, ce qui correspond à tous les utilisateurs de cette page).

Bouton par formation :

```tsx
<Button size="sm" variant="outline" onClick={() => generateEmargementPdf(formation, supabase)}>
  <FileText className="h-4 w-4 mr-2" />
  Feuille d'émargement
</Button>
```

L'appel est asynchrone — ajouter un état `loadingPdf` pour désactiver le bouton pendant la génération.

---

## Tests

- `SignatureModal` :
  - Canvas vide + clic Confirmer → toast erreur, `onConfirm` non appelé
  - Canvas non vide + clic Confirmer → `onConfirm` appelé avec string base64
  - Clic Effacer → canvas remis à zéro
  - Clic X → `onClose` appelé

- `generateEmargementPdf` :
  - Avec 2 stagiaires, 2 jours, 2 périodes → fonction appelée sans erreur (vérifié via mock jspdf)
  - Aucun émargement → PDF généré sans crash

---

## Mobile

- Canvas `signature_pad` fonctionne nativement avec les événements touch
- Dialog pleine largeur sur mobile (`max-w-full` ou `sm:max-w-lg`)
- Canvas hauteur 180px — suffisant pour une signature au doigt
- Boutons "Effacer" et "Confirmer" : `min-h-[44px]`

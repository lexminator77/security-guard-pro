# Filtre par date — Consignes & Permis de feu

**Date :** 2026-05-22  
**Statut :** Approuvé

---

## Contexte

Le fichier `src/components/MainCourante.tsx` contient 4 composants concernés :

| Composant | Filtre date existant |
|-----------|---------------------|
| `ConsignesFormateur` | Aucun |
| `ConsignesStagiaire` | 4 boutons prédéfinis (`filtrePeriode`) sur `created_at` |
| `PermisFeuFormateur` | Aucun |
| `PermisFeuStagiaire` | 4 boutons prédéfinis (`filtrePeriode`) sur `created_at` |

---

## Objectif

Ajouter un filtre par date de type **Combiné** (raccourcis prédéfinis + plage libre) sur les 4 vues. Les vues qui ont déjà des boutons prédéfinis sont migrées vers le nouveau composant.

---

## Nouveau composant : `FiltreDateRange`

**Fichier :** `src/components/FiltreDateRange.tsx`

### Type de valeur

```ts
type FiltreDateValue =
  | { type: "preset"; preset: "toutes" | "aujourd_hui" | "semaine" | "mois" }
  | { type: "range"; from: string; to: string }
```

La valeur par défaut est `{ type: "preset", preset: "toutes" }`.

### Props

```ts
interface FiltreDateRangeProps {
  value: FiltreDateValue
  onChange: (v: FiltreDateValue) => void
}
```

### Comportement UI

- **Ligne 1 :** 4 boutons — Toutes / Aujourd'hui / 7 derniers jours / 30 derniers jours
- **Ligne 2 :** Deux champs `<input type="date">` (Du… Au…) + bouton Réinitialiser
- Quand au moins un champ de la plage est renseigné, les boutons preset sont visuellement désactivés (opacité réduite) et la plage libre prend le dessus
- Cliquer un bouton preset efface les deux champs date et active le preset

### Style

Cohérent avec les boutons existants dans le projet : `bg-muted/30`, `text-muted-foreground`, actif = `bg-primary/20 text-primary`. Champs date avec `input` de style `bg-muted/30 border border-border rounded-lg`.

---

## Modifications des 4 vues

### `ConsignesFormateur`

- Supprimer : rien (aucun filtre existant)
- Ajouter : state `filtreDateRange`, composant `<FiltreDateRange>` dans la barre de contrôles, appel à `appliquerFiltreDateRange` dans le `.filter()` sur `c.created_at`

### `ConsignesStagiaire`

- Supprimer : state `filtrePeriode`, les 4 boutons inline correspondants
- Ajouter : state `filtreDateRange`, composant `<FiltreDateRange>` à la place, appel à `appliquerFiltreDateRange` dans le `.filter()` sur `c.created_at`
- Conserver : state `filtreType` et ses boutons (filtre par type de consigne, indépendant)

### `PermisFeuFormateur`

- Supprimer : rien (aucun filtre existant)
- Ajouter : state `filtreDateRange`, composant `<FiltreDateRange>`, appel à `appliquerFiltreDateRange` dans le `.filter()` sur `p.date_debut`

### `PermisFeuStagiaire`

- Supprimer : state `filtrePeriode`, les 4 boutons inline correspondants
- Ajouter : state `filtreDateRange`, composant `<FiltreDateRange>` à la place, appel à `appliquerFiltreDateRange` dans le `.filter()` sur `p.date_debut`
- Conserver : onglets actif/archive (indépendants du filtre date)

---

## Fonction utilitaire de filtrage

Exportée depuis `FiltreDateRange.tsx` pour être importée dans `MainCourante.tsx` :

```ts
export function appliquerFiltreDateRange(
  dateStr: string | null | undefined,
  filtre: FiltreDateValue
): boolean {
  if (filtre.type === "preset") {
    if (filtre.preset === "toutes") return true
    if (!dateStr) return false
    const date = new Date(dateStr)
    const now = new Date()
    if (filtre.preset === "aujourd_hui") return date.toDateString() === now.toDateString()
    if (filtre.preset === "semaine") {
      const s = new Date(now); s.setDate(s.getDate() - 7); return date >= s
    }
    if (filtre.preset === "mois") {
      const m = new Date(now); m.setMonth(m.getMonth() - 1); return date >= m
    }
  }
  if (filtre.type === "range") {
    if (!dateStr) return false
    const date = new Date(dateStr)
    if (filtre.from && date < new Date(filtre.from)) return false
    if (filtre.to && date > new Date(filtre.to + "T23:59:59")) return false
    return true
  }
  return true
}
```

**Cas `date_debut` null (Permis de feu) :** Si `date_debut` est null et le filtre est "Toutes" (preset), le permis reste visible. Pour tout autre filtre (preset non-toutes ou plage), il est exclu.

---

## Ce qui ne change pas

- Les onglets actif/archive sur les vues Permis de feu
- Le filtre par type de consigne (`filtreType`) sur `ConsignesStagiaire`
- La structure de données Supabase (aucune migration)
- Le reste du fichier `MainCourante.tsx`

# Qualiopi Quick Wins — Design Spec

## Goal

Implémenter les 4 fonctionnalités Qualiopi prioritaires : questionnaires de positionnement et satisfaction (à chaud/froid) avec envoi email + page publique, registre des réclamations, et export BPF annuel.

## Architecture

Trois sous-systèmes indépendants partageant la base Supabase existante. Les questionnaires reposent sur des tokens UUID publics (aucune auth requise pour répondre). Les réclamations sont un CRUD admin pur. L'export BPF agrège les données existantes côté client.

**Tech Stack :** React 18 + TypeScript + Vite, Supabase (PostgreSQL + Edge Functions), Resend (emails), `xlsx` (génération fichier côté client), Tailwind + Shadcn UI, Vitest + Testing Library.

---

## Subsystème 1 — Questionnaires

### Data Model

**Table `questionnaire_tokens`**

```sql
CREATE TYPE questionnaire_type AS ENUM (
  'positionnement',
  'satisfaction_chaud',
  'satisfaction_froid'
);

CREATE TABLE public.questionnaire_tokens (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token          uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  formation_id   uuid NOT NULL REFERENCES public.formations(id) ON DELETE CASCADE,
  stagiaire_id   uuid NOT NULL REFERENCES public.stagiaires(id) ON DELETE CASCADE,
  type           questionnaire_type NOT NULL,
  sent_at        timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  reponses       jsonb,
  UNIQUE(formation_id, stagiaire_id, type)
);
```

**RLS :**
- SELECT public par token (sans auth) — via Edge Function submit uniquement
- Accès complet aux rôles `administrateur` et `secretaire`
- Aucun accès direct en INSERT/UPDATE depuis le client — tout passe par Edge Functions

---

### Questions fixes

#### Positionnement d'entrée (10 questions)

| # | Libellé | Type de réponse |
|---|---------|-----------------|
| q1 | Quel est votre niveau d'expérience dans ce domaine ? | échelle 1–5 |
| q2 | Avez-vous déjà suivi une formation similaire ? | oui/non |
| q3 | Si oui, il y a combien de temps ? | texte libre |
| q4 | Quel est votre poste actuel ? | texte libre |
| q5 | Depuis combien d'années exercez-vous ce métier ? | texte libre |
| q6 | Quels sont vos objectifs principaux pour cette formation ? | texte libre |
| q7 | Quelles compétences souhaitez-vous développer en priorité ? | texte libre |
| q8 | Avez-vous des contraintes particulières (handicap, langue, etc.) ? | oui/non + texte libre |
| q9 | Comment avez-vous entendu parler de cette formation ? | texte libre |
| q10 | Quelles sont vos disponibilités et contraintes d'organisation ? | texte libre |

#### Satisfaction à chaud — fin de formation (11 questions)

| # | Libellé | Type de réponse |
|---|---------|-----------------|
| q1 | La formation a répondu à vos attentes. | échelle 1–5 |
| q2 | Les objectifs pédagogiques ont été atteints. | échelle 1–5 |
| q3 | Le contenu était adapté à votre niveau. | échelle 1–5 |
| q4 | Le formateur maîtrisait son sujet. | échelle 1–5 |
| q5 | Le formateur était disponible et à l'écoute. | échelle 1–5 |
| q6 | Les supports pédagogiques étaient clairs et utiles. | échelle 1–5 |
| q7 | La durée de la formation était adaptée. | échelle 1–5 |
| q8 | Les conditions d'accueil et le lieu étaient satisfaisants. | échelle 1–5 |
| q9 | Recommanderiez-vous cette formation à un collègue ? | oui/non |
| q10 | Qu'avez-vous le plus apprécié ? | texte libre |
| q11 | Qu'est-ce qui pourrait être amélioré ? | texte libre |

#### Satisfaction à froid — 30 j après (10 questions)

| # | Libellé | Type de réponse |
|---|---------|-----------------|
| q1 | Vous souvenez-vous des principaux apports de la formation ? | échelle 1–5 |
| q2 | Les compétences acquises sont utiles dans votre travail. | échelle 1–5 |
| q3 | Avez-vous pu mettre en pratique ce que vous avez appris ? | oui/non |
| q4 | À quelle fréquence appliquez-vous les acquis ? | jamais/parfois/souvent/toujours |
| q5 | Votre niveau a-t-il progressé grâce à cette formation ? | échelle 1–5 |
| q6 | Votre hiérarchie a-t-elle remarqué une évolution ? | oui/non/non applicable |
| q7 | Avez-vous rencontré des difficultés à appliquer les acquis ? | oui/non + texte libre |
| q8 | Avez-vous eu besoin d'un accompagnement supplémentaire ? | oui/non |
| q9 | La formation a eu un impact positif sur votre travail au quotidien. | échelle 1–5 |
| q10 | Avez-vous des suggestions pour améliorer la formation ? | texte libre |

Les questions sont hardcodées dans `src/lib/questionnaireQuestions.ts` — un objet exporté `QUESTIONS` indexé par `questionnaire_type`.

---

### Edge Functions

#### `send-questionnaire`

Appelée par l'admin depuis le détail d'une formation.

**Entrée :** `{ formation_id: string, stagiaire_ids: string[], type: questionnaire_type }`

**Logique :**
1. Vérifie auth + rôle `administrateur` ou `secretaire`
2. Pour chaque `stagiaire_id` :
   - Upsert dans `questionnaire_tokens` (conflit sur `formation_id, stagiaire_id, type`) → reset `sent_at`, garde `completed_at` si déjà complété
   - Récupère prénom/nom du stagiaire + titre de la formation
   - Envoie email via Resend avec lien `${SITE_URL}/q/${token}`
3. Retourne `{ sent: number }`

#### `submit-questionnaire`

Appelée depuis la page publique `/q/:token`, sans auth.

**Entrée :** `{ token: string, reponses: Record<string, unknown> }`

**Logique :**
1. Récupère le token depuis `questionnaire_tokens`
2. Si `completed_at` non null → retourne 409 "already completed"
3. Met à jour `reponses` + `completed_at = now()`
4. Retourne `{ ok: true }`

---

### Page publique `/q/:token`

Route : `/q/:token` — sans ProtectedRoute, sans auth.

**États :**
- Chargement : spinner
- Token invalide : message d'erreur + contact admin
- Déjà complété : "Merci, votre réponse a bien été enregistrée."
- Formulaire actif : affiche les questions du bon type, bouton "Envoyer"

**Composant :** `src/pages/QuestionnairePublic.tsx`

Les questions sont rendues selon leur `type` :
- `scale` → 5 boutons radio numérotés 1–5
- `boolean` → 2 boutons radio Oui/Non
- `select` → liste de choix radio
- `text` → `<textarea>`
- `boolean_text` → Oui/Non + textarea conditionnelle si Oui

Soumission → appel `submit-questionnaire` → affiche page de remerciement.

---

### Vue admin dans Formations.tsx

Dans le drawer/dialog de détail d'une formation, nouvel onglet **"Questionnaires"** :

- 3 lignes (une par type) avec : label, nombre envoyés, taux de complétion (ex. "8/12 — 67%")
- Bouton "Envoyer" par type → sélecteur de stagiaires (tous cochés par défaut) → appel `send-questionnaire`
- Si ≥ 3 réponses : bouton "Voir résultats" → dialog avec moyennes par question (questions numériques) + réponses texte listées

---

## Subsystème 2 — Registre réclamations

### Data Model

```sql
CREATE TYPE reclamation_demandeur_type AS ENUM ('stagiaire', 'entreprise', 'autre');
CREATE TYPE reclamation_statut AS ENUM ('ouverte', 'en_cours', 'cloturee');

CREATE TABLE public.reclamations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date_reclamation date NOT NULL DEFAULT CURRENT_DATE,
  demandeur_nom    text NOT NULL,
  demandeur_type   reclamation_demandeur_type NOT NULL,
  objet            text NOT NULL,
  description      text NOT NULL,
  statut           reclamation_statut NOT NULL DEFAULT 'ouverte',
  reponse          text,
  date_cloture     date,
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

**RLS :** accès complet aux rôles `administrateur` et `secretaire` uniquement.

---

### Interface admin

**Nouvelle page `/reclamations`** (`src/pages/Reclamations.tsx`) dans le menu latéral, icône `MessageSquareWarning`.

**Liste :**
- Tableau trié par `date_reclamation DESC`
- Colonnes : Date | Demandeur | Type | Objet | Statut (badge coloré : rouge=ouverte, orange=en_cours, vert=cloturee)
- Filtre par statut (tous / ouvertes / en cours / clôturées)
- Bouton "Nouvelle réclamation"

**Dialog création :**
- Champs : date, nom demandeur, type demandeur, objet, description
- Statut = `ouverte` automatiquement

**Dialog édition (clic sur une ligne) :**
- Tous les champs éditables
- Champ "Réponse apportée"
- Bouton "Clôturer" → `statut = cloturee`, `date_cloture = today`

**Badge dans le menu latéral :** nombre de réclamations `ouverte` (affiché en rouge si > 0).

---

## Subsystème 3 — Export BPF

### Migration

```sql
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS prix_ht NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.formations ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(5,1) DEFAULT 0;
```

Champs `prix_ht` et `duration_hours` ajoutés au formulaire de création/édition de formation (dans `Formations.tsx`).

### Agrégation

Dans la page `/statistiques` existante, nouveau bloc **"Export BPF"** :

**Sélecteur d'année** (défaut : année en cours).

**Données agrégées depuis Supabase (requêtes côté client) :**

| Rubrique | Requête |
|---|---|
| Nombre d'actions de formation | `COUNT(*)` sur `formations` filtrée par année (`start_date`) |
| Nombre de stagiaires formés | `COUNT(DISTINCT stagiaire_id)` sur `formation_participants` jointure `formations` |
| Nombre d'heures stagiaires | `SUM(f.duration_hours × participants_count)` — calculé JS après fetch |
| Chiffre d'affaires formation | `SUM(prix_ht)` sur `formations` |
| Nombre de formateurs actifs | `COUNT(DISTINCT formateur_id)` sur `formations` (formateur_id direct sur la table) |
| Taux de satisfaction moyen | moyenne des scores numériques `questionnaire_tokens.reponses` type `satisfaction_chaud` |
| Taux de complétion questionnaires | `completed_at IS NOT NULL` / total par type |

**Aperçu à l'écran** : tableau récapitulatif avant téléchargement.

**Bouton "Télécharger BPF (.xlsx)"** : génération côté client avec la lib `xlsx` (SheetJS). Un seul onglet, format compatible Cerfa 10443.

---

## Routing

```tsx
// Public — sans auth
<Route path="/q/:token" element={<QuestionnairePublic />} />

// Protégé — dans le bloc ProtectedRoute > AppLayout existant
<Route path="/reclamations" element={<Reclamations />} />
```

`/q/:token` est public (pas de ProtectedRoute). `/reclamations` s'intègre dans le bloc ProtectedRoute/AppLayout existant comme les autres pages admin.

---

## Tests

- `QuestionnairePublic` : token invalide, déjà complété, rendu questions, soumission
- `Reclamations` : liste, filtres, création, clôture
- `BPF` : agrégation avec données mockées, structure du fichier xlsx
- `send-questionnaire` Edge Function : auth check, upsert, envoi Resend
- `submit-questionnaire` Edge Function : token valide, déjà complété (409), écriture réponses

# Accès Stagiaire — Design Spec

## Goal

Créer automatiquement un compte Supabase Auth pour chaque stagiaire inscrit à une formation, lui envoyer ses identifiants par email, et gérer une fenêtre d'accès de J (début formation) à J+15 (fin formation).

## Architecture

Quand un stagiaire est ajouté à une formation via `saveManage` dans `Formations.tsx`, une Edge Function `create-stagiaire-account` est appelée. Elle génère un mot de passe mémorisable, crée le compte Supabase Auth avec le service role key, assigne le rôle `stagiaire` dans `user_roles`, lie le compte à la fiche stagiaire via `stagiaires.auth_user_id`, et envoie un email de bienvenue via Resend.

La fenêtre d'accès est vérifiée côté client dans `EspaceStagiaire.tsx` après login : les formations ne sont affichées que si elles sont dans leur fenêtre active (`start_date <= aujourd'hui <= end_date + 15j`). Si aucune formation n'est active, le stagiaire voit un message adapté plutôt que le dashboard. Le login Supabase reste toujours possible — la restriction est applicative, pas au niveau Auth.

**Tech Stack :** React 18 + TypeScript + Vite, Supabase (PostgreSQL + Edge Functions + Auth), Resend (email), Tailwind + Shadcn UI, Vitest + Testing Library.

---

## Data Model

### Migration : `auth_user_id` sur `stagiaires`

```sql
ALTER TABLE public.stagiaires
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
```

Permet de savoir si un stagiaire a déjà un compte Auth, et d'éviter la création en double.

### Tables existantes utilisées

- `stagiaires` : `id`, `first_name`, `last_name`, `email`, `auth_user_id` (nouveau)
- `formations` : `id`, `title`, `start_date`, `end_date`
- `formation_participants` : `formation_id`, `stagiaire_id`
- `user_roles` : `user_id`, `role` — rôle `stagiaire` déjà supporté

---

## Edge Function `create-stagiaire-account`

**Appelée par :** `saveManage` dans `Formations.tsx`, pour chaque nouveau participant ajouté.

**Auth :** requiert un header `Authorization` avec le token admin/secrétaire (même pattern que `send-questionnaire`).

**Entrée :** `{ stagiaire_id: string, formation_id: string }`

**Logique :**

1. Vérifie auth + rôle `administrateur` ou `secretaire`
2. Récupère le stagiaire (`first_name`, `last_name`, `email`, `auth_user_id`)
3. Si `email` absent → retourne `{ skipped: true, reason: "no_email" }`
4. Si `auth_user_id` déjà renseigné → retourne `{ skipped: true, reason: "already_exists" }` (pas de recréation)
5. Génère mot de passe : prénom avec 1ère lettre majuscule + 4 chiffres aléatoires → ex. `Jean4821`. Formule : `capitalize(first_name) + Math.floor(1000 + Math.random() * 9000)`. Min 8 chars garanti si prénom ≥ 4 chars ; si prénom < 4 chars, complète avec des chiffres supplémentaires.
6. Crée le compte Auth : `adminClient.auth.admin.createUser({ email, password, email_confirm: true })`
7. Assigne le rôle : insert dans `user_roles` (`user_id`, `role: 'stagiaire'`)
8. Met à jour `stagiaires.auth_user_id = userId`
9. Récupère la formation (`title`, `start_date`)
10. Envoie email via Resend :
    - From : `FROM_EMAIL`
    - To : email stagiaire
    - Subject : `Votre accès formation — [titre formation]`
    - Body HTML : prénom, email, mot de passe, lien vers l'app, dates de formation, note "changez votre mot de passe à la première connexion"
11. Retourne `{ ok: true, user_id: userId }`

**Gestion d'erreurs :** si `createUser` échoue (email déjà utilisé dans Auth mais `auth_user_id` null → compte orphelin), tente de récupérer l'utilisateur existant via `listUsers` filtré par email, puis relie.

---

## Modifications `Formations.tsx`

Dans `saveManage`, après l'insert réussi dans `formation_participants` pour chaque nouveau stagiaire (`toAdd`), appeler `create-stagiaire-account` en parallèle :

```tsx
await Promise.all(
  toAdd.map((sid) =>
    fetch(`${SUPABASE_URL}/functions/v1/create-stagiaire-account`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({ stagiaire_id: sid, formation_id: manageFormation.id }),
    })
  )
);
```

Les erreurs de création de compte sont silencieuses côté UI (le participant est bien inscrit même si l'email échoue) — un `console.error` suffit.

---

## Fenêtre d'accès dans `EspaceStagiaire.tsx`

### Logique

Après chargement des formations du stagiaire, calculer pour chacune si elle est dans la fenêtre active :

```ts
const isActive = (f: Formation) => {
  const today = new Date();
  const start = new Date(f.start_date);
  const end = new Date(f.end_date ?? f.start_date);
  end.setDate(end.getDate() + 15);
  return today >= start && today <= end;
};
```

### États

- **Au moins une formation active** → affichage normal du dashboard (seulement les formations actives)
- **Toutes futures** → page "Votre accès ouvrira le [date la plus proche]"
- **Toutes expirées** → page "Votre accès a expiré. Contactez votre organisme de formation."
- **Aucune formation** → page "Aucune formation associée à votre compte."

Ces états remplacent le contenu principal, pas le layout — le header et le bouton de déconnexion restent visibles.

---

## Onglet Paramètres dans `EspaceStagiaire.tsx`

Nouveau tab "Paramètres" dans la navigation de l'espace stagiaire.

**Contenu :**
- Section "Changer mon mot de passe"
- Champ "Nouveau mot de passe" (min 8 caractères)
- Champ "Confirmer le mot de passe"
- Bouton "Enregistrer"
- Appel : `supabase.auth.updateUser({ password: newPassword })`
- Toast succès/erreur

Pas de champ "mot de passe actuel" — Supabase Auth ne le requiert pas pour `updateUser` avec session active.

---

## Mobile

L'EspaceStagiaire doit être utilisable sur téléphone :

- Vérifier que le conteneur principal utilise `max-w-full` ou `w-full` sur petits écrans
- Boutons tactiles : `min-h-[44px]` sur les éléments cliquables
- Navigation entre tabs : scrollable horizontalement sur mobile si trop d'onglets
- Formulaire changement de mot de passe : inputs pleine largeur, labels au-dessus
- La session Supabase est persistante par défaut (`persistSession: true`) — le stagiaire reste connecté entre les ouvertures du navigateur mobile

---

## Tests

- `create-stagiaire-account` Edge Function :
  - email absent → `skipped: no_email`
  - `auth_user_id` déjà présent → `skipped: already_exists`
  - création réussie → `ok: true`
  - auth check → 401 sans header, 403 si pas admin/secrétaire

- `EspaceStagiaire.tsx` :
  - formation active → dashboard visible
  - formation future → message "ouvrira le"
  - formation expirée → message "a expiré"
  - onglet Paramètres → formulaire changement mot de passe présent

- `Formations.tsx` `saveManage` :
  - appelle `create-stagiaire-account` pour chaque nouveau participant

---

## Routing

Pas de nouvelle route. L'EspaceStagiaire est déjà accessible via son URL existante. Le login se fait via la page Auth existante (`/auth`).

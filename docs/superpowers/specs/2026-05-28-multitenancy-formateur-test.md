# Spec — Fondation multi-tenant + accès formateur (phase test)

**Date :** 2026-05-28
**Contexte :** Phase de test avec un premier formateur réel et ses élèves. Pose les bases du futur SaaS multi-organismes sans bloquer le lancement du test.

---

## Objectifs

1. Permettre à un formateur de créer, modifier et soft-supprimer des stagiaires depuis son espace
2. Donner à l'admin une visibilité totale (corbeille + audit)
3. Poser `organisme_id` sur les tables clés pour ne pas avoir à refactorer au moment du passage en SaaS
4. Ne rien casser dans le workflow admin existant

**Note future :** En production SaaS, seul l'admin du centre de formation pourra créer/modifier des stagiaires. Les formateurs perdront ce droit. Le design ci-dessous anticipe ce changement sans l'implémenter maintenant.

---

## Section 1 — Base de données

### 1.1 Colonne `organisme_id`

Ajoutée sur les tables : `stagiaires`, `formations`, `formateurs`, `formation_participants`.

- Type : `UUID REFERENCES public.organismes(id)`
- Nullable pour la migration (les lignes existantes reçoivent l'ID de l'organisme par défaut créé automatiquement)
- Table `organismes` : `id`, `nom`, `slug`, `plan` (free/medium/total), `created_at`
- Un seul organisme existe pendant la phase test — pas d'UI de gestion d'organismes

### 1.2 Soft delete sur `stagiaires`

Deux colonnes ajoutées :
- `deleted_at TIMESTAMPTZ` — null = actif, non-null = archivé
- `deleted_by UUID REFERENCES auth.users(id)` — qui a déclenché la suppression

Les RLS existants sont mis à jour : les formateurs ne voient que les lignes où `deleted_at IS NULL`. L'admin voit tout.

### 1.3 Table `audit_log`

```
id          UUID PK
organisme_id UUID REFERENCES organismes(id)
user_id     UUID REFERENCES auth.users(id)
user_role   TEXT
action      TEXT  -- 'create' | 'update' | 'delete' | 'restore'
table_name  TEXT  -- 'stagiaires' | 'formations' | ...
record_id   UUID
payload     JSONB -- snapshot des champs modifiés
created_at  TIMESTAMPTZ DEFAULT now()
```

Alimentée côté application (insert explicite à chaque opération formateur). Pas de trigger pour garder la logique visible et contrôlable.

---

## Section 2 — Permissions (RLS)

### Formateur — ce qu'il peut faire

| Opération | Condition |
|-----------|-----------|
| SELECT stagiaires | `deleted_at IS NULL` ET même `organisme_id` |
| INSERT stagiaires | `organisme_id` assigné automatiquement depuis son profil |
| UPDATE stagiaires | Créé par lui (`created_by = auth.uid()`) OU inscrit dans une de ses formations |
| Soft-delete | Même condition que UPDATE — met `deleted_at` + `deleted_by` |
| Hard-delete | Interdit (pas de politique DELETE pour le rôle formateur) |

### Admin — ce qu'il voit en plus

- Tous les stagiaires y compris `deleted_at IS NOT NULL`
- Toutes les lignes de `audit_log`
- Peut hard-delete (définitif) ou restaurer (remet `deleted_at` à null)

### Isolation inter-organismes

Toutes les politiques incluent `organisme_id = get_user_organisme_id()` (fonction helper qui lit l'organisme du profil connecté). Un formateur d'un organisme A ne peut jamais voir les données d'un organisme B.

---

## Section 3 — Interface formateur

### Nouvel onglet "Mes stagiaires"

Position dans la sidebar : entre "Mes formations" et "Cours".

**Vue liste :**
- Tous les stagiaires créés par ce formateur + ceux inscrits dans ses formations
- Colonnes : Nom, Prénom, Date de naissance, Ville, Email, Statut
- Bouton "Nouveau stagiaire" (coin haut droit)
- Icône crayon (modifier) + icône corbeille (archiver) sur chaque ligne

**Formulaire de création/édition :**
Champs : prénom\*, nom\*, date de naissance\*, email, téléphone, adresse, ville, code postal, notes
(\* = obligatoire)

**Suppression :**
- Confirmation : "Ce stagiaire sera archivé. L'administrateur pourra le restaurer si besoin."
- Pas de suppression définitive possible côté formateur

**Inscription rapide :**
Après création d'un stagiaire, proposer directement de l'inscrire dans une des formations du formateur.

---

## Section 4 — Interface admin

### Onglet "Archivés" dans la page Stagiaires

- Séparé de la liste active par un onglet (Actifs / Archivés)
- Colonnes supplémentaires : "Archivé le", "Archivé par"
- Bouton "Restaurer" → remet `deleted_at` à null + log dans audit_log
- Bouton "Supprimer définitivement" → confirmation en deux étapes, suppression réelle

### Section "Activité" (audit log)

- Accessible depuis le tableau de bord admin ou un onglet dans Stagiaires
- Format : `[Photo/initiales] Prénom Nom · action · il y a Xh`
- Filtres : par formateur, par type d'action, par date
- Pas de pagination complexe pour la phase test — les 100 dernières actions suffisent

---

## Ce qui n'est PAS dans cette spec

- UI de gestion des organismes (création, facturation, plans free/medium/total) → futur
- Invitation de nouveaux formateurs depuis l'espace formateur → futur
- Backup/serveur distant → futur
- Retrait des droits de création aux formateurs (SaaS prod) → futur, 1 ligne de migration

---

## Ordre d'implémentation suggéré

1. Migration : table `organismes` + colonne `organisme_id` + soft delete + `audit_log`
2. RLS mis à jour
3. Onglet "Mes stagiaires" dans EspaceFormateur
4. Onglets "Archivés" + "Activité" dans admin Stagiaires

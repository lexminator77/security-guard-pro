# Sprint 3 — Cycle de certifications stagiaires

**Date :** 2026-05-23
**Statut :** Approuvé

---

## Objectif

Implémenter le suivi du cycle de vie des certifications par stagiaire : création automatique depuis les formations validées, saisie manuelle pour les certifications externes, alertes multi-destinataires (90j / 30j / 7j) par email et in-app, et suggestion de sessions de recyclage disponibles.

---

## Périmètre

| Inclus | Exclu |
|--------|-------|
| Certifications auto depuis formations SecureCRM | Inscription automatique en recyclage (suggestion uniquement) |
| Certifications manuelles (externes) | SMS |
| Alertes email (stagiaire + admin + entreprise) | Passeport de Prévention |
| Notifications in-app avec cloche | Paiement en ligne |
| Suggestions de sessions recyclage | |
| Dashboard certifications espace stagiaire | |
| Onglet certifications fiche admin | |
| Amélioration page /rappels | |

---

## Types de certifications et durées de validité

| Type (`enum`) | Label | Durée de validité | Session de recyclage associée |
|---|---|---|---|
| `sst` | SST | 24 mois | `mac_sst` |
| `mac_sst` | MAC SST | 24 mois | `mac_sst` |
| `ssiap1` | SSIAP 1 | 36 mois | `ssiap1` |
| `ssiap2` | SSIAP 2 | 36 mois | `ssiap2` |
| `ssiap3` | SSIAP 3 | 36 mois | `ssiap3` |
| `tfp_aps` | TFP APS | 60 mois | `mac_aps` |
| `mac_aps` | MAC APS | 60 mois | `mac_aps` |
| `epi` | EPI / Extincteurs | 12 mois | `epi` |
| `h0b0` | H0B0 | 36 mois | `h0b0` |

---

## Modèle de données

### Table `certifications`

```sql
create table certifications (
  id uuid primary key default gen_random_uuid(),
  stagiaire_id uuid not null references stagiaires(id) on delete cascade,
  type text not null,                          -- enum ci-dessus
  date_obtention date not null,
  date_expiration date not null,
  source text not null default 'auto',         -- 'auto' | 'manuel'
  formation_id uuid references formations(id) on delete set null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(stagiaire_id, type)                   -- une seule certification active par type par stagiaire
);
```

**Contrainte `unique(stagiaire_id, type)` :** garantit qu'un stagiaire a au plus une certification active par type. Un recyclage réussi fait un `UPDATE` sur la ligne existante plutôt qu'un `INSERT`.

### Table `notifications`

```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  destinataire_id uuid not null,               -- stagiaire_id, formateur_id, ou admin user id
  destinataire_type text not null,             -- 'stagiaire' | 'admin' | 'entreprise'
  certification_id uuid references certifications(id) on delete cascade,
  type_alerte text not null,                   -- '90j' | '30j' | '7j' | 'expire'
  email_envoye boolean default false,
  lu boolean default false,
  created_at timestamptz default now()
);
```

---

## Trigger PostgreSQL — création automatique

La table réelle s'appelle `formation_participants`. Les colonnes concernées sont :
- `status` (enum PostgreSQL `participant_status` : `inscrit | present | absent | valide | echec`)
- `resultat` (texte : `en_attente | obtenu | a_repasser`)
- `formation_id` (FK vers `formations`)

Le trigger se déclenche quand `NEW.status = 'valide'` ET `NEW.resultat = 'obtenu'`. Il :

1. Joint `formations` via `formation_id` pour récupérer `type` et `end_date`
2. Calcule `date_obtention = formations.end_date`
3. Calcule `date_expiration = date_obtention + durée_type`
4. Fait un `INSERT ... ON CONFLICT (stagiaire_id, type) DO UPDATE` pour créer ou remplacer
5. Positionne `source = 'auto'` et `formation_id`

**Types de formation (enum `formation_type`, valeurs réelles) → certification créée :**

| Formation type (DB) | Certification créée |
|---|---|
| `SST` | `sst` |
| `MAC_APS` | `mac_aps` |
| `SSIAP1` | `ssiap1` |
| `SSIAP2` | `ssiap2` |
| `SSIAP3` | `ssiap3` |
| `H0B0` | `h0b0` |
| `APS` | `tfp_aps` |
| `AUTRE` | aucune certification créée |

Note : `EPI` n'existe pas encore dans l'enum `formation_type`. La certification `epi` ne sera créée que par saisie manuelle pour l'instant. L'ajout de `EPI` à l'enum est hors périmètre de ce sprint.

**Protection anti-boucle :** le trigger ne se déclenche que sur `UPDATE` des colonnes `status` et `resultat`, pas sur `INSERT` initial ou modifications non liées.

---

## Edge Function `check-expirations`

**Fichier :** `supabase/functions/check-expirations/index.ts`

**Déclenchement :** HTTP POST (appelée par GitHub Actions chaque matin à 6h UTC)

**Algorithme :**

```
Pour chaque seuil [90, 30, 7] jours :
  1. Récupérer certifications où date_expiration = aujourd'hui + N jours (±12h)
  2. Pour chaque certification :
     a. Vérifier qu'une notification type_alerte='Nj' n'existe pas déjà → skip si oui
     b. Récupérer sessions disponibles du type recyclage correspondant
        (start_date dans les 90j, places disponibles)
     c. Insérer notification stagiaire
     d. Insérer notification admin (groupée par batch — une seule notification admin
        par exécution, pas une par certification)
     e. Si stagiaire.entreprise_id renseigné → insérer notification entreprise
     f. Envoyer email via Resend :
        - Stagiaire : email individuel avec liste sessions suggérées
        - Admin : email récap groupant toutes les expirations du jour
        - Entreprise : email récap des agents concernés
     g. Marquer email_envoye = true sur chaque notification

Pour certifications expirées aujourd'hui :
  Même logique avec type_alerte = 'expire'
```

**Gestion des erreurs :** chaque certification est traitée indépendamment dans un try/catch. Un échec d'envoi email ne bloque pas les autres. Les erreurs sont loggées dans la réponse de la fonction.

**Idempotence :** la vérification de doublon en étape 2a garantit qu'un rejeu du cron ne génère pas de doublons.

---

## GitHub Actions — cron quotidien

**Fichier :** `.github/workflows/check-expirations.yml`

```yaml
name: Check certification expirations
on:
  schedule:
    - cron: '0 6 * * *'   # 6h UTC = 7h ou 8h heure française selon DST
  workflow_dispatch:        # déclenchement manuel possible

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Call check-expirations Edge Function
        run: |
          curl -sf -X POST \
            "${{ secrets.SUPABASE_EDGE_FUNCTION_URL }}/check-expirations" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json"
```

**Secrets GitHub à configurer :** `SUPABASE_EDGE_FUNCTION_URL`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`

---

## Emails (Resend)

**Package :** `resend` (npm, free tier : 3 000 emails/mois, 100/jour)

### Email stagiaire
- **Objet :** "⚠️ Votre certification [SST] expire dans [30] jours"
- **Corps :** nom du stagiaire, type de certification, date d'expiration, liste des sessions de recyclage disponibles (titre, date, lieu), lien vers l'espace stagiaire

### Email admin
- **Objet :** "Certifications — [N] expirations dans les prochains jours"
- **Corps :** tableau récapitulatif groupé par seuil (90j / 30j / 7j), lien vers `/rappels`

### Email entreprise (si renseignée)
- **Objet :** "Certifications de vos agents — action requise"
- **Corps :** liste des agents concernés avec type et date d'expiration, lien vers l'espace entreprise (futur Sprint 5)

---

## Notifications in-app

### Composant `NotificationBell`
- Icône cloche dans le header global (Admin, Formateur, Stagiaire)
- Badge rouge avec le nombre de notifications non lues (`lu = false`)
- Dropdown au clic : liste des 10 dernières notifications, triées par `created_at DESC`
- Chaque item : icône type d'alerte, message court ("SST expire dans 30 jours"), date relative ("il y a 2h")
- Clic sur un item : marque `lu = true` + redirige vers la section concernée
- Supabase Realtime : souscription sur `notifications` filtrée par `destinataire_id` → badge mis à jour en temps réel

### Placement dans le header
Le composant est ajouté dans le header existant, à gauche du bouton de profil utilisateur, visible sur toutes les routes après authentification.

---

## Interface utilisateur

### Espace Admin — fiche stagiaire

Nouvel onglet **"Certifications"** dans la fiche stagiaire (à côté des onglets Documents, Compétences).

Contenu :
- Tableau des certifications avec colonnes : Type, Date obtention, Expire le, Statut (badge coloré), Source (auto/manuel), Actions (Modifier / Supprimer)
- Badges statut : 🟢 Valide (>90j) · 🟡 À renouveler (30–90j) · 🔴 Urgent (<30j) · ⛔ Expiré
- Bouton "Ajouter une certification externe" → dialog : sélecteur de type + date d'obtention (date_expiration calculée automatiquement et affichée)

### Espace Admin — page `/rappels`

Nouvel onglet **"Certifications stagiaires"** ajouté aux onglets existants.
- Même structure que l'onglet formateurs : liste triée par jours restants
- Filtre par type de certification
- Filtre par seuil (expiré / <30j / <90j / tout)
- Lien vers la fiche stagiaire

### Espace Stagiaire — section "Mes certifications"

Nouveau bloc dans le dashboard stagiaire, sous les formations en cours.
- Cartes par certification : titre, date d'expiration, badge coloré, jours restants
- Si session de recyclage disponible : encart "Session disponible" avec date, lieu, lien vers la section Formations
- Si aucune session disponible : mention "Contactez votre formateur pour planifier un recyclage"

---

## Ce qui ne change pas

- Le flux d'inscription aux sessions (la suggestion pointe vers la section Formations existante — pas d'inscription en un clic)
- Le modèle de données des formations et participants
- Les certifications formateurs déjà gérées dans `/rappels` (hors périmètre de ce sprint)
- La gestion CNAPS existante sur la fiche stagiaire (champs séparés, non remplacés)

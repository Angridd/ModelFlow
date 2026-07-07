# Phase 3 — Rendre MF indépendamment fidèle (méthodes vs recopie)

> Rédigé le 2026-07-07, après la Phase 2 (25/25 sur le compteur, calage ligne-à-ligne
> des 25 BP existants). **Objectif Phase 3 :** qu'un BP **construit de zéro dans MF**
> (sans fichier Excel source) reproduise fidèlement un BP, en donnant à MF une **méthode
> de calcul** pour les postes aujourd'hui simplement **recopiés** du fichier Excel.

## 1. Principe directeur — les deux usages cohabitent

Phase 2 a atteint 25/25 en **routant** (recopiant) les séries réellement appliquées de
`data/<N>.xlsm`. C'est exact au centime sur les Excel existants, mais un projet neuf
retombe sur des approximations. Phase 3 ajoute une **méthode** par poste, en **filet de
secours**, sans jamais retirer le routing :

- **Série routée présente** (cas *import Excel*) → on l'utilise. **Priorité absolue.**
- **Série absente** (cas *projet neuf construit dans MF*) → on applique la **méthode**.

Conséquence : **le 25/25 actuel n'est pas menacé** (le routing garde la priorité).

⚠️ **Nuance rétrocompat.** Aujourd'hui, série absente ⇒ *fallback plat approximatif*.
Phase 3 remplace ce fallback par la **méthode** (ex. MRA en paliers). C'est **voulu**
(c'est tout l'intérêt), mais ça **change le comportement par défaut** des scénarios sans
série routée. Décision d'implémentation (cf §7) : soit on accepte ce nouveau défaut (la
méthode est plus juste que l'ancien plat), soit on gate via un sélecteur de profil.

## 2. Stratégie de validation (la même vérité terrain qu'en Phase 2)

Les séries routées **sont** le BP → elles servent de vérité terrain pour valider les méthodes.
Pour chaque poste : **débrancher le routing** et vérifier que la **méthode seule** reproduit
le BP sur les 25 projets (`read_bp_matrix` → `seed_bp_reel` → `calibrate_all`, +
`compare_bp_project "<nom>" --full`). Si méthode ≈ série routée sur les 25 → la méthode
généralise aux projets neufs.

- **Cible centime** là où le poste est déterministe : **MRA paliers**, **démantèlement**.
- **Quelques % tolérés** là où le BP a des spécificités de site : **base des taxes**.

## 3. Ordre d'implémentation (du plus simple au plus dur)

1. **Démantèlement** (🟢 faible effort)
2. **MRA paliers** (🟢 faible effort — forme universelle déjà prouvée)
3. **Engagements** (🟡 moyen)
4. **TF/CFE** (🔴 base fragile — le vrai morceau)

---

## 4. Spec par poste

### 4.1 Démantèlement
- **Inputs** :
  - `demantelementEuroMWc` — coût en €/MWc (**défaut ≈ 10 000 €/MWc**, = les BP actuels).
  - `demantelementTiming` — enum : **`fin_de_vie` (défaut)** | `construction`.
- **Formule** :
  - `fin_de_vie` : coût total = €/MWc × MWc, **étalé également sur les années 25-29**, **non indexé**.
  - `construction` : provisionné en année 0.
- **Fallback** : si `demantelementKeuroByYear` (série routée r195) présente → l'utiliser ; sinon méthode.
- **Validation** : débrancher r195 → Total OPEX an25-29 ≈ BP sur les 25.

### 4.2 MRA (gros entretien / renouvellement onduleurs)
Bonne nouvelle : la **forme en paliers est universelle** (prouvée Phase 2, item 6), il ne
manque que le **niveau moyen**.
- **Ratios de paliers** (% de la moyenne 35 ans, à re-figer depuis le diagnostic item 6) :
  - an1-4 : **50,7 %** (garantie constructeur)
  - an5-8 : **93,0 %**
  - an9-11 : **135,3 %** (pic de renouvellement)
  - an12-18 : **93,0 %**
  - an19-35 : **109,9 %**
- **Inputs** :
  - `mraEuroKwc` — niveau **moyen** en €/kWc (**défaut ≈ 1,09**).
  - `mraProfil` — enum : **`paliers` (défaut)** | `plat` (rares sites type Mur-de-Sologne).
- **Formule** (`paliers`) : `mraKeuro(y) = mraEuroKwc × kWc × ratio_palier(y) × 1,02^(y-1) × flag_exploitation`.
- **Fallback** : `mraKeuroByYear` (série routée r189) présente → l'utiliser ; sinon méthode.
- **Validation** : débrancher r189 → ligne MRA ≈ BP sur les projets « Input ».

### 4.3 Engagements (provisions/charges récurrentes)
- **Input** : `engagementsKeuroAn1` — montant de l'**année 1** (ou défaut), **indexé 2 %/an**.
- **Formule** : `engagements(y) = base_an1 × 1,02^(y-1)`.
- **Fallback** : série routée (r199) présente → l'utiliser ; sinon méthode.
- **Note** : l'indexation naïve avait régressé des projets **existants** par compensation
  (Phase 1) — mais pour un projet **neuf**, c'est l'hypothèse de l'utilisateur, donc pas de
  souci. Les projets existants gardent le routing.

### 4.4 TF / CFE (taxes foncières & d'entreprise) — le morceau dur
Deux briques de difficulté **très différentes** :

**a) Les taux → facile (saisie utilisateur, défauts nationaux).**
- **TFPB** = `taux_commune` (+ `taux_departement` si ≠ 0) + `taux_EPCI` + `TSE` + `GEMAPI` + `TEOM`
- **CFE** = `taux_commune` + `taux_EPCI` + `TSE` + `GEMAPI` + `CCI`
- Formule : `TFPB = base_TFPB × Σ(taux TFPB)` ; `CFE = base_CFE × Σ(taux CFE)`.
- Chaque taux = input optionnel avec **défaut national**, remplaçable par la valeur réelle
  de la commune.

**b) La base (assiette) → le vrai travail.**
- **Input décisif** : booléen `achatTerrain` (oui/non) → sélectionne la méthode d'assiette :
  - `non` → **« appréciation directe »** (déjà calée sur Baugé/Sigoulès en Phase 2).
  - `oui` → **« comptable »** (×~2,5 ; base jugée *fragile* à reconstruire en Phase 2 —
    à implémenter proprement : bâtiments PTR/PDL, dénominateur MOD, taux terrain 0,04 vs 0,08).
- **Fallback** : `tfKeuroByYear` / `cfeKeuroByYear` (routées r191/r192) présentes → les
  utiliser ; sinon méthode (base × Σ taux).
- **Validation** : débrancher r191/r192 → TF/CFE ≈ BP (sites « comptable » = les plus durs).
- **Scraping des taux** : hors scope Phase 3. Amélioration future possible (open data
  collectivités), mais taux **annuels et par commune** → fragile ; on privilégie
  saisie + défauts.

---

## 5. Financing fees — rien à faire
La formule ×0,95 (7 composants) **est déjà la bonne méthode** et généralise. Le `0,8` de
Salbris était une **édition manuelle du fichier BP**, gérée par l'override `financingFeesKeuro`
(routing). Aucun travail Phase 3.

## 6. Récap : état par poste

| Poste | Méthode Phase 3 | Confiance | Effort |
|---|---|---|---|
| Démantèlement | €/MWc + timing (défaut an25-29) | 🟢 haute | faible |
| MRA | moyenne €/kWc × forme paliers universelle | 🟢 haute | faible |
| Engagements | base an1 × 1,02/an | 🟡 moyenne | moyen |
| TF/CFE (taux) | Σ des taux saisis (défauts nationaux) | 🟢 haute | faible |
| TF/CFE (base) | sélecteur achat terrain → 2 méthodes | 🔴 basse | élevé |
| Financing fees | ×0,95 (déjà correct) | ✅ — | — |

## 7. Points de décision restants (à trancher à l'implémentation)
1. **Rétrocompat du fallback** (§1) : nouveau défaut = méthode, ou opt-in via sélecteur de
   profil ? (impacte les scénarios existants sans série routée)
2. **Défauts nationaux des taux** : quelles valeurs par défaut retenir (TFPB/CFE moyens) ?
3. **UI** : où placer les nouveaux inputs dans les formulaires new/edit (regroupés par poste).

## 8. Rétrocompat & non-régression
- Aucun retrait de routing → **25/25 préservé** (à revérifier via `calibrate_all` à chaque étape).
- Nouveaux inputs Scenario optionnels (null-default) ; priorité systématique
  **série routée > méthode > défaut**.
- `npm run build` + `npx vitest run app/lib/finance` verts à chaque étape.

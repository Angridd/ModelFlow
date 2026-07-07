# Phase 3 — Rendre MF indépendamment fidèle (méthodes vs recopie)

> Rédigé le 2026-07-07, après la Phase 2 (25/25 sur le compteur, calage ligne-à-ligne
> des 25 BP existants). **Objectif Phase 3 :** qu'un BP **construit de zéro dans MF**
> (sans fichier Excel source) reproduise fidèlement un BP, en donnant à MF une **méthode
> de calcul** pour les postes aujourd'hui simplement **recopiés** du fichier Excel.
>
> **AVANCEMENT 2026-07-07 — tranche 1 FAITE : démantèlement (§4.1) + MRA paliers (§4.2).**
> Migration `add_phase3_methodes_dem_mra` (3 colonnes Scenario : `demantelementEuroMWc`,
> `demantelementTiming`, `mraProfil`), méthodes câblées dans `calculateOpexDetails` (+ poste
> CAPEX No D&A `demantelementProvisionKeuro` pour le timing « construction »), exposées aux
> formulaires new/edit (section « Démantèlement » + sélecteur « Profil MRA »). **Validation
> « méthode vs BP » (scripts/_audit_phase3_methode.ts, série routée débranchée) : écart 0,0000 €
> toutes années × tous projets** — démantèlement 25/25 (10 000 €/MWc exact partout), MRA paliers
> 24/25 (Mur-de-Sologne = 0,0000 € avec `mraProfil="plat"`, son enum dédié ; seul « écart » :
> Digoin, r189 = micro-série aberrante 1 €×an, max 69 €/an, déjà documentée read_bp_matrix).
> **Ratios de paliers EXACTS re-dérivés des données** (identiques à 1e-9 sur les 17 BP à paliers) :
> niveaux ∝ **6/11/16/13**, normalisés 35 ans (poids 414) → an1-4 = **210/414**, an5-8 & an12-18 =
> **385/414**, an9-11 = **560/414**, an19+ = **455/414** (les % du §4.2 étaient des arrondis).
> **Non-régression : calibrate_all = 25/25 VERT** (le routing garde la priorité) ; build +
> 55 tests vitest verts (Digoin : `mraProfil="plat"` figé — son banc BP applique la MRA plate).
>
> **AVANCEMENT 2026-07-07 — tranche 2 FAITE : engagements (§4.3).** Migration
> `add_phase3_methode_engagements` (colonne Scenario `engagementsKeuroAn1` Float?), méthode
> `an1 × 1,02^(y−1)` câblée dans la boucle annuelle (P50 + P90), exposée aux formulaires new/edit
> (input optionnel sous la grille an-par-an). **PAS de défaut imposé** : l'an1/MWc des 25 BP varie
> de **369 à 9 586 €/MWc** (médiane ≈ 2 626, ratio ×26) — null → comportement actuel inchangé (0).
> Validation (scripts/_audit_phase3_engagements.ts) : la méthode ne reproduit le BP au centime sur
> **aucun** des 21 projets à engagements (Δ total −79 % à +384 %) — **attendu et documenté §4.3** :
> les séries r199 sont des échéanciers contractuels lumpy (an1 = pic, puis niveau récurrent plus
> bas + pointes périodiques), pas des séries indexées. La méthode reste le bon défaut déclaratif
> pour un projet neuf ; les existants gardent le routing. **Non-régression : 25/25 VERT**, build +
> 55 tests verts.
>
> **AVANCEMENT 2026-07-07 — tranche 4 FAITE : TF/CFE (§4.4) → PHASE 3 COMPLÈTE (4/4).**
> Migration `add_phase3_taxes` (3 colonnes Scenario : `prixAchatTerrainEuro`, `methodeAssiette`,
> `tauxTFDepartement`). Sélecteur d'assiette **AUTO + override** (§7.2) câblé dans
> `calculateTaxesFoncieres` (nouvelle branche `calculateTaxesMethodeAssiette`, active dès qu'un
> des 2 nouveaux champs est non-null — sinon branche legacy STRICTEMENT inchangée) ; formules
> template décodées au centime (assiette directe J354 avec terrain à **4 %**, assiette comptable
> J302/J304/J323, frais 3 %/9 %/**8 % TEOM**, frais CFE comptable **134,8827 € en dur** J331).
> **Validation « méthode vs BP » (scripts/_audit_phase3_taxes.ts, série routée débranchée, taux
> lus de chaque xlsm) : 23/25 AU CENTIME sur an1-35 en AUTO** (max|Δ| = 0,0000 €), dont Baugé
> (TF an1 7 474,84 €), Sigoulès (7 185,14 €) en directe et Selles (TF 9 084,52 € / CFE
> 4 927,35 €) en comptable. Les 2 écarts AUTO tombent à **0,0000 € avec l'override** aligné sur
> le choix du BP : **Digoin** (MISMATCH ATTENDU — BP en directe par ERREUR malgré terrain acheté
> 545 970 € ; en AUTO, MF est PLUS correct que l'Excel) et **Salbris** (cas inverse découvert par
> l'audit : I266 forcé « Comptable seule si achat » alors que prix d'achat = 0 → l'override
> `methodeAssiette="comptable"` couvre ce choix). **Non-régression : calibrate_all = 25/25 VERT**
> (routing r191/r192 prioritaire), build + 37 tests vitest finance verts.

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

1. ✅ **Démantèlement** (FAIT 2026-07-07)
2. ✅ **MRA paliers** (FAIT 2026-07-07)
3. ✅ **Engagements** (FAIT 2026-07-07)
4. ✅ **TF/CFE** (FAIT 2026-07-07 — assiette décodée au centime, sélecteur AUTO + override)

**→ PHASE 3 COMPLÈTE (4/4).**

---

## 4. Spec par poste

### 4.1 Démantèlement ✅ FAIT (2026-07-07)
> Implémenté tel que spécifié. Défaut 10 000 €/MWc **vérifié EXACT sur les 25 BP** (total
> C_P50 r195 / MWc = 10 000,00 partout, étalé an25-29 non indexé). Méthode = série r195 à
> **0,0000 €** toutes années sur les 25 projets (audit). Timing « construction » → poste CAPEX
> No D&A `demantelementProvisionKeuro` (année 0, non amorti, inactif si série routée présente).

- **Inputs** :
  - `demantelementEuroMWc` — coût en €/MWc (**défaut ≈ 10 000 €/MWc**, = les BP actuels).
  - `demantelementTiming` — enum : **`fin_de_vie` (défaut)** | `construction`.
- **Formule** :
  - `fin_de_vie` : coût total = €/MWc × MWc, **étalé également sur les années 25-29**, **non indexé**.
  - `construction` : provisionné en année 0.
- **Fallback** : si `demantelementKeuroByYear` (série routée r195) présente → l'utiliser ; sinon méthode.
- **Validation** : débrancher r195 → Total OPEX an25-29 ≈ BP sur les 25.

### 4.2 MRA (gros entretien / renouvellement onduleurs) ✅ FAIT (2026-07-07)
> Implémenté avec les **fractions exactes re-dérivées des séries** (r189 dé-indexée ÷ moyenne,
> identiques à 1e-9 sur les 17 BP « Input » à paliers — PAS les % arrondis ci-dessous).
> Niveaux ∝ 6/11/16/13, normalisés 35 ans (Σ poids = 414). Méthode = série r189 à **0,0000 €**
> toutes années sur les projets à paliers ; Mur-de-Sologne = 0,0000 € avec `mraProfil="plat"`.

Bonne nouvelle : la **forme en paliers est universelle** (prouvée Phase 2, item 6), il ne
manque que le **niveau moyen**.
- **Ratios de paliers** (fraction de la moyenne 35 ans — valeurs exactes figées en Phase 3) :
  - an1-4 : **210/414 ≈ 50,72 %** (garantie constructeur)
  - an5-8 : **385/414 ≈ 93,00 %**
  - an9-11 : **560/414 ≈ 135,27 %** (pic de renouvellement)
  - an12-18 : **385/414 ≈ 93,00 %**
  - an19-35 : **455/414 ≈ 109,90 %**
- **Inputs** :
  - `mraEuroKwc` — niveau **moyen** en €/kWc (**défaut ≈ 1,09**).
  - `mraProfil` — enum : **`paliers` (défaut)** | `plat` (rares sites type Mur-de-Sologne).
- **Formule** (`paliers`) : `mraKeuro(y) = mraEuroKwc × kWc × ratio_palier(y) × 1,02^(y-1) × flag_exploitation`.
- **Fallback** : `mraKeuroByYear` (série routée r189) présente → l'utiliser ; sinon méthode.
- **Validation** : débrancher r189 → ligne MRA ≈ BP sur les projets « Input ».

### 4.3 Engagements (provisions/charges récurrentes) ✅ FAIT (2026-07-07)
> Implémenté tel que spécifié, avec une décision de défaut : **input optionnel SANS défaut
> imposé**. Audit des 25 BP (scripts/_audit_phase3_engagements.ts, série r199) :
> - **an1/MWc trop variable pour un défaut sensé** : 369 → 9 586 €/MWc (ratio ×26), médiane
>   2 626 €/MWc, sur les 21 projets à engagements non nuls (Digoin an1 = 0, 3 Villeherviers
>   sans série). → `engagementsKeuroAn1` null → comportement actuel inchangé (0) ; l'ordre de
>   grandeur (≈ 370-9 590 €/MWc, médiane ≈ 2 630) est documenté dans l'UI plutôt qu'imposé.
> - **Méthode vs BP (série routée débranchée, an1 pris de r199)** : au centime sur **0/21**
>   projets — ATTENDU. Les séries BP sont des **échéanciers contractuels lumpy** (an1 = pic
>   souvent, puis niveau récurrent plus bas + pointes périodiques), pas des séries indexées :
>   Δ total 35 ans de **−79 %** (Avermes, an1 anormalement bas vs suite) à **+384 %** (Sigoulès,
>   an1-2 chargés puis chute à 12 % de l'an1) ; les plus proches : Baugé +9,4 %, Salbris +15,8 %,
>   Ychoux +30,2 %, Orval +33,4 %. La méthode reste le bon défaut DÉCLARATIF pour un projet
>   neuf (hypothèse simple de l'utilisateur) ; l'exactitude BP passe par la grille an-par-an.
> - Câblage : colonne `Scenario.engagementsKeuroAn1` (Float?, migration
>   `add_phase3_methode_engagements`), fallback dans la boucle annuelle (P50 ET P90), input
>   sous la grille an-par-an des formulaires new/edit, create/update/clone. **Priorité :**
>   `opexEngagementsKeuroByYear` (grille/r199) > méthode (an1 non null) > 0.
> - **Non-régression : calibrate_all 25/25 VERT** (routing prioritaire), build + 55 tests verts.

- **Input** : `engagementsKeuroAn1` — montant de l'**année 1** (SANS défaut), **indexé 2 %/an**.
- **Formule** : `engagements(y) = base_an1 × 1,02^(y-1)`.
- **Fallback** : série routée (r199) présente → l'utiliser ; sinon méthode si an1 saisi ; sinon 0.
- **Note** : l'indexation naïve avait régressé des projets **existants** par compensation
  (Phase 1) — mais pour un projet **neuf**, c'est l'hypothèse de l'utilisateur, donc pas de
  souci. Les projets existants gardent le routing.

### 4.4 TF / CFE (taxes foncières & d'entreprise) ✅ FAIT (2026-07-07)
> **Implémenté** (migration `add_phase3_taxes`) : colonnes Scenario `prixAchatTerrainEuro`
> (Float?), `methodeAssiette` (String? — override "comptable" | "appreciation_directe",
> null → AUTO) et `tauxTFDepartement` (Float? — compté EN PLUS du communal si ≠ 0). Nouvelle
> branche moteur `calculateTaxesMethodeAssiette` (engine.ts), déclenchée dès que
> `methodeAssiette` OU `prixAchatTerrainEuro` est non-null — sinon les branches taxes legacy
> (ancres Baugé/Sigoulès de calibration) restent STRICTEMENT inchangées. Formulaires new/edit :
> section « Taxes locales » (prix d'achat terrain — défaut 0 sur un projet NEUF → sélecteur
> AUTO actif d'emblée —, sélecteur AUTO/directe/comptable, taux département ; l'ancien select
> `methodeTaxes` devient un champ caché de rétrocompat). `read_bp_matrix`/`seed_bp_reel`
> INCHANGÉS (le routing r191/r192 garde la priorité absolue).
>
> **Décodage confirmé à l'implémentation (au centime)** :
> - Frais de gestion TF par composante (J312/J362) : **3 %** principales (commune + département
>   + EPCI + GEMAPI), **9 %** TSE, **8 % TEOM** (vérifié sur Selles/Sigoulès, TEOM 14 %/11,35 %).
> - Directe : terrain forfaitaire à **4 %** (taux LF simple, J349) × 0,256066 × 50 % — la branche
>   legacy (millésime Sigoulès antérieur, ancre 614,56 €) reste à 8 %, d'où la branche distincte.
> - CFE directe : s'applique sur la MÊME assiette que la TF (J354), frais 3 %/9 % (J394).
> - CFE comptable : assiette J323 = base × 4 % × (1−30 %), **SANS frais proportionnels**,
>   + **134,8827 € EN DUR** (J331, artefact template identique dans les 25 BP — reproduit,
>   appliqué seulement si Σ taux CFE > 0).
> - Base comptable J302 = prix d'achat + biens passibles hors terrain (J342 = les MÊMES
>   composants immos/MOD que la directe) — cohérence vérifiée sur les 25 fichiers par l'audit.
> - Indexation **2 %/an** dès l'an 2 (`inflationTaxes ?? 2` dans la branche méthode ; le défaut
>   legacy 0,4 est conservé sur la branche legacy).
>
> **Validation (scripts/_audit_phase3_taxes.ts — série routée débranchée, taux lus de chaque
> xlsm, comparaison C_P50 r191/r192 an1-35)** : **23/25 AU CENTIME en AUTO** (max|Δ| 0,0000 €),
> dont **Baugé** TF an1 = 7 474,84 € / CFE 4 005,11 € (directe), **Sigoulès** 7 185,14 € /
> 3 574,96 € (directe), **Selles** 9 084,52 € / 4 927,35 € (comptable). Les 2 écarts AUTO
> tombent à **0,0000 € avec l'override** aligné sur le choix du BP :
> - **Digoin** : MISMATCH ATTENDU (documenté ci-dessous) — BP resté en « Appréciation Directe »
>   malgré l'achat du terrain (545 970 €). En AUTO, MF choisit comptable = PLUS correct que
>   l'Excel. Son routing r191/r192 (qui reflète l'erreur) reste prioritaire en production.
> - **Salbris** (découvert par l'audit) : cas INVERSE — I266 forcé « Comptable seule si achat »
>   alors que prix d'achat = 0 (choix ou erreur du BP). L'override `methodeAssiette="comptable"`
>   reproduit son BP au centime. La « classification réelle » du § ci-dessous devient donc :
>   **3 BP en comptable** (Aérodrome, Selles = achat > 0 → AUTO correct ; Salbris = comptable
>   sans achat → override), 22 en directe.
> **Non-régression : calibrate_all 25/25 VERT** (routing prioritaire), build + tests verts.

Deux briques de difficulté **très différentes** :

**a) Les taux → facile (saisie utilisateur, défauts nationaux).**
- **TFPB** = `taux_commune` (+ `taux_departement` si ≠ 0) + `taux_EPCI` + `TSE` + `GEMAPI` + `TEOM`
- **CFE** = `taux_commune` + `taux_EPCI` + `TSE` + `GEMAPI` + `CCI`
- Formule : `TFPB = base_TFPB × Σ(taux TFPB)` ; `CFE = base_CFE × Σ(taux CFE)`.
- Chaque taux = input optionnel avec **défaut national**, remplaçable par la valeur réelle
  de la commune.

**b) La base (assiette) → le vrai travail. Décodée au centime (Baugé/Selles/Digoin, agent 2026-07-07).**

Localisation dans le BP : feuille `Inp_Matrice_O&M_Taxes` (libellés col. D, valeurs col. J).
Assiette appliquée = `J354` (directe) ou `J304` (comptable) ; montant final en `C_P50` r191 (TF) /
r192 (CFE). Sélecteur = **texte `Inp_Assumption!I266`** (« Appréciation Directe » | « Comptable seule
si achat »), routé par XLOOKUP vers les candidats J401/J402 (TF) et J405/J406 (CFE).

- **Règle métier (confirmée utilisateur) : achat de terrain → méthode COMPTABLE.** MF dérive donc
  la méthode du **prix d'achat du terrain** : `prixAchatTerrainEuro > 0` → `comptable` ; sinon →
  `appreciation_directe`. ⚠️ Le BP de **Digoin** est une **ERREUR de saisie** (terrain acheté
  545 970 € mais `Inp_Assumption!I266` laissé sur « Appréciation Directe ») → en dérivant de l'achat,
  **MF serait PLUS correct que l'Excel** (il éviterait ce bug). **Villognon** = terrain 0 € → directe,
  correct (pas un contre-exemple). Option d'override manuel `methodeAssiette` à décider (§7) pour
  d'éventuels cas exceptionnels.
- **Formule d'assiette = biens passibles × taux d'intérêt LF × abattement 50 %.** Deux méthodes :
  - `appreciation_directe` (**déjà calée Baugé/Sigoulès en Phase 2**) — `J354` = biens passibles
    (BOS + terrassement + bâtiments PTR/PDL + MOD retraité, `J342`) × **8 %** (taux LF **doublé**)
    × 50 % + terrain forfaitaire (ha × 5 000 €) × 4 % × 0,2561 × 50 %.
  - `comptable` (**à implémenter**) — `J304` = (**prix d'achat terrain** + immos non exonérées +
    MOD retraité, `J302`) × **4 %** (taux LF simple) × 50 %. Le prix d'achat pèse ~80 % de la base
    → assiette **×~2,5** vs directe.
- **Puis** `TFPB = assiette × Σ(taux TFPB)`. ⚠️ **En directe, la CFE s'applique sur la MÊME assiette
  TF (`J354`)** — le classeur calcule une assiette CFE dédiée mais ne l'utilise pas.
- **Classification réelle** : dans les BP existants, **seul Selles applique le comptable** ; **Digoin
  DEVRAIT l'être** (erreur Excel, cf ci-dessus) ; Baugé/Villognon = directe (pas d'achat). **À recenser
  sur les 25 selon le PRIX D'ACHAT du terrain (la règle), pas selon `I266`** (qui peut être erroné).
  ⚠️ Validation : la « méthode vs BP » de Digoin **mismatchera** (son BP calcule en directe par erreur)
  — c'est ATTENDU ; son routing r191/r192 reflète l'erreur et reste prioritaire pour ce projet existant.
- **Piège** : `J331` (frais de gestion CFE comptable) = **valeur en dur 134,88 €** (artefact template),
  à reproduire pour le centime en comptable.
- **Fallback** : `tfKeuroByYear` / `cfeKeuroByYear` (routées r191/r192) présentes → les utiliser ;
  sinon méthode (assiette × Σ taux).
- **Validation** : débrancher r191/r192 → TF/CFE ≈ BP.
- **Scraping des taux** : hors scope Phase 3 (taux annuels et par commune → fragile) ; saisie + défauts.

---

## 5. Financing fees — rien à faire
La formule ×0,95 (7 composants) **est déjà la bonne méthode** et généralise. Le `0,8` de
Salbris était une **édition manuelle du fichier BP**, gérée par l'override `financingFeesKeuro`
(routing). Aucun travail Phase 3.

## 6. Récap : état par poste

| Poste | Méthode Phase 3 | Confiance | Effort |
|---|---|---|---|
| Démantèlement | €/MWc + timing (défaut an25-29) | ✅ FAIT (0,0000 € vs BP, 25/25) | faible |
| MRA | moyenne €/kWc × forme paliers universelle | ✅ FAIT (0,0000 € vs BP + « plat » Mur-de-Sologne) | faible |
| Engagements | base an1 × 1,02/an (SANS défaut — an1/MWc ×26 entre BP) | ✅ FAIT (0/21 au centime, ATTENDU : séries BP lumpy — méthode = défaut déclaratif) | moyen |
| TF/CFE (taux) | Σ(taux saisis × frais 3 %/9 %/8 % TEOM) + taux département | ✅ FAIT (au centime — placeholders UI, pas de défaut national imposé) | faible |
| TF/CFE (base) | **auto** depuis prix d'achat terrain (+override) → directe/comptable | ✅ FAIT (23/25 au centime an1-35 en AUTO ; 25/25 avec override — Digoin/Salbris = choix BP hors règle) | élevé |
| Financing fees | ×0,95 (déjà correct) | ✅ — | — |

## 7. Points de décision restants (à trancher à l'implémentation)
1. ✅ **TRANCHÉ (tranche 1)** — **méthode = nouveau défaut** : la méthode remplace l'ancien
   fallback plat/zéro dès que la série routée est absente (`demantelementEuroMWc` null →
   10 000 €/MWc, `demantelementTiming` null → fin_de_vie, `mraProfil` null → paliers). Les
   scénarios existants sans série routée basculent sur la méthode (plus juste) ; l'opt-out
   existe par scénario via `mraProfil="plat"` / `demantelementEuroMWc=0`. Tests ancres
   restés verts (seul le banc Digoin fige explicitement `mraProfil="plat"`, = son BP).
2. ✅ **TRANCHÉ + IMPLÉMENTÉ (tranche 4)** — **méthode d'assiette = AUTO depuis le prix d'achat
   terrain + override** : `prixAchatTerrainEuro > 0` → comptable ; sinon appréciation directe ;
   l'utilisateur peut forcer via `methodeAssiette`. MF rattrape ainsi les erreurs de saisie type
   Digoin (BP en directe malgré achat). L'audit a montré le cas inverse (Salbris : comptable
   forcé SANS achat) → l'override couvre les deux sens. Déclenchement : un des deux champs
   non-null ; tous null → branche taxes legacy strictement inchangée (ancres de calibration).
3. ✅ **TRANCHÉ + IMPLÉMENTÉ (tranche 4)** — **Taux TF/CFE en saisie utilisateur** (taux existants
   + nouveau `tauxTFDepartement`), défauts = simples **placeholders** UI (ex. 0,28) — taux null →
   la composante ne contribue pas, AUCUNE dérivation « nationale » factice (leçon engagements).
4. ✅ **TRANCHÉ (tranche 4)** — **UI** : les nouveaux inputs vivent dans la section « Taxes
   locales (TF & CFE) » d'OpexDetailFields (prix d'achat terrain + sélecteur AUTO/directe/
   comptable en tête, taux département dans la grille TFPB) ; l'ancien select `methodeTaxes`
   est conservé en champ caché (rétrocompat des scénarios legacy).

## 8. Rétrocompat & non-régression
- Aucun retrait de routing → **25/25 préservé** (à revérifier via `calibrate_all` à chaque étape).
- Nouveaux inputs Scenario optionnels (null-default) ; priorité systématique
  **série routée > méthode > défaut**.
- `npm run build` + `npx vitest run app/lib/finance` verts à chaque étape.

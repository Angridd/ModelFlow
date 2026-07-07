# Phase 2 — Aligner la MÉTHODE de calcul MF sur les BP (en cours)

> **AVANCEMENT 2026-07-07 (ter) — items 9 + 10 FAITS. 🎯 25/25 maintenu, cascade équity calée
> ligne-à-ligne.** Deux commits couplés dans `applyWaterfall` (cascade P50) + le sizing P90 :
> - **Commit 1 — cascade P50 (items 9a + 10a/b/c)** : (a) **SEED du cumEBT an0** = −intérêts SHL
>   capitalisés (`ccaPrincipal − ccaDrawdown`), sur `cumEbtP50` ET un nouveau tracker
>   `retainedEarnings` → l'IS bascule à l'année BP (déficit fiscal cumulé Sigoulès = BP à l'euro).
>   La mine « no-seed » (ancienne note G5) est **RÉFUTÉE** : le seed est UNIVERSEL, vérifié sur les
>   25 fichiers (C_P50 r243an1 − r242an1 = r243an0 = −r289an0). (b) **DSRA RETIRÉE** de la cascade
>   P50 (le BP ne finance aucune réserve : r296 == r268 sur les 25) → champs dsra* = 0,
>   `dsraInitialKeuro` du double-TRI intact. (c) **Capitalisation** des intérêts SHL P50 impayés
>   (r289 an1+ ≠ 0 sur les projets cash-tight). (d) **Dividendes plafonnés** aux bénéfices
>   distribuables (r311) ; excédent → nouveau champ `cashPoolingKeuro` (r319). **Résultat** : dette
>   au centime inchangée ; TRI investisseur bouge TOUJOURS vers le BP (Orval 5,95→**6,07 = BP** ;
>   Digoin 5,68→**5,82 = BP** ; Sigoulès 7,31→**7,33 = BP** ; Villeherviers-LG 5,83→6,01) ;
>   dividendes/pooling Orval exacts à l'euro. Oracle `_audit_910f` : Δréel == Δsim sur les 25.
> - **Commit 2 — seed P90 (item 9b, touche la DETTE)** : `cumEbtP90` seedé pareil → l'IS de sizing
>   bascule à l'année BP sur les 4 projets P90-taxés. **Dette recalée VERS le BP** : Salbris
>   −0,5→**−0,1 %** (TRI Δ−0,57→**−0,07 pp**), Villognon −0,1→−0,0 %, Baugé −0,2→−0,1 %, Ychoux
>   TRI Δ−0,19→−0,04. Les 20 projets à IS_P90 = 0 : dette **strictement inchangée** (au k€). Ancres
>   `calibration_sigoules` (IS an24 134 900 no-seed → **133 006 = cible BP**) et `calibration_digoin`
>   (fiche P90-taxée : dette +1 450 € / +0,046 %, dans la bande de bruit ; le Digoin de PORTEFEUILLE
>   data/3.xlsm a IS_P90 = 0 → dette exactement sur le BP) mises à jour. 37 tests finance verts.
>   Résidus Salbris/Villognon an14-24 = **item 1** (queue merchant P90), hors périmètre 9/10.

> **AVANCEMENT 2026-07-07 (bis) — item 1 FAIT (queue merchant P90 du sizing).** Le blend
> Debt Sizing Curve est désormais LU du BP (« Inp_Curve price » r47 central / r48 low, col H,
> `buildGroundTruthBySlug`) au lieu du 0,7/0,3 codé en dur. **Salbris = 1,0/0,0 (central pur)**
> — **2e édition manuelle de son fichier après le financing fee 0,8** (item 11) ; les 24 autres
> BP = 0,7/0,3 exact (round6) → strictement inchangés (calibrate_all bit-à-bit identique,
> Sigoulès/Baugé témoins). Salbris : dette Δ−0,49 → **−0,11 %**, TRI inv Δ−0,57 → **−0,11 pp**,
> Revenus P90 (sizing) an21+ −4,7/−6,4 % → **0,00 %** → VERT franc (plus besoin du plancher de
> bruit). Compteur 25/25 conservé. Fix d'EXTRACTION seul (read_bp_matrix → seed_bp_reel →
> colonnes `Project.debtSizingCentralW/LowW` existantes) — engine.ts intouché. Investor curve
> (r55/r56) lue en défensif (log si ≠ 1/0) mais non routée : 1,0/0 partout, P50 déjà juste.
>
> **AVANCEMENT 2026-07-07 — 🎯 25/25 calés, 0 rouge.** Item **11** (financing fees = valeur
> RÉELLEMENT APPLIQUÉE, Inp_Assumption r548) fait : **Salbris ROUGE→VERT** (CAPEX Δ+0,59 % →
> **0,00 %**, TRI inv Δ−1,22 → **−0,57 pp**, dans la bande de bruit 0,7 pp). Le BP de Salbris a
> un facteur **0,8 codé en dur** dans sa formule de fees (édition manuelle, unique sur les 34
> fichiers) → 610,4 k€ appliqués vs 720,2 k€ recalculés par la formule template ×0,95 (qui reste
> correcte ailleurs → on route la valeur appliquée par projet au lieu de toucher
> `calculateFinancingFees`). Témoins : Sigoulès Δ−0,04 → −0,02 pp, Baugé inchangé (−0,08 pp) ;
> aucun projet dégradé (le CAPEX passe à ~0,00 % sur les 25). L'item **1** (queue merchant P90
> an21+, dette Salbris −0,49 %/TRI −0,57 pp résiduels) reste OPTIONNEL pour le ligne-à-ligne
> dette — plus nécessaire au compteur.
>
> Rédigé le 2026-07-05. État de départ : **22/25 projets calés** (dette/CAPEX/TRI) après
> Phase 1 (corrections d'extraction, commit `61a0969`). Objectif Phase 2 : que MF reproduise
> le BP **ligne à ligne, année par année**, sur les 25 projets — ce qui calera aussi la VAN
> brute à l'euro et les 3 derniers rouges (Golf de Baugé, Selles-sur-Cher 1, Villognon).
>
> **AVANCEMENT 2026-07-06 (soir) — 24/25 calés, items 2/3/4/5/6/7/8 FAITS.** Items **5**
> (engagements, commit `c58153a`), **4** (TF/CFE, commit `d0c2655`), **8** (CFADS de
> dimensionnement net de l'IS P90, commit `6c33c89`), **7** (D&A — dotation ligne-à-ligne ✓ sur
> les 25), **3** (assurance — bug d'AFFICHAGE bpModel uniquement, moteur déjà juste, commit
> `58fd8f7`), **2** (démantèlement an25-29, commit `b53e163`) et **6** (MRA en paliers, commit
> `674dee5`) faits. **MRA + Démantèlement + Total OPEX = 0,00 % ligne-à-ligne sur LES 25.**
> **Ychoux ROUGE→VERT** (item 6 : TRI inv Δ−0,83 → −0,19 pp). Reste **Salbris** (Δ−1,22 pp :
> timing IS item 9 + CAPEX +0,59 % pré-existant). La compensation redoutée sur Baugé/Selles n'a
> PAS eu lieu (Baugé Δ−0,18 → −0,08 pp, Selles inchangé — tous deux VERTS).
>
> **Item 8 — RECLASSÉ : le driver N'EST PAS le blend merchant, c'est l'IS déduit du CFADS de
> sizing.** Le blend 0,7 central / 0,3 low est EXACT (prix MF = prix BP au centime, hypothèse
> « Low pur en queue » RÉFUTÉE). Le vrai mécanisme BP (vérifié à l'euro sur data/<N>.xlsm :
> C_P90 r260 = r226 EBITDA + r244 IS = C_Financing r80/r84) : `CFADS_sizing(y) = EBITDA_P90(y) −
> IS_P90(y)`, `IS_P90 = 25% × max(0, min(EBT_P90, cumEBT_P90))`, report déficitaire intégral.
> EBT_P90 = EBITDA_P90 − D&A − intérêts dette sizée − **intérêts SHL du cas P90** (waterfall dédié,
> capitalisés/croissants) − DSRF − agent fee. Câblé dans `applyWaterfall` (P&L P90 + cascade SHL P90)
> et `resolveCfadsSizingKeuro` ; point fixe IS↔dette dans la boucle de sizing (convergence **2-7
> itérations** selon le projet). **Résultat :**
> • **Villognon** ROUGE→VERT : IS_P90 calé à **±1 €** vs BP (an20-24), dette 16 157 = BP (0,00 %).
> • **Golf de Baugé** ROUGE→VERT : dette −0,3 %, TRI inv Δ−0,18 pp.
> • Les 8 projets « verts » à SHL couvrant restent à IS_P90 = 0 (cumEBT P90 négatif tout le ténor).
>
> **Restent 2 rouges — NOUVEAUX, pilotés par l'item 7 (D&A), pas par l'item 8** (cas de compensation
> classique : l'item 8 a retiré l'erreur « pas d'IS de sizing » qui masquait l'écart D&A) :
> • **Ychoux** TRI inv Δ−1,80 pp : dette −0,4 % (2,96 k€/MW, DANS le bruit) mais gearing 95 % → équity
>   à 5 % du CAPEX amplifie tout écart. Cause = **D&A MF −2,6 % vs BP** (359,9 vs 369,6 k€/an) → cumEBT
>   P90 franchit le seuil un an trop tôt → sur-taxation an17. intérêts SHL = 0 des deux côtés (pur D&A).
> • **Salbris** TRI inv Δ−1,22 pp : dette −0,4 % (3,3 k€/MW, dans le bruit) ; **D&A MF +1,5 % vs BP** +
>   SHL P90 remboursé un peu trop lentement. Gearing 90,6 % → même amplification.
> Ces deux écarts D&A sont l'item 7 exact (« Ychoux = seul où MF < BP ») : latents avant, révélés par
> l'item 8. La dette RESTE dans le bruit (±0,4 %, < 12 k€/MW) ; seul le TRI (équity fine) casse.

## Comment travailler (méthode imposée)
- **Outil de vérité** : `npx tsx scripts/compare_bp_project.ts "<nom>"` (ou `… <N> --full`) —
  compare MF au BP Excel calculé du projet (`data/<N>.xlsm` : C_P50/C_P90/C_Financing/C_D&A),
  ligne à ligne et année par année. Mapping N→nom en tête du script. `data/<N>.xlsm` = ground
  truth par projet (single-project, tout calculé).
- **Une correction de méthode à la fois.** Après chaque fix : relancer le comparateur sur
  plusieurs projets (au moins Sigoulès=21 témoin + 2-3 concernés) et vérifier que l'écart
  **se réduit** (au lieu de « tests inchangés »).
- ⚠️ **Les tests ancres devront être MIS À JOUR** vers les valeurs BP-correctes.
  `app/lib/finance/calibration_bauge.test.ts` / `calibration_sigoules.test.ts` verrouillent
  l'ANCIENNE méthode (approximative) — c'est normal qu'ils bougent quand on corrige.
- ⚠️ **Les erreurs se COMPENSENT.** Preuve Phase 1 : indexer les engagements à 2 % partout
  faisait régresser Salbris (vert par erreurs qui s'annulaient). Donc le compteur de verts
  peut **osciller** en cours de route — viser le match ligne-à-ligne du comparateur, pas le
  compteur. Ne pas s'arrêter à la première régression apparente.
- Ne PAS toucher la logique de courbe/dégradation sans mesurer l'effet sur TOUS les projets
  (elle est partagée). `npm run build` + `npx vitest run app/lib/finance` verts à chaque étape.

## Backlog des 10 corrections (ordre : postes → cascade IS/SHL)

Diagnostic issu du comparateur + 4 agents Fable sur les 25 projets. Fréquence = nb de projets
où l'écart apparaît (sur les échantillons Fable).

### 1. Tarif merchant an21+ (7/7) — index de courbe ✅ FAIT (blend de sizing routé)
> **Résolu comme fix d'extraction, pas de courbe.** Le prix P50 opérationnel (Investor curve,
> 1,0/flat 0) était déjà juste partout ; le résidu an21+ ne touchait que le **P90 de sizing** de
> Salbris, dont le BP applique un blend Debt Sizing **1,0/0,0 (central pur)** — édition manuelle
> du fichier (la 2e après le financing fee 0,8, item 11), unique sur les 25. Fix : lire
> « Inp_Curve price » (⚠️ espace final dans le nom de feuille) r47/r48 col H dans
> `buildGroundTruthBySlug` (round6 → 0,7/0,3 exact sur les 24 standards) → engineOnly →
> seed_bp_reel → colonnes `Project.debtSizingCentralW/LowW` (préexistantes, consommées par
> `resolveMerchantPrices` — engine.ts intouché). Fallback 0,7/0,3 sans data/N.xlsm. Investor
> curve r55/r56 lue en défensif (log si ≠ 1/0), non routée. **Salbris dette −0,49 → −0,11 %,
> TRI inv −0,57 → −0,11 pp, Revenus P90 sizing an21+ → 0,00 % ; les 24 autres bit-à-bit
> identiques ; 25/25 conservé.**

- **Symptôme** : identique an1-20, puis divergence à partir de l'an21 (bascule merchant).
  De −12 à −19 % à la bascule (surtout MES lointaine, ex. Salbris MES 2030 −21 % an21) jusqu'à
  +13 à +19 % en fin de vie. Le BP extrapole ~+0,44 %/an lisse ; MF applique la courbe Aurora
  (dents de scie, plus pentue).
- **BP** : `curveIndexAn1` = série IMF stockée (Inp_Curve price R34), puis ×1,02/an. Vérifier
  l'index par projet selon la MES (déjà partiellement traité, cf CALIBRATION.md G8a).
- **Code** : `engine.ts` calcul revenu merchant P50/P90 (`resolveMerchantPrices`, `inflFactor`),
  `curveIndexAn1` dans read_bp_matrix (formule `1.10245×1.02^(mes-2029)`), `merchantCurves.ts`.
- **Attention** : logique PARTAGÉE → mesurer l'effet sur Sigoulès/Baugé (MES 2028/2029).

### 2. Démantèlement an25-29 (7/7) — poste OPEX manquant (G7) ✅ FAIT (commit b53e163)
> La série RÉELLEMENT APPLIQUÉE est **C_P50/C_P90 r195** : constante an25-29, NON indexée
> (= Inp_Assumption r294 TOTAL €, étalé sur 5 ans — ex. Ychoux 131 700 € → 26,34 k€/an ; ⚠️ le
> diagnostic initial confondait total et annuel). Routée comme TF/CFE : colonne
> `Scenario.demantelementKeuroByYear` (String? JSON, migration `add_demantelement`), poste
> `demantelementKeuro` dans `calculateOpexDetails` (P50) + somme P90 (r195 présent dans C_P90
> aussi ; sans effet sizing, an25-29 > ténor). Ligne « Démantèlement » ajoutée à bpModel +
> compare_bp_project. **Démantèlement 0,00 % ligne-à-ligne ; Total OPEX an25-29 −4 % → ~−0,45 %
> (résidu = MRA, item 6) ; Sigoulès Total OPEX 0,00 % sur les 35 ans.** Compteur stable.

- **Symptôme** : Total OPEX MF −4 à −8 % sur an25-29 → EBITDA/CFADS P50 gonflés +4 à +7,7 %.
- **BP** : 24-40 k€/an (≈ 10 000 €/MWc) sur an25-29, non indexé (SPEC_BP_SIGOULES §1.7).
- **Code** : nouvel input optionnel (ex. `demantelementKeuroTotal` ou €/MWc) routé dans l'OPEX
  des années 25-29 seulement. Lire la valeur par projet (Inp_Opération / Inp_Assumption).
- Anchor-safe (input optionnel null-default). Impacte TRI projet + VAN.

### 3. Assurance (7/7) — assiette + indexation ✅ FAIT (commit 58fd8f7 — display-only)
> **Le moteur était DÉJÀ juste** (assiette = revenu PV pur, ×1,02^(y−1)). Le faux écart venait du
> COMPARATEUR : `bpModel.ts` rappelait `calculateOpexDetails` avec `undefined` en 6e argument
> (`revenueP50PvKeuro`) → fallback sur le revenu TOTAL (capacité+GO) → lignes « Assurance » ET
> « Engagements » (dérivée par différence) faussées à l'affichage les années à capacité/GO.
> Fix : champ ADDITIF `revenueP50PvKeuro` (PreRow → AnnualCashFlow, simple forward de la valeur
> déjà calculée) passé par bpModel. ZÉRO changement de calcul moteur : dette/TRI/VAN strictement
> inchangés, compteur inchangé. Assurance + Engagements → 0,00 % ligne-à-ligne (Baugé, Sigoulès).

- **Symptôme** : MF > BP, +0,8 % an1 dérivant à +6-7 % an35.
- **BP** : `1,5 % × RevenuesPV_énergie(y) × 1,02^(y−1)` — assiette = revenu PV PUR (hors
  capacité/GO), avec facteur ×(1+inflation). Cf SPEC §2.4 (le facteur inflation EST dans le BP).
- **Code** : `engine.ts` calcul assurance (~L851 historique) — vérifier assiette (revenu PV pur)
  ET le facteur ×1,02^(y−1). ⚠️ Un ancien fix avait retiré le facteur en croyant à un bug —
  le remettre à 2 %.

### 4. Base TF/CFE (7/7 TF, 5/7 CFE) — multiplicateur d'assiette ✅ FAIT (commit d0c2655)
> **Résolu autrement que prévu.** La MÉTHODE d'assiette du BP varie PAR SITE (sélecteur R400/R405
> de `Inp_Matrice_O&M_Taxes`) : « comptable seule si achat terrain » (Selles/Villognon, ×~2,5) vs
> « appréciation directe » (Baugé). Reconstruire la base était fragile (batiments PTR/PDL R271,
> dénominateur MOD R267, taux terrain 0,04 vs 0,08). On **route la série RÉELLEMENT APPLIQUÉE**
> (C_P50 r191/r192, ground truth exact) comme les engagements → colonnes `tfKeuroByYear`/
> `cfeKeuroByYear` (migration `add_tf_cfe_series`), override dans `calculateAnnualOpex`. TF/CFE
> désormais +0,00 % ligne-à-ligne. Selles ROUGE→VERT, Salbris ROUGE→VERT.

- **Symptôme** : écart CONSTANT toutes années (−8 à −14 % en général ; Salbris **+82 %** TF,
  Selles −68 %). Signe = base cadastrale mal calculée pour ces sites.
- **BP** : Règle 6 (appréciation directe) déjà implémentée et calée sur Baugé/Sigoulès. L'écart
  constant par projet suggère que la BASE foncière (`fonciereBienEuroWc` / immo passibles /
  MOD retraité) diffère par site. Comparer la base cadastrale MF vs BP (data/<N>.xlsm, feuille
  taxes / Inp_Matrice_O&M_Taxes) projet par projet. Salbris (+82 %) et Selles (−68 %) = à
  investiguer en premier (peut-être extraction de la base, pas seulement méthode).
- **Code** : `calculateTaxesFoncieres` dans engine.ts + extraction base dans read_bp_matrix.

### 5. Engagements — indexation / fin de vie (6/7) ✅ FAIT (commit c58153a)
> Le portefeuille Inp_Opération porte une série NON indexée (an1 correct, plate ensuite) qui
> sous-charge l'OPEX de ~15-18 % sur les 20 ans de dimensionnement → dette sur-dimensionnée. On
> adopte la série RÉELLEMENT APPLIQUÉE (C_P50 r199, déjà indexée 2 %/an, provisions incluses)
> dès qu'un data/N.xlsm existe (`buildGroundTruthBySlug`). Digoin (saisie pure) couvert. Dette
> Baugé 2,9→1,0 %, Villognon 2,2→1,9 %, Selles 5,8→4,3 %. ⚠️ A transitoirement regressé Salbris
> (cas de compensation documenté) — résorbé ensuite par l'item 4.

- **Symptôme** : MF plat, BP indexé 2 %/an → MF dérive à −53 à −99 % en fin de vie (voire négatif).
- **BP** : la série « Total Engagements » (Inp_Opération) est indexée ~2 %/an. MF route la série
  brute sans indexation (ou avec zéros de queue).
- **Code** : `opexEngagementsKeuroByYear` déjà routé (Phase précédente) mais NON indexé. Décider :
  soit lire la série déjà inflatée du BP par projet (data/<N>.xlsm Inp_Opération), soit appliquer
  l'indexation 2 %. ⚠️ Phase 1 a montré qu'indexer NAÏVEMENT partout régresse Salbris → lire la
  vraie série par projet est plus sûr.

### 6. MRA — calendrier en paliers (5/7) ✅ FAIT (commit 674dee5)
> Série RÉELLEMENT APPLIQUÉE **C_P50 r189** (déjà indexée 2 %/an, flag exploitation inclus)
> routée comme TF/CFE : colonne `Scenario.mraKeuroByYear` (String? JSON, migration
> `add_mra_series`), override au calcul MRA (`mraKeuroByYear[y-1] ?? formule scalaire plate`),
> `hasDetailedOpexInput` étendu ; le P90/sizing suit via `opexDetailsP50.mraKeuro`.
> Mur-de-Sologne (r189 = plat) et MRA nulles → strictement inchangés. **MRA + Total OPEX
> 0,00 % ligne-à-ligne sur LES 25. Compteur 23→24/25 : Ychoux ROUGE→VERT** (Δ−0,83 → −0,19 pp,
> l'écart de timing d'impôt attendu ne s'est PAS matérialisé en rouge). Salbris −1,35 → −1,22 pp
> (reste ROUGE : timing IS item 9 + CAPEX +0,59 %). Baugé Δ−0,18 → −0,08 pp (pas de régression
> par compensation). Tests calibration verts SANS modification (les ancres ne routent pas la série).

- **Symptôme** : BP en paliers de remplacement (an1-4 à ~50 % du niveau, sauts an5/an9/an12/an19) ;
  MF applique un niveau plat indexé. Signature récurrente : +97 % an1-4, puis +7,5 %/−26 %/−9 %.
- **BP** : profil de renouvellement onduleurs (garantie constructeur) — une courbe MRA par année,
  pas un scalaire. Mur-de-Sologne est calé (0,00 %) → la méthode marche pour au moins un profil.
- **Code** : permettre une SÉRIE MRA an-par-an (comme les engagements) au lieu du scalaire
  `mraEuroKwc` indexé. Lire la courbe MRA du BP par projet.

### 7. D&A dégressif (5/7) — base / coef ✅ FAIT — dotation à 0 € sur les 25
> **La contingency était DISCULPÉE et le Type 1 déjà exact** (MF modules+BOS+contingency = BP
> Modules+BOS à 0 € sur les 25 C_D&A — la contingency BP est DANS le poste BOS ; mécanique
> dégressif ×0,1125 + bascule linéaire an13 identique). Tout l'écart = la base **Type 2** :
> le BP amortit `Grid connection + MOD facturé TOTAL` (= Coût du Dev r93 + « Dont Marge
> facturable » r32, C_D&A r21) et met l'**Apport Affaires** (r215) dans « Other expenses »
> r231 → **No D&A**. MF faisait l'inverse : apport amorti (13 projets, dotation +1 à +3 % —
> Sigoulès +11,2 k€/an, Salbris +9,7) et marge facturable non amortie (Ychoux, seul r32 ≠ 0 :
> 193 136 € → dotation −9,7 k€/an, le seul « MF < BP »). **Fix** : mapping auto
> `capexType2 = raccordement + devFees + margeFactAmortissableKeuro` (nouveau champ Scenario,
> migration `add_marge_fact_amortissable`, null → inchangé ; routé read_bp_matrix→seed→
> scenarioMetrics/calibrate/report/check + formulaires). CAPEX total, sizing (margeFactFigee)
> et base foncière (modRetraitement) INTOUCHÉS — seul le statut D&A change. **Résultat** :
> dotation + VNC ligne-à-ligne ✓ sur les 25 ; Sigoulès TRI Δ 0,02→**0,00 pp** ; Baugé inchangé ;
> Ychoux TRI Δ −1,80→**−0,83 pp** (encore ROUGE, bande 0,7) ; Salbris −1,22→−1,33 pp (ROUGE —
> son ancienne dotation fausse compensait d'autres erreurs, cf § compensation). Les 2 rouges
> résiduels ne sont PLUS du D&A : OPEX an1-3 (−0,7/−0,8 %), timing IS an1+ (item 9), SHL (10),
> démantèlement an25-30 (item 2) ; Salbris a aussi un CAPEX +0,59 % pré-existant.

- **Symptôme** : dotation MF +1 à +3 % (base amortissable trop haute), croissant en phase
  dégressive puis plateau. Ychoux = seul où MF < BP.
- **BP** : dégressif coef 2,25 sur base Type 1 (modules+BOS) — déjà implémenté. L'écart +1-3 %
  suggère base amortissable légèrement différente (contingency ? périmètre des postes Type 1).
  Comparer C_D&A du projet vs `calculateAnnualCashFlows` amort.
- **Code** : `engine.ts` D&A (mapping des classes Type1/Type2/NoD&A), coef dégressif.

### 8. CFADS de dimensionnement net de l'IS P90 ✅ FAIT — driver reclassé (blend merchant DISCULPÉ)
> **Le blend merchant n'était PAS le driver** (hypothèse « Low pur en queue » réfutée : prix de
> sizing MF = prix BP au centime, blend 0,7/0,3 exact). Le VRAI driver = le BP dimensionne la dette
> sur un CFADS **net de l'IS du cas P90** : `CFADS_sizing(y) = EBITDA_P90(y) − IS_P90(y)` avec
> `IS_P90 = 25% × max(0, min(EBT_P90, cumEBT_P90))` (report déficitaire intégral). Vérifié à l'euro
> sur data/<N>.xlsm (C_P90 r260 = r226 + r244 = C_Financing r80/r84) pour les 25.
> - **EBT_P90** = EBITDA_P90 − D&A − intérêts dette sizée − **intérêts SHL du cas P90** − DSRF −
>   agent fee. Le SHL P90 a un waterfall PROPRE (≠ série P50) : servi par le cash P90 résiduel après
>   dette, capitalisé quand le cash manque. Gearing élevé (peu de CCA) → SHL éteint tôt → intérêts →
>   0 → EBT P90 taxable (Villognon/Salbris/Ychoux). Gearing faible → SHL grossit → cumEBT P90 négatif
>   tout le ténor → IS de sizing = 0 (Sigoulès/Orval/Langon/Montcuq 3/Selles/Villeherviers ×3).
> - **Circularité IS ↔ intérêts dette sizée ↔ dette** : résolue par point fixe dans la boucle de
>   sizing (`sizingWithFacturableMargin`, refeed du SHL P90 = capex − dette courante), 2-7 itérations.
> - **Code** : `applyWaterfall` (P&L P90 : `intSHLP90`, `isP90`, cascade SHL P90 ; nouveaux champs
>   `isP90Keuro`/`intSHLP90Keuro`/`shlP90OutstandingKeuro`), `resolveCfadsSizingKeuro` (= cfadsP90 −
>   isP90), boucle de sizing (param `ccaP90PrincipalKeuro`). `taxeFinaleSizingKeuro` (ancien proxy
>   « 15,129 à l'an24 » figé) DÉPRÉCIÉ dans le sizing. Rétrocompat : `tauxIS` null → isP90 = 0 → inchangé.
> - **Validation** : Villognon IS_P90 = ±1 € vs BP (an20-24), dette 0,00 % ; Baugé dette −0,3 % ;
>   Sigoulès/Orval/Selles inchangés (IS_P90 = 0). Bancs `calibration_sigoules`/`bauge`/`digoin`
>   verts (Digoin — anchor gearing 92 % — mis à jour vers la dette BP-correcte 3 130,4 k€).
> - **RESTE l'item 7 (D&A)** : Ychoux/Salbris passent ROUGES sur le TRI (dette dans le bruit) car
>   leur écart D&A, jusqu'ici masqué par « pas d'IS de sizing », décale d'un an le franchissement du
>   seuil cumEBT P90. Compensation classique → faire l'item 7 pour atteindre 25/25.

### 9. Timing IS / report déficitaire (7/7) ✅ FAIT (seed cumEBT an0 P50 + P90)
> **Cause exacte trouvée = SEED du cumEBT an0** (pas les OPEX). Le BP cumule le déficit fiscal
> DEPUIS l'an0 où EBT(an0) = −intérêts SHL capitalisés (`ccaPrincipal − ccaDrawdown`). UNIVERSEL,
> vérifié à l'euro sur les 25 fichiers (C_P50 r243an1 − r242an1 = r243an0 = −r289an0) → **RÉFUTE
> l'ancienne note « no-seed » G5** (millésime fiche antérieur, cascade SHL alors fausse). Câblé dans
> `applyWaterfall` : `seedP50/seedP90 = −Math.max(0, ccaPrincipal − ccaDrawdown)` → `cumEbtP50` +
> `retainedEarnings` (P50, commit 1) et `cumEbtP90` (P90, commit 2, via `shlP90Drawdown`). IS
> bascule à l'année BP sur les 25 ; le seed P90 recale la DETTE des 4 projets P90-taxés vers le BP.
> Ground truth exact : `compare_bp_project 21` (IS/déficit/résultat cumulés à l'euro).

- **Symptôme** : déficit fiscal cumulé diverge dès an1 (−9 à −25 %, car OPEX an1 MF ≠ BP) puis
  explose ; IS décalé de plusieurs années (−79 % à +154 % l'année de bascule). Principal
  amplificateur des écarts CR/dividendes.
- **Cause partielle** : dépend des OPEX/D&A (1-8). Beaucoup se résorbera une fois 1-8 faits →
  refaire le diagnostic IS APRÈS.
- **BP** : `IS = 25 % × MIN(EBT, cumEBT)` (report intégral, SPEC §2.6) — déjà implémenté. Vérifier
  la base cumEBT (intérêts SHL capitalisés an0 ?) et le timing exact vs C_P50 r245 du projet.

### 10. Waterfall SHL (7/7) ✅ FAIT (no-DSRA + capitalisation + gate dividendes/pooling)
> Trois corrections dans la cascade P50 de `applyWaterfall` (commit 1) : (a) **DSRA RETIRÉE** — le
> BP ne finance aucune réserve de service de la dette (r296 « Cash flow available for SHL » == r268
> « FCF after debt service » à l'euro sur les 25) ; l'ancienne DSRA ponctionnait le cash an1-2 et
> décalait le sweep. Champs dsra* = 0 ; `dsraInitialKeuro` (double-TRI) intact. (b) **Capitalisation**
> des intérêts SHL non couverts par le cash (r289 an1+ ≠ 0 → solde SHL croissant chez les cash-tight).
> (c) **Dividendes plafonnés** aux bénéfices distribuables cumulés (r311) ; l'excédent → nouveau champ
> `cashPoolingKeuro` (r319, affichage bpModel + mapping compare_bp_project). Le TRI investisseur
> (FCF after debt service) n'utilise pas cette cascade → NON cassé (il bouge seulement via l'IS
> retimé, TOUJOURS vers le BP). Dividendes/pooling Orval exacts à l'euro ; résidus Salbris/Villognon
> = item 1 (merchant P90 queue).

- **Symptôme** : MF ne rembourse pas an1 (sweep démarre an3), et/ou capitalisation des intérêts
  SHL différente → soldes ±100 % à ±3 900 %, dividendes ±100 à +1 200 % en fin de vie. Largement
  DÉRIVÉ de l'IS (9) et des CFADS (1-8).
- **BP** : intérêts SHL capitalisés en construction ; sweep intégral du cash dispo dès an1 (SPEC
  §2.7). Cf CALIBRATION.md (mécanique SHL Baugé décodée).
- **Code** : `applyWaterfall` / calcul SHL dans engine.ts. Vérifier : sweep dès an1, capitalisation
  an0, ordre intérêts→principal→dividendes.
- ⚠️ Rappel : le TRI investisseur n'utilise PAS le waterfall dividendes mais le FCF after debt
  service (déjà calé). Le waterfall SHL affecte surtout l'AFFICHAGE et la VAN equity — vérifier
  que corriger le SHL ne casse pas le TRI investisseur déjà calé.

### 11. Financing fees — valeur appliquée BP (Inp_Assumption r548) ✅ FAIT → 25/25
> **Dernier rouge (Salbris) résolu.** Cause n°1 de son Δ TRI (−0,79 pp sur −1,22) : le BP de
> Salbris applique **610,4 k€** de financing fees (r548) alors que MF en recalculait **720,2 k€**
> (formule template 7 composants ×0,95). Son fichier BP a un facteur **0,8 codé en dur** (édition
> manuelle unique sur les 34) → non reconstituable par formule. **Fix** (stratégie « valeur
> appliquée », comme TF/CFE r191-192, MRA r189, engagements r199) : route r548 (€ → k€) par
> projet → colonne `Scenario.financingFeesKeuro` (Float?, migration
> `add_financing_fees_override`) → input moteur `financingFeesKeuro`.
> - **Moteur** : l'override est porté dans le CAPEX total (`calculateCapexDetails`, poste
>   **No D&A** — canal input préexistant, celui des bancs Baugé/Sigoulès) et NEUTRALISE le
>   recalcul par taux (`calculateFinancingFees` → 0 quand l'override est non nul, sinon double
>   comptage dans `initialInvestment`). La formule ×0,95 (engine.ts) est INCHANGÉE (correcte sur
>   les 25 autres BP) ; null → recalcul par taux inchangé (rétrocompat stricte, 55 tests verts
>   SANS retouche d'ancre). Effet limité à l'équity an0/CAPEX : D&A (mapping par composants),
>   base foncière (composants + TF/CFE routées) et OPEX intouchés ; la dette sculptée (DSCR,
>   gearing Salbris 90,1 % < 95 %) ne bouge que de −19 k€ (via intérêts SHL P90 ↔ IS de sizing).
> - **Câblage** : read_bp_matrix (r548 → persistedEngineInputs + flag) → seed_bp_reel (colonne)
>   → scenarioMetrics/calibrate_all (input). Affichage : page projet et analysisServer re-séparent
>   « CAPEX initial (hors fees) » / « frais de financement » (exactement UN des deux canaux —
>   override capexDetails OU recalcul metrics — est non nul).
> - **Résultat** : **25/25 VERT**. Salbris CAPEX 18 557 = BP (0,00 %), TRI Δ−0,57 pp (bande 0,7),
>   dette −0,49 % (résidu = queue merchant P90, item 1). CAPEX ~0,00 % sur les 25 (les petits
>   Δ 0,1 % Montcuq/Sigoulès/Aérodrome absorbés). Sigoulès −0,02 pp, Baugé −0,08 pp inchangé.

## Les rouges — état 2026-07-07 (après items 11 puis 1) : 🎯 25/25 — plus aucun rouge
- **Salbris** : ✅ VERT franc (items 11 + 1). CAPEX 0,00 %, dette Δ−0,11 %, TRI inv Δ−0,11 pp —
  sorti du plancher de bruit (blend Debt Sizing 1,0/0,0 routé, Revenus P90 sizing an21+ 0,00 %).

## Les rouges — état 2026-07-06 soir (après items 2/3/6) : 24/25
- **Selles-sur-Cher 1** : ✅ VERT (items 4 + 5). Dette 0,0 %, TF/CFE ligne-à-ligne. La régression
  par compensation redoutée avec l'item 6 n'a PAS eu lieu.
- **Golf de Baugé** : ✅ VERT (item 8, consolidé par 6). Dette −0,2 %, TRI inv Δ−0,08 pp.
- **Villognon** : ✅ VERT (item 8). Dette −0,1 %, TRI inv Δ−0,17 pp.
- **Ychoux** : ✅ VERT (item 6). TRI inv Δ−0,83 → **−0,19 pp**, dette −0,0 %. La MRA en paliers
  était le driver résiduel ; le timing d'impôt n'a finalement pas dégradé le TRI (pas besoin de
  l'item 9 pour le caler).
- **Salbris** : 🔴 SEUL ROUGE. TRI inv Δ−1,22 pp (dette −0,4 %, gearing 90,6 % → équity fine).
  Drivers restants : **timing IS P50 (item 9)**, SHL/CCA (item 10) et **CAPEX +0,59 %
  pré-existant** à creuser. MRA/TF/CFE/engagements/démantèlement/D&A désormais exacts chez lui.

## Estimation
≈ 3-6 h de travail en arrière-plan, ~8-12 itérations moteur. Items 1-6 rapides (~1,5-2,5 h),
7-8 (~45 min), 9-10 (cascade IS/SHL) = la partie incertaine, plusieurs passes (~1-2,5 h).
Committer à chaque correction (progrès banké).

## Reprendre (au 2026-07-07 — 🎯 25/25, items 1/2/3/4/5/6/7/8/11 faits)
0. Pipeline de mesure après TOUTE modif d'extraction/moteur (l'ordre compte) :
   `npx tsx scripts/read_bp_matrix.ts` (régénère data/cibles/) → `DATABASE_URL="file:./prisma/dev.db"
   npx tsx scripts/seed_bp_reel.ts` (réécrit la DB) → `npx tsx scripts/calibrate_all.ts` (compteur).
   ⚠️ calibrate_all lit data/cibles/*.json ; le comparateur lit la DB (Prisma). Régénérer LES DEUX.
   Après un changement de schéma Prisma : `npx prisma generate` (explicite) avant de re-seed/build.
1. `npx tsx scripts/calibrate_all.ts` → **25/25 VERT, 0 rouge** (Salbris calé par l'item 11 —
   financing fees appliqués r548). Le compteur est ATTEINT : toute suite est du raffinement
   ligne-à-ligne, plus du débogage de compteur — ne jamais redescendre sous 25.
2. ~~Item 1~~ ✅ FAIT (blend Debt Sizing routé — Salbris dette −0,11 %, TRI −0,11 pp).
   Reste optionnel (ligne-à-ligne) : **9** (timing IS P50) et **10** (waterfall SHL,
   affichage/VAN equity). Commit à chaque correction.

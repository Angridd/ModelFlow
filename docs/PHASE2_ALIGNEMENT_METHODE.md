# Phase 2 — Aligner la MÉTHODE de calcul MF sur les BP (en cours)

> Rédigé le 2026-07-05. État de départ : **22/25 projets calés** (dette/CAPEX/TRI) après
> Phase 1 (corrections d'extraction, commit `61a0969`). Objectif Phase 2 : que MF reproduise
> le BP **ligne à ligne, année par année**, sur les 25 projets — ce qui calera aussi la VAN
> brute à l'euro et les 3 derniers rouges (Golf de Baugé, Selles-sur-Cher 1, Villognon).
>
> **AVANCEMENT 2026-07-06 — 23/25 calés, item 8 FAIT.** Items **5** (engagements, commit `c58153a`),
> **4** (TF/CFE, commit `d0c2655`) et **8** (CFADS de dimensionnement net de l'IS P90) faits.
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

### 1. Tarif merchant an21+ (7/7) — index de courbe
- **Symptôme** : identique an1-20, puis divergence à partir de l'an21 (bascule merchant).
  De −12 à −19 % à la bascule (surtout MES lointaine, ex. Salbris MES 2030 −21 % an21) jusqu'à
  +13 à +19 % en fin de vie. Le BP extrapole ~+0,44 %/an lisse ; MF applique la courbe Aurora
  (dents de scie, plus pentue).
- **BP** : `curveIndexAn1` = série IMF stockée (Inp_Curve price R34), puis ×1,02/an. Vérifier
  l'index par projet selon la MES (déjà partiellement traité, cf CALIBRATION.md G8a).
- **Code** : `engine.ts` calcul revenu merchant P50/P90 (`resolveMerchantPrices`, `inflFactor`),
  `curveIndexAn1` dans read_bp_matrix (formule `1.10245×1.02^(mes-2029)`), `merchantCurves.ts`.
- **Attention** : logique PARTAGÉE → mesurer l'effet sur Sigoulès/Baugé (MES 2028/2029).

### 2. Démantèlement an25-29 (7/7) — poste OPEX manquant (G7)
- **Symptôme** : Total OPEX MF −4 à −8 % sur an25-29 → EBITDA/CFADS P50 gonflés +4 à +7,7 %.
- **BP** : 24-40 k€/an (≈ 10 000 €/MWc) sur an25-29, non indexé (SPEC_BP_SIGOULES §1.7).
- **Code** : nouvel input optionnel (ex. `demantelementKeuroTotal` ou €/MWc) routé dans l'OPEX
  des années 25-29 seulement. Lire la valeur par projet (Inp_Opération / Inp_Assumption).
- Anchor-safe (input optionnel null-default). Impacte TRI projet + VAN.

### 3. Assurance (7/7) — assiette + indexation
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

### 6. MRA — calendrier en paliers (5/7)
- **Symptôme** : BP en paliers de remplacement (an1-4 à ~50 % du niveau, sauts an5/an9/an12/an19) ;
  MF applique un niveau plat indexé. Signature récurrente : +97 % an1-4, puis +7,5 %/−26 %/−9 %.
- **BP** : profil de renouvellement onduleurs (garantie constructeur) — une courbe MRA par année,
  pas un scalaire. Mur-de-Sologne est calé (0,00 %) → la méthode marche pour au moins un profil.
- **Code** : permettre une SÉRIE MRA an-par-an (comme les engagements) au lieu du scalaire
  `mraEuroKwc` indexé. Lire la courbe MRA du BP par projet.

### 7. D&A dégressif (5/7) — base / coef
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

### 9. Timing IS / report déficitaire (7/7) — À FAIRE APRÈS 1-8
- **Symptôme** : déficit fiscal cumulé diverge dès an1 (−9 à −25 %, car OPEX an1 MF ≠ BP) puis
  explose ; IS décalé de plusieurs années (−79 % à +154 % l'année de bascule). Principal
  amplificateur des écarts CR/dividendes.
- **Cause partielle** : dépend des OPEX/D&A (1-8). Beaucoup se résorbera une fois 1-8 faits →
  refaire le diagnostic IS APRÈS.
- **BP** : `IS = 25 % × MIN(EBT, cumEBT)` (report intégral, SPEC §2.6) — déjà implémenté. Vérifier
  la base cumEBT (intérêts SHL capitalisés an0 ?) et le timing exact vs C_P50 r245 du projet.

### 10. Waterfall SHL (7/7) — À FAIRE EN DERNIER
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

## Les rouges — état 2026-07-06 (après item 8)
- **Selles-sur-Cher 1** : ✅ VERT (items 4 + 5). Dette −0,2 %, TF/CFE ligne-à-ligne.
- **Golf de Baugé** : ✅ VERT (item 8). Dette −0,3 %, TRI inv Δ−0,18 pp. Le sur-dimensionnement
  venait de l'absence d'IS de sizing, pas de la queue merchant (blend disculpé).
- **Villognon** : ✅ VERT (item 8). IS_P90 calé ±1 € vs BP an20-24, dette 16 157 = BP (0,00 %).
- **Ychoux** : 🔴 NOUVEAU. TRI inv Δ−1,80 pp (dette −0,4 %, dans le bruit). Driver = **item 7 (D&A
  MF −2,6 %)** amplifié par le gearing 95 %. intérêts SHL = 0 des deux côtés → pur D&A.
- **Salbris** : 🔴 NOUVEAU. TRI inv Δ−1,22 pp (dette −0,4 %). Driver = **item 7 (D&A MF +1,5 %)** +
  SHL P90 remboursé un peu lentement. Gearing 90,6 %.

## Estimation
≈ 3-6 h de travail en arrière-plan, ~8-12 itérations moteur. Items 1-6 rapides (~1,5-2,5 h),
7-8 (~45 min), 9-10 (cascade IS/SHL) = la partie incertaine, plusieurs passes (~1-2,5 h).
Committer à chaque correction (progrès banké).

## Reprendre (au 2026-07-06 — 23/25, item 8 fait)
0. Pipeline de mesure après TOUTE modif d'extraction/moteur (l'ordre compte) :
   `npx tsx scripts/read_bp_matrix.ts` (régénère data/cibles/) → `DATABASE_URL="file:./prisma/dev.db"
   npx tsx scripts/seed_bp_reel.ts` (réécrit la DB) → `npx tsx scripts/calibrate_all.ts` (compteur).
   ⚠️ calibrate_all lit data/cibles/*.json ; le comparateur lit la DB (Prisma). Régénérer LES DEUX.
   Après un changement de schéma Prisma : `npx prisma generate` (explicite) avant de re-seed/build.
1. `npx tsx scripts/calibrate_all.ts` → 23/25 (rouges : **Ychoux** TRI, **Salbris** TRI — tous deux
   D&A/item 7 amplifié par gearing ≥90 %, dette dans le bruit). Villognon + Baugé désormais VERTS.
2. **Attaquer l'item 7 (D&A)** : c'est le driver des 2 rouges restants (compensation révélée par
   l'item 8). Comparer `calculateAnnualCashFlows(...).amort` (P90 = P50) à C_D&A/C_P90 r228 par projet :
   Ychoux D&A MF −2,6 %, Salbris +1,5 % — base amortissable (split Type1/Type2, contingency) par site.
   Cibler le franchissement du seuil cumEBT P90 à la BONNE année (Ychoux an17, Salbris an20).
3. Puis items 9 (timing IS P50) et 10 (waterfall SHL P50 — affichage/VAN). Commit à chaque correction.

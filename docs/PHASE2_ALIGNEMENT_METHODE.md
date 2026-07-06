# Phase 2 — Aligner la MÉTHODE de calcul MF sur les BP (à faire)

> Rédigé le 2026-07-05. État de départ : **22/25 projets calés** (dette/CAPEX/TRI) après
> Phase 1 (corrections d'extraction, commit `61a0969`). Objectif Phase 2 : que MF reproduise
> le BP **ligne à ligne, année par année**, sur les 25 projets — ce qui calera aussi la VAN
> brute à l'euro et les 3 derniers rouges (Golf de Baugé, Selles-sur-Cher 1, Villognon).

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

### 4. Base TF/CFE (7/7 TF, 5/7 CFE) — multiplicateur d'assiette
- **Symptôme** : écart CONSTANT toutes années (−8 à −14 % en général ; Salbris **+82 %** TF,
  Selles −68 %). Signe = base cadastrale mal calculée pour ces sites.
- **BP** : Règle 6 (appréciation directe) déjà implémentée et calée sur Baugé/Sigoulès. L'écart
  constant par projet suggère que la BASE foncière (`fonciereBienEuroWc` / immo passibles /
  MOD retraité) diffère par site. Comparer la base cadastrale MF vs BP (data/<N>.xlsm, feuille
  taxes / Inp_Matrice_O&M_Taxes) projet par projet. Salbris (+82 %) et Selles (−68 %) = à
  investiguer en premier (peut-être extraction de la base, pas seulement méthode).
- **Code** : `calculateTaxesFoncieres` dans engine.ts + extraction base dans read_bp_matrix.

### 5. Engagements — indexation / fin de vie (6/7)
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

### 8. Courbe P90 merchant en queue de dette (4/7)
- **Symptôme** : CFADS P90 des années merchant (an21-24) trop haute chez MF (+6 à +34 % — Ychoux
  +34 % an24, dette éteinte 1 an trop tôt). Ratio P90/P50 merchant : MF ≈ 0,75 vs BP ≈ 0,58 sur
  certains projets. Calé uniquement sur Sigoulès.
- **BP** : blend 70 % Central / 30 % Low sur la courbe merchant en P90 ; vérifier que MF applique
  le bon blend et le bon ratio prod P90 en années merchant.
- **Code** : `engine.ts` P90 sizing merchant (debtSizingCentralW/LowW, prix merchant P90).

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

## Les 3 rouges restants (résolus par la Phase 2)
- **Golf de Baugé** : engagements non indexés (BP inflaté 82→148 k€) + MRA paliers → items 5 + 6.
- **Selles-sur-Cher 1** : base TF/CFE (−68 %/−77 %) + queue merchant MES 2033 → items 4 + 1 + 8.
- **Villognon** : base TF/CFE + sizing/amortissement dette → items 4 + 8.

## Estimation
≈ 3-6 h de travail en arrière-plan, ~8-12 itérations moteur. Items 1-6 rapides (~1,5-2,5 h),
7-8 (~45 min), 9-10 (cascade IS/SHL) = la partie incertaine, plusieurs passes (~1-2,5 h).
Committer à chaque correction (progrès banké).

## Reprendre
1. `npx tsx scripts/calibrate_all.ts` → état actuel (22/25).
2. `npx tsx scripts/compare_bp_project.ts "Golf de Baugé" --full` → voir les écarts d'un rouge.
3. Attaquer l'item 1, vérifier au comparateur, mettre à jour les tests ancres, commit. Répéter.

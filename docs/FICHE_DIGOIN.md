# FICHE PROJET — DIGOIN (extraite du BP xlsm du 12/06/2026, scénario "Base Case")

> Format Annexe A de SPEC_BP_SIGOULES.md. **Même template que Sigoulès, vérifié** (mêmes
> onglets, mêmes constantes : DSCR 1,15/1,40 · all-in 4,2% · DSRA 6 mois · DSRF 1,4% ·
> agent 1 000 · SHL 5% · IS 25% · assurance 1,5% · balancing 2 · back office 22,5 k ·
> compteur/télécom/inspection 2 500/1 500/1 500 · abatt. AD 50/30% · valeur vénale 5 000 €/ha
> · profils d'inflation identiques). Digoin = saisie pure, zéro archéologie.

## Inputs (fiche à saisir dans MF)

### Timing & technique
| Champ | Valeur | vs Sigoulès |
|---|---|---|
| `commissioningYear` | **2030** | ≠ 2029 |
| `constructionYears` / `projectLifeYears` | 1 / 35 | = |
| `capacityMw` | **4** | ≠ 12 |
| `yieldMwh` | **1 250** | ≠ 1 360 |
| `unavailability` | 0,01 | = (irradiation 1 237,5 ✓) |
| `degradationRate` | 0,4 (P50 = P90, linéaire) | = |
| `iferRpn` | 1,35 | = |
| `surfaceHa` | **3** | ≠ 12 |
| Wc panneau | 650 | = |

### CAPEX
| Champ | Valeur | vs Sigoulès |
|---|---|---|
| `prixModuleUSDWc` | **0,15** | ≠ 0,17 |
| `tauxEURUSD` | 1,16 | = |
| `boSCtWc` | **35** | ≠ 36 |
| `contingencyRate` | 2 (BOS : 28 000 €) | = |
| `raccordementOuvrageKEuro` | **800** | ≠ 5 000 |
| `devFeesKEuroPerMW` (MOD) | 110 → 440 k€ | = règle |
| `indemnitesImmoKeuro` | **50** | ≠ 90 |
| Taxe aménagement+archéo (calculée) | 22 797,73 € | contrôle moteur |

### Offtake & revenus
| Champ | Valeur | vs Sigoulès |
|---|---|---|
| `tariff` | **80** €/MWh | ≠ 73 |
| `contractDuration` | 20 (2030-2049) | = |
| `tariffInflationRate` | 0,4 | = |
| `capacityCertificateMw` | **0,1** | ≠ 0,3 |
| `goStartYear` / `goPriceBase` | 21 / 1 | = |
| Courbes Aurora + capacité | **identiques** (template, Fixed) | = |
| **`curveIndexAn1`** | **1,124496** (= 1,10245 × 1,02, MES 2030 — lu dans Inp_Curve price!r34) | ≠ 1,10245 |

### OPEX
| Champ | Valeur | vs Sigoulès |
|---|---|---|
| `loyerMode` / `loyerValeur` | €/ha / **1 000** | ≠ 2 500 |
| `omFixedEuroKwc` | **5,615907** (matrice O&M) | ≠ 6 |
| **`mraEuroKwc`** (onduleurs) | **1,157127** (matrice) | ⚠️ ≠ 0 — poste ACTIF ici |
| `backOfficeKeuro` | 22,5 | = |
| `assuranceRate` / `balancingCost` / `aleasOpexRate` | 1,5 / 2 / 0,5 | = |
| `diversOpexKeuro` | **7,277778** (2 500+1 500+1 500+**1 777,78** autoconso = 444,44 €/MWc × 4 ✓ règle) | ≠ 10,833 |
| Démantèlement an25-29 | **40 000** (= 10 000 × MWc, formule template ✓) | règle générique |

### Dette (tout = template)
`debtInterestRate` 4,2 · `debtTenorYears` 24 · `gearingMaxPct` 95 · `dscrSchedule` 1,15
(an1-20) / 1,40 (an21-24) · `dsraMonths` 6 · `dsrfFeeRate` 1,4 (calculé) · `agentFeeAnnuelKeuro`
1,0 · `ccaRemunRate` 5 · fees 7 composants idem.

### Fiscal & taxes
| Champ | Valeur | vs Sigoulès |
|---|---|---|
| `tauxIS` | 25 | = |
| `iferRate1` / `iferRate2` | **3,758799 / 9,03088** €/kVA (barème MES 2030) | ≠ 3,5/8,5 |
| `methodeTaxes` | appreciation_directe | = |
| Immo soumises TFPB/CFE | **89 666,67 €** (→ `fonciereBienEuroWc` 0,0224167 si bâtiments=0, OU override `baseFonciereKeuro` = **103,826** pré-sommé) | ≠ 267,245 |
| MOD retraité (contrôle moteur) | 14 158,91 = ratio 3,218% × 440 000 | calculé |
| `valeurTerrainKeuro` | **15** (5 000 × 3 ha) | ≠ 60 |
| Rateset TF : commune/EPCI/TSE/GEMAPI/TEOM | **0,3069 / 0,0487** / 0,0024 / 0,0023 / 0 | commune+EPCI ≠ |
| Rateset CFE : commune/EPCI/TSECfe/GEMAPICfe/CCI | 0 / 0,2594 / 0,0086 / 0 / 0,0112 | = |
| `inflationTaxes` | 2 | = |

## Cibles de calibration (BP Digoin)

| Cible | Valeur BP |
|---|---|
| ① CAPEX total | **3 401 358,93 €** |
| ② Dette sculptée | **3 192 493,19 €** (binding DSCR, gearing 93,86% < cap 95) |
| ② Equity/SHL | **208 865,74 €** |
| ③ Prod P50 an1 | 4 950 MWh (P90 = 4 603,5) |
| ③ Revenu PPA an1 | 396 000 € |
| CFADS sizing an1 | **277 286,81 €** |
| TF / CFE an1 | **1 598,86 / 1 243,61 €** (base passible 103 825,58) |
| Service dette an1 | 241 118,96 (principal 107 034,25 + intérêts 134 084,71) |
| DSRF an1 / agent an1 | 1 687,83 / 1 000 |
| Flux actionnaire an1 (FCF after DS) | **63 832,15 €** |
| ④ TRI Investisseur | **23,89 %** (mise 208 865,74 — fort levier) |
| TRI Projet brut / net | 8,24 % / 6,77 % |
| VAN brute / nette | 876,1 / 436,1 k€ |

## Points d'attention pour le test MF

1. **`mraEuroKwc` = 1,157127** : premier projet avec MRA onduleurs ≠ 0 — vérifier le
   routage (opex, indexation 2%, présence dans P50 ET P90 sizing).
2. **Gearing 93,86%** : binding DSCR mais à 1,1 pt du cap — vérifier que le moteur
   rapporte le bon binding (pas gearing-capped).
3. **MES 2030** : mapping année → colonne des courbes (Aurora/capacité) décalé d'un an
   vs Sigoulès ; `curveIndexAn1` = 1,124496.
4. **TRI 23,89%** avec mise 209 k€ : très sensible aux petits écarts de flux — si le TRI
   sort à ±1 pt, décomposer le flux an1 (cible 63 832,15) avant de conclure.
5. IFER barème 2030 (3,7588/9,0309) : inputs bruts, pas les valeurs Sigoulès.
6. Base foncière : privilégier la saisie €/Wc (0,0224167, bâtiments 0) pour tester le
   calcul Fix 2 ; l'override 103,826 en secours si la décomposition €/Wc coince.

# SPEC BP Sigoulès — référence complète pour calibration ModelFlow

> Sources : `BP_Sigoulès_en_dur.xlsx` (valeurs) + `BP_Sigoulès_-__12_juin_2026.xlsm` (**formules**).
> Extraction exhaustive du 02/07/2026 — v2 : tous les mécanismes confirmés sur les FORMULES du
> classeur (plus aucune rétro-ingénierie). Onglets réels : Inp_Assumption, C_P50, C_P90,
> C_Financing, C_D&A, Inp_Curve price. RP/BESS/onglets O_ ignorés (hors périmètre).
> Ce doc complète `docs/CALIBRATION.md` (Règle 6 taxes déjà calée).

---

## 0. Architecture du classeur

| Feuille | Rôle | Équivalent MF |
|---|---|---|
| Feuil2 | **Hypothèses** — tous les inputs bruts (708 lignes) | `FinanceEngineInput` |
| Feuil1 | **Debt Sizing** — sculpting DSCR, gearing cap, DSRF | `sizing` |
| Feuil4 | **C_P90** — cash flow sizing (P90, blend 70/30) | CFADS de sizing |
| Feuil3 | **C_P50** — investor case (P50 central 100%), P&L, waterfall SHL, IRR | flux actionnaire, TRI |
| Feuil5 | **D&A** — amortissements 4 types | dépréciations |

Colonnes temps : an0 = 2028 (construction), an1 = 2029 (MES), an24 = fin dette, an35 = fin horizon.

---

## 1. Inputs bruts Sigoulès (valeurs de référence)

### 1.1 Timing & structure
| Input BP | Valeur | Champ MF |
|---|---|---|
| Année MES | 2029 | `commissioningYear` |
| Closing (valuation date) | 31/12/2027 | — (an0 = 2028) |
| Construction duration | 1 an | `constructionYears` |
| Horizon observé | 35 ans | `projectLifeYears` |
| Targeted returns Photosol | 7,5% | `discountRate` |

### 1.2 Technique & production
| Input BP | Valeur | Champ MF |
|---|---|---|
| Capacity | 12 MWc | `capacityMw` |
| Project type (courbe merchant) | **Fixed** (structure fixe) | — (courbe partagée) |
| Yield P50 | 1 360 kWh/kWp | `yieldMwh` |
| Unavailability | 1% | `unavailability` |
| % P90/P50 | 0,93 | (défaut moteur ✓) |
| Dégradation modules (P50 = P90) | 0,4%/an | `degradationRate` |
| RPN | 1,35 | `iferRpn` |
| DC/AC | 0,7407 → injecté 8,889 MVA | — |
| Wc panneau / long / larg | 650 / 2,382 / 1,134 | (taxe aménagement ✓) |

Production : `Initial production = 12 000 kWc × 1 360 × 0,99 = 16 156,8 MWh` (P50 an1).
P90 = ×0,93 = 15 025,8 MWh. Dégradation ×(1−0,004)^(y−1) dès an2.

### 1.3 CAPEX
| Input BP | Valeur | Champ MF |
|---|---|---|
| EUR/USD | 1,16 | `tauxEURUSD` |
| Module price | 0,17 $/Wp → 0,1466 €/Wp | `prixModuleUSDWc` |
| BOS | 0,36 €/Wp | `boSCtWc` (36 ct) |
| BOS contingency | 2% (86 400 €) | `contingencyRate` |
| Connection capex #1 | 5 000 000 € | `raccordementOuvrageKEuro` |
| Coût du Dev PV (MOD) | 110 000 €/MWp → 1 320 000 € | `devFeesKEuroPerMW` |
| Indemnités immo (rent constr.) | 90 000 € | `indemnitesImmoKeuro` |
| Taxe aménagement + archéo | 68 393,18 € (calculé) | (moteur calcule ✓ 68,4 k) |
| Marge facturable | 0 (gearing 78,5% < seuil) | `margeFactKeuro: 0` |

Uses BP : Modules 1 758 620,69 + BOS 4 406 400 (contingency incl.) + Grid 5 000 000
+ MOD 1 320 000 + Financing fees 507 684,33 + Other 158 393,18 = **13 151 098,20 €** ✓ (moteur exact).

### 1.4 Financing fees (7 composants — mécanisme, pas montant)
| Composant | Input | Valeur BP |
|---|---|---|
| Legal fees | fixe | 10 000 € |
| Technical DD | fixe | 5 000 € |
| Arranger fees | 0,8% × PLT | 99 933,54 € |
| Participant fees | 0,4% × PLT | 49 966,77 € |
| Bank fees doc | 1,5 €/kW × 12 MW | 18 000 € |
| Interim financing | 2,5% × PLT | 312 292,32 € |
| Commitment fees | 0,1% × PLT | 12 491,69 € |
| **Total** | | **507 684,33 €** |

**PLT — formule exacte (Inp_Assumption!K536)** :
```
PLT = (CAPEX hors financing fees) × (1 + 4%) × gearing max 95%
    = 12 643 414 × 1,04 × 0,95 = 12 491 693 €   ✓ à l'euro
```
MF fait déjà `CAPEX×1,04×gearing` — seule différence : la base doit être **CAPEX − financing
fees** (le ×1,04 EST la réintégration forfaitaire des fees). Correction triviale.
Interim = 2,5% × PLT ; commitment = 0,1% × PLT ; arranger 0,8% ; participant 0,4% ;
bank doc = 1 500 € × MWc.

### 1.5 Dette & sizing
| Input BP | Valeur | Champ MF |
|---|---|---|
| All-in rate (margin 4,2% + base 0) | **4,20%** | `debtInterestRate` ✓ |
| Maturité | 24 ans | `debtTenorYears` ✓ |
| Gearing max | 95% | `gearingMaxPct` ✓ |
| DSCR contracted / merchant | 1,15 / 1,40 | `dscrSchedule` ✓ |
| Courbe sizing | 70% Central / 30% Low | `debtSizingCentralW/LowW` ✓ |
| Agent fee | 1 000 €/an, **indexé 2%** | `agentFeeAnnuelKeuro` (⚠ flat) |
| DSRF sizing | 6 mois | `dsraMonths` ✓ |
| DSRF fee | **1,4% × réserve** (dynamique) | `dsrfAnnuelKeuro` (⚠ flat 2,7) |
| SHL rate | 5% | `ccaRemunRate` ✓ |

### 1.6 Offtake & revenus
| Input BP | Valeur | Champ MF |
|---|---|---|
| PPA 1 : 100% prod, 73 €/MWh, 20 ans (2029-2048) | | `tariff`, `contractDuration` ✓ |
| Indexation PPA | Custom 1 = **0,4%** | `tariffInflationRate` ✓ |
| Merchant indexation | Euro Inflation **2%** | `inflationAurora` ✓ |
| Courbe P50 investisseur | **100% Central / 0% Low** | `investorCurveW: 1` ✓ |
| Certificat capacité | 0,3 MW | `capacityCertificateMw` ✓ |
| GO post-PPA | dès an21, 1 €/MWh base, indexé 2% | `goStartYear/goPriceBase` ✓ |
| Annual sales year 1 | 1 179 446,4 € (PPA pur) | ✓ moteur exact |

### 1.7 OPEX (inputs bruts)
| Input BP | Valeur | Champ MF |
|---|---|---|
| Rent | 2 500 €/ha × 12 ha = 30 000, indexé 0,4% | `loyerMode/loyerValeur/surfaceHa` ✓ |
| O&M (excl. inverters) | 6 €/kWp = 72 000, indexé 2% | `omFixedEuroKwc` ✓ |
| Back office | 22 500 €, indexé 2% | `backOfficeKeuro` ✓ |
| Insurance | 1,5% sales (voir §2.4) | `assuranceRate` ✓ |
| Balancing | 2 €/MWh (an1-5 = an5+), indexé 2% | `balancingCost` ✓ |
| **Total Other OPEX** | **10 833,33 €** = compteur 2 500 + télécom 1 500 + inspection 1 500 + autoconso 5 333,33 ; indexé 2% | `diversOpexKeuro` (**Fix 3**) |
| Aléas | 0,5% × revenu P50 an1 (1 189 442) = 5 947,21, indexé 2% | `aleasOpexRate` ✓ |
| IFER | 3,5 €/kVA (an1-20) puis **8,5** (an21+), indexé 2% | `iferRate1/2` ✓ |
| TF / CFE | 4 582,18 / 3 264,29 (appréciation directe) | Règle 6 ✓ EXACT |
| **Démantèlement** | 120 000 € → **24 000 €/an, an25-29** (non indexé apparent) | ❌ absent MF |
| Dépôt de garantie | 240 000 € (20 k/MWc) | **hors flux** — ne PAS modéliser |

### 1.8 Fiscal & indexations
| Input BP | Valeur | Champ MF |
|---|---|---|
| IS France | 25% | `tauxIS` ✓ |
| Report déficitaire | intégral (voir §2.6) | ❓ à vérifier MF |
| Profils : OPEX 2% · Loyer 0,4% · PPA 0,4% · Merchant 2% · Assurance "3%" (série réelle = 2%, voir §2.4) | | |

---

## 2. Mécanismes calculés (méthodologie vérifiée)

### 2.1 Sizing dette — Feuil1 (tout confirmé au k€ près par MF)
```
CFADS_sizing(y) = EBITDA_P90(y) + IS_P90(y)      (C_Financing!r80 = C_P90!EBITDA + IS P&L P90)
                = EBITDA_P90(y) pour Sigoulès    (IS P90 = 0 sur an1-24 : report déficitaire
                                                  plus long car revenus P90 plus bas)
Target DS(y)    = CFADS(y) / DSCR(y)              DSCR = 1,15 (an1-20) ; 1,40 (an21-24)
DF(y)           = 1/(1,042)^y                     (année entière, C_Financing!r100)
Dette           = NPV(Target DS)                  = 10 323 840,46 €  (< gearing cap 12 493 543)
```
- SANS déduction agent fee ni DSRF du CFADS (ils vivent en aval). Générique : le mécanisme
  IS-P90-dans-le-sizing existe (peut être non nul sur un autre projet).
- Pas de haircut merchant (100% considéré), binding = DSCR (sculpted).
- **DSRF (formule C_Financing!r153-154)** : `fee(y) = 1,4% × [6/12 × (principal+intérêts)(y)]`
  du schedule appliqué → an1 = 5 289 €, an24 = 2 821 €, total vie = 112 174 €. Déduit du flux
  equity (PAS du sizing).

### 2.2 Revenus
- **P50 (investor)** : PPA an1-20 = prod P50 × 73 × 1,004^(y−1) ; merchant an21+ = prod P50 ×
  courbe centrale 100% × 1,02^exponent. + capacité (0,3 MW × courbe €/kW × 1000 × 1,02^n,
  base 2024) + GO (prod × 1 € × 1,02^(y−1), an21+).
- **P90 (sizing)** : prod P90 × [PPA an1-20 | blend 70C/30L an21-24]. Ni capacité ni GO ni
  ancillary dans la CFADS de sizing. (Les lignes BESS/ancillary de C_P50/C_P90 sont du bruit
  d'affichage : BESS OFF, non sommées dans « Revenues PV ».)
- **Index d'inflation des courbes (G8 RÉSOLU — Inp_Curve price!r34)** : série stockée (IMF),
  PAS un 1,02^n pur : index(2025) = 1,02029 … **index(2029/an1) = 1,10245**, puis ×1,02/an
  exactement (index(2049) = 1,63818). Prix sizing an21 = 44,325 × 1,63818 = 72,61 ✓ à l'euro.
  Moteur : 1,02^5 = 1,10408 (+0,148%) → les ~6 k€ de dette. Même index pour merchant ET
  capacité. Fix générique : `index(y) = indexAn1 × 1,02^(y−1)` avec `indexAn1` en input
  (1,10245 pour MES 2029) — ou stocker la série.
- Deux index distincts dans le BP : index COURBES (base absolue 2025) vs index OPEX
  (base an1 = 1,00, ×1,02^(y−1)) utilisé par opex/assurance/agent fee/GO.

### 2.3 OPEX — règle d'or P50 vs P90
**Les OPEX P50 et P90 sont IDENTIQUES poste par poste, à UNE exception : le balancing**,
assis sur la production du scénario (2 €/MWh × prod P50 = 32 313,6 vs × prod P90 = 30 051,6 an1).
Tout le reste (rent, O&M, back office, insurance, IFER, TF/CFE, autres, aléas) : mêmes valeurs
dans C_P50 et C_P90, toute la vie. (⚠ diffère de l'architecture « panier P90 ×1,02 » notée
pour Baugé — pour Sigoulès c'est plus simple.)

Totaux an1 : P50 = 230 243,4 · P90 = 227 981,5 (Δ = balancing uniquement).

### 2.4 Assurance — RÉSOLU (série vérifiée an1/2/20/21)
```
Insurance(y) = −1,5% × RevenuesPV_énergie(y) × (1 + opexHazard 0%) × flag × indexOpex(y)
```
(formule C_P50!r187 : `=-I284×M83×(1+I301)×M13×M26` — M83 = Σ PPA+merchant, HORS
capacité/GO ; M26 = index opex 1,02^(y−1) base an1.)
an1 : 1,5%×1 179 446 = 17 691,70 ✓ · an20 : 1,5%×1 175 684×1,02^19 = 25 691,5 ✓ (BP 25 691,3)
· an21 : 1,5%×1 147 630×1,02^20 = 25 580,4 ✓ (BP 25 579,8).
→ Le facteur ×(1+inflationAssurance)^(y−1) **est dans le BP Sigoulès** (le « bug préexistant »
noté sur Baugé n'en est pas un ici — trancher Baugé séparément avant de retirer quoi que ce soit).
Le profil « Custom 3 (3%) » affiché en hypothèses n'est PAS ce que fait la série (2%).

### 2.5 D&A — Feuil5 (vérifié : dotation an1 = 1 009 564,8 ✓)
| Type | Postes | Base | Mode | Durée |
|---|---|---|---|---|
| 1 | Modules + BOS (contingency incl.) | 6 165 020,69 | **Dégressif** coef 2,25 → 11,25%/an sur solde (bascule linéaire en fin) | 20 ans |
| 2 | Grid connection + MOD | 6 320 000 | Linéaire 5% | 20 ans |
| No D&A | Financing fees + Other expenses | 666 077,51 | — | — |

an1 = 6 165 021×11,25% + 6 320 000×5% = 693 565 + 316 000 = 1 009 565 ✓.
Tout est amorti à an20 (dotation an21+ = 0).

### 2.6 IS — report déficitaire intégral
```
IS(y) = 0                              si EBT(y) < 0 OU cumEBT(y) < 0
      = 25% × MIN(EBT(y), cumEBT(y))   sinon        (formule C_P50!r245)
```
(cumEBT = Σ depuis l'an0 construction inclus — les intérêts SHL capitalisés an0 comptent.
Le MIN encode le report déficitaire : 1re année positive → taxe le cumul ; ensuite → l'EBT.)
EBT = EBITDA − D&A − intérêts dette − intérêts SHL − DSRF − agent fees.
Premier IS = **an24 : 133 005,5 = 25% × 532 022 (cumEBT)** ✓ à l'euro. IS = 0 an1-23.
(Pas de plafonnement 1 M€/50% appliqué dans ce BP.)

### 2.7 Waterfall SHL & dividendes — Feuil3 §4
```
FCF after debt service(y) = EBITDA_P50 − IS − principal − intérêts − DSRF − agent fee
   = « Cash flow available for SHL »                    ← LE flux actionnaire (an1 = 197 340)
Ordre : 1) intérêts SHL (5% × BoP)  2) principal SHL = tout le cash restant (sweep intégral)
        3) dividendes = min(cash restant, aggregate earnings > 0)
```
- **Intérêts SHL capitalisés** (C_P50!r289) : `capitalisé = intérêts payables − intérêts payés`
  (payés = min(cash dispo, payables)). An0 construction : cash = 0 → 141 363 intégralement
  capitalisés → SHL BoP an1 = 2 968 621. Mécanique générique de capitalisation du non-payable.
- **Agent fee** (C_P50!r236) : 1 000 € × indexOpex(1,02^(y−1)) × [années 1-24 uniquement].
- SHL soldé an25 ; **premier dividende partiel la même année** (an25 = 244 123), pleins an26+.
- Dividendes bloqués tant que retained earnings < 0 — mais le flux actionnaire pour l'IRR
  N'attend PAS les dividendes : c'est le FCF after DS, dès an1. (= la cause racine TRI déjà
  identifiée en mémoire, confirmée par le BP.)

### 2.8 Définitions IRR (Feuil3 §5) — mapping des cibles
| Ligne BP | Flux | an0 | TOT flux |
|---|---|---|---|
| Project IRR ignoring costs | EBITDA (pré-IS) | −CAPEX 13 151 098 | 18 772 940 |
| Project IRR post-tax / BRUT | EBITDA − IS | −13 151 098 | 16 499 615 |
| Project IRR Net | idem − MOD 1 320 000 | | 15 179 615 |
| **Photosol / Equity IRR** | **FCF after debt service** | **−2 827 258** | **8 828 276** |
| + (D) marge MOD | idem, mise nette | −1 837 258 (D = +990 000) | 9 818 276 |
| Investor / VAN nette (+D+E) | idem, E = −1 320 000 | | 8 498 276 |

**La cible « TRI Investisseur 7,42% » = IRR(an0 : −2 827 258 ; an1-35 : FCF after debt service).**
IRR projet affichés (post-tax) : 20a 4,7% · 25a 5,6% · 30a 6,1% · 35a 6,4%.
Marge MOD Photosol (D) = +990 000 (75% × MOD) ; coût réel dev (E) = −330 000.

---

## 3. Séries de référence (bancs de calibration)

### 3.1 FCF after debt service an1-35 (flux actionnaire — banc du TRI 7,42%)
```
197340  196770  196772  196383  195986  195060  194650  185240  184629  184003
183363  209531  209397  210713  210598  208992  208839  216698  216696  207431
367899  335652  326835  181745  524537  542838  553840  563881  571870  585321
602799  610148  618210  626338  634532
```
(an0 = −2 827 258. Vérif : Σ an1-35 = 8 828 276.)

### 3.2 IS an24-35
```
133006  170394  180946  184613  187960  190623  195107  200933  203383  206070  208779  211511
```
(Total vie = 2 273 326.)

### 3.3 CFADS sizing P90 an1-24 (déjà calée à ~1% près, cf. Fix 3)
an1 = 868 903,7 · an20 = 776 010,3 · an21 = 615 330,1 · an24 = 564 133,9
(série complète dans Feuil1 r80/81 — reproduite dans l'échange du 02/07.)

---

## 4. Gaps MF restants, par priorité

| # | Gap | Impact | Nature |
|---|---|---|---|
| G1 | `diversOpexKeuro` 0 → **10,833** | Dette : −168 k€ (ferme l'essentiel du +1,76%) | **Fix 3 en cours** — config |
| G2 | **Flux actionnaire = FCF after debt service** (pas les dividendes), mise = 2 827 258, dès an1 | TRI : 17,58% → ~7,4% (chantier ④) | moteur — le correctif mémoire, désormais spécifié par le BP + banc §3.1 |
| G3 | **IS dans le flux actionnaire** avec report déficitaire intégral (§2.6) | TRI (2 273 k€ de flux) | moteur — vérifier l'implémentation du report |
| G4 | **D&A dégressif Type 1** (coef 2,25) — nécessaire pour l'EBT donc pour l'IS | conditionne G3 | moteur — vérifier mode dégressif |
| G5 | **Intérêts SHL capitalisés année construction** (SHL 2 827 258 → 2 968 621 à MES) | TRI (échéancier SHL) | moteur |
| G6 | **DSRF** = 1,4% × (6/12 × service dette(y)) ; **agent fee** = 1 000 × 1,02^(y−1), an1-24 | flux equity (≈ −112 k€ vie vs flat 2,7×24 = 65 k€) | moteur (audit #7) — formules exactes connues |
| G7 | **Démantèlement 24 k€/an an25-29** | TRI (−120 k€ post-dette) | input + routage opex an25-29 |
| G8 | Index courbes : `indexAn1 = 1,10245` (série IMF) au lieu de 1,02^5 | dette ~6 k€, prix à l'euro | moteur — résolu, formule connue |
| G9 | Assurance : trancher Baugé vs Sigoulès avant de « retirer le facteur » (§2.4, formule confirmée) | non-régression | décision |
| G10 | PLT des fees : base = CAPEX **− financing fees** (×1,04×95%) | fee-stack à l'euro | moteur — trivial |

Hors modèle (ne PAS implémenter) : dépôt de garantie 240 k€ (aucun flux), lignes ancillary/BESS
(OFF, non sommées), plafonnement report déficitaire, haircut merchant, taxes dans le sizing.

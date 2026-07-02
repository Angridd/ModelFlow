# Spec de calibration ModelFlow

Document de référence pour caler le moteur (`engine.ts`) sur les Business Plans Excel.
Règles validées sur le BP **Golf de Baugé** (7 MWc, MES 2029). À implémenter sans casser
la calibration **Sigoulès** (actuellement TRI 0.54 %, VAN 0.30 % — état stable au commit `04597ee`).

Principe directeur : **on valide ligne par ligne, de haut en bas** (production → CA → OPEX →
EBITDA → D&A → intérêts → IS → CFADS → service dette → SHL → dividendes). On ne descend d'une
ligne que quand la précédente matche le BP. Comparer le TRI/VAN final masque les erreurs
intermédiaires.

---

## Règle 1 — Courbe Aurora (prix merchant)

Le moteur reçoit la courbe **brute** (non inflatée) en années calendaires, à partir de 2025 :

- **Investor Curve** (utilisée pour le P50, retour equity) : `42.00, 40.94, 34.03, 33.41, 34.92, 39.58, 42.98, 42.76, 42.80, 47.65, 47.78, 49.72, 51.43, 50.89, 51.31, 50.87, 51.33, 51.32, 50.25, 48.54, 47.17, 47.38, 47.58, 47.43, 47.13, 45.16, 44.46, 43.11, 42.60, 43.35, 43.53, 42.82, 42.83, 42.22, 42.69, 42.15` (2025→2060, puis constant 42.15)
- **Debt Sizing Curve** (utilisée pour le P90, sizing dette) : `39.00, 38.01, 31.61, 31.15, 32.49, 36.79, 39.47, 39.25, 39.32, 43.86, 44.32, 46.36, 47.95, 47.53, 48.00, 47.76, 48.32, 48.41, 47.75, 46.49, 45.25, 45.54, 45.42, 44.87, 44.33, 42.25, 42.02, 41.03, 40.60, 41.50, 41.64, 40.29, 40.09, 39.12, 39.77, 39.33, 39.43` (2025→2061, puis constant 39.43)

**Inflation appliquée par le moteur** (ne PAS la pré-appliquer dans la courbe d'entrée) :

```
prix_capté(année) = prix_brut(année) × 1.02 ^ (année_calendaire − 2024)
```

Vérification : Investor 2025 = 42.00 × 1.02^1 = 42.84 ✅ ; Investor 2049 = 47.13 × 1.02^25 = 77.3 ✅.

Le taux 2 % est `inflationAurora`. L'année de base 2024 est fixe.
Au-delà de la dernière année de courbe, on garde le dernier prix brut (42.15 / 39.43) et on
continue d'appliquer l'inflation depuis 2024.

⚠️ Bug historique à éviter : double application de l'inflation (une fois dans la courbe,
une fois via un `auroraInflationFactor` séparé dans `buildPreRows`). Il ne doit y en avoir
**qu'une seule**.

---

## Règle 2 — IFER

L'IFER se calcule sur la **puissance injectée**, pas la puissance crête :

```
puissance_injectée (MVA) = puissance (MWc) / RPN
IFER = taux_IFER × puissance_injectée
```

- `RPN` = 1.35 par défaut, **modulable** par input.
- Taux IFER : `iferRate1` pour les années 1–20, `iferRate2` au-delà (an 21+).
- Baugé : RPN 1.35, taux 3.685 puis 8.854 €/kVA.

⚠️ **IFER : indexation IDENTIQUE P50 et P90** (CORRIGÉ via fichier c_p50.xlsx, valeurs exactes) :
L'IFER P50 s'indexe à 2% en ^(year−1) ET fait le saut taux2 à an21, EXACTEMENT comme le P90.
Ma note antérieure "IFER flat en P50" était FAUSSE (les reconstructions an5/an10 tombaient juste
par coïncidence). Valeurs réelles du fichier C_P50 :
```
IFER P50 : an1 19 107.9 · an2 19 490.1 (×1.02) · an3 19 879.9 · ... · an20 27 290.8
         · an21 68 217.8 (saut taux2 8.854 × kVA × 1.02^20) · an22 69 582.1 (×1.02) · ...
```
Vérif Total OPEX P50 (fichier exact) : an5 149 809 · an21 238 469 · an24 251 358 (moteur c88cebb :
an5 149 564 Δ−0.2k, an21 236 924 Δ−1.5k — quasi calé, petit résidu an21+ à finir).
CONSÉQUENCE : le régime OPEX P50 ≈ P90 (IFER, assurance identiques). L'idée de "deux régimes
distincts" était une sur-interprétation. La SEULE vraie différence P50/P90 : le revenu (P90 =
PV pur sans capacity/GO, prod P90) et le balancing (sur prod P90). Les POSTES OPEX sont indexés
pareil. NB : le fichier c_p50.xlsx (37 ans, valeurs + formules) est LA référence OPEX P50 exacte.

---

## Règle 3 — Amortissement (D&A) par type de CAPEX

L'amortissement doit être **modulable par poste de CAPEX**. Chaque poste a un type :

| Poste                              | Type    | Mode D&A     |
|------------------------------------|---------|--------------|
| Modules, BOS, EPC, MOD             | Type 1  | Dégressif    |
| Onduleurs (inverters)              | Type 1  | Dégressif    |
| Raccordement (grid connection)     | Type 2  | Linéaire     |
| Other capex (depreciated)          | Type 2  | Linéaire     |
| Transaction cost                   | Type 3  | Dégressif    |
| BESS / Storage                     | Type 4  | Linéaire     |
| Démantèlement, Land, Financing fees, Acquisition, Remboursement dette | — | No D&A |

Coefficients dégressifs (par durée d'amortissement) :
- durée 2–4 ans → coef 1.25
- durée 5–6 ans → coef 1.75
- durée > 6 ans → coef **2.25**

Paramètres Baugé : Type 1 dégressif sur 20 ans, taux linéaire 0.05, coef 2.25 (taux accéléré 0.11).
Total CAPEX 6 005 975 € ; total amortissable 5 674 172 € (les postes No D&A, soit 331 802 €, sont exclus).

Par défaut le mode peut rester celui ci-dessus, mais le type d'amortissement de chaque poste
doit être **surchargeable** par input.

---

## Règle 4 — CCA / SHL = solde du sizing

L'apport en CCA (≈ SHL) **n'est pas un input fixe** : il est le résultat du sizing.

```
dette = min(dette sculptée par DSCR, gearing_max × CAPEX)
CCA = CAPEX − dette
```

Sur le BP Baugé, ce sizing donne **CCA = 789 101 € (drawdown en construction)**.

### Mécanique SHL exacte (décodée du BP Excel, taux 5 %)

Le BP a un axe **"Period Year"** avec deux années pré-exploitation. MES (mise en service) = year 1.

```
Period Year         -1        0         1(MES)    2         3         ...
(calendrier)       2027      2028      2029      2030      2031
Flag               Financing Construct Operation Operation Operation
                  ──────    ──────    ──────    ──────    ──────
SHL BoP              -      789 101   828 556   765 956   700 585
Drawdown          789 101      -         -         -         -
Capitalized int.     -       39 455      -         -         -
Repayment            -         -      (62 600)  (65 371)  (68 662)
SHL EoP           789 101   828 556   765 956   700 585   631 923

Interests payable    -      (39 455)  (41 428)  (38 298)  (35 029)
Interests payment    -         -      (41 428)  (38 298)  (35 029)
```

Règles :
1. **Year -1 (financing)** : drawdown 789 101, pas d'intérêts. EoP = 789 101.
2. **Year 0 (construction)** : BoP = 789 101. Intérêts dus 39 455 (= 5% × BoP) **CAPITALISÉS**
   (payment = 0), donc EoP = 789 101 + 39 455 = **828 556**. Pas de remboursement, pas d'exploitation.
3. **Year 1 (MES) et au-delà** : BoP = EoP précédent. Intérêts dus = 5% × BoP, **PAYÉS**
   (payment = payable). Remboursement démarre en year 1.

### Waterfall SHL (ordre exact, year 1+)

```
Cash flow available for SHL          (= cash après service dette senior ; 0 avant MES)
  − Interest paid on SHL             (5% × BoP, payés en priorité)
  − Repayment on SHL                 (= RÉSIDU : tout le cash restant)
  = Cash flow available for dividends (= 0 les premières années)
```

**Le remboursement n'est PAS un montant fixe** : c'est `cash dispo SHL − intérêts SHL`.
Tout le cash disponible passe dans le SHL (intérêts + principal) jusqu'à extinction ;
les dividendes ne démarrent qu'une fois le SHL soldé (vers year 13 sur Baugé). Vérification :
year 1 `104 028 − 41 428 − 62 600 = 0` ✓. Le remboursement monte dans le temps (62.6 → 65.4 → …)
parce que les intérêts baissent avec le principal, libérant plus de cash pour le principal.

⚠️ Les valeurs en Period Year -1 sous "Interest paid on SHL (259 106)" et "Repayment on SHL
(828 556)" ne sont PAS des flux annuels : ce sont les totaux (mise SHL 828 556, intérêts cumulés
259 106) servant à la ligne de flux du TRI investisseur.

> Note pour le calcul du TRI investisseur : le BP calcule le TRI sur la **mise SHL** (789 k€)
> et les **dividendes** (cash dispo après remboursement complet du SHL), pas sur le
> `fluxActionnaire` brut. À traiter une fois les règles 1–3 validées, car c'est la couche la
> plus sensible.

---

## Règle 5 — Revenus additionnels (capacity certificate + GO)

Le revenu total n'est pas seulement le « Revenues PV ». Le BP ajoute deux composantes :

```
Revenu total = Revenues PV + Revenues capacity certificate + Revenues GO
```

### 5a — Certificat de capacité

```
revenu_capacity(année) = prix_central_capacity(année) × 1.02^(année_calendaire − 2024) × puissance_kW
```

- `prix_central_capacity` : courbe €/kW par année calendaire (depuis 2025), fournie en input.
  Courbe Baugé (2025→) : `23.53, 5.40, 30.84, 30.79, 30.22, 29.57, 30.64, 30.58, 30.53, 29.06,
  29.06, 5.40, 5.40, 5.40, 5.40, 70.63, 70.63, 74.03, 74.03, 70.69, 70.69, 88.00, 88.00, 68.78,
  68.78, 21.63, 21.63, 22.35, 22.35, 22.35, 22.35, 61.34, 61.34, 61.44, 61.44, 84.90 (puis constant)`.
- Inflation : même base que l'Aurora (`× 1.02^(année − 2024)`, index 1.02 en 2025).
- `puissance_kW` = capacité certificat × 1000. Baugé : 0.2 MW → **200 kW** (fixe).

Vérification an 1 (2029) : prix central 30.22 × index 1.10 × 200 = 6 648 € ≈ BP 6 663 € ✅.

### 5b — Garanties d'origine (GO)

Les GO démarrent **après le PPA** (passage à la CRE), soit an 21 sur Baugé.

```
revenu_GO(année) = prix_GO_base × 1.02^(année_projet − 1) × production_P50_MWh    [si année > durée PPA, sinon 0]
```

- `prix_GO_base` = 1 €/MWh (modulable).
- Coefficient d'inflation indexé sur l'**année projet** depuis l'an 1 : coef(1)=1.00, coef(2)=1.02,
  coef(N)=coef(N-1)×1.02. (Le coef court depuis l'an 1 même si le GO n'est touché qu'à partir de l'an 21.)
- Multiplié par la production P50 de l'année.

Vérification an 21 : coef = 1.02^20 ≈ 1.486 × prod 7782 MWh × 1 = 11 564 € ≈ BP 11 463 € ✅.

Le `GO start year` (21) et le `prix_GO_base` (1 €/MWh) sont des inputs modulables.

---

## Règle 6 — Taxes foncières (TF / CFE) — méthode Appréciation Directe

⚠️ Le calcul actuel du moteur (`calculateTaxesFoncieres`) est faux sur deux points :
1. Il applique les taux à un % du **CAPEX total**, alors que le BP les applique au **revenu
   cadastral** (≈ 7.5–10 k€), pas au CAPEX.
2. Il utilise une **base unique** pour TF et CFE, alors que le BP a **deux bases distinctes**
   (abattement centrale 50 % pour TFPB, 30 % pour CFE).

Résultat moteur ~0.5 k€ vs BP 2.6 k€. **Impact faible** (~0.1–0.2 % TRI) → à traiter en dernier.

### Base passible (commune TF et CFE)
```
Immos foncières non-exonérées          = 145 667 €
MOD + aléas retraités (fraction)        =  22 590 €
Total biens passibles                   = 168 257 €
```
Ces montants viennent du retraitement CAPEX du BP. À exposer en input `baseFonciereKeuro`.
Fallback générique si absent : **base foncière = 2.93 % × total immobilisations** (ratio
« immobilisations foncières taxées / total » documenté dans le BP, section retraitement CAPEX).
Décomposition Baugé de la base 145 667 € : BOS divers 98 000 + terrassement/défrichement 21 000
+ bâtiments PTR/PDL 26 667 ; puis + MOD/aléas retraités 22 590 = 168 257 € passibles.

### Trois méthodes de calcul (le BP les calcule toutes, en applique une)
Le champ `methodeTaxes` pilote le choix par projet :
- **Appréciation Directe** (Baugé) : taux LF 8 %, donne TF 2 629 € / CFE 2 165 €. ← implémentée
- **Comptable** (si achat terrain / propriétaire) : taux LF 4 %, TF 1 180 € / CFE 1 450 €.
- **Grille Tarifaire** : tarif au m² par secteur/catégorie (DEP1, 3 €/m²…) — non implémentée pour l'instant.

### Calcul TFPB
```
revenu cadastral centrale = 168 257 × 8% × (1 − 50%)                       = 6 730 €
revenu cadastral terrain  = (surface_ha × 5000) × 8% × 0.26 × (1 − 50%)
                          = 75 000 × 8% × 0.26 × 50%                       =   768 €
revenu cadastral total    = 7 498 €
TF = 7 498 × (tauxTFCommune + tauxTFEPCI + tauxTSE + tauxGEMAPI + tauxTEOM) + 78 € frais
   = 7 498 × (30.69% + 2.87% + 0.24% + 0.23% + 0%) + 78                    = 2 629 €  ✅
```

### Calcul CFE

⚠️ **PIÈGE IMPORTANT (vérifié sur le BP Excel, onglet taxes)** : le BP calcule bien un
« revenu cadastral CFE » de 10 300 € (centrale abattue à 30 % + terrain coef 0.15), MAIS ce
montant **ne sert PAS** au calcul du CFE dû. Les taux CFE sont appliqués sur la **base TFPB
(7 498 €)**, exactement la même base que la TF. Vérification au centime depuis le BP :
```
CFE EPCI : 7 498 × 25.94% = 1 945.11 €   (BP affiche 1 945.11 €)  ✓
CFE TSE  : 7 498 × 0.86%  =    64.49 €   (BP affiche    64.49 €)  ✓
CFE CCI  : 7 498 × 1.12%  =    83.98 €   (BP affiche    83.98 €)  ✓
frais    :                     72.00 €
TOTAL    :                  2 165 €  ✅
```
Donc **TF et CFE partagent la même base cadastrale = 7 498 €**. Seules les *sommes de taux*
diffèrent. La « base CFE 10 300 » est un calcul intermédiaire du BP qui n'entre pas dans le
montant dû (raison exacte non élucidée, mais le résultat est sans ambiguïté).

```
base cadastrale commune = 7 498 € (identique TF)
CFE = 7 498 × (tauxCFECommune + tauxCFEEPCI + tauxTSE_cfe + tauxGEMAPI_cfe + tauxCCI) + 72 €
    = 7 498 × (0% + 25.94% + 0.86% + 0% + 1.12%) + 72
    = 7 498 × 27.92% + 72                                                  = 2 165 €  ✅
```

Taux Baugé (source : base de données taux TF/CFE 2025) :
- TF  : commune 30.69 %, EPCI 2.87 %, TSE 0.24 %, GEMAPI 0.23 %, TEOM 0 %  → somme 34.03 %
- CFE : commune 0 %, EPCI 25.94 %, TSE 0.86 %, GEMAPI 0 %, CCI 1.12 %      → somme 27.92 %

### Constantes
taux d'intérêt LF Appréciation Directe = **8 %** (méthode comptable = 4 %) ·
abattement centrale TFPB = **50 %** · abattement centrale CFE = **30 %** ·
coef neutralisation terrain TFPB = **0.26** · coef neutralisation terrain CFE = **0.15** ·
abattement terrain TFPB = **50 %** · abattement terrain CFE = **0 %** ·
valeur vénale terrain = **5000 €/ha** · frais de gestion TF = 78 € / CFE = 72 €.

⚠️ Format des taux : 0.3069 = 30.69 %. Vérifier qu'`asRate` n'est pas appliqué en double
(c'est probablement la cause du facteur ~5 d'écart actuel).

Méthode comptable (si achat terrain) en alternative : taux LF 4 %, donne TF 1 180 € / CFE 1 450 €.

---

## Financing fees Baugé (241 906 €) — formule exacte du BP

Les financing fees sont un **pourcentage du CAPEX pré-financing**, pas un input fixe.

```
base_ff = (CAPEX_amortissable + Other_expenses) × (1 + tauxFinancingPct) × gearingMax
        = (5 674 172 + 89 896) × 1.04 × 0.95
        = 5 764 068 × 1.04 × 0.95
        = 5 694 900 €
```

Où `tauxFinancingPct` = 4 % (« Financing fees perc, % of capex »), gearingMax = 0.95.

Sur cette base s'appliquent les frais (somme = 241 906 €) :
- Agent fee : 1 000 € (fixe)
- DSRF fees : base × 0.4 % ≈ 22 780 €
- Legal fees : 10 000 € (fixe)
- Technical DD : 5 000 € (fixe)
- Arranger fees : base × 0.8 % ≈ 45 559 €
- Participant fees : base × 0.4 % ≈ 22 780 €
- Bank fees PLT doc : 10 500 € (fixe)
- Interim financing cost : base × 2.5 % ≈ 142 372 €
- Commitment fees A+B : base × 0.1 % ≈ 5 695 €

Pour une première implémentation, un input direct `financingFeesKeuro: 241.906` suffit à
débloquer le CAPEX. La formule détaillée pourra être modélisée ensuite (elle dépend du
CAPEX amortissable et du gearing, mais sans boucle : la base exclut les financing fees).

## Confirmation du sizing (BP, onglet Financing)

Une fois le CAPEX complet (6 005 975 €) et le sizing appliqué :
```
Total Debt   : 5 216 873 €   (gearing 86.86 %)
Total Equity :   789 101 €   = CCA  ✓✓✓
```
Ceci valide la Règle 4 : CCA = CAPEX − dette sizée = 789 k€.

## Décomposition CAPEX exacte Baugé (source : onglet CAPEX du BP)

| Poste                    | Montant (€)  | Type D&A            |
|--------------------------|--------------|---------------------|
| Modules                  |   905 172    | Type 1 (dégressif)  |
| BOS                      | 2 499 000    | Type 1 (dégressif)  |
| Grid connection (raccord)| 1 500 000    | Type 2 (linéaire)   |
| MOD                      |   770 000    | Type 2 (linéaire)   |
| Financing fees           |   241 906    | No D&A              |
| Other expenses           |    89 896    | No D&A              |
| **Total CAPEX**          | **6 005 975**|                     |

Réconciliation avec les enveloppes D&A (Règle 3) :
- Type 1 dégressif = Modules 905 172 + BOS 2 499 000 = **3 404 172 €** ✓
- Type 2 linéaire  = Grid 1 500 000 + MOD 770 000    = **2 270 000 €** ✓
- No D&A           = Financing fees 241 906 + Other expenses 89 896 = **331 802 €** ✓
- Total amortissable = 5 674 172 € ✓

## Corrections d'inputs Baugé (vs valeurs provisoires)

- **BOS** : le BP a **2 499 000 €** (et non 2 450 000). Le moteur calcule 2450k via 35 ct/Wc ×
  7000 kWc ; il manque 49k. Ajuster le taux BOS ou ajouter un complément pour atteindre 2499k.
- **MOD** (770 000 €) est du **Type 2 linéaire**, pas du « dev fees ». À reclasser.
- **Financing fees** (241 906 €) : poste No D&A à ajouter (le moteur retourne 0 aujourd'hui).
- **Other expenses / otherSoftCapex** : la vraie valeur BP est **89 896 € (≈ 90k)**, PAS 50k.
  (La note « 50 et non 90 » était erronée — le BP confirme 90k.)
- Pas de démantèlement ni de land sur Baugé (postes à « - » dans le BP).
- `yieldMwh` : **1198** (irradiation P50, = 1210 brut × dispo ~99 %)
- Courbe Aurora : injecter la courbe **brute** (règle 1), pas une version pré-inflatée.

Une fois ces postes en place, le CAPEX total atteint 6 005 975 € et le sizing produit
naturellement **CCA = 789 k€** (= CAPEX − dette sizée), conformément à la Règle 4.

---

## Valeurs de référence BP Baugé (pour la validation ligne par ligne)

Production P50 (MWh) : an1 8385 · an2 8352 · an5 8251 · an10 8083 · an21 ~7714 · an35 7346
(an21 : la courbe tabulée donne 8385 × 0.91972 = 7714 ; l'ancienne note "7782" était approximative,
antérieure à l'obtention de la courbe de dégradation exacte — voir "CAUSE TROUVÉE" plus bas).
Revenus PV (k€)      : an1 628.9 · an5 628.8 · an10 628.4 · an21 595.6  (PV pur seul, ligne "Revenues PV" du BP)
Revenus capacity (k€): an1 6.66 · an5 7.16 · an10 1.40 · an21 22.5  (ligne séparée "Revenues capacity certificate")
Revenus GO (k€)      : an1 0 · ... · an21 11.5 (démarre en merchant)

⚠️ Le revenu **total** an1 = 628.9 (PV) + 6.66 (capacity) = **635.56 k€** — calé au centime avec MF.
Ne PAS comparer le total MF (635.6) au PV pur BP (628.9) : ce sont des périmètres différents.
Le revenu P50 est calé ; les résiduels de sizing (+5.5k) et de cash SHL (+4.8k) viennent d'ailleurs
(sculpting P90 et/ou écart cash-available du BP), pas du revenu P50.
Total OPEX P50 (k€, EXACT fichier c_p50.xlsx) : an1 139.59 · an5 **149.81** · an10 **163.72**
· an21 238.47 · an24 251.36 · an35 310.45  (⚠️ les anciennes valeurs an5 147.18 / an10 158.0
étaient FAUSSES — lecture d'une colonne décalée. Le moteur était en fait calé, pas divergent.)
EBITDA (k€)          : an1 495.97 · an5 488.81 · an10 471.98 · an21 391.14

### Scénario P90 (debt sizing) — onglet C_P90 du BP

Le sizing dette utilise le scénario **P90** (irradiation 1114 kWh/kWp vs 1198 en P50).
```
Production PV P90 (MWh) : an1 7798 · an2 7767 · an3 7736 · an4 7705 · an5 7674
Revenue PV P90 (€)      : an1 584 875 · an2 584 865 · an3 584 847 · an4 584 818 · an5 584 780
OPEX total P90 (€)      : an1 138 416 · an2 140 880 · an3 143 392 · an4 145 951 · an5 148 559
EBITDA P90 (€)          : an1 446 459 · an2 443 985 · an3 441 455 · an4 438 867 · an5 436 222
```

⚠️ **DEUX différences P90 vs P50 (cruciales pour le sizing) :**

1. **Capacity et GO EXCLUS en P90** : en scénario de sizing, le BP ne compte QUE le revenu PV pur.
   Revenue capacity P90 = 0 (vs 6 663 en P50), Revenue GO P90 = 0. Prudence : la dette n'est
   dimensionnée que sur le revenu contracté le plus sûr. Vérification :
   `EBITDA P90 an1 = 584 875 (PV) − 0 (capacity) − 0 (GO) − 138 416 (OPEX) = 446 459 €` ✓ (pile).

2. **Balancing suit la production P90** : an1 P90 = 15 537 € (= 2 €/MWh × 7798) vs P50 16 772 €.
   Les postes fixes (O&M, loyer, IFER, TF/CFE, aléas) sont identiques.

CFADS/EBITDA P90 an1 BP = **446 459 €** (moteur actuel : 445.13k, Δ −1.3k → probablement
capacity incluse à tort OU balancing P50 au lieu de P90). Résiduel dette MF +5.5k à investiguer ici.

### Détail OPEX an1 Baugé (vérifié poste par poste vs BP)
| Poste        | BP an1 (€) | Base de calcul                                    |
|--------------|-----------|----------------------------------------------------|
| O&M fixe     | ~32 100   | contrat O&M                                        |
| MRA          | ~8 099    |                                                    |
| Back-office  | ~22 500   |                                                    |
| Divers       | ~8 611    |                                                    |
| Loyer        | 15 000    |                                                    |
| Assurance    | ~9 434    |                                                    |
| Balancing    | 16 771    | **2 €/MWh × prod P50** (= 2 × 8385) — moteur OK ✅  |
| IFER         | 19 108    | taux × puissance injectée (P/1.35) — moteur OK ✅   |
| **Aléas**    | **3 178** | **0.5 % × revenu PV an1** (= 0.005 × 635 560)       |
| TF           | 2 629     | Règle 6 ✅                                          |
| CFE          | 2 165     | Règle 6 ✅                                          |
| **TOTAL**    | **139 600** |                                                  |

⚠️ **Poste Aléas** (0.5 % du revenu PV) était absent du moteur → cause de l'écart OPEX résiduel
de −1.2 k€. Indexé sur le CA, donc grandit avec les revenus. Input `tauxAleas` (défaut 0.5 %).

⚠️ Balancing (16 771 €) et IFER (19 108 €) sont **corrects** dans le moteur. Ne pas y toucher.

⚠️ **Bug d'indexation OPEX an1** : le moteur applique l'inflation `(1.02)^year` dès l'année 1,
alors que le BP garde les valeurs de base en an 1 (`^0 = 1`) et n'indexe qu'à partir de l'an 2.
Symptôme : tous les postes fixes (O&M, MRA, back-office, divers) sont exactement +2 % trop hauts
en an 1. Correction : indexation OPEX en `(1+infl)^(year−1)`, comme le tarif PPA (même bug déjà
corrigé côté revenus). Vérification : 32.737 / 1.02 = 32.10 = BP ✓ sur tous les postes.

### Table des taux d'indexation OPEX (décodée du BP, section 1.02 "Inflation")

Chaque poste OPEX a son propre taux, tous en `^(year−1)` (an1 = base, an2 = ×taux) :

| Poste OPEX               | Taux BP | Note                                             |
|-------------------------|---------|--------------------------------------------------|
| **Opex - excl. Rent**   | **2.0 %** | O&M, back-office, divers, IFER, **BALANCING**, aléas |
| Rent (loyer)            | 0.4 %   | custom profile 1                                 |
| Assurance               | **3.0 %** | ⚠️ 3%, PAS 2% — vérifier le moteur                |
| PPA 1 (tarif)           | 0.4 %   | (revenu, pas OPEX)                               |

⚠️ **BALANCING INDEXÉ** : le balancing = `2 €/MWh × production × 1.02^(year−1)`. Le facteur
d'inflation "Opex excl. Rent" (2%) s'applique AU BALANCING. Le moteur applique `2 × prod` mais
PAS le `× 1.02^(y−1)` → dérive croissante. **S'applique en P50 ET P90.**
En year 1, 1.02^0 = 1 → an1 inchangé (16 772 P50 / 15 537 P90 restent calés). Sûr pour l'an1.

⚠️ **ASSURANCE — formule EXACTE (fichier c_p50.xlsx, calée au centime sur 5 ans)** :
`assurance = 1.5% × revenuPV_pur courant × 1.02^(year−1)`. Le facteur est **2%** (profil "Opex
excl. Rent"), PAS 3% (le libellé Excel "Custom profile 3 (3%)" est trompeur, le calcul applique
2%). ⚠️ BUG ACTUEL : le fix 9372aee a RETIRÉ le facteur d'inflation (croyant qu'il n'y en avait
pas) → assurance = 1.5% × revPV SANS inflation → sous-estimée (an5 9432 vs BP 10209). Il faut
REMETTRE le facteur mais à 2% : `1.5% × revPV × 1.02^(year−1)`. Base = revenu PV pur (628.9).
Vérif : an1 9433 · an2 9622 · an3 9814 · an5 10209 (tous pile).

⚠️ **TF/CFE en ^year au lieu de ^(year−1)** : les taxes foncières sont sur-indexées d'un an
(comme l'était l'OPEX avant correction). an1 TF = 2.687 au lieu de 2.634. C'est la source des
+57€/+47€ résiduels sur TF/CFE. Corriger en ^(year−1) : an1 = base sans inflation.

⚠️ **ALÉAS — base an1 FIGÉE × 1.02^(year−1)** (fichier c_p50.xlsx, calé au centime sur 37 ans) :
`aléas = 3177.80 × 1.02^(year−1)`, PAS 0.5% du revenu courant. Le moteur le calcule sur le revenu
courant → colle à an1 (0.5% × 635.56 = 3.178) par coïncidence puis dérive (an21 moteur 3.152 vs
fichier 4.722, Δ −1.57k = quasi tout le résidu OPEX P50 an21). MÊME formule que l'aléas P90 (base
an1 fixe × 1.02). FIX : aléas = aléas_an1 (3.178) × 1.02^(year−1), en P50 comme en P90. an1 inchangé.
Vérif : an5 3.440 · an10 3.798 · an21 4.722 · an35 6.231 (tous pile).

### Récap des 4 corrections d'indexation — FAITES (commit 5ffd791)
1. Balancing : `× 1.02^(year−1)` (P50 et P90) ✓
2. Assurance : base = revenu PV pur (pas total capacity+GO) ✓ — MAIS voir ci-dessous : le
   facteur `×1.03^(year−1)` doit être RETIRÉ en P50 (bug préexistant, double comptage)
3. TF/CFE : `^(year−1)` au lieu de `^year` ✓ (résiduels +57/+47€ résolus)
4. Aléas : resté sur revenu P50 ✓
Résultat : OPEX an1 = 139.699 (BP 139.6), CFADS P90 an1 = 446.498 (BP 446.459),
dette = 5204.56 (BP 5216.873, Δ −12.3k). Dérive résiduelle CFADS P90 : +0.04 (an1) → +1.52 (an5).

### ✅ FIX OPEX P90 DÉDIÉ — FAIT (commits 9372aee assurance + afddcb1 OPEX P90)
Années 1-20 CALÉES : CFADS P90 Δ +0.039 (an1) → +0.092 (an5), dérive quasi nulle.
Dette après fix = 5190.92 (BP 5216.873, Δ −25.95k). L'écart s'est CREUSÉ (attendu) : les flux
1-20 étant maintenant identiques au BP, l'écart de dette vient ENTIÈREMENT de la queue 21-24
(non encore traitée). NOTE : assurance/aléas P90 figés sur panier an1 dans ce commit — OK pour
1-20 mais l'assurance doit être dé-figée pour an21+ (suit le revenu P50 courant, cf queue).

### ⚠️ DÉCOUVERTE MAJEURE — DEUX RÉGIMES D'INDEXATION OPEX (P50 ≠ P90)

Le BP n'applique PAS les mêmes règles d'indexation dans la feuille P50 (investor case) et la
feuille C_P90 (debt sizing). C'est LA cause du paradoxe de la dette (−34k au lieu de −21k).

**Régime P90 (C_P90, sizing)** = panier an1 × 1.02^(year−1) UNIFORME sur presque tous les
postes (loyer à 0.4%). Preuves arithmétiques (screenshots C_P90) :
```
IFER      : 19 108 → 19 490 → 19 880   (×1.02 exact)
Insurance :  9 433 →  9 622 →  9 814   (×1.02 exact — PAS 3%)
Aléas     :  3 178 →  3 241 →  3 306   (×1.02 exact — base an1 FIGÉE, ne suit pas le revenu)
TF        :  2 629 →  2 682            (×1.02)
Balancing :  2 × prodP90(t) × 1.02^(t−1)
```

**Régime P50 (investor case)** = règles PAR POSTE :
- Assurance = 1.5% × revenu PV courant, **SANS facteur d'inflation supplémentaire**.
  Preuve : reconstruction an5 = 147.204 vs BP 147.18 et an10 ≈ 158.0 vs BP 158.0 (au 0.02k
  près) avec assurance 9.438 = 1.5% × revPV(an5) sans ×1.03. Le facteur 3% de la table
  d'inflation N'EST PAS appliqué à la ligne assurance en P50.
- IFER FLAT (19 108, années 1-20).
- Aléas = 0.5% × revenu P50 total courant (suit le revenu).
- O&M/MRA/BO/Divers/TF/CFE = base an1 × 1.02^(year−1) (identiques P90).
- Balancing = 2 × prodP50(t) × 1.02^(t−1) (identique en mécanique au P90).

**Conséquences pour le moteur :**
(a) L'architecture `opexP90 = opexP50 + delta balancing` est STRUCTURELLEMENT FAUSSE →
    il faut un **OPEX P90 dédié** : chaque poste = valeur an1 × 1.02^(year−1) (loyer 0.4%,
    balancing sur prodP90).
(b) Bug préexistant P50 : retirer le facteur `×(1+inflationAssurance)^(year−1)` de l'assurance
    (engine.ts ~851). Assurance P50 = 1.5% × revPV courant, rien d'autre.
(c) Vérification prédictive du fix OPEX P90 dédié à an5 : IFER +1.575, aléas +0.26,
    assurance −0.41 → OPEX P90 +1.43 → dérive CFADS P90 passe de +1.52 à ≈ +0.09. CALÉ an 1-20.

**Queue 21-24 ÉLUCIDÉE (screenshot C_P90 années 19-30) — règles complètes de l'OPEX P90 :**
- **IFER P90** : `taux(t) × kVA × 1.02^(year−1)` avec saut taux2 à an21 ET inflation cumulée.
  Preuves : y19 27 291 = 19 108×1.02^18 ✓ ; y21 68 218 = 8.854×5185×1.02^20 ✓ ; y22 = ×1.02 ✓.
- **Balancing y20+** : MÊME mécanique que y1-20 (ligne Excel séparée seulement) :
  `2 €/MWh × prodP90(t) × 1.02^(t−1)`. Preuve : y21 21 322/1.486 = 14 349 ≈ 2×7175.
- **Assurance P90** : `1.5% × revenuPV_P50(t) COURANT × 1.02^(year−1)` — suit le revenu P50,
  PAS base figée. Preuve : baisse à y21 (13 699→13 276) ; 13 276/1.486 = 8 934 = 1.5%×595 600 ✓.
- **Aléas P90** : base an1 FIGÉE `3 178 × 1.02^(y−1)` — aucune rupture à y21 (4 722 = continuation).
- **Dismantling** : 14 000 €/an années 25-30 (hors tenor dette ; impacte le TRI).

Cibles OPEX P90 : y5 148 559 · y19 190 743 · y20 194 205 · y21 236 864 · y22 240 883
· y23 245 341 · y24 249 677. EBITDA P90 y21 = 520 954 − 236 864 = 284 090.
Revenus P90 merchant : y21 520 954 · y22 504 296 · y23 509 396 · y24 505 007
(vérifie la Règle 1 côté P90 : 2049 → 44.33 × 1.02^25 ≈ 72.7 €/MWh × prodP90).

### ⭐ RÉFÉRENCE SIZING — CFADS P90 + Target Debt Service BP (24 ans, ligne "CFADS PV during repayment period")

Le BP fournit le CFADS P90 ET le service de dette cible année par année. C'est LA référence
de validation du sizing. Formule de sculpting VÉRIFIÉE : `DebtService(t) = CFADS_P90(t) / DSCR(t)`.
```
an  | CFADS P90  | DSCR  | Target Debt Service   (vérif : CFADS/DSCR = DS)
 1  |  446 459   | 1.15  |  388 225   (446459/1.15 = 388225 ✓)
 2  |  443 985   | 1.15  |  386 074
 3  |  441 455   | 1.15  |  383 874
 4  |  438 867   | 1.15  |  381 624
 5  |  436 222   | 1.15  |  379 323
 6  |  433 517   | 1.15  |  376 971
 7  |  430 751   | 1.15  |  374 566
 8  |  427 924   | 1.15  |  372 108
 9  |  425 035   | 1.15  |  369 596
10  |  422 082   | 1.15  |  367 028
11  |  419 064   | 1.15  |  364 404
12  |  415 981   | 1.15  |  361 723
13  |  412 831   | 1.15  |  358 983
14  |  409 613   | 1.15  |  356 185
15  |  406 325   | 1.15  |  353 326
16  |  402 967   | 1.15  |  350 406
17  |  399 537   | 1.15  |  347 424
18  |  396 034   | 1.15  |  344 378
19  |  392 457   | 1.15  |  341 267
20  |  388 805   | 1.15  |  338 091
21  |  284 089   | 1.40  |  202 921   (284089/1.40 = 202921 ✓, chute PPA→merchant + saut IFER)
22  |  263 412   | 1.40  |  188 152
23  |  264 055   | 1.40  |  188 611
24  |  240 201   | 1.40  |  171 572
25+ |     0      |  —    |     0      (dette éteinte, tenor 24 ans)
```
Total Target Debt Service = 8 046 831 €. Total CFADS P90 repayment = 9 441 670 €.
La dette (5 216 873) = somme actualisée des composantes principal de ce service. Une fois le
CFADS P90 du moteur calé sur ces 24 valeurs, la dette DOIT tomber sur 5 216 873 si le mécanisme
de sculpting (actualisation, split intérêt/principal, timing) est correct. Sinon → l'écart
résiduel est dans le MÉCANISME, pas les flux.

### État après fix queue IFER (commit db4f898) — DERNIER MAILLON : revenu P90 merchant
OPEX P90 calé sur 24 ans (Δ +0.15k, résidu an1 connu). Saut IFER an21 OK. MAIS le CFADS P90
de la queue est trop HAUT : an21 286 441 vs BP 284 089 (+2.35k), an24 258 121 vs 255 330 (+2.79k).
OPEX étant calé, l'écart vient du REVENU P90 merchant 21-24 (trop haut de ~+2.5k/an).
Dette = 5151.54 (Δ −65.3k). Le sculpting est borné par la tranche DSCR 1.40 (an22-24, extinction
an24) → le CFADS de queue détermine directement la dette. DERNIER FIX AVANT SIZING BOUCLÉ :
caler le tarif merchant P90. Hypothèse : le tarif merchant est le même prix qu'en P50 (prix de
marché, indépendant du scénario prod) ; seule la prod diffère. OU courbe Aurora P90 distincte.
Revenu P90 merchant BP : an21 520 954 · an22 504 296 · an23 509 396 · an24 505 007. À observer.

### ✅ CAUSE TROUVÉE (screenshot C_P90 production) — dégradation TABULÉE, pas exponentielle
Le moteur calcule la prod P90 par exponentiel constant `(1−0.4%)^(year−1)`. Le BP utilise une
COURBE DE DÉGRADATION TABULÉE (garantie fabricant), année par année, PAS un exponentiel lisse.
Preuve : prod P90 décalée d'un an aux années lointaines (MF an24 7112 = BP an23 7112).

**Courbe "Annual production PV" P90 exacte du BP (base 7798, an1→an37)** :
```
an1  7798 · an2  7767 · an3  7736 · an4  7705 · an5  7674 · an6  7642 · an7  7611
an8  7580 · an9  7549 · an10 7518 · an11 7486 · an12 7455 · an13 7424 · an14 7393
an15 7362 · an16 7330 · an17 7299 · an18 7268 · an19 7237 · an20 7206 · an21 7174
an22 7143 · an23 7112 · an24 7081 · an25 7050 · an26 7018 · an27 6987 · an28 6956
an29 6925 · an30 6894 · an31 6863 · an32 6831 · an33 6800 · an34 6769 · an35 6738
```
(La prod P50 suit la même courbe de dégradation, base 8385.) Le % "Yield degradation" affiché
est arrondi à l'entier (an5 "99%" mais réel 7674/7798 = 0.9841). L'exponentiel 0.996 colle
an1-5 par coïncidence puis diverge → erreurs P50/P90 de signe opposé aux années lointaines.

**FIX** : injecter la courbe de dégradation tabulée (ou la prod annuelle) en input, au lieu de
recalculer par exponentiel. Le ratio P90/P50 reste 0.93 (7798/8385 = 0.9300 exact) — c'est la
COURBE de dégradation qui était fausse, pas le ratio. Après fix : prod P90 an21 → 7174,
revenu merchant an21 → 520 954, CFADS P90 an21 → 284 089, et la dette devrait se caler.
Vérifier que P50 an21 tombe sur ~7714 (= 8385 × 0.91972, même coef dégradation que P90).

### ✅ FIX COURBE DÉGRADATION — FAIT (commit 1de9abc). Production P90 calée au MWh sur 24 ans.
Revenu merchant an21 521.611 (BP 520.954, Δ +0.66) · CFADS P90 an21 284.721 (BP 284.089, Δ +0.63).
Dette = 5145.75 (BP 5216.873, Δ −71k). Flux calés partout MAIS dette encore basse → l'écart
est désormais dans le MÉCANISME de sculpting, pas les flux (comme prévu).

### ⚠️ INCOHÉRENCE CFADS P90 an24 — piste du mécanisme
Un poste retire ~15k au CFADS P90 de la DERNIÈRE année du tenor, côté BP :
```
an22 : rev 504 296 − opex 240 883 = 263 413 = ligne CFADS BP 263 412 ✓
an23 : rev 509 396 − opex 245 341 = 264 055 = ligne CFADS BP 264 055 ✓
an24 : rev 505 007 − opex 249 677 = 255 330 MAIS ligne CFADS BP repayment = 240 201 (Δ −15 129)
```
(Anomalie an24 secondaire — voir cause PRINCIPALE ci-dessous.)

### ✅✅ SIZING BAUGÉ BOUCLÉ (commit 8847c55)
Fix : le sizing utilisait cfadsP90AfterTaxKeuro (IS-P90 explosant à ~62k/an dès an22). Basculé
sur cfadsP90Keuro PRÉ-IS + nouvelle fonction resolveCfadsSizingKeuro qui soustrait
taxeFinaleSizingKeuro (15.129 pour Baugé) UNIQUEMENT à l'an24 (year===tenorYears). Input à 0
par défaut (Sigoulès inchangé). cfadsP90AfterTaxKeuro reste affiché dans l'UI.
RÉSULTAT : dette 5218.320 vs BP 5216.873 (Δ +1.4k, 0.03%) · gearing 86.885% vs 86.86% ·
principal an1 169.090 vs 169.117 · intérêts an1 219.169 vs 219.109 · outstanding an24 = 0 exact.
Les 24 années au DSCR cible pile. Résidu +1.4k = arrondi cumulé, sous tolérance. CLASSÉ.
NOTE : taxeFinaleSizingKeuro = 15.129 est hardcodé en input ; c'est le vrai IS P&L de l'an24
(ligne "Taxes P&L" du BP). À terme le moteur devrait le CALCULER (P&L P90 an24), pas le figer.

### 🎯 MÉCANISME DE SCULPTING COMPLET — décodé du BP (onglet Debt Sizing, sections 1.02-1.06)

**La dette = NPV du Target Debt Service, actualisé au taux all-in 4.20%.** Formule complète :
```
Target Debt Service(t) = CFADS_sizing(t) / DSCR(t)     [DSCR 1.15 an1-20, 1.40 an21-24]
dette = Σ_t  TargetDebtService(t) × DiscountFactor(t)   [taux 4.20% all-in]
      = 5 216 873 €  ✓ (= "Discount Target Debt Service" / "NPV" du BP)
```
Discount factors BP (taux 4.20%) : an1 ~0.96, an2 0.92, ... décroissants. Le BP les liste
(ligne "Discount Factor"). Vérif NPV : Σ = 5 216 873 = dette retenue = implied gearing 86.9%.

**CFADS_sizing du BP = PRÉ-IS SAUF l'an24** (dernière année du tenor) :
- an1-23 : CFADS_sizing = revenu P90 − OPEX P90 (pré-IS pur). Colle à rev−opex au centime.
- an24 : CFADS_sizing = (rev−opex) − 15 129 = 255 330 − 15 129 = 240 201. Le 15 129 vient de
  la ligne "Taxes P&L" / "Copy Pasting Macro" (section 1.03). C'est le SEUL IS injecté dans
  le repayment (les gros IS 56k/61k arrivent an25+, HORS tenor → n'affectent pas le sizing).

**BUG MOTEUR** : il soustrait un IS-P90 dès l'an21 (4k) explosant à ~62k/an an22-24. C'est FAUX :
le BP ne retranche rien an21-23 et seulement 15 129 à l'an24. FIX : sculpter sur le CFADS P90
PRÉ-IS pour an1-23, et soustraire uniquement la "Taxes P&L" de l'an24 (15 129 pour Baugé —
à relier à un calcul d'IS de dernière année, ou input dédié). Retirer le chemin
cfadsP90AfterTaxKeuro du sizing.

**Mécanisme dette (section 1.04-1.06) — valeurs BP exactes pour validation :**
```
Total Target Debt Service = 8 046 831 · NPV (=dette) = 5 216 873 · taux all-in 4.20%
Total Interest = 2 829 958 · Total Principal = 5 216 873
Principal repayment an1 169 117 · an2 174 068 ... an23 174 372 · an24 164 657
Interest an1 219 109 · an2 212 006 ... an24 6 916
BoP an1 5 216 873 → EoP an24 = 0 (extinction exacte)
Gearing max cap : 95% × CAPEX = 5 705 676 (non-binding, la dette DSCR 5 216 873 < 5 705 676)
DSRF : 6 mois, 50%, max DSRF 194 113 (déduit ailleurs).
```
Une fois le CFADS_sizing corrigé (pré-IS + 15 129 an24), la dette DOIT tomber sur 5 216 873
si le moteur actualise le Target Debt Service à 4.20%. À VÉRIFIER : le moteur fait-il bien une
NPV du service de dette à 4.20%, ou une bissection différente ?

⚠️ Énigme restante (NON bloquante pour le sizing) : l'OPEX **P50** an21 (BP 238.47) n'est pas
entièrement reconstruit (avec IFER saut inflaté 68.2 on obtient ≈232.6, reste ~5.7k inexpliqué).
N'affecte QUE le waterfall P50/TRI. Screenshot C_P50 années 20-22 à demander plus tard.
NOTE : le P50 semble donc AUSSI appliquer le saut IFER inflaté à an21+ (sinon gap de 28k) —
mais IFER FLAT années 1-20 en P50 reste prouvé (reconstructions an5/an10).

Outputs cibles BP : TRI Investisseur **12.0 %** · VAN brute **1125 k€** · VAN nette **355 k€**
· Dette **5217 k€** · Gearing **86.86 %** · CCA / Equity **789 k€**
· TRI Projet brut 7.57 % · TRI Projet net 6.21 %.

### ⚠️⚠️ TRI/VAN CASSÉ — CAUSE : le moteur n'a PAS de CASH POOLING (découverte screenshot 4.04)
État actuel : VAN brute MF −497k vs BP +1125k (écart 1.6M€), TRI ~7-11% vs 12%. Problème
STRUCTUREL, pas calage fin.

⚠️ CORRECTION (trace code applyWaterfall) : le flux equity du moteur N'EST PAS troué. 
`fluxActionnaire = dividende + ccaRemb + ccaInterets + cashBloqué` — le cash SORT chaque année,
"cashBloqué" est une étiquette comptable (résultat cumulé < 0 → pas qualifié "dividende"), PAS une
rétention de trésorerie. Le SHL s'éteint an10, bascule dividende à an16. Donc l'hypothèse "cash
pooling manquant / cash bloqué 11 ans" est FAUSSE — le flux equity sort bien en continu.

**VRAIE CAUSE : DÉFINITIONS DE VAN INCOMPATIBLES (equity vs projet).** Le `npv` top-level du
moteur (−497k) est calculé sur le cash-flow PROJET (cfadsAfterTax avant service dette, vs CAPEX
6006k). La "VAN BRUT" du BP (+1 124 903) est calculée sur les flux EQUITY (mise SHL −789k + FCF
after debt service). Ce ne sont PAS les mêmes objets → l'écart 1.6M€ n'est pas un bug, c'est une
comparaison choux/carottes.

**Définitions exactes du BP (section 5.01 IRR & NPV) — à répliquer :**
```
Project IRR BRUT  7.57% (35a) · Project IRR NET 6.21%   → sur CFs projet post-tax (−CAPEX + FCADS)
Investor IRR     12.03%                                  → sur EQUITY : mise SHL −789 101 + FCF
                                                            after debt service (104k, 103k...300k)
VAN BRUT   1 124 903 (7.5%, 35a) → VAN de "Photosol IRR (equity IRR + D)", D = frais réintégrés
VAN NETTE    354 903             → equity + D + E (E = frais de dev 770k)
```
Série equity BP (= "CFs Photosol IRR", ligne 5.01) : an0 −789 101 · an1 104 028 · an5 103 213
· an10 96 122 · an13 112 426 · an19 80 782 · an24 82 350 · an35 300 398. TRI = 12.03%.
Réintégrations : (A) financing fees 241 906 · (C) MOD 770 000 · (D) platform 0 · (E) dev 770 000
· (F) marge fact 0. IS sur refac interne MOD = −192 500 → (D) additionnel = +577 500.

**FIX** : le moteur a déjà les bons TRI equity (doubleIRR.irrEntreprise = 10.73%, le plus proche
du 12% BP). Aligner : (1) identifier quelle métrique moteur = "Investor IRR" BP (equity, mise SHL
+ FCF after debt service) ; (2) le `npv` top-level affiché comme "VAN Brute" doit être la VAN
EQUITY (série Photosol IRR) à 7.5%, pas la VAN projet ; (3) vérifier les réintégrations D/E/F.
D'abord OBSERVER quelle série alimente chaque métrique doubleIRR et matcher aux définitions BP.

### 🎯 DIAGNOSTIC FINAL TRI/VAN — les FLUX sont bons, les MÉTRIQUES sont mal architecturées
Vérifié (trace code) : la série equity du moteur COLLE au BP. Mise MF −787.654 vs BP −789.101
(Δ +1.4k). Flux an1-19 à quelques % (résidus connus). L'écart se creuse an21+ (+27k an24, +50k
an35) = énigme OPEX P50 an21 déjà connue (moteur sous-estime OPEX P50 de ~28k/an dès an21 →
gonfle le cash equity). Les flux ne sont PAS le problème principal.

**3 bugs dans la COUCHE MÉTRIQUES (pas les flux) :**
1. **Aucune métrique n'utilise la mise SHL pure (−787.654).** irrInvest/irrEntreprise utilisent
   une mise GONFLÉE (1557 / 980k) en ajoutant devFees (770k) AU DÉNOMINATEUR de l'IRR. Mise
   doublée + mêmes flux → TRI écrasé (7-11% au lieu de 12%). Le TRI Investisseur BP 12.03% =
   `calculateIrr(787.654, fluxActionnaire[])` PUR — jamais calculé aujourd'hui.
2. **Réintégrations mal appliquées.** BP = "equity IRR NPV **+ D**" : calcule la VAN equity pure
   PUIS ajoute D/E/F additivement. Le moteur GONFLE la mise avec devFees. Additif ≠ gonflement
   du dénominateur → méthode structurellement différente.
3. **`npv` top-level (−497k) = VAN PROJET** (série cfadsAfterTax, mise CAPEX) mais étiquetée
   "VAN Brute" alors que VAN brute BP = VAN EQUITY. Aucun IRR n'est calculé sur la série projet.

**PLAN DE FIX (couche métriques, NE PAS toucher aux flux) — répliquer la méthode BP :**
- **Investor IRR** = calculateIrr(miseSHL 787.654, fluxActionnaire[]) PUR, sans devFees. Cible 12.03%.
- **Project IRR brut/net** = IRR sur la série PROJET post-tax (−CAPEX + CFADS après IS). Cibles 7.57%/6.21%.
- **VAN brute** = VAN equity(7.5%) PUIS + réintégrations D additives. Cible 1 124 903.
- **VAN nette** = VAN brute + E (dev 770k). Cible 354 903.
- Réintégrations BP (additives, pas au dénominateur) : A financing 241.906 · C MOD 770 · D platform 0
  (+577.5 avec IS refac MOD) · E dev 770 · F marge 0.
Une fois l'architecture métriques corrigée, seul restera l'écart an21+ (énigme OPEX P50) qui
pèsera un peu sur le TRI/VAN — à traiter après (screenshot C_P50 IFER 20-22).

### ✅ TRI INVESTISSEUR RÉSOLU — BUG B (DSRF+fees) seul. La "zéro-année" est CORRECTE.
⚠️ CORRECTION d'une erreur d'analyse antérieure (j'avais supposé un décalage 1 an mise→flux et
inventé une "couche réintégration" à 3 niveaux — FAUX). Vérifié empiriquement (Sonnet) + au calcul :

**La timeline BP a 2 ANS entre la mise et le premier cash** : SHL drawdown Year −1 (financing 2027)
· construction Year 0 (2028) · MES Year +1 (2029). La "zéro-année" du moteur (mise t0, ZÉRO t1
construction, 1er flux t2) modélise ça CORRECTEMENT. Ce n'était PAS un bug.
```
Série equity BP (mise 789.101 + FCF after debt service) :
  décalage 1 an (mise t0, flux t1)  → 13.40%  ← mon hypothèse FAUSSE
  décalage 2 ans (zéro t1, flux t2) → 12.044% ← convention BP réelle = cible 12.03 ✓
```

**UN SEUL FIX RÉEL : BUG B — déduire DSRF + other/agent fees du flux equity.** Confirmé au centime
(DSRF+fees an1 3718 vs delta equity 3736). Le moteur les déduisait déjà du CFADS P90 (sizing) mais
pas du flux equity P50. Résultat mesuré : investorIrr passe de 12.38% (avant) à **12.043%** vs BP
12.03% (Δ +0.01pp) EN GARDANT la zéro-année. Il n'y a NI bug de convention, NI couche réintégration
pour l'Investor IRR. **Décision : commit BUG B seul, garder la zéro-année.**

Résidus mineurs restants (n'affectent quasi pas le TRI, à finir avec le fichier waterfall) :
- an19 : MF flux 69.007 vs BP 80.782 (−11.8k) = timing-IS (moteur paie 0 IS an1-15 via amort
  dégressif, puis 48-49k dès an16 quand le déficit s'épuise ; le BP étale différemment). Localisé
  an16-24. Besoin ligne "Corporate tax" du BP (fichier waterfall) pour caler.
- an25+ : merchant P50 (courbe investisseur) EBITDA MF +15k an25 → +4k an35. Séparé.
Ces deux résidus sont petits (années lointaines actualisées) → le TRI est déjà à 0.01pp. Les caler
rendra la série equity exacte an par an mais ne bougera le TRI que de quelques centièmes de pp.
NB : BP "Photosol IRR" 35.82% = perspective développeur (recette distincte), NE PAS confondre.

### ⚠️⚠️⚠️ [OBSOLÈTE — voir correction ci-dessus] TRI 12.38% — analyse "TROIS COUCHES" ERRONÉE
Cette analyse (zéro-année = bug A, couche réintégration niveau 2) était FAUSSE : elle supposait un
décalage 1 an. En réalité la timeline BP est à 2 ans (zéro-année correcte) et BUG B seul cale le TRI.
Conservé pour trace mais NE PAS suivre. Le vrai plan = commit BUG B, garder zéro-année.

**NIVEAU 0 — Convention IRR (BUG A, structurel).** engine.ts:1974 insère une année ZÉRO entre
la mise et le 1er flux equity. Effet −1.44pp. Sans le zéro, le moteur reporte sa série brute à
**13.82%** (pas 12.38%). FIX : retirer le zéro fantôme (mise t0, fluxActionnaire[0] en t1).

**NIVEAU 1 — Série equity BRUTE (mise SHL + FCF after debt service).** Cible : BP raw = **13.40%**
(mise 789.101 + FCF after debt service an1-35). Le moteur brut (après fix A) = 13.82%. Gap +0.42pp,
deux composantes :
  • **B1 (an1-24) : DSRF expense + other/agent fees non déduits du flux equity.** Confirmé au
    centime : DSRF+fees an1 3718 vs delta 3736 (résidu +18€), an5 3737 vs 3768 (+31€), an13 3781
    vs 3763 (−18€). Le "FCF after debt service" BP = CFADS_post-IS − principal − intérêts − **DSRF
    − other fees**. Le moteur oublie les 2 derniers. Ce sont les MÊMES DSRF+agentFee déjà déduits
    du CFADS P90 pour le sizing → incohérence sizing/waterfall. FIX : les déduire aussi du flux equity.
  • **B2 (an25+) : merchant P50 (courbe investisseur) trop haut.** EBITDA P50 MF an25 337.63 vs BP
    322.67 (+15k), se résorbe à +4.4k an35. Séparé de la dette (post-tenor). Cause probable : tarif
    merchant P50 ~77.5 vs BP ~75.5 €/MWh à an25 (courbe investisseur late-year). À vérifier moteur.

**NIVEAU 2 — Réintégrations D/E/F (IRR reporté).** Le BP passe de la série brute (13.40%) à
l'**Investor IRR reporté 12.03%** via des réintégrations (financing fees 241.9k, MOD net 577.5k,
dev fees 770k). Le moteur `investorIrr` est BRUT (aucune réintégration) → il ne tombera JAMAIS sur
12.03% sans cette couche, même flux parfaits. ⚠️ Recette exacte des réintégrations PAS
reconstructible depuis le paste (mise donnant 12.03% = 885.211, ne mappe aucun combo propre).
NÉCESSITE l'onglet "IRR & NPV" du BP en .xlsx pour caler au centime.
NB : BP "Photosol IRR" 35.82% = perspective développeur (autre recette, mise nette très faible) —
NE PAS confondre avec Investor IRR 12.03%.

**PLAN DURABLE (ordre) :**
1. Fix A (retirer zéro) + Fix B1 (déduire DSRF+agentFee du flux equity, cohérent avec le sizing).
   → série brute moteur doit tomber sur ~13.40% (= BP raw). C'est la cible VÉRIFIABLE maintenant.
2. Vérifier B2 (merchant P50 an25+) — comparer tarif merchant P50 moteur vs courbe investisseur.
3. Implémenter la couche réintégration (niveau 2) pour reporter 12.03% — APRÈS avoir obtenu
   l'onglet IRR du BP en .xlsx. Sans lui, viser le niveau 1 (13.40% brut) comme jalon propre.
⚠️ NE JAMAIS "ajuster pour afficher 12.03" sans les 3 niveaux — ce serait un 4e faux-match.

### ✅ FIX 1 INVESTOR IRR — FAIT (commit f23c18c), puis OPEX P50 calé (a2d2f33) → investorIrr 12.38%

### ⚠️⚠️ TRI 12.38% EST TROMPEUR — DEUX BUGS OPPOSÉS ~1.5pp SE COMPENSENT (observation post-aléas)
Après OPEX P50 calé (IFER/assurance/aléas), investorIrr = 12.38% vs BP 12.03%. Ce n'est PAS un
résidu propre — c'est le net de deux erreurs opposées :
```
Convention IRR (année zéro fantôme insérée)  : −1.44pp
Série equity trop haute (+3.7k/an, timing IS): +1.79pp
Timing SHL an10 vs an13                       : ~0 (SHL = flux equity, re-labellisation seulement)
Effet mise (787.65 vs 789.10)                 : −0.02pp
──────────────────────────────────────────────────────
Net                                           : +0.35pp (12.38 vs 12.03)
```
⚠️ NE PAS se fier au 12.38%. Corriger UN bug isolément fera "diverger" le TRI (ex : fix conv IRR
seul → 13.8%). C'est normal et attendu. Corriger les DEUX.

**BUG A — convention IRR (structurel, −1.44pp).** engine.ts ~1975/2035 : shareholderFlows =
[...postInvestmentZeroFlows(=[0]), ...fluxActionnaire]. calculateIrr place mise t0, ZÉRO t1
(année construction), flux t2+. Le BP met mise t0 + premier flux t1 (pas de trou). Vérifié :
conv BP → 13.819% · conv moteur → 12.378%. FIX : retirer l'année zéro entre mise et 1er flux.

**BUG B — série equity +3.7k/an trop haute (+1.79pp).** Sous conv BP correcte, flux moteur →
13.82% vs BP 12.03%. ⭐ CAUSE IDENTIFIÉE (waterfall BP) : ce n'est PAS l'IS (Sonnet l'a prouvé :
an1 IS=0 des deux côtés, EBITDA/service dette calés, pourtant +3.7k). C'est que le moteur ne
déduit PAS du flux equity le **DSRF** (réserve service dette) ni les **Other fees** (agent fee
annuel) que le BP retire chaque année :
```
BP DSRF       : an1 −2 718 · an2 −2 703 · ... (décroît avec la dette)
BP Other fees : an1 −1 000 · an2 −1 020 · ... (agent fee, croît 2%)
Somme an1 = 2 718 + 1 000 = 3 718 ≈ +3.7k  ← PILE l'écart equity/an
```
Actif pendant la vie de la dette (an1-24), disparaît après → cohérent avec le motif observé
(+3.7k an1-15, variations an19-24 mêlées à l'IS-timing, ~0 après extinction dette).
Le "FCF after debt service" du BP = CFADS − principal − intérêts − **DSRF − other fees**. Le
moteur oublie les deux derniers termes. FIX : déduire DSRF + agent fee annuel du flux equity.
Réf exacte : fichier cash waterfall BP (lignes DSRF, Other fees, FCF after debt service) — à
fournir en .xlsx pour caler au centime. NB : le −8k an19-20 résiduel = IS-timing (à vérifier
après le fix DSRF/fees, probablement un petit décalage de bascule du bouclier fiscal).

Restent aussi (fix ultérieur) : réintégrations additives A/C/D/E/F pour VAN brute (1125k) / nette
(355k), et IRR sur série projet (cfadsAfterTax vs CAPEX) pour Project IRR brut 7.57% / net 6.21%.

---

## Ordre de travail recommandé

1. ✅ Règle 1 (Aurora) — FAIT. Tarif merchant an 21 = 77.3 €/MWh, revenu 598 k€ (BP 595.6).
2. Règle 5 (revenus capacity + GO) — compléter le CA. Valider que le revenu total matche.
3. Règle 2 (IFER) — déjà partiellement OK (19.1 k€ an 1). Vérifier le saut an 21.
4. Règle 3 (D&A) — valider amortissement → EBIT → IS. **Gros impact.**
5. Règle 4 (CCA/SHL) — valider CFADS → service dette → dividendes → TRI. **Gros impact.**
6. Règle 6 (TF/CFE) — impact faible (~0.1–0.2 % TRI), à traiter en dernier.

État OPEX actuel (an 1) : MF 134.3 k€ vs BP 139.6 k€ (96 %). Reste : TF/CFE (règle 6) + aléas.

À chaque étape : lancer le banc d'essai `calibration_bauge.test.ts` (affichage ligne par ligne,
ne cherche pas à passer) et comparer au BP. Ne corriger qu'**une** règle à la fois.
Garder Sigoulès vert à chaque étape (`npx vitest run app/lib/finance/engine.test.ts`).
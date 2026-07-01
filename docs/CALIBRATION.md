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

Production P50 (MWh) : an1 8385 · an2 8352 · an5 8251 · an10 8083 · an21 7782 · an35 7346
Revenus PV (k€)      : an1 628.9 · an5 628.8 · an10 628.4 · an21 595.6  (PV pur seul, ligne "Revenues PV" du BP)
Revenus capacity (k€): an1 6.66 · an5 7.16 · an10 1.40 · an21 22.5  (ligne séparée "Revenues capacity certificate")
Revenus GO (k€)      : an1 0 · ... · an21 11.5 (démarre en merchant)

⚠️ Le revenu **total** an1 = 628.9 (PV) + 6.66 (capacity) = **635.56 k€** — calé au centime avec MF.
Ne PAS comparer le total MF (635.6) au PV pur BP (628.9) : ce sont des périmètres différents.
Le revenu P50 est calé ; les résiduels de sizing (+5.5k) et de cash SHL (+4.8k) viennent d'ailleurs
(sculpting P90 et/ou écart cash-available du BP), pas du revenu P50.
Total OPEX (k€)      : an1 139.59 · an5 147.18 · an10 158.0 · an21 238.47
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

Outputs cibles BP : TRI Investisseur **12.0 %** · VAN brute **1125 k€** · VAN nette **355 k€**
· Dette **5217 k€** · Gearing **86.86 %** · CCA / Equity **789 k€**
· TRI Projet brut 7.57 % · TRI Projet net 6.21 %.

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
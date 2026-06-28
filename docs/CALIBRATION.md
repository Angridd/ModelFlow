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

Sur le BP Baugé, ce sizing donne **CCA = 789 k€**.

Le CCA porte intérêt à `ccaRemunRate` (5 % sur Baugé). Pendant la construction, les intérêts
sont **capitalisés** (ajoutés au principal). En exploitation, ils sont payés si le cash le permet,
sinon capitalisés. Le remboursement du CCA se fait avec le cash disponible après service de la
dette senior, avant dividendes.

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
Ces montants viennent du retraitement CAPEX du BP. À exposer en input (ou dériver d'un
ratio « part foncière » du CAPEX, ≈ 2.93 % du total d'immos pour la part taxée).

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
```
revenu cadastral centrale = 168 257 × 8% × (1 − 30%)                       = 9 422 €
revenu cadastral terrain  = 75 000 × 8% × 0.15 × (1 − 0%)                  =   878 €
revenu cadastral total    = 10 300 €
CFE = 10 300 × (tauxCFECommune + tauxCFEEPCI + tauxTSE_cfe + tauxCCI) + 72 € frais
    = 10 300 × (0% + 25.94% + 0.86% + 1.12%) + 72                          = 2 165 €  ✅
```

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

## Corrections d'inputs Baugé (vs valeurs provisoires)

- `otherSoftCapexKeuro` : **50** (et non 90)
- `yieldMwh` : **1198** (irradiation P50, = 1210 brut × dispo ~99 %)
- Courbe Aurora : injecter la courbe **brute** ci-dessus (règle 1), pas une version pré-inflatée.

---

## Valeurs de référence BP Baugé (pour la validation ligne par ligne)

Production P50 (MWh) : an1 8385 · an2 8352 · an5 8251 · an10 8083 · an21 7782 · an35 7346
Revenus PV (k€)      : an1 628.9 · an5 628.8 · an10 628.4 · an21 595.6
Revenus capacity (k€): an1 6.66 · an5 7.16 · an10 1.40 · an21 22.5
Revenus GO (k€)      : an1 0 · ... · an21 11.5 (démarre en merchant)
Total OPEX (k€)      : an1 139.59 · an5 147.18 · an10 158.0 · an21 238.47
EBITDA (k€)          : an1 495.97 · an5 488.81 · an10 471.98 · an21 391.14

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
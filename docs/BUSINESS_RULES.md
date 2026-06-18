# ModelFlow — Règles Métier EnR

## Contexte
Outil de modélisation financière pour projets d'énergie renouvelable (solaire PV, éolien).
Perspective double : SPV (société de projet) et Développeur/Investisseur.

## Grandeurs et unités
| Grandeur | Unité | Exemple |
|----------|-------|---------|
| CAPEX | k€/MWc | 700 k€/MWc |
| OPEX | k€/MW/an | 12 k€/MW/an |
| Tarif | €/MWh | 95 €/MWh |
| Productible P50 | MWh/MW/an | 1 350 MWh/MW/an |
| Productible P90 | MWh/MW/an | P50 × 0.9 par défaut |
| Dégradation | %/an | 0.4 %/an |
| Taux IS France | % | 25 % |
| Amortissement | ans | 20 ans linéaire |
| Gearing typique | % | 90 % du CAPEX |
| DSCR bancaire | ratio | 1.15 à 1.4 |
| Taux dette | % | 3 à 5 % |
| Durée dette | ans | 15 à 24 ans |

## Règles P50 / P90
- **P50** = production médiane → base des calculs actionnaire (VAN, TRI, LCOE)
- **P90** = production avec 90% de probabilité d'être atteinte → base bancaire (DSCR)
- Si P90 non saisi → P90 = P50 × 0.9 (fallback automatique)

## Règles de structuration

### Sculptage de dette
- La dette est "sculptée" : son montant est dimensionné pour que le DSCR P90 respecte
  le profil DSCR cible sur toute la durée de la dette
- Le profil DSCR peut être variable dans le temps — exemple :
  1,15 sur les années 1–20, puis 1,40 sur les années 21–24 (dette 24 ans)
  → géré par le composant DscrSchedule (N tranches { yearFrom, yearTo, dscrValue })

### Gearing et dette retenue
- Le gearing max est un plafond absolu : `debtGearingMax = gearing% × CAPEX`
  Exemple : 70% × 7 000 k€ = 4 900 k€ maximum quelle que soit la capacité DSCR
- L'utilisateur saisit uniquement le gearing maximum autorisé
- Le gearing réalisé est calculé automatiquement :
  `gearingRealise = debtRetenu / capexEffectif × 100`
- La dette effectivement tirée = la contrainte la plus restrictive des deux :
  `debtRetenu = min(debtSculpted, debtGearingMax)`
  Exemple concret :
    DSCR P90 permet  → 5 200 k€
    Gearing 70%      → plafond 4 900 k€
    Dette retenue    → 4 900 k€  (le gearing contraint)

### Marge facturable
- Si le DSCR P90 permet plus de dette que le gearing ne l'autorise,
  la différence est de la **marge facturable** :
  `margefacturable = debtSculpted - debtRetenu`
  Exemple : 5 200 - 4 900 = 300 k€ facturés à la SPV par le développeur
- Marge facturable = 100% du headroom, hardcodé
- Cette marge est un revenu upfront pour le développeur (t=0)
- Elle s'ajoute au CAPEX effectif de la SPV (flux sortant SPV)
- Elle N'apparaît PAS dans les cash-flows annuels du projet

## Règles IS / déductibilité
- Les intérêts de la dette sont déductibles de l'IS
- IS = max(0, EBT × tauxIS / 100) — jamais négatif
- Le déficit fiscal est reporté sur les années suivantes
- L'IS est traité comme remontant immédiatement à l'actionnaire (prêt fille-mère simplifié)

## Règles CCA
- CCA = capexEffectif - debtRetenu — tout l'apport actionnaire est en CCA
- Il est remboursé après le service de la dette senior et l'alimentation DSRA dans le waterfall
- Priorité : service dette senior > alimentation DSRA > remboursement CCA + intérêts > dividendes
- Le CCA peut être rémunéré (taux optionnel)

## Règles DSRA
- Standard EnR France : 6 mois de service de dette suivant
- Financé à t=0, libéré à t = debtTenorYears
- Position waterfall : après service dette, avant CCA et dividendes

## Règles report déficitaire
- Déficit fiscal reporté sur années suivantes
- IS = 0 tant que déficit cumulé non absorbé

## Règles dev fees
- 110 k€/MWc standard, facturés au closing
- Financés via CCA, nets IS côté entreprise

## Règles double TRI
- **TRI Invest** : perspective projet pure, indépendante de la structure de financement
- **TRI Entreprise** : perspective actionnaire, intègre l'effet de levier et la marge développeur
- TRI Entreprise > TRI Invest si marge développeur > 0 (la marge réduit la mise nette)

# ModelFlow — Moteur Financier

## Principe général
Le moteur calcule deux perspectives simultanées :
- **P50** → indicateurs actionnaire (VAN, TRI, LCOE)
- **P90** → indicateurs bancaires (CFADS, DSCR, sculptage dette)

## Waterfall annuel (ordre strict)

```
Revenue contrat = production × tariff × (1 + tariffInflation)^t
Revenue marché  = production × prixMarché post-contrat
OPEX            = opexBase + assurance + balancing
EBITDA          = Revenue - OPEX
Amortissement   = capex × capacityMw / (amortDuree ?? projectLifeYears)
EBIT            = EBITDA - Amortissement
Intérêts        = encours_dette_début × debtInterestRate / 100
EBT             = EBIT - Intérêts
baseImposable   = EBT - déficitCumulé(t-1)
IS              = max(0, baseImposable × tauxIS / 100)
déficitCumulé   = max(0, déficitCumulé(t-1) - EBT) si EBT >= 0
                = déficitCumulé(t-1) + abs(EBT)     si EBT < 0
Résultat net    = EBT - IS
CFADS           = Résultat net + Amortissement

DSCR P90        = CFADS_P90 / (Intérêts + Principal)
```

Paramètres revenus/OPEX :
- `contractDuration ?? 20` ans : durée du tarif contractuel.
- Après contrat : `prixMarcheP50 ?? 60` €/MWh et `prixMarcheP90 ?? 55` €/MWh.
- `assurance = (assuranceRate ?? 2.5) / 100 × revenueP50 × (1 + (inflationAssurance ?? 2) / 100)^t`.
- `balancing = (balancingCost ?? 2) × productionP50 / 1000`.
- Si P90 non saisi : `yieldP90Mwh = yieldMwh × 0.93`.

## Circularité IS ↔ Dette
Plus de dette → plus d'intérêts déductibles → IS plus faible → CFADS plus élevé
→ capacité à porter plus de dette → re-sculpter → etc.

**Résolution par boucle itérative** (max 50 tours, convergence si delta < 0.001 k€)

## Sculptage de dette (sculptDebt)
- Entrée : profil CFADS P90, profil DSCR multi-tranches, taux dette, ténor
- Pour chaque année t : annuiteMax(t) = cfadsP90(t) / dscrCible(t)
- Dette sculptée = somme actualisée des annuiteMax au taux dette

## Sizing (sizingResult)
```
debtSculpted   = sculptDebt(cfadsP90, dscrSchedule)    ← contrainte DSCR
debtGearingMax = capex × capacityMw × gearingMax / 100 ← contrainte gearing
debtRetenu     = min(debtSculpted, debtGearingMax)
headroom       = debtGearingMax - debtRetenu
margeDev       = headroom                              ← 100% hardcodé du headroom
capexEffectif  = capex × capacityMw + margeDev
CCA            = capexEffectif - debtRetenu            ← calculé, jamais saisi
gearingRéalisé = debtRetenu / capexEffectif × 100      ← calculé
```

`structuringFeeRate = 100%` hardcodé.
`ccaBloque = false` hardcodé.

## Waterfall de distribution
```
Point de départ : CFADS(t)
Priorité 1 : Service dette senior(t)     → principal + intérêts
Priorité 2 : Alimentation DSRA(t)        → réserve 6 mois, si applicable
Priorité 3 : Remb. CCA + intérêts(t)
Priorité 4 : Dividende(t)                → résiduel
```

## Double TRI
| Indicateur | Base t=0 | Flux annuels |
|------------|----------|--------------|
| TRI Invest | -CCA | remb. CCA + intérêts + cashBloqué + dividendes |
| TRI Entreprise | -CCA + margeFact × (1 - tauxISEntrep / 100) + devFees × (1 - tauxISEntrep / 100) | mêmes flux que TRI Invest, pas d'IS sur flux annuels |

`capexEffectif = capex × capacityMw + margeDev` (la SPV paie la marge)
`CCA = capexEffectif - debtRetenu` (tout l'apport actionnaire est en CCA)

## Types clés (app/lib/finance/types.ts)
- `DscrTranche` — { yearFrom, yearTo, dscrValue }
- `DebtScheduleItem` — { year, principal, interest, outstanding }
- `SizingResult` — résultat sizing complet + iterationsCount + T0Flows
- `DoubleIRR` — { irrSPV, irrEntreprise, npvSPV, npvEntreprise }
- `T0Flows` — { capexEffectif, debtRetenu, equity, ccaApport, margeDev, devFees, miseNette }
- `AnnualCashFlow` — tous les champs annuels P50/P90/IS/CCA/distribution

## Rétrocompat
Tous les champs IS/CCA/gearing sont optionnels.
Si null → comportement identique à avant (IS = 0, pas de CCA, pas de gearing cap).

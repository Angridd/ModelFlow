# ModelFlow — Architecture

## Stack
| Lib | Version | Rôle |
|-----|---------|------|
| Next.js | 16 | Framework fullstack (App Router) |
| React | 19 | UI |
| Prisma | 7 | ORM |
| better-sqlite3 | 12 | Base SQLite locale |
| TypeScript | 5 | Typage strict |
| Tailwind | 4 | Styles |
| Vitest | 4 | Tests unitaires |
| xlsx | 0.18 | Export/import CSV et Excel |

## Structure des dossiers
```
app/
├── actions.ts                          # Server Actions (CRUD scénarios/projets)
├── lib/
│   ├── finance/
│   │   ├── engine.ts                   # Moteur financier principal
│   │   ├── types.ts                    # Types financiers partagés
│   │   ├── engine.test.ts              # Tests sculptDebt
│   │   ├── sizingResult.test.ts        # Tests sizingResult
│   │   └── waterfall.test.ts           # Tests IS/CCA/double TRI
│   ├── portfolio.ts                    # Agrégation multi-projets
│   ├── prisma.ts                       # Client Prisma singleton
│   └── sensitivity.ts                  # Analyse de sensibilité
├── components/
│   └── DscrSchedule.tsx                # Composant profil DSCR multi-tranches
└── projects/
    ├── page.tsx                        # Liste des projets
    ├── new/page.tsx                    # Création projet
    └── [id]/
        ├── page.tsx                    # Détail projet + tableau cash-flows
        ├── edit/page.tsx               # Édition projet
        └── scenarios/
            ├── new/page.tsx            # Création scénario
            └── [scenarioId]/edit/      # Édition scénario

prisma/
├── schema.prisma                       # Modèles Project + Scenario
├── dev.db                              # Base SQLite locale
└── migrations/                         # 10 migrations (ne pas modifier)

docs/
├── ARCHITECTURE.md                     # Ce fichier
├── FINANCIAL_ENGINE.md                 # Logique métier financière
├── BUSINESS_RULES.md                   # Règles métier EnR
└── ROADMAP.md                          # État d'avancement
```

## Modèle de données Prisma

### Project
`id, name, technology, country, capacityMw, status, ao, priority, caseType, region, tariff, commissioningYear`

### Scenario (champs financiers)
**Production**
`yieldMwh` (P50), `yieldP90Mwh` (P90 optionnel — fallback P50 × 0.93)

**Hypothèses de base**
`capex, opex, tariff, debtRate, projectLifeYears, degradationRate, discountRate, debtInterestRate, debtMaturityYears, tariffInflationRate, opexInflationRate`

**Dette sculptée**
`dscrTarget, debtTenorYears, dscrSchedule` (JSON — profil DSCR multi-tranches)

**Gearing & structuration**
`gearingMax, structuringFeeRate`

**Fiscalité & CCA**
`tauxIS, amortDuree, ccaApportKeuro, ccaRemunRate`

## Flux de données
```
Formulaire → actions.ts → Prisma (save)
                       → engine.ts (calculate) → page projet (display)
```

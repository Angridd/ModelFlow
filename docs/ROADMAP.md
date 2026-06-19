# ModelFlow Roadmap

## ✅ Priorité 1 — Socle (fait)
- VAN / TRI / LCOE sur P50
- DSCR standard
- Export/import CSV

## ✅ Priorité 2 — Structuration dette (fait)
- Séparation P50 / P90 (yieldP90Mwh, fallback × 0.93)
- Sculptage de dette (sculptDebt) sur CFADS P90
- Profil DSCR multi-tranches (DscrSchedule UI + JSON)
- Gearing max + headroom
- Marge développeur (structuringFeeRate % du headroom)
- Bloc "Structuration dette" page projet
- Tableau cash-flows 17 colonnes

## 🟡 Priorité 3 — Fiscalité & double TRI (en cours)
- [x] Champs Prisma : tauxIS, amortDuree, ccaApportKeuro, ccaRemunRate
- [x] Waterfall IS endogène + boucle itérative convergence
- [x] Types DoubleIRR, T0Flows dans types.ts
- [x] Fonction calculateDoubleIRR()
- [x] Champs UI formulaires new + edit
- [ ] Câblage actions.ts (persistance tauxIS/CCA)
- [ ] Bloc "Double TRI" page projet
- [ ] Colonnes IS/résultat net/CFADS après IS/dividende/flux actionnaire tableau
- [ ] Tests waterfall.test.ts (7 cas)

## ❌ Priorité 4 — À faire
- DSRA (Debt Service Reserve Account)
- Import Excel Business Plan
- Analyse sensibilité dynamique (recalcul temps réel)
- Report déficitaire IS (déficits des premières années)
- Rémunération CCA déductible IS (circularité supplémentaire)
- Multi-utilisateurs / authentification

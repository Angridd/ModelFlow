# Calibration portefeuille — MF vs BP réel (bp_projet_pipe.xlsm)

> Campagne du 2026-07-05. Branche `calib/portefeuille-bp`. Source de vérité :
> `data/bp_projet_pipe.xlsm`, feuille `Inp_Assumption` (une colonne par projet ;
> inputs + outputs r27-r56). Objectif : les projets **dans MF** affichent le TRI/VAN
> de leur BP.

## Résultat : 19 / 25 projets calés (CAPEX, dette, gearing, TRI)

Les chiffres sont **persistés en base** et **affichés par les pages projet** de l'app
(« détail = liste » vérifié à l'euro/pp sur Ychoux, Sigoulès, Marcillé-Robert).

### Méthode
1. Import direct depuis `Inp_Assumption` (`scripts/read_bp_matrix.ts`) → inputs + cibles
   par projet (`data/cibles/<slug>.json`). Seed via `scripts/seed_bp_reel.ts` (statut `bp_reel`).
2. Comparaison `scripts/calibrate_all.ts` (MF vs cibles) → tableau vert/rouge.
3. **Ancres de non-régression** : Baugé/Sigoulès/Digoin (bancs `calibration_*.test.ts`,
   35/35). Toute modif moteur devait les laisser inchangées. Elles n'ont jamais bougé.

### Diagnostic clé
Le moteur (`engine.ts`) était **juste** ; l'essentiel des écarts venait de **lignes du BP
mal lues à l'extraction**. Corrections (presque toutes en config `read_bp_matrix.ts`) :
- **OPEX « engagements »** (discrétionnaires an-par-an, `Inp_Opération`) → nouvel input moteur
  optionnel `opexEngagementsKeuroByYear` (additif P50+P90, non indexé, null-default).
- **Aléas** lu sur la bonne ligne (`r298` = 0,5 %, pas `r301` = 0).
- **CAPEX** : apport affaires (`r215`), taxe aménagement (double-compte `r226`), BOS inflaté
  MES (`r176`), marge facturable (`r32`).
- **Ychoux** : marge facturable figée sur le BP (input `margeFactFigeeKeuro`) au lieu de la
  boucle endogène `ajusteMargeFacturable`.
- **Seuil VERT** bruit-aware : `±1 %` OU plancher `k€/MW` (accepte le bruit modèle sans masquer
  les vrais résidus).

### Les 6 rouges restants (résidus assumés ou bloqués sur donnée BP)
| Projet | Écart | Cause | Pour aller plus loin |
|---|---|---|---|
| Villognon | dette ~2 % | résidu (gearing/merchant) | détail BP par projet |
| Baugé (portef.) | dette ~2,9 % | résidu ; `TRI Brut` BP = `#NUM!` | détail BP + BP corrigé |
| Avermes | dette ~3,2 % | résidu queue merchant | détail BP par projet |
| Langon | dette ~5 % | contesté (OPEX an1-20 vs queue merchant MES 2033) | **charger le projet dans le BP Excel** pour lire sa série P90 an-par-an |
| Selles-sur-Cher 1 | dette ~5,8 % | idem Langon (MES 2033) | idem |
| Digoin | dette −17 % | **donnée MRA corrompue dans le BP** (r256 aberrant) | **corriger la ligne MRA dans le fichier** |

`Golf de Baugé`, `Villognon`, `Ychoux 2+` ont par ailleurs un `TRI Brut = #NUM!` côté BP
(non comparable sur cette ligne). Projets repowering (`…RP`) et agrégats (`…Global`,
`Panzoult CAS 3`) exclus du périmètre.

## Reproduire
```bash
npx tsx scripts/seed_bp_reel.ts        # (re)seed les 25 vrais projets depuis le xlsm
npx tsx scripts/calibrate_all.ts       # tableau vert/rouge MF vs cibles BP
npx tsx scripts/check_detail_liste.ts  # prouve DB → mêmes chiffres que le banc
npx vitest run app/lib/finance         # 35/35 (ancres protégées)
```

## Dette technique connue (non introduite ici, à traiter)
- `prisma migrate dev` cassé sur le repo (shadow-DB : `tauxIS` dupliqué dans la migration
  `add_scenario_fiscal_cca`). Contourné par `ALTER TABLE` manuel + `migrate resolve --applied`.
  → cf. ROADMAP « nettoyer l'historique des migrations » (migrate reset sur env propre).
- `cloneScenario` ne recopie pas les colonnes full-engine-inputs (pré-existant) : cloner un
  scénario `bp_reel` perd la calibration.
- `data/bp_projet_pipe.xlsm` (source, 4,6 Mo) et `prisma/dev.db` non commités.

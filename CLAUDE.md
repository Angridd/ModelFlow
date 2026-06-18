# ModelFlow — Instructions Claude/Codex

## Règles absolues
## Fichiers de référence — lire au démarrage
- docs/ARCHITECTURE.md      → structure du code et stack
- docs/FINANCIAL_ENGINE.md  → logique métier financière complète
- docs/BUSINESS_RULES.md    → règles métier EnR (unités, ratios)
- docs/ROADMAP.md           → état d'avancement, ce qui reste à faire
- Lire les fichiers existants AVANT toute modification
- Faire des modifications ciblées (str_replace) — jamais réécrire un fichier entier
- Ne jamais modifier les migrations Prisma existantes (dossier prisma/migrations/)
- Toujours exécuter `npx prisma generate` après une migration
- Vérifier `npm run build` à la fin de chaque tâche
- TypeScript strict — zéro `any`
- Rétrocompat totale : si un champ Prisma est null → comportement actuel inchangé
- CCA toujours calculé (pas saisi), `ccaBloque` toujours false, `structuringFeeRate` toujours 100%

## Commandes utiles
```bash
npm run dev          # lancer le serveur
npm run build        # vérifier la compilation
npx prisma migrate dev --name <nom>   # nouvelle migration
npx prisma generate  # régénérer le client
npx vitest run       # lancer les tests
```

## Fichiers clés
- Moteur financier : `app/lib/finance/engine.ts`
- Types financiers : `app/lib/finance/types.ts`
- Actions serveur  : `app/actions.ts`
- Page projet      : `app/projects/[id]/page.tsx`
- Formulaire new   : `app/projects/[id]/scenarios/new/page.tsx`
- Formulaire edit  : `app/projects/[id]/scenarios/[scenarioId]/edit/page.tsx`
- Composant DSCR   : `app/components/DscrSchedule.tsx`

## Tests existants (ne pas casser)
- `app/lib/finance/engine.test.ts` — 5 tests sculptDebt
- `app/lib/finance/sizingResult.test.ts` — 5 tests sizingResult

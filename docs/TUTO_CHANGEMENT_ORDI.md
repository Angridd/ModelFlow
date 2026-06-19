# 🖥️ Changer d'ordi — ModelFlow

## Avant de quitter l'ordi actuel
# 🖥️ Changer d'ordi — ModelFlow

## Avant de quitter l'ordi actuel

```bash
git add .
git commit -m "wip: sauvegarde avant changement ordi"
git push
```

Vérifie que ça passe bien :
```bash
git status
# doit afficher : nothing to commit, working tree clean
```

---

## Sur le nouvel ordi

### Étape 1 — Récupérer le code
```bash
# Si c'est la première fois sur cet ordi
git clone https://github.com/Angridd/ModelFlow.git
cd ModelFlow

# Si le repo est déjà là
cd ModelFlow
git pull
```

### Étape 2 — Installer les dépendances
```bash
npm install
```

### Étape 3 — Base de données
```bash
# Appliquer toutes les migrations (TOUJOURS migrate deploy, jamais migrate dev)
npx prisma migrate deploy

# Régénérer le client Prisma
npx prisma generate
```

### Étape 4 — Vérifier
```bash
# Les tests doivent passer
npx vitest run

# Le build doit compiler
npm run build

# Lancer le serveur
npm run dev
```

---

## ⚠️ Règles importantes

| ✅ Faire | ❌ Ne jamais faire |
|----------|-------------------|
| `npx prisma migrate deploy` | `npx prisma migrate dev` |
| `npx prisma db push` (si nouvelle migration en dev) | `npx prisma migrate reset` |
| `git pull` avant de commencer à travailler | Travailler sans avoir pullé |
| `git push` avant de changer d'ordi | Changer d'ordi sans avoir pushé |

---

## Si tu as un conflit git au pull

```bash
# Option safe — prendre la version GitHub
git fetch origin
git reset --hard origin/main
git push

# Puis relancer
npx prisma migrate deploy
npx prisma generate
npm run dev
```

---

## Si Prisma se plaint de migration manquante

```bash
# Voir l'état des migrations
npx prisma migrate status

# Marquer une migration comme appliquée sans la rejouer
npx prisma migrate resolve --applied "nom_de_la_migration"

# Régénérer
npx prisma generate
```

---

## Checklist rapide

- [ ] `git pull` ✅
- [ ] `npm install` ✅
- [ ] `npx prisma migrate deploy` ✅
- [ ] `npx prisma generate` ✅
- [ ] `npx vitest run` → 20 tests verts ✅
- [ ] `npm run dev` → localhost:3000 ✅

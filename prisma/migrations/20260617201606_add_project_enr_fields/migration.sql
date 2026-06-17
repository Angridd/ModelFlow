-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "capacityMw" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "ao" TEXT NOT NULL DEFAULT 'Non renseigne',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "caseType" TEXT NOT NULL DEFAULT 'Base',
    "region" TEXT NOT NULL DEFAULT 'Non renseignee',
    "tariff" REAL NOT NULL DEFAULT 0,
    "commissioningYear" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Project" ("capacityMw", "country", "createdAt", "id", "name", "status", "technology", "updatedAt") SELECT "capacityMw", "country", "createdAt", "id", "name", "status", "technology", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

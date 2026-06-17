-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "capex" REAL NOT NULL,
    "opex" REAL NOT NULL,
    "yieldMwh" REAL NOT NULL,
    "tariff" REAL NOT NULL,
    "debtRate" REAL NOT NULL,
    "projectLifeYears" INTEGER NOT NULL DEFAULT 30,
    "degradationRate" REAL NOT NULL DEFAULT 0.3,
    "discountRate" REAL NOT NULL DEFAULT 6,
    "debtInterestRate" REAL NOT NULL DEFAULT 4,
    "debtMaturityYears" INTEGER NOT NULL DEFAULT 20,
    "dscr" REAL NOT NULL,
    "npv" REAL NOT NULL,
    "irr" REAL NOT NULL,
    "lcoe" REAL NOT NULL,
    "isReference" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "Scenario_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Scenario" ("capex", "debtRate", "dscr", "id", "irr", "isReference", "lcoe", "name", "npv", "opex", "projectId", "tariff", "yieldMwh") SELECT "capex", "debtRate", "dscr", "id", "irr", "isReference", "lcoe", "name", "npv", "opex", "projectId", "tariff", "yieldMwh" FROM "Scenario";
DROP TABLE "Scenario";
ALTER TABLE "new_Scenario" RENAME TO "Scenario";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

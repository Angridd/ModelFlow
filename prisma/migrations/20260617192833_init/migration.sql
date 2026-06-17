-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "technology" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "capacityMw" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "capex" REAL NOT NULL,
    "opex" REAL NOT NULL,
    "yieldMwh" REAL NOT NULL,
    "tariff" REAL NOT NULL,
    "debtRate" REAL NOT NULL,
    "dscr" REAL NOT NULL,
    "npv" REAL NOT NULL,
    "irr" REAL NOT NULL,
    "lcoe" REAL NOT NULL,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "Scenario_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

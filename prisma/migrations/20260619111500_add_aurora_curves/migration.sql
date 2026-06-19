ALTER TABLE "Project" ADD COLUMN "auroraUpdatedAt" DATETIME;
ALTER TABLE "Project" ADD COLUMN "auroraTechnology" TEXT;
ALTER TABLE "Project" ADD COLUMN "debtSizingCentralW" REAL;
ALTER TABLE "Project" ADD COLUMN "debtSizingLowW" REAL;
ALTER TABLE "Project" ADD COLUMN "investorCurveW" REAL;

CREATE TABLE "AuroraCurve" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "high" REAL NOT NULL,
    "central" REAL NOT NULL,
    "low" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuroraCurve_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AuroraCurve_projectId_year_key" ON "AuroraCurve"("projectId", "year");

CREATE TABLE "new_AuroraCurve" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "high" REAL NOT NULL,
    "central" REAL NOT NULL,
    "low" REAL NOT NULL,
    "technology" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_AuroraCurve" ("id", "year", "high", "central", "low", "technology", "updatedAt")
SELECT
    MIN("AuroraCurve"."id"),
    "AuroraCurve"."year",
    "AuroraCurve"."high",
    "AuroraCurve"."central",
    "AuroraCurve"."low",
    COALESCE("Project"."auroraTechnology", 'fixed'),
    COALESCE("Project"."auroraUpdatedAt", "AuroraCurve"."createdAt", CURRENT_TIMESTAMP)
FROM "AuroraCurve"
LEFT JOIN "Project" ON "Project"."id" = "AuroraCurve"."projectId"
GROUP BY "AuroraCurve"."year";

DROP TABLE "AuroraCurve";

ALTER TABLE "new_AuroraCurve" RENAME TO "AuroraCurve";

CREATE UNIQUE INDEX "AuroraCurve_year_key" ON "AuroraCurve"("year");

ALTER TABLE "Project" DROP COLUMN "auroraUpdatedAt";
ALTER TABLE "Project" DROP COLUMN "auroraTechnology";

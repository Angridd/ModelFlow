-- AlterTable
ALTER TABLE "Scenario" ADD COLUMN "unavailability" REAL;
ALTER TABLE "Scenario" ADD COLUMN "indemnitesImmoKeuro" REAL;
ALTER TABLE "Scenario" ADD COLUMN "aleasOpexRate" REAL;
ALTER TABLE "Scenario" ADD COLUMN "tauxTSECfe" REAL;
ALTER TABLE "Scenario" ADD COLUMN "tauxGEMAPICfe" REAL;
ALTER TABLE "Scenario" ADD COLUMN "coefDegressif" REAL;
ALTER TABLE "Scenario" ADD COLUMN "taxeFinaleSizingKeuro" REAL;
ALTER TABLE "Scenario" ADD COLUMN "agentFeeAnnuelKeuro" REAL;
ALTER TABLE "Scenario" ADD COLUMN "dsrfFeeRate" REAL;
ALTER TABLE "Scenario" ADD COLUMN "capacityCertificateMw" REAL;
ALTER TABLE "Scenario" ADD COLUMN "goStartYear" INTEGER;
ALTER TABLE "Scenario" ADD COLUMN "goPriceBase" REAL;
ALTER TABLE "Scenario" ADD COLUMN "curveIndexAn1" REAL;
ALTER TABLE "Scenario" ADD COLUMN "fonciereBienEuroWc" REAL;
ALTER TABLE "Scenario" ADD COLUMN "batimentsFonciersKeuro" REAL;
ALTER TABLE "Scenario" ADD COLUMN "modRetraitementKeuro" REAL;
ALTER TABLE "Scenario" ADD COLUMN "valeurTerrainKeuro" REAL;

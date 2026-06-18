-- AlterTable
ALTER TABLE "Scenario" ADD COLUMN "omFixedEuroKwc" REAL;
ALTER TABLE "Scenario" ADD COLUMN "mraEuroKwc" REAL;
ALTER TABLE "Scenario" ADD COLUMN "backOfficeKeuro" REAL;
ALTER TABLE "Scenario" ADD COLUMN "diversOpexKeuro" REAL;
ALTER TABLE "Scenario" ADD COLUMN "loyerMode" TEXT;
ALTER TABLE "Scenario" ADD COLUMN "loyerValeur" REAL;
ALTER TABLE "Scenario" ADD COLUMN "loyerInflation" REAL;
ALTER TABLE "Scenario" ADD COLUMN "inflationOM" REAL;
ALTER TABLE "Scenario" ADD COLUMN "inflationMRA" REAL;
ALTER TABLE "Scenario" ADD COLUMN "inflationBackOffice" REAL;
ALTER TABLE "Scenario" ADD COLUMN "inflationDivers" REAL;

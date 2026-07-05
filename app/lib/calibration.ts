/**
 * Statut de calibration d'un projet vs sa CIBLE BP (data/cibles/<slug>.json), en réutilisant
 * EXACTEMENT la logique de scripts/calibrate_all.ts : VERT si (CAPEX ±1 % OU ≤12 k€/MW) ET
 * (dette ±1 % OU ≤12 k€/MW) ET (TRI investisseur ≤0,7 pp). Sinon ROUGE. GRIS = cible BP absente
 * ou invalide. Lecture seule (fs), côté serveur uniquement.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const CIBLES_DIR = path.resolve(process.cwd(), "data/cibles");

// Seuils repris à l'identique de calibrate_all.ts (« dans le bruit du modèle »).
const ECART_BRUIT_KEURO_PAR_MW = 12;
const TRI_BRUIT_PP = 0.7;

export type CibleTargets = {
  capexTotalKeuro?: number | null;
  detteKeuro?: number | null;
  investorIrrPct?: number | null;
  vanNetteKeuro?: number | null;
  gearingPct?: number | null;
};

type Cible = {
  name: string;
  slug: string;
  targets: CibleTargets;
};

export type CalibrationStatus = "green" | "red" | "gray" | "none";

export type CalibrationResult = {
  status: CalibrationStatus;
  /** Résumé lisible (ex. « CAPEX Δ1,2 % · dette Δ0,3 % · TRIinv Δ0,04 pp »). */
  detail: string;
  targets: CibleTargets | null;
};

/** slugify identique à scripts/read_bp_matrix.ts (NFD + retrait diacritiques + a-z0-9→_). */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Charge toutes les cibles BP disponibles, indexées par slug. Robuste si le dossier est absent. */
export function loadCibles(): Map<string, Cible> {
  const map = new Map<string, Cible>();
  let files: string[];
  try {
    files = readdirSync(CIBLES_DIR).filter((f) => f.endsWith(".json"));
  } catch {
    return map;
  }
  for (const f of files) {
    try {
      const c = JSON.parse(readFileSync(path.join(CIBLES_DIR, f), "utf8")) as Cible;
      if (c.slug) map.set(c.slug, c);
    } catch {
      // fichier illisible → ignoré (statut « none » côté projet)
    }
  }
  return map;
}

function fmt(n: number | null, d = 1): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

/**
 * Évalue le statut de calibration d'un projet. `capexCalibKeuro` = CAPEX détaillé + frais de
 * financement (== la métrique comparée à la cible BP dans calibrate_all).
 */
export function evaluateCalibration(
  projectName: string,
  capacityMw: number,
  capexCalibKeuro: number,
  debtRetenuKeuro: number,
  investorIrrPct: number,
  cibles: Map<string, Cible>,
): CalibrationResult {
  const cible = cibles.get(slugify(projectName));
  if (!cible) {
    return { status: "none", detail: "Aucune cible BP", targets: null };
  }
  const { capexTotalKeuro, detteKeuro, investorIrrPct: triBP } = cible.targets;
  if (capexTotalKeuro == null || detteKeuro == null || triBP == null) {
    return { status: "gray", detail: "Cible BP invalide", targets: cible.targets };
  }

  const dCapexPct = ((capexCalibKeuro - capexTotalKeuro) / capexTotalKeuro) * 100;
  const dDettePct = ((debtRetenuKeuro - detteKeuro) / detteKeuro) * 100;
  const dTriPp = investorIrrPct - triBP;
  const ecartCapexPmw = capacityMw > 0 ? Math.abs(capexCalibKeuro - capexTotalKeuro) / capacityMw : Infinity;
  const ecartDettePmw = capacityMw > 0 ? Math.abs(debtRetenuKeuro - detteKeuro) / capacityMw : Infinity;

  const capexOK = Math.abs(dCapexPct) <= 1 || ecartCapexPmw <= ECART_BRUIT_KEURO_PAR_MW;
  const detteOK = Math.abs(dDettePct) <= 1 || ecartDettePmw <= ECART_BRUIT_KEURO_PAR_MW;
  const triOK = Math.abs(dTriPp) <= TRI_BRUIT_PP;

  const detail = `CAPEX Δ${fmt(dCapexPct)} % · dette Δ${fmt(dDettePct)} % · TRIinv Δ${fmt(dTriPp, 2)} pp`;
  return {
    status: capexOK && detteOK && triOK ? "green" : "red",
    detail,
    targets: cible.targets,
  };
}

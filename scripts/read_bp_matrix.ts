/**
 * Lecteur de la VÉRITÉ BP — data/bp_projet_pipe.xlsm, feuille « Inp_Assumption » (matrice,
 * une colonne par projet). Pour chaque colonne projet réel, extrait :
 *   (a) les INPUTS nécessaires au FinanceEngineInput (mapping calqué sur scripts/import_pipe.ts,
 *       mais sur les LIGNES de Inp_Assumption — layout totalement différent du pipe BizDev) ;
 *   (b) les CIBLES (outputs stockés par le BP) : r27 Capex, r28 Debt, r29 SHL, r30 Gearing,
 *       r34 Max debt DSCR, r46 VAN Brute, r48 TRI Brut, r49 VAN Nette, r51 TRI Investisseur,
 *       r53 TRI Projet BRUT, r54 TRI Projet NET, r56 Equity required.
 *
 * Émet data/cibles/<slug>.json par projet (inputs + cibles + flags). Sert de source unique aux
 * scripts scripts/seed_bp_reel.ts (seed base) et scripts/calibrate_all.ts (comparaison).
 *
 *   npx tsx scripts/read_bp_matrix.ts
 *
 * Le moteur (engine.ts / types.ts / merchantCurves.ts) n'est PAS modifié. Aucune écriture DB ici.
 *
 * ⚠️ Colonnes : le layout Inp_Assumption décale les projets de +1 vs le cadrage initial
 *    (Digoin col13, Baugé col14, Panzoult CRE 1 col21). Exclusions = mêmes qu'import_pipe
 *    (plage 11..36 + /global/i + /\bRP\b/ + "Panzoult CAS 3").
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import {
  CAPACITY_PRICE_CURVE,
  MERCHANT_CURVE_VINTAGE,
  merchantCurveForTechnology,
} from "../app/lib/finance/merchantCurves";
import type { DscrTranche } from "../app/lib/finance/types";

const XLSX_PATH = path.resolve(process.cwd(), "data/bp_projet_pipe.xlsm");
const CIBLES_DIR = path.resolve(process.cwd(), "data/cibles");
const SHEET = "Inp_Assumption";

// Plage projets (comme import_pipe : cols 11..36) + exclusions par nom.
const COL_FROM = 11;
const COL_TO = 36;
const isExcludedName = (name: string) =>
  /global/i.test(name) || /\bRP\b/.test(name) || name === "Panzoult CAS 3";

export type Cell = (row: number, col: number) => XLSX.CellObject | undefined;

export function loadSheet(): Cell {
  const wb = XLSX.read(readFileSync(XLSX_PATH), { type: "buffer" });
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`Onglet ${SHEET} introuvable`);
  return (row: number, col: number) =>
    ws[XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })] as XLSX.CellObject | undefined;
}

// ---- OPEX « engagements » : feuille Inp_Opération ----------------------------------------
// Un bloc ~60 lignes par projet. En-tête = (col2 index numérique, col3 nom, col4 = true).
// Ligne « Total Engagments » (SIC, mal orthographiée dans le BP) en col5 ; la série an-par-an est
// alignée sur l'ANNÉE PROJET (an1 = col13), confirmée par la ligne d'index (1,2,3,… en col13..47)
// située juste sous la ligne « Total Engagments ». Valeurs en EUROS → converties en k€.
// C'est le poste discrétionnaire (Foncier + Environnement + Agricole + Concertation) que le BP
// intègre dans C_P90 (« Total operational expenses PV »), OMIS par MF jusqu'ici.
const SHEET_OP = "Inp_Opération";
const ENG_YEAR1_COL = 13; // col13 = an1 du projet
const ENG_MAX_YEARS = 40;

/** slug → série engagements en k€ (index 0 = an1). Parse la feuille Inp_Opération une seule fois. */
export function buildEngagementsBySlug(): Map<string, number[]> {
  const wb = XLSX.read(readFileSync(XLSX_PATH), {
    type: "buffer",
    sheets: [SHEET_OP],
    bookVBA: false,
    cellStyles: false,
  });
  const ws = wb.Sheets[SHEET_OP];
  if (!ws) throw new Error(`Onglet ${SHEET_OP} introuvable`);
  const get = (r: number, c: number) =>
    ws[XLSX.utils.encode_cell({ r: r - 1, c: c - 1 })] as XLSX.CellObject | undefined;
  const sv = (r: number, c: number) => String(get(r, c)?.v ?? "").trim();
  const nvv = (r: number, c: number) => {
    const x = get(r, c);
    return x && typeof x.v === "number" && Number.isFinite(x.v) ? x.v : null;
  };

  const maxR = XLSX.utils.decode_range(ws["!ref"] ?? "A1:A1").e.r + 1;
  const map = new Map<string, number[]>();
  let headerName = "";
  let foncierRow = 0; // ligne « Total operational Foncier » du bloc courant (0 si absente).
  for (let r = 1; r <= maxR; r += 1) {
    const c2 = get(r, 2);
    const c3 = sv(r, 3);
    if (c2 && typeof c2.v === "number" && c3 !== "" && sv(r, 4) === "true") {
      headerName = c3;
      foncierRow = 0; // nouveau bloc projet → on ré-arme la détection du Foncier.
    }
    // « Total operational Foncier » = REMBOURSEMENT de loyer (crédit, ex. Avermes −12 k€/an). Ce
    // poste appartient au LOYER, pas aux engagements : le BP single-project l'EXCLUT de sa ligne
    // engagements (C_P50 r199). On le mémorise pour le SOUSTRAIRE du « Total Engagments ».
    if (sv(r, 5).toLowerCase().includes("total operational foncier")) foncierRow = r;

    if (!sv(r, 5).toLowerCase().includes("total engag")) continue;
    if (!headerName || isExcludedName(headerName)) continue;

    // Ligne d'index (an projet 1,2,3…) juste sous la ligne « Total Engagments ».
    let idxRow = 0;
    for (let rr = r + 1; rr <= r + 3; rr += 1) {
      if (nvv(rr, ENG_YEAR1_COL) === 1) {
        idxRow = rr;
        break;
      }
    }
    if (idxRow === 0) continue;

    const series: number[] = [];
    for (let c = ENG_YEAR1_COL; c < ENG_YEAR1_COL + ENG_MAX_YEARS; c += 1) {
      // Tant que la ligne d'index enchaîne 1,2,3,… (an projet = c − 12).
      if (nvv(idxRow, c) !== c - (ENG_YEAR1_COL - 1)) break;
      const totalEngag = nvv(r, c) ?? 0;
      const foncier = foncierRow > 0 ? nvv(foncierRow, c) ?? 0 : 0;
      series.push((totalEngag - foncier) / 1000); // hors remboursement loyer (Foncier)
    }
    const slug = slugify(headerName);
    if (!map.has(slug)) map.set(slug, series);
  }
  return map;
}

// ---- VÉRITÉ SINGLE-PROJECT : data/<N>.xlsm (BP calculé, ground truth) ------------------------
// Le portefeuille (Inp_Assumption / Inp_Opération) contient des valeurs parfois périmées ou dans
// un format différent du BP réellement calculé (data/<N>.xlsm) :
//   • ENGAGEMENTS : la ligne « Total Engagments » d'Inp_Opération inclut, pour certains projets,
//     un « Remboursement loyer » (Foncier, ex. Avermes −12 k€) que le BP porte dans le LOYER et
//     NON dans les engagements ; d'autres projets (Digoin, saisie pure) n'ont aucun engagement
//     dans leur BP alors que le portefeuille en liste. La série appliquée par le BP est C_P50 r199
//     (charges en négatif) — on la lit directement (ground truth), déjà indexée à 2 %/an.
//   • TARIF PPA an1 : le BP indexe le tarif d'entrée (CRE) jusqu'à la MES (Langon 77 → 80,93).
//     C_P50 r73 an1 = tarif réellement appliqué la 1re année ; = r457 pour les projets sans
//     indexation → override sans effet ailleurs.
// Le mapping N→nom est identique à scripts/compare_bp_project.ts.
const N_TO_NAME: Record<number, string> = {
  1: "Aérodrome Perreux/Charny", 2: "Avermes - sol", 3: "Digoin", 4: "Golf de Baugé", 5: "Langon",
  6: "Marcillé-Robert", 7: "Montcuq 1 & 2", 8: "Montcuq 3", 9: "Mur-de-Sologne", 10: "Orval",
  11: "Panzoult CRE 1", 12: "Panzoult CRE 2", 13: "Panzoult CRE 3", 15: "Perpignan", 16: "Peyrilhac 1",
  17: "Salbris (GIAT) 1", 18: "Sauvigny-les-Bois 79", 19: "Sauvigny-les-Bois 76", 20: "Selles-sur-Cher 1",
  21: "Sigoulès", 22: "Villeherviers-Fontenils", 23: "Villeherviers-La Griffonnerie",
  24: "Villeherviers-Les Bruyères", 25: "Villognon", 26: "Ychoux 2 +",
};

export type BpGroundTruth = { engagements: number[]; appliedTariffAn1: number | null };

export function buildGroundTruthBySlug(): Map<string, BpGroundTruth> {
  const map = new Map<string, BpGroundTruth>();
  for (const [nStr, name] of Object.entries(N_TO_NAME)) {
    const n = Number(nStr);
    const file = path.resolve(process.cwd(), `data/${n}.xlsm`);
    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(readFileSync(file), { type: "buffer", sheets: ["C_P50"], bookVBA: false });
    } catch {
      continue; // fichier absent → pas de ground truth (fallback : série vide)
    }
    const ws = wb.Sheets["C_P50"];
    if (!ws) continue;
    const g = (r1: number, c0: number): number | null => {
      const x = ws[XLSX.utils.encode_cell({ r: r1 - 1, c: c0 })] as XLSX.CellObject | undefined;
      if (!x || x.t === "e") return null;
      return typeof x.v === "number" && Number.isFinite(x.v) ? x.v : null;
    };
    // Colonne an1 = période 1 (voisin gauche 0, voisin droite 2), scannée sur les 8 1res lignes.
    let an1 = -1;
    for (let r = 1; r <= 8 && an1 < 0; r += 1)
      for (let c = 2; c < 60; c += 1)
        if (g(r, c) === 1 && g(r, c - 1) === 0 && g(r, c + 1) === 2) { an1 = c; break; }
    if (an1 < 0) continue;

    const engagements: number[] = [];
    for (let k = 0; k < ENG_MAX_YEARS; k += 1) {
      const v = g(199, an1 + k);
      if (v === null) break;
      engagements.push(-v / 1000); // BP : charge en négatif → k€ positifs
    }
    while (engagements.length && Math.abs(engagements[engagements.length - 1]) < 1e-9) engagements.pop();

    map.set(slugify(name), { engagements, appliedTariffAn1: g(73, an1) });
  }
  return map;
}

function num(cell: Cell, r: number, c: number): number | null {
  const x = cell(r, c);
  if (!x || x.t === "e") return null;
  if (typeof x.v === "number" && Number.isFinite(x.v)) return x.v;
  if (typeof x.v === "string") {
    const n = Number(x.v.trim().replace(/\s| |€|%/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function str(cell: Cell, r: number, c: number): string | null {
  const x = cell(r, c);
  if (!x) return null;
  const s = String(x.v ?? "").trim();
  return s === "" ? null : s;
}
/** Cible : renvoie la valeur numérique brute, ou null si cellule en erreur (#NUM!, #VALUE!…). */
function target(cell: Cell, r: number, c: number): number | null {
  const x = cell(r, c);
  if (!x || x.t === "e") return null;
  return typeof x.v === "number" && Number.isFinite(x.v) ? x.v : null;
}
const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
export const slugify = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export type BuiltProject = {
  name: string;
  slug: string;
  technology: string;
  capacityMw: number;
  commissioningYear: number;
  /** Sous-ensemble persisté dans Scenario (colonnes du schéma Prisma). */
  scenario: Record<string, unknown>;
  /** Champs moteur non persistés (portés par Project / marché) — injectés en mémoire. */
  engineOnly: Record<string, unknown>;
  dscrSchedule: DscrTranche[];
  /** Cibles BP (clés = clés numériques de calibrate_report). null = output BP invalide. */
  targets: Record<string, number | null>;
  flags: string[];
};

export function buildProject(
  cell: Cell,
  col: number,
  engagementsBySlug?: Map<string, number[]>,
  groundTruthBySlug?: Map<string, BpGroundTruth>,
): BuiltProject | null {
  const name = str(cell, 8, col);
  if (!name || isExcludedName(name)) return null;

  const flags: string[] = [];
  const groundTruth = groundTruthBySlug?.get(slugify(name));
  const capacityMw = num(cell, 23, col) ?? 0;
  const mes = Math.trunc(num(cell, 70, col) ?? 0);
  const technoRaw = str(cell, 124, col) ?? "Fixed"; // "Fixed" | "Trackers"
  const technology = /track/i.test(technoRaw) ? "Tracker" : "Fixed";
  const curve = merchantCurveForTechnology(technoRaw);

  const tenor = Math.trunc(num(cell, 506, col) ?? 24);
  const dscrContracted = num(cell, 512, col) ?? 1.15;
  const dscrMerchant = num(cell, 513, col) ?? 1.4;
  const dscrSchedule: DscrTranche[] = [
    { yearFrom: 1, yearTo: Math.min(20, tenor), dscrValue: dscrContracted },
  ];
  if (tenor > 20) dscrSchedule.push({ yearFrom: 21, yearTo: tenor, dscrValue: dscrMerchant });

  // Loyer (r156 mode / r157 valeur) — projets "Achat de terrain" : valeur vide → 0.
  // Modes du portefeuille (r156) : "€/ha", "€/Mwc", "% of revenues", "Annuel". Le moteur
  // (engine.buildPreRows) sait traiter euroParHa / euroParMWc / pctCA / fixe. Ici on route
  // CHAQUE mode ; « % of revenues » et « Annuel » étaient auparavant ignorés (loyer → 0), ce qui
  // annulait le loyer de Langon (6,5 % du CA, 88→112 k€) sur 35 ans.
  const rentType = (str(cell, 156, col) ?? "").toLowerCase();
  const rentValeur = num(cell, 157, col);
  let loyerMode: string | null = null;
  let loyerValeur = rentValeur;
  if (rentType.includes("/ha")) loyerMode = "euroParHa";
  else if (rentType.includes("mwc") || rentType.includes("mw")) loyerMode = "euroParMWc";
  else if (rentType.includes("revenu") || rentType.includes("%")) {
    // « % of revenues » : le moteur fait asRate(loyerValeur) × revenueP50 = (loyerValeur/100) × CA.
    // r157 = fraction (0,065) → on passe le POURCENTAGE (6,5) pour que asRate le ramène à 0,065.
    loyerMode = "pctCA";
    loyerValeur = rentValeur != null ? rentValeur * 100 : null;
  } else if (rentType.includes("annuel")) {
    // « Annuel » : loyer fixe € annuel → k€ (mode "fixe" du moteur, en k€).
    loyerMode = "fixe";
    loyerValeur = rentValeur != null ? rentValeur / 1000 : null;
  }

  // MRA (r256) : € par kWc. Les valeurs légitimes du portefeuille sont ≤ ~1,1 €/kWc. Une valeur
  // > 100 (seul Digoin : r256 = 21 200, saisie aberrante) N'EST PAS un total € annuel : le BP
  // single-project (data/3.xlsm C_P50 r189) applique une MRA ≈ 0. On IGNORE donc la valeur
  // aberrante (mraEuroKwc = 0) au lieu de la « convertir » en un poste fictif de 21 k€/an.
  const mraRaw = num(cell, 256, col);
  let mraEuroKwc = mraRaw ?? 0;
  if (mraRaw != null && mraRaw > 100) {
    mraEuroKwc = 0;
    flags.push(`MRA r256=${mraRaw} aberrante (>100 €/kWc) → ignorée (BP applique 0)`);
  }

  // OPEX divers = compteur (r258) + telecom (r259) + inspection (r260) + autoconso (r261).
  const diversOpexKeuro =
    ((num(cell, 258, col) ?? 0) + (num(cell, 259, col) ?? 0) +
      (num(cell, 260, col) ?? 0) + (num(cell, 261, col) ?? 0)) / 1000;

  // MOD (poste CAPEX) = r93 « Coût du Dev » = r91 €/MWp × MW. La « Marge facturable » (r32 « Dont
  // Marge facturable », ≠ 0 seulement sur Ychoux) N'EST PAS ajoutée ici : le moteur la modélise
  // ENDOGÈNEMENT (ajusteMargeFacturable → sizing.margeFactKeuro), en gonflant la base de gearing
  // pour absorber la capacité de dette au-delà de 95 %. L'ajouter au CAPEX la compterait deux fois.
  const devFeesKEuroPerMW = (num(cell, 91, col) ?? 0) / 1000; // r91 €/MWp → k€/MW
  const devFeesKeuroTotal = devFeesKEuroPerMW * capacityMw;
  const surfaceHa = num(cell, 24, col) ?? 0;

  // Connexion : r208 = total connection (ouvrages + quote-part + contingency), replié dans
  // raccordementOuvrageKEuro (tarifQPKEuroPerMW laissé nul → pas de double comptage).
  const raccordementOuvrageKEuro = (num(cell, 208, col) ?? 0) / 1000;

  // "Autres charges à financer" (r231) + achat de terrain (r578, 0 si location) → indemnités
  // (ajoutées au CAPEX, NON amorties, hors base foncière — fidèle au traitement BP land = No D&A).
  // ⚠️ r231 = r213 (rent constr) + r214 (mesures agri/env) + r226 (Tax Aménagement/Archéo). Or le
  // moteur RECALCULE déjà r226 (taxeAménagement + taxeArchéo dans calculateCapexDetails) → on le
  // RETIRE ici pour ne pas le compter deux fois (bug historique : r226 comptabilisé dans indemnités
  // ET dans taxesFoncières). Le moteur reproduit r226 à ~0,1 k€ près (mêmes formules m²PV).
  const taxAmenArcheoEuro = num(cell, 226, col) ?? 0; // r226, recalculé par le moteur
  const landAcquisition = num(cell, 578, col) ?? 0;
  // r32 « Dont Marge facturable » (≠ 0 seulement sur Ychoux : 177 k€) : part du MOD (r31) que le
  // BP finance dans le CAPEX (r27) mais que r93 « Coût du Dev » n'inclut pas. Porté ici en poste
  // financé No-D&A (pas via devFees amortissable, qui déclenche la boucle marge facturable endogène
  // du moteur et sur-dimensionne la dette). Absent (marge nulle) → CAPEX inchangé.
  const margeFacturableEuro = num(cell, 32, col) ?? 0; // r32 € → indemnités (financé, No D&A)
  const indemnitesImmoKeuro =
    ((num(cell, 231, col) ?? 0) - taxAmenArcheoEuro + margeFacturableEuro + landAcquisition) / 1000;
  // r215 « Autres (Apport Affaires) » — poste CAPEX financé, HORS r231. Porté par l'input dédié
  // apportAffaire (mode "fixe" en k€). Absent (Baugé/Ychoux) → 0 → CAPEX inchangé.
  const apportAffaireKeuroTotal = (num(cell, 215, col) ?? 0) / 1000; // r215 € → k€
  if (landAcquisition > 0) {
    flags.push(
      `Achat de terrain ${Math.round(landAcquisition)} € replié dans indemnités (financé, non amorti)`,
    );
  }

  const dismantling = num(cell, 294, col);
  if (dismantling != null && dismantling > 0) {
    flags.push(`Démantèlement ${Math.round(dismantling)} € an25-30 non modélisé (flux surestimés)`);
  }

  const curveIndexAn1 = round6(1.10245 * 1.02 ** (mes - 2029));

  // Tarif PPA an1 : priorité au tarif RÉELLEMENT appliqué par le BP (C_P50 r73, indexé CRE
  // jusqu'à la MES), sinon r457/r25 du portefeuille. Identique à r457 pour les projets sans
  // indexation ; corrige Langon (77 → 80,93).
  const tariffPortfolio = num(cell, 457, col) ?? num(cell, 25, col) ?? 0;
  const gtTariff = groundTruth?.appliedTariffAn1 ?? null;
  // Override UNIQUEMENT si l'écart est matériel (> 0,5 €/MWh) : évite de perturber au 1/1000e les
  // 19 projets déjà calés (dont r73 an1 ≈ r457) ; ne corrige que le tarif CRE indexé de Langon.
  const tariffIndexed = gtTariff != null && Math.abs(gtTariff - tariffPortfolio) > 0.5;
  const tariff = tariffIndexed ? (gtTariff as number) : tariffPortfolio;
  if (tariffIndexed) {
    flags.push(
      `Tarif PPA an1 indexé BP ${(gtTariff as number).toFixed(2)} €/MWh (portefeuille ${tariffPortfolio.toFixed(2)})`,
    );
  }

  // ---- Champs communs (moteur ET base) ----
  const shared = {
    yieldMwh: num(cell, 111, col) ?? 0,
    tariff,
    projectLifeYears: Math.trunc(num(cell, 76, col) ?? 35),
    degradationRate: (num(cell, 129, col) ?? 0) * 100, // 0.004 → 0.4
    discountRate: 7.5,
    debtInterestRate: (num(cell, 510, col) ?? 0) * 100, // 0.0435 → 4.35
    debtMaturityYears: tenor,
    tariffInflationRate: 0.4,
    opexInflationRate: 2,
    contractDuration: Math.trunc(num(cell, 459, col) ?? 20),
    constructionYears: Math.trunc(num(cell, 72, col) ?? 1),
    assuranceRate: (num(cell, 284, col) ?? 0) * 100, // 0.025 → 2.5
    inflationAssurance: 2,
    balancingCost: num(cell, 245, col) ?? 2,
    omFixedEuroKwc: num(cell, 255, col) ?? 0,
    mraEuroKwc,
    backOfficeKeuro: (num(cell, 285, col) ?? 0) / 1000,
    diversOpexKeuro,
    loyerMode,
    loyerValeur,
    loyerInflation: 0.4,
    inflationOM: 2,
    inflationMRA: 2,
    inflationBackOffice: 2,
    inflationDivers: 2,
    methodeTaxes: "appreciation_directe",
    tauxTFCommune: num(cell, 268, col),
    tauxTFEPCI: num(cell, 269, col),
    tauxTSE: num(cell, 270, col),
    tauxGEMAPI: num(cell, 271, col),
    tauxTEOM: num(cell, 272, col),
    tauxCFECommune: num(cell, 274, col),
    tauxCFEEPCI: num(cell, 275, col),
    tauxCCI: num(cell, 278, col),
    inflationTaxes: 2,
    iferRate1: num(cell, 282, col),
    iferRate2: num(cell, 283, col),
    iferRpn: 1.35,
    inflationAurora: 2,
    debtTenorYears: tenor,
    gearingMaxPct: 95,
    tauxIS: (num(cell, 305, col) ?? 0) * 100, // 0.25 → 25
    amortDuree: 20,
    ccaRemunRate: (num(cell, 521, col) ?? 0) * 100, // 0.06 → 6
    dsraMonths: Math.trunc(num(cell, 529, col) ?? 6),
    devFeesKEuroPerMW,
    contingencyRate: (num(cell, 186, col) ?? 0) * 100, // 0.02 → 2
    prixModuleUSDWc: num(cell, 172, col),
    tauxEURUSD: 1.16,
    // BOS : r176 « BOS price (including inflation until comissioning if needed) » — c'est le prix
    // que la construction BP (r184) utilise réellement. r176 = r173 (prix de base) sauf quand le
    // prix est coté en année antérieure à la MES (seul Langon : r173 0,321 → r176 0,3374, +5,1 %).
    boSCtWc: (num(cell, 176, col) ?? num(cell, 173, col) ?? 0) * 100, // €/Wp → ct/Wc
    raccordementOuvrageKEuro,
    // Apport affaires (r215) : mode fixe en k€ (0 si absent → poste CAPEX nul, rétrocompat).
    apportAffaireMode: apportAffaireKeuroTotal > 0 ? "fixe" : null,
    apportAffaireValeur: apportAffaireKeuroTotal,
    // Financing fees : mode taux 7 composants (constantes template §4.02, identiques import_pipe).
    legalFeesKEuro: 10,
    technicalDDKEuro: 5,
    arrangerFeesRate: 0.8,
    participantFeesRate: 0.4,
    bankFeesPLTKEuroPerMW: 1.5,
    interimFinancingRate: 2.5,
    commitmentFeesRate: 0.1,
  };

  // ---- Inputs moteur persistés en base (colonnes scenario_full_engine_inputs) ----
  const persistedEngineInputs = {
    unavailability: num(cell, 116, col) ?? 0,
    indemnitesImmoKeuro,
    // Aléas = r298 « Aléas % » = 0,5 % × revenu (poste réel du BP, cf CALIBRATION.md Baugé
    // aléas 3177,80 = 0,5 % × 635,56 k). ⚠️ NE PAS lire r301 « Opex hazard % » (=0, poste
    // distinct) : c'était le bug qui annulait l'aléas sur tout le portefeuille (CFADS P90 trop
    // haut → dette sur-dimensionnée). r298 = 0,5 % uniforme sur les 26 projets.
    aleasOpexRate: (num(cell, 298, col) ?? 0) * 100, // 0.005 → 0.5
    tauxTSECfe: num(cell, 276, col),
    tauxGEMAPICfe: num(cell, 277, col),
    coefDegressif: 2.25,
    taxeFinaleSizingKeuro: 0,
    agentFeeAnnuelKeuro: (num(cell, 528, col) ?? 0) / 1000, // r528 Agent Fee €
    dsrfFeeRate: (num(cell, 530, col) ?? 0) * 100, // 0.014 → 1.4
    capacityCertificateMw: num(cell, 489, col),
    goStartYear: Math.trunc(num(cell, 490, col) ?? 21),
    goPriceBase: 1,
    curveIndexAn1,
    // Base foncière template €/Wc : BOS divers 0,014 + terrassement 0,003 = 0,017.
    fonciereBienEuroWc: 0.017,
    batimentsFonciersKeuro: 0,
    modRetraitementKeuro: devFeesKeuroTotal,
    valeurTerrainKeuro: 5 * surfaceHa,
  };

  // OPEX « engagements » an-par-an (k€, an1..anN) — routé ADDITIVEMENT SANS ré-indexation dans
  // engine.buildPreRows. Persisté via la colonne Scenario.opexEngagementsKeuroByYear (String? JSON)
  // et saisissable au formulaire (grille an-par-an). Absent → [] → inchangé.
  //
  // SOURCE (Phase 2, item 5) : la série RÉELLEMENT APPLIQUÉE par le BP est C_P50 r199 du single-
  // project (data/N.xlsm), DÉJÀ indexée ~2 %/an (provisions comprises). Le portefeuille Inp_Opération
  // (buildEngagementsBySlug) porte, lui, une série NON indexée (an1 identique mais plate ensuite) qui
  // sous-charge l'OPEX de ~15-18 % sur les 20 ans de dimensionnement → CFADS P90 gonflé → dette
  // sur-dimensionnée (cause des rouges Baugé/Villognon/Selles). On adopte donc le ground truth r199
  // DÈS QU'UN data/N.xlsm existe (série exacte, provisions incluses) ; repli sur Inp_Opération pour
  // les projets sans single-project. Digoin (« saisie pure » : r199 ≈ 0 sauf provision an34) est
  // couvert naturellement — son r199 exact remplace les 36 k€/an d'Environnement du portefeuille.
  let opexEngagementsKeuroByYear: number[];
  if (groundTruth) {
    opexEngagementsKeuroByYear = groundTruth.engagements;
    flags.push("Engagements = BP single-project C_P50 r199 (série appliquée, indexée 2%/an)");
  } else {
    opexEngagementsKeuroByYear = engagementsBySlug?.get(slugify(name)) ?? [];
  }
  if (opexEngagementsKeuroByYear.length === 0) {
    flags.push("Aucun engagement (série vide → OPEX inchangé)");
  }

  // Marge facturable figée par le BP (r32 « Dont Marge facturable » € → k€). Les k€ sont déjà
  // inclus dans le CAPEX via indemnitesImmoKeuro → on impose 0 pour ne pas les compter deux fois
  // et désactiver la boucle endogène. r32 ≠ 0 uniquement sur Ychoux → null partout ailleurs
  // (rétrocompat stricte). Persisté via la colonne Scenario.margeFactFigeeKeuro (Float?),
  // saisissable au formulaire (section template).
  const margeFactFigeeKeuro = margeFacturableEuro > 0 ? 0 : null;

  const engineOnly = {
    capacityMw,
    commissioningYear: mes,
    investorCurveW: 1,
    debtSizingCentralW: 0.7,
    debtSizingLowW: 0.3,
    ...persistedEngineInputs,
    opexEngagementsKeuroByYear,
    margeFactFigeeKeuro,
  };

  const scenario: Record<string, unknown> = {
    name: `Base Case (BP réel — Inp_Assumption ${MERCHANT_CURVE_VINTAGE})`,
    capex: 0,
    opex: 0,
    debtRate: 0,
    surfaceHa,
    yieldP90Mwh: null,
    ...shared,
    ...persistedEngineInputs,
    dscrSchedule: JSON.stringify(dscrSchedule),
    isReference: true,
  };

  // ---- CIBLES BP (clés = clés numériques de buildReportRows / calibrate) ----
  const t = (r: number) => target(cell, r, col);
  const k = (r: number) => {
    const v = t(r);
    return v == null ? null : v / 1000;
  };
  const pct = (r: number) => {
    const v = t(r);
    return v == null ? null : v * 100;
  };
  const targets: Record<string, number | null> = {
    capexTotalKeuro: k(27), // r27 en € → k€
    detteKeuro: k(28), // r28 en € → k€
    equityCcaKeuro: k(29), // r29 SHL en € → k€
    gearingPct: pct(30), // r30 fraction → %
    maxDebtDscrKeuro: k(34),
    vanBruteKeuro: t(46), // r46 déjà en k€
    trIBrutPct: pct(48), // r48 TRI Brut (souvent #NUM! → null)
    vanNetteKeuro: t(49), // r49 déjà en k€
    investorIrrPct: pct(51), // r51 TRI Investisseur
    trIProjetBrutPct: pct(53), // r53
    trIProjetNetPct: pct(54), // r54
    equityRequiredKeuro: t(56), // r56 déjà en k€
  };

  return {
    name,
    slug: slugify(name),
    technology,
    capacityMw,
    commissioningYear: mes,
    scenario,
    engineOnly: { ...engineOnly, auroraCurves: curve, capacityPriceCurve: CAPACITY_PRICE_CURVE },
    dscrSchedule,
    targets,
    flags,
  };
}

export function buildAll(): BuiltProject[] {
  const cell = loadSheet();
  const engagementsBySlug = buildEngagementsBySlug();
  const groundTruthBySlug = buildGroundTruthBySlug();
  const out: BuiltProject[] = [];
  for (let col = COL_FROM; col <= COL_TO; col += 1) {
    const b = buildProject(cell, col, engagementsBySlug, groundTruthBySlug);
    if (b) out.push(b);
  }
  return out;
}

function main() {
  const built = buildAll();
  mkdirSync(CIBLES_DIR, { recursive: true });
  console.log(`\n=== READ BP MATRIX — Inp_Assumption : ${built.length} projets réels ===\n`);
  for (const b of built) {
    const dest = path.join(CIBLES_DIR, `${b.slug}.json`);
    writeFileSync(
      dest,
      JSON.stringify(
        {
          name: b.name,
          slug: b.slug,
          technology: b.technology,
          capacityMw: b.capacityMw,
          commissioningYear: b.commissioningYear,
          scenario: b.scenario,
          engineOnly: {
            ...b.engineOnly,
            auroraCurves: undefined, // non sérialisé (résolu par techno au calibrage)
            capacityPriceCurve: undefined,
          },
          dscrSchedule: b.dscrSchedule,
          targets: b.targets,
          flags: b.flags,
        },
        null,
        2,
      ),
      "utf8",
    );
    const invalid = Object.entries(b.targets)
      .filter(([, v]) => v == null)
      .map(([kk]) => kk);
    console.log(
      `✓ ${b.name.padEnd(30)} ${b.technology.padEnd(8)} ${b.capacityMw} MW · MES ${b.commissioningYear}` +
        `  cible CAPEX ${((b.targets.capexTotalKeuro ?? 0)).toFixed(0)} k€ · TRI Inv ${(b.targets.investorIrrPct ?? 0).toFixed(2)}%` +
        (invalid.length ? `  ⚑ cibles invalides: ${invalid.join(",")}` : ""),
    );
    if (b.flags.length) b.flags.forEach((f) => console.log(`      ⚑ ${f}`));
  }
  console.log(`\nCibles écrites dans ${path.relative(process.cwd(), CIBLES_DIR)}/`);
}

if (process.argv[1] && process.argv[1].includes("read_bp_matrix")) main();

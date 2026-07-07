/**
 * COMPARATEUR ligne-à-ligne / année-par-année  BP (Excel) ↔ MF (moteur).
 * =====================================================================
 * Outil de DIAGNOSTIC (lecture seule sur le moteur) pour localiser OÙ la MÉTHODE de calcul
 * diverge entre le plan d'affaires Excel calculé d'un projet (data/<N>.xlsm) et le modèle MF
 * (app/lib/bpModel.buildBpModel, qui appelle le moteur). N'ÉDITE PAS le moteur : il l'IMPORTE.
 *
 *   npx tsx scripts/compare_bp_project.ts "Sigoulès"      # par nom
 *   npx tsx scripts/compare_bp_project.ts 21              # par numéro de fichier data/<N>.xlsm
 *   npx tsx scripts/compare_bp_project.ts Langon --full   # dump complet an-par-an (toutes années)
 *
 * ── Principe d'alignement ────────────────────────────────────────────────────────────────────
 *  • CÔTÉ MF : buildBpModel(project, scenario) renvoie des lignes { label, unite, valeurs[] }
 *    alignées sur `years` = [-1, 0, 1, 2, … 35] (an1 = MES). On indexe par ANNÉE de projet.
 *  • CÔTÉ BP : data/<N>.xlsm, feuilles C_P50 / C_P90 / C_Financing / C_D&A. Layout identique aux
 *    4 feuilles : ligne « period » (…-1, 0, 1, 2…) + ligne « year » (2026, 2027…). On repère la
 *    COLONNE de l'an1 (période == 1 = MES) par SCAN (robuste au MES variable d'un projet à l'autre),
 *    puis période k → colonne = an1col + (k − 1).
 *  • Les LIGNES BP sont repérées par NUMÉRO de ligne Excel (stable : les 26 fichiers partagent le
 *    même gabarit) ; le mapping ci-dessous documente, pour chaque ligne MF, sa (ses) ligne(s) BP,
 *    le signe (le BP porte les charges en négatif, MF en positif) et l'échelle (€ → k€).
 *
 * ── Sortie ───────────────────────────────────────────────────────────────────────────────────
 *  1. Scalaires de synthèse (dette / gearing / CAPEX / TRI / VAN) MF ↔ cible BP.
 *  2. Top 3-5 divergences (ligne, année, ampleur).
 *  3. Table par SECTION : section | ligne | année | BP | MF | Δ | Δ% (années échantillon, ou
 *     toutes avec --full), avec mise en évidence de la 1re ligne/année divergente (> seuil).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../app/generated/prisma/client";
import { buildBpModel, type BpModel } from "../app/lib/bpModel";
import { computeProjectFinance, pickReferenceScenario } from "../app/lib/scenarioMetrics";
import { slugify } from "./read_bp_matrix";

// ─────────────────────────────────────────────────────────────────────────────────────────────
// N (fichier data/<N>.xlsm) → nom de projet (doit matcher le `name` en base, statut bp_reel).
// Les agrégats (14, 27, 28-34) sont hors périmètre (single-project uniquement).
// ─────────────────────────────────────────────────────────────────────────────────────────────
const N_TO_NAME: Record<number, string> = {
  1: "Aérodrome Perreux/Charny",
  2: "Avermes - sol",
  3: "Digoin",
  4: "Golf de Baugé",
  5: "Langon",
  6: "Marcillé-Robert",
  7: "Montcuq 1 & 2",
  8: "Montcuq 3",
  9: "Mur-de-Sologne",
  10: "Orval",
  11: "Panzoult CRE 1",
  12: "Panzoult CRE 2",
  13: "Panzoult CRE 3",
  15: "Perpignan",
  16: "Peyrilhac 1",
  17: "Salbris (GIAT) 1",
  18: "Sauvigny-les-Bois 79",
  19: "Sauvigny-les-Bois 76",
  20: "Selles-sur-Cher 1",
  21: "Sigoulès",
  22: "Villeherviers-Fontenils",
  23: "Villeherviers-La Griffonnerie",
  24: "Villeherviers-Les Bruyères",
  25: "Villognon",
  26: "Ychoux 2 +",
};

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });
const CIBLES_DIR = path.resolve(process.cwd(), "data/cibles");

const SEUIL_PCT = 0.5; // % : au-delà, la ligne/année est signalée « divergente ».

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Accès xlsm : détection générique de la colonne « an1 » (période == 1) par feuille.
// ─────────────────────────────────────────────────────────────────────────────────────────────
type SheetGet = (row1: number, col0: number) => number | null;

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function openSheet(wb: XLSX.WorkBook, name: string): { get: SheetGet; an1Col: number; maxCol: number } {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Feuille « ${name} » introuvable`);
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1:A1");
  const raw = (r1: number, c0: number): XLSX.CellObject | undefined =>
    ws[XLSX.utils.encode_cell({ r: r1 - 1, c: c0 })] as XLSX.CellObject | undefined;
  const get: SheetGet = (r1, c0) => {
    const cell = raw(r1, c0);
    if (!cell || cell.t === "e") return null;
    return typeof cell.v === "number" && Number.isFinite(cell.v) ? cell.v : null;
  };
  // Repère la ligne « period » : cellule == 1 dont la gauche == 0 et la droite == 2.
  let an1Col = -1;
  for (let r = 1; r <= 8 && an1Col < 0; r += 1) {
    for (let c = 2; c <= range.e.c && c < 60; c += 1) {
      if (get(r, c) === 1 && get(r, c - 1) === 0 && get(r, c + 1) === 2) {
        an1Col = c;
        break;
      }
    }
  }
  if (an1Col < 0) throw new Error(`${name} : ligne « period » (…0,1,2…) introuvable`);
  return { get, an1Col, maxCol: range.e.c };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// MAPPING MF ↔ BP. Une entrée par LIGNE du modèle MF (identifiée par section + label MF).
//   sheet  : feuille BP source (C_P50 par défaut).
//   rows   : ligne(s) Excel BP (1-based) — sommées si plusieurs (ex. balancing an1-20 + an20+).
//   sign   : le BP porte les charges/dépréciations/service en NÉGATIF, MF en POSITIF → -1 aligne.
//            (+1 pour revenus, prod, EBITDA, EBIT, résultat, flux, soldes, DSCR…)
//   xform  : transformation optionnelle sur la valeur BP brute (avant signe/échelle).
// L'échelle (€ → k€) est déduite de l'unité MF (kEUR ⇒ /1000 ; MWh/EUR-MWh/ratio ⇒ inchangé).
// ─────────────────────────────────────────────────────────────────────────────────────────────
type BpSheet = "C_P50" | "C_P90" | "C_Financing" | "C_D&A";
type Mapping = {
  mfSection: string;
  mfLabel: string;
  sheet: BpSheet;
  rows: number[];
  sign: 1 | -1;
  xform?: (v: number) => number;
};

const MAPPINGS: Mapping[] = [
  // ── Production ───────────────────────────────────────────────────────────────────────────
  { mfSection: "Production", mfLabel: "Production P50", sheet: "C_P50", rows: [64], sign: 1 },
  { mfSection: "Production", mfLabel: "Production P90", sheet: "C_P90", rows: [64], sign: 1 },
  { mfSection: "Production", mfLabel: "Tarif appliqué", sheet: "C_P50", rows: [73], sign: 1 },
  // ── Revenus (total = PPA + merchant + capacité + GO ; BP r168 « Total revenues ») ──────────
  { mfSection: "Revenus", mfLabel: "Revenus P50 (total)", sheet: "C_P50", rows: [168], sign: 1 },
  { mfSection: "Revenus", mfLabel: "Revenus P90 (sizing)", sheet: "C_P90", rows: [168], sign: 1 },
  // ── OPEX par poste (BP en négatif → sign -1) ───────────────────────────────────────────────
  { mfSection: "OPEX par poste (P50)", mfLabel: "O&M", sheet: "C_P50", rows: [188], sign: -1 },
  { mfSection: "OPEX par poste (P50)", mfLabel: "MRA", sheet: "C_P50", rows: [189], sign: -1 },
  { mfSection: "OPEX par poste (P50)", mfLabel: "Back-office", sheet: "C_P50", rows: [186], sign: -1 },
  { mfSection: "OPEX par poste (P50)", mfLabel: "Divers", sheet: "C_P50", rows: [200], sign: -1 },
  { mfSection: "OPEX par poste (P50)", mfLabel: "Loyer", sheet: "C_P50", rows: [172], sign: -1 },
  { mfSection: "OPEX par poste (P50)", mfLabel: "Assurance", sheet: "C_P50", rows: [187], sign: -1 },
  { mfSection: "OPEX par poste (P50)", mfLabel: "Balancing", sheet: "C_P50", rows: [193, 194], sign: -1 },
  { mfSection: "OPEX par poste (P50)", mfLabel: "IFER", sheet: "C_P50", rows: [190], sign: -1 },
  { mfSection: "OPEX par poste (P50)", mfLabel: "Taxe foncière (TF)", sheet: "C_P50", rows: [191], sign: -1 },
  { mfSection: "OPEX par poste (P50)", mfLabel: "CFE", sheet: "C_P50", rows: [192], sign: -1 },
  { mfSection: "OPEX par poste (P50)", mfLabel: "Aléas", sheet: "C_P50", rows: [201], sign: -1 },
  { mfSection: "OPEX par poste (P50)", mfLabel: "Démantèlement", sheet: "C_P50", rows: [195], sign: -1 },
  { mfSection: "OPEX par poste (P50)", mfLabel: "Engagements", sheet: "C_P50", rows: [199], sign: -1 },
  { mfSection: "OPEX par poste (P50)", mfLabel: "Total OPEX", sheet: "C_P50", rows: [204], sign: -1 },
  // ── EBITDA ─────────────────────────────────────────────────────────────────────────────────
  { mfSection: "EBITDA", mfLabel: "EBITDA P50", sheet: "C_P50", rows: [227], sign: 1 },
  { mfSection: "EBITDA", mfLabel: "EBITDA P90", sheet: "C_Financing", rows: [80], sign: 1 },
  // ── Amortissements ──────────────────────────────────────────────────────────────────────────
  { mfSection: "Amortissements (D&A)", mfLabel: "Dotation D&A", sheet: "C_P50", rows: [229], sign: -1 },
  { mfSection: "Amortissements (D&A)", mfLabel: "VNC (valeur nette comptable)", sheet: "C_P50", rows: [338], sign: 1 },
  // ── Compte de résultat ──────────────────────────────────────────────────────────────────────
  { mfSection: "Compte de résultat", mfLabel: "EBIT", sheet: "C_P50", rows: [231], sign: 1 },
  { mfSection: "Compte de résultat", mfLabel: "Intérêts dette senior", sheet: "C_P50", rows: [233], sign: -1 },
  { mfSection: "Compte de résultat", mfLabel: "Intérêts SHL (CCA)", sheet: "C_P50", rows: [234], sign: -1 },
  { mfSection: "Compte de résultat", mfLabel: "Intérêts totaux", sheet: "C_P50", rows: [233, 234], sign: -1 },
  { mfSection: "Compte de résultat", mfLabel: "EBT", sheet: "C_P50", rows: [242], sign: 1 },
  { mfSection: "Compte de résultat", mfLabel: "IS", sheet: "C_P50", rows: [245], sign: -1 },
  { mfSection: "Compte de résultat", mfLabel: "Résultat net", sheet: "C_P50", rows: [246], sign: 1 },
  // Déficit fiscal cumulé : MF = max(0, −cumEBT). BP r243 = Cumulative EBT (négatif si déficit).
  { mfSection: "Compte de résultat", mfLabel: "Déficit fiscal cumulé", sheet: "C_P50", rows: [243], sign: 1, xform: (v) => Math.max(0, -v) },
  { mfSection: "Compte de résultat", mfLabel: "Résultat cumulé", sheet: "C_P50", rows: [247], sign: 1 },
  // ── CFADS ──────────────────────────────────────────────────────────────────────────────────
  { mfSection: "CFADS", mfLabel: "CFADS après IS (P50)", sheet: "C_P50", rows: [261], sign: 1 },
  { mfSection: "CFADS", mfLabel: "CFADS P90 (sizing)", sheet: "C_Financing", rows: [81], sign: 1 },
  { mfSection: "CFADS", mfLabel: "CFADS P90 après IS", sheet: "C_P90", rows: [261], sign: 1 },
  // ── Service de la dette (C_Financing = échéancier appliqué/sculpté) ──────────────────────────
  { mfSection: "Service de la dette", mfLabel: "Service dette (appliqué)", sheet: "C_Financing", rows: [152], sign: -1 },
  { mfSection: "Service de la dette", mfLabel: "dont principal", sheet: "C_Financing", rows: [109], sign: -1 },
  { mfSection: "Service de la dette", mfLabel: "dont intérêts", sheet: "C_Financing", rows: [112], sign: -1 },
  { mfSection: "Service de la dette", mfLabel: "Dette restante (EoP)", sheet: "C_Financing", rows: [110], sign: 1 },
  { mfSection: "Service de la dette", mfLabel: "DSCR cible", sheet: "C_Financing", rows: [86], sign: 1 },
  { mfSection: "Service de la dette", mfLabel: "DSCR réalisé", sheet: "C_Financing", rows: [114], sign: 1 },
  // ── Waterfall SHL (CCA) ─────────────────────────────────────────────────────────────────────
  { mfSection: "Waterfall SHL (CCA)", mfLabel: "SHL solde d'ouverture (BoP)", sheet: "C_P50", rows: [287], sign: 1 },
  { mfSection: "Waterfall SHL (CCA)", mfLabel: "SHL intérêts courus", sheet: "C_P50", rows: [293], sign: -1 },
  { mfSection: "Waterfall SHL (CCA)", mfLabel: "SHL remboursement", sheet: "C_P50", rows: [290], sign: -1 },
  { mfSection: "Waterfall SHL (CCA)", mfLabel: "SHL solde de clôture (EoP)", sheet: "C_P50", rows: [291], sign: 1 },
  // ── Distribution actionnaire ────────────────────────────────────────────────────────────────
  { mfSection: "Distribution actionnaire", mfLabel: "Dividende", sheet: "C_P50", rows: [313], sign: -1 },
  { mfSection: "Distribution actionnaire", mfLabel: "Cash pooling", sheet: "C_P50", rows: [319], sign: -1 },
  { mfSection: "Distribution actionnaire", mfLabel: "Flux actionnaire (FCF after DS)", sheet: "C_P50", rows: [268], sign: 1 },
];

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Résolution du projet (argument = nom ou N).
// ─────────────────────────────────────────────────────────────────────────────────────────────
function resolveArg(arg: string): { n: number; name: string } {
  if (/^\d+$/.test(arg)) {
    const n = Number(arg);
    const name = N_TO_NAME[n];
    if (!name) throw new Error(`Aucun projet single-project pour data/${n}.xlsm`);
    return { n, name };
  }
  const q = normalize(arg);
  const hit = Object.entries(N_TO_NAME).find(
    ([, name]) => normalize(name) === q || normalize(name).includes(q),
  );
  if (!hit) throw new Error(`Projet « ${arg} » introuvable dans le mapping N→nom`);
  return { n: Number(hit[0]), name: hit[1] };
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Formatage.
// ─────────────────────────────────────────────────────────────────────────────────────────────
function fmt(n: number | null, d = 1): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const s = n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n >= 0 ? "+" : "") + s + "%";
}

// Plancher |BP| en-dessous duquel une ligne est ignorée (bruit près de zéro), par unité MF.
function floorFor(unite: string): number {
  if (unite === "kEUR") return 5;
  if (unite === "MWh") return 10;
  if (unite === "EUR/MWh") return 0.5;
  if (unite === "ratio") return 0.02;
  return 1;
}

type Cell = { year: number; bp: number | null; mf: number };
type LineResult = {
  section: string;
  label: string;
  unite: string;
  cells: Cell[];
  firstDivergeYear: number | null;
  firstDivergePct: number | null;
  worstYear: number | null;
  worstPct: number | null;
  worstAbs: number | null;
};

function main() {
  const args = process.argv.slice(2);
  const full = args.includes("--full");
  const positional = args.find((a) => !a.startsWith("--"));
  if (!positional) throw new Error('Usage : npx tsx scripts/compare_bp_project.ts "<nom|N>" [--full]');
  const { n, name } = resolveArg(positional);

  // ── Charge le projet + scénario de référence en base, calcule le modèle MF ──────────────────
  const projects = prismaFindProjects();
  const project = projects.find((p) => normalize(p.name) === normalize(name)) ??
    projects.find((p) => normalize(p.name).includes(normalize(name)));
  if (!project) throw new Error(`Projet « ${name} » absent de la base (statut bp_reel)`);
  const scenario = pickReferenceScenario(project.scenarios);
  if (!scenario) throw new Error(`Projet « ${name} » sans scénario`);
  const model: BpModel = buildBpModel(
    {
      name: project.name,
      technology: project.technology,
      capacityMw: project.capacityMw,
      commissioningYear: project.commissioningYear,
      debtSizingCentralW: project.debtSizingCentralW,
      debtSizingLowW: project.debtSizingLowW,
      investorCurveW: project.investorCurveW,
    },
    scenario,
  );
  const finance = computeProjectFinance(
    {
      technology: project.technology,
      capacityMw: project.capacityMw,
      commissioningYear: project.commissioningYear,
      debtSizingCentralW: project.debtSizingCentralW,
      debtSizingLowW: project.debtSizingLowW,
      investorCurveW: project.investorCurveW,
    },
    scenario,
  );

  // ── Ouvre le BP Excel ───────────────────────────────────────────────────────────────────────
  const xlsmPath = path.resolve(process.cwd(), `data/${n}.xlsm`);
  const wb = XLSX.read(readFileSync(xlsmPath), { type: "buffer" });
  const sheets = new Map<BpSheet, ReturnType<typeof openSheet>>();
  for (const s of ["C_P50", "C_P90", "C_Financing", "C_D&A"] as BpSheet[]) {
    sheets.set(s, openSheet(wb, s));
  }

  // MF : index année → position dans valeurs[]. years = [-1,0,1,…] → map year→idx.
  const yearIdx = new Map<number, number>();
  model.years.forEach((y, i) => yearIdx.set(y, i));
  const maxYear = Math.max(...model.years);
  const opYears: number[] = [];
  for (let y = 1; y <= maxYear; y += 1) opYears.push(y);
  const sampleYears = full
    ? opYears
    : [1, 2, 3, 5, 10, 15, 20, 21, 24, 25, 30, 35].filter((y) => y <= maxYear);

  // MF line lookup.
  const mfLine = (section: string, label: string) => {
    const sec = model.sections.find((s) => s.title === section);
    return sec?.lines.find((l) => l.label === label);
  };

  // ── Calcule chaque ligne comparée ───────────────────────────────────────────────────────────
  const results: LineResult[] = [];
  for (const map of MAPPINGS) {
    const line = mfLine(map.mfSection, map.mfLabel);
    if (!line) continue;
    const sheet = sheets.get(map.sheet)!;
    const scale = line.unite === "kEUR" ? 1000 : 1;
    const floor = floorFor(line.unite);

    const cells: Cell[] = [];
    let firstDivergeYear: number | null = null;
    let firstDivergePct: number | null = null;
    let worstYear: number | null = null;
    let worstPct: number | null = null;
    let worstAbs: number | null = null;

    for (const y of opYears) {
      const idx = yearIdx.get(y);
      const mfRaw = idx != null ? line.valeurs[idx] : NaN;
      const mf = Number.isFinite(mfRaw) ? mfRaw : NaN;
      // BP : somme des lignes, xform, signe, échelle.
      const col = sheet.an1Col + (y - 1);
      let bpSum: number | null = 0;
      let hasBp = false;
      for (const r of map.rows) {
        const v = sheet.get(r, col);
        if (v !== null) {
          hasBp = true;
          bpSum = (bpSum ?? 0) + v;
        }
      }
      let bp: number | null = null;
      if (hasBp && bpSum !== null) {
        const t = map.xform ? map.xform(bpSum) : bpSum;
        bp = (map.sign * t) / scale;
      }
      cells.push({ year: y, bp, mf });

      if (bp !== null && Math.abs(bp) >= floor && Number.isFinite(mf)) {
        const pct = ((mf - bp) / bp) * 100;
        const abs = Math.abs(mf - bp);
        if (worstPct === null || Math.abs(pct) > Math.abs(worstPct)) {
          worstPct = pct;
          worstYear = y;
          worstAbs = abs;
        }
        if (firstDivergeYear === null && Math.abs(pct) > SEUIL_PCT) {
          firstDivergeYear = y;
          firstDivergePct = pct;
        }
      }
    }

    results.push({
      section: map.mfSection,
      label: map.mfLabel,
      unite: line.unite,
      cells,
      firstDivergeYear,
      firstDivergePct,
      worstYear,
      worstPct,
      worstAbs,
    });
  }

  // ── Cibles BP (scalaires de synthèse) ─────────────────────────────────────────────────────────
  const cibles = loadCibles(project.name);

  // ═════════════════════════════════════════════════════════════════════════════════════════════
  // IMPRESSION
  // ═════════════════════════════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(96));
  console.log(
    `COMPARATEUR BP↔MF  —  ${project.name}  (data/${n}.xlsm · ${project.technology} · ${project.capacityMw} MW · MES ${project.commissioningYear})`,
  );
  console.log("═".repeat(96));

  // 1) Scalaires de synthèse.
  console.log("\n▌SCALAIRES DE SYNTHÈSE  (MF moteur ↔ cible BP)");
  const scal: Array<[string, number | null, number | null | undefined, string]> = [
    ["CAPEX (calib)", finance.capexCalibKeuro, cibles?.capexTotalKeuro, "k€"],
    ["Dette retenue", finance.debtRetenuKeuro, cibles?.detteKeuro, "k€"],
    ["CCA / SHL", finance.ccaKeuro, cibles?.equityCcaKeuro, "k€"],
    ["Gearing", finance.gearingPct, cibles?.gearingPct, "%"],
    ["TRI investisseur", finance.metrics.investorIrr, cibles?.investorIrrPct, "pp"],
    ["TRI projet (net)", finance.metrics.irr, cibles?.trIProjetNetPct, "pp"],
    ["VAN brute", finance.vanBruteKeuro, cibles?.vanBruteKeuro, "k€"],
    ["VAN nette", finance.vanNetteKeuro, cibles?.vanNetteKeuro, "k€"],
  ];
  console.log(
    `  ${"".padEnd(18)}${"MF".padStart(12)}${"BP".padStart(12)}${"Δ".padStart(12)}${"Δ%".padStart(10)}`,
  );
  for (const [lbl, mf, bp, unit] of scal) {
    const d = mf != null && bp != null ? mf - bp : null;
    const dp = mf != null && bp != null && bp !== 0 ? ((mf - bp) / bp) * 100 : null;
    const flag = dp != null && Math.abs(dp) > 1 ? "  ⚠" : "";
    console.log(
      `  ${lbl.padEnd(18)}${fmt(mf ?? null).padStart(12)}${fmt(bp ?? null).padStart(12)}` +
        `${fmt(d).padStart(12)}${(unit === "pp" ? fmt(d, 2) + "pp" : fmtPct(dp)).padStart(10)}${flag}`,
    );
  }

  // 2) Top divergences (par ligne, sur son pire écart au-delà du plancher).
  const ranked = results
    .filter((r) => r.worstPct !== null && Math.abs(r.worstPct) > SEUIL_PCT && (r.worstAbs ?? 0) > 0)
    .sort((a, b) => Math.abs(b.worstPct!) - Math.abs(a.worstPct!));
  console.log("\n▌TOP DIVERGENCES DE MÉTHODE  (ligne · pire année · ampleur)");
  if (ranked.length === 0) {
    console.log("  (aucune ligne au-delà de ±0,5% — projet calé sur toutes les sections mappées)");
  } else {
    ranked.slice(0, 5).forEach((r, i) => {
      console.log(
        `  ${i + 1}. [${r.section}] ${r.label}  →  an${r.worstYear} : ` +
          `BP ${fmt(r.cells.find((c) => c.year === r.worstYear)?.bp ?? null)} · ` +
          `MF ${fmt(r.cells.find((c) => c.year === r.worstYear)?.mf ?? null)} · ` +
          `Δ ${fmt(r.worstAbs)} (${fmtPct(r.worstPct)})`,
      );
    });
  }

  // 3) Table par section.
  const yh = sampleYears.map((y) => `an${y}`.padStart(11)).join("");
  const sectionsOrder = [...new Set(MAPPINGS.map((m) => m.mfSection))];
  for (const section of sectionsOrder) {
    const lines = results.filter((r) => r.section === section);
    if (lines.length === 0) continue;
    console.log(`\n▌${section}`);
    console.log(`  ${"ligne".padEnd(26)}${"".padStart(4)}${yh}`);
    for (const r of lines) {
      const diverges = r.firstDivergeYear !== null;
      const mark = diverges ? "✗" : "✓";
      const rowsToPrint = sampleYears;
      const bpRow = rowsToPrint
        .map((y) => fmt(r.cells.find((c) => c.year === y)?.bp ?? null).padStart(11))
        .join("");
      const mfRow = rowsToPrint
        .map((y) => {
          const c = r.cells.find((cc) => cc.year === y);
          return fmt(c && Number.isFinite(c.mf) ? c.mf : null).padStart(11);
        })
        .join("");
      const dpRow = rowsToPrint
        .map((y) => {
          const c = r.cells.find((cc) => cc.year === y);
          if (!c || c.bp === null || !Number.isFinite(c.mf) || Math.abs(c.bp) < floorFor(r.unite))
            return "·".padStart(11);
          return fmtPct(((c.mf - c.bp) / c.bp) * 100).padStart(11);
        })
        .join("");
      console.log(`  ${mark} ${r.label.padEnd(24)} BP ${bpRow}`);
      console.log(`  ${"".padEnd(26)} MF ${mfRow}`);
      console.log(`  ${"".padEnd(26)} Δ% ${dpRow}`);
      if (diverges) {
        console.log(
          `       ↳ 1er écart >${SEUIL_PCT}% : an${r.firstDivergeYear} (${fmtPct(r.firstDivergePct)}) · ` +
            `pire : an${r.worstYear} (${fmtPct(r.worstPct)}, Δ ${fmt(r.worstAbs)})`,
        );
      }
    }
  }

  // Gaps connus (documentés par le modèle MF).
  if (model.gaps.length) {
    console.log("\n▌GAPS MF connus (méthode incomplète, documentée par bpModel) :");
    model.gaps.forEach((g) => console.log(`  • ${g}`));
  }
  console.log("");
}

// ── Accès Prisma (synchrone via better-sqlite3 adapter → on encapsule dans une promesse) ────────
type LoadedProject = Awaited<ReturnType<typeof loadProjects>>[number];
async function loadProjects() {
  return prisma.project.findMany({ where: { status: "bp_reel" }, include: { scenarios: true } });
}
// Helper synchrone (main est appelé dans un then).
let PROJECTS_CACHE: LoadedProject[] = [];
function prismaFindProjects(): LoadedProject[] {
  return PROJECTS_CACHE;
}

type Cibles = { targets: Record<string, number | null> };
function loadCibles(name: string): Record<string, number | null> | null {
  const slug = slugify(name);
  const files = readdirSync(CIBLES_DIR).filter((f) => f.endsWith(".json"));
  const f = files.find((x) => x === `${slug}.json`);
  if (!f) return null;
  const c = JSON.parse(readFileSync(path.join(CIBLES_DIR, f), "utf8")) as Cibles;
  return c.targets;
}

loadProjects()
  .then((projects) => {
    PROJECTS_CACHE = projects;
    main();
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * Export Excel du modèle BP — Option A : mise en page calquée sur le BP réel (SPEC_BP_SIGOULES.md :
 * onglets Inp_Assumption/C_P50/C_P90/C_Financing) + VALEURS figées (pas de formules vivantes).
 * Auditable ligne à ligne : chaque cellule numérique reproduit exactement une valeur de `BpModel`
 * (app/lib/bpModel.ts), lui-même dérivé du moteur financier. Ce module NE recalcule RIEN : il
 * consomme `buildBpModel` et se contente de mapper les sections/lignes sur des feuilles xlsx
 * (via SheetJS `utils.aoa_to_sheet` — tableau de tableaux, une ligne = un array de cellules).
 *
 * Deux classeurs :
 *   - `buildBpWorkbook` / `buildBpWorkbookBuffer` : export PAR PROJET, 4 onglets (Hypothèses,
 *     C_P50, C_P90, C_Financing) — utilisé par la route app/api/projects/[id]/export.
 *   - `buildPortfolioWorkbook` / `buildPortfolioWorkbookBuffer` : export DU PORTEFEUILLE, un
 *     classeur unique = 1 onglet « Synthèse portefeuille » + 1 onglet « modèle complet » par
 *     projet — utilisé par la route app/api/projects/export.
 */
import * as XLSX from "xlsx";
import type { Scenario } from "@/app/generated/prisma/client";
import {
  buildBpModel,
  type BpLine,
  type BpModel,
  type BpProjectFields,
  type BpSection,
  type BpUnit,
} from "@/app/lib/bpModel";

/** Une ligne de feuille xlsx (aoa_to_sheet) : cellules texte ou nombre brut (audit = pas de texte formaté). */
type SheetRow = (string | number)[];

/** Libellé d'unité (colonne dédiée) — copie volontairement isolée de bp/page.tsx (zéro dépendance UI). */
function unitLabel(unite: BpUnit): string {
  switch (unite) {
    case "kEUR":
      return "k€";
    case "kEUR/MW":
      return "k€/MW";
    case "%":
      return "%";
    case "ratio":
      return "x";
    case "MWh":
      return "MWh";
    case "EUR/MWh":
      return "€/MWh";
    case "MW":
      return "MW";
    case "annees":
      return "ans";
    default:
      return "";
  }
}

/** NaN (« non applicable ») → cellule vide (pas de texte « - », pour ne pas polluer l'audit numérique). */
function numOrBlank(value: number): number | string {
  return Number.isFinite(value) ? value : "";
}

/** an1 = commissioningYear (calendrier réel). Copie de la formule engine.ts (calendarYear = commissioningYear + year - 1). */
function calendarYear(year: number, commissioningYear: number): number {
  return commissioningYear + year - 1;
}

function findSection(model: BpModel, title: string): BpSection {
  const section = model.sections.find((s) => s.title === title);
  if (!section) {
    throw new Error(`bpExcel: section "${title}" introuvable dans le modèle BP.`);
  }
  return section;
}

function findLine(section: BpSection, label: string): BpLine {
  const line = section.lines.find((l) => l.label === label);
  if (!line) {
    throw new Error(`bpExcel: ligne "${label}" introuvable dans la section "${section.title}".`);
  }
  return line;
}

/** Une ligne annuelle (label, unité, 1 valeur par année) ; scalaire → une seule valeur après l'unité. */
function annualLineRow(line: BpLine): SheetRow {
  if (line.scalar) {
    return [line.label, unitLabel(line.unite), numOrBlank(line.valeurs[0] ?? NaN)];
  }
  return [line.label, unitLabel(line.unite), ...line.valeurs.map(numOrBlank)];
}

type Block = { sectionTitle: string; lines: BpLine[] };

/**
 * Feuille « annuelle » : 1re colonne = libellé, 2e = unité, puis 1 colonne par année. Deux lignes
 * d'en-tête (année réelle calendaire + numéro de période, cf spec) puis un bandeau par section.
 */
function annualSheetAoa(
  title: string,
  blocks: Block[],
  years: number[],
  commissioningYear: number,
): SheetRow[] {
  const rows: SheetRow[] = [];
  rows.push([title]);
  rows.push(["Ligne", "Unité", ...years.map((y) => calendarYear(y, commissioningYear))]);
  rows.push(["", "", ...years.map((y) => `an${y}`)]);
  for (const block of blocks) {
    rows.push([block.sectionTitle]);
    for (const line of block.lines) {
      rows.push(annualLineRow(line));
    }
  }
  return rows;
}

/** Feuille « scalaire » (Hypothèses / Outputs) : label / unité / valeur unique — pas de colonnes année. */
function scalarSheetAoa(title: string, blocks: Block[], gaps: string[]): SheetRow[] {
  const rows: SheetRow[] = [];
  rows.push([title]);
  rows.push(["Ligne", "Unité", "Valeur"]);
  for (const block of blocks) {
    rows.push([block.sectionTitle]);
    for (const line of block.lines) {
      rows.push([line.label, unitLabel(line.unite), numOrBlank(line.valeurs[0] ?? NaN)]);
    }
  }
  if (gaps.length > 0) {
    rows.push([""]);
    rows.push(["Notes — champs BP non exposés au grain annuel par le moteur"]);
    for (const gap of gaps) {
      rows.push([gap]);
    }
  }
  return rows;
}

/** Modèle complet (toutes les sections, scalaires + annuelles) sur UNE feuille — vue portefeuille. */
function fullModelAoa(model: BpModel, commissioningYear: number): SheetRow[] {
  const rows: SheetRow[] = [];
  rows.push([`Modèle BP complet — ${model.projectName} (${model.scenarioName})`]);
  rows.push(["Ligne", "Unité", ...model.years.map((y) => calendarYear(y, commissioningYear))]);
  rows.push(["", "", ...model.years.map((y) => `an${y}`)]);
  for (const section of model.sections) {
    rows.push([section.title]);
    for (const line of section.lines) {
      if (line.scalar) {
        rows.push([line.label, unitLabel(line.unite), numOrBlank(line.valeurs[0] ?? NaN)]);
      } else {
        rows.push([line.label, unitLabel(line.unite), ...line.valeurs.map(numOrBlank)]);
      }
    }
  }
  if (model.gaps.length > 0) {
    rows.push([""]);
    rows.push(["Notes — champs BP non exposés au grain annuel par le moteur"]);
    for (const gap of model.gaps) {
      rows.push([gap]);
    }
  }
  return rows;
}

/**
 * Construit le classeur PAR PROJET : 4 onglets calqués sur le BP réel.
 *   - Hypothèses  : hypothèses clés + outputs (synthèse), scalaires.
 *   - C_P50       : production/revenus P50, OPEX par poste, EBITDA P50, D&A, P&L, CFADS P50,
 *                   waterfall SHL, distribution actionnaire — annuel.
 *   - C_P90       : production/revenus/EBITDA/CFADS P90 (sizing) — annuel.
 *   - C_Financing : service de la dette, DSCR, DSRA, waterfall SHL — annuel.
 * Fonction pure : lecture seule, aucun effet de bord (consomme buildBpModel, ne le modifie pas).
 */
export function buildBpWorkbook(project: BpProjectFields, scenario: Scenario): XLSX.WorkBook {
  const model = buildBpModel(project, scenario);
  const wb = XLSX.utils.book_new();

  const hypotheses = findSection(model, "Hypothèses clés (rappel)");
  const outputs = findSection(model, "Outputs (synthèse)");
  const production = findSection(model, "Production");
  const revenus = findSection(model, "Revenus");
  const opex = findSection(model, "OPEX par poste (P50)");
  const ebitda = findSection(model, "EBITDA");
  const da = findSection(model, "Amortissements (D&A)");
  const cdr = findSection(model, "Compte de résultat");
  const cfads = findSection(model, "CFADS");
  const serviceDette = findSection(model, "Service de la dette");
  const dsra = findSection(model, "Réserve de service de la dette (DSRA)");
  const shl = findSection(model, "Waterfall SHL (CCA)");
  const distrib = findSection(model, "Distribution actionnaire");

  const hypAoa = scalarSheetAoa(
    `Hypothèses — ${model.projectName} (${model.scenarioName})`,
    [
      { sectionTitle: hypotheses.title, lines: hypotheses.lines },
      { sectionTitle: outputs.title, lines: outputs.lines },
    ],
    model.gaps,
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hypAoa), "Hypothèses");

  const p50Aoa = annualSheetAoa(
    `C_P50 — ${model.projectName}`,
    [
      {
        sectionTitle: production.title,
        lines: [findLine(production, "Production P50"), findLine(production, "Tarif appliqué")],
      },
      { sectionTitle: revenus.title, lines: [findLine(revenus, "Revenus P50 (total)")] },
      { sectionTitle: opex.title, lines: opex.lines },
      { sectionTitle: ebitda.title, lines: [findLine(ebitda, "EBITDA P50")] },
      { sectionTitle: da.title, lines: da.lines },
      { sectionTitle: cdr.title, lines: cdr.lines },
      { sectionTitle: cfads.title, lines: [findLine(cfads, "CFADS après IS (P50)")] },
      { sectionTitle: shl.title, lines: shl.lines },
      { sectionTitle: distrib.title, lines: distrib.lines },
    ],
    model.years,
    project.commissioningYear,
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(p50Aoa), "C_P50");

  const p90Aoa = annualSheetAoa(
    `C_P90 — ${model.projectName}`,
    [
      { sectionTitle: production.title, lines: [findLine(production, "Production P90")] },
      { sectionTitle: revenus.title, lines: [findLine(revenus, "Revenus P90 (sizing)")] },
      { sectionTitle: ebitda.title, lines: [findLine(ebitda, "EBITDA P90")] },
      {
        sectionTitle: cfads.title,
        lines: [
          findLine(cfads, "CFADS P90 (sizing)"),
          findLine(cfads, "CFADS P90 après IS"),
        ],
      },
    ],
    model.years,
    project.commissioningYear,
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(p90Aoa), "C_P90");

  const financingAoa = annualSheetAoa(
    `C_Financing — ${model.projectName}`,
    [
      { sectionTitle: serviceDette.title, lines: serviceDette.lines },
      { sectionTitle: dsra.title, lines: dsra.lines },
      { sectionTitle: shl.title, lines: shl.lines },
    ],
    model.years,
    project.commissioningYear,
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(financingAoa), "C_Financing");

  return wb;
}

/** Classeur par projet, sérialisé en buffer .xlsx (pour la réponse HTTP de téléchargement). */
export function buildBpWorkbookBuffer(project: BpProjectFields, scenario: Scenario): Buffer {
  const wb = buildBpWorkbook(project, scenario);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Noms d'onglet Excel : 31 caractères max, pas de : \ / ? * [ ], uniques dans le classeur. */
function sanitizeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[:\\/?*[\]]/g, " ").trim();
  if (base.length > 31) {
    base = base.slice(0, 31);
  }
  if (base.length === 0) {
    base = "Projet";
  }
  let candidate = base;
  let suffixIndex = 2;
  while (used.has(candidate)) {
    const suffix = ` ${suffixIndex}`;
    candidate = base.slice(0, Math.max(0, 31 - suffix.length)) + suffix;
    suffixIndex += 1;
  }
  used.add(candidate);
  return candidate;
}

/**
 * Construit le classeur PORTEFEUILLE : 1 onglet « Synthèse portefeuille » (KPI par projet, lus
 * directement dans la section Outputs de chaque BpModel — même source que le détail) + 1 onglet
 * par projet portant le modèle complet (toutes sections, scalaires + annuelles).
 */
export function buildPortfolioWorkbook(
  entries: readonly { project: BpProjectFields; scenario: Scenario }[],
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>(["Synthèse portefeuille"]);

  const summaryHeader: SheetRow = [
    "Projet",
    "Technologie",
    "Capacité (MW)",
    "MES",
    "Scénario",
    "CAPEX effectif (k€)",
    "Dette retenue (k€)",
    "CCA (k€)",
    "Gearing (%)",
    "TRI investisseur (%)",
    "TRI projet (%)",
    "VAN brute (k€)",
    "VAN nette (k€)",
    "LCOE (€/MWh)",
    "DSCR minimum",
  ];
  const summaryRows: SheetRow[] = [summaryHeader];

  for (const { project, scenario } of entries) {
    const model = buildBpModel(project, scenario);
    const outputs = findSection(model, "Outputs (synthèse)");
    const outputValue = (label: string) => numOrBlank(findLine(outputs, label).valeurs[0] ?? NaN);

    summaryRows.push([
      model.projectName,
      project.technology,
      project.capacityMw,
      project.commissioningYear,
      model.scenarioName,
      outputValue("CAPEX effectif"),
      outputValue("Dette retenue"),
      outputValue("CCA (SHL)"),
      outputValue("Gearing"),
      outputValue("TRI investisseur"),
      outputValue("TRI projet"),
      outputValue("VAN brute"),
      outputValue("VAN nette"),
      outputValue("LCOE"),
      outputValue("DSCR minimum"),
    ]);

    const sheetName = sanitizeSheetName(model.projectName, used);
    const aoa = fullModelAoa(model, project.commissioningYear);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheetName);
  }

  // La feuille synthèse doit être EN TÊTE du classeur (book_append_sheet ajoute en fin de liste).
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Synthèse portefeuille");
  wb.SheetNames.unshift(wb.SheetNames.pop() as string);

  return wb;
}

/** Classeur portefeuille, sérialisé en buffer .xlsx. */
export function buildPortfolioWorkbookBuffer(
  entries: readonly { project: BpProjectFields; scenario: Scenario }[],
): Buffer {
  const wb = buildPortfolioWorkbook(entries);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

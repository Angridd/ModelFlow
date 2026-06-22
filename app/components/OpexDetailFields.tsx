"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateOpexDetails } from "@/app/lib/finance/engine";

type OpexDetailInitialValue = {
  opex: number;
  surfaceHa?: number | null;
  yieldMwh?: number | null;
  tariff?: number | null;
  tariffInflationRate?: number | null;
  contractDuration?: number | null;
  assuranceRate?: number | null;
  inflationAssurance?: number | null;
  balancingCost?: number | null;
  omFixedEuroKwc?: number | null;
  mraEuroKwc?: number | null;
  backOfficeKeuro?: number | null;
  diversOpexKeuro?: number | null;
  loyerMode?: string | null;
  loyerValeur?: number | null;
  loyerInflation?: number | null;
  inflationOM?: number | null;
  inflationMRA?: number | null;
  inflationBackOffice?: number | null;
  inflationDivers?: number | null;
  methodeTaxes?: string | null;
  tauxTFCommune?: number | null;
  tauxTFEPCI?: number | null;
  tauxTSE?: number | null;
  tauxGEMAPI?: number | null;
  tauxTEOM?: number | null;
  tauxCFECommune?: number | null;
  tauxCFEEPCI?: number | null;
  tauxCCI?: number | null;
  prixTerrainHa?: number | null;
  abattTerrain?: number | null;
  inflationTaxes?: number | null;
};

type OpexDetailFieldsProps = {
  capacityMw: number;
  initialValue: OpexDetailInitialValue;
};

const numberInputClass =
  "h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900 placeholder:text-zinc-400";

function parseNumber(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function initialNumber(value: number | null | undefined, fallback = "") {
  return value != null ? String(value) : fallback;
}

function formatKeuro(value: number) {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kEUR/an`;
}

function formatKeuroDecimal(value: number) {
  return `${value.toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })} kEUR/an`;
}

function formatEuro(value: number) {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} EUR`;
}

function formatOpexPerMw(value: number) {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kEUR/MWc`;
}

function defaultInputClass(value: string, defaultValue: string) {
  return `${numberInputClass} ${value === defaultValue ? "input-default" : ""}`.trim();
}

function syncedInitialValue(initialValue: number | null | undefined, fallback: number) {
  return initialValue ?? fallback;
}

function useSyncedFormNumber(name: string, initialValue: number) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);

    if (!input) {
      return;
    }

    const sync = () => setValue(parseNumber(input.value) ?? initialValue);
    sync();
    input.addEventListener("input", sync);

    return () => input.removeEventListener("input", sync);
  }, [initialValue, name]);

  return value;
}

export function OpexDetailFields({
  capacityMw,
  initialValue,
}: OpexDetailFieldsProps) {
  const [omFixedEuroKwc, setOmFixedEuroKwc] = useState(
    initialNumber(initialValue.omFixedEuroKwc, "5.1"),
  );
  const [mraEuroKwc, setMraEuroKwc] = useState(
    initialNumber(initialValue.mraEuroKwc, "1.1"),
  );
  const [backOfficeKeuro, setBackOfficeKeuro] = useState(
    initialNumber(initialValue.backOfficeKeuro, "22"),
  );
  const [diversOpexKeuro, setDiversOpexKeuro] = useState(
    initialNumber(initialValue.diversOpexKeuro, "35"),
  );
  const [loyerMode, setLoyerMode] = useState(initialValue.loyerMode ?? "");
  const [loyerValeur, setLoyerValeur] = useState(initialNumber(initialValue.loyerValeur));
  const [loyerInflation, setLoyerInflation] = useState(
    initialNumber(initialValue.loyerInflation, "0.4"),
  );
  const [inflationOM, setInflationOM] = useState(
    initialNumber(initialValue.inflationOM, "2"),
  );
  const [inflationMRA, setInflationMRA] = useState(
    initialNumber(initialValue.inflationMRA, "2"),
  );
  const [inflationBackOffice, setInflationBackOffice] = useState(
    initialNumber(initialValue.inflationBackOffice, "2"),
  );
  const [inflationDivers, setInflationDivers] = useState(
    initialNumber(initialValue.inflationDivers, "2"),
  );
  const [methodeTaxes, setMethodeTaxes] = useState(
    initialValue.methodeTaxes ?? "appreciation_directe",
  );
  const [tauxTFCommune, setTauxTFCommune] = useState(
    initialNumber(initialValue.tauxTFCommune),
  );
  const [tauxTFEPCI, setTauxTFEPCI] = useState(initialNumber(initialValue.tauxTFEPCI));
  const [tauxTSE, setTauxTSE] = useState(initialNumber(initialValue.tauxTSE));
  const [tauxGEMAPI, setTauxGEMAPI] = useState(initialNumber(initialValue.tauxGEMAPI));
  const [tauxTEOM, setTauxTEOM] = useState(initialNumber(initialValue.tauxTEOM));
  const [tauxCFECommune, setTauxCFECommune] = useState(
    initialNumber(initialValue.tauxCFECommune),
  );
  const [tauxCFEEPCI, setTauxCFEEPCI] = useState(initialNumber(initialValue.tauxCFEEPCI));
  const [tauxCCI, setTauxCCI] = useState(initialNumber(initialValue.tauxCCI));
  const [prixTerrainHa, setPrixTerrainHa] = useState(
    initialNumber(initialValue.prixTerrainHa, "5000"),
  );
  const [abattTerrain, setAbattTerrain] = useState(
    initialNumber(initialValue.abattTerrain, "0"),
  );
  const [inflationTaxes, setInflationTaxes] = useState(
    initialNumber(initialValue.inflationTaxes, "0.4"),
  );

  const capexPerMwKeuro = useSyncedFormNumber("capex", 0);
  const surfaceHa = useSyncedFormNumber(
    "surfaceHa",
    syncedInitialValue(initialValue.surfaceHa, 0),
  );
  const yieldMwh = useSyncedFormNumber(
    "yieldMwh",
    syncedInitialValue(initialValue.yieldMwh, 0),
  );
  const tariff = useSyncedFormNumber("tariff", syncedInitialValue(initialValue.tariff, 0));
  const tariffInflationRate = useSyncedFormNumber(
    "tariffInflationRate",
    syncedInitialValue(initialValue.tariffInflationRate, 0.4),
  );
  const contractDuration = useSyncedFormNumber(
    "contractDuration",
    syncedInitialValue(initialValue.contractDuration, 20),
  );
  const assuranceRate = useSyncedFormNumber(
    "assuranceRate",
    syncedInitialValue(initialValue.assuranceRate, 2.5),
  );
  const inflationAssurance = useSyncedFormNumber(
    "inflationAssurance",
    syncedInitialValue(initialValue.inflationAssurance, 2),
  );
  const balancingCost = useSyncedFormNumber(
    "balancingCost",
    syncedInitialValue(initialValue.balancingCost, 2),
  );

  const productionP50Mwh = yieldMwh * capacityMw;
  const annualTariff =
    contractDuration >= 1
      ? tariff * (1 + tariffInflationRate / 100)
      : 0;
  const revenueP50Keuro = productionP50Mwh * annualTariff / 1000;
  const hasLocalTaxRate = [
    tauxTFCommune,
    tauxTFEPCI,
    tauxTSE,
    tauxGEMAPI,
    tauxTEOM,
    tauxCFECommune,
    tauxCFEEPCI,
    tauxCCI,
  ].some((value) => parseNumber(value) !== null);

  const details = useMemo(
    () =>
      calculateOpexDetails(
        {
          capacityMw,
          capex: capexPerMwKeuro,
          opex: initialValue.opex,
          yieldMwh,
          tariff,
          debtRate: 0,
          projectLifeYears: 1,
          degradationRate: 0,
          discountRate: 0,
          debtInterestRate: 0,
          debtMaturityYears: 1,
          tariffInflationRate,
          opexInflationRate: 0,
          surfaceHa,
          contractDuration,
          assuranceRate,
          inflationAssurance,
          balancingCost,
          omFixedEuroKwc: parseNumber(omFixedEuroKwc),
          mraEuroKwc: parseNumber(mraEuroKwc),
          backOfficeKeuro: parseNumber(backOfficeKeuro),
          diversOpexKeuro: parseNumber(diversOpexKeuro),
          loyerMode,
          loyerValeur: parseNumber(loyerValeur),
          loyerInflation: parseNumber(loyerInflation),
          inflationOM: parseNumber(inflationOM),
          inflationMRA: parseNumber(inflationMRA),
          inflationBackOffice: parseNumber(inflationBackOffice),
          inflationDivers: parseNumber(inflationDivers),
          methodeTaxes,
          tauxTFCommune: parseNumber(tauxTFCommune),
          tauxTFEPCI: parseNumber(tauxTFEPCI),
          tauxTSE: parseNumber(tauxTSE),
          tauxGEMAPI: parseNumber(tauxGEMAPI),
          tauxTEOM: parseNumber(tauxTEOM),
          tauxCFECommune: parseNumber(tauxCFECommune),
          tauxCFEEPCI: parseNumber(tauxCFEEPCI),
          tauxCCI: parseNumber(tauxCCI),
          prixTerrainHa: parseNumber(prixTerrainHa),
          abattTerrain: parseNumber(abattTerrain),
          inflationTaxes: parseNumber(inflationTaxes),
        },
        1,
        revenueP50Keuro,
        productionP50Mwh,
      ),
    [
      assuranceRate,
      backOfficeKeuro,
      balancingCost,
      capexPerMwKeuro,
      capacityMw,
      contractDuration,
      diversOpexKeuro,
      abattTerrain,
      inflationAssurance,
      inflationBackOffice,
      inflationDivers,
      inflationMRA,
      inflationOM,
      inflationTaxes,
      initialValue.opex,
      loyerInflation,
      loyerMode,
      loyerValeur,
      methodeTaxes,
      mraEuroKwc,
      omFixedEuroKwc,
      prixTerrainHa,
      productionP50Mwh,
      revenueP50Keuro,
      surfaceHa,
      tariff,
      tariffInflationRate,
      tauxCFECommune,
      tauxCFEEPCI,
      tauxCCI,
      tauxGEMAPI,
      tauxTEOM,
      tauxTFCommune,
      tauxTFEPCI,
      tauxTSE,
      yieldMwh,
    ],
  );

  return (
    <section className="grid gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <input type="hidden" name="opex" value={details.opexPerMwKeuro} />
      <h2 className="text-sm font-semibold text-zinc-950">OPEX detaille</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>O&M fixe (EUR/kWc/an) <span className="badge-default">Défaut</span></span>
          <input
            name="omFixedEuroKwc"
            type="number"
            min="0"
            step="0.01"
            value={omFixedEuroKwc}
            onChange={(event) => setOmFixedEuroKwc(event.target.value)}
            placeholder="ex. 5.1"
            title="Exploitation et maintenance proportionnelle a la puissance installee"
            className={defaultInputClass(omFixedEuroKwc, "5.1")}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>MRA (EUR/kWc/an) <span className="badge-default">Défaut</span></span>
          <input
            name="mraEuroKwc"
            type="number"
            min="0"
            step="0.01"
            value={mraEuroKwc}
            onChange={(event) => setMraEuroKwc(event.target.value)}
            placeholder="ex. 1.1"
            title="Major Replacement Allowance - provision remplacement onduleurs etc."
            className={defaultInputClass(mraEuroKwc, "1.1")}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>Back-office (kEUR/an) <span className="badge-default">Défaut</span></span>
          <input
            name="backOfficeKeuro"
            type="number"
            min="0"
            step="0.01"
            value={backOfficeKeuro}
            onChange={(event) => setBackOfficeKeuro(event.target.value)}
            placeholder="ex. 22"
            title="Frais de gestion administrative annuels fixes"
            className={defaultInputClass(backOfficeKeuro, "22")}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>Divers OPEX (kEUR/an) <span className="badge-default">Défaut</span></span>
          <input
            name="diversOpexKeuro"
            type="number"
            min="0"
            step="0.01"
            value={diversOpexKeuro}
            onChange={(event) => setDiversOpexKeuro(event.target.value)}
            placeholder="ex. 35"
            title="Charges diverses forfaitaires annuelles"
            className={defaultInputClass(diversOpexKeuro, "35")}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Loyer foncier - mode
          <select
            name="loyerMode"
            value={loyerMode}
            onChange={(event) => setLoyerMode(event.target.value)}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none focus:border-zinc-900"
          >
            <option value="">-</option>
            <option value="fixe">Montant fixe (kEUR/an)</option>
            <option value="euroParHa">EUR/ha/an</option>
            <option value="euroParMWc">EUR/MWc/an</option>
            <option value="pctCA">% du CA</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Loyer foncier - valeur
          <input
            name="loyerValeur"
            type="number"
            min="0"
            step="0.01"
            value={loyerValeur}
            onChange={(event) => setLoyerValeur(event.target.value)}
            placeholder="ex. 3"
            title="Valeur appliquee selon le mode de loyer"
            className={numberInputClass}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>Inflation loyer (%/an) <span className="badge-default">Défaut</span></span>
          <input
            name="loyerInflation"
            type="number"
            min="0"
            step="0.01"
            value={loyerInflation}
            onChange={(event) => setLoyerInflation(event.target.value)}
            placeholder="ex. 0.4"
            className={defaultInputClass(loyerInflation, "0.4")}
          />
        </label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>Inflation O&M (%/an) <span className="badge-default">Défaut</span></span>
          <input
            name="inflationOM"
            type="number"
            min="0"
            step="0.01"
            value={inflationOM}
            onChange={(event) => setInflationOM(event.target.value)}
            placeholder="ex. 2"
            className={defaultInputClass(inflationOM, "2")}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>Inflation MRA (%/an) <span className="badge-default">Défaut</span></span>
          <input
            name="inflationMRA"
            type="number"
            min="0"
            step="0.01"
            value={inflationMRA}
            onChange={(event) => setInflationMRA(event.target.value)}
            placeholder="ex. 2"
            className={defaultInputClass(inflationMRA, "2")}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>Inflation back-office (%/an) <span className="badge-default">Défaut</span></span>
          <input
            name="inflationBackOffice"
            type="number"
            min="0"
            step="0.01"
            value={inflationBackOffice}
            onChange={(event) => setInflationBackOffice(event.target.value)}
            placeholder="ex. 2"
            className={defaultInputClass(inflationBackOffice, "2")}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>Inflation divers (%/an) <span className="badge-default">Défaut</span></span>
          <input
            name="inflationDivers"
            type="number"
            min="0"
            step="0.01"
            value={inflationDivers}
            onChange={(event) => setInflationDivers(event.target.value)}
            placeholder="ex. 2"
            className={defaultInputClass(inflationDivers, "2")}
          />
        </label>
      </div>
      <div className="grid gap-4 border-t border-zinc-200 pt-4">
        <h3 className="text-sm font-semibold text-zinc-950">Taxes locales (TF &amp; CFE)</h3>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          <span>Méthode de calcul <span className="badge-default">Défaut</span></span>
          <select
            name="methodeTaxes"
            value={methodeTaxes}
            onChange={(event) => setMethodeTaxes(event.target.value)}
            title="Appréciation directe : base sur valeur vénale terrain + immo (8%). Comptable : base sur valeur comptable immo (4%). LF 2021."
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none focus:border-zinc-900"
          >
            <option value="appreciation_directe">Appréciation directe</option>
            <option value="comptable">Méthode comptable</option>
          </select>
        </label>
        <div className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Taux communaux TFPB (%) - consulter avis TF de la commune
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Taux commune
              <input name="tauxTFCommune" type="number" min="0" step="0.01" value={tauxTFCommune} onChange={(event) => setTauxTFCommune(event.target.value)} placeholder="ex. 28.5" className={numberInputClass} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Taux EPCI
              <input name="tauxTFEPCI" type="number" min="0" step="0.01" value={tauxTFEPCI} onChange={(event) => setTauxTFEPCI(event.target.value)} placeholder="ex. 12.3" className={numberInputClass} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              TSE
              <input name="tauxTSE" type="number" min="0" step="0.01" value={tauxTSE} onChange={(event) => setTauxTSE(event.target.value)} placeholder="ex. 5.2" className={numberInputClass} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              GEMAPI
              <input name="tauxGEMAPI" type="number" min="0" step="0.01" value={tauxGEMAPI} onChange={(event) => setTauxGEMAPI(event.target.value)} placeholder="ex. 0.8" className={numberInputClass} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              TEOM
              <input name="tauxTEOM" type="number" min="0" step="0.01" value={tauxTEOM} onChange={(event) => setTauxTEOM(event.target.value)} placeholder="ex. 9.4" className={numberInputClass} />
            </label>
          </div>
        </div>
        <div className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Taux CFE (%) - consulter avis CFE de la commune
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Taux commune
              <input name="tauxCFECommune" type="number" min="0" step="0.01" value={tauxCFECommune} onChange={(event) => setTauxCFECommune(event.target.value)} placeholder="ex. 22.1" className={numberInputClass} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              Taux EPCI
              <input name="tauxCFEEPCI" type="number" min="0" step="0.01" value={tauxCFEEPCI} onChange={(event) => setTauxCFEEPCI(event.target.value)} placeholder="ex. 8.5" className={numberInputClass} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              CCI
              <input name="tauxCCI" type="number" min="0" step="0.01" value={tauxCCI} onChange={(event) => setTauxCCI(event.target.value)} placeholder="ex. 0.5" className={numberInputClass} />
            </label>
          </div>
        </div>
        <div className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Terrain</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              <span>Prix terrain (EUR/ha) <span className="badge-default">Défaut</span></span>
              <input name="prixTerrainHa" type="number" min="0" step="0.01" value={prixTerrainHa} onChange={(event) => setPrixTerrainHa(event.target.value)} placeholder="ex. 5000" className={defaultInputClass(prixTerrainHa, "5000")} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              <span>Abattement terrain (%) <span className="badge-default">Défaut</span></span>
              <input name="abattTerrain" type="number" min="0" step="0.01" value={abattTerrain} onChange={(event) => setAbattTerrain(event.target.value)} placeholder="ex. 0" className={defaultInputClass(abattTerrain, "0")} />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-700">
              <span>Inflation taxes (%/an) <span className="badge-default">Défaut</span></span>
              <input name="inflationTaxes" type="number" min="0" step="0.01" value={inflationTaxes} onChange={(event) => setInflationTaxes(event.target.value)} placeholder="ex. 0.4" className={defaultInputClass(inflationTaxes, "0.4")} />
            </label>
          </div>
        </div>
        {!hasLocalTaxRate ? (
          <span className="badge badge-yellow">Taux non renseignés - TF et CFE = 0</span>
        ) : null}
      </div>
      <div className="grid gap-2 border-t border-zinc-200 pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">O&M</span>
          <span className="font-medium text-zinc-950">{formatKeuro(details.omKeuro)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">MRA</span>
          <span className="font-medium text-zinc-950">{formatKeuro(details.mraKeuro)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Back-office</span>
          <span className="font-medium text-zinc-950">
            {formatKeuro(details.backOfficeKeuro)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Divers</span>
          <span className="font-medium text-zinc-950">
            {formatKeuro(details.diversKeuro)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Loyer</span>
          <span className="font-medium text-zinc-950">{formatKeuro(details.loyerKeuro)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Assurance</span>
          <span className="font-medium text-zinc-950">
            {formatKeuro(details.assuranceKeuro)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Balancing</span>
          <span className="font-medium text-zinc-950">
            {formatKeuro(details.balancingKeuro)}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-4 border-t border-zinc-300 pt-3">
          <span className="text-zinc-500">Base imposable calculée</span>
          <span className="font-medium text-zinc-950">
            {formatEuro(details.baseTaxesEuro)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">TF annuelle (an 1)</span>
          <span className="font-medium text-zinc-950">
            {formatKeuroDecimal(details.tfKeuro)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">CFE annuelle (an 1)</span>
          <span className="font-medium text-zinc-950">
            {formatKeuroDecimal(details.cfeKeuro)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Total taxes locales</span>
          <span className="font-medium text-zinc-950">
            {formatKeuroDecimal(details.tfKeuro + details.cfeKeuro)}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-4 border-t border-zinc-300 pt-3 font-semibold text-zinc-950">
          <span>OPEX TOTAL an 1</span>
          <span>{formatKeuro(details.opexTotalKeuro)}</span>
        </div>
        <div className="flex justify-between gap-4 font-semibold text-zinc-950">
          <span>OPEX/MWc an 1</span>
          <span>{formatOpexPerMw(details.opexPerMwKeuro)}</span>
        </div>
      </div>
    </section>
  );
}

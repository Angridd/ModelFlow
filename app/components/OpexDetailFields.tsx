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

function formatOpexPerMw(value: number) {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kEUR/MWc`;
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

  const details = useMemo(
    () =>
      calculateOpexDetails(
        {
          capacityMw,
          capex: 0,
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
        },
        1,
        revenueP50Keuro,
        productionP50Mwh,
      ),
    [
      assuranceRate,
      backOfficeKeuro,
      balancingCost,
      capacityMw,
      contractDuration,
      diversOpexKeuro,
      inflationAssurance,
      inflationBackOffice,
      inflationDivers,
      inflationMRA,
      inflationOM,
      initialValue.opex,
      loyerInflation,
      loyerMode,
      loyerValeur,
      mraEuroKwc,
      omFixedEuroKwc,
      productionP50Mwh,
      revenueP50Keuro,
      surfaceHa,
      tariff,
      tariffInflationRate,
      yieldMwh,
    ],
  );

  return (
    <section className="grid gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <input type="hidden" name="opex" value={details.opexPerMwKeuro} />
      <h2 className="text-sm font-semibold text-zinc-950">OPEX detaille</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          O&M fixe (EUR/kWc/an)
          <input
            name="omFixedEuroKwc"
            type="number"
            min="0"
            step="0.01"
            value={omFixedEuroKwc}
            onChange={(event) => setOmFixedEuroKwc(event.target.value)}
            placeholder="ex. 5.1"
            title="Exploitation et maintenance proportionnelle a la puissance installee"
            className={numberInputClass}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          MRA (EUR/kWc/an)
          <input
            name="mraEuroKwc"
            type="number"
            min="0"
            step="0.01"
            value={mraEuroKwc}
            onChange={(event) => setMraEuroKwc(event.target.value)}
            placeholder="ex. 1.1"
            title="Major Replacement Allowance - provision remplacement onduleurs etc."
            className={numberInputClass}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Back-office (kEUR/an)
          <input
            name="backOfficeKeuro"
            type="number"
            min="0"
            step="0.01"
            value={backOfficeKeuro}
            onChange={(event) => setBackOfficeKeuro(event.target.value)}
            placeholder="ex. 22"
            title="Frais de gestion administrative annuels fixes"
            className={numberInputClass}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Divers OPEX (kEUR/an)
          <input
            name="diversOpexKeuro"
            type="number"
            min="0"
            step="0.01"
            value={diversOpexKeuro}
            onChange={(event) => setDiversOpexKeuro(event.target.value)}
            placeholder="ex. 35"
            title="Charges diverses forfaitaires annuelles"
            className={numberInputClass}
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
          Inflation loyer (%/an)
          <input
            name="loyerInflation"
            type="number"
            min="0"
            step="0.01"
            value={loyerInflation}
            onChange={(event) => setLoyerInflation(event.target.value)}
            placeholder="ex. 0.4"
            className={numberInputClass}
          />
        </label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Inflation O&M (%/an)
          <input
            name="inflationOM"
            type="number"
            min="0"
            step="0.01"
            value={inflationOM}
            onChange={(event) => setInflationOM(event.target.value)}
            placeholder="ex. 2"
            className={numberInputClass}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Inflation MRA (%/an)
          <input
            name="inflationMRA"
            type="number"
            min="0"
            step="0.01"
            value={inflationMRA}
            onChange={(event) => setInflationMRA(event.target.value)}
            placeholder="ex. 2"
            className={numberInputClass}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Inflation back-office (%/an)
          <input
            name="inflationBackOffice"
            type="number"
            min="0"
            step="0.01"
            value={inflationBackOffice}
            onChange={(event) => setInflationBackOffice(event.target.value)}
            placeholder="ex. 2"
            className={numberInputClass}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Inflation divers (%/an)
          <input
            name="inflationDivers"
            type="number"
            min="0"
            step="0.01"
            value={inflationDivers}
            onChange={(event) => setInflationDivers(event.target.value)}
            placeholder="ex. 2"
            className={numberInputClass}
          />
        </label>
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

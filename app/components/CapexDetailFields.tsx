"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateCapexDetails,
  calculateFinancingFees,
} from "@/app/lib/finance/engine";

type CapexDetailInitialValue = {
  capex: number;
  surfaceHa?: number | null;
  prixModuleUSDWc?: number | null;
  tauxEURUSD?: number | null;
  boSCtWc?: number | null;
  raccordementOuvrageKEuro?: number | null;
  tarifQPKEuroPerMW?: number | null;
  apportAffaireMode?: string | null;
  apportAffaireValeur?: number | null;
  devFeesKEuroPerMW?: number | null;
  contingencyRate?: number | null;
};

type CapexDetailFieldsProps = {
  capacityMw: number;
  initialValue: CapexDetailInitialValue;
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
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kEUR`;
}

function formatCapexPerMw(value: number) {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} kEUR/MWc`;
}

function formatCtWc(value: number) {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ct/Wc`;
}

const financingInputNames = [
  "legalFeesK€",
  "technicalDDK€",
  "arrangerFeesRate",
  "participantFeesRate",
  "bankFeesPLTK€PerMW",
  "interimFinancingRate",
  "commitmentFeesRate",
] as const;

type FinancingInputName = (typeof financingInputNames)[number];
type FinancingInputValues = Record<FinancingInputName, number | null>;

function readNamedNumber(name: string) {
  const input = document.getElementsByName(name)[0];

  return input instanceof HTMLInputElement ? parseNumber(input.value) : null;
}

export function CapexDetailFields({
  capacityMw,
  initialValue,
}: CapexDetailFieldsProps) {
  const capexInputRef = useRef<HTMLInputElement>(null);
  const [surfaceHa, setSurfaceHa] = useState(initialNumber(initialValue.surfaceHa));
  const [prixModuleUSDWc, setPrixModuleUSDWc] = useState(
    initialNumber(initialValue.prixModuleUSDWc),
  );
  const [tauxEURUSD, setTauxEURUSD] = useState(
    initialNumber(initialValue.tauxEURUSD, "1.08"),
  );
  const [boSCtWc, setBoSCtWc] = useState(initialNumber(initialValue.boSCtWc));
  const [raccordementOuvrageKEuro, setRaccordementOuvrageKEuro] = useState(
    initialNumber(initialValue.raccordementOuvrageKEuro),
  );
  const [tarifQPKEuroPerMW, setTarifQPKEuroPerMW] = useState(
    initialNumber(initialValue.tarifQPKEuroPerMW),
  );
  const [apportAffaireMode, setApportAffaireMode] = useState(
    initialValue.apportAffaireMode ?? "",
  );
  const [apportAffaireValeur, setApportAffaireValeur] = useState(
    initialNumber(initialValue.apportAffaireValeur),
  );
  const [devFeesKEuroPerMW, setDevFeesKEuroPerMW] = useState(
    initialValue.devFeesKEuroPerMW ?? 0,
  );
  const [contingencyRate, setContingencyRate] = useState(
    initialNumber(initialValue.contingencyRate, "2"),
  );
  const [gearingMaxPct, setGearingMaxPct] = useState<number | null>(null);
  const [financingValues, setFinancingValues] = useState<FinancingInputValues>({
    "legalFeesK€": null,
    "technicalDDK€": null,
    arrangerFeesRate: null,
    participantFeesRate: null,
    "bankFeesPLTK€PerMW": null,
    interimFinancingRate: null,
    commitmentFeesRate: null,
  });

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>(
      'input[name="devFeesKEuroPerMW"]',
    );

    if (!input) {
      return;
    }

    const sync = () => setDevFeesKEuroPerMW(parseNumber(input.value) ?? 0);
    sync();
    input.addEventListener("input", sync);

    return () => input.removeEventListener("input", sync);
  }, []);

  useEffect(() => {
    const sync = () => {
      setGearingMaxPct(readNamedNumber("gearingMaxPct"));
      setFinancingValues({
        "legalFeesK€": readNamedNumber("legalFeesK€"),
        "technicalDDK€": readNamedNumber("technicalDDK€"),
        arrangerFeesRate: readNamedNumber("arrangerFeesRate"),
        participantFeesRate: readNamedNumber("participantFeesRate"),
        "bankFeesPLTK€PerMW": readNamedNumber("bankFeesPLTK€PerMW"),
        interimFinancingRate: readNamedNumber("interimFinancingRate"),
        commitmentFeesRate: readNamedNumber("commitmentFeesRate"),
      });
    };
    const inputs = [
      document.getElementsByName("gearingMaxPct")[0],
      ...financingInputNames.map((name) => document.getElementsByName(name)[0]),
    ].filter((input): input is HTMLInputElement => input instanceof HTMLInputElement);

    sync();
    inputs.forEach((input) => input.addEventListener("input", sync));

    return () => {
      inputs.forEach((input) => input.removeEventListener("input", sync));
    };
  }, []);

  const details = useMemo(
    () =>
      calculateCapexDetails({
        capacityMw,
        capex: initialValue.capex,
        opex: 0,
        yieldMwh: 0,
        tariff: 0,
        debtRate: 0,
        projectLifeYears: 1,
        degradationRate: 0,
        discountRate: 0,
        debtInterestRate: 0,
        debtMaturityYears: 1,
        tariffInflationRate: 0,
        opexInflationRate: 0,
        surfaceHa: parseNumber(surfaceHa),
        prixModuleUSDWc: parseNumber(prixModuleUSDWc),
        tauxEURUSD: parseNumber(tauxEURUSD),
        boSCtWc: parseNumber(boSCtWc),
        raccordementOuvrageKEuro: parseNumber(raccordementOuvrageKEuro),
        tarifQPKEuroPerMW: parseNumber(tarifQPKEuroPerMW),
        apportAffaireMode,
        apportAffaireValeur: parseNumber(apportAffaireValeur),
        devFeesKEuroPerMW,
        contingencyRate: parseNumber(contingencyRate),
      }),
    [
      apportAffaireMode,
      apportAffaireValeur,
      boSCtWc,
      capacityMw,
      devFeesKEuroPerMW,
      initialValue.capex,
      prixModuleUSDWc,
      raccordementOuvrageKEuro,
      surfaceHa,
      tarifQPKEuroPerMW,
      tauxEURUSD,
      contingencyRate,
    ],
  );
  const financingFees = useMemo(
    () =>
      calculateFinancingFees({
        capacityMw,
        capexTotalKeuro: details.capexTotalKeuro,
        gearingMaxPct,
        legalFeesKEuro: financingValues["legalFeesK€"],
        technicalDDKEuro: financingValues["technicalDDK€"],
        arrangerFeesRate: financingValues.arrangerFeesRate,
        participantFeesRate: financingValues.participantFeesRate,
        bankFeesPLTKEuroPerMW: financingValues["bankFeesPLTK€PerMW"],
        interimFinancingRate: financingValues.interimFinancingRate,
        commitmentFeesRate: financingValues.commitmentFeesRate,
      }),
    [capacityMw, details.capexTotalKeuro, financingValues, gearingMaxPct],
  );
  const capexEffectifKeuro = details.capexTotalKeuro + financingFees.financingFeesKeuro;

  useEffect(() => {
    capexInputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [details.capexPerMwKeuro]);

  return (
    <section className="grid gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <input ref={capexInputRef} type="hidden" name="capex" value={details.capexPerMwKeuro} />
      <h2 className="text-sm font-semibold text-zinc-950">CAPEX detaille</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Superficie (ha)
          <input
            name="surfaceHa"
            type="number"
            min="0"
            step="0.01"
            value={surfaceHa}
            onChange={(event) => setSurfaceHa(event.target.value)}
            placeholder="ex. 14"
            title="Surface totale du projet en hectares"
            className={numberInputClass}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Taux EUR/USD
          <input
            name="tauxEURUSD"
            type="number"
            min="0"
            step="0.0001"
            value={tauxEURUSD}
            onChange={(event) => setTauxEURUSD(event.target.value)}
            placeholder="ex. 1.08"
            title="Taux de change spot EUR/USD pour conversion prix module"
            className={numberInputClass}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Prix module (ct/Wc USD)
          <input
            name="prixModuleUSDWc"
            type="number"
            min="0"
            step="0.01"
            value={prixModuleUSDWc}
            onChange={(event) => setPrixModuleUSDWc(event.target.value)}
            placeholder="ex. 12"
            title="Prix panneau en centimes USD par Wc - converti automatiquement en EUR"
            className={numberInputClass}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          BoS (ct/Wc)
          <input
            name="boSCtWc"
            type="number"
            min="0"
            step="0.01"
            value={boSCtWc}
            onChange={(event) => setBoSCtWc(event.target.value)}
            placeholder="ex. 25"
            title="Balance of System : tout sauf module, raccordement, soft CAPEX et frais financiers"
            className={numberInputClass}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Raccordement ouvrage (kEUR)
          <input
            name="raccordementOuvrageK€"
            type="number"
            min="0"
            step="0.01"
            value={raccordementOuvrageKEuro}
            onChange={(event) => setRaccordementOuvrageKEuro(event.target.value)}
            placeholder="ex. 800"
            title="Cout fixe de l'ouvrage de raccordement"
            className={numberInputClass}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Tarif QP S3RENR (kEUR/MW injecte)
          <input
            name="tarifQPk€PerMW"
            type="number"
            min="0"
            step="0.01"
            value={tarifQPKEuroPerMW}
            onChange={(event) => setTarifQPKEuroPerMW(event.target.value)}
            placeholder="ex. 45"
            title="Quote-part reseau - puissance injectee = capacite / 1.35 par defaut"
            className={numberInputClass}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Apport d'affaire - mode
          <select
            name="apportAffaireMode"
            value={apportAffaireMode}
            onChange={(event) => setApportAffaireMode(event.target.value)}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none focus:border-zinc-900"
          >
            <option value="">-</option>
            <option value="fixe">Montant fixe (kEUR)</option>
            <option value="euroParMWc">EUR/MWc</option>
            <option value="euroParHa">EUR/ha</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Apport d'affaire - valeur
          <input
            name="apportAffaireValeur"
            type="number"
            min="0"
            step="0.01"
            value={apportAffaireValeur}
            onChange={(event) => setApportAffaireValeur(event.target.value)}
            placeholder="ex. 50"
            title="Valeur appliquee selon le mode d'apport d'affaire"
            className={numberInputClass}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-700">
          Contingency (%)
          <input
            name="contingencyRate"
            type="number"
            min="0"
            step="0.01"
            value={contingencyRate}
            onChange={(event) => setContingencyRate(event.target.value)}
            placeholder="ex. 2"
            title="Provision pour aléas sur le CAPEX - appliquée sur le CAPEX avant frais de financement"
            className={numberInputClass}
          />
        </label>
      </div>
      <div className="grid gap-2 border-t border-zinc-200 pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">CAPEX modules</span>
          <span className="font-medium text-zinc-950">{formatKeuro(details.modulesKeuro)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">CAPEX BoS</span>
          <span className="font-medium text-zinc-950">{formatKeuro(details.boSKeuro)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Raccordement</span>
          <span className="font-medium text-zinc-950">
            {formatKeuro(details.raccordementKeuro)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Apport d'affaire</span>
          <span className="font-medium text-zinc-950">
            {formatKeuro(details.apportAffaireKeuro)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Dev fees</span>
          <span className="font-medium text-zinc-950">{formatKeuro(details.devFeesKeuro)}</span>
        </div>
        <div className="mt-2 flex justify-between gap-4 border-t border-zinc-300 pt-3">
          <span className="text-zinc-500">Sous-total</span>
          <span className="font-medium text-zinc-950">
            {formatKeuro(details.capexBeforeContingencyKeuro)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Contingency ({parseNumber(contingencyRate) ?? 2}%)</span>
          <span className="font-medium text-zinc-950">{formatKeuro(details.contingencyKeuro)}</span>
        </div>
        <div className="mt-2 flex justify-between gap-4 border-t border-zinc-300 pt-3 font-semibold text-zinc-950">
          <span>CAPEX total</span>
          <span>{formatKeuro(details.capexTotalKeuro)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Frais financement</span>
          <span className="font-medium text-zinc-950">
            {formatKeuro(financingFees.financingFeesKeuro)}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-4 border-t border-zinc-300 pt-3 font-semibold" style={{ color: "var(--ps-blue-dark)" }}>
          <span>CAPEX effectif</span>
          <span>{formatKeuro(capexEffectifKeuro)}</span>
        </div>
        <div className="flex justify-between gap-4 font-semibold text-zinc-950">
          <span>CAPEX/MWc</span>
          <span>
            {formatCapexPerMw(capacityMw > 0 ? capexEffectifKeuro / capacityMw : 0)}
          </span>
        </div>
        <p className="text-xs text-zinc-400">
          Modules equivalents : {formatCtWc(details.modulesCtWc)}
        </p>
      </div>
    </section>
  );
}

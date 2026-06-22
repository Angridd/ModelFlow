"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateFinancingFees } from "@/app/lib/finance/engine";

type FinancingFeesInitialValue = {
  capexPerMwKeuro: number;
  gearingMaxPct?: number | null;
  legalFeesKEuro?: number | null;
  technicalDDKEuro?: number | null;
  arrangerFeesRate?: number | null;
  participantFeesRate?: number | null;
  bankFeesPLTKEuroPerMW?: number | null;
  interimFinancingRate?: number | null;
  commitmentFeesRate?: number | null;
};

type FinancingFeesFieldsProps = {
  capacityMw: number;
  initialValue: FinancingFeesInitialValue;
};

const numberInputClass =
  "h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900 placeholder:text-zinc-400";

const financingFeeFields = [
  {
    stateKey: "legalFeesKEuro",
    name: "legalFeesK€",
    label: "Legal fees (k€ forfait)",
    step: "0.01",
    placeholder: "ex. 10",
    title: "Frais juridiques forfaitaires liés au closing",
    fallback: 10,
  },
  {
    stateKey: "technicalDDKEuro",
    name: "technicalDDK€",
    label: "Technical DD (k€ forfait)",
    step: "0.01",
    placeholder: "ex. 5",
    title: "Due diligence technique bancaire",
    fallback: 5,
  },
  {
    stateKey: "arrangerFeesRate",
    name: "arrangerFeesRate",
    label: "Arranger fees (% du PLT)",
    step: "0.01",
    placeholder: "ex. 0.8",
    title: "Commission d'arrangement - % du montant de dette",
    fallback: 0.8,
  },
  {
    stateKey: "participantFeesRate",
    name: "participantFeesRate",
    label: "Participant fees (% du PLT)",
    step: "0.01",
    placeholder: "ex. 0.4",
    title: "Commission de participation bancaire",
    fallback: 0.4,
  },
  {
    stateKey: "bankFeesPLTKEuroPerMW",
    name: "bankFeesPLTK€PerMW",
    label: "Bank fees PLT (k€/MW)",
    step: "0.01",
    placeholder: "ex. 1.5",
    title: "Frais documentaires bancaires - 1 500 €/MW",
    fallback: 1.5,
  },
  {
    stateKey: "interimFinancingRate",
    name: "interimFinancingRate",
    label: "Interim financing cost (% du PLT)",
    step: "0.01",
    placeholder: "ex. 2.5",
    title: "Coût du financement intérimaire (pont) pendant la construction",
    fallback: 2.5,
  },
  {
    stateKey: "commitmentFeesRate",
    name: "commitmentFeesRate",
    label: "Commitment fees (% du PLT)",
    step: "0.01",
    placeholder: "ex. 0.1",
    title: "Commission d'engagement sur la dette non tirée",
    fallback: 0.1,
  },
] as const;

type FinancingFeeStateKey = (typeof financingFeeFields)[number]["stateKey"];
type FinancingFeeState = Record<FinancingFeeStateKey, string>;

function parseNumber(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function initialNumber(value: number | null | undefined, fallback: number) {
  return String(value ?? fallback);
}

function formatKeuro(value: number) {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k€`;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("fr-FR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  })} %`;
}

export function FinancingFeesFields({
  capacityMw,
  initialValue,
}: FinancingFeesFieldsProps) {
  const [capexPerMwKeuro, setCapexPerMwKeuro] = useState(initialValue.capexPerMwKeuro);
  const [gearingMaxPct, setGearingMaxPct] = useState(initialValue.gearingMaxPct ?? 95);
  const [values, setValues] = useState<FinancingFeeState>(() => ({
    legalFeesKEuro: initialNumber(initialValue.legalFeesKEuro, 10),
    technicalDDKEuro: initialNumber(initialValue.technicalDDKEuro, 5),
    arrangerFeesRate: initialNumber(initialValue.arrangerFeesRate, 0.8),
    participantFeesRate: initialNumber(initialValue.participantFeesRate, 0.4),
    bankFeesPLTKEuroPerMW: initialNumber(initialValue.bankFeesPLTKEuroPerMW, 1.5),
    interimFinancingRate: initialNumber(initialValue.interimFinancingRate, 2.5),
    commitmentFeesRate: initialNumber(initialValue.commitmentFeesRate, 0.1),
  }));

  useEffect(() => {
    const capexInput = document.querySelector<HTMLInputElement>('input[name="capex"]');
    const gearingInput = document.querySelector<HTMLInputElement>(
      'input[name="gearingMaxPct"]',
    );

    const sync = () => {
      if (capexInput) {
        setCapexPerMwKeuro(parseNumber(capexInput.value) ?? 0);
      }
      if (gearingInput) {
        setGearingMaxPct(parseNumber(gearingInput.value) ?? 95);
      }
    };

    sync();
    capexInput?.addEventListener("input", sync);
    gearingInput?.addEventListener("input", sync);

    return () => {
      capexInput?.removeEventListener("input", sync);
      gearingInput?.removeEventListener("input", sync);
    };
  }, []);

  const capexTotalKeuro = capexPerMwKeuro * capacityMw;
  const estimatedPltKeuro = capexTotalKeuro * gearingMaxPct / 100;
  const fees = useMemo(
    () =>
      calculateFinancingFees({
        capacityMw,
        capexTotalKeuro,
        gearingMaxPct,
        legalFeesKEuro: parseNumber(values.legalFeesKEuro),
        technicalDDKEuro: parseNumber(values.technicalDDKEuro),
        arrangerFeesRate: parseNumber(values.arrangerFeesRate),
        participantFeesRate: parseNumber(values.participantFeesRate),
        bankFeesPLTKEuroPerMW: parseNumber(values.bankFeesPLTKEuroPerMW),
        interimFinancingRate: parseNumber(values.interimFinancingRate),
        commitmentFeesRate: parseNumber(values.commitmentFeesRate),
      }),
    [capexTotalKeuro, capacityMw, gearingMaxPct, values],
  );
  const capexShare =
    capexTotalKeuro > 0 ? fees.financingFeesKeuro / capexTotalKeuro * 100 : 0;

  return (
    <section className="grid gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <h2 className="text-sm font-semibold text-zinc-950">Frais de financement</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        {financingFeeFields.map((field) => (
          <label key={field.name} className="grid gap-2 text-sm font-medium text-zinc-700">
            {field.label}
            <input
              name={field.name}
              type="number"
              min="0"
              step={field.step}
              value={values[field.stateKey]}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.stateKey]: event.target.value,
                }))
              }
              placeholder={field.placeholder}
              title={field.title}
              className={numberInputClass}
            />
          </label>
        ))}
      </div>
      <div className="grid gap-2 border-t border-zinc-200 pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Legal fees</span>
          <span className="font-medium text-zinc-950">
            {formatKeuro(fees.financingFeesDetail.legalFees)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Technical DD</span>
          <span className="font-medium text-zinc-950">
            {formatKeuro(fees.financingFeesDetail.technicalDD)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">
            Arranger fees ({values.arrangerFeesRate}% x PLT estimé)
          </span>
          <span className="font-medium text-zinc-950">
            {formatKeuro(fees.financingFeesDetail.arrangerFees)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Participant fees</span>
          <span className="font-medium text-zinc-950">
            {formatKeuro(fees.financingFeesDetail.participantFees)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Bank fees PLT</span>
          <span className="font-medium text-zinc-950">
            {formatKeuro(fees.financingFeesDetail.bankFeesPLT)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Interim financing</span>
          <span className="font-medium text-zinc-950">
            {formatKeuro(fees.financingFeesDetail.interimFinancing)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-500">Commitment fees</span>
          <span className="font-medium text-zinc-950">
            {formatKeuro(fees.financingFeesDetail.commitmentFees)}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-4 border-t border-zinc-300 pt-3 font-semibold text-zinc-950">
          <span>TOTAL frais fin.</span>
          <span>{formatKeuro(fees.financingFeesKeuro)}</span>
        </div>
        <div className="flex justify-between gap-4 font-semibold text-zinc-950">
          <span>% du CAPEX</span>
          <span>{formatPercent(capexShare)}</span>
        </div>
        <p className="text-xs text-zinc-400">
          PLT estimé : {formatKeuro(estimatedPltKeuro)}
        </p>
      </div>
    </section>
  );
}

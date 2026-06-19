"use client";

import { useRef, useState } from "react";

type AuroraTechnology = "fixed" | "tracking";

type AuroraImportProps = {
  projectId: string;
  auroraUpdatedAt: string | null;
  auroraTechnology: string | null;
  debtSizingCentralW: number | null;
  debtSizingLowW: number | null;
  investorCurveW: number | null;
};

function technologyLabel(value: string | null) {
  return value === "tracking" ? "Tracking solar PV" : "Fixed solar PV";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatQuarter(value: Date) {
  return `Q${Math.floor(value.getMonth() / 3) + 1} ${value.getFullYear()}`;
}

export function AuroraImport({
  projectId,
  auroraUpdatedAt,
  auroraTechnology,
  debtSizingCentralW,
  debtSizingLowW,
  investorCurveW,
}: AuroraImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [technology, setTechnology] = useState<AuroraTechnology>(
    auroraTechnology === "tracking" ? "tracking" : "fixed",
  );
  const [centralWeight, setCentralWeight] = useState(
    Math.round((debtSizingCentralW ?? 0.7) * 100),
  );
  const [lowWeight, setLowWeight] = useState(Math.round((debtSizingLowW ?? 0.3) * 100));
  const [investorWeight, setInvestorWeight] = useState(
    Math.round((investorCurveW ?? 1) * 100),
  );
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDebtWeightValid = centralWeight + lowWeight === 100;

  async function importAurora() {
    const file = fileInputRef.current?.files?.[0] ?? null;

    setMessage(null);
    setError(null);

    if (!file) {
      setError("Selectionnez un fichier .xlsx.");
      return;
    }

    if (!isDebtWeightValid) {
      setError("Central + Low doit etre egal a 100 %.");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("technology", technology);
    formData.set("debtSizingCentralW", String(centralWeight));
    formData.set("debtSizingLowW", String(lowWeight));
    formData.set("investorCurveW", String(investorWeight));
    setIsImporting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/aurora`, {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        success?: boolean;
        yearsImported?: number;
        error?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(result.error ?? "Import Aurora impossible.");
      }

      setMessage(
        `✅ ${result.yearsImported ?? 0} annees importees · ${technologyLabel(technology)} · ${formatQuarter(new Date())}`,
      );
      setIsOpen(false);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import Aurora impossible.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Importer courbes Aurora
        </button>
        {auroraUpdatedAt ? (
          <span className="text-sm font-medium text-zinc-500">
            Derniere mise a jour : {formatDate(auroraUpdatedAt)} ·{" "}
            {technologyLabel(auroraTechnology)}
          </span>
        ) : null}
      </div>
      {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}
      {error && !isOpen ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4">
          <div className="w-full max-w-lg rounded-md border border-zinc-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-zinc-950">
                Importer courbes Aurora
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Technologie
                <select
                  value={technology}
                  onChange={(event) =>
                    setTechnology(event.target.value === "tracking" ? "tracking" : "fixed")
                  }
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none focus:border-zinc-900"
                >
                  <option value="fixed">Fixed solar PV</option>
                  <option value="tracking">Tracking solar PV</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Fichier Aurora
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700"
                />
              </label>

              <div className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-sm font-semibold text-zinc-950">
                  Ponderation Debt Sizing
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-zinc-700">
                    Central (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={centralWeight}
                      onChange={(event) => setCentralWeight(Number(event.target.value))}
                      className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-zinc-700">
                    Low (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={lowWeight}
                      onChange={(event) => setLowWeight(Number(event.target.value))}
                      className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
                    />
                  </label>
                </div>
                {!isDebtWeightValid ? (
                  <p className="text-sm font-medium text-red-700">
                    Central + Low doit etre egal a 100 %.
                  </p>
                ) : null}
              </div>

              <label className="grid gap-2 text-sm font-medium text-zinc-700">
                Ponderation Investor Curve - Central (%)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={investorWeight}
                  onChange={(event) => setInvestorWeight(Number(event.target.value))}
                  className="h-10 rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
                />
              </label>
            </div>

            {error ? <p className="mt-4 text-sm font-medium text-red-700">{error}</p> : null}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={importAurora}
                disabled={isImporting || !isDebtWeightValid}
                className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
              >
                {isImporting ? "Import..." : "Importer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

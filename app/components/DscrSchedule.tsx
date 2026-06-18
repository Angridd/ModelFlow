"use client";

import { useState } from "react";
import type { DscrTranche } from "@/app/lib/finance/types";

const DSCR_FALLBACK = 1.3;

function validateSchedule(tranches: DscrTranche[]): string | null {
  for (const t of tranches) {
    if (t.yearFrom >= t.yearTo) {
      return `Année début (${t.yearFrom}) doit être inférieure à l'année fin (${t.yearTo}).`;
    }
    if (t.dscrValue <= 1.0) {
      return `Le DSCR minimum doit être supérieur à 1,0.`;
    }
  }
  for (let i = 0; i < tranches.length; i++) {
    for (let j = i + 1; j < tranches.length; j++) {
      const a = tranches[i];
      const b = tranches[j];
      if (a.yearFrom <= b.yearTo && b.yearFrom <= a.yearTo) {
        return `Les tranches ${i + 1} et ${j + 1} se chevauchent.`;
      }
    }
  }
  return null;
}

export function DscrSchedule({ initialValue }: { initialValue?: DscrTranche[] | null }) {
  const [tranches, setTranches] = useState<DscrTranche[]>(
    initialValue && initialValue.length > 0 ? initialValue : [],
  );

  const addTranche = () => {
    const last = tranches.at(-1);
    const yearFrom = last ? last.yearTo + 1 : 1;
    const yearTo = yearFrom + 14;
    setTranches([...tranches, { yearFrom, yearTo, dscrValue: DSCR_FALLBACK }]);
  };

  const removeTranche = (i: number) => {
    setTranches(tranches.filter((_, idx) => idx !== i));
  };

  const update = (i: number, field: keyof DscrTranche, raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const updated = [...tranches];
    updated[i] = { ...updated[i], [field]: value };
    setTranches(updated);
  };

  const error = validateSchedule(tranches);
  const jsonValue = tranches.length > 0 ? JSON.stringify(tranches) : "";

  return (
    <div className="grid gap-2">
      <input type="hidden" name="dscrSchedule" value={jsonValue} />
      {tranches.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-50 text-zinc-600">
                <th className="border border-zinc-200 px-3 py-2 text-left font-medium">
                  Année début
                </th>
                <th className="border border-zinc-200 px-3 py-2 text-left font-medium">
                  Année fin
                </th>
                <th className="border border-zinc-200 px-3 py-2 text-left font-medium">
                  DSCR minimum
                </th>
                <th className="w-8 border border-zinc-200" />
              </tr>
            </thead>
            <tbody>
              {tranches.map((t, i) => (
                <tr key={i}>
                  <td className="border border-zinc-200 p-1">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      title="Première année couverte par cette tranche (incluse)"
                      value={t.yearFrom}
                      onChange={(e) => update(i, "yearFrom", e.target.value)}
                      className="h-8 w-full rounded px-2 text-zinc-950 outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </td>
                  <td className="border border-zinc-200 p-1">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      title="Dernière année couverte par cette tranche (incluse)"
                      value={t.yearTo}
                      onChange={(e) => update(i, "yearTo", e.target.value)}
                      className="h-8 w-full rounded px-2 text-zinc-950 outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </td>
                  <td className="border border-zinc-200 p-1">
                    <input
                      type="number"
                      step="0.01"
                      min="1.01"
                      title="Ratio de couverture du service de la dette cible — ex. 1,30 signifie que les flux doivent couvrir 130 % du service de la dette"
                      value={t.dscrValue}
                      onChange={(e) => update(i, "dscrValue", e.target.value)}
                      className="h-8 w-full rounded px-2 text-zinc-950 outline-none focus:ring-1 focus:ring-zinc-900"
                    />
                  </td>
                  <td className="border border-zinc-200 p-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeTranche(i)}
                      title="Supprimer cette tranche"
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-zinc-400">Aucune tranche définie — la dette ne sera pas sculptée.</p>
      )}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={addTranche}
        className="w-fit inline-flex h-8 items-center gap-1 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
      >
        + Ajouter une tranche
      </button>
      <p className="text-xs text-zinc-400">
        Ex. : 1,35 sur les années 1–5 (risque de rampe), 1,20 sur les années 6–15.
        Fallback : 1,30 pour les années non couvertes par une tranche.
      </p>
    </div>
  );
}

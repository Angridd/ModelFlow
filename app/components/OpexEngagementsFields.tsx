"use client";

import { useState } from "react";

type OpexEngagementsFieldsProps = {
  /** Nombre d'années projet — nombre de lignes de la grille (an1..anN). */
  years: number;
  /** Valeurs initiales en k€ (index 0 = an1). */
  initialValue?: number[] | null;
};

const MIN_ROWS = 1;
const MAX_ROWS = 40;

function clampRows(years: number, initialLength: number) {
  return Math.min(MAX_ROWS, Math.max(MIN_ROWS, years, initialLength));
}

export function OpexEngagementsFields({ years, initialValue }: OpexEngagementsFieldsProps) {
  const rowCount = clampRows(
    Number.isFinite(years) ? Math.trunc(years) : MIN_ROWS,
    initialValue?.length ?? 0,
  );
  const [values, setValues] = useState<string[]>(() =>
    Array.from({ length: rowCount }, (_, index) => {
      const value = initialValue?.[index];
      return value != null ? String(value) : "";
    }),
  );

  const numbers = values.map((value) => {
    if (value.trim() === "") {
      return 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  });

  // Trim des zéros de queue : l'index 0 = an1, on ne conserve que jusqu'au dernier montant non nul.
  let lastNonZero = numbers.length - 1;
  while (lastNonZero >= 0 && numbers[lastNonZero] === 0) {
    lastNonZero -= 1;
  }

  const trimmed = numbers.slice(0, lastNonZero + 1);
  const total = numbers.reduce((sum, value) => sum + value, 0);
  const jsonValue = trimmed.length > 0 ? JSON.stringify(trimmed) : "";

  const update = (index: number, raw: string) => {
    setValues((current) => {
      const next = [...current];
      next[index] = raw;
      return next;
    });
  };

  return (
    <div className="grid gap-2">
      <input type="hidden" name="opexEngagementsKeuroByYear" value={jsonValue} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-50 text-zinc-600">
              <th className="border border-zinc-200 px-3 py-2 text-left font-medium">
                Année projet
              </th>
              <th className="border border-zinc-200 px-3 py-2 text-left font-medium">
                Engagement (k€)
              </th>
            </tr>
          </thead>
          <tbody>
            {values.map((value, index) => (
              <tr key={index}>
                <td className="border border-zinc-200 px-3 py-1 text-zinc-500">
                  An {index + 1}
                </td>
                <td className="border border-zinc-200 p-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={value}
                    onChange={(event) => update(index, event.target.value)}
                    placeholder="0"
                    title={`Montant réel d'engagement OPEX pour l'année ${index + 1}, en k€ (routé sans ré-indexation)`}
                    className="h-8 w-full rounded px-2 text-zinc-950 outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold text-zinc-950">
              <td className="border border-zinc-200 px-3 py-2">Total</td>
              <td className="border border-zinc-200 px-3 py-2">
                {total.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k€
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-zinc-400">
        Montants réels an-par-an (déjà datés par le BP) — ajoutés à l'OPEX P50 et P90 sans
        ré-indexation. Grille vide → aucun engagement (comportement inchangé).
      </p>
    </div>
  );
}

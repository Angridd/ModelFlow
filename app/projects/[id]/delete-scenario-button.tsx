"use client";

import { deleteScenario } from "@/app/actions";

export function DeleteScenarioButton({
  projectId,
  scenarioId,
  scenarioName,
}: {
  projectId: string;
  scenarioId: string;
  scenarioName: string;
}) {
  const deleteScenarioForProject = deleteScenario.bind(null, projectId, scenarioId);

  return (
    <form
      action={deleteScenarioForProject}
      onSubmit={(event) => {
        if (!window.confirm(`Supprimer le scenario "${scenarioName}" ?`)) {
          event.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="inline-flex h-8 items-center justify-center rounded-md border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Supprimer
      </button>
    </form>
  );
}

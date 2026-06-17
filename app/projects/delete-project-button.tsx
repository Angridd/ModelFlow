"use client";

import { deleteProject } from "@/app/actions";

export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const deleteProjectById = deleteProject.bind(null, projectId);

  return (
    <form
      action={deleteProjectById}
      onSubmit={(event) => {
        if (!window.confirm(`Supprimer le projet "${projectName}" et ses scenarios ?`)) {
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

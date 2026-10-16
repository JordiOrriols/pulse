import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@jordiorriols/ui";
import type { ActionApi, ActionOrigin } from "@/data/actions";
import type { ImprovementAction, Person } from "@/lib/actions";
import { ActionDialog } from "./ActionDialog";
import type { ChangeAction } from "./ActionCard";

type Editing =
  | { kind: "create"; origin: ActionOrigin; topic: string | null }
  | { kind: "edit"; action: ImprovementAction };

/** The create, edit and delete dialogs of improvement actions, shared by every place that lists them. */
export function useActionEditor({
  api,
  workspaceId,
  people,
  reload,
  onChange,
}: {
  api: ActionApi | null;
  workspaceId: string | null;
  people: Person[];
  reload: () => Promise<unknown>;
  onChange: ChangeAction;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<ImprovementAction | null>(null);

  const dialogs =
    api && workspaceId ? (
      <>
        <ActionDialog
          isOpen={editing !== null}
          action={editing?.kind === "edit" ? editing.action : null}
          topic={editing?.kind === "create" ? editing.topic : null}
          people={people}
          onClose={() => setEditing(null)}
          onSubmit={async (draft) => {
            if (!editing) return;
            if (editing.kind === "edit") await api.updateAction(editing.action.id, draft);
            else await api.createAction(workspaceId, editing.origin, draft);
            await reload();
          }}
        />
        <ConfirmDialog
          isOpen={deleting !== null}
          title={t("actions.delete.title")}
          description={t("actions.delete.description", { title: deleting?.title ?? "" })}
          confirmLabel={t("actions.delete.confirm")}
          cancelLabel={t("actions.delete.cancel")}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            const target = deleting;
            setDeleting(null);
            if (target) void onChange(() => api.deleteAction(target.id));
          }}
        />
      </>
    ) : null;

  return {
    create: (origin: ActionOrigin, topic: string | null = null) =>
      setEditing({ kind: "create", origin, topic }),
    edit: (action: ImprovementAction) => setEditing({ kind: "edit", action }),
    remove: (action: ImprovementAction) => setDeleting(action),
    dialogs,
  };
}

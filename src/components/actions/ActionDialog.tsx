import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Checkbox, Input, Label, Modal, SelectField } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import type { ActionDraft } from "@/data/actions";
import { PRIORITIES, type ImprovementAction, type Person, type Priority } from "@/lib/actions";
import { FIELD_CLASS } from "@/components/retros/styles";

const blank = (): ActionDraft => ({
  title: "",
  description: "",
  ownerId: "",
  collaboratorIds: [],
  dueOn: "",
  priority: "medium",
  successCriteria: "",
});

const draftOf = (action: ImprovementAction): ActionDraft => ({
  title: action.title,
  description: action.description ?? "",
  ownerId: action.ownerId ?? "",
  collaboratorIds: action.collaborators.map((person) => person.id),
  dueOn: action.dueOn ?? "",
  priority: action.priority,
  successCriteria: action.successCriteria ?? "",
});

/** Creates an action, or edits `action` when given. */
export function ActionDialog({
  isOpen,
  action,
  people,
  topic,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  action: ImprovementAction | null;
  people: Person[];
  /** Name of the retrospective group the new action answers, if any. */
  topic: string | null;
  onClose: () => void;
  onSubmit: (draft: ActionDraft) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ActionDraft>(blank);
  const { busy, error, reset, run } = useAsyncAction();

  useEffect(() => {
    if (!isOpen) return;
    setDraft(action ? draftOf(action) : blank());
    reset();
  }, [isOpen, action, reset]);

  const set = <K extends keyof ActionDraft>(key: K, value: ActionDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const toggleCollaborator = (id: string) =>
    set(
      "collaboratorIds",
      draft.collaboratorIds.includes(id)
        ? draft.collaboratorIds.filter((other) => other !== id)
        : [...draft.collaboratorIds, id]
    );

  const valid = draft.title.trim().length > 0 && draft.ownerId !== "";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const result = await run(() =>
      onSubmit({
        ...draft,
        title: draft.title.trim(),
        description: draft.description.trim(),
        successCriteria: draft.successCriteria.trim(),
        collaboratorIds: draft.collaboratorIds.filter((id) => id !== draft.ownerId),
      })
    );
    if (result.ok) onClose();
  };

  const others = people.filter((person) => person.id !== draft.ownerId);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={t(action ? "actions.form.edit" : "actions.form.create")}
      description={topic ? t("actions.form.from", { topic }) : t("actions.form.description")}
      closeLabel={t("actions.form.cancel")}
      footer={
        <Button type="submit" form="pulse-action-form" disabled={!valid || busy}>
          {t(action ? "actions.form.save" : "actions.form.submit")}
        </Button>
      }
    >
      <form
        id="pulse-action-form"
        onSubmit={submit}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="pulse-action-title">{t("actions.form.title")}</Label>
          <Input
            id="pulse-action-title"
            value={draft.title}
            maxLength={200}
            placeholder={t("actions.form.titlePlaceholder")}
            onChange={(event) => set("title", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pulse-action-description">{t("actions.form.details")}</Label>
          <textarea
            id="pulse-action-description"
            rows={2}
            maxLength={2000}
            value={draft.description}
            onChange={(event) => set("description", event.target.value)}
            className={FIELD_CLASS}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="pulse-action-owner">{t("actions.form.owner")}</Label>
            <SelectField
              id="pulse-action-owner"
              value={draft.ownerId}
              onValueChange={(value) => set("ownerId", value)}
              options={[
                { value: "", label: t("actions.form.chooseOwner"), disabled: true },
                ...people.map((person) => ({ value: person.id, label: person.email })),
              ]}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pulse-action-due">{t("actions.form.due")}</Label>
            <Input
              id="pulse-action-due"
              type="date"
              value={draft.dueOn}
              onChange={(event) => set("dueOn", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pulse-action-priority">{t("actions.form.priority")}</Label>
            <SelectField
              id="pulse-action-priority"
              value={draft.priority}
              onValueChange={(value) => set("priority", value as Priority)}
              options={PRIORITIES.map((priority) => ({
                value: priority,
                label: t(`actions.priorities.${priority}`),
              }))}
            />
          </div>
        </div>
        {others.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("actions.form.collaborators")}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {others.map((person) => (
                <label key={person.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.collaboratorIds.includes(person.id)}
                    onCheckedChange={() => toggleCollaborator(person.id)}
                  />
                  {person.email}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div className="space-y-2">
          <Label htmlFor="pulse-action-criteria">{t("actions.form.criteria")}</Label>
          <Input
            id="pulse-action-criteria"
            value={draft.successCriteria}
            maxLength={1000}
            placeholder={t("actions.form.criteriaPlaceholder")}
            onChange={(event) => set("successCriteria", event.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

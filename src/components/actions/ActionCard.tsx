import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, FormField, Input, Textarea, cn, SelectField } from "@jordiorriols/ui";
import { CalendarDays, History, Pencil, Trash2, UserRound } from "@jordiorriols/ui/icons";
import { useData } from "@/data/DataProvider";
import { useActionHistory } from "@/hooks/useActions";
import { useDateFormat } from "@/hooks/useDateFormat";
import {
  ACTION_STATUSES,
  isOverdue,
  type ActionStatus,
  type ActionUpdate,
  type ImprovementAction,
} from "@/lib/actions";

/** Runs a mutation and refreshes the actions; resolves to whether it worked. */
export type ChangeAction = (operation: () => Promise<unknown>) => Promise<boolean>;

export const STATUS_TONES: Record<ActionStatus, string> = {
  open: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  in_progress: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  done: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUS_EDGES: Record<ActionStatus, string> = {
  open: "border-l-sky-500",
  in_progress: "border-l-amber-500",
  done: "border-l-emerald-500",
  cancelled: "border-l-muted-foreground/40",
};

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  const { t } = useTranslation();
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_TONES[status])}>
      {t(`actions.statuses.${status}`)}
    </span>
  );
}

function OutcomeForm({
  action,
  busy,
  onSave,
  onCancel,
}: {
  action: ImprovementAction;
  busy: boolean;
  onSave: (outcome: string, helped: boolean | null, followUp: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [outcome, setOutcome] = useState(action.outcome ?? "");
  const [helped, setHelped] = useState<boolean | null>(action.helped);
  const [followUp, setFollowUp] = useState(action.followUp ?? "");
  const id = `pulse-outcome-${action.id}`;
  const choices = [
    ["yes", true],
    ["no", false],
    ["unsure", null],
  ] as const;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await onSave(outcome.trim(), helped, followUp.trim())) onCancel();
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md bg-muted/50 p-3">
      <p className="text-sm font-medium">{t("actions.outcome.title")}</p>
      <FormField id={`${id}-text`} label={t("actions.outcome.outcome")} className="space-y-1">
        {(field) => (
          <Textarea
            {...field}
            rows={2}
            maxLength={2000}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            className="min-h-16"
          />
        )}
      </FormField>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">{t("actions.outcome.helped")}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {choices.map(([key, value]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${id}-helped`}
                className="accent-primary"
                checked={helped === value}
                onChange={() => setHelped(value)}
              />
              {t(`actions.outcome.${key}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <FormField id={`${id}-follow`} label={t("actions.outcome.followUp")} className="space-y-1">
        {(field) => (
          <Input
            {...field}
            value={followUp}
            maxLength={2000}
            onChange={(event) => setFollowUp(event.target.value)}
          />
        )}
      </FormField>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("actions.outcome.cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {t("actions.outcome.save")}
        </Button>
      </div>
    </form>
  );
}

function UpdateLine({ update }: { update: ActionUpdate }) {
  const { t, i18n } = useTranslation();
  const author = update.authorEmail ?? t("actions.history.someone");
  const when = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(update.createdAt));
  const status = update.status ? t(`actions.statuses.${update.status}`) : "";
  return (
    <li className="relative pl-4 before:absolute before:top-2 before:left-0 before:size-1.5 before:rounded-full before:bg-muted-foreground/50">
      <p className="text-sm">
        {t(`actions.history.${update.kind}`, { author, status })}
        <span className="ml-2 text-xs text-muted-foreground">{when}</span>
      </p>
      {update.note && (
        <p className="text-sm break-words whitespace-pre-line text-muted-foreground">
          {update.note}
        </p>
      )}
    </li>
  );
}

function HistoryPanel({
  action,
  busy,
  onChange,
}: {
  action: ImprovementAction;
  busy: boolean;
  onChange: ChangeAction;
}) {
  const { t } = useTranslation();
  const { actionApi } = useData();
  const history = useActionHistory(actionApi, action.id, action);
  const [note, setNote] = useState("");
  const id = `pulse-note-${action.id}`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = note.trim();
    if (!text || !actionApi) return;
    if (await onChange(() => actionApi.addNote(action.id, text))) {
      setNote("");
      void history.reload();
    }
  };

  return (
    <div
      className="space-y-3 border-t border-border pt-3"
      role="region"
      aria-label={t("actions.history.label", { title: action.title })}
    >
      {history.error && (
        <p role="alert" className="text-sm text-destructive">
          {history.error}
        </p>
      )}
      {history.updates === null ? (
        !history.error && (
          <p className="text-sm text-muted-foreground">{t("actions.history.loading")}</p>
        )
      ) : (
        <ol className="space-y-1.5">
          {history.updates.map((update) => (
            <UpdateLine key={update.id} update={update} />
          ))}
        </ol>
      )}
      {action.canUpdate && (
        <form onSubmit={submit} className="flex gap-2">
          <label htmlFor={id} className="sr-only">
            {t("actions.history.noteLabel", { title: action.title })}
          </label>
          <Input
            id={id}
            value={note}
            maxLength={1000}
            placeholder={t("actions.history.notePlaceholder")}
            onChange={(event) => setNote(event.target.value)}
          />
          <Button type="submit" variant="outline" size="sm" disabled={busy || !note.trim()}>
            {t("actions.history.addNote")}
          </Button>
        </form>
      )}
    </div>
  );
}

export function ActionCard({
  action,
  today,
  busy,
  showOrigin = true,
  onChange,
  onEdit,
  onDelete,
}: {
  action: ImprovementAction;
  today: string;
  busy: boolean;
  /** Whether to name the retrospective the action came from. */
  showOrigin?: boolean;
  onChange: ChangeAction;
  onEdit: (action: ImprovementAction) => void;
  onDelete: (action: ImprovementAction) => void;
}) {
  const { t } = useTranslation();
  const formatDate = useDateFormat();
  const { actionApi } = useData();
  const [showHistory, setShowHistory] = useState(false);
  const [recording, setRecording] = useState(false);
  const overdue = isOverdue(action, today);
  const closed = action.status === "done" || action.status === "cancelled";

  const setStatus = (status: ActionStatus) => {
    if (!actionApi || status === action.status) return;
    void onChange(() => actionApi.setStatus(action.id, status, ""));
  };

  return (
    <article
      aria-label={action.title}
      className={cn(
        "space-y-2.5 rounded-lg border border-l-4 border-border bg-card p-3.5",
        STATUS_EDGES[action.status],
        closed && "bg-card/60"
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <h4
            className={cn(
              "font-medium break-words",
              action.status === "cancelled" && "text-muted-foreground line-through"
            )}
          >
            {action.title}
          </h4>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <UserRound className="size-3.5" aria-hidden />
              {action.ownerEmail ?? t("actions.card.noOwner")}
            </span>
            <span
              className={cn(
                "flex items-center gap-1",
                overdue && "font-semibold text-rose-600 dark:text-rose-400"
              )}
            >
              <CalendarDays className="size-3.5" aria-hidden />
              {action.dueOn
                ? t("actions.card.due", { date: formatDate(action.dueOn) })
                : t("actions.card.noDue")}
              {overdue && ` · ${t("actions.card.overdue")}`}
            </span>
            {action.priority !== "medium" && (
              <span className={cn(action.priority === "high" && "text-foreground font-medium")}>
                {t("actions.card.priority", {
                  priority: t(`actions.priorities.${action.priority}`),
                })}
              </span>
            )}
            {showOrigin && action.retroTitle && (
              <span>{t("actions.card.from", { retro: action.retroTitle })}</span>
            )}
          </p>
          {action.collaborators.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("actions.card.with", {
                people: action.collaborators.map((person) => person.email).join(", "),
              })}
            </p>
          )}
        </div>
        {action.canUpdate ? (
          <SelectField
            aria-label={t("actions.card.status", { title: action.title })}
            value={action.status}
            disabled={busy}
            onValueChange={(value) => setStatus(value as ActionStatus)}
            className={cn(
              "w-auto border-transparent py-1 text-xs font-medium",
              STATUS_TONES[action.status]
            )}
            options={ACTION_STATUSES.map((status) => ({
              value: status,
              label: t(`actions.statuses.${status}`),
            }))}
          />
        ) : (
          <ActionStatusBadge status={action.status} />
        )}
      </header>

      {action.description && (
        <p className="text-sm break-words whitespace-pre-line">{action.description}</p>
      )}
      {action.successCriteria && (
        <p className="text-sm">
          <span className="text-muted-foreground">{t("actions.card.criteria")}: </span>
          {action.successCriteria}
        </p>
      )}
      {(action.outcome || action.helped !== null || action.followUp) && !recording && (
        <div className="space-y-1 rounded-md bg-muted/50 px-3 py-2 text-sm">
          {action.helped !== null && (
            <span
              className={cn(
                "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                action.helped
                  ? STATUS_TONES.done
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
              )}
            >
              {t(action.helped ? "actions.outcome.helpedBadge" : "actions.outcome.notHelpedBadge")}
            </span>
          )}
          {action.outcome && <p className="break-words whitespace-pre-line">{action.outcome}</p>}
          {action.followUp && (
            <p>
              <span className="text-muted-foreground">{t("actions.outcome.followUp")}: </span>
              {action.followUp}
            </p>
          )}
        </div>
      )}
      {recording && actionApi && (
        <OutcomeForm
          action={action}
          busy={busy}
          onCancel={() => setRecording(false)}
          onSave={(outcome, helped, followUp) =>
            onChange(() => actionApi.recordOutcome(action.id, { outcome, helped, followUp }))
          }
        />
      )}

      <footer className="flex flex-wrap items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={showHistory}
          onClick={() => setShowHistory((open) => !open)}
        >
          <History className="size-3.5" />
          {t(showHistory ? "actions.card.hideHistory" : "actions.card.history")}
        </Button>
        {action.canUpdate && action.status === "done" && !recording && (
          <Button variant="ghost" size="sm" onClick={() => setRecording(true)}>
            {t(action.outcome ? "actions.card.editOutcome" : "actions.card.outcome")}
          </Button>
        )}
        {action.canManage && (
          <span className="ml-auto flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              aria-label={t("actions.card.edit", { title: action.title })}
              onClick={() => onEdit(action)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              aria-label={t("actions.card.delete", { title: action.title })}
              onClick={() => onDelete(action)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </span>
        )}
      </footer>
      {showHistory && <HistoryPanel action={action} busy={busy} onChange={onChange} />}
    </article>
  );
}

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Label, cn } from "@jordiorriols/ui";
import { NotebookPen } from "@jordiorriols/ui/icons";
import {
  DECISIONS,
  rankGroups,
  type Decision,
  type Discussion,
  type RankedGroup,
  type RetroBoard,
} from "@/lib/retros";
import { useGroupName } from "./GroupBoard";
import { FIELD_CLASS } from "./styles";

const NOTE_FIELDS = ["summary", "impact", "rootCauses", "context"] as const;
type NoteField = (typeof NOTE_FIELDS)[number];

export const DECISION_TONES: Record<Decision, string> = {
  action: "bg-primary/10 text-primary",
  monitor: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  accept: "bg-muted text-muted-foreground",
};

export function DecisionBadge({ decision }: { decision: Decision }) {
  const { t } = useTranslation();
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", DECISION_TONES[decision])}>
      {t(`retros.discuss.decisions.${decision}`)}
    </span>
  );
}

export function DiscussionNotes({ group }: { group: Discussion }) {
  const { t } = useTranslation();
  const filled = NOTE_FIELDS.filter((field) => group[field]);
  if (filled.length === 0) return null;
  return (
    <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
      {filled.map((field) => (
        <React.Fragment key={field}>
          <dt className="text-muted-foreground">{t(`retros.discuss.fields.${field}`)}</dt>
          <dd className="break-words whitespace-pre-line">{group[field]}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function NotesForm({
  group,
  name,
  busy,
  onSave,
  onCancel,
}: {
  group: Discussion & { id: string };
  name: string;
  busy: boolean;
  onSave: (discussion: Discussion) => Promise<boolean>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<Record<NoteField, string>>(() => ({
    summary: group.summary ?? "",
    impact: group.impact ?? "",
    rootCauses: group.rootCauses ?? "",
    context: group.context ?? "",
  }));
  const [decision, setDecision] = useState<Decision | null>(group.decision);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const saved = await onSave({
      summary: notes.summary.trim() || null,
      impact: notes.impact.trim() || null,
      rootCauses: notes.rootCauses.trim() || null,
      context: notes.context.trim() || null,
      decision,
    });
    if (saved) onCancel();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {NOTE_FIELDS.map((field) => {
          const id = `pulse-notes-${group.id}-${field}`;
          return (
            <div key={field} className="space-y-1">
              <Label htmlFor={id} className="text-xs">
                {t(`retros.discuss.fields.${field}`)}
              </Label>
              <textarea
                id={id}
                className={cn(FIELD_CLASS, "min-h-16")}
                value={notes[field]}
                maxLength={2000}
                onChange={(event) =>
                  setNotes((current) => ({ ...current, [field]: event.target.value }))
                }
              />
            </div>
          );
        })}
      </div>
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">{t("retros.discuss.decision", { name })}</legend>
        <span aria-hidden className="text-xs text-muted-foreground">
          {t("retros.discuss.decisionLabel")}
        </span>
        {DECISIONS.map((item) => (
          <label
            key={item}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors",
              decision === item
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-muted"
            )}
          >
            <input
              type="radio"
              className="sr-only"
              name={`pulse-decision-${group.id}`}
              checked={decision === item}
              onChange={() => setDecision(item)}
            />
            {t(`retros.discuss.decisions.${item}`)}
          </label>
        ))}
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t("retros.discuss.cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {t("retros.discuss.save")}
        </Button>
      </div>
    </form>
  );
}

export function RankedGroupHeader({
  item,
  rank,
  name,
}: {
  item: RankedGroup;
  rank: number;
  name: string;
}) {
  const { t } = useTranslation();
  return (
    <header className="flex items-start gap-3">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums"
      >
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold break-words">{name}</h3>
        {(item.group.title || item.topics.length > 1) && (
          <p className="text-xs break-words text-muted-foreground">
            {item.topics.map((topic) => topic.title).join(" · ")}
          </p>
        )}
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {t("retros.discuss.votes", { count: item.group.votes ?? 0 })}
      </span>
    </header>
  );
}

export function DiscussBoard({
  board,
  busy,
  onSave,
}: {
  board: RetroBoard;
  busy: boolean;
  onSave: (group: string, discussion: Discussion) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const nameOf = useGroupName();
  const [editing, setEditing] = useState<string | null>(null);
  const indexes = new Map(board.groups.map((group, index) => [group.id, index]));

  return (
    <ol className="space-y-3">
      {rankGroups(board).map((item, rank) => {
        const name = nameOf(item.group, item.topics, indexes.get(item.group.id) ?? 0);
        return (
          <li
            key={item.group.id}
            aria-label={name}
            className="space-y-3 rounded-lg border border-border bg-card p-4"
          >
            <RankedGroupHeader item={item} rank={rank + 1} name={name} />
            {editing === item.group.id ? (
              <NotesForm
                group={item.group}
                name={name}
                busy={busy}
                onCancel={() => setEditing(null)}
                onSave={(discussion) => onSave(item.group.id, discussion)}
              />
            ) : (
              <div className="space-y-2 pl-10">
                <DiscussionNotes group={item.group} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {item.group.decision ? (
                    <DecisionBadge decision={item.group.decision} />
                  ) : (
                    <span />
                  )}
                  {board.canFacilitate && (
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={t("retros.discuss.takeNotesFor", { name })}
                      onClick={() => setEditing(item.group.id)}
                    >
                      <NotebookPen className="size-4" />
                      {t("retros.discuss.takeNotes")}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

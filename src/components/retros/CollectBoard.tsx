import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Textarea, cn } from "@jordiorriols/ui";
import { EyeOff, Pencil, ShieldCheck, Trash2, UserRound } from "@jordiorriols/ui/icons";
import type { TopicDraft } from "@/data/retros";
import { TEMPLATE_COLUMNS, type Retro, type RetroBoard, type RetroTopic } from "@/lib/retros";
import { toneOf } from "./styles";

function TopicForm({
  column,
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  column: string;
  initial?: RetroTopic;
  busy: boolean;
  submitLabel: string;
  onSubmit: (draft: TopicDraft) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const columnName = t(`retros.columns.${column}`);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    const saved = await onSubmit({ column, title: title.trim(), description: description.trim() });
    if (saved && !initial) {
      setTitle("");
      setDescription("");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <Input
        value={title}
        maxLength={200}
        aria-label={t("retros.collect.topicTitle", { column: columnName })}
        placeholder={t("retros.collect.topicPlaceholder")}
        onChange={(event) => setTitle(event.target.value)}
      />
      {(title || initial) && (
        <Textarea
          className="min-h-14"
          value={description}
          maxLength={1000}
          aria-label={t("retros.collect.topicDescription", { column: columnName })}
          placeholder={t("retros.collect.descriptionPlaceholder")}
          onChange={(event) => setDescription(event.target.value)}
        />
      )}
      {(title || initial) && (
        <div className="flex justify-end gap-1.5">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {t("retros.collect.cancel")}
            </Button>
          )}
          <Button type="submit" size="sm" disabled={busy || !title.trim()}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}

export function TopicCard({
  topic,
  children,
  className,
  ...rest
}: {
  topic: RetroTopic;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li
      className={cn(
        "rounded-md border border-border bg-background px-3 py-2 text-sm shadow-xs",
        "border-l-[3px] [border-left-color:var(--tone)]",
        toneOf(topic.column),
        className
      )}
      {...rest}
    >
      <p className="font-medium break-words">{topic.title}</p>
      {topic.description && (
        <p className="mt-0.5 text-xs break-words whitespace-pre-line text-muted-foreground">
          {topic.description}
        </p>
      )}
      {topic.author && <p className="mt-1 text-xs text-muted-foreground">{topic.author}</p>}
      {children}
    </li>
  );
}

export function CollectBoard({
  retro,
  board,
  busy,
  onAdd,
  onUpdate,
  onDelete,
}: {
  retro: Retro;
  board: RetroBoard;
  busy: boolean;
  onAdd: (draft: TopicDraft) => Promise<boolean>;
  onUpdate: (topic: string, draft: TopicDraft) => Promise<boolean>;
  onDelete: (topic: string) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<string | null>(null);
  const columns = TEMPLATE_COLUMNS[retro.template];

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <EyeOff className="size-4 shrink-0" aria-hidden />
        {t("retros.collect.hidden", { count: board.hiddenTopics })}
      </p>
      <div
        className={cn(
          "grid gap-3",
          columns.length === 1 ? "max-w-xl" : "md:grid-cols-2 xl:grid-cols-3"
        )}
      >
        {columns.map((column) => {
          const topics = board.topics.filter((topic) => topic.column === column);
          const name = t(`retros.columns.${column}`);
          return (
            <section
              key={column}
              aria-label={name}
              className={cn(
                "rounded-lg border border-t-4 border-border bg-muted/30 p-3",
                toneOf(column)
              )}
            >
              <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">
                {name}
                <span className="text-xs font-normal tabular-nums text-muted-foreground">
                  {topics.length}
                </span>
              </h3>
              <ul className="mb-3 space-y-2">
                {topics.map((topic) =>
                  editing === topic.id ? (
                    <li key={topic.id}>
                      <TopicForm
                        column={column}
                        initial={topic}
                        busy={busy}
                        submitLabel={t("retros.collect.save")}
                        onCancel={() => setEditing(null)}
                        onSubmit={async (draft) => {
                          const saved = await onUpdate(topic.id, draft);
                          if (saved) setEditing(null);
                          return saved;
                        }}
                      />
                    </li>
                  ) : (
                    <TopicCard key={topic.id} topic={topic} className="group relative pr-16">
                      <span className="absolute top-1.5 right-1.5 flex opacity-70 group-hover:opacity-100 focus-within:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label={t("retros.collect.edit", { title: topic.title })}
                          onClick={() => setEditing(topic.id)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={busy}
                          aria-label={t("retros.collect.delete", { title: topic.title })}
                          onClick={() => onDelete(topic.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </span>
                    </TopicCard>
                  )
                )}
              </ul>
              <TopicForm
                column={column}
                busy={busy}
                submitLabel={t("retros.collect.add")}
                onSubmit={onAdd}
              />
            </section>
          );
        })}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {retro.anonymous ? (
          <ShieldCheck className="size-3.5" aria-hidden />
        ) : (
          <UserRound className="size-3.5" aria-hidden />
        )}
        {t(retro.anonymous ? "retros.collect.anonymous" : "retros.collect.named")}
      </p>
    </div>
  );
}

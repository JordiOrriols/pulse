import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, cn } from "@jordiorriols/ui";
import { GripVertical, Layers, Ungroup } from "@jordiorriols/ui/icons";
import {
  groupLabel,
  looseTopics,
  topicsOf,
  type RetroBoard,
  type RetroGroup,
  type RetroTopic,
} from "@/lib/retros";
import { TopicCard } from "./CollectBoard";
import { FIELD_CLASS } from "./styles";

const TOPIC = "application/x-pulse-topic";
const GROUP = "application/x-pulse-group";
const LOOSE = "loose";
const NEW = "new";

export interface GroupHandlers {
  onMove: (topic: string, group: string | null) => void;
  onCreateGroup: (topics: string[], title: string) => void;
  onRename: (group: string, title: string) => void;
  onMerge: (source: string, destination: string) => void;
  onUngroup: (group: string) => void;
}

/** Name to show for a group, falling back to its position when it has no title yet. */
export function useGroupName() {
  const { t } = useTranslation();
  return (group: RetroGroup, topics: RetroTopic[], index: number) =>
    groupLabel(group, topics) ?? t("retros.group.untitled", { number: index + 1 });
}

function useDropZone(onDrop: (data: DataTransfer) => void, accepts: string[]) {
  const [over, setOver] = useState(false);
  const allowed = (event: React.DragEvent) =>
    accepts.some((type) => event.dataTransfer.types.includes(type));
  return {
    over,
    props: {
      onDragOver: (event: React.DragEvent) => {
        if (!allowed(event)) return;
        event.preventDefault();
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (event: React.DragEvent) => {
        setOver(false);
        if (!allowed(event)) return;
        event.preventDefault();
        onDrop(event.dataTransfer);
      },
    },
  };
}

function DraggableTopic({
  topic,
  groups,
  names,
  busy,
  onMove,
  onCreateGroup,
}: {
  topic: RetroTopic;
  groups: RetroGroup[];
  names: Map<string, string>;
  busy: boolean;
} & Pick<GroupHandlers, "onMove" | "onCreateGroup">) {
  const { t } = useTranslation();
  return (
    <TopicCard
      topic={topic}
      draggable={!busy}
      onDragStart={(event) => {
        event.dataTransfer.setData(TOPIC, topic.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      className="cursor-grab active:cursor-grabbing"
    >
      <div className="mt-2 flex items-center gap-1.5">
        <GripVertical className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <select
          className={cn(FIELD_CLASS, "h-7 py-0 text-xs")}
          aria-label={t("retros.group.moveTopic", { title: topic.title })}
          value={topic.groupId ?? LOOSE}
          disabled={busy}
          onChange={(event) => {
            const target = event.target.value;
            if (target === NEW) onCreateGroup([topic.id], "");
            else onMove(topic.id, target === LOOSE ? null : target);
          }}
        >
          <option value={LOOSE}>{t("retros.group.loose")}</option>
          <option value={NEW}>{t("retros.group.newGroup")}</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {names.get(group.id)}
            </option>
          ))}
        </select>
      </div>
    </TopicCard>
  );
}

function GroupCard({
  group,
  name,
  topics,
  groups,
  names,
  busy,
  handlers,
}: {
  group: RetroGroup;
  name: string;
  topics: RetroTopic[];
  groups: RetroGroup[];
  names: Map<string, string>;
  busy: boolean;
  handlers: GroupHandlers;
}) {
  const { t } = useTranslation();
  const drop = useDropZone(
    (data) => {
      const topic = data.getData(TOPIC);
      const source = data.getData(GROUP);
      if (topic) handlers.onMove(topic, group.id);
      else if (source && source !== group.id) handlers.onMerge(source, group.id);
    },
    [TOPIC, GROUP]
  );
  const others = groups.filter((item) => item.id !== group.id);

  return (
    <section
      aria-label={name}
      {...drop.props}
      className={cn(
        "rounded-lg border bg-card p-3 transition-colors",
        drop.over ? "border-primary bg-primary/5" : "border-border"
      )}
    >
      <div
        className="mb-2 flex items-center gap-1.5"
        draggable={!busy}
        onDragStart={(event) => {
          event.dataTransfer.setData(GROUP, group.id);
          event.dataTransfer.effectAllowed = "move";
        }}
      >
        <Layers className="size-4 shrink-0 cursor-grab text-primary" aria-hidden />
        <Input
          key={group.title ?? ""}
          defaultValue={group.title ?? ""}
          maxLength={120}
          placeholder={name}
          aria-label={t("retros.group.name", { name })}
          className="h-8 font-medium"
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value !== (group.title ?? "")) handlers.onRename(group.id, value);
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          disabled={busy}
          aria-label={t("retros.group.ungroup", { name })}
          title={t("retros.group.ungroup", { name })}
          onClick={() => handlers.onUngroup(group.id)}
        >
          <Ungroup className="size-4" />
        </Button>
      </div>
      <ul className="space-y-2">
        {topics.map((topic) => (
          <DraggableTopic
            key={topic.id}
            topic={topic}
            groups={groups}
            names={names}
            busy={busy}
            onMove={handlers.onMove}
            onCreateGroup={handlers.onCreateGroup}
          />
        ))}
      </ul>
      {others.length > 0 && (
        <select
          className={cn(FIELD_CLASS, "mt-2 h-8 py-0 text-xs text-muted-foreground")}
          aria-label={t("retros.group.merge", { name })}
          value=""
          disabled={busy}
          onChange={(event) => event.target.value && handlers.onMerge(group.id, event.target.value)}
        >
          <option value="">{t("retros.group.mergeInto")}</option>
          {others.map((item) => (
            <option key={item.id} value={item.id}>
              {names.get(item.id)}
            </option>
          ))}
        </select>
      )}
    </section>
  );
}

export function GroupBoard({
  board,
  busy,
  ...handlers
}: { board: RetroBoard; busy: boolean } & GroupHandlers) {
  const { t } = useTranslation();
  const nameOf = useGroupName();
  const loose = looseTopics(board);
  const names = new Map(
    board.groups.map((group, index) => [group.id, nameOf(group, topicsOf(board, group.id), index)])
  );
  const looseDrop = useDropZone(
    (data) => {
      const topic = data.getData(TOPIC);
      if (topic) handlers.onMove(topic, null);
    },
    [TOPIC]
  );
  const newDrop = useDropZone(
    (data) => {
      const topic = data.getData(TOPIC);
      if (topic) handlers.onCreateGroup([topic], "");
    },
    [TOPIC]
  );

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("retros.group.hint")}</p>
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <section
          aria-label={t("retros.group.loose")}
          {...looseDrop.props}
          className={cn(
            "self-start rounded-lg border border-dashed p-3 transition-colors",
            looseDrop.over ? "border-primary bg-primary/5" : "border-border bg-muted/30"
          )}
        >
          <h3 className="mb-2 flex justify-between text-sm font-semibold">
            {t("retros.group.loose")}
            <span className="text-xs font-normal tabular-nums text-muted-foreground">
              {loose.length}
            </span>
          </h3>
          {loose.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("retros.group.allGrouped")}</p>
          ) : (
            <ul className="space-y-2">
              {loose.map((topic) => (
                <DraggableTopic
                  key={topic.id}
                  topic={topic}
                  groups={board.groups}
                  names={names}
                  busy={busy}
                  onMove={handlers.onMove}
                  onCreateGroup={handlers.onCreateGroup}
                />
              ))}
            </ul>
          )}
        </section>
        <div className="grid content-start gap-3 md:grid-cols-2">
          {board.groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              name={names.get(group.id)!}
              topics={topicsOf(board, group.id)}
              groups={board.groups}
              names={names}
              busy={busy}
              handlers={handlers}
            />
          ))}
          <div
            {...newDrop.props}
            className={cn(
              "flex min-h-24 items-center justify-center rounded-lg border-2 border-dashed px-4 text-center text-sm transition-colors",
              newDrop.over
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground"
            )}
          >
            {t("retros.group.dropNew")}
          </div>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { useTranslation } from "react-i18next";
import { Button, cn } from "@jordiorriols/ui";
import { Minus, Plus } from "@jordiorriols/ui/icons";
import { topicsOf, votesLeft, type Retro, type RetroBoard } from "@/lib/retros";
import { useGroupName } from "./GroupBoard";

export function VoteBoard({
  retro,
  board,
  busy,
  onVote,
}: {
  retro: Retro;
  board: RetroBoard;
  busy: boolean;
  onVote: (group: string, votes: number) => void;
}) {
  const { t } = useTranslation();
  const nameOf = useGroupName();
  const left = votesLeft(board, retro.votesPerPerson);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("retros.vote.hint")}</p>
        <p
          className="flex items-center gap-2 text-sm font-medium"
          aria-live="polite"
          aria-label={t("retros.vote.left", { count: left, total: retro.votesPerPerson })}
        >
          <span aria-hidden className="flex gap-1">
            {Array.from({ length: retro.votesPerPerson }, (_, index) => (
              <span
                key={index}
                className={cn(
                  "size-2.5 rounded-full transition-colors",
                  index < left ? "bg-primary" : "bg-border"
                )}
              />
            ))}
          </span>
          {t("retros.vote.left", { count: left, total: retro.votesPerPerson })}
        </p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {board.groups.map((group, index) => {
          const topics = topicsOf(board, group.id);
          const name = nameOf(group, topics, index);
          return (
            <li
              key={group.id}
              className={cn(
                "flex flex-col rounded-lg border bg-card p-3 transition-colors",
                group.myVotes > 0 ? "border-primary/50" : "border-border"
              )}
            >
              <h3 className="text-sm font-semibold break-words">{name}</h3>
              {(group.title || topics.length > 1) && (
                <ul className="mt-1.5 flex-1 space-y-0.5 text-xs text-muted-foreground">
                  {topics.map((topic) => (
                    <li key={topic.id} className="break-words">
                      {topic.title}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex items-center justify-end gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={busy || group.myVotes === 0}
                  aria-label={t("retros.vote.remove", { name })}
                  onClick={() => onVote(group.id, group.myVotes - 1)}
                >
                  <Minus className="size-4" />
                </Button>
                <span
                  className="w-8 text-center text-lg font-semibold tabular-nums"
                  aria-label={t("retros.vote.mine", { count: group.myVotes, name })}
                >
                  {group.myVotes}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  disabled={busy || left === 0}
                  aria-label={t("retros.vote.add", { name })}
                  onClick={() => onVote(group.id, group.myVotes + 1)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

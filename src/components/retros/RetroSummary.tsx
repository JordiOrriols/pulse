import React from "react";
import { useTranslation } from "react-i18next";
import { summarizeRetro, type RetroBoard } from "@/lib/retros";
import { DecisionBadge, DiscussionNotes, RankedGroupHeader } from "./DiscussBoard";
import { useGroupName } from "./GroupBoard";

export function RetroSummary({ board }: { board: RetroBoard }) {
  const { t } = useTranslation();
  const nameOf = useGroupName();
  const summary = summarizeRetro(board);
  const indexes = new Map(board.groups.map((group, index) => [group.id, index]));
  const name = (item: (typeof summary.top)[number]) =>
    nameOf(item.group, item.topics, indexes.get(item.group.id) ?? 0);
  const stats = [
    ["topics", summary.topics],
    ["groups", board.groups.length],
    ["voters", summary.voters],
  ] as const;

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-3 gap-3">
        {stats.map(([key, value]) => (
          <div key={key} className="rounded-lg bg-muted/60 px-4 py-3">
            <dt className="text-xs text-muted-foreground">{t(`retros.summary.${key}`)}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-2" aria-labelledby="pulse-retro-top">
        <h3 id="pulse-retro-top" className="text-sm font-semibold">
          {t("retros.summary.top")}
        </h3>
        {summary.top.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("retros.summary.noVotes")}</p>
        ) : (
          <ol className="space-y-2">
            {summary.top.map((item, index) => (
              <li key={item.group.id} className="rounded-lg border border-border p-3">
                <RankedGroupHeader item={item} rank={index + 1} name={name(item)} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="pulse-retro-discussed">
        <h3 id="pulse-retro-discussed" className="text-sm font-semibold">
          {t("retros.summary.discussed")}
        </h3>
        {summary.discussed.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("retros.summary.noNotes")}</p>
        ) : (
          <ul className="space-y-2">
            {summary.discussed.map((item) => (
              <li key={item.group.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium break-words">{name(item)}</p>
                  {item.group.decision && <DecisionBadge decision={item.group.decision} />}
                </div>
                <DiscussionNotes group={item.group} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

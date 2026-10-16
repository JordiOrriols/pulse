import React from "react";
import { useTranslation } from "react-i18next";
import { Button, cn } from "@jordiorriols/ui";
import { Plus } from "@jordiorriols/ui/icons";
import type { ActionReview, ImprovementAction } from "@/lib/actions";
import { rankGroups, type Retro, type RetroBoard } from "@/lib/retros";
import { DecisionBadge, RankedGroupHeader } from "@/components/retros/DiscussBoard";
import { useGroupName } from "@/components/retros/GroupBoard";
import { ActionCard, type ChangeAction } from "./ActionCard";
import type { useActionEditor } from "./useActionEditor";

interface ListProps {
  today: string;
  busy: boolean;
  onChange: ChangeAction;
  editor: ReturnType<typeof useActionEditor>;
}

function ActionList({
  actions,
  showOrigin = true,
  ...props
}: ListProps & { actions: ImprovementAction[]; showOrigin?: boolean }) {
  return (
    <ul className="space-y-2">
      {actions.map((action) => (
        <li key={action.id}>
          <ActionCard
            action={action}
            today={props.today}
            busy={props.busy}
            showOrigin={showOrigin}
            onChange={props.onChange}
            onEdit={props.editor.edit}
            onDelete={props.editor.remove}
          />
        </li>
      ))}
    </ul>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2" aria-labelledby={id}>
      <h3 id={id} className="text-sm font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Earlier actions a retrospective checks before collecting topics. */
export function ActionReviewPanel({ review, ...props }: ListProps & { review: ActionReview }) {
  const { t } = useTranslation();
  const empty = review.outstanding.length === 0 && review.completed.length === 0;
  return (
    <div className="space-y-4 border-t border-border pt-5">
      <div className="space-y-1">
        <h3 className="font-semibold">{t("actions.review.title")}</h3>
        <p className="max-w-prose text-sm text-muted-foreground">
          {t(empty ? "actions.review.none" : "actions.review.hint")}
        </p>
      </div>
      {review.outstanding.length > 0 && (
        <Section id="pulse-review-outstanding" title={t("actions.review.outstanding")}>
          <ActionList actions={review.outstanding} {...props} />
        </Section>
      )}
      {review.completed.length > 0 && (
        <Section id="pulse-review-completed" title={t("actions.review.completed")}>
          <ActionList actions={review.completed} {...props} />
        </Section>
      )}
    </div>
  );
}

/** The actions stage: the facilitator turns the chosen groups into owned actions. */
export function ActionsStage({
  retro,
  board,
  agreed,
  ...props
}: ListProps & { retro: Retro; board: RetroBoard; agreed: ImprovementAction[] }) {
  const { t } = useTranslation();
  const nameOf = useGroupName();
  const indexes = new Map(board.groups.map((group, index) => [group.id, index]));
  const ranked = rankGroups(board).map((item, index) => ({
    item,
    rank: index + 1,
    name: nameOf(item.group, item.topics, indexes.get(item.group.id) ?? 0),
    actions: agreed.filter((action) => action.groupId === item.group.id),
  }));
  const chosen = (entry: (typeof ranked)[number]) =>
    entry.item.group.decision === "action" || entry.actions.length > 0;
  const ordered = [...ranked.filter(chosen), ...ranked.filter((entry) => !chosen(entry))];
  const grouped = new Set(ranked.map((entry) => entry.item.group.id));
  const loose = agreed.filter((action) => !action.groupId || !grouped.has(action.groupId));

  return (
    <div className="space-y-4">
      {board.canFacilitate && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={props.busy}
            onClick={() => props.editor.create({ retroId: retro.id, groupId: null })}
          >
            <Plus className="size-4" />
            {t("actions.retro.add")}
          </Button>
        </div>
      )}
      {loose.length > 0 && <ActionList actions={loose} showOrigin={false} {...props} />}
      <ol className="space-y-3">
        {ordered.map((entry) => (
          <li
            key={entry.item.group.id}
            className={cn(
              "space-y-3 rounded-lg border p-3",
              chosen(entry) ? "border-primary/40 bg-primary/[0.03]" : "border-border"
            )}
          >
            <RankedGroupHeader item={entry.item} rank={entry.rank} name={entry.name} />
            {entry.item.group.decision && (
              <div className="pl-10">
                <DecisionBadge decision={entry.item.group.decision} />
              </div>
            )}
            {entry.actions.length > 0 && (
              <div className="pl-10">
                <ActionList actions={entry.actions} showOrigin={false} {...props} />
              </div>
            )}
            {board.canFacilitate && (
              <div className="pl-10">
                <Button
                  variant={entry.item.group.decision === "action" ? "secondary" : "ghost"}
                  size="sm"
                  disabled={props.busy}
                  aria-label={t("actions.retro.addFor", { name: entry.name })}
                  onClick={() =>
                    props.editor.create(
                      { retroId: retro.id, groupId: entry.item.group.id },
                      entry.name
                    )
                  }
                >
                  <Plus className="size-4" />
                  {t("actions.retro.add")}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {ordered.length === 0 && loose.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("actions.retro.none")}</p>
      )}
    </div>
  );
}

/** Actions agreed in a closed retrospective, and the earlier ones it carried over. */
export function RetroActionsSummary({ review, ...props }: ListProps & { review: ActionReview }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <Section id="pulse-retro-agreed" title={t("actions.retro.agreed")}>
        {review.agreed.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("actions.retro.noneAgreed")}</p>
        ) : (
          <ActionList actions={review.agreed} showOrigin={false} {...props} />
        )}
      </Section>
      {review.outstanding.length > 0 && (
        <Section id="pulse-retro-carried" title={t("actions.retro.carried")}>
          <ActionList actions={review.outstanding} {...props} />
        </Section>
      )}
    </div>
  );
}

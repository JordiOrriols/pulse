import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Spinner,
  StatusBadge,
  cn,
} from "@jordiorriols/ui";
import { Maximize2, MessagesSquare, Plus, Share2 } from "@jordiorriols/ui/icons";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { useData } from "@/data/DataProvider";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useActions } from "@/hooks/useActions";
import { useDateFormat } from "@/hooks/useDateFormat";
import { usePolling, useRetroBoard, useRetros } from "@/hooks/useRetros";
import { localDate, reviewActions } from "@/lib/actions";
import { retroRoomPath, TEMPLATE_COLUMNS, type Retro, type RetroBoard } from "@/lib/retros";
import {
  ActionReviewPanel,
  ActionsStage,
  RetroActionsSummary,
} from "@/components/actions/RetroActions";
import { useActionEditor } from "@/components/actions/useActionEditor";
import { CollectBoard } from "@/components/retros/CollectBoard";
import { DiscussBoard } from "@/components/retros/DiscussBoard";
import { GroupBoard } from "@/components/retros/GroupBoard";
import { NewRetroDialog } from "@/components/retros/NewRetroDialog";
import { RetroSummary } from "@/components/retros/RetroSummary";
import { StageStepper } from "@/components/retros/StageStepper";
import { VoteBoard } from "@/components/retros/VoteBoard";

function RetroListItem({
  retro,
  selected,
  onSelect,
}: {
  retro: Retro;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const formatDate = useDateFormat();
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
          selected
            ? "border-primary/50 bg-primary/5"
            : "border-transparent hover:border-border hover:bg-card"
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{retro.title}</span>
          {retro.stage !== "closed" && (
            <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          )}
        </span>
        <span className="mt-0.5 flex justify-between gap-2 text-xs text-muted-foreground">
          <span>{formatDate(retro.heldOn)}</span>
          <span>{t(`retros.stages.${retro.stage}.name`)}</span>
        </span>
      </button>
    </li>
  );
}

function PrepareDetails({ retro }: { retro: Retro }) {
  const { t } = useTranslation();
  const details = [
    [
      "template",
      `${t(`retros.templates.${retro.template}`)} (${TEMPLATE_COLUMNS[retro.template]
        .map((column) => t(`retros.columns.${column}`))
        .join(" · ")})`,
    ],
    ["votes", String(retro.votesPerPerson)],
    ["anonymity", t(retro.anonymous ? "retros.details.anonymous" : "retros.details.named")],
  ] as const;
  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
      {details.map(([key, value]) => (
        <React.Fragment key={key}>
          <dt className="text-muted-foreground">{t(`retros.details.${key}`)}</dt>
          <dd>{value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export default function RetrospectivesPage({
  retroId,
  fullscreen = false,
}: {
  retroId?: string;
  fullscreen?: boolean;
}) {
  const { t } = useTranslation();
  const formatDate = useDateFormat();
  const { retroApi, actionApi } = useData();
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const list = useRetros(retroApi, workspaceId);
  const tracked = useActions(actionApi, workspaceId);
  const canManage = workspace?.access_level === "owner" || workspace?.access_level === "editor";
  const [params] = useSearchParams();
  const [chosenId, setChosenId] = useState<string | null>(() => params.get("retro"));
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Retro | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const action = useAsyncAction();

  const selected = retroId
    ? (list.retros.find((retro) => retro.id === retroId) ?? null)
    : (list.retros.find((retro) => retro.id === chosenId) ??
      list.retros.find((retro) => retro.stage !== "closed") ??
      list.retros[0] ??
      null);
  const room = useRetroBoard(retroApi, selected?.id ?? null);
  const refresh = () => {
    void list.reload();
    void room.reload();
    void tracked.reload();
  };
  usePolling(refresh, !!selected && selected.stage !== "closed" && !action.busy);

  const change = async (operation: () => Promise<unknown>) => {
    const result = await action.run(async () => {
      await operation();
      await Promise.all([list.reload(), room.reload(), tracked.reload()]);
    });
    return result.ok;
  };
  const editor = useActionEditor({
    api: actionApi,
    workspaceId,
    people: tracked.people,
    reload: tracked.reload,
    onChange: change,
  });

  if (!retroApi || !workspaceId) return null;

  const actionProps = { today: localDate(), busy: action.busy, onChange: change, editor };

  const header = (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 id="retrospectives-title" className="text-2xl font-semibold">
          {t("sections.retrospectives.title")}
        </h1>
        <p className="text-muted-foreground">{t("sections.retrospectives.description")}</p>
      </div>
      {canManage && (
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          {t("retros.create.open")}
        </Button>
      )}
    </header>
  );

  const stageContent = (retro: Retro, board: RetroBoard) => {
    const review = reviewActions(tracked.actions, retro, list.retros);
    switch (retro.stage) {
      case "prepare":
        return (
          <>
            <PrepareDetails retro={retro} />
            <ActionReviewPanel review={review} {...actionProps} />
          </>
        );
      case "collect":
        return (
          <CollectBoard
            retro={retro}
            board={board}
            busy={action.busy}
            onAdd={(draft) => change(() => retroApi.addTopic(retro.id, draft))}
            onUpdate={(topic, draft) => change(() => retroApi.updateTopic(topic, draft))}
            onDelete={(topic) => void change(() => retroApi.deleteTopic(topic))}
          />
        );
      case "group":
        return (
          <GroupBoard
            board={board}
            busy={action.busy}
            onMove={(topic, group) => void change(() => retroApi.moveTopic(topic, group))}
            onCreateGroup={(topics, title) =>
              void change(() => retroApi.createGroup(retro.id, topics, title))
            }
            onRename={(group, title) => void change(() => retroApi.renameGroup(group, title))}
            onMerge={(source, destination) =>
              void change(() => retroApi.mergeGroups(source, destination))
            }
            onUngroup={(group) => void change(() => retroApi.ungroup(group))}
          />
        );
      case "vote":
        return (
          <VoteBoard
            retro={retro}
            board={board}
            busy={action.busy}
            onVote={(group, votes) => void change(() => retroApi.setVote(group, votes))}
          />
        );
      case "discuss":
        return (
          <DiscussBoard
            board={board}
            busy={action.busy}
            onSave={(group, discussion) =>
              change(() => retroApi.updateDiscussion(group, discussion))
            }
          />
        );
      case "actions":
        return <ActionsStage retro={retro} board={board} agreed={review.agreed} {...actionProps} />;
      case "closed":
        return (
          <>
            <RetroSummary board={board} />
            <RetroActionsSummary review={review} {...actionProps} />
          </>
        );
    }
  };

  let body;
  if (list.error) {
    body = <ErrorState message={list.error} />;
  } else if (list.loading) {
    body = (
      <div className="flex justify-center py-12">
        <Spinner label={t("retros.loading")} />
      </div>
    );
  } else if (!selected) {
    body = (
      <EmptyState
        icon={<MessagesSquare className="size-8 text-muted-foreground" />}
        title={t(retroId ? "retroRoom.unavailable" : "retros.empty.title")}
        description={t(
          retroId
            ? "retroRoom.notFound"
            : canManage
              ? "retros.empty.manager"
              : "retros.empty.member"
        )}
      />
    );
  } else {
    const board = room.board;
    body = (
      <div className={cn("grid gap-6", !fullscreen && "lg:grid-cols-[16rem_minmax(0,1fr)]")}>
        {!fullscreen && (
          <nav aria-label={t("retros.list.label")}>
            <ul className="space-y-1">
              {list.retros.map((retro) => (
                <RetroListItem
                  key={retro.id}
                  retro={retro}
                  selected={retro.id === selected.id}
                  onSelect={() => setChosenId(retro.id)}
                />
              ))}
            </ul>
          </nav>
        )}

        <article className="panel min-w-0 space-y-5 self-start" aria-labelledby="pulse-retro-title">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <h2 id="pulse-retro-title" className="text-lg font-semibold">
                {selected.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <StatusBadge positive={selected.stage !== "closed"}>
                  {t(`retros.stages.${selected.stage}.name`)}
                </StatusBadge>
                <span>{formatDate(selected.heldOn)}</span>
                {selected.period && <span>· {selected.period}</span>}
              </div>
              {selected.goal && (
                <p className="max-w-prose text-sm">
                  <span className="text-muted-foreground">{t("retros.details.goal")} </span>
                  {selected.goal}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.stage !== "closed" && (
                <>
                  {!fullscreen && (
                    <Button asChild variant="outline">
                      <Link to={retroRoomPath(workspaceId, selected.id)}>
                        <Maximize2 className="size-4" />
                        {t("retroRoom.open")}
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(async () => {
                        const url = `${window.location.href.split("#")[0]}#${retroRoomPath(workspaceId, selected.id)}`;
                        await navigator.clipboard.writeText(url);
                        setCopiedId(selected.id);
                      })
                    }
                  >
                    <Share2 className="size-4" />
                    {t(copiedId === selected.id ? "retroRoom.copied" : "retroRoom.share")}
                  </Button>
                </>
              )}
              {canManage && !fullscreen && (
                <Button
                  variant="ghost"
                  disabled={action.busy}
                  onClick={() => setDeleting(selected)}
                >
                  {t("retros.actions.delete")}
                </Button>
              )}
            </div>
          </header>
          {board && (
            <StageStepper
              stage={selected.stage}
              canFacilitate={board.canFacilitate}
              busy={action.busy}
              onMove={(stage) => void change(() => retroApi.setStage(selected.id, stage))}
            />
          )}
          {action.error && <ErrorState message={action.error} />}
          {room.error && !board ? (
            <ErrorState message={room.error} />
          ) : board ? (
            stageContent(selected, board)
          ) : (
            <div className="flex justify-center py-8">
              <Spinner label={t("retros.loadingBoard")} />
            </div>
          )}
        </article>
      </div>
    );
  }

  return (
    <section className="space-y-6" aria-label={t("sections.retrospectives.title")}>
      {!fullscreen && header}
      {body}
      <NewRetroDialog
        isOpen={creating}
        onClose={() => setCreating(false)}
        onCreate={async (retro) => {
          const id = await retroApi.createRetro(workspaceId, retro);
          await list.reload();
          setChosenId(id);
        }}
      />
      {editor.dialogs}
      <ConfirmDialog
        isOpen={deleting !== null}
        title={t("retros.delete.title")}
        description={t("retros.delete.description", { title: deleting?.title ?? "" })}
        confirmLabel={t("retros.delete.confirm")}
        cancelLabel={t("retros.delete.cancel")}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) void change(() => retroApi.deleteRetro(target.id));
        }}
      />
    </section>
  );
}

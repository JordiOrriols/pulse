import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, EmptyState, Spinner, cn } from "@jordiorriols/ui";
import { ListChecks, Plus } from "@jordiorriols/ui/icons";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { useData } from "@/data/DataProvider";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useActions } from "@/hooks/useActions";
import {
  ANY,
  DEFAULT_FILTERS,
  DUE_FILTERS,
  GROUPINGS,
  NONE,
  STATUS_FILTERS,
  countActions,
  filterActions,
  groupActions,
  localDate,
  type ActionFilters,
  type ActionGroup,
  type Grouping,
  type ImprovementAction,
} from "@/lib/actions";
import { ActionCard } from "@/components/actions/ActionCard";
import { useActionEditor } from "@/components/actions/useActionEditor";
import { FIELD_CLASS } from "@/components/retros/styles";

const COUNT_KEYS = ["open", "inProgress", "overdue", "doneRecently"] as const;

function Counts({ actions }: { actions: ImprovementAction[] }) {
  const { t } = useTranslation();
  const counts = countActions(actions);
  return (
    <dl aria-label={t("actions.counts.label")} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {COUNT_KEYS.map((key) => (
        <div
          key={key}
          className={cn(
            "rounded-lg bg-muted/60 px-4 py-3",
            key === "overdue" && counts.overdue > 0 && "bg-rose-500/10"
          )}
        >
          <dt className="text-xs text-muted-foreground">{t(`actions.counts.${key}`)}</dt>
          <dd
            className={cn(
              "text-2xl font-semibold tabular-nums",
              key === "overdue" && counts.overdue > 0 && "text-rose-600 dark:text-rose-400"
            )}
          >
            {counts[key]}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Filter({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_CLASS}
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function Filters({
  actions,
  filters,
  grouping,
  onFilters,
  onGrouping,
}: {
  actions: ImprovementAction[];
  filters: ActionFilters;
  grouping: Grouping;
  onFilters: (filters: ActionFilters) => void;
  onGrouping: (grouping: Grouping) => void;
}) {
  const { t } = useTranslation();
  const owners = new Map<string, string>();
  const retros = new Map<string, { title: string; heldOn: string }>();
  for (const action of actions) {
    if (action.ownerId) owners.set(action.ownerId, action.ownerEmail ?? action.ownerId);
    if (action.retroId)
      retros.set(action.retroId, {
        title: action.retroTitle ?? action.retroId,
        heldOn: action.retroHeldOn ?? "",
      });
  }
  const set = <K extends keyof ActionFilters>(key: K, value: ActionFilters[K]) =>
    onFilters({ ...filters, [key]: value });
  const label = (key: string) => t(`actions.filters.${key}`);
  const statusOptions = STATUS_FILTERS.map(
    (status) =>
      [
        status,
        status === "unresolved" || status === "all"
          ? t(`actions.filters.statusOptions.${status}`)
          : t(`actions.statuses.${status}`),
      ] as const
  );
  const ownerOptions = [
    [ANY, t("actions.filters.ownerOptions.all")],
    ...[...owners].toSorted((a, b) => a[1].localeCompare(b[1])),
    [NONE, t("actions.filters.ownerOptions.none")],
  ] as const;
  const retroOptions = [
    [ANY, t("actions.filters.retroOptions.all")],
    ...[...retros]
      .toSorted((a, b) => b[1].heldOn.localeCompare(a[1].heldOn))
      .map(([id, retro]) => [id, retro.title] as const),
    [NONE, t("actions.filters.retroOptions.none")],
  ] as const;
  const changed =
    JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS) || grouping !== "status";

  return (
    <div
      role="group"
      aria-label={t("actions.filters.label")}
      className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
    >
      <Filter
        id="pulse-filter-status"
        label={label("status")}
        value={filters.status}
        options={statusOptions}
        onChange={(value) => set("status", value as ActionFilters["status"])}
      />
      <Filter
        id="pulse-filter-owner"
        label={label("owner")}
        value={filters.owner}
        options={ownerOptions}
        onChange={(value) => set("owner", value)}
      />
      <Filter
        id="pulse-filter-retro"
        label={label("retro")}
        value={filters.retro}
        options={retroOptions}
        onChange={(value) => set("retro", value)}
      />
      <Filter
        id="pulse-filter-due"
        label={label("due")}
        value={filters.due}
        options={DUE_FILTERS.map((due) => [due, t(`actions.filters.dueOptions.${due}`)] as const)}
        onChange={(value) => set("due", value as ActionFilters["due"])}
      />
      <Filter
        id="pulse-filter-group"
        label={label("groupBy")}
        value={grouping}
        options={GROUPINGS.map((by) => [by, t(`actions.filters.groupings.${by}`)] as const)}
        onChange={(value) => onGrouping(value as Grouping)}
      />
      <Button
        variant="ghost"
        size="sm"
        disabled={!changed}
        onClick={() => {
          onFilters(DEFAULT_FILTERS);
          onGrouping("status");
        }}
      >
        {label("clear")}
      </Button>
    </div>
  );
}

function useGroupTitle(grouping: Grouping) {
  const { t } = useTranslation();
  return (group: ActionGroup) => {
    if (grouping === "status") return t(`actions.statuses.${group.key}`);
    if (group.key === NONE)
      return t(grouping === "retro" ? "actions.groups.noRetro" : "actions.groups.noOwner");
    return group.label ?? group.key;
  };
}

export default function ActionsPage() {
  const { t } = useTranslation();
  const { actionApi } = useData();
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const tracked = useActions(actionApi, workspaceId);
  const canManage = workspace?.access_level === "owner" || workspace?.access_level === "editor";
  const [filters, setFilters] = useState<ActionFilters>(DEFAULT_FILTERS);
  const [grouping, setGrouping] = useState<Grouping>("status");
  const titleOf = useGroupTitle(grouping);
  const action = useAsyncAction();

  const change = async (operation: () => Promise<unknown>) => {
    const result = await action.run(async () => {
      await operation();
      await tracked.reload();
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

  if (!actionApi || !workspaceId) return null;

  const today = localDate();
  const groups = groupActions(filterActions(tracked.actions, filters, today), grouping);

  let body;
  if (tracked.error) {
    body = (
      <p role="alert" className="text-sm text-destructive">
        {tracked.error}
      </p>
    );
  } else if (tracked.loading) {
    body = (
      <div className="flex justify-center py-12">
        <Spinner label={t("actions.loading")} />
      </div>
    );
  } else if (tracked.actions.length === 0) {
    body = (
      <EmptyState
        icon={<ListChecks className="size-8 text-muted-foreground" />}
        title={t("actions.empty.title")}
        description={t(canManage ? "actions.empty.manager" : "actions.empty.member")}
      />
    );
  } else {
    body = (
      <div className="space-y-6">
        <Counts actions={tracked.actions} />
        <Filters
          actions={tracked.actions}
          filters={filters}
          grouping={grouping}
          onFilters={setFilters}
          onGrouping={setGrouping}
        />
        {action.error && (
          <p role="alert" className="text-sm text-destructive">
            {action.error}
          </p>
        )}
        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("actions.noMatches")}</p>
        ) : (
          groups.map((group) => {
            const id = `pulse-actions-${grouping}-${group.key}`;
            return (
              <section key={group.key} className="space-y-3" aria-labelledby={id}>
                <h2 id={id} className="flex items-baseline gap-2 text-sm font-semibold">
                  {titleOf(group)}
                  <span className="font-normal text-muted-foreground tabular-nums">
                    {group.actions.length}
                  </span>
                </h2>
                <ul className="max-w-4xl space-y-3">
                  {group.actions.map((item) => (
                    <li key={item.id}>
                      <ActionCard
                        action={item}
                        today={today}
                        busy={action.busy}
                        showOrigin={grouping !== "retro"}
                        onChange={change}
                        onEdit={editor.edit}
                        onDelete={editor.remove}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    );
  }

  return (
    <section className="space-y-6" aria-labelledby="actions-title">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 id="actions-title" className="text-2xl font-semibold">
            {t("sections.actions.title")}
          </h1>
          <p className="text-muted-foreground">{t("sections.actions.description")}</p>
        </div>
        {canManage && (
          <Button onClick={() => editor.create({ retroId: null, groupId: null })}>
            <Plus className="size-4" />
            {t("actions.form.create")}
          </Button>
        )}
      </header>
      {body}
      {editor.dialogs}
    </section>
  );
}

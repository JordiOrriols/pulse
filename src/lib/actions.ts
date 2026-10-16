import type { Retro } from "./retros";

export const ACTION_STATUSES = ["open", "in_progress", "done", "cancelled"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ACTION_UPDATE_KINDS = ["created", "edited", "status", "note", "outcome"] as const;
export type ActionUpdateKind = (typeof ACTION_UPDATE_KINDS)[number];

/** Completed actions stay in the "done recently" count for this many days. */
export const RECENT_DAYS = 14;

/** An account with Pulse access to the workspace, which can own or collaborate on actions. */
export interface Person {
  id: string;
  email: string;
}

export interface ImprovementAction {
  id: string;
  retroId: string | null;
  groupId: string | null;
  title: string;
  description: string | null;
  ownerId: string | null;
  ownerEmail: string | null;
  collaborators: Person[];
  /** A calendar date, YYYY-MM-DD. */
  dueOn: string | null;
  priority: Priority;
  status: ActionStatus;
  successCriteria: string | null;
  outcome: string | null;
  helped: boolean | null;
  followUp: string | null;
  createdAt: string;
  completedAt: string | null;
  retroTitle: string | null;
  retroHeldOn: string | null;
  groupTitle: string | null;
  /** May edit or delete the action. */
  canManage: boolean;
  /** May change its status, add notes and record the outcome. */
  canUpdate: boolean;
}

export interface ActionUpdate {
  id: string;
  kind: ActionUpdateKind;
  status: ActionStatus | null;
  note: string | null;
  authorEmail: string | null;
  createdAt: string;
}

/** Today's date in the browser's time zone, YYYY-MM-DD, to compare with due dates. */
export function localDate(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isUnresolved(action: ImprovementAction): boolean {
  return action.status === "open" || action.status === "in_progress";
}

export function isOverdue(action: ImprovementAction, today: string): boolean {
  return isUnresolved(action) && action.dueOn !== null && action.dueOn < today;
}

export function isRecentlyDone(action: ImprovementAction, now = new Date()): boolean {
  return (
    action.status === "done" &&
    action.completedAt !== null &&
    now.getTime() - new Date(action.completedAt).getTime() <= RECENT_DAYS * 24 * 60 * 60 * 1000
  );
}

export interface ActionCounts {
  open: number;
  inProgress: number;
  overdue: number;
  doneRecently: number;
}

export function countActions(actions: ImprovementAction[], now = new Date()): ActionCounts {
  const today = localDate(now);
  return {
    open: actions.filter((action) => action.status === "open").length,
    inProgress: actions.filter((action) => action.status === "in_progress").length,
    overdue: actions.filter((action) => isOverdue(action, today)).length,
    doneRecently: actions.filter((action) => isRecentlyDone(action, now)).length,
  };
}

/** Open work first, then by due date (undated last), priority and age. */
export function sortActions(actions: ImprovementAction[]): ImprovementAction[] {
  return actions.toSorted(
    (a, b) =>
      ACTION_STATUSES.indexOf(a.status) - ACTION_STATUSES.indexOf(b.status) ||
      (a.dueOn ?? "9999-12-31").localeCompare(b.dueOn ?? "9999-12-31") ||
      PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id)
  );
}

export const STATUS_FILTERS = ["unresolved", "all", ...ACTION_STATUSES] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];
export const DUE_FILTERS = ["all", "overdue", "week", "none"] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];
/** Matches every owner or retrospective. */
export const ANY = "all";
/** Matches actions without an owner or without a retrospective. */
export const NONE = "none";

export interface ActionFilters {
  status: StatusFilter;
  owner: string;
  retro: string;
  due: DueFilter;
}

export const DEFAULT_FILTERS: ActionFilters = {
  status: "unresolved",
  owner: ANY,
  retro: ANY,
  due: "all",
};

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function matches(filter: string, value: string | null): boolean {
  return filter === ANY || (filter === NONE ? value === null : value === filter);
}

export function filterActions(
  actions: ImprovementAction[],
  filters: ActionFilters,
  today: string
): ImprovementAction[] {
  const weekEnd = addDays(today, 7);
  return actions.filter((action) => {
    const status =
      filters.status === "all" ||
      (filters.status === "unresolved" ? isUnresolved(action) : action.status === filters.status);
    const due =
      filters.due === "all" ||
      (filters.due === "overdue" && isOverdue(action, today)) ||
      (filters.due === "week" &&
        action.dueOn !== null &&
        action.dueOn >= today &&
        action.dueOn <= weekEnd) ||
      (filters.due === "none" && action.dueOn === null);
    return (
      status &&
      due &&
      matches(filters.owner, action.ownerId) &&
      matches(filters.retro, action.retroId)
    );
  });
}

export const GROUPINGS = ["status", "retro", "owner"] as const;
export type Grouping = (typeof GROUPINGS)[number];

export interface ActionGroup {
  /** A status, a retro or owner id, or NONE. */
  key: string;
  /** The retro title or owner email; null for statuses and for NONE. */
  label: string | null;
  actions: ImprovementAction[];
}

/** Sorted actions split by status (in workflow order), retrospective (latest first) or owner. */
export function groupActions(actions: ImprovementAction[], by: Grouping): ActionGroup[] {
  const sorted = sortActions(actions);
  if (by === "status")
    return ACTION_STATUSES.map((status) => ({
      key: status,
      label: null,
      actions: sorted.filter((action) => action.status === status),
    })).filter((group) => group.actions.length > 0);
  const groups = new Map<string, ActionGroup & { order: string }>();
  for (const action of sorted) {
    const key = (by === "retro" ? action.retroId : action.ownerId) ?? NONE;
    const label = key === NONE ? null : by === "retro" ? action.retroTitle : action.ownerEmail;
    const order = by === "retro" ? (action.retroHeldOn ?? "") : (label ?? "");
    const group = groups.get(key) ?? { key, label, order, actions: [] };
    group.actions.push(action);
    groups.set(key, group);
  }
  return [...groups.values()]
    .toSorted((a, b) => {
      if (a.key === NONE || b.key === NONE) return Number(a.key === NONE) - Number(b.key === NONE);
      return by === "retro"
        ? b.order.localeCompare(a.order) || a.key.localeCompare(b.key)
        : a.order.localeCompare(b.order) || a.key.localeCompare(b.key);
    })
    .map(({ order: _order, ...group }) => group);
}

/** The retrospective held just before this one, if any. */
export function previousRetro(retro: Retro, retros: Retro[]): Retro | null {
  const earlier = retros.filter(
    (other) =>
      other.id !== retro.id &&
      (other.heldOn < retro.heldOn ||
        (other.heldOn === retro.heldOn && other.createdAt < retro.createdAt))
  );
  return (
    earlier.toSorted(
      (a, b) => b.heldOn.localeCompare(a.heldOn) || b.createdAt.localeCompare(a.createdAt)
    )[0] ?? null
  );
}

export interface ActionReview {
  /** Open or in progress actions agreed elsewhere, carried into this retro. */
  outstanding: ImprovementAction[];
  /** Actions from elsewhere finished since the previous retro, to check whether they helped. */
  completed: ImprovementAction[];
  /** Actions agreed in this retro. */
  agreed: ImprovementAction[];
}

/**
 * What a retrospective reviews. A new retro never resolves earlier actions on its own: they stay
 * outstanding until someone moves them.
 */
export function reviewActions(
  actions: ImprovementAction[],
  retro: Retro,
  retros: Retro[]
): ActionReview {
  const since = previousRetro(retro, retros)?.heldOn ?? null;
  const elsewhere = actions.filter(
    (action) =>
      action.retroId !== retro.id &&
      (action.retroHeldOn === null
        ? retro.closedAt === null || action.createdAt <= retro.closedAt
        : action.retroHeldOn <= retro.heldOn)
  );
  return {
    outstanding: sortActions(elsewhere.filter(isUnresolved)),
    completed: sortActions(
      elsewhere.filter(
        (action) =>
          action.status === "done" &&
          action.completedAt !== null &&
          (since === null || action.completedAt.slice(0, 10) >= since)
      )
    ),
    agreed: sortActions(actions.filter((action) => action.retroId === retro.id)),
  };
}

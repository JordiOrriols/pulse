import type { SupabaseClient } from "@supabase/supabase-js";
import i18n from "@/i18n";
import {
  ACTION_STATUSES,
  ACTION_UPDATE_KINDS,
  PRIORITIES,
  type ActionStatus,
  type ActionUpdate,
  type ImprovementAction,
  type Person,
  type Priority,
} from "@/lib/actions";

type Row = { [field: string]: unknown };
type Fields<K extends string> = { [P in K]?: unknown };

function unexpected(): never {
  throw new Error(i18n.t("errors.unexpectedResponse"));
}
const isRow = <K extends string = never>(value: unknown): value is Fields<K> & Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value : unexpected());
const optionalText = (value: unknown) => (value === null ? null : text(value));
const flag = (value: unknown) => (typeof value === "boolean" ? value : unexpected());
function oneOf<T extends string>(values: readonly T[], value: unknown): T {
  return (values as readonly unknown[]).includes(value) ? (value as T) : unexpected();
}
const list = (value: unknown) => (Array.isArray(value) ? value : unexpected());

function parsePerson(row: unknown): Person {
  if (!isRow<"id" | "user_id" | "email">(row)) unexpected();
  return { id: text(row.id ?? row.user_id), email: text(row.email) };
}

function parseAction(row: unknown): ImprovementAction {
  if (
    !isRow<
      | "id"
      | "retro_id"
      | "group_id"
      | "title"
      | "description"
      | "owner_id"
      | "owner_email"
      | "collaborators"
      | "due_on"
      | "priority"
      | "status"
      | "success_criteria"
      | "outcome"
      | "helped"
      | "follow_up"
      | "created_at"
      | "completed_at"
      | "retro_title"
      | "retro_held_on"
      | "group_title"
      | "can_manage"
      | "can_update"
    >(row)
  )
    unexpected();
  return {
    id: text(row.id),
    retroId: optionalText(row.retro_id),
    groupId: optionalText(row.group_id),
    title: text(row.title),
    description: optionalText(row.description),
    ownerId: optionalText(row.owner_id),
    ownerEmail: optionalText(row.owner_email),
    collaborators: list(row.collaborators).map(parsePerson),
    dueOn: optionalText(row.due_on),
    priority: oneOf(PRIORITIES, row.priority),
    status: oneOf(ACTION_STATUSES, row.status),
    successCriteria: optionalText(row.success_criteria),
    outcome: optionalText(row.outcome),
    helped: row.helped === null ? null : flag(row.helped),
    followUp: optionalText(row.follow_up),
    createdAt: text(row.created_at),
    completedAt: optionalText(row.completed_at),
    retroTitle: optionalText(row.retro_title),
    retroHeldOn: optionalText(row.retro_held_on),
    groupTitle: optionalText(row.group_title),
    canManage: flag(row.can_manage),
    canUpdate: flag(row.can_update),
  };
}

function parseUpdate(row: unknown): ActionUpdate {
  if (!isRow<"id" | "kind" | "status" | "note" | "author_email" | "created_at">(row)) unexpected();
  return {
    id: text(row.id),
    kind: oneOf(ACTION_UPDATE_KINDS, row.kind),
    status: row.status === null ? null : oneOf(ACTION_STATUSES, row.status),
    note: optionalText(row.note),
    authorEmail: optionalText(row.author_email),
    createdAt: text(row.created_at),
  };
}

export interface ActionDraft {
  title: string;
  description: string;
  ownerId: string;
  collaboratorIds: string[];
  /** YYYY-MM-DD, or empty for no due date. */
  dueOn: string;
  priority: Priority;
  successCriteria: string;
}

export interface ActionOrigin {
  retroId: string | null;
  groupId: string | null;
}

export interface ActionOutcome {
  outcome: string;
  helped: boolean | null;
  followUp: string;
}

/** Improvement actions of a workspace and their history, all through RPCs. */
export function createActionApi(client: SupabaseClient) {
  async function check<T>(request: PromiseLike<{ data: T; error: { message: string } | null }>) {
    const { data, error } = await request;
    if (error) throw new Error(error.message);
    return data;
  }
  const fields = (draft: ActionDraft) => ({
    action_title: draft.title,
    action_description: draft.description,
    action_owner: draft.ownerId,
    collaborators: draft.collaboratorIds,
    due: draft.dueOn || null,
    action_priority: draft.priority,
    criteria: draft.successCriteria,
  });
  return {
    async listActions(workspace: string): Promise<ImprovementAction[]> {
      return list(await check(client.rpc("list_pulse_actions", { workspace }))).map(parseAction);
    },
    async listPeople(workspace: string): Promise<Person[]> {
      return list(await check(client.rpc("pulse_workspace_people", { workspace }))).map(
        parsePerson
      );
    },
    async history(action: string): Promise<ActionUpdate[]> {
      return list(await check(client.rpc("pulse_action_history", { action }))).map(parseUpdate);
    },
    async createAction(workspace: string, origin: ActionOrigin, draft: ActionDraft) {
      const id = await check(
        client.rpc("create_pulse_action", {
          workspace,
          retro: origin.retroId,
          grp: origin.groupId,
          ...fields(draft),
        })
      );
      return text(id);
    },
    async updateAction(action: string, draft: ActionDraft) {
      await check(client.rpc("update_pulse_action", { action, ...fields(draft) }));
    },
    async setStatus(action: string, status: ActionStatus, note: string) {
      await check(
        client.rpc("set_pulse_action_status", { action, new_status: status, status_note: note })
      );
    },
    async addNote(action: string, note: string) {
      await check(client.rpc("add_pulse_action_note", { action, action_note: note }));
    },
    async recordOutcome(action: string, outcome: ActionOutcome) {
      await check(
        client.rpc("record_pulse_action_outcome", {
          action,
          action_outcome: outcome.outcome,
          did_help: outcome.helped,
          action_follow_up: outcome.followUp,
        })
      );
    },
    async deleteAction(action: string) {
      await check(client.rpc("delete_pulse_action", { action }));
    },
  };
}

export type ActionApi = ReturnType<typeof createActionApi>;

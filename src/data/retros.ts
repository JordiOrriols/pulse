import type { SupabaseClient } from "@supabase/supabase-js";
import i18n from "@/i18n";
import {
  DECISIONS,
  RETRO_STAGES,
  RETRO_TEMPLATES,
  type Decision,
  type Discussion,
  type Retro,
  type RetroBoard,
  type RetroGroup,
  type RetroStage,
  type RetroTemplate,
  type RetroTopic,
} from "@/lib/retros";

const RETRO_COLUMNS =
  "id,title,held_on,period,goal,template,anonymous,votes_per_person,stage,created_at,closed_at";

type Row = { [field: string]: unknown };
type Fields<K extends string> = { [P in K]?: unknown };

function unexpected(): never {
  throw new Error(i18n.t("errors.unexpectedResponse"));
}
const isRow = <K extends string = never>(value: unknown): value is Fields<K> & Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value : unexpected());
const optionalText = (value: unknown) => (value === null ? null : text(value));
const count = (value: unknown) => (typeof value === "number" ? value : unexpected());
function oneOf<T extends string>(values: readonly T[], value: unknown): T {
  return (values as readonly unknown[]).includes(value) ? (value as T) : unexpected();
}

function parseRetro(row: unknown): Retro {
  if (
    !isRow<
      | "id"
      | "title"
      | "held_on"
      | "period"
      | "goal"
      | "template"
      | "anonymous"
      | "votes_per_person"
      | "stage"
      | "created_at"
      | "closed_at"
    >(row) ||
    typeof row.anonymous !== "boolean"
  )
    unexpected();
  return {
    id: text(row.id),
    title: text(row.title),
    heldOn: text(row.held_on),
    period: optionalText(row.period),
    goal: optionalText(row.goal),
    template: oneOf(RETRO_TEMPLATES, row.template),
    anonymous: row.anonymous,
    votesPerPerson: count(row.votes_per_person),
    stage: oneOf(RETRO_STAGES, row.stage),
    createdAt: text(row.created_at),
    closedAt: optionalText(row.closed_at),
  };
}

function parseTopic(row: unknown): RetroTopic {
  if (
    !isRow<
      "id" | "column" | "title" | "description" | "group_id" | "created_at" | "mine" | "author"
    >(row) ||
    typeof row.mine !== "boolean"
  )
    unexpected();
  return {
    id: text(row.id),
    column: text(row.column),
    title: text(row.title),
    description: optionalText(row.description),
    groupId: optionalText(row.group_id),
    createdAt: text(row.created_at),
    mine: row.mine,
    author: optionalText(row.author),
  };
}

function parseGroup(row: unknown): RetroGroup {
  if (
    !isRow<
      | "id"
      | "title"
      | "created_at"
      | "summary"
      | "impact"
      | "root_causes"
      | "context"
      | "decision"
      | "votes"
      | "my_votes"
    >(row)
  )
    unexpected();
  return {
    id: text(row.id),
    title: optionalText(row.title),
    createdAt: text(row.created_at),
    summary: optionalText(row.summary),
    impact: optionalText(row.impact),
    rootCauses: optionalText(row.root_causes),
    context: optionalText(row.context),
    decision: row.decision === null ? null : oneOf(DECISIONS, row.decision),
    votes: row.votes === null ? null : count(row.votes),
    myVotes: count(row.my_votes),
  };
}

function parseBoard(row: unknown): RetroBoard {
  if (
    !isRow<"can_facilitate" | "topics" | "hidden_topics" | "groups" | "voters">(row) ||
    typeof row.can_facilitate !== "boolean" ||
    !Array.isArray(row.topics) ||
    !Array.isArray(row.groups)
  )
    unexpected();
  return {
    canFacilitate: row.can_facilitate,
    topics: row.topics.map(parseTopic),
    hiddenTopics: count(row.hidden_topics),
    groups: row.groups.map(parseGroup),
    voters: count(row.voters),
  };
}

export interface NewRetro {
  title: string;
  heldOn: string;
  period: string;
  goal: string;
  template: RetroTemplate;
  anonymous: boolean;
  votesPerPerson: number;
}

export interface TopicDraft {
  column: string;
  title: string;
  description: string;
}

/** Guided retrospectives of a workspace. Boards only come back through one RPC. */
export function createRetroApi(client: SupabaseClient) {
  async function check<T>(request: PromiseLike<{ data: T; error: { message: string } | null }>) {
    const { data, error } = await request;
    if (error) throw new Error(error.message);
    return data;
  }
  return {
    async listRetros(workspace: string): Promise<Retro[]> {
      const rows = await check(
        client
          .from("pulse_retros")
          .select(RETRO_COLUMNS)
          .eq("workspace_id", workspace)
          .order("held_on", { ascending: false })
          .order("created_at", { ascending: false })
      );
      return Array.isArray(rows) ? rows.map(parseRetro) : unexpected();
    },
    async loadBoard(retro: string): Promise<RetroBoard> {
      return parseBoard(await check(client.rpc("pulse_retro_board", { retro })));
    },
    async createRetro(workspace: string, retro: NewRetro): Promise<string> {
      const id = await check(
        client.rpc("create_pulse_retro", {
          workspace,
          retro_title: retro.title,
          held: retro.heldOn,
          retro_period: retro.period,
          retro_goal: retro.goal,
          retro_template: retro.template,
          is_anonymous: retro.anonymous,
          votes: retro.votesPerPerson,
        })
      );
      return text(id);
    },
    async deleteRetro(retro: string) {
      await check(client.rpc("delete_pulse_retro", { retro }));
    },
    async setStage(retro: string, stage: RetroStage) {
      await check(client.rpc("set_pulse_retro_stage", { retro, new_stage: stage }));
    },
    async addTopic(retro: string, topic: TopicDraft): Promise<string> {
      const id = await check(
        client.rpc("add_pulse_topic", {
          retro,
          topic_column: topic.column,
          topic_title: topic.title,
          topic_description: topic.description,
        })
      );
      return text(id);
    },
    async updateTopic(topic: string, draft: TopicDraft) {
      await check(
        client.rpc("update_pulse_topic", {
          topic,
          topic_column: draft.column,
          topic_title: draft.title,
          topic_description: draft.description,
        })
      );
    },
    async deleteTopic(topic: string) {
      await check(client.rpc("delete_pulse_topic", { topic }));
    },
    async createGroup(retro: string, topics: string[], title: string): Promise<string> {
      const id = await check(
        client.rpc("create_pulse_group", { retro, topics, group_title: title })
      );
      return text(id);
    },
    async renameGroup(group: string, title: string) {
      await check(client.rpc("rename_pulse_group", { grp: group, group_title: title }));
    },
    async moveTopic(topic: string, group: string | null) {
      await check(client.rpc("move_pulse_topic", { topic, grp: group }));
    },
    async mergeGroups(source: string, destination: string) {
      await check(client.rpc("merge_pulse_groups", { source, destination }));
    },
    async ungroup(group: string) {
      await check(client.rpc("ungroup_pulse_group", { grp: group }));
    },
    async setVote(group: string, votes: number) {
      await check(client.rpc("set_pulse_vote", { grp: group, votes }));
    },
    async updateDiscussion(group: string, discussion: Discussion) {
      await check(
        client.rpc("update_pulse_discussion", {
          grp: group,
          group_summary: discussion.summary ?? "",
          group_impact: discussion.impact ?? "",
          group_root_causes: discussion.rootCauses ?? "",
          group_context: discussion.context ?? "",
          group_decision: discussion.decision satisfies Decision | null,
        })
      );
    },
  };
}

export type RetroApi = ReturnType<typeof createRetroApi>;

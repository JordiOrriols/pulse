import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createRetroApi } from "../retros";

type Reply = { data: unknown; error: { message: string } | null };

function fakeClient(tables: Record<string, Reply>, rpc: Record<string, Reply> = {}) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const from = vi.fn((table: string) => {
    const reply = tables[table] ?? { data: [], error: null };
    const query = {
      then: (resolve: (value: Reply) => unknown) => resolve(reply),
    } as Record<string, unknown>;
    for (const method of ["select", "eq", "order"])
      query[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return query;
      };
    return query;
  });
  const client = {
    from,
    rpc: vi.fn(async (name: string) => rpc[name] ?? { data: null, error: null }),
  };
  return { client: client as unknown as SupabaseClient, calls, rpc: client.rpc };
}

const retroRow = {
  id: "r1",
  title: "Sprint 12",
  held_on: "2026-10-01",
  period: "Sprint 12",
  goal: null,
  template: "start_stop_continue",
  anonymous: true,
  votes_per_person: 3,
  stage: "collect",
  created_at: "2026-10-01T10:00:00Z",
  closed_at: null,
};

const boardRow = {
  can_facilitate: false,
  topics: [
    {
      id: "t1",
      column: "start",
      title: "Pairing",
      description: null,
      group_id: "g1",
      created_at: "2026-10-01T10:01:00Z",
      mine: true,
      author: null,
    },
  ],
  hidden_topics: 0,
  groups: [
    {
      id: "g1",
      title: null,
      created_at: "2026-10-01T10:02:00Z",
      summary: null,
      impact: null,
      root_causes: "Silos",
      context: null,
      decision: "action",
      votes: null,
      my_votes: 2,
    },
  ],
  voters: 1,
};

describe("createRetroApi", () => {
  it("lists the retrospectives of a workspace, latest first", async () => {
    const { client, calls } = fakeClient({ pulse_retros: { data: [retroRow], error: null } });
    expect(await createRetroApi(client).listRetros("w1")).toEqual([
      {
        id: "r1",
        title: "Sprint 12",
        heldOn: "2026-10-01",
        period: "Sprint 12",
        goal: null,
        template: "start_stop_continue",
        anonymous: true,
        votesPerPerson: 3,
        stage: "collect",
        createdAt: "2026-10-01T10:00:00Z",
        closedAt: null,
      },
    ]);
    expect(calls).toContainEqual({
      table: "pulse_retros",
      method: "eq",
      args: ["workspace_id", "w1"],
    });
    expect(calls).toContainEqual({
      table: "pulse_retros",
      method: "order",
      args: ["held_on", { ascending: false }],
    });
  });

  it.each([
    ["an unknown template", { ...retroRow, template: "sailboat" }],
    ["an unknown stage", { ...retroRow, stage: "archived" }],
  ])("rejects a retrospective with %s", async (_, row) => {
    const { client } = fakeClient({ pulse_retros: { data: [row], error: null } });
    await expect(createRetroApi(client).listRetros("w1")).rejects.toThrow(
      "The server sent an unexpected response"
    );
  });

  it("reads a board with hidden vote totals", async () => {
    const { client, rpc } = fakeClient({}, { pulse_retro_board: { data: boardRow, error: null } });
    const board = await createRetroApi(client).loadBoard("r1");
    expect(rpc).toHaveBeenCalledWith("pulse_retro_board", { retro: "r1" });
    expect(board.topics[0]).toMatchObject({ id: "t1", groupId: "g1", mine: true, author: null });
    expect(board.groups[0]).toMatchObject({
      votes: null,
      myVotes: 2,
      rootCauses: "Silos",
      decision: "action",
    });
  });

  it("rejects a board with an unknown decision", async () => {
    const { client } = fakeClient(
      {},
      {
        pulse_retro_board: {
          data: { ...boardRow, groups: [{ ...boardRow.groups[0], decision: "ignore" }] },
          error: null,
        },
      }
    );
    await expect(createRetroApi(client).loadBoard("r1")).rejects.toThrow();
  });

  it("creates a retrospective", async () => {
    const { client, rpc } = fakeClient({}, { create_pulse_retro: { data: "r9", error: null } });
    const id = await createRetroApi(client).createRetro("w1", {
      title: "Q4",
      heldOn: "2026-10-02",
      period: "",
      goal: "Ship faster",
      template: "open",
      anonymous: false,
      votesPerPerson: 5,
    });
    expect(id).toBe("r9");
    expect(rpc).toHaveBeenCalledWith("create_pulse_retro", {
      workspace: "w1",
      retro_title: "Q4",
      held: "2026-10-02",
      retro_period: "",
      retro_goal: "Ship faster",
      retro_template: "open",
      is_anonymous: false,
      votes: 5,
    });
  });

  it("drives the board through the database functions", async () => {
    const { client, rpc } = fakeClient(
      {},
      {
        add_pulse_topic: { data: "t2", error: null },
        create_pulse_group: { data: "g2", error: null },
      }
    );
    const api = createRetroApi(client);
    const draft = { column: "stop", title: "Late reviews", description: "" };
    expect(await api.addTopic("r1", draft)).toBe("t2");
    await api.updateTopic("t2", draft);
    await api.deleteTopic("t2");
    await api.setStage("r1", "group");
    expect(await api.createGroup("r1", ["t1"], "Focus")).toBe("g2");
    await api.renameGroup("g2", "Flow");
    await api.moveTopic("t1", null);
    await api.mergeGroups("g2", "g1");
    await api.ungroup("g1");
    await api.setVote("g1", 2);
    await api.updateDiscussion("g1", {
      summary: "Talked",
      impact: null,
      rootCauses: null,
      context: null,
      decision: "monitor",
    });
    await api.deleteRetro("r1");
    const topicArgs = { topic_column: "stop", topic_title: "Late reviews", topic_description: "" };
    expect(rpc.mock.calls).toEqual([
      ["add_pulse_topic", { retro: "r1", ...topicArgs }],
      ["update_pulse_topic", { topic: "t2", ...topicArgs }],
      ["delete_pulse_topic", { topic: "t2" }],
      ["set_pulse_retro_stage", { retro: "r1", new_stage: "group" }],
      ["create_pulse_group", { retro: "r1", topics: ["t1"], group_title: "Focus" }],
      ["rename_pulse_group", { grp: "g2", group_title: "Flow" }],
      ["move_pulse_topic", { topic: "t1", grp: null }],
      ["merge_pulse_groups", { source: "g2", destination: "g1" }],
      ["ungroup_pulse_group", { grp: "g1" }],
      ["set_pulse_vote", { grp: "g1", votes: 2 }],
      [
        "update_pulse_discussion",
        {
          grp: "g1",
          group_summary: "Talked",
          group_impact: "",
          group_root_causes: "",
          group_context: "",
          group_decision: "monitor",
        },
      ],
      ["delete_pulse_retro", { retro: "r1" }],
    ]);
  });

  it("passes database errors on", async () => {
    const { client } = fakeClient(
      {},
      { set_pulse_vote: { data: null, error: { message: "You only have 3 votes" } } }
    );
    await expect(createRetroApi(client).setVote("g1", 4)).rejects.toThrow("You only have 3 votes");
  });
});

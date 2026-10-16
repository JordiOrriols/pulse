import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createActionApi, type ActionDraft } from "../actions";

type Reply = { data: unknown; error: { message: string } | null };

function fakeClient(replies: Record<string, Reply> = {}) {
  const rpc = vi.fn(async (name: string) => replies[name] ?? { data: null, error: null });
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

const actionRow = {
  id: "a1",
  retro_id: "r1",
  group_id: "g1",
  title: "Approve scope changes",
  description: null,
  owner_id: "u2",
  owner_email: "grace@example.com",
  collaborators: [{ id: "u1", email: "ada@example.com" }],
  due_on: "2026-10-30",
  priority: "high",
  status: "in_progress",
  success_criteria: "Every change has a decision",
  outcome: null,
  helped: null,
  follow_up: null,
  created_at: "2026-10-16T10:00:00Z",
  completed_at: null,
  retro_title: "Sprint 24",
  retro_held_on: "2026-10-16",
  group_title: "Scope churn",
  can_manage: false,
  can_update: true,
};

const draft: ActionDraft = {
  title: "Approve scope changes",
  description: "",
  ownerId: "u2",
  collaboratorIds: ["u1"],
  dueOn: "",
  priority: "high",
  successCriteria: "Every change has a decision",
};

describe("createActionApi", () => {
  it("parses actions with their people, retro and permissions", async () => {
    const { client, rpc } = fakeClient({ list_pulse_actions: { data: [actionRow], error: null } });
    const [action] = await createActionApi(client).listActions("ws-1");
    expect(rpc).toHaveBeenCalledWith("list_pulse_actions", { workspace: "ws-1" });
    expect(action).toMatchObject({
      retroId: "r1",
      groupId: "g1",
      ownerEmail: "grace@example.com",
      collaborators: [{ id: "u1", email: "ada@example.com" }],
      dueOn: "2026-10-30",
      priority: "high",
      status: "in_progress",
      successCriteria: "Every change has a decision",
      retroTitle: "Sprint 24",
      groupTitle: "Scope churn",
      canManage: false,
      canUpdate: true,
    });
  });

  it("rejects actions with an unknown status", async () => {
    const { client } = fakeClient({
      list_pulse_actions: { data: [{ ...actionRow, status: "blocked" }], error: null },
    });
    await expect(createActionApi(client).listActions("ws-1")).rejects.toThrow();
  });

  it("lists the people who can own actions and the history of one", async () => {
    const { client } = fakeClient({
      pulse_workspace_people: { data: [{ user_id: "u1", email: "ada@example.com" }], error: null },
      pulse_action_history: {
        data: [
          {
            id: "h1",
            kind: "status",
            status: "done",
            note: "Shipped",
            author_email: "ada@example.com",
            created_at: "2026-10-16T11:00:00Z",
          },
        ],
        error: null,
      },
    });
    const api = createActionApi(client);
    expect(await api.listPeople("ws-1")).toEqual([{ id: "u1", email: "ada@example.com" }]);
    expect(await api.history("a1")).toEqual([
      {
        id: "h1",
        kind: "status",
        status: "done",
        note: "Shipped",
        authorEmail: "ada@example.com",
        createdAt: "2026-10-16T11:00:00Z",
      },
    ]);
  });

  it("sends drafts with an empty due date as no due date", async () => {
    const { client, rpc } = fakeClient({ create_pulse_action: { data: "a9", error: null } });
    const api = createActionApi(client);
    expect(await api.createAction("ws-1", { retroId: "r1", groupId: "g1" }, draft)).toBe("a9");
    expect(rpc).toHaveBeenCalledWith("create_pulse_action", {
      workspace: "ws-1",
      retro: "r1",
      grp: "g1",
      action_title: "Approve scope changes",
      action_description: "",
      action_owner: "u2",
      collaborators: ["u1"],
      due: null,
      action_priority: "high",
      criteria: "Every change has a decision",
    });
    await api.updateAction("a9", { ...draft, dueOn: "2026-11-01" });
    expect(rpc).toHaveBeenLastCalledWith(
      "update_pulse_action",
      expect.objectContaining({ action: "a9", due: "2026-11-01" })
    );
  });

  it("updates status, notes and outcome through their own functions", async () => {
    const { client, rpc } = fakeClient();
    const api = createActionApi(client);
    await api.setStatus("a1", "done", "Shipped");
    await api.addNote("a1", "Halfway");
    await api.recordOutcome("a1", { outcome: "Calmer sprints", helped: true, followUp: "" });
    await api.deleteAction("a1");
    expect(rpc.mock.calls).toEqual([
      ["set_pulse_action_status", { action: "a1", new_status: "done", status_note: "Shipped" }],
      ["add_pulse_action_note", { action: "a1", action_note: "Halfway" }],
      [
        "record_pulse_action_outcome",
        { action: "a1", action_outcome: "Calmer sprints", did_help: true, action_follow_up: "" },
      ],
      ["delete_pulse_action", { action: "a1" }],
    ]);
  });

  it("surfaces database errors", async () => {
    const { client } = fakeClient({
      set_pulse_action_status: { data: null, error: { message: "Only the owner" } },
    });
    await expect(createActionApi(client).setStatus("a1", "done", "")).rejects.toThrow(
      "Only the owner"
    );
  });
});

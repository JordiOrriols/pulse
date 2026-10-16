import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSurveyApi } from "../surveys";

type Reply = { data: unknown; error: { message: string } | null };

function fakeClient(tables: Record<string, Reply>, rpc: Record<string, Reply> = {}) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const from = vi.fn((table: string) => {
    const reply = tables[table] ?? { data: [], error: null };
    const query = {
      then: (resolve: (value: Reply) => unknown) => resolve(reply),
    } as Record<string, unknown>;
    for (const method of ["select", "eq", "in", "order"])
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

const surveyRow = {
  id: "s1",
  title: "Sprint 12",
  asks_comment: true,
  min_responses: 3,
  status: "open",
  created_at: "2026-10-01T10:00:00Z",
  closed_at: null,
  pulse_questions: [
    { id: "q2", position: 2, key: null, prompt: "On-call?", low_label: "Heavy", high_label: null },
    { id: "q1", position: 1, key: "health", prompt: null, low_label: null, high_label: null },
  ],
};

describe("createSurveyApi", () => {
  it("lists the surveys of a workspace with their ordered questions and my participation", async () => {
    const { client, calls } = fakeClient({
      pulse_surveys: {
        data: [surveyRow, { ...surveyRow, id: "s2", pulse_questions: [] }],
        error: null,
      },
      pulse_participations: { data: [{ survey_id: "s2" }], error: null },
    });
    const surveys = await createSurveyApi(client).listSurveys("w1");
    expect(surveys.map((survey) => [survey.id, survey.answered])).toEqual([
      ["s1", false],
      ["s2", true],
    ]);
    expect(surveys[0]!.questions).toEqual([
      { id: "q1", position: 1, key: "health", prompt: null, lowLabel: null, highLabel: null },
      { id: "q2", position: 2, key: null, prompt: "On-call?", lowLabel: "Heavy", highLabel: null },
    ]);
    expect(calls).toContainEqual({
      table: "pulse_surveys",
      method: "eq",
      args: ["workspace_id", "w1"],
    });
    expect(calls).toContainEqual({
      table: "pulse_participations",
      method: "in",
      args: ["survey_id", ["s1", "s2"]],
    });
  });

  it("skips the participation lookup for a workspace without surveys", async () => {
    const { client, calls } = fakeClient({ pulse_surveys: { data: [], error: null } });
    expect(await createSurveyApi(client).listSurveys("w1")).toEqual([]);
    expect(calls.some((call) => call.table === "pulse_participations")).toBe(false);
  });

  it.each([
    [
      "an unknown question key",
      { ...surveyRow, pulse_questions: [{ ...surveyRow.pulse_questions[1], key: "mood" }] },
    ],
    ["an unknown status", { ...surveyRow, status: "draft" }],
    ["missing questions", { ...surveyRow, pulse_questions: null }],
  ])("rejects a survey row with %s", async (_, row) => {
    const { client } = fakeClient({ pulse_surveys: { data: [row], error: null } });
    await expect(createSurveyApi(client).listSurveys("w1")).rejects.toThrow(
      "The server sent an unexpected response"
    );
  });

  it("reads aggregated results", async () => {
    const { client, rpc } = fakeClient(
      {},
      {
        pulse_survey_results: {
          data: [
            {
              survey_id: "s1",
              responses: 3,
              participants: 4,
              visible: true,
              distribution: { q1: [0, 0, 1, 2, 0] },
              comments: ["More pairing"],
            },
          ],
          error: null,
        },
      }
    );
    expect(await createSurveyApi(client).listResults("w1")).toEqual([
      {
        surveyId: "s1",
        responses: 3,
        participants: 4,
        visible: true,
        distribution: { q1: [0, 0, 1, 2, 0] },
        comments: ["More pairing"],
      },
    ]);
    expect(rpc).toHaveBeenCalledWith("pulse_survey_results", { workspace: "w1" });
  });

  it("rejects a distribution without five counts", async () => {
    const { client } = fakeClient(
      {},
      {
        pulse_survey_results: {
          data: [
            {
              survey_id: "s1",
              responses: 1,
              participants: 1,
              visible: true,
              distribution: { q1: [1] },
              comments: [],
            },
          ],
          error: null,
        },
      }
    );
    await expect(createSurveyApi(client).listResults("w1")).rejects.toThrow();
  });

  it("creates a survey with default and custom questions", async () => {
    const { client, rpc } = fakeClient({}, { create_pulse_survey: { data: "s9", error: null } });
    const id = await createSurveyApi(client).createSurvey("w1", {
      title: "Sprint 13",
      questions: [{ key: "health" }, { prompt: "On-call?", lowLabel: "Heavy" }],
      asksComment: false,
      minResponses: 2,
    });
    expect(id).toBe("s9");
    expect(rpc).toHaveBeenCalledWith("create_pulse_survey", {
      workspace: "w1",
      survey_title: "Sprint 13",
      questions: [{ key: "health" }, { prompt: "On-call?", low_label: "Heavy", high_label: null }],
      with_comment: false,
      minimum: 2,
    });
  });

  it("submits, closes and deletes through the database functions", async () => {
    const { client, rpc } = fakeClient({});
    const api = createSurveyApi(client);
    await api.submitResponse("s1", { q1: 4 }, "Good sprint");
    await api.setStatus("s1", "closed");
    await api.deleteSurvey("s1");
    expect(rpc.mock.calls).toEqual([
      ["submit_pulse_response", { survey: "s1", ratings: { q1: 4 }, comment: "Good sprint" }],
      ["set_pulse_survey_status", { survey: "s1", new_status: "closed" }],
      ["delete_pulse_survey", { survey: "s1" }],
    ]);
  });

  it("passes database errors on", async () => {
    const { client } = fakeClient(
      {},
      {
        submit_pulse_response: {
          data: null,
          error: { message: "You already answered this survey" },
        },
      }
    );
    await expect(createSurveyApi(client).submitResponse("s1", {}, "")).rejects.toThrow(
      "You already answered this survey"
    );
  });
});

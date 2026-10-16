import { describe, expect, it } from "vitest";
import type { ImprovementAction } from "../actions";
import {
  closedRetros,
  concerns,
  currentRetro,
  doneSince,
  lastRetro,
  latestHealth,
  normalizeTopic,
  recurringTopics,
  stuckActions,
  type RetroHistory,
} from "../overview";
import type { Retro, RetroBoard, RetroGroup, RetroTopic } from "../retros";
import type { Distribution, Survey, SurveyQuestion, SurveyResult } from "../surveys";

const question = (id: string, key: SurveyQuestion["key"], position: number): SurveyQuestion => ({
  id,
  position,
  key,
  prompt: null,
  lowLabel: null,
  highLabel: null,
});
const survey = (id: string, createdAt: string): Survey => ({
  id,
  title: id,
  asksComment: false,
  minResponses: 3,
  status: "closed",
  createdAt,
  closedAt: createdAt,
  questions: [
    question(`${id}-health`, "health", 1),
    question(`${id}-delivery`, "delivery", 2),
    question(`${id}-workload`, "workload", 3),
  ],
  answered: false,
});
const result = (
  surveyId: string,
  [health, delivery, workload]: [Distribution, Distribution, Distribution],
  visible = true
): SurveyResult => ({
  surveyId,
  responses: 4,
  participants: 4,
  visible,
  distribution: {
    [`${surveyId}-health`]: health,
    [`${surveyId}-delivery`]: delivery,
    [`${surveyId}-workload`]: workload,
  },
  comments: [],
});

const retro = (id: string, heldOn: string, overrides: Partial<Retro> = {}): Retro => ({
  id,
  title: id,
  heldOn,
  period: null,
  goal: null,
  template: "well_improve",
  anonymous: true,
  votesPerPerson: 3,
  stage: "closed",
  createdAt: `${heldOn}T08:00:00Z`,
  closedAt: `${heldOn}T10:00:00Z`,
  ...overrides,
});

const action = (id: string, overrides: Partial<ImprovementAction> = {}): ImprovementAction => ({
  id,
  retroId: null,
  groupId: null,
  title: id,
  description: null,
  ownerId: "ada",
  ownerEmail: "ada@example.com",
  collaborators: [],
  dueOn: null,
  priority: "medium",
  status: "open",
  successCriteria: null,
  outcome: null,
  helped: null,
  followUp: null,
  createdAt: "2026-09-01T10:00:00Z",
  completedAt: null,
  retroTitle: null,
  retroHeldOn: null,
  groupTitle: null,
  canManage: true,
  canUpdate: true,
  ...overrides,
});

describe("team health", () => {
  const surveys = [
    survey("hidden", "2026-10-10T00:00:00Z"),
    survey("latest", "2026-10-01T00:00:00Z"),
    survey("earlier", "2026-09-01T00:00:00Z"),
  ];
  const results = [
    result("earlier", [
      [0, 0, 0, 4, 0],
      [0, 0, 0, 0, 4],
      [0, 0, 4, 0, 0],
    ]),
    result("latest", [
      [0, 0, 0, 4, 0],
      [0, 0, 0, 4, 0],
      [0, 4, 0, 0, 0],
    ]),
    result(
      "hidden",
      [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
      ],
      false
    ),
  ];

  it("reports the latest survey with visible results", () => {
    expect(latestHealth(surveys, results)?.survey.id).toBe("latest");
    expect(latestHealth(surveys, [results[2]!])).toBeNull();
    expect(latestHealth([], [])).toBeNull();
  });

  it("flags questions scoring below 3 or dropping by half a point, lowest first", () => {
    const report = latestHealth(surveys, results)!;
    expect(concerns(report).map((item) => [item.question.key, item.average, item.change])).toEqual([
      ["workload", 2, -1],
      ["delivery", 4, -1],
    ]);
  });
});

describe("current retrospective", () => {
  it("prefers the session under way over the ones being prepared", () => {
    const retros = [
      retro("next", "2026-10-30", { stage: "prepare" }),
      retro("old", "2026-09-01"),
      retro("running", "2026-10-15", { stage: "vote" }),
    ];
    expect(currentRetro(retros)?.id).toBe("running");
  });

  it("falls back to the earliest one being prepared, or nothing", () => {
    const retros = [
      retro("later", "2026-11-30", { stage: "prepare" }),
      retro("sooner", "2026-10-30", { stage: "prepare" }),
    ];
    expect(currentRetro(retros)?.id).toBe("sooner");
    expect(currentRetro([retro("old", "2026-09-01")])).toBeNull();
  });

  it("knows the retrospective held last", () => {
    const retros = [
      retro("a", "2026-09-01"),
      retro("b", "2026-09-15"),
      retro("now", "2026-10-01", { stage: "discuss" }),
    ];
    expect(lastRetro(retros)?.id).toBe("b");
    expect(lastRetro(retros.slice(0, 2))?.id).toBe("b");
    expect(lastRetro([])).toBeNull();
    expect(closedRetros(retros, 1).map((item) => item.id)).toEqual(["b"]);
  });
});

describe("actions over time", () => {
  it("lists actions done since the last retrospective", () => {
    const actions = [
      action("before", { status: "done", completedAt: "2026-09-10T10:00:00Z" }),
      action("same-day", { status: "done", completedAt: "2026-09-15T18:00:00Z" }),
      action("open"),
    ];
    const since = retro("b", "2026-09-15");
    expect(doneSince(actions, since).map((item) => item.id)).toEqual(["same-day"]);
    expect(doneSince(actions, null).map((item) => item.id)).toEqual(["before", "same-day"]);
  });

  it("finds open actions that survived two or more later retrospectives", () => {
    const retros = [
      retro("a", "2026-09-01"),
      retro("b", "2026-09-15"),
      retro("c", "2026-10-01"),
      retro("d", "2026-10-15", { stage: "collect" }),
    ];
    const actions = [
      action("from-a", { retroId: "a", retroHeldOn: "2026-09-01" }),
      action("from-b", { retroId: "b", retroHeldOn: "2026-09-15" }),
      action("loose", { createdAt: "2026-08-20T10:00:00Z" }),
      action("done-from-a", { retroId: "a", retroHeldOn: "2026-09-01", status: "done" }),
      action("blocked-feeling", { retroId: "a", retroHeldOn: "2026-09-01", status: "in_progress" }),
    ];
    expect(stuckActions(actions, retros).map((item) => [item.action.id, item.retros])).toEqual([
      ["loose", 3],
      ["blocked-feeling", 2],
      ["from-a", 2],
    ]);
  });
});

describe("recurring topics", () => {
  const group = (id: string, title: string | null): RetroGroup => ({
    id,
    title,
    createdAt: "2026-09-01T10:00:00Z",
    votes: 0,
    myVotes: 0,
    summary: null,
    impact: null,
    rootCauses: null,
    context: null,
    decision: null,
  });
  const topic = (id: string, groupId: string, title: string): RetroTopic => ({
    id,
    column: "to_improve",
    title,
    description: null,
    groupId,
    createdAt: "2026-09-01T09:00:00Z",
    mine: false,
    author: null,
  });
  const board = (groups: RetroGroup[], topics: RetroTopic[]): RetroBoard => ({
    canFacilitate: false,
    topics,
    hiddenTopics: 0,
    groups,
    voters: 3,
  });

  it("ignores case, accents and punctuation", () => {
    expect(normalizeTopic("  Revisión   de código!! ")).toBe("revision de codigo");
  });

  it("matches group names and topics across retrospectives, most frequent first", () => {
    const a = retro("a", "2026-09-01");
    const b = retro("b", "2026-09-15");
    const c = retro("c", "2026-10-01");
    const history: RetroHistory[] = [
      {
        retro: a,
        board: board(
          [group("g1", "Slow reviews"), group("g2", null)],
          [topic("t1", "g1", "PRs wait"), topic("t2", "g2", "Flaky tests")]
        ),
      },
      {
        retro: b,
        board: board(
          [group("g3", null), group("g4", null)],
          [
            topic("t3", "g3", "slow reviews."),
            topic("t4", "g4", "Flaky tests"),
            topic("t5", "g4", "flaky TESTS"),
          ]
        ),
      },
      {
        retro: c,
        board: board([group("g5", "Slow Reviews")], [topic("t6", "g5", "Deploys on Friday")]),
      },
    ];
    expect(
      recurringTopics(history).map((item) => [item.label, item.retros.map((r) => r.id)])
    ).toEqual([
      ["Slow Reviews", ["c", "b", "a"]],
      ["Flaky tests", ["b", "a"]],
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  ANY,
  DEFAULT_FILTERS,
  NONE,
  countActions,
  filterActions,
  groupActions,
  isOverdue,
  isRecentlyDone,
  localDate,
  previousRetro,
  reviewActions,
  sortActions,
  type ImprovementAction,
} from "../actions";
import type { Retro } from "../retros";

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
  createdAt: `2026-10-01T10:00:00Z`,
  completedAt: null,
  retroTitle: null,
  retroHeldOn: null,
  groupTitle: null,
  canManage: true,
  canUpdate: true,
  ...overrides,
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
  stage: "prepare",
  createdAt: `${heldOn}T08:00:00Z`,
  closedAt: null,
  ...overrides,
});

const NOW = new Date("2026-10-16T12:00:00");
const TODAY = "2026-10-16";

describe("action status", () => {
  it("formats today's date in local time", () => {
    expect(localDate(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });

  it("only flags unresolved actions past their due date as overdue", () => {
    expect(isOverdue(action("a", { dueOn: "2026-10-15" }), TODAY)).toBe(true);
    expect(isOverdue(action("a", { dueOn: TODAY }), TODAY)).toBe(false);
    expect(isOverdue(action("a", { dueOn: "2026-10-15", status: "in_progress" }), TODAY)).toBe(
      true
    );
    expect(isOverdue(action("a", { dueOn: "2026-10-15", status: "done" }), TODAY)).toBe(false);
    expect(isOverdue(action("a", { dueOn: "2026-10-15", status: "cancelled" }), TODAY)).toBe(false);
    expect(isOverdue(action("a"), TODAY)).toBe(false);
  });

  it("counts actions done in the last two weeks as recent", () => {
    const done = (completedAt: string) => action("a", { status: "done", completedAt });
    expect(isRecentlyDone(done("2026-10-03T12:00:00"), NOW)).toBe(true);
    expect(isRecentlyDone(done("2026-10-01T12:00:00"), NOW)).toBe(false);
    expect(isRecentlyDone(action("a", { completedAt: "2026-10-15T12:00:00" }), NOW)).toBe(false);
  });

  it("counts open, in progress, overdue and recently done actions", () => {
    expect(
      countActions(
        [
          action("a"),
          action("b", { dueOn: "2026-10-01" }),
          action("c", { status: "in_progress", dueOn: "2026-10-02" }),
          action("d", { status: "done", completedAt: "2026-10-15T09:00:00" }),
          action("e", { status: "cancelled", dueOn: "2026-10-01" }),
        ],
        NOW
      )
    ).toEqual({ open: 2, inProgress: 1, overdue: 2, doneRecently: 1 });
  });
});

describe("sorting, filtering and grouping", () => {
  it("puts open work first, then by due date, priority and age", () => {
    const sorted = sortActions([
      action("done", { status: "done" }),
      action("undated"),
      action("late-low", { dueOn: "2026-10-20", priority: "low" }),
      action("late-high", { dueOn: "2026-10-20", priority: "high" }),
      action("soon", { dueOn: "2026-10-17" }),
      action("progress", { status: "in_progress" }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual([
      "soon",
      "late-high",
      "late-low",
      "undated",
      "progress",
      "done",
    ]);
  });

  const actions = [
    action("open", { dueOn: "2026-10-10", retroId: "r1" }),
    action("progress", { status: "in_progress", dueOn: "2026-10-20", ownerId: "bob" }),
    action("done", { status: "done", retroId: "r1" }),
    action("unowned", { ownerId: null, ownerEmail: null }),
  ];
  const ids = (list: ImprovementAction[]) => list.map((item) => item.id);

  it("shows unresolved actions by default", () => {
    expect(ids(filterActions(actions, DEFAULT_FILTERS, TODAY))).toEqual([
      "open",
      "progress",
      "unowned",
    ]);
  });

  it("filters by status, owner, retrospective and due date", () => {
    const filter = (overrides: Partial<typeof DEFAULT_FILTERS>) =>
      ids(filterActions(actions, { ...DEFAULT_FILTERS, ...overrides }, TODAY));
    expect(filter({ status: "done" })).toEqual(["done"]);
    expect(filter({ status: "all", owner: "bob" })).toEqual(["progress"]);
    expect(filter({ owner: NONE })).toEqual(["unowned"]);
    expect(filter({ status: "all", retro: "r1" })).toEqual(["open", "done"]);
    expect(filter({ retro: NONE })).toEqual(["progress", "unowned"]);
    expect(filter({ due: "overdue" })).toEqual(["open"]);
    expect(filter({ due: "week" })).toEqual(["progress"]);
    expect(filter({ due: "none" })).toEqual(["unowned"]);
    expect(filter({ status: "all", owner: ANY, retro: ANY })).toHaveLength(4);
  });

  it("groups by status in workflow order", () => {
    expect(groupActions(actions, "status").map((group) => [group.key, ids(group.actions)])).toEqual(
      [
        ["open", ["open", "unowned"]],
        ["in_progress", ["progress"]],
        ["done", ["done"]],
      ]
    );
  });

  it("groups by retrospective, latest first and standalone actions last", () => {
    const groups = groupActions(
      [
        action("old", { retroId: "r1", retroTitle: "Sprint 1", retroHeldOn: "2026-09-01" }),
        action("loose"),
        action("new", { retroId: "r2", retroTitle: "Sprint 2", retroHeldOn: "2026-10-01" }),
      ],
      "retro"
    );
    expect(groups.map((group) => [group.key, group.label])).toEqual([
      ["r2", "Sprint 2"],
      ["r1", "Sprint 1"],
      [NONE, null],
    ]);
  });

  it("groups by owner email with unowned actions last", () => {
    const groups = groupActions(
      [
        action("z", { ownerId: "zoe", ownerEmail: "zoe@example.com" }),
        action("n", { ownerId: null, ownerEmail: null }),
        action("a"),
      ],
      "owner"
    );
    expect(groups.map((group) => group.label)).toEqual([
      "ada@example.com",
      "zoe@example.com",
      null,
    ]);
  });
});

describe("reviewing actions in a retrospective", () => {
  const retros = [
    retro("r1", "2026-09-01", { stage: "closed", closedAt: "2026-09-01T10:00:00Z" }),
    retro("r2", "2026-10-01", { stage: "closed", closedAt: "2026-10-01T10:00:00Z" }),
    retro("r3", "2026-10-15"),
  ];

  it("finds the retrospective held just before", () => {
    expect(previousRetro(retros[2]!, retros)?.id).toBe("r2");
    expect(previousRetro(retros[0]!, retros)).toBeNull();
    const sameDay = retro("r4", "2026-10-15", { createdAt: "2026-10-15T09:00:00Z" });
    expect(previousRetro(sameDay, [...retros, sameDay])?.id).toBe("r3");
  });

  it("carries unresolved actions over and lists what finished since the last retro", () => {
    const from = (id: string, heldOn: string) => ({ retroId: id, retroHeldOn: heldOn });
    const review = reviewActions(
      [
        action("still-open", from("r1", "2026-09-01")),
        action("in-progress", { ...from("r2", "2026-10-01"), status: "in_progress" }),
        action("done-before", {
          ...from("r1", "2026-09-01"),
          status: "done",
          completedAt: "2026-09-20T10:00:00Z",
        }),
        action("done-since", {
          ...from("r2", "2026-10-01"),
          status: "done",
          completedAt: "2026-10-05T10:00:00Z",
        }),
        action("cancelled", { ...from("r2", "2026-10-01"), status: "cancelled" }),
        action("agreed-here", from("r3", "2026-10-15")),
        action("standalone"),
      ],
      retros[2]!,
      retros
    );
    expect(review.outstanding.map((item) => item.id)).toEqual([
      "standalone",
      "still-open",
      "in-progress",
    ]);
    expect(review.completed.map((item) => item.id)).toEqual(["done-since"]);
    expect(review.agreed.map((item) => item.id)).toEqual(["agreed-here"]);
  });

  it("does not show later actions in an earlier retrospective", () => {
    const review = reviewActions(
      [
        action("later-retro", { retroId: "r3", retroHeldOn: "2026-10-15" }),
        action("later-standalone", { createdAt: "2026-10-02T10:00:00Z" }),
        action("earlier-standalone", { createdAt: "2026-09-20T10:00:00Z" }),
      ],
      retros[1]!,
      retros
    );
    expect(review.outstanding.map((item) => item.id)).toEqual(["earlier-standalone"]);
  });
});

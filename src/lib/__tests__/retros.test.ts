import { describe, expect, it } from "vitest";
import {
  TEMPLATE_COLUMNS,
  groupLabel,
  hasDiscussion,
  looseTopics,
  nextStage,
  previousStage,
  rankGroups,
  summarizeRetro,
  votesLeft,
  type RetroBoard,
  type RetroGroup,
  type RetroTopic,
} from "../retros";

const group = (id: string, overrides: Partial<RetroGroup> = {}): RetroGroup => ({
  id,
  title: null,
  createdAt: `2026-10-01T10:00:0${id.slice(-1)}Z`,
  votes: null,
  myVotes: 0,
  summary: null,
  impact: null,
  rootCauses: null,
  context: null,
  decision: null,
  ...overrides,
});
const topic = (id: string, groupId: string | null, title = id): RetroTopic => ({
  id,
  column: "went_well",
  title,
  description: null,
  groupId,
  createdAt: "2026-10-01T09:00:00Z",
  mine: false,
  author: null,
});
const board = (groups: RetroGroup[], topics: RetroTopic[]): RetroBoard => ({
  canFacilitate: true,
  topics,
  hiddenTopics: 0,
  groups,
  voters: 2,
});

describe("retrospective stages", () => {
  it("moves one stage at a time and stops at both ends", () => {
    expect(nextStage("prepare")).toBe("collect");
    expect(nextStage("discuss")).toBe("actions");
    expect(nextStage("actions")).toBe("closed");
    expect(previousStage("closed")).toBe("actions");
    expect(nextStage("closed")).toBeNull();
    expect(previousStage("collect")).toBe("prepare");
    expect(previousStage("prepare")).toBeNull();
  });

  it("gives every template its own columns", () => {
    expect(TEMPLATE_COLUMNS.start_stop_continue).toEqual(["start", "stop", "continue"]);
    expect(TEMPLATE_COLUMNS.open).toEqual(["topics"]);
  });
});

describe("rankGroups", () => {
  it("orders by votes, then by topic count, then oldest first", () => {
    const ranked = rankGroups(
      board(
        [
          group("g1", { votes: 2 }),
          group("g2", { votes: 5 }),
          group("g3", { votes: 2 }),
          group("g4", { votes: 2 }),
        ],
        [topic("t1", "g3"), topic("t2", "g3"), topic("t3", "g1"), topic("t4", "g4")]
      )
    );
    expect(ranked.map((item) => item.group.id)).toEqual(["g2", "g3", "g1", "g4"]);
    expect(ranked[1]!.topics.map((item) => item.id)).toEqual(["t1", "t2"]);
  });

  it("treats hidden totals as zero", () => {
    const ranked = rankGroups(board([group("g1"), group("g2")], [topic("t1", "g2")]));
    expect(ranked.map((item) => item.group.id)).toEqual(["g2", "g1"]);
  });
});

describe("board helpers", () => {
  it("counts the votes I still have", () => {
    expect(
      votesLeft(board([group("g1", { myVotes: 2 }), group("g2", { myVotes: 1 })], []), 5)
    ).toBe(2);
  });

  it("finds topics outside any group", () => {
    expect(looseTopics(board([], [topic("t1", null), topic("t2", "g1")])).map((t) => t.id)).toEqual(
      ["t1"]
    );
  });

  it("labels untitled single-topic groups with their topic", () => {
    expect(groupLabel(group("g1", { title: "Focus" }), [])).toBe("Focus");
    expect(groupLabel(group("g1"), [topic("t1", "g1", "Slow CI")])).toBe("Slow CI");
    expect(groupLabel(group("g1"), [topic("t1", "g1"), topic("t2", "g1")])).toBeNull();
  });

  it("knows when a group was discussed", () => {
    expect(hasDiscussion(group("g1"))).toBe(false);
    expect(hasDiscussion(group("g1", { decision: "monitor" }))).toBe(true);
  });
});

describe("summarizeRetro", () => {
  it("keeps the three most voted groups and every discussed one", () => {
    const summary = summarizeRetro(
      board(
        [
          group("g1", { votes: 1, summary: "Talked" }),
          group("g2", { votes: 4 }),
          group("g3", { votes: 3, decision: "action" }),
          group("g4", { votes: 2 }),
          group("g5", { votes: 0, impact: "Low" }),
        ],
        [topic("t1", "g1"), topic("t2", "g2")]
      )
    );
    expect(summary.topics).toBe(2);
    expect(summary.voters).toBe(2);
    expect(summary.top.map((item) => item.group.id)).toEqual(["g2", "g3", "g4"]);
    expect(summary.discussed.map((item) => item.group.id)).toEqual(["g3", "g1", "g5"]);
  });
});

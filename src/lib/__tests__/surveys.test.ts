import { describe, expect, it } from "vitest";
import {
  averageRating,
  buildSurveyReport,
  isComplete,
  questionIdentity,
  type Distribution,
  type Survey,
  type SurveyQuestion,
  type SurveyResult,
} from "../surveys";

const question = (id: string, key: SurveyQuestion["key"], position = 1): SurveyQuestion => ({
  id,
  position,
  key,
  prompt: null,
  lowLabel: null,
  highLabel: null,
});
const custom = (id: string, prompt: string, position = 1): SurveyQuestion => ({
  ...question(id, null, position),
  prompt,
});
const survey = (id: string, createdAt: string, questions: SurveyQuestion[]): Survey => ({
  id,
  title: id,
  asksComment: true,
  minResponses: 3,
  status: "closed",
  createdAt,
  closedAt: createdAt,
  questions,
  answered: false,
});
const result = (
  surveyId: string,
  distribution: Record<string, Distribution>,
  overrides: Partial<SurveyResult> = {}
): SurveyResult => ({
  surveyId,
  responses: 4,
  participants: 5,
  visible: true,
  distribution,
  comments: [],
  ...overrides,
});

describe("averageRating", () => {
  it.each<[Distribution, number | null]>([
    [[0, 0, 0, 0, 0], null],
    [[1, 0, 0, 0, 0], 1],
    [[0, 0, 0, 0, 2], 5],
    [[1, 0, 0, 0, 1], 3],
    [[0, 1, 2, 1, 0], 3],
    [[0, 0, 1, 3, 0], 3.75],
  ])("averages %j as %s", (distribution, expected) => {
    expect(averageRating(distribution)).toBe(expected);
  });
});

describe("questionIdentity", () => {
  it.each([
    [{ key: "workload" as const, prompt: null }, "workload"],
    [{ key: null, prompt: "  On-call load? " }, "custom:on-call load?"],
    [{ key: null, prompt: "ON-CALL LOAD?" }, "custom:on-call load?"],
  ])("identifies %j as %s", (input, expected) => {
    expect(questionIdentity(input)).toBe(expected);
  });
});

describe("isComplete", () => {
  const questions = [question("a", "health"), question("b", "workload", 2)];
  it.each<[Record<string, number>, boolean]>([
    [{}, false],
    [{ a: 3 }, false],
    [{ a: 3, b: 0 }, false],
    [{ a: 3, b: 6 }, false],
    [{ a: 1, b: 5 }, true],
  ])("treats %j as complete: %s", (ratings, expected) => {
    expect(isComplete(questions, ratings)).toBe(expected);
  });
});

describe("buildSurveyReport", () => {
  it("returns null for an unknown survey", () => {
    expect(buildSurveyReport([], [], "missing")).toBeNull();
  });

  it("averages each question, compares with the previous survey and names the extremes", () => {
    const first = survey("s1", "2026-01-01", [
      question("a1", "health"),
      question("b1", "workload", 2),
    ]);
    const second = survey("s2", "2026-02-01", [
      question("a2", "health"),
      question("b2", "workload", 2),
    ]);
    const report = buildSurveyReport(
      [second, first],
      [
        result("s1", { a1: [0, 0, 2, 0, 0], b1: [0, 0, 0, 2, 0] }),
        result("s2", { a2: [0, 0, 0, 2, 2], b2: [0, 2, 2, 0, 0] }),
      ],
      "s2"
    )!;
    expect(report.questions.map((item) => [item.question.key, item.average, item.change])).toEqual([
      ["health", 4.5, 1.5],
      ["workload", 2.5, -1.5],
    ]);
    expect(report.questions[0]!.trend).toEqual([3, 4.5]);
    expect(report.strongest?.question.key).toBe("health");
    expect(report.weakest?.question.key).toBe("workload");
    expect(report.responseRate).toBe(0.8);
  });

  it("matches custom questions by their wording across surveys", () => {
    const first = survey("s1", "2026-01-01", [custom("c1", "On-call load?")]);
    const second = survey("s2", "2026-02-01", [custom("c2", "on-call load?")]);
    const report = buildSurveyReport(
      [first, second],
      [result("s1", { c1: [0, 2, 0, 0, 0] }), result("s2", { c2: [0, 0, 0, 2, 0] })],
      "s2"
    )!;
    expect(report.questions[0]!.change).toBe(2);
  });

  it("hides ratings until the survey is closed with enough responses", () => {
    const open = {
      ...survey("s1", "2026-01-01", [question("a1", "health")]),
      status: "open" as const,
    };
    const report = buildSurveyReport(
      [open],
      [result("s1", {}, { visible: false, responses: 2 })],
      "s1"
    )!;
    expect(report.questions[0]).toMatchObject({
      average: null,
      answers: 0,
      change: null,
      trend: [],
    });
    expect(report.strongest).toBeNull();
    expect(report.responseRate).toBe(0.4);
  });

  it("skips hidden surveys when comparing with the previous one", () => {
    const surveys = ["s1", "s2", "s3"].map((id, index) =>
      survey(id, `2026-0${index + 1}-01`, [question(`${id}a`, "health")])
    );
    const report = buildSurveyReport(
      surveys,
      [
        result("s1", { s1a: [0, 2, 0, 0, 0] }),
        result("s2", {}, { visible: false }),
        result("s3", { s3a: [0, 0, 0, 2, 0] }),
      ],
      "s3"
    )!;
    expect(report.questions[0]).toMatchObject({ change: 2, trend: [2, 4] });
  });

  it("keeps the trend to the last five surveys with results", () => {
    const surveys = Array.from({ length: 7 }, (_, index) =>
      survey(`s${index}`, `2026-01-0${index + 1}`, [question(`q${index}`, "health")])
    );
    const results = surveys.map((item, index) => {
      const distribution: Distribution = [0, 0, 0, 0, 0];
      distribution[index % 5] = 1;
      return result(item.id, { [`q${index}`]: distribution });
    });
    expect(buildSurveyReport(surveys, results, "s6")!.questions[0]!.trend).toEqual([3, 4, 5, 1, 2]);
  });

  it.each<[string, Distribution, Distribution]>([
    ["no extremes when every question averages the same", [0, 0, 2, 0, 0], [0, 0, 2, 0, 0]],
    ["no extremes without ratings", [0, 0, 0, 0, 0], [0, 0, 0, 0, 0]],
  ])("%s", (_, a, b) => {
    const only = survey("s1", "2026-01-01", [
      question("a", "health"),
      question("b", "autonomy", 2),
    ]);
    const report = buildSurveyReport([only], [result("s1", { a, b })], "s1")!;
    expect([report.strongest, report.weakest]).toEqual([null, null]);
  });

  it("caps the response rate at everyone and leaves it empty without participants", () => {
    const only = survey("s1", "2026-01-01", [question("a", "health")]);
    expect(
      buildSurveyReport([only], [result("s1", {}, { responses: 6, participants: 5 })], "s1")!
        .responseRate
    ).toBe(1);
    expect(
      buildSurveyReport([only], [result("s1", {}, { participants: 0 })], "s1")!.responseRate
    ).toBeNull();
  });
});

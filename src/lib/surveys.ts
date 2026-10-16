/** The six questions every new survey starts with; their wording lives in the locales. */
export const DEFAULT_QUESTION_KEYS = [
  "health",
  "delivery",
  "autonomy",
  "clarity",
  "workload",
  "collaboration",
] as const;
export type QuestionKey = (typeof DEFAULT_QUESTION_KEYS)[number];

export const RATINGS = [1, 2, 3, 4, 5] as const;
export const TREND_LENGTH = 5;

export interface SurveyQuestion {
  id: string;
  position: number;
  key: QuestionKey | null;
  prompt: string | null;
  lowLabel: string | null;
  highLabel: string | null;
}

export interface Survey {
  id: string;
  title: string;
  asksComment: boolean;
  minResponses: number;
  status: "open" | "closed";
  createdAt: string;
  closedAt: string | null;
  questions: SurveyQuestion[];
  /** Whether the signed-in account already answered; nothing says what it answered. */
  answered: boolean;
}

/** Counts of 1 to 5 ratings, index 0 holding the ones. */
export type Distribution = [number, number, number, number, number];

export interface SurveyResult {
  surveyId: string;
  responses: number;
  participants: number;
  /** Ratings and comments are only shared once closed with enough responses. */
  visible: boolean;
  distribution: Record<string, Distribution>;
  comments: string[];
}

export type QuestionDraft =
  { key: QuestionKey } | { prompt: string; lowLabel?: string; highLabel?: string };

export interface QuestionSummary {
  question: SurveyQuestion;
  distribution: Distribution;
  answers: number;
  average: number | null;
  /** Difference with the same question in the previous survey that has results. */
  change: number | null;
  /** Averages of this question in up to the last five surveys with results, oldest first. */
  trend: number[];
}

export interface SurveyReport {
  survey: Survey;
  result: SurveyResult | null;
  responseRate: number | null;
  questions: QuestionSummary[];
  strongest: QuestionSummary | null;
  weakest: QuestionSummary | null;
}

const EMPTY: Distribution = [0, 0, 0, 0, 0];

export function averageRating(distribution: Distribution): number | null {
  let total = 0;
  let sum = 0;
  distribution.forEach((count, index) => {
    total += count;
    sum += count * (index + 1);
  });
  return total === 0 ? null : sum / total;
}

/** Matches a question across surveys: default ones by key, custom ones by their wording. */
export function questionIdentity(question: Pick<SurveyQuestion, "key" | "prompt">): string {
  return question.key ?? `custom:${(question.prompt ?? "").trim().toLowerCase()}`;
}

/** True when every question has a rating from 1 to 5. */
export function isComplete(questions: SurveyQuestion[], ratings: Record<string, number>): boolean {
  return questions.every((question) =>
    (RATINGS as readonly number[]).includes(ratings[question.id] ?? 0)
  );
}

function byCreation(a: Survey, b: Survey) {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function averagesByIdentity(survey: Survey, result: SurveyResult) {
  const averages = new Map<string, number>();
  for (const question of survey.questions) {
    const average = averageRating(result.distribution[question.id] ?? EMPTY);
    if (average !== null) averages.set(questionIdentity(question), average);
  }
  return averages;
}

/**
 * Summarises one survey against the earlier surveys of the same workspace. Only surveys whose
 * results are visible count as history, so a survey below its response threshold never shows up.
 */
export function buildSurveyReport(
  surveys: Survey[],
  results: SurveyResult[],
  surveyId: string
): SurveyReport | null {
  const survey = surveys.find((item) => item.id === surveyId);
  if (!survey) return null;
  const resultsById = new Map(results.map((result) => [result.surveyId, result]));
  const result = resultsById.get(survey.id) ?? null;
  const visible = result?.visible ?? false;
  const earlier = surveys
    .filter((item) => byCreation(item, survey) < 0 && resultsById.get(item.id)?.visible)
    .toSorted(byCreation)
    .map((item) => averagesByIdentity(item, resultsById.get(item.id)!));
  const own = visible ? averagesByIdentity(survey, result!) : null;
  const window = (own ? [...earlier, own] : []).slice(-TREND_LENGTH);

  const questions = survey.questions
    .toSorted((a, b) => a.position - b.position)
    .map((question): QuestionSummary => {
      const distribution = (visible && result!.distribution[question.id]) || EMPTY;
      const average = averageRating(distribution);
      const identity = questionIdentity(question);
      const before = earlier.findLast((averages) => averages.has(identity))?.get(identity);
      return {
        question,
        distribution,
        answers: distribution.reduce((sum, count) => sum + count, 0),
        average,
        change: average !== null && before !== undefined ? average - before : null,
        trend: window.flatMap((averages) => {
          const value = averages.get(identity);
          return value === undefined ? [] : [value];
        }),
      };
    });

  let strongest: QuestionSummary | null = null;
  let weakest: QuestionSummary | null = null;
  for (const item of questions) {
    if (item.average === null) continue;
    if (!strongest || item.average > strongest.average!) strongest = item;
    if (!weakest || item.average < weakest.average!) weakest = item;
  }
  const distinct = !!strongest && !!weakest && strongest.average !== weakest.average;

  return {
    survey,
    result,
    responseRate:
      result && result.participants > 0
        ? Math.min(1, result.responses / result.participants)
        : null,
    questions,
    strongest: distinct ? strongest : null,
    weakest: distinct ? weakest : null,
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import i18n from "@/i18n";
import {
  DEFAULT_QUESTION_KEYS,
  type Distribution,
  type QuestionDraft,
  type QuestionKey,
  type Survey,
  type SurveyQuestion,
  type SurveyResult,
} from "@/lib/surveys";

const SURVEY_COLUMNS =
  "id,title,asks_comment,min_responses,status,created_at,closed_at," +
  "pulse_questions(id,position,key,prompt,low_label,high_label)";

type Row = { [field: string]: unknown };
type Fields<K extends string> = { [P in K]?: unknown };

function unexpected(): never {
  throw new Error(i18n.t("errors.unexpectedResponse"));
}
const isRow = <K extends string = never>(value: unknown): value is Fields<K> & Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value : unexpected());
const optionalText = (value: unknown) => (value === null ? null : text(value));

function parseQuestion(row: unknown): SurveyQuestion {
  if (!isRow<"id" | "position" | "key" | "prompt" | "low_label" | "high_label">(row)) unexpected();
  if (typeof row.position !== "number") unexpected();
  const key = optionalText(row.key);
  if (key !== null && !(DEFAULT_QUESTION_KEYS as readonly string[]).includes(key)) unexpected();
  return {
    id: text(row.id),
    position: row.position,
    key: key as QuestionKey | null,
    prompt: optionalText(row.prompt),
    lowLabel: optionalText(row.low_label),
    highLabel: optionalText(row.high_label),
  };
}

function parseSurvey(row: unknown, answered: Set<string>): Survey {
  if (
    !isRow<
      | "id"
      | "title"
      | "asks_comment"
      | "min_responses"
      | "status"
      | "created_at"
      | "closed_at"
      | "pulse_questions"
    >(row) ||
    typeof row.asks_comment !== "boolean" ||
    typeof row.min_responses !== "number" ||
    (row.status !== "open" && row.status !== "closed") ||
    !Array.isArray(row.pulse_questions)
  )
    unexpected();
  const id = text(row.id);
  return {
    id,
    title: text(row.title),
    asksComment: row.asks_comment,
    minResponses: row.min_responses,
    status: row.status,
    createdAt: text(row.created_at),
    closedAt: optionalText(row.closed_at),
    questions: row.pulse_questions.map(parseQuestion).sort((a, b) => a.position - b.position),
    answered: answered.has(id),
  };
}

function parseDistribution(value: unknown): Distribution {
  if (
    !Array.isArray(value) ||
    value.length !== 5 ||
    value.some((count) => typeof count !== "number")
  )
    unexpected();
  return value as Distribution;
}

function parseResult(row: unknown): SurveyResult {
  if (
    !isRow<"survey_id" | "responses" | "participants" | "visible" | "distribution" | "comments">(
      row
    ) ||
    typeof row.responses !== "number" ||
    typeof row.participants !== "number" ||
    typeof row.visible !== "boolean" ||
    !isRow(row.distribution) ||
    !Array.isArray(row.comments)
  )
    unexpected();
  return {
    surveyId: text(row.survey_id),
    responses: row.responses,
    participants: row.participants,
    visible: row.visible,
    distribution: Object.fromEntries(
      Object.entries(row.distribution).map(([id, counts]) => [id, parseDistribution(counts)])
    ),
    comments: row.comments.map(text),
  };
}

export interface NewSurvey {
  title: string;
  questions: QuestionDraft[];
  asksComment: boolean;
  minResponses: number;
}

/** Team Pulse surveys of a workspace. Answers only ever come back aggregated. */
export function createSurveyApi(client: SupabaseClient) {
  async function check<T>(request: PromiseLike<{ data: T; error: { message: string } | null }>) {
    const { data, error } = await request;
    if (error) throw new Error(error.message);
    return data;
  }
  return {
    async listSurveys(workspace: string): Promise<Survey[]> {
      const rows = await check(
        client
          .from("pulse_surveys")
          .select(SURVEY_COLUMNS)
          .eq("workspace_id", workspace)
          .order("created_at", { ascending: false })
      );
      if (!Array.isArray(rows)) unexpected();
      const ids = rows.map((row: unknown) => (isRow<"id">(row) ? text(row.id) : unexpected()));
      const answered = ids.length
        ? await check(client.from("pulse_participations").select("survey_id").in("survey_id", ids))
        : [];
      if (!Array.isArray(answered)) unexpected();
      const answeredIds = new Set(
        answered.map((row: unknown) =>
          isRow<"survey_id">(row) ? text(row.survey_id) : unexpected()
        )
      );
      return rows.map((row: unknown) => parseSurvey(row, answeredIds));
    },
    async listResults(workspace: string): Promise<SurveyResult[]> {
      const rows = await check(client.rpc("pulse_survey_results", { workspace }));
      return Array.isArray(rows) ? rows.map(parseResult) : unexpected();
    },
    async createSurvey(workspace: string, survey: NewSurvey): Promise<string> {
      const id = await check(
        client.rpc("create_pulse_survey", {
          workspace,
          survey_title: survey.title,
          questions: survey.questions.map((question) =>
            "key" in question
              ? { key: question.key }
              : {
                  prompt: question.prompt,
                  low_label: question.lowLabel ?? null,
                  high_label: question.highLabel ?? null,
                }
          ),
          with_comment: survey.asksComment,
          minimum: survey.minResponses,
        })
      );
      return text(id);
    },
    async submitResponse(survey: string, ratings: Record<string, number>, comment: string) {
      await check(client.rpc("submit_pulse_response", { survey, ratings, comment }));
    },
    async setStatus(survey: string, status: Survey["status"]) {
      await check(client.rpc("set_pulse_survey_status", { survey, new_status: status }));
    },
    async deleteSurvey(survey: string) {
      await check(client.rpc("delete_pulse_survey", { survey }));
    },
  };
}

export type SurveyApi = ReturnType<typeof createSurveyApi>;

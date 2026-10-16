import { isUnresolved, previousRetro, sortActions, type ImprovementAction } from "./actions";
import { groupLabel, topicsOf, type Retro, type RetroBoard } from "./retros";
import {
  buildSurveyReport,
  type QuestionSummary,
  type Survey,
  type SurveyReport,
  type SurveyResult,
} from "./surveys";

/** Averages below this ask for a conversation. */
export const CONCERN_AVERAGE = 3;
/** A drop of at least this much since the previous survey asks for a conversation too. */
export const CONCERN_DROP = 0.5;
/** How many closed retrospectives the overview looks back on. */
export const HISTORY_LENGTH = 6;
/** An action still open after this many later retrospectives keeps remaining open. */
export const STUCK_AFTER = 2;

function byHeldOn(a: Retro, b: Retro) {
  return a.heldOn.localeCompare(b.heldOn) || a.createdAt.localeCompare(b.createdAt);
}

/** The report of the latest survey whose results are visible. */
export function latestHealth(surveys: Survey[], results: SurveyResult[]): SurveyReport | null {
  const visible = new Set(results.filter((result) => result.visible).map((r) => r.surveyId));
  const latest = surveys
    .filter((survey) => visible.has(survey.id))
    .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
  return latest ? buildSurveyReport(surveys, results, latest.id) : null;
}

/** Questions scoring low or dropping, lowest first. */
export function concerns(report: SurveyReport): QuestionSummary[] {
  return report.questions
    .filter(
      (item) =>
        item.average !== null &&
        (item.average < CONCERN_AVERAGE || (item.change !== null && item.change <= -CONCERN_DROP))
    )
    .toSorted((a, b) => a.average! - b.average! || a.question.position - b.question.position);
}

/** The retrospective under way, or else the next one being prepared. */
export function currentRetro(retros: Retro[]): Retro | null {
  const open = retros.filter((retro) => retro.stage !== "closed");
  const running = open
    .filter((retro) => retro.stage !== "prepare")
    .toSorted(byHeldOn)
    .at(-1);
  return running ?? open.toSorted(byHeldOn)[0] ?? null;
}

/** Closed retrospectives, latest first, at most `limit`. */
export function closedRetros(retros: Retro[], limit = HISTORY_LENGTH): Retro[] {
  return retros
    .filter((retro) => retro.stage === "closed")
    .toSorted(byHeldOn)
    .reverse()
    .slice(0, limit);
}

/** The retrospective the team last held: the one before the current, or the latest closed. */
export function lastRetro(retros: Retro[]): Retro | null {
  const current = currentRetro(retros);
  return current ? previousRetro(current, retros) : (closedRetros(retros, 1)[0] ?? null);
}

/** Actions finished on or after the day of `since`, or every finished one without it. */
export function doneSince(actions: ImprovementAction[], since: Retro | null): ImprovementAction[] {
  return sortActions(
    actions.filter(
      (action) =>
        action.status === "done" &&
        action.completedAt !== null &&
        (since === null || action.completedAt.slice(0, 10) >= since.heldOn)
    )
  );
}

export interface StuckAction {
  action: ImprovementAction;
  /** Closed retrospectives held after the action was agreed while it stayed open. */
  retros: number;
}

/** Open actions that survived at least `STUCK_AFTER` later retrospectives, longest first. */
export function stuckActions(actions: ImprovementAction[], retros: Retro[]): StuckAction[] {
  const closed = retros.filter((retro) => retro.stage === "closed");
  return actions
    .filter(isUnresolved)
    .map((action) => {
      const since = action.retroHeldOn ?? action.createdAt.slice(0, 10);
      return {
        action,
        retros: closed.filter((retro) => retro.id !== action.retroId && retro.heldOn > since)
          .length,
      };
    })
    .filter((item) => item.retros >= STUCK_AFTER)
    .toSorted(
      (a, b) =>
        b.retros - a.retros ||
        a.action.createdAt.localeCompare(b.action.createdAt) ||
        a.action.id.localeCompare(b.action.id)
    );
}

/** Lowercase without accents, punctuation or repeated spaces, so wording variants match. */
export function normalizeTopic(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export interface RetroHistory {
  retro: Retro;
  board: RetroBoard;
}

export interface RecurringTopic {
  /** The wording used the last time it came up. */
  label: string;
  /** Retrospectives where it came up, latest first. */
  retros: Retro[];
}

/** Topics and group names that came up in more than one retrospective, most frequent first. */
export function recurringTopics(history: RetroHistory[]): RecurringTopic[] {
  const found = new Map<string, { label: string; retros: Retro[] }>();
  for (const { retro, board } of history.toSorted((a, b) => byHeldOn(b.retro, a.retro))) {
    const labels = [
      ...board.groups.map((group) => groupLabel(group, topicsOf(board, group.id))),
      ...board.topics.map((topic) => topic.title),
    ];
    const seen = new Set<string>();
    for (const label of labels) {
      const key = label ? normalizeTopic(label) : "";
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = found.get(key);
      if (entry) entry.retros.push(retro);
      else found.set(key, { label: label!.trim(), retros: [retro] });
    }
  }
  return [...found.values()]
    .filter((entry) => entry.retros.length > 1)
    .toSorted(
      (a, b) =>
        b.retros.length - a.retros.length ||
        byHeldOn(b.retros[0]!, a.retros[0]!) ||
        a.label.localeCompare(b.label)
    );
}

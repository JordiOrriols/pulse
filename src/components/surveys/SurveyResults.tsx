import React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@jordiorriols/ui";
import { Lock } from "@jordiorriols/ui/icons";
import type { QuestionSummary, SurveyReport } from "@/lib/surveys";
import { RATING_TONES, formatChange, formatScore, questionText } from "./scale";

const TREND_WIDTH = 56;
const TREND_HEIGHT = 18;

export function Trend({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return <span className="w-14" aria-hidden />;
  const step = TREND_WIDTH / (values.length - 1);
  const coordinates = values.map((value, index) => ({
    x: Math.round(index * step),
    y: Math.round((TREND_HEIGHT - ((value - 1) / 4) * TREND_HEIGHT) * 10) / 10,
  }));
  const last = coordinates[coordinates.length - 1]!;
  return (
    <svg
      role="img"
      aria-label={label}
      width={TREND_WIDTH}
      height={TREND_HEIGHT}
      viewBox={`-2 -2 ${TREND_WIDTH + 4} ${TREND_HEIGHT + 4}`}
      className="shrink-0 overflow-visible text-sky-600 dark:text-sky-400"
    >
      <polyline
        points={coordinates.map(({ x, y }) => `${x},${y}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last.x} cy={last.y} r={2.5} fill="currentColor" />
    </svg>
  );
}

function QuestionRow({ summary }: { summary: QuestionSummary }) {
  const { t, i18n } = useTranslation();
  const text = questionText(t, summary.question);
  const { distribution, answers, average, change, trend } = summary;
  return (
    <li className="grid gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
      <p className="text-sm">{text}</p>
      <div className="flex items-center gap-3 sm:row-span-2 sm:justify-end">
        <Trend
          values={trend}
          label={t("surveys.results.trend", { points: trend.length, question: text })}
        />
        <span
          className={cn(
            "w-10 text-right text-xs tabular-nums",
            change === null || change === 0
              ? "text-muted-foreground"
              : change > 0
                ? "text-emerald-600"
                : "text-rose-600"
          )}
          title={t("surveys.results.changeHint")}
        >
          {change === null ? "" : formatChange(i18n.language, change)}
        </span>
        <span className="w-9 text-right text-lg font-semibold tabular-nums">
          {average === null ? "–" : formatScore(i18n.language, average)}
        </span>
      </div>
      <div
        className="flex h-2 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={t("surveys.results.distribution", {
          question: text,
          counts: distribution.join(" / "),
        })}
      >
        {answers > 0 &&
          distribution.map((count, index) =>
            count > 0 ? (
              <span
                key={index}
                className={RATING_TONES[index]}
                style={{ width: `${(count / answers) * 100}%` }}
              />
            ) : null
          )}
      </div>
    </li>
  );
}

export function SurveyResults({ report }: { report: SurveyReport }) {
  const { t, i18n } = useTranslation();
  const { survey, result, responseRate, questions, strongest, weakest } = report;
  const responses = result?.responses ?? 0;

  if (!result?.visible) {
    return (
      <div className="flex items-start gap-3 rounded-lg bg-muted px-4 py-3 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p>
          {survey.status === "open"
            ? t("surveys.results.hiddenWhileOpen")
            : t("surveys.results.belowThreshold", {
                minimum: survey.minResponses,
                responses,
              })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">{t("surveys.results.responses")}</dt>
          <dd className="text-lg font-semibold tabular-nums">{responses}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("surveys.results.rate")}</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {responseRate === null
              ? "–"
              : new Intl.NumberFormat(i18n.language, { style: "percent" }).format(responseRate)}
          </dd>
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">{t("surveys.results.strongest")}</dt>
            <dd
              className="truncate text-sm font-medium"
              title={strongest ? questionText(t, strongest.question) : undefined}
            >
              {strongest ? questionText(t, strongest.question) : "–"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("surveys.results.weakest")}</dt>
            <dd
              className="truncate text-sm font-medium"
              title={weakest ? questionText(t, weakest.question) : undefined}
            >
              {weakest ? questionText(t, weakest.question) : "–"}
            </dd>
          </div>
        </div>
      </dl>

      <ul className="divide-y divide-border">
        {questions.map((summary) => (
          <QuestionRow key={summary.question.id} summary={summary} />
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {RATING_TONES.map((tone, index) => (
          <span key={tone} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", tone)} />
            {index + 1}
          </span>
        ))}
      </div>

      {survey.asksComment && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("surveys.results.comments")}</h3>
          {result.comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("surveys.results.noComments")}</p>
          ) : (
            <ul className="space-y-2">
              {result.comments.map((comment, index) => (
                <li
                  key={index}
                  className="rounded-md border-l-2 border-primary/40 bg-muted/60 px-3 py-2 text-sm whitespace-pre-line"
                >
                  {comment}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

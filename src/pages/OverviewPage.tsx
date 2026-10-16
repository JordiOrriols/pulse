import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button, Spinner, StatusBadge, cn } from "@jordiorriols/ui";
import { ArrowRight } from "@jordiorriols/ui/icons";
import { useData } from "@/data/DataProvider";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useActions } from "@/hooks/useActions";
import { useDateFormat } from "@/hooks/useDateFormat";
import { useRetroHistory, useRetros } from "@/hooks/useRetros";
import { useSurveys } from "@/hooks/useSurveys";
import {
  isOverdue,
  isUnresolved,
  localDate,
  sortActions,
  type ImprovementAction,
} from "@/lib/actions";
import {
  CONCERN_DROP,
  concerns,
  currentRetro,
  doneSince,
  lastRetro,
  latestHealth,
  recurringTopics,
  stuckActions,
  type RetroHistory,
} from "@/lib/overview";
import { RETRO_STAGES, stageIndex, summarizeRetro, type Retro } from "@/lib/retros";
import type { Survey, SurveyReport } from "@/lib/surveys";
import { Trend } from "@/components/surveys/SurveyResults";
import { formatChange, formatScore, questionText } from "@/components/surveys/scale";
import { useGroupName } from "@/components/retros/GroupBoard";

const LIST_LENGTH = 3;

function Panel({
  id,
  title,
  link,
  className,
  children,
}: {
  id: string;
  title: string;
  link?: { to: string; label: string } | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("space-y-4 rounded-xl border border-border bg-card p-5", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {link && (
          <Button asChild variant="ghost" size="sm">
            <Link to={link.to}>
              {link.label}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Change({ value }: { value: number | null }) {
  const { t, i18n } = useTranslation();
  if (value === null) return <span className="w-10" />;
  return (
    <span
      title={t("surveys.results.changeHint")}
      className={cn(
        "w-10 text-right text-xs tabular-nums",
        value === 0 ? "text-muted-foreground" : value > 0 ? "text-emerald-600" : "text-rose-600"
      )}
    >
      {formatChange(i18n.language, value)}
    </span>
  );
}

function OpenSurvey({ survey }: { survey: Survey }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sky-500/10 px-3 py-2 text-sm">
      <span>
        {t(survey.answered ? "overview.health.answered" : "overview.health.open", {
          survey: survey.title,
        })}
      </span>
      {!survey.answered && (
        <Button asChild size="sm">
          <Link to={`/team-pulse?survey=${survey.id}`}>{t("overview.health.answer")}</Link>
        </Button>
      )}
    </div>
  );
}

function TeamHealth({ report, open }: { report: SurveyReport | null; open: Survey | null }) {
  const { t, i18n } = useTranslation();
  const formatDate = useDateFormat();
  const flagged = report ? concerns(report) : [];

  return (
    <Panel
      id="overview-health"
      title={t("overview.health.title")}
      link={
        report
          ? { to: `/team-pulse?survey=${report.survey.id}`, label: t("overview.health.results") }
          : undefined
      }
    >
      {open && <OpenSurvey survey={open} />}
      {!report ? (
        <div className="space-y-3">
          <Quiet>{t("overview.health.empty")}</Quiet>
          {!open && (
            <Button asChild variant="outline" size="sm">
              <Link to="/team-pulse">{t("overview.health.start")}</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {t("overview.health.from", {
              survey: report.survey.title,
              date: formatDate((report.survey.closedAt ?? report.survey.createdAt).slice(0, 10)),
            })}
          </p>
          <ul aria-label={t("overview.health.scores")} className="divide-y divide-border">
            {report.questions.map((item) => (
              <li key={item.question.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 text-sm">{questionText(t, item.question)}</span>
                <Change value={item.change} />
                <span className="w-8 text-right font-semibold tabular-nums">
                  {item.average === null ? "–" : formatScore(i18n.language, item.average)}
                </span>
              </li>
            ))}
          </ul>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">{t("overview.health.concerns")}</h3>
            {flagged.length === 0 ? (
              <Quiet>{t("overview.health.noConcerns")}</Quiet>
            ) : (
              <ul aria-label={t("overview.health.concerns")} className="space-y-1.5">
                {flagged.map((item) => (
                  <li
                    key={item.question.id}
                    className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{questionText(t, item.question)}</span>
                    <span className="block text-xs text-amber-800 dark:text-amber-300">
                      {item.change !== null && item.change <= -CONCERN_DROP
                        ? t("overview.health.drop", {
                            change: formatChange(i18n.language, item.change),
                          })
                        : t("overview.health.low")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

function CurrentRetro({ retro }: { retro: Retro | null }) {
  const { t } = useTranslation();
  const formatDate = useDateFormat();

  return (
    <Panel id="overview-retro" title={t("overview.retro.title")}>
      {!retro ? (
        <div className="space-y-3">
          <Quiet>{t("overview.retro.none")}</Quiet>
          <Button asChild variant="outline" size="sm">
            <Link to="/retrospectives">{t("overview.retro.plan")}</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-lg font-semibold">{retro.title}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <StatusBadge positive>{t(`retros.stages.${retro.stage}.name`)}</StatusBadge>
              <span>{formatDate(retro.heldOn)}</span>
            </div>
            {retro.goal && <p className="text-sm">{retro.goal}</p>}
          </div>
          <div
            role="img"
            aria-label={t("overview.retro.progress", {
              number: stageIndex(retro.stage) + 1,
              total: RETRO_STAGES.length,
              stage: t(`retros.stages.${retro.stage}.name`),
            })}
            className="flex gap-1"
          >
            {RETRO_STAGES.map((stage, index) => (
              <span
                key={stage}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  index <= stageIndex(retro.stage) ? "bg-foreground" : "bg-muted"
                )}
              />
            ))}
          </div>
          <Button asChild>
            <Link to={`/retrospectives?retro=${retro.id}`}>
              {t(retro.stage === "prepare" ? "overview.retro.open" : "overview.retro.resume")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}
    </Panel>
  );
}

function ActionLine({ action, note }: { action: ImprovementAction; note: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <span className="min-w-0 truncate font-medium">{action.title}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{note}</span>
    </li>
  );
}

function Actions({ actions, since }: { actions: ImprovementAction[]; since: Retro | null }) {
  const { t } = useTranslation();
  const formatDate = useDateFormat();
  const today = localDate();
  const open = actions.filter(isUnresolved);
  const overdue = sortActions(open.filter((action) => isOverdue(action, today)));
  const done = doneSince(actions, since);
  const counts = [
    ["open", t("overview.actions.open"), open.length],
    ["overdue", t("overview.actions.overdue"), overdue.length],
    [
      "done",
      since ? t("overview.actions.doneSince", { retro: since.title }) : t("overview.actions.done"),
      done.length,
    ],
  ] as const;

  return (
    <Panel
      id="overview-actions"
      title={t("overview.actions.title")}
      link={{ to: "/actions", label: t("overview.actions.all") }}
    >
      <dl className="grid grid-cols-3 gap-3">
        {counts.map(([key, label, value]) => (
          <div
            key={key}
            className={cn(
              "rounded-lg bg-muted/60 px-3 py-2.5",
              key === "overdue" && value > 0 && "bg-rose-500/10"
            )}
          >
            <dt className="truncate text-xs text-muted-foreground" title={label}>
              {label}
            </dt>
            <dd
              className={cn(
                "text-2xl font-semibold tabular-nums",
                key === "overdue" && value > 0 && "text-rose-600 dark:text-rose-400"
              )}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {overdue.length > 0 && (
        <ul aria-label={t("overview.actions.overdue")} className="divide-y divide-border">
          {overdue.slice(0, LIST_LENGTH).map((action) => (
            <ActionLine
              key={action.id}
              action={action}
              note={t("overview.actions.due", { date: formatDate(action.dueOn!) })}
            />
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <ul aria-label={t("overview.actions.doneList")} className="divide-y divide-border">
          {done.slice(0, LIST_LENGTH).map((action) => (
            <ActionLine
              key={action.id}
              action={action}
              note={
                action.helped === null
                  ? t("overview.actions.noOutcome")
                  : t(action.helped ? "overview.actions.helped" : "overview.actions.didNotHelp")
              }
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Block({
  id,
  title,
  empty,
  children,
}: {
  id: string;
  title: string;
  empty: string | null;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="text-sm font-semibold">
        {title}
      </h3>
      {empty ? <Quiet>{empty}</Quiet> : children}
    </section>
  );
}

function RecentRetros({
  history,
  actions,
}: {
  history: RetroHistory[];
  actions: ImprovementAction[];
}) {
  const { t } = useTranslation();
  const formatDate = useDateFormat();
  const nameOf = useGroupName();
  return (
    <ul className="space-y-2">
      {history.slice(0, LIST_LENGTH).map(({ retro, board }) => {
        const summary = summarizeRetro(board);
        const top = summary.top[0];
        const index = top ? board.groups.findIndex((group) => group.id === top.group.id) : 0;
        return (
          <li key={retro.id} className="rounded-lg border border-border px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <Link
                to={`/retrospectives?retro=${retro.id}`}
                className="truncate text-sm font-medium hover:underline"
              >
                {retro.title}
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDate(retro.heldOn)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("overview.history.retroStats", {
                topics: summary.topics,
                decisions: summary.discussed.filter((item) => item.group.decision).length,
                actions: actions.filter((action) => action.retroId === retro.id).length,
              })}
            </p>
            {top && (
              <p className="mt-1 truncate text-xs">
                {t("overview.history.top", { group: nameOf(top.group, top.topics, index) })}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Improvement({
  history,
  retros,
  actions,
  report,
}: {
  history: RetroHistory[];
  retros: Retro[];
  actions: ImprovementAction[];
  report: SurveyReport | null;
}) {
  const { t, i18n } = useTranslation();
  const recurring = recurringTopics(history).slice(0, 5);
  const stuck = stuckActions(actions, retros).slice(0, 5);
  const trends = report?.questions.filter((item) => item.trend.length > 1) ?? [];

  return (
    <Panel id="overview-improvement" title={t("overview.history.title")} className="lg:col-span-2">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Block
          id="overview-recent"
          title={t("overview.history.retros")}
          empty={history.length ? null : t("overview.history.noRetros")}
        >
          <RecentRetros history={history} actions={actions} />
        </Block>
        <Block
          id="overview-recurring"
          title={t("overview.history.recurring")}
          empty={recurring.length ? null : t("overview.history.noRecurring")}
        >
          <ul className="divide-y divide-border">
            {recurring.map((item) => (
              <li key={item.label} className="py-2 text-sm">
                <span className="font-medium">{item.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("overview.history.recurringIn", {
                    retros: item.retros.map((retro) => retro.title).join(", "),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </Block>
        <Block
          id="overview-stuck"
          title={t("overview.history.stuck")}
          empty={stuck.length ? null : t("overview.history.noStuck")}
        >
          <ul className="divide-y divide-border">
            {stuck.map((item) => (
              <li key={item.action.id} className="py-2 text-sm">
                <span className="font-medium">{item.action.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("overview.history.stuckFor", { retros: item.retros })}
                </span>
              </li>
            ))}
          </ul>
        </Block>
        <Block
          id="overview-trends"
          title={t("overview.history.trends")}
          empty={trends.length ? null : t("overview.history.noTrends")}
        >
          <ul className="divide-y divide-border">
            {trends.map((item) => {
              const text = questionText(t, item.question);
              return (
                <li key={item.question.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm" title={text}>
                    {text}
                  </span>
                  <Trend
                    values={item.trend}
                    label={t("surveys.results.trend", {
                      points: item.trend.length,
                      question: text,
                    })}
                  />
                  <span className="w-8 text-right text-sm font-semibold tabular-nums">
                    {formatScore(i18n.language, item.trend.at(-1)!)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Block>
      </div>
    </Panel>
  );
}

export default function OverviewPage() {
  const { t } = useTranslation();
  const { surveyApi, retroApi, actionApi } = useData();
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const surveys = useSurveys(surveyApi, workspaceId);
  const retros = useRetros(retroApi, workspaceId);
  const tracked = useActions(actionApi, workspaceId);
  const past = useRetroHistory(retroApi, retros.retros);

  if (!workspaceId) return null;
  const error = surveys.error ?? retros.error ?? tracked.error ?? past.error;
  const loading = surveys.loading || retros.loading || tracked.loading;
  const report = latestHealth(surveys.surveys, surveys.results);
  const open = surveys.surveys.find((survey) => survey.status === "open") ?? null;

  return (
    <section className="space-y-6" aria-labelledby="overview-title">
      <header className="space-y-1">
        <h1 id="overview-title" className="text-2xl font-semibold">
          {t("sections.overview.title")}
        </h1>
        <p className="text-muted-foreground">{t("sections.overview.description")}</p>
      </header>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : loading ? (
        <Spinner label={t("overview.loading")} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <TeamHealth report={report} open={open} />
          <div className="space-y-4">
            <CurrentRetro retro={currentRetro(retros.retros)} />
            <Actions actions={tracked.actions} since={lastRetro(retros.retros)} />
          </div>
          <Improvement
            history={past.history}
            retros={retros.retros}
            actions={tracked.actions}
            report={report}
          />
        </div>
      )}
    </section>
  );
}

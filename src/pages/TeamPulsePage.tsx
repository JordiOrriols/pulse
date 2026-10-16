import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Button, ConfirmDialog, EmptyState, Spinner, StatusBadge, cn } from "@jordiorriols/ui";
import { CheckCircle2, HeartPulse, Plus } from "@jordiorriols/ui/icons";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { useData } from "@/data/DataProvider";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { useSurveys } from "@/hooks/useSurveys";
import { buildSurveyReport, type Survey, type SurveyResult } from "@/lib/surveys";
import { AnswerSurveyDialog } from "@/components/surveys/AnswerSurveyDialog";
import { NewSurveyDialog } from "@/components/surveys/NewSurveyDialog";
import { SurveyResults } from "@/components/surveys/SurveyResults";

function SurveyListItem({
  survey,
  result,
  selected,
  onSelect,
}: {
  survey: Survey;
  result: SurveyResult | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
          selected
            ? "border-primary/50 bg-primary/5"
            : "border-transparent hover:border-border hover:bg-card"
        )}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{survey.title}</span>
          {survey.status === "open" && (
            <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          )}
        </span>
        <span className="mt-0.5 flex justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
              new Date(survey.createdAt)
            )}
          </span>
          <span className="tabular-nums">
            {t("surveys.list.answered", {
              responses: result?.responses ?? 0,
              participants: result?.participants ?? 0,
            })}
          </span>
        </span>
      </button>
    </li>
  );
}

export default function TeamPulsePage() {
  const { t } = useTranslation();
  const { surveyApi } = useData();
  const { workspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;
  const { surveys, results, loading, error, reload } = useSurveys(surveyApi, workspaceId);
  const canManage = workspace?.access_level === "owner" || workspace?.access_level === "editor";
  const [params] = useSearchParams();
  const [chosenId, setChosenId] = useState<string | null>(() => params.get("survey"));
  const [creating, setCreating] = useState(false);
  const [answering, setAnswering] = useState<Survey | null>(null);
  const [deleting, setDeleting] = useState<Survey | null>(null);
  const action = useAsyncAction();

  const resultsById = useMemo(
    () => new Map(results.map((result) => [result.surveyId, result])),
    [results]
  );
  const selectedId =
    surveys.find((survey) => survey.id === chosenId)?.id ??
    surveys.find((survey) => survey.status === "open")?.id ??
    surveys[0]?.id ??
    null;
  const report = useMemo(
    () => (selectedId ? buildSurveyReport(surveys, results, selectedId) : null),
    [surveys, results, selectedId]
  );

  if (!surveyApi || !workspaceId) return null;

  const change = async (operation: () => Promise<unknown>) => {
    await action.run(async () => {
      await operation();
      await reload();
    });
  };

  const header = (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 id="teamPulse-title" className="text-2xl font-semibold">
          {t("sections.teamPulse.title")}
        </h1>
        <p className="text-muted-foreground">{t("sections.teamPulse.description")}</p>
      </div>
      {canManage && (
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          {t("surveys.create.open")}
        </Button>
      )}
    </header>
  );

  const selected = report?.survey ?? null;
  const selectedResult = selected ? resultsById.get(selected.id) : undefined;

  let body;
  if (error) {
    body = (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  } else if (loading) {
    body = (
      <div className="flex justify-center py-12">
        <Spinner label={t("surveys.loading")} />
      </div>
    );
  } else if (!selected || !report) {
    body = (
      <EmptyState
        icon={<HeartPulse className="size-8 text-muted-foreground" />}
        title={t("surveys.empty.title")}
        description={t(canManage ? "surveys.empty.manager" : "surveys.empty.member")}
      />
    );
  } else {
    body = (
      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label={t("surveys.list.label")}>
          <ul className="space-y-1">
            {surveys.map((survey) => (
              <SurveyListItem
                key={survey.id}
                survey={survey}
                result={resultsById.get(survey.id)}
                selected={survey.id === selected.id}
                onSelect={() => setChosenId(survey.id)}
              />
            ))}
          </ul>
        </nav>

        <article className="panel space-y-5 self-start" aria-labelledby="pulse-survey-title">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5">
              <h2 id="pulse-survey-title" className="text-lg font-semibold">
                {selected.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <StatusBadge positive={selected.status === "open"}>
                  {t(`surveys.status.${selected.status}`)}
                </StatusBadge>
                <span className="tabular-nums">
                  {t("surveys.list.answered", {
                    responses: selectedResult?.responses ?? 0,
                    participants: selectedResult?.participants ?? 0,
                  })}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.status === "open" &&
                (selected.answered ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="size-4" />
                    {t("surveys.answer.done")}
                  </span>
                ) : (
                  <Button onClick={() => setAnswering(selected)}>{t("surveys.answer.open")}</Button>
                ))}
              {canManage && (
                <>
                  <Button
                    variant="outline"
                    disabled={action.busy}
                    onClick={() =>
                      change(() =>
                        surveyApi.setStatus(
                          selected.id,
                          selected.status === "open" ? "closed" : "open"
                        )
                      )
                    }
                  >
                    {t(
                      selected.status === "open"
                        ? "surveys.actions.close"
                        : "surveys.actions.reopen"
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={action.busy}
                    onClick={() => setDeleting(selected)}
                  >
                    {t("surveys.actions.delete")}
                  </Button>
                </>
              )}
            </div>
          </header>
          {action.error && (
            <p role="alert" className="text-sm text-destructive">
              {action.error}
            </p>
          )}
          <SurveyResults report={report} />
        </article>
      </div>
    );
  }

  return (
    <section className="space-y-6" aria-labelledby="teamPulse-title">
      {header}
      {body}
      <NewSurveyDialog
        isOpen={creating}
        onClose={() => setCreating(false)}
        onCreate={async (survey) => {
          const id = await surveyApi.createSurvey(workspaceId, survey);
          await reload();
          setChosenId(id);
        }}
      />
      <AnswerSurveyDialog
        survey={answering}
        onClose={() => setAnswering(null)}
        onSubmit={async (ratings, comment) => {
          if (!answering) return;
          await surveyApi.submitResponse(answering.id, ratings, comment);
          await reload();
        }}
      />
      <ConfirmDialog
        isOpen={deleting !== null}
        title={t("surveys.delete.title")}
        description={t("surveys.delete.description", { title: deleting?.title ?? "" })}
        confirmLabel={t("surveys.delete.confirm")}
        cancelLabel={t("surveys.delete.cancel")}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) void change(() => surveyApi.deleteSurvey(target.id));
        }}
      />
    </section>
  );
}

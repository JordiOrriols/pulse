import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal, cn } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { RATINGS, isComplete, type Survey } from "@/lib/surveys";
import { RATING_TONES, questionText, scaleLabels } from "./scale";

export function AnswerSurveyDialog({
  survey,
  onClose,
  onSubmit,
}: {
  survey: Survey | null;
  onClose: () => void;
  onSubmit: (ratings: Record<string, number>, comment: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const { busy, error, reset, run } = useAsyncAction();

  useEffect(() => {
    setRatings({});
    setComment("");
    reset();
  }, [survey?.id, reset]);

  if (!survey) return null;
  const complete = isComplete(survey.questions, ratings);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!complete) return;
    const result = await run(() => onSubmit(ratings, comment));
    if (result.ok) onClose();
  };

  return (
    <Modal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={survey.title}
      description={t("surveys.answer.description")}
      closeLabel={t("surveys.answer.cancel")}
      footer={
        <Button type="submit" form="pulse-answer" disabled={!complete || busy}>
          {t("surveys.answer.submit")}
        </Button>
      }
    >
      <form id="pulse-answer" onSubmit={submit} className="space-y-5">
        {survey.questions.map((question, index) => {
          const labels = scaleLabels(t, question);
          const selected = ratings[question.id];
          return (
            <fieldset key={question.id} className="space-y-2">
              <legend className="text-sm font-medium">
                <span className="mr-2 text-muted-foreground tabular-nums">{index + 1}</span>
                {questionText(t, question)}
              </legend>
              <div className="grid grid-cols-5 gap-1.5" role="radiogroup">
                {RATINGS.map((rating) => {
                  const checked = selected === rating;
                  return (
                    <label
                      key={rating}
                      className={cn(
                        "relative flex h-10 cursor-pointer items-center justify-center rounded-md border text-sm font-medium tabular-nums transition-colors",
                        "has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                        checked
                          ? "border-transparent text-slate-900"
                          : "border-border bg-card hover:bg-muted"
                      )}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name={question.id}
                        value={rating}
                        checked={checked}
                        onChange={() =>
                          setRatings((current) => ({ ...current, [question.id]: rating }))
                        }
                        aria-label={t("surveys.answer.rating", {
                          rating,
                          question: questionText(t, question),
                        })}
                      />
                      {checked && (
                        <span
                          aria-hidden
                          className={cn("absolute inset-0 rounded-md", RATING_TONES[rating - 1])}
                        />
                      )}
                      <span className="relative">{rating}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-between gap-4 text-xs text-muted-foreground">
                <span>{labels.low}</span>
                <span className="text-right">{labels.high}</span>
              </div>
            </fieldset>
          );
        })}
        {survey.asksComment && (
          <div className="space-y-2">
            <label htmlFor="pulse-comment" className="text-sm font-medium">
              {t("surveys.answer.comment")}
            </label>
            <textarea
              id="pulse-comment"
              value={comment}
              maxLength={2000}
              rows={3}
              onChange={(event) => setComment(event.target.value)}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <p className="text-xs text-muted-foreground">{t("surveys.answer.commentHint")}</p>
          </div>
        )}
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          {t("surveys.answer.privacy", { minimum: survey.minResponses })}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

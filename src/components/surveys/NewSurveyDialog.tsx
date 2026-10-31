import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Checkbox, Input, Label, Modal } from "@jordiorriols/ui";
import { Plus, X } from "@jordiorriols/ui/icons";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import type { NewSurvey } from "@/data/surveys";
import { DEFAULT_QUESTION_KEYS, type QuestionKey } from "@/lib/surveys";

interface CustomDraft {
  id: number;
  prompt: string;
  lowLabel: string;
  highLabel: string;
}

const DEFAULT_MINIMUM = 3;

export function NewSurveyDialog({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (survey: NewSurvey) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [keys, setKeys] = useState<Set<QuestionKey>>(() => new Set(DEFAULT_QUESTION_KEYS));
  const [custom, setCustom] = useState<CustomDraft[]>([]);
  const [asksComment, setAsksComment] = useState(true);
  const [minimum, setMinimum] = useState(DEFAULT_MINIMUM);
  const { busy, error, reset, run } = useAsyncAction();

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setKeys(new Set(DEFAULT_QUESTION_KEYS));
    setCustom([]);
    setAsksComment(true);
    setMinimum(DEFAULT_MINIMUM);
    reset();
  }, [isOpen, reset]);

  const filled = custom.filter((question) => question.prompt.trim());
  const valid =
    title.trim().length > 0 && keys.size + filled.length > 0 && minimum >= 1 && minimum <= 50;

  const toggleKey = (key: QuestionKey) =>
    setKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const updateCustom = (id: number, change: Partial<CustomDraft>) =>
    setCustom((current) =>
      current.map((question) => (question.id === id ? { ...question, ...change } : question))
    );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const result = await run(() =>
      onCreate({
        title: title.trim(),
        questions: [
          ...DEFAULT_QUESTION_KEYS.filter((key) => keys.has(key)).map((key) => ({ key })),
          ...filled.map((question) => {
            const lowLabel = question.lowLabel.trim();
            const highLabel = question.highLabel.trim();
            return {
              prompt: question.prompt.trim(),
              ...(lowLabel ? { lowLabel } : {}),
              ...(highLabel ? { highLabel } : {}),
            };
          }),
        ],
        asksComment,
        minResponses: minimum,
      })
    );
    if (result.ok) onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={t("surveys.create.title")}
      description={t("surveys.create.description")}
      closeLabel={t("surveys.create.cancel")}
      footer={
        <Button type="submit" form="pulse-new-survey" disabled={!valid || busy}>
          {t("surveys.create.submit")}
        </Button>
      }
    >
      <form
        id="pulse-new-survey"
        onSubmit={submit}
        className="max-h-[60vh] space-y-5 overflow-y-auto pr-1"
      >
        <div className="space-y-2">
          <Label htmlFor="pulse-survey-title">{t("surveys.create.name")}</Label>
          <Input
            id="pulse-survey-title"
            value={title}
            maxLength={120}
            placeholder={t("surveys.create.namePlaceholder")}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("surveys.create.questions")}</legend>
          <div className="grid gap-1.5">
            {DEFAULT_QUESTION_KEYS.map((key) => (
              <label
                key={key}
                className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                <Checkbox
                  className="mt-0.5"
                  checked={keys.has(key)}
                  onCheckedChange={() => toggleKey(key)}
                />
                <span>{t(`surveys.questions.${key}.prompt`)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("surveys.create.custom")}</legend>
          {custom.map((question, index) => (
            <div key={question.id} className="space-y-1.5 rounded-md border border-border p-3">
              <div className="flex gap-2">
                <Input
                  value={question.prompt}
                  maxLength={300}
                  aria-label={t("surveys.create.customPrompt", { number: index + 1 })}
                  placeholder={t("surveys.create.customPromptPlaceholder")}
                  onChange={(event) => updateCustom(question.id, { prompt: event.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("surveys.create.removeCustom", { number: index + 1 })}
                  onClick={() =>
                    setCustom((current) => current.filter((item) => item.id !== question.id))
                  }
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={question.lowLabel}
                  maxLength={60}
                  aria-label={t("surveys.create.lowLabel", { number: index + 1 })}
                  placeholder={t("surveys.scale.low")}
                  onChange={(event) => updateCustom(question.id, { lowLabel: event.target.value })}
                />
                <Input
                  value={question.highLabel}
                  maxLength={60}
                  aria-label={t("surveys.create.highLabel", { number: index + 1 })}
                  placeholder={t("surveys.scale.high")}
                  onChange={(event) => updateCustom(question.id, { highLabel: event.target.value })}
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setCustom((current) => [
                ...current,
                { id: Date.now(), prompt: "", lowLabel: "", highLabel: "" },
              ])
            }
          >
            <Plus className="size-4" />
            {t("surveys.create.addCustom")}
          </Button>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={asksComment}
              onCheckedChange={(checked) => setAsksComment(checked === true)}
            />
            <span>{t("surveys.create.asksComment")}</span>
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="pulse-survey-minimum">{t("surveys.create.minimum")}</Label>
            <Input
              id="pulse-survey-minimum"
              type="number"
              min={1}
              max={50}
              value={minimum}
              onChange={(event) => setMinimum(Number(event.target.value))}
            />
            <p className="text-xs text-muted-foreground">{t("surveys.create.minimumHint")}</p>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

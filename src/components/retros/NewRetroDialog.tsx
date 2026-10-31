import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Checkbox, FormField, Input, Label, Modal, Textarea, cn } from "@jordiorriols/ui";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import type { NewRetro } from "@/data/retros";
import {
  DEFAULT_VOTES,
  MAX_VOTES,
  RETRO_TEMPLATES,
  TEMPLATE_COLUMNS,
  type RetroTemplate,
} from "@/lib/retros";

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export function NewRetroDialog({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (retro: NewRetro) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [heldOn, setHeldOn] = useState(today);
  const [period, setPeriod] = useState("");
  const [goal, setGoal] = useState("");
  const [template, setTemplate] = useState<RetroTemplate>("well_improve");
  const [anonymous, setAnonymous] = useState(true);
  const [votes, setVotes] = useState(DEFAULT_VOTES);
  const { busy, error, reset, run } = useAsyncAction();

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setHeldOn(today());
    setPeriod("");
    setGoal("");
    setTemplate("well_improve");
    setAnonymous(true);
    setVotes(DEFAULT_VOTES);
    reset();
  }, [isOpen, reset]);

  const valid = title.trim().length > 0 && !!heldOn && votes >= 1 && votes <= MAX_VOTES;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    const result = await run(() =>
      onCreate({
        title: title.trim(),
        heldOn,
        period: period.trim(),
        goal: goal.trim(),
        template,
        anonymous,
        votesPerPerson: votes,
      })
    );
    if (result.ok) onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={t("retros.create.title")}
      description={t("retros.create.description")}
      closeLabel={t("retros.create.cancel")}
      footer={
        <Button type="submit" form="pulse-new-retro" disabled={!valid || busy}>
          {t("retros.create.submit")}
        </Button>
      }
    >
      <form id="pulse-new-retro" onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <FormField id="pulse-retro-title" label={t("retros.create.name")}>
            {(field) => (
              <Input
                {...field}
                value={title}
                maxLength={120}
                placeholder={t("retros.create.namePlaceholder")}
                onChange={(event) => setTitle(event.target.value)}
              />
            )}
          </FormField>
          <FormField id="pulse-retro-date" label={t("retros.create.date")}>
            {(field) => (
              <Input
                {...field}
                type="date"
                value={heldOn}
                onChange={(event) => setHeldOn(event.target.value)}
              />
            )}
          </FormField>
        </div>
        <FormField id="pulse-retro-period" label={t("retros.create.period")}>
          {(field) => (
            <Input
              {...field}
              value={period}
              maxLength={80}
              placeholder={t("retros.create.periodPlaceholder")}
              onChange={(event) => setPeriod(event.target.value)}
            />
          )}
        </FormField>
        <FormField id="pulse-retro-goal" label={t("retros.create.goal")}>
          {(field) => (
            <Textarea
              {...field}
              className="min-h-16"
              value={goal}
              maxLength={500}
              placeholder={t("retros.create.goalPlaceholder")}
              onChange={(event) => setGoal(event.target.value)}
            />
          )}
        </FormField>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("retros.create.template")}</legend>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {RETRO_TEMPLATES.map((item) => (
              <label
                key={item}
                className={cn(
                  "flex cursor-pointer flex-col gap-0.5 rounded-md border px-3 py-2 text-sm transition-colors",
                  template === item
                    ? "border-primary/60 bg-primary/5"
                    : "border-border hover:bg-muted"
                )}
              >
                <span className="flex items-center gap-2 font-medium">
                  <input
                    type="radio"
                    name="pulse-retro-template"
                    className="accent-primary"
                    checked={template === item}
                    onChange={() => setTemplate(item)}
                  />
                  {t(`retros.templates.${item}`)}
                </span>
                <span className="pl-5 text-xs text-muted-foreground">
                  {TEMPLATE_COLUMNS[item]
                    .map((column) => t(`retros.columns.${column}`))
                    .join(" · ")}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={anonymous}
              onCheckedChange={(checked) => setAnonymous(checked === true)}
            />
            <span className="space-y-0.5">
              <span className="block">{t("retros.create.anonymous")}</span>
              <span className="block text-xs text-muted-foreground">
                {t("retros.create.anonymousHint")}
              </span>
            </span>
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="pulse-retro-votes">{t("retros.create.votes")}</Label>
            <Input
              id="pulse-retro-votes"
              type="number"
              min={1}
              max={MAX_VOTES}
              value={votes}
              onChange={(event) => setVotes(Number(event.target.value))}
            />
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

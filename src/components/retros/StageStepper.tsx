import React from "react";
import { useTranslation } from "react-i18next";
import { Button, cn } from "@jordiorriols/ui";
import { ArrowLeft, ArrowRight, Check } from "@jordiorriols/ui/icons";
import { RETRO_STAGES, nextStage, previousStage, stageIndex, type RetroStage } from "@/lib/retros";

export function StageStepper({
  stage,
  canFacilitate,
  busy,
  onMove,
}: {
  stage: RetroStage;
  canFacilitate: boolean;
  busy: boolean;
  onMove: (stage: RetroStage) => void;
}) {
  const { t } = useTranslation();
  const current = stageIndex(stage);
  const back = previousStage(stage);
  const next = nextStage(stage);

  return (
    <div className="space-y-3">
      <ol aria-label={t("retros.stages.label")} className="flex items-center gap-1.5">
        {RETRO_STAGES.map((item, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={item}
              aria-current={active ? "step" : undefined}
              className="flex min-w-0 flex-1 flex-col gap-1.5"
            >
              <span
                className={cn(
                  "h-1 rounded-full transition-colors",
                  done || active ? "bg-primary" : "bg-border",
                  active && "shadow-[0_0_0_3px] shadow-primary/20"
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "flex items-center gap-1 truncate text-xs",
                  active ? "font-semibold text-foreground" : "text-muted-foreground"
                )}
              >
                {done && <Check className="size-3 shrink-0 text-primary" aria-hidden />}
                {t(`retros.stages.${item}.name`)}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2.5">
        <p className="text-sm text-muted-foreground">
          {t(`retros.stages.${stage}.${canFacilitate ? "facilitator" : "participant"}`)}
        </p>
        {canFacilitate && (
          <div className="flex gap-2">
            {back && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => onMove(back)}>
                <ArrowLeft className="size-4" />
                {t("retros.stages.back", { stage: t(`retros.stages.${back}.name`) })}
              </Button>
            )}
            {next && (
              <Button size="sm" disabled={busy} onClick={() => onMove(next)}>
                {t(next === "closed" ? "retros.stages.close" : "retros.stages.next", {
                  stage: t(`retros.stages.${next}.name`),
                })}
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

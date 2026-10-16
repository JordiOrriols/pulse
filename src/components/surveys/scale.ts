import type { TFunction } from "i18next";
import type { SurveyQuestion } from "@/lib/surveys";

/** One hue per rating, from rose (1) to emerald (5), shared by the answer form and the results. */
export const RATING_TONES = [
  "bg-rose-400",
  "bg-orange-300",
  "bg-slate-300",
  "bg-emerald-300",
  "bg-emerald-500",
] as const;

export function questionText(t: TFunction, question: SurveyQuestion) {
  return question.key ? t(`surveys.questions.${question.key}.prompt`) : (question.prompt ?? "");
}

export function scaleLabels(t: TFunction, question: SurveyQuestion) {
  return question.key
    ? {
        low: t(`surveys.questions.${question.key}.low`),
        high: t(`surveys.questions.${question.key}.high`),
      }
    : {
        low: question.lowLabel ?? t("surveys.scale.low"),
        high: question.highLabel ?? t("surveys.scale.high"),
      };
}

export function formatScore(language: string, value: number) {
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatChange(language: string, value: number) {
  return new Intl.NumberFormat(language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value);
}

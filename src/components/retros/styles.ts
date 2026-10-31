const POSITIVE = "border-t-emerald-500 [--tone:var(--color-emerald-500)]";
const NEGATIVE = "border-t-rose-500 [--tone:var(--color-rose-500)]";
const CONCERN = "border-t-amber-500 [--tone:var(--color-amber-500)]";
const IDEA = "border-t-sky-500 [--tone:var(--color-sky-500)]";

/** Accent of each board column, set on the column so its chips can reuse it. */
export const COLUMN_TONES: Record<string, string> = {
  went_well: POSITIVE,
  to_improve: CONCERN,
  ideas: IDEA,
  start: IDEA,
  stop: NEGATIVE,
  continue: POSITIVE,
  mad: NEGATIVE,
  sad: CONCERN,
  glad: POSITIVE,
  topics: "border-t-primary [--tone:var(--primary)]",
};

export const toneOf = (column: string) => COLUMN_TONES[column] ?? COLUMN_TONES["topics"]!;

/** Matches the shared Input so native selects and text areas sit well next to it. */
export const FIELD_CLASS =
  "w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

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

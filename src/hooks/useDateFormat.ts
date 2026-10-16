import { useTranslation } from "react-i18next";

/** Formats a calendar date (YYYY-MM-DD) in the current language, without time zone shifts. */
export function useDateFormat() {
  const { i18n } = useTranslation();
  return (date: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeZone: "UTC" }).format(
      new Date(`${date}T00:00:00Z`)
    );
}

import React from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@jordiorriols/ui";
import type { Section } from "@/sections";

/** Placeholder until each section gets its own page. */
export default function SectionPage({ section: { id, icon: Icon } }: { section: Section }) {
  const { t } = useTranslation();

  return (
    <section className="space-y-6" aria-labelledby={`${id}-title`}>
      <header className="space-y-1">
        <h1 id={`${id}-title`} className="text-2xl font-semibold">
          {t(`sections.${id}.title`)}
        </h1>
        <p className="text-muted-foreground">{t(`sections.${id}.description`)}</p>
      </header>
      <EmptyState
        icon={<Icon className="size-8 text-muted-foreground" />}
        title={t("sections.empty.title")}
        description={t("sections.empty.description")}
      />
    </section>
  );
}

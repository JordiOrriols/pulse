import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AppHeader,
  AppMain,
  AppNavigation,
  AppNavigationItem,
  AppPage,
  LanguageSelector,
  PROJECTS,
} from "@jordiorriols/ui";
import { SECTIONS } from "@/sections";

const AppIcon = PROJECTS.find((project) => project.id === "pulse")!.icon;

export default function AppLayout() {
  const { t, i18n } = useTranslation();

  return (
    <AppPage>
      <AppHeader
        projectId="pulse"
        projectSwitcherLabel={t("app.switchProject")}
        title={t("app.name")}
        subtitle={t("app.subtitle")}
        icon={<AppIcon />}
        actions={
          <LanguageSelector
            value={i18n.language}
            label={t("app.language")}
            className="inline-flex"
            onValueChange={(language) => void i18n.changeLanguage(language)}
          />
        }
        navigation={
          <AppNavigation label={t("app.pages")}>
            {SECTIONS.map(({ id, path, icon: Icon }) => (
              <AppNavigationItem key={id} asChild>
                <NavLink to={path} end={path === "/"}>
                  <Icon />
                  <span>{t(`sections.${id}.tab`)}</span>
                </NavLink>
              </AppNavigationItem>
            ))}
          </AppNavigation>
        }
      />
      <AppMain>
        <Outlet />
      </AppMain>
    </AppPage>
  );
}

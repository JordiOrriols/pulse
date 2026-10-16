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
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { useData } from "@/data/DataProvider";
import { SECTIONS } from "@/sections";

const AppIcon = PROJECTS.find((project) => project.id === "pulse")!.icon;

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const { signOut, user } = useData();
  const action = useAsyncAction();

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
        accountAction={{
          type: "signOut",
          label: t("auth.signOut"),
          title: user?.email ?? "",
          disabled: action.busy,
          onClick: () => void action.run(signOut),
        }}
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
        {action.error && (
          <p role="alert" className="text-destructive">
            {action.error}
          </p>
        )}
        <Outlet />
      </AppMain>
    </AppPage>
  );
}

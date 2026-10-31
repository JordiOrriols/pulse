import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AppShell,
  AppNavigation,
  AppNavigationItem,
  AppSkeleton,
  EmptyState,
  ErrorState,
  WorkspaceBar,
  getWorkspaceLabels,
  getDisplayName,
} from "@jordiorriols/ui";
import { FolderOpen } from "@jordiorriols/ui/icons";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { useData } from "@/data/DataProvider";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { SECTIONS } from "@/sections";

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const { signOut, user, workspaceApi } = useData();
  const { workspaces, workspace, select, refresh, error, loading } = useWorkspace();
  const action = useAsyncAction();

  return (
    <AppShell
      projectId="pulse"
      header={{
        projectSwitcherLabel: t("app.switchProject"),
        title: t("app.name"),
        subtitle: t("app.subtitle"),
        language: {
          value: i18n.language,
          label: t("app.language"),
          className: "inline-flex",
          onValueChange: (language) => void i18n.changeLanguage(language),
        },
        accountAction: {
          type: "signOut",
          label: t("auth.signOut"),
          title: getDisplayName({
            accountName: user?.user_metadata?.["full_name"] ?? user?.user_metadata?.["name"],
            email: user?.email ?? "",
          }),
          disabled: action.busy,
          onClick: () => void action.run(signOut),
        },
        navigation: (
          <AppNavigation
            label={t("app.pages")}
            actions={
              workspaceApi && (
                <WorkspaceBar
                  api={workspaceApi}
                  app="pulse"
                  workspaces={workspaces ?? []}
                  value={workspace?.id ?? ""}
                  onValueChange={select}
                  onCreated={async (created) => {
                    select(created.id);
                    await refresh();
                  }}
                  onSharesChanged={refresh}
                  labels={getWorkspaceLabels(i18n.language)}
                />
              )
            }
          >
            {SECTIONS.map(({ id, path, icon: Icon }) => (
              <AppNavigationItem key={id} asChild>
                <NavLink to={path} end={path === "/"}>
                  <Icon />
                  <span>{t(`sections.${id}.tab`)}</span>
                </NavLink>
              </AppNavigationItem>
            ))}
          </AppNavigation>
        ),
      }}
    >
      {action.error && <ErrorState message={action.error} />}
      {error && <ErrorState message={error} />}
      {loading ? (
        <AppSkeleton label={t("app.loading")} />
      ) : workspace ? (
        <Outlet />
      ) : (
        !error && (
          <EmptyState
            icon={<FolderOpen className="size-8 text-muted-foreground" />}
            title={t("workspace.empty.title")}
            description={t("workspace.empty.description")}
          />
        )
      )}
    </AppShell>
  );
}

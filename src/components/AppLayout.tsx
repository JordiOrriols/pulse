import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AppShell,
  AppAccountControls,
  AppNavigation,
  AppNavigationItem,
  AppSkeleton,
  EmptyState,
  ErrorState,
  WorkspaceBar,
  WorkspaceSetup,
  getWorkspaceLabels,
  getDisplayName,
} from "@jordiorriols/ui";
import { FolderOpen } from "@jordiorriols/ui/icons";
import { useAuthDialogProps } from "./LoginDialog";
import { useData } from "@/data/DataProvider";
import { useWorkspace } from "@/data/WorkspaceProvider";
import { SECTIONS } from "@/sections";

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const { authEnabled, authError, user, workspaceApi } = useData();
  const { workspaces, workspace, select, refresh, error, loading } = useWorkspace();
  const auth = useAuthDialogProps();

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
        actions: (
          <AppAccountControls
            {...auth}
            projectId="pulse"
            enabled={authEnabled}
            signedIn={!!user}
            authError={authError}
            signOutLabel={t("auth.signOut")}
            accountTitle={getDisplayName({
              accountName: user?.user_metadata?.["full_name"] ?? user?.user_metadata?.["name"],
              email: user?.email ?? "",
            })}
          />
        ),
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
                  onDeleted={refresh}
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
      {error && <ErrorState message={error} />}
      {loading ? (
        <AppSkeleton label={t("app.loading")} />
      ) : workspace ? (
        <Outlet />
      ) : user && workspaceApi && !error ? (
        <WorkspaceSetup
          api={workspaceApi}
          language={i18n.language}
          onRefresh={refresh}
          onCreated={async (created) => {
            select(created.id);
            await refresh();
          }}
        />
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

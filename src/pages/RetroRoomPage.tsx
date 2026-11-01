import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PublicAppShell, AppSkeleton, Button } from "@jordiorriols/ui";
import { ArrowLeft, Maximize2, Minimize2 } from "@jordiorriols/ui/icons";
import { useAsyncAction } from "@jordiorriols/ui/hooks";
import { useWorkspace } from "@/data/WorkspaceProvider";
import RetrospectivesPage from "./RetrospectivesPage";

/** A direct room link selects only a workspace the account can already access. */
export default function RetroRoomPage() {
  const { workspaceId = "", retroId = "" } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { workspaces, workspace, select, loading, error } = useWorkspace();
  const allowed = workspaces?.some((item) => item.id === workspaceId) ?? false;
  const [browserFullscreen, setBrowserFullscreen] = useState(!!document.fullscreenElement);
  const action = useAsyncAction();
  useEffect(() => {
    if (allowed && workspace?.id !== workspaceId) select(workspaceId);
  }, [allowed, workspace?.id, workspaceId, select]);
  useEffect(() => {
    const update = () => setBrowserFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  return (
    <PublicAppShell
      projectId="pulse"
      mainClassName="max-w-none space-y-4"
      header={{
        title: t("app.name"),
        language: {
          value: i18n.language,
          label: t("app.language"),
          onValueChange: (language) => void i18n.changeLanguage(language),
        },
        actions: (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="ghost"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  if (document.fullscreenElement) await document.exitFullscreen();
                  navigate(`/retrospectives?retro=${encodeURIComponent(retroId)}`);
                })
              }
            >
              <ArrowLeft className="size-4" />
              {t("retroRoom.back")}
            </Button>
            {allowed && (
              <Button
                variant="outline"
                disabled={
                  action.busy || typeof document.documentElement.requestFullscreen !== "function"
                }
                onClick={() =>
                  void action.run(async () => {
                    if (document.fullscreenElement) await document.exitFullscreen();
                    else await document.documentElement.requestFullscreen();
                  })
                }
              >
                {browserFullscreen ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
                {t(browserFullscreen ? "retroRoom.exitBrowser" : "retroRoom.enterBrowser")}
              </Button>
            )}
          </div>
        ),
      }}
    >
      {action.error && (
        <p role="alert" className="text-destructive">
          {action.error}
        </p>
      )}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : loading || (allowed && workspace?.id !== workspaceId) ? (
        <AppSkeleton label={t("app.loading")} />
      ) : !allowed ? (
        <p role="alert">{t("retroRoom.noAccess")}</p>
      ) : (
        <RetrospectivesPage key={`${workspaceId}:${retroId}`} retroId={retroId} fullscreen />
      )}
    </PublicAppShell>
  );
}

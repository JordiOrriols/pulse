import React from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { Button } from "@jordiorriols/ui";
import AppLayout from "./components/AppLayout";
import { SECTIONS } from "./sections";
import SectionPage from "./pages/SectionPage";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const { t } = useTranslation();

  return (
    <div className="p-8 space-y-4">
      <h1>{t("app.errors.title")}</h1>
      <p role="alert">{error instanceof Error ? error.message : String(error)}</p>
      <Button onClick={resetErrorBoundary}>{t("app.actions.tryAgain")}</Button>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Routes>
        <Route element={<AppLayout />}>
          {SECTIONS.map((section) => (
            <Route
              key={section.id}
              path={section.path}
              element={<SectionPage section={section} />}
            />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

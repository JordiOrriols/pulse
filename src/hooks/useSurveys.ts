import { useCallback, useEffect, useRef, useState } from "react";
import type { SurveyApi } from "@/data/surveys";
import type { Survey, SurveyResult } from "@/lib/surveys";

/** Surveys of the open workspace with their aggregated results, reloaded after every change. */
export function useSurveys(api: SurveyApi | null, workspaceId: string | null) {
  const [data, setData] = useState<{ surveys: Survey[]; results: SurveyResult[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!api || !workspaceId) return;
    const request = ++latest.current;
    try {
      const [surveys, results] = await Promise.all([
        api.listSurveys(workspaceId),
        api.listResults(workspaceId),
      ]);
      if (request !== latest.current) return;
      setData({ surveys, results });
      setError(null);
    } catch (err) {
      if (request === latest.current) setError(err instanceof Error ? err.message : String(err));
    }
  }, [api, workspaceId]);

  useEffect(() => {
    setData(null);
    void reload();
  }, [reload]);

  return {
    surveys: data?.surveys ?? [],
    results: data?.results ?? [],
    loading: data === null && !error,
    error,
    reload,
  };
}

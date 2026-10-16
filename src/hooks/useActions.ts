import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionApi } from "@/data/actions";
import type { ActionUpdate, ImprovementAction, Person } from "@/lib/actions";

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

interface Loaded {
  actions: ImprovementAction[];
  people: Person[];
}

/** Improvement actions of the open workspace and the people who can own them. */
export function useActions(api: ActionApi | null, workspaceId: string | null) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!api || !workspaceId) return;
    const request = ++latest.current;
    try {
      const [actions, people] = await Promise.all([
        api.listActions(workspaceId),
        api.listPeople(workspaceId),
      ]);
      if (request !== latest.current) return;
      setData({ actions, people });
      setError(null);
    } catch (err) {
      if (request === latest.current) setError(message(err));
    }
  }, [api, workspaceId]);

  useEffect(() => {
    setData(null);
    setError(null);
    void reload();
  }, [reload]);

  return {
    actions: data?.actions ?? [],
    people: data?.people ?? [],
    loading: data === null && !error,
    error,
    reload,
  };
}

/** The history of one action, loaded while `actionId` is set and again whenever `version` changes. */
export function useActionHistory(api: ActionApi | null, actionId: string | null, version: unknown) {
  const [updates, setUpdates] = useState<{ id: string; rows: ActionUpdate[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!api || !actionId) return;
    const request = ++latest.current;
    try {
      const rows = await api.history(actionId);
      if (request !== latest.current) return;
      setUpdates({ id: actionId, rows });
      setError(null);
    } catch (err) {
      if (request === latest.current) setError(message(err));
    }
  }, [api, actionId]);

  useEffect(() => {
    void reload();
  }, [reload, version]);

  return { updates: updates?.id === actionId ? updates.rows : null, error, reload };
}

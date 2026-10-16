import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RetroApi } from "@/data/retros";
import { closedRetros, type RetroHistory } from "@/lib/overview";
import type { Retro, RetroBoard } from "@/lib/retros";

export const POLL_INTERVAL = 5000;

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

/** Retrospectives of the open workspace, latest first. */
export function useRetros(api: RetroApi | null, workspaceId: string | null) {
  const [retros, setRetros] = useState<Retro[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!api || !workspaceId) return;
    const request = ++latest.current;
    try {
      const rows = await api.listRetros(workspaceId);
      if (request !== latest.current) return;
      setRetros(rows);
      setError(null);
    } catch (err) {
      if (request === latest.current) setError(message(err));
    }
  }, [api, workspaceId]);

  useEffect(() => {
    setRetros(null);
    void reload();
  }, [reload]);

  return { retros: retros ?? [], loading: retros === null && !error, error, reload };
}

/** The board of one retrospective as the signed-in account may see it. */
export function useRetroBoard(api: RetroApi | null, retroId: string | null) {
  const [board, setBoard] = useState<{ id: string; board: RetroBoard } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!api || !retroId) return;
    const request = ++latest.current;
    try {
      const next = await api.loadBoard(retroId);
      if (request !== latest.current) return;
      setBoard({ id: retroId, board: next });
      setError(null);
    } catch (err) {
      if (request === latest.current) setError(message(err));
    }
  }, [api, retroId]);

  useEffect(() => {
    setError(null);
    void reload();
  }, [reload]);

  return { board: board?.id === retroId ? board.board : null, error, reload };
}

/** Calls refresh every few seconds while active and the tab is visible. */
export function usePolling(refresh: () => void, active: boolean, interval = POLL_INTERVAL) {
  const callback = useRef(refresh);
  useEffect(() => {
    callback.current = refresh;
  }, [refresh]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") callback.current();
    }, interval);
    return () => window.clearInterval(timer);
  }, [active, interval]);
}

/** Boards of the latest closed retrospectives, latest first. */
export function useRetroHistory(api: RetroApi | null, retros: Retro[]) {
  const recent = useMemo(() => closedRetros(retros), [retros]);
  const key = recent.map((retro) => retro.id).join(",");
  const [history, setHistory] = useState<{ key: string; items: RetroHistory[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    let live = true;
    const items = recent;
    Promise.all(items.map((retro) => api.loadBoard(retro.id)))
      .then((boards) => {
        if (!live) return;
        setHistory({ key, items: items.map((retro, index) => ({ retro, board: boards[index]! })) });
        setError(null);
      })
      .catch((err: unknown) => {
        if (live) setError(message(err));
      });
    return () => {
      live = false;
    };
  }, [api, key, recent]);

  return {
    history: history?.key === key ? history.items : [],
    loading: history?.key !== key && !error,
    error,
  };
}

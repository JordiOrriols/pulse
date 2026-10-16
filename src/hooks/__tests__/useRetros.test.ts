import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RetroApi } from "@/data/retros";
import { useRetroHistory, useRetros } from "../useRetros";

describe("useRetros", () => {
  it("keeps the same empty list while loading, so the board history loads once", () => {
    const api = {
      listRetros: vi.fn(() => new Promise(() => {})),
      loadBoard: vi.fn(),
    } as unknown as RetroApi;
    const { result, rerender } = renderHook(() => {
      const list = useRetros(api, "ws-1");
      useRetroHistory(api, list.retros);
      return list.retros;
    });
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
    expect(api.listRetros).toHaveBeenCalledTimes(1);
  });
});

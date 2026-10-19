import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RetroRoomPage from "@/pages/RetroRoomPage";
import i18n from "@/i18n";

const { select, state } = vi.hoisted(() => ({
  select: vi.fn(),
  state: {
    workspaces: [{ id: "target" }],
    workspace: { id: "target" },
    loading: false,
    error: null as string | null,
  },
}));
vi.mock("@/data/WorkspaceProvider", () => ({
  useWorkspace: () => ({ ...state, select }),
}));
vi.mock("@/pages/RetrospectivesPage", () => ({
  default: ({ retroId, fullscreen }: { retroId: string; fullscreen: boolean }) => (
    <div data-testid="selected-room">{`${retroId}:${fullscreen}`}</div>
  ),
}));

function room(path = "/workspaces/target/retrospectives/retro") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/workspaces/:workspaceId/retrospectives/:retroId"
          element={<RetroRoomPage />}
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  vi.clearAllMocks();
  state.workspaces = [{ id: "target" }];
  state.workspace = { id: "target" };
  state.loading = false;
  state.error = null;
});

describe("direct fullscreen retrospective", () => {
  it("opens the exact requested retro without the app navigation", () => {
    room();
    expect(screen.getByTestId("selected-room")).toHaveTextContent("retro:true");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to retrospectives" })).toBeVisible();
  });
  it("denies an unshared workspace rather than falling back to the selected one", () => {
    room("/workspaces/private/retrospectives/retro");
    expect(screen.getByRole("alert")).toHaveTextContent("do not have access");
    expect(screen.queryByTestId("selected-room")).not.toBeInTheDocument();
    expect(select).not.toHaveBeenCalled();
  });
  it("switches to the shared workspace before mounting any board", () => {
    state.workspace = { id: "other" };
    const rendered = room();
    expect(select).toHaveBeenCalledWith("target");
    expect(screen.queryByTestId("selected-room")).not.toBeInTheDocument();
    state.workspace = { id: "target" };
    rendered.rerender(
      <MemoryRouter>
        <Routes>
          <Route
            path="/workspaces/:workspaceId/retrospectives/:retroId"
            element={<RetroRoomPage />}
          />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByTestId("selected-room")).toHaveTextContent("retro:true");
  });
  it("surfaces workspace load errors and never loads a board", () => {
    state.error = "Service unavailable";
    room();
    expect(screen.getByRole("alert")).toHaveTextContent("Service unavailable");
    expect(screen.queryByTestId("selected-room")).not.toBeInTheDocument();
  });
  it("requests true browser fullscreen only after a click and surfaces failures", async () => {
    const request = vi.fn().mockRejectedValue(new Error("Fullscreen denied"));
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: request,
    });
    try {
      room();
      expect(request).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Enter browser fullscreen" }));
      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Fullscreen denied"));
    } finally {
      Reflect.deleteProperty(document.documentElement, "requestFullscreen");
    }
  });
});

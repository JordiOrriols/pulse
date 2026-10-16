import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import App from "@/App";

const { client, auth } = vi.hoisted(() => {
  const auth = {
    session: null as { user: { id: string; email: string } } | null,
    listener: undefined as ((event: string, session: unknown) => void) | undefined,
    workspaces: [] as { id: string; name: string; owner_id: string; access_level: string }[],
  };
  const client = {
    current: {
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        if (name === "list_workspaces") return { data: auth.workspaces, error: null };
        if (name === "create_workspace") {
          const row = {
            id: `ws-${auth.workspaces.length + 1}`,
            name: String(args["workspace_name"]),
            owner_id: "user-1",
          };
          auth.workspaces.push({ ...row, access_level: "owner" });
          return { data: row, error: null };
        }
        return { data: [], error: null };
      }),
      auth: {
        getSession: vi.fn(async () => ({ data: { session: auth.session }, error: null })),
        onAuthStateChange: vi.fn((listener: typeof auth.listener) => {
          auth.listener = listener;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        }),
        signInWithPassword: vi.fn(async () => ({ error: null })),
        signOut: vi.fn(async () => ({ error: null })),
        updateUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      },
    } as unknown,
  };
  return { client, auth };
});
vi.mock("@/data/supabaseClient", () => ({
  get supabase() {
    return client.current;
  },
}));
const supabaseAuth = (client.current as { auth: Record<string, ReturnType<typeof vi.fn>> }).auth;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );

describe("Pulse shell", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    auth.session = { user: { id: "user-1", email: "ada@example.com" } };
    auth.workspaces = [{ id: "ws-1", name: "Platform", owner_id: "user-1", access_level: "owner" }];
    localStorage.clear();
  });

  it("shows the shared header with Pulse as the current project", async () => {
    renderAt("/");
    expect(await screen.findByTestId("header-title")).toHaveTextContent("Pulse");
    await userEvent.click(screen.getByRole("button", { name: "Switch project" }));
    expect(screen.getByRole("menuitem", { name: "Pulse" })).toHaveAttribute("aria-current", "page");
  });

  it("navigates between the four sections from the shared tab bar", async () => {
    renderAt("/");
    const tabs = await screen.findByRole("navigation", { name: "Pulse pages" });
    expect(
      within(tabs)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(["Overview", "Team Pulse", "Retrospectives", "Actions"]);
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    for (const name of ["Team Pulse", "Retrospectives", "Actions"]) {
      await userEvent.click(within(tabs).getByRole("link", { name }));
      expect(within(tabs).getByRole("link", { name })).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("heading", { level: 1, name })).toBeInTheDocument();
      expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
    }
  });

  it("sends unknown routes to the overview", async () => {
    renderAt("/missing");
    expect(await screen.findByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
  });

  it("opens the first workspace from the shared workspace bar", async () => {
    renderAt("/");
    expect(await screen.findByTestId("workspace-switcher")).toHaveTextContent("Platform");
    expect(screen.getByTestId("workspace-share")).toBeInTheDocument();
    expect((client.current as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith(
      "list_workspaces",
      { app_name: "pulse" }
    );
  });

  it("asks for a workspace when the account has none, and opens the one it creates", async () => {
    auth.workspaces = [];
    renderAt("/");
    expect(await screen.findByText("No workspace yet")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Overview" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("workspace-switcher"));
    await userEvent.click(await screen.findByRole("menuitem", { name: "New workspace" }));
    await userEvent.type(screen.getByLabelText("Name"), "Mobile");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
    expect(screen.getByTestId("workspace-switcher")).toHaveTextContent("Mobile");
    expect(localStorage.getItem("pulse.workspace")).toBe("ws-1");
  });

  it("signs out from the shared header", async () => {
    renderAt("/");
    const signOut = await screen.findByRole("button", { name: "Sign out" });
    expect(signOut).toHaveAttribute("title", "ada@example.com");
    await userEvent.click(signOut);
    expect(supabaseAuth["signOut"]).toHaveBeenCalled();
    await act(async () => auth.listener?.("SIGNED_OUT", null));
    expect(
      await screen.findByRole("heading", { name: "Keep a finger on the team's pulse." })
    ).toBeInTheDocument();
  });
});

describe("Pulse sign-in", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    auth.session = null;
  });

  it("welcomes signed-out visitors instead of showing any section", async () => {
    renderAt("/retrospectives");
    expect(
      await screen.findByRole("heading", { name: "Keep a finger on the team's pulse." })
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Pulse pages" })).not.toBeInTheDocument();
    expect(screen.getByText("Collaborative retrospectives")).toBeInTheDocument();
  });

  it("signs in with the shared account and opens the app", async () => {
    renderAt("/");
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Sign in" });
    await userEvent.type(within(dialog).getByLabelText("Email"), "ada@example.com");
    await userEvent.type(within(dialog).getByLabelText("Password"), "a-long-password");
    await userEvent.click(within(dialog).getByRole("button", { name: "Sign in" }));
    expect(supabaseAuth["signInWithPassword"]).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "a-long-password",
    });
    await act(async () =>
      auth.listener?.("SIGNED_IN", { user: { id: "user-1", email: "ada@example.com" } })
    );
    expect(await screen.findByRole("navigation", { name: "Pulse pages" })).toBeInTheDocument();
  });

  it("offers account creation from the welcome page", async () => {
    renderAt("/");
    await userEvent.click(await screen.findByRole("button", { name: "Create account" }));
    expect(
      await screen.findByRole("alertdialog", { name: "Create an account" })
    ).toBeInTheDocument();
  });

  it("asks for a new password after a recovery link", async () => {
    renderAt("/");
    await screen.findByRole("button", { name: "Sign in" });
    await act(async () =>
      auth.listener?.("PASSWORD_RECOVERY", { user: { id: "user-1", email: "ada@example.com" } })
    );
    expect(
      await screen.findByRole("alertdialog", { name: "Set a new password" })
    ).toBeInTheDocument();
  });

  it("explains that sign-in needs Supabase config when the build has none", async () => {
    const configured = client.current;
    client.current = null;
    try {
      renderAt("/");
      expect(await screen.findByText(/Configure VITE_SUPABASE_URL/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    } finally {
      client.current = configured;
    }
  });
});

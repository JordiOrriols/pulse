import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import App from "@/App";

const { client, auth, pulse } = vi.hoisted(() => {
  const auth = {
    session: null as { user: { id: string; email: string } } | null,
    listener: undefined as ((event: string, session: unknown) => void) | undefined,
    workspaces: [] as { id: string; name: string; owner_id: string; access_level: string }[],
  };
  type Question = { id: string; position: number; key: string | null; prompt: string | null };
  type SurveyRow = {
    id: string;
    title: string;
    asks_comment: boolean;
    min_responses: number;
    status: string;
    created_at: string;
    closed_at: string | null;
    pulse_questions: Question[];
  };
  /** An in-memory stand-in for the Team Pulse tables and their RPCs. */
  const pulse = {
    surveys: [] as SurveyRow[],
    answered: [] as string[],
    ratings: {} as Record<string, number[][]>,
    comments: {} as Record<string, string[]>,
    reset() {
      pulse.surveys = [];
      pulse.answered = [];
      pulse.ratings = {};
      pulse.comments = {};
    },
    results() {
      return pulse.surveys.map((survey) => {
        const responses = pulse.ratings[survey.id]?.length ?? 0;
        const visible = survey.status === "closed" && responses >= survey.min_responses;
        const distribution: Record<string, number[]> = {};
        if (visible)
          survey.pulse_questions.forEach((question, index) => {
            const counts = [0, 0, 0, 0, 0];
            for (const answer of pulse.ratings[survey.id] ?? []) counts[answer[index]! - 1]!++;
            distribution[question.id] = counts;
          });
        return {
          survey_id: survey.id,
          responses,
          participants: 1,
          visible,
          distribution,
          comments: visible ? (pulse.comments[survey.id] ?? []) : [],
        };
      });
    },
  };
  const surveyRpc = (name: string, args: Record<string, unknown>) => {
    const find = () => pulse.surveys.find((survey) => survey.id === args["survey"])!;
    switch (name) {
      case "create_pulse_survey": {
        const id = `survey-${pulse.surveys.length + 1}`;
        const questions = args["questions"] as { key?: string; prompt?: string }[];
        pulse.surveys.unshift({
          id,
          title: String(args["survey_title"]),
          asks_comment: Boolean(args["with_comment"]),
          min_responses: Number(args["minimum"]),
          status: "open",
          created_at: `2026-10-${String(10 + pulse.surveys.length)}T09:00:00Z`,
          closed_at: null,
          pulse_questions: questions.map((question, position) => ({
            id: `${id}-q${position}`,
            position,
            key: question.key ?? null,
            prompt: question.prompt ?? null,
            low_label: null,
            high_label: null,
          })),
        });
        return id;
      }
      case "submit_pulse_response": {
        const survey = find();
        const ratings = args["ratings"] as Record<string, number>;
        pulse.answered.push(survey.id);
        (pulse.ratings[survey.id] ??= []).push(
          survey.pulse_questions.map((question) => ratings[question.id]!)
        );
        const comment = String(args["comment"] ?? "").trim();
        if (comment) (pulse.comments[survey.id] ??= []).push(comment);
        return null;
      }
      case "set_pulse_survey_status":
        find().status = String(args["new_status"]);
        return null;
      case "delete_pulse_survey":
        pulse.surveys = pulse.surveys.filter((survey) => survey.id !== args["survey"]);
        return null;
      case "pulse_survey_results":
        return pulse.results();
      default:
        return [];
    }
  };
  const query = (table: string) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      in: () => builder,
      then: (resolve: (value: { data: unknown; error: null }) => unknown) =>
        resolve({
          data:
            table === "pulse_surveys"
              ? pulse.surveys
              : pulse.answered.map((survey_id) => ({ survey_id })),
          error: null,
        }),
    };
    return builder;
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
        return { data: surveyRpc(name, args), error: null };
      }),
      from: vi.fn(query),
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
  return { client, auth, pulse };
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
    pulse.reset();
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
    await userEvent.click(within(tabs).getByRole("link", { name: "Team Pulse" }));
    expect(screen.getByRole("heading", { level: 1, name: "Team Pulse" })).toBeInTheDocument();
    for (const name of ["Retrospectives", "Actions"]) {
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

describe("Team Pulse surveys", () => {
  const HEALTH = "How are you feeling about the team right now?";
  const CUSTOM = "Are retros useful?";

  beforeEach(async () => {
    await i18n.changeLanguage("en");
    auth.session = { user: { id: "user-1", email: "ada@example.com" } };
    auth.workspaces = [{ id: "ws-1", name: "Platform", owner_id: "user-1", access_level: "owner" }];
    localStorage.clear();
    pulse.reset();
  });

  async function createSurvey(title: string, minimum: string) {
    await userEvent.click(await screen.findByRole("button", { name: "New survey" }));
    const dialog = await screen.findByRole("dialog", { name: "New survey" });
    await userEvent.type(within(dialog).getByLabelText("Title"), title);
    for (const key of ["delivery", "autonomy", "clarity", "workload", "collaboration"]) {
      await userEvent.click(
        within(dialog).getByRole("checkbox", { name: i18n.t(`surveys.questions.${key}.prompt`) })
      );
    }
    await userEvent.click(within(dialog).getByRole("button", { name: "Add a question" }));
    await userEvent.type(within(dialog).getByLabelText("Question 1"), CUSTOM);
    const minimumField = within(dialog).getByLabelText("Minimum responses");
    await userEvent.clear(minimumField);
    await userEvent.type(minimumField, minimum);
    await userEvent.click(within(dialog).getByRole("button", { name: "Create survey" }));
    expect(await screen.findByRole("heading", { level: 2, name: title })).toBeInTheDocument();
  }

  async function answer(health: number, custom: number, comment: string) {
    await userEvent.click(screen.getByRole("button", { name: "Answer" }));
    const dialog = await screen.findByRole("dialog");
    const send = within(dialog).getByRole("button", { name: "Send answer" });
    expect(within(dialog).getByText(/Your answer is anonymous/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByLabelText(`${health} for: ${HEALTH}`));
    expect(send).toBeDisabled();
    await userEvent.click(within(dialog).getByLabelText(`${custom} for: ${CUSTOM}`));
    await userEvent.type(
      within(dialog).getByLabelText(
        "What is the main thing helping or hurting the team right now?"
      ),
      comment
    );
    await userEvent.click(send);
    expect(await screen.findByText("You answered")).toBeInTheDocument();
  }

  it("invites managers to create the first survey", async () => {
    renderAt("/team-pulse");
    expect(await screen.findByText("No surveys yet")).toBeInTheDocument();
    expect(
      screen.getByText("Create a short survey to hear how the team is doing.")
    ).toBeInTheDocument();
  });

  it("creates a survey, answers it once and shows aggregated results after closing", async () => {
    renderAt("/team-pulse");
    await createSurvey("Sprint 24", "1");
    expect(screen.getByText(/Results appear when the survey is closed/)).toBeInTheDocument();
    await answer(4, 2, "Pairing helps");
    expect(screen.queryByRole("button", { name: "Answer" })).not.toBeInTheDocument();
    expect(pulse.surveys[0]?.pulse_questions.map((question) => question.key)).toEqual([
      "health",
      null,
    ]);

    await userEvent.click(screen.getByRole("button", { name: "Close survey" }));
    expect(await screen.findByText("Pairing helps")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText("4.0")).toBeInTheDocument();
    expect(screen.getByText("2.0")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: `Ratings 1 to 5 for ${HEALTH}: 0 / 0 / 0 / 1 / 0` }));
    expect(screen.getByText("Strongest").nextElementSibling).toHaveTextContent(HEALTH);
    expect(screen.getByText("Needs attention").nextElementSibling).toHaveTextContent(CUSTOM);
  });

  it("keeps results hidden when a closed survey has too few answers", async () => {
    renderAt("/team-pulse");
    await createSurvey("Quiet sprint", "3");
    await answer(5, 5, "Secret");
    await userEvent.click(screen.getByRole("button", { name: "Close survey" }));
    expect(
      await screen.findByText(/Only 1 answers were received and this survey needs 3/)
    ).toBeInTheDocument();
    expect(screen.queryByText("Secret")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reopen" }));
    expect(await screen.findByText("Open")).toBeInTheDocument();
  });

  it("deletes a survey after confirming", async () => {
    renderAt("/team-pulse");
    await createSurvey("Throwaway", "3");
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Delete survey?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("No surveys yet")).toBeInTheDocument();
  });

  it("lets viewers answer without managing surveys", async () => {
    auth.workspaces = [
      { id: "ws-1", name: "Platform", owner_id: "user-2", access_level: "viewer" },
    ];
    renderAt("/team-pulse");
    expect(
      await screen.findByText(
        "When a survey opens in this workspace you will be able to answer it here."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New survey" })).not.toBeInTheDocument();
  });
});

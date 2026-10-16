import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import App from "@/App";

const { client, auth, pulse, retros } = vi.hoisted(() => {
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
  type RetroTopic = {
    id: string;
    column: string;
    title: string;
    description: string | null;
    group_id: string | null;
    created_at: string;
    author: string;
  };
  type RetroGroup = {
    id: string;
    retro: string;
    title: string | null;
    created_at: string;
    summary: string | null;
    impact: string | null;
    root_causes: string | null;
    context: string | null;
    decision: string | null;
  };
  /** An in-memory stand-in for the retrospective tables, seen by ada@example.com. */
  const retros = {
    rows: [] as Record<string, unknown>[],
    topics: {} as Record<string, RetroTopic[]>,
    groups: [] as RetroGroup[],
    votes: {} as Record<string, number>,
    facilitates: true,
    counter: 0,
    reset() {
      retros.rows = [];
      retros.topics = {};
      retros.groups = [];
      retros.votes = {};
      retros.facilitates = true;
      retros.counter = 0;
    },
    stamp() {
      retros.counter += 1;
      return `2026-10-01T10:${String(retros.counter).padStart(2, "0")}:00Z`;
    },
    find(id: unknown) {
      return retros.rows.find((row) => row["id"] === id)!;
    },
    topicById(id: unknown) {
      return Object.values(retros.topics)
        .flat()
        .find((topic) => topic.id === id)!;
    },
    retroOfGroup(id: unknown) {
      return retros.groups.find((group) => group.id === id)!.retro;
    },
    addGroup(retro: string, title: string | null) {
      const group: RetroGroup = {
        id: `group-${retros.groups.length + 1}`,
        retro,
        title,
        created_at: retros.stamp(),
        summary: null,
        impact: null,
        root_causes: null,
        context: null,
        decision: null,
      };
      retros.groups.push(group);
      return group;
    },
    dropEmpty(retro: string) {
      const used = new Set(retros.topics[retro]?.map((topic) => topic.group_id));
      retros.groups = retros.groups.filter((group) => group.retro !== retro || used.has(group.id));
    },
    board(id: string) {
      const row = retros.find(id);
      const collecting = row["stage"] === "collect";
      const revealed = row["stage"] === "discuss" || row["stage"] === "closed";
      const all = retros.topics[id] ?? [];
      const visible = collecting ? all.filter((topic) => topic.author === "ada@example.com") : all;
      return {
        can_facilitate: retros.facilitates,
        topics: visible.map(({ author, ...topic }) => ({
          ...topic,
          mine: author === "ada@example.com",
          author: row["anonymous"] ? null : author,
        })),
        hidden_topics: collecting ? all.length - visible.length : 0,
        groups: retros.groups
          .filter((group) => group.retro === id)
          .map(({ retro: _retro, ...group }) => ({
            ...group,
            votes: revealed ? (retros.votes[group.id] ?? 0) : null,
            my_votes: retros.votes[group.id] ?? 0,
          })),
        voters: Object.values(retros.votes).some((votes) => votes > 0) ? 1 : 0,
      };
    },
  };
  const retroRpc = (name: string, args: Record<string, unknown>) => {
    const text = (key: string) => String(args[key] ?? "").trim() || null;
    switch (name) {
      case "create_pulse_retro": {
        const id = `retro-${retros.rows.length + 1}`;
        retros.rows.unshift({
          id,
          title: args["retro_title"],
          held_on: args["held"],
          period: text("retro_period"),
          goal: text("retro_goal"),
          template: args["retro_template"],
          anonymous: args["is_anonymous"],
          votes_per_person: args["votes"],
          stage: "prepare",
          created_at: retros.stamp(),
          closed_at: null,
        });
        return id;
      }
      case "delete_pulse_retro":
        retros.rows = retros.rows.filter((row) => row["id"] !== args["retro"]);
        return null;
      case "set_pulse_retro_stage": {
        const id = String(args["retro"]);
        if (args["new_stage"] === "vote")
          for (const topic of retros.topics[id] ?? [])
            topic.group_id ??= retros.addGroup(id, null).id;
        retros.find(id)["stage"] = args["new_stage"];
        return null;
      }
      case "add_pulse_topic": {
        const id = String(args["retro"]);
        const topic = {
          id: `topic-${retros.stamp()}`,
          column: String(args["topic_column"]),
          title: String(args["topic_title"]),
          description: text("topic_description"),
          group_id: null,
          created_at: retros.stamp(),
          author: "ada@example.com",
        };
        (retros.topics[id] ??= []).push(topic);
        return topic.id;
      }
      case "update_pulse_topic":
        Object.assign(retros.topicById(args["topic"]), {
          column: args["topic_column"],
          title: args["topic_title"],
          description: text("topic_description"),
        });
        return null;
      case "delete_pulse_topic":
        for (const [id, topics] of Object.entries(retros.topics))
          retros.topics[id] = topics.filter((topic) => topic.id !== args["topic"]);
        return null;
      case "create_pulse_group": {
        const id = String(args["retro"]);
        const group = retros.addGroup(id, text("group_title"));
        for (const topic of args["topics"] as string[]) retros.topicById(topic).group_id = group.id;
        retros.dropEmpty(id);
        return group.id;
      }
      case "move_pulse_topic": {
        const topic = retros.topicById(args["topic"]);
        topic.group_id = (args["grp"] as string | null) ?? null;
        for (const [id, topics] of Object.entries(retros.topics))
          if (topics.includes(topic)) retros.dropEmpty(id);
        return null;
      }
      case "rename_pulse_group":
        retros.groups.find((group) => group.id === args["grp"])!.title = text("group_title");
        return null;
      case "merge_pulse_groups": {
        const retro = retros.retroOfGroup(args["source"]);
        for (const topic of retros.topics[retro] ?? [])
          if (topic.group_id === args["source"]) topic.group_id = String(args["destination"]);
        retros.dropEmpty(retro);
        return null;
      }
      case "ungroup_pulse_group": {
        const retro = retros.retroOfGroup(args["grp"]);
        for (const topic of retros.topics[retro] ?? [])
          if (topic.group_id === args["grp"]) topic.group_id = null;
        retros.dropEmpty(retro);
        return null;
      }
      case "set_pulse_vote":
        retros.votes[String(args["grp"])] = Number(args["votes"]);
        return null;
      case "update_pulse_discussion":
        Object.assign(
          retros.groups.find((group) => group.id === args["grp"])!,
          {
            summary: text("group_summary"),
            impact: text("group_impact"),
            root_causes: text("group_root_causes"),
            context: text("group_context"),
            decision: args["group_decision"],
          }
        );
        return null;
      case "pulse_retro_board":
        return retros.board(String(args["retro"]));
      default:
        return undefined;
    }
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
            table === "pulse_retros"
              ? retros.rows
              : table === "pulse_surveys"
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
        return { data: retroRpc(name, args) ?? surveyRpc(name, args), error: null };
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
  return { client, auth, pulse, retros };
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
    retros.reset();
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
    await userEvent.click(within(tabs).getByRole("link", { name: "Retrospectives" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Retrospectives" })
    ).toBeInTheDocument();
    for (const name of ["Actions"]) {
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

describe("Retrospectives", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    auth.session = { user: { id: "user-1", email: "ada@example.com" } };
    auth.workspaces = [{ id: "ws-1", name: "Platform", owner_id: "user-1", access_level: "owner" }];
    localStorage.clear();
    retros.reset();
  });

  const next = async (stage: string) => {
    await userEvent.click(screen.getByRole("button", { name: stage }));
    expect(await screen.findByRole("listitem", { current: "step" })).toBeInTheDocument();
  };
  const currentStage = () =>
    screen.getByRole("list", { name: "Retrospective stages" }).querySelector("[aria-current]");

  async function createRetro(anonymous = true) {
    await userEvent.click(await screen.findByRole("button", { name: "New retrospective" }));
    const dialog = await screen.findByRole("dialog", { name: "New retrospective" });
    await userEvent.type(within(dialog).getByLabelText("Title"), "Sprint 24");
    await userEvent.type(within(dialog).getByLabelText("Goal"), "Ship calmer");
    if (!anonymous) await userEvent.click(within(dialog).getByLabelText(/Anonymous topics/));
    const votes = within(dialog).getByLabelText("Votes per person");
    await userEvent.clear(votes);
    await userEvent.type(votes, "2");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create retrospective" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Sprint 24" })).toBeInTheDocument();
  }

  async function addTopic(column: string, title: string) {
    await userEvent.type(screen.getByLabelText(`New topic in ${column}`), title);
    const section = screen.getByRole("region", { name: column });
    await userEvent.click(within(section).getByRole("button", { name: "Add" }));
    expect(await within(section).findByText(title)).toBeInTheDocument();
  }

  it("invites managers to plan the first retrospective", async () => {
    renderAt("/retrospectives");
    expect(await screen.findByText("No retrospectives yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New retrospective" })).toBeInTheDocument();
  });

  it("guides the team from collecting topics to a closing summary", async () => {
    renderAt("/retrospectives");
    await createRetro();
    expect(retros.rows[0]).toMatchObject({
      template: "well_improve",
      anonymous: true,
      votes_per_person: 2,
    });
    expect(screen.getByText("Ship calmer")).toBeInTheDocument();
    expect(currentStage()).toHaveTextContent("Prepare");

    await next("Start Collect");
    retros.topics["retro-1"] = [
      {
        id: "topic-other",
        column: "to_improve",
        title: "Flaky CI",
        description: null,
        group_id: null,
        created_at: "2026-10-01T09:00:00Z",
        author: "grace@example.com",
      },
    ];
    await addTopic("Went well", "Pairing");
    await addTopic("To improve", "Slow reviews");
    expect(
      screen.getByText("1 topic from others stays hidden until grouping.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Flaky CI")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Edit “Slow reviews”" }));
    const edit = screen.getByDisplayValue("Slow reviews");
    await userEvent.clear(edit);
    await userEvent.type(edit, "Late reviews");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Late reviews")).toBeInTheDocument();

    await next("Start Group");
    expect(await screen.findByText("Flaky CI")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Move “Late reviews” to"), "New group");
    const group = await screen.findByRole("region", { name: "Late reviews" });
    await userEvent.selectOptions(screen.getByLabelText("Move “Flaky CI” to"), "Late reviews");
    expect(await within(group).findByText("Flaky CI")).toBeInTheDocument();
    const name = within(group).getByRole("textbox", { name: /^Name of/ });
    await userEvent.type(name, "Delivery flow{Enter}");
    expect(await screen.findByRole("region", { name: "Delivery flow" })).toBeInTheDocument();

    await next("Start Vote");
    expect(retros.groups).toHaveLength(2);
    expect(screen.getByText("2 of 2 votes left")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add a vote to Delivery flow" }));
    expect(await screen.findByText("1 of 2 votes left")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add a vote to Delivery flow" }));
    expect(await screen.findByText("0 of 2 votes left")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add a vote to Pairing" })).toBeDisabled();

    await next("Start Discuss");
    const ranked = screen.getAllByRole("listitem", { name: /Delivery flow|Pairing/ });
    expect(ranked.map((item) => item.getAttribute("aria-label"))).toEqual([
      "Delivery flow",
      "Pairing",
    ]);
    expect(within(ranked[0]!).getByText("2 votes")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Take notes on Delivery flow" }));
    await userEvent.type(screen.getByLabelText("Root causes"), "Reviews wait for one person");
    await userEvent.click(screen.getByLabelText("Take action"));
    await userEvent.click(screen.getByRole("button", { name: "Save notes" }));
    expect(await screen.findByText("Reviews wait for one person")).toBeInTheDocument();

    await next("Close retrospective");
    expect(currentStage()).toHaveTextContent("Closed");
    expect(screen.getByRole("heading", { name: "Most voted" })).toBeInTheDocument();
    expect(screen.getAllByText("Take action").length).toBeGreaterThan(0);
    expect(screen.getByText("Voters").nextElementSibling).toHaveTextContent("1");
  });

  it("shows authors only when topics are not anonymous", async () => {
    renderAt("/retrospectives");
    await createRetro(false);
    await next("Start Collect");
    await addTopic("Ideas", "Mob on Fridays");
    expect(screen.getByText("ada@example.com", { selector: "p" })).toBeInTheDocument();
  });

  it("lets participants follow along without facilitating", async () => {
    auth.workspaces = [
      { id: "ws-1", name: "Platform", owner_id: "user-2", access_level: "viewer" },
    ];
    retros.facilitates = false;
    retroRpcSeed();
    renderAt("/retrospectives");
    expect(
      await screen.findByRole("heading", { level: 2, name: "Team retro" })
    ).toBeInTheDocument();
    expect(
      await screen.findByText("The facilitator will open the board soon.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New retrospective" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Start / })).not.toBeInTheDocument();
  });

  function retroRpcSeed() {
    retros.rows = [
      {
        id: "retro-9",
        title: "Team retro",
        held_on: "2026-10-01",
        period: null,
        goal: null,
        template: "open",
        anonymous: true,
        votes_per_person: 3,
        stage: "prepare",
        created_at: "2026-10-01T08:00:00Z",
        closed_at: null,
      },
    ];
  }
});

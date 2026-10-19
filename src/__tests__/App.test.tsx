import React from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import App from "@/App";

const { client, auth, pulse, retros, actions } = vi.hoisted(() => {
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
      const revealed = ["discuss", "actions", "closed"].includes(String(row["stage"]));
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
        Object.assign(retros.find(id), {
          stage: args["new_stage"],
          closed_at: args["new_stage"] === "closed" ? retros.stamp() : null,
        });
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
  type ActionRow = Record<string, unknown> & { id: string; status: string; owner_id: string };
  /** An in-memory stand-in for improvement actions, as the workspace owner sees them. */
  const actions = {
    rows: [] as ActionRow[],
    updates: {} as Record<string, Record<string, unknown>[]>,
    people: [
      { user_id: "user-1", email: "ada@example.com" },
      { user_id: "user-2", email: "grace@example.com" },
    ],
    canManage: true,
    reset() {
      actions.rows = [];
      actions.updates = {};
      actions.canManage = true;
    },
    email(id: unknown) {
      return actions.people.find((person) => person.user_id === id)?.email ?? null;
    },
    log(id: string, kind: string, extra: Record<string, unknown> = {}) {
      (actions.updates[id] ??= []).push({
        id: `update-${retros.stamp()}`,
        kind,
        status: null,
        note: null,
        author_email: "ada@example.com",
        created_at: retros.stamp(),
        ...extra,
      });
    },
    fields(args: Record<string, unknown>) {
      const text = (key: string) => String(args[key] ?? "").trim() || null;
      return {
        title: String(args["action_title"]).trim(),
        description: text("action_description"),
        owner_id: String(args["action_owner"]),
        owner_email: actions.email(args["action_owner"]),
        collaborators: (args["collaborators"] as string[]).map((id) => ({
          id,
          email: actions.email(id),
        })),
        due_on: args["due"] ?? null,
        priority: args["action_priority"] ?? "medium",
        success_criteria: text("criteria"),
      };
    },
    list() {
      return actions.rows.map((row) => {
        const retro = retros.rows.find((other) => other["id"] === row["retro_id"]);
        return {
          ...row,
          retro_title: retro?.["title"] ?? null,
          retro_held_on: retro?.["held_on"] ?? null,
          group_title: null,
          can_manage: actions.canManage,
          can_update: actions.canManage || row.owner_id === "user-1",
        };
      });
    },
  };
  const actionRpc = (name: string, args: Record<string, unknown>) => {
    const find = () => actions.rows.find((row) => row.id === args["action"])!;
    switch (name) {
      case "pulse_workspace_people":
        return actions.people;
      case "list_pulse_actions":
        return actions.list();
      case "pulse_action_history":
        return actions.updates[String(args["action"])] ?? [];
      case "create_pulse_action": {
        const id = `action-${actions.rows.length + 1}`;
        actions.rows.push({
          id,
          retro_id: args["retro"] ?? null,
          group_id: args["grp"] ?? null,
          ...actions.fields(args),
          status: "open",
          outcome: null,
          helped: null,
          follow_up: null,
          created_at: retros.stamp(),
          completed_at: null,
        });
        actions.log(id, "created");
        return id;
      }
      case "update_pulse_action":
        Object.assign(find(), actions.fields(args));
        actions.log(find().id, "edited");
        return null;
      case "set_pulse_action_status": {
        const status = String(args["new_status"]);
        Object.assign(find(), {
          status,
          completed_at: status === "done" ? new Date().toISOString() : null,
        });
        actions.log(find().id, "status", { status });
        return null;
      }
      case "add_pulse_action_note":
        actions.log(find().id, "note", { note: args["action_note"] });
        return null;
      case "record_pulse_action_outcome":
        Object.assign(find(), {
          outcome: String(args["action_outcome"] ?? "").trim() || null,
          helped: args["did_help"],
          follow_up: String(args["action_follow_up"] ?? "").trim() || null,
        });
        actions.log(find().id, "outcome");
        return null;
      case "delete_pulse_action":
        actions.rows = actions.rows.filter((row) => row.id !== args["action"]);
        return null;
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
    link: null as unknown,
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
        return {
          data: retroRpc(name, args) ?? actionRpc(name, args) ?? surveyRpc(name, args),
          error: null,
        };
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
        setSession: vi.fn(async () => {
          auth.session = { user: { id: "user-1", email: "ada@example.com" } };
          auth.listener?.("SIGNED_IN", auth.session);
          return { data: { session: auth.session }, error: null };
        }),
      },
    } as unknown,
  };
  return { client, auth, pulse, retros, actions };
});
vi.mock("@/data/supabaseClient", () => ({
  get supabase() {
    return client.current;
  },
  get authCallback() {
    return client.link;
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
    actions.reset();
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
    await userEvent.click(within(tabs).getByRole("link", { name: "Actions" }));
    expect(within(tabs).getByRole("link", { name: "Actions" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("heading", { level: 1, name: "Actions" })).toBeInTheDocument();
    expect(await screen.findByText("No improvement actions yet")).toBeInTheDocument();
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
    client.link = null;
  });

  it("asks for a new password after a recovery link that carries its tokens in the hash", async () => {
    client.link = { kind: "session", accessToken: "at", refreshToken: "rt", recovery: true };
    renderAt("/");
    expect(
      await screen.findByRole("alertdialog", { name: "Set a new password" })
    ).toBeInTheDocument();
    expect(supabaseAuth["setSession"]).toHaveBeenCalledWith({
      access_token: "at",
      refresh_token: "rt",
    });
  });

  it("says why a sign-in link did not work instead of ignoring it", async () => {
    client.link = { kind: "error", message: "Email link is invalid or has expired" };
    renderAt("/");
    expect(
      await screen.findByText(
        "This link did not work: Email link is invalid or has expired. Ask for a new one from Sign in."
      )
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
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

  it("opens the survey named in the link", async () => {
    const row = (id: string, title: string, status: string) => ({
      id,
      title,
      asks_comment: false,
      min_responses: 1,
      status,
      created_at: `2026-10-0${id.slice(-1)}T09:00:00Z`,
      closed_at: null,
      pulse_questions: [],
    });
    pulse.surveys = [row("survey-2", "Current", "open"), row("survey-1", "Earlier", "closed")];
    renderAt("/team-pulse?survey=survey-1");
    expect(await screen.findByRole("heading", { level: 2, name: "Earlier" })).toBeInTheDocument();
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
    actions.reset();
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

  it("opens an active retrospective in a distraction-free room", async () => {
    retroRpcSeed();
    renderAt("/retrospectives");
    await userEvent.click(await screen.findByRole("link", { name: "Open fullscreen" }));
    expect(await screen.findByRole("heading", { name: "Team retro" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Pulse pages" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Retrospectives" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share fullscreen link" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Back to retrospectives" }));
    expect(await screen.findByRole("navigation", { name: "Pulse pages" })).toBeVisible();
  });

  it("never substitutes a different retrospective for a missing room link", async () => {
    retroRpcSeed();
    renderAt("/workspaces/ws-1/retrospectives/missing");
    expect(await screen.findByText("Retrospective unavailable")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Team retro" })).not.toBeInTheDocument();
  });

  it("does not offer a fullscreen link for a closed retrospective", async () => {
    retroRpcSeed();
    retros.rows[0]!["stage"] = "closed";
    retros.rows[0]!["closed_at"] = "2026-10-01T10:00:00Z";
    renderAt("/retrospectives");
    expect(await screen.findByRole("heading", { name: "Team retro" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Open fullscreen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share fullscreen link" })).not.toBeInTheDocument();
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

    await next("Start Actions");
    const chosen = screen
      .getAllByRole("listitem")
      .find((item) => within(item).queryByRole("heading", { name: "Delivery flow" }))!;
    expect(within(chosen).getByText("Take action")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add an action for Delivery flow" }));
    const dialog = await screen.findByRole("dialog", { name: "New action" });
    expect(within(dialog).getByText("For Delivery flow")).toBeInTheDocument();
    const create = within(dialog).getByRole("button", { name: "Create action" });
    await userEvent.type(within(dialog).getByLabelText("Action"), "Rotate reviewers");
    expect(create).toBeDisabled();
    await userEvent.selectOptions(within(dialog).getByLabelText("Owner"), "grace@example.com");
    await userEvent.type(within(dialog).getByLabelText("Due date"), "2026-10-30");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "ada@example.com" }));
    await userEvent.click(create);
    expect(
      await within(chosen).findByRole("article", { name: "Rotate reviewers" })
    ).toBeInTheDocument();
    expect(actions.rows[0]).toMatchObject({
      retro_id: "retro-1",
      group_id: retros.groups.find((group) => group.title === "Delivery flow")!.id,
      owner_id: "user-2",
      due_on: "2026-10-30",
      collaborators: [{ id: "user-1", email: "ada@example.com" }],
    });

    await next("Close retrospective");
    expect(currentStage()).toHaveTextContent("Closed");
    expect(screen.getByRole("heading", { name: "Most voted" })).toBeInTheDocument();
    expect(screen.getAllByText("Take action").length).toBeGreaterThan(0);
    expect(screen.getByText("Voters").nextElementSibling).toHaveTextContent("1");
    const agreed = screen.getByRole("region", { name: "Agreed actions" });
    expect(within(agreed).getByRole("article", { name: "Rotate reviewers" })).toHaveTextContent(
      "grace@example.com"
    );
  });

  it("reviews earlier actions while preparing the next retrospective", async () => {
    retroRpcSeed();
    retros.rows.push({
      ...retros.rows[0],
      id: "retro-8",
      title: "Previous retro",
      held_on: "2026-09-15",
      stage: "closed",
      created_at: "2026-09-15T08:00:00Z",
      closed_at: "2026-09-15T10:00:00Z",
    });
    const base = {
      retro_id: "retro-8",
      group_id: null,
      description: null,
      owner_id: "user-1",
      owner_email: "ada@example.com",
      collaborators: [],
      due_on: "2026-09-20",
      priority: "high",
      success_criteria: null,
      outcome: null,
      helped: null,
      follow_up: null,
      created_at: "2026-09-15T09:00:00Z",
      completed_at: null,
    };
    actions.rows = [
      { ...base, id: "action-1", title: "Write a review guide", status: "in_progress" },
      {
        ...base,
        id: "action-2",
        title: "Pair on releases",
        status: "done",
        completed_at: "2026-09-25T09:00:00Z",
      },
    ];
    renderAt("/retrospectives");
    const open = await screen.findByRole("region", { name: "Still open" });
    const late = within(open).getByRole("article", { name: "Write a review guide" });
    expect(late).toHaveTextContent("Overdue");
    expect(late).toHaveTextContent("From Previous retro");
    const done = screen.getByRole("region", { name: "Done since the last retrospective" });
    expect(within(done).getByRole("article", { name: "Pair on releases" })).toBeInTheDocument();

    await userEvent.selectOptions(
      within(late).getByLabelText("Status of “Write a review guide”"),
      "Done"
    );
    expect(
      await within(
        await screen.findByRole("region", { name: "Done since the last retrospective" })
      ).findByRole("article", { name: "Write a review guide" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Still open" })).not.toBeInTheDocument();
  });

  it("opens the retrospective named in the link", async () => {
    retroRpcSeed();
    retros.rows.push({
      ...retros.rows[0],
      id: "retro-8",
      title: "Previous retro",
      held_on: "2026-09-15",
      stage: "closed",
      closed_at: "2026-09-15T10:00:00Z",
    });
    renderAt("/retrospectives?retro=retro-8");
    expect(
      await screen.findByRole("heading", { level: 2, name: "Previous retro" })
    ).toBeInTheDocument();
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

describe("Improvement actions", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    auth.session = { user: { id: "user-1", email: "ada@example.com" } };
    auth.workspaces = [{ id: "ws-1", name: "Platform", owner_id: "user-1", access_level: "owner" }];
    localStorage.clear();
    retros.reset();
    actions.reset();
  });

  const row = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
    id,
    title,
    retro_id: null,
    group_id: null,
    description: null,
    owner_id: "user-1",
    owner_email: "ada@example.com",
    collaborators: [],
    due_on: null,
    priority: "medium",
    status: "open",
    success_criteria: null,
    outcome: null,
    helped: null,
    follow_up: null,
    created_at: "2026-09-01T09:00:00Z",
    completed_at: null,
    ...extra,
  });
  const titles = () =>
    screen.getAllByRole("article").map((article) => article.getAttribute("aria-label"));

  it("invites managers to add the first action", async () => {
    renderAt("/actions");
    expect(await screen.findByText("No improvement actions yet")).toBeInTheDocument();
    expect(
      screen.getByText("Agree on actions at the end of a retrospective, or add one here.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New action" })).toBeInTheDocument();
  });

  it("follows an action from creation to a recorded outcome", async () => {
    renderAt("/actions");
    await userEvent.click(await screen.findByRole("button", { name: "New action" }));
    const dialog = await screen.findByRole("dialog", { name: "New action" });
    await userEvent.type(within(dialog).getByLabelText("Action"), "Automate release notes");
    await userEvent.selectOptions(within(dialog).getByLabelText("Owner"), "ada@example.com");
    await userEvent.selectOptions(within(dialog).getByLabelText("Priority"), "High");
    await userEvent.type(within(dialog).getByLabelText("Success criteria"), "No manual notes");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create action" }));

    const findCard = () => screen.findByRole("article", { name: "Automate release notes" });
    let card = await findCard();
    expect(actions.rows[0]).toMatchObject({ retro_id: null, priority: "high", owner_id: "user-1" });
    expect(card).toHaveTextContent("High priority");
    expect(card).toHaveTextContent("No manual notes");
    expect(screen.getByText("Open", { selector: "dt" }).nextElementSibling).toHaveTextContent("1");

    await userEvent.selectOptions(
      within(card).getByLabelText("Status of “Automate release notes”"),
      "In progress"
    );
    expect(
      await screen.findByRole("heading", { level: 2, name: /^In progress/ })
    ).toBeInTheDocument();
    card = await findCard();

    await userEvent.click(within(card).getByRole("button", { name: "History" }));
    const history = await within(card).findByRole("region", {
      name: "History of “Automate release notes”",
    });
    expect(
      await within(history).findByText(/ada@example.com created the action/)
    ).toBeInTheDocument();
    expect(within(history).getByText(/moved it to In progress/)).toBeInTheDocument();
    await userEvent.type(
      within(history).getByLabelText("Add a note to “Automate release notes”"),
      "Draft script ready"
    );
    await userEvent.click(within(history).getByRole("button", { name: "Add note" }));
    expect(await within(history).findByText("Draft script ready")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Status"), "all");
    await userEvent.selectOptions(
      within(card).getByLabelText("Status of “Automate release notes”"),
      "Done"
    );
    await screen.findByRole("heading", { level: 2, name: /^Done/ });
    card = await findCard();
    await userEvent.click(await within(card).findByRole("button", { name: "Record outcome" }));
    await userEvent.type(within(card).getByLabelText("Outcome"), "Notes write themselves");
    await userEvent.click(within(card).getByLabelText("It helped"));
    await userEvent.click(within(card).getByRole("button", { name: "Save outcome" }));
    expect(await within(card).findByText("Notes write themselves")).toBeInTheDocument();
    expect(within(card).getByText("Helped")).toBeInTheDocument();
    expect(actions.rows[0]).toMatchObject({ status: "done", helped: true });
    expect(screen.getByText("Done in the last 14 days").nextElementSibling).toHaveTextContent("1");
  });

  it("filters, groups and edits actions", async () => {
    retroRpcSeedWithHistory();
    actions.rows = [
      row("a1", "Fix flaky tests", { due_on: "2020-01-01", retro_id: "retro-1" }),
      row("a2", "Pair on releases", {
        owner_id: "user-2",
        owner_email: "grace@example.com",
        status: "in_progress",
      }),
      row("a3", "Old idea", { status: "cancelled" }),
    ];
    renderAt("/actions");
    expect(await screen.findByRole("article", { name: "Fix flaky tests" })).toHaveTextContent(
      "Overdue"
    );
    expect(titles()).toEqual(["Fix flaky tests", "Pair on releases"]);
    expect(screen.getByText("Overdue", { selector: "dt" }).nextElementSibling).toHaveTextContent(
      "1"
    );

    await userEvent.selectOptions(screen.getByLabelText("Owner"), "grace@example.com");
    expect(titles()).toEqual(["Pair on releases"]);
    await userEvent.selectOptions(screen.getByLabelText("Due"), "overdue");
    expect(screen.getByText("No actions match these filters.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    await userEvent.selectOptions(screen.getByLabelText("Status"), "all");
    expect(titles()).toHaveLength(3);

    await userEvent.selectOptions(screen.getByLabelText("Group by"), "retro");
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)
    ).toEqual(["Sprint 11", "Not from a retrospective2"]);

    await userEvent.click(screen.getByRole("button", { name: "Edit “Pair on releases”" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit action" });
    const title = within(dialog).getByLabelText("Action");
    await userEvent.clear(title);
    await userEvent.type(title, "Pair on every release");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save action" }));
    expect(
      await screen.findByRole("article", { name: "Pair on every release" })
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete “Old idea”" }));
    await userEvent.click(await screen.findByRole("button", { name: "Delete action" }));
    await screen.findByText("Pair on every release");
    expect(screen.queryByRole("article", { name: "Old idea" })).not.toBeInTheDocument();
  });

  it("lets viewers update only the actions they own", async () => {
    auth.workspaces = [
      { id: "ws-1", name: "Platform", owner_id: "user-2", access_level: "viewer" },
    ];
    actions.canManage = false;
    actions.rows = [
      row("a1", "My action"),
      row("a2", "Someone else's", { owner_id: "user-2", owner_email: "grace@example.com" }),
    ];
    renderAt("/actions");
    const mine = await screen.findByRole("article", { name: "My action" });
    const theirs = screen.getByRole("article", { name: "Someone else's" });
    expect(within(mine).getByLabelText("Status of “My action”")).toBeInTheDocument();
    expect(within(theirs).queryByRole("combobox")).not.toBeInTheDocument();
    expect(within(theirs).getByText("Open")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New action" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit “/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Delete “/ })).not.toBeInTheDocument();
  });

  function retroRpcSeedWithHistory() {
    retros.rows = [
      {
        id: "retro-1",
        title: "Sprint 1",
        held_on: "2026-09-01",
        period: null,
        goal: null,
        template: "open",
        anonymous: true,
        votes_per_person: 3,
        stage: "closed",
        created_at: "2026-09-01T08:00:00Z",
        closed_at: "2026-09-01T10:00:00Z",
      },
    ];
  }
});

describe("Team overview", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    auth.session = { user: { id: "user-1", email: "ada@example.com" } };
    auth.workspaces = [{ id: "ws-1", name: "Platform", owner_id: "user-1", access_level: "owner" }];
    localStorage.clear();
    pulse.reset();
    retros.reset();
    actions.reset();
  });

  const region = (name: string) => screen.getByRole("region", { name });

  it("points to each part of Pulse while the workspace is empty", async () => {
    renderAt("/");
    expect(
      await screen.findByText(/No survey results yet/, undefined, { timeout: 3000 })
    ).toBeInTheDocument();
    expect(
      within(region("Current retrospective")).getByRole("link", { name: "Plan a retrospective" })
    ).toHaveAttribute("href", "/retrospectives");
    expect(screen.getByText("Closed retrospectives show up here.")).toBeInTheDocument();
    expect(
      screen.getByText("No topic has come up in more than one retrospective.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No action has stayed open through two retrospectives.")
    ).toBeInTheDocument();
    expect(screen.getByText("Trends appear after two surveys with results.")).toBeInTheDocument();
  });

  it("summarises health, the current retrospective, actions and recurring problems", async () => {
    const survey = (id: string, title: string, created: string) => ({
      id,
      title,
      asks_comment: false,
      min_responses: 1,
      status: "closed",
      created_at: created,
      closed_at: created,
      pulse_questions: [
        {
          id: `${id}-health`,
          position: 0,
          key: "health",
          prompt: null,
          low_label: null,
          high_label: null,
        },
        {
          id: `${id}-workload`,
          position: 1,
          key: "workload",
          prompt: null,
          low_label: null,
          high_label: null,
        },
      ],
    });
    pulse.surveys = [
      survey("survey-2", "October pulse", "2026-10-02T09:00:00Z"),
      survey("survey-1", "September pulse", "2026-09-02T09:00:00Z"),
    ];
    pulse.ratings = { "survey-1": [[4, 3]], "survey-2": [[4, 2]] };

    const retro = (id: string, title: string, held: string, stage = "closed") => ({
      id,
      title,
      held_on: held,
      period: null,
      goal: stage === "closed" ? null : "Calmer releases",
      template: "well_improve",
      anonymous: true,
      votes_per_person: 3,
      stage,
      created_at: `${held}T08:00:00Z`,
      closed_at: stage === "closed" ? `${held}T10:00:00Z` : null,
    });
    retros.rows = [
      retro("retro-d", "Sprint D", "2026-10-14", "vote"),
      retro("retro-c", "Sprint C", "2026-10-01"),
      retro("retro-b", "Sprint B", "2026-09-15"),
      retro("retro-a", "Sprint A", "2026-09-01"),
    ];
    const topic = (id: string, group: string, title: string) => ({
      id,
      column: "to_improve",
      title,
      description: null,
      group_id: group,
      created_at: "2026-09-01T09:00:00Z",
      author: "ada@example.com",
    });
    retros.topics = {
      "retro-a": [topic("t-a", "g-a", "Slow reviews")],
      "retro-b": [topic("t-b", "g-b", "Flaky tests")],
      "retro-c": [topic("t-c", "g-c", "slow reviews!"), topic("t-c2", "g-c2", "Deploys")],
    };
    retros.groups = ["a", "b", "c", "c2"].map((key) => ({
      id: `g-${key}`,
      retro: `retro-${key.charAt(0)}`,
      title: null,
      created_at: "2026-09-01T09:00:00Z",
      summary: null,
      impact: null,
      root_causes: null,
      context: null,
      decision: key === "c" ? "action" : null,
    }));
    retros.votes = { "g-c": 2 };

    const action = (id: string, title: string, extra: Record<string, unknown>) => ({
      id,
      title,
      retro_id: null,
      group_id: null,
      description: null,
      owner_id: "user-1",
      owner_email: "ada@example.com",
      collaborators: [],
      due_on: null,
      priority: "medium",
      status: "open",
      success_criteria: null,
      outcome: null,
      helped: null,
      follow_up: null,
      created_at: "2026-10-10T09:00:00Z",
      completed_at: null,
      ...extra,
    });
    actions.rows = [
      action("action-1", "Write a review guide", { retro_id: "retro-a" }),
      action("action-2", "Fix the flaky suite", { due_on: "2020-01-01" }),
      action("action-3", "Pair on releases", {
        retro_id: "retro-c",
        status: "done",
        helped: true,
        completed_at: "2026-10-05T09:00:00Z",
      }),
    ];

    renderAt("/");
    const health = await screen.findByRole("region", { name: "Team health" }, { timeout: 3000 });
    expect(within(health).getByText(/From “October pulse”/)).toBeInTheDocument();
    const scores = within(health).getByRole("list", { name: "Latest scores" });
    expect(within(scores).getAllByRole("listitem")).toHaveLength(2);
    const concerns = within(health).getByRole("list", { name: "Worth discussing" });
    expect(concerns).toHaveTextContent(i18n.t("surveys.questions.workload.prompt"));
    expect(concerns).toHaveTextContent(/1\.0 since the previous survey/);
    expect(concerns).not.toHaveTextContent(i18n.t("surveys.questions.health.prompt"));
    expect(within(health).getByRole("link", { name: /See results/ })).toHaveAttribute(
      "href",
      "/team-pulse?survey=survey-2"
    );

    const current = region("Current retrospective");
    expect(current).toHaveTextContent("Sprint D");
    expect(within(current).getByRole("img", { name: "Stage 4 of 7: Vote" })).toBeInTheDocument();

    const tracked = region("Improvement actions");
    expect(within(tracked).getByText("Overdue", { selector: "dt" }).nextSibling).toHaveTextContent(
      "1"
    );
    expect(within(tracked).getByRole("list", { name: "Overdue" })).toHaveTextContent(
      "Fix the flaky suite"
    );
    expect(within(tracked).getByText("Done since “Sprint C”").nextSibling).toHaveTextContent("1");
    expect(within(tracked).getByRole("list", { name: "Recently done" })).toHaveTextContent(
      "Pair on releasesHelped"
    );

    const recent = await screen.findByRole("region", { name: "Recent retrospectives" });
    expect(
      within(recent)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(["Sprint C", "Sprint B", "Sprint A"]);
    expect(recent).toHaveTextContent("Topics 2 · Decisions 1 · Actions 1");
    expect(recent).toHaveTextContent("Most voted: slow reviews!");
    expect(region("Recurring topics")).toHaveTextContent("slow reviews!In Sprint C, Sprint A");
    expect(region("Actions that stay open")).toHaveTextContent(
      "Write a review guideOpen through 2 retrospectives"
    );
    expect(
      within(region("Health over time")).getAllByRole("img", {
        name: /Trend over the last 2 surveys/,
      })
    ).toHaveLength(2);

    await userEvent.click(within(current).getByRole("link", { name: "Resume" }));
    expect(await screen.findByRole("heading", { level: 2, name: "Sprint D" })).toBeInTheDocument();
  });
});

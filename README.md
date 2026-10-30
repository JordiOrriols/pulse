# Pulse

Team health and continuous improvement: short Team Pulse surveys,
guided retrospectives and improvement actions tracked until they are done.
The product brief is in [DEFINITION.md](./DEFINITION.md).

Pulse is a sibling of Planner and Ladders and is built the same way:
React 18, Vite, Tailwind 4, i18next (en, es, ca, fr, de, it) and the shared
`@jordiorriols/ui` package for the header, project switcher, tabs and tokens.
UI `^0.3.22` is installed from GitHub Packages. Header, project-menu and
login/welcome icons reuse the shared purple Pulse branding through `projectId`
and `ProjectIcon`; no local palette is maintained.

Action forms, status/filter controls and retrospective move/merge dropdowns use
UI's shared `SelectField` listbox, including inside modals. Workspace sharing uses
the same component. Account tooltips reuse UI's `getDisplayName` rather than full emails.

## Status

Team Pulse surveys, guided retrospectives, improvement actions and the team
overview work end to end.

## Sign-in

Pulse uses the same Supabase project and accounts as Planner and Ladders.
Signed-out visitors see the shared `WelcomeScreen`; sign in, sign up, GitHub,
password reset and sign out come from `@jordiorriols/ui` (`useSupabaseAuth`,
`LoginDialog`, `PasswordResetDialog`). Auth emails return to Pulse through the
`auth_app=pulse` redirect. Copy `.env.example` to `.env` with the Supabase URL
and publishable key; without them the welcome page explains that sign-in is not
configured.

## Workspaces

Like Planner and Ladders, Pulse works inside a workspace. The shared
`WorkspaceBar` next to the tabs lists the workspaces the account can open in
Pulse (`list_workspaces('pulse')`), creates new ones and lets the owner share a
workspace per app. `WorkspaceProvider` (`useWorkspace()`) exposes the open
workspace to the pages; the selection is remembered in `localStorage` under
`pulse.workspace`.

## Team Pulse surveys

Surveys belong to the workspace, so every team in it answers the same survey.
Owners and editors create a survey from the six default questions in the brief
and their own 1–5 questions, choose whether to ask the free-text question and
set a minimum number of responses. They can close, reopen and delete it.
Anyone with Pulse access answers once.

Anonymity is enforced by the database (`supabase/migrations/20261017030000_pulse_surveys.sql`
in Planner):

- `submit_pulse_response` stores the ratings and the comment without the
  account; `pulse_participations` only records who answered, so an account
  cannot answer twice and answers cannot be edited.
- Accounts cannot read `pulse_responses`, `pulse_answers` or `pulse_comments`.
  `pulse_survey_results` returns counts, and only returns the 1–5
  distribution and comments once the survey is closed with at least the
  minimum number of responses.

`src/lib/surveys.ts` turns those results into the report: averages,
distribution, change since the previous survey, the last five surveys as a
trend, the strongest and weakest question and the response rate. Recurring
surveys are not built yet.

## Retrospectives

Active retrospectives have **Open fullscreen** and **Share fullscreen link**
controls. The direct `#/workspaces/<workspace>/retrospectives/<retro>` route opens
only that board, without the app header, tabs or retrospective list. The link
requires sign-in and existing Pulse access to its workspace; it grants no new
permissions. A missing or inaccessible target is never replaced with another
retrospective. Existing topic visibility, voting and facilitator rules still apply.

**Enter browser fullscreen** additionally hides the browser chrome after an
explicit click. Browsers do not allow a shared URL to enter that mode automatically.
Escape exits browser fullscreen; **Back to retrospectives** returns to the normal
page. A previously shared room still shows the read-only summary once closed.

Owners and editors create a retrospective with a title, date, period, goal,
format (went well / to improve / ideas; start / stop / continue; mad / sad /
glad; or open), anonymity (on by default) and votes per person (default 3).
The facilitator (the creator, an owner or an editor) moves it through the
stages; everyone else follows along, and boards refresh every few seconds:

1. **Prepare**: the details above.
2. **Collect**: each person adds topics to the columns and sees only their own,
   plus a count of the hidden ones. Authors can edit or delete their topics.
3. **Group**: every topic becomes visible. Drag topics onto groups, group names
   onto other groups to merge, or use the selects on each card.
4. **Vote**: loose topics become groups of one. Each person spends their votes,
   several on the same group if they like; totals stay hidden.
5. **Discuss**: groups are ranked by votes, then topic count, then age. The
   facilitator records summary, impact, root causes, context and a decision
   (take action, monitor, accept as is).
6. **Actions**: groups marked "take action" come first; the facilitator turns
   them into tracked actions (see below), one or more per group or for the
   retrospective as a whole.
7. **Closed**: a summary with counts, the most voted groups, the decisions,
   the agreed actions and the ones carried over. The facilitator can step back
   to amend notes.

While preparing the next retrospective, the facilitator sees the actions that
are still open and the ones done since the last retrospective.

The rules live in the database (`supabase/migrations/20261017040000_pulse_retrospectives.sql`
in Planner). Accounts read only `pulse_retros`; topics, groups and votes come
from `pulse_retro_board`, which hides other people's topics during Collect,
never returns authors of anonymous topics and hides vote totals until Discuss.

## Actions

An improvement action has a title, description, owner, collaborators, due
date, priority, success criteria and a status (open, in progress, blocked,
done, cancelled). It can come from a retrospective (and one of its groups) or
be created on its own from the Actions page. Owners and collaborators are
accounts with Pulse access to the workspace.

- Owners, editors and the facilitator of the action's retrospective create,
  edit and delete actions.
- The action's owner and collaborators (and the managers above) change its
  status, add notes and, once it is done, record the outcome: whether it
  helped, what happened and any follow-up.
- Every change is kept in the action's history, shown on each card with the
  notes.

The Actions page counts open, in progress, overdue and recently done actions,
filters by status, owner, retrospective and due date, and groups by status,
owner or retrospective. The rules live in the database
(`supabase/migrations/20261017050000_pulse_actions.sql` in Planner).

## Overview

The landing page summarises the workspace in four panels. It never combines
them into a single health score.

- **Team health**: the scores of the latest survey with visible results, their
  change against the previous one, and the questions worth discussing (average
  below 3, or a drop of 0.5 or more). An open survey shows a prompt to answer.
- **Current retrospective**: the running retrospective (or the next one being
  prepared) with its stage, plus what the last one produced.
- **Improvement actions**: open, overdue and done counts, the overdue list, and
  what was done since the last retrospective with its outcome.
- **Continuous improvement**: recent retrospectives, topics and groups that
  come back in two or more of them (matched ignoring case, accents and
  punctuation), actions still open after two or more later retrospectives,
  and health over time.

Links open the exact item: `/retrospectives?retro=ID` and
`/team-pulse?survey=ID`. The logic lives in `src/lib/overview.ts`.

## Development

Use Node.js 26 LTS with npm 11.20.0. Run `nvm install && nvm use` to select
the `.nvmrc` version used by CI and deployment.

```sh
npm install   # needs GITHUB_TOKEN with read:packages for @jordiorriols/ui
npm start     # http://127.0.0.1:5177
npm test
npm run compile && npm run lint && npm run format:check
```

All visible text lives in `src/locales/*.json`, grouped by area (`app`,
`auth`, `welcome`, `sections.<page>`). `src/__tests__/locales.test.ts` keeps the six languages in
sync and `no-inline-copy.test.ts` rejects hard-coded UI text.

## Deployment

Build and deployment run in separate jobs. Builds have only read permissions;
`UI_READ_TOKEN` is available only to dependency installation. Only the deployment
job receives Pages/OIDC permissions, on `main` or `master` and subject to the
`github-pages` environment's branch policy. Checkout credentials are not persisted.
Actions are pinned to commit SHAs and receive weekly Dependabot update PRs.

`.github/workflows/build.yml` type-checks, lints, tests and builds on every
push to `main`, then deploys `dist` to GitHub Pages at
https://pulse.jordiorriols.cat/. The repository needs the `UI_READ_TOKEN`
secret to install `@jordiorriols/ui`, plus the `VITE_SUPABASE_URL` variable and
the `VITE_SUPABASE_PUBLISHABLE_KEY` secret for sign-in.

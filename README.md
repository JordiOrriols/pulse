# Pulse

Team health and continuous improvement: short Team Pulse surveys,
guided retrospectives and improvement actions tracked until they are done.
The product brief is in [DEFINITION.md](./DEFINITION.md).

Pulse is a sibling of Planner and Ladders and is built the same way:
React 18, Vite, Tailwind 4, i18next (en, es, ca, fr, de, it) and the shared
`@jordiorriols/ui` package for the header, project switcher, tabs and tokens.

## Status

Team Pulse surveys work end to end. Overview, Retrospectives and Actions are
still empty placeholders; each comes in its own step.

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

## Development

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

`.github/workflows/build.yml` type-checks, lints, tests and builds on every
push to `main`, then deploys `dist` to GitHub Pages at
https://pulse.jordiorriols.cat/. The repository needs the `UI_READ_TOKEN`
secret to install `@jordiorriols/ui`, plus the `VITE_SUPABASE_URL` variable and
the `VITE_SUPABASE_PUBLISHABLE_KEY` secret for sign-in.

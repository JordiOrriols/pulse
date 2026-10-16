# Pulse

Team health and continuous improvement: short Team Pulse surveys,
guided retrospectives and improvement actions tracked until they are done.
The product brief is in [DEFINITION.md](./DEFINITION.md).

Pulse is a sibling of Planner and Ladders and is built the same way:
React 18, Vite, Tailwind 4, i18next (en, es, ca, fr, de, it) and the shared
`@jordiorriols/ui` package for the header, project switcher, tabs and tokens.

## Status

Scaffold only. The four sections (Overview, Team Pulse, Retrospectives,
Actions) are empty placeholders. Sign-in, shared workspaces and the data model
come in later steps.

## Development

```sh
npm install   # needs GITHUB_TOKEN with read:packages for @jordiorriols/ui
npm start     # http://127.0.0.1:5177
npm test
npm run compile && npm run lint && npm run format:check
```

All visible text lives in `src/locales/*.json`, grouped by area (`app`,
`sections.<page>`). `src/__tests__/locales.test.ts` keeps the six languages in
sync and `no-inline-copy.test.ts` rejects hard-coded UI text.

## Deployment

`.github/workflows/build.yml` type-checks, lints, tests and builds on every
push to `main`, then deploys `dist` to GitHub Pages at
https://pulse.jordiorriols.cat/. The repository needs the `UI_READ_TOKEN`
secret to install `@jordiorriols/ui`.

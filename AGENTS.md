# Repository Guidelines

## Project Structure & Module Organization
This repository is a Vite + React 19 + TypeScript web app for multiplayer Texas Hold'em. Main entry points live in `src/main.tsx` and `src/App.tsx`. Screen-level UI is under `src/screens`, reusable UI pieces in `src/components`, poker rules and room state in `src/game`, and Firebase setup in `src/firebase`. Static assets such as screenshots live in `src/assets`.

## Build, Test, and Development Commands
Use the package scripts already defined in `package.json`:

- `npm run dev` starts the Vite dev server on the local network with `--host`.
- `npm run build` creates the production bundle in `dist/`.
- `npm run preview` serves the built app locally for a production-like check.
- `npm run deploy` runs `deploy.sh`, publishes `dist` to `gh-pages`, and rewrites git tracking for that folder.
- `npx tsc --noEmit` is the current type-safety check and should be run before opening a PR.

## Coding Style & Naming Conventions
Follow the existing code style in `src/`: TypeScript with strict mode, functional React components, and 2-space indentation in JSX-heavy files. Prefer `PascalCase` for components and screens (`LobbyScreen.tsx`), `camelCase` for functions and variables (`handleStartGame`), and descriptive file names for game modules (`handEvaluator.ts`, `roomManager.ts`). Use single quotes where the surrounding file already uses them; avoid reformatting unrelated code.

## Testing Guidelines
There is no dedicated test framework or `npm test` script configured yet. For now, contributors should verify changes with `npx tsc --noEmit`, `npm run build`, and targeted manual testing of host/player flows, QR join, room state sync, and poker hand evaluation. When adding tests later, place them near the feature or in a dedicated `src/__tests__` tree.

## Commit & Pull Request Guidelines
Recent history uses short, imperative commits such as `deploy`, `remove dist from tracking`, and `Fix: ...`. Keep commit subjects brief, present tense, and focused on one change. Pull requests should include a concise description, manual test notes, linked issues when applicable, and screenshots or short recordings for UI changes.

## Security & Configuration Tips
Firebase configuration lives in `src/firebase/config.ts`. Do not commit secrets outside the intended client config, and validate any room or player state changes carefully because gameplay depends on shared real-time data.

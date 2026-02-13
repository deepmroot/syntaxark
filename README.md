# SyntaxArk

SyntaxArk is a browser-based coding workspace with:
- multi-file editing
- code execution and challenge testing
- output console + virtual shell
- collaboration rooms (presence, chat, shared whiteboard)
- community/challenge flows backed by Convex

This README is a full operational and engineering reference for running and deploying the project.

## Product Overview

SyntaxArk combines three main experiences in one app:
- IDE workflow: create/edit files, run code, inspect console output, preview output where supported.
- Challenge workflow: open built-in or metadata-driven challenges, run test cases, inspect pass/fail output.
- Collaboration workflow: create or join rooms, see participants, chat, and use a shared whiteboard.

Primary UI entrypoint:
- `src/components/Layout/MainLayout.tsx`

App bootstrap:
- `src/main.tsx`

## Core Stack

- Frontend: React + TypeScript + Vite
- Styling: Tailwind CSS v4 + custom CSS in `src/index.css`
- State: Zustand
- Editor: Monaco (`@monaco-editor/react`)
- Terminal UI: xterm
- Layout panels: `react-resizable-panels`
- Backend/data/auth: Convex + `@convex-dev/auth`

## Repository Structure

- `src/components/*`: UI feature modules
- `src/runner/*`: execution pipeline for language runtimes
- `src/store/*`: global client state (editor/files/auth/collab session)
- `src/data/*`: language and challenge metadata
- `convex/*`: backend queries/mutations/schema/auth config
- `scripts/*`: local automation and smoke checks
- `.github/workflows/*`: CI pipelines

## Main Functional Areas

### 1) Editor and Execution

- Main editor container: `src/components/Editor/EditorContainer.tsx`
- File system state: `src/store/useFileSystem.ts`
- Editor state + logs/test results: `src/store/useEditor.ts`
- Runtime execution: `src/runner/Runner.ts` (+ language-specific runners)

Behavior:
- Run current file (`Ctrl+Enter`)
- Run challenge tests when active challenge supports test execution (`Ctrl+Shift+Enter`)
- Console logs are streamed into editor store and displayed in console panel.

### 2) Console

- UI: `src/components/Console/ConsoleContainer.tsx`
- Shell: `src/components/Console/Shell.tsx`
- Mounted from layout in challenge and non-challenge editor contexts.

Current state:
- old/working console interaction model retained (resizable/collapsible panel)
- no `eval` fallback for unknown shell commands (safer runtime behavior)

### 3) Challenges

- Panel: `src/components/Challenges/ChallengesPanel.tsx`
- Layout-side rendering: challenge description and test case panel in `src/components/Layout/MainLayout.tsx`
- Challenge metadata support:
  - built-in challenges from `src/data/challenges.ts`
  - metadata-backed challenge files via `challengeMeta`

### 4) Collaboration

- Panel: `src/components/Collaborate/CollaboratePanel.tsx`
- Session store: `src/store/useCollabSession.ts`
- Backend APIs: `convex/rooms.ts`
- Shared whiteboard component: `src/components/Drawing/DrawingCanvas.tsx`

Current panel supports:
- create room
- join room by code
- leave room
- copy invite link
- participant list/presence
- room chat display + send message
- shared whiteboard snapshot save/load and cursor presence updates

### 5) Auth/Profile

- Auth modal: `src/components/Profile/AuthModal.tsx`
- Profile modal: `src/components/Profile/UserProfileModal.tsx`
- Public profile modal: `src/components/Profile/PublicUserProfileModal.tsx`
- Store: `src/store/useAuth.ts`
- OAuth profile sync from Convex in main layout

## Environment Variables

Copy `.env.example` -> `.env.local` for local development.

Required frontend:
- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`

Required backend/auth config:
- `CONVEX_SITE_URL`

Optional:
- `VITE_TURN_URLS`
- `VITE_TURN_USERNAME`
- `VITE_TURN_CREDENTIAL`

Example from current deployment:
- `VITE_CONVEX_URL=https://amiable-gopher-827.convex.cloud`
- `VITE_CONVEX_SITE_URL=https://amiable-gopher-827.convex.site`
- `CONVEX_SITE_URL=https://amiable-gopher-827.convex.site`

## NPM Scripts

- `npm run dev`: start Vite dev server
- `npm run build`: TypeScript project build + Vite production build
- `npm run typecheck`: TypeScript project build only
- `npm run lint`: full repo lint (currently includes legacy debt)
- `npm run lint:deploy`: strict deploy lint gate for production-critical files
- `npm run smoke`: smoke checks (`scripts/smoke.mjs`)
- `npm run test`: alias to smoke
- `npm run predeploy`: `lint:deploy + smoke + build`
- `npm run ci:verify`: alias to predeploy
- `npm run preview`: local preview of built app

## Production Safety Gates

Deploy gate intentionally focuses on high-risk paths:
- `src/components/Layout/MainLayout.tsx`
- `src/components/Collaborate/CollaboratePanel.tsx`
- `src/components/Console/Shell.tsx`
- `src/components/Console/ConsoleContainer.tsx`
- `scripts/smoke.mjs`

Why:
- Full repo has legacy lint debt in many untouched modules.
- Deploy path is protected while debt is reduced incrementally.

## CI

Workflow:
- `.github/workflows/predeploy.yml`

Runs on:
- push to `main`
- pull requests to `main`
- manual trigger

Steps:
- `npm ci`
- `npm run -s lint:deploy`
- `npm run -s smoke`
- `npm run -s build`

## Vercel Deployment

Config:
- `vercel.json` (Vite build, `dist` output, SPA rewrite to `index.html`)

Deploy flow:
- connect repo in Vercel
- add required env vars
- deploy from `main`

Important:
- `src/main.tsx` now has a startup guard for missing `VITE_CONVEX_URL`.
- If missing, app renders a clear configuration error instead of a blank screen.

## Cloudflare Deployment (Alternative)

Possible and supported from a static frontend perspective.
- Build output is `dist`
- Ensure same required env vars are set in Cloudflare Pages/Workers environment

## Troubleshooting

### Blank page after deploy

Likely causes:
- missing `VITE_CONVEX_URL`
- missing/incorrect Convex URLs

Check:
- Vercel project env vars
- browser console for startup errors

### Build fails locally with `spawn EPERM`

This can be environment policy restrictions (Windows/process execution policy), not always code errors.
Use CI runner (GitHub Actions) as canonical build verification.

### PowerShell `npm.ps1` blocked

Use:
- `npm.cmd` directly
- or run via `cmd /c`

## Lint Debt Status

Current full lint debt is not zero.
- Latest run reported:
  - 149 errors
  - 14 warnings
- Largest category: `@typescript-eslint/no-explicit-any`

Deploy-critical lint gate is green (`lint:deploy`).

## Work Completed in Stabilization Pass

Summary of major work done:
- restored working console behavior after regressions
- reintroduced richer main UI shell while preserving console stability
- fixed challenge panel regressions with structured description rendering
- restored challenge metadata compatibility in layout run/test logic
- rebuilt collaboration panel with live room features:
  - create/join/leave room
  - participants
  - room chat send
  - shared whiteboard snapshot/cursor sync
- removed risky shell `eval`
- added production hardening:
  - smoke tests
  - deploy lint gate
  - predeploy command
  - CI workflow
  - env template
  - Vercel config
- removed unused Clerk dependency from package dependencies

## Manual Predeploy Checklist

See:
- `PREDEPLOY_CHECKLIST.md`

Quick version:
- run `npm run -s predeploy`
- verify challenge run/test
- verify profile open/auth flow
- verify collaboration room + chat + whiteboard

## Recommended Next Steps

- Reduce lint debt module-by-module:
  - `src/runner/*`
  - `convex/*`
  - `src/components/Community/*` and `Challenges/*`
- Expand `lint:deploy` coverage gradually as modules are cleaned.
- Add real automated integration/e2e tests for critical user flows.

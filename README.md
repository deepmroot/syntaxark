# SyntaxArk

SyntaxArk is a browser IDE with:
- Monaco editor + multi-file workspace
- Code execution + challenge test runner
- Output console + virtual shell
- Collaboration rooms (participants, room chat, shared whiteboard)

## Requirements

- Node.js 20+
- npm 10+

## Environment Setup

1. Copy `.env.example` to `.env.local`.
2. Fill required values:
- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CONVEX_SITE_URL`

Optional:
- TURN config (`VITE_TURN_*`) for realtime media features.

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
npm run preview
```

## Predeploy Verification

Run this before every deploy:

```bash
npm run predeploy
```

`predeploy` currently includes:
- `lint:deploy` (strict lint gate for deploy-critical paths)
- `smoke` (structural runtime checks)
- `build` (TypeScript + Vite production build)

## CI

GitHub Actions workflow:
- `.github/workflows/predeploy.yml`

It runs on PRs and `main` pushes:
1. `npm ci`
2. `npm run -s lint:deploy`
3. `npm run -s smoke`
4. `npm run -s build`

## Notes

- `npm run lint` is intentionally not part of deploy gate yet because the repo has existing lint debt across legacy files.
- If you want lint as a hard gate, reduce the existing violations first and then add lint to the CI workflow.

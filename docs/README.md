# Docs Home

This app is a Vite + React + TypeScript personal task manager backed by Supabase.
It supports:
- Email/password auth
- Per-user task data
- Tags (`work` / `personal`)
- Sidebar task views (All, Work, Personal, Overdue, Upcoming, Completed)
- Light/dark theme

## Local Run

1. Install dependencies:
```bash
npm ci
```
2. Create `.env` in repo root:
```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```
3. Start dev server:
```bash
npm run dev
```

## Deploy (GitHub Pages via Actions)

- Deploy pipeline: `.github/workflows/deploy.yml`
- Trigger: push to `main` (or manual dispatch)
- Build uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from GitHub Secrets
- Vite base path is configured in `vite.config.ts` as `/Test_App/` for Pages hosting

## Environment Variables

- Local development: `.env` in repo root
- CI/Pages: GitHub repository secrets used by workflow
- Required keys:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

See:
- `docs/OPERATIONS.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`


# Operations

## Required Environment Variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Where to set:
- Local: `.env` in repo root
- GitHub Actions: repository secrets (`Settings -> Secrets and variables -> Actions`)

## GitHub Pages / Actions Notes

- Deploy workflow: `.github/workflows/deploy.yml`
- Vite base path: `vite.config.ts` uses `/Test_App/`
- If repo name changes, update `base` accordingly or app assets may fail to load on Pages.

## Troubleshooting

## Blank screen on GitHub Pages

Likely causes:
- Wrong `base` path in `vite.config.ts`
- Missing build env vars in Actions

Checks:
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set as GitHub Secrets.
- Verify built asset paths in deployed `index.html` start with `/Test_App/`.

## `invalid supabaseUrl` / Supabase config error in CI

Cause:
- `VITE_SUPABASE_URL` is missing or empty during build.

Fix:
- Add/repair `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` secrets.
- Re-run workflow.

## Linux CI import/casing failures (`App.tsx` missing)

Cause:
- Case-insensitive local filesystem can hide import path casing mistakes.

Fix:
- Ensure file path and import casing match exactly (`src/App.tsx` and `import App from "./App";` in `src/main.tsx`).


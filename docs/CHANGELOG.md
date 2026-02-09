# Changelog

All notable changes to this project should be documented here.

## Unreleased

- Added docs-as-code baseline under `docs/` (architecture, data model, operations, ADRs, changelog).
- Added CI docs enforcement workflow (`.github/workflows/docs-required.yml`).
- Added pull request checklist template (`.github/pull_request_template.md`).
- Implemented light/dark theme toggle and persisted theme preference.
- Implemented Supabase-backed task CRUD with per-user scoping.
- Added tag support for tasks (`work` / `personal` / `none`) and sidebar filter counts.
- Added sidebar views: All, Work, Personal, Overdue, Upcoming, Completed.
- Added auth flow: sign in, create account, sign out, session restore via Supabase.
- Added per-user profile name fetch/display with email fallback.


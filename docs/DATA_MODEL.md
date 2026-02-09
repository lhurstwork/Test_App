# Data Model

## Supabase Tables

## `public.tasks`

Primary task records for each authenticated user.

Columns used by the app:
- `id`: task identifier
- `text`: task title/content
- `completed`: boolean completion state
- `created_at`: creation timestamp
- `due_date`: nullable due date/timestamp
- `tag`: nullable tag (`work`, `personal`, or `null`)
- `user_id`: owner user id (`auth.users.id`)

## `public.profiles`

Per-user profile metadata.

Columns used by the app:
- `user_id` (PK): user id (`auth.users.id`)
- `name`: display name shown in app header
- `created_at`
- `updated_at`

## RLS Intent

- Users can only read/write rows where `user_id = auth.uid()`.
- Applies to both `tasks` and `profiles`.
- App code also scopes queries by current `session.user.id` as an additional safeguard.

## Migrations

- TODO: No migration files are currently tracked in this repository.
- Recommended location for future SQL migrations: `supabase/migrations/`.
- If schema or policies change, add migration SQL and update this document + `docs/CHANGELOG.md`.


# Docs Update Contract

Use this contract in feature prompts and PRs to keep docs in sync.

## Required Doc Updates By Change Type

- UI behavior changes:
  - Update `docs/ARCHITECTURE.md` (flow/module impact)
  - Update `docs/CHANGELOG.md`
- Data model or RLS changes:
  - Update `docs/DATA_MODEL.md`
  - Add/update SQL migration files (recommended: `supabase/migrations/`)
  - Update `docs/CHANGELOG.md`
- Auth/session/profile behavior changes:
  - Update `docs/ARCHITECTURE.md`
  - Update `docs/DATA_MODEL.md` (if schema/policy affected)
  - Update `docs/CHANGELOG.md`
- Deploy/CI/env changes:
  - Update `docs/OPERATIONS.md`
  - Update `docs/README.md` (if setup/deploy flow changed)
  - Update `docs/CHANGELOG.md`
- Architectural decisions:
  - Add an ADR in `docs/ADR/` from template

## Prompt Snippet (Copy/Paste)

```md
Documentation requirements:
- Update docs for any behavior/schema/ops changes:
  - docs/ARCHITECTURE.md
  - docs/DATA_MODEL.md
  - docs/OPERATIONS.md
  - docs/CHANGELOG.md
- Add or update ADR in docs/ADR/ if an architectural decision is made.
- If code changes without doc updates, explain why explicitly.
```

## Quick PR Checklist

- [ ] `docs/CHANGELOG.md` updated
- [ ] Architecture/docs updated for behavior changes
- [ ] Data model + migration notes updated for schema/RLS changes
- [ ] Operations docs updated for env/deploy/CI changes
- [ ] ADR added/updated for architectural decisions


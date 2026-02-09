# ADR 0001: Record Architecture Decisions

## Status

Accepted

## Context

The project has been evolving quickly (UI, auth, data model, deployment, CI). Without lightweight decision records, rationale gets lost and future changes become harder to review safely.

## Decision

Adopt Architecture Decision Records (ADRs) in `docs/ADR/`:
- One markdown file per decision
- Sequential numbering (`0001`, `0002`, ...)
- Use `docs/ADR/template.md`
- Reference related files/workflows in each ADR

## Consequences

Positive:
- Better review context for future contributors
- Faster onboarding and troubleshooting
- Clear historical rationale for architecture and process changes

Tradeoffs:
- Small documentation overhead per architectural change

## Alternatives Considered

- Keep rationale only in PR descriptions: rejected (not durable enough).
- Keep rationale only in code comments: rejected (not decision-focused).

## Related Links/Files

- `docs/ADR/template.md`
- `docs/ARCHITECTURE.md`
- `.github/workflows/docs-required.yml`


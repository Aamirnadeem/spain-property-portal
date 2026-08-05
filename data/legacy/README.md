# Legacy inventory (blocked)

Expected file (not present):

`barcelona_property_explorer_legacy_60.json`

## Rules

- Import only when this file is supplied into this directory.
- Mark imported records as `legacy_snapshot`.
- Preserve original source URLs.
- Do not invent images.
- Do not describe records as live or verified until freshness and media rights are reviewed.

## Until then

Use `data/fixtures/` synthetic records for CI and local development (created in Phase 2).

See:

- [`docs/IMPLEMENTATION_PLAN.md`](../docs/IMPLEMENTATION_PLAN.md) §12
- [`docs/EXTERNAL_SERVICES.md`](../docs/EXTERNAL_SERVICES.md) §6–7
- [`docs/DECISIONS_REQUIRED.md`](../docs/DECISIONS_REQUIRED.md) ADR-010 and D-016

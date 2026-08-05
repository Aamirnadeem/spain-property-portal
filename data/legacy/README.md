# Legacy inventory

Canonical dataset (present):

`barcelona_property_explorer_legacy_60.json` — 60 records, identical to `legacy/client/src/data/properties.json`.

Reference application (frozen — do not modify):

`legacy/` (also referred to as barcelona-property-explorer-preview)

## Rules

- Import via Phase 2 as `legacy_snapshot` only.
- Preserve original source URLs.
- Do not invent images (dataset has none).
- Do not scrape Idealista, Fotocasa, or other portal pages from stored URLs without written permission in the source register.
- Do not describe records as live or verified until rights/freshness review (D-019).

## See also

- [`docs/LEGACY_CODE_ASSESSMENT.md`](../docs/LEGACY_CODE_ASSESSMENT.md)
- [`docs/DATABASE_DESIGN.md`](../docs/DATABASE_DESIGN.md) §13 (field mapping)
- [`docs/IMPLEMENTATION_PLAN.md`](../docs/IMPLEMENTATION_PLAN.md) §12
- [`docs/EXTERNAL_SERVICES.md`](../docs/EXTERNAL_SERVICES.md) §6–7
- [`docs/DECISIONS_REQUIRED.md`](../docs/DECISIONS_REQUIRED.md) ADR-010, ADR-014, ADR-015, D-019

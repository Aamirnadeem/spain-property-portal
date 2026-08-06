# Phase 4B security review

Date: 2026-08-06  
Status: Phase 4B **implemented** (review baseline; residual notes in [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md))  
Parent: [`PHASE4B_PLAN.md`](PHASE4B_PLAN.md) · [`PHASE4B_IMPLEMENTATION.md`](PHASE4B_IMPLEMENTATION.md) · ADR-030b

## Scope

Saved searches, browsing history, in-app notifications, alert evaluation jobs, guest merge extensions. Channels limited to in-app + test providers.

## Threat model (selected)

| ID  | Threat                                                      | Mitigation                                                                                 |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| B4b | Oversized guest merge payload (searches/history)            | Zod bounds; caps 5 searches / 50 history; opaque cookie preferred                          |
| B10 | Cross-user read of saved searches / history / notifications | Session + `withAuthenticatedDb` + owner RLS; tests                                         |
| B11 | Agency SELECT on buyer activity                             | No org policies; matrix deny; integration deny tests                                       |
| B12 | Alert enumeration / spam                                    | Dedupe keys; rate limits; alerts opt-in; inventory filter                                  |
| B13 | Notification content leak (notes/PII)                       | i18n keys + minimal payload ids only                                                       |
| B14 | Job privilege escalation                                    | Service-role only for evaluate/expire; no client-callable bypass of owner checks for reads |
| B15 | Double notify / replay                                      | UNIQUE `dedupe_key`; source_event_id; idempotent jobs                                      |
| B16 | History recording without consent path                      | Default on with explicit disable; guest local flag                                         |
| B17 | CSRF on `/me/*` mutations                                   | `assertSameOrigin` (4A pattern)                                                            |

## Authorization summary

| Resource             | Buyer self   | Other buyer | Agency | Platform admin (4B) | Job service-role |
| -------------------- | ------------ | ----------- | ------ | ------------------- | ---------------- |
| saved_searches       | CRUD         | deny        | deny   | no ad-hoc UI        | evaluate only    |
| browsing_history     | CRUD         | deny        | deny   | deny                | expire only      |
| in_app_notifications | read/update  | deny        | deny   | deny                | insert           |
| guest payload        | cookie owner | deny        | deny   | deny                | —                |

## Privacy

- Retention 90 days history; notification archive/dismiss; guest session expiry unchanged from 4A.
- Account deletion CASCADE on all 4B buyer tables.
- Export/erasure workers deferred to 4.1+; document obligations.
- Minimal event payloads; exclude from agency analytics and unauthorized profiling.
- Private notes remain 4A rules (never in notifications).

## Rate limits (app-level)

| Action             | Limit       |
| ------------------ | ----------- |
| Save/update search | 20/min/user |
| Record view        | 30/min/user |
| Mark notifications | 60/min/user |

## Residual risks

- Inline evaluation on large partner imports may extend request latency — accepted under ADR-027; revisit queue if needed.
- Sibling suppression is UTC-day heuristic — document limitation.
- `guestPayload` fallback remains untrusted (ADR-030a residual).

## Required tests before “implemented”

Cross-user RLS deny; agency deny; merge overwrite refusal; dedupe uniqueness; CSRF on mutations; Playwright persistence after logout/login.

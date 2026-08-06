# Phase 3 security review (planning)

Date: 2026-08-05  
Status: Planning threat model — policies not yet migrated  
Related: [`SECURITY_AND_PRIVACY.md`](SECURITY_AND_PRIVACY.md), [`RLS_IMPLEMENTATION_STATUS.md`](RLS_IMPLEMENTATION_STATUS.md), [`SOURCE_PERMISSION_MODEL.md`](SOURCE_PERMISSION_MODEL.md)

## Scope

Authorize live inventory ingestion and agency/admin operations without weakening Phase 2 public browse or favourites isolation. **No scraping, CAPTCHA bypass, or access-control evasion.**

## Assets

| Asset                                      | Sensitivity                |
| ------------------------------------------ | -------------------------- |
| Partner listing drafts and import payloads | Confidential (org)         |
| Raw snapshots                              | Confidential (org + admin) |
| Media binaries and rights declarations     | Confidential / legal       |
| Source permission status                   | Privileged                 |
| Public published listings                  | Public                     |
| Buyer favourites                           | Private (user)             |
| Audit events                               | Privileged / org-scoped    |

## Actors

- Anonymous buyer
- Registered buyer
- `org_agent` / `org_owner`
- `listing_reviewer` / `platform_admin`
- Worker service role
- Attacker (cross-tenant, upload abuse, XXE, malware)

## Threats and controls

| Threat                              | Control                                                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Cross-agency data read/write        | RLS by `organization_id` + membership; API `requireOrgMember`; two-org tests                                      |
| Spoofed `x-user-id` (Phase 2 gap)   | Partner/admin **must** use verified AuthProvider session before launch; remove header trust for privileged routes |
| Publish without permission          | Gate on source `permission_status` + role check + audit                                                           |
| Unauthorized media storage          | `image_rights` enforcement; malware scan; content-type/size limits                                                |
| Malicious CSV/XML                   | Zod validation; XXE-safe XML; quarantine; size limits                                                             |
| Mass withdraw on failed feed        | Freshness job only runs on successful full sync                                                                   |
| Privilege escalation via role table | Only platform admin assigns platform roles; org_owner limited to own org members                                  |
| Worker bypass abuse                 | Service role only on worker; no public exposure of service key                                                    |
| Listing enumeration of drafts       | Public APIs filter `is_public_browseable`; drafts invisible to anon                                               |
| Legacy snapshot mislabelled live    | Keep ADR-021; partner publish path never clears legacy flags on legacy source rows                                |

## RLS matrix (planned)

| Table                          | anon                          | authenticated buyer | org member     | platform admin | worker |
| ------------------------------ | ----------------------------- | ------------------- | -------------- | -------------- | ------ |
| Public browseable listings     | SELECT                        | SELECT              | SELECT         | SELECT         | all    |
| Draft/pending org listings     | —                             | —                   | own org        | all            | all    |
| `import_runs` / errors         | —                             | —                   | own org        | all            | all    |
| `raw_snapshots`                | —                             | —                   | own org        | all            | all    |
| `feed_configs`                 | —                             | —                   | own org read   | all            | all    |
| `data_sources` public metadata | SELECT approved/public fields | same                | own + public   | all            | all    |
| `duplicate_candidates`         | —                             | —                   | —              | all            | all    |
| `audit_events`                 | —                             | —                   | own org SELECT | all            | insert |
| `media_assets` writes          | —                             | —                   | own org        | all            | all    |
| `favourites`                   | —                             | owner               | owner          | —              | —      |

Exact SQL belongs in migration `0005_phase3_rls.sql` and must update [`RLS_IMPLEMENTATION_STATUS.md`](RLS_IMPLEMENTATION_STATUS.md).

## Authn/Authz requirements before partner UI goes live

1. Replace temporary cookie/`x-user-id` trust on `/api/v1/partner/*` and `/api/v1/admin/*` with AuthProvider session verification.
2. Map Supabase JWT `sub` → `users.id`; set `request.jwt.claim.sub` (and org claim) on DB connections used for partner queries **or** keep service-role queries strictly filtered in trusted server code with mandatory automated isolation tests.
3. FakeAuth remains development/test only (ADR-018).

## Media security

- Default deny storage when `image_rights` ∈ {`none`, `hotlink_only`}.
- Local CI: EICAR fixture must be rejected.
- Production: ClamAV or cloud scanner (decision required).
- No fetching of Idealista/Fotocasa CDN URLs from legacy rows.

## Logging and PII

- Audit actions, not raw OTP codes.
- Import errors may store raw partner rows — treat as confidential; retention aligned with snapshots.
- Do not log storage signed URLs in plaintext application logs.

## Testing requirements

- [ ] Two-org isolation in `pnpm test:db`
- [ ] Expired permission blocks publish and jobs
- [ ] Malicious XML/CSV fixtures fail closed
- [ ] Unauthorized media blocked
- [ ] Playwright: agent cannot open admin publish API/UI
- [ ] Axe critical=0 on partner upload + admin review

## Residual risks (accepted for planning)

- Until session wiring lands, privileged routes must not be exposed on public deployments.
- Licensed geocoder not in Phase 3 — fixture/seed matching only.
- Real partner HTTP feeds blocked without written permission.

## Sign-off

Planning review only. Implementation security sign-off follows migration + test evidence after Phase 3 approval.

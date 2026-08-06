# Phase 4C security review — Comparison shares

Date: 2026-08-06  
Status: Phase 4C planning (pre-implementation threat model)  
Parent: [`PHASE4C_PLAN.md`](PHASE4C_PLAN.md) · [`COMPARISON_SHARE_SECURITY_MODEL.md`](COMPARISON_SHARE_SECURITY_MODEL.md)

## Scope

Threats specific to secure, expiring, revocable comparison share links. Assumes Phase 4A/4B controls remain intact (sessions ADR-029, note isolation, 4B private tables).

## Threat catalogue

### B-share-01 — Token guessing / brute force

**Risk:** Attacker enumerates share URLs.  
**Mitigation:** ≥256-bit CSPRNG tokens; hash-at-rest; rate limit 60/min/IP; generic unavailable responses.  
**Residual:** Negligible for random tokens if rate limits hold.

### B-share-02 — Token leakage via logs / Referer / analytics

**Risk:** Plaintext token appears in logs, Referer headers, or third-party scripts.  
**Mitigation:** Never log full tokens; `Referrer-Policy: no-referrer` on public page; noindex; no CDN cache of capability URLs; scrub error reports.  
**Residual:** Owner clipboard / chat paste remains user-controlled.

### B-share-03 — Existence / status oracle

**Risk:** Distinct responses reveal whether a share existed, expired, or was revoked.  
**Mitigation:** Identical generic unavailable for invalid / expired / revoked; constant-time hash path where practical.  
**Residual:** Timing side-channels at scale — accept with rate limits.

### B-share-04 — Private note / identity leakage on public page

**Risk:** Notes, buyer identity, or 4B data appear in public DTO.  
**Mitigation:** Dedicated allowlist mapper; D6 scores opt-in frozen only; unit tests assert exclusions; never call owner compare with `includeNotes: true` on public path.  
**Residual:** Mis-implementation — gate with acceptance + Playwright.

### B-share-05 — Listing substitution / sibling leakage

**Risk:** Withdrawn listing replaced silently by another marketing of same physical property.  
**Mitigation:** Explicit share items by listing ID; warnings only; never auto-swap.  
**Residual:** Operator must not manually “fix” shares without replace flow.

### B-share-06 — Cross-user revoke / list

**Risk:** User A revokes or lists User B’s shares.  
**Mitigation:** Session-bound owner APIs; RLS `user_id = jwt.sub`; integration tests.  
**Residual:** Service-role misuse — restrict to resolve/access only.

### B-share-07 — Agency / admin ad-hoc access

**Risk:** Agency staff browse buyer share inventory.  
**Mitigation:** No 4C agency UI; no admin SELECT product path; RLS deny non-owner authenticated unless service role.  
**Residual:** DB operators with superuser — operational control outside app.

### B-share-08 — Anon RLS broad SELECT

**Risk:** PostgREST/anon role reads share tables by guessing UUIDs.  
**Mitigation:** No anon policies; resolve only via hashed-token service after rate limit (D24).  
**Residual:** Misconfigured grants — cover in RLS checklist.

### B-share-09 — Share spam / DoS create

**Risk:** Authenticated user floods share creation.  
**Mitigation:** 10/min/user create/replace; 2–5 listings validation; title length caps.  
**Residual:** Distributed accounts — platform abuse tooling later.

### B-share-10 — Public resolve DoS

**Risk:** Flood public GET.  
**Mitigation:** 60/min/IP; cheap hash lookup; avoid heavy work before auth of token validity.  
**Residual:** Distributed IP floods — edge WAF later.

### B-share-11 — CSRF on owner mutations

**Risk:** Cross-site revoke/create.  
**Mitigation:** Same-site session + CSRF tokens on POST mutations (platform standard).  
**Residual:** None unique to 4C.

### B-share-12 — Stale privilege after logout

**Risk:** Browser still holds copied link (expected). Capability URL remains valid until expiry/revoke.  
**Mitigation:** Product: revoke UI; short default expiry (7d); max 90d.  
**Residual:** Inherent to capability URLs — documented.

### B-share-13 — Social crawler expansion

**Risk:** Preview bots fetch and cache private-adjacent content.  
**Mitigation:** Same DTO allowlist; no private fields; classify UA as preview; noindex.  
**Residual:** Bot farms — rate limits.

### B-share-14 — Score / weight oversharing

**Risk:** Live preference profile or unintended score disclosure.  
**Mitigation:** Defaults off; frozen snapshot only when opted in; never re-score with live profile on public open.  
**Residual:** Owner opts in — informed UI copy required.

## Residual risks (accepted for 4C)

1. Possession of a valid link equals read access to approved public comparison fields until expiry or revoke.
2. Clipboard / messaging channel exposure of the URL is outside server control.
3. Superuser database access can read share metadata (not plaintext tokens if hashing is correct).

## Pre-implementation checklist

- [ ] Token generation uses CSPRNG ≥256 bits
- [ ] Only hash stored; create response returns plaintext once
- [ ] Public mapper allowlist reviewed against [`PUBLIC_COMPARISON_DTO.md`](PUBLIC_COMPARISON_DTO.md)
- [ ] Anon grants absent on share tables
- [ ] Rate limits wired on public + create paths
- [ ] Playwright journey includes revoke → unavailable
- [ ] Logging scrub assertions for tokens

## Post-implementation review

Re-run this catalogue after code lands; file residual findings in [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) if any mitigations slip.

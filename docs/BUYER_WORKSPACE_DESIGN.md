# Buyer workspace design

Date: 2026-08-06  
Status: Phase 4 planning  
Parent: [`PHASE4_PLAN.md`](PHASE4_PLAN.md)

## Purpose

Define how buyers organize properties after Phase 2 favourites: named shortlists, notes, browsing history, and the workspace shell—while keeping agency users out of private buyer data.

## Concepts

| Concept | Meaning |
| ------- | ------- |
| Favourite | Phase 2 quick heart bookmark (`favourites` table). Independent of shortlists. |
| Shortlist | Named collection (e.g. “Barcelona apartments”, “Coastal homes”, “Investment options”, “Final family shortlist”). |
| Default shortlist | At most one per user (`is_default`); used as the primary “Add to shortlist” target. |
| Property note | Private text + optional pros/cons for one listing. |
| Shortlist note | General note for the whole shortlist. |
| Workspace | Authenticated (and guest-local) hub under `/{locale}/workspace`. |

## Favourites coexistence

- Keep `/api/v1/favourites` and `/{locale}/favourites` unchanged in behaviour.
- Shortlist UI is additive; hearts do not auto-insert shortlist items (ADR-030 / decisions doc).
- Guest localStorage key `spain_guest_favourites` remains; shortlists use a separate key (e.g. `spain_guest_shortlists`) until HttpOnly guest session lands.
- Merge on auth persists both favourites and shortlists transactionally.

## Shortlist lifecycle

1. **Create** — name required (1–80 chars); optional `is_default`.
2. **Rename** — uniqueness per user; conflict → `409 name_taken`.
3. **Delete** — cascades items and shortlist note; if default deleted, clear default (no auto-promote unless product later chooses promote-oldest).
4. **Add/remove items** — listing UUID must exist; duplicate item → no-op / `onConflictDoNothing`.
5. **Reorder** — optional `position` integer; API accepts ordered id list.
6. **Default** — setting default unsets previous default in one transaction.

### Caps (defaults)

| Cap | Default | Rationale |
| --- | ------- | --------- |
| Shortlists / user | 20 | Abuse bound |
| Items / shortlist | 100 | UI performance |
| Name length | 80 | Display |
| Guest shortlists | 5 | LocalStorage size |
| Guest items / list | 30 | LocalStorage size |

## Notes

### Property notes

- Fields: `body` (text, max ~4k), `positives` / `negatives` (string arrays, max 10 × 200 chars each), `updated_at`.
- Upsert per `(user_id, listing_id)`.
- Visible on property detail (owner), shortlist detail, and **owner** comparison matrix only.
- **Excluded** from public comparison shares.

### Shortlist notes

- One note row per shortlist; general planning text (“visit order”, “budget ceiling”).
- Owner-only; not shared.

## Browsing history

- Record on authenticated property detail view (and guest local mirror).
- Fields: listing_id, viewed_at, channel (`web` default).
- List newest-first; cap display at 50; DB retention **90 days** (env `BUYER_HISTORY_RETENTION_DAYS`).
- Actions: clear one, clear all.
- Privacy control: `historyRecordingEnabled` on profile or local flag; when off, do not write.
- **Agency/partner/admin APIs must not expose this table.**

## Workspace IA and routes

```text
/{locale}/workspace                 Hub: shortlists summary, recent, notifications badge
/{locale}/workspace/shortlists      List + create
/{locale}/workspace/shortlists/[id] Items, note, compare CTA, set default, delete
/{locale}/workspace/compare         Comparison matrix + weights
/{locale}/workspace/searches        Saved searches
/{locale}/workspace/history         Recently viewed
/{locale}/workspace/notifications   In-app alerts
/{locale}/favourites                Existing Phase 2 page
/{locale}/account                   Auth (unchanged)
/{locale}/compare/shared/[token]    Public share (no workspace chrome that implies login)
```

### Components (planned)

- `WorkspaceNav`, `ShortlistCard`, `ShortlistEditor`, `AddToShortlistDialog`
- `PropertyNotesPanel`, `ShortlistNotesPanel`
- `ComparisonMatrix`, `WeightSliders`, `ScoreExplanation`
- `SavedSearchList`, `HistoryList`, `NotificationCentre`
- Guest: hydrate from localStorage; prompt sign-in to sync

### i18n / a11y

- Messages under `workspace`, `shortlists`, `compare`, `history`, `notifications` in en/es/ca/ar.
- Arabic RTL: matrix first column sticky on the inline-start side.
- Compare table: keyboard focusable headers; score disclaimer not colour-only.

## Guest behaviour

| Data | Guest storage | Server |
| ---- | ------------- | ------ |
| Favourites | `spain_guest_favourites` | After merge → `favourites` |
| Shortlists | `spain_guest_shortlists` JSON | After merge → tables |
| Recent views | guest payload / local | After merge → `recently_viewed` |
| Saved searches | local criteria array | After merge → `saved_searches` |
| Weights | local profile | After merge → `user_preference_profiles` |
| Notes | optional local only | Persist on auth if present |

Unauthenticated users hitting `/workspace/**` pages: allow read-only guest UI **or** redirect soft-prompt to account—prefer **guest-capable workspace shell** that works offline-local, with banner “Sign in to sync”. Protected **API** still requires session.

Page gate: authenticated-only APIs; HTML may render guest mode without leaking other users’ data.

## Authenticated behaviour

- All `/api/v1/me/*` require ADR-029 session.
- Mutations: CSRF Origin check.
- DB via `withAuthenticatedDb(session.userId)`.
- Seed buyer demo UUID for Playwright (see database changes doc).

## Authorization summary

| Actor | Shortlists / notes / history / searches |
| ----- | --------------------------------------- |
| Anon | Guest local only |
| Buyer (session) | Own rows only |
| Agency roles | **No** access to buyer private tables |
| Platform admin | No casual read of buyer notes/history in Phase 4 (admin tools out of scope) |

## Tests (workspace-focused)

- Shortlist CRUD + default uniqueness
- Cross-user isolation
- Guest merge shortlist name collision
- History clear + retention
- Favourites still work after shortlists ship
- Playwright: create four example shortlists, add listings, open compare
- RTL smoke on `/ar/workspace`

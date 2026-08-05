# Known issues — Phase 2

Date: 2026-08-05

1. **No authorized listing photographs.** Legacy JSON has no images and no republication rights. UI uses placeholders only.
2. **Bathrooms unavailable** in the legacy dataset; detail pages show an explicit “not provided” state rather than inventing values.
3. **Some source URLs are portal search pages** (Idealista/Fotocasa). Stored as-is; weak listing identity flagged via snapshot provenance.
4. **Fake auth user rows** are created lazily when favourites are persisted; production will use Supabase Auth UUIDs as `users.id`.
5. **Playwright e2e** requires a migrated/seeded/imported local database and `DATABASE_URL` for the Next.js server.
6. **Map view** is deferred (not required for this Phase 2 slice); card and table views are implemented.
7. **Favourites authorization** is enforced in API + RLS; browser `x-user-id` header is a temporary Phase 1/2 wiring aid until full Supabase session cookies are configured.

# CLAUDE.md

Forge app: **Query & Bulk Actions for Confluence** (Kitefold, app 3). Read `SPEC.md` before changing anything; it is the source of truth and scope boundary. This file is kept out of Git (listed in `.git/info/exclude`).

## Rules

- Every Confluence call runs from the browser as the viewer (`@forge/bridge` `requestConfluence`). Resolvers never call Confluence, except the admin check in `src/admin-check.js` (one `asUser()` read). `test/platform.test.mjs` enforces this.
- Design as if every call counts against the shared points pool (SPEC.md §1.12): heavy actions reserve through `src/lib/points.js`; CSV up to 2,000 rows; the macro reuses results per viewer for 5 minutes; log both `Beta-` and unprefixed rate-limit headers.
- Never store search results, page content or plain-English requests. Storage is in SPEC.md §5 only.
- No egress: no `external` permissions, no outside fetches, no analytics, no outside AI. AI only through Forge LLMs (the `llm` module).
- Never take the person from the client; use `context.accountId`.
- No permanent delete. Bulk actions show a preview first and report a result per item.
- Don't add scopes or modules without updating SPEC.md §6 first. Adding scopes after listing forces customers to re-approve.
- Pure logic in `src/lib/` with `node:test` tests in `test/`. Keep resolvers thin.
- UI is UI Kit only (`@forge/react`). Text boxes use `defaultValue` + `onChange`.
- Paid app: the licence check is the last v1 patch.
- Patches: authored `Kitefold <hello@kitefold.app>`, no co-author or tool trailers, no personal or tool names in tracked files (Forge LLM model names are fine; the platform test checks this).
- Test data: only spaces starting `QB`. Never touch PROD, MKTG, CS, KF* (app 1) or LH* (app 2).
- Never put tokens in code or commits.

## Commands

```
npm install
npm test
forge lint
forge deploy
forge install --product confluence --site kitefold-dev.atlassian.net
forge install --product confluence --site one-atlas-bvlw.atlassian.net
forge logs
node scripts/seed-qb.mjs --dry-run
```

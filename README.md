# Query & Bulk Actions for Confluence

Forge app by Kitefold. Spec: `SPEC.md` (draft until "Settle the final spec").

## First run

Needs Node 22+, the Forge CLI logged in as hello@kitefold.app, and the kitefold-dev and demo sites.

```powershell
cd $HOME\Projects\kitefold-query-bulk
npm install
npm test
forge register "Query & Bulk Actions"   # writes this app's own id into manifest.yml
forge lint
forge deploy
forge install --product confluence --site kitefold-dev.atlassian.net
```

Then open **Apps → Query & Bulk Actions** in Confluence. The starter page only confirms the app is installed; searching, saved searches, the results macro and bulk actions arrive in later patches (SPEC.md §14).

## Applying a patch

```powershell
git am $HOME\Downloads\<name>.patch
npm test
forge deploy
git push
```

If a patch adds permissions, deploy with `forge deploy --approve MAJOR_VERSION_RULE`, then run `forge install --upgrade` for each site.

## Test data

`scripts/seed-qb.mjs` creates spaces QB1 to QB3 (about 3,000 pages, 300 blog posts and a few files) with known labels: `needs-review` on 825 items (the rename test), `how-to` and `howto` (the merge test), `draft`, `archive-me`, team labels, and the word "onboarding" in 165 bodies. It only touches QB1 to QB3. See the script header for how to run it; use a fresh plain API token and revoke it afterwards. It writes `seed-summary.json` with the counts the app should find. QBSEC and QBSHOW are made by hand.

## Code layout

- `src/lib/cql.js`: the builder (state to CQL and back), CQL quoting, and the `pageId()` / `spaceKey()` placeholders.
- `src/lib/planner.js`: the bulk-run planner (preview counts, skip rules, limits, batches, retries).
- `src/lib/points.js`: the points budget (estimates per action, rate-limit headers with and without `Beta-`, the pool guard, the site's hourly budget).
- `test/`: unit tests and platform rule tests (`npm test`, no Forge login needed).
- `src/frontend/search.jsx`: the search page (starter).

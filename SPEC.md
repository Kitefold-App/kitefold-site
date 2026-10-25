# Kitefold App 3: Query & Bulk Actions for Confluence — SPEC (DRAFT 1, 18 Oct 2026; large-site checks added 18 Oct; lessons from apps 1 and 2, §0 decisions, "Ask in plain English" (with its shared AI pool), the plain-English competitor check and Atlassian's points-pool answer (design as if every call counts) added 20 Oct; new Atlassian APIs (14–15 Oct) added 21 Oct; listing name changed and name check done 21 Oct)

Status: **draft, all §0 decisions made; building started 21 Oct (after Link Health, app 2, was submitted).** This file is `SPEC.md` in the private repo `Kitefold-App/kitefold-query-bulk` (from 21 Oct) and is the source of truth; the project doc `kitefold/app-3-spec-draft.md` is a copy kept in step with it. Refer to checklist steps by name, not number.

---

## 0. Decisions (all made 20 Oct unless noted)

1. **Go: yes, decided 20 Oct.** Build app 3, but only **after Link Health (app 2) is submitted**. App 2 comes first.
2. **App name: decided 18 Oct, listing name changed 21 Oct (§11).** Marketplace name "Query & Bulk Actions: CQL Search, Labels, Watchers, Archive" (21 Oct: whichever name brings the most searches; the exact phrase "CQL Search" beats "CQL Query … Saved Searches"); "Query & Bulk Actions" inside Confluence; backup "CQL Query & Bulk Actions: Saved Searches, Labels, Watchers". Not "CQL Search & Bulk Actions". Name check done 21 Oct: short name clear; one UK mark for the word "CQL" (Cryptomathic, cryptography software), which the owner accepts. Earlier text: UKIPO (classes 9 and 42) and Google check still to do.
3. **Bulk actions in v1: decided 20 Oct, keep all three** (labels, watch, archive). Archive as specced: up to 300 pages a run, one archive job per site at a time, not on Confluence Free, pages only, restored from Confluence's archive rather than the app's Undo (§1.5, §3.4). It reuses app 2's tested code.
4. **Shared saved searches: decided 20 Oct (§3.3).** The owner can edit, rename and delete; **Confluence admins can also edit or delete any shared search**; everyone else can run it or copy it to their own. Each shows "Shared by [name]". *Design note:* Forge has no supported way to check for a Confluence admin (§1.10.1), so the admin part relies on a check the app's backend makes as the person, against a Confluence endpoint only admins may call (§3.3, §12.14). If no such endpoint works for Forge, admins fall back to owner-only plus "Copy" and the owner decides again.
5. **Price: app 3 stays the cheapest Kitefold app (decided 20 Oct).** With "Ask in plain English" the owner is considering $250–300 a year for 100 users; proposed ladder in §10 ($0.28 for 11–100 = $280 a year). Final numbers at "Check competitors' prices and set yours".
6. **New v1 feature: "Ask in plain English" (decided 20 Oct, §3.5).** Turns a typed request into CQL with Forge LLMs (Atlassian-hosted), shows the CQL to check or edit, never runs it automatically. It's part of the first highlight, but the listing leads with what makes the app different (see item 7). **Decided 20 Oct (16:10): Atlassian-hosted AI only, no "bring your own AI key" option.** A customer's own key would mean sending data outside Atlassian, which loses the Runs on Atlassian badge for the whole app, changes the privacy answers, means storing customers' API keys, and puts off most admins; and it would only save about $9 a month at 200 installs. If big customers want more, a larger allowance goes in the Advanced edition.
7. **Two tweaks (decided 20 Oct, 16:57):**
   - **"Rename or merge a label across the site" moves into v1** (§3.4), from the v2 label manager idea. It reuses the bulk-label code, Bulk Action Tools users already have it (its "label manager" was one of its main features, answering CONF-7681), and label phrases bring searches. "labels" phrases join the tracked search phrases (§11).
   - **The listing leads with "check the query, save it, show live results, act on them in bulk"**, not with plain English. Rovo search and the small "Just Search" apps already do plain-English search (§1.3), so plain English is one way in, never "the only" one.
8. **Points pool (decided 20 Oct, 17:53, after Atlassian's answer on ECOHELP-175732):** design as if every call counts, browser ones included. The old fallback limits are the v1 defaults: CSV up to 2,000 rows, the macro reused per viewer for 5 minutes, a per-site budget of 5,000 points an hour; both `Beta-` and unprefixed rate-limit headers logged. Higher limits stay a later option. Tier 2 is never given on request. The Forge LLM data questions went in a separate support request, **ECOHELP-176558** (sent 21 Oct; §12.18).
---

## 1. Results of the brief's checks (18 Oct 2026)

### 1.1 Is StreamlineSoft releasing Forge versions? — **No sign of it.**
- CQL Search: still version 1.1.3-AC (Connect), released 11 Jul 2024. 978 installs, 5 reviews (5.0). Paid via Atlassian.
- Bulk Action Tools: still 1.0.7-AC (Connect). 366 installs, 14 reviews (2.8).
- They have moved *See All Unresolved Comments* and *QR Code for Jira Cloud* to Forge ("Runs on Atlassian"), so they can do it. Their CQL Search docs space shows no migration notice.
- **Connect end of support moved from end of 2026 to 31 Jan 2027.** After that, only critical security fixes, and Connect features may be removed with little notice. Our "listed by December 2026" target still lands before it.

### 1.2 Can a Forge app add another user as a watcher? — **Yes, but only when the caller is a Confluence administrator.**
- `POST /wiki/rest/api/user/watch/content/{contentId}?accountId=…` adds a watcher; `DELETE` on the same path removes one. Without `accountId` it acts on the calling user. Scope: `write:watcher:confluence` (granular). Check status with `GET` and `read:watcher:confluence`.
- Atlassian's API notes say naming another user needs the **Confluence Administrator** global permission; watching yourself needs only site access.
- Because v1 runs every action as the viewer, "add someone else" works for site/Confluence admins and is refused (and reported) for everyone else. That is the safe behaviour we want.
- **Groups (v2 idea):** members come from `GET /wiki/rest/api/group/{groupId}/membersByGroupId` (scope `read:confluence-groups` classic / `read:group:confluence` granular, beta). No group-watch endpoint exists, so it means one call per member per page.
- **Still to test (dev-only, removed before submitting):** add and remove another user (a) as the owner (admin), (b) as a non-admin test user, (c) `asApp`; and the group members call. See §12.

### 1.3 Competitors re-checked (changes the brief)
| App | Partner | Installs | Notes |
|---|---|---|---|
| **Capable Search for Confluence (Knowledge Management)** | Capable (UK) | 40 | Free, Runs on Atlassian. CQL, filters, columns, saved searches, macro, **bulk change: delete, move, label, status, find/replace**. "Migrating from CQL Search? Use our migrator". Updated 11 Oct 2026. |
| Capable for Confluence (All-in-One) | Capable | 398 | Includes Capable Search; also migrates StreamlineSoft "CQL Query" macros. |
| Bulk Actions: Labels, Watchers & Page Trees | jeereemiassb | 0–1 | Runs on Atlassian, paid. Watch/unwatch and labels on a page tree, space label manager, copy tree. Released 25 Sep 2026. |
| Canned Search, Clovity, Instant Search, Search Results Macro+ (47) | various | 225 / 104 / 99 / 47 | Search or macro only, as in the brief. |
| Pages Manager, Label Manager, Space Content Manager | various | 478 / 494 / 193 | Bulk only, as in the brief. |

**Plain-English search (checked 20 Oct) isn't unique either:**
- **Rovo search** (Atlassian), switched on automatically for Confluence Standard, Premium and Enterprise sites: ask a question in natural language and get an answer with links to the pages it used. It doesn't show or save a CQL search, put results in a macro, or act on them in bulk, and Free sites don't have it.
- **Sendel's "Just Search" apps** (Claude, ChatGPT and Gemini versions; for example Just Search Claude, 2 installs): natural language instead of CQL/JQL, with summaries; the customer brings their own AI account.
- **So the listing leads with what they don't do:** you see the CQL and can edit it, save and share it, show it live on a page and act on the results in bulk, with no AI account needed, on Free sites too. Never claim to be the only plain-English search.

**What this means:** the brief's gap ("nobody combines query then act") is closed by Capable for labels, move and delete. Still open:
- **Watchers** from search results (Bulk Action Tools' most-asked feature: CONF-2853 watch page and children; CONF-8458 bulk unwatch). Nobody established does it on Forge.
- **Viewer-safe bulk actions with a preview, per-page results and undo.** No permanent delete, so admins can let everyone use it.
- **A paid-but-cheap, focused app.** Capable Search is free, but it's one module of a large suite. The question is whether buyers want a focused tool.
- **Switching from both StreamlineSoft apps at once**: CQL syntax including `pageId()` / `spaceKey()`, plus watchers and labels.

### 1.4 Bulk labels — endpoints and limits
- Add: `POST /wiki/rest/api/content/{id}/label` with `[{prefix:"global", name}]`. Scopes `read:label:confluence` + `write:label:confluence`.
- Remove: `DELETE /wiki/rest/api/content/{id}/label?name=…` (query form, safe for any label name). Scope `write:label:confluence`.
- These are v1 endpoints, **not deprecated**; there is no v2 label-writing endpoint (Atlassian's own workaround points to these).
- Labels **can't be removed from archived content**: report it as "Skipped: archived".
- Pages the viewer can't edit: Confluence refuses (403). We show "Refused: you can't edit this page" per row and carry on.

### 1.5 Archive — reuse app 2's answer
- `POST /wiki/rest/api/content/archive` with `{pages:[{id}]}` → 202 and a long task. Granular scopes `write:page:confluence` + `read:content.metadata:confluence`.
- Refused (400) if another archive job is running on the site, more than 300 pages, already archived, or the site is on **Confluence Free**.
- Pages only (not blog posts). Restore happens in Confluence's archive. App 2 tested this on 14 Oct.

### 1.6 CQL, paging and time limits
- Search: `GET /wiki/rest/api/search?cql=…` with **cursor** paging (`_links.next`). Offset (`start`) paging was dropped in 2020, so there's no "jump to page 7": Next / Previous only (we keep a stack of cursors). `totalSize` gives the total for the header (an old bug made it wrong when results were bigger than the page size; re-check in §12).
- Results per call are capped by Confluence (observed 200–250 without body expansions; never ask for bodies). We ask for 25–100 per screen.
- `order by` works in CQL; sortable columns are only those CQL can order by (title, created, lastmodified; confirm others in the API check).
- **Forge time limits:** UI resolvers have 25 s; async consumers and scheduled jobs up to 900 s.
- **Rate limits (enforced since 2 Mar 2026):** points per hour. Reads cost 1 + 1 per page object (users and permissions 2 each); every write costs 1. **By default an app shares one 65,000-point hourly pool across all of its customers.** **Which calls count: design as if every call counts (Atlassian's answer, ECOHELP-175732, 20 Oct).** Atlassian support isn't sure whether browser `requestConfluence` calls count (a staff post on 1 Apr 2026 said front-end traffic was exempt, but the ticket answer won't confirm it), so app 3 treats every call, browser or backend, as using the shared pool (§1.12). Separate per-second burst limits apply, and search has extra burst protection.
- **Does the macro run as the page viewer?** Yes, if the macro's UI calls `requestConfluence` from `@forge/bridge`: that always runs as the signed-in viewer.
- → **Design consequence (§4):** all Confluence calls, searches and bulk actions, are made from the UI as the viewer, not from resolvers. This keeps every action within the viewer's own permissions and keeps the app out of the shared points pool. 429s are retried after `Retry-After`.

### 1.7 Can we import CQL Search macros? — **Possible (Capable does it), but not in v1.**
- A migrator has to find every page using the Connect macro, read its storage body, rewrite the macro into ours and save a new page version, as each page's editor or as the app. That needs body read/write on every page: broad scopes, version noise and risk.
- v1 instead: **accept their CQL as is**, including `pageId()` and `spaceKey()` (CQL Search's own functions), so a user can paste the query into our macro. Plus a migration page on kitefold.app: "Moving from CQL Search or Bulk Action Tools before Connect ends".
- To learn the macro key and parameter names, the owner downloads CQL Search's descriptor from its listing (Resources → Descriptor). The Marketplace blocks automated downloads.
- A migrator stays a v2 candidate if switchers ask for it. Atlassian's new macro index (RFC-142, 14 Oct) doesn't help here: it only covers Data Center to Cloud migrations of an app's own macros (§1.13.2).

### 1.8 Large sites: what decides whether app 3 copes (added 18 Oct evening)
- **App 3 never reads the whole site.** Each action is bounded (one screen, at most 500 items per bulk run, 300 per archive, 10,000 CSV rows), so its cost is the same on a 3,000-page site and a 1-million-page site. Site size affects **speed** (CQL on huge sites, `text ~` queries), **paging** and the **pickers** (thousands of spaces, tens of thousands of labels), not points. This is unlike app 1 (counts every task) and app 2 (indexes every page).
- **Points per action:** see §1.12 (v1 limits, every call counted).
- **Do page calls count? Unknown, so assume yes (ECOHELP-175732, 20 Oct).** The earlier fallback limits are now the v1 defaults (§1.12). The developer console's API metrics don't show front-end calls (ECO-1208), so the app logs the rate-limit headers itself.
- **Known paging bug:** CONFCLOUD-84279 (Apr 2026, unresolved): `content/search` cursor paging can return an empty page with no Next after about 500 results. Must be checked on both search endpoints, because "Select all" and CSV export depend on deep paging.
- **Plan:** measure page sizes, paging and rate-limit headers on the API check page (§12.8–10), simulate 10k/100k/1M pages (§12.11), then set the limits in this spec before building features. Write-up: `kitefold/app-3-scale-test.md`.

### 1.9 Apps 1 and 2 and the shared pool (for reference; not changed here)
- **App 2** (Link Health) indexes every page from the backend, so it does use the pool. Its chat built a pool-share patch on 20 Oct: each site's index spends at most 8,000 points an hour, stops when Confluence reports the pool low or after any 429, and resumes at a per-site offset; viewer checks moved to the browser, except the byline, which Forge only runs on the backend. (Atlassian has since said Tier 2 is never given on request, ECOHELP-175732.)
- **App 1** (Task Report) reads from the backend today; its chat plans to move the report's reads to the browser after approval.
- **App 3:** browser calls only, but since 20 Oct it budgets them as if they count (§1.12), with the same pool signals app 2 uses.

### 1.10 Lessons from apps 1 and 2 that change app 3 (20 Oct)
1. **No supported admin check exists.** A Forge Confluence app can't reliably tell whether the person is a Confluence admin: `/wiki/rest/api/user/current?expand=operations` from Forge is refused ("Authentication Required"), and Atlassian has no supported way (CONFCLOUD-84789). And **any resolver can be invoked directly** by any signed-in user, whatever page the UI shows it on. So:
   - the **bulk actions on/off setting** is a team preference that hides the bulk bar, not a security control. Anyone could call the setting's resolver or Confluence itself, and every action still only runs with that person's own permissions. Help and listing must say "hide bulk actions", never "restrict" or "allow only admins" (§3.4);
   - **watching for another person** is offered to everyone; Confluence refuses non-admins, and the run stops at the first refusal with "Only Confluence admins can add other people as watchers" (§3.4);
   - **shared saved searches:** the person is always taken from the resolver's own context (`context.accountId`), never from what the page sends. The owner decided (§0.4) that Confluence admins may also edit or delete them, so that path needs a check the backend can trust (§3.3, §12.14).
2. **Keep resolvers away from Confluence.** Backend calls count against the pool, so a test fails the build if any resolver imports Forge's product-API fetch (`@forge/api` `requestConfluence` / `asUser` / `asApp`). **One exception, in one file (`src/admin-check.js`):** the admin check for shared searches (§3.3), one `asUser()` call made only when someone who isn't the owner edits or deletes a shared search (a few points, rare). The macro has **no `export` function**: Confluence would run it on the backend for PDF/Word export, as the user, and it would count.
3. **Rate-limit headers tell us little.** Points left (`r`) only appear once about 80% of the pool is used, and the docs still call the headers informational (`Beta-RateLimit*`). The app logs both the `Beta-` and unprefixed versions (§1.12), and the API check compares a browser response with a backend one (§12.6).
4. **We can't see front-end 429s anywhere else.** They don't appear in the developer console or `forge logs`. The page keeps a small "Confluence was busy" count (written only when a 429 actually happened, at most once per page view), shown on the settings page (§5).
5. **Forge storage is billed per app,** free up to 0.1 GB of reads and 0.1 GB of writes a month across all sites (app 2 used up its reads by 18 Oct). App 3 stores a few KB per site. To keep it near zero: a macro with its own CQL makes **no app call at all** (the CQL is in the macro's settings on the page, and the licence comes from the page context); only a macro that uses a saved search makes one small storage read per view.
6. **UI Kit lessons carried over** (app 2): a test that fails if a screen imports a component `@forge/react` doesn't export at runtime (the blank-page `Grid` bug); tables sorted by the app itself, not UI Kit's controlled sort; pickers keyed so React doesn't reuse an old one; text boxes uncontrolled; type into text boxes by hand when testing, because the browser chat's typing doesn't always register.
7. **Testing a paid app** (app 2): a paid app's production version can't be installed by the CLI; licence tests run on the development or staging install with `--license active` / `inactive`. With Sharing on, other people can Allow access on development installs.
8. **Cost:** app 3 has no background jobs and no index, so its Forge bill is close to zero. Rough worst case at 50 customer sites with 100,000 saved-search macro views a day: about 75,000 GB-seconds of function time a month (free up to 200,000) and about 3 GB of storage reads (about $0.16). Well under $1 a month. Free 1–10 user sites cost nothing extra.

---

### 1.11 Forge LLMs: facts for "Ask in plain English" (checked 20 Oct)
- **Status:** generally available since 29 Jul 2026 (preview from 2 Jun 2026). SDK `@forge/llm`: `chat({model, messages, max_completion_tokens, temperature|top_p})` → `choices[].message`, `usage.{input_tokens, output_tokens, total_tokens}`; `list()` returns the models and whether each is `active` or `deprecated`. Called from Forge functions (our resolver), not the browser.
- **Manifest:** an `llm` module (`model: [claude]`). It isn't a scope, but adding it to an existing app forces a major version that admins must approve; app 3 has it from its first version, so it's in the first install's consent screen.
- **Models (all Anthropic Claude, hosted on Amazon Bedrock inside Atlassian):** `claude-haiku-4-5-20251001` (tentative retirement "not sooner than 15 Oct 2026", so it could be retired with notice any time now), `claude-sonnet-4-6`, `claude-sonnet-5`, Opus 4.6–5. Some newer models refuse `temperature` and `top_p`: send neither.
- **Price (charged to Kitefold, no free allowance):** Haiku 4.5 $1 per million input tokens and $5 per million output; Sonnet $3 / $15; Opus $5 / $25. Billed monthly on the Forge bill; per-model usage in the developer console.
- **Limits per installation:** 100 prompts a minute (all models), 500,000 tokens a minute per model.
- **Data:** Atlassian says no data leaves its platform and nothing goes to an outside AI service; requests pass the same moderation as Atlassian's own AI (high-risk prompts are blocked). Atlassian doesn't publish (as of 20 Oct) whether prompts are kept or how long, whether they're used for training, or whether processing follows data residency. **We don't claim any of those** until Atlassian confirms (a separate support request, §12.18).
- **Runs on Atlassian:** apps using Forge LLMs still qualify for the badge.
- **Marketplace:** the Privacy & Security tab has no AI questions; the AI use is disclosed in the listing, the Help page and the privacy page instead (§7, §11).
- **Atlassian's own advice:** build per-user, per-site or per-edition limits into the app (§3.5).

### 1.12 Points pool: design as if every call counts (ECOHELP-175732, 20 Oct)
**Atlassian's answer:** they can't say whether browser `requestConfluence` calls count, so treat every call as counted. Points: **1 per request, +1 per page, space or attachment returned, +2 per user, group or permission returned; every write 1.** The default pool is **65,000 points an hour shared by all of the app's customers**. **Tier 2 (a pool per site) is never given on request**; Atlassian assigns it itself.

**v1 defaults (previously the fallback in §12.11):**
- **CSV export: up to 2,000 rows** (≈ 2,010 points: 8 calls of 250 plus 1 per row). Bigger searches: "Export the first 2,000 rows" plus a note to narrow the search.
- **Macro:** loads once per page view, never on a timer, **and reuses its results for the same viewer for 5 minutes** (browser storage, keyed by the macro's settings and the viewer; if browser storage isn't available it just loads). 25 rows by default (10–100). A view within 5 minutes costs 0.
- **A per-site points budget: 5,000 points an hour** (about 8% of the shared pool), shared by everyone on the site:
  - **Heavy actions** (CSV export, Select all, bulk runs, label rename/merge, archive) **reserve their estimate first** through the `reserve` resolver; if the hour can't cover it: "Your site has used this hour's allowance for big actions. This can run at 15:00, or try fewer items."
  - **Light actions** (search screens, pickers, macro views, the space list for plain English) run while the budget lasts. Each page counts what it spends and reports it to the site's hourly record every 200 points and before any heavy action (one write each). Once the hour is spent, the page shows its last results and "Confluence limits how often apps can search. Try again at 15:00."
  - If Confluence reports a per-site pool (`tenant-app-quota`, i.e. Atlassian has assigned Tier 2), the budget becomes a quarter of it, at most 25,000 (app 2's rule).
- **Pool guard on top (from app 2):** when any response shows points left (`r`, sent once about 80% of the pool is used), heavy actions pause until the reset time (`t`); after a quota 429 (`RateLimit-Reason` quota), every call pauses until `Retry-After` or the reset. The pause is written to the site's hourly record so other people's pages see it. A burst 429 (no quota reason) is retried once after `Retry-After`.
- **Cheaper calls:** no per-item status reads before bulk watch (watching a page twice or unwatching a page not watched is harmless; the preview says "Pages you already watch are left as they are"); space names from the search results (`resultGlobalContainer`), not expanded space objects; people's names looked up once per screen in one bulk call, deduplicated, and only when a people column is shown (off by default); pickers search after 2 characters with a 300 ms pause, 10 results; the space list for "Ask in plain English" loaded once per page session (≤ 200 spaces ≈ 201 points) and reused.

**Points per action (v1, every call counted):**

| Action | Points |
|---|---|
| Search page, 50 rows, default columns | ≈ 51 (+2 per distinct person if a people column is on) |
| Macro view, 25 rows | ≈ 26; 0 when reused within 5 minutes |
| Picker search (10 results) | spaces ≈ 11; people ≈ 21 |
| Space list for plain English (once per session) | ≤ 201 |
| Select all (up to 500) | ≈ 502 |
| Bulk labels / label rename or merge, 500 items | ≈ 1,000 (500 to find, 500 writes) |
| Bulk watch, 500 items | ≈ 1,000 (no status reads) |
| Archive, 300 pages | ≈ 312 |
| CSV export, 2,000 rows | ≈ 2,010 |
| Admin check (backend) | ≈ 2 |

**What 5,000 an hour means for one site:** about 100 search screens, or two 500-item bulk runs and a 2,000-row export, in an hour. 13 sites at their full budget in the same hour would fill the shared pool; the pool guard then pauses everyone's heavy actions first.

**Logging the headers:** the page reads every rate-limit header the browser exposes, **both the `Beta-` and the unprefixed versions** (`RateLimit`, `RateLimit-Policy`, `Beta-RateLimit`, `Beta-RateLimit-Policy`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-NearLimit`, `RateLimit-Reason`, `Retry-After`). They go with the next budget report, and the resolver logs one line, e.g. `ratelimit: prefix=beta policy=global-app-quota q=65000 w=3600 r=- t=3120 reason=-`, at most once per site per hour unless `r`, a near-limit flag or a 429 appears (then every time). No user data. The backend admin check logs its headers the same way. If the browser can't see the headers, the log says so (§12.6).

**Later option, higher limits** (one switch, `LIMITS = "relaxed"`): CSV 10,000 rows, macro without reuse, budget 25,000 an hour. Only if Atlassian confirms browser calls don't count, or a site's own pool (`tenant-app-quota`) shows in the headers.

### 1.13 New Atlassian APIs (14–15 Oct 2026; read 21 Oct)
Sources: the Confluence Cloud changelog (14 and 15 Oct 2026), the Confluence macro index docs and RFC-142.

1. **V2 content permissions APIs (14 Oct).** `GET`/`PUT /wiki/api/v2/{content-type}/{id}/restriction-state` and `GET`/`POST`/`PUT`/`DELETE /wiki/api/v2/{content-type}/{id}/permissions`, for pages, blog posts, databases, whiteboards and folders. `GET …/permissions` lists the read and update permissions on the item; `restriction-state` says whether it's restricted. The changelog doesn't name the scopes or the response shape. App 3 would only ever use the two **GET**s (no restriction changes in v1).
   - **Bulk preview ("You can't edit N of these"):** the list shows who is granted read and update on a restricted item. That isn't the same as "can this viewer edit": an unrestricted page follows its space permissions, and group membership needs more calls. So it may only answer "restricted, and you're not on the list". Test what it returns (§12.19). Points, if every call counts (§1.12): about 1 per `restriction-state` call; `permissions` 1 plus 2 per user or group listed, so roughly 3–20+ per item. Checking 500 items could cost 1,000–5,000+ points, up to a whole hour's site budget. **v1 stays as it is** (Confluence refuses, the row shows "Refused", the run carries on) unless the test shows a cheap, accurate answer. Then, at most, a capped `restriction-state` check on the selected items (for example the first 100), shown as "N of these have restrictions; you may not be able to edit some", reserving its points like other heavy actions.
   - **Admin check:** not documented as one. Test whether either GET answers differently for a Confluence admin than for a non-admin on a QBSEC page restricted to someone else (§12.14). It only qualifies if the difference comes from Confluence-admin rights, not from space-admin rights or being on the list. System info and the audit log stay the first candidates.
2. **Confluence macro index for app migrations (RFC-142, 14 Oct, Preview).** It gives an app a file listing the pages that contain **its own declared macros**, only during a **Data Center to Cloud** migration through the Confluence Cloud Migration Assistant, only for Forge apps with an automated migration path, and only valid at migration time. RFC-142 says rows for other apps' macros may appear and apps should ignore them. The Forge method that downloads the file needs egress to Atlassian's migration storage (which can affect Runs on Atlassian; the row iterator avoids it). **It doesn't help a CQL Search migrator:** CQL Search users are already on Cloud (Connect to Forge, cloud to cloud, isn't covered), and Kitefold has no Data Center app. A v2 migrator would still find the pages itself. First test (§12.7): does CQL `macro = "<CQL Search's macro key>"` find pages that use the Connect macro? If so, finding them is one search; the hard part stays rewriting each page body (§1.7).
3. **V1 content restrictions change (15 Oct, rolling out by site).** Each user or group holds either read only ("Can view") or read and update ("Can edit"); removing only read from someone who has both is rejected, and update is only granted with read. **No effect on v1** (app 3 doesn't change restrictions). Noted for v2 bulk restriction changes (§13): use the V2 permissions APIs and treat read as a prerequisite of update.

## 2. Product summary

**One line:** Check the query, save it, show live results on any page and act on them in bulk (add, rename or merge labels, watchers, archive), safely, as yourself. Write the query in plain English, CQL or a simple builder.

**Who it's for:** Confluence admins and space admins tidying content; team leads who want "everything labelled X in these spaces" on a page; people leaving CQL Search and Bulk Action Tools before Connect ends.

**Rules (same as apps 1 and 2):**
- Read Atlassian data as the viewing user. Every bulk action runs **as the viewer**, so it can never do more than they could by hand.
- Store as little as possible: saved searches and settings only. Never page content.
- No calls outside Atlassian, no outside AI, no analytics. Runs on Atlassian. **AI only through Forge LLMs** (Atlassian-hosted), only for "Ask in plain English", only with the person's request, the allowed CQL fields and functions and the names of spaces they can see; never page content; nothing stored.
- **No permanent delete, ever.** Archive only, which can be undone in Confluence.
- Never put tokens in code or commits. Patches are authored "Kitefold <hello@kitefold.app>" with no tool trailers; local notes files stay out of the repo.

---

## 3. v1 features

### 3.1 Search page (Forge `confluence:globalPage`, title "Query & Bulk Actions")
- **Three ways in, one query box:** "Ask in plain English" (§3.5) at the top, then:
  - **Builder:** spaces (multi-select), type (page, blog post, attachment), labels (has any of / has all of / doesn't have), creator, contributor, created and modified dates (presets "last 7/30/90 days, older than 6/12 months", or a range), title contains, text contains, under page (ancestor). The builder writes CQL into the box, so users learn CQL as they go.
  - **CQL:** a free text box. Editing CQL by hand switches the builder off for that query (one way, like Jira's basic/advanced). "Reset to builder" starts again.
  - Text boxes use `defaultValue` + `onChange` (app 2 lesson: controlled UI Kit text fields drop characters when typing fast).
- **Placeholders:** `currentUser()` (native CQL). On the search page `pageId()` and `spaceKey()` have no current page, so they're refused with a clear message; in the macro they're replaced (§3.2).
- **Validation:** Confluence's own error message is shown under the box, in plain words where we recognise it.
- **Results table:**
  - Columns chosen by the user (saved in the browser, and in a saved search): Title (link, opens in a new tab), Type, Space ("KEY – Name"; personal spaces "Name (personal space)"), Created, Created by, Last modified, Modified by, Labels, Version, Parent, File size (attachments).
  - Sort by clicking a sortable column header (CQL `order by`). Columns CQL can't sort show no sort control.
  - 25 / 50 / 100 rows per page; Next / Previous; header: "1,234 results · showing 51–100".
  - Results are only what the viewer can see (Confluence filters them).
- **Export CSV:** up to 2,000 rows (v1 default, §1.12), walked page by page from the UI. UTF-8 BOM, CRLF, formula-safe cells, local-date file name (reuse app 2's code and its London-time fix).
- **Bulk actions bar** appears when rows are ticked (§3.4).

### 3.2 Search Results macro ("Query results")
- Config (UI Kit custom config): pick a saved search **or** enter CQL / use the builder; columns; sort; rows per page (10–100); title; show count (on/off); show Export CSV (on/off).
- Placeholders replaced before running: `pageId()` → the page holding the macro, `spaceKey()` → its space key. Also our own `thisPage()` / `thisSpace()` names.
- Runs as **whoever views the page**: two people can see different results. The macro says so in its help text.
- **Calls:** a macro with its own CQL makes no app call (CQL in the macro settings, licence from the page context); a macro using a saved search makes one small storage read per view. Results are loaded once per page view, never on a timer, and **reused for the same viewer for 5 minutes** (§1.12). 25 rows by default. No `export` function (§1.10.2).
- Read-only: **no bulk actions in the macro.** It has a link "Open in Query & Bulk Actions" that opens the search page with the same query.
- If the saved search is deleted or unshared, the macro shows "This saved search is no longer available" to everyone except the macro's editor, who sees how to fix it.

### 3.3 Saved searches
- Name (≤ 80 chars), CQL, builder state (if any), columns, sort, rows per page.
- **Private** (owner only) or **Shared** (everyone on the site can see and run it; it always runs as the person running it).
- **Who can do what (decided 20 Oct):**
  - **Owner:** edit, rename, share/unshare, delete.
  - **Confluence admins:** edit or delete any shared search (not rename-only edits of private ones: private searches stay private).
  - **Everyone else:** run it, or **Copy to my searches** (a new private search they own).
  - Each shared search shows **"Shared by [name]"**, and "Edited by [name]" when an admin last changed it. Names are looked up in the browser from the stored account IDs, as the viewer; only IDs are stored.
- **Trust rules:** every saved-search resolver takes the person from `context.accountId`, never from the request. Owner actions need `owner === context.accountId`. **Admin actions** (edit or delete by a non-owner) need a fresh admin check made by the backend as that person (`src/admin-check.js`): one `asUser()` call to a Confluence endpoint only Confluence admins may call; 200 = admin, 401/403 = not. Candidate endpoints, to test in the API check (§12.14): system info (`GET /wiki/rest/api/settings/systemInfo`), the audit log (`GET /wiki/rest/api/audit?limit=1`), or another admin-only read (new 14 Oct: the V2 content permissions reads, §1.13.1, though they aren't documented as an admin check). It costs a few pool points and only runs on those rare actions. The browser may hide or show the admin buttons from a cheap guess, but only the backend check decides.
- **If no admin-only endpoint works for Forge** (app 2's `user/current?expand=operations` didn't): admins get owner-only plus Copy, and the decision goes back to the owner.
- Lists on the search page: "My searches" and "Shared searches", each with a filter box.
- Limits: 100 saved searches per person, 500 shared per site (protects storage; shown as a message if reached).

### 3.4 Bulk actions (search page only)
- **Selection:** tick rows, "Tick all on this page", or "Select all N results" (walks the cursor pages; up to the action's limit).
- **Actions:**
  1. **Add labels** (one or more), **Remove labels**. Pages, blog posts and attachments. Limit 500 items per run.
  2. **Watch / Stop watching** (no per-item "already watching" check, to save points: watching twice is harmless) — for "me", or another person chosen with the user picker. Only Confluence admins can do the second; the app can't check that in advance (§1.10.1), so it's offered to everyone and the run stops at Confluence's first refusal with "Only Confluence admins can add other people as watchers". Pages and blog posts. Limit 500 items per run.
  3. **Archive** — pages only. Limit 300 per run (one Confluence archive job). Not offered on Confluence Free (Confluence refuses; we show its reason).
  4. **Rename or merge a label across the site** (v1, decided 20 Oct). A separate button, "Rename or merge a label": pick the label (or several, to merge) and the new name. The app searches `label = "old"` (or `label in ("a","b")`) across every space the viewer can see, previews "412 pages and blog posts in 9 spaces; 37 already have 'new'", then adds the new label and removes the old one on each item, as the viewer. Same limits and results as other bulk actions: 500 items a run, then "Continue with the next 500" (the search is re-run, so done items drop out); Refused for items the viewer can't edit; Skipped for archived content (Confluence won't remove labels there, so those keep the old label and are listed). Undo reverses the run. No new scopes. Confluence has no rename-label API, so this is always add-then-remove per item.
- **Preview before acting:** "You selected 412 items: 380 pages, 32 blog posts. 37 already have the label 'old' and will be skipped." Items that don't fit the action (for example blog posts for Archive) are listed as "won't be changed". A "you may not be able to edit N of these" count depends on the V2 permissions test (§1.13.1, §12.19); v1 doesn't have it unless that test shows it's cheap and accurate.
- **Confirmation dialog** lists the first 20 titles plus "and N more", and the exact action. Archive needs a second tick: "I understand these pages move to the space archive".
- **Run:**
  - Reserves its points estimate from the site's hourly budget first (§1.12). Runs in the open tab, 4 requests at a time, as the viewer. Progress bar "120 of 412".
  - "Keep this tab open" note; leaving the page stops the run cleanly between items, never half-way through one.
  - Retries after `Retry-After` on 429, then up to 3 tries with backoff on 5xx.
- **Results:** every row gets a status:
  - Done;
  - Skipped (already had it / archived / not this type);
  - Refused (you can't edit this page / only admins can add other watchers);
  - Failed (with Confluence's message).
  Summary line, "Download results (CSV)", and the table refreshes.
- **Undo** for labels and watchers: "Undo these changes" reverses exactly the items marked Done in this run (kept in memory only, so it's gone after a reload). Archive: a link to the space archive, where pages can be restored.
- **Site setting** (on the admin settings page): Bulk actions **Shown** (default) / **Hidden**. With Hidden, the search page and macro still work; the bulk bar is hidden. Saved in Forge storage. It's a team preference, not a security control (§1.10.1): it can't stop anyone doing what their own Confluence permissions allow, and the Help page says so. The resolver checks it's called from the settings module (`context.moduleKey`) as a speed bump only.

### 3.5 Ask in plain English (v1, decided 20 Oct)
**What the person sees**
- A box at the top of the search page: *"Ask in plain English, e.g. pages about onboarding that HR hasn't updated in a year"*, a **Write the search** button, and "1,240 of 2,500 plain-English searches left on your site this month" (the total grows as more people start using it).
- The app writes CQL into the CQL box with a one-line description generated by the app itself from the parsed CQL (not by the AI), e.g. "Pages · in HR – People team · containing 'onboarding' · not changed since 20 Oct 2025". **It never runs automatically**: the person checks or edits it, then presses **Run**.
- Names of people: CQL needs account IDs, so the AI writes a placeholder (`creator = person("Sam")`); the app shows a person picker pre-filled with "Sam" before the search can run. No directory is sent to the AI.
- If it can't be done: "Couldn't turn that into a search. Try rewording it, or use the builder." (Also used when the request asks for something CQL can't do, such as "pages Sam liked".)
- The builder and the CQL box stay exactly as they are: the feature is optional, and the app works fully without it (and when the monthly allowance is used up).
- The same request in the same browser tab reuses the last answer (no second call).

**What's sent (and only this)**
- The person's request (up to 300 characters).
- Today's date (for "a year ago").
- The allowed CQL fields, operators and functions (fixed list in `src/lib/cql-grammar.js`) and short worked examples.
- **Spaces the viewer can see, key and name only**, looked up in the browser as the viewer, once per page session and reused (§1.12). On big sites: spaces whose key or name words appear in the request first, then the rest alphabetically, **at most 200** (keeps cost and tokens bounded).
- Never page titles, page content, labels, people or results.

**Checking the answer before it's shown (`src/lib/cql-validate.js`, pure, tested)**
- The model must answer as JSON: `{"ok": true, "cql": "..."}` or `{"ok": false}`.
- The CQL is parsed with the app's own grammar: only allowed fields (type, space, title, text, label, creator, contributor, created, lastmodified, ancestor, parent, id) and functions (`currentUser()`, `now("…")`, `startOfDay/Week/Month/Year`, `endOf…`, `person("…")` placeholder); balanced quotes and brackets; space keys must be ones that were sent; no `order by` on unsortable fields; length ≤ 1,000 characters.
- If it fails: one repair call with the validator's message; if that fails too, the "couldn't" message. Confluence still has the last word when the search runs (its error shows in plain words, as for typed CQL).

**Model, cost and limits**
- **Model:** the cheapest active model that passes the accuracy test (§12.17): Haiku 4.5 first; if Haiku is retired, the next one on a ranked list read from `list()` at run time, never a hard-coded single model. The model used is logged (no request text).
- **Monthly allowance: a shared pool for the site that grows with the people using it (decided 20 Oct, 16:53; replaces the flat 200).**
  - **Paid sites** (trials count as paid; development installs too): the pool is **25 × the number of people who have used "Ask in plain English" this month, at least 200**. Anyone on the site can draw from it, so a keen person isn't stopped at 25. A person's first request of the month adds 25 to the pool before it's counted.
  - **Ceiling for every paid site: 2,500 searches or $15 of AI a month,** whichever comes first (from the real token counts).
  - **Free sites (10 users or fewer):** 20 a month for the whole site, at most $0.25.
  - A repair call is part of the same request. Every request counts, including "couldn't".
  - When the pool or a ceiling is used up, the counter says "No plain-English searches left on your site this month. The builder and CQL box still work."
  - Why: a flat 200 runs out in days on a 500-user site (0.4 each), which would hit the customers who pay most; a strict per-person limit would block the keenest user on a small team.
- **Counting (like app 2's usage guard):** the resolver counts tokens and requests in memory for the request (one or two calls), then writes the month's record once (`ai:<yyyy-mm>`, §5). The first request a person makes in a month also writes a marker `aip:<yyyy-mm>:<accountId>` (so the pool knows how many people use it); later requests from them write only the month record. Read-modify-write, so two people pressing at the same moment can go one over; that's acceptable. The allowance is enforced on the backend, where the AI call happens, so it can't be skipped from the page.
- **Clean-up:** the first request of a new month deletes the previous month's `aip:` markers (up to 100 per request until none are left), so account IDs are kept for one month only. No scheduled job is needed.
- **Free vs paid:** from the licence in the function context. **To confirm (§12.15):** whether Forge's licence shows a free 10-user site differently from a paid one. If it doesn't, every site gets the paid pool with a lower minimum (100) and the owner reviews it.
- **Cost estimate (Haiku 4.5, before measuring):** typical request ≈ 2,500 tokens in, 100 out ≈ **$0.003**; largest (200 spaces, 300-token answer) ≈ $0.006, or $0.012 with a repair call. **Per site a month at its full allowance:** an 11-user paid site (pool 275) about $0.80 typical; a 250-user site with 100 people using it (pool 2,500) about $7.50 typical; **no paid site above $15, no free site above $0.25**. **Across 200 installs:** realistic about **$20 a month** (each paid site averaging 20 people × 5 searches); the theoretical worst, every site at its ceiling every month, about $935 (70% free / 30% paid) to $3,000 (all paid), reachable only by large, busy sites that pay far more than their ceiling. To be measured (§12.16).

### 3.6 Extras
- Footer on the search page: Help (kitefold.app/query-bulk/), "Also by Kitefold: All-Spaces Task Report · Link Health & Cleanup", "Leave a review" (shown once REVIEW_URL is set after listing).
- Licence check: last Build v1 patch (§8).

---

## 4. Architecture

- **Forge, UI Kit, Runs on Atlassian.** Node runtime (current), no egress.
- **Modules:**
  - `confluence:globalPage` — search page;
  - `macro` (UI Kit, with custom config) — Query results;
  - `confluence:globalSettings` — admin settings (bulk actions on/off);
  - resolver functions for storage (saved searches, the setting, the busy count), the admin check (§3.3) and "Ask in plain English" (`ask`: allowance check, Forge LLM call, validation, one month-record write). The licence comes from the page context;
  - `llm` module (`model: [claude]`).
- **Who calls Confluence:** the UI, using `@forge/bridge` `requestConfluence`, as the viewer. Resolvers don't call Confluence in v1 (no `asApp`, no impersonation), with one exception: the admin check in `src/admin-check.js` (§3.3). **A test enforces this** (§1.10.2). The `ask` resolver calls Forge LLMs, not Confluence; the space list it needs comes from the page.
  - Why: every action is limited to the viewer's own permissions, and there's no 25 s resolver time limit for long runs. Points: designed as if browser calls count (§1.12).
  - **Points budget module** `src/lib/points.js` (pure, tested: estimates per action, header parsing for both prefixes, hold decisions) and a `reserve` resolver (reads and updates the site's hourly record, `pts:<hour>`).
- **Lessons carried over from app 2** (§1.10.6): runtime component test, app-side sorting, keyed pickers, uncontrolled text boxes.
- **Pure logic in `src/lib`** with `node:test` tests: CQL builder (state → CQL and back), placeholder replacement, CQL quoting/escaping, cursor stack, bulk-run planner (preview counts, skip rules, limits, batching, retry schedule), result summariser, CSV writer (reused), space label formatting (reused), saved-search validation.
- **A simulation** (as in app 2): a fake Confluence API with lagging and refusing responses, 429s with Retry-After, archived pages and pages the viewer can't edit, to test bulk runs end to end.

---

## 5. Storage (Forge KVS)

| Key | Value | Notes |
|---|---|---|
| `ss:<id>` | `{name, cql, builder, columns, sort, rows, owner, shared, editedBy, createdAt, updatedAt}` | `owner` is an Atlassian account ID. Query text only; never results or page content. |
| `ssu:<owner>:<id>` | `1` | index of a person's searches |
| `ssh:<id>` | `1` | index of shared searches |
| `settings` | `{bulkActions: "shown" \| "hidden", changedAt}` | admin settings page |
| `ai:<yyyy-mm>` | `{requests, people, couldnt, repairs, inTokens, outTokens, credits, model}` | "Ask in plain English" pool and cost for the month (§3.5). One write per request; no request text, no account IDs. Kept 13 months. |
| `aip:<yyyy-mm>:<accountId>` | `1` | Marks that this person used "Ask in plain English" this month (sizes the pool). Written once per person per month; deleted early the next month (§3.5). |
| `pts:<yyyy-mm-dd-hh>` | `{used, reserved, holdUntil, holdReason, policy, q}` | The site's points budget for the hour (§1.12). Written on reports (every 200 points a page spends), reservations and pool signals. No user data. Kept 48 hours. |
| `busy:<yyyy-ww>` | `{count, lastAt}` | "Confluence was busy" count for the week (§1.10.4). Written only when a 429 happened, at most once per page view; approximate under concurrent writes (fine for a count). Kept 8 weeks. |

- Keys encoded to Forge's allowed characters (app 2 lesson; account IDs contain `:`).
- `kvs.query` is eventually consistent: after a save the UI updates its own list straight away, and any "does this exist" decision uses `kvs.get` (app 2 lesson).
- On uninstall, Atlassian deletes Forge storage under its standard lifecycle.

---

## 6. Scopes (to confirm with `forge lint` and the API check)

| Scope | Why |
|---|---|
| `search:confluence` | CQL search for the page and macro |
| `read:content-details:confluence` | titles, versions, history and parents in results (confirm the exact set needed for the `expand`s) |
| `read:space:confluence` | space names in results and the builder's space picker |
| `read:label:confluence`, `write:label:confluence` | add and remove labels |
| `read:watcher:confluence`, `write:watcher:confluence` | check, add and remove watchers |
| `write:page:confluence`, `read:content.metadata:confluence` | archive pages |
| `read:user:confluence` | names in Created by / Modified by and the user picker |
| `storage:app` | saved searches, the setting, the busy count and the monthly AI allowance |
| (V2 content permissions read scope, only if §12.19 adopts it) | a capped "has restrictions" count in the bulk preview, or the admin check (§1.13.1) |
| (admin check scope, TBD by §12.14) | the one admin-only read used to check "is this person a Confluence admin" before an admin edits or deletes someone else's shared search |

The `llm` module isn't a scope; it shows on the install screen as AI use.

**Not requested:** impersonation, `asApp` writes, delete scopes, page body read or write, outside egress. That keeps the Marketplace security review simple.

---

## 7. Privacy facts (website and Marketplace answers must match; full drafts in `kitefold/app-3-privacy-security.md`)
- Also stores an hourly points-budget record per site (points used and reserved, any pause; no user data).
- Stores: saved searches (name, query text, columns, sort, owner's account ID, the account ID of an admin who last edited it, shared flag, dates), one site setting, a weekly "Confluence was busy" count, a monthly count of plain-English searches with token totals (no request text, no personal data), and for the current month only, the account IDs of people who have used "Ask in plain English" (to size the site's pool; deleted early the next month).
- Doesn't store: search results, page content, labels or watcher lists, bulk-run results (they stay in the browser tab), or **plain-English requests or the AI's answers**.
- **AI:** "Ask in plain English" sends the person's request, the allowed CQL fields and functions and the keys and names of spaces they can see to an AI model hosted by Atlassian (Forge LLMs), inside Atlassian's platform. Never page content. The answer is a CQL search shown to the person first. Nothing goes to an outside AI service. Kitefold doesn't store or log the request.
- No calls outside Atlassian; no analytics.
- Every Confluence call runs as the viewer from the browser, except the admin check (as the person, from the backend). No background jobs in v1.
- GDPR/CCPA: processor/service provider for the account IDs, as for app 1.
- Logs: counts, model name, token totals and error codes only, never query text, request text or titles.
---

## 8. Licence check (last Build v1 patch)
- `app.licensing.enabled: true`.
- UI: if `license.isActive` is false, the search page and macro show "Query & Bulk Actions needs an active licence" and run nothing.
- Resolvers refuse saved-search writes when unlicensed (reads still allowed, so the message can show the search name).
- Development installs are always treated as licensed.
- Tested on the demo site with `--license inactive`, then put back to `--license active` (as apps 1 and 2), on the development or staging install: a paid app's production version can't be installed by the CLI (app 2, 18 Oct).

---

## 9. Test data and testing
- **Spaces:** QB1, QB2, QB3 (content), QBSEC (permission tests: restricted pages, a page the test user can view but not edit), QBSHOW (screenshots). **Never change PROD, MKTG, CS, KF\* or LH\*.**
- **Seed script** `scripts/seed-qb.mjs`: about 3,000 pages and 300 blog posts in QB1–QB3 (including one label on 600+ items, for the rename test, and two near-duplicate labels to merge) (the same size as app 2's test site, so times and page sizes mean something) with known labels, a few attachments, parent/child trees, two authors. It only creates QB\* content. Writes `seed-summary.json` with expected counts (e.g. "label `draft` = 120, of which QB2 = 40"). Token created before, revoked after, never in screenshots.
- **Dates:** the API can't back-date pages, so date filters are tested with "today" ranges plus a dev-only "modified today" preset (refused in production), as app 2 did.
- **Browser testing** in a separate browser-testing session, only on "go", QB\* spaces only.
- **Large-site simulation** `npm run sim`: fake Confluence with 10k / 100k / 1M pages, up to 10,000 spaces, 50,000 labels, 10,000 people; latency and page sizes from §12.8; points counted by Atlassian's rules, **every call counted** (1 per request, +1 per page/space/attachment, +2 per user/group/permission, writes 1); 5, 20 and 50 busy sites sharing the 65,000-point pool; throttling, slow Confluence (2.5×) and paging that stops early.
- **Plain-English accuracy set** (`test/ask-cases.json`): 30 requests written against the seeded QB spaces, each with the expected result count from `seed-summary.json` (not an exact CQL string): 25 answerable (spaces, labels, types, dates, "me", text, ancestors, a person by name) and 5 that CQL can't do (should get "couldn't"). Pass mark: at least 27 of 30 right (90%), and no answerable request turned into a search that returns the wrong pages. Run against each candidate model; the cheapest that passes is used.
- **Points budget tests** (`src/lib/points.js` and the simulation): the estimate for each action matches §1.12's table; headers parsed with and without the `Beta-` prefix; a reservation over the hour's budget is refused with the right time; `r` in a header pauses heavy actions until `t`; a quota 429 pauses everything until `Retry-After`; a burst 429 is retried once; the macro reuses its results within 5 minutes and reloads after; CSV stops at 2,000 rows with the note.
- **Platform rule tests:** no resolver imports Forge's product-API fetch except `src/admin-check.js`; no screen imports a UI Kit component missing at runtime; saved-search resolvers ignore any owner sent by the page.
- Label rename/merge test: rename a seeded label used on 600+ items in QB1–QB3 (two runs of 500), merge two labels, check counts against `seed-summary.json`, a refused item, an archived item kept and listed, and undo.
- Tests to pass before submitting: builder ↔ CQL round trips; placeholders; paging and totals vs `seed-summary.json`; columns and sort; CSV contents; saved searches private vs shared with a second user; macro as two different viewers; each bulk action with preview, skip, refuse, undo; 429 handling in the simulation; settings Off hides bulk actions; licence inactive.

---

## 10. Pricing (level decided 20 Oct: the cheapest Kitefold app; numbers set at "Check competitors' prices and set yours")
- One paid app, Paid via Atlassian. 1–10 users free.
- **Draft before "Ask in plain English":** $0.18 for 11–100 users.
- **Proposed now (20 Oct), for the owner's $250–300 a year at 100 users:** $0.28 for 11–100. Atlassian's annual price is 10 × the monthly price and the bands are progressive (the first paid band covers users 1–100 once a site has more than 10), so 100 users pay **$280 a year** (or $28 a month).

| Users | Per user per month | Yearly total at the top of the band |
|---|---|---|
| 1–10 | Free | $0 |
| 11–100 | $0.28 | $280 (100 users) |
| 101–250 | $0.18 | $550 (250) |
| 251–1,000 | $0.11 | $1,375 (1,000) |
| 1,001–2,500 | $0.07 | $2,425 (2,500) |
| 2,501–5,000 | $0.055 | $3,800 (5,000) |
| 5,001–7,500 | $0.045 | |
| 7,501–10,000 | $0.035 | |
| 10,001–15,000 | $0.03 | |
| 15,001–20,000 | $0.028 | |
| 20,001+ | $0.025 | |

- **Why $0.28:** the middle of the owner's range, still below app 2 ($0.40, $400 a year at 100 users) and app 1 ($0.45), so app 3 stays the cheapest; the same shape as app 2's ladder, about 70% of it. $0.25 ($250) and $0.30 ($300) are the ends of the range.
- **Against the AI cost:** the smallest paid site (11 users) pays $3.08 a month; at its full allowance (275) its AI costs about $0.80. A 250-user site pays $55 a month; at its 2,500 ceiling, about $7.50 typical, never more than $15. Free sites cost at most $0.25 a month each.
- **Competitors:** CQL Search about $50 a year for 100 users; Capable Search free. The listing leads with what they lack: plain English, watchers, previews and undo, no delete.
- Editions after listing: v1 = Standard; v2 = Advanced (§13).
---

## 11. Name, listing and search phrases
Research: `kitefold/app-3-name-and-search.md` (18 Oct; top 8 Marketplace results per phrase, same method as apps 1 and 2). Words in the app name decide rank more than installs do.

- **Names (decided 18 Oct; listing name changed 21 Oct for search):**
  - Marketplace listing name (59/60): **Query & Bulk Actions: CQL Search, Labels, Watchers, Archive**. Why: words in the name decide rank, and the biggest group of searchers are CQL Search's 976 sites, so the exact words "CQL Search" go in the name; "Bulk Actions" (Bulk Action Tools' 367 sites), "Labels" and "Watchers" (an open phrase) stay; the listing name now starts with the name customers see inside Confluence. Only "Saved Searches" leaves the name; it stays in highlight 2 and the summary. "CQL Search" is used as a description after our own name, so it doesn't read as StreamlineSoft's app names joined together.
  - Inside Confluence (Forge app name, `forge register`, module titles): **Query & Bulk Actions**.
  - Backup (58/60): CQL Query & Bulk Actions: Saved Searches, Labels, Watchers (the 18 Oct choice).
  - Not "CQL Search & Bulk Actions": it reads as StreamlineSoft's two app names ("CQL Search", "Bulk Action Tools") joined together.
- **Can they differ? Yes.** The listing's name is entered on the listing, and the listing is linked to the Forge app by its app key. The Forge/developer console name is separate: MP-278 (open, updated Sep 2026) confirms listing changes don't flow to the developer console or into Confluence. Customers see the long name on the Marketplace and "Query & Bulk Actions" on the install permissions screen and in Manage apps. Renaming a Forge app later partly needs a support ticket, so register it with the short name from the start.
- **Draft listing text (updated 20 Oct, 16:57: leads with "check the query, save it, show live results, act on them in bulk"; plain English is one way in, never "the only"):**
  - Tagline (128/130, no ending punctuation): Check the query, save it, show live results on any page and act on them in bulk: labels, watchers, archive. Plain English or CQL
  - Summary (241/250): Check the query before it runs, save and share it, show live results on any page, and act on them in bulk: add, rename or merge labels, add watchers or archive pages, with a preview first. Write it in plain English or CQL. Runs on Atlassian.
  - Highlight 1 title (30/50): "Check the query before it runs". Summary (176/220): Ask in plain English, like "onboarding pages HR hasn't updated in a year", or type CQL. You see the exact query and can edit it before anything runs, then save it to use again.
  - Highlight 2: "Saved searches and a live results macro" (unchanged).
  - Highlight 3 title: "Bulk labels, watchers and archive, with a preview" (unchanged). Summary (203/220): Add or remove labels, rename or merge a label across every space you can edit, watch or unwatch, or archive pages. You see a preview first, every page gets a result, and labels and watches can be undone.
  - **Wording rule:** never "the only plain-English search" or "first AI search". Plain English is a convenience; the reasons to buy are the checked, saved, live and actionable query.
  - Categories: Administrative tools, plus Content and communication. Keywords: the 4 closest from Atlassian's fixed list (search, reporting, administration; "AI" if the list has it).
- **AI explanation (More details, Help page and reviewer note):** "Ask in plain English uses an AI model hosted by Atlassian (Forge LLMs). It receives only your request, the list of CQL fields the app allows and the names of spaces you can see, never page content, and it never leaves Atlassian. It writes a CQL search that you see and can edit before anything runs; the search then runs as you, so it only finds what you can already see. Nothing you type is stored. Each site has a monthly allowance; the builder and CQL box always work." Reviewer note adds: the `llm` module, the cheapest Claude model used, the allowance enforced in the backend, and the validator.
- **Search phrases tracked:** cql search, saved search, bulk actions, bulk watchers, search results macro, **bulk labels, rename label, merge labels** (added 20 Oct; label managers crowd "bulk labels", but "rename"/"merge" may be open). Re-run just before submitting, then monthly after launch. Also check once before submitting: "ai search" and "natural language" (they only shape the summary and highlights; the listing name changed on 21 Oct for "cql search", §0.2).
- **Migration page on kitefold.app:** "Moving from CQL Search or Bulk Action Tools before Connect ends". Factual and respectful; names the apps only to explain the switch.
- **Name check (done 21 Oct, browser chat):** UKIPO classes 9 and 42: no live marks for "Query & Bulk Actions", "Query and Bulk Actions", "CQL Query", "Bulk Action(s)" or "Query Bulk"; one registered word mark **"CQL"** (Cryptomathic Ltd, UK00912246971, classes 9 and 42, mainly cryptographic key management; renewal 2033). Accepted (21 Oct): here CQL means Atlassian's Confluence Query Language. Google: no exact matches for either name. Marketplace: no app with the same or a close name. New since 18 Oct: **Sift** (Hyperdella, 1 install: CQL search, saved queries, live result tables), Smart Search (Horizon Ventures, 0), Easy Bulk Tools for Confluence (Shinetech, 19), Bulk Operations for Confluence (Business Critical Apps, 3, find and replace). CQL Search 976, Bulk Action Tools 367, Navi 46, Capable Search 40.
- **Aim:** listed by about December 2026.
---

## 12. Still to confirm (API check step, dev-only code removed before submitting)
1. Watchers: add/remove another user as the owner (admin), as a non-admin test user, and `asApp`. Record exact status codes and messages.
2. Group members call with the granular scope (works from the UI?). For v2 only.
3. Which CQL `order by` fields work (title, created, lastmodified, others?).
4. The `expand`s needed for each column, the scopes they need, and the real per-call result cap with those expands.
5. Label add/remove responses on: a page the viewer can't edit, an archived page, an attachment.
6. `requestConfluence` from a UI Kit macro and global page: confirm it runs as the viewer, and **whether the browser can read response headers at all** (the header logging in §1.12 depends on it). Compare one browser call with one backend call (dev-only resolver, removed later): does the browser response carry `RateLimit-Policy` / `Beta-RateLimit-Policy`? (`r` only appears after ~80% use, so don't expect it.)
7. CQL Search's macro key and parameter names (the owner downloads the descriptor), to write the switching help page. Then, for a v2 migrator (§1.13.2): does CQL `macro = "<that key>"` find pages using it? If CQL Search can still be added to kitefold-dev as a trial, put its macro on one QB page and search; otherwise test the `macro` field with a built-in macro (for example `macro = toc`) and note that Connect macros are unconfirmed.
8. **Page sizes and speed** (3,000 seeded pages): results per call and time per call for each column set; a slow `text ~` query; deep paging to the end of a 3,000-result search on `/wiki/rest/api/search` and `/wiki/rest/api/content/search` (CONFCLOUD-84279); `totalSize` vs `seed-summary.json`; cursor length.
9. **Bulk write speed:** labels 4 at a time, then 8, until Confluence answers 429; record Retry-After.
10. **Do page calls count?** Atlassian's answer (ECOHELP-175732, 20 Oct): not sure, so design as if they do (§1.12). Still measure: 200 searches from the page over 5 minutes, recording every rate-limit header the browser can read (both `Beta-` and unprefixed) and any 429, and one backend call for comparison. If page responses carry `RateLimit-Policy`, that's a sign they're metered.
11. **Large-site simulation** (§9) → `kitefold/app-3-scale-test.md`, in "every call counts" mode: points per action against §1.12's table, the 5,000-an-hour site budget, and how many busy sites fit in the shared pool before the pool guard pauses heavy actions. Tune the budget and limits from it. The higher limits stay a later option (§1.12). Pickers always search as you type.
12. **The setting's resolver as a non-admin:** can Demo User One invoke it (from the browser console or the search page's context)? Expected yes; confirms it's a preference, not a control (§1.10.1).
13. **Watching for someone else as a non-admin:** the exact status and message Confluence returns, for the "stop at first refusal" text.
14. **Admin check for shared searches (§3.3):** as the owner (admin) and as Demo User One, from the backend as the person, try the candidate admin-only endpoints (system info, audit log, others). Pick one that answers 200 for admins and 401/403 for others, and note its scope. Also try the V2 content permissions reads (§1.13.1, §12.19) on a QBSEC page restricted to someone else. If none works for Forge, tell the owner (§0.4 fallback).
15. **Free vs paid in the licence:** on the demo site, compare the function-context licence for a paid licence, a trial (`isEvaluation`) and the free 10-user tier (if Forge can simulate it; otherwise ask Atlassian). Decides how the AI allowance tells free from paid (§3.5).
16. **AI cost per request:** run the 30 accuracy requests (§9) on Haiku 4.5 and Sonnet 5 (and Sonnet 4.6), record `usage.input_tokens` / `output_tokens` per request, and work out the cost per request, the worst case and the monthly totals. Write-up in `kitefold/app-3-scale-test.md`.
17. **AI accuracy:** the 30-request set (§9) on each candidate model; ≥ 27/30 to pass; the cheapest passing model becomes the first choice.
18. **Ask Atlassian in a separate support request (not ECOHELP-175732). Sent 21 Oct as ECOHELP-176558 (Ecosystem Support Request, Cloud, P4, vendor ID 574716167); waiting for the answer.** are Forge LLM prompts kept, for how long, used for training, and does processing follow data residency? Only then can the privacy page say more than "inside Atlassian". Draft:
    > **Subject:** Forge LLMs: prompt retention, training and data residency
    > Hello, we're building a Confluence Forge app that uses Forge LLMs (the `llm` module, Claude Haiku) to turn a user's typed search request into a CQL query. Before we describe this in our privacy policy and Marketplace listing, could you confirm: (1) Are prompts and responses sent through `@forge/llm` stored by Atlassian or by the model host, and if so for how long? (2) Are they ever used to train or improve models? (3) Does Forge LLM processing follow the customer's data residency location (for example EU or Australia)? If not, where is it processed? (4) Should we name Atlassian or Amazon Bedrock as a sub-processor, or is this covered by Atlassian's terms for Forge? (5) When a prompt is blocked by moderation, is anything recorded about the user? Thanks, Kitefold (support@kitefold.app)

19. **V2 content permissions APIs (§1.13.1):** as the owner and as Demo User One, from the page (`requestConfluence`, as the viewer) and from a dev-only backend resolver (`asUser`), call `GET …/restriction-state` and `GET …/permissions` on an unrestricted QB page, a QBSEC page restricted to Demo User One, a page edit-restricted to the owner only, and a blog post. Record the status codes, whether anything in the response describes the current user or their rights, the scopes `forge lint` asks for, the rate-limit headers and points per call, and whether the answer matches what Confluence then does on a label add (Done or Refused). Decides whether the bulk preview gets a "has restrictions" count and whether either read can be the admin check.

---

## 13. v2 / Advanced edition ideas (after listing)
- Add a whole **group** as watchers (CONFCLOUD-20118, 518 votes; CONFCLOUD-23015, 802). Depends on check 2.
- Scheduled searches that post a results page each week (app 1's digest pattern; needs impersonation). **These would run on the backend, so they count against the shared pool:** follow app 2's pool rules (per-site hourly cap, stop when the headers report the pool low or after any 429, per-site start offset) and app 1's digest limits, and budget them inside the shared pool (Tier 2 is never given on request, ECOHELP-175732).
- Bulk move; bulk restriction changes. For restrictions, use the V2 permissions APIs (14 Oct), not V1: since 15 Oct, V1 treats read as a prerequisite of update and rejects removing only read from someone who has both (§1.13.3).
- A CQL Search macro migrator (§1.7). Atlassian's macro index (RFC-142) doesn't apply (Data Center to Cloud only); finding the pages depends on the CQL `macro` test (§12.7, §1.13.2).
- Label manager extras beyond v1's rename and merge: split a label, a list of every label with counts, unused or near-duplicate labels.
- Dropped: drafts clean-up. App 2's check (14 Oct) found no public way to list drafts.

---

## 14. Build order (patches)
1. Starter project + SPEC.md + local notes file (excluded from Git) + tests skeleton, including the platform rule tests (§9). **Done 21 Oct** (also includes the seed script and the points budget logic, `src/lib/points.js`).
2. Register, deploy, install on kitefold-dev and the demo site.
3. seed-script (QB spaces, about 3,000 pages).
4. **api-check** (dev-only page running §12 checks 1–6, 8–10 and 12–15; removed later).
5. **large-site simulation** (`npm run sim`, §12.11), then the limits go into this spec.
6. **ai-check** (dev-only, on the API check page): the 30-request accuracy and cost run on each candidate model (§12.16–17), then the model choice and allowance go into this spec.
7. search-page: builder, CQL box, results, paging, columns, sort, **plus the points budget** (`src/lib/points.js`, `reserve` resolver, `pts:` records, header logging, pool guard), so every later feature spends through it.
8. **ask-plain-english** (§3.5): request box, `ask` resolver, validator, person placeholder, allowance counter, "couldn't" message.
9. csv-export.
10. saved-searches (owner and admin rights with the admin check, "Shared by", Copy to my searches).
11. results-macro.
12. bulk-labels (with the bulk framework: selection, preview, run, results, undo).
13. label-rename-merge (§3.4 item 4).
14. bulk-watch.
15. bulk-archive.
16. admin-settings.
17. remove-api-check (also removes the dev-only AI check and any scope only it needed).
18. usage guard (fixed call limits per action, one retry per call, bulk runs slow down and stop on repeated 429s, macro loads once per view, "Confluence was busy" count on the admin page).
19. large-site proof: the real code in the simulation.
20. design pass (after the design check).
21. licence-check (last).

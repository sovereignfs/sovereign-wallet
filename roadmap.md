# Sovereign Wallet — Roadmap

Chronological, dependency-ordered task queue for building the Sovereign
Wallet plugin. Each task is scoped to **one branch = one PR**, small enough
for an AI agent to pick up with minimal supervision. Full requirements:
[SPEC.md](SPEC.md).

## How to read this file

- **`[PLATFORM]`** tasks change the main **`claude-sv`** monorepo
  (`/Users/heimdallr/Dev/kasunben/sovereignfs/claude-sv`). They follow that
  repo's own `CLAUDE.md` / `docs/development-workflow.md` conventions
  (branch naming, version bumps, `docs/roadmap.md` + `docs/epics/` updates,
  draft PRs). **Do these in the `claude-sv` repo, not here.**
- **`[PLUGIN]`** tasks change **this repo** (`sovereign-wallet.local`, which
  becomes the public `sovereign-wallet` repo).
- Tasks are **sequenced** — don't start a task whose `Depends on` isn't ✅,
  unless tagged `[parallel]`.
- Status: `⬜ not started` / `🟨 in progress` / `✅ done`.
- **Unlike Sovereign Docs, this plugin's chosen phase-1 scope (cards &
  encrypted documents) is genuinely blocked on unbuilt platform capability.**
  Phase 1 below is real platform engineering, not a formality — expect it to
  take materially longer than the plugin-side phases that follow it.

---

## Phase 0 — Plugin repo bootstrap `[PLUGIN]`

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| W-00 | Bootstrap this repo: `package.json`, `tsconfig` (extend `@sovereignfs/tsconfig`), ESLint/Prettier config matching `claude-sv` conventions, `manifest.json` skeleton (id `fs.sovereign.wallet`, `type: sovereign`, `shell: default`), CI workflow, README pointing to SPEC.md + this roadmap. | — | ✅ |

---

## Phase 1 — Platform prerequisites for cards & documents `[PLATFORM]`

Must land in `claude-sv` before Phase 2's encrypted-document work (W-05) can
ship. Loyalty cards alone (W-03/W-04) don't strictly need encryption and can
start once W-00 is done, in parallel with this phase.

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| W-01 | **[PLATFORM]** Implement RFC 0044 (`sdk.storage`): replace the `NotImplementedError` stubs in `packages/sdk/src/unimplemented.ts` with a real `put()`/`get()` backed by an actual storage surface. Update RFC 0044 status + `docs/roadmap.md` / epic task 8.7. | — | 🟨 |
| W-02 | **[PLATFORM]** Implement RFC 0060 (client-side encryption core), step 1: manifest permission/capability for client-side encryption use; encrypted profile metadata tables (wrapped CMK, device enrollment records, recovery-secret wrapper metadata) + SDK types. | — | ⬜ |
| W-03 | **[PLATFORM]** RFC 0060 step 2: Account setup/unlock/recovery-secret UX (generate CMK in browser, wrap with recovery secret, device enrollment flow). | W-02 | ⬜ |
| W-04 | **[PLATFORM]** RFC 0060 step 3: SDK helpers for encrypting/decrypting `Blob`/`ArrayBuffer`/JSON metadata (`sdk.crypto.client` or `sdk.e2ee` — name is an open question in RFC 0060, resolve during this task), wrap/unwrap per-object DEKs, locked/unlocked state detection. | W-03 | ⬜ |
| W-05 | **[PLATFORM]** RFC 0060 step 4: integrate with `sdk.storage` (W-01) for encrypted binary object storage — upload/download ciphertext through the storage surface. | W-01, W-04 | ⬜ |
| W-06 | **[PLATFORM]** RFC 0060 step 5: export/delete behavior through the existing `sdk.portability` hooks (already implemented per RFC 0007 — confirm `blobs`/wrapped-key handling covers encrypted objects, extend if not). Update RFC 0060 status to Implemented, update `docs/roadmap.md` / epic task 8.9. | W-05 | ⬜ |

---

## Phase 2 — Plugin v0.1: cards & documents (Epic 21 scope) `[PLUGIN]`

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| W-07 | DB schema: `wallet_items`, `wallet_card_payloads` (see SPEC data model). Migration + Drizzle schema file. | W-00 | ✅ |
| W-08 | Wallet home view: empty state, card/document category tiles, nav using `@sovereignfs/ui` primitives. | W-07 | ✅ |
| W-09 | Loyalty card CRUD (create/view/edit/delete): display name, issuer, payload, format, notes. `[parallel]`-safe with Phase 1 — no encryption required for the payload itself. | W-08 | ✅ |
| W-10 | Browser-side QR/barcode rendering (resolve SPEC open question 11: library + supported formats first). No payload sent to an external service. | W-09 | ✅ |
| W-11 | Locked-state UI path for encrypted card payloads (resolve SPEC open question 10: encrypted-by-default or opt-in). | W-10, W-04 | ⬜ |
| W-12 | Sensitive-document upload flow: gate on client-side encryption setup (W-03) being complete; block upload otherwise with a clear explanation. | W-06, W-08 | ⬜ |
| W-13 | Browser-side binary encryption of document images before upload (encrypt → upload ciphertext via `sdk.storage`); encrypted human-readable metadata. | W-12 | ⬜ |
| W-14 | Browser-side decrypt-and-display flow using Blob URLs; recovery/locked-state UX explaining data-loss implications. | W-13 | ⬜ |
| W-15 | Optional front/back card image support via `sdk.storage` (W-01). | W-01, W-09 | ⬜ |
| W-16 | Portability hooks: export (encrypted metadata + wrapped keys + ciphertext storage objects), import (remap object IDs, preserve ciphertext), delete (idempotent removal of rows, wrapped keys, storage objects). Uses the already-implemented `sdk.portability`. | W-13, W-06 | ⬜ |
| W-17 | v0.1 hardening pass: tenant-scoping test sweep, locked-state edge cases, recovery-warning copy review, no-plaintext-leak audit (verify no route handler or log ever sees decrypted bytes). | W-16 | ⬜ |

**Cards & documents v0.1 is feature-complete after W-17.**

---

## Phase 3 — Plugin v0.2: finance ledger POC `[PLUGIN]`

No platform blockers — can run in parallel with Phase 1/2 if the team wants
two tracks moving, but numbered after per the chosen priority.

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| W-18 | DB schema: `wallet_profiles`, `wallet_accounts`, `wallet_categories`, `wallet_counterparties`, `wallet_transactions`, `wallet_import_batches`. Migration + Drizzle schema file. | W-00 | ⬜ |
| W-19 | Resolve SPEC open questions 1–4 (currency model, decimal precision, minor-units-vs-decimal storage, category defaults) before building forms/validation around them. | W-18 | ⬜ |
| W-20 | Wallet profile creation (auto on first ledger use) + manual account CRUD (name, type, currency, opening balance, status; archive/delete with confirmation). | W-19 | ⬜ |
| W-21 | Manual transaction CRUD: date, amount, direction, account, category, counterparty, notes; types income/expense/transfer/adjustment. | W-20 | ⬜ |
| W-22 | Paired transfer validation (two user-owned accounts, `transfer_group_id` linkage). | W-21 | ⬜ |
| W-23 | Balance calculation from opening balance + posted transactions. | W-21 | ⬜ |
| W-24 | Categories (add/rename/merge/archive/delete) + counterparties (add/reuse). | W-20 | ⬜ |
| W-25 | Transaction filter/search by account, date, category, counterparty, amount, text. | W-21 | ⬜ |
| W-26 | CSV import with user-reviewed column mapping (resolve SPEC open question 5: store original row data for audit?). | W-21 | ⬜ |
| W-27 | CSV export: accounts, categories, counterparties, transactions. | W-21 | ⬜ |
| W-28 | Ledger dashboard: totals by account type, recent activity, monthly income/expense summary. | W-23, W-24 | ⬜ |
| W-29 | v0.2 hardening pass: owner-scoping test sweep, transfer/balance correctness tests, import-mapping edge cases, export round-trip test. | W-26, W-27, W-28 | ⬜ |

**Finance ledger v0.2 (POC) is feature-complete after W-29.**

---

## Phase 4 — Plugin v0.3: ledger organization & audit `[PLUGIN]`

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| W-30 | Budgets by category and month. | W-29 | ⬜ |
| W-31 | Recurring transactions. | W-29 | ⬜ |
| W-32 | Transaction reconciliation states: pending, posted, reviewed, reconciled. | W-29 | ⬜ |
| W-33 | Statement import batches + duplicate detection. | W-26 | ⬜ |
| W-34 | Audit events for import, export, account changes, transaction deletion, reconciliation. | W-29 | ⬜ |
| W-35 | Receipt/statement attachments via `sdk.storage`. | W-01, W-29 | ⬜ |

---

## Phase 5 — Ledger Sovereign ID integration `[PLATFORM/PLUGIN — external dependency]`

**Not actionable yet.** Blocked on `local/sovereign-plugin-proposals/sovereign-id.md`,
which is itself an unbuilt, separate external plugin with no roadmap of its
own. Do not start these tasks until Sovereign ID has shipped a stable
identity/credential/signing interface.

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| W-36 | Link wallet profile to a Sovereign ID after explicit user approval. | Sovereign ID plugin (not started) | ⬜ |
| W-37 | Issue a wallet-readiness credential or local signed claim. | W-36 | ⬜ |
| W-38 | Sign wallet-sensitive actions through Sovereign ID where available. | W-36 | ⬜ |
| W-39 | Consent screens before sharing wallet credentials or financial claims. | W-36 | ⬜ |
| W-40 | Record signed approval artifacts for sensitive wallet operations. | W-38 | ⬜ |

---

## Phase 6 — Ledger external financial connections `[PLUGIN]`

SDK-ready today (`sdk.connections`, `sdk.secrets` both implemented) — only
gated on reaching this point in sequence, not on platform work.

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| W-41 | External provider connection records via `sdk.connections`. | W-29 | ⬜ |
| W-42 | Store provider tokens/secrets via `sdk.secrets` only. | W-41 | ⬜ |
| W-43 | Sync accounts/balances from approved providers. | W-42 | ⬜ |
| W-44 | Sync transactions from approved providers with duplicate detection and import review. | W-43, W-33 | ⬜ |
| W-45 | Provider disconnect + data-retention/deletion policy for provider-sourced data. | W-43 | ⬜ |

---

## Phase 7 — Ledger payment intents & approvals `[PLATFORM/PLUGIN]`

Blocked on Phase 5 (Sovereign ID signing) and a platform webhook primitive.

| ID | Task | Depends on | Status |
| --- | --- | --- | --- |
| W-46 | **[PLATFORM]** Implement RFC 0050 (public plugin webhooks) — needed for payment-provider status callbacks. Update RFC status + `docs/roadmap.md` / epic task 2.15. | — | ⬜ |
| W-47 | Payment intent creation (no automatic execution). | W-41 | ⬜ |
| W-48 | Approval/rejection flow: recipient, amount, provider, fees, risk warnings, explicit confirmation. | W-47, W-40 | ⬜ |
| W-49 | Store signed approval/rejection records via Sovereign ID (W-40). | W-48 | ⬜ |
| W-50 | Hand approved intents to configured payment provider. | W-49 | ⬜ |
| W-51 | Track payment status from provider callbacks (W-46) or polling. | W-50 | ⬜ |

---

## Deferred / optional (not blocking)

- **W-52** — **[PLATFORM]** RFC 0054 (plugin-scoped roles/grants) — only
  needed if shared wallets / accountant / approval-only roles are prioritized
  later. Neither track needs this for the phases above.
- **W-53** — **[PLUGIN]** Resolve SPEC open question 9 (split cards/documents
  and ledger into two plugins) — revisit once both tracks are past their POC
  and the access-model divergence (if any) is concrete rather than
  theoretical.

---

## Cross-repo sync note

Epic 21 in `claude-sv` (`docs/epics/sovereign-wallet.md`, tasks 21.1–21.4)
currently frames Wallet as a first-party in-monorepo plugin. This roadmap
uses the external-repo model instead (per SPEC.md's
[Repo-model deviation](SPEC.md#repo-model-deviation-from-rfc-0061)). Someone
should reconcile Epic 21's task descriptions (or close it in favor of this
repo) **before** Phase 1/2 work starts, so the platform roadmap doesn't carry
a stale, conflicting plan. This is a `[PLATFORM]` documentation task, not
tracked with a `W-*` ID here since it's a one-time reconciliation, not part
of the build sequence.

## Changelog

| Date | Change |
| --- | --- |
| 2026-07-12 | Initial roadmap, derived from merged SPEC.md + platform audit. |
| 2026-07-12 | W-00 done: repo bootstrap (package.json, tsconfig, manifest.json, icon, CI, README). No local ESLint/Prettier override added — `plugins/*` is already covered by `claude-sv`'s single root config per its "one config, entire monorepo" rule. |
| 2026-07-12 | W-07 done: `wallet_items`/`wallet_card_payloads` Drizzle schema (`app/_db/schema.ts`, re-exported from `db/schema.ts` for `drizzle-kit generate`) + generated SQLite migration. Manifest resolves to SQLite only (`isolation: isolated, dialect: sqlite`), so no Postgres schema/migration variant is needed. Verified: migration applies cleanly against the provisioned isolated store (`data/plugins/fs.sovereign.wallet.db`) on `pnpm dev` startup. |
| 2026-07-12 | W-08 done: home view (`app/page.tsx`) — `PageHeader` + `EmptyState` (whole-wallet empty case) + two `Card`-tile categories (Cards, Documents) linking to `/wallet/cards` and `/wallet/documents` (built in W-09/W-12), each showing a per-kind item count from `app/_lib/counts.ts`. Verified: typecheck/lint/format clean; counts query logic verified directly against the isolated SQLite store (tenant/owner scoping confirmed correct). Browser UI verification blocked by a sandboxed-preview auth quirk (session cookie doesn't persist across the auth↔runtime redirect in this environment) — not a code defect; unauthenticated `/wallet` access was already confirmed clean in W-00. |
| 2026-07-12 | W-09 done: loyalty card CRUD — `app/_lib/actions.ts` (`listCards`/`getCard`/`createCard`/`updateCard`/`deleteCard`, tenant+owner scoped throughout), `app/cards/page.tsx` (list + `NewCardDialog`), `app/cards/[cardId]/page.tsx` + `CardDetailView` (view/inline-edit/delete with `ConfirmDialog`). Payload/metadata stored plaintext for now (`payloadEncrypted: false`, `encryption_version: null`) — cards are "encryption recommended, not required" per SPEC's data-class table; `wallet_items.encrypted_metadata` holds a plain JSON `{title, issuer, notes}` blob until W-11 wires real encryption into the same column (no schema change anticipated there). Barcode format is a fixed enum (qr/code128/code39/ean13/upc/other) pending W-10's format-support decision. Verified: typecheck/lint/format clean; full create→list→update→get→delete flow verified against a scratch SQLite DB using the exact query shapes from actions.ts (all correct, including `.returning()` and the join). Browser UI verification blocked by the same sandboxed-preview auth quirk noted under W-08. |
| 2026-07-12 | W-10 done: resolved SPEC open question 11 — `qrcode` (QR, canvas) + `jsbarcode` (Code 128/39, EAN-13, UPC, inline SVG), both dynamically imported client-only so neither lands in a server bundle; `other` falls back to showing the raw payload text. New `CodeDisplay` component wired into `CardDetailView`'s view mode. No payload ever leaves the browser. Verified: typecheck/lint/format clean; both libraries' import shape and `qrcode`'s encode path confirmed directly in Node. Browser UI verification blocked by the same sandboxed-preview auth quirk noted under W-08/W-09. |
| 2026-07-12 | W-01 in progress: implemented RFC 0044 (`sdk.storage`) in `claude-sv` — put/get/delete/list/getSignedUrl, `plugin_storage_objects` metadata table, local-filesystem backend (Tier 0), env-configurable quotas, a signed-download route (`/api/storage/[token]`), and account-deletion cleanup. Full `claude-sv` suite green (format/lint/typecheck/834 tests) plus a live boot smoke-test and a security-check pass (matcher-only middleware change, no redirect/CSP/cookie code touched). Per `claude-sv`'s own workflow (branch-per-task, draft PR, never auto-merged — confirmed with the developer, distinct from this repo's direct-to-main convention), opened as a **draft PR, not yet merged**: [sovereignfs/sovereign#199](https://github.com/sovereignfs/sovereign/pull/199). W-01 flips to ✅ here once that PR merges. |

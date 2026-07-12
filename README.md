# Wallet

Wallet is a Sovereign plugin for a private wallet: QR/barcode loyalty cards,
client-side encrypted sensitive-document snapshots, and a manual personal
finance ledger. Full requirements: [SPEC.md](SPEC.md). Build sequencing:
[roadmap.md](roadmap.md).

## Local development

To test this standalone checkout against the platform, clone or copy it into
a platform workspace as a plugin checkout:

```bash
plugins/sovereign-wallet
```

Then run the platform generate/dev workflow from the platform repository:

```bash
pnpm generate
pnpm dev
```

The app is served at `/wallet` once composed by the platform.

## Current scope

This repository is at the bootstrap stage (roadmap task W-00): manifest,
package/tsconfig scaffolding, CI, and this README. No wallet functionality is
implemented yet.

Most of the cards & documents track (v0.1) is blocked on platform work that
doesn't exist yet — `sdk.storage` (RFC 0044) and the client-side encryption
core (RFC 0060). See [SPEC.md](SPEC.md#current-platform-capability-status-re-verified-july-2026)
for the full capability table and [roadmap.md](roadmap.md) for the phase
sequencing. The finance-ledger track (v0.2) has no platform blockers and can
start once this bootstrap task lands.

## Identity

| Property     | Value                 |
| ------------ | ---------------------- |
| Plugin ID    | `fs.sovereign.wallet`  |
| Route prefix | `/wallet`               |
| Permissions  | `auth:session`, `db:readWrite` |
| Min platform | `0.19.0`                |
| Table prefix | `wallet_`               |
| Database     | isolated SQLite         |

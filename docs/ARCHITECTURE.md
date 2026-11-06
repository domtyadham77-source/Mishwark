# Architecture notes

- Cloudflare Pages serves `public/` and discovers root `functions/` for Pages Functions.
- D1 (`DB`) is the source of truth for accounts, rides, offers, settings, subscriptions, offers, notifications, ledger, sessions, and audit records.
- Private captain identity-document storage is currently intentionally unconfigured. Do not store identity files in D1, KV, or public assets. Add a private object-storage binding only after the owner approves the storage provider and billing setup.
- The admin UI lives under `/admin/`, has no PWA manifest link, and is not linked from passenger/captain navigation.
- The map remains an isolated future component; do not implement geographic behavior until the user supplies the three map images.
- All money values are integer piasters. Fixed routes are stored in `fixed_routes`; negotiated bounds are stored in `app_settings`.
- Cairo local date is used for the captain's daily ledger summary. Ledger inserts are unique per ride.
- Never store secrets in source control. Never put private documents in Pages static assets.

## Incomplete production requirements
Telegram identity linking and one-time recovery, push delivery/signing, rate limits, full ride UIs, mutual-offer workflow decision, and production integration/load/security testing remain open. See README for exact API coverage and setup.

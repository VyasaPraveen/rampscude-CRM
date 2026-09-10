# RAMPS CUBE CRM

Modern PWA CRM for RAMPS CUBE commercial refrigeration workflows. Next.js static
export (no Node server in production) backed by a small self-hosted PHP + MySQL
sync endpoint.

## Run Locally

```bash
npm install
npm run dev -- -p 3000
```

Open `http://localhost:3000`.

## Architecture

| Piece | Where | Notes |
| --- | --- | --- |
| App | `src/` | Next.js 15 App Router, `output: "export"` — builds to static HTML/JS |
| Sync client | `src/lib/sync.ts` | Polls the endpoint every 8s; last-write-wins per module |
| Sync endpoint | `server/api.php` | Reads/upserts one JSON row per module in `crm_workspace` |
| Server config | `server/htaccess.conf` | Security headers, CSP, cache rules, `Authorization` passthrough |

Data is cached in `localStorage` on each device and mirrored to the server, so
the app keeps working offline and re-syncs when the endpoint is reachable.

## Configuration

Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SYNC_API_URL=/api.php
NEXT_PUBLIC_SYNC_TOKEN=<the same long random secret as crm-sync-config.php>
```

Both values are inlined into the static bundle at build time and are therefore
readable by anyone who can load the app. The shared token gates the endpoint
against the open internet — it is **not** a per-user credential. Keep the CRM
behind a URL you do not publish, and rotate the token if it leaks.

### Server side

`server/api.php` expects a config file **above the web root** (never served):

```php
<?php // /home/<account>/crm-sync-config.php
return [
  'token'   => '<the same secret as NEXT_PUBLIC_SYNC_TOKEN>',
  'db_host' => 'localhost',
  'db_user' => '...',
  'db_pass' => '...',
  'db_name' => '...',
];
```

The table it reads and writes:

```sql
CREATE TABLE crm_workspace (
  module_key VARCHAR(64) NOT NULL PRIMARY KEY,
  payload    LONGTEXT    NOT NULL,
  updated_at BIGINT      NOT NULL,
  INDEX (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## Build & Deploy

```bash
npm run build
```

This runs `next build` and then `tools/postbuild.mjs`, which copies
`server/htaccess.conf` → `out/.htaccess` and `server/api.php` → `out/api.php`.
**`out/` is then the complete docroot** — upload its contents as-is.

Do not upload the bare `next build` output: without `.htaccess` the deployment
loses its CSP and security headers, its 404 mapping, and the `Authorization`
header rewrite that cross-device sync depends on.

Bump `APP_VERSION` in `src/lib/version.ts` on each deploy — it is shown in the
sidebar footer so any device can be checked against the live build at a glance.

## Licensing

The CRM is gated by a signed yearly key (`src/lib/license.ts`). A key encodes its
own term (`RCUBE-<from>-<until>-<signature>`) and is verified offline against a
secret baked into the build. Renewal is simply a key with a later end date; the
app warns for the last 30 days of the term and hard-locks after it.

Because the signing secret ships in the bundle, this deters casual tampering but
is not strong per-install binding — that would need a licence server.

## First Sign-In

A brand-new workspace ships one bootstrap admin, `admin@rampscube.com` /
`admin123`, defined in `src/lib/seed-data.ts`. **Change this password from the
Users module before entering real data.** The plaintext seed is replaced with a
PBKDF2-SHA256 hash on first load; staff accounts are created from Users.

All other modules start empty.

## Modules

- **Customers** — Name & Phone required; town/address, brand/model, product type,
  source, and per-purchase payment tracking
- **Inventory** — brand, model, serial, purchase/sale prices, GST slab, sale status
- **Leads** — walk-in / online / social capture, auto-draft quotation, convert to customer
- **Orders / Services** — status, delivery, technician, dates
- **Payments** — balance and Paid/Partial/Pending computed from the linked purchase
- **Invoices** — mark Created / Shared, add manually, or import a Tally CSV export
- **Quotations** — line items with GST-inclusive maths, PDF + WhatsApp share
- **Overall Search** — one tab across customers, inventory and leads
- **Users** (admin) and **Attendance** with a monthly grid
- **Reports** — CSV export and dashboard charts
- **Backup** — daily local snapshot plus a downloadable off-device JSON backup

Customers, Orders and Payments are kept in two-way sync: money entered in any one
of them is written onto the customer's purchase and reflected in the other two.

## Checks

```bash
npm run typecheck
npm run lint
```

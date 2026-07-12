# RAMPS CUBE CRM

Modern PWA CRM MVP for RAMPS CUBE commercial refrigeration workflows.

## Run Locally

```bash
npm.cmd install
npm.cmd run dev -- -p 3000
```

Open `http://localhost:3000`.

## Firebase Setup

The Firebase web app config is wired for project `ramps-cube-crm-mvp`. The app includes a Firebase client in `src/firebase/client.ts`, Firestore rules, Storage rules, `.firebaserc`, and `firebase.json`.

## Deploy

```bash
npm.cmd run build
firebase.cmd deploy --only hosting,firestore:rules,storage --project ramps-cube-crm-mvp --non-interactive
```

If Firebase Storage has not been initialized in the Firebase Console yet, deploy Hosting and Firestore first:

```bash
firebase.cmd deploy --only hosting,firestore:rules --project ramps-cube-crm-mvp --non-interactive
```

## Demo Access (3-day evaluation)

The app ships as a time-limited demo. Access is granted for **3 days**, after which the whole UI locks behind a **"Demo access expired"** screen (login and dashboard both blocked).

Two guards are combined and the earlier one wins:

- **Hard cut-off** — `NEXT_PUBLIC_DEMO_EXPIRES_AT` (absolute ISO 8601, UTC) is inlined into the static build and cannot be changed by the client. Set it to *deploy time + 3 days*.
- **Rolling window** — if no hard cut-off is set, the demo lasts 3 days from the device's first launch (tracked in `localStorage`).

The window is re-checked every minute, so an open session locks the moment it lapses without a manual refresh.

**To hand a fresh 3-day demo to a client**, update the deadline and redeploy:

```bash
# .env.local  →  set to now + 3 days, e.g.
NEXT_PUBLIC_DEMO_EXPIRES_AT=2026-07-14T13:56:45Z

npm.cmd run build
firebase.cmd deploy --only hosting --project ramps-cube-crm-mvp --non-interactive
```

Demo login: `admin@rampscube.com` / `admin123` (any valid email + 6+ char password works).

## Current MVP Scope

- Role-aware login (Admin / Staff) with React Hook Form and Zod validation
- Responsive SaaS dashboard with CRM navigation
- Seeded demo records for customers, products, enquiries, quotations, orders, services, and payments
- **Editable quotations** — create/edit with live line items and auto subtotal, discount, GST, and total
- **User management** (admin only) — create, edit, activate/deactivate and remove staff & admin accounts
- **Staff attendance** — mark daily attendance, monthly attendance grid, and present/leave/attendance-% summaries
- Search, filters, status badges, reports, settings, and add customer flow
- Data persists in the browser (localStorage) across reloads
- PWA manifest, app icon, and production service worker

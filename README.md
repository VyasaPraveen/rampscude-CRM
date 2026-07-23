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

## Demo Access

The app ships as a time-limited demo. After the cut-off the whole UI locks behind a **"Demo access expired"** screen (login and dashboard both blocked). **Current window: through 25 July 2026 (IST).**

- **Hard cut-off** — `NEXT_PUBLIC_DEMO_EXPIRES_AT` (absolute ISO 8601) is inlined into the static build and cannot be changed by the client. When set, it is **authoritative for every client**, regardless of when they first opened the app.
- **Rolling window** — if no hard cut-off is set, the demo lasts 3 days from the device's first launch (tracked in `localStorage`).

The window is re-checked every minute, so an open session locks the moment it lapses without a manual refresh.

**To change the demo end date**, update the deadline and redeploy:

```bash
# .env.local  →  set the absolute end date, e.g. end of 25 July 2026 (IST)
NEXT_PUBLIC_DEMO_EXPIRES_AT=2026-07-25T23:59:59+05:30

npm.cmd run build
firebase.cmd deploy --only hosting --project ramps-cube-crm-mvp --non-interactive
```

Demo login: `admin@rampscube.com` / `admin123`. All modules start empty — staff accounts are created from the **Users** module, and every other module is filled in by the client.

## Current MVP Scope

- Role-aware login (Admin / Staff) with React Hook Form and Zod validation
- Responsive SaaS dashboard with CRM navigation
- **Customers** — Name & Phone required; Town/Address, Product Brand & Model, Company, Email, GST optional
- **Inventory** — brand, model, serial no, price, purchased-from, purchase invoice; add **and edit**
- **Leads** — walk-in / online / social-media capture with nature of enquiry, interest, description; add **and edit**
- **Orders / Services** — add and edit (status, delivery, technician, dates)
- **Payments** — record a payment; balance and Paid/Partial/Pending status auto-computed
- **Invoices** — mark Created / Shared, add manually, or import a Tally CSV export. **In live production, Tally Sync will be enabled** (auto-sync connector)
- **Overall Search** — one tab searching customers, inventory and leads by name, town, phone, brand, model
- **Editable quotations** — line items with auto subtotal/discount/GST/total, one-click PDF + WhatsApp share
- **User management** (admin only) and **Staff attendance** with a monthly grid
- Reports export to CSV, real dashboard charts, and save toasts
- Data persists in the browser (localStorage) across reloads
- PWA manifest, app icon, and production service worker

# Savoralivingcrm

Build Prompt: Savora Inventory & Sales CRM

Use this as a spec/prompt for a developer or AI coding agent (Claude Code, Cursor, Replit Agent, etc.) to build the platform.

---

1. Project Goal

Build a lightweight, smooth-to-use CRM/dashboard for Savora that pulls live data from a connected Google Sheet and gives a single place to see:

Inventory stock on hand (raw materials)

Boxes made, broken down by SKU

How many finished "sets" can currently be assembled from available stock

Monthly sales

General item/order tracking (CRM view)

Scope the platform to 5 product collections only:

`Zebra`, `Mini`, `Le Cirque`, `Mahjong`, `Orchid`

Collection name mapping (confirmed / to confirm):

CRM collection	Sheet tab	savora.in collection

Orchid	Eden Bloom	Eden Bloom ✅ confirmed

Mini	MINI	Masai Minis (likely)

Le Cirque	LE CIRQUE	Le Cirque ✅

Zebra	ZEBRA	Unconfirmed — no "Zebra" collection found on savora.in; "Masai"/"The Masai Collection" (animal-print pattern) is the closest match and may be the same line under a different public name. Confirm internally before building.

Mahjong	MAHJONG	Unconfirmed — not found on savora.in at all (may be sheet-only, discontinued, or unlisted). Confirm internally before building.

Keep this mapping in a config file so collection names/tab references are a one-line change if any of the above turns out wrong.

2. Data Source

Google Sheet: "Savora Inventory - Stock & Prints"

`https://docs.google.com/spreadsheets/d/1dixSJJzV6SunQ5dKZJt9ViEH1G1d7hkWGZlcAk3EdsE`

Relevant tabs identified in the sheet:

`Boxes Stock by Vineet` — box inventory by SKU

`Zebra Production cost`, `Mini Production Cost`, `Le cirque Production Cost`, `Mahajong Production Cost`

`ZEBRA`, `Savora Costing_Zebra`

`MINI`, `Savora Costing_Minis`

`LE CIRQUE`, `Savora Costing_Le cirque`

`MAHJONG`

`EDEN BLOOM`, `Savora Costing_Eden Bloom`, `Glasses`

`PARAKEET`

`Sales sheet`

`Debit/Credit per month`

`Firm Details`, `Future Roadmap`, `Name Print Sheet`, `Ceramic Dinner Ware - Distributor & Suppliers`, `Instagram - to be built`

Integration approach:

Use the Google Sheets API (read-only scope) with a service account, OR the `gspread` / `googleapis` client library.

Sync on a schedule (e.g., every 15–30 min) or on-demand refresh button — sheets are edited manually, so avoid write-back unless explicitly requested later.

Build a thin "sync layer" that maps each tab to a normalized internal schema (see below), so messy/inconsistent sheet formatting doesn't break the app. Sheets currently have inconsistent headers/merged cells — the sync layer must tolerate blank rows, merged header cells, and inconsistent date formats (dd.mm.yyyy vs m/d).

3. Core Modules

A. Inventory Stock (Material on Hand)

Pull raw material quantities per collection/SKU from the relevant collection tabs (e.g., ZEBRA, MINI, LE CIRQUE, MAHJONG, Orchid-equivalent).

Show current quantity on hand, unit, and low-stock flag (configurable threshold per SKU).

Filterable/searchable by collection and SKU.

B. Boxes by SKU

Pull from `Boxes Stock by Vineet`.

Show boxes made, grouped by SKU and collection.

Show box production cost alongside quantity (from the "Production cost" tabs) for margin visibility.

C. Sets Buildable (Kitting Logic)

A "set" = a defined bill-of-materials (BOM): X units of raw material + 1 box of a matching SKU.

For each collection/SKU, calculate: `sets_buildable = min(floor(material_qty / material_per_set), box_qty)`

BOM source: savora.in — Savora runs on Shopify. Each published "Set" product (e.g., "Le Cirque Set," "Eden Bloom Tea Set," "Masai Dinner Set") already lists its component pieces on the product page. Use this as the source of truth for BOM composition instead of manual entry:

Pull product + variant data via the Shopify Storefront API (or Admin API if the team has store access) for each collection.

Where a "Set" product bundles multiple distinct pieces (e.g., dinner set = plates + bowls + mugs), parse the product description/line items to build the BOM (piece name + quantity per set). If Shopify doesn't expose bundle composition structurally (most bundle apps don't), this may need a one-time manual mapping screen seeded from the product page content, then kept in the `bom` config table below — auto-pull for product names/prices, manual for exact per-piece quantities.

Sync collection/product/price list from Shopify on the same schedule as the Sheets sync, so new products or price changes on the site reflect in the CRM.

Show "Buildable Now" as a live count per collection, with a breakdown of what's the limiting factor (materials vs. boxes).

D. Sales — Monthly View

Pull from `Sales sheet` and `Debit/Credit per month`.

Show sales by month, filterable by collection.

Basic KPIs: total sales this month, month-over-month trend, top-selling collection/SKU.

Client-level view (client name, billing details, amount, status — e.g., Received / Invoice raised / Pending), matching the columns already in the sheet (Client Name, Billing Details, Amount, Status).

E. CRM / Item Tracking

A unified table/list view: item/SKU, collection, stage (raw material → box made → set assembled → sold), quantity, last updated.

Order/client tracking: client name, order date, items ordered, status (Received / Invoice raised / Pending / Delivered).

Search + filter across collection, status, and date range.

Simple activity log (what changed, when) so it's easy to trust the numbers.

4. Authentication (Email-Confirmation Login)

Sign-up flow: user enters name + email + password → system sends a confirmation link to that email → account is only activated (able to log in) once the link is clicked. Unconfirmed accounts can't access the dashboard.

Login flow: standard email + password. Block login with a clear message ("please confirm your email") until confirmed.

Password reset: "forgot password" sends a reset link to the registered email, same pattern as confirmation.

Session handling: JWT or signed session cookie, reasonable expiry (e.g., 7 days) with re-login required after.

Roles (optional, confirm with team): Admin (full access, can edit BOM/thresholds) vs. Viewer (read-only dashboard) — only needed if more than one person will log in with different trust levels.

Email delivery: use a transactional email service (Resend, SendGrid, or Postmark) for confirmation/reset emails rather than a raw SMTP box — better deliverability and easier to set up.

Implementation note: if using Supabase or Firebase Auth, email-confirmation sign-up is built in and saves significant build time — worth considering over rolling custom auth.

5. Suggested Tech Stack

Frontend: React + Tailwind (dashboard with cards/tables, mobile-friendly)

Backend: Node.js/Express or Python/FastAPI — handles Google Sheets sync, Shopify sync, and business logic (BOM/kitting calc)

Database: PostgreSQL or SQLite (cache the sheet/Shopify data locally so the app is fast and doesn't hit external APIs on every page load)

Auth: Email/password with email confirmation (see Section 4) — Supabase Auth or Firebase Auth recommended to avoid building this from scratch

Hosting: Vercel/Render for frontend+backend, or a single VPS if preferred

6. Suggested Data Model (simplified)

```

users: id, name, email, password_hash, email_confirmed_at, role, created_at

collections: id, name, sheet_tab_ref, shopify_collection_handle

skus: id, collection_id, name, unit, shopify_product_id

raw_materials: id, sku_id, quantity_on_hand, unit, low_stock_threshold, last_synced

boxes: id, sku_id, quantity_on_hand, production_cost, last_synced

bom: id, sku_id, component_name, qty_required_per_set, source ('shopify'|'manual')

sales: id, date, collection_id, sku_id, client_name, billing_details, amount, status

sync_log: id, source ('sheets'|'shopify'), tab_or_endpoint, synced_at, row_count, status

```

7. UX Requirements

Single dashboard home screen: 5 collection cards (Zebra, Mini, Le Cirque, Mahjong, Orchid), each showing at-a-glance: stock health, boxes on hand, sets buildable now, this month's sales.

Drill-down per collection into the 5 modules above.

Clean, minimal, fast — this is an internal ops tool, not a public-facing product. Prioritize clarity of numbers over decoration.

Manual "Sync Now" button in addition to scheduled sync, with a visible "last synced" timestamp so the team trusts the data.

8. Open Questions to Resolve Before Building

Confirm what "Orchid" maps to ✅ Resolved: Orchid = Eden Bloom.

Confirm whether Shopify Admin API access is available (needed for full product/inventory data — Storefront API alone only sees published, customer-facing info, not stock levels).

Confirm the "Zebra" and "Mahjong" collection mapping to savora.in — not verified in this pass (see table in Section 1).

Confirm per-piece BOM quantities for each "Set" product, since Shopify likely won't expose bundle composition structurally and this will need one manual pass to seed the `bom` table.

Confirm whether roles (Admin vs. Viewer) are needed, or everyone gets the same access.

Confirm whether write-back to the sheet is ever needed, or if the CRM becomes the new source of truth going forward.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://savoralivingcrm.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/25b7d1ff-be52-4617-8848-de9246867482).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

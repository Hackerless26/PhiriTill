# PoxPOS (PhiriTill)

Mobile-first POS + inventory system with Supabase and Netlify Functions.

## Stack
- Frontend: Vite + React + TypeScript (PWA)
- Backend: Supabase (Postgres + Auth + Realtime)
- Functions: Netlify Functions (secure writes)

## Setup
1) Install dependencies
   - `npm install`

2) Environment
   - Copy `.env.example` to `.env` and fill in keys.

3) Database
   - Run `supabase/schema.sql` in Supabase SQL Editor.
   - Run `supabase/storage.sql` as `postgres` (avatars bucket + policies).
   - Optional demo data: run `supabase/seed.sql`.

4) Run dev server
   - `npm run dev`

## Notes
- Netlify Functions are used for critical writes (checkout, stock, PO, returns).
- Reads use direct Supabase queries.
- If you want local function emulation, use `netlify dev` (requires Netlify CLI).

## Key Pages
- Dashboard
- POS (Sell)
- Products
- Stock Receive / Adjust / Movements / Returns
- Sales History
- Reports
- Suppliers / Purchase Orders
- Branches
- Users & Roles
- Profile / Settings

## Functions
- `/.netlify/functions/checkout`
- `/.netlify/functions/stock-receive`
- `/.netlify/functions/stock-adjust`
- `/.netlify/functions/product-upsert`
- `/.netlify/functions/supplier-upsert`
- `/.netlify/functions/purchase-order-create`
- `/.netlify/functions/purchase-order-receive`
- `/.netlify/functions/return-process`
- `/.netlify/functions/branch-upsert`

## Auth
- Email or phone + password.
- Roles: admin, manager, cashier.

## PWA
Install the app from the browser on mobile once deployed.

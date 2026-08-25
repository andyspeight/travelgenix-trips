# Travelgenix Trips

A group travel booking and payments platform. Operators sell trips, travellers
book and pay, and the money lands in the operator's own Stripe account.

Trips is built on Stripe Connect Standard, so the operator is the merchant of
record. Travelgenix never holds traveller funds and takes nothing per
transaction.

## Status

**Phase 0, foundations.** The app boots, resolves a session over the existing
Travelgenix SSO, and reads the Trips database. There is no booking engine yet.

| Phase | | Status |
|---|---|---|
| 0 | Foundations | done |
| 1 | Trips and departures as first-class records | next |
| 2 | Deposits and checkout | pending Stripe setup |
| 3 | Payment plans | pending Stripe setup |
| 4 | Travellers, forms, waivers | ready |
| 5 | Packages and rooming | ready |
| 6 | Operator console | pending Stripe setup |
| 7 | Traveller app hookup | ready |
| 8 | Self-serve signup | pending Stripe setup |

## Running it

```bash
npm install
cp .env.example .env.local     # then fill it in
npm run dev
```

`GET /api/health` reports what is wired without revealing any value:

```json
{ "ok": true, "phase": 0, "database": "configured", "stripe": "missing" }
```

```bash
npm test            # node:test over the real TypeScript sources
npm run typecheck
```

## The database

Supabase project `group-trips`. `gt_001` created bookings, payments and reminders
for the original widget. `gt_002_platform.sql` in this repo turns that into a
platform schema: operators, trips, departures, packages, options, payment plans,
instalments, travellers, forms, waivers, signatures and documents.

RLS is on for every table with no policies. The service role is the only way in
and the browser never connects.

## Conventions

`CLAUDE.md` carries the locked technical decisions and the rules that must hold.
Read it before changing anything, particularly the ones about who owns a trip,
where traveller data may live and why we never take a cut of a payment.

Note that this repository is public: product and commercial context lives
elsewhere, and nothing sensitive belongs in here.

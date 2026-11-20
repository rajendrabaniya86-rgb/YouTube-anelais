# GLOBAL TRUST NETWORK

A privacy-first digital ledger for small shops and their customers.

## Current stage
This repository is being rebuilt from the former YouTube demo into the Global Trust Network project. The current commit creates the first frontend prototype only. It uses local demo data in the browser; it does **not** yet provide real accounts, cloud sync, payments, AI credit decisions, or production security.

## MVP direction
- Shop dashboard with total receivables and recent activity
- Customer ledger with credit and payment entries
- Clear balance calculations and transaction history
- Consent-first sharing and dispute-ready audit design
- Hindi-first, mobile-friendly interface

## Run locally
```bash
npm install
npm run dev
```

## Planned architecture
- Frontend: React + Vite
- Backend: Supabase Auth + PostgreSQL with Row Level Security
- Offline: IndexedDB and an explicit sync queue
- Hosting: Vercel
- AI: explainable summaries only, never an automatic lending decision

## Privacy principles
1. A shop sees only its own customer and transaction records.
2. Cross-shop sharing requires clear, purpose-specific customer consent.
3. No public payer blacklist or permanent character score.
4. Corrections create an audit event; settled history is not silently erased.
5. Never store raw fingerprint or face data.

See [docs/PRODUCT-PLAN.md](docs/PRODUCT-PLAN.md) and [docs/SECURITY-PRINCIPLES.md](docs/SECURITY-PRINCIPLES.md).

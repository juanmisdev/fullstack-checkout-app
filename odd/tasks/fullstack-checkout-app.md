# Feature: fullstack-checkout-app

## Objective
SPA + API for a product checkout flow: product page → card/delivery form → summary → payment → receipt with printed-invoice animation → stock updated. Public GitHub repo (no company name), deployed docs in README.

## Problem / Why
Technical test evaluation: API design, clean architecture (Hexagonal + Ports & Adapters, ROP), >80% Jest coverage, resilient UX, mobile-first design.

## Scope & Constraints
- Frontend: React (Vite, TS), Redux Toolkit, Tailwind + shadcn/ui, receipt-printer animation (dqnamo) for final invoice.
- Backend: NestJS (TS), Hexagonal architecture, ROP use cases, PostgreSQL (or SQLite for dev) + ORM.
- Payment gateway sandbox integration (UAT sandbox keys from test doc — kept OUT of the public repo, .env only).
- No company name anywhere in the public repo.
- Repo: https://github.com/juanmisdev/fullstack-checkout-app

## Route declaration
- Route: delegated-direct for multi-file features; inline for scaffolding/mechanical files.
- Triggers observed: multi-file writes (backend domain, frontend pages) → writer delegation where non-trivial.

## Tasks

- [x] T1 — Convert test PDF to FULLSTACK-TEST.md (local only, NOT pushed to public repo)
- [x] T2 — Create public repo `fullstack-checkout-app`, initial README + .gitignore, first commit + push
- [x] T3 — Scaffold backend (NestJS + TS) — commit 849b393
- [x] T4 — Scaffold frontend (Vite React + TS + Tailwind + shadcn) — commit 5d82644
- [x] T5 — Backend domain: products/stock, transactions, customers, deliveries (hexagonal: domain/application/infrastructure) — commit + push
- [x] T6 — Payment gateway sandbox client + transaction use case (ROP result types) — commit + push
- [x] T7 — Frontend state (Redux) + product page + card/delivery modal + summary backdrop — commit + push
- [x] T8 — Receipt printer component (adapted from dqnamo experiment) on final status screen — commit + push
- [ ] T9 — Unit tests frontend + backend (>80%), coverage results in README — commit + push
- [ ] T10 — README: data model, API docs (Swagger/Postman), setup, coverage — commit + push

## Acceptance criteria
- 5-step flow works end-to-end in sandbox; stock updates; app survives refresh (state recovery).
- Jest coverage >80% both sides; results documented in README.
- Repo history shows incremental feature commits (not a single dump).

## Progress log
- T1/T2 done. T3-T8 pushed (849b393, 5d82644). Next: T9 tests.
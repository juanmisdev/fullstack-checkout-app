# Checkout Fullstack App

A fullstack product checkout application: browse a product, pay with a credit card (sandbox payment gateway), enter delivery info, and get an animated printed receipt — with stock updated in real time.

## Stack

| Layer     | Tech |
|-----------|------|
| Frontend  | React 18 (Vite + TypeScript), Redux Toolkit, Tailwind CSS + shadcn/ui, motion |
| Backend   | NestJS (TypeScript), Hexagonal Architecture (Ports & Adapters), Railway Oriented Programming |
| Database  | PostgreSQL (Prisma) — SQLite for local dev |
| Testing   | Jest (frontend + backend), >80% coverage target |

## Quick start

```bash
# Backend
cd server && npm install && npm run start:dev

# Frontend
cd client && npm install && npm run dev
```

## Status

🚧 Work in progress — built incrementally, one feature per commit.
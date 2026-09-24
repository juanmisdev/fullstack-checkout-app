# Testing Capabilities

**Strict TDD Mode**: disabled
**Detected**: 2026-09-24
**Workspace root**: /Volumes/SSD/wompi/fullstack-checkout-app

## Projects

| Relative path | Stack | Test command | Framework |
| ------------- | ----- | ------------ | --------- |
| `server` | NestJS 10 + TypeScript + Prisma (hexagonal) | `cd server && npx jest --coverage` | Jest 29 (ts-jest) |
| `client` | React 19 + Vite + Redux Toolkit + Tailwind 4 | *(pending — vitest to be added in T9)* | vitest-pending |

## Test Layers

| Relative path | Layer       | Available | Tool |
| ------------- | ----------- | --------- | ---- |
| `server` | Unit        | ✅ | Jest + ts-jest (`*.spec.ts` in domain, application) |
| `server` | Integration | ✅ | Jest + Supertest (`server/src/app.integration.spec.ts`, uncommitted) |
| `server` | E2E         | ❌ | — |
| `client` | Unit        | ❌ | pending (T9) |
| `client` | Integration | ❌ | — |
| `client` | E2E         | ❌ | — |

## Coverage

| Relative path | Available | Command |
| ------------- | --------- | ------- |
| `server` | ✅ | `cd server && npx jest --coverage` (config: `server/jest.config.js`, excludes `main.ts` and `*.module.ts`) |
| `client` | ❌ | pending (T9, target >80%) |

## Quality Tools

| Relative path | Tool         | Available | Command |
| ------------- | ------------ | --------- | ------- |
| `server` | Type checker | ✅ | `cd server && npm run build` (tsc -p tsconfig.build.json) |
| `server` | Linter       | ❌ | — |
| `server` | Formatter    | ❌ | — |
| `client` | Type checker | ✅ | `cd client && npm run build` (tsc -b) |
| `client` | Linter       | ✅ | `cd client && npm run lint` (oxlint) |
| `client` | Formatter    | ❌ | — |

## Notes

- No workspace-level test command exists; Strict TDD falls back to `false` per decision gate.
- Existing server unit tests (uncommitted): `checkout.use-case.spec.ts`, `customer.entity.spec.ts`, `card-validator.spec.ts`, `product.entity.spec.ts`, `result.spec.ts`, `transaction.entity.spec.ts`.
- T9 plan: add vitest + coverage for client, document coverage in README (target >80% both sides).
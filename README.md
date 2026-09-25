# Checkout Fullstack App

A fullstack product checkout application that walks the shopper through a five-step flow: **Product** (browse and pick a product) → **Card/Delivery** (enter payment and shipping details) → **Summary** (review the breakdown of amount, base fee, delivery fee and total) → **Payment** (charge via the sandbox payment gateway) → **Receipt** (an animated printer prints the transaction receipt), with stock updated in real time on the backend.

> API documentation lives in this README (see the [API endpoints](#api-endpoints) section), plus a ready-to-import [Postman collection](docs/checkout-api.postman_collection.json).

## Stack

| Layer        | Tech |
|--------------|------|
| Frontend     | React 19 (Vite + TypeScript), Redux Toolkit, Tailwind CSS + shadcn/ui-style components, motion |
| Backend      | NestJS (TypeScript), Hexagonal Architecture (Ports & Adapters), Railway Oriented Programming (ROP) |
| Persistence  | Prisma-ready — in-memory repositories for local dev (same ports, swappable adapters) |
| Testing      | Jest (server), Vitest + coverage (client) |

## Quick start

```bash
# 1. Configure the server environment
cp server/.env.example server/.env
#    Set GATEWAY_API_URL and GATEWAY_PUBLIC_KEY with your sandbox gateway credentials.

# 2. Backend (port 3001)
cd server && npm install && npm run start:dev

# 3. Frontend
cd client && npm install && npm run dev
```

The client expects `VITE_API_URL` (defaults to `http://localhost:3001/api/v1`).

## API endpoints

Base URL: `http://localhost:3001/api/v1`

### `GET /api/v1/products`

Lists all seeded products.

```json
{
  "data": [
    {
      "id": "prod_001",
      "name": "Wireless Headphones",
      "description": "Noise-cancelling over-ear wireless headphones, 30h battery life.",
      "priceInCents": 250000,
      "imageUrl": "https://picsum.photos/seed/headphones/600/600",
      "stock": 12
    }
  ]
}
```

### `GET /api/v1/products/:id`

Returns a single product (same shape as above), or a `404` (`Product not found`) if the id does not exist.

### `GET /api/v1/transactions/:id`

Returns a transaction by id, or `404` (`Transaction not found`) if it does not exist.

```json
{
  "data": {
    "id": "tx_abc123_def456",
    "productRef": "prod_001",
    "customerRef": "cust_...",
    "amountInCents": 250000,
    "baseFeeInCents": 500,
    "deliveryFeeInCents": 10000,
    "status": "APPROVED",
    "gatewayTransactionId": "...",
    "createdAt": "2026-09-24T10:00:00.000Z",
    "updatedAt": "2026-09-24T10:00:01.000Z"
  }
}
```

### `POST /api/v1/checkout`

Request body:

```json
{
  "productId": "prod_001",
  "units": 2,
  "card": {
    "number": "4242424242424242",
    "cvv": "123",
    "expiryMonth": 12,
    "expiryYear": 2028,
    "holderName": "Jane Doe"
  },
  "customer": {
    "fullName": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+573001234567"
  },
  "delivery": {
    "address": "Calle 100 #15-30",
    "city": "Bogota",
    "postalCode": "110111"
  },
  "deliveryFeeInCents": 10000
}
```

Success response (`data` wrapper):

```json
{
  "data": {
    "transactionId": "tx_abc123_def456",
    "status": "APPROVED",
    "totalInCents": 510500,
    "receipt": {
      "productRef": "prod_001",
      "customerRef": "cust_...",
      "deliveryRef": "tx_abc123_def456"
    }
  }
}
```

On a business error, the checkout controller throws a mapped Nest `HttpException`, so the HTTP status matches the error type and the response body carries the error details:

```json
{
  "statusCode": 409,
  "error": "INSUFFICIENT_STOCK",
  "message": "Not enough stock for the requested units"
}
```

Error mapping table:

| Error code            | HTTP status |
|-----------------------|-------------|
| `INSUFFICIENT_STOCK`  | 409         |
| `PRODUCT_NOT_FOUND`   | 404         |
| `PAYMENT_DECLINED`    | 402         |
| `INVALID_CARD`        | 422         |
| Other                 | 500         |

## Data model

| Entity       | Fields (relevant) | Relationships |
|--------------|-------------------|---------------|
| `Product`    | `id`, `name`, `description`, `priceInCents`, `imageUrl`, `stock` | Referenced by `Transaction.productRef` and `Delivery.productRef` |
| `Transaction`| `id`, `productRef`, `customerRef`, `amountInCents`, `baseFeeInCents`, `deliveryFeeInCents`, `status` (`PENDING`/`APPROVED`/`DECLINED`/`ERROR`), `gatewayTransactionId`, timestamps | Belongs to one `Product` and one `Customer`; owns one `Delivery` |
| `Customer`   | `id`, `fullName`, `email`, `phone`, `createdAt` | Referenced by `Transaction.customerRef` and `Delivery.customerRef` |
| `Delivery`   | `id`, `transactionRef`, `customerRef`, `productRef`, `address`, `city`, `postalCode`, `status` (`PENDING`/`SHIPPED`/`DELIVERED`), `createdAt` | Belongs to one `Transaction` and one `Customer`; created only when the payment is `APPROVED` |

```
Customer 1 ──── * Transaction * ──── 1 Product
    │                  │
    └── * Delivery * ──┴────────────── (Delivery also references Product)
```

**Fee structure** — the total charged is:

```
totalInCents = amountInCents            (product price × units)
             + baseFeeInCents           (500 cents, fixed base fee applied by the API)
             + deliveryFeeInCents       (10000 cents, sent by the client)
```

Example: 1 × Wireless Headphones (`250000`) → `250000 + 500 + 10000 = 260500`.

## Architecture

The backend follows Hexagonal Architecture (Ports & Adapters). Dependencies point inward: the interface layer (Nest controllers, DTO validation) calls the application layer (services + use cases), which orchestrates pure domain entities — while the infrastructure layer (in-memory repositories, the payment gateway HTTP adapter) implements the ports the application defines. The domain knows nothing about Nest, HTTP or any framework.

```
        ┌────────────────────────────────────────────┐
        │            interface (HTTP)                │
        │   controllers.ts — DTOs, protocol only     │
        └──────────────────┬─────────────────────────┘
                           ▼
        ┌────────────────────────────────────────────┐
        │             application                    │
        │  CheckoutService · CheckoutUseCase · ports │
        └──────────────────┬─────────────────────────┘
                           ▼
        ┌────────────────────────────────────────────┐
        │                domain ◄────┐               │
        │  Product · Transaction ·   │ pure          │
        │  Customer · Delivery ·     │ entities      │
        │  CardValidator · Result    │               │
        └────────────────────────────┴───────────────┘
                           ▲
        ┌──────────────────┴─────────────────────────┐
        │            infrastructure                  │
        │  InMemory*Repository · PaymentGatewayAdapter│
        └────────────────────────────────────────────┘
```

**Railway Oriented Programming** — instead of throwing exceptions across layers, the checkout use case is a pipeline where every step returns a `Result<T, E>` (`Ok` / `Err`). Steps are composed with `attemptAsync` and `flatMap`, so failure short-circuits along the "error rail" and the controller receives a typed, exhaustive error union (`CheckoutError`) it maps to HTTP statuses.

**Why it matters** — the use case is testable without Nest or HTTP, the payment gateway is behind a port (the sandbox adapter is a drop-in replacement for a real one), and persistence is behind the same ports, which is why in-memory repositories for dev and Prisma adapters can coexist.

## Testing

Real coverage numbers from the latest run:

| Suite   | Framework | Tests | Statements |
|---------|-----------|-------|------------|
| Server  | Jest      | 75    | 82.83%     |
| Client  | Vitest    | 37    | 91.62%     |

```bash
# Server (Jest + coverage)
cd server && npx jest --coverage

# Client (Vitest + coverage)
cd client && npm run test
```

## Postman

A ready-to-import Postman collection covering all API endpoints (list/get product, get transaction, and 4 checkout scenarios: approved, insufficient stock 409, invalid card 422, unknown product 404) lives at [`docs/checkout-api.postman_collection.json`](docs/checkout-api.postman_collection.json). In Postman: **Import → File → select the JSON** — the `api_base_url` variable defaults to the deployed API.

## Security notes

- **Card data is never persisted raw**: only derived, non-sensitive metadata (last 4 digits inside the sandbox tokenization step and holder name) is used; the full PAN never reaches the repositories. Honest note: card tokenization happens **server-side** in sandbox mode — the PAN travels over HTTPS to the API and is never stored; in production, tokenization would happen client-side via the gateway's JS SDK so the PAN never touches our servers at all.
- **OWASP security headers**: the API applies `helmet` on every response (HSTS, `X-Content-Type-Options: nosniff`, CSP, `X-Frame-Options`, etc.) and the Express signature (`x-powered-by`) is disabled.
- **Explicit CORS allowlist**: both the Lambda/Nest layer and API Gateway only allow the CloudFront SPA origin and localhost dev origins — no wildcard CORS.
- **Credentials only via environment**: gateway keys are read from `process.env` (`GATEWAY_API_URL`, `GATEWAY_PUBLIC_KEY`); `.env` files are never committed (see `server/.env.example`).
- **Validation on both sides**: Luhn checksum and brand detection (Visa/Mastercard) run on the client for instant feedback, and card validation is enforced again in the server's pure domain (`card-validator.ts`).

## Deployment (live on AWS, region us-east-1)

Deployed architecture (all free-tier eligible):

| Component | Service | URL / identifier |
|---|---|---|
| SPA | S3 + CloudFront | https://d30is68sphf1e9.cloudfront.net (dist. `E711RYV9D8JJS`, bucket `checkout-spa-33971295360`) |
| API | Lambda (nodejs20.x, arm64, 1024MB) + API Gateway HTTP API | https://dp2txvb8v8.execute-api.us-east-1.amazonaws.com/api/v1 |
| Database | RDS PostgreSQL (db.t4g.micro, public access + SG on 5432) | `checkout-db.c4ngk6200fhh.us-east-1.rds.amazonaws.com` |

- **Backend**: deployed with the Serverless Framework (`server/serverless.yml`), handler in `server/src/lambda.ts` (`@vendia/serverless-express` wrapping the Nest app). Persistence switches automatically to the Prisma adapters via `PERSISTENCE_DRIVER=prisma` (in-memory adapters are kept for local dev and tests — the hexagonal ports did not change).
- **Database**: Prisma schema in `server/prisma/schema.prisma` (Lambda binary target `linux-arm64-openssl-3.0.x` included), single migration applied, seeded with the 3 products (idempotent seed in `server/prisma/seed.ts`; the app also self-seeds an empty table on cold start).
- **Frontend**: `deploy/deploy-frontend.sh` builds the SPA with `VITE_API_URL` pointing to the API Gateway and syncs `client/dist` to S3 + CloudFront (SPA fallback on 404, HTTPS by default).
- **Redeploy**: backend → `cd server && npx serverless deploy` (with `DATABASE_URL` exported); frontend → `ROOT_DIR=$(pwd) VITE_API_URL=<api-url> bash deploy/deploy-frontend.sh`.
- **Honest notes**: RDS is publicly accessible with security group allowing 5432 from anywhere — acceptable for this test only, not production. Sandbox gateway credentials are passed as Lambda env vars in `serverless.yml` (they are sandbox keys, not production secrets). Card transactions in the sandbox finalize asynchronously (`PENDING` → `APPROVED`), so the gateway adapter polls the transaction endpoint until a terminal state.

## Status

✅ Completed features:

- Product catalog with seeded products (headphones, keyboard, shoes) and real-time stock
- Five-step SPA checkout flow: Product → Card/Delivery → Summary → Payment → animated receipt printer
- Card validation (Luhn + brand detection) on client and server
- Checkout use case with ROP pipeline, transaction state machine (PENDING → APPROVED/DECLINED)
- Delivery created and stock decreased only on APPROVED payments
- Payment gateway sandbox integration (acceptance token + charge) behind a port
- REST API: products, transactions, checkout with error mapping
- Server tests (Jest, 75 tests, 82.83% statements) and client tests (Vitest, 37 tests, 91.62% statements)

🚧 Future work: CI pipeline, production-hardening (RDS in private VPC, secrets in SSM, ACM custom domain).
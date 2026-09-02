# Smart Procurement System — Phase 1

A modern full-stack foundation for an AI-powered agricultural procurement platform.

## Phase 1 included

- Landing page
- Login / signup
- Forgot-password architecture
- Role selection
- Farmer login and protected farmer area
- Admin login and protected admin area
- SQLite user database
- Argon2 password hashing
- JWT authentication in HttpOnly cookies
- Role-based backend authorization
- Protected frontend routes
- Responsive agricultural-tech UI
- Development admin seed
- Basic authentication/authorization tests

## Stack

- Frontend: React + Vite + React Router
- Backend: Node.js + Express
- Database: SQLite
- Authentication: JWT + HttpOnly cookie
- Password hashing: Argon2
- Validation: Zod

## Run

Requirements: Node.js 20+.

```bash
npm install
npm run install:all
```

Create `backend/.env` from `backend/.env.example`.

```bash
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:4000

## Development admin

Do not create an admin through public signup. To seed one:

```bash
npm --prefix backend run seed:admin
```

The seed reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` from `backend/.env`.

## Production notes

Use a strong JWT secret, HTTPS, secure cookies, a managed database, email/SMS delivery for password reset, rate limiting, audit logging, CSRF protection appropriate to the deployment model, and a secrets manager before production launch.

## Phase 2 readiness

The authenticated user model and role boundaries are intentionally separated from procurement logic so future modules can add farmer profiles, crops, centres, bookings, tokens, queues, quality, weights, payments, notifications and analytics without rewriting authentication.

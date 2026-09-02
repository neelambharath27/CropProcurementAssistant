# Smart Procurement System — Phase 2
## Role-Based Intelligent Dashboards

Phase 2 extends the Phase 1 authentication foundation with genuinely different Farmer and Admin dashboard experiences.

### Stack
- React + Vite + React Router
- Node.js + Express
- SQLite + better-sqlite3
- JWT in HttpOnly cookie
- Argon2 password hashing
- Zod validation

### Run
1. Install Node.js 20+.
2. Create `backend/.env` from `backend/.env.example`.
3. From this folder:
   `npm install`
   `npm run install:all`
   `npm run dev`
4. Open `http://localhost:5173`.

Backend runs on `http://localhost:4000`.

### Important Phase 2 behavior
- Backend remains the source of truth for role authorization.
- Farmer and Admin dashboards have different information architecture.
- Dashboard APIs return authenticated-user-specific placeholder/empty states rather than fake production statistics or AI predictions.
- Navigation contains integration points for later phases without pretending those modules are live.
- Admin signup remains blocked; use the protected Phase 1 seed mechanism if an admin is needed.

### Dashboard APIs
- GET `/api/farmer/dashboard`
- GET `/api/admin/dashboard`

Both require the Phase 1 authentication cookie and appropriate role.

### Phase 3 integration
Connect crop registration to the Farmer Dashboard's `Register Crop` action. The dashboard API response is deliberately structured around sections, so future crop, booking, AI, queue, payment and history services can replace empty-state payloads without changing the overall UI contract.

### Testing
`npm test` runs backend authorization and dashboard-contract tests.

# Smart Procurement System — Phase 3
## Farmer & Crop Data Management

Phase 3 extends the Phase 2 role-based dashboard foundation with:
- Farmer profile management
- English / తెలుగు / हिन्दी language switching
- Guided crop-registration wizard
- Crop records stored per farmer
- Crop history
- Server-side validation and farmer-only authorization
- Responsive farmer-focused UI

## Run
Requirements: Node.js 20+

```bash
npm install
npm run install:all
```

Create `backend/.env` from `backend/.env.example`.

Run:
```bash
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:4000

## Demo account
For a quick UI demonstration, the app has a local demo mode on the Farmer login screen. It creates a local demo farmer session in the browser and does not represent production authentication.

For real Phase 1 authentication, connect the Phase 2 `/api/auth/login` endpoint and replace the demo login handler.

## Phase 3 routes
- `/farmer/dashboard`
- `/farmer/crops/new`
- `/farmer/crops`
- `/farmer/profile`

## API
- GET `/api/farmer/profile`
- PUT `/api/farmer/profile`
- GET `/api/farmer/crops`
- POST `/api/farmer/crops`
- GET `/api/farmer/crops/:id`

Crop creation is authorized by the authenticated farmer identity; `farmerId` is derived from the session rather than trusted from the browser.

## Supported languages
- English
- తెలుగు
- हिन्दी

The language preference is persisted to the farmer profile and in local browser storage.

## Phase 4 readiness
The crop record includes stable identifiers and dates so recommendation, procurement-centre, slot-booking, queue, quality, payment and AI services can consume it later without redesigning the Phase 3 data model.

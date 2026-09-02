# Smart Procurement System — Phase 4

Procurement Data Management extension built on the Phase 3 farmer/crop foundation.

## What is included
- Farmer & crop data preserved from Phase 3
- Admin command centre
- Procurement centre management
- Crop type master
- Price master and historical prices
- Procurement records
- Queue records
- Quality assessment records
- Weight and amount calculation
- Payment records
- Receipt records
- Role-protected farmer/admin API routes
- Responsive admin UI

## Development admin access
Email: `admin@smartprocure.local`

No real payment gateway is connected. Payment records are stored as application data only.

## Run

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd frontend
npm run dev
```

Open:
- Farmer: http://localhost:5173/farmer/login
- Admin: http://localhost:5173/admin/login

The SQLite database is created at `backend/data/procurement.sqlite` on first backend start.

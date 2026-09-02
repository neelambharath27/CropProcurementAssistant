# Phase 5 Corrections

This build includes the requested SmartProcure corrections:

1. **All active crop types** are loaded from the crop master for farmer crop registration instead of relying only on a hard-coded short list.
2. **Time slots are date-specific.** Selecting a procurement date loads available slots for that exact date; a booking is rejected if the slot date does not match the farmer's registered expected procurement date.
3. **Live queue wait time** is calculated from the number of farmers ahead and the procurement centre's historical average service time. A real `0 minutes` wait is displayed as `0 minutes`, not `Calculating…`.
4. **Admin dashboard** now labels the pipeline panel `FOUNDATION` and removes the FARMER + CROP + CENTRE network graphic.
5. **Procurement date is controlled by farmer registration.** Admin procurement records display the farmer crop's registered expected procurement date, and new admin records automatically use that date.
6. **No queue popup errors.** Queue action errors are displayed inline on the page.
7. **Finish Procurement** in the admin queue opens an inline form for quality and weight data. After quality is accepted and weight is recorded, the procurement, booking, and queue are all set to `COMPLETED`.

## Run from this folder

The ZIP is structured so `package.json` is directly in the extracted project root.

```powershell
npm install
npm run install:all
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:4000`

If you already installed dependencies, use:

```powershell
npm run dev
```

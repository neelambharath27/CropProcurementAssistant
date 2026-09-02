# Farmer authentication and centre fix

## Farmer registration
- Requires only Full Name and 10-digit Mobile Number.
- Email and password are no longer requested from farmers.
- The backend keeps internal database-only email/password values for compatibility with the existing schema.

## Farmer login
- Requires only the registered Farmer Name + Mobile Number.
- Email/password login is not shown to farmers.
- Admin login remains separate and unchanged.

## Procurement centre
- The Admin Procurement form now clearly shows when there are no ACTIVE procurement centres.
- It provides a link to Admin > Centres so an administrator can add an active centre.
- In the supplied database there are currently 0 procurement centres, which is why the Centre dropdown in the screenshot had no selectable options.

## Important
After extracting the project on Windows, run `npm install` at the root, then use `npm run dev`.

# Razorpay backend (Node.js)

If you are deploying on Firebase, use `FIREBASE_DEPLOY.md` instead (Firebase Hosting + Cloud Functions).

## Setup
1. Install dependencies:
   - `cd backend`
   - If PowerShell blocks `npm` scripts, use:
     - `& "$env:ProgramFiles\\nodejs\\npm.cmd" install`
2. Create env file:
   - Copy `backend/.env.example` to `backend/.env`
   - Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (never commit the secret key)
3. Run server:
   - `& "$env:ProgramFiles\\nodejs\\npm.cmd" run dev`

## Open the app
Open `http://localhost:4242/` (served from `Property Analyzer/`).

## API
- `POST /api/order` → creates Razorpay order (amount in paise)
- `POST /api/verify` → verifies checkout signature

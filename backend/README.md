# PropVerify backend (Node.js)

Serves the `Property Analyzer/` frontend and handles server-side Gemini analysis.

## Setup
1. Install dependencies:
   - `cd backend`
   - `npm install`
2. Create `backend/.env` with:
   - `PORT=4242`
   - `GEMINI_MODEL=gemini-2.5-flash`
   - `GEMINI_REQUEST_INTERVAL_MS=1000`
   - `BREVO_API_KEY=your_brevo_api_key`
   - `CONTACT_TO_EMAIL=info@asliproperty.in`
   - `CONTACT_FROM_EMAIL=info@asliproperty.in`
   - `CONTACT_FROM_NAME=AsliProperty Website`
   - `GEMINI_API_KEY_1=key_one`
   - `GEMINI_API_KEY_2=key_two`
   - `GEMINI_API_KEY_3=key_three`
3. Run server:
   - `npm run dev`

## Open the app
Open `http://localhost:4242/`.

## API
- `POST /api/analyze` analyzes a Hyderabad locality.
- `POST /api/contact` sends Contact Us form submissions through Brevo.
- `POST /api/upload-document/:trackId` uploads audit documents.

Gemini keys are tried in numbered order. Calls are queued with `GEMINI_REQUEST_INTERVAL_MS` between Gemini requests to reduce burst rate-limit errors.

For Brevo, `CONTACT_FROM_EMAIL` must be a verified sender/domain in your Brevo account.

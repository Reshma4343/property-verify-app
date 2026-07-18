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
   - `GEMINI_MAX_RETRIES=0`
   - `GEMINI_FALLBACK_MODELS=`
   - `AI_PROVIDER_TIMEOUT_MS=15000`
   - `GOOGLE_DISTANCE_TIMEOUT_MS=8000`
   - `MAX_ROAD_DISTANCE_DESTINATIONS=75`
   - `BREVO_API_KEY=your_brevo_api_key`
   - `CONTACT_TO_EMAIL=info@asliproperty.in`
   - `CONTACT_FROM_EMAIL=info@asliproperty.in`
   - `CONTACT_FROM_NAME=AsliProperty Website`
   - `GOOGLE_PAID_API_KEY=your_paid_gemini_api_key_here`
   - `GOOGLE_MAPS_API_KEY=your_google_maps_key_with_routes_and_geocoding_enabled`
   - `GEMINI_API_KEY_1=free_fallback_key_one`
   - `GEMINI_API_KEY_2=free_fallback_key_two`
   - `GEMINI_API_KEY_3=free_fallback_key_three`
3. Run server:
   - `npm run dev`

## Open the app
Open `http://localhost:4242/`.

## API
- `POST /api/analyze` analyzes a Hyderabad locality.
- `POST /api/contact` sends Contact Us form submissions through Brevo.
- `POST /api/upload-document/:trackId` uploads audit documents.

Gemini tries `GOOGLE_PAID_API_KEY` or `GEMINI_PAID_API_KEY` first, then numbered fallback keys such as `GEMINI_API_KEY_1`. Calls are queued with `GEMINI_REQUEST_INTERVAL_MS` between Gemini requests to reduce burst rate-limit errors. `AI_PROVIDER_TIMEOUT_MS` keeps slow AI provider calls from making users wait too long before fallback or error handling.

Free locality insight responses are stored in `backend/data/freeInsightCache.json` by normalized locality only. Repeat requests for the same property/location reuse this file to reduce API hits, even when users enter different budgets. Metro connectivity is validated against `backend/data/hyderabadMetroStations.json` before responses are returned or cached.

Road distances use Google Routes API when `GOOGLE_MAPS_API_KEY` is set, with legacy Distance Matrix only as a fallback for older projects. Enable Routes API and Geocoding API on the Maps key. If road distance lookup is not enabled or times out, the backend keeps the AI/fallback distance instead of failing the request.

For Brevo, `CONTACT_FROM_EMAIL` must be a verified sender/domain in your Brevo account.

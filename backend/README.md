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
   - `GOOGLE_PLACES_RADIUS_METERS=10000`
   - `GOOGLE_PLACES_LIMIT=10`
   - `BREVO_API_KEY=your_brevo_api_key`
   - `CONTACT_TO_EMAIL=info@asliproperty.in`
   - `CONTACT_FROM_EMAIL=info@asliproperty.in`
   - `CONTACT_FROM_NAME=AsliProperty Website`
   - `GOOGLE_PAID_API_KEY=your_paid_gemini_api_key_here`
   - `GOOGLE_MAPS_API_KEY=your_google_maps_key_with_geocoding_routes_places_enabled`
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

Free locality insight responses are stored in `backend/data/freeInsightCache.json` by normalized locality only. Repeat requests for the same property/location reuse this file to reduce API hits, even when users enter different budgets.

Free insight location data uses Google Geocoding, Routes, and Places APIs when `GOOGLE_MAPS_API_KEY` is set. Nearby hospitals, schools, restaurants, parks, malls, tourist spots, and public transport are replaced with Google Places results whenever available. If Google APIs fail or return no results, the backend keeps AI fallback values instead of failing the request.

For Brevo, `CONTACT_FROM_EMAIL` must be a verified sender/domain in your Brevo account.

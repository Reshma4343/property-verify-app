# PropVerify backend (Node.js)

Serves the `Property Analyzer/` frontend and handles server-side Gemini analysis.

## Setup
1. Install dependencies:
   - `cd backend`
   - `npm install`
2. Create `backend/.env` with:
   - `PORT=4242`
   - `GEMINI_API_KEYS=key_one,key_two,key_three`
   - `GEMINI_MODEL=gemini-2.5-flash`
3. Run server:
   - `npm run dev`

## Open the app
Open `http://localhost:4242/`.

## API
- `POST /api/analyze` analyzes a Hyderabad locality.
- `POST /api/upload-document/:trackId` uploads audit documents.

Gemini keys are tried in order. If a key/model fails with a retryable quota or server error, the backend tries the next key, then fallback models.

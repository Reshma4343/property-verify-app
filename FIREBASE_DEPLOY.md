# Firebase Deploy (Hosting + Functions)

This repo includes a Firebase Functions backend at `functions/index.js` and a Hosting rewrite for `/api/*`.

## 1. One-Time Firebase Setup
Install Firebase CLI:
- `npm i -g firebase-tools`

Login:
- `firebase login`

Set your Firebase project id:
- Edit `.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID`

## 2. Configure Gemini Keys
Use a comma-separated list so the backend can rotate through keys:
- `firebase functions:config:set gemini.api_keys="key_one,key_two,key_three" gemini.model="gemini-2.5-flash"`

Optional fallback models:
- `firebase functions:config:set gemini.fallback_models="gemini-2.0-flash,gemini-2.0-flash-lite"`

## 3. Configure Contact Email
For local testing, put these values in `functions/.env`:
- `BREVO_API_KEY=your_brevo_api_key`
- `CONTACT_TO_EMAIL=info@asliproperty.in`
- `CONTACT_FROM_EMAIL=info@asliproperty.in`
- `CONTACT_FROM_NAME=AsliProperty Website`

For production Firebase Functions, configure the same values as environment variables or secrets before deploying. `CONTACT_FROM_EMAIL` must be verified in Brevo.

## 4. Install Dependencies And Deploy
From repo root:
- `cd functions`
- `npm install`
- `cd ..`
- `firebase deploy`

## Local Testing
Put `GEMINI_API_KEYS` in `functions/.env`, then run:
- `firebase emulators:start`

Open the emulator Hosting URL printed in the terminal.

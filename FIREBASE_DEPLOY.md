# Firebase deploy (Hosting + Functions) for Razorpay

Firebase Hosting is only for static files — Razorpay **requires a backend** for order creation + signature verification.
This repo includes a Firebase Functions backend at `functions/index.js` and a Hosting rewrite for `/api/*`.

## 1) One-time Firebase setup
Install Firebase CLI (on your machine):
- `npm i -g firebase-tools`

Login:
- `firebase login`

Set your Firebase project id:
- Edit `.firebaserc` and replace `YOUR_FIREBASE_PROJECT_ID`

## 2) Configure Razorpay keys (recommended: Functions config)
Run:
- `firebase functions:config:set razorpay.key_id="rzp_test_..." razorpay.key_secret="..."`

Then:
- `firebase deploy --only functions`

## 3) Install dependencies and deploy
From repo root:
- `cd functions`
- `& "$env:ProgramFiles\\nodejs\\npm.cmd" install`
- `cd ..`
- `firebase deploy`

## Local testing (optional)
Put keys in `functions/.env` (copy from `functions/.env.example`), then:
- `firebase emulators:start`

Open the emulator Hosting URL printed in the terminal.


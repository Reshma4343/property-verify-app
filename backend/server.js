import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "dotenv/config";
import express from "express";
import Razorpay from "razorpay";
import { findGo111Village } from "./data/go111Villages.js";

const app = express();

const PORT = Number(process.env.PORT || 4242);
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error("Missing Razorpay env vars. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  process.exit(1);
}

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const frontendDir = path.join(repoRoot, "Property Analyzer");

app.use(express.json({ limit: "1mb" }));

// Serve the existing frontend so it runs on http://localhost:<PORT>/ (no CORS issues).
app.use(express.static(frontendDir));

app.get("/api/config", (_req, res) => {
  res.json({ razorpayKeyId: RAZORPAY_KEY_ID });
});

function buildPrompt(locality, budget) {
  return `Analyze market intelligence for the locality: ${locality}, Hyderabad. User Budget: ${budget}.
Return ONLY a valid JSON with these keys:
"price" (approx price range per sqft/sqyd),
"appreciation" (3-year growth %),
"go111" (SAFE or AFFECTED),
"zoning" (Master plan zone),
"metro" (nearest metro station and distance),
"hospitals_list" (array of exactly 3-4 top hospitals with distance in KM),
"schools_list" (array of exactly 3-4 top schools with distance in KM),
"malls_list" (array of exactly 3-4 top malls/markets with distance in KM),
"highway" (nearest NH highway connectivity),
"orr_access" (nearest ORR Exit and distance),
"rail_access" (nearest MMTS or Railway station),
"local_transport" (General bus/transit availability)`;
}

function parseGeminiJson(text) {
  const cleanText = String(text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(cleanText);
}

app.post("/api/analyze", async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Missing Gemini API key on backend." });
    }

    const locality = String(req.body?.locality || "").trim();
    const budget = String(req.body?.budget || "").trim();
    if (!locality) {
      return res.status(400).json({ error: "Locality is required." });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(locality, budget) }] }],
        }),
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = result?.error?.message || `Gemini request failed (HTTP ${response.status}).`;
      return res.status(response.status).json({ error: message });
    }

    const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return res.status(502).json({ error: "Empty Gemini response." });
    }

    const data = parseGeminiJson(rawText);
    const go111Match = findGo111Village(locality);
    data.go111 = go111Match ? "AFFECTED" : "SAFE";
    data.go111_details = go111Match
      ? {
          ...go111Match,
          status: "AFFECTED",
          note: "This locality matches the GO111 village list. Verify land-use and permissions carefully before purchase.",
        }
      : null;

    res.json({ data });
  } catch (err) {
    console.error("Analyze failed:", err);
    res.status(500).json({ error: "Failed to analyze locality." });
  }
});

app.post("/api/order", async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    const currency = (req.body?.currency || "INR").toUpperCase();
    const receipt = String(req.body?.receipt || `rcpt_${Date.now()}`).slice(0, 40);
    const notes = typeof req.body?.notes === "object" && req.body?.notes ? req.body.notes : undefined;

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount (expected integer paise)." });
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      return res.status(400).json({ error: "Invalid currency." });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount),
      currency,
      receipt,
      notes,
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Order create failed:", err);
    res.status(500).json({ error: "Failed to create order." });
  }
});

app.post("/api/verify", (req, res) => {
  try {
    const orderId = String(req.body?.razorpay_order_id || "");
    const paymentId = String(req.body?.razorpay_payment_id || "");
    const signature = String(req.body?.razorpay_signature || "");

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ ok: false, error: "Missing verification fields." });
    }

    const expected = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const ok = crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
    if (!ok) return res.status(400).json({ ok: false, error: "Invalid signature." });

    res.json({ ok: true });
  } catch (err) {
    console.error("Verify failed:", err);
    res.status(500).json({ ok: false, error: "Verification error." });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running: http://localhost:${PORT}/`);
});

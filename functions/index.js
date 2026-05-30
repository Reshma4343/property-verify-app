import crypto from "node:crypto";

import "dotenv/config";
import express from "express";
import functions from "firebase-functions";
import Razorpay from "razorpay";

const app = express();
app.use(express.json({ limit: "1mb" }));

function getRazorpayConfig() {
  const cfg = (() => {
    try {
      return functions.config?.() || {};
    } catch {
      return {};
    }
  })();

  const keyId = process.env.RAZORPAY_KEY_ID || cfg?.razorpay?.key_id;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || cfg?.razorpay?.key_secret;
  return { keyId, keySecret };
}

function getRazorpayClient() {
  const { keyId, keySecret } = getRazorpayConfig();
  if (!keyId || !keySecret) {
    throw new Error("Missing Razorpay credentials. Set env vars or Firebase functions config.");
  }
  return {
    keyId,
    keySecret,
    client: new Razorpay({ key_id: keyId, key_secret: keySecret }),
  };
}

function getGeminiConfig() {
  const cfg = (() => {
    try {
      return functions.config?.() || {};
    } catch {
      return {};
    }
  })();

  return {
    apiKey: process.env.GEMINI_API_KEY || cfg?.gemini?.api_key,
    model: process.env.GEMINI_MODEL || cfg?.gemini?.model || "gemini-2.5-flash",
  };
}

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

const go111Villages = [
  ["Aziznagar", "8", "Moinabad"], ["Yenkatpally", "9", "Moinabad"], ["Mumtazguda", "10", "Moinabad"],
  ["Sajjanpalli", "13", "Moinabad"], ["Surgangal", "19", "Moinabad"], ["Nageshnagar", "20", "Moinabad"],
  ["KBangallaguda", "2", "Moinabad"], ["Nagireddiguda", "22", "Moinabad"], ["Bakaramjagir", "23", "Moinabad"],
  ["Amdapur", "24", "Moinabad"], ["Dargatdurla", "25", "Moinabad"], ["Venkatpuram", "26", "Moinabad"],
  ["Malkaram", "3", "Shamshabad"], ["Kolbawatideddi", "4", "Shamshabad"], ["Sultanpalli", "5", "Shamshabad"],
  ["Kacharam", "6", "Shamshabad"], ["Rayangudda", "7", "Shamshabad"], ["Chodergudda", "10", "Shamshabad"],
  ["Narkhudda", "11", "Shamshabad"], ["Amepelli", "12", "Shamshabad"], ["Marrigudda", "13", "Shamshabad"],
  ["Kotwalgudda", "14", "Shamshabad"], ["Shamshabad", "20", "Shamshabad"], ["Kishanguda", "21", "Shamshabad"],
  ["Ootapalli", "22", "Shamshabad"], ["Tondapalli", "23", "Shamshabad"], ["Devatabowli", "24", "Shamshabad"],
  ["Talkatta", "14/2", "Moinabad"], ["Etbarpally", "15", "Moinabad"], ["Nakanpally", "16", "Moinabad"],
  ["Ketireddipally", "17", "Moinabad"], ["Kenkamadi", "18", "Moinabad"], ["Ramangipur", "1", "Shamshabad"],
  ["Kavatriguda", "2", "Shamshabad"], ["Nangipur", "8", "Shamshabad"], ["Jukal", "9", "Shamshabad"],
  ["Gandigudda", "24", "Shamshabad"], ["Peddashapur", "26", "Shamshabad"], ["Madenpally", "27", "Shamshabad"],
  ["Palmakula", "28", "Shamshabad"], ["Gangiraiguda", "31", "Shamshabad"], ["Cherlaguda", "32", "Shamshabad"],
  ["Hamedullanagar", "33", "Shamshabad"], ["Posettiguda", "34", "Shamshabad"], ["Gowlanallykand", "35", "Shamshabad"],
  ["Rashiguda", "36", "Shamshabad"], ["Syedguda", "37", "Shamshabad"], ["Gollapallikalan", "38", "Shamshabad"],
  ["Bahadurguda", "39", "Shamshabad"], ["Golcondakhur", "40", "Shamshabad"], ["Shankerpur", "41", "Shamshabad"],
  ["Sangiguda", "42", "Shamshabad"], ["Golcondakalan", "43", "Shamshabad"], ["Solipet", "8", "Shabad"],
  ["Maddur", "9", "Shabad"], ["Gudur", "5", "Kothur"], ["Himayat Nagar", "7", "Moinabad"],
  ["Chilkoor", "6", "Moinabad"], ["Chandanagar", "5", "Moinabad"], ["Medipally", "1", "Moinabad"],
  ["Chinna Mangalaram", "2", "Moinabad"], ["Mothukupally", "3", "Moinabad"], ["Reddypally", "4", "Moinabad"],
  ["Pedda Mangalaram", "11", "Moinabad"], ["Khanapur", "2", "Rajendranagar"], ["Gunugurthy", "3", "Rajendranagar"],
  ["Vatti Nagulapally", "1", "Rajendranagar"], ["Janwada", "9", "Shankerpally"], ["Dhatampally", "8", "Shamshabad"],
  ["Maharajpet", "10", "Shamshabad"], ["Gopularam", "11", "Shamshabad"], ["Poddutur", "12", "Shamshabad"],
  ["Chinna Shapur", "12", "Moinabad"], ["Tol Katta", "14", "Moinabad"], ["Yenkapally", "12", "Chevella"],
  ["Yerlapally", "13", "Chevella"], ["Kameta", "14", "Chevella"], ["Gollapally", "15", "Chevella"],
  ["Ravlapally", "16", "Chevella"], ["Mudimyal", "17", "Chevella"], ["Mumera", "18", "Rajendranagar"],
  ["Malkapur", "34", "Rajendranagar"], ["Tankutur", "13", "Shankerpally"], ["Bulkapur", "5", "Shankerpally"],
].map(([name, villageNo, mandal], index) => ({ serialNo: index + 1, name, villageNo, mandal }));

function normalizeVillageName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findGo111Village(locality) {
  const query = normalizeVillageName(locality);
  if (!query) return null;

  return (
    go111Villages.find((village) => normalizeVillageName(village.name) === query) ||
    go111Villages.find((village) => {
      const name = normalizeVillageName(village.name);
      return query.length >= 4 && (name.includes(query) || query.includes(name));
    }) ||
    null
  );
}

app.get("/api/config", (_req, res) => {
  try {
    const { keyId } = getRazorpayClient();
    res.json({ razorpayKeyId: keyId });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Config error" });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { apiKey, model } = getGeminiConfig();
    if (!apiKey) {
      return res.status(500).json({ error: "Missing Gemini API key on backend." });
    }

    const locality = String(req.body?.locality || "").trim();
    const budget = String(req.body?.budget || "").trim();
    if (!locality) {
      return res.status(400).json({ error: "Locality is required." });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
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
  } catch (e) {
    console.error("Analyze failed:", e);
    res.status(500).json({ error: "Failed to analyze locality." });
  }
});

app.post("/api/order", async (req, res) => {
  try {
    const { client, keyId } = getRazorpayClient();
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

    const order = await client.orders.create({
      amount: Math.round(amount),
      currency,
      receipt,
      notes,
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
    });
  } catch (e) {
    console.error("Order create failed:", e);
    res.status(500).json({ error: "Failed to create order." });
  }
});

app.post("/api/verify", (req, res) => {
  try {
    const { keySecret } = getRazorpayClient();
    const orderId = String(req.body?.razorpay_order_id || "");
    const paymentId = String(req.body?.razorpay_payment_id || "");
    const signature = String(req.body?.razorpay_signature || "");

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ ok: false, error: "Missing verification fields." });
    }

    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const ok = crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
    if (!ok) return res.status(400).json({ ok: false, error: "Invalid signature." });

    res.json({ ok: true });
  } catch (e) {
    console.error("Verify failed:", e);
    res.status(500).json({ ok: false, error: "Verification error." });
  }
});

export const api = functions.https.onRequest(app);

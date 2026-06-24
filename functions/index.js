import "dotenv/config";
import express from "express";
import functions from "firebase-functions";

const app = express();
app.use(express.json({ limit: "1mb" }));

const GEMINI_REQUEST_INTERVAL_MS = Math.max(0, Number(process.env.GEMINI_REQUEST_INTERVAL_MS || 1000));
const BREVO_API_KEY = String(process.env.BREVO_API_KEY || "").trim();
const CONTACT_TO_EMAIL = String(process.env.CONTACT_TO_EMAIL || "info@asliproperty.in").trim();
const CONTACT_FROM_EMAIL = String(process.env.CONTACT_FROM_EMAIL || CONTACT_TO_EMAIL).trim();
const CONTACT_FROM_NAME = String(process.env.CONTACT_FROM_NAME || "AsliProperty Website").trim();
const BREVO_TIMEOUT_MS = Math.max(1000, Number(process.env.BREVO_TIMEOUT_MS || 30000));
const BREVO_MAX_RETRIES = Math.max(0, Number(process.env.BREVO_MAX_RETRIES || 2));
const contactRateLimits = new Map();

function isAllowedCorsOrigin(origin) {
  if (!origin) return false;
  const configuredOrigins = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (configuredOrigins.includes(origin)) return true;

  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function applyCors(req, res, next) {
  const origin = req.headers.origin;
  if (isAllowedCorsOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-file-name,x-file-type");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
}

app.use(applyCors);

function parseCsv(value, fallback = "") {
  return String(value ?? fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getNumberedGeminiKeys(env) {
  const keys = [];
  for (let index = 1; index <= 100; index += 1) {
    const key = String(env[`GEMINI_API_KEY_${index}`] || "").trim();
    if (key) keys.push(key);
  }
  return keys;
}

const GEMINI_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function summarizeGeminiError(err) {
  return String(err?.message || err || "Unknown Gemini error").split("\n")[0];
}

function getGeminiAttemptSummary(attempts) {
  return attempts
    .map((attempt) => `model ${attempt.model}, key #${attempt.keyIndex}: HTTP ${attempt.status || "error"} - ${attempt.message}`)
    .join(" | ");
}

function getGeminiClientMessage(lastError) {
  const status = Number(lastError?.status);
  const message = summarizeGeminiError(lastError);
  if (status === 429) {
    return "Gemini quota/rate limit was reached. Wait for quota reset or add a valid key with available quota.";
  }
  if (status === 400 || status === 403) {
    return "Gemini rejected one or more backend keys. Check that every configured key is a Google AI Studio API key with Gemini API access.";
  }
  if (status === 404) {
    return "Gemini model was not found for the configured key/project. Check GEMINI_MODEL and fallback models.";
  }
  return message;
}

function escapeHtml(input) {
  return String(input || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function getClientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function isContactRateLimited(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxSubmissions = 5;
  const current = contactRateLimits.get(ip) || [];
  const recent = current.filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= maxSubmissions) {
    contactRateLimits.set(ip, recent);
    return true;
  }
  recent.push(now);
  contactRateLimits.set(ip, recent);
  return false;
}

async function sendBrevoEmail(payload) {
  let lastError;
  for (let attempt = 1; attempt <= BREVO_MAX_RETRIES + 1; attempt += 1) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        signal: AbortSignal.timeout(BREVO_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          "api-key": BREVO_API_KEY,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const messageText = result?.message || result?.error || `Brevo request failed (HTTP ${response.status}).`;
        const error = new Error(messageText);
        error.status = response.status;
        error.result = result;
        throw error;
      }
      return result;
    } catch (err) {
      lastError = err;
      const isNetworkError = err?.name === "TimeoutError" || err?.cause?.code === "UND_ERR_CONNECT_TIMEOUT" || err?.cause?.code === "UND_ERR_HEADERS_TIMEOUT" || err?.cause?.code === "ECONNRESET";
      const retryableStatus = [408, 429, 500, 502, 503, 504].includes(Number(err?.status));
      if (attempt > BREVO_MAX_RETRIES || (!isNetworkError && !retryableStatus)) break;
      await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

function getFirebaseConfig() {
  const cfg = (() => {
    try {
      return functions.config?.() || {};
    } catch {
      return {};
    }
  })();

  return cfg;
}

function getGeminiConfig() {
  const cfg = getFirebaseConfig();
  const numberedKeys = getNumberedGeminiKeys(process.env);
  const csvKeys = parseCsv(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || cfg?.gemini?.api_keys || cfg?.gemini?.api_key);
  const keys = [...new Set([...numberedKeys, ...csvKeys])];
  const fallbackModels = parseCsv(process.env.GEMINI_FALLBACK_MODELS || cfg?.gemini?.fallback_models);

  return {
    keys,
    model: process.env.GEMINI_MODEL || cfg?.gemini?.model || "gemini-2.5-flash",
    fallbackModels,
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
"hospitals_list" (array of exactly 10 nearby hospitals, sorted nearest first; include at least 2-3 government hospitals where available; each item must include "name", "distance_km", and "type" as Government or Private),
"schools_list" (array of exactly 10 nearby schools, sorted nearest first; include at least 2-3 government schools where available; each item must include "name", "distance_km", and "type" as Government or Private),
"malls_list" (array of exactly 10 nearby malls, shopping centres, supermarkets, or major markets, sorted nearest first; each item must include "name" and "distance_km"),
"gardens_list" (array of exactly 10 nearby public gardens, parks, or lake parks, sorted nearest first; each item must include "name" and "distance_km"),
"tourism_list" (array of exactly 10 nearby tourist spots, landmarks, or attractions, sorted nearest first; each item must include "name" and "distance_km"),
"restaurants_list" (array of exactly 10 nearby restaurants, cafes, or popular food places, sorted nearest first; each item must include "name" and "distance_km"),
"highway" (array of at least 3 nearest main highways/NH/SH roads, sorted nearest first; each item must include "name" and "distance_km"),
"orr_access" (array of at least 2 nearest ORR exits/gates/interchanges, sorted nearest first; each item must include "name" and "distance_km"),
"rail_access" (array that must include Secunderabad Railway Station with "distance_km", plus nearby main MMTS stations and railway stations with "name" and "distance_km"),
"local_transport" (array of nearby proper bus stands, TSRTC stops, bus depots, and public transport hubs, sorted nearest first; each item must include "name" and "distance_km")`;
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

let geminiQueue = Promise.resolve();
let lastGeminiCallAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runGeminiQueued(task) {
  const run = geminiQueue.then(async () => {
    const elapsed = Date.now() - lastGeminiCallAt;
    const waitMs = GEMINI_REQUEST_INTERVAL_MS - elapsed;
    if (waitMs > 0) await sleep(waitMs);
    lastGeminiCallAt = Date.now();
    return task();
  });
  geminiQueue = run.catch(() => {});
  return run;
}

app.get("/api/config", (_req, res) => {
  const { keys, model, fallbackModels } = getGeminiConfig();
  res.json({
    geminiKeyCount: keys.length,
    geminiModels: [...new Set([model, ...fallbackModels])],
    geminiRequestIntervalMs: GEMINI_REQUEST_INTERVAL_MS,
  });
});

async function callGeminiModel(model, apiKey, locality, budget) {
  const response = await runGeminiQueued(() =>
    fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(locality, budget) }] }],
        }),
      }
    )
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result?.error?.message || `Gemini request failed (HTTP ${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    const error = new Error("Empty Gemini response.");
    error.status = 502;
    throw error;
  }

  return parseGeminiJson(rawText);
}

app.post("/api/contact", async (req, res) => {
  try {
    if (!BREVO_API_KEY || BREVO_API_KEY === "PASTE_BREVO_API_KEY_HERE") {
      return res.status(500).json({ error: "Contact mail service is not configured." });
    }
    if (isContactRateLimited(req)) {
      return res.status(429).json({ error: "Too many contact submissions. Please try again later." });
    }

    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const subject = String(req.body?.subject || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: "Name, email, subject, and message are required." });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const htmlContent = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone || "Not provided")}</p>
      <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(message).replaceAll("\n", "<br>")}</p>
    `;

    const result = await sendBrevoEmail({
      sender: { email: CONTACT_FROM_EMAIL, name: CONTACT_FROM_NAME },
      to: [{ email: CONTACT_TO_EMAIL, name: "AsliProperty" }],
      replyTo: { email, name },
      subject: `Website Contact - ${subject}`,
      htmlContent,
    });

    res.json({ ok: true, messageId: result?.messageId || null });
  } catch (err) {
    console.error("Contact email failed:", err);
    const isTimeout = err?.name === "TimeoutError" || err?.cause?.code === "UND_ERR_CONNECT_TIMEOUT";
    res.status(isTimeout ? 504 : 500).json({
      error: isTimeout
        ? "Brevo email service timed out. Please try again."
        : "Failed to send contact email.",
    });
  }
});

app.post("/api/analyze", async (req, res) => {
  try {
    const { keys, model, fallbackModels } = getGeminiConfig();
    if (!keys.length) {
      return res.status(500).json({ error: "Missing Gemini API keys on backend." });
    }

    const locality = String(req.body?.locality || "").trim();
    const budget = String(req.body?.budget || "").trim();
    if (!locality) {
      return res.status(400).json({ error: "Locality is required." });
    }

    let data;
    let lastError;
    const attempts = [];
    for (const modelCandidate of [...new Set([model, ...fallbackModels])]) {
      for (const [keyIndex, apiKey] of keys.entries()) {
        try {
          data = await callGeminiModel(modelCandidate, apiKey, locality, budget);
          console.log(`Analyze succeeded with Gemini model ${modelCandidate} using key #${keyIndex + 1}`);
          break;
        } catch (err) {
          lastError = err;
          attempts.push({
            model: modelCandidate,
            keyIndex: keyIndex + 1,
            status: err?.status,
            message: summarizeGeminiError(err),
            retryable: GEMINI_RETRYABLE_STATUSES.has(Number(err?.status)),
          });
          console.warn(`Analyze failed with Gemini model ${modelCandidate}, key #${keyIndex + 1}:`, summarizeGeminiError(err));
        }
      }
      if (data) break;
    }

    if (!data) {
      return res.status(lastError?.status || 500).json({
        error: "All Gemini keys failed for this request.",
        clientMessage: getGeminiClientMessage(lastError),
        lastError: summarizeGeminiError(lastError),
        attempts: getGeminiAttemptSummary(attempts),
      });
    }

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

export const api = functions.https.onRequest(app);

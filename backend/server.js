import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "dotenv/config";
import express from "express";
import Razorpay from "razorpay";
import { findGo111Village } from "./data/go111Villages.js";
import {
  applyGoogleVerifiedInsights,
  buildGoogleVerifiedInsights,
} from "./services/googleMaps.js";

const app = express();

const PORT = Number(process.env.PORT || 4242);
const GEMINI_REQUEST_INTERVAL_MS = Math.max(0, Number(process.env.GEMINI_REQUEST_INTERVAL_MS || 1000));
const BREVO_API_KEY = String(process.env.BREVO_API_KEY || "").trim();
const CONTACT_TO_EMAIL = String(process.env.CONTACT_TO_EMAIL || "info@asliproperty.in").trim();
const CONTACT_FROM_EMAIL = String(process.env.CONTACT_FROM_EMAIL || CONTACT_TO_EMAIL).trim();
const CONTACT_FROM_NAME = String(process.env.CONTACT_FROM_NAME || "AsliProperty Website").trim();
const BREVO_TIMEOUT_MS = Math.max(1000, Number(process.env.BREVO_TIMEOUT_MS || 30000));
const BREVO_MAX_RETRIES = Math.max(0, Number(process.env.BREVO_MAX_RETRIES || 2));
const GEMINI_MAX_RETRIES = Math.max(0, Number(process.env.GEMINI_MAX_RETRIES || 0));
const AI_PROVIDER_TIMEOUT_MS = Math.max(5000, Number(process.env.AI_PROVIDER_TIMEOUT_MS || 15000));
const INSIGHT_CACHE_VERSION = Number(process.env.INSIGHT_CACHE_VERSION || 4);
const RAZORPAY_KEY_ID = String(process.env.RAZORPAY_KEY_ID || "").trim();
const RAZORPAY_KEY_SECRET = String(process.env.RAZORPAY_KEY_SECRET || "").trim();
const PAYMENT_CURRENCY = String(process.env.PAYMENT_CURRENCY || "INR").trim().toUpperCase();
const PAYMENT_BASE_AMOUNT_PAISE = Math.max(100, Number(process.env.PAYMENT_BASE_AMOUNT_PAISE || 29900));
const PAYMENT_GST_PERCENT = Math.max(0, Number(process.env.PAYMENT_GST_PERCENT || 18));
const FRONTEND_ORIGINS = parseCsv(
  process.env.FRONTEND_ORIGINS,
  "https://asliproperty.in,https://www.asliproperty.in,https://property-1b194.web.app,https://property-1b194.firebaseapp.com,http://localhost:4242,http://localhost:4243,http://127.0.0.1:4242,http://127.0.0.1:4243"
);
const contactRateLimits = new Map();
const razorpay = RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET
  ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
  : null;

function isAllowedCorsOrigin(origin) {
  if (!origin) return false;
  const configuredOrigins = [
    ...parseCsv(process.env.CORS_ORIGINS),
    ...FRONTEND_ORIGINS,
  ];
  if (configuredOrigins.includes("*")) return true;
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

function parseCsv(value, fallback = "") {
  return String(value ?? fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeInsightCachePart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\bhyderabad\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getInsightCacheKey(locality) {
  return normalizeInsightCachePart(locality);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function readInsightCache() {
  try {
    const raw = await fs.readFile(insightCachePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    if (err?.code === "ENOENT") return {};
    console.warn("Insight cache read failed:", err.message);
    return {};
  }
}

async function getCachedInsight(locality) {
  const key = getInsightCacheKey(locality);
  const cache = await readInsightCache();
  const entry = cache[key];
  if (!entry?.data) return null;
  if (Number(entry.cacheVersion || 0) !== INSIGHT_CACHE_VERSION) return null;
  return cloneJson(entry.data);
}

async function saveCachedInsight(locality, data) {
  const key = getInsightCacheKey(locality);
  if (!key || !data || typeof data !== "object") return;

  const cache = await readInsightCache();
  cache[key] = {
    locality: String(locality || "").trim(),
    updatedAt: new Date().toISOString(),
    cacheVersion: INSIGHT_CACHE_VERSION,
    data: cloneJson(data),
  };
  await fs.mkdir(path.dirname(insightCachePath), { recursive: true });
  await fs.writeFile(insightCachePath, `${JSON.stringify(cache, null, 2)}\n`);
}

function getNumberedGeminiKeys(env) {
  const keys = [];
  for (let index = 1; index <= 100; index += 1) {
    const key = String(env[`GEMINI_API_KEY_${index}`] || "").trim();
    if (key) keys.push(key);
  }
  return keys;
}

function getGeminiApiKeys() {
  const paidKeys = parseCsv(
    process.env.GOOGLE_PAID_API_KEY
      || process.env.GEMINI_PAID_API_KEY
  );
  const numberedKeys = getNumberedGeminiKeys(process.env);
  const csvKeys = parseCsv(process.env.GEMINI_API_KEYS);
  return [...new Set([...paidKeys, ...numberedKeys, ...csvKeys])];
}

const GEMINI_API_KEYS = getGeminiApiKeys();
function getNumberedKeys(prefix, env) {
  const keys = [];

  for (let i = 1; i <= 100; i++) {
    const key = String(env[`${prefix}_${i}`] || "").trim();

    if (key) {
      keys.push(key);
    }
  }

  return keys;
}

const GROQ_API_KEYS = getNumberedKeys("GROQ_API_KEY", process.env);

const OPENROUTER_API_KEYS = getNumberedKeys(
  "OPENROUTER_API_KEY",
  process.env
);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_FALLBACK_MODELS = parseCsv(
  process.env.GEMINI_FALLBACK_MODELS
);

const GEMINI_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const GROQ_MODEL =
  process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

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

const GEMINI_KEY_FORMAT_WARNINGS = GEMINI_API_KEYS
  .map((key, index) => ({ key, index: index + 1 }))
  .filter(({ key }) => !key.startsWith("AIza"))
  .map(({ index }) => `#${index}`);

if (GEMINI_KEY_FORMAT_WARNINGS.length) {
  console.warn(`Gemini key format warning for keys: ${GEMINI_KEY_FORMAT_WARNINGS.join(", ")}. REST API keys usually start with "AIza".`);
}

let geminiQueue = Promise.resolve();
let lastGeminiCallAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const frontendDir = path.join(repoRoot, "Property Analyzer");
const uploadsDir = path.join(repoRoot, "uploads");
const insightCachePath = path.join(__dirname, "data", "freeInsightCache.json");
const maxUploadBytes = 10 * 1024 * 1024;

app.use(applyCors);
app.use(express.json({ limit: "1mb" }));

// Serve the existing frontend so it runs on http://localhost:<PORT>/ (no CORS issues).
app.use(express.static(frontendDir));
app.use("/uploads", express.static(uploadsDir));

app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

app.get("/api/config", (_req, res) => {
  const payment = getAuditPaymentBreakdown();
  res.json({
    geminiKeyCount: GEMINI_API_KEYS.length,
    geminiModels: getGeminiModelCandidates(),
    geminiRequestIntervalMs: GEMINI_REQUEST_INTERVAL_MS,
    razorpayKeyId: RAZORPAY_KEY_ID,
    payment,
  });
});

function getAuditPaymentBreakdown() {
  const gstAmount = Math.round((PAYMENT_BASE_AMOUNT_PAISE * PAYMENT_GST_PERCENT) / 100);
  return {
    baseAmount: PAYMENT_BASE_AMOUNT_PAISE,
    gstAmount,
    gstPercent: PAYMENT_GST_PERCENT,
    amount: PAYMENT_BASE_AMOUNT_PAISE + gstAmount,
    currency: PAYMENT_CURRENCY,
  };
}

function isMissingRazorpayConfig() {
  return !razorpay || !RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET;
}

app.post("/api/create-order", async (req, res) => {
  try {
    if (isMissingRazorpayConfig()) {
      return res.status(500).json({ error: "Razorpay is not configured on the backend." });
    }

    const payment = getAuditPaymentBreakdown();
    const requestedAmount = Number(req.body?.amount || payment.amount);
    const currency = String(req.body?.currency || payment.currency).trim().toUpperCase();
    const receipt = safeSegment(req.body?.receipt || `audit_${Date.now()}`) || `audit_${Date.now()}`;

    if (!Number.isInteger(requestedAmount) || requestedAmount < 100) {
      return res.status(400).json({ error: "Amount must be at least 100 paise." });
    }
    if (requestedAmount !== payment.amount || currency !== payment.currency) {
      return res.status(400).json({ error: "Invalid payment amount or currency." });
    }

    const order = await razorpay.orders.create({
      amount: payment.amount,
      currency: payment.currency,
      receipt,
      notes: {
        service: "AsliProperty Full Audit",
        baseAmount: String(payment.baseAmount),
        gstAmount: String(payment.gstAmount),
        gstPercent: String(payment.gstPercent),
      },
    });

    return res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      payment,
    });
  } catch (err) {
    console.error("Razorpay order creation failed:", err);
    const status = Number(err?.statusCode || err?.status || err?.error?.code);
    if (status === 401 || /auth|credential/i.test(String(err?.message || ""))) {
      return res.status(401).json({ error: "Razorpay authentication failed." });
    }
    return res.status(500).json({ error: "Failed to create Razorpay order." });
  }
});

app.post("/api/verify-payment", (req, res) => {
  try {
    if (isMissingRazorpayConfig()) {
      return res.status(500).json({ error: "Razorpay is not configured on the backend." });
    }

    const orderId = String(req.body?.razorpay_order_id || "").trim();
    const paymentId = String(req.body?.razorpay_payment_id || "").trim();
    const signature = String(req.body?.razorpay_signature || "").trim();

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: "Payment ID, order ID, and signature are required." });
    }

    const generatedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const expected = Buffer.from(generatedSignature, "hex");
    const received = Buffer.from(signature, "hex");
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      return res.status(400).json({ error: "Payment signature verification failed." });
    }

    return res.json({ ok: true, payment_id: paymentId, order_id: orderId });
  } catch (err) {
    console.error("Razorpay signature verification failed:", err);
    return res.status(500).json({ error: "Failed to verify Razorpay payment." });
  }
});

function safeFileName(fileName) {
  const cleaned = String(fileName || "document")
    .trim()
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "document";
}

function decodeHeaderValue(value, fallback) {
  try {
    return decodeURIComponent(String(value || fallback));
  } catch {
    return String(value || fallback);
  }
}

function safeSegment(value) {
  return String(value || "")
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

app.post(
  "/api/upload-document/:trackId",
  express.raw({ type: "application/octet-stream", limit: maxUploadBytes }),
  async (req, res) => {
    try {
      const trackId = safeSegment(req.params.trackId);
      if (!trackId) return res.status(400).json({ error: "Track ID is required." });
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: "File body is required." });
      }

      const originalName = decodeHeaderValue(req.header("x-file-name"), "document");
      const contentType = String(req.header("x-file-type") || "application/octet-stream");
      const fileName = `${Date.now()}_${safeFileName(originalName)}`;
      const relativeDir = path.join("auditOrders", trackId, "documents");
      const absoluteDir = path.join(uploadsDir, relativeDir);
      await fs.mkdir(absoluteDir, { recursive: true });

      const absolutePath = path.join(absoluteDir, fileName);
      await fs.writeFile(absolutePath, req.body);

      const publicPath = `/uploads/${relativeDir.replaceAll(path.sep, "/")}/${encodeURIComponent(fileName)}`;
      res.json({
        name: originalName,
        url: `${req.protocol}://${req.get("host")}${publicPath}`,
        type: contentType,
        size: req.body.length,
        storagePath: publicPath,
      });
    } catch (err) {
      if (err?.type === "entity.too.large") {
        return res.status(413).json({ error: "File is too large. Maximum allowed size is 10 MB." });
      }
      console.error("Upload failed:", err);
      res.status(500).json({ error: "Failed to upload document." });
    }
  }
);

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

function getPromptLocality(locality) {
  const normalized = normalizeInsightCachePart(locality).replace(/\s+/g, "");
  if (normalized === "suncity" || normalized === "suncityhyderabad") {
    return "Suncity, Bandlaguda Jagir, Hyderabad";
  }
  return `${locality}, Hyderabad`;
}

// function buildPrompt(locality, budget) {
//   return `Analyze market intelligence for the locality: ${getPromptLocality(locality)}. User Budget: ${budget}.
// Return ONLY a valid JSON with these keys:
// "price" (approx price range per sqft/sqyd),
// "appreciation" (3-year growth %),
// "go111" (SAFE or AFFECTED),
// "zoning" (Master plan zone),
// "metro" (nearest operational Hyderabad Metro station and road distance from the exact locality; do not return railway/MMTS stations here),
// "metro_stations" (array of exactly 3 nearest operational Hyderabad Metro stations, sorted nearest first; each item must include "name", "distance_km", and "line"),
// "hospitals_list" (array of exactly 10 nearby hospitals, sorted nearest first; include at least 2-3 government hospitals where available; each item must include "name", "distance_km", and "type" as Government or Private),
// "schools_list" (array of exactly 10 nearby schools, sorted nearest first; include at least 2-3 government schools where available; each item must include "name", "distance_km", and "type" as Government or Private),
// "malls_list" (array of exactly 10 nearby malls, shopping centres, supermarkets, or major markets, sorted nearest first; each item must include "name" and "distance_km"),
// "gardens_list" (array of exactly 10 nearby public gardens, parks, or lake parks, sorted nearest first; each item must include "name" and "distance_km"),
// "tourism_list" (array of exactly 10 nearby tourist spots, landmarks, or attractions, sorted nearest first; each item must include "name" and "distance_km"),
// "restaurants_list" (array of exactly 10 nearby restaurants, cafes, or popular food places, sorted nearest first; each item must include "name" and "distance_km"),
// "highway" (array of at least 3 nearest main highways/NH/SH roads, sorted nearest first; each item must include "name" and "distance_km"),
// "orr_access" (array of at least 2 nearest ORR exits/gates/interchanges, sorted nearest first; each item must include "name" and "distance_km"),
// "rail_access" (array that must include Secunderabad Railway Station with "distance_km", plus nearby main MMTS stations and railway stations with "name" and "distance_km"),
// "local_transport" (array of nearby proper bus stands, TSRTC stops, bus depots, and public transport hubs, sorted nearest first; each item must include "name" and "distance_km")`;
// }

function buildPrompt(locality, budget) {
  return `Analyze market intelligence for the locality: ${getPromptLocality(locality)}. User Budget: ${budget}.

Return ONLY a valid JSON with these keys:

"price" (approx price range per sqft/sqyd),
"appreciation" (3-year growth %),
"go111" (SAFE or AFFECTED),
"zoning" (Master plan zone),
"summary" (short 2-3 sentence investment/locality summary),

"metro" (fallback only; backend will verify and overwrite this),
"metro_stations" (fallback only; backend will verify and overwrite this),

"hospitals_list" (fallback only; backend will replace with Google Places when available),

"schools_list" (fallback only; backend will replace with Google Places when available),

"malls_list" (fallback only; backend will replace with Google Places when available),

"gardens_list" (fallback only; backend will replace with Google Places when available),

"tourism_list" (fallback only; backend will replace with Google Places when available),

"restaurants_list" (fallback only; backend will replace with Google Places when available),

"highway" (array of at least 3 nearest highways/NH/SH roads; include "name" and "distance_km"),

"orr_access" (array of at least 2 nearest ORR exits; include "name" and "distance_km"),

"rail_access" (array including Secunderabad Railway Station and nearby MMTS stations; include "name" and "distance_km"),

"local_transport" (array of nearby TSRTC bus stands/stops; include "name" and "distance_km").

IMPORTANT:
- Do not guess metro stations or metro distances.
- Backend will verify metro and nearby amenities using Google APIs.
- If unsure, return "Not Available" instead of inventing data.
- Never return fictional metro stations, hospitals, schools, malls or distances.
`;
}

function parseGeminiJson(text) {
  const cleanText = String(text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(cleanText);
}

async function applyInsightValidations(data, locality) {
  if (!data || typeof data !== "object") return data;

  try {
    const verifiedInsights = await buildGoogleVerifiedInsights(locality);
    applyGoogleVerifiedInsights(data, verifiedInsights);
  } catch (err) {
    console.warn("Google insight verification failed:", err.message);
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

  return data;
}

function getGeminiModelCandidates() {
  return [...new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS])];
}

async function callGroqModel(apiKey, locality, budget) {
  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      signal: AbortSignal.timeout(AI_PROVIDER_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "user",
            content: buildPrompt(locality, budget),
          },
        ],
      }),
    }
  );

  const result = await response.json();

  const text =
    result?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("Groq returned empty response");
  }

  return parseGeminiJson(text);
}

async function callOpenRouterModel(apiKey, locality, budget) {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      signal: AbortSignal.timeout(AI_PROVIDER_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: "user",
            content: buildPrompt(locality, budget),
          },
        ],
      }),
    }
  );

  const result = await response.json();

  const text =
    result?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("OpenRouter returned empty response");
  }

  return parseGeminiJson(text);
}

async function callAI(locality, budget) {

  // 1. Try Gemini first
  for (const model of getGeminiModelCandidates()) {
    for (const apiKey of GEMINI_API_KEYS) {
      try {
        return await callGeminiModel(model, apiKey, locality, budget);
      } catch (err) {
        console.log("Gemini failed:", err.message);
      }
    }
  }

  // 2. Try Groq
  for (const apiKey of GROQ_API_KEYS) {
    try {
      return await callGroqModel(apiKey, locality, budget);
    } catch (err) {
      console.log("Groq failed:", err.message);
    }
  }

  // 3. Try OpenRouter
  for (const apiKey of OPENROUTER_API_KEYS) {
    try {
      return await callOpenRouterModel(apiKey, locality, budget);
    } catch (err) {
      console.log("OpenRouter failed:", err.message);
    }
  }

  throw new Error("All AI providers failed");
}

async function callGeminiModel(model, apiKey, locality, budget) {
  let lastError;
  for (let attempt = 0; attempt <= GEMINI_MAX_RETRIES; attempt += 1) {
    if (attempt > 0) await sleep(1000 * attempt);

    const response = await runGeminiQueued(() =>
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          signal: AbortSignal.timeout(AI_PROVIDER_TIMEOUT_MS),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: buildPrompt(locality, budget) }] }],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        }
      )
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = result?.error?.message || `Gemini request failed (HTTP ${response.status}).`;
      const error = new Error(message);
      error.status = response.status;
      lastError = error;
      if (!GEMINI_RETRYABLE_STATUSES.has(Number(response.status)) || attempt >= GEMINI_MAX_RETRIES) {
        throw error;
      }
      continue;
    }

    const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      const error = new Error("Empty Gemini response.");
      error.status = 502;
      lastError = error;
      if (attempt >= GEMINI_MAX_RETRIES) throw error;
      continue;
    }

    return parseGeminiJson(rawText);
  }

  throw lastError || new Error("Gemini request failed.");
}

app.post("/api/analyze", async (req, res) => {
  try {
    const locality = String(req.body?.locality || "").trim();
    const budget = String(req.body?.budget || "").trim();
    if (!locality) {
      return res.status(400).json({ error: "Locality is required." });
    }

    let data;
    const cachedData = await getCachedInsight(locality);
    if (cachedData) {
      await applyInsightValidations(cachedData, locality);
      await saveCachedInsight(locality, cachedData);
      return res.json({ data: cachedData, cached: true });
    }

    if (!GEMINI_API_KEYS.length && !GROQ_API_KEYS.length && !OPENROUTER_API_KEYS.length) {
      return res.status(500).json({ error: "Missing AI provider API keys on backend." });
    }

    try {
      data = await callAI(locality, budget);
      await applyInsightValidations(data, locality);
    } catch (err) {
      return res.status(500).json({
        error: err?.message || "All AI providers failed",
      });
    }

    await saveCachedInsight(locality, data);

    res.json({ data, cached: false });
  } catch (err) {
    console.error("Analyze failed:", err);
    res.status(500).json({ error: "Failed to analyze locality." });
  }
});

app.use((err, _req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "File is too large. Maximum allowed size is 10 MB." });
  }
  return next(err);
});

app.listen(PORT, () => {
  console.log(`Backend running: http://localhost:${PORT}/`);
});
console.log("Gemini Keys:", GEMINI_API_KEYS.length);
console.log("Groq Keys:", GROQ_API_KEYS.length);
console.log("OpenRouter Keys:", OPENROUTER_API_KEYS.length);

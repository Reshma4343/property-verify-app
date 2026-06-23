import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "dotenv/config";
import express from "express";
import { findGo111Village } from "./data/go111Villages.js";

const app = express();

const PORT = Number(process.env.PORT || 4242);
const GEMINI_REQUEST_INTERVAL_MS = Math.max(0, Number(process.env.GEMINI_REQUEST_INTERVAL_MS || 1000));
const BREVO_API_KEY = String(process.env.BREVO_API_KEY || "").trim();
const CONTACT_TO_EMAIL = String(process.env.CONTACT_TO_EMAIL || "info@asliproperty.in").trim();
const CONTACT_FROM_EMAIL = String(process.env.CONTACT_FROM_EMAIL || CONTACT_TO_EMAIL).trim();
const CONTACT_FROM_NAME = String(process.env.CONTACT_FROM_NAME || "AsliProperty Website").trim();
const BREVO_TIMEOUT_MS = Math.max(1000, Number(process.env.BREVO_TIMEOUT_MS || 30000));
const BREVO_MAX_RETRIES = Math.max(0, Number(process.env.BREVO_MAX_RETRIES || 2));
const FRONTEND_ORIGINS = parseCsv(
  process.env.FRONTEND_ORIGINS,
  "https://asliproperty.in,https://www.asliproperty.in,https://property-1b194.web.app,https://property-1b194.firebaseapp.com,http://localhost:4242,http://localhost:4243,http://127.0.0.1:4242,http://127.0.0.1:4243"
);
const contactRateLimits = new Map();

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

function getGeminiApiKeys() {
  const numberedKeys = getNumberedGeminiKeys(process.env);
  const csvKeys = parseCsv(process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY);
  return [...new Set([...numberedKeys, ...csvKeys])];
}

const GEMINI_API_KEYS = getGeminiApiKeys();
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_FALLBACK_MODELS = parseCsv(process.env.GEMINI_FALLBACK_MODELS);

const GEMINI_RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function summarizeGeminiError(err) {
  return String(err?.message || err || "Unknown Gemini error").split("\n")[0];
}

function getGeminiAttemptSummary(attempts) {
  return attempts
    .map((attempt) => `model ${attempt.model}, key #${attempt.keyIndex}: HTTP ${attempt.status || "error"} - ${attempt.message}`)
    .join(" | ");
}

const GEMINI_KEY_FORMAT_WARNINGS = GEMINI_API_KEYS
  .map((key, index) => ({ key, index: index + 1 }))
  .filter(({ key }) => !key.startsWith("AIza") && !key.startsWith("AQ."))
  .map(({ index }) => `#${index}`);

if (GEMINI_KEY_FORMAT_WARNINGS.length) {
  console.warn(`Gemini key format warning for keys: ${GEMINI_KEY_FORMAT_WARNINGS.join(", ")}`);
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
const maxUploadBytes = 10 * 1024 * 1024;

app.use((req, res, next) => {
  const origin = String(req.headers.origin || "");
  if (origin && (FRONTEND_ORIGINS.includes("*") || FRONTEND_ORIGINS.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-file-name,x-file-type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
});

app.use(express.json({ limit: "1mb" }));

// Serve the existing frontend so it runs on http://localhost:<PORT>/ (no CORS issues).
app.use(express.static(frontendDir));
app.use("/uploads", express.static(uploadsDir));

app.get("/api/config", (_req, res) => {
  res.json({
    geminiKeyCount: GEMINI_API_KEYS.length,
    geminiModels: getGeminiModelCandidates(),
    geminiRequestIntervalMs: GEMINI_REQUEST_INTERVAL_MS,
  });
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

function getGeminiModelCandidates() {
  return [...new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS])];
}

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

app.post("/api/analyze", async (req, res) => {
  try {
    if (!GEMINI_API_KEYS.length) {
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
    for (const model of getGeminiModelCandidates()) {
      for (const [keyIndex, apiKey] of GEMINI_API_KEYS.entries()) {
        try {
          data = await callGeminiModel(model, apiKey, locality, budget);
          console.log(`Analyze succeeded with Gemini model ${model} using key #${keyIndex + 1}`);
          break;
        } catch (err) {
          lastError = err;
          attempts.push({
            model,
            keyIndex: keyIndex + 1,
            status: err?.status,
            message: summarizeGeminiError(err),
            retryable: GEMINI_RETRYABLE_STATUSES.has(Number(err?.status)),
          });
          console.warn(`Analyze failed with Gemini model ${model}, key #${keyIndex + 1}:`, summarizeGeminiError(err));
        }
      }
      if (data) break;
    }

    if (!data) {
      return res.status(lastError?.status || 500).json({
        error: "All Gemini keys failed for this request.",
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

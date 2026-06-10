import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "dotenv/config";
import express from "express";
import { findGo111Village } from "./data/go111Villages.js";

const app = express();

const PORT = Number(process.env.PORT || 4242);
const GEMINI_REQUEST_INTERVAL_MS = Math.max(0, Number(process.env.GEMINI_REQUEST_INTERVAL_MS || 1000));

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

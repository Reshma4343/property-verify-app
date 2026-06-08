import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "dotenv/config";
import express from "express";
import { findGo111Village } from "./data/go111Villages.js";

const app = express();

const PORT = Number(process.env.PORT || 4242);
const GEMINI_API_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "")
  .split(",")
  .map((key) => key.trim())
  .filter(Boolean);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || "gemini-2.0-flash,gemini-2.0-flash-lite")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);

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
  res.json({ geminiKeyCount: GEMINI_API_KEYS.length });
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
    for (const model of getGeminiModelCandidates()) {
      for (const [keyIndex, apiKey] of GEMINI_API_KEYS.entries()) {
        try {
          data = await callGeminiModel(model, apiKey, locality, budget);
          console.log(`Analyze succeeded with Gemini model ${model} using key #${keyIndex + 1}`);
          break;
        } catch (err) {
          lastError = err;
          console.warn(`Analyze failed with Gemini model ${model}, key #${keyIndex + 1}:`, err?.message || err);
          if (![429, 500, 502, 503, 504].includes(Number(err?.status))) break;
        }
      }
      if (data) break;
    }

    if (!data) {
      return res.status(lastError?.status || 500).json({
        error: lastError?.message || "Failed to analyze locality.",
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

import "dotenv/config";
import express from "express";
import functions from "firebase-functions";

const app = express();
app.use(express.json({ limit: "1mb" }));

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
  const keys = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || cfg?.gemini?.api_keys || cfg?.gemini?.api_key || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const fallbackModels = (process.env.GEMINI_FALLBACK_MODELS || cfg?.gemini?.fallback_models || "gemini-2.0-flash,gemini-2.0-flash-lite")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

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
  const { keys } = getGeminiConfig();
  res.json({ geminiKeyCount: keys.length });
});

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
    for (const modelCandidate of [...new Set([model, ...fallbackModels])]) {
      for (const [keyIndex, apiKey] of keys.entries()) {
        try {
          data = await callGeminiModel(modelCandidate, apiKey, locality, budget);
          console.log(`Analyze succeeded with Gemini model ${modelCandidate} using key #${keyIndex + 1}`);
          break;
        } catch (err) {
          lastError = err;
          console.warn(`Analyze failed with Gemini model ${modelCandidate}, key #${keyIndex + 1}:`, err?.message || err);
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
  } catch (e) {
    console.error("Analyze failed:", e);
    res.status(500).json({ error: "Failed to analyze locality." });
  }
});

export const api = functions.https.onRequest(app);

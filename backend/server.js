import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import "dotenv/config";
import express from "express";
import Razorpay from "razorpay";

const app = express();

const PORT = Number(process.env.PORT || 4242);
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

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


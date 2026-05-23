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

app.get("/api/config", (_req, res) => {
  try {
    const { keyId } = getRazorpayClient();
    res.json({ razorpayKeyId: keyId });
  } catch (e) {
    res.status(500).json({ error: e?.message || "Config error" });
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


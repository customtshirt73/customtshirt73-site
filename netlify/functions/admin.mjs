// Private admin tools for the shop owner (used by admin.html).
// Needs a Netlify environment variable ADMIN_PASSWORD, plus the Square and Resend ones already set up.
// POST /api/admin  { password, action: "list" | "get" | "quote", ... }
import { getStore } from "@netlify/blobs";
import { timingSafeEqual, createHash } from "node:crypto";

const esc = s => String(s ?? "").replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const hash = s => createHash("sha256").update(String(s ?? "")).digest();
const sleep = ms => new Promise(r => setTimeout(r, ms));

function passwordOk(given) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) throw new Error("ADMIN_PASSWORD is not set in Netlify yet.");
  return timingSafeEqual(hash(given), hash(real));
}

async function listRequests(store) {
  const { blobs } = await store.list();
  const keys = blobs.map(b => b.key).filter(k => k.startsWith("REQ-")).sort().reverse().slice(0, 60);
  const out = [];
  for (const k of keys) {
    const r = await store.get(k, { type: "json" });
    if (!r) continue;
    const { photos, ...rest } = r;
    out.push({ ...rest, photoCount: (photos || []).length });
  }
  return out;
}

async function sendQuote(store, body, site) {
  const id = String(body.id || "");
  const r = await store.get(id, { type: "json" });
  if (!r) throw new Error("Request not found.");
  const price = Math.round(Number(body.price) * 100) / 100;
  if (!(price >= 1 && price <= 10000)) throw new Error("Please enter a price between $1 and $10,000.");
  const message = String(body.message || "").slice(0, 1500);

  // 1) Square payment link for the quoted price
  const host = process.env.SQUARE_ENV === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
  const sq = await fetch(host + "/v2/online-checkout/payment-links", {
    method: "POST",
    headers: { "Authorization": "Bearer " + process.env.SQUARE_ACCESS_TOKEN, "Content-Type": "application/json", "Square-Version": "2024-10-17" },
    body: JSON.stringify({
      idempotency_key: id + "-" + Date.now(),
      quick_pay: { name: `Custom shirt design ${id}`, price_money: { amount: Math.round(price * 100), currency: "USD" }, location_id: process.env.SQUARE_LOCATION_ID },
      pre_populated_data: { buyer_email: r.email },
      payment_note: `Design request ${id} - ${r.name}`
    })
  });
  const sqData = await sq.json();
  if (!sq.ok) { console.error(JSON.stringify(sqData)); throw new Error("Square could not make the payment link."); }
  const link = sqData.payment_link.url;

  // 2) Try to email the customer (Resend only allows this once your domain is verified in Resend)
  let emailed = false, emailError = "";
  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || "CustomTshirt73 <onboarding@resend.dev>",
        to: [r.email],
        reply_to: process.env.ORDER_EMAIL,
        subject: `Your custom shirt price - ${id}`,
        html: `<p>${esc(message).replace(/\n/g, "<br>")}</p>
          <p style="font-size:20px"><b>Price: $${price.toFixed(2)}</b></p>
          <p><a href="${link}" style="display:inline-block;background:#c8323a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Pay securely with Square</a></p>
          <p>Questions? Reply to this email or call/text 220-204-0090.</p><p>CustomTshirt73<br>${site}</p>`
      })
    });
    if (res.ok) emailed = true; else { emailError = (await res.text()).slice(0, 300); console.error("customer email failed", emailError); }
  }

  r.status = "quoted";
  r.quote = { price, link, message, at: new Date().toISOString(), emailed };
  await store.setJSON(id, r);
  return { link, emailed, emailError, email: r.email, name: r.name };
}

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const body = await req.json();
    if (!passwordOk(body.password)) { await sleep(1000); return Response.json({ error: "Wrong password" }, { status: 401 }); }
    const store = getStore("requests");
    if (body.action === "list") return Response.json({ requests: await listRequests(store) });
    if (body.action === "get") {
      const r = await store.get(String(body.id || ""), { type: "json" });
      return r ? Response.json(r) : Response.json({ error: "Request not found." }, { status: 404 });
    }
    if (body.action === "quote") return Response.json(await sendQuote(store, body, new URL(req.url).origin));
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 400 });
  }
};

export const config = { path: "/api/admin" };

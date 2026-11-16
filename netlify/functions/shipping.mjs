// Live USPS shipping prices for the checkout.
// Netlify environment variables needed: USPS_CLIENT_ID, USPS_CLIENT_SECRET
const FROM_ZIP = "43232";      // where orders ship from
const OZ_PER_SHIRT = 5;        // weight of one shirt
const USPS = "https://apis.usps.com";

// Shipping choices shown to the customer. Rate types are tried in order until USPS accepts one.
const SERVICES = [
  { id: "USPS_GROUND_ADVANTAGE", name: "USPS Ground Advantage",     days: "2-5 business days", ind: ["SP"] },
  { id: "PRIORITY_MAIL",         name: "USPS Priority Mail",        days: "1-3 business days", ind: ["SP"] },
  { id: "PRIORITY_MAIL_EXPRESS", name: "USPS Priority Mail Express", days: "1-2 business days", ind: ["PA", "SP"] }
];

// Packaging grows with the order: poly mailer, small box, big box.
function parcel(qty) {
  if (qty <= 3)  return { packOz: 3,  length: 12, width: 10, height: 2 };
  if (qty <= 10) return { packOz: 8,  length: 14, width: 12, height: 6 };
  return            { packOz: 16, length: 18, width: 14, height: 10 };
}

let cached = { token: null, until: 0 };
async function getToken() {
  if (cached.token && Date.now() < cached.until) return cached.token;
  const creds = { grant_type: "client_credentials", client_id: process.env.USPS_CLIENT_ID, client_secret: process.env.USPS_CLIENT_SECRET };
  let r = await fetch(USPS + "/oauth2/v3/token", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(creds)
  });
  if (!r.ok) {   // some USPS setups only take form-encoded logins
    r = await fetch(USPS + "/oauth2/v3/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(creds)
    });
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) { console.error("USPS login failed", r.status, JSON.stringify(d)); throw new Error("Could not connect to USPS right now."); }
  cached = { token: d.access_token, until: Date.now() + ((parseInt(d.expires_in) || 3600) - 300) * 1000 };
  return cached.token;
}

async function priceFor(token, svc, zip, lb, p) {
  const mailingDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  for (const rateIndicator of svc.ind) {
    const r = await fetch(USPS + "/prices/v3/base-rates/search", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({
        originZIPCode: FROM_ZIP, destinationZIPCode: zip, weight: lb,
        length: p.length, width: p.width, height: p.height,
        mailClass: svc.id, processingCategory: "MACHINABLE", rateIndicator,
        destinationEntryFacilityType: "NONE", priceType: "RETAIL", mailingDate
      })
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && typeof d.totalBasePrice === "number")
      return { id: svc.id, name: svc.name, days: svc.days, price: Math.round(d.totalBasePrice * 100) / 100 };
    console.error("USPS price failed", svc.id, rateIndicator, r.status, JSON.stringify(d));
  }
  return null;
}

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const { zip, qty } = await req.json();
    const z = String(zip || "").trim().slice(0, 5);
    const q = parseInt(qty) || 0;
    if (!/^\d{5}$/.test(z)) throw new Error("Please enter a 5-digit ZIP code.");
    if (q < 1 || q > 500) throw new Error("Your cart is empty.");
    const p = parcel(q);
    const lb = Math.ceil((q * OZ_PER_SHIRT + p.packOz) / 16 * 10) / 10;
    if (lb > 70) throw new Error("That order is too big to ship in one box. Please call or text 220-204-0090 and we'll sort out shipping.");
    if (!process.env.USPS_CLIENT_ID || !process.env.USPS_CLIENT_SECRET) throw new Error("Shipping isn't set up yet.");
    const token = await getToken();
    const rates = (await Promise.all(SERVICES.map(s => priceFor(token, s, z, lb, p)))).filter(Boolean);
    if (!rates.length) throw new Error("USPS prices aren't available right now.");
    return Response.json({ zip: z, qty: q, weightLb: lb, rates });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 400 });
  }
};

export const config = { path: "/api/shipping" };

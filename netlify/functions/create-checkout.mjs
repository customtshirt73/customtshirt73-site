// Creates a Square payment link and emails the order to the shop.
// Netlify environment variables needed:
//   SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_ENV ("production" or "sandbox")
//   RESEND_API_KEY, ORDER_EMAIL (where orders go), FROM_EMAIL (optional)
//   USPS_CLIENT_ID, USPS_CLIENT_SECRET (used by shipping.mjs for delivery prices)
import { getStore } from "@netlify/blobs";

// Prices live here on the server so customers can't change them.
const STYLES = { tee: 24, heavy: 29, longsleeve: 32, hoodie: 46 };
const SIZE_UP = { xs:0, s:0, m:0, l:0, xl:0, "2xl":3, "3xl":3, "4xl":5 };
const BACK_PRINT = 6;   // extra if both sides printed
const PICKUP_PLACE = "2750 S Hamilton Rd, Columbus, OH 43232 (inside Saraga International Grocery)";

function unitPrice(it){
  const base = STYLES[it.style]; if(base===undefined) throw new Error("bad style");
  const up = SIZE_UP[it.size]; if(up===undefined) throw new Error("bad size");
  return base + up + (it.front && it.back ? BACK_PRINT : 0);
}
function discount(q){ return q>=12 ? 0.20 : q>=6 ? 0.10 : 0; }
// One design can be ordered in several sizes (group orders). Older carts send just size + qty.
function itemLines(it){
  const raw = Array.isArray(it.lines) && it.lines.length ? it.lines.slice(0, 20) : [{ size: it.size, qty: it.qty }];
  return raw.map(l => ({ size: String(l.size), qty: Math.max(0, Math.min(500, parseInt(l.qty) || 0)) })).filter(l => l.qty > 0);
}
const esc = s => String(s??"").replace(/[<>&"]/g, c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]));

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const { items, customer } = await req.json();
    if (!Array.isArray(items) || !items.length || items.length > 20) throw new Error("empty cart");
    if (!customer?.name || !customer?.email) throw new Error("missing details");
    const ship = customer.delivery === "ship";
    customer.delivery = ship ? "ship" : "pickup";
    if (ship && (!customer.address || !/^\d{5}/.test(String(customer.zip || "").trim())))
      throw new Error("please enter your shipping address and ZIP code");
    if (!ship && !customer.phone)
      throw new Error("please add a phone number so we can tell you when your order is ready");

    const site = new URL(req.url).origin;
    const orderId = "CT73-" + Date.now().toString(36).toUpperCase();
    let totalShirts = 0;
    const lineItems = items.flatMap(it => {
      const lines = itemLines(it);
      const total = lines.reduce((s, l) => s + l.qty, 0);
      if (!total) throw new Error("no sizes picked");
      if (total > 500) throw new Error("too many shirts in one item");
      totalShirts += total;
      const d = discount(total);   // bulk discount counts every size of the same design
      return lines.map(l => ({
        name: `${it.styleName} - ${it.colorName} - ${l.size.toUpperCase()}`.slice(0,500),
        quantity: String(l.qty),
        note: (it.summary || "").slice(0, 400),
        base_price_money: { amount: Math.round(unitPrice({ ...it, size: l.size }) * (1 - d) * 100), currency: "USD" }
      }));
    });

    // Shipping: get the price again from USPS here, so the customer can't change it
    let shipping = null;
    if (ship) {
      const r = await fetch(site + "/api/shipping", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip: String(customer.zip).trim().slice(0, 5), qty: totalShirts })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "could not get the shipping price");
      shipping = (d.rates || []).find(x => x.id === customer.shipService);
      if (!shipping) throw new Error("please pick a shipping option");
      lineItems.push({
        name: "Shipping - " + shipping.name, quantity: "1",
        base_price_money: { amount: Math.round(shipping.price * 100), currency: "USD" }
      });
    }

    // Save full order (with print files) in Netlify Blobs
    const store = getStore("orders");
    await store.setJSON(orderId, { orderId, created: new Date().toISOString(), customer, items,
      delivery: ship ? { method: "ship", service: shipping.name, price: shipping.price } : { method: "pickup", place: PICKUP_PLACE },
      status: "awaiting payment" });

    // Square payment link
    const host = process.env.SQUARE_ENV === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
    const sq = await fetch(host + "/v2/online-checkout/payment-links", {
      method: "POST",
      headers: { "Authorization": "Bearer " + process.env.SQUARE_ACCESS_TOKEN,
                 "Content-Type": "application/json", "Square-Version": "2024-10-17" },
      body: JSON.stringify({
        idempotency_key: orderId,
        order: { location_id: process.env.SQUARE_LOCATION_ID, reference_id: orderId, line_items: lineItems },
        checkout_options: { redirect_url: site + "/thanks.html?order=" + orderId, ask_for_shipping_address: false },
        pre_populated_data: { buyer_email: customer.email },
        payment_note: "Online order " + orderId + (ship ? " (ship " + shipping.name + ")" : " (store pickup)")
      })
    });
    const sqData = await sq.json();
    if (!sq.ok) { console.error(JSON.stringify(sqData)); throw new Error("Square checkout failed"); }

    // Email the shop with the order + print files attached
    if (process.env.RESEND_API_KEY && process.env.ORDER_EMAIL) {
      const attachments = [];
      items.forEach((it, i) => {
        for (const side of ["front","back"]) {
          const d = it.files?.[side];
          if (d && d.startsWith("data:image/png;base64,"))
            attachments.push({ filename: `${orderId}-item${i+1}-${side}-print.png`, content: d.split(",")[1] });
          const m = it.mockups?.[side];
          if (m && m.startsWith("data:image/png;base64,"))
            attachments.push({ filename: `${orderId}-item${i+1}-${side}-mockup.png`, content: m.split(",")[1] });
        }
      });
      const rows = items.map((it,i)=>` Item ${i+1}: ${esc(it.styleName)}, ${esc(it.colorName)}, sizes ${itemLines(it).map(l=>esc(l.size).toUpperCase()+' x '+l.qty).join(', ')} ${esc(it.summary)} `).join("");
      const deliveryHtml = ship
        ? ` SHIP by ${esc(shipping.name)} ($${shipping.price.toFixed(2)}, ${totalShirts} shirts) to:
           ${esc(customer.address)}, ${esc(customer.city)} ${esc(customer.state)} ${esc(customer.zip)} `
        : ` STORE PICKUP - call or text the customer when it's ready. `;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.FROM_EMAIL || "Orders <onboarding@resend.dev>",
          to: [process.env.ORDER_EMAIL],
          reply_to: customer.email,
          subject: `New order ${orderId} (awaiting payment) - ${ship ? "SHIP" : "PICKUP"} - ${customer.name}`,
          html: ` Order ${orderId} Check Square to confirm it was paid before printing.
                 ${esc(customer.name)} ${esc(customer.email)} ${esc(customer.phone)}
                 ${deliveryHtml}
                 Notes: ${esc(customer.notes)} ${rows} `,
          attachments
        })
      }).catch(e => console.error("email failed", e));
    }

    return Response.json({ orderId, url: sqData.payment_link.url });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 400 });
  }
};

export const config = { path: "/api/checkout" };

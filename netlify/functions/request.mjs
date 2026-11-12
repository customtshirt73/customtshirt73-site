// "Design it for me": a customer sends an idea (and photos), and it is emailed to the shop for a quote.
// Uses the same Netlify environment variables as checkout: RESEND_API_KEY, ORDER_EMAIL, FROM_EMAIL (optional)
import { getStore } from "@netlify/blobs";

const MAX_BYTES = 5_500_000;   // Netlify functions accept about 6 MB
const str = (v, max) => String(v ?? "").trim().slice(0, max);
const esc = s => String(s ?? "").replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const raw = await req.text();
    if (raw.length > MAX_BYTES) return Response.json({ error: "Your photos are too big. Please try fewer or smaller photos." }, { status: 413 });
    const b = JSON.parse(raw);

    const r = {
      name: str(b.name, 100), email: str(b.email, 150), phone: str(b.phone, 30),
      idea: str(b.idea, 1500), style: str(b.style, 40), color: str(b.color, 40),
      sizes: str(b.sizes, 200), needBy: str(b.needBy, 20)
    };
    if (!r.name || !r.idea) throw new Error("Please add your name and your idea.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) throw new Error("Please check your email address.");
    const photos = (Array.isArray(b.photos) ? b.photos : []).slice(0, 3)
      .filter(p => typeof p === "string" && /^data:image\/(jpeg|png);base64,/.test(p));

    const id = "REQ-" + Date.now().toString(36).toUpperCase();
    await getStore("requests").setJSON(id, { id, created: new Date().toISOString(), ...r, photos, status: "new" });

    if (!process.env.RESEND_API_KEY || !process.env.ORDER_EMAIL) throw new Error("email is not set up");
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || "Orders <onboarding@resend.dev>",
        to: [process.env.ORDER_EMAIL],
        reply_to: r.email,
        subject: `Design request ${id} - ${r.name}`,
        html: `<h2>Design request ${id}</h2>
          <p>The customer is waiting for a quote. Reply to this email to answer them.</p>
          <p><b>Their idea:</b><br>${esc(r.idea).replace(/\n/g, "<br>")}</p>
          <p><b>Shirt:</b> ${esc(r.style)}, ${esc(r.color)}<br><b>How many / sizes:</b> ${esc(r.sizes) || "not given"}<br>
             <b>Needed by:</b> ${esc(r.needBy) || "not given"}</p>
          <p><b>${esc(r.name)}</b><br>${esc(r.email)}<br>${esc(r.phone)}</p>
          <p>${photos.length} photo(s) attached.</p>`,
        attachments: photos.map((p, i) => ({
          filename: `${id}-photo${i + 1}.${p.startsWith("data:image/png") ? "png" : "jpg"}`,
          content: p.split(",")[1]
        }))
      })
    });
    if (!sent.ok) { console.error("email failed", await sent.text()); throw new Error("email failed"); }

    return Response.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 400 });
  }
};

export const config = { path: "/api/request" };

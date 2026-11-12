// Saves a customer's design so it can be shared with a link, and loads it back.
// POST /api/design            -> saves the design, returns { id }
// GET  /api/design?id=XXXX    -> returns the saved design
import { getStore } from "@netlify/blobs";

const MAX_BYTES = 5_500_000;   // Netlify functions accept about 6 MB
const num = (v, lo, hi, def) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def; };
const str = (v, max) => String(v ?? "").slice(0, max);

function cleanEl(e) {
  if (!e || (e.type !== "text" && e.type !== "img")) return null;
  const out = { type: e.type, size: num(e.size, .05, 2, .5), x: num(e.x, 0, 1, .5), y: num(e.y, 0, 1, .4), rot: num(e.rot, -180, 180, 0) };
  if (e.type === "img") {
    if (typeof e.src !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(e.src)) return null;
    out.src = e.src; out.ar = num(e.ar, .01, 100, 1);
  } else {
    out.text = str(e.text, 60); out.font = str(e.font, 40); out.color = str(e.color, 20); out.stroke = str(e.stroke, 20);
    out.strokeW = num(e.strokeW, 0, 10, 0); out.curve = num(e.curve, -100, 100, 0); out.bold = !!e.bold; out.italic = !!e.italic;
  }
  return out;
}

export default async (req) => {
  const store = getStore("designs");
  try {
    if (req.method === "GET") {
      const id = new URL(req.url).searchParams.get("id") || "";
      if (!/^[a-z0-9]{6,20}$/i.test(id)) return Response.json({ error: "bad link" }, { status: 400 });
      const d = await store.get(id, { type: "json" });
      return d ? Response.json(d) : Response.json({ error: "design not found" }, { status: 404 });
    }
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const raw = await req.text();
    if (raw.length > MAX_BYTES) return Response.json({ error: "design is too big to share" }, { status: 413 });
    const body = JSON.parse(raw);
    const els = {};
    for (const side of ["front", "back"]) {
      els[side] = (Array.isArray(body?.els?.[side]) ? body.els[side] : []).slice(0, 30).map(cleanEl).filter(Boolean);
    }
    if (!els.front.length && !els.back.length) return Response.json({ error: "empty design" }, { status: 400 });

    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    await store.setJSON(id, { style: str(body.style, 20), color: str(body.color, 20), els, created: new Date().toISOString() });
    return Response.json({ id });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "could not save design" }, { status: 400 });
  }
};

export const config = { path: "/api/design" };

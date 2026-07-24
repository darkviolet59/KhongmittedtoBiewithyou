// Cloudflare Worker — photo storage for the "Us" app, backed by R2.
// Required binding (Settings → Variables and Bindings → R2 bucket): name it BUCKET.

const SUPABASE_URL  = "https://opwhxntgpeiygmmgdukt.supabase.co";
const SUPABASE_ANON = "sb_publishable_EXtkLx6pH7xavaSL78hFMQ_aw-mCl6M";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Token, Authorization",
  "Access-Control-Max-Age": "86400"
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}

// Confirm the caller is a signed-in user of your app.
async function verify(token) {
  if (!token) return false;
  try {
    const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
      headers: { Authorization: "Bearer " + token, apikey: SUPABASE_ANON }
    });
    return r.ok;
  } catch (e) { return false; }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const BUCKET = env.BUCKET;

    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    // Health check
    if (request.method === "GET" && (path === "/" || path === "")) {
      return new Response(
        "Us photo worker OK · " + (BUCKET ? "bucket connected ✓" : "NO bucket binding ✗"),
        { headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    if (!BUCKET) return json({ error: "no bucket binding" }, 500);

    // Storage usage (total bytes + photo count)
    if (request.method === "GET" && path === "/usage") {
      let bytes = 0, count = 0, cursor = undefined;
      do {
        const list = await BUCKET.list({ cursor, limit: 1000 });
        for (const o of list.objects) { bytes += o.size || 0; count++; }
        cursor = list.truncated ? list.cursor : undefined;
      } while (cursor);
      return json({ bytes, count });
    }

    // Serve a photo
    if (request.method === "GET" && path.startsWith("/file/")) {
      const key = decodeURIComponent(path.slice("/file/".length));
      const obj = await BUCKET.get(key);
      if (!obj) return new Response("Not found", { status: 404, headers: CORS });
      const headers = new Headers(CORS);
      obj.writeHttpMetadata(headers);
      headers.set("Cache-Control", "public, max-age=31536000");
      return new Response(obj.body, { headers });
    }

    // Upload a photo (signed-in users only)
    if (request.method === "POST" && path === "/upload") {
      if (!(await verify(request.headers.get("X-Token")))) return json({ error: "unauthorized" }, 401);
      const key = url.searchParams.get("key");
      if (!key) return json({ error: "missing key" }, 400);
      await BUCKET.put(key, request.body, {
        httpMetadata: { contentType: request.headers.get("Content-Type") || "image/jpeg" }
      });
      return json({ ok: true, key });
    }

    // Delete a photo (signed-in users only)
    if (request.method === "POST" && path === "/delete") {
      if (!(await verify(request.headers.get("X-Token")))) return json({ error: "unauthorized" }, 401);
      const key = url.searchParams.get("key");
      if (!key) return json({ error: "missing key" }, 400);
      await BUCKET.delete(key);
      return json({ ok: true });
    }

    return new Response("Not found", { status: 404, headers: CORS });
  }
};

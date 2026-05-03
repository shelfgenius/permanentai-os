/**
 * Cloudflare Worker — Tunnel URL Registry
 * GET  /get          → returnează URL-ul curent
 * POST /set?url=...  → setează URL-ul (necesită token)
 */

export default {
  async fetch(request, env) {
    const TOKEN = env.TUNNEL_TOKEN || "pai-tunnel-2024";
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "*";

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (url.pathname === "/get") {
      const tunnelUrl = await env.TUNNEL_STORE.get("tunnel_url");
      return Response.json(
        { url: tunnelUrl || null, ts: await env.TUNNEL_STORE.get("tunnel_ts") },
        { headers: cors }
      );
    }

    if (url.pathname === "/set" && request.method === "POST") {
      const token = url.searchParams.get("token") || request.headers.get("X-Token");
      if (token !== TOKEN) {
        return Response.json({ error: "unauthorized" }, { status: 401, headers: cors });
      }
      const newUrl = url.searchParams.get("url");
      if (!newUrl || !newUrl.startsWith("https://")) {
        return Response.json({ error: "url invalid" }, { status: 400, headers: cors });
      }
      await env.TUNNEL_STORE.put("tunnel_url", newUrl);
      await env.TUNNEL_STORE.put("tunnel_ts", new Date().toISOString());
      return Response.json({ ok: true, url: newUrl }, { headers: cors });
    }

    return Response.json({ service: "Tunnel Registry", endpoints: ["/get", "/set"] }, { headers: cors });
  },
};

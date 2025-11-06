// Studio Yapad Downloader v4.1 — frontend + backend dans un seul Deno Deploy
// Sert automatiquement index.html + gère API TikTok/Instagram

import { serveFile } from "https://deno.land/std@0.224.0/http/file_server.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  const url = new URL(req.url);

  // 🧭 1. Si aucune query → renvoie le site (index.html)
  if (!url.searchParams.get("url") && !url.pathname.includes("/api")) {
    try {
      return await serveFile(req, "index.html");
    } catch {
      return new Response("index.html manquant", { status: 404 });
    }
  }

  // ✅ 2. OPTIONS (CORS)
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  // 🧩 3. Route API : /?url=...
  const link = url.searchParams.get("url");
  if (!link)
    return new Response(JSON.stringify({ error: "Lien manquant" }), { headers });

  try {
    let response, data;

    // ⚡ Instagram via snapsave.io proxy
    if (link.includes("instagram.com")) {
      const proxy = "https://snapsave.io/api/ajaxSearch";
      const body = new URLSearchParams({ q: link, lang: "en" });
      response = await fetch(proxy, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body,
      });
      data = await response.json();
      const html = data.data || "";
      const matches = [...html.matchAll(/href="([^"]+\.(mp4|jpg))"/g)];
      const media = matches.map((m) => m[1]);
      if (!media.length) throw new Error("Aucun média trouvé pour Instagram.");
      return new Response(
        JSON.stringify({ platform: "instagram", media, timestamp: Date.now() }),
        { headers }
      );
    }

    // ⚡ TikTok via tikwm.com
    if (link.includes("tiktok.com")) {
      response = await fetch("https://www.tikwm.com/api/", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ url: link }),
      });
      data = await response.json();
      if (!data.data || !data.data.play) throw new Error("Aucun média TikTok trouvé.");
      return new Response(
        JSON.stringify({
          platform: "tiktok",
          media: [data.data.play],
          music: data.data.music,
          author: data.data.author?.unique_id,
          caption: data.data.title,
          timestamp: Date.now(),
        }),
        { headers }
      );
    }

    return new Response(JSON.stringify({ error: "Lien non supporté" }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { headers });
  }
});

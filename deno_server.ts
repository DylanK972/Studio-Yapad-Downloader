// Studio Yapad Downloader v4 - 100% Deno Deploy compatible
// 🔥 Instagram & TikTok downloader via proxys fiables

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return new Response(JSON.stringify({ error: "Lien manquant." }), { headers });
  }

  try {
    let response, data;

    // 🟣 Instagram via snapinsta.app (proxy fiable)
    if (url.includes("instagram.com")) {
      const proxy = "https://snapsave.io/api/ajaxSearch";
      const body = new URLSearchParams({ q: url, lang: "en" });
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

    // 🔴 TikTok via tikwm API
    else if (url.includes("tiktok.com")) {
      response = await fetch("https://www.tikwm.com/api/", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ url }),
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

    return new Response(JSON.stringify({ error: "Lien non supporté." }), { headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { headers, status: 500 });
  }
});

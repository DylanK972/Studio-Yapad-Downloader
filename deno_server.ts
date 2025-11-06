// Studio Yapad Downloader v8.0 - Full Free Edition
// by Dylan KESSLER / Studio Yapad
// API-free: use Snapinsta (IG) & SssTik (TikTok)

import { serveFile } from "https://deno.land/std@0.224.0/http/file_server.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { extname } from "https://deno.land/std@0.224.0/path/mod.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === "OPTIONS") return new Response("ok", { headers });

  const link = url.searchParams.get("url");
  if (link) {
    try {
      let result;

      // 🟣 Instagram via Snapinsta.io API
      if (link.includes("instagram.com")) {
        const body = new URLSearchParams({ q: link, t: "media" });
        const res = await fetch("https://snapinsta.io/api/ajaxSearch", {
          method: "POST",
          headers: {
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          },
          body,
        });
        const data = await res.json();
        const html = data.data || "";
        const matches = [...html.matchAll(/href="([^"]+\.(mp4|jpg))"/g)];
        const media = matches.map((m) => m[1]);
        if (media.length === 0) throw new Error("Aucun média trouvé pour Instagram.");
        result = {
          platform: "instagram",
          source: "snapinsta.io",
          media,
          count: media.length,
          timestamp: Date.now(),
        };
      }

      // 🔴 TikTok via SssTik.io
      else if (link.includes("tiktok.com")) {
        const form = new URLSearchParams({ id: link, locale: "fr", count: "12" });
        const res = await fetch("https://ssstik.io/abc?url=dl", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: form,
        });
        const html = await res.text();
        const video = html.match(/https:\/\/[^"]+\.mp4/)?.[0];
        if (!video) throw new Error("Aucun média trouvé pour TikTok.");
        result = {
          platform: "tiktok",
          source: "ssstik.io",
          media: [video],
          timestamp: Date.now(),
        };
      }

      else {
        throw new Error("Lien non supporté.");
      }

      return new Response(JSON.stringify(result), { headers });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        headers,
        status: 500,
      });
    }
  }

  // 🗂️ Fichiers statiques
  const ext = extname(path);
  if (ext) {
    try {
      return await serveFile(req, `.${path}`);
    } catch {
      return new Response("Fichier introuvable", { status: 404 });
    }
  }

  // 🏠 Page d’accueil
  try {
    return await serveFile(req, "index.html");
  } catch {
    return new Response("index.html manquant", { status: 404 });
  }
});

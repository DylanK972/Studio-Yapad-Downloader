// Studio Yapad Downloader v6.0 — RapidAPI (TikTok + Instagram)
// by Dylan KESSLER / Studio Yapad

import { serveFile } from "https://deno.land/std@0.224.0/http/file_server.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { extname } from "https://deno.land/std@0.224.0/path/mod.ts";

// ✅ Ta clé RapidAPI (tu peux la déplacer en variable d'env si besoin)
const RAPID_KEY = "0b50a91b3bmsh3470b98d87091fdp16dd70jsna0750ececa79";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // 🔹 OPTIONS (CORS)
  if (req.method === "OPTIONS") return new Response("ok", { headers });

  // 🔹 API ?url=
  const link = url.searchParams.get("url");
  if (link) {
    try {
      let res, data, result;

      // 🟣 INSTAGRAM — API officielle RapidAPI
      if (link.includes("instagram.com")) {
        res = await fetch(
          `https://instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com/?url=${encodeURIComponent(
            link
          )}`,
          {
            method: "GET",
            headers: {
              "x-rapidapi-key": RAPID_KEY,
              "x-rapidapi-host":
                "instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com",
            },
          }
        );
        data = await res.json();

        if (!data.media || data.media.length === 0) {
          throw new Error("Aucun média trouvé pour Instagram.");
        }

        result = {
          platform: "instagram",
          media: data.media.map((m) => m.url || m),
          caption: data.caption || "",
          author: data.username || "inconnu",
          timestamp: Date.now(),
        };
      }

      // 🔴 TIKTOK — API officielle RapidAPI (No Watermark)
      else if (link.includes("tiktok.com")) {
        res = await fetch(
          `https://tiktok-download-video-no-watermark.p.rapidapi.com/tiktok/info?url=${encodeURIComponent(
            link
          )}`,
          {
            method: "GET",
            headers: {
              "x-rapidapi-key": RAPID_KEY,
              "x-rapidapi-host":
                "tiktok-download-video-no-watermark.p.rapidapi.com",
            },
          }
        );

        data = await res.json();

        if (!data.data || !data.data.video_link_nwm_hd) {
          throw new Error("Aucun média TikTok trouvé.");
        }

        result = {
          platform: "tiktok",
          caption: data.data.desc,
          author: data.data.author_nickname,
          avatar: data.data.author_avatar,
          cover: data.data.cover,
          music: data.data.music?.uri,
          media: [data.data.video_link_nwm_hd],
          timestamp: Date.now(),
        };
      } else {
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

  // 🔹 Fichiers statiques (HTML / CSS / JS)
  const fileExt = extname(path);
  if (fileExt) {
    try {
      return await serveFile(req, `.${path}`);
    } catch {
      return new Response("Fichier introuvable", { status: 404 });
    }
  }

  // 🔹 Par défaut → index.html
  try {
    return await serveFile(req, "index.html");
  } catch {
    return new Response("index.html manquant", { status: 404 });
  }
});
